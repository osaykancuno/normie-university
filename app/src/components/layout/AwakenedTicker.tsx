"use client";

import { useCollectionStats } from "@/hooks/useNormies";

/// Live "awakened count" indicator. Polls /api/normies/collection-stats every
/// 30s. Renders nothing while loading so it doesn't cause layout shift.
/// We're the school for awakened agents — this number IS our product.
export function AwakenedTicker({ compact = false }: { compact?: boolean }) {
  const stats = useCollectionStats(30_000);
  if (!stats) return null;
  const n = stats.awakenedCount;
  return (
    <div
      className="inline-flex items-center gap-1.5 border border-line bg-paper px-2 py-1"
      title="Normies enrolled at NORMIE UNIVERSITY · live from api.normies.art · updates every 30s"
    >
      <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent-ok)] opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--accent-ok)]" />
      </span>
      <span className="mono text-[11px] font-semibold tracking-tight text-ink tabular-nums">
        {n.toLocaleString()}
      </span>
      {!compact && (
        <span className="mono text-[10px] uppercase tracking-wider text-ink-muted">
          enrolled
        </span>
      )}
    </div>
  );
}
