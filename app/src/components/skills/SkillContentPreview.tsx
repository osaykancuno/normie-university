"use client";

import { useEffect, useState } from "react";

type Contract = {
  role?: string;
  name?: string;
  chain_id?: number;
  address?: string;
  note?: string;
  abi_fragments?: Array<{
    type?: string;
    name?: string;
    selector?: string;
    stateMutability?: string;
  }>;
};

type Step = {
  id?: string;
  action?: string;
  target?: string;
  function?: string;
  optional?: boolean;
};

type SkillModule = {
  spec_version?: string;
  name?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  chain?: { id: number; name: string };
  use_case?: string;
  prerequisites?: number[];
  executable?: {
    kind?: string;
    contracts?: Contract[];
    steps?: Step[];
    endpoints?: Array<{ role?: string; name?: string; url?: string }>;
  };
  verification?: {
    auto_verifiable?: boolean;
    criteria?: string;
    min_score?: number;
    type?: string;
  };
  risk_parameters?: Record<string, string>;
  reference_implementation?: {
    language?: string;
    deps?: string[];
    snippet?: string;
  };
};

type Response = {
  skillId: number;
  contentURI: string | null;
  content: SkillModule | null;
  source: string;
};

function explorerUrl(chainId: number, addr: string): string {
  const base =
    chainId === 1 ? "https://etherscan.io" :
    chainId === 10 ? "https://optimistic.etherscan.io" :
    chainId === 42161 ? "https://arbiscan.io" :
    chainId === 8453 ? "https://basescan.org" :
    "https://etherscan.io";
  return `${base}/address/${addr}`;
}

const ZERO = "0x0000000000000000000000000000000000000000";

export function SkillContentPreview({ skillId }: { skillId: bigint | string }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(false);
    fetch(`/api/skills/${skillId.toString()}/content`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j); })
      .catch(() => { if (!cancelled) setErr(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [skillId]);

  if (loading) {
    return (
      <div className="border border-line bg-surface p-5">
        <div className="mb-3 mono text-[10px] uppercase tracking-wider text-ink-muted">
          Skill module · loading from IPFS…
        </div>
        <div className="h-32 animate-pulse bg-surface-2" />
      </div>
    );
  }

  if (err || !data || !data.content) {
    return (
      <div className="border border-line bg-surface p-5">
        <div className="mb-2 mono text-[10px] uppercase tracking-wider text-ink-muted">
          Skill module
        </div>
        <p className="text-sm text-ink-soft">
          Module content could not be fetched right now.{" "}
          {data?.contentURI && (
            <>
              CID:{" "}
              <code className="mono text-xs text-ink">
                {data.contentURI.replace("ipfs://", "")}
              </code>
            </>
          )}
        </p>
      </div>
    );
  }

  const m = data.content;
  const contracts = m.executable?.contracts ?? [];
  const steps     = m.executable?.steps ?? [];
  const ver       = m.verification;
  const ref       = m.reference_implementation;
  const risk      = m.risk_parameters;
  const defaultChain = m.chain?.id ?? 1;

  return (
    <div className="space-y-5">
      {/* Use case (the "why pay") */}
      {m.use_case && (
        <div className="border border-line-strong bg-canvas p-4">
          <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
            Real-world use case
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink">{m.use_case}</p>
        </div>
      )}

      {/* Contracts */}
      {contracts.length > 0 && (
        <div className="border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
              Canonical contracts · {contracts.length}
            </div>
            <span className="mono text-[10px] text-ink-faint">
              {m.executable?.kind}
            </span>
          </div>
          <ul className="space-y-3">
            {contracts.map((c, i) => {
              const ch = c.chain_id ?? defaultChain;
              const addr = c.address ?? "";
              const isPlaceholder = !addr || addr === ZERO;
              return (
                <li key={i} className="border border-line bg-paper p-3 text-xs">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-ink">{c.name ?? c.role}</span>
                      {c.role && c.name && (
                        <span className="ml-2 mono text-[10px] text-ink-muted">role: {c.role}</span>
                      )}
                    </div>
                    <span className="mono text-[10px] text-ink-faint">chain {ch}</span>
                  </div>
                  <div className="mt-1">
                    {isPlaceholder ? (
                      <span className="mono text-[11px] text-ink-muted">
                        user-provided at runtime
                      </span>
                    ) : (
                      <a
                        href={explorerUrl(ch, addr)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mono text-[11px] text-ink underline decoration-line-strong decoration-1 underline-offset-2 hover:opacity-70 break-all"
                      >
                        {addr}
                      </a>
                    )}
                  </div>
                  {c.note && (
                    <p className="mt-2 text-[11px] italic text-ink-soft">{c.note}</p>
                  )}
                  {c.abi_fragments && c.abi_fragments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.abi_fragments.slice(0, 6).map((fn, j) => (
                        <span
                          key={j}
                          className="mono inline-block border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-soft"
                          title={fn.selector}
                        >
                          {fn.name}()
                        </span>
                      ))}
                      {c.abi_fragments.length > 6 && (
                        <span className="mono text-[10px] text-ink-muted">
                          +{c.abi_fragments.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="border border-line bg-surface p-5">
          <div className="mb-3 mono text-[10px] uppercase tracking-wider text-ink-muted">
            Execution steps · {steps.length}
          </div>
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-xs">
                <span className="mono text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-ink">
                  <span className="mono text-ink-muted">{s.action ?? "call"}</span>
                  {s.target && <> → <span className="mono text-ink-soft">{s.target}</span></>}
                  {s.function && <span className="text-ink-soft">.{s.function}()</span>}
                  {s.optional && <span className="ml-2 text-[10px] text-ink-faint">[optional]</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Verification + risk */}
      <div className="grid gap-4 sm:grid-cols-2">
        {ver && (
          <div className="border border-line bg-surface p-4">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
              Verification
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {ver.auto_verifiable ? (
                <span className="border border-[color:var(--accent-ok)] bg-paper px-1.5 py-0.5 text-[10px] font-semibold mono uppercase text-[color:var(--accent-ok)]">
                  ✓ Auto-verified on-chain
                </span>
              ) : (
                <span className="border border-[color:var(--accent-warn)] bg-paper px-1.5 py-0.5 text-[10px] font-semibold mono uppercase text-[color:var(--accent-warn)]">
                  Manual review · 48h SLA
                </span>
              )}
              {typeof ver.min_score === "number" && (
                <span className="mono text-[10px] text-ink-muted">
                  pass ≥ {ver.min_score}
                </span>
              )}
            </div>
            {ver.criteria && (
              <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
                {ver.criteria}
              </p>
            )}
          </div>
        )}
        {risk && Object.keys(risk).length > 0 && (
          <div className="border border-line bg-surface p-4">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
              Risk parameters
            </div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              {Object.entries(risk).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="mono text-ink-muted">{k}</dt>
                  <dd className="mono text-ink">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* Reference implementation */}
      {ref?.snippet && (
        <div className="border border-line bg-surface p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
              Reference implementation · {ref.language}
            </div>
            {ref.deps && ref.deps.length > 0 && (
              <div className="mono text-[10px] text-ink-faint">
                {ref.deps.join(" · ")}
              </div>
            )}
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border border-line bg-paper p-3 text-[11px] leading-relaxed text-ink-soft">
            <code className="mono">{ref.snippet}</code>
          </pre>
        </div>
      )}

      {/* Provenance footer */}
      <div className="border border-line bg-paper px-3 py-2 text-[10px] mono text-ink-muted">
        spec {m.spec_version ?? "unknown"} · pinned to IPFS{" "}
        {data.contentURI && (
          <code className="text-ink-soft">{data.contentURI.replace("ipfs://","")}</code>
        )}
      </div>
    </div>
  );
}
