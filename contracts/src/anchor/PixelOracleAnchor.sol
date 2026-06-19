// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPixelOracleAnchor} from "./interfaces/IPixelOracleAnchor.sol";

/**
 * @title  PixelOracleAnchor
 * @notice On-chain checkpoint contract for Pixel Oracle attestations on
 *         Ethereum mainnet. Each epoch the Oracle co-signs (with Normie
 *         University) a single 32-byte state root that commits to ALL
 *         credentials and reputations issued in that epoch. The contract
 *         exposes constant-time on-chain verifiers that any external dApp
 *         can call without trusting the Oracle's off-chain service.
 *
 * @dev    Storage cost per epoch: 1 SSTORE (~22k gas warm / ~50k cold-slot).
 *         Verification cost: ~5k base + ~2k per Merkle proof step.
 *
 *         Domain-tagged leaves (see packages/core/src/anchor.ts) guarantee
 *         credential leaves and reputation leaves cannot collide.
 *
 *         The contract uses SHA-256 (`sha256` precompile, address 0x02) to
 *         match the off-chain spec exactly. Keccak256 is NOT used for tree
 *         hashing, so verifier output is bit-identical to the off-chain
 *         primitives in the core package.
 */
contract PixelOracleAnchor is IPixelOracleAnchor {
    // -----------------------------------------------------------------
    // Constants — see docs/ALGORITHM_V4.md
    // -----------------------------------------------------------------
    bytes constant DOMAIN_CREDENTIAL = bytes("PIXEL_ANCHOR_CREDENTIAL_V1");
    bytes constant DOMAIN_REPUTATION = bytes("PIXEL_ANCHOR_REPUTATION_V1");
    bytes constant DOMAIN_STATE      = bytes("PIXEL_ANCHOR_STATE_V1");

    // EIP-712 domain
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant CHECKPOINT_TYPEHASH = keccak256(
        "Checkpoint(uint256 epochId,bytes32 stateRoot,uint256 anchorBlock,uint64 credentialCount,uint64 reputationCount)"
    );

    // -----------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------
    address public immutable universitySigner;
    address public immutable oracleSigner;

    /// @inheritdoc IPixelOracleAnchor
    uint256 public latestEpoch;

    /// @inheritdoc IPixelOracleAnchor
    mapping(uint256 => bytes32) public stateRootOf;

    /// @notice (epoch => merkleRoot) — the inner Merkle root before state-root commitment.
    mapping(uint256 => bytes32) public merkleRootOf;

    /// @notice (epoch => packed counts) — credentialCount in high 32 bits, reputationCount in low 32 bits.
    mapping(uint256 => uint64) public countsOf;

    /// @notice (epoch => block number used as anchor).
    mapping(uint256 => uint256) public anchorBlockOf;

    // -----------------------------------------------------------------
    // Events / errors
    // -----------------------------------------------------------------
    event Checkpoint(
        uint256 indexed epochId,
        bytes32 stateRoot,
        bytes32 merkleRoot,
        uint256 anchorBlock,
        uint32 credentialCount,
        uint32 reputationCount
    );

    error InvalidSignature(string which);
    error EpochAlreadyCommitted(uint256 epochId);
    error EpochNotMonotonic(uint256 epochId, uint256 latest);
    error UnknownEpoch(uint256 epochId);
    error ProofLengthMismatch();

    // -----------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------
    constructor(address _universitySigner, address _oracleSigner) {
        require(_universitySigner != address(0) && _oracleSigner != address(0), "signer=0");
        require(_universitySigner != _oracleSigner, "signers equal");
        universitySigner = _universitySigner;
        oracleSigner = _oracleSigner;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Pixel Oracle")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // -----------------------------------------------------------------
    // Checkpoint (write — single SSTORE per call)
    // -----------------------------------------------------------------

    /**
     * @notice Commit a new epoch. Requires valid EIP-712 signatures from
     *         BOTH the University signer and the Oracle signer.
     *
     * @param  epochId          Monotonically increasing epoch id.
     * @param  merkleRoot       Inner Merkle root of all leaves.
     * @param  anchorBlock      Block number used as randomness anchor (0 if N/A).
     * @param  credentialCount  Number of credential leaves in the tree.
     * @param  reputationCount  Number of reputation leaves in the tree.
     * @param  universitySig    EIP-712 signature from University signer.
     * @param  oracleSig        EIP-712 signature from Oracle signer.
     */
    function checkpoint(
        uint256 epochId,
        bytes32 merkleRoot,
        uint256 anchorBlock,
        uint32 credentialCount,
        uint32 reputationCount,
        bytes calldata universitySig,
        bytes calldata oracleSig
    ) external {
        if (stateRootOf[epochId] != bytes32(0)) revert EpochAlreadyCommitted(epochId);
        if (epochId <= latestEpoch && latestEpoch != 0) revert EpochNotMonotonic(epochId, latestEpoch);

        bytes32 stateRoot = _computeStateRoot(epochId, merkleRoot, credentialCount, reputationCount);
        bytes32 digest = _hashCheckpoint(epochId, stateRoot, anchorBlock, credentialCount, reputationCount);

        if (_recover(digest, universitySig) != universitySigner) revert InvalidSignature("university");
        if (_recover(digest, oracleSig)     != oracleSigner)     revert InvalidSignature("oracle");

        stateRootOf[epochId] = stateRoot;
        merkleRootOf[epochId] = merkleRoot;
        countsOf[epochId] = (uint64(credentialCount) << 32) | uint64(reputationCount);
        anchorBlockOf[epochId] = anchorBlock;
        latestEpoch = epochId;

        emit Checkpoint(epochId, stateRoot, merkleRoot, anchorBlock, credentialCount, reputationCount);
    }

    // -----------------------------------------------------------------
    // Verifiers (read — pure / view, free off any tx)
    // -----------------------------------------------------------------

    /// @inheritdoc IPixelOracleAnchor
    function verifyCredential(
        uint256 epochId,
        Credential calldata c,
        bytes32[] calldata proof,
        bool[] calldata leftFlags
    ) external view returns (bool) {
        bytes32 root = merkleRootOf[epochId];
        if (root == bytes32(0)) revert UnknownEpoch(epochId);
        if (proof.length != leftFlags.length) revert ProofLengthMismatch();
        bytes32 leaf = _hashCredentialLeaf(c);
        return _verifyMerkle(leaf, proof, leftFlags, root);
    }

    /// @inheritdoc IPixelOracleAnchor
    function verifyReputation(
        uint256 epochId,
        Reputation calldata r,
        bytes32[] calldata proof,
        bool[] calldata leftFlags
    ) external view returns (bool) {
        bytes32 root = merkleRootOf[epochId];
        if (root == bytes32(0)) revert UnknownEpoch(epochId);
        if (proof.length != leftFlags.length) revert ProofLengthMismatch();
        bytes32 leaf = _hashReputationLeaf(r);
        return _verifyMerkle(leaf, proof, leftFlags, root);
    }

    /// @notice Convenience: read credentialCount + reputationCount packed.
    function decodeCounts(uint256 epochId) external view returns (uint32 credentialCount, uint32 reputationCount) {
        uint64 packed = countsOf[epochId];
        credentialCount = uint32(packed >> 32);
        reputationCount = uint32(packed);
    }

    // -----------------------------------------------------------------
    // Leaf + state hashing (sha256 precompile)
    // -----------------------------------------------------------------

    function _hashCredentialLeaf(Credential calldata c) internal view returns (bytes32) {
        return sha256(
            abi.encodePacked(
                DOMAIN_CREDENTIAL,
                _u32be(uint32(c.tokenId)),
                c.skillId,
                _u64be(c.issuedAt),
                _u64be(c.nonce),
                c.evidenceTxHash
            )
        );
    }

    function _hashReputationLeaf(Reputation calldata r) internal view returns (bytes32) {
        return sha256(
            abi.encodePacked(
                DOMAIN_REPUTATION,
                _u32be(uint32(r.tokenId)),
                _u64be(uint64(r.score)),
                _u64be(r.computedAt),
                _u64be(r.epochId)
            )
        );
    }

    function _computeStateRoot(
        uint256 epochId,
        bytes32 merkleRoot,
        uint32 credentialCount,
        uint32 reputationCount
    ) internal view returns (bytes32) {
        return sha256(
            abi.encodePacked(
                DOMAIN_STATE,
                _u64be(uint64(epochId)),
                merkleRoot,
                _u32be(credentialCount),
                _u32be(reputationCount)
            )
        );
    }

    function _verifyMerkle(
        bytes32 leaf,
        bytes32[] calldata proof,
        bool[] calldata leftFlags,
        bytes32 root
    ) internal view returns (bool) {
        bytes32 acc = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            if (leftFlags[i]) {
                acc = sha256(abi.encodePacked(proof[i], acc));
            } else {
                acc = sha256(abi.encodePacked(acc, proof[i]));
            }
        }
        return acc == root;
    }

    // -----------------------------------------------------------------
    // EIP-712 typed-data hashing
    // -----------------------------------------------------------------

    function _hashCheckpoint(
        uint256 epochId,
        bytes32 stateRoot,
        uint256 anchorBlock,
        uint32 credentialCount,
        uint32 reputationCount
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                CHECKPOINT_TYPEHASH,
                epochId,
                stateRoot,
                anchorBlock,
                uint64(credentialCount),
                uint64(reputationCount)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return address(0);
        return ecrecover(digest, v, r, s);
    }

    // -----------------------------------------------------------------
    // Big-endian helpers (match SHA-256 input layout from core/anchor.ts)
    // -----------------------------------------------------------------

    function _u32be(uint32 x) internal pure returns (bytes memory b) {
        b = new bytes(4);
        b[0] = bytes1(uint8(x >> 24));
        b[1] = bytes1(uint8(x >> 16));
        b[2] = bytes1(uint8(x >> 8));
        b[3] = bytes1(uint8(x));
    }

    function _u64be(uint64 x) internal pure returns (bytes memory b) {
        b = new bytes(8);
        b[0] = bytes1(uint8(x >> 56));
        b[1] = bytes1(uint8(x >> 48));
        b[2] = bytes1(uint8(x >> 40));
        b[3] = bytes1(uint8(x >> 32));
        b[4] = bytes1(uint8(x >> 24));
        b[5] = bytes1(uint8(x >> 16));
        b[6] = bytes1(uint8(x >> 8));
        b[7] = bytes1(uint8(x));
    }
}
