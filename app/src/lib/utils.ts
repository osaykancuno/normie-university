import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/// Merge Tailwind classes safely (shadcn/ui convention)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/// Shorten an Ethereum address for display: 0x1234...abcd
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/// Format a reputation score (0-10000) to a human-readable string
export function formatReputation(score: number): string {
  return (score / 100).toFixed(2);
}

/// Get reputation tier label from score
export function getReputationTier(score: number): string {
  if (score >= 8000) return "Master";
  if (score >= 6000) return "Expert";
  if (score >= 4000) return "Skilled";
  if (score >= 2000) return "Apprentice";
  return "Novice";
}

/// Format USDC amount (6 decimals) to human-readable
export function formatUsdc(raw: bigint): string {
  return (Number(raw) / 1_000_000).toFixed(2);
}

/// Format ETH (wei) to human-readable
export function formatEth(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4);
}

/// Category label map
export const CATEGORY_LABELS: Record<number, string> = {
  0: "DeFi",
  1: "NFT",
  2: "Governance",
  3: "Social",
  4: "Trading",
  5: "Security",
  6: "Cross-Chain",
  7: "Custom",
};

/// Difficulty label map
export const DIFFICULTY_LABELS: Record<number, string> = {
  0: "Beginner",
  1: "Intermediate",
  2: "Advanced",
  3: "Expert",
};

/// Difficulty color map (for badges)
export const DIFFICULTY_COLORS: Record<number, string> = {
  0: "bg-green-100 text-green-800",
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-red-100 text-red-800",
};
