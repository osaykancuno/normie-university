"use client";

import { useReadContract } from "wagmi";
import { SKILL_CREDENTIAL_ABI, getAddresses } from "@/lib/contracts";

export type CredentialData = {
  tokenId: bigint;
  agent: `0x${string}`;
  skillId: bigint;
  level: number;
  score: bigint;
  acquiredAt: bigint;
  verified: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000";

/// Total SBT credentials minted
export function useTotalCredentials() {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillCredential,
    abi: SKILL_CREDENTIAL_ABI,
    functionName: "totalCredentials",
    query: { enabled: addr.SkillCredential !== ZERO },
  });
}

/// Does agent own a credential for this skill?
export function useHasSkill(agent: `0x${string}` | undefined, skillId: bigint | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillCredential,
    abi: SKILL_CREDENTIAL_ABI,
    functionName: "hasSkill",
    args: agent && skillId !== undefined ? [agent, skillId] : undefined,
    query: {
      enabled: !!agent && skillId !== undefined && addr.SkillCredential !== ZERO,
    },
  });
}

/// All skillIds owned by an agent
export function useAgentSkills(agent: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillCredential,
    abi: SKILL_CREDENTIAL_ABI,
    functionName: "getAgentSkills",
    args: agent ? [agent] : undefined,
    query: { enabled: !!agent && addr.SkillCredential !== ZERO },
  });
}

/// All credential tokenIds owned by an agent
export function useAgentTokenIds(agent: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillCredential,
    abi: SKILL_CREDENTIAL_ABI,
    functionName: "getAgentTokenIds",
    args: agent ? [agent] : undefined,
    query: { enabled: !!agent && addr.SkillCredential !== ZERO },
  });
}

/// Credential struct by tokenId
export function useCredentialDetails(tokenId: bigint | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillCredential,
    abi: SKILL_CREDENTIAL_ABI,
    functionName: "getCredentialDetails",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined && addr.SkillCredential !== ZERO },
  });
}

/// Credential struct for a (agent, skillId) pair
export function useAgentSkillCredential(
  agent: `0x${string}` | undefined,
  skillId: bigint | undefined
) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillCredential,
    abi: SKILL_CREDENTIAL_ABI,
    functionName: "getAgentSkillCredential",
    args: agent && skillId !== undefined ? [agent, skillId] : undefined,
    query: {
      enabled: !!agent && skillId !== undefined && addr.SkillCredential !== ZERO,
    },
  });
}
