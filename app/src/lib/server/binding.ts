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
