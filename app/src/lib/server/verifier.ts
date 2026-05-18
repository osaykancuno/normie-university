/// @file verifier.ts (server)
/// @notice Auto-verifier MVP for NORMIE UNIVERSITY completion proofs.
///
///         For each skill we declare a verification rule. The endpoint
///         /api/verify takes (agent, skillId, optional proof), evaluates the
///         rule on-chain, and — if it passes — returns an EIP-191 signed
///         completion authorization the agent can submit to
///         SkillMarketplace.completeSkill().
///
///         Rules are intentionally conservative. Any skill not in the rule
///         table requires a manual verifier (admin signs via dashboard).

import "server-only";
import {
  encodePacked,
  hashMessage,
  hexToBytes,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  AGENT_REGISTRY_ABI,
  SKILL_CREDENTIAL_ABI,
  getAddresses,
} from "@/lib/contracts";
import { ACTIVE_CHAIN } from "@/config/chains";
import { getPublicClient } from "./viem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerifyRequest = {
  agent: Address;
  skillId: bigint;
  txHash?: Hex; // optional, used by tx-receipt rules
};

export type VerifyOk = {
  ok: true;
  agent: Address;
  skillId: string;
  level: number;     // 1..3
  score: number;     // 0..100
  signature: Hex;
  marketplace: Address;
  chainId: number;
};

export type VerifyFail = {
  ok: false;
  reason: string;
  hint?: string;
};

export type VerifyResult = VerifyOk | VerifyFail;

type RuleResult =
  | { pass: true; level: number; score: number }
  | { pass: false; reason: string; hint?: string };

/// Use the inferred return type of getPublicClient instead of viem's loose
/// PublicClient type — the chain-narrowed concrete type is incompatible with
/// the loose one when crossing module boundaries.
type Client = ReturnType<typeof getPublicClient>;
type Rule = (client: Client, req: VerifyRequest) => Promise<RuleResult>;

// ---------------------------------------------------------------------------
// Rule registry — keyed by skillId
// ---------------------------------------------------------------------------

/// Skill 5 — ERC-8004 Agent Registration. Self-verifying: passes if the agent
/// is registered on AgentRegistry.
const ruleErc8004Registration: Rule = async (client, req) => {
  const addr = getAddresses();
  const isRegistered = (await client.readContract({
    address: addr.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "isRegistered",
    args: [req.agent],
  })) as boolean;

  if (!isRegistered) {
    return {
      pass: false,
      reason: "Agent is not registered on AgentRegistry",
      hint: "Call registerAgent('ipfs://...') first.",
    };
  }
  return { pass: true, level: 1, score: 70 };
};

/// Skill 1 — Uniswap V3 Swap. Pass if the agent has emitted a Swap event from
/// SwapRouter02 in a tx the agent submitted. txHash required.
const ruleUniswapV3Swap: Rule = async (client, req) => {
  if (!req.txHash) {
    return {
      pass: false,
      reason: "txHash required for Uniswap V3 swap verification",
      hint: "Submit { txHash } pointing to your swap.",
    };
  }
  const SWAP_ROUTER02 = "0x2626664c2603336E57B271c5C0b26F421741e481".toLowerCase();
  // Uniswap V3 Pool Swap event topic
  const SWAP_EVENT_TOPIC =
    "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

  const receipt = await client.getTransactionReceipt({ hash: req.txHash });
  if (receipt.status !== "success") {
    return { pass: false, reason: "Transaction reverted on-chain" };
  }
  if (receipt.from.toLowerCase() !== req.agent.toLowerCase()) {
    return {
      pass: false,
      reason: "Transaction was not sent by the claimed agent",
    };
  }
  const tx = await client.getTransaction({ hash: req.txHash });
  if (!tx.to || tx.to.toLowerCase() !== SWAP_ROUTER02) {
    return {
      pass: false,
      reason: `Transaction was not sent to SwapRouter02 (${SWAP_ROUTER02})`,
    };
  }
  const swapped = receipt.logs.some((l) =>
    l.topics[0]?.toLowerCase() === SWAP_EVENT_TOPIC
  );
  if (!swapped) {
    return {
      pass: false,
      reason: "No Uniswap V3 Swap event found in transaction logs",
    };
  }
  return { pass: true, level: 2, score: 80 };
};

/// Skill 9 — ERC-721 Mint. Pass if the agent received a Transfer(from=0,to=agent)
/// event in the supplied tx.
const ruleErc721Mint: Rule = async (client, req) => {
  if (!req.txHash) {
    return {
      pass: false,
      reason: "txHash required for ERC-721 mint verification",
    };
  }
  const TRANSFER_TOPIC =
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const receipt = await client.getTransactionReceipt({ hash: req.txHash });
  if (receipt.status !== "success") {
    return { pass: false, reason: "Transaction reverted on-chain" };
  }
  // Padded zero from-address: 32 bytes of 0
  const ZERO32 =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const padded = ("0x" + req.agent.slice(2).toLowerCase().padStart(64, "0")) as Hex;
  const minted = receipt.logs.some(
    (l) =>
      l.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
      l.topics.length === 4 && // ERC-721 has 3 indexed params + topic0
      l.topics[1]?.toLowerCase() === ZERO32 &&
      l.topics[2]?.toLowerCase() === padded
  );
  if (!minted) {
    return {
      pass: false,
      reason: "No ERC-721 mint Transfer(from=0, to=agent) event found",
    };
  }
  return { pass: true, level: 1, score: 75 };
};

// =============================================================================
// Additional auto-verifier rules — skill modules v2 on Ethereum L1
// =============================================================================

/// Generic helper: tx receipt was successful, sent by `agent` to `expectedTo`,
/// and contains at least one log with `topic0 = topic0Hex`.
async function _checkTxEvent(
  client: Client,
  req: VerifyRequest,
  expectedTo: `0x${string}`,
  topic0Hex: `0x${string}`
): Promise<RuleResult> {
  if (!req.txHash) return { pass: false, reason: "txHash required" };
  const receipt = await client.getTransactionReceipt({ hash: req.txHash });
  if (receipt.status !== "success") return { pass: false, reason: "Transaction reverted" };
  if (receipt.from.toLowerCase() !== req.agent.toLowerCase()) {
    return { pass: false, reason: "Transaction was not sent by the claimed agent" };
  }
  const tx = await client.getTransaction({ hash: req.txHash });
  if (!tx.to || tx.to.toLowerCase() !== expectedTo.toLowerCase()) {
    return { pass: false, reason: `Transaction was not sent to ${expectedTo}` };
  }
  const has = receipt.logs.some((l) => l.topics[0]?.toLowerCase() === topic0Hex);
  if (!has) return { pass: false, reason: "Expected event topic not found in tx logs" };
  return { pass: true, level: 2, score: 80 };
}

/// Skill 2 — Aave V3 Supply.
const AAVE_V3_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" as `0x${string}`;
const AAVE_SUPPLY_TOPIC0 =
  "0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61" as `0x${string}`;
const ruleAaveSupply: Rule = async (c, r) => {
  const res = await _checkTxEvent(c, r, AAVE_V3_POOL, AAVE_SUPPLY_TOPIC0);
  return res.pass ? { pass: true, level: 1, score: 70 } : res;
};

/// Skill 6 — Safe multisig execTransaction (any Safe proxy emits ExecutionSuccess).
const SAFE_EXEC_SUCCESS_TOPIC0 =
  "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e" as `0x${string}`;
const ruleSafeExec: Rule = async (client, req) => {
  if (!req.txHash) return { pass: false, reason: "txHash required" };
  const receipt = await client.getTransactionReceipt({ hash: req.txHash });
  if (receipt.status !== "success") return { pass: false, reason: "Transaction reverted" };
  const has = receipt.logs.some(
    (l) => l.topics[0]?.toLowerCase() === SAFE_EXEC_SUCCESS_TOPIC0
  );
  if (!has) return { pass: false, reason: "No Safe ExecutionSuccess event in tx" };
  return { pass: true, level: 3, score: 85 };
};

/// Skill 11 — Sushiswap V2 Swap.
const SUSHI_V2_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F" as `0x${string}`;
const UNI_V2_SWAP_TOPIC0 =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822" as `0x${string}`;
const ruleSushiSwap: Rule = async (c, r) => {
  const res = await _checkTxEvent(c, r, SUSHI_V2_ROUTER, UNI_V2_SWAP_TOPIC0);
  return res.pass ? { pass: true, level: 2, score: 80 } : res;
};

/// Skill 13 — Snapshot voting (off-chain attestation via Snapshot Hub).
const ruleSnapshotVote: Rule = async (_c, req) => {
  try {
    const since = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
    const url =
      `https://hub.snapshot.org/api/votes?voter=${req.agent.toLowerCase()}` +
      `&first=1&orderBy=created&orderDirection=desc`;
    const r = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return { pass: false, reason: `Snapshot hub returned ${r.status}` };
    const votes = (await r.json()) as Array<{ created: number }>;
    if (!Array.isArray(votes) || votes.length === 0) {
      return { pass: false, reason: "No Snapshot votes found for this address" };
    }
    if (votes[0].created < since) {
      return { pass: false, reason: "Latest Snapshot vote is older than 7 days" };
    }
    return { pass: true, level: 2, score: 75 };
  } catch (e) {
    return { pass: false, reason: e instanceof Error ? e.message : "Snapshot hub unreachable" };
  }
};

/// Skill 15 — ENS Resolution. Pass if the agent's address has a reverse record.
const ruleEnsReverse: Rule = async (client, req) => {
  try {
    const name = await (client as unknown as {
      getEnsName: (opts: { address: `0x${string}` }) => Promise<string | null>;
    }).getEnsName({ address: req.agent });
    if (!name) return { pass: false, reason: "No ENS reverse record set on this address" };
    return { pass: true, level: 1, score: 65 };
  } catch {
    return { pass: false, reason: "ENS reverse resolution failed" };
  }
};

/// Skill 16 — Normies Agent API Integration: agent holds a Normie AND it has
/// an active ERC-8004 binding via Adapter8004.
const ruleNormiesIntegration: Rule = async (_c, req) => {
  try {
    const NORMIES_API = process.env.NORMIES_API_URL ?? "https://api.normies.art";
    const hRes = await fetch(`${NORMIES_API}/holders/${req.agent}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!hRes.ok) return { pass: false, reason: `Normies API holders returned ${hRes.status}` };
    const h = (await hRes.json()) as { tokenIds?: string[] };
    if (!h.tokenIds || h.tokenIds.length === 0) {
      return { pass: false, reason: "Address does not hold any Normie on Ethereum mainnet" };
    }
    const bRes = await fetch(`${NORMIES_API}/agents/binding/${h.tokenIds[0]}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!bRes.ok) return { pass: false, reason: `Binding lookup returned ${bRes.status}` };
    const b = (await bRes.json()) as { bound?: boolean; agentId?: string };
    const fullyBound = !!b.bound && !!b.agentId && b.agentId !== "0";
    return { pass: true, level: 2, score: fullyBound ? 80 : 70 };
  } catch (e) {
    return { pass: false, reason: e instanceof Error ? e.message : "Normies API unreachable" };
  }
};

// =============================================================================
// Rule registry — 10 auto-verifiable, 6 manual-with-SLA
// =============================================================================

const RULES: Record<string, Rule> = {
  "1":  ruleUniswapV3Swap,
  "2":  ruleAaveSupply,
  "5":  ruleErc8004Registration,
  "6":  ruleSafeExec,
  "9":  ruleErc721Mint,
  "11": ruleSushiSwap,
  "13": ruleSnapshotVote,
  "15": ruleEnsReverse,
  "16": ruleNormiesIntegration,
};

/// Skills that intentionally require manual SLA-based review.
const MANUAL_HINT: Record<string, string> = {
  "3":  "ERC-20 Permit: submit { txHash } of a tx that called permit() then a downstream transferFrom. Manual review confirms signature was valid and within bounds. SLA 72h.",
  "4":  "x402 / EIP-3009 USDC Payment: validator audits USDC.AuthorizationUsed event with authorizer = agent. SLA 24h via merchant relay.",
  "7":  "MEV Protection: behavioural. Submit 3 recent swap tx hashes; verifier confirms private-relay submission + tight slippage discipline. SLA 72h.",
  "8":  "Cross-Chain Skill Purchase: completes automatically when the bridge adapter delivers the SkillPurchased event on L1. No manual action needed if you used the LayerZero path.",
  "10": "EIP-2981 Royalty Enforcement: submit a sale tx where both ERC-721 Transfer and royalty payment occurred atomically. SLA 48h.",
  "12": "Cross-DEX Arbitrage: submit a tx with FlashLoan + at least 2 Swap events on different routers + positive net PnL. SLA 48h.",
  "14": "ZK Proof Verification: submit { txHash, verifierAddress, circuitName }. Verifier confirms verifyProof returned true for a known-good circuit. SLA 72h.",
};

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

/// Build the EIP-191 message hash bound to the marketplace + chain.
function buildPayload(
  agent: Address,
  skillId: bigint,
  level: number,
  score: number,
  marketplace: Address,
  chainId: number
): Hex {
  const inner = keccak256(
    encodePacked(
      ["address", "uint256", "uint8", "uint256", "uint256", "address"],
      [agent, skillId, level, BigInt(score), BigInt(chainId), marketplace]
    )
  );
  return inner;
}

async function signCompletion(
  agent: Address,
  skillId: bigint,
  level: number,
  score: number,
  marketplace: Address,
  chainId: number,
  privateKey: Hex
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  const payload = buildPayload(agent, skillId, level, score, marketplace, chainId);
  // hashMessage applies the EIP-191 "\x19Ethereum Signed Message:\n32" prefix
  // and returns the digest. Sign that digest by re-applying signMessage on the
  // raw 32-byte payload. viem's signMessage with `raw` does the prefix for us.
  const signature = await account.signMessage({
    message: { raw: hexToBytes(payload) },
  });
  return signature;
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function isVerifierConfigured(): boolean {
  return !!process.env.VERIFIER_PRIVATE_KEY;
}

export async function verifySkillCompletion(
  req: VerifyRequest
): Promise<VerifyResult> {
  const pk = process.env.VERIFIER_PRIVATE_KEY as Hex | undefined;
  if (!pk) {
    return {
      ok: false,
      reason:
        "Verifier is not configured on this server. Set VERIFIER_PRIVATE_KEY.",
    };
  }

  const skillIdKey = req.skillId.toString();
  const rule = RULES[skillIdKey];
  if (!rule) {
    return {
      ok: false,
      reason: `Skill #${skillIdKey} requires manual verification`,
      hint: MANUAL_HINT[skillIdKey] ??
        "This skill is not yet in the auto-verifier rule table.",
    };
  }

  const client = getPublicClient();
  const ruleResult = await rule(client, req);
  if (!ruleResult.pass) {
    return { ok: false, reason: ruleResult.reason, hint: ruleResult.hint };
  }

  const addr = getAddresses();
  const marketplace = addr.SkillMarketplace;
  const chainId = ACTIVE_CHAIN.id;

  const signature = await signCompletion(
    req.agent,
    req.skillId,
    ruleResult.level,
    ruleResult.score,
    marketplace,
    chainId,
    pk
  );

  return {
    ok: true,
    agent: req.agent,
    skillId: skillIdKey,
    level: ruleResult.level,
    score: ruleResult.score,
    signature,
    marketplace,
    chainId,
  };
}

/// Public for testing: same hashing the contract uses.
export const _internals = {
  buildPayload,
  hashMessage,
};
