"use client";

import { useMemo, useState } from "react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { IS_COMING_SOON } from "@/config/launch";
import { ComingSoonButton } from "@/components/layout/ComingSoonButton";
import { maxUint256 } from "viem";
import { useDemoMode } from "@/hooks/useSkills";
import { ACTIVE_CHAIN } from "@/config/chains";
import {
  usePurchaseSkill,
  usePurchaseSkillWithUsdc,
  useApproveUsdc,
  useUsdcAllowance,
  useUsdcBalance,
  useHasPurchased,
  useHasCompleted,
  useRateSkill,
} from "@/hooks/useMarketplace";
import type { Skill } from "@/hooks/useSkills";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatEth, formatUsdc } from "@/lib/format";
import { cn } from "@/lib/utils";

const IS_TESTNET = (ACTIVE_CHAIN.id as number) !== 1 && (ACTIVE_CHAIN.id as number) !== 8453;

type Tab = "eth" | "usdc";

export function PurchasePanel({ skill }: { skill: Skill }) {
  const { address } = useAccount();
  const demo = useDemoMode();
  const defaultTab: Tab = skill.priceInWei > 0n ? "eth" : "usdc";
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [rating, setRating] = useState<number>(5);

  const { data: hasPurchased } = useHasPurchased(address, skill.skillId);
  const { data: hasCompleted } = useHasCompleted(address, skill.skillId);
  const { data: usdcBalance } = useUsdcBalance(address);
  const { data: allowance, refetch: refetchAllowance } = useUsdcAllowance(address);

  const { purchaseSkill, txHash: ethTx, isPending: isEthPending } = usePurchaseSkill();
  const { purchaseSkillWithUsdc, txHash: usdcTx, isPending: isUsdcPending } = usePurchaseSkillWithUsdc();
  const { approveUsdc, txHash: approveTx, isPending: isApprovePending } = useApproveUsdc();
  const { rateSkill, txHash: rateTx, isPending: isRatePending } = useRateSkill();

  const ethWait      = useWaitForTransactionReceipt({ hash: ethTx });
  const usdcWait     = useWaitForTransactionReceipt({ hash: usdcTx });
  const approveWait  = useWaitForTransactionReceipt({ hash: approveTx, query: { enabled: !!approveTx } });
  const rateWait     = useWaitForTransactionReceipt({ hash: rateTx });

  const needsApproval = useMemo(() => {
    if (tab !== "usdc") return false;
    if (allowance === undefined) return true;
    return (allowance as bigint) < skill.priceInUsdc;
  }, [tab, allowance, skill.priceInUsdc]);

  const insufficientUsdc =
    tab === "usdc" && usdcBalance !== undefined && (usdcBalance as bigint) < skill.priceInUsdc;

  // --- Demo mode: contracts not deployed → purchase disabled ---
  if (demo) {
    return (
      <div className="space-y-3 rounded-none border border-[color:var(--accent-warn)] bg-surface-2 p-5">
        <div className="flex items-center gap-2">
          <Badge variant="warning">Demo mode</Badge>
          <span className="text-sm font-medium text-[color:var(--accent-warn)]">
            Purchase disabled
          </span>
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">
          The protocol contracts are not deployed on this chain yet. You&apos;re
          previewing the catalogue with the bundled launch dataset.
        </p>
        <p className="text-xs text-ink-muted">
          Once <code className="text-ink-soft">SkillRegistry</code> +{" "}
          <code className="text-ink-soft">SkillMarketplace</code> are
          deployed and addresses are filled into{" "}
          <code className="text-ink-soft">.env.local</code>, every purchase
          flow (ETH, USDC, x402) activates automatically.
        </p>
      </div>
    );
  }

  // --- Already completed: show rating ---
  if (hasCompleted) {
    return (
      <div className="rounded-none border border-[color:var(--accent-ok)] bg-surface-2 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="success">Completed</Badge>
          <span className="text-sm text-ink-soft">
            You own a Soulbound credential for this skill.
          </span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium text-ink">Rate this skill</div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRating(v)}
                className={cn(
                  "h-9 w-9 rounded-md border text-sm font-semibold transition-colors",
                  rating >= v
                    ? "border-yellow-500/40 bg-yellow-500/20 text-yellow-200"
                    : "border-line text-ink-muted hover:text-ink-soft"
                )}
              >
                ★
              </button>
            ))}
          </div>
          <Button
            onClick={() => rateSkill(skill.skillId, rating)}
            disabled={isRatePending || rateWait.isLoading}
            className="mt-2"
          >
            {isRatePending || rateWait.isLoading ? "Submitting rating…" : "Submit rating"}
          </Button>
          {rateWait.isSuccess && (
            <div className="text-xs text-[color:var(--accent-ok)]">Thanks — rating submitted.</div>
          )}
        </div>
      </div>
    );
  }

  // --- Already purchased but not completed ---
  if (hasPurchased) {
    return (
      <div className="rounded-none border border-line /10 p-5">
        <Badge variant="default">Purchased</Badge>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          You&apos;ve paid for this skill. Submit a validator-signed proof of
          completion via <code className="text-ink-soft">completeSkill()</code>{" "}
          to mint your Soulbound credential. You can request a refund after the
          refund window expires if never completed.
        </p>
      </div>
    );
  }

  // --- Pre-launch preview: no wallet connection at all ---
  if (IS_COMING_SOON) {
    return (
      <div className="space-y-3 rounded-none border border-[color:var(--accent-warn)] bg-surface p-5">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent-warn)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--accent-warn)]" />
          </span>
          <span className="mono text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-warn)]">
            Launching soon
          </span>
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">
          Skill purchases go live with the audited mainnet release. For now
          this is a public preview — inspect the full module below, no wallet
          needed.
        </p>
        <ComingSoonButton variant="block" />
      </div>
    );
  }

  // --- Not connected ---
  if (!address) {
    return (
      <div className="rounded-none border border-line bg-surface p-5 text-center">
        <p className="mb-3 text-sm text-ink-soft">Connect a wallet to purchase.</p>
        <div className="inline-block">
          <ConnectButton />
        </div>
      </div>
    );
  }

  const offersEth  = skill.priceInWei  > 0n;
  const offersUsdc = skill.priceInUsdc > 0n;

  return (
    <div className="space-y-4 rounded-none border border-line bg-surface p-5">
      {IS_TESTNET && (
        <div className="space-y-2 border border-[color:var(--accent-warn)] bg-paper p-3 text-[11px] leading-relaxed text-ink-soft">
          <div>
            <span className="mono uppercase tracking-wider font-semibold text-[color:var(--accent-warn)]">
              Demo build · purchases disabled
            </span>
          </div>
          <p>
            We&apos;re running on Ethereum {ACTIVE_CHAIN.name}. Wallet
            connection works (read on-chain, view your Normies, sign messages),
            but purchase transactions are intentionally disabled to prevent
            anyone from spending real or test funds on an unaudited build.
          </p>
          <p className="text-ink-muted">
            Mainnet release will activate purchase with audited contracts and a
            multisig admin. Until then, you can browse, preview, and verify
            every skill module — and your wallet stays untouched.
          </p>
        </div>
      )}
      {/* Tabs */}
      <div className="flex gap-2">
        {offersEth && (
          <TabPill active={tab === "eth"} onClick={() => setTab("eth")}>
            Pay in ETH · {formatEth(skill.priceInWei)} ETH
          </TabPill>
        )}
        {offersUsdc && (
          <TabPill active={tab === "usdc"} onClick={() => setTab("usdc")}>
            Pay in USDC · {formatUsdc(skill.priceInUsdc)} USDC
          </TabPill>
        )}
      </div>

      {tab === "eth" && offersEth && (
        <Button
          className="w-full"
          size="lg"
          disabled={IS_TESTNET || isEthPending || ethWait.isLoading || !skill.isActive}
          onClick={() => purchaseSkill(skill.skillId, skill.priceInWei)}
        >
          {IS_TESTNET
            ? "Purchase disabled on testnet"
            : isEthPending || ethWait.isLoading
            ? "Purchasing…"
            : `Purchase for ${formatEth(skill.priceInWei)} ETH`}
        </Button>
      )}

      {tab === "usdc" && offersUsdc && (
        <div className="space-y-2">
          <div className="text-xs text-ink-muted">
            Balance: {formatUsdc((usdcBalance as bigint) ?? 0n)} USDC
          </div>
          {needsApproval ? (
            <Button
              className="w-full"
              size="lg"
              disabled={IS_TESTNET || isApprovePending || approveWait.isLoading}
              onClick={async () => {
                await approveUsdc(maxUint256);
                await refetchAllowance();
              }}
            >
              {IS_TESTNET
                ? "Approval disabled on testnet"
                : isApprovePending || approveWait.isLoading
                ? "Approving USDC…"
                : "Approve USDC"}
            </Button>
          ) : (
            <Button
              className="w-full"
              size="lg"
              disabled={
                IS_TESTNET ||
                isUsdcPending ||
                usdcWait.isLoading ||
                !skill.isActive ||
                insufficientUsdc
              }
              onClick={() => purchaseSkillWithUsdc(skill.skillId)}
            >
              {IS_TESTNET
                ? "Purchase disabled on testnet"
                : insufficientUsdc
                ? "Insufficient USDC"
                : isUsdcPending || usdcWait.isLoading
                ? "Purchasing…"
                : `Purchase for ${formatUsdc(skill.priceInUsdc)} USDC`}
            </Button>
          )}
        </div>
      )}

      {ethWait.isSuccess || usdcWait.isSuccess ? (
        <div className="rounded-md border border-[color:var(--accent-ok)] bg-surface-2 px-3 py-2 text-xs text-[color:var(--accent-ok)]">
          Purchase confirmed on-chain. Reload to refresh state.
        </div>
      ) : null}

      <p className="text-xs text-ink-muted">
        Funds are held in escrow until completion. Revenue split:{" "}
        <span className="text-ink-soft">70%</span> creator ·{" "}
        <span className="text-ink-soft">20%</span> protocol ·{" "}
        <span className="text-ink-soft">10%</span> reserve.
      </p>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? " text-white"
          : "border border-line bg-surface-2 text-ink-soft hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
