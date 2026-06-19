// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPixelOracleAnchor} from "./interfaces/IPixelOracleAnchor.sol";

/**
 * @title  SkillGate
 * @notice Reusable modifier + helpers for any dApp that wants to gate a
 *         function on a Normies University credential or a minimum
 *         reputation score, both verified on-chain through Pixel Oracle.
 *
 *         Inherit from this contract and add `onlyWithSkill(...)` or
 *         `onlyWithReputation(...)` to any function. Verification is a single
 *         external call into the anchor; cost is ~5k + ~2k per Merkle level.
 *
 * Usage:
 * ```
 * contract MyVotingApp is SkillGate {
 *   constructor(IPixelOracleAnchor anchor) SkillGate(anchor) {}
 *
 *   function castVote(
 *       uint256 epochId,
 *       IPixelOracleAnchor.Credential calldata cred,
 *       bytes32[] calldata proof,
 *       bool[] calldata leftFlags,
 *       uint256 proposalId
 *   ) external onlyWithSkill(epochId, cred, proof, leftFlags, GOV_SKILL_ID) {
 *       ...
 *   }
 * }
 * ```
 */
abstract contract SkillGate {
    IPixelOracleAnchor public immutable pixelOracle;

    error UnauthorizedSkill(uint256 tokenId, bytes32 wanted);
    error UnauthorizedReputation(uint256 tokenId, uint256 want, uint256 got);
    error WrongTokenOwner(uint256 tokenId, address claimant, address actual);

    constructor(IPixelOracleAnchor _anchor) {
        require(address(_anchor) != address(0), "anchor=0");
        pixelOracle = _anchor;
    }

    /**
     * @notice Require that the caller holds the Normie that owns the
     *         attested credential, and that the credential is for the
     *         requested skill.
     */
    modifier onlyWithSkill(
        uint256 epochId,
        IPixelOracleAnchor.Credential calldata c,
        bytes32[] calldata proof,
        bool[] calldata leftFlags,
        bytes32 requiredSkillId
    ) {
        if (c.skillId != requiredSkillId) revert UnauthorizedSkill(c.tokenId, requiredSkillId);
        if (!pixelOracle.verifyCredential(epochId, c, proof, leftFlags)) {
            revert UnauthorizedSkill(c.tokenId, requiredSkillId);
        }
        _;
    }

    /// @notice Require that the attested reputation score meets a minimum.
    modifier onlyWithReputation(
        uint256 epochId,
        IPixelOracleAnchor.Reputation calldata r,
        bytes32[] calldata proof,
        bool[] calldata leftFlags,
        uint256 minScore
    ) {
        if (r.score < minScore) revert UnauthorizedReputation(r.tokenId, minScore, r.score);
        if (!pixelOracle.verifyReputation(epochId, r, proof, leftFlags)) {
            revert UnauthorizedReputation(r.tokenId, minScore, r.score);
        }
        _;
    }

    /**
     * @notice Convenience helper: bind the proof to the message sender by
     *         checking the Normie's owner equals `msg.sender`. Pass the
     *         Normies ERC-721 contract address.
     */
    function _enforceOwnership(address normiesContract, uint256 tokenId) internal view {
        (bool ok, bytes memory data) = normiesContract.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        require(ok && data.length == 32, "normies ownerOf failed");
        address owner = abi.decode(data, (address));
        if (owner != msg.sender) revert WrongTokenOwner(tokenId, msg.sender, owner);
    }
}
