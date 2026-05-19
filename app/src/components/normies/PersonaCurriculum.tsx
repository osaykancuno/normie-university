"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePersonaOf, type Persona } from "@/hooks/useNormies";
import { DEMO_SKILLS } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Recommendation = {
  kind: "skill";
  id: bigint;
  reason: string;
};

/// Persona-aware curriculum: derives recommendations from the full agent
/// identity (type + traits + canvas state + level + customization) rather
/// than from raw trait strings. The recommendations explicitly cite WHY in
/// language that mirrors the Normie's persona.
/// Only references ACTIVE skill IDs (path bundles hidden during testnet).
function recommendFromPersona(p: Persona): Recommendation[] {
  const recs: Recommendation[] = [];
  const type = p.type.toLowerCase();
  const tagline = p.tagline.toLowerCase();
  const customized = p.canvas.customized;
  const level = p.canvas.level;

  // ─── Type-driven primary recommendation ───────────────────────────────
  if (type === "agent") {
    recs.push({ kind: "skill", id: 33n, reason: `As an Agent type, you're built for autonomous flows — ERC-7702 delegation is your foundation.` });
    recs.push({ kind: "skill", id: 26n, reason: "Cross-chain mastery is table stakes for agent commerce." });
  } else if (type === "alien") {
    recs.push({ kind: "skill", id: 14n, reason: "Alien intelligence pairs perfectly with zero-knowledge cryptography." });
    recs.push({ kind: "skill", id: 26n, reason: "Operate across every chain like a true alien — multi-planet citizen." });
  } else if (type === "cat") {
    recs.push({ kind: "skill", id: 19n, reason: "Cats hunt silently. Flashbots anti-MEV is the art of being unseen on-chain." });
    recs.push({ kind: "skill", id: 2n,  reason: "DeFi fundamentals first — even hunters need their territory mapped (start with Aave V3)." });
  } else {
    // Human (and unknown)
    recs.push({ kind: "skill", id: 2n,  reason: `${p.name}, Aave V3 supply is the classical first lesson for your type.` });
    recs.push({ kind: "skill", id: 1n,  reason: "Uniswap V3 swaps — every agent needs a way in and out of positions." });
  }

  // ─── Tagline-driven flavor ─────────────────────────────────────────────
  if (tagline.includes("philosopher") || tagline.includes("thinker")) {
    recs.push({ kind: "skill", id: 14n, reason: `"${p.tagline}" — ZK proofs are the philosopher's stone of cryptography.` });
  }
  if (tagline.includes("trader") || tagline.includes("dealer") || tagline.includes("hustler")) {
    recs.push({ kind: "skill", id: 12n, reason: `"${p.tagline}" — atomic arbitrage is your craft.` });
  }
  if (tagline.includes("guardian") || tagline.includes("protector")) {
    recs.push({ kind: "skill", id: 6n,  reason: `"${p.tagline}" — Safe multisigs were built for guardians.` });
  }
  if (tagline.includes("explorer") || tagline.includes("wanderer") || tagline.includes("nomad")) {
    recs.push({ kind: "skill", id: 26n, reason: `"${p.tagline}" — Across cross-chain bridging is your medium.` });
  }

  // ─── Canvas-state recommendations ──────────────────────────────────────
  if (customized) {
    recs.push({
      kind: "skill",
      id: 10n,
      reason: `Canvas-customized Normies understand transformation — EIP-2981 royalties keep value flowing.`,
    });
  }
  if (level >= 2) {
    recs.push({
      kind: "skill",
      id: 21n,
      reason: `Level ${level} agent — UniswapX intent-based execution is within reach.`,
    });
  }
  if (level >= 3) {
    recs.push({
      kind: "skill",
      id: 12n,
      reason: `Level ${level} unlocks expert-tier strategies. Cross-DEX arbitrage is your next class.`,
    });
  }

  // Always include the canonical NFT-builder skills for Normie holders
  recs.push({ kind: "skill", id: 9n,  reason: `Native to your collection — ERC-721 mint primitive, the foundation of any NFT op.` });
  recs.push({ kind: "skill", id: 25n, reason: `Blur collection-bidding — sweep your own kind, set the floor.` });
  recs.push({ kind: "skill", id: 10n, reason: `EIP-2981 royalty enforcement — protect the artists who minted your kind.` });

  // Dedup, top 5
  const seen = new Set<string>();
  return recs
    .filter((r) => {
      const k = `${r.kind}-${r.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
}

export function PersonaCurriculum({ address }: { address: `0x${string}` | undefined }) {
  const { data } = usePersonaOf(address);

  const recs = useMemo(() => {
    if (!data?.persona) return [];
    return recommendFromPersona(data.persona);
  }, [data]);

  if (!address || !data?.persona || recs.length === 0) return null;
  const p = data.persona;

  return (
    <Card className="border-line bg-surface">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="default" className="border-line-strong">
            Curriculum for {p.name}
          </Badge>
          <span className="text-sm font-medium text-ink">
            Tailored to your persona
          </span>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-ink-soft">
          {p.tagline} · Level {p.canvas.level} ·
          {" "}{p.canvas.actionPoints.toLocaleString()} AP ·
          {" "}{p.canvas.customized ? "canvas-customized" : "purist form"}.
          {" "}Based on your traits + biography, these are the classes that fit best.
        </p>

        <div className="space-y-2">
          {recs.map((r) => {
            const item = DEMO_SKILLS.find((s) => s.skillId === r.id);
            if (!item) return null;
            return (
              <Link
                key={`skill-${r.id}`}
                href={`/skills/${r.id}`}
                className="block rounded-lg border border-line bg-surface/60 p-3 transition-colors hover:border-line-strong"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Skill</Badge>
                    <span className="text-sm font-medium text-ink">{item.name}</span>
                  </div>
                  <span className="text-xs text-ink-muted">→</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{r.reason}</p>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
