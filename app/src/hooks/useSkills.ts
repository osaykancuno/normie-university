"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { SKILL_REGISTRY_ABI, getAddresses } from "@/lib/contracts";
import { DEMO_SKILLS, getDemoSkillById, isDemoMode } from "@/lib/demo-data";

/// True when no contracts are deployed on the active chain. Hooks fall back
/// to the bundled demo dataset so stakeholders can preview the UX.
export function useDemoMode(): boolean {
  const addr = getAddresses();
  return isDemoMode(addr.SkillRegistry);
}

export type Skill = {
  skillId: bigint;
  name: string;
  description: string;
  category: number;
  difficulty: number;
  priceInWei: bigint;
  priceInUsdc: bigint;
  prerequisites: readonly bigint[];
  contentURI: string;
  creator: `0x${string}`;
  createdAt: bigint;
  updatedAt: bigint;
  isActive: boolean;
  totalPurchases: bigint;
  totalCompletions: bigint;
  ratingSum: bigint;
  ratingCount: bigint;
};

/// Total number of skills. In demo mode returns the bundled catalogue length.
export function useTotalSkills() {
  const addr = getAddresses();
  const demo = isDemoMode(addr.SkillRegistry);
  const live = useReadContract({
    address: addr.SkillRegistry,
    abi: SKILL_REGISTRY_ABI,
    functionName: "totalSkills",
    query: { enabled: !demo },
  });
  if (demo) {
    return {
      ...live,
      data: BigInt(DEMO_SKILLS.length),
      isLoading: false,
      isError: false,
      error: null,
    } as typeof live;
  }
  return live;
}

/// Fetch a single skill by id. Falls back to the demo catalogue.
export function useSkill(skillId: bigint | undefined) {
  const addr = getAddresses();
  const demo = isDemoMode(addr.SkillRegistry);
  const live = useReadContract({
    address: addr.SkillRegistry,
    abi: SKILL_REGISTRY_ABI,
    functionName: "getSkill",
    args: skillId !== undefined ? [skillId] : undefined,
    query: { enabled: !demo && skillId !== undefined },
  });
  if (demo) {
    const found = getDemoSkillById(skillId);
    return {
      ...live,
      data: found,
      isLoading: false,
      isError: !found,
      error: found ? null : new Error("Skill not found in demo catalogue"),
    } as typeof live;
  }
  return live;
}

/// Fetch skills in a [1, total] range (batched). Demo-mode aware.
export function useAllSkills(limit = 50) {
  const addr = getAddresses();
  const demo = isDemoMode(addr.SkillRegistry);

  const { data: total } = useTotalSkills();
  const n = demo ? DEMO_SKILLS.length : total ? Number(total) : 0;
  const count = Math.min(n, limit);

  const contracts = useMemo(
    () =>
      demo
        ? []
        : Array.from({ length: count }, (_, i) => ({
            address: addr.SkillRegistry,
            abi: SKILL_REGISTRY_ABI,
            functionName: "getSkill" as const,
            args: [BigInt(i + 1)] as const,
          })),
    [addr.SkillRegistry, count, demo]
  );

  const res = useReadContracts({
    contracts,
    query: { enabled: !demo && count > 0 },
  });

  if (demo) {
    return {
      skills: DEMO_SKILLS.slice(0, count),
      isLoading: false,
      isError: false,
      error: null,
    } as { skills: Skill[]; isLoading: boolean; isError: boolean; error: Error | null };
  }

  const skills: Skill[] = (res.data ?? [])
    .map((r) => (r.status === "success" ? (r.result as unknown as Skill) : null))
    .filter((s): s is Skill => s !== null);

  return { skills, ...res };
}

/// Skills in a category
export function useSkillsByCategory(category: number | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillRegistry,
    abi: SKILL_REGISTRY_ABI,
    functionName: "getSkillsByCategory",
    args: category !== undefined ? [category] : undefined,
    query: { enabled: category !== undefined },
  });
}

/// Average rating (scaled × 100) for a skill
export function useAverageRating(skillId: bigint | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillRegistry,
    abi: SKILL_REGISTRY_ABI,
    functionName: "getAverageRating",
    args: skillId !== undefined ? [skillId] : undefined,
    query: { enabled: skillId !== undefined },
  });
}
