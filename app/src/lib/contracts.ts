/// @file contracts.ts
/// @notice Central registry of SKILLAI contract addresses and ABIs.
///         Update addresses after each deploy. ABIs are imported from
///         the Foundry build output in contracts/out/

// ---------------------------------------------------------------------------
// CONTRACT ADDRESSES
// ---------------------------------------------------------------------------

export const CONTRACT_ADDRESSES = {
  84532: {
    // Base Sepolia (testnet)
    AgentRegistry:    "" as `0x${string}`,
    SkillRegistry:    "" as `0x${string}`,
    SkillCredential:  "" as `0x${string}`,
    SkillMarketplace: "" as `0x${string}`,
    ReputationEngine: "" as `0x${string}`,
    Treasury:         "" as `0x${string}`,
    USDC:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`, // USDC on Base Sepolia
  },
  8453: {
    // Base Mainnet
    AgentRegistry:    "" as `0x${string}`,
    SkillRegistry:    "" as `0x${string}`,
    SkillCredential:  "" as `0x${string}`,
    SkillMarketplace: "" as `0x${string}`,
    ReputationEngine: "" as `0x${string}`,
    Treasury:         "" as `0x${string}`,
    USDC:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`, // USDC on Base Mainnet
  },
} as const;

// ---------------------------------------------------------------------------
// MINIMAL ABIs (expand as contracts are deployed)
// ---------------------------------------------------------------------------

export const AGENT_REGISTRY_ABI = [] as const;
export const SKILL_REGISTRY_ABI = [] as const;
export const SKILL_CREDENTIAL_ABI = [] as const;
export const SKILL_MARKETPLACE_ABI = [] as const;
export const REPUTATION_ENGINE_ABI = [] as const;
