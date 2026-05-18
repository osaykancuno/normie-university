"use client";

import { Badge } from "@/components/ui/badge";

/// Auto-vs-manual verification matrix per skillId. Mirrors the server-side
/// RULES + MANUAL_HINT registries in lib/server/verifier.ts so the UI can
/// honestly disclose how completion is checked BEFORE the user buys.
const AUTO_VERIFIED = new Set([1, 2, 5, 6, 9, 11, 13, 15, 16]);

const MANUAL_SLA: Record<number, string> = {
  3:  "Manual review · SLA 72h",
  4:  "Merchant relay verifies · SLA 24h",
  7:  "Behavioural review · SLA 72h",
  8:  "Bridge-attested automatically",
  10: "Manual review · SLA 48h",
  12: "Manual review · SLA 48h",
  14: "Manual review · SLA 72h",
};

export function VerificationBadge({ skillId }: { skillId: bigint | number | string }) {
  const id = Number(skillId);
  if (AUTO_VERIFIED.has(id)) {
    return (
      <Badge variant="success" className="border-green-500/40">
        ✓ Auto-verified on-chain
      </Badge>
    );
  }
  const sla = MANUAL_SLA[id];
  if (sla) {
    return (
      <Badge variant="warning" className="border-amber-500/40">
        ⏱ {sla}
      </Badge>
    );
  }
  return <Badge variant="secondary">Verification: standard</Badge>;
}

/// Inline explainer — drop into the skill detail page below the price card.
export function VerificationExplainer({ skillId }: { skillId: bigint | number | string }) {
  const id = Number(skillId);
  const isAuto = AUTO_VERIFIED.has(id);
  const sla = MANUAL_SLA[id];

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-4 text-xs leading-relaxed text-zinc-400">
      <div className="mb-1 flex items-center gap-2">
        <VerificationBadge skillId={skillId} />
      </div>
      {isAuto ? (
        <p>
          Completion is checked programmatically. Submit a transaction hash via{" "}
          <code className="text-violet-300">POST /api/skills/{String(skillId)}/complete</code>{" "}
          (or via the SDK). The verifier confirms the on-chain pattern, signs an
          EIP-191 authorisation, and the relayer mints your Soulbound credential —
          you don&apos;t pay gas.
        </p>
      ) : sla ? (
        <p>
          This skill needs a human-attested check ({sla.toLowerCase()}). Submit
          the required proof artefact to{" "}
          <code className="text-violet-300">POST /api/verify</code> — our
          verifier reviews within the stated SLA and signs a completion
          attestation. We declare this upfront because it&apos;s real work; we
          don&apos;t fake an &quot;auto-pass&quot; for behavioural or proof-heavy
          skills.
        </p>
      ) : (
        <p>Completion verification details available in the skill module spec.</p>
      )}
    </div>
  );
}
