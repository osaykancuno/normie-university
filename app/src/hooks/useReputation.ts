"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { REPUTATION_ENGINE_ABI, getAddresses } from "@/lib/contracts";
import { DEMO_LEADERBOARD, DEMO_STATS } from "@/lib/demo-data";

export type ReputationData = {
  score: bigint;
  tier: number;
  skillCount: bigint;
  avgSkillLevel: bigint;
  categoryDiversity: bigint;
  avgVerifyScore: bigint;
  lastUpdated: bigint;
};

export const TIER_LABELS = ["Novice", "Apprentice", "Skilled", "Expert", "Master"] as const;
export type TierLabel = (typeof TIER_LABELS)[number];

const ZERO = "0x0000000000000000000000000000000000000000";

/// Public reputation score (0..10000) for an agent
export function useReputation(agent: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.ReputationEngine,
    abi: REPUTATION_ENGINE_ABI,
    functionName: "getReputation",
    args: agent ? [agent] : undefined,
    query: { enabled: !!agent && addr.ReputationEngine !== ZERO },
  });
}

/// Current reputation tier enum (0..4)
export function useReputationTier(agent: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.ReputationEngine,
    abi: REPUTATION_ENGINE_ABI,
    functionName: "getReputationTier",
    args: agent ? [agent] : undefined,
    query: { enabled: !!agent && addr.ReputationEngine !== ZERO },
  });
}

/// Full reputation breakdown (last stored value)
export function useReputationData(agent: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.ReputationEngine,
    abi: REPUTATION_ENGINE_ABI,
    functionName: "getReputationData",
    args: agent ? [agent] : undefined,
    query: { enabled: !!agent && addr.ReputationEngine !== ZERO },
  });
}

/// Preview recomputed reputation without writing to storage
export function usePreviewReputation(agent: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.ReputationEngine,
    abi: REPUTATION_ENGINE_ABI,
    functionName: "previewReputation",
    args: agent ? [agent] : undefined,
    query: { enabled: !!agent && addr.ReputationEngine !== ZERO },
  });
}

/// Top-N leaderboard: returns [addresses, scores].
/// In demo mode returns the bundled mock leaderboard.
export function useLeaderboard(n = 10) {
  const addr = getAddresses();
  const demo = addr.ReputationEngine === ZERO;
  const live = useReadContract({
    address: addr.ReputationEngine,
    abi: REPUTATION_ENGINE_ABI,
    functionName: "getLeaderboard",
    args: [BigInt(n)],
    query: { enabled: !demo },
  });
  if (demo) {
    const top = DEMO_LEADERBOARD.slice(0, n);
    const tuple: [readonly `0x${string}`[], readonly bigint[]] = [
      top.map((r) => r.agent),
      top.map((r) => BigInt(r.score)),
    ];
    return {
      ...live,
      data: tuple,
      isLoading: false,
      isError: false,
      error: null,
    } as typeof live;
  }
  return live;
}

/// Total agents that have ever had reputation updated. Demo-aware.
export function useTotalTrackedAgents() {
  const addr = getAddresses();
  const demo = addr.ReputationEngine === ZERO;
  const live = useReadContract({
    address: addr.ReputationEngine,
    abi: REPUTATION_ENGINE_ABI,
    functionName: "totalTrackedAgents",
    query: { enabled: !demo },
  });
  if (demo) {
    return {
      ...live,
      data: BigInt(DEMO_STATS.totalTrackedAgents),
      isLoading: false,
      isError: false,
      error: null,
    } as typeof live;
  }
  return live;
}

/// Write: force a reputation recompute + persist
export function useUpdateReputation() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const updateReputation = (agent: `0x${string}`) =>
    writeContract({
      address: addr.ReputationEngine,
      abi: REPUTATION_ENGINE_ABI,
      functionName: "updateReputation",
      args: [agent],
    });

  const updateReputationAsync = (agent: `0x${string}`) =>
    writeContractAsync({
      address: addr.ReputationEngine,
      abi: REPUTATION_ENGINE_ABI,
      functionName: "updateReputation",
      args: [agent],
    });

  return { updateReputation, updateReputationAsync, txHash: data, isPending, error };
}
