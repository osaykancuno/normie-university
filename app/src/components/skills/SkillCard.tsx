"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Skill } from "@/hooks/useSkills";
import { categoryLabel, difficultyLabel, difficultyVariant } from "@/lib/skill-meta";
import { formatEth, formatUsdc, formatAverageRating, shortAddress } from "@/lib/format";

export function SkillCard({ skill }: { skill: Skill }) {
  const rating = formatAverageRating(skill.ratingSum, skill.ratingCount);

  return (
    <Link
      href={`/skills/${skill.skillId.toString()}`}
      className="group block focus:outline-none"
    >
      <Card className="h-full border-line transition-colors hover:border-line-strong group-focus-visible:border-violet-500">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{categoryLabel(skill.category)}</Badge>
              <Badge variant={difficultyVariant(skill.difficulty)}>
                {difficultyLabel(skill.difficulty)}
              </Badge>
              {!skill.isActive && <Badge variant="secondary">Inactive</Badge>}
            </div>
            <div className="text-xs text-ink-muted">#{skill.skillId.toString()}</div>
          </div>

          <div className="flex-1 space-y-1.5">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-ink">
              {skill.name || "Untitled skill"}
            </h3>
            <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">
              {skill.description || "No description provided."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted">
            <span>by {shortAddress(skill.creator)}</span>
            <span>
              {skill.totalPurchases.toString()} sold
              {skill.ratingCount > 0n && <> · ★ {rating}</>}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-ink-muted">Price</span>
              <span className="text-lg font-semibold text-ink">
                {skill.priceInWei > 0n
                  ? `${formatEth(skill.priceInWei)} ETH`
                  : `${formatUsdc(skill.priceInUsdc)} USDC`}
              </span>
            </div>
            {skill.priceInWei > 0n && skill.priceInUsdc > 0n && (
              <span className="text-xs text-ink-muted">
                or {formatUsdc(skill.priceInUsdc)} USDC
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
