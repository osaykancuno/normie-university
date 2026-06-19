/// @file /api/validation/attest
/// @notice ERC-8004 validation attestation. A VALIDATOR-role holder submits a
///         0-100 quality score about an agent's skill execution. The score is
///         written to the on-chain ValidationRegistry and blended into the
///         agent's reputation by ReputationEngine.
///
///         This is SEPARATE from skill completion: completion (via the
///         verifier) mints the credential; validation is an additional,
///         independent third-party signal. The endpoint requires
///         VALIDATOR_PRIVATE_KEY (whose address must hold VALIDATOR_ROLE).
///
///         POST { agent, skillId, score, txHash? }

import { isAddress, type Hex } from "viem";
import { submitValidation, isValidatorConfigured } from "@/lib/server/validator";

export async function POST(req: Request) {
  if (!isValidatorConfigured()) {
    return Response.json(
      {
        error:
          "Validator is not configured on this server. Set VALIDATOR_PRIVATE_KEY and grant VALIDATOR_ROLE on the ValidationRegistry to the corresponding address.",
      },
      { status: 501 }
    );
  }

  let body: { agent?: string; skillId?: string; score?: number; txHash?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.agent || !isAddress(body.agent)) {
    return Response.json({ error: "Invalid or missing 'agent' address" }, { status: 400 });
  }
  if (!body.skillId) {
    return Response.json({ error: "Missing 'skillId'" }, { status: 400 });
  }
  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return Response.json({ error: "'score' must be an integer 0..100" }, { status: 400 });
  }

  let skillId: bigint;
  try { skillId = BigInt(body.skillId); }
  catch { return Response.json({ error: "Invalid 'skillId'" }, { status: 400 }); }

  let txHash: Hex | undefined;
  if (body.txHash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(body.txHash)) {
      return Response.json({ error: "Invalid 'txHash'" }, { status: 400 });
    }
    txHash = body.txHash as Hex;
  }

  const result = await submitValidation(
    body.agent as `0x${string}`,
    skillId,
    score,
    txHash
  );

  if (!result.ok) {
    return Response.json(result, { status: 502 });
  }
  return Response.json(result);
}
