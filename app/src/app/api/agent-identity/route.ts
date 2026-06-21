/// @file /api/agent-identity
/// @notice Resolves the NORMIE UNIVERSITY agent identity bound to a Normie NFT,
///         and the identity's CURRENT controller (the live NFT owner). This is
///         what proves "skills follow the NFT": the controller is read from
///         ownerOf(tokenId), so it changes the instant the NFT is sold.
///
///         GET ?tokenId=N[&token=0x..]  (token defaults to the testnet Mock
///         Normies collection on Sepolia). Read-only — no wallet needed.

import { getPublicClient } from "@/lib/server/viem";
import {
  NORMIE_AGENT_BINDING_ABI,
  MOCK_NORMIES_ABI,
  SKILL_CREDENTIAL_ABI,
  getAddresses,
} from "@/lib/contracts";
import { isAddress } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenIdRaw = url.searchParams.get("tokenId");
  const tokenParam = url.searchParams.get("token");
  if (!tokenIdRaw) return Response.json({ error: "Missing 'tokenId'" }, { status: 400 });

  let tokenId: bigint;
  try { tokenId = BigInt(tokenIdRaw); } catch { return Response.json({ error: "Invalid tokenId" }, { status: 400 }); }

  const addr = getAddresses();
  const binding = addr.NormieAgentBinding;
  if (binding === ZERO) return Response.json({ error: "Agent binding not configured" }, { status: 501 });
  const token = (tokenParam && isAddress(tokenParam) ? tokenParam : addr.MockNormies) as `0x${string}`;
  if (token === ZERO) return Response.json({ error: "No NFT collection configured" }, { status: 501 });

  const client = getPublicClient();

  // ownerOf (may revert if the token doesn't exist)
  let owner: string | null = null;
  try {
    owner = (await client.readContract({ address: token, abi: MOCK_NORMIES_ABI, functionName: "ownerOf", args: [tokenId] })) as string;
  } catch { owner = null; }

  // resolve identity
  const [agentId, identity] = (await client.readContract({
    address: binding, abi: NORMIE_AGENT_BINDING_ABI, functionName: "identityForToken", args: [token, tokenId],
  })) as [bigint, string];

  const bound = agentId > 0n;
  let controller: string | null = null;
  let skillCount = 0;
  if (bound) {
    try {
      controller = (await client.readContract({ address: binding, abi: NORMIE_AGENT_BINDING_ABI, functionName: "controllerOf", args: [agentId] })) as string;
    } catch { controller = owner; }
    try {
      skillCount = Number(await client.readContract({ address: addr.SkillCredential, abi: SKILL_CREDENTIAL_ABI, functionName: "balanceOf", args: [identity as `0x${string}`] }));
    } catch { skillCount = 0; }
  }

  return Response.json(
    {
      token,
      tokenId: tokenId.toString(),
      exists: owner !== null,
      owner,
      bound,
      agentId: bound ? agentId.toString() : null,
      identity: bound ? identity : null,
      controller,           // == owner — follows the NFT
      skillCount,           // credentials held by the identity
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
