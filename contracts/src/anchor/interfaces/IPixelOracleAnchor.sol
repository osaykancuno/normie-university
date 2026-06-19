// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @notice Read-side interface of the Pixel Oracle anchor contract.
 *         Any dApp that wants to gate behaviour on a Normies credential or on
 *         a Normies reputation score can import this and call the relevant
 *         verifier. Everything is verifiable in-call with a Merkle proof —
 *         the contract holds only one storage slot per epoch.
 */
interface IPixelOracleAnchor {
    struct Credential {
        uint256 tokenId;
        bytes32 skillId;
        uint64 issuedAt;
        uint64 nonce;
        bytes32 evidenceTxHash;
    }

    struct Reputation {
        uint256 tokenId;
        uint256 score;
        uint64 computedAt;
        uint64 epochId;
    }

    /// @notice The latest epoch the anchor has committed.
    function latestEpoch() external view returns (uint256);

    /// @notice State root committed at a given epoch (zero if not yet committed).
    function stateRootOf(uint256 epochId) external view returns (bytes32);

    /// @notice Verify a credential was included in the epoch's state tree.
    function verifyCredential(
        uint256 epochId,
        Credential calldata c,
        bytes32[] calldata proof,
        bool[] calldata leftFlags
    ) external view returns (bool);

    /// @notice Verify a reputation attestation was included in the epoch's state tree.
    function verifyReputation(
        uint256 epochId,
        Reputation calldata r,
        bytes32[] calldata proof,
        bool[] calldata leftFlags
    ) external view returns (bool);
}
