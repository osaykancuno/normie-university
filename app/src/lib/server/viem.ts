/// @file viem.ts (server)
/// @notice Server-side viem public client used by API Route Handlers.
///         Reads RPC URL from env; falls back to chain's default public RPC.

import "server-only";
import { createPublicClient, http } from "viem";
import { ACTIVE_CHAIN } from "@/config/chains";

function build() {
  const rpcUrl =
    process.env.RPC_URL ||
    process.env[`RPC_URL_${ACTIVE_CHAIN.id}`] ||
    undefined; // fall back to chain's default public RPC

  return createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: http(rpcUrl),
    batch: { multicall: true },
  });
}

let cached: ReturnType<typeof build> | null = null;

export function getPublicClient() {
  if (!cached) cached = build();
  return cached;
}
