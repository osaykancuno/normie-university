"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Path } from "@/hooks/usePaths";
import { DEMO_SKILLS } from "@/lib/demo-data";
import { formatUsdc } from "@/lib/format";

export function PathCard({ path }: { path: Path }) {
  // Compute regular/discounted USDC client-side from demo data.
  // When live, the contract `getPathPriceInUsdc` is the source of truth, but
  // for the catalogue card we just want to show the badge — close enough.
  const { regular, discounted, savings } = useMemo(() => {
    let r = 0n;
    for (const id of path.skillIds) {
      const sk = DEMO_SKILLS.find((s) => s.skillId === id);
      if (sk) r += sk.priceInUsdc;
    }
    const d = (r * BigInt(10_000 - path.discountBps)) / 10_000n;
    return { regular: r, discounted: d, savings: r - d };
  }, [path.skillIds, path.discountBps]);

  const discountPct = (path.discountBps / 100).toFixed(0);

  return (
    <Link
      href={`/paths/${path.pathId.toString()}`}
      className="group block focus:outline-none"
    >
      <Card className="h-full border-line transition-colors hover:border-line-strong group-focus-visible:border-violet-500">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <Badge variant="default">Learning Path</Badge>
            <Badge variant="success">−{discountPct}%</Badge>
          </div>

          <div className="flex-1 space-y-1.5">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-ink">
              {path.name}
            </h3>
            <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">
              {path.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-xs text-ink-muted">
            <span>{path.skillIds.length} skills</span>
            {path.totalPurchases > 0n && (
              <span>· {path.totalPurchases.toString()} sold</span>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-ink-muted">Bundle price</span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-ink">
                  {formatUsdc(discounted)} USDC
                </span>
                <span className="text-xs text-ink-muted line-through">
                  {formatUsdc(regular)}
                </span>
              </div>
            </div>
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-[color:var(--accent-ok)] ring-1 ring-[color:var(--accent-ok)]">
              Save {formatUsdc(savings)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
