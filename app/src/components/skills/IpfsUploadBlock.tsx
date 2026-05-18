"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TEMPLATE = {
  name: "Uniswap V3 Swap Execution",
  version: "1.0.0",
  description: "Execute exactInputSingle swaps on Uniswap V3 on Base.",
  category: "DeFi",
  difficulty: "intermediate",
  prerequisites: [],
  content: {
    type: "interaction-pattern",
    contracts: [
      { name: "SwapRouter", address: "0x2626664c2603336E57B271c5C0b26F421741e481" },
    ],
    steps: [
      { action: "approve_token", description: "Approve the router for the input token" },
      { action: "execute_swap",  description: "Call exactInputSingle with slippage + deadline" },
    ],
    best_practices: ["Check slippage", "Use a deadline"],
    risk_parameters: { max_slippage_bps: 50, deadline_seconds: 300 },
  },
  verification: {
    type: "on-chain-tx",
    criteria: "successful_swap_on_testnet",
    min_score: 70,
  },
};

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string; details?: unknown }
  | { kind: "success"; cid: string; uri: string; gatewayUrl: string };

export function IpfsUploadBlock({
  onUploaded,
}: {
  onUploaded: (uri: string) => void;
}) {
  const [json, setJson] = useState<string>(JSON.stringify(TEMPLATE, null, 2));
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const upload = async () => {
    setStatus({ kind: "uploading" });
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Invalid JSON",
      });
      return;
    }

    try {
      const res = await fetch("/api/ipfs/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: parsed }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({
          kind: "error",
          message: body?.error ?? `Upload failed (${res.status})`,
          details: body?.details,
        });
        return;
      }

      setStatus({
        kind: "success",
        cid: body.cid,
        uri: body.uri,
        gatewayUrl: body.gatewayUrl,
      });
      onUploaded(body.uri);
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  };

  return (
    <div className="rounded-none border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-ink">Upload skill module JSON</div>
        <Badge variant="outline">IPFS · Pinata</Badge>
      </div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        spellCheck={false}
        rows={10}
        className="w-full rounded-md border border-line bg-surface p-3 font-mono text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={upload}
          disabled={status.kind === "uploading"}
        >
          {status.kind === "uploading" ? "Uploading…" : "Pin to IPFS"}
        </Button>
        <button
          type="button"
          onClick={() => setJson(JSON.stringify(TEMPLATE, null, 2))}
          className="text-xs text-ink-muted hover:text-ink-soft"
        >
          Reset to template
        </button>
      </div>

      {status.kind === "error" && (
        <div className="mt-3 rounded-md border border-[color:var(--accent-err)] bg-surface-2 p-3 text-xs text-[color:var(--accent-err)]">
          <div className="font-medium">{status.message}</div>
          {Array.isArray(status.details) && status.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {status.details.map((d: unknown, i) => {
                const rec = d as { path?: string; message?: string };
                return (
                  <li key={i}>
                    <span className="font-mono">{rec.path}</span>: {rec.message}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {status.kind === "success" && (
        <div className="mt-3 rounded-md border border-[color:var(--accent-ok)] bg-surface-2 p-3 text-xs text-[color:var(--accent-ok)]">
          Pinned ·{" "}
          <a
            href={status.gatewayUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            {status.cid}
          </a>
          <div className="mt-1 font-mono text-[10px] text-ink-soft">{status.uri}</div>
        </div>
      )}
    </div>
  );
}
