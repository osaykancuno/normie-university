"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { keccak256, toBytes } from "viem";
import { SKILL_REGISTRY_ABI, getAddresses } from "@/lib/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";

/// keccak256("CREATOR_ROLE")
const CREATOR_ROLE = keccak256(toBytes("CREATOR_ROLE"));

/// True if the given address holds CREATOR_ROLE on SkillRegistry.
/// Used to gate /admin/skills/create.
export function useIsCreator(account: `0x${string}` | undefined) {
  const addr = getAddresses();
  const res = useReadContract({
    address: addr.SkillRegistry,
    abi: SKILL_REGISTRY_ABI,
    functionName: "hasRole",
    args: account ? [CREATOR_ROLE, account] : undefined,
    query: {
      enabled: !!account && addr.SkillRegistry !== ZERO,
    },
  });
  // The ABI is typed as `Abi` (loose) so wagmi infers `unknown` for `data`.
  // Coerce to a proper boolean for downstream consumers.
  const data = res.data as boolean | undefined;
  return { ...res, data };
}

export type SkillParams = {
  name: string;
  description: string;
  category: number;
  difficulty: number;
  priceInWei: bigint;
  priceInUsdc: bigint;
  prerequisites: bigint[];
  contentURI: string;
};

/// Write: publish a new skill
export function useCreateSkill() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const createSkill = (params: SkillParams) =>
    writeContract({
      address: addr.SkillRegistry,
      abi: SKILL_REGISTRY_ABI,
      functionName: "createSkill",
      args: [params],
    });

  const createSkillAsync = (params: SkillParams) =>
    writeContractAsync({
      address: addr.SkillRegistry,
      abi: SKILL_REGISTRY_ABI,
      functionName: "createSkill",
      args: [params],
    });

  return { createSkill, createSkillAsync, txHash: data, isPending, error };
}

/// Write: update an existing skill (owner only)
export function useUpdateSkill() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const updateSkill = (skillId: bigint, params: SkillParams) =>
    writeContract({
      address: addr.SkillRegistry,
      abi: SKILL_REGISTRY_ABI,
      functionName: "updateSkill",
      args: [skillId, params],
    });

  const updateSkillAsync = (skillId: bigint, params: SkillParams) =>
    writeContractAsync({
      address: addr.SkillRegistry,
      abi: SKILL_REGISTRY_ABI,
      functionName: "updateSkill",
      args: [skillId, params],
    });

  return { updateSkill, updateSkillAsync, txHash: data, isPending, error };
}

/// Write: deactivate a skill (creator only)
export function useDeactivateSkill() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const deactivateSkill = (skillId: bigint) =>
    writeContract({
      address: addr.SkillRegistry,
      abi: SKILL_REGISTRY_ABI,
      functionName: "deactivateSkill",
      args: [skillId],
    });

  const deactivateSkillAsync = (skillId: bigint) =>
    writeContractAsync({
      address: addr.SkillRegistry,
      abi: SKILL_REGISTRY_ABI,
      functionName: "deactivateSkill",
      args: [skillId],
    });

  return { deactivateSkill, deactivateSkillAsync, txHash: data, isPending, error };
}
