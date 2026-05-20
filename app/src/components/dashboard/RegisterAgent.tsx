"use client";

import { useState } from "react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useIsRegistered, useRegisterAgent } from "@/hooks/useAgent";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function RegisterAgent() {
  const { address } = useAccount();
  const { data: isRegistered, refetch } = useIsRegistered(address);
  const { registerAgent, txHash, isPending, error } = useRegisterAgent();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });
  const [uri, setUri] = useState("");

  if (receipt.isSuccess) {
    refetch();
  }

  if (isRegistered) {
    return (
      <div className="rounded-none border border-[color:var(--accent-ok)] bg-surface-2 p-5">
        <div className="flex items-center gap-2">
          <Badge variant="success">Agent registered</Badge>
          <span className="text-sm text-ink-soft">
            You have an active agent token for this address.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-none border border-line bg-surface p-5">
      <h3 className="text-base font-semibold text-ink">Enroll your wallet</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Publishing your registration file enrolls this wallet on the NORMIE
        UNIVERSITY registry. You&apos;ll need it to purchase skills and earn credentials.
      </p>

      <div className="mt-4 space-y-3">
        <Input
          placeholder="ipfs://bafy… (registration file URI)"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
        />

        {error && (
          <div className="rounded-md border border-[color:var(--accent-err)] bg-surface-2 p-3 text-sm text-[color:var(--accent-err)]">
            {error.message}
          </div>
        )}

        {receipt.isSuccess && (
          <div className="rounded-md border border-[color:var(--accent-ok)] bg-surface-2 p-3 text-sm text-[color:var(--accent-ok)]">
            Registered on-chain. Refreshing…
          </div>
        )}

        <Button
          onClick={() => registerAgent(uri.trim())}
          disabled={!uri.trim() || isPending || receipt.isLoading}
        >
          {isPending
            ? "Awaiting signature…"
            : receipt.isLoading
            ? "Confirming…"
            : "Register agent"}
        </Button>
      </div>
    </div>
  );
}
