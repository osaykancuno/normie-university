"use client";

import { use } from "react";
import Link from "next/link";
import { useMemo } from "react";
import { usePath, type Path } from "@/hooks/usePaths";
import { useAllSkills, useDemoMode } from "@/hooks/useSkills";
import { useAgentSkills } from "@/hooks/useCredentials";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsdc, formatEth, shortAddress } from "@/lib/format";
import { categoryLabel, difficultyLabel, difficultyVariant } from "@/lib/skill-meta";

export default function PathDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  let pathId: bigint | undefined;
  try {
    pathId = BigInt(id);
  } catch {
    pathId = undefined;
  }

  const { address } = useAccount();
  const demo = useDemoMode();
  const { data: pathData, isLoading, isError } = usePath(pathId);
  const path = pathData as Path | undefined;
  const { skills } = useAllSkills(200);
  const { data: agentSkillIds } = useAgentSkills(address);
  const ownedSkillIds = (agentSkillIds as bigint[] | undefined) ?? [];

  // Filter skills in this path
  const pathSkills = useMemo(() => {
    if (!path) return [];
    return path.skillIds
      .map((id) => skills.find((s) => s.skillId === id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
  }, [path, skills]);

  // Bundle pricing (computed client-side from skills)
  const pricing = useMemo(() => {
    if (!path || pathSkills.length === 0) return null;
    let regularEth = 0n;
    let regularUsdc = 0n;
    for (const s of pathSkills) {
      regularEth  += s.priceInWei;
      regularUsdc += s.priceInUsdc;
    }
    const factor = BigInt(10_000 - path.discountBps);
    return {
      regularEth,
      regularUsdc,
      discountedEth:  (regularEth  * factor) / 10_000n,
      discountedUsdc: (regularUsdc * factor) / 10_000n,
      discountPct: path.discountBps / 100,
    };
  }, [path, pathSkills]);

  // Path completion: own ALL of the path's skills as credentials
  const completion = useMemo(() => {
    if (!path) return { completed: 0, total: 0, percent: 0 };
    const total = path.skillIds.length;
    const completed = path.skillIds.filter((id) =>
      ownedSkillIds.some((o) => o === id)
    ).length;
    return { completed, total, percent: total === 0 ? 0 : (completed / total) * 100 };
  }, [path, ownedSkillIds]);

  if (pathId === undefined) {
    return (
      <PageShell>
        <div className="rounded-lg border border-[color:var(--accent-err)] bg-surface-2 p-4 text-sm text-[color:var(--accent-err)]">
          Invalid path id.
        </div>
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="h-64 animate-pulse rounded-none border border-line bg-surface" />
      </PageShell>
    );
  }

  if (isError || !path) {
    return (
      <PageShell>
        <div className="rounded-lg border border-[color:var(--accent-err)] bg-surface-2 p-4 text-sm text-[color:var(--accent-err)]">
          Path not found.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-6">
        <Link href="/paths" className="text-sm text-ink-muted hover:text-ink-soft">
          ← Back to paths
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="default">Learning Path</Badge>
              {pricing && (
                <Badge variant="success">−{pricing.discountPct.toFixed(0)}% bundle</Badge>
              )}
              {!path.isActive && <Badge variant="secondary">Inactive</Badge>}
              <span className="text-xs text-ink-muted">#{path.pathId.toString()}</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              {path.name}
            </h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              {path.description}
            </p>
          </div>

          {/* Progress */}
          {address && (
            <Card className="border-line bg-surface">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium text-ink">Your progress</div>
                  <Badge variant={completion.percent === 100 ? "success" : "secondary"}>
                    {completion.completed} / {completion.total}{" "}
                    {completion.percent === 100 ? "· Path completed" : "completed"}
                  </Badge>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-none bg-surface-2">
                  <div
                    className="h-full bg-gradient-to-r from-ink to-line-strong transition-all"
                    style={{ width: `${completion.percent}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skills in path */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink">Skills in this path</h2>
            <div className="space-y-3">
              {pathSkills.map((sk, i) => {
                const owned = ownedSkillIds.some((o) => o === sk.skillId);
                return (
                  <Link
                    key={sk.skillId.toString()}
                    href={`/skills/${sk.skillId.toString()}`}
                    className="block"
                  >
                    <Card className="border-line transition-colors hover:border-line-strong">
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-none bg-surface-2 text-xs font-semibold text-ink-soft">
                            {i + 1}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium text-ink">{sk.name}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline">{categoryLabel(sk.category)}</Badge>
                              <Badge variant={difficultyVariant(sk.difficulty)}>
                                {difficultyLabel(sk.difficulty)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {owned ? (
                          <Badge variant="success">Owned ✓</Badge>
                        ) : (
                          <span className="text-xs text-ink-muted">
                            {formatUsdc(sk.priceInUsdc)} USDC
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Pricing card */}
          {pricing && (
            <Card className="border-line bg-surface">
              <CardContent className="space-y-3 p-5">
                <div className="text-xs uppercase tracking-wider text-ink-muted">Bundle price</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-ink">
                    {formatUsdc(pricing.discountedUsdc)} USDC
                  </span>
                  <span className="text-sm text-ink-muted line-through">
                    {formatUsdc(pricing.regularUsdc)}
                  </span>
                </div>
                <div className="text-xs text-ink-soft">
                  or {formatEth(pricing.discountedEth)} ETH
                </div>
                <div className="rounded-md bg-surface-2 px-3 py-2 text-xs font-medium text-[color:var(--accent-ok)] ring-1 ring-[color:var(--accent-ok)]">
                  You save {formatUsdc(pricing.regularUsdc - pricing.discountedUsdc)} USDC vs
                  buying individually
                </div>
              </CardContent>
            </Card>
          )}

          {/* Purchase / demo notice */}
          {demo ? (
            <div className="space-y-3 rounded-none border border-[color:var(--accent-warn)] bg-surface-2 p-5">
              <Badge variant="warning">Demo mode</Badge>
              <p className="text-sm leading-relaxed text-ink-soft">
                Path bundle purchase is disabled because the protocol contracts
                are not deployed yet. After deploy, <code className="text-ink-soft">purchasePath()</code>{" "}
                atomically buys all skills in the bundle at the discounted price.
              </p>
            </div>
          ) : (
            <div className="rounded-none border border-line bg-surface p-5 text-sm text-ink-soft">
              Connect a wallet to purchase the bundle.
            </div>
          )}

          <div className="rounded-none border border-line bg-surface p-5 text-sm text-ink-soft">
            <div className="mb-2 font-medium text-ink">Curated by</div>
            <span className="font-mono text-ink underline">{shortAddress(path.creator, 6)}</span>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>
  );
}
