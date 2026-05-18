/// @file skill-meta.ts
/// @notice Labels and helpers for SkillTypes enums, mirroring the Solidity contracts.

export const CATEGORY_LABELS = [
  "DeFi",
  "NFT",
  "Governance",
  "Social",
  "Trading",
  "Security",
  "CrossChain",
  "Custom",
] as const;

export const DIFFICULTY_LABELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;

export const TIER_LABELS = [
  "Novice",
  "Apprentice",
  "Skilled",
  "Expert",
  "Master",
] as const;

export function categoryLabel(n: number | undefined): string {
  if (n === undefined) return "—";
  return CATEGORY_LABELS[n] ?? "Custom";
}

export function difficultyLabel(n: number | undefined): string {
  if (n === undefined) return "—";
  return DIFFICULTY_LABELS[n] ?? "Beginner";
}

export function tierLabel(n: number | undefined): string {
  if (n === undefined) return "—";
  return TIER_LABELS[n] ?? "Novice";
}

/// Color variant for difficulty badges
export function difficultyVariant(n: number | undefined):
  "success" | "default" | "warning" | "destructive" | "secondary" {
  switch (n) {
    case 0: return "success";
    case 1: return "default";
    case 2: return "warning";
    case 3: return "destructive";
    default: return "secondary";
  }
}
