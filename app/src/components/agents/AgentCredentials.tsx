"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useReadContracts } from "wagmi";
import { useAgentSkills } from "@/hooks/useCredentials";
import type { Skill } from "@/hooks/useSkills";
import { SKILL_REGISTRY_ABI, SKILL_CREDENTIAL_ABI, getAddresses } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { categoryLabel, difficultyLabel, difficultyVariant } from "@/lib/skill-meta";

type CredentialData = {
  tokenId: bigint;
  agent: `0x${string}`;
  skillId: bigint;
  level: number;
  score: bigint;
  acquiredAt: bigint;
  verified: boolean;
};

export function AgentCredentials({ agent }: { agent: `0x${string}` }) {
  const addr = getAddresses();
  const { data: skillIds, isLoading } = useAgentSkills(agent);
  const ids = (skillIds as bigint[] | undefined) ?? [];

  // Load each skill's full data + this agent's credential for it
  const contracts = useMemo(() => {
    if (ids.length === 0) return [];
    return ids.flatMap((skillId) => [
      {
        address: addr.SkillRegistry,
        abi: SKILL_REGISTRY_ABI,
        functionName: "getSkill" as const,
        args: [skillId] as const,
      },
      {
        address: addr.SkillCredential,
        abi: SKILL_CREDENTIAL_ABI,
        functionName: "getAgentSkillCredential" as const,
        args: [agent, skillId] as const,
      },
    ]);
  }, [addr.SkillRegistry, addr.SkillCredential, agent, ids]);

  const { data, isLoading: loadingBatch } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: contracts.length > 0 },
  });

  const items = useMemo(() => {
    if (!data) return [];
    const out: { skill: Skill; cred: CredentialData }[] = [];
    for (let i = 0; i < ids.length; i++) {
      const skillRes = data[i * 2];
      const credRes = data[i * 2 + 1];
      if (skillRes?.status === "success" && credRes?.status === "success") {
        out.push({
          skill: skillRes.result as unknown as Skill,
          cred: credRes.result as unknown as CredentialData,
        });
      }
    }
    return out;
  }, [data, ids]);

  if (isLoading || loadingBatch) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-none border border-line bg-surface" />
        ))}
      </div>
    );
  }

  if (ids.length === 0) {
    return (
      <div className="rounded-none border border-line bg-surface p-8 text-center text-sm text-ink-muted">
        No credentials yet. This agent has not completed any skills.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map(({ skill, cred }) => (
        <Link
          key={cred.tokenId.toString()}
          href={`/skills/${skill.skillId.toString()}`}
          className="block"
        >
          <Card className="h-full border-line transition-colors hover:border-line-strong">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{categoryLabel(skill.category)}</Badge>
                <Badge variant={difficultyVariant(skill.difficulty)}>
                  {difficultyLabel(skill.difficulty)}
                </Badge>
                {cred.verified && <Badge variant="success">Verified</Badge>}
              </div>
              <h4 className="line-clamp-2 text-base font-semibold text-ink">
                {skill.name || `Skill #${skill.skillId.toString()}`}
              </h4>
              <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-ink-muted">
                <span>Level {cred.level}</span>
                <span>Score {cred.score.toString()}</span>
                <span>SBT #{cred.tokenId.toString()}</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
