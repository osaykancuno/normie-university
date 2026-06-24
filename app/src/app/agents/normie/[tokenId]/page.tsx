"use client";

import { use, useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { usePersona, usePersonaPreview, useCanvasFeed, useBurnHistory, useNormie } from "@/hooks/useNormies";
import { useAgentSkills } from "@/hooks/useCredentials";
import { usePreviewReputation, TIER_LABELS } from "@/hooks/useReputation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { categoryLabel, difficultyLabel } from "@/lib/skill-meta";
import { DEMO_SKILLS } from "@/lib/demo-data";
import { shortAddress } from "@/lib/format";

/// Profile page for an AWAKENED Normie agent — lookup by tokenId.
/// Pulls persona, canvas state, burn history, and NORMIE UNIVERSITY credentials.
/// Distinct from /agents/[address] which is keyed on wallet address.
export default function NormieAgentProfilePage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = use(params);
  const id = Number(tokenId);
  const validId = Number.isInteger(id) && id >= 0 && id <= 9999;

  // Try the awakened-agent endpoint first; if the Normie is not awakened (or
  // has been burned) /api/normies/agent/[id] returns 404 and the hook errors —
  // we then fall back to the persona-preview which works for any minted token.
  const { data: personaRes, error: personaErr } = usePersona(validId ? id : undefined);
  const { data: preview }    = usePersonaPreview(
    validId && personaErr ? id : undefined
  );
  const { data: canvas }     = useCanvasFeed(validId ? id : undefined, 60_000);
  const { data: burns }      = useBurnHistory(validId ? id : undefined);
  const { data: normieMeta, error: normieErr } = useNormie(validId ? id : undefined);

  // Distinguish a genuinely burned/non-existent token (upstream 404) from a
  // transient Normies API outage (502 / timeout). Only a 404 means "gone" —
  // a 502 must NOT render the burned-token page for a perfectly valid Normie.
  const is404 = (e: Error | null | undefined) =>
    !!e && /\(404\)/.test(e.message);
  const isApiDown = (e: Error | null | undefined) =>
    !!e && /\((?:5\d\d|0)\)/.test(e.message);

  const isBurnedOrGone =
    validId && is404(normieErr) && is404(personaErr) && !preview;

  // Upstream degraded: persona + owner both failed but NOT with a 404.
  const isApiDegraded =
    validId && !isBurnedOrGone && isApiDown(personaErr) && isApiDown(normieErr) && !preview;
  const ownerAddr = normieMeta?.owner;
  // v1 design: SkillCredential is mapping(wallet => skills). We show the skills
  // owned by the *current* holder wallet of this Normie. If the NFT is sold,
  // the buyer's wallet doesn't inherit the seller's credentials — they remain
  // soulbound to the original purchaser. v2 will use ERC-6551 token-bound
  // accounts so credentials follow the NFT (see Roadmap in README).
  const { data: skillIds } = useAgentSkills(ownerAddr);
  // Canonical on-chain reputation from ReputationEngine (preview = computed
  // live without a write). This is the protocol's single source of truth;
  // the Normies-flavoured composite below is a separate activity display.
  const { data: repData } = usePreviewReputation(ownerAddr);

  // Official rarity index — rank, score, fair value, type floor. Enriches the
  // profile with how rare/valuable this Normie is (from api.normies.art).
  const [rarity, setRarity] = useState<{
    rank?: number; rarityScore?: number; fairValue?: number | string;
    typeFloor?: number | string; openseaUrl?: string;
  } | null>(null);
  useEffect(() => {
    if (!validId) return;
    let off = false;
    fetch(`/api/normies/rarity/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!off && j?.rarity) setRarity(j.rarity); })
      .catch(() => {});
    return () => { off = true; };
  }, [id, validId]);

  const credentials = useMemo(() => {
    const ids = (skillIds as bigint[] | undefined) ?? [];
    return ids.map((sid) => {
      const s = DEMO_SKILLS.find((sk) => sk.skillId === sid);
      return { skillId: sid, skill: s };
    });
  }, [skillIds]);

  if (!validId) {
    return (
      <Shell>
        <Err>Invalid Normie token id (range 0–9999).</Err>
      </Shell>
    );
  }
  if (isApiDegraded) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl border border-[color:var(--accent-warn)] bg-surface p-8 text-center">
          <h1 className="text-2xl font-semibold text-ink">Normie #{id}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            The Normies API is briefly unavailable upstream, so this Normie&apos;s
            live persona and canvas state can&apos;t be loaded right now. This is a
            temporary outage on the data source — not a problem with the token.
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Reload in a moment — the page recovers automatically once the API responds.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/agents" className="mono text-xs text-ink underline">← back to directory</Link>
            <Link href="/skills" className="mono text-xs text-ink underline">browse skills</Link>
          </div>
        </div>
      </Shell>
    );
  }
  if (isBurnedOrGone) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl border border-line bg-surface p-8 text-center">
          <h1 className="text-2xl font-semibold text-ink">Normie #{id} is not here.</h1>
          <p className="mt-2 text-sm text-ink-soft">
            This token has been permanently burned in the Normies burn-commit
            flow, or never existed. Burned Normies are removed from circulation —
            their pixel mass is redistributed as Action Points to surviving
            Normies via the receiver mechanism.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/agents" className="mono text-xs text-ink underline">← back to directory</Link>
            <Link href="/skills" className="mono text-xs text-ink underline">browse skills</Link>
          </div>
        </div>
      </Shell>
    );
  }
  // Loading state — wait for either the awakened or the preview endpoint
  if (!personaRes && !preview) {
    return (
      <Shell>
        <div className="h-96 animate-pulse border border-line bg-surface" />
      </Shell>
    );
  }
  // Use awakened persona when available, otherwise the preview persona.
  const persona = personaRes?.persona ?? preview?.persona;
  const binding = personaRes?.binding ?? null;
  if (!persona) {
    return (
      <Shell>
        <Err>Could not load Normie #{id}. Try again in a moment.</Err>
      </Shell>
    );
  }

  const lastTransform = canvas?.lastTransformAt
    ? new Date(canvas.lastTransformAt * 1000)
    : null;

  // Composite reputation: AP from canvas + AP from burns + NORMIE UNIVERSITY credentials
  const apFromBurns = burns?.summary.totalApFromBurns ?? 0;
  const canvasAP    = persona.canvas?.actionPoints ?? 0;
  const credCount   = credentials.length;
  const composite   = Math.round(Math.sqrt(Math.max(canvasAP + apFromBurns, 1) * Math.max(credCount, 1)) * 10);

  return (
    <Shell>
      <div className="mb-4">
        <Link href="/agents" className="mono text-xs text-ink-muted hover:text-ink">
          ← directory
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Portrait + binding */}
        <aside className="space-y-4 lg:col-span-1">
          <Card className="overflow-hidden">
            <div className="aspect-square bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.normies.art/normie/${id}/image.svg`}
                alt={`Normie #${id}`}
                className="h-full w-full pixel"
              />
            </div>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                {binding?.bound ? (
                  <Badge variant="success">Enrolled</Badge>
                ) : (
                  <Badge variant="warning">Not yet enrolled</Badge>
                )}
                <Badge variant="outline">{persona.type}</Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink">
                  {persona.name}
                </h1>
                <p className="mono text-xs text-ink-muted">Normie #{id}</p>
              </div>
              {persona.tagline && (
                <p className="text-sm italic text-ink-soft">
                  &ldquo;{persona.tagline}&rdquo;
                </p>
              )}
              <div className="rule" />
              {binding?.bound && binding.agentId && (
                <div>
                  <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                    Normie agent id
                  </div>
                  <div className="mono text-xs text-ink">{binding.agentId}</div>
                </div>
              )}
              {ownerAddr && (
                <div>
                  <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                    Held by
                  </div>
                  <Link href={`/agents/${ownerAddr}`} className="mono text-xs text-ink underline hover:opacity-70">
                    {shortAddress(ownerAddr, 6)}
                  </Link>
                </div>
              )}
              <div className="rule" />
              {/* Official Normies ERC-8004 agent records — NU builds on these. */}
              <div className="mono text-[9px] uppercase tracking-wider text-ink-faint">Official ERC-8004 records</div>
              <a
                href={`https://api.normies.art/agents/agent-card/${id}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mono block text-[10px] text-ink-muted hover:text-ink"
              >
                ↗ a2a agent card (json)
              </a>
              <a
                href={`https://api.normies.art/agents/metadata/${id}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mono block text-[10px] text-ink-muted hover:text-ink"
              >
                ↗ erc-8004 metadata (json)
              </a>
            </CardContent>
          </Card>
        </aside>

        {/* Main column */}
        <main className="space-y-6 lg:col-span-2">
          {/* Protocol reputation — the canonical on-chain ReputationEngine score */}
          {(() => {
            const r = repData as
              | { score: bigint; tier: number; skillCount: bigint; avgSkillLevel: bigint; categoryDiversity: bigint; avgVerifyScore: bigint }
              | undefined;
            const scoreBps = r ? Number(r.score) : 0;     // 0..10000
            const scorePct = (scoreBps / 100).toFixed(1); // 0..100
            const tier = r ? TIER_LABELS[r.tier] ?? "Novice" : "Novice";
            return (
              <div className="border border-line-strong bg-surface p-6">
                <div className="flex items-center justify-between">
                  <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                    Protocol reputation · on-chain
                  </div>
                  <Badge variant="outline">{tier}</Badge>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold tracking-tight text-ink">{scorePct}</span>
                  <span className="mono text-sm text-ink-muted">/ 100</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  Read from <code className="text-ink-soft">ReputationEngine</code> — 30% skills · 25% avg level ·
                  15% category diversity · 10% tenure · 20% verification &amp; validation score.
                </p>
                {r && (
                  <div className="mt-4 grid grid-cols-4 gap-3 text-xs">
                    <Stat label="Skills" value={Number(r.skillCount)} />
                    <Stat label="Avg level" value={(Number(r.avgSkillLevel) / 100).toFixed(1)} />
                    <Stat label="Categories" value={Number(r.categoryDiversity)} />
                    <Stat label="Verify score" value={Number(r.avgVerifyScore)} />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Rarity — from the official Normies rarity index */}
          {rarity && (rarity.rank || rarity.rarityScore) && (
            <div className="border border-line bg-surface p-6">
              <div className="flex items-center justify-between">
                <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                  Rarity · api.normies.art
                </div>
                {rarity.openseaUrl && (
                  <a href={String(rarity.openseaUrl)} target="_blank" rel="noopener noreferrer"
                    className="mono text-[11px] text-ink underline decoration-line-strong underline-offset-2 hover:opacity-70">
                    OpenSea →
                  </a>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                {rarity.rank != null && <Stat label="Rank" value={`#${rarity.rank}`} />}
                {rarity.rarityScore != null && <Stat label="Score" value={Number(rarity.rarityScore).toFixed(0)} />}
                {rarity.fairValue != null && <Stat label="Fair value" value={`${rarity.fairValue} Ξ`} />}
                {rarity.typeFloor != null && <Stat label="Type floor" value={`${rarity.typeFloor} Ξ`} />}
              </div>
            </div>
          )}

          {/* Normies activity index — community-flavoured, NOT the protocol score */}
          <div className="border border-line bg-surface p-6">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
              Normies activity index
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-ink-soft">
              {composite}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              A community display blending Normies canvas &amp; burn activity with earned credentials:
              √( (canvas AP + burn-derived AP) × credentials ) × 10. Not the on-chain protocol score above.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <Stat label="Canvas AP" value={canvasAP} />
              <Stat label="AP from burns" value={apFromBurns} />
              <Stat label="Skill credentials" value={credCount} />
            </div>
          </div>

          {/* Canvas live state */}
          {persona.canvas?.customized && persona.canvas?.diff && (
            <div className="border border-line bg-surface p-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge>Canvas</Badge>
                <Badge variant="outline">
                  {(persona.canvas.diff.addedCount ?? 0) + (persona.canvas.diff.removedCount ?? 0)} pixel edits
                </Badge>
                {lastTransform && (
                  <span className="mono text-[10px] text-ink-muted">
                    last @ {lastTransform.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm text-ink">
                <Stat label="pixels +" value={persona.canvas.diff.addedCount ?? 0} />
                <Stat label="pixels −" value={persona.canvas.diff.removedCount ?? 0} />
                <Stat label="net" value={persona.canvas.diff.netChange ?? 0} />
              </div>
            </div>
          )}

          {/* Burn-derived reputation feed */}
          {burns && burns.summary.burnsReceived > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-3 mono text-[10px] uppercase tracking-wider text-ink-muted">
                  Burn lineage · {burns.summary.burnsReceived} commitments → +{burns.summary.totalApFromBurns} AP
                </div>
                <ul className="space-y-2 text-xs text-ink-soft">
                  {burns.burns.slice(0, 5).map((b) => (
                    <li key={b.commitId} className="flex items-center justify-between gap-3 border border-line bg-paper p-2">
                      <div className="mono">
                        commit #{b.commitId} · {b.tokenCount} burned ·{" "}
                        {new Date(b.timestamp * 1000).toLocaleDateString()}
                      </div>
                      <span className="mono text-ink">+{b.transferredActionPoints} AP</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* NORMIE UNIVERSITY credentials */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                  NORMIE UNIVERSITY credentials
                </div>
                <Link href="/skills" className="mono text-xs text-ink underline hover:opacity-70">
                  + acquire more
                </Link>
              </div>
              {credentials.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No NORMIE UNIVERSITY credentials yet. Skills earned by the wallet
                  holding this Normie will appear here.
                </p>
              ) : (
                <div className="space-y-2">
                  {credentials.map((c) => (
                    <Link
                      key={c.skillId.toString()}
                      href={`/skills/${c.skillId.toString()}`}
                      className="flex items-center justify-between border border-line bg-paper p-3 transition-colors hover:border-line-strong"
                    >
                      <div>
                        <div className="text-sm text-ink">
                          {c.skill?.name ?? `Skill #${c.skillId.toString()}`}
                        </div>
                        <div className="mono text-[10px] text-ink-muted">
                          {c.skill ? `${categoryLabel(c.skill.category)} · ${difficultyLabel(c.skill.difficulty)}` : ""}
                        </div>
                      </div>
                      <Badge variant="success">Earned ✓</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* CTA — buy / verify */}
          <div className="border border-line bg-canvas p-6">
            <h3 className="text-base font-semibold text-ink">
              Equip {persona.name} with more skills
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              NORMIE UNIVERSITY uses {persona.name}&apos;s traits, level, and canvas
              history to recommend a tailored curriculum. Buy via x402 USDC,
              earn an on-chain SBT, build composable reputation.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/skills"><Button>Browse curriculum →</Button></Link>
              <Link href="/use-cases"><Button variant="outline">Use cases</Button></Link>
            </div>
          </div>
        </main>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="text-base font-semibold text-ink">{value}</div>
    </div>
  );
}
function Err({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-[color:var(--accent-err)] bg-surface-2 p-6 text-sm text-[color:var(--accent-err)]">
      {children}
    </div>
  );
}
