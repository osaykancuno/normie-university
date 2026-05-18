"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { usePersonaPreview, useCanvasFeed } from "@/hooks/useNormies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DEMO_SKILLS, DEMO_PATHS } from "@/lib/demo-data";

/// Pre-school detail — shows the deterministic persona for a Normie BEFORE
/// awakening, with a curriculum already mapped to its traits + canvas state.
export default function PreviewPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = use(params);
  const id = Number(tokenId);
  const validId = Number.isInteger(id) && id >= 0 && id <= 9999;

  const { data: preview, isLoading, error } = usePersonaPreview(validId ? id : undefined);
  const { data: canvas } = useCanvasFeed(validId ? id : undefined, 120_000);

  // Compute trait-driven recommended skills + path (uses the same heuristic
  // as TraitRecommendations but applied to the preview's persona).
  const recommended = useMemo(() => {
    if (!preview?.persona) return null;
    const p = preview.persona;
    const t = p.type?.toLowerCase() ?? "";

    let pathId: bigint = 1n;
    if (t === "agent")  pathId = 3n;
    else if (t === "alien") pathId = 5n;
    else if (t === "cat")   pathId = 1n;
    else if (t === "human") pathId = 1n;

    const path = DEMO_PATHS.find((x) => x.pathId === pathId);
    // Pick 3 starter skills from that path + one Normies-aware (skill 16)
    const skillIds = path ? path.skillIds.slice(0, 3) : [];
    const skills = skillIds
      .map((sid) => DEMO_SKILLS.find((s) => s.skillId === sid))
      .filter((s): s is NonNullable<typeof s> => !!s);
    const normiesSkill = DEMO_SKILLS.find((s) => s.skillId === 16n);
    if (normiesSkill) skills.push(normiesSkill);
    return { path, skills };
  }, [preview]);

  if (!validId) {
    return (
      <Shell>
        <div className="border border-[color:var(--accent-err)] bg-surface-2 p-6 text-sm text-[color:var(--accent-err)]">
          Invalid Normie token id. Valid range: 0–9999.
        </div>
      </Shell>
    );
  }
  if (isLoading) return <Shell><LoadingPreview /></Shell>;
  if (error || !preview) {
    return (
      <Shell>
        <div className="border border-line bg-surface p-6 text-sm text-ink-soft">
          Could not load preview for Normie #{id}. Either the token doesn&apos;t
          exist or the Normies API is temporarily unreachable.
        </div>
      </Shell>
    );
  }

  const persona = preview.persona;
  const lastTransform = canvas?.lastTransformAt
    ? new Date(canvas.lastTransformAt * 1000)
    : null;
  const transformations = canvas?.versions?.length ?? 0;

  return (
    <Shell>
      <div className="mb-4">
        <Link href="/preview" className="mono text-xs text-ink-muted hover:text-ink">
          ← back to pre-school
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* LEFT — persona portrait */}
        <aside className="lg:col-span-1">
          <Card className="overflow-hidden">
            <div className="aspect-square bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.image.svg}
                alt={`Normie #${id}`}
                className="h-full w-full pixel"
              />
            </div>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Preview</Badge>
                <Badge variant="outline">Not yet awakened</Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink">
                  {persona.name}
                </h1>
                <p className="mono text-xs text-ink-muted">
                  Normie #{id} · {persona.type}
                </p>
              </div>
              {persona.tagline && (
                <p className="text-sm italic text-ink-soft">
                  &ldquo;{persona.tagline}&rdquo;
                </p>
              )}
              <div className="rule" />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Stat label="Level" value={persona.canvas?.level ?? "—"} />
                <Stat label="AP" value={persona.canvas?.actionPoints ?? "—"} />
                <Stat
                  label="Customized"
                  value={persona.canvas?.customized ? "yes" : "no"}
                />
                <Stat label="Transforms" value={transformations} />
                <Stat
                  label="Pixels +"
                  value={persona.canvas?.diff?.addedCount ?? 0}
                />
                <Stat
                  label="Pixels −"
                  value={persona.canvas?.diff?.removedCount ?? 0}
                />
              </div>
              {lastTransform && (
                <p className="mono text-[10px] text-ink-muted">
                  last transformed {lastTransform.toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* RIGHT — persona narrative + curriculum */}
        <main className="space-y-6 lg:col-span-2">
          {/* Greeting */}
          {persona.greeting && (
            <div className="border border-line-strong bg-surface p-6">
              <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                Greeting
              </div>
              <p className="mt-2 text-xl leading-relaxed text-ink">
                &ldquo;{persona.greeting}&rdquo;
              </p>
            </div>
          )}

          {/* Personality */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-3 mono text-[10px] uppercase tracking-wider text-ink-muted">
                Personality · 8 layers
              </div>
              <ul className="space-y-2 text-sm text-ink">
                {(persona.personalityTraits ?? persona.personality ?? []).map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mono text-ink-muted">0{i + 1}</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              {persona.communicationStyle && (
                <div className="rule my-4" />
              )}
              {persona.communicationStyle && (
                <div>
                  <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                    Communication style
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    {persona.communicationStyle}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quirks */}
          {persona.quirks && persona.quirks.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-3 mono text-[10px] uppercase tracking-wider text-ink-muted">
                  Quirks · {persona.quirks.length} mannerisms
                </div>
                <ul className="grid gap-2 text-sm text-ink sm:grid-cols-2">
                  {persona.quirks.map((q, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-ink-muted">→</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Backstory — API returns a single paragraph string */}
          {persona.backstory && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-3 mono text-[10px] uppercase tracking-wider text-ink-muted">
                  Backstory
                </div>
                <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
                  {(Array.isArray(persona.backstory)
                    ? (persona.backstory as string[])
                    : String(persona.backstory).split(/\n+/).filter(Boolean)
                  ).map((b, i) => (
                    <p key={i}>{b}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended curriculum */}
          {recommended && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                    Recommended curriculum for {persona.name}
                  </div>
                  {recommended.path && (
                    <Link
                      href={`/paths/${recommended.path.pathId.toString()}`}
                      className="mono text-xs text-ink underline hover:opacity-70"
                    >
                      → start with {recommended.path.name}
                    </Link>
                  )}
                </div>
                <div className="grid gap-2">
                  {recommended.skills.map((s) => (
                    <Link
                      key={s.skillId.toString()}
                      href={`/skills/${s.skillId.toString()}`}
                      className="flex items-center justify-between border border-line bg-paper p-3 transition-colors hover:border-line-strong"
                    >
                      <span className="text-sm text-ink">{s.name}</span>
                      <Badge variant="outline">
                        {s.priceInUsdc > 0n
                          ? `${Number(s.priceInUsdc) / 1e6} USDC`
                          : "Free"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CTA */}
          <div className="border border-line-strong bg-canvas p-6">
            <h3 className="text-lg font-semibold text-ink">
              Ready to graduate?
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              {preview.hint}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://normies.art/lab"
                target="_blank"
                rel="noreferrer noopener"
              >
                <Button>Awaken on normies.art/lab →</Button>
              </a>
              <Link href="/skills">
                <Button variant="outline">Browse the curriculum</Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function LoadingPreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="h-[500px] animate-pulse border border-line bg-surface" />
      <div className="space-y-4 lg:col-span-2">
        <div className="h-24 animate-pulse border border-line bg-surface" />
        <div className="h-40 animate-pulse border border-line bg-surface" />
        <div className="h-40 animate-pulse border border-line bg-surface" />
      </div>
    </div>
  );
}
