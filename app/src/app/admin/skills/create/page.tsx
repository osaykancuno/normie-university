"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, parseUnits } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { IS_COMING_SOON } from "@/config/launch";
import { ComingSoonButton } from "@/components/layout/ComingSoonButton";
import { useCreateSkill, useIsCreator } from "@/hooks/useSkillRegistry";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from "@/lib/skill-meta";
import { IpfsUploadBlock } from "@/components/skills/IpfsUploadBlock";
import { cn } from "@/lib/utils";

export default function CreateSkillPage() {
  const { address } = useAccount();
  const router = useRouter();
  const { data: isCreator, isLoading: roleLoading } = useIsCreator(address);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [priceEth, setPriceEth] = useState("0");
  const [priceUsdc, setPriceUsdc] = useState("0");
  const [prereqsInput, setPrereqsInput] = useState("");
  const [contentURI, setContentURI] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { createSkillAsync, txHash, isPending } = useCreateSkill();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!address) { setError("Connect a wallet first."); return; }
    if (!name.trim()) { setError("Name is required."); return; }
    if (!description.trim()) { setError("Description is required."); return; }

    let priceInWei = 0n;
    let priceInUsdc = 0n;
    try {
      if (priceEth.trim()) priceInWei = parseEther(priceEth.trim() as `${number}`);
    } catch { setError("Invalid ETH price."); return; }
    try {
      if (priceUsdc.trim()) priceInUsdc = parseUnits(priceUsdc.trim(), 6);
    } catch { setError("Invalid USDC price."); return; }

    if (priceInWei === 0n && priceInUsdc === 0n) {
      setError("Set at least one of ETH price or USDC price.");
      return;
    }

    let prerequisites: bigint[] = [];
    if (prereqsInput.trim()) {
      try {
        prerequisites = prereqsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => BigInt(s));
      } catch { setError("Prerequisites must be comma-separated integers."); return; }
    }

    try {
      await createSkillAsync({
        name: name.trim(),
        description: description.trim(),
        category,
        difficulty,
        priceInWei,
        priceInUsdc,
        prerequisites,
        contentURI: contentURI.trim(),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transaction failed.");
    }
  };

  // Redirect after confirmation
  if (receipt.isSuccess) {
    setTimeout(() => router.push("/skills"), 1500);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/skills" className="text-sm text-ink-muted hover:text-ink-soft">
          ← Back to catalogue
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Publish a skill
        </h1>
        <Badge variant="warning">Admin</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Internal tool — gated by <code className="text-ink-soft">CREATOR_ROLE</code>{" "}
        on the SkillRegistry. Public publishing opens in v2.
      </p>

      {IS_COMING_SOON ? (
        <div className="mt-8 rounded-none border border-[color:var(--accent-warn)] bg-surface p-6 text-center">
          <p className="mb-3 text-sm text-ink-soft">
            Skill authoring opens with the mainnet release. This is a public
            preview — wallet connection is disabled.
          </p>
          <div className="inline-block"><ComingSoonButton /></div>
        </div>
      ) : !address ? (
        <div className="mt-8 rounded-none border border-line bg-surface p-6 text-center">
          <p className="mb-3 text-sm text-ink-soft">Connect a wallet to continue.</p>
          <ConnectButton />
        </div>
      ) : roleLoading ? (
        <div className="mt-8 h-32 animate-pulse rounded-none border border-line bg-surface" />
      ) : !isCreator ? (
        <div className="mt-8 rounded-none border border-[color:var(--accent-err)] bg-surface-2 p-6">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="destructive">403</Badge>
            <span className="text-sm font-medium text-[color:var(--accent-err)]">Access denied</span>
          </div>
          <p className="text-sm text-ink-soft">
            The connected wallet does not hold <code className="text-ink-soft">CREATOR_ROLE</code>{" "}
            on the SkillRegistry. Ask an admin to grant it via{" "}
            <code className="text-ink-soft">grantCreatorRole(address)</code>.
          </p>
          <p className="mt-3 text-xs text-ink-muted">
            Connected as <span className="font-mono">{address}</span>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          {/* Name */}
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Uniswap V3 Swap Execution"
              maxLength={100}
              required
            />
          </Field>

          {/* Description */}
          <Field label="Description" required>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the agent will learn and how it will be verified…"
              maxLength={1000}
              rows={4}
              required
              className="flex w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
            />
          </Field>

          {/* Category */}
          <Field label="Category" required>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_LABELS.map((label, i) => (
                <Pill key={label} active={category === i} onClick={() => setCategory(i)}>
                  {label}
                </Pill>
              ))}
            </div>
          </Field>

          {/* Difficulty */}
          <Field label="Difficulty" required>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_LABELS.map((label, i) => (
                <Pill key={label} active={difficulty === i} onClick={() => setDifficulty(i)}>
                  {label}
                </Pill>
              ))}
            </div>
          </Field>

          {/* Pricing */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Price (ETH)"
              hint="Set to 0 to disable ETH payments"
            >
              <Input
                type="text"
                inputMode="decimal"
                value={priceEth}
                onChange={(e) => setPriceEth(e.target.value)}
                placeholder="0.01"
              />
            </Field>
            <Field
              label="Price (USDC)"
              hint="Set to 0 to disable USDC payments"
            >
              <Input
                type="text"
                inputMode="decimal"
                value={priceUsdc}
                onChange={(e) => setPriceUsdc(e.target.value)}
                placeholder="10.00"
              />
            </Field>
          </div>

          {/* Prerequisites */}
          <Field
            label="Prerequisites"
            hint="Comma-separated skill IDs (e.g. 1, 3, 7)"
          >
            <Input
              value={prereqsInput}
              onChange={(e) => setPrereqsInput(e.target.value)}
              placeholder="1, 3"
            />
          </Field>

          {/* Content URI + inline IPFS upload */}
          <Field
            label="Content URI"
            hint="ipfs://… or https://… pointing to the skill module JSON. Or paste the module JSON below to upload it to IPFS automatically."
          >
            <Input
              value={contentURI}
              onChange={(e) => setContentURI(e.target.value)}
              placeholder="ipfs://bafy…"
            />
          </Field>

          <IpfsUploadBlock
            onUploaded={(uri) => setContentURI(uri)}
          />

          {error && (
            <div className="rounded-md border border-[color:var(--accent-err)] bg-surface-2 p-3 text-sm text-[color:var(--accent-err)]">
              {error}
            </div>
          )}

          {receipt.isSuccess && (
            <div className="rounded-md border border-[color:var(--accent-ok)] bg-surface-2 p-3 text-sm text-[color:var(--accent-ok)]">
              Skill published. Redirecting…
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="lg"
              disabled={isPending || receipt.isLoading}
            >
              {isPending
                ? "Awaiting signature…"
                : receipt.isLoading
                ? "Confirming…"
                : "Publish skill"}
            </Button>
            <Badge variant="secondary">Base · testnet/mainnet</Badge>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {required && <span className="text-ink underline">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function Pill({
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
        "rounded-none px-3 py-1 text-xs font-medium transition-colors",
        active
          ? " text-white"
          : "border border-line bg-surface-2 text-ink-soft hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
