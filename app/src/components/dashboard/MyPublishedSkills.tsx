"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";
import { SKILL_REGISTRY_ABI, getAddresses } from "@/lib/contracts";
import type { Skill } from "@/hooks/useSkills";
import { SkillCard } from "@/components/skills/SkillCard";

export function MyPublishedSkills({ owner }: { owner: `0x${string}` }) {
  const addr = getAddresses();

  const { data: skillIds } = useReadContract({
    address: addr.SkillRegistry,
    abi: SKILL_REGISTRY_ABI,
    functionName: "getSkillsByCreator",
    args: [owner],
    query: {
      enabled: addr.SkillRegistry !== "0x0000000000000000000000000000000000000000",
    },
  });
  const ids = (skillIds as bigint[] | undefined) ?? [];

  const contracts = useMemo(
    () =>
      ids.map((id) => ({
        address: addr.SkillRegistry,
        abi: SKILL_REGISTRY_ABI,
        functionName: "getSkill" as const,
        args: [id] as const,
      })),
    [addr.SkillRegistry, ids]
  );

  const { data } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: contracts.length > 0 },
  });

  const skills: Skill[] = (data ?? [])
    .map((r) => (r.status === "success" ? (r.result as unknown as Skill) : null))
    .filter((s): s is Skill => s !== null);

  if (ids.length === 0) {
    return (
      <div className="rounded-none border border-line bg-surface p-8 text-center text-sm text-ink-muted">
        You haven&apos;t published any skills yet.{" "}
        <Link href="/skills/create" className="text-ink underline hover:underline">
          Publish your first skill →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((s) => (
        <SkillCard key={s.skillId.toString()} skill={s} />
      ))}
    </div>
  );
}
