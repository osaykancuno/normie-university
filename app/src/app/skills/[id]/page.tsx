"use client";

import { use } from "react";
import Link from "next/link";
import { useSkill, type Skill } from "@/hooks/useSkills";
import { PurchasePanel } from "@/components/skills/PurchasePanel";
import { VerificationBadge, VerificationExplainer } from "@/components/skills/VerificationBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  categoryLabel,
  difficultyLabel,
  difficultyVariant,
} from "@/lib/skill-meta";
import {
  formatEth,
  formatUsdc,
  formatAverageRating,
  shortAddress,
} from "@/lib/format";

export default function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  let skillId: bigint | undefined;
  try {
    skillId = BigInt(id);
  } catch {
    skillId = undefined;
  }

  const { data, isLoading, isError } = useSkill(skillId);
  const skill = data as Skill | undefined;

  if (skillId === undefined) {
    return (
      <PageShell>
        <div className="rounded-lg border border-[color:var(--accent-err)] bg-surface-2 p-4 text-sm text-[color:var(--accent-err)]">
          Invalid skill id.
        </div>
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="h-64 animate-pulse rounded-none border border-line bg-surface" />
      </PageShell>
    );
  }

  if (isError || !skill) {
    return (
      <PageShell>
        <div className="rounded-lg border border-[color:var(--accent-err)] bg-surface-2 p-4 text-sm text-[color:var(--accent-err)]">
          Skill not found or contract unreachable.
        </div>
      </PageShell>
    );
  }

  const avg = formatAverageRating(skill.ratingSum, skill.ratingCount);

  return (
    <PageShell>
      <div className="mb-6">
        <Link href="/skills" className="text-sm text-ink-muted hover:text-ink-soft">
          ← Back to catalogue
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{categoryLabel(skill.category)}</Badge>
              <Badge variant={difficultyVariant(skill.difficulty)}>
                {difficultyLabel(skill.difficulty)}
              </Badge>
              <VerificationBadge skillId={skill.skillId} />
              {!skill.isActive && <Badge variant="secondary">Inactive</Badge>}
              <span className="text-xs text-ink-muted">#{skill.skillId.toString()}</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              {skill.name || "Untitled skill"}
            </h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              {skill.description || "No description provided."}
            </p>
          </div>

          {/* Verification model — honest disclosure upfront */}
          <VerificationExplainer skillId={skill.skillId} />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Purchases" value={skill.totalPurchases.toString()} />
            <Stat label="Completions" value={skill.totalCompletions.toString()} />
            <Stat
              label="Rating"
              value={skill.ratingCount > 0n ? `★ ${avg}` : "—"}
              sub={skill.ratingCount > 0n ? `${skill.ratingCount.toString()} ratings` : undefined}
            />
            <Stat
              label="Prerequisites"
              value={skill.prerequisites.length.toString()}
            />
          </div>

          {skill.prerequisites.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Prerequisites</h3>
              <div className="flex flex-wrap gap-2">
                {skill.prerequisites.map((p) => (
                  <Link key={p.toString()} href={`/skills/${p.toString()}`}>
                    <Button variant="outline" size="sm">
                      Skill #{p.toString()}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Content</h3>
            {skill.contentURI ? (
              <a
                href={toGatewayUrl(skill.contentURI)}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-sm text-ink underline hover:underline"
              >
                {skill.contentURI}
              </a>
            ) : (
              <p className="text-sm text-ink-muted">No content URI set.</p>
            )}
          </div>

          <div className="rounded-none border border-line bg-surface p-5 text-sm text-ink-soft">
            <div className="mb-2 font-medium text-ink">Creator</div>
            <Link
              href={`/agents/${skill.creator}`}
              className="font-mono text-ink underline hover:underline"
            >
              {shortAddress(skill.creator, 6)}
            </Link>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-none border border-line bg-surface p-5">
            <div className="text-xs uppercase tracking-wider text-ink-muted">Price</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-ink">
                {skill.priceInWei > 0n
                  ? `${formatEth(skill.priceInWei)} ETH`
                  : `${formatUsdc(skill.priceInUsdc)} USDC`}
              </span>
            </div>
            {skill.priceInWei > 0n && skill.priceInUsdc > 0n && (
              <div className="mt-1 text-xs text-ink-muted">
                or {formatUsdc(skill.priceInUsdc)} USDC
              </div>
            )}
          </div>

          <PurchasePanel skill={skill} />
        </aside>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="text-xs uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="text-lg font-semibold text-ink">{value}</div>
      {sub && <div className="text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

/// If a URI looks like ipfs://… resolve to a public gateway for easy preview.
function toGatewayUrl(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`;
  }
  return uri;
}
