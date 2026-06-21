"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract, useSendTransaction } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther } from "viem";
import { ACTIVE_CHAIN } from "@/config/chains";
import { MOCK_NORMIES_ABI, NORMIE_AGENT_BINDING_ABI, getAddresses } from "@/lib/contracts";

const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" as const;
const STARTER_SKILL = "54"; // Wrap ETH → WETH (Sepolia)
const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

type Step = { label: string; status: "idle" | "busy" | "done" | "error"; note?: string };

/// The interactive "skills follow the NFT" demo (live mode only): mint a test
/// Normie, bind it, earn the starter skill onto its identity, then transfer the
/// Normie and watch the skill follow the new owner.
export default function LiveBindingDemo() {
  const { address, isConnected, chainId } = useAccount();
  const pub = usePublicClient();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const addr = getAddresses();

  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const [skillCount, setSkillCount] = useState<number | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<Step[]>([]);

  const push = (label: string, status: Step["status"], note?: string) =>
    setLog((l) => [...l, { label, status, note }]);

  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN.id;

  async function refreshIdentity(tid: bigint) {
    const r = await fetch(`/api/agent-identity?tokenId=${tid}`);
    const j = await r.json();
    setIdentity(j.identity);
    setSkillCount(j.skillCount ?? 0);
    return j;
  }

  async function mintAndBind() {
    if (!address || !pub) return;
    setBusy("mint");
    try {
      const next = (await pub.readContract({ address: addr.MockNormies, abi: MOCK_NORMIES_ABI, functionName: "nextId" })) as bigint;
      push(`Minting test Normie #${next}`, "busy");
      const h1 = await writeContractAsync({ address: addr.MockNormies, abi: MOCK_NORMIES_ABI, functionName: "mint" });
      await pub.waitForTransactionReceipt({ hash: h1 });
      push(`Binding Normie #${next} to an agent identity`, "busy");
      const h2 = await writeContractAsync({ address: addr.NormieAgentBinding, abi: NORMIE_AGENT_BINDING_ABI, functionName: "bind", args: [addr.MockNormies, next] });
      await pub.waitForTransactionReceipt({ hash: h2 });
      setTokenId(next);
      const j = await refreshIdentity(next);
      push(`Bound → identity ${short(j.identity)}`, "done");
    } catch (e) {
      push("Mint/bind failed", "error", e instanceof Error ? e.message.split("\n")[0] : "");
    } finally {
      setBusy(null);
    }
  }

  async function earnStarter() {
    if (!address || !pub || tokenId === null) return;
    setBusy("earn");
    try {
      push("Sponsoring the starter skill for your Normie", "busy");
      const sp = await fetch("/api/identity/sponsor", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentToken: addr.MockNormies, agentTokenId: tokenId.toString(), skillId: STARTER_SKILL }),
      }).then((r) => r.json());
      if (!sp.ok) throw new Error(sp.reason || sp.error || "sponsor failed");

      push("Wrapping 0.001 ETH → WETH (the skill action)", "busy");
      const wrapHash = await sendTransactionAsync({
        to: WETH_SEPOLIA,
        value: parseEther("0.001"),
        data: "0xd0e30db0", // deposit()
      });
      await pub.waitForTransactionReceipt({ hash: wrapHash });

      push("Verifying on-chain & minting the credential to the identity", "busy");
      const cp = await fetch(`/api/skills/${STARTER_SKILL}/complete`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: identity, agentToken: addr.MockNormies, agentTokenId: tokenId.toString(), txHash: wrapHash }),
      }).then((r) => r.json());
      if (!(cp.txHash || cp.ok)) throw new Error(cp.error || cp.reason || "completion failed");

      const j = await refreshIdentity(tokenId);
      push(`Credential earned — identity now holds ${j.skillCount} skill(s)`, "done");
    } catch (e) {
      push("Earn failed", "error", e instanceof Error ? e.message.split("\n")[0] : "");
    } finally {
      setBusy(null);
    }
  }

  async function transfer() {
    if (!address || !pub || tokenId === null || !/^0x[0-9a-fA-F]{40}$/.test(transferTo)) return;
    setBusy("transfer");
    try {
      push(`Selling Normie #${tokenId} → ${short(transferTo)}`, "busy");
      const h = await writeContractAsync({ address: addr.MockNormies, abi: MOCK_NORMIES_ABI, functionName: "transferFrom", args: [address, transferTo as `0x${string}`, tokenId] });
      await pub.waitForTransactionReceipt({ hash: h });
      const j = await refreshIdentity(tokenId);
      push(`Done — new controller ${short(j.controller)}; identity STILL holds ${j.skillCount} skill(s). The education followed the NFT.`, "done");
    } catch (e) {
      push("Transfer failed", "error", e instanceof Error ? e.message.split("\n")[0] : "");
    } finally {
      setBusy(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-line-strong bg-surface p-5">
        <div className="text-sm text-ink-soft">Connect a wallet on {ACTIVE_CHAIN.name} to try the full flow with free testnet ETH.</div>
        <ConnectButton showBalance={false} label="Connect wallet" />
      </div>
    );
  }
  if (wrongChain) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-line-strong bg-surface p-5">
        <div className="text-sm text-ink-soft">Switch to {ACTIVE_CHAIN.name} to continue.</div>
        <button onClick={() => switchChain({ chainId: ACTIVE_CHAIN.id })} className="border border-line-strong bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 mono">
          Switch network
        </button>
      </div>
    );
  }

  return (
    <div className="border border-line-strong bg-surface p-5">
      <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">Try it live · {ACTIVE_CHAIN.name}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={mintAndBind} disabled={!!busy} className="border border-line-strong bg-ink px-4 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40 mono">
          {busy === "mint" ? "Working…" : "1 · Mint + bind a test Normie"}
        </button>
        <button onClick={earnStarter} disabled={!!busy || tokenId === null} className="border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-paper disabled:opacity-40 mono">
          {busy === "earn" ? "Working…" : "2 · Earn the starter skill"}
        </button>
      </div>

      {tokenId !== null && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="0x… new owner address" className="mono min-w-[280px] flex-1 border border-line bg-paper px-3 py-1.5 text-xs text-ink outline-none focus:border-line-strong" />
          <button onClick={transfer} disabled={!!busy || !/^0x[0-9a-fA-F]{40}$/.test(transferTo)} className="border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper disabled:opacity-40 mono">
            {busy === "transfer" ? "Working…" : "3 · Sell the Normie"}
          </button>
        </div>
      )}

      {(identity || skillCount !== null) && (
        <div className="mt-4 grid gap-2 border border-line bg-paper p-3 text-xs sm:grid-cols-3">
          <div><span className="mono text-ink-muted">Normie</span><div className="mono text-ink">#{tokenId?.toString() ?? "—"}</div></div>
          <div><span className="mono text-ink-muted">Identity</span><div className="mono text-ink">{short(identity)}</div></div>
          <div><span className="mono text-ink-muted">Skills on identity</span><div className="mono text-ink">{skillCount ?? "—"}</div></div>
        </div>
      )}

      {log.length > 0 && (
        <ol className="mt-4 space-y-1.5">
          {log.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mono text-[11px]">{s.status === "done" ? "✓" : s.status === "error" ? "✗" : "·"}</span>
              <span className={s.status === "error" ? "text-ink" : "text-ink-soft"}>{s.label}{s.note ? ` — ${s.note}` : ""}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
