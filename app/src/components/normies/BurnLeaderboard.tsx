"use client";

import { useEffect, useState } from "react";

type Row = {
  wallet: string;
  customizedTokensHeld: number;
  totalRecursiveBurnCount: number;
  tokenIds: number[];
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/// Community commitment leaderboard — wallets ranked by recursive burns into
/// their customized Normies. Sourced from the official rarity index.
export default function BurnLeaderboard({ limit = 10 }: { limit?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let off = false;
    fetch(`/api/normies/burn-leaderboard?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!off && j?.items) { setRows(j.items); setTotal(j.totalWallets ?? null); } })
      .catch(() => {});
    return () => { off = true; };
  }, [limit]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Community burn leaderboard</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Top wallets by recursive burns into customized Normies — a real on-chain commitment signal.
            {total != null && <> · {total} wallets total</>}
          </p>
        </div>
        <span className="mono text-[10px] uppercase tracking-wider text-ink-faint">api.normies.art</span>
      </div>
      <ol className="divide-y divide-line">
        {rows.map((r, i) => (
          <li key={r.wallet} className="flex items-center justify-between gap-4 p-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="mono w-6 text-ink-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="mono text-ink">{short(r.wallet)}</span>
              <span className="mono text-[10px] text-ink-muted">{r.customizedTokensHeld} customized</span>
            </div>
            <span className="mono text-ink-soft">{r.totalRecursiveBurnCount} burns</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
