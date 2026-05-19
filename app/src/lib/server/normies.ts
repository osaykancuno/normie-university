/// @file normies.ts (server)
/// @notice Thin server-side client for the Normies hackathon API
///         (https://api.normies.art). We proxy + cache because the public API
///         rate-limits to 60 req/min per IP, and we want NORMIE UNIVERSITY users to
///         benefit from a shared cache rather than each hitting Normies cold.
///
///         Sources:
///           - https://hackathon.normies.art/
///           - https://api.normies.art/llms.txt
///
///         Chain: Ethereum mainnet
///         Contract: 0x9Eb6E2025B64f340691e424b7fe7022fFDE12438

import "server-only";

export const NORMIES_API   = process.env.NORMIES_API_URL ?? "https://api.normies.art";
export const NORMIES_CONTRACT = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438" as `0x${string}`;
export const NORMIES_CHAIN_ID = 1; // Ethereum mainnet

/// Module-level cache. Process-scoped (fine for serverless functions warm-pool
/// reuse). Each entry stores a value + timestamp. We use short TTLs because
/// holder/canvas data can change with on-chain activity.
type CacheEntry<T> = { value: T; at: number };
const cache = new Map<string, CacheEntry<unknown>>();

const TTL = {
  holders:   60_000,       // 1 min — wallets can transfer
  owner:     60_000,       // 1 min — same reason
  traits:    24 * 3600_000, // 24h — immutable per token
  metadata:  60 * 60_000,   // 1h — Canvas state can change but slowly
  canvas:    60_000,        // 1 min — fast-moving
};

async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && now - hit.at < ttlMs) return hit.value;
  const value = await fetcher();
  cache.set(key, { value, at: now });
  return value;
}

async function getJson<T>(path: string, ttlMs: number): Promise<T> {
  return cachedFetch(`json:${path}`, ttlMs, async () => {
    const res = await fetch(`${NORMIES_API}${path}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new NormiesApiError(`Normies API ${path} returned ${res.status}`, res.status);
    return (await res.json()) as T;
  });
}

export class NormiesApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "NormiesApiError";
  }
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export type NormieHolderResponse = {
  address: `0x${string}`;
  tokenIds: string[];
};

export type NormieTrait = { trait_type: string; value: string };
export type NormieTraits = { raw: string; attributes: NormieTrait[] };

export type NormieOwner = { tokenId: string; owner: `0x${string}` };

export type NormieMetadata = {
  name: string;
  description?: string;
  image: string;          // data URI base64-encoded SVG
  animation_url?: string; // data URI base64-encoded HTML
  attributes: NormieTrait[];
};

export type NormieCanvasInfo = {
  actionPoints: number;
  level: number;
  customized: boolean;
  delegate: `0x${string}`;
  delegateSetBy: `0x${string}`;
};

/// All tokenIds held by `address` on Ethereum mainnet.
export async function getHolderTokens(address: `0x${string}`): Promise<NormieHolderResponse> {
  return getJson(`/holders/${address}`, TTL.holders);
}

export async function isNormieHolder(address: `0x${string}`): Promise<boolean> {
  try {
    const res = await getHolderTokens(address);
    return res.tokenIds.length > 0;
  } catch {
    return false;
  }
}

export async function getNormieOwner(tokenId: string | number): Promise<NormieOwner | null> {
  try {
    return await getJson<NormieOwner>(`/normie/${tokenId}/owner`, TTL.owner);
  } catch {
    return null;
  }
}

export async function getNormieTraits(tokenId: string | number): Promise<NormieTraits | null> {
  try {
    return await getJson<NormieTraits>(`/normie/${tokenId}/traits`, TTL.traits);
  } catch {
    return null;
  }
}

export async function getNormieMetadata(tokenId: string | number): Promise<NormieMetadata | null> {
  try {
    return await getJson<NormieMetadata>(`/normie/${tokenId}/metadata`, TTL.metadata);
  } catch {
    return null;
  }
}

export async function getNormieCanvasInfo(tokenId: string | number): Promise<NormieCanvasInfo | null> {
  try {
    return await getJson<NormieCanvasInfo>(`/normie/${tokenId}/canvas/info`, TTL.canvas);
  } catch {
    return null;
  }
}

/// Direct URL to a Normie SVG — safe to embed as <img src>.
export function normieImageUrl(tokenId: string | number, format: "svg" | "png" = "svg"): string {
  return `${NORMIES_API}/normie/${tokenId}/image.${format}`;
}

// ===========================================================================
// AGENT-LAYER ENDPOINTS — Normies "Awakening" (Nov 2025+)
//
// Normies launched ERC-8004 agent identity binding via Adapter8004 + ERC-8217.
// Each Normie has a deterministic persona generated from on-chain bytes:
// name, personality, backstory, tagline, communication style, quirks, greeting.
// NORMIE UNIVERSITY is positioned as "the agent academy" — the school where these living
// NFTs acquire skills. We integrate via the public agent API.
//
// Spec: https://hackathon.normies.art/
// Adapter8004: https://adapter8004.xyz/
// ===========================================================================

export type AgentBinding = {
  tokenId: string;
  agentId: string;
  bound: boolean;
  adapter: `0x${string}`;
};

export type PersonaInfo = {
  tokenId: string;
  name: string;            // e.g. "Zori"
  tagline: string;         // e.g. "Pixel-born philosopher"
  archetype: string;       // e.g. "people-first, with quiet emotional depth"
  type: string;            // Human / Cat / Alien / Agent
  personality?: string[];        // legacy alias
  personalityTraits?: string[];  // actual API field name
  communicationStyle: string;
  quirks: string[];              // 6 mannerisms
  backstory: string;             // single paragraph from Normies API
  greeting: string;
  canvas: {
    level: number;
    actionPoints: number;
    customized: boolean;
    diff?: {
      added?: Array<{ x: number; y: number }>;
      removed?: Array<{ x: number; y: number }>;
      addedCount?: number;
      removedCount?: number;
      netChange?: number;
    };
  };
};

export type A2AAgentCard = {
  name: string;
  description: string;
  url: string;
  version: string;
  skills?: Array<{ id: string; name: string; description?: string }>;
  // ... A2A spec allows more fields; we relay verbatim
  [key: string]: unknown;
};

/// GET /agents/binding/:tokenId — token → agentId lookup.
export async function getAgentBinding(tokenId: string | number): Promise<AgentBinding | null> {
  try {
    return await getJson<AgentBinding>(`/agents/binding/${tokenId}`, TTL.holders);
  } catch {
    return null;
  }
}

/// GET /agents/info/:tokenId — full persona JSON, regenerated live from canvas state.
export async function getPersona(tokenId: string | number): Promise<PersonaInfo | null> {
  try {
    return await getJson<PersonaInfo>(`/agents/info/${tokenId}`, TTL.canvas);
  } catch {
    return null;
  }
}

/// GET /agents/persona-preview/:tokenId — preview before official registration.
export async function getPersonaPreview(tokenId: string | number): Promise<PersonaInfo | null> {
  try {
    return await getJson<PersonaInfo>(`/agents/persona-preview/${tokenId}`, TTL.canvas);
  } catch {
    return null;
  }
}

/// GET /agents/agent-card/:tokenId — A2A Agent Card ready for cross-agent discovery.
export async function getA2AAgentCard(tokenId: string | number): Promise<A2AAgentCard | null> {
  try {
    return await getJson<A2AAgentCard>(`/agents/agent-card/${tokenId}`, TTL.canvas);
  } catch {
    return null;
  }
}

/// Direct URL to the canvas-aware Normie agent portrait.
export function normieAgentImageUrl(tokenId: string | number): string {
  return `${NORMIES_API}/agents/image/${tokenId}`;
}

// ---------------------------------------------------------------------------
// Canvas (live transformation state) — used by agent profile + directory cards
// ---------------------------------------------------------------------------

export type CanvasDiff = {
  added: { x: number; y: number }[];
  removed: { x: number; y: number }[];
  addedCount: number;
  removedCount: number;
  netChange: number;
};

/// GET /normie/:id/canvas/diff — pixel-level delta vs original mint.
export async function getCanvasDiff(tokenId: string | number): Promise<CanvasDiff | null> {
  try {
    return await getJson<CanvasDiff>(`/normie/${tokenId}/canvas/diff`, TTL.canvas);
  } catch {
    return null;
  }
}

export type CanvasVersion = {
  version: number;
  changeCount: number;
  newPixelCount: number;
  transformer: `0x${string}`;
  blockNumber: number;
  timestamp: number;
  txHash: `0x${string}`;
};

/// GET /history/normie/:id/versions — full transformation chain.
export async function getCanvasVersions(
  tokenId: string | number,
  limit = 20
): Promise<CanvasVersion[]> {
  try {
    return (
      (await getJson<CanvasVersion[]>(
        `/history/normie/${tokenId}/versions?limit=${limit}`,
        TTL.canvas
      )) ?? []
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Burn history — feeds the reputation engine
// ---------------------------------------------------------------------------

export type BurnCommitment = {
  commitId: number;
  owner: `0x${string}`;
  receiverTokenId: string;
  tokenCount: number;
  transferredActionPoints: number;
  blockNumber: number;
  timestamp: number;
  txHash: `0x${string}`;
  revealed: boolean;
};

/// GET /history/burns/receiver/:tokenId — burns that endowed this Normie
/// with action points. Sum of transferredActionPoints = AP-from-burns.
export async function getBurnsReceivedBy(
  tokenId: string | number,
  limit = 50
): Promise<BurnCommitment[]> {
  try {
    return (
      (await getJson<BurnCommitment[]>(
        `/history/burns/receiver/${tokenId}?limit=${limit}`,
        TTL.canvas
      )) ?? []
    );
  } catch {
    return [];
  }
}

// ===========================================================================
// Collection-wide live stats. Real numbers — supply changes as burns happen.
// ===========================================================================

export type CollectionStats = {
  originalSupply: number;       // 10000 (immutable mint cap)
  burnedCount: number;          // tokens permanently burned
  circulatingSupply: number;    // originalSupply - burnedCount
  awakenedCount: number;        // ERC-8004 agentIds bound to a Normie
  totalTransforms: number;
  totalBurnCommitments: number;
  totalActionPointsDistributed: string;
};

export async function getCollectionStats(): Promise<CollectionStats> {
  // 30s cache — this is the most live-feeling metric on the site
  return cachedFetch("collection-stats", 30_000, async () => {
    const [statsRes, countRes] = await Promise.all([
      fetch(`${NORMIES_API}/history/stats`, { headers: { accept: "application/json" } }),
      fetch(`${NORMIES_API}/agents/count`, { headers: { accept: "application/json" } }),
    ]);
    const stats = statsRes.ok ? await statsRes.json() : {};
    const count = countRes.ok ? await countRes.json() : { count: 0 };
    const originalSupply = Number(stats.totalTokenData ?? 10000);
    const burnedCount    = Number(stats.totalBurnedTokens ?? 0);
    return {
      originalSupply,
      burnedCount,
      circulatingSupply: Math.max(0, originalSupply - burnedCount),
      awakenedCount: Number(count.count ?? 0),
      totalTransforms: Number(stats.totalTransforms ?? 0),
      totalBurnCommitments: Number(stats.totalBurnCommitments ?? 0),
      totalActionPointsDistributed: String(stats.totalActionPointsDistributed ?? "0"),
    };
  });
}

export type AwakenedAgentSummary = {
  agentId: string;
  tokenId: string;
  name: string;
  type: string;
  registeredBy: string;
  registeredAt: string;
};

/// Upstream /agents/list caps at 100 results per call but supports
/// ?offset=N. To return more, we page through and concatenate in order.
/// Cached 60s — same as the awakened ticker so the directory and the
/// hero number stay in sync.
export async function getAwakenedList(limit = 24): Promise<AwakenedAgentSummary[]> {
  return cachedFetch(`awakened-list:${limit}`, 60_000, async () => {
    const PAGE = 100;
    const want = Math.max(1, Math.min(limit, 1000)); // hard cap at 1000 to bound load
    try {
      const pages: AwakenedAgentSummary[][] = [];
      for (let offset = 0; offset < want; offset += PAGE) {
        const pageSize = Math.min(PAGE, want - offset);
        const res = await fetch(
          `${NORMIES_API}/agents/list?limit=${pageSize}&offset=${offset}`,
          { headers: { accept: "application/json" } }
        );
        if (!res.ok) break;
        const j = await res.json();
        const items = (j.items ?? []) as AwakenedAgentSummary[];
        if (items.length === 0) break;
        pages.push(items);
        if (items.length < pageSize) break; // upstream exhausted
      }
      return pages.flat();
    } catch { return []; }
  });
}

export async function isTokenBurned(tokenId: string | number): Promise<boolean> {
  // Cheapest probe: /normie/{id}/owner returns 404 if burned/non-existent.
  // Cache for 5 min — burns are infrequent and we want to avoid hammering.
  return cachedFetch(`burned:${tokenId}`, 300_000, async () => {
    try {
      const res = await fetch(`${NORMIES_API}/normie/${tokenId}/owner`, {
        headers: { accept: "application/json" },
      });
      return res.status === 404;
    } catch { return false; }
  });
}
