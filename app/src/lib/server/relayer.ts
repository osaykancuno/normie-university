/// @file relayer.ts (server)
/// @notice Server-side relayer that pays the gas for agent transactions.
///         Reads RELAYER_PRIVATE_KEY from env. Signs and submits two flows:
///         (1) `purchaseSkillWithAuthorization` after settling an x402 X-PAYMENT
///         (2) `completeSkill` after the verifier has issued a signature
///
///         The relayer holds ETH on the active chain to pay gas. It does NOT
///         hold USDC — funds flow agent → marketplace via EIP-3009.

import "server-only";
import {
  createWalletClient,
  http,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ACTIVE_CHAIN } from "@/config/chains";
import {
  SKILL_MARKETPLACE_ABI,
  getAddresses,
} from "@/lib/contracts";
import { getPublicClient } from "./viem";
import type { Eip3009Authorization, Eip3009Signature } from "@/lib/x402";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function relayerAccount() {
  const pk = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
  if (!pk) return null;
  return privateKeyToAccount(pk);
}

function build() {
  const account = relayerAccount();
  if (!account) return null;
  const rpcUrl = process.env.RPC_URL || undefined;
  return createWalletClient({
    account,
    chain: ACTIVE_CHAIN,
    transport: http(rpcUrl),
  });
}

let cached: ReturnType<typeof build> = null;
function getRelayer() {
  if (!cached) cached = build();
  return cached;
}

export function isRelayerConfigured(): boolean {
  return relayerAccount() !== null;
}

export function relayerAddress(): `0x${string}` | null {
  return relayerAccount()?.address ?? null;
}

// ---------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------

export type RelayResult =
  | { ok: true; txHash: Hash; blockNumber: bigint }
  | { ok: false; reason: string };

/// Submit `purchaseSkillWithAuthorization` on-chain on behalf of the agent.
/// The EIP-3009 auth carries the signed transfer; the relayer just pays gas.
export async function relayPurchaseWithAuth(
  skillId: bigint,
  auth: Eip3009Authorization,
  sig: Eip3009Signature
): Promise<RelayResult> {
  const wallet = getRelayer();
  if (!wallet) return { ok: false, reason: "Relayer not configured" };

  const addr = getAddresses();
  const pub = getPublicClient();

  try {
    const txHash = await wallet.writeContract({
      account: wallet.account!,
      chain: wallet.chain,
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "purchaseSkillWithAuthorization",
      args: [
        skillId,
        auth.from,
        BigInt(auth.value),
        BigInt(auth.validAfter),
        BigInt(auth.validBefore),
        auth.nonce,
        sig.v,
        sig.r,
        sig.s,
      ],
    });
    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return { ok: false, reason: "Purchase transaction reverted" };
    }
    return { ok: true, txHash, blockNumber: receipt.blockNumber };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Relayer error";
    return { ok: false, reason: message };
  }
}

/// Submit `sponsorFirstSkill` on behalf of the protocol. The relayer key
/// must hold SPONSOR_ROLE on the marketplace. Records a zero-amount purchase
/// so the agent can complete the skill and claim the SBT.
export async function relaySponsorFirstSkill(
  agent: `0x${string}`,
  skillId: bigint
): Promise<RelayResult> {
  const wallet = getRelayer();
  if (!wallet) return { ok: false, reason: "Relayer not configured" };

  const addr = getAddresses();
  const pub = getPublicClient();

  try {
    const txHash = await wallet.writeContract({
      account: wallet.account!,
      chain: wallet.chain,
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "sponsorFirstSkill",
      args: [agent, skillId],
    });
    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return { ok: false, reason: "Sponsorship transaction reverted" };
    }
    return { ok: true, txHash, blockNumber: receipt.blockNumber };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Relayer error";
    return { ok: false, reason: message };
  }
}

/// Submit `completeSkillFor` on behalf of the agent. The relayer pays gas;
/// the SBT mints to `agent`, reputation updates for `agent`. Authority comes
/// from the verifier signature (bound to `agent`) — msg.sender is irrelevant.
export async function relayCompleteFor(
  agent: `0x${string}`,
  skillId: bigint,
  level: number,
  score: bigint,
  signature: Hex
): Promise<RelayResult> {
  const wallet = getRelayer();
  if (!wallet) return { ok: false, reason: "Relayer not configured" };

  const addr = getAddresses();
  const pub = getPublicClient();

  try {
    const txHash = await wallet.writeContract({
      account: wallet.account!,
      chain: wallet.chain,
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "completeSkillFor",
      args: [agent, skillId, level, score, signature],
    });
    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return { ok: false, reason: "Completion transaction reverted" };
    }
    return { ok: true, txHash, blockNumber: receipt.blockNumber };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Relayer error";
    return { ok: false, reason: message };
  }
}
