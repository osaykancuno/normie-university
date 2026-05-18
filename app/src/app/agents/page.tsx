"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { useTotalTrackedAgents, useLeaderboard } from "@/hooks/useReputation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatReputation, shortAddress } from "@/lib/format";
import { AgentDirectoryCard } from "@/components/agents/AgentDirectoryCard";
import { cn } from "@/lib/utils";

/// Curated set of Normie token ids surfaced as "featured agents" in the
/// directory. Each card pulls its persona live from the Normies API and
/// renders pixel art + name + tagline + level. Covers all 4 types.
const FEATURED_NORMIES: number[] = [
  42, 100, 1337, 4354, 7777, 9001,
  1, 256, 512, 2048, 3333, 5555,
];

type TypeFilter = "all" | "Human" | "Cat" | "Alien" | "Agent";
type LevelFilter = "all" | "1" | "2" | "3+";
type StateFilter = "all" | "customized" | "purist";

export default function AgentsDirectoryPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [typeF, setTypeF] = useState<TypeFilter>("all");
  const [levelF, setLevelF] = useState<LevelFilter>("all");
  const [stateF, setStateF] = useState<StateFilter>("all");

  const { data: totalTracked } = useTotalTrackedAgents();
  const { data: lb } = useLeaderboard(12);
  const [lbAddrs, lbScores] = (lb as [readonly `0x${string}`[], readonly bigint[]] | undefined) ?? [[], []];

  const filteredFeatured = useMemo(() => {
    // We use indexes; actual filter happens at card-level using the persona it fetches.
    // For now we pass filters down and each card decides whether to render.
    return FEATURED_NORMIES;
  }, []);

  const onLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = query.trim();
    if (!v) return;
    // Numeric → preview
    const asNumber = Number(v);
    if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 9999) {
      router.push(`/agents/normie/${asNumber}`);
      return;
    }
    // EVM address → profile
    if (isAddress(v)) {
      router.push(`/agents/${v}`);
      return;
    }
    setError("Enter a Normie token id (0–9999) or a 0x… address.");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge>Agent directory</Badge>
          <Badge variant="outline">Normies-first</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Discover{" "}
          <span className="border-b-4 border-line-strong">awakened agents</span>.
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-soft">
          Searchable index of ERC-8004 agents — filtered by type, level, and
          customization state. Live persona data pulled from{" "}
          <a href="https://api.normies.art" target="_blank" rel="noreferrer noopener" className="underline hover:text-ink">api.normies.art</a>.
          {totalTracked !== undefined && (
            <> NORMIE UNIVERSITY tracks <span className="mono">{(totalTracked as bigint).toString()}</span> ranked agents.</>
          )}
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={onLookup} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Normie token id (0–9999) or 0x… address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-md"
        />
        <Button type="submit">Find →</Button>
      </form>
      {error && (
        <div className="mb-6 border border-[color:var(--accent-err)] bg-surface-2 p-3 text-sm text-[color:var(--accent-err)]">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border border-line bg-surface p-4">
        <FilterGroup label="Type">
          {(["all", "Human", "Cat", "Alien", "Agent"] as TypeFilter[]).map((t) => (
            <Pill key={t} active={typeF === t} onClick={() => setTypeF(t)}>
              {t}
            </Pill>
          ))}
        </FilterGroup>
        <Divider />
        <FilterGroup label="Level">
          {(["all", "1", "2", "3+"] as LevelFilter[]).map((l) => (
            <Pill key={l} active={levelF === l} onClick={() => setLevelF(l)}>
              {l === "all" ? "all" : `lvl ${l}`}
            </Pill>
          ))}
        </FilterGroup>
        <Divider />
        <FilterGroup label="Canvas">
          {(["all", "customized", "purist"] as StateFilter[]).map((s) => (
            <Pill key={s} active={stateF === s} onClick={() => setStateF(s)}>
              {s}
            </Pill>
          ))}
        </FilterGroup>
      </div>

      {/* Featured Normie agents */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="mono text-xs uppercase tracking-wider text-ink-muted">
          Featured awakened Normies
        </h2>
        <Link href="/preview" className="mono text-xs text-ink underline hover:opacity-70">
          → Pre-school: preview any Normie
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredFeatured.map((id) => (
          <AgentDirectoryCard
            key={id}
            tokenId={id}
            typeFilter={typeF}
            levelFilter={levelF}
            stateFilter={stateF}
          />
        ))}
      </div>

      {/* Top by reputation */}
      <div className="mt-12">
        <h2 className="mono text-xs uppercase tracking-wider text-ink-muted">
          Top by reputation
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lbAddrs.length === 0 ? (
            <div className="col-span-full border border-line bg-surface p-6 text-center text-sm text-ink-muted">
              No ranked agents yet.
            </div>
          ) : (
            lbAddrs.map((a, i) => (
              <Link key={a} href={`/agents/${a}`} className="block">
                <div className="flex items-center justify-between gap-4 border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                  <div>
                    <div className="mono text-sm text-ink">{shortAddress(a, 6)}</div>
                    <div className="mono text-xs text-ink-muted">rank #{i + 1}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-ink">
                      {formatReputation(lbScores[i] ?? 0n)}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="mono text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Divider() {
  return <span className="hidden h-5 w-px bg-line sm:inline-block" />;
}

function Pill({
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
        "border px-2 py-0.5 text-[11px] font-medium transition-colors mono uppercase tracking-wider",
        active
          ? "border-ink bg-ink text-paper"
          : "border-line bg-surface text-ink-soft hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
