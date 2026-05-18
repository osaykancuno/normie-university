"use client";

import { useState } from "react";
import Link from "next/link";
import { useLeaderboard } from "@/hooks/useReputation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatReputation, shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100] as const;

export default function ReputationLeaderboardPage() {
  const [n, setN] = useState<(typeof PAGE_SIZES)[number]>(25);
  const { data, isLoading, isError } = useLeaderboard(n);

  const result = data as [readonly `0x${string}`[], readonly bigint[]] | undefined;
  const addresses = result?.[0] ?? [];
  const scores = result?.[1] ?? [];

  const rows = addresses.map((addr, i) => ({ addr, score: scores[i] ?? 0n }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Reputation Leaderboard</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Top agents by composable on-chain reputation score. Readable by any external protocol.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {PAGE_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => setN(size)}
            className={cn(
              "rounded-none px-3 py-1 text-xs font-medium transition-colors",
              n === size
                ? " text-white"
                : "border border-line bg-surface-2 text-ink-soft hover:text-ink"
            )}
          >
            Top {size}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-lg border border-[color:var(--accent-err)] bg-surface-2 p-4 text-sm text-[color:var(--accent-err)]">
          Unable to load leaderboard.
        </div>
      )}

      <Card className="border-line bg-surface">
        <CardContent className="p-0">
          <div className="divide-y divide-line">
            {isLoading && (
              <div className="p-6 text-center text-sm text-ink-muted">Loading…</div>
            )}

            {!isLoading && rows.length === 0 && (
              <div className="p-10 text-center text-sm text-ink-muted">
                No ranked agents yet.
              </div>
            )}

            {rows.map((row, i) => (
              <Link
                key={row.addr}
                href={`/agents/${row.addr}`}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-center gap-4">
                  <RankBadge rank={i + 1} />
                  <div>
                    <div className="font-mono text-sm text-ink">
                      {shortAddress(row.addr, 6)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-ink">
                    {formatReputation(row.score)}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {row.score.toString()} bps
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Badge variant="warning">#1</Badge>;
  if (rank === 2) return <Badge variant="default">#2</Badge>;
  if (rank === 3) return <Badge variant="success">#3</Badge>;
  return <Badge variant="secondary">#{rank}</Badge>;
}
