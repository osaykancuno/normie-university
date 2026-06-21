/// @file /api/identity/sponsor
/// @notice Sponsors a skill for a Normie's agent identity so its controller can
///         then earn it (testnet prototype + the mainnet pattern for Normie
///         holders). POST { agentToken, agentTokenId, skillId }. The relayer
///         (SPONSOR_ROLE) records a zero-price purchase for the bound identity.

import { resolveBoundAgent } from "@/lib/server/binding";
import { isRelayerConfigured, relaySponsorFirstSkill } from "@/lib/server/relayer";

export async function POST(req: Request) {
  if (!isRelayerConfigured()) {
    return Response.json({ error: "Relayer not configured" }, { status: 501 });
  }

  let body: { agentToken?: string; agentTokenId?: string; skillId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.agentToken || !body.agentTokenId || !body.skillId) {
    return Response.json({ error: "Missing agentToken / agentTokenId / skillId" }, { status: 400 });
  }

  let tokenId: bigint;
  let skillId: bigint;
  try {
    tokenId = BigInt(body.agentTokenId);
    skillId = BigInt(body.skillId);
  } catch {
    return Response.json({ error: "Invalid tokenId / skillId" }, { status: 400 });
  }

  const bound = await resolveBoundAgent(body.agentToken, tokenId);
  if (!bound) {
    return Response.json({ error: "NFT is not bound to an agent identity" }, { status: 400 });
  }

  const result = await relaySponsorFirstSkill(bound.identity, skillId);
  if (!result.ok) {
    // Already-purchased is fine for the demo — surface as ok so the flow continues.
    if (/PurchaseExists|AlreadyPurchased|already/i.test(result.reason ?? "")) {
      return Response.json({ ok: true, alreadySponsored: true, identity: bound.identity });
    }
    return Response.json({ ok: false, reason: result.reason }, { status: 502 });
  }
  return Response.json({ ok: true, identity: bound.identity, txHash: result.txHash });
}
