"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { SKILL_MARKETPLACE_ABI, USDC_ABI, getAddresses } from "@/lib/contracts";

export type Purchase = {
  agent: `0x${string}`;
  skillId: bigint;
  amountPaid: bigint;
  paidInUsdc: boolean;
  purchasedAt: bigint;
  completed: boolean;
  refunded: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000";

/// Check if agent has purchased a given skill
export function useHasPurchased(agent: `0x${string}` | undefined, skillId: bigint | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillMarketplace,
    abi: SKILL_MARKETPLACE_ABI,
    functionName: "hasPurchased",
    args: agent && skillId !== undefined ? [agent, skillId] : undefined,
    query: {
      enabled: !!agent && skillId !== undefined && addr.SkillMarketplace !== ZERO,
    },
  });
}

/// Check if agent has completed a given skill
export function useHasCompleted(agent: `0x${string}` | undefined, skillId: bigint | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillMarketplace,
    abi: SKILL_MARKETPLACE_ABI,
    functionName: "hasCompleted",
    args: agent && skillId !== undefined ? [agent, skillId] : undefined,
    query: {
      enabled: !!agent && skillId !== undefined && addr.SkillMarketplace !== ZERO,
    },
  });
}

/// Get detailed purchase struct for agent/skill
export function usePurchase(agent: `0x${string}` | undefined, skillId: bigint | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.SkillMarketplace,
    abi: SKILL_MARKETPLACE_ABI,
    functionName: "getPurchase",
    args: agent && skillId !== undefined ? [agent, skillId] : undefined,
    query: {
      enabled: !!agent && skillId !== undefined && addr.SkillMarketplace !== ZERO,
    },
  });
}

/// USDC allowance for the marketplace spender
export function useUsdcAllowance(owner: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.USDC,
    abi: USDC_ABI,
    functionName: "allowance",
    args: owner ? [owner, addr.SkillMarketplace] : undefined,
    query: { enabled: !!owner && addr.SkillMarketplace !== ZERO },
  });
}

/// USDC balance
export function useUsdcBalance(owner: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.USDC,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner && addr.USDC !== ZERO },
  });
}

/// Purchase a skill with ETH
export function usePurchaseSkill() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const purchaseSkill = (skillId: bigint, priceInWei: bigint) =>
    writeContract({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "purchaseSkill",
      args: [skillId],
      value: priceInWei,
    });

  const purchaseSkillAsync = (skillId: bigint, priceInWei: bigint) =>
    writeContractAsync({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "purchaseSkill",
      args: [skillId],
      value: priceInWei,
    });

  return { purchaseSkill, purchaseSkillAsync, txHash: data, isPending, error };
}

/// Purchase a skill with USDC (requires prior approve)
export function usePurchaseSkillWithUsdc() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const purchaseSkillWithUsdc = (skillId: bigint) =>
    writeContract({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "purchaseSkillWithUsdc",
      args: [skillId],
    });

  const purchaseSkillWithUsdcAsync = (skillId: bigint) =>
    writeContractAsync({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "purchaseSkillWithUsdc",
      args: [skillId],
    });

  return { purchaseSkillWithUsdc, purchaseSkillWithUsdcAsync, txHash: data, isPending, error };
}

/// Approve USDC spending for the marketplace
export function useApproveUsdc() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const approveUsdc = (amount: bigint) =>
    writeContract({
      address: addr.USDC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [addr.SkillMarketplace, amount],
    });

  const approveUsdcAsync = (amount: bigint) =>
    writeContractAsync({
      address: addr.USDC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [addr.SkillMarketplace, amount],
    });

  return { approveUsdc, approveUsdcAsync, txHash: data, isPending, error };
}

/// Submit proof of completion (signed verifier signature)
export function useCompleteSkill() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const completeSkill = (skillId: bigint, level: number, score: bigint, signature: `0x${string}`) =>
    writeContract({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "completeSkill",
      args: [skillId, level, score, signature],
    });

  const completeSkillAsync = (
    skillId: bigint, level: number, score: bigint, signature: `0x${string}`
  ) =>
    writeContractAsync({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "completeSkill",
      args: [skillId, level, score, signature],
    });

  return { completeSkill, completeSkillAsync, txHash: data, isPending, error };
}

/// Rate a completed skill (1..5)
export function useRateSkill() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const rateSkill = (skillId: bigint, rating: number) =>
    writeContract({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "rateSkill",
      args: [skillId, rating],
    });

  const rateSkillAsync = (skillId: bigint, rating: number) =>
    writeContractAsync({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "rateSkill",
      args: [skillId, rating],
    });

  return { rateSkill, rateSkillAsync, txHash: data, isPending, error };
}

/// Request a refund for an un-completed purchase past the refund window
export function useRequestRefund() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const requestRefund = (skillId: bigint) =>
    writeContract({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "requestRefund",
      args: [skillId],
    });

  const requestRefundAsync = (skillId: bigint) =>
    writeContractAsync({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "requestRefund",
      args: [skillId],
    });

  return { requestRefund, requestRefundAsync, txHash: data, isPending, error };
}
