/// @file console-planner.ts (server)
/// @notice The brain of the Agent Console. Turns a plain-English instruction
///         ("stake 1 ETH on Lido", "park 500 USDC at the best savings rate")
///         into a SAFE, human-readable execution plan — but ONLY ever mapped to
///         a skill that exists in the live catalogue and ONLY ever touching the
///         exact contract/function that skill's IPFS module declares.
///
///         Safety is structural: the planner cannot invent a target. Every plan
///         resolves to (activeSkill → declared contract → declared function), so
///         the worst an instruction can do is match the wrong certified skill —
///         never an arbitrary address. The user still signs every transaction.
///
///         Matching is deterministic (keyword/intent scoring over the real
///         catalogue) so it runs with no external API. An LLM planner can slot
///         in later behind the same interface.

import "server-only";
import { encodeFunctionData, isAddress, parseEther, parseUnits, type Hex } from "viem";
import { listSkills, type ApiSkill } from "./skills";
import { loadSkillModule, type SkillModule } from "./skill-module-loader";
import { explorerFor } from "./chains-rpc";
import { getPublicClient } from "./viem";
import { SKILL_CREDENTIAL_ABI, getAddresses } from "@/lib/contracts";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/// Built transaction the user will sign. Only produced when we can encode it
/// safely from a known function + a parsed amount; otherwise the plan still
/// shows the target + function, just without concrete calldata.
export type ConsoleTx = {
  to: string;
  value: string;        // wei, as string
  data: Hex;
  functionName: string;
  needsApproval?: string; // ERC-20 symbol that must be approved first
};

function assetDecimals(asset?: string): number {
  const a = (asset ?? "").toLowerCase();
  return a === "usdc" || a === "usdt" ? 6 : 18;
}

/// Encode the exact transaction for the certified function. Supports the
/// value-bearing staking entrypoints (no approval) and the common ERC-4626 /
/// wrap entrypoints (approval-first). Returns null when it can't build safely.
function buildTx(
  to: string,
  selector: string | undefined,
  amount: string | undefined,
  asset: string | undefined,
  agent: string | undefined
): ConsoleTx | null {
  if (!to || !selector || !amount) return null;
  const sel = selector.toLowerCase();
  try {
    switch (sel) {
      case "0xa1903eab": // Lido submit(address) payable
        return { to, value: parseEther(amount).toString(), functionName: "submit",
          data: encodeFunctionData({ abi: [{ name: "submit", type: "function", stateMutability: "payable", inputs: [{ name: "_referral", type: "address" }], outputs: [{ type: "uint256" }] }], functionName: "submit", args: [ZERO_ADDR] }) };
      case "0xd0e30db0": // deposit() payable (Rocket, ether.fi)
        return { to, value: parseEther(amount).toString(), functionName: "deposit",
          data: encodeFunctionData({ abi: [{ name: "deposit", type: "function", stateMutability: "payable", inputs: [], outputs: [] }], functionName: "deposit", args: [] }) };
      case "0xf6326fb3": // Renzo depositETH() payable
        return { to, value: parseEther(amount).toString(), functionName: "depositETH",
          data: encodeFunctionData({ abi: [{ name: "depositETH", type: "function", stateMutability: "payable", inputs: [], outputs: [] }], functionName: "depositETH", args: [] }) };
      case "0x72c51c0b": // Kelp depositETH(uint256,string) payable
        return { to, value: parseEther(amount).toString(), functionName: "depositETH",
          data: encodeFunctionData({ abi: [{ name: "depositETH", type: "function", stateMutability: "payable", inputs: [{ type: "uint256" }, { type: "string" }], outputs: [] }], functionName: "depositETH", args: [0n, ""] }) };
      case "0xea598cb0": // wstETH wrap(uint256) — approval-first
        return { to, value: "0", functionName: "wrap", needsApproval: "stETH",
          data: encodeFunctionData({ abi: [{ name: "wrap", type: "function", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] }], functionName: "wrap", args: [parseEther(amount)] }) };
      case "0x6e553f65": { // ERC-4626 deposit(uint256,address) — approval-first
        if (!agent || !isAddress(agent)) return null; // receiver required
        return { to, value: "0", functionName: "deposit", needsApproval: asset,
          data: encodeFunctionData({ abi: [{ name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }] }], functionName: "deposit", args: [parseUnits(amount, assetDecimals(asset)), agent as `0x${string}`] }) };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/// Does the agent already hold this skill's credential? (Sepolia SkillCredential)
async function checkOwned(agent: string, skillId: bigint): Promise<boolean | null> {
  if (!isAddress(agent)) return null;
  try {
    const client = getPublicClient();
    const addr = getAddresses();
    const r = await client.readContract({
      address: addr.SkillCredential,
      abi: SKILL_CREDENTIAL_ABI,
      functionName: "hasSkill",
      args: [agent as `0x${string}`, skillId],
    });
    return Boolean(r);
  } catch {
    return null;
  }
}

export type ConsoleAction = {
  verb: string;            // stake | swap | save | supply | restake | wrap | bridge | trade
  amount?: string;         // "1", "500"
  asset?: string;          // "ETH", "USDC"
};

export type ConsolePlan = {
  skillId: string;
  skillName: string;
  difficulty: number;
  chainId: number;
  chainName: string;
  owned: boolean | null;   // does the agent already hold this credential? null = unknown
  action: ConsoleAction;
  contract: { name: string; address: string; explorer: string | null };
  call: { functionName?: string; selector?: string };
  tx: ConsoleTx | null;    // the exact transaction to sign (when buildable)
  mode: "transaction" | "automation"; // one-shot vs an ongoing monitored strategy
  advantage: string;       // the concrete EDGE of the skill vs a raw tx (lever 1)
  optimization: {          // best-option comparison for yield/swap decisions (lever 1)
    label: string;
    options: { name: string; detail: string; best?: boolean }[];
  } | null;
  automation: string | null; // what the strategy monitors + acts on (lever 2)
  preview: string;         // one-line plain-English summary
  steps: string[];         // ordered human steps
  outcome: string;         // what the user ends up with
  safety: string[];        // why this is safe
  confidence: number;      // 0..1
};

export type PlanResult =
  | { ok: true; instruction: string; plan: ConsolePlan; alternatives: { skillId: string; name: string }[] }
  | { ok: false; instruction: string; reason: string; suggestions: { skillId: string; name: string }[] };

const CHAIN_NAME: Record<number, string> = {
  1: "Ethereum", 8453: "Base", 10: "Optimism", 42161: "Arbitrum", 11155111: "Sepolia",
};

// Intent verbs → the words a user might say. Used both to detect the action and
// to bias skill matching.
const VERB_SYNONYMS: Record<string, string[]> = {
  stake:   ["stake", "staking", "staked"],
  restake: ["restake", "restaking", "eigenlayer", "avs", "lrt"],
  swap:    ["swap", "trade", "exchange", "convert", "buy", "sell"],
  supply:  ["supply", "lend", "lending", "collateral"],
  save:    ["save", "savings", "park", "idle", "earn", "yield", "apr", "apy", "interest"],
  wrap:    ["wrap", "wrapping"],
  bridge:  ["bridge", "bridging", "move", "send to", "cross-chain", "crosschain"],
  deposit: ["deposit", "put", "allocate"],
};

const STOPWORDS = new Set([
  "the", "a", "an", "my", "me", "i", "to", "on", "in", "into", "with", "for", "of",
  "and", "at", "some", "please", "want", "would", "like", "get", "best", "via", "using",
  "use", "make", "do", "agent", "let", "can", "you", "it", "this", "that",
]);

// Common asset symbols we recognise in an instruction.
const ASSETS = ["eth", "weth", "steth", "wsteth", "reth", "ezeth", "rseth", "eeth", "sfrxeth",
  "usdc", "usdt", "dai", "usds", "usde", "susde", "susds", "sdai", "frxeth", "crv", "gmx"];

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9.\s-]/g, " ").split(/\s+/).filter(Boolean);
}

function detectVerb(tokens: string[]): string | null {
  for (const [verb, syns] of Object.entries(VERB_SYNONYMS)) {
    if (tokens.some((t) => syns.includes(t))) return verb;
  }
  return null;
}

function detectAmountAsset(raw: string): { amount?: string; asset?: string } {
  const amt = raw.match(/(\d[\d.,]*)/);
  const amount = amt ? amt[1].replace(/,/g, "") : undefined;
  // Asset = the MOST SPECIFIC symbol present (longest match), independent of the
  // amount, so "wrap 0.01 ETH to WETH" resolves to WETH (target), not ETH.
  const present = ASSETS.filter((sym) => new RegExp(`\\b${sym}\\b`, "i").test(raw))
    .sort((a, b) => b.length - a.length);
  const asset = present[0] ? present[0].toUpperCase() : undefined;
  return { amount, asset };
}

// ---------------------------------------------------------------------------
// The three "edge" levers: why a skill beats a raw tx (advantage), the best
// option among comparable skills (optimization), and whether it's a one-shot tx
// or an ongoing monitored strategy (automation).
// ---------------------------------------------------------------------------

/// Indicative MAINNET APYs for the yield/staking skills — used only for the
/// "best available rate" comparison shown in the plan. Clearly labelled
/// indicative; not a guarantee. Keyed by a substring of the skill name.
const INDICATIVE_APY: { match: RegExp; name: string; apy: number }[] = [
  { match: /ethena|susde/i, name: "Ethena sUSDe", apy: 12 },
  { match: /sky|susds/i, name: "Sky sUSDS", apy: 7.5 },
  { match: /maker|sdai|dsr/i, name: "Maker sDAI", apy: 6 },
  { match: /renzo|ezeth/i, name: "Renzo ezETH", apy: 4.2 },
  { match: /kelp|rseth/i, name: "Kelp rsETH", apy: 4.0 },
  { match: /ether\.?fi|eeth/i, name: "ether.fi eETH", apy: 3.6 },
  { match: /frax|sfrxeth/i, name: "Frax sfrxETH", apy: 3.5 },
  { match: /lido|steth/i, name: "Lido stETH", apy: 3.1 },
  { match: /rocket|reth/i, name: "Rocket Pool rETH", apy: 3.0 },
  { match: /compound/i, name: "Compound V3", apy: 4.5 },
  { match: /aave/i, name: "Aave V3", apy: 4.0 },
];

function classifyMode(name: string): "transaction" | "automation" {
  return /manager|rebalanc|auto[- ]?claim|health|harvest|delta[- ]?neutral|monitor|router/i.test(name)
    ? "automation"
    : "transaction";
}

function automationFor(name: string): string | null {
  if (classifyMode(name) !== "automation") return null;
  if (/health|aave/i.test(name)) return "Monitors your position's health factor and rebalances before it can be liquidated.";
  if (/rebalanc|lp/i.test(name)) return "Watches your LP range and rebalances when price drifts out of it, keeping capital productive.";
  if (/harvest|bribe/i.test(name)) return "Periodically claims and compounds rewards/bribes so they don't sit idle.";
  if (/router|yield/i.test(name)) return "Continuously routes funds to the best available rate as markets move.";
  if (/auto[- ]?claim|vesting/i.test(name)) return "Auto-claims each vesting unlock and reinvests it the moment it's available.";
  return "Runs as an ongoing strategy — NORMIE UNIVERSITY monitors and acts on your behalf within the skill's certified bounds.";
}

function advantageFor(verb: string | null, name: string): string {
  const n = name.toLowerCase();
  if (classifyMode(name) === "automation") return "An ongoing strategy, not a one-shot tx — it keeps working for you after you set it up.";
  if (verb === "swap" || /swap|router|1inch|aggregat/.test(n)) return "Best-price routing across venues with a slippage guard — better execution than a manual swap, with the revert simulated away before you sign.";
  if (verb === "save" || /saving|sdai|susds|susde|dsr|stable/.test(n)) return "Auto-picks the best available savings rate and handles the ERC-4626 deposit in one safe step.";
  if (verb === "restake" || /restak|ezeth|rseth|eigen/.test(n)) return "Restaking stacks extra AVS rewards on top of base staking yield — double yield in a single liquid position.";
  if (verb === "stake" || /stak|steth|reth|eeth/.test(n)) return "You receive a liquid staking token you can keep using as collateral while it earns.";
  if (verb === "wrap" || /wrap|wsteth/.test(n)) return "Turns your token into its DeFi-composable form in one click, ready to use anywhere.";
  if (verb === "bridge" || /bridge|across/.test(n)) return "Moves funds across chains via the fastest, cheapest route — no manual bridge hunting.";
  if (verb === "supply" || /supply|lend|aave|compound/.test(n)) return "Earns yield AND unlocks borrowing power, with the position tracked for you.";
  return "A safe, simulated, one-click version of a multi-step on-chain operation a non-expert would otherwise get wrong.";
}

/// For yield/staking intents, compare the relevant active skills by indicative
/// APY and mark the best — so the skill demonstrably optimises, vs a raw tx.
function optimizationFor(
  verb: string | null,
  matchedName: string,
  entries: Entry[]
): ConsolePlan["optimization"] {
  const isYield = verb === "save" || verb === "stake" || verb === "restake" ||
    /saving|stak|yield|susde|susds|sdai|reth|steth|eeth|ezeth|rseth/i.test(matchedName);
  if (!isYield) return null;

  // family: ETH-staking vs dollar-yield — compare like with like. Classify by
  // the TOKEN, not the word "staking" ("Ethena sUSDe Staking" is a stablecoin).
  const STABLE = /susde|susds|sdai|usde|usds|usdc|\bdai\b/i;
  const ETHLST = /steth|reth|eeth|ezeth|rseth|frxeth|wsteth|restak|eigen|lido|rocket/i;
  const fam = (n: string): "eth" | "dollar" => (ETHLST.test(n) && !STABLE.test(n) ? "eth" : "dollar");
  const target = fam(matchedName);
  const rows: { name: string; detail: string; best?: boolean; apy: number }[] = [];
  for (const e of entries) {
    const row = INDICATIVE_APY.find((r) => r.match.test(e.skill.name));
    if (!row) continue;
    if (fam(e.skill.name) !== target) continue;
    if (!rows.some((x) => x.name === row.name)) rows.push({ name: row.name, detail: `~${row.apy}% APY`, apy: row.apy });
  }
  const ethFamily = target === "eth";
  if (rows.length < 2) return null;
  rows.sort((a, b) => b.apy - a.apy);
  rows[0].best = true;
  return {
    label: ethFamily ? "Best ETH-staking yield (indicative)" : "Best stablecoin yield (indicative)",
    options: rows.slice(0, 4).map(({ name, detail, best }) => ({ name, detail, best })),
  };
}

// ---------------------------------------------------------------------------
// Catalogue cache: active skills keyed by their ON-CHAIN NAME only. Matching
// never needs the IPFS module — only the WINNING skill's module is fetched (at
// plan time), so a cold serverless invocation makes ~1 IPFS round-trip instead
// of one per skill. The skill list itself is one multicall.
// ---------------------------------------------------------------------------
type Entry = { skill: ApiSkill; keywords: Set<string> };
let CACHE: { at: number; entries: Entry[] } | null = null;
const TTL_MS = 5 * 60_000;

function nameKeywords(skill: ApiSkill): Set<string> {
  const kw = new Set<string>();
  const add = (s?: string) => { if (s) tokenize(s).forEach((t) => { if (!STOPWORDS.has(t) && t.length > 1) kw.add(t); }); };
  add(skill.name);
  add(skill.category?.label);
  return kw;
}

async function getCatalogue(): Promise<Entry[]> {
  if (CACHE && Date.now() - CACHE.at < TTL_MS) return CACHE.entries;
  const skills = await listSkills({ limit: 200, onlyActive: true });
  const entries: Entry[] = skills.map((skill) => ({ skill, keywords: nameKeywords(skill) }));
  CACHE = { at: Date.now(), entries };
  return entries;
}

/// Prime the catalogue cache so the first user request is fast. Safe to call
/// from a warmup route; never throws.
export async function warmConsoleCatalogue(): Promise<number> {
  try {
    const entries = await getCatalogue();
    return entries.length;
  } catch {
    return 0;
  }
}

function score(tokens: string[], verb: string | null, asset: string | undefined, e: Entry): number {
  let s = 0;
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    if (e.keywords.has(t)) s += 3;                 // direct keyword hit (protocol/skill name)
    else if ([...e.keywords].some((k) => k.includes(t) || t.includes(k))) s += 1; // partial
  }
  if (asset && e.keywords.has(asset.toLowerCase())) s += 2;
  // A SPECIFIC asset symbol appearing in the skill NAME is a very strong signal
  // (disambiguates "wrap ETH→WETH" #54 from "wrap stETH→wstETH" #51). Skip the
  // generic "ETH" — it appears in almost every name and would add no signal.
  if (asset && asset !== "ETH" && e.skill.name.toLowerCase().includes(asset.toLowerCase())) s += 5;
  // verb affinity: bias families by skill name/category. The action word
  // appearing literally in the skill NAME is the strongest signal; protocol
  // families are a weaker, secondary bias.
  const name = e.skill.name.toLowerCase();
  if (verb === "stake") { if (/stak/.test(name)) s += 4; else if (/steth|reth|eeth/.test(name)) s += 2; }
  if (verb === "restake") {
    if (/restak/.test(name)) s += 6;
    else if (/ezeth|rseth|eigen|renzo|kelp/.test(name)) s += 4;
    // plain liquid STAKING is not RE-staking — don't let it win a restake intent
    if (/liquid staking|wsteth| stake\b/.test(name) && !/restak/.test(name)) s -= 3;
  }
  if (verb === "swap") {
    if (/swap/.test(name)) s += 4;
    else if (/router|1inch|balancer|aerodrome|velodrome|aggregat/.test(name)) s += 2;
    if (/\blp\b|liquidity|rebalanc|position/.test(name)) s -= 3; // an LP skill is not a swap
  }
  if (verb === "save") { if (/saving|dsr/.test(name)) s += 4; else if (/sdai|susds|susde|stable/.test(name)) s += 2; }
  if (verb === "supply") { if (/supply|lend/.test(name)) s += 4; else if (/aave|compound/.test(name)) s += 2; }
  if (verb === "wrap" && /wrap|wsteth/.test(name)) s += 4;
  if (verb === "bridge" && /bridge|across/.test(name)) s += 4;
  return s;
}

function primaryContract(mod: SkillModule | null) {
  const c = (mod?.executable?.contracts ?? [])[0];
  return c ?? null;
}
function primarySelector(mod: SkillModule | null): { functionName?: string; selector?: string } {
  for (const c of mod?.executable?.contracts ?? []) {
    const f = (c.abi_fragments ?? [])[0];
    if (f?.selector) return { functionName: f.name, selector: f.selector };
  }
  return {};
}

/// OPTIONAL LLM refinement. When ANTHROPIC_API_KEY is set, Claude Haiku picks
/// the best-fitting skill for fuzzier instructions the keyword matcher misses
/// (e.g. "I want exposure to ETH staking but keep it liquid"). Returns the
/// chosen skillId or null; always falls back to the deterministic match.
async function llmRefine(instruction: string, entries: Entry[]): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const menu = entries.map((e) => `#${e.skill.skillId} ${e.skill.name}`).join("\n");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        system:
          "You map a user's DeFi intent to exactly ONE skill from the provided menu. " +
          "Reply with ONLY the numeric skill id (no #, no prose). If nothing fits, reply NONE.",
        messages: [{ role: "user", content: `Menu:\n${menu}\n\nInstruction: ${instruction}\n\nBest skill id:` }],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text: string = j?.content?.[0]?.text?.trim() ?? "";
    const id = text.match(/\d+/)?.[0];
    return id && entries.some((e) => e.skill.skillId === id) ? id : null;
  } catch {
    return null;
  }
}

export async function planInstruction(instruction: string, agent?: string): Promise<PlanResult> {
  const raw = instruction.trim();
  if (!raw) return { ok: false, instruction, reason: "Empty instruction.", suggestions: [] };

  const entries = await getCatalogue();
  if (entries.length === 0) {
    return { ok: false, instruction, reason: "No executable skills are available right now.", suggestions: [] };
  }

  const tokens = tokenize(raw);
  const verb = detectVerb(tokens);
  const { amount, asset } = detectAmountAsset(raw);

  const ranked = entries
    .map((e) => ({ e, s: score(tokens, verb, asset, e) }))
    .sort((a, b) => b.s - a.s);

  let top = ranked[0];
  // Weak keyword match → give the optional LLM planner a chance to pick a
  // better skill from the menu (no-op unless ANTHROPIC_API_KEY is configured).
  if (!top || top.s < 5) {
    const llmId = await llmRefine(raw, entries);
    if (llmId) {
      const picked = entries.find((x) => x.skill.skillId === llmId)!;
      top = { e: picked, s: Math.max(top?.s ?? 0, 5) };
    }
  }
  const suggestions = entries.slice(0, 5).map((e) => ({ skillId: e.skill.skillId, name: e.skill.name }));
  if (!top || top.s < 3) {
    return {
      ok: false,
      instruction,
      reason:
        "I couldn't confidently map that to a certified skill. Try naming the protocol or action — e.g. \"stake 1 ETH on Lido\" or \"earn yield on 500 USDC\".",
      suggestions,
    };
  }

  const { e } = top;
  // Load ONLY the winning skill's module (1 IPFS round-trip, retried) — this is
  // what keeps the cold-start fast. Everything below degrades gracefully if the
  // module can't be fetched (plan still shows the skill, just without a tx).
  const mod = await loadSkillModule(BigInt(e.skill.skillId)).catch(() => null);
  const contract = primaryContract(mod);
  const sel = primarySelector(mod);
  const chainId = Number(mod?.chain?.id ?? 1);
  const chainName = CHAIN_NAME[chainId] ?? `chain ${chainId}`;
  const verbLabel = verb ?? "interact with";

  // Credential ownership (if the caller passed an agent address) + the exact
  // transaction to sign (when we can encode it safely).
  const owned: boolean | null = agent ? await checkOwned(agent, BigInt(e.skill.skillId)) : null;
  const tx = buildTx(contract?.address ?? "", sel.selector, amount, asset, agent);

  const amountStr = amount ? `${amount}${asset ? " " + asset : ""}` : (asset ?? "your funds");
  const action: ConsoleAction = { verb: verbLabel, amount, asset };
  const explorer = contract?.address ? `${explorerFor(chainId)}/address/${contract.address}` : null;

  const plan: ConsolePlan = {
    skillId: e.skill.skillId,
    skillName: e.skill.name,
    difficulty: e.skill.difficulty.id,
    chainId,
    chainName,
    owned,
    action,
    contract: { name: contract?.name ?? "target contract", address: contract?.address ?? "", explorer },
    call: sel,
    tx,
    mode: classifyMode(e.skill.name),
    advantage: advantageFor(verb, e.skill.name),
    optimization: optimizationFor(verb, e.skill.name, entries),
    automation: automationFor(e.skill.name),
    preview: `${cap(verbLabel)} ${amountStr} via ${e.skill.name} on ${chainName}.`,
    steps: buildSteps(verbLabel, amountStr, e.skill.name, contract?.name, sel.functionName),
    outcome: mod?.verification?.criteria
      ? `On success the oracle verifies the on-chain action and mints credential #${e.skill.skillId} to your agent, updating its on-chain reputation.`
      : `Mints credential #${e.skill.skillId} to your agent on success.`,
    safety: [
      `This can only call ${contract?.name ?? "the contract"} (${short(contract?.address)}) — the exact address skill #${e.skill.skillId} declares. No other contract can be targeted.`,
      `You sign the transaction yourself. NORMIE UNIVERSITY never holds your keys or funds.`,
      `Runs on ${chainName}; the action is verified on-chain before any credential is issued.`,
      `This is a technical attestation, not financial advice — NORMIE UNIVERSITY does not guarantee outcomes, yields, or safety of third-party protocols.`,
    ],
    confidence: Math.min(1, top.s / 10),
  };

  const alternatives = ranked.slice(1, 4).filter((r) => r.s >= 3).map((r) => ({ skillId: r.e.skill.skillId, name: r.e.skill.name }));
  return { ok: true, instruction, plan, alternatives };
}

function buildSteps(verb: string, amount: string, skill: string, contractName?: string, fn?: string): string[] {
  const steps: string[] = [];
  if (/usdc|usdt|dai|usds|usde|frxeth|steth/i.test(amount)) {
    steps.push(`Approve ${amount} for ${contractName ?? "the contract"} (one-time per token).`);
  }
  steps.push(`Call ${fn ? `${fn}()` : "the certified function"} on ${contractName ?? skill}${amount ? ` with ${amount}` : ""}.`);
  steps.push(`The oracle confirms the transaction on-chain and issues your Soulbound credential.`);
  return steps;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "n/a");
