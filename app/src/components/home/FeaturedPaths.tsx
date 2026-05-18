"use client";

import Link from "next/link";
import { useAllPaths } from "@/hooks/usePaths";
import { PathCard } from "@/components/paths/PathCard";

export function FeaturedPaths() {
  const { paths } = useAllPaths();
  if (paths.length === 0) return null;

  const featured = paths.slice(0, 3);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Learning Paths
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Curated bundles — save 25–30% over buying individually.
          </p>
        </div>
        <Link
          href="/paths"
          className="text-sm font-medium text-ink underline hover:underline"
        >
          See all paths →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((p) => (
          <PathCard key={p.pathId.toString()} path={p} />
        ))}
      </div>
    </section>
  );
}
