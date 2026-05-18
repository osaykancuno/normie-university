/// @file format.ts
/// @notice Shared formatting helpers for on-chain values.

import { formatEther, formatUnits } from "viem";

/// ETH price formatted with up to 4 decimals (drops trailing zeros)
export function formatEth(wei: bigint | undefined): string {
  if (wei === undefined) return "—";
  if (wei === 0n) return "0";
  const s = formatEther(wei);
  const [i, d = ""] = s.split(".");
  const trimmed = d.replace(/0+$/, "").slice(0, 4);
  return trimmed ? `${i}.${trimmed}` : i;
}

/// USDC (6 decimals) formatted with 2 decimals
export function formatUsdc(amount: bigint | undefined): string {
  if (amount === undefined) return "—";
  if (amount === 0n) return "0";
  const s = formatUnits(amount, 6);
  const [i, d = ""] = s.split(".");
  const trimmed = d.padEnd(2, "0").slice(0, 2);
  return `${i}.${trimmed}`;
}

/// Short "0x1234…abcd" address
export function shortAddress(addr: string | undefined, pad = 4): string {
  if (!addr) return "—";
  return `${addr.slice(0, 2 + pad)}…${addr.slice(-pad)}`;
}

/// "3.42 / 5" average rating, where sum and count are raw uint256s from SkillRegistry
export function formatAverageRating(sum: bigint | undefined, count: bigint | undefined): string {
  if (!sum || !count || count === 0n) return "—";
  const avgX100 = (Number(sum) * 100) / Number(count);
  return (avgX100 / 100).toFixed(2);
}

/// Reputation score (0..10000 basis points) → "78.4%"
export function formatReputation(score: bigint | undefined): string {
  if (score === undefined) return "—";
  return `${(Number(score) / 100).toFixed(1)}%`;
}
