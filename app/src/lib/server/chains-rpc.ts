/// @file chains-rpc.ts (server)
/// @notice Per-chainId public-client map for the oracle.
///
///         The oracle must verify a skill execution on the chain the skill
///         actually targets — which is NOT necessarily the chain the
///         marketplace is deployed on. A skill module declares `chain.id`
///         (1 = Ethereum, 42161 = Arbitrum, 10 = Optimism, 8453 = Base, …);
///         the verifier picks the matching provider here.
///
///         This is the structural fix for the old bug where the verifier
///         always queried ACTIVE_CHAIN (Sepolia) regardless of the skill's
///         declared chain, so a real mainnet execution could never be found.

import "server-only";
import { createPublicClient, http, type PublicClient } from "viem";
import { mainnet, arbitrum, optimism, base, sepolia } from "viem/chains";

/// Public RPC fallbacks (no key). Override per-chain via env for reliability:
///   RPC_URL_1, RPC_URL_42161, RPC_URL_10, RPC_URL_8453, RPC_URL_11155111
const DEFAULT_RPC: Record<number, string> = {
  1:        "https://ethereum-rpc.publicnode.com",
  42161:    "https://arbitrum-one-rpc.publicnode.com",
  10:       "https://optimism-rpc.publicnode.com",
  8453:     "https://base-rpc.publicnode.com",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
};

const CHAIN_BY_ID = {
  1:        mainnet,
  42161:    arbitrum,
  10:       optimism,
  8453:     base,
  11155111: sepolia,
} as const;

export type SupportedChainId = keyof typeof CHAIN_BY_ID;

export function isSupportedChain(id: number): id is SupportedChainId {
  return id in CHAIN_BY_ID;
}

const cache = new Map<number, PublicClient>();

/// Returns a public client bound to the given chainId, or null if the chain
/// is not supported by the oracle. RPC URL comes from env (RPC_URL_<id>)
/// with a public fallback.
export function getProviderForChain(chainId: number): PublicClient | null {
  if (!isSupportedChain(chainId)) return null;
  const hit = cache.get(chainId);
  if (hit) return hit;

  const rpcUrl =
    process.env[`RPC_URL_${chainId}`] ||
    DEFAULT_RPC[chainId] ||
    undefined;

  const client = createPublicClient({
    chain: CHAIN_BY_ID[chainId],
    transport: http(rpcUrl),
    batch: { multicall: true },
  }) as PublicClient;

  cache.set(chainId, client);
  return client;
}

/// Human-readable explorer base for surfacing links in verifier responses.
export function explorerFor(chainId: number): string {
  switch (chainId) {
    case 1:        return "https://etherscan.io";
    case 42161:    return "https://arbiscan.io";
    case 10:       return "https://optimistic.etherscan.io";
    case 8453:     return "https://basescan.org";
    case 11155111: return "https://sepolia.etherscan.io";
    default:       return "https://etherscan.io";
  }
}
