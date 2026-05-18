"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { AGENT_REGISTRY_ABI, getAddresses } from "@/lib/contracts";

export type AgentProfile = {
  tokenId: bigint;
  agentAddress: `0x${string}`;
  registrationFileURI: string;
  registeredAt: bigint;
  updatedAt: bigint;
  isActive: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000";

/// Total number of agents registered
export function useTotalAgents() {
  const addr = getAddresses();
  return useReadContract({
    address: addr.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "totalAgents",
    query: { enabled: addr.AgentRegistry !== ZERO },
  });
}

/// Whether an address has at least one active agent token
export function useIsRegistered(agent: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "isRegistered",
    args: agent ? [agent] : undefined,
    query: { enabled: !!agent && addr.AgentRegistry !== ZERO },
  });
}

/// Primary tokenId for an address (0 if none)
export function usePrimaryTokenId(agent: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getPrimaryTokenId",
    args: agent ? [agent] : undefined,
    query: { enabled: !!agent && addr.AgentRegistry !== ZERO },
  });
}

/// All token ids owned by an address
export function useAgentsByOwner(owner: `0x${string}` | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgentsByOwner",
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner && addr.AgentRegistry !== ZERO },
  });
}

/// Full profile by tokenId
export function useAgent(tokenId: bigint | undefined) {
  const addr = getAddresses();
  return useReadContract({
    address: addr.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined && addr.AgentRegistry !== ZERO },
  });
}

/// Write: register a new agent with IPFS metadata URI
export function useRegisterAgent() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const registerAgent = (registrationFileURI: string) =>
    writeContract({
      address: addr.AgentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "registerAgent",
      args: [registrationFileURI],
    });

  const registerAgentAsync = (registrationFileURI: string) =>
    writeContractAsync({
      address: addr.AgentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "registerAgent",
      args: [registrationFileURI],
    });

  return { registerAgent, registerAgentAsync, txHash: data, isPending, error };
}

/// Write: update an existing agent's metadata
export function useUpdateAgent() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const updateAgent = (tokenId: bigint, registrationFileURI: string) =>
    writeContract({
      address: addr.AgentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "updateAgent",
      args: [tokenId, registrationFileURI],
    });

  const updateAgentAsync = (tokenId: bigint, registrationFileURI: string) =>
    writeContractAsync({
      address: addr.AgentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "updateAgent",
      args: [tokenId, registrationFileURI],
    });

  return { updateAgent, updateAgentAsync, txHash: data, isPending, error };
}
