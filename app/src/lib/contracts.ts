/// @file contracts.ts
/// @notice Central registry of NORMIE UNIVERSITY contract addresses and ABIs.
///         ABIs are imported from Foundry build output (extracted via `forge inspect`).
///         Addresses are populated post-deploy.

import type { Abi } from "viem";

import AgentRegistryAbi      from "./abis/AgentRegistry.json";
import SkillRegistryAbi      from "./abis/SkillRegistry.json";
import SkillCredentialAbi    from "./abis/SkillCredential.json";
import SkillMarketplaceAbi   from "./abis/SkillMarketplace.json";
import ReputationEngineAbi   from "./abis/ReputationEngine.json";
import TreasuryAbi           from "./abis/Treasury.json";
import ValidationRegistryAbi from "./abis/ValidationRegistry.json";
import CrossChainReceiverAbi from "./abis/CrossChainReceiver.json";
import PathRegistryAbi       from "./abis/PathRegistry.json";

import { ACTIVE_CHAIN } from "@/config/chains";

// ---------------------------------------------------------------------------
// ABIs — JSON imports need a cast through unknown to the Abi type so wagmi
// accepts them in useReadContract/useReadContracts/useWriteContract hooks.
// ---------------------------------------------------------------------------

export const AGENT_REGISTRY_ABI       = AgentRegistryAbi      as unknown as Abi;
export const SKILL_REGISTRY_ABI       = SkillRegistryAbi      as unknown as Abi;
export const SKILL_CREDENTIAL_ABI     = SkillCredentialAbi    as unknown as Abi;
export const SKILL_MARKETPLACE_ABI    = SkillMarketplaceAbi   as unknown as Abi;
export const REPUTATION_ENGINE_ABI    = ReputationEngineAbi   as unknown as Abi;
export const TREASURY_ABI             = TreasuryAbi           as unknown as Abi;
export const VALIDATION_REGISTRY_ABI  = ValidationRegistryAbi as unknown as Abi;
export const CROSS_CHAIN_RECEIVER_ABI = CrossChainReceiverAbi as unknown as Abi;
export const PATH_REGISTRY_ABI        = PathRegistryAbi       as unknown as Abi;

// Minimal USDC ABI for approve / balanceOf / allowance
export const USDC_ABI = [
  { type: "function", name: "approve",   stateMutability: "nonpayable",
    inputs: [{name: "spender", type: "address"}, {name: "amount", type: "uint256"}],
    outputs: [{type: "bool"}] },
  { type: "function", name: "allowance", stateMutability: "view",
    inputs: [{name: "owner", type: "address"}, {name: "spender", type: "address"}],
    outputs: [{type: "uint256"}] },
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{name: "account", type: "address"}], outputs: [{type: "uint256"}] },
  { type: "function", name: "decimals",  stateMutability: "view",
    inputs: [], outputs: [{type: "uint8"}] },
] as const;

// ---------------------------------------------------------------------------
// ADDRESSES (by chainId)
// ---------------------------------------------------------------------------

type ContractAddresses = {
  AgentRegistry:      `0x${string}`;
  SkillRegistry:      `0x${string}`;
  SkillCredential:    `0x${string}`;
  SkillMarketplace:   `0x${string}`;
  ReputationEngine:   `0x${string}`;
  Treasury:           `0x${string}`;
  ValidationRegistry: `0x${string}`;
  CrossChainReceiver: `0x${string}`;
  PathRegistry:       `0x${string}`;
  USDC:               `0x${string}`;
};

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Ethereum Sepolia (testnet)
  11155111: {
    AgentRegistry:      (process.env.NEXT_PUBLIC_AGENT_REGISTRY_11155111      || ZERO) as `0x${string}`,
    SkillRegistry:      (process.env.NEXT_PUBLIC_SKILL_REGISTRY_11155111      || ZERO) as `0x${string}`,
    SkillCredential:    (process.env.NEXT_PUBLIC_SKILL_CREDENTIAL_11155111    || ZERO) as `0x${string}`,
    SkillMarketplace:   (process.env.NEXT_PUBLIC_SKILL_MARKETPLACE_11155111   || ZERO) as `0x${string}`,
    ReputationEngine:   (process.env.NEXT_PUBLIC_REPUTATION_ENGINE_11155111   || ZERO) as `0x${string}`,
    Treasury:           (process.env.NEXT_PUBLIC_TREASURY_11155111            || ZERO) as `0x${string}`,
    ValidationRegistry: (process.env.NEXT_PUBLIC_VALIDATION_REGISTRY_11155111 || ZERO) as `0x${string}`,
    CrossChainReceiver: (process.env.NEXT_PUBLIC_CROSS_CHAIN_RECEIVER_11155111|| ZERO) as `0x${string}`,
    PathRegistry:       (process.env.NEXT_PUBLIC_PATH_REGISTRY_11155111       || ZERO) as `0x${string}`,
    USDC:               "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle USDC testnet
  },
  // Ethereum Mainnet
  1: {
    AgentRegistry:      (process.env.NEXT_PUBLIC_AGENT_REGISTRY_1      || ZERO) as `0x${string}`,
    SkillRegistry:      (process.env.NEXT_PUBLIC_SKILL_REGISTRY_1      || ZERO) as `0x${string}`,
    SkillCredential:    (process.env.NEXT_PUBLIC_SKILL_CREDENTIAL_1    || ZERO) as `0x${string}`,
    SkillMarketplace:   (process.env.NEXT_PUBLIC_SKILL_MARKETPLACE_1   || ZERO) as `0x${string}`,
    ReputationEngine:   (process.env.NEXT_PUBLIC_REPUTATION_ENGINE_1   || ZERO) as `0x${string}`,
    Treasury:           (process.env.NEXT_PUBLIC_TREASURY_1            || ZERO) as `0x${string}`,
    ValidationRegistry: (process.env.NEXT_PUBLIC_VALIDATION_REGISTRY_1 || ZERO) as `0x${string}`,
    CrossChainReceiver: (process.env.NEXT_PUBLIC_CROSS_CHAIN_RECEIVER_1|| ZERO) as `0x${string}`,
    PathRegistry:       (process.env.NEXT_PUBLIC_PATH_REGISTRY_1       || ZERO) as `0x${string}`,
    USDC:               "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Circle USDC mainnet
  },
};

/// Helper — returns addresses for the currently active chain
export function getAddresses(): ContractAddresses {
  return CONTRACT_ADDRESSES[ACTIVE_CHAIN.id] ?? CONTRACT_ADDRESSES[11155111];
}
