"use client";

import { useAllPaths } from "@/hooks/usePaths";
import { useDemoMode } from "@/hooks/useSkills";
import { PathCard } from "@/components/paths/PathCard";
import { Badge } from "@/components/ui/badge";

export default function PathsPage() {
  const { paths, isLoading } = useAllPaths();
  const demo = useDemoMode();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Learning Paths
          </h1>
          {demo && <Badge variant="warning">Demo mode</Badge>}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">
          Curated bundles of skills sold at a 25–30% discount over individual
          purchase. Buy a path → atomically acquire all its skills → earn each
          credential individually on completion. The most efficient way to
          ship a competent agent into the agentic web.
        </p>
      </div>

      {isLoading && paths.length === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-none border border-line bg-surface" />
          ))}
        </div>
      )}

      {!isLoading && paths.length === 0 && (
        <div className="rounded-none border border-line bg-surface p-10 text-center text-sm text-ink-muted">
          No paths yet — the catalogue is being seeded.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paths.map((p) => (
          <PathCard key={p.pathId.toString()} path={p} />
        ))}
      </div>
    </div>
  );
}
