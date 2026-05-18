"use client";

import { useMemo, useState } from "react";
import { useAllSkills } from "@/hooks/useSkills";
import { SkillCard } from "@/components/skills/SkillCard";
import { cn } from "@/lib/utils";

type SortKey = "trending" | "new" | "top" | "popular";

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: "trending", label: "Trending",    hint: "Most purchased this week" },
  { key: "new",      label: "New",         hint: "Recently published" },
  { key: "top",      label: "Top rated",   hint: "Highest average rating" },
  { key: "popular",  label: "Most popular",hint: "All-time purchases" },
];

export default function MarketplacePage() {
  const { skills, isLoading } = useAllSkills(200);
  const [sort, setSort] = useState<SortKey>("trending");

  const ordered = useMemo(() => {
    const active = skills.filter((s) => s.isActive);

    const withRating = active.map((s) => ({
      ...s,
      avgRatingX100:
        s.ratingCount > 0n
          ? Number(s.ratingSum) * 100 / Number(s.ratingCount)
          : 0,
    }));

    switch (sort) {
      case "new":
        return [...withRating].sort((a, b) => Number(b.createdAt - a.createdAt));
      case "top":
        return [...withRating].sort((a, b) =>
          b.avgRatingX100 - a.avgRatingX100 ||
          Number(b.ratingCount - a.ratingCount)
        );
      case "popular":
        return [...withRating].sort((a, b) => Number(b.totalPurchases - a.totalPurchases));
      case "trending":
      default:
        // Heuristic: purchases weighted by recency
        return [...withRating].sort((a, b) => {
          const ageA = Math.max(1, Number(BigInt(Math.floor(Date.now() / 1000)) - a.createdAt));
          const ageB = Math.max(1, Number(BigInt(Math.floor(Date.now() / 1000)) - b.createdAt));
          const scoreA = Number(a.totalPurchases) / Math.sqrt(ageA);
          const scoreB = Number(b.totalPurchases) / Math.sqrt(ageB);
          return scoreB - scoreA;
        });
    }
  }, [skills, sort]);

  const top = ordered.slice(0, 24);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Marketplace</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Discover skill modules sorted by momentum, recency, and reputation.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            title={s.hint}
            className={cn(
              "rounded-none px-4 py-1.5 text-sm font-medium transition-colors",
              sort === s.key
                ? " text-white"
                : "border border-line bg-surface-2 text-ink-soft hover:text-ink"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading && skills.length === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-none border border-line bg-surface" />
          ))}
        </div>
      )}

      {!isLoading && top.length === 0 && (
        <div className="rounded-none border border-line bg-surface p-10 text-center text-sm text-ink-muted">
          No active skills yet. The registry is empty.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((s) => (
          <SkillCard key={s.skillId.toString()} skill={s} />
        ))}
      </div>
    </div>
  );
}
