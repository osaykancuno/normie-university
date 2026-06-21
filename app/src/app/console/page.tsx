"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { IS_COMING_SOON } from "@/config/launch";

type Plan = {
  skillId: string; skillName: string; difficulty: number; chainId: number; chainName: string;
  owned: boolean | null;
  action: { verb: string; amount?: string; asset?: string };
  contract: { name: string; address: string; explorer: string | null };
  call: { functionName?: string; selector?: string };
  preview: string; steps: string[]; outcome: string; safety: string[]; confidence: number;
};
type PlanResult =
  | { ok: true; instruction: string; plan: Plan; alternatives: { skillId: string; name: string }[] }
  | { ok: false; instruction: string; reason: string; suggestions: { skillId: string; name: string }[] };

const EXAMPLES = [
  "Stake 1 ETH on Lido",
  "Earn the best yield on 500 USDC",
  "Restake my ETH for extra rewards",
  "Swap 0.5 ETH for the best price",
  "Wrap my stETH into wstETH",
  "Bridge funds to another chain",
];

const DIFF = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function ConsolePage() {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);

  async function plan(text?: string) {
    const value = (text ?? instruction).trim();
    if (!value) return;
    setInstruction(value);
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/console/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: value }),
      });
      setResult(await r.json());
    } catch {
      setResult({ ok: false, instruction: value, reason: "Network error — please try again.", suggestions: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Badge>Agent Console</Badge>
          <span className="mono text-[10px] uppercase tracking-wider text-ink-muted">preview</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Tell your agent what to do.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
          Describe what you want in plain English. The console maps it to a skill
          your agent is certified for, builds a transparent plan, and shows you
          exactly which on-chain action it will take — before you sign anything.
        </p>
      </header>

      {/* input */}
      <div className="border border-line-strong bg-surface p-4">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) plan(); }}
          rows={2}
          placeholder="e.g. Stake 1 ETH on Lido"
          className="w-full resize-none bg-transparent text-lg text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="mono text-[10px] text-ink-faint">⌘/Ctrl + Enter</span>
          <button
            onClick={() => plan()}
            disabled={loading || !instruction.trim()}
            className="border border-line-strong bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40 mono"
          >
            {loading ? "Planning…" : "Plan it →"}
          </button>
        </div>
      </div>

      {/* example chips */}
      {!result && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => plan(ex)}
              className="border border-line bg-paper px-3 py-1.5 text-xs text-ink-soft hover:border-line-strong"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* result */}
      {result && !result.ok && (
        <div className="mt-6 border border-line bg-surface p-5">
          <p className="text-sm text-ink">{result.reason}</p>
          {result.suggestions.length > 0 && (
            <div className="mt-3">
              <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">Try one of these</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.suggestions.map((s) => (
                  <Link key={s.skillId} href={`/skills/${s.skillId}`} className="border border-line bg-paper px-3 py-1.5 text-xs text-ink-soft hover:border-line-strong">
                    #{s.skillId} {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {result && result.ok && (
        <PlanView result={result} onPick={(t) => plan(t)} />
      )}

      <p className="mt-8 text-xs mono text-ink-muted">
        The console never holds your keys or funds. Every plan resolves to a
        skill in the on-chain catalogue and can only touch that skill&apos;s
        certified contract. You sign every transaction yourself.
      </p>
    </div>
  );
}

function PlanView({ result, onPick }: { result: Extract<PlanResult, { ok: true }>; onPick: (t: string) => void }) {
  const p = result.plan;
  const pct = Math.round(p.confidence * 100);
  return (
    <div className="mt-6 space-y-4">
      {/* matched skill */}
      <div className="border border-line-strong bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">Plan</div>
            <h2 className="mt-1 text-lg font-semibold text-ink">{p.preview}</h2>
          </div>
          <div className="text-right">
            <div className="mono text-[10px] text-ink-muted">match confidence</div>
            <div className="mono text-sm text-ink">{pct}%</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <Link href={`/skills/${p.skillId}`} className="border border-line bg-paper px-2.5 py-1 text-ink hover:border-line-strong">
            Skill #{p.skillId} · {p.skillName}
          </Link>
          <span className="border border-line bg-paper px-2.5 py-1 text-ink-soft">{DIFF[p.difficulty] ?? "—"}</span>
          <span className="border border-line bg-paper px-2.5 py-1 text-ink-soft">{p.chainName}</span>
          {p.call.functionName && (
            <span className="mono border border-line bg-paper px-2.5 py-1 text-ink-soft">{p.call.functionName}()</span>
          )}
        </div>

        {/* steps */}
        <div className="mt-5">
          <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">What will happen</div>
          <ol className="mt-2 space-y-1.5">
            {p.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink-soft">
                <span className="mono text-[11px] text-ink-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* target contract */}
        <div className="mt-4 border border-line bg-paper p-3 text-xs">
          <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">Target contract (certified)</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-ink">{p.contract.name}</span>
            <span className="mono text-ink-soft">{p.contract.address}</span>
            {p.contract.explorer && (
              <a href={p.contract.explorer} target="_blank" rel="noopener noreferrer" className="mono text-ink underline decoration-line-strong underline-offset-2 hover:opacity-70">
                explorer →
              </a>
            )}
          </div>
        </div>

        <p className="mt-3 text-xs text-ink-soft">{p.outcome}</p>
      </div>

      {/* safety */}
      <div className="border border-line bg-canvas p-5">
        <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">Why this is safe</div>
        <ul className="mt-2 space-y-1.5">
          {p.safety.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-soft">
              <span className="text-ink">✓</span><span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* execute (gated) */}
      <div className="border border-line-strong bg-surface p-5">
        {IS_COMING_SOON ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">Execution opens at launch</div>
              <p className="mt-1 text-xs text-ink-soft">
                This is a safe preview. At launch you&apos;ll connect your wallet and
                sign this exact transaction — nothing else.
              </p>
            </div>
            <button disabled className="border border-line bg-paper px-5 py-2 text-sm font-semibold text-ink-muted mono opacity-60">
              Sign &amp; execute (soon)
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink-soft">Review the plan above, then sign to execute on {p.chainName}.</div>
            <button className="border border-line-strong bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 mono">
              Sign &amp; execute →
            </button>
          </div>
        )}
      </div>

      {/* alternatives */}
      {result.alternatives.length > 0 && (
        <div className="text-xs">
          <span className="mono text-ink-muted">Did you mean: </span>
          {result.alternatives.map((a) => (
            <button key={a.skillId} onClick={() => onPick(a.name)} className="mr-2 text-ink underline decoration-line-strong underline-offset-2 hover:opacity-70">
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
