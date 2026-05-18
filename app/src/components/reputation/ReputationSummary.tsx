"use client";

import { useReputation, useReputationData, useReputationTier } from "@/hooks/useReputation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { tierLabel } from "@/lib/skill-meta";
import { formatReputation } from "@/lib/format";

export function ReputationSummary({ agent }: { agent: `0x${string}` }) {
  const { data: score } = useReputation(agent);
  const { data: tier } = useReputationTier(agent);
  const { data: rep } = useReputationData(agent);

  const scoreBigInt = (score as bigint | undefined) ?? 0n;
  const tierNum = tier as number | undefined;

  type RepData = {
    score: bigint;
    tier: number;
    skillCount: bigint;
    avgSkillLevel: bigint;
    categoryDiversity: bigint;
    avgVerifyScore: bigint;
    lastUpdated: bigint;
  };
  const r = rep as RepData | undefined;

  const percent = Number(scoreBigInt) / 100;

  return (
    <Card className="border-line bg-surface">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-muted">Reputation</div>
            <div className="mt-1 text-4xl font-semibold text-ink">
              {formatReputation(scoreBigInt)}
            </div>
          </div>
          <Badge variant="default">{tierLabel(tierNum)}</Badge>
        </div>

        {/* Bar */}
        <div className="h-2 w-full overflow-hidden rounded-none bg-surface-2">
          <div
            className="h-full bg-gradient-to-r from-ink to-line-strong transition-all"
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Stat label="Skills" value={r ? r.skillCount.toString() : "—"} />
          <Stat
            label="Avg level"
            value={r ? (Number(r.avgSkillLevel) / 100).toFixed(1) : "—"}
          />
          <Stat
            label="Categories"
            value={r ? r.categoryDiversity.toString() : "—"}
          />
          <Stat
            label="Verify score"
            value={r ? (Number(r.avgVerifyScore) / 100).toFixed(1) : "—"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="font-semibold text-ink">{value}</div>
    </div>
  );
}
