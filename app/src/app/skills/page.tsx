"use client";

import { useMemo, useState } from "react";
import { useAllSkills, useDemoMode } from "@/hooks/useSkills";
import { SkillCard } from "@/components/skills/SkillCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from "@/lib/skill-meta";
import { cn } from "@/lib/utils";

export default function SkillsPage() {
  const { skills, isLoading, isError } = useAllSkills(200);
  const demo = useDemoMode();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<number | "all">("all");
  const [difficulty, setDifficulty] = useState<number | "all">("all");
  const [onlyActive, setOnlyActive] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (onlyActive && !s.isActive) return false;
      if (category !== "all" && s.category !== category) return false;
      if (difficulty !== "all" && s.difficulty !== difficulty) return false;
      if (q && !(s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [skills, query, category, difficulty, onlyActive]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Skill Catalogue</h1>
          {demo && <Badge variant="warning">Demo mode · contracts not deployed</Badge>}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Curated, verifiable skill modules for on-chain agents. Purchase in ETH or USDC,
          earn a Soulbound credential on completion.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 rounded-none border border-line bg-surface p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            placeholder="Search by name or description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="md:max-w-md"
          />
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="h-4 w-4 rounded border-line bg-surface-2 accent-violet-500"
            />
            Active only
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterPill active={category === "all"} onClick={() => setCategory("all")}>
            All categories
          </FilterPill>
          {CATEGORY_LABELS.map((label, i) => (
            <FilterPill key={label} active={category === i} onClick={() => setCategory(i)}>
              {label}
            </FilterPill>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterPill active={difficulty === "all"} onClick={() => setDifficulty("all")}>
            All levels
          </FilterPill>
          {DIFFICULTY_LABELS.map((label, i) => (
            <FilterPill key={label} active={difficulty === i} onClick={() => setDifficulty(i)}>
              {label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
        <Badge variant="secondary">{filtered.length}</Badge>
        <span>{filtered.length === 1 ? "skill" : "skills"} found</span>
      </div>

      {isError && (
        <div className="rounded-lg border border-[color:var(--accent-err)] bg-surface-2 p-4 text-sm text-[color:var(--accent-err)]">
          Failed to load skills. Check that contracts are deployed on this chain.
        </div>
      )}

      {isLoading && skills.length === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-none border border-line bg-surface" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-none border border-line bg-surface p-10 text-center">
          <p className="text-sm text-ink-soft">
            No skills match your filters.
            {skills.length === 0 && (
              <> The catalogue is being seeded. Check back soon.</>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <SkillCard key={s.skillId.toString()} skill={s} />
        ))}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-none px-3 py-1 text-xs font-medium transition-colors",
        active
          ? " text-white"
          : "border border-line bg-surface-2 text-ink-soft hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
