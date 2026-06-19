/// @file verifier.ts (server) — the NORMIE UNIVERSITY skills oracle.
///
/// Responsibilities:
///   1. Load the canonical, IPFS-pinned skill module for a skillId.
///   2. Verify the agent's execution on the chain the module DECLARES
///      (not the chain the marketplace lives on) against the addresses /
///      selectors the module DECLARES (not values hardcoded here).
///   3. On success, return an EIP-191 completion authorization carrying a
///      DEADLINE + NONCE so it can't be replayed or redeemed stale.
///
/// Two distinct chains are in play:
///   • verification chain — where the skill ran (module.chain.id). Picked via
///     getProviderForChain(). This is the structural fix for the old bug
///     where the oracle always queried the settlement chain (Sepolia) and so
///     could never see a real mainnet execution.
///   • settlement chain   — where SkillMarketplace lives (ACTIVE_CHAIN). The
///     signature binds to it + the marketplace address so it can only be
///     redeemed there.

import "server-only";
import {
  encodePacked,
  hashMessage,
  hexToBytes,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getAddresses } from "@/lib/contracts";
import { ACTIVE_CHAIN } from "@/config/chains";
import { getProviderForChain, explorerFor } from "./chains-rpc";
import {
  loadSkillModule,
  tierFromDifficulty,
  declaredAddresses,
  declaredSelectors,
  verificationChainId,
  type SkillModule,
} from "./skill-module-loader";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerifyRequest = {
  agent: Address;
  skillId: bigint;
  txHash?: Hex;
};

export type VerifyOk = {
  ok: true;
  agent: Address;
  skillId: string;
  level: number;     // 1..3
  score: number;     // 0..100
  deadline: string;  // unix seconds (stringified for JSON safety)
  nonce: Hex;        // bytes32
  signature: Hex;
  marketplace: Address;
  chainId: number;          // settlement chain
  verificationChainId: number;
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

// ---------------------------------------------------------------------------
// Spec-driven on-chain verification (works for ANY smart_contract_interaction)
// ---------------------------------------------------------------------------

/// Generic, spec-driven check: the tx (a) succeeded, (b) was sent by the
/// agent, (c) targeted one of the module's DECLARED contract addresses, and
/// (d) called one of the module's DECLARED function selectors — all on the
/// chain the module DECLARES. Level/score derive from the module difficulty.
async function verifyOnChainCall(
  mod: SkillModule,
  req: VerifyRequest
): Promise<RuleResult> {
  const chainId = verificationChainId(mod);
  const client = getProviderForChain(chainId);
  if (!client) {
    return {
      pass: false,
      reason: `Oracle has no RPC provider for chain ${chainId}`,
      hint: `Set RPC_URL_${chainId} on the server to enable verification of this skill.`,
    };
  }
  if (!req.txHash) {
    return {
      pass: false,
      reason: "txHash required",
      hint: `Submit { txHash } of the transaction that performed this skill on chain ${chainId}.`,
    };
  }

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: req.txHash });
  } catch {
    return {
      pass: false,
      reason: `Transaction not found on chain ${chainId}`,
      hint: `Make sure the tx is on the right chain (${chainId}) and confirmed.`,
    };
  }
  if (receipt.status !== "success") {
    return { pass: false, reason: "Transaction reverted on-chain" };
  }
  if (receipt.from.toLowerCase() !== req.agent.toLowerCase()) {
    return { pass: false, reason: "Transaction was not sent by the claimed agent" };
  }

  // FAIL-CLOSED: a contract-interaction skill that declares no usable target
  // address cannot be auto-verified. Without a declared contract, *any*
  // successful tx from the agent (even a 0-value self-transfer) would otherwise
  // pass — absence of a constraint must never mean "accept everything". Route
  // these to the human/validator path instead of rubber-stamping.
  const addresses = declaredAddresses(mod);
  if (addresses.length === 0) {
    return {
      pass: false,
      reason: "This skill has no verifiable on-chain target and needs manual review",
      hint:
        mod.verification?.criteria ??
        "The skill module declares no usable contract address; a human validator confirms this completion.",
    };
  }

  const tx = await client.getTransaction({ hash: req.txHash });
  const to = tx.to?.toLowerCase();
  if (!to || !addresses.includes(to)) {
    return {
      pass: false,
      reason: "Transaction target is not one of the skill's declared contracts",
      hint: `Expected one of: ${addresses.join(", ")}`,
    };
  }
  const selectors = declaredSelectors(mod);
  if (selectors.length > 0) {
    const selector = (tx.input ?? "0x").slice(0, 10).toLowerCase();
    if (!selectors.includes(selector)) {
      return {
        pass: false,
        reason: "Transaction did not call one of the skill's declared functions",
        hint: `Expected a call to one of: ${selectors.join(", ")}`,
      };
    }
  }

  const { level, score } = tierFromDifficulty(mod.difficulty);
  return { pass: true, level, score };
}

// ---------------------------------------------------------------------------
// Off-chain rules that aren't a single on-chain tx (kept specific)
// ---------------------------------------------------------------------------

/// Snapshot-style governance: pass if the agent cast a Snapshot vote in the
/// last 7 days. Used by skills whose executable.kind is off_chain_signed_message
/// and whose category is Governance.
async function verifySnapshotVote(
  mod: SkillModule,
  req: VerifyRequest
): Promise<RuleResult> {
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
    const { level, score } = tierFromDifficulty(mod.difficulty);
    return { pass: true, level, score };
  } catch (e) {
    return { pass: false, reason: e instanceof Error ? e.message : "Snapshot hub unreachable" };
  }
}

/// Normies API integration: agent holds a Normie and (bonus) it has an
/// active ERC-8004 binding. Bound to skills whose category is the Normies
/// integration family.
async function verifyNormiesIntegration(
  mod: SkillModule,
  req: VerifyRequest
): Promise<RuleResult> {
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
    const { level } = tierFromDifficulty(mod.difficulty);
    return { pass: true, level, score: 80 };
  } catch (e) {
    return { pass: false, reason: e instanceof Error ? e.message : "Normies API unreachable" };
  }
}

// ---------------------------------------------------------------------------
// Router: pick the verification strategy from the module's declared shape
// ---------------------------------------------------------------------------

/// Skill names/categories that get a dedicated off-chain check rather than the
/// generic on-chain one. Matched case-insensitively on the module name.
function pickOffChainRule(
  mod: SkillModule
): ((m: SkillModule, r: VerifyRequest) => Promise<RuleResult>) | null {
  const name = (mod.name ?? "").toLowerCase();
  if (name.includes("snapshot") || name.includes("dao") || name.includes("voting")) {
    return verifySnapshotVote;
  }
  if (name.includes("normies")) {
    return verifyNormiesIntegration;
  }
  return null;
}

async function evaluate(mod: SkillModule, req: VerifyRequest): Promise<RuleResult> {
  if (mod.verification?.auto_verifiable === false) {
    return {
      pass: false,
      reason: "This skill requires manual review",
      hint:
        mod.verification?.criteria ??
        "A human validator reviews this completion within the declared SLA.",
    };
  }

  const kind = mod.executable?.kind ?? "";

  // Off-chain attestations (governance votes, API integrations) get a
  // dedicated check; everything contract-based goes through the generic
  // spec-driven on-chain verifier.
  const offChain = pickOffChainRule(mod);
  if (offChain && kind !== "smart_contract_interaction") {
    return offChain(mod, req);
  }
  if (kind === "smart_contract_interaction") {
    return verifyOnChainCall(mod, req);
  }
  if (offChain) {
    return offChain(mod, req);
  }

  // intent_submission / rpc_submission / hub_broadcast / off_chain_service:
  // need a solver/relay/endpoint confirmation we can't do synchronously.
  return {
    pass: false,
    reason: `Skill kind '${kind || "unknown"}' is not auto-verifiable yet`,
    hint:
      mod.verification?.criteria ??
      "This skill is verified by a human validator within the declared SLA.",
  };
}

// ---------------------------------------------------------------------------
// Signature — EIP-191 over (agent, skillId, level, score, deadline, nonce,
//             settlementChainId, marketplace). Deadline + nonce are the
//             anti-replay / anti-stale protection consumed by the contract.
// ---------------------------------------------------------------------------

function buildPayload(
  agent: Address,
  skillId: bigint,
  level: number,
  score: number,
  deadline: bigint,
  nonce: Hex,
  settlementChainId: number,
  marketplace: Address
): Hex {
  return keccak256(
    encodePacked(
      ["address", "uint256", "uint8", "uint256", "uint256", "bytes32", "uint256", "address"],
      [agent, skillId, level, BigInt(score), deadline, nonce, BigInt(settlementChainId), marketplace]
    )
  );
}

function freshNonce(agent: Address, skillId: bigint): Hex {
  // Unique per call. Binds agent+skill+time+randomness; the contract only
  // checks it hasn't been used, so collision-resistance is all we need.
  const rand = crypto.getRandomValues(new Uint8Array(16));
  return keccak256(
    encodePacked(
      ["address", "uint256", "uint256", "bytes"],
      [agent, skillId, BigInt(Date.now()), toHex(rand)]
    )
  );
}

async function signCompletion(
  payload: Hex,
  privateKey: Hex
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  return account.signMessage({ message: { raw: hexToBytes(payload) } });
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function isVerifierConfigured(): boolean {
  return !!process.env.VERIFIER_PRIVATE_KEY;
}

/// How long a completion authorization stays valid. Short — the agent (or the
/// relayer) should redeem promptly. Configurable via env.
const COMPLETION_TTL_SECONDS = Number(process.env.COMPLETION_TTL_SECONDS ?? "1800"); // 30 min

export async function verifySkillCompletion(
  req: VerifyRequest
): Promise<VerifyResult> {
  const pk = process.env.VERIFIER_PRIVATE_KEY as Hex | undefined;
  if (!pk) {
    return {
      ok: false,
      reason: "Verifier is not configured on this server. Set VERIFIER_PRIVATE_KEY.",
    };
  }

  const mod = await loadSkillModule(req.skillId);
  if (!mod) {
    return {
      ok: false,
      reason: `Skill #${req.skillId.toString()} has no resolvable module (IPFS content unavailable)`,
      hint: "The skill's contentURI could not be fetched from any IPFS gateway. Try again shortly.",
    };
  }

  const ruleResult = await evaluate(mod, req);
  if (!ruleResult.pass) {
    return { ok: false, reason: ruleResult.reason, hint: ruleResult.hint };
  }

  const addr = getAddresses();
  const marketplace = addr.SkillMarketplace;
  const settlementChainId = ACTIVE_CHAIN.id;
  const verChainId = verificationChainId(mod);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + COMPLETION_TTL_SECONDS);
  const nonce = freshNonce(req.agent, req.skillId);

  const payload = buildPayload(
    req.agent,
    req.skillId,
    ruleResult.level,
    ruleResult.score,
    deadline,
    nonce,
    settlementChainId,
    marketplace
  );
  const signature = await signCompletion(payload, pk);

  return {
    ok: true,
    agent: req.agent,
    skillId: req.skillId.toString(),
    level: ruleResult.level,
    score: ruleResult.score,
    deadline: deadline.toString(),
    nonce,
    signature,
    marketplace,
    chainId: settlementChainId,
    verificationChainId: verChainId,
  };
}

/// Exposed for tests: same hashing the contract uses.
export const _internals = {
  buildPayload,
  hashMessage,
  explorerFor,
};
