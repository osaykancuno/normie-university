/// @file types.ts
/// @notice Public shapes exposed by the SKILLAI SDK (mirror the REST API).

export type Address = `0x${string}`;

export type Skill = {
  skillId: string;
  name: string;
  description: string;
  category: { id: number; label: string };
  difficulty: { id: number; label: string };
  priceInWei: string;  // decimal string
  priceInUsdc: string; // decimal string (6 decimals)
  prerequisites: string[];
  contentURI: string;
  creator: Address;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  stats: {
    totalPurchases: number;
    totalCompletions: number;
    ratingCount: number;
    averageRating: number | null;
  };
};

export type Credential = {
  tokenId: string;
  agent: Address;
  skillId: string;
  level: number;
  score: string;
  acquiredAt: number;
  verified: boolean;
};

export type Reputation = {
  agent: Address;
  score: number;
  scorePercent: number;
  tier: { id: number; label: string };
  skillCount: number;
  avgSkillLevel: number;
  categoryDiversity: number;
  avgVerifyScore: number;
  lastUpdated: number;
};

export type AgentProfileResponse = {
  agent: Address;
  isRegistered: boolean;
  primaryTokenId: string;
  tokenIds: string[];
  profile: {
    tokenId: string;
    registrationFileURI: string;
    registeredAt: number;
    updatedAt: number;
    isActive: boolean;
  } | null;
  credentials: Credential[];
  reputation: Reputation | null;
};

export type PlatformStats = {
  chainId: number;
  chainName: string;
  totalAgents: number;
  totalSkills: number;
  totalCredentials: number;
  totalTrackedAgents: number;
};

export type LeaderboardEntry = {
  rank: number;
  agent: Address;
  score: number;
  scorePercent: number;
};

export type SortKey = "trending" | "new" | "top" | "popular";

export type Path = {
  pathId: string;
  name: string;
  description: string;
  skillIds: string[];
  discountBps: number;
  contentURI: string;
  creator: Address;
  isActive: boolean;
  totalPurchases: number;
  /// Bundle price after discount (smallest units of USDC, 6 decimals).
  priceInUsdc: string;
  /// Bundle price after discount (wei).
  priceInWei: string;
  /// Regular sum of individual skill prices (USDC smallest units).
  regularPriceInUsdc: string;
  /// Regular sum of individual skill prices (wei).
  regularPriceInWei: string;
};
