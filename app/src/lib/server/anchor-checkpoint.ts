/// @file anchor-checkpoint.ts (server)
/// @notice Builds, co-signs (2-of-2), and submits a PixelOracleAnchor
///         checkpoint, and serves Merkle proofs for any committed leaf.
///
///         Per epoch we collect every credential + reputation attestation,
///         build the combined SHA-256 Merkle tree (bit-equivalent to the
///         on-chain verifier), compute the state root, and require BOTH the
///         University signer and the Oracle signer to co-sign the EIP-712
///         Checkpoint before submitting on-chain. Two-of-two removes the
///         single-key SPOF that plain EIP-191 completion signing has.

import "server-only";
import {
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ACTIVE_CHAIN } from "@/config/chains";
import { PIXEL_ORACLE_ANCHOR_ABI, getAddresses } from "@/lib/contracts";
import { getPublicClient } from "./viem";
import {
  hashCredentialLeaf,
  hashReputationLeaf,
  credentialOrderingKey,
  reputationOrderingKey,
  buildAnchorTree,
  generateAnchorProof,
  computeStateRoot,
  type AnchorLeaf,
} from "./anchor/anchor";
import {
  buildDomain,
  CHECKPOINT_TYPES,
  type CredentialAttestation,
  type ReputationAttestation,
} from "./anchor/eip712";
import { toHex as bytesToHex } from "./anchor/hex";

export function isAnchorConfigured(): boolean {
  return (
    !!process.env.UNIVERSITY_SIGNER_PRIVATE_KEY &&
    !!process.env.ORACLE_SIGNER_PRIVATE_KEY &&
    getAddresses().PixelOracleAnchor !== "0x0000000000000000000000000000000000000000"
  );
}

/// Surface the two anchor signers and whether they are genuinely distinct.
/// The 2-of-2 checkpoint only protects against a single compromised key if the
/// University signer and the Oracle signer are DIFFERENT keys (ideally under
/// diverse custody). If they collapse to one address the co-signature is
/// theatre — so we expose this for the health endpoint and hard-fail submission.
export function anchorSignerDiagnostics():
  | { configured: false }
  | { configured: true; university: Address; oracle: Address; distinct: boolean } {
  const uniPk = process.env.UNIVERSITY_SIGNER_PRIVATE_KEY as Hex | undefined;
  const oraPk = process.env.ORACLE_SIGNER_PRIVATE_KEY as Hex | undefined;
  if (!uniPk || !oraPk) return { configured: false };
  const university = privateKeyToAccount(uniPk).address;
  const oracle = privateKeyToAccount(oraPk).address;
  return {
    configured: true,
    university,
    oracle,
    distinct: university.toLowerCase() !== oracle.toLowerCase(),
  };
}

function hx(bytes: Uint8Array): Hex {
  return ("0x" + bytesToHex(bytes)) as Hex;
}

export type CheckpointInput = {
  epochId: bigint;
  anchorBlock: bigint;
  credentials: CredentialAttestation[];
  reputations: ReputationAttestation[];
};

export type CheckpointResult =
  | {
      ok: true;
      epochId: string;
      merkleRoot: Hex;
      stateRoot: Hex;
      credentialCount: number;
      reputationCount: number;
      txHash: Hex;
      blockNumber: string;
    }
  | { ok: false; reason: string };

/// Build the combined leaf set (credentials + reputations) with ordering keys.
function buildLeaves(
  credentials: CredentialAttestation[],
  reputations: ReputationAttestation[]
): AnchorLeaf[] {
  const leaves: AnchorLeaf[] = [];
  for (const c of credentials) {
    leaves.push({
      hash: hashCredentialLeaf(c),
      kind: "credential",
      orderingKey: credentialOrderingKey(c),
    });
  }
  for (const r of reputations) {
    leaves.push({
      hash: hashReputationLeaf(r),
      kind: "reputation",
      orderingKey: reputationOrderingKey(r),
    });
  }
  return leaves;
}

/// Build the tree + co-sign + submit the checkpoint on-chain.
export async function buildAndSubmitCheckpoint(
  input: CheckpointInput
): Promise<CheckpointResult> {
  const uniPk = process.env.UNIVERSITY_SIGNER_PRIVATE_KEY as Hex | undefined;
  const oraPk = process.env.ORACLE_SIGNER_PRIVATE_KEY as Hex | undefined;
  if (!uniPk || !oraPk) {
    return { ok: false, reason: "Anchor signers not configured" };
  }
  const anchor = getAddresses().PixelOracleAnchor;
  if (anchor === "0x0000000000000000000000000000000000000000") {
    return { ok: false, reason: "PixelOracleAnchor address not configured" };
  }

  const { epochId, anchorBlock, credentials, reputations } = input;
  if (credentials.length + reputations.length === 0) {
    return { ok: false, reason: "Cannot checkpoint an empty epoch (no leaves)" };
  }

  const leaves = buildLeaves(credentials, reputations);
  const tree = buildAnchorTree(leaves);
  const merkleRoot = tree.root;
  const credentialCount = credentials.length;
  const reputationCount = reputations.length;
  const stateRoot = computeStateRoot(epochId, merkleRoot, credentialCount, reputationCount);

  const domain = buildDomain(anchor, ACTIVE_CHAIN.id);
  const message = {
    epochId,
    stateRoot: hx(stateRoot),
    anchorBlock,
    credentialCount: BigInt(credentialCount),
    reputationCount: BigInt(reputationCount),
  };

  // 2-of-2 EIP-712 co-signature
  const uniAccount = privateKeyToAccount(uniPk);
  const oraAccount = privateKeyToAccount(oraPk);
  // Hard-fail if the two "independent" signers are the same key: a 2-of-2 that
  // resolves to one address provides no extra protection over single-key signing.
  if (uniAccount.address.toLowerCase() === oraAccount.address.toLowerCase()) {
    return {
      ok: false,
      reason:
        "Anchor signers are identical — 2-of-2 requires two distinct keys (ideally diverse custody)",
    };
  }
  const sigParams = {
    domain,
    types: CHECKPOINT_TYPES,
    primaryType: "Checkpoint" as const,
    message,
  };
  const universitySig = await uniAccount.signTypedData(sigParams);
  const oracleSig = await oraAccount.signTypedData(sigParams);

  // Submit via the relayer (pays gas). Reuse RELAYER_PRIVATE_KEY.
  const relayerPk = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
  if (!relayerPk) return { ok: false, reason: "Relayer not configured to submit checkpoint" };
  const relayer = createWalletClient({
    account: privateKeyToAccount(relayerPk),
    chain: ACTIVE_CHAIN,
    transport: http(process.env.RPC_URL || undefined),
  });
  const pub = getPublicClient();

  try {
    const txHash = await relayer.writeContract({
      account: relayer.account,
      chain: relayer.chain,
      address: anchor,
      abi: PIXEL_ORACLE_ANCHOR_ABI,
      functionName: "checkpoint",
      args: [
        epochId,
        hx(merkleRoot),
        anchorBlock,
        credentialCount,
        reputationCount,
        universitySig,
        oracleSig,
      ],
    });
    const r = await pub.waitForTransactionReceipt({ hash: txHash });
    if (r.status !== "success") return { ok: false, reason: "checkpoint tx reverted" };
    return {
      ok: true,
      epochId: epochId.toString(),
      merkleRoot: hx(merkleRoot),
      stateRoot: hx(stateRoot),
      credentialCount,
      reputationCount,
      txHash,
      blockNumber: r.blockNumber.toString(),
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "checkpoint submission failed" };
  }
}

/// Produce a Merkle proof for one credential (for on-chain verifyCredential).
export function proofForCredential(
  credentials: CredentialAttestation[],
  reputations: ReputationAttestation[],
  target: CredentialAttestation
): { proof: Hex[]; leftFlags: boolean[] } {
  const tree = buildAnchorTree(buildLeaves(credentials, reputations));
  const steps = generateAnchorProof(tree, credentialOrderingKey(target));
  return {
    proof: steps.map((s) => hx(s.sibling)),
    leftFlags: steps.map((s) => s.position === "L"),
  };
}

/// Produce a Merkle proof for one reputation entry.
export function proofForReputation(
  credentials: CredentialAttestation[],
  reputations: ReputationAttestation[],
  target: ReputationAttestation
): { proof: Hex[]; leftFlags: boolean[] } {
  const tree = buildAnchorTree(buildLeaves(credentials, reputations));
  const steps = generateAnchorProof(tree, reputationOrderingKey(target));
  return {
    proof: steps.map((s) => hx(s.sibling)),
    leftFlags: steps.map((s) => s.position === "L"),
  };
}
