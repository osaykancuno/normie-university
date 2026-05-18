"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useNormie, useNormiesOf } from "@/hooks/useNormies";
import { DEMO_SKILLS, DEMO_PATHS } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/// Maps a Normie trait pattern to a recommended skill/path. Returned in the
/// order they should be shown — most relevant first.
type Recommendation = {
  kind: "skill" | "path";
  id: bigint;
  reason: string; // human-readable why
};

/// Pure scoring function. Each trait value matches against rules and pushes
/// recommendations to the list. Inspired by classic RPG class systems —
/// we read the Normie's "build" and suggest a curriculum.
function recommend(traits: { trait_type: string; value: string }[]): Recommendation[] {
  const t = Object.fromEntries(traits.map((x) => [x.trait_type.toLowerCase(), x.value.toLowerCase()]));
  const recs: Recommendation[] = [];

  // Type-driven primary path
  const type = t["type"] ?? "";
  if (type === "agent") {
    recs.push({ kind: "path", id: 3n, reason: "You're an Agent type — Trading Specialist is your home." });
    recs.push({ kind: "path", id: 5n, reason: "Master cross-chain ops to operate everywhere." });
  } else if (type === "alien") {
    recs.push({ kind: "path", id: 5n, reason: "Alien type — start with Cross-Chain Master." });
    recs.push({ kind: "skill", id: 14n, reason: "ZK proofs are alien tech — perfect fit." });
  } else if (type === "cat") {
    recs.push({ kind: "skill", id: 7n, reason: "Cats stalk silently — MEV protection is your craft." });
    recs.push({ kind: "path", id: 1n, reason: "Get DeFi fundamentals down first." });
  } else if (type === "human") {
    recs.push({ kind: "path", id: 1n, reason: "Human type — start with DeFi Fundamentals." });
    recs.push({ kind: "path", id: 2n, reason: "Then claim your identity with the Agent Identity path." });
  }

  // Expression hints
  const expr = t["expression"] ?? "";
  if (expr === "confident" || expr === "serious") {
    recs.push({ kind: "skill", id: 12n, reason: "Confident expression — try Cross-DEX Arbitrage." });
  } else if (expr === "peaceful" || expr === "content") {
    recs.push({ kind: "skill", id: 2n, reason: "Peaceful temperament — Aave Supply is the calm yield." });
  }

  // Eyes hints
  const eyes = t["eyes"] ?? "";
  if (eyes.includes("vr") || eyes.includes("3d")) {
    recs.push({ kind: "path", id: 5n, reason: "VR/3D eyes see across chains." });
  } else if (eyes.includes("shades")) {
    recs.push({ kind: "skill", id: 6n, reason: "Sunglasses → Safe multisig, you're a treasurer." });
  }

  // Accessory hints
  const acc = t["accessory"] ?? "";
  if (acc.includes("chain")) {
    recs.push({ kind: "skill", id: 4n, reason: "Wearing a chain → x402 payment is your medium." });
  } else if (acc.includes("hoodie")) {
    recs.push({ kind: "skill", id: 14n, reason: "Hoodie + privacy → ZK proofs." });
  }

  // Always recommend the Normies Builder Path
  recs.push({ kind: "path", id: 6n, reason: "Native to your collection — Normies Builder Path." });

  // Dedup keeping first occurrence (preserves the most-relevant reason)
  const seen = new Set<string>();
  return recs.filter((r) => {
    const key = `${r.kind}-${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

export function TraitRecommendations({ address }: { address: `0x${string}` | undefined }) {
  const { data: holder } = useNormiesOf(address);
  const primaryTokenId = holder?.isHolder ? holder.tokenIds[0] : undefined;
  const { data: normie } = useNormie(primaryTokenId);

  const recs = useMemo(() => {
    if (!normie?.traits || normie.traits.length === 0) return [];
    return recommend(normie.traits);
  }, [normie]);

  if (!address || !holder?.isHolder) return null;
  if (recs.length === 0) return null;

  return (
    <Card className="border-line-strong bg-canvas">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="default" className="border-line-strong">
            For Normie #{primaryTokenId}
          </Badge>
          <span className="text-sm font-medium text-ink">
            Recommended for your build
          </span>
        </div>
        <p className="mb-4 text-xs text-ink-soft">
          Based on your Normie&apos;s traits ({normie?.traits.map((t) => t.value).join(", ")}),
          we suggest:
        </p>

        <div className="space-y-2">
          {recs.map((r) => {
            const item = r.kind === "skill"
              ? DEMO_SKILLS.find((s) => s.skillId === r.id)
              : DEMO_PATHS.find((p) => p.pathId === r.id);
            if (!item) return null;
            const href = r.kind === "skill" ? `/skills/${r.id}` : `/paths/${r.id}`;
            const label = r.kind === "skill" ? "Skill" : "Path";
            return (
              <Link
                key={`${r.kind}-${r.id}`}
                href={href}
                className="block rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.kind === "path" ? "default" : "outline"}>
                      {label}
                    </Badge>
                    <span className="text-sm font-medium text-ink">{item.name}</span>
                  </div>
                  <span className="text-xs text-ink-muted">→</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">{r.reason}</p>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
