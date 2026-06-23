/// @file binding.ts (server)
/// @notice Resolves NORMIE UNIVERSITY agent identities from their bound NFT, so
///         the completion flow can mint credentials to the IDENTITY (which
///         follows the NFT) while verifying that the action was performed by the
///         current CONTROLLER (the live NFT owner).

import "server-only";
import { isAddress, type Address } from "viem";
import { getPublicClient } from "./viem";
import { NORMIE_AGENT_BINDING_ABI, getAddresses } from "@/lib/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Anti-sybil: an agent BOUND to a real NFT (1 Normie = 1 identity, and Normies
// are scarce + cost money) is far harder to farm than a throwaway wallet. We
// enumerate the binding registry (nextAgentId + identityOf + bindingOf via
// multicall — robust on any RPC, unlike eth_getLogs which public nodes reject)
// so the leaderboard / profiles can flag and weight sybil-resistant agents.
// ---------------------------------------------------------------------------
export type BoundInfo = { agentId: bigint; tokenContract: Address; tokenId: bigint };
let boundCache: { at: number; map: Map<string, BoundInfo> } | null = null;
const BOUND_TTL_MS = 2 * 60_000;

/// Map of identity-address (lowercased) → its bound NFT. Cached; degrades to an
/// empty map on error (the badge simply won't show).
export async function getBoundIdentities(): Promise<Map<string, BoundInfo>> {
  if (boundCache && Date.now() - boundCache.at < BOUND_TTL_MS) return boundCache.map;
  const addr = getAddresses();
  const map = new Map<string, BoundInfo>();
  if (addr.NormieAgentBinding !== ZERO) {
    try {
      const client = getPublicClient();
      const next = (await client.readContract({
        address: addr.NormieAgentBinding,
        abi: NORMIE_AGENT_BINDING_ABI,
        functionName: "nextAgentId",
      })) as bigint;
      const count = Number(next) - 1; // agentIds are 1..next-1
      if (count > 0) {
        const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
        const mk = (fn: string) =>
          ids.map((id) => ({ address: addr.NormieAgentBinding, abi: NORMIE_AGENT_BINDING_ABI, functionName: fn, args: [id] as const }));
        const [identities, bindings] = await Promise.all([
          client.multicall({ allowFailure: true, contracts: mk("identityOf") }),
          client.multicall({ allowFailure: true, contracts: mk("bindingOf") }),
        ]);
        ids.forEach((agentId, i) => {
          const identity = identities[i].status === "success" ? (identities[i].result as Address) : null;
          const b = bindings[i].status === "success" ? (bindings[i].result as readonly [Address, bigint]) : null;
          if (identity && identity !== ZERO && b) {
            map.set(identity.toLowerCase(), { agentId, tokenContract: b[0], tokenId: b[1] });
          }
        });
      }
    } catch { /* graceful: empty map */ }
  }
  boundCache = { at: Date.now(), map };
  return map;
}

/// True if `address` is an NFT-bound agent identity (sybil-resistant).
export async function isBoundIdentity(address: string): Promise<boolean> {
  if (!isAddress(address)) return false;
  return (await getBoundIdentities()).has(address.toLowerCase());
}

export type ResolvedAgent = {
  agentId: bigint;
  identity: Address;     // credential recipient — stable, follows the NFT
  controller: Address;   // current NFT owner — the expected tx sender
};

/// Resolve the agent identity bound to (tokenContract, tokenId). Returns null
/// when the binding contract isn't configured or the NFT isn't bound.
export async function resolveBoundAgent(
  tokenContract: string,
  tokenId: bigint
): Promise<ResolvedAgent | null> {
  const addr = getAddresses();
  if (addr.NormieAgentBinding === ZERO || !isAddress(tokenContract)) return null;

  const client = getPublicClient();
  try {
    const [agentId, identity] = (await client.readContract({
      address: addr.NormieAgentBinding,
      abi: NORMIE_AGENT_BINDING_ABI,
      functionName: "identityForToken",
      args: [tokenContract as Address, tokenId],
    })) as [bigint, Address];

    if (agentId === 0n) return null;

    const controller = (await client.readContract({
      address: addr.NormieAgentBinding,
      abi: NORMIE_AGENT_BINDING_ABI,
      functionName: "controllerOf",
      args: [agentId],
    })) as Address;

    return { agentId, identity, controller };
  } catch {
    return null;
  }
}
