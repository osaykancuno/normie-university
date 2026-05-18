"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { usePersona, useCanvasFeed, useBurnHistory, useNormie } from "@/hooks/useNormies";
import { useAgentSkills } from "@/hooks/useCredentials";
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

  const { data: personaRes } = usePersona(validId ? id : undefined);
  const { data: canvas }     = useCanvasFeed(validId ? id : undefined, 60_000);
  const { data: burns }      = useBurnHistory(validId ? id : undefined);
  const { data: normieMeta } = useNormie(validId ? id : undefined);
  const ownerAddr = normieMeta?.owner;
  // NORMIE UNIVERSITY credentials currently keyed by wallet — best effort lookup via owner
  const { data: skillIds } = useAgentSkills(ownerAddr);

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
        <Err>Invalid Normie token id (0–9999).</Err>
      </Shell>
    );
  }
  if (!personaRes) {
    return (
      <Shell>
        <div className="h-96 animate-pulse border border-line bg-surface" />
      </Shell>
    );
  }
  const persona = personaRes.persona;
  const binding = personaRes.binding;

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
                  <Badge variant="success">Awakened agent</Badge>
                ) : (
                  <Badge variant="warning">Not yet awakened</Badge>
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
              {binding?.bound && (
                <div>
                  <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                    ERC-8004 agent id
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
              <a
                href={`https://api.normies.art/agents/agent-card/${id}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mono block text-[10px] text-ink-muted hover:text-ink"
              >
                ↗ a2a agent card (json)
              </a>
            </CardContent>
          </Card>
        </aside>

        {/* Main column */}
        <main className="space-y-6 lg:col-span-2">
          {/* Composite reputation */}
          <div className="border border-line-strong bg-surface p-6">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
              Combat readiness
            </div>
            <div className="mt-1 text-5xl font-semibold tracking-tight text-ink">
              {composite}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              composite = √( (canvas AP + burn-derived AP) × NORMIE UNIVERSITY credentials ) × 10
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <Stat label="Canvas AP" value={canvasAP} />
              <Stat label="AP from burns" value={apFromBurns} />
              <Stat label="Skill credentials" value={credCount} />
            </div>
          </div>

          {/* Canvas live state */}
          {persona.canvas?.customized && (
            <div className="border border-line bg-surface p-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge>Canvas</Badge>
                <Badge variant="outline">
                  {persona.canvas.transformations} transformations
                </Badge>
                {lastTransform && (
                  <span className="mono text-[10px] text-ink-muted">
                    last @ {lastTransform.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm text-ink">
                <Stat label="pixels +" value={persona.canvas.pixelDiff.added} />
                <Stat label="pixels −" value={persona.canvas.pixelDiff.removed} />
                <Stat label="net" value={persona.canvas.pixelDiff.net} />
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
              <Link href="/paths"><Button variant="outline">Learning paths</Button></Link>
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
