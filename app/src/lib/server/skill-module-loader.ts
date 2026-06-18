/// @file skill-module-loader.ts (server)
/// @notice Loads the canonical skill module JSON for a skillId by reading the
///         on-chain contentURI from SkillRegistry, then fetching the
///         IPFS-pinned document. This is what makes the oracle SPEC-DRIVEN:
///         it verifies against the addresses/selectors/chain the module
///         actually declares, instead of values hardcoded in the verifier
///         (which inevitably drift from the modules).

import "server-only";
import { getSkillById } from "./skills";

/// Shape we rely on from the v2 skill module. Everything optional/defensive —
/// modules are author-supplied and we never trust their structure blindly.
export type SkillModuleExecutableContract = {
  role?: string;
  name?: string;
  chain_id?: number;
  address?: string;
  abi_fragments?: Array<{
    type?: string;
    name?: string;
    selector?: string;
    stateMutability?: string;
  }>;
};

export type SkillModule = {
  spec_version?: string;
  name?: string;
  category?: string;
  difficulty?: "beginner" | "intermediate" | "advanced" | "expert";
  chain?: { id?: number; name?: string };
  supported_chains?: Array<{ id?: number; name?: string }>;
  executable?: {
    kind?: string;
    contracts?: SkillModuleExecutableContract[];
    endpoints?: Array<{ role?: string; name?: string; url?: string }>;
    steps?: unknown[];
  };
  verification?: {
    auto_verifiable?: boolean;
    criteria?: string;
    min_score?: number;
    type?: string;
  };
};

const PINATA_GW   = process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud/ipfs";
const FALLBACK_GW = process.env.IPFS_GATEWAY   ?? "https://ipfs.io/ipfs";
const SECOND_GW   = "https://cloudflare-ipfs.com/ipfs";

function ipfsToHttp(uri: string, gateway: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `${gateway}/${uri.slice("ipfs://".length).replace(/^\/+/, "")}`;
  }
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return null;
}

async function fetchJson(url: string, ms = 6000): Promise<unknown | null> {
  try {
    const r = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(ms),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// process-scoped cache (module content is immutable per CID)
const cache = new Map<string, SkillModule>();

/// Load the skill module for a skillId. Returns null when the skill has no
/// contentURI or the document can't be fetched from any gateway.
export async function loadSkillModule(skillId: bigint): Promise<SkillModule | null> {
  const key = skillId.toString();
  const cached = cache.get(key);
  if (cached) return cached;

  const skill = await getSkillById(skillId).catch(() => null);
  if (!skill?.contentURI) return null;

  const urls = [
    ipfsToHttp(skill.contentURI, PINATA_GW),
    ipfsToHttp(skill.contentURI, FALLBACK_GW),
    ipfsToHttp(skill.contentURI, SECOND_GW),
  ].filter((u): u is string => !!u);

  for (const url of urls) {
    const json = await fetchJson(url);
    if (json && typeof json === "object") {
      const mod = json as SkillModule;
      cache.set(key, mod);
      return mod;
    }
  }
  return null;
}

/// Normalize the difficulty tier into (level, baseScore) for the credential.
/// Level 1..3, score 0..100. Replaces the old hardcoded per-rule values so
/// the credential's strength tracks the skill's declared difficulty.
export function tierFromDifficulty(
  difficulty?: string
): { level: number; score: number } {
  switch (difficulty) {
    case "beginner":     return { level: 1, score: 70 };
    case "intermediate": return { level: 2, score: 78 };
    case "advanced":     return { level: 2, score: 85 };
    case "expert":       return { level: 3, score: 90 };
    default:             return { level: 1, score: 70 };
  }
}

/// All contract addresses declared in the module, lowercased + de-duped.
export function declaredAddresses(mod: SkillModule): string[] {
  const out = new Set<string>();
  for (const c of mod.executable?.contracts ?? []) {
    const a = c.address?.toLowerCase();
    if (a && /^0x[0-9a-f]{40}$/.test(a) && a !== "0x0000000000000000000000000000000000000000") {
      out.add(a);
    }
  }
  return [...out];
}

/// All 4-byte function selectors declared across the module's abi_fragments,
/// lowercased. Empty array means "module didn't declare selectors" (skip the
/// selector check rather than fail).
export function declaredSelectors(mod: SkillModule): string[] {
  const out = new Set<string>();
  for (const c of mod.executable?.contracts ?? []) {
    for (const f of c.abi_fragments ?? []) {
      const sel = f.selector?.toLowerCase();
      if (sel && /^0x[0-9a-f]{8}$/.test(sel)) out.add(sel);
    }
  }
  return [...out];
}

/// The chain the skill executes on. Falls back to mainnet (1) when unset —
/// every v2 module in the catalogue declares chain.id, so this is defensive.
export function verificationChainId(mod: SkillModule): number {
  return Number(mod.chain?.id ?? 1);
}
