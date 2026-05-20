"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { useTotalTrackedAgents, useLeaderboard } from "@/hooks/useReputation";
import { useAwakenedList, useCollectionStats, useCanvasBatch } from "@/hooks/useNormies";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatReputation, shortAddress } from "@/lib/format";
import { AgentDirectoryCard } from "@/components/agents/AgentDirectoryCard";
import { cn } from "@/lib/utils";

/// Fallback only — used while the live awakened list is loading or if the
/// Normies API is down. Real list is fetched from /api/normies/awakened-list.
const FALLBACK_FEATURED: number[] = [4354, 5506, 1141, 1337];

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

  // Live: pull the most recent awakened Normies from the Normies API.
  // We fetch a wide pool (200) so type-filtering by Cat / Alien / Agent has
  // enough sample to show real entries (most recent dozen are typically all
  // Human). Auto-refreshes every 60s and on tab-visibility change.
  const { items: awakened, refreshedAt: awakenedRefreshedAt } = useAwakenedList(100, 60_000);
  const collectionStats = useCollectionStats();

  // Batched per-token canvas state. Lets us compute LEVEL + CUSTOMIZED
  // filter counts against the awakened pool without 100 separate fetches.
  // Server-cached via getPersonaPreview (shared with the card-level call).
  const allIds = useMemo(() => awakened.map((a) => Number(a.tokenId)), [awakened]);
  const canvasBatch = useCanvasBatch(allIds, 90_000);

  // Index canvas data by tokenId for fast lookup during filter / count.
  const canvasByToken = useMemo(() => {
    const m = new Map<number, { level: number | null; customized: boolean | null }>();
    for (const c of canvasBatch) m.set(Number(c.tokenId), { level: c.level, customized: c.customized });
    return m;
  }, [canvasBatch]);

  const filteredFeatured = useMemo(() => {
    if (awakened.length === 0) return FALLBACK_FEATURED;
    // Filter ALL THREE dimensions server-side using the batched canvas data.
    // No more empty slots in the grid; pagination becomes meaningful.
    const result = awakened.filter((a) => {
      if (typeF !== "all" && a.type !== typeF) return false;
      const c = canvasByToken.get(Number(a.tokenId));
      // If canvas data hasn't loaded yet, show the card (avoid empty grid flash)
      if (!c) return levelF === "all" && stateF === "all";
      // Level filter
      if (levelF !== "all" && c.level !== null) {
        if (levelF === "1"  && c.level !== 1) return false;
        if (levelF === "2"  && c.level !== 2) return false;
        if (levelF === "3+" && c.level <  3 ) return false;
      }
      // Canvas state filter
      if (stateF === "customized" && c.customized === false) return false;
      if (stateF === "purist"     && c.customized === true)  return false;
      return true;
    });
    return result.slice(0, 24).map((a) => Number(a.tokenId));
  }, [awakened, typeF, levelF, stateF, canvasByToken]);

  const typeFilterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: awakened.length };
    for (const a of awakened) counts[a.type] = (counts[a.type] ?? 0) + 1;
    return counts;
  }, [awakened]);

  const levelFilterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: canvasBatch.length, "1": 0, "2": 0, "3+": 0 };
    for (const c of canvasBatch) {
      if (c.level === 1) counts["1"]++;
      else if (c.level === 2) counts["2"]++;
      else if (typeof c.level === "number" && c.level >= 3) counts["3+"]++;
    }
    return counts;
  }, [canvasBatch]);

  const stateFilterCounts = useMemo(() => {
    let custom = 0, purist = 0;
    for (const c of canvasBatch) {
      if (c.customized === true) custom++;
      else if (c.customized === false) purist++;
    }
    return { all: canvasBatch.length, customized: custom, purist };
  }, [canvasBatch]);

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
          <Badge>Student directory</Badge>
          <Badge variant="outline">Normies-first</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Discover{" "}
          <span className="border-b-4 border-line-strong">enrolled Normies</span>.
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-soft">
          Searchable index of Normies — filtered by type, level, and
          customization state. Live data pulled from{" "}
          <a href="https://api.normies.art" target="_blank" rel="noreferrer noopener" className="underline hover:text-ink">api.normies.art</a>.
          {collectionStats && (
            <>
              {" "}
              <span className="mono">{collectionStats.awakenedCount.toLocaleString()}</span>{" "}
              enrolled of{" "}
              <span className="mono">{collectionStats.circulatingSupply.toLocaleString()}</span>{" "}
              circulating
              {collectionStats.burnedCount > 0 && (
                <> ({collectionStats.burnedCount.toLocaleString()} burned)</>
              )}.
            </>
          )}
        </p>
        <div className="mt-2 flex items-center gap-2 text-[11px] mono text-ink-faint">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent-ok)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--accent-ok)]" />
          </span>
          <span>
            Showing the latest {awakened.length} Normies
            {collectionStats && (
              <> of {collectionStats.awakenedCount.toLocaleString()} enrolled</>
            )}
            {" "}· refreshes every 60s
            {awakenedRefreshedAt && (
              <> · last sync {new Date(awakenedRefreshedAt).toLocaleTimeString()}</>
            )}
          </span>
        </div>
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
          {(["all", "Human", "Cat", "Alien", "Agent"] as TypeFilter[]).map((t) => {
            const c = typeFilterCounts[t] ?? 0;
            return (
              <Pill key={t} active={typeF === t} onClick={() => setTypeF(t)}>
                {t}
                {awakened.length > 0 && (
                  <span className="ml-1 text-[10px] text-ink-faint">{c}</span>
                )}
              </Pill>
            );
          })}
        </FilterGroup>
        <Divider />
        <FilterGroup label="Level">
          {(["all", "1", "2", "3+"] as LevelFilter[]).map((l) => {
            const c = levelFilterCounts[l] ?? 0;
            return (
              <Pill key={l} active={levelF === l} onClick={() => setLevelF(l)}>
                {l === "all" ? "all" : `lvl ${l}`}
                {canvasBatch.length > 0 && (
                  <span className="ml-1 text-[10px] text-ink-faint">{c}</span>
                )}
              </Pill>
            );
          })}
        </FilterGroup>
        <Divider />
        <FilterGroup label="Canvas">
          {(["all", "customized", "purist"] as StateFilter[]).map((s) => {
            const c = stateFilterCounts[s] ?? 0;
            return (
              <Pill key={s} active={stateF === s} onClick={() => setStateF(s)}>
                {s}
                {canvasBatch.length > 0 && (
                  <span className="ml-1 text-[10px] text-ink-faint">{c}</span>
                )}
              </Pill>
            );
          })}
        </FilterGroup>
      </div>

      {/* Featured Normies */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="mono text-xs uppercase tracking-wider text-ink-muted">
          Featured Normies
        </h2>
        <Link href="https://normies.art" target="_blank" rel="noreferrer noopener" className="mono text-xs text-ink underline hover:opacity-70">
          → Get a Normie at normies.art
        </Link>
      </div>
      {filteredFeatured.length === 0 ? (
        <div className="border border-line bg-surface p-8 text-center">
          <p className="text-sm text-ink-soft">
            No <span className="font-medium text-ink">{typeF}</span> Normies
            in the latest {awakened.length} fetched from the Normies API.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Of the latest pool:{" "}
            {(["Human", "Cat", "Alien", "Agent"] as const).map((t, i, arr) => (
              <span key={t}>
                <span className="mono">
                  {typeFilterCounts[t] ?? 0} {t}
                </span>
                {i < arr.length - 1 && " · "}
              </span>
            ))}
            . Try a different type or search a specific token id above.
          </p>
        </div>
      ) : (
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
      )}

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
