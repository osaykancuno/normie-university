/// @file skills.ts (server)
/// @notice Server helpers that read skill data from the NORMIE UNIVERSITY contracts
///         and normalize them into plain JSON-serializable shapes for the API.

import "server-only";
import { getPublicClient } from "./viem";
import {
  SKILL_REGISTRY_ABI,
  SKILL_CREDENTIAL_ABI,
  SKILL_MARKETPLACE_ABI,
  AGENT_REGISTRY_ABI,
  REPUTATION_ENGINE_ABI,
  getAddresses,
} from "@/lib/contracts";
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  TIER_LABELS,
} from "@/lib/skill-meta";

// ---------------------------------------------------------------------------
// Raw on-chain shapes
// ---------------------------------------------------------------------------

type RawSkill = {
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

type RawCredential = {
  tokenId: bigint;
  agent: `0x${string}`;
  skillId: bigint;
  level: number;
  score: bigint;
  acquiredAt: bigint;
  verified: boolean;
};

type RawReputation = {
  score: bigint;
  tier: number;
  skillCount: bigint;
  avgSkillLevel: bigint;
  categoryDiversity: bigint;
  avgVerifyScore: bigint;
  lastUpdated: bigint;
};

// ---------------------------------------------------------------------------
// Public API shapes (JSON-safe)
// ---------------------------------------------------------------------------

export type ApiSkill = {
  skillId: string;
  name: string;
  description: string;
  category: { id: number; label: string };
  difficulty: { id: number; label: string };
  priceInWei: string;
  priceInUsdc: string;
  prerequisites: string[];
  contentURI: string;
  creator: `0x${string}`;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  stats: {
    totalPurchases: number;
    totalCompletions: number;
    ratingCount: number;
    averageRating: number | null; // 0..5
  };
};

export type ApiCredential = {
  tokenId: string;
  agent: `0x${string}`;
  skillId: string;
  level: number;
  score: string;
  acquiredAt: number;
  verified: boolean;
};

export type ApiPath = {
  pathId: string;
  name: string;
  description: string;
  skillIds: string[];
  discountBps: number;
  contentURI: string;
  creator: `0x${string}`;
  isActive: boolean;
  totalPurchases: number;
  priceInUsdc: string;
  priceInWei: string;
  regularPriceInUsdc: string;
  regularPriceInWei: string;
};

function demoPathToApi(p: DemoPath): ApiPath {
  const pUsdc = computePathPriceUsdc(p);
  const pWei  = computePathPriceWei(p);
  return {
    pathId: p.pathId.toString(),
    name: p.name,
    description: p.description,
    skillIds: p.skillIds.map((s) => s.toString()),
    discountBps: p.discountBps,
    contentURI: p.contentURI,
    creator: "0x5111A100000000000000000000000000000000Ab",
    isActive: p.isActive,
    totalPurchases: Number(p.totalPurchases),
    priceInUsdc: pUsdc.discounted.toString(),
    priceInWei:  pWei.discounted.toString(),
    regularPriceInUsdc: pUsdc.regular.toString(),
    regularPriceInWei:  pWei.regular.toString(),
  };
}

export async function listPaths(): Promise<ApiPath[]> {
  // For now demo-only; live PathRegistry reads can be added when contracts deploy.
  if (!isProtocolDeployed()) {
    return DEMO_PATHS.map(demoPathToApi);
  }
  // TODO: read from on-chain PathRegistry once deployed
  return DEMO_PATHS.map(demoPathToApi);
}

export async function getPathById(pathId: bigint): Promise<ApiPath | null> {
  if (!isProtocolDeployed()) {
    const demo = getDemoPathById(pathId);
    return demo ? demoPathToApi(demo) : null;
  }
  const demo = getDemoPathById(pathId);
  return demo ? demoPathToApi(demo) : null;
}

export type ApiReputation = {
  agent: `0x${string}`;
  score: number;      // 0..10000 (bps)
  scorePercent: number; // 0..100
  tier: { id: number; label: string };
  skillCount: number;
  avgSkillLevel: number; // x100
  categoryDiversity: number;
  avgVerifyScore: number; // x100
  lastUpdated: number;
};

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeSkill(s: RawSkill): ApiSkill {
  const ratingCount = Number(s.ratingCount);
  const averageRating =
    ratingCount > 0 ? Number(s.ratingSum) / ratingCount : null;

  return {
    skillId: s.skillId.toString(),
    name: s.name,
    description: s.description,
    category: {
      id: s.category,
      label: CATEGORY_LABELS[s.category] ?? "Custom",
    },
    difficulty: {
      id: s.difficulty,
      label: DIFFICULTY_LABELS[s.difficulty] ?? "Beginner",
    },
    priceInWei: s.priceInWei.toString(),
    priceInUsdc: s.priceInUsdc.toString(),
    prerequisites: s.prerequisites.map((p) => p.toString()),
    contentURI: s.contentURI,
    creator: s.creator,
    createdAt: Number(s.createdAt),
    updatedAt: Number(s.updatedAt),
    isActive: s.isActive,
    stats: {
      totalPurchases: Number(s.totalPurchases),
      totalCompletions: Number(s.totalCompletions),
      ratingCount,
      averageRating,
    },
  };
}

function normalizeCredential(c: RawCredential): ApiCredential {
  return {
    tokenId: c.tokenId.toString(),
    agent: c.agent,
    skillId: c.skillId.toString(),
    level: c.level,
    score: c.score.toString(),
    acquiredAt: Number(c.acquiredAt),
    verified: c.verified,
  };
}

function normalizeReputation(
  agent: `0x${string}`,
  r: RawReputation
): ApiReputation {
  return {
    agent,
    score: Number(r.score),
    scorePercent: Number(r.score) / 100,
    tier: { id: r.tier, label: TIER_LABELS[r.tier] ?? "Novice" },
    skillCount: Number(r.skillCount),
    avgSkillLevel: Number(r.avgSkillLevel),
    categoryDiversity: Number(r.categoryDiversity),
    avgVerifyScore: Number(r.avgVerifyScore),
    lastUpdated: Number(r.lastUpdated),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const ZERO = "0x0000000000000000000000000000000000000000";

/// Returns true when the protocol is fully wired on the active chain.
/// Used to surface graceful empty states instead of viem revert noise when
/// the frontend is running before a deploy.
export function isProtocolDeployed(): boolean {
  const a = getAddresses();
  return (
    a.AgentRegistry    !== ZERO &&
    a.SkillRegistry    !== ZERO &&
    a.SkillCredential  !== ZERO &&
    a.SkillMarketplace !== ZERO
  );
}

/// Lightweight demo dataset for API consumers when the protocol is not yet
/// deployed. Mirrors the on-chain catalogue via the bundled JSON modules so
/// the developer landing + agent manifest stay informative pre-launch.
import {
  DEMO_SKILLS,
  DEMO_STATS,
  DEMO_LEADERBOARD,
  DEMO_PATHS,
  getDemoSkillById,
  getDemoPathById,
  computePathPriceUsdc,
  computePathPriceWei,
  type DemoPath,
} from "@/lib/demo-data";

function rawDemoToApiSkill(s: (typeof DEMO_SKILLS)[number]): ApiSkill {
  return normalizeSkill({
    skillId: s.skillId,
    name: s.name,
    description: s.description,
    category: s.category,
    difficulty: s.difficulty,
    priceInWei: s.priceInWei,
    priceInUsdc: s.priceInUsdc,
    prerequisites: s.prerequisites,
    contentURI: s.contentURI,
    creator: s.creator,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    isActive: s.isActive,
    totalPurchases: s.totalPurchases,
    totalCompletions: s.totalCompletions,
    ratingSum: s.ratingSum,
    ratingCount: s.ratingCount,
  });
}

export async function getTotalSkills(): Promise<number> {
  if (!isProtocolDeployed()) return DEMO_SKILLS.length;
  const client = getPublicClient();
  const addr = getAddresses();
  const total = (await client.readContract({
    address: addr.SkillRegistry,
    abi: SKILL_REGISTRY_ABI,
    functionName: "totalSkills",
  })) as bigint;
  return Number(total);
}

export async function getSkillById(skillId: bigint): Promise<ApiSkill | null> {
  if (!isProtocolDeployed()) {
    const demo = getDemoSkillById(skillId);
    return demo ? rawDemoToApiSkill(demo) : null;
  }
  const client = getPublicClient();
  const addr = getAddresses();
  try {
    const raw = (await client.readContract({
      address: addr.SkillRegistry,
      abi: SKILL_REGISTRY_ABI,
      functionName: "getSkill",
      args: [skillId],
    })) as unknown as RawSkill;
    return normalizeSkill(raw);
  } catch {
    return null;
  }
}

export async function listSkills(opts: {
  limit?: number;
  offset?: number;
  category?: number;
  difficulty?: number;
  onlyActive?: boolean;
}): Promise<ApiSkill[]> {
  const { limit = 50, offset = 0, category, difficulty, onlyActive } = opts;
  if (!isProtocolDeployed()) {
    return DEMO_SKILLS
      .map(rawDemoToApiSkill)
      .filter((s) => (onlyActive === undefined ? true : s.isActive === onlyActive))
      .filter((s) => (category === undefined ? true : s.category.id === category))
      .filter((s) => (difficulty === undefined ? true : s.difficulty.id === difficulty))
      .slice(offset, offset + limit);
  }
  const client = getPublicClient();
  const addr = getAddresses();

  const total = await getTotalSkills();
  if (total === 0) return [];

  const upper = Math.min(total, offset + limit);
  const ids = Array.from({ length: upper - offset }, (_, i) => BigInt(offset + i + 1));
  if (ids.length === 0) return [];

  const results = await client.multicall({
    allowFailure: true,
    contracts: ids.map((id) => ({
      address: addr.SkillRegistry,
      abi: SKILL_REGISTRY_ABI,
      functionName: "getSkill",
      args: [id],
    })),
  });

  return results
    .map((r) =>
      r.status === "success" ? normalizeSkill(r.result as unknown as RawSkill) : null
    )
    .filter((s): s is ApiSkill => s !== null)
    .filter((s) => (onlyActive === undefined ? true : s.isActive === onlyActive))
    .filter((s) => (category === undefined ? true : s.category.id === category))
    .filter((s) => (difficulty === undefined ? true : s.difficulty.id === difficulty));
}

export async function getSkillsByCreator(creator: `0x${string}`): Promise<string[]> {
  if (!isProtocolDeployed()) return [];
  const client = getPublicClient();
  const addr = getAddresses();
  const ids = (await client.readContract({
    address: addr.SkillRegistry,
    abi: SKILL_REGISTRY_ABI,
    functionName: "getSkillsByCreator",
    args: [creator],
  })) as readonly bigint[];
  return ids.map((i) => i.toString());
}

// ---------------------------------------------------------------------------
// Agent + credentials + reputation
// ---------------------------------------------------------------------------

export async function getAgentProfile(agent: `0x${string}`) {
  if (!isProtocolDeployed()) {
    return {
      agent,
      isRegistered: false,
      primaryTokenId: "0",
      tokenIds: [] as string[],
      profile: null,
    };
  }
  const client = getPublicClient();
  const addr = getAddresses();

  const [isRegistered, primaryTokenId, tokenIds] = await Promise.all([
    client.readContract({
      address: addr.AgentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "isRegistered",
      args: [agent],
    }) as Promise<boolean>,
    client.readContract({
      address: addr.AgentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "getPrimaryTokenId",
      args: [agent],
    }) as Promise<bigint>,
    client.readContract({
      address: addr.AgentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "getAgentsByOwner",
      args: [agent],
    }) as Promise<readonly bigint[]>,
  ]);

  let profile: {
    tokenId: string;
    registrationFileURI: string;
    registeredAt: number;
    updatedAt: number;
    isActive: boolean;
  } | null = null;

  if (primaryTokenId > 0n) {
    const raw = (await client.readContract({
      address: addr.AgentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "getAgent",
      args: [primaryTokenId],
    })) as {
      tokenId: bigint;
      agentAddress: `0x${string}`;
      registrationFileURI: string;
      registeredAt: bigint;
      updatedAt: bigint;
      isActive: boolean;
    };
    profile = {
      tokenId: raw.tokenId.toString(),
      registrationFileURI: raw.registrationFileURI,
      registeredAt: Number(raw.registeredAt),
      updatedAt: Number(raw.updatedAt),
      isActive: raw.isActive,
    };
  }

  return {
    agent,
    isRegistered,
    primaryTokenId: primaryTokenId.toString(),
    tokenIds: tokenIds.map((t) => t.toString()),
    profile,
  };
}

export async function getAgentCredentials(
  agent: `0x${string}`
): Promise<ApiCredential[]> {
  if (!isProtocolDeployed()) return [];
  const client = getPublicClient();
  const addr = getAddresses();

  const skillIds = (await client.readContract({
    address: addr.SkillCredential,
    abi: SKILL_CREDENTIAL_ABI,
    functionName: "getAgentSkills",
    args: [agent],
  })) as readonly bigint[];

  if (skillIds.length === 0) return [];

  const results = await client.multicall({
    allowFailure: true,
    contracts: skillIds.map((id) => ({
      address: addr.SkillCredential,
      abi: SKILL_CREDENTIAL_ABI,
      functionName: "getAgentSkillCredential",
      args: [agent, id],
    })),
  });

  return results
    .map((r) =>
      r.status === "success"
        ? normalizeCredential(r.result as unknown as RawCredential)
        : null
    )
    .filter((c): c is ApiCredential => c !== null);
}

export async function getAgentReputation(
  agent: `0x${string}`
): Promise<ApiReputation> {
  if (!isProtocolDeployed()) {
    return normalizeReputation(agent, {
      score: 0n, tier: 0, skillCount: 0n, avgSkillLevel: 0n,
      categoryDiversity: 0n, avgVerifyScore: 0n, lastUpdated: 0n,
    });
  }
  const client = getPublicClient();
  const addr = getAddresses();
  const raw = (await client.readContract({
    address: addr.ReputationEngine,
    abi: REPUTATION_ENGINE_ABI,
    functionName: "getReputationData",
    args: [agent],
  })) as unknown as RawReputation;
  return normalizeReputation(agent, raw);
}

export async function getLeaderboard(
  n: number
): Promise<{ agent: `0x${string}`; score: number }[]> {
  if (!isProtocolDeployed()) {
    return DEMO_LEADERBOARD.slice(0, n);
  }
  const client = getPublicClient();
  const addr = getAddresses();
  const [addrs, scores] = (await client.readContract({
    address: addr.ReputationEngine,
    abi: REPUTATION_ENGINE_ABI,
    functionName: "getLeaderboard",
    args: [BigInt(n)],
  })) as [readonly `0x${string}`[], readonly bigint[]];

  return addrs.map((a, i) => ({ agent: a, score: Number(scores[i] ?? 0n) }));
}

// ---------------------------------------------------------------------------
// Purchase status
// ---------------------------------------------------------------------------

export async function getPurchaseStatus(
  agent: `0x${string}`,
  skillId: bigint
) {
  if (!isProtocolDeployed()) {
    return { hasPurchased: false, hasCompleted: false };
  }
  const client = getPublicClient();
  const addr = getAddresses();
  const [hasPurchased, hasCompleted] = await Promise.all([
    client.readContract({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "hasPurchased",
      args: [agent, skillId],
    }) as Promise<boolean>,
    client.readContract({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "hasCompleted",
      args: [agent, skillId],
    }) as Promise<boolean>,
  ]);
  return { hasPurchased, hasCompleted };
}

// ---------------------------------------------------------------------------
// Platform stats
// ---------------------------------------------------------------------------

export async function getPlatformStats() {
  if (!isProtocolDeployed()) {
    return {
      totalAgents:        DEMO_STATS.totalAgents,
      totalSkills:        DEMO_STATS.totalSkills,
      totalCredentials:   DEMO_STATS.totalCredentials,
      totalTrackedAgents: DEMO_STATS.totalTrackedAgents,
    };
  }
  const client = getPublicClient();
  const addr = getAddresses();
  const [agents, skills, credentials, tracked] = await client.multicall({
    allowFailure: true,
    contracts: [
      { address: addr.AgentRegistry,    abi: AGENT_REGISTRY_ABI,     functionName: "totalAgents" },
      { address: addr.SkillRegistry,    abi: SKILL_REGISTRY_ABI,     functionName: "totalSkills" },
      { address: addr.SkillCredential,  abi: SKILL_CREDENTIAL_ABI,   functionName: "totalCredentials" },
      { address: addr.ReputationEngine, abi: REPUTATION_ENGINE_ABI,  functionName: "totalTrackedAgents" },
    ],
  });

  const pick = (r: { status: string; result?: unknown }) =>
    r.status === "success" ? Number(r.result as bigint) : 0;

  return {
    totalAgents:      pick(agents),
    totalSkills:      pick(skills),
    totalCredentials: pick(credentials),
    totalTrackedAgents: pick(tracked),
  };
}
