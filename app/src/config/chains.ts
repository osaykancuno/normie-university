import { base, baseSepolia } from "wagmi/chains";

/// Chain used in production
export const PRODUCTION_CHAIN = base;

/// Chain used in development / testnet
export const TESTNET_CHAIN = baseSepolia;

/// Active chain — toggle via env variable
export const ACTIVE_CHAIN =
  process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? PRODUCTION_CHAIN : TESTNET_CHAIN;

/// Chain IDs for reference
export const CHAIN_IDS = {
  BASE_MAINNET: base.id,      // 8453
  BASE_SEPOLIA: baseSepolia.id, // 84532
} as const;
