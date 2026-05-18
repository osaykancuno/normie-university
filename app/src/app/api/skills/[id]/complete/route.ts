/// @file /api/skills/[id]/complete
/// @notice Verifier + relayer endpoint for the agent-native completion flow.
///
///         POST { agent, txHash? } →
///           1. Run the on-chain verification rule for this skill.
///           2. Sign the completion payload with the verifier key.
///           3. Submit `completeSkillFor(agent, ...)` on-chain via the relayer.
///           4. Return 200 with { txHash, level, score, signature }.
///
///         The agent never spends gas. End-to-end gasless agent UX requires
///         BOTH /buy AND /complete to be relayed — this endpoint is the
///         second half.

import { isAddress } from "viem";
import { isVerifierConfigured, verifySkillCompletion } from "@/lib/server/verifier";
import { isRelayerConfigured, relayCompleteFor, relayerAddress } from "@/lib/server/relayer";

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/skills/[id]/complete">
) {
  const { id } = await ctx.params;
  let skillId: bigint;
  try {
    skillId = BigInt(id);
  } catch {
    return Response.json({ error: "Invalid skillId" }, { status: 400 });
  }

  if (!isVerifierConfigured()) {
    return Response.json(
      { error: "Verifier is not configured (VERIFIER_PRIVATE_KEY missing)" },
      { status: 501 }
    );
  }
  if (!isRelayerConfigured()) {
    return Response.json(
      { error: "Relayer is not configured (RELAYER_PRIVATE_KEY missing)" },
      { status: 501 }
    );
  }

  let body: { agent?: string; txHash?: string };
  try {
    body = (await req.json()) as { agent?: string; txHash?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.agent || !isAddress(body.agent)) {
    return Response.json({ error: "Invalid or missing 'agent' address" }, { status: 400 });
  }
  let txHash: `0x${string}` | undefined;
  if (body.txHash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(body.txHash)) {
      return Response.json({ error: "Invalid 'txHash'" }, { status: 400 });
    }
    txHash = body.txHash as `0x${string}`;
  }

  // Step 1: ask the verifier to evaluate the rule and sign on success
  const verified = await verifySkillCompletion({
    agent: body.agent as `0x${string}`,
    skillId,
    txHash,
  });
  if (!verified.ok) {
    return Response.json(verified, { status: 422 });
  }

  // Step 2: relay the completion on-chain (gasless for the agent)
  const relay = await relayCompleteFor(
    verified.agent,
    skillId,
    verified.level,
    BigInt(verified.score),
    verified.signature
  );
  if (!relay.ok) {
    // Surface the verifier signature so the agent can submit it themselves
    return Response.json(
      {
        ok: false,
        reason: relay.reason,
        hint:
          "Relay failed but the verifier signed a valid completion. You can submit it yourself by calling SkillMarketplace.completeSkill(skillId, level, score, signature) from your wallet.",
        verifier: verified,
      },
      { status: 502 }
    );
  }

  return Response.json({
    ok: true,
    agent: verified.agent,
    skillId: verified.skillId,
    level: verified.level,
    score: verified.score,
    txHash: relay.txHash,
    blockNumber: relay.blockNumber.toString(),
    relayer: relayerAddress(),
    signature: verified.signature,
  });
}
