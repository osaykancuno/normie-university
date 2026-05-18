"use client";

import { useState } from "react";
import Link from "next/link";
import { useNormiesOf } from "@/hooks/useNormies";
import { useHasPurchased } from "@/hooks/useMarketplace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/// Welcome gift: a sponsored "first skill" (ERC-8004 Registration, skill #5)
/// offered to Normie holders. Click → server verifies Normie ownership +
/// calls sponsorFirstSkill via the relayer. Agent then submits completion
/// themselves to mint the SBT.
///
/// Renders nothing if the wallet doesn't hold a Normie or the gift has
/// already been claimed.

const GIFT_SKILL_ID = 5n; // ERC-8004 Agent Registration

type Status =
  | { kind: "idle" }
  | { kind: "claiming" }
  | { kind: "success"; txHash: string }
  | { kind: "error"; message: string };

export function NormieWelcomeGift({ address }: { address: `0x${string}` | undefined }) {
  const { data: holder } = useNormiesOf(address);
  const { data: alreadyPurchased } = useHasPurchased(address, GIFT_SKILL_ID);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (!address || !holder?.isHolder) return null;
  if (alreadyPurchased) return null;
  if (status.kind === "success") {
    return (
      <div className="rounded-none border border-[color:var(--accent-ok)] bg-surface-2 p-5">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="success">Welcome gift claimed</Badge>
        </div>
        <p className="text-sm text-ink-soft">
          ERC-8004 Agent Registration recorded on-chain for Normie #{holder.tokenIds[0]}.{" "}
          <Link href="/skills/5" className="text-ink underline hover:underline">
            Submit completion proof
          </Link>{" "}
          to mint the SBT credential.
        </p>
        <p className="mt-2 font-mono text-xs text-ink-muted">
          tx: {status.txHash.slice(0, 10)}…{status.txHash.slice(-6)}
        </p>
      </div>
    );
  }

  const claim = async () => {
    setStatus({ kind: "claiming" });
    try {
      const res = await fetch("/api/onboarding/claim-normie-gift", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: address }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setStatus({
          kind: "error",
          message: body?.reason ?? body?.error ?? `Claim failed (${res.status})`,
        });
        return;
      }
      setStatus({ kind: "success", txHash: body.txHash });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  };

  return (
    <div className="rounded-none border border-line-strong bg-canvas p-5">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="default" className="border-line-strong">
          Welcome gift
        </Badge>
        <Badge variant="success">FREE</Badge>
      </div>
      <h3 className="text-lg font-semibold text-ink">
        Your first SBT credential, on us.
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        Normie #{holder.tokenIds[0]} is eligible for a sponsored claim of the{" "}
        <span className="font-medium text-ink">ERC-8004 Agent Registration</span>{" "}
        skill — value $1, paid by NORMIE UNIVERSITY. Click below to record the purchase
        on-chain (zero gas, zero cost).
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={claim} disabled={status.kind === "claiming"}>
          {status.kind === "claiming" ? "Claiming…" : "Claim your welcome gift"}
        </Button>
        <Link href="/community/normies" className="text-xs text-ink underline hover:underline">
          What does this mean?
        </Link>
      </div>
      {status.kind === "error" && (
        <p className="mt-3 rounded-md border border-[color:var(--accent-err)] bg-surface-2 p-2 text-xs text-[color:var(--accent-err)]">
          {status.message}
        </p>
      )}
    </div>
  );
}
