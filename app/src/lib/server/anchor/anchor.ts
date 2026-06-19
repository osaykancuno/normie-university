import 'server-only';
/**
 * On-chain anchor primitives (V4).
 *
 * Per-epoch, Pixel Oracle commits ONE state root to a smart contract on
 * Ethereum mainnet. That root commits to BOTH:
 *
 *   - credential attestations (Normie University SBT issuances)
 *   - reputation attestations (canonical scores at epoch close)
 *
 * Each leaf carries a domain tag so credential leaves and reputation leaves
 * cannot collide under any input. Anyone holding the root + a Merkle proof
 * can verify any single attestation on-chain in ~70k gas.
 *
 * Full normative spec: docs/ALGORITHM_V4.md.
 */

import { createHash } from 'node:crypto';
import { utf8, u32be, u64be, concatBytes } from './hex';
import type { CredentialAttestation, ReputationAttestation } from './eip712';

export const DOMAIN_ANCHOR_CREDENTIAL = 'PIXEL_ANCHOR_CREDENTIAL_V1';
export const DOMAIN_ANCHOR_REPUTATION = 'PIXEL_ANCHOR_REPUTATION_V1';
export const DOMAIN_ANCHOR_STATE = 'PIXEL_ANCHOR_STATE_V1';

function sha256(...parts: Uint8Array[]): Uint8Array {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return new Uint8Array(h.digest());
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('odd-length hex');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// =================================================================== leaves

/**
 * Credential leaf:
 *   SHA-256(
 *     "PIXEL_ANCHOR_CREDENTIAL_V1" ||
 *     u32be(tokenId) || skillId(32) || u64be(issuedAt) ||
 *     u64be(nonce)   || evidenceTxHash(32)
 *   )
 *
 * The leaf depends on every public input of the EIP-712 struct. Two
 * credentials cannot share a leaf without sharing every field, so any change
 * to issuedAt or nonce yields a distinct fact.
 */
export function hashCredentialLeaf(c: CredentialAttestation): Uint8Array {
  const skillId = hexToBytes(c.skillId);
  if (skillId.length !== 32) throw new Error('skillId must be 32 bytes');
  const evidence = hexToBytes(c.evidenceTxHash);
  if (evidence.length !== 32) throw new Error('evidenceTxHash must be 32 bytes');
  if (!Number.isInteger(c.tokenId) || c.tokenId < 0 || c.tokenId > 9999) {
    throw new Error(`invalid tokenId: ${c.tokenId}`);
  }
  if (c.issuedAt < 0 || c.nonce < 0) throw new Error('issuedAt and nonce must be non-negative');
  return sha256(
    utf8(DOMAIN_ANCHOR_CREDENTIAL),
    u32be(c.tokenId),
    skillId,
    u64be(BigInt(c.issuedAt)),
    u64be(BigInt(c.nonce)),
    evidence,
  );
}

/**
 * Reputation leaf:
 *   SHA-256(
 *     "PIXEL_ANCHOR_REPUTATION_V1" ||
 *     u32be(tokenId) || u64be(score) || u64be(computedAt) || u64be(epochId)
 *   )
 *
 * Score is u64-bounded (the University formula caps well below 2^64).
 */
export function hashReputationLeaf(r: ReputationAttestation): Uint8Array {
  if (!Number.isInteger(r.tokenId) || r.tokenId < 0 || r.tokenId > 9999) {
    throw new Error(`invalid tokenId: ${r.tokenId}`);
  }
  if (r.score < 0n || r.score > 0xffffffffffffffffn) throw new Error('score out of u64 range');
  if (r.computedAt < 0) throw new Error('computedAt must be non-negative');
  if (r.epochId < 0n) throw new Error('epochId must be non-negative');
  return sha256(
    utf8(DOMAIN_ANCHOR_REPUTATION),
    u32be(r.tokenId),
    u64be(r.score),
    u64be(BigInt(r.computedAt)),
    u64be(r.epochId),
  );
}

// =================================================================== tree

export interface AnchorLeaf {
  readonly hash: Uint8Array;
  readonly kind: 'credential' | 'reputation';
  /** Stable index used both as ordering key and as the position used by the proof verifier. */
  readonly orderingKey: string;
}

export interface AnchorTree {
  readonly leaves: readonly AnchorLeaf[];
  readonly levels: readonly Uint8Array[][];
  readonly root: Uint8Array;
}

/**
 * Build a combined state tree. Leaves are sorted lexicographically by
 * `orderingKey` so the resulting tree is deterministic across implementations.
 *
 * The ordering key MUST embed the leaf kind so credentials and reputation
 * never interleave ambiguously. Conventions:
 *
 *   credential:  "c|<tokenId 5-digit zero-padded>|<skillId hex>|<nonce 10-digit>"
 *   reputation:  "r|<tokenId 5-digit zero-padded>|<epochId 20-digit>"
 *
 * Sorting by string is sufficient given these canonical forms.
 */
export function buildAnchorTree(leaves: readonly AnchorLeaf[]): AnchorTree {
  if (leaves.length === 0) {
    throw new Error('cannot build anchor tree with zero leaves');
  }
  const sorted = [...leaves].sort((a, b) => (a.orderingKey < b.orderingKey ? -1 : a.orderingKey > b.orderingKey ? 1 : 0));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.orderingKey === sorted[i - 1]!.orderingKey) {
      throw new Error(`duplicate orderingKey: ${sorted[i]!.orderingKey}`);
    }
  }
  const levels: Uint8Array[][] = [];
  levels.push(sorted.map((l) => l.hash));
  while (levels[levels.length - 1]!.length > 1) {
    const prev = levels[levels.length - 1]!;
    const next: Uint8Array[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i]!;
      const right = i + 1 < prev.length ? prev[i + 1]! : left;
      next.push(sha256(left, right));
    }
    levels.push(next);
  }
  return { leaves: sorted, levels, root: levels[levels.length - 1]![0]! };
}

export interface AnchorProofStep {
  readonly sibling: Uint8Array;
  readonly position: 'L' | 'R';
}

export function generateAnchorProof(tree: AnchorTree, orderingKey: string): AnchorProofStep[] {
  const idx = tree.leaves.findIndex((l) => l.orderingKey === orderingKey);
  if (idx < 0) throw new Error(`leaf not in tree: ${orderingKey}`);
  const proof: AnchorProofStep[] = [];
  let i = idx;
  for (let level = 0; level < tree.levels.length - 1; level++) {
    const layer = tree.levels[level]!;
    const isRight = (i & 1) === 1;
    const siblingIdx = isRight ? i - 1 : i + 1;
    const sibling = siblingIdx < layer.length ? layer[siblingIdx]! : layer[i]!;
    proof.push({ sibling, position: isRight ? 'L' : 'R' });
    i = i >> 1;
  }
  return proof;
}

export function verifyAnchorProof(
  leafHash: Uint8Array,
  proof: readonly AnchorProofStep[],
  root: Uint8Array,
): boolean {
  let acc = leafHash;
  for (const step of proof) {
    acc = step.position === 'L' ? sha256(step.sibling, acc) : sha256(acc, step.sibling);
  }
  if (acc.length !== root.length) return false;
  let diff = 0;
  for (let i = 0; i < acc.length; i++) diff |= acc[i]! ^ root[i]!;
  return diff === 0;
}

// =================================================================== keys

export function credentialOrderingKey(c: CredentialAttestation): string {
  return `c|${String(c.tokenId).padStart(5, '0')}|${c.skillId.toLowerCase()}|${String(c.nonce).padStart(10, '0')}`;
}

export function reputationOrderingKey(r: ReputationAttestation): string {
  return `r|${String(r.tokenId).padStart(5, '0')}|${r.epochId.toString().padStart(20, '0')}`;
}

// =================================================================== state-root commitment

/**
 * Final commitment that the anchor smart contract stores per epoch.
 *
 *   stateRoot = SHA-256(
 *     "PIXEL_ANCHOR_STATE_V1" ||
 *     u64be(epochId) ||
 *     merkleRoot ||
 *     u32be(credentialCount) ||
 *     u32be(reputationCount)
 *   )
 *
 * Including the counts in the commit lets verifiers reject malicious roots
 * that claim a different cardinality than what was actually published.
 */
export function computeStateRoot(
  epochId: bigint,
  merkleRoot: Uint8Array,
  credentialCount: number,
  reputationCount: number,
): Uint8Array {
  if (merkleRoot.length !== 32) throw new Error('merkleRoot must be 32 bytes');
  return sha256(
    utf8(DOMAIN_ANCHOR_STATE),
    u64be(epochId),
    merkleRoot,
    u32be(credentialCount),
    u32be(reputationCount),
  );
}

// Re-exported helpers
export { concatBytes };
