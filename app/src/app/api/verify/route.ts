/// @file /api/verify
/// @notice Auto-verifier endpoint. Agents POST { agent, skillId, txHash? }.
///         If the skill has an on-chain verification rule that passes, the
///         endpoint returns an EIP-191 signed completion authorization the
///         agent then submits to SkillMarketplace.completeSkill().
///
///         Returns 403 if the connected verifier key does not hold
///         VERIFIER_ROLE on the marketplace (the contract will reject the
///         signature anyway, but we surface the misconfig early).

import { isAddress } from "viem";
import { verifySkillCompletion, isVerifierConfigured } from "@/lib/server/verifier";

export async function POST(req: Request) {
  if (!isVerifierConfigured()) {
    return Response.json(
      {
        error:
          "Verifier is not configured on this server. Set VERIFIER_PRIVATE_KEY in the environment, then ensure the corresponding address has been granted VERIFIER_ROLE on the SkillMarketplace.",
      },
      { status: 501 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = (body ?? {}) as { agent?: string; skillId?: string; txHash?: string };
  if (!o.agent || !isAddress(o.agent)) {
    return Response.json({ error: "Invalid or missing 'agent' address" }, { status: 400 });
  }
  if (!o.skillId) {
    return Response.json({ error: "Missing 'skillId'" }, { status: 400 });
  }

  let skillId: bigint;
  try {
    skillId = BigInt(o.skillId);
  } catch {
    return Response.json({ error: "Invalid 'skillId'" }, { status: 400 });
  }

  let txHash: `0x${string}` | undefined;
  if (o.txHash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(o.txHash)) {
      return Response.json({ error: "Invalid 'txHash'" }, { status: 400 });
    }
    txHash = o.txHash as `0x${string}`;
  }

  try {
    const result = await verifySkillCompletion({
      agent: o.agent as `0x${string}`,
      skillId,
      txHash,
    });

    if (!result.ok) {
      return Response.json(result, { status: 422 });
    }
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal verifier error";
    return Response.json({ error: message }, { status: 500 });
  }
}
