import { mainnet, sepolia } from "wagmi/chains";

/// Production: Ethereum L1 mainnet — same chain as Normies + ERC-8004 +
/// Adapter8004. Native alignment with the agent identity layer.
/// Cost model: skill purchases happen off-chain via x402 + EIP-3009 USDC.
/// SBT credentials are issued as server-signed attestations and only
/// committed on-chain via lazy `mintFromAttestation` when the holder
/// explicitly wants permanent on-chain proof.
export const PRODUCTION_CHAIN = mainnet;

/// Testnet: Sepolia (Ethereum's primary public testnet).
export const TESTNET_CHAIN = sepolia;

/// Active chain — toggle via env variable.
export const ACTIVE_CHAIN =
  process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? PRODUCTION_CHAIN : TESTNET_CHAIN;

export const CHAIN_IDS = {
  ETHEREUM_MAINNET: mainnet.id, // 1
  ETHEREUM_SEPOLIA: sepolia.id, // 11155111
} as const;
