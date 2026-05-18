/// @file /api/verify/manual
/// @notice Submit a manual-verification request for skills whose completion
///         requires human review (skills 3, 4, 7, 10, 12, 14 — see verifier.ts
///         MANUAL_HINT). The endpoint logs the submission and returns a
///         queued status with the declared SLA. Operations review fulfills
///         out-of-band and issues an attestation via /api/attestation/issue
///         once verified.
///
/// In production this would persist to a real queue (Postgres / KV).
/// For v1 / testnet we accept the request, return a deterministic id, and
/// emit a server-side log. Admins handle review in-house.

import { isAddress } from "viem";

const MANUAL_SLA: Record<string, number> = {
  "3":  72,
  "4":  24,
  "7":  72,
  "8":  0,  // bridge-attested automatically
  "10": 48,
  "12": 48,
  "14": 72,
};

export async function POST(req: Request) {
  let body: {
    agent?: string;
    skillId?: string;
    proof?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.agent || !isAddress(body.agent)) {
    return Response.json({ error: "Invalid or missing 'agent' address" }, { status: 400 });
  }
  if (!body.skillId) {
    return Response.json({ error: "Missing 'skillId'" }, { status: 400 });
  }
  if (!body.proof || typeof body.proof !== "object") {
    return Response.json(
      { error: "Missing 'proof' object — include txHash, verifierAddress, or other evidence per skill spec" },
      { status: 400 }
    );
  }

  const sla = MANUAL_SLA[body.skillId];
  if (sla === undefined) {
    return Response.json(
      {
        error: `Skill #${body.skillId} does not require manual review. Use /api/verify (auto) or /api/skills/${body.skillId}/complete (relayed).`,
      },
      { status: 422 }
    );
  }

  // Generate a deterministic submission id (replay-safe pre-DB):
  // sha256(agent + skillId + JSON(proof)) — first 8 bytes
  const idSource = `${body.agent.toLowerCase()}|${body.skillId}|${JSON.stringify(body.proof)}`;
  let id = "";
  try {
    const enc = new TextEncoder().encode(idSource);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    id = Array.from(new Uint8Array(buf).slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    id = Date.now().toString(16);
  }

  // Server-side log (visible in Vercel logs / wherever the app runs)
  console.log(
    `[manual-verify] queued id=${id} agent=${body.agent} skill=${body.skillId} sla=${sla}h proof=${JSON.stringify(body.proof).slice(0, 200)}`
  );

  return Response.json({
    ok: true,
    queued: true,
    submissionId: id,
    agent: body.agent,
    skillId: body.skillId,
    sla: { hours: sla, deadline: Math.floor(Date.now() / 1000) + sla * 3600 },
    nextStep:
      sla === 0
        ? "Cross-chain skill: no action needed — bridge adapter will complete it automatically."
        : "Once reviewed, an attestation will be issued via /api/attestation/issue. You can poll /api/agents/{address}/skills to see the credential appear, or submit the attestation on-chain via SkillCredential.mintFromAttestation().",
  });
}
