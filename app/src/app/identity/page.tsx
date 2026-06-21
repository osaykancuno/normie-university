"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Identity = {
  token: string; tokenId: string; exists: boolean; owner: string | null;
  bound: boolean; agentId: string | null; identity: string | null;
  controller: string | null; skillCount: number;
};

const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

export default function IdentityPage() {
  const [tokenId, setTokenId] = useState("1");
  const [data, setData] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resolve(id?: string) {
    const v = (id ?? tokenId).trim();
    if (!v) return;
    setTokenId(v); setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/agent-identity?tokenId=${encodeURIComponent(v)}`);
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Lookup failed"); setData(null); }
      else setData(j);
    } catch { setErr("Network error"); setData(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { resolve("1"); /* initial */ }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="mb-3"><Badge>Agent Identity</Badge></div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Skills live on the NFT, not the wallet.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
          A Normie is bound to a NORMIE UNIVERSITY agent identity (ERC-8217 / ERC-8004).
          Its credentials and reputation are minted to that identity — and the identity&apos;s
          controller is read live from <span className="mono">ownerOf(Normie)</span>. Sell the
          Normie, and its entire education transfers atomically to the new owner.
        </p>
        <p className="mt-2 text-xs mono text-ink-muted">
          Sepolia prototype — bound to a testnet Mock Normies collection. The same contract binds the
          real Normies at the mainnet launch.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 border border-line-strong bg-surface p-4">
        <label className="text-sm text-ink-soft">
          <span className="mono block text-[10px] uppercase tracking-wider text-ink-muted">Mock Normie #</span>
          <input
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") resolve(); }}
            className="mono mt-1 w-32 border border-line bg-paper px-3 py-1.5 text-ink outline-none focus:border-line-strong"
          />
        </label>
        <button
          onClick={() => resolve()}
          disabled={loading}
          className="border border-line-strong bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40 mono"
        >
          {loading ? "Resolving…" : "Resolve identity →"}
        </button>
      </div>

      {err && <p className="mt-4 text-sm text-ink-soft">{err}</p>}

      {data && !err && (
        <div className="mt-6">
          {!data.bound ? (
            <div className="border border-line bg-surface p-5 text-sm text-ink-soft">
              {data.exists
                ? `Mock Normie #${data.tokenId} exists (owner ${short(data.owner)}) but isn't bound to an agent identity yet.`
                : `Mock Normie #${data.tokenId} doesn't exist on the testnet collection yet.`}
            </div>
          ) : (
            <>
              {/* the binding flow */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Node label="The NFT" title={`Normie #${data.tokenId}`} sub={`owner ${short(data.owner)}`} />
                <Node label="Agent identity" title={short(data.identity)} sub={`agentId ${data.agentId} · ${data.skillCount} credential${data.skillCount === 1 ? "" : "s"}`} arrow />
                <Node label="Controller (live)" title={short(data.controller)} sub="= ownerOf(Normie)" arrow highlight />
              </div>

              <div className="mt-4 border border-line bg-canvas p-5">
                <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">Why this matters</div>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                  <li><span className="text-ink">✓</span> The identity address <span className="mono">{short(data.identity)}</span> is permanent — it never changes.</li>
                  <li><span className="text-ink">✓</span> Whoever owns Normie #{data.tokenId} controls the identity and its {data.skillCount} credential{data.skillCount === 1 ? "" : "s"}.</li>
                  <li><span className="text-ink">✓</span> Transfer the Normie → <span className="mono">controller</span> updates the same block. The education follows the asset.</li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      <p className="mt-8 text-xs mono text-ink-muted">
        Read-only — resolves on-chain via <code className="text-ink-soft">NormieAgentBinding.identityForToken</code> +{" "}
        <code className="text-ink-soft">controllerOf</code> on Sepolia.{" "}
        <Link href="/console" className="text-ink underline decoration-line-strong underline-offset-2">Use a skill →</Link>
      </p>
    </div>
  );
}

function Node({ label, title, sub, arrow, highlight }: { label: string; title: string; sub: string; arrow?: boolean; highlight?: boolean }) {
  return (
    <div className="relative">
      {arrow && <span className="absolute -left-2.5 top-1/2 hidden -translate-y-1/2 text-ink-faint sm:block">→</span>}
      <div className={`border p-4 ${highlight ? "border-line-strong bg-surface" : "border-line bg-paper"}`}>
        <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="mono mt-1 text-sm text-ink">{title}</div>
        <div className="mt-1 text-[11px] text-ink-soft">{sub}</div>
      </div>
    </div>
  );
}
