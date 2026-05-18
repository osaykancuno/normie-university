/// @file onchain.ts
/// @notice On-chain helpers for writing to SKILLAI contracts from an agent.
///         Brings your own `WalletClient` (viem) + contract addresses.

import type { Address, Hash, PublicClient, WalletClient } from "viem";

// Minimal fragments — keep the SDK small. For full ABIs import from the
// app package or regenerate with forge inspect.
const SKILL_MARKETPLACE_ABI = [
  {
    type: "function",
    name: "purchaseSkill",
    stateMutability: "payable",
    inputs: [{ name: "skillId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "purchaseSkillWithUsdc",
    stateMutability: "nonpayable",
    inputs: [{ name: "skillId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "completeSkill",
    stateMutability: "nonpayable",
    inputs: [
      { name: "skillId",   type: "uint256" },
      { name: "level",     type: "uint8"   },
      { name: "score",     type: "uint256" },
      { name: "signature", type: "bytes"   },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "rateSkill",
    stateMutability: "nonpayable",
    inputs: [
      { name: "skillId", type: "uint256" },
      { name: "rating",  type: "uint8"   },
    ],
    outputs: [],
  },
] as const;

const AGENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "registerAgent",
    stateMutability: "nonpayable",
    inputs: [{ name: "registrationFileURI", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isRegistered",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type SkillaiContracts = {
  agentRegistry:    Address;
  skillMarketplace: Address;
  usdc:             Address;
};

export type OnchainOptions = {
  walletClient: WalletClient;
  publicClient?: PublicClient;
  contracts: SkillaiContracts;
};

export class SkillaiOnchain {
  constructor(private opts: OnchainOptions) {}

  /// Register this agent on the AgentRegistry (ERC-8004).
  async registerAgent(registrationFileURI: string): Promise<Hash> {
    const { walletClient, contracts } = this.opts;
    const account = walletClient.account;
    if (!account) throw new Error("WalletClient has no account");

    return walletClient.writeContract({
      chain: walletClient.chain,
      account,
      address: contracts.agentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "registerAgent",
      args: [registrationFileURI],
    });
  }

  /// Check registration status (requires publicClient).
  async isRegistered(agent: Address): Promise<boolean> {
    const pc = this.opts.publicClient;
    if (!pc) throw new Error("publicClient required for reads");
    return pc.readContract({
      address: this.opts.contracts.agentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "isRegistered",
      args: [agent],
    }) as Promise<boolean>;
  }

  /// Purchase a skill with native ETH.
  async purchaseSkillWithEth(skillId: bigint, priceInWei: bigint): Promise<Hash> {
    const { walletClient, contracts } = this.opts;
    const account = walletClient.account;
    if (!account) throw new Error("WalletClient has no account");

    return walletClient.writeContract({
      chain: walletClient.chain,
      account,
      address: contracts.skillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "purchaseSkill",
      args: [skillId],
      value: priceInWei,
    });
  }

  /// Approve USDC then purchase a skill with USDC (2 transactions).
  async purchaseSkillWithUsdc(skillId: bigint, priceInUsdc: bigint): Promise<{
    approveTx: Hash;
    purchaseTx: Hash;
  }> {
    const { walletClient, contracts } = this.opts;
    const account = walletClient.account;
    if (!account) throw new Error("WalletClient has no account");

    const approveTx = await walletClient.writeContract({
      chain: walletClient.chain,
      account,
      address: contracts.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [contracts.skillMarketplace, priceInUsdc],
    });

    const purchaseTx = await walletClient.writeContract({
      chain: walletClient.chain,
      account,
      address: contracts.skillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "purchaseSkillWithUsdc",
      args: [skillId],
    });

    return { approveTx, purchaseTx };
  }

  /// Submit verifier-signed proof of completion to mint the SBT credential.
  async completeSkill(
    skillId: bigint,
    level: number,
    score: bigint,
    signature: `0x${string}`
  ): Promise<Hash> {
    const { walletClient, contracts } = this.opts;
    const account = walletClient.account;
    if (!account) throw new Error("WalletClient has no account");

    return walletClient.writeContract({
      chain: walletClient.chain,
      account,
      address: contracts.skillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "completeSkill",
      args: [skillId, level, score, signature],
    });
  }

  /// Rate a completed skill (1..5 stars).
  async rateSkill(skillId: bigint, rating: number): Promise<Hash> {
    const { walletClient, contracts } = this.opts;
    const account = walletClient.account;
    if (!account) throw new Error("WalletClient has no account");

    return walletClient.writeContract({
      chain: walletClient.chain,
      account,
      address: contracts.skillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "rateSkill",
      args: [skillId, rating],
    });
  }
}
