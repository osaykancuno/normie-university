/// @file validator.ts (server) — ERC-8004 ValidationRegistry orchestration.
///
/// The verifier (verifier.ts) gates the CREDENTIAL: it signs a completion
/// authorization that lets the marketplace mint. The VALIDATOR is a SEPARATE
/// role: an independent party that attests a 0-100 quality score about an
/// agent's skill execution. Those attestations live in the ERC-8004
/// ValidationRegistry and are blended into the on-chain reputation by
/// ReputationEngine._blendVerify (avgCred + avgValidationScore) / 2.
///
/// This module lets a VALIDATOR-role holder submit such an attestation in one
/// server-orchestrated flow (open request → respond). It is intentionally
/// distinct from the verifier so the two roles can be held by different
/// entities — self-validating every completion with the verifier's own key
/// would be circular and is deliberately NOT wired into the completion path.

import "server-only";
import {
  createWalletClient,
  http,
  keccak256,
  encodePacked,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { VALIDATION_REGISTRY_ABI, getAddresses } from "@/lib/contracts";
import { ACTIVE_CHAIN } from "@/config/chains";
import { getPublicClient } from "./viem";

export function isValidatorConfigured(): boolean {
  return !!process.env.VALIDATOR_PRIVATE_KEY;
}

function buildValidatorWallet(pk: Hex) {
  const account = privateKeyToAccount(pk);
  return createWalletClient({
    account,
    chain: ACTIVE_CHAIN,
    transport: http(process.env.RPC_URL || undefined),
  });
}

/// Deterministic dataHash for a (serverAgent, skillId, txHash) tuple so the
/// same execution can't be double-attested.
export function validationDataHash(
  serverAgent: Address,
  skillId: bigint,
  txHash?: Hex
): Hex {
  return keccak256(
    encodePacked(
      ["address", "uint256", "bytes32"],
      [serverAgent, skillId, (txHash ?? ("0x" + "0".repeat(64))) as Hex]
    )
  );
}

export type ValidationResult =
  | { ok: true; dataHash: Hex; score: number; requestTx: Hex; responseTx: Hex }
  | { ok: false; reason: string };

/// Submit a validation attestation: open a request (validator → serverAgent)
/// then respond with `score` (0-100). Requires VALIDATOR_PRIVATE_KEY whose
/// address holds VALIDATOR_ROLE on the ValidationRegistry.
export async function submitValidation(
  serverAgent: Address,
  skillId: bigint,
  score: number,
  txHash?: Hex
): Promise<ValidationResult> {
  const pk = process.env.VALIDATOR_PRIVATE_KEY as Hex | undefined;
  if (!pk) return { ok: false, reason: "Validator not configured (VALIDATOR_PRIVATE_KEY missing)" };
  if (score < 0 || score > 100) return { ok: false, reason: "score must be 0..100" };

  const wallet = buildValidatorWallet(pk);
  const addr = getAddresses();
  const registry = addr.ValidationRegistry;
  const validator = wallet.account.address as Address;
  const pub = getPublicClient();
  const dataHash = validationDataHash(serverAgent, skillId, txHash);

  try {
    const requestTx = await wallet.writeContract({
      account: wallet.account,
      chain: wallet.chain,
      address: registry,
      abi: VALIDATION_REGISTRY_ABI,
      functionName: "validationRequest",
      args: [validator, serverAgent, dataHash, skillId],
    });
    await pub.waitForTransactionReceipt({ hash: requestTx });

    const responseTx = await wallet.writeContract({
      account: wallet.account,
      chain: wallet.chain,
      address: registry,
      abi: VALIDATION_REGISTRY_ABI,
      functionName: "validationResponse",
      args: [dataHash, score],
    });
    const r = await pub.waitForTransactionReceipt({ hash: responseTx });
    if (r.status !== "success") return { ok: false, reason: "validationResponse reverted" };

    return { ok: true, dataHash, score, requestTx, responseTx };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Validation submission failed" };
  }
}
