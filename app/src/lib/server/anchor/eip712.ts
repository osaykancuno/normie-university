/**
 * EIP-712 typed-data structures used for credential co-signing and
 * reputation attestation.
 *
 * These types are the canonical interface between Normie University, Pixel
 * Oracle, and any on-chain consumer (smart contract or off-chain verifier).
 *
 * Domain separator: the `verifyingContract` MUST be the deployed
 * `PixelOracleAnchor` address on Ethereum mainnet. Chain id is always 1.
 *
 * Spec reference: docs/ALGORITHM_V4.md.
 */

export const EIP712_DOMAIN_NAME = 'Pixel Oracle';
export const EIP712_DOMAIN_VERSION = '1';

/** Identifies the kind of attestation — encoded into the leaf hash. */
export const ATTESTATION_KIND_CREDENTIAL = 'CREDENTIAL';
export const ATTESTATION_KIND_REPUTATION = 'REPUTATION';

export interface Eip712Domain {
  readonly name: string;
  readonly version: string;
  readonly chainId: number;
  readonly verifyingContract: `0x${string}`;
}

/**
 * Credential = a Normie University SBT credential, co-signed by Oracle.
 *
 * The University server emits this struct, signs it with its own key, and
 * forwards it to Pixel Oracle. The oracle re-verifies the underlying on-chain
 * evidence (the same proof of completion that triggered University's
 * attestation) and counter-signs.
 *
 * `issuedAt` and `nonce` jointly prevent replay across epochs.
 */
export interface CredentialAttestation {
  /** Normie token id (0..9999). */
  readonly tokenId: number;
  /** keccak256 of the skill canonical id (lower-case hex string with 0x). */
  readonly skillId: `0x${string}`;
  /** Unix timestamp the credential was first issued by University. */
  readonly issuedAt: number;
  /** Per-(tokenId, skillId) monotonic counter — protects against replay. */
  readonly nonce: number;
  /** On-chain tx hash that proved skill completion. */
  readonly evidenceTxHash: `0x${string}`;
}

export const CREDENTIAL_TYPES = {
  Credential: [
    { name: 'tokenId',        type: 'uint256' },
    { name: 'skillId',        type: 'bytes32' },
    { name: 'issuedAt',       type: 'uint64'  },
    { name: 'nonce',          type: 'uint64'  },
    { name: 'evidenceTxHash', type: 'bytes32' },
  ],
} as const;

/**
 * Reputation = canonical score for a Normie at a given epoch.
 *
 * Computed by Normie University's ReputationEngine, co-signed by Oracle.
 * `score` uses the same formula University publishes — Oracle does not
 * re-derive, only validates the formula against published inputs.
 */
export interface ReputationAttestation {
  readonly tokenId: number;
  readonly score: bigint;
  /** Unix timestamp the score was computed. */
  readonly computedAt: number;
  /** Epoch index at which this attestation is bound. */
  readonly epochId: bigint;
}

export const REPUTATION_TYPES = {
  Reputation: [
    { name: 'tokenId',    type: 'uint256' },
    { name: 'score',      type: 'uint256' },
    { name: 'computedAt', type: 'uint64'  },
    { name: 'epochId',    type: 'uint64'  },
  ],
} as const;

/**
 * Checkpoint = the per-epoch commitment from Pixel Oracle to the Anchor
 * smart contract on mainnet. Signed jointly by University + Oracle.
 */
export interface CheckpointPayload {
  readonly epochId: bigint;
  readonly stateRoot: `0x${string}`;
  /** Block number used for randomness anchoring (optional, 0 if not used). */
  readonly anchorBlock: bigint;
  /** Count of credential leaves included in the tree. */
  readonly credentialCount: number;
  /** Count of reputation leaves included in the tree. */
  readonly reputationCount: number;
}

export const CHECKPOINT_TYPES = {
  Checkpoint: [
    { name: 'epochId',         type: 'uint256' },
    { name: 'stateRoot',       type: 'bytes32' },
    { name: 'anchorBlock',     type: 'uint256' },
    { name: 'credentialCount', type: 'uint64'  },
    { name: 'reputationCount', type: 'uint64'  },
  ],
} as const;

/** Build the canonical EIP-712 domain object given a deployed anchor address. */
export function buildDomain(verifyingContract: `0x${string}`, chainId = 1): Eip712Domain {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  };
}
