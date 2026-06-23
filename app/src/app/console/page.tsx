"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Badge } from "@/components/ui/badge";
import { IS_COMING_SOON } from "@/config/launch";
import { getAddresses } from "@/lib/contracts";

type Tx = { to: string; value: string; data: string; functionName: string; needsApproval?: string };
type Opt = { label: string; options: { name: string; detail: string; best?: boolean }[] };
type Plan = {
  skillId: string; skillName: string; difficulty: number; chainId: number; chainName: string;
  owned: boolean | null;
  action: { verb: string; amount?: string; asset?: string };
  contract: { name: string; address: string; explorer: string | null };
  call: { functionName?: string; selector?: string };
  tx: Tx | null;
  mode: "transaction" | "automation";
  advantage: string;
  optimization: Opt | null;
  automation: string | null;
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

/// The live execution flow: connect → (right chain) → sign the exact tx →
/// wait for confirmation → ask the oracle to verify + mint the credential.
function ExecutePanel({ plan, normieId }: { plan: Plan; normieId?: string }) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { sendTransactionAsync, isPending: signing } = useSendTransaction();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { data: receipt, isLoading: confirming } = useWaitForTransactionReceipt({ hash });
  const [completing, setCompleting] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; msg: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isMainnet = plan.chainId === 1;

  // Once the tx confirms, ask the oracle to verify it and mint the credential.
  useEffect(() => {
    if (receipt?.status !== "success" || !hash || !address || completing || done) return;
    let cancelled = false;
    (async () => {
      setCompleting(true);
      try {
        // Normie-native completion: route the credential to the Normie's agent
        // identity (so it follows the NFT) instead of the earning wallet.
        let completeBody: Record<string, unknown> = { agent: address, txHash: hash };
        if (normieId) {
          const id = await fetch(`/api/agent-identity?tokenId=${encodeURIComponent(normieId)}`).then((x) => x.json());
          if (!id?.identity) throw new Error("That Normie isn't bound to an agent identity yet");
          const mock = getAddresses().MockNormies;
          await fetch("/api/identity/sponsor", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ agentToken: mock, agentTokenId: normieId, skillId: plan.skillId }),
          }).catch(() => null); // best-effort; already-sponsored is fine
          completeBody = { agent: id.identity, agentToken: mock, agentTokenId: normieId, txHash: hash };
        }
        const r = await fetch(`/api/skills/${plan.skillId}/complete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(completeBody),
        });
        const j = await r.json();
        if (cancelled) return;
        if (r.ok && (j.txHash || j.ok))
          setDone({ ok: true, msg: normieId ? `Credential #${plan.skillId} earned for Normie #${normieId}.` : `Credential #${plan.skillId} issued to your agent.` });
        else setDone({ ok: false, msg: j.error || j.reason || "Verification did not pass." });
      } catch (e) {
        if (!cancelled) setDone({ ok: false, msg: e instanceof Error ? e.message : "Could not reach the verifier." });
      } finally {
        if (!cancelled) setCompleting(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt?.status, hash, address]);

  if (!plan.tx) {
    return <p className="text-sm text-ink-soft">Add an amount to your instruction (e.g. &ldquo;wrap 0.01 ETH&rdquo;) so the exact transaction can be built.</p>;
  }
  if (plan.tx.needsApproval) {
    return (
      <p className="text-sm text-ink-soft">
        This action needs a one-time <span className="mono">{plan.tx.needsApproval}</span> approval before the deposit.
        Token-approval signing lands next — for an end-to-end test, try an ETH action like <span className="mono">&ldquo;wrap 0.01 ETH to WETH&rdquo;</span>.
      </p>
    );
  }
  if (!isConnected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-ink-soft">Connect a wallet to sign this transaction on {plan.chainName}.</div>
        <ConnectButton showBalance={false} label="Connect wallet" />
      </div>
    );
  }
  if (chainId !== plan.chainId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">Wrong network</div>
          <p className="mt-1 text-xs text-ink-soft">
            This skill runs on {plan.chainName}.{" "}
            {isMainnet && <span className="text-ink">⚠ Ethereum mainnet — this would spend REAL funds.</span>}
          </p>
        </div>
        <button
          onClick={() => switchChain({ chainId: plan.chainId })}
          disabled={switching}
          className="border border-line-strong bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40 mono"
        >
          {switching ? "Switching…" : `Switch to ${plan.chainName}`}
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className={done.ok ? "text-sm text-ink" : "text-sm text-ink-soft"}>
        <span className="mono mr-2">{done.ok ? "✓" : "✗"}</span>{done.msg}
        {hash && (
          <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="mono ml-2 text-xs text-ink underline decoration-line-strong underline-offset-2">tx →</a>
        )}
      </div>
    );
  }

  const busy = signing || confirming || completing;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-ink-soft">
        {signing && "Confirm in your wallet…"}
        {confirming && "Waiting for confirmation…"}
        {completing && "Verifying on-chain & minting credential…"}
        {!busy && (plan.mode === "automation"
          ? `Set up this strategy on ${plan.chainName} — the initial position is signed by you.`
          : `Sign to ${plan.action.verb} on ${plan.chainName}.`)}
        {err && <span className="mt-1 block text-ink">{err}</span>}
      </div>
      <button
        disabled={busy || simulating}
        onClick={async () => {
          setErr(null);
          // SAFETY: dry-run the tx first. If it would revert, stop before the
          // user signs and loses gas.
          setSimulating(true);
          try {
            const sim = await fetch("/api/console/simulate", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ chainId: plan.chainId, from: address, to: plan.tx!.to, data: plan.tx!.data, value: plan.tx!.value }),
            }).then((r) => r.json()).catch(() => null);
            if (sim && sim.ok === false) {
              setErr(`Simulation failed — not signing: ${sim.reason}`);
              setSimulating(false);
              return;
            }
          } catch { /* simulation best-effort */ }
          setSimulating(false);
          try {
            const h = await sendTransactionAsync({
              to: plan.tx!.to as `0x${string}`,
              value: BigInt(plan.tx!.value),
              data: plan.tx!.data as `0x${string}`,
            });
            setHash(h);
          } catch (e) {
            setErr(e instanceof Error ? e.message.split("\n")[0] : "Transaction rejected.");
          }
        }}
        className="border border-line-strong bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40 mono"
      >
        {simulating ? "Simulating…" : busy ? "Working…" : plan.mode === "automation" ? "Set up strategy →" : "Sign & execute →"}
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="mono w-20 shrink-0 text-ink-muted">{k}</dt>
      <dd className="mono break-all text-ink-soft">{v}</dd>
    </div>
  );
}

function formatEth(wei: string): string {
  try {
    const n = BigInt(wei);
    if (n === 0n) return "0";
    const whole = n / 10n ** 18n;
    const frac = (n % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return "0";
  }
}

export default function ConsolePage() {
  const [instruction, setInstruction] = useState("");
  const [agent, setAgent] = useState("");
  const [normieId, setNormieId] = useState("");
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
        body: JSON.stringify({ instruction: value, agent: agent.trim() || undefined }),
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <input
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            placeholder="Agent address (optional — checks your credentials)"
            className="mono min-w-[220px] flex-1 border border-line bg-paper px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
          />
          <input
            value={normieId}
            onChange={(e) => setNormieId(e.target.value)}
            placeholder="Earn for Normie # (optional)"
            className="mono w-44 border border-line bg-paper px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
          />
          <button
            onClick={() => plan()}
            disabled={loading || !instruction.trim()}
            className="border border-line-strong bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40 mono"
          >
            {loading ? "Planning…" : "Plan it →"}
          </button>
        </div>
        <span className="mono mt-2 block text-[10px] text-ink-faint">⌘/Ctrl + Enter to plan</span>
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
        <PlanView result={result} onPick={(t) => plan(t)} normieId={normieId.trim() || undefined} />
      )}

      <p className="mt-8 text-xs mono text-ink-muted">
        The console never holds your keys or funds. Every plan resolves to a skill
        in the on-chain catalogue and can only touch that skill&apos;s declared
        contract; each transaction is dry-run before you sign it. You sign every
        transaction yourself.{" "}
        <span className="block mt-1">
          Skills are technical attestations, <strong className="text-ink-soft">not financial advice</strong>.
          NORMIE UNIVERSITY verifies that an on-chain interaction occurred — it does
          not recommend it, custody funds, or guarantee outcomes. You are responsible
          for your transactions.
        </span>
      </p>
    </div>
  );
}

function PlanView({ result, onPick, normieId }: { result: Extract<PlanResult, { ok: true }>; onPick: (t: string) => void; normieId?: string }) {
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
          {p.owned === true && (
            <span className="border border-line bg-paper px-2.5 py-1 text-ink-soft">✓ credential owned</span>
          )}
          {p.owned === false && (
            <span className="border border-line bg-paper px-2.5 py-1 text-ink-soft">new credential on completion</span>
          )}
          {p.mode === "automation" && (
            <span className="border border-line-strong bg-paper px-2.5 py-1 text-ink">⚙ automation</span>
          )}
        </div>

        {/* the edge — why a skill beats a raw tx (lever 1) */}
        <div className="mt-4 border-l-2 border-line-strong bg-paper p-3">
          <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">⚡ The edge</div>
          <p className="mt-1 text-sm text-ink">{p.advantage}</p>
        </div>

        {/* optimization — best option among comparable skills (lever 1) */}
        {p.optimization && (
          <div className="mt-3 border border-line bg-paper p-3">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">{p.optimization.label}</div>
            <ul className="mt-2 space-y-1">
              {p.optimization.options.map((o) => (
                <li key={o.name} className={`flex items-center justify-between text-sm ${o.best ? "text-ink" : "text-ink-soft"}`}>
                  <span>{o.best ? "★ " : "· "}{o.name}{o.best ? " — best" : ""}</span>
                  <span className="mono text-xs">{o.detail}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] mono text-ink-muted">Indicative rates — the skill routes you to the best available, not a fixed venue.</p>
          </div>
        )}

        {/* automation — ongoing strategy framing (lever 2) */}
        {p.automation && (
          <div className="mt-3 border border-line bg-canvas p-3">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">⚙ Ongoing strategy</div>
            <p className="mt-1 text-sm text-ink-soft">{p.automation}</p>
          </div>
        )}

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

      {/* the exact transaction */}
      {p.tx && (
        <div className="border border-line bg-paper p-4">
          <div className="flex items-center justify-between">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">Transaction you will sign</div>
            {p.tx.needsApproval && (
              <span className="mono text-[10px] text-ink-muted">+ one-time {p.tx.needsApproval} approval</span>
            )}
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <Row k="to" v={p.tx.to} />
            <Row k="function" v={`${p.tx.functionName}()`} />
            <Row k="value" v={`${formatEth(p.tx.value)} ETH`} />
            <Row k="calldata" v={`${p.tx.data.slice(0, 26)}…`} />
          </dl>
        </div>
      )}

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

      {/* execute */}
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
          <ExecutePanel plan={p} normieId={normieId} />
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
