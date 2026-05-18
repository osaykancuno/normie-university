// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721}         from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl}  from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}       from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712}         from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA}          from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {ISkillCredential} from "../interfaces/ISkillCredential.sol";
import {SkillTypes}       from "../libraries/SkillTypes.sol";
import {
    SkillAI__TransferNotAllowed,
    SkillAI__ZeroAddress,
    SkillAI__AlreadyCompleted,
    SkillAI__InvalidScore,
    SkillAI__InvalidLevel,
    SkillAI__SkillNotFound,
    SkillAI__InvalidSignature
} from "../libraries/SkillTypes.sol";

/// @title  SkillCredential
/// @author SKILLAI
/// @notice ERC-721 Soulbound Token representing a skill credential earned by an agent.
///         Non-transferable — once minted, stays with the agent forever (or until burned by admin).
/// @dev    Security:
///         - Transfer/approve functions revert (Soulbound)
///         - Only Marketplace can mint (MARKETPLACE_ROLE)
///         - One credential per (agent, skillId) pair
///         - Burnable by admin only (emergency)
contract SkillCredential is
    ISkillCredential,
    ERC721,
    AccessControl,
    Pausable,
    EIP712
{
    using ECDSA for bytes32;

    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE          = keccak256("ADMIN_ROLE");
    bytes32 public constant MARKETPLACE_ROLE    = keccak256("MARKETPLACE_ROLE");
    /// @notice Off-chain attestation signer. The server holds this key and
    ///         issues EIP-712 attestations after verifying skill completion.
    ///         Users redeem attestations via `mintFromAttestation`, paying
    ///         their own gas. This is the L1 cost-optimisation: skill
    ///         purchases and completions are free for the user; only the
    ///         explicit on-chain commit costs gas.
    bytes32 public constant ATTESTATION_SIGNER  = keccak256("ATTESTATION_SIGNER");

    /// @dev EIP-712 typehash for a completion attestation.
    bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
        "SkillAttestation(address agent,uint256 skillId,uint8 level,uint256 score,uint256 deadline)"
    );

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    /// @notice Next tokenId to mint (starts at 1)
    uint256 private _nextTokenId = 1;

    /// @notice tokenId => CredentialData
    mapping(uint256 => SkillTypes.CredentialData) private _credentials;

    /// @notice agent => skillId => tokenId (0 if no credential)
    mapping(address => mapping(uint256 => uint256)) private _agentSkillToToken;

    /// @notice agent => array of tokenIds owned
    mapping(address => uint256[]) private _agentTokenIds;

    /// @notice agent => array of skillIds acquired
    mapping(address => uint256[]) private _agentSkillIds;

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    constructor(address admin)
        ERC721("SKILLAI Credential", "SCRED")
        EIP712("SKILLAI Credential", "1")
    {
        if (admin == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // =========================================================================
    //                              MINT
    // =========================================================================

    /// @inheritdoc ISkillCredential
    function mintCredential(address agent, uint256 skillId, uint8 level, uint256 score)
        external
        override
        onlyRole(MARKETPLACE_ROLE)
        whenNotPaused
        returns (uint256 tokenId)
    {
        if (agent == address(0)) revert SkillAI__ZeroAddress();
        if (skillId == 0) revert SkillAI__SkillNotFound(skillId);
        if (level < 1 || level > 3) revert SkillAI__InvalidLevel(level);
        if (score > 100) revert SkillAI__InvalidScore(score);
        if (_agentSkillToToken[agent][skillId] != 0) {
            revert SkillAI__AlreadyCompleted(agent, skillId);
        }

        tokenId = _nextTokenId++;
        _safeMint(agent, tokenId);

        _credentials[tokenId] = SkillTypes.CredentialData({
            tokenId: tokenId,
            agent: agent,
            skillId: skillId,
            level: level,
            score: score,
            acquiredAt: block.timestamp,
            verified: true
        });

        _agentSkillToToken[agent][skillId] = tokenId;
        _agentTokenIds[agent].push(tokenId);
        _agentSkillIds[agent].push(skillId);

        emit CredentialMinted(tokenId, agent, skillId, level, score, block.timestamp);
    }

    // =========================================================================
    //                    LAZY MINT (EIP-712 attestation)
    // =========================================================================

    /// @notice Mint a credential by redeeming a server-signed EIP-712 attestation.
    /// @dev    L1 cost optimisation: after off-chain x402 purchase + verifier
    ///         attestation, the user (or anyone on their behalf) can submit
    ///         the attestation on-chain. The signature must come from an
    ///         address with ATTESTATION_SIGNER role. The credential is minted
    ///         to `agent` (the address the attestation binds to), regardless
    ///         of who submits the tx.
    function mintFromAttestation(
        address agent,
        uint256 skillId,
        uint8 level,
        uint256 score,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused returns (uint256 tokenId) {
        if (agent == address(0)) revert SkillAI__ZeroAddress();
        if (block.timestamp > deadline) revert SkillAI__InvalidSignature();
        if (skillId == 0) revert SkillAI__SkillNotFound(skillId);
        if (level < 1 || level > 3) revert SkillAI__InvalidLevel(level);
        if (score > 100) revert SkillAI__InvalidScore(score);
        if (_agentSkillToToken[agent][skillId] != 0) {
            revert SkillAI__AlreadyCompleted(agent, skillId);
        }

        bytes32 structHash = keccak256(abi.encode(
            ATTESTATION_TYPEHASH, agent, skillId, level, score, deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        if (!hasRole(ATTESTATION_SIGNER, signer)) revert SkillAI__InvalidSignature();

        tokenId = _nextTokenId++;
        _safeMint(agent, tokenId);
        _credentials[tokenId] = SkillTypes.CredentialData({
            tokenId: tokenId,
            agent: agent,
            skillId: skillId,
            level: level,
            score: score,
            acquiredAt: block.timestamp,
            verified: true
        });
        _agentSkillToToken[agent][skillId] = tokenId;
        _agentTokenIds[agent].push(tokenId);
        _agentSkillIds[agent].push(skillId);

        emit CredentialMinted(tokenId, agent, skillId, level, score, block.timestamp);
    }

    // =========================================================================
    //                    SOULBOUND — TRANSFER BLOCKED
    // =========================================================================

    /// @notice Transfers are permanently disabled for Soulbound credentials
    function transferFrom(address, address, uint256)
        public
        pure
        override(ERC721)
    {
        revert SkillAI__TransferNotAllowed();
    }

    /// @notice Safe transfers are permanently disabled for Soulbound credentials
    function safeTransferFrom(address, address, uint256, bytes memory)
        public
        pure
        override(ERC721)
    {
        revert SkillAI__TransferNotAllowed();
    }

    /// @notice Approvals don't make sense for Soulbound tokens
    function approve(address, uint256) public pure override(ERC721) {
        revert SkillAI__TransferNotAllowed();
    }

    /// @notice Approval-for-all also disabled
    function setApprovalForAll(address, bool) public pure override(ERC721) {
        revert SkillAI__TransferNotAllowed();
    }

    // =========================================================================
    //                         ADMIN FUNCTIONS
    // =========================================================================

    /// @notice Grant marketplace role (e.g., after deploying marketplace contract)
    function grantAttestationSigner(address signer) external onlyRole(ADMIN_ROLE) {
        if (signer == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(ATTESTATION_SIGNER, signer);
    }

    function revokeAttestationSigner(address signer) external onlyRole(ADMIN_ROLE) {
        _revokeRole(ATTESTATION_SIGNER, signer);
    }

    function grantMarketplaceRole(address marketplace) external onlyRole(ADMIN_ROLE) {
        if (marketplace == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(MARKETPLACE_ROLE, marketplace);
    }

    /// @notice Revoke marketplace role
    function revokeMarketplaceRole(address marketplace) external onlyRole(ADMIN_ROLE) {
        _revokeRole(MARKETPLACE_ROLE, marketplace);
    }

    /// @notice Emergency burn a credential (e.g., fraud detected)
    function adminBurn(uint256 tokenId) external onlyRole(ADMIN_ROLE) {
        address holder = ownerOf(tokenId);
        SkillTypes.CredentialData memory data = _credentials[tokenId];

        _burn(tokenId);

        // Clean up storage
        delete _agentSkillToToken[holder][data.skillId];
        delete _credentials[tokenId];

        _removeFromArray(_agentTokenIds[holder], tokenId);
        _removeFromArray(_agentSkillIds[holder], data.skillId);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // =========================================================================
    //                          VIEW FUNCTIONS
    // =========================================================================

    /// @inheritdoc ISkillCredential
    function hasSkill(address agent, uint256 skillId) external view override returns (bool) {
        return _agentSkillToToken[agent][skillId] != 0;
    }

    /// @inheritdoc ISkillCredential
    function getAgentSkills(address agent) external view override returns (uint256[] memory) {
        return _agentSkillIds[agent];
    }

    /// @inheritdoc ISkillCredential
    function getAgentTokenIds(address agent) external view override returns (uint256[] memory) {
        return _agentTokenIds[agent];
    }

    /// @inheritdoc ISkillCredential
    function getCredentialDetails(uint256 tokenId)
        external
        view
        override
        returns (SkillTypes.CredentialData memory)
    {
        if (_ownerOf(tokenId) == address(0)) revert SkillAI__SkillNotFound(tokenId);
        return _credentials[tokenId];
    }

    /// @inheritdoc ISkillCredential
    function getAgentSkillCredential(address agent, uint256 skillId)
        external
        view
        override
        returns (SkillTypes.CredentialData memory)
    {
        uint256 tokenId = _agentSkillToToken[agent][skillId];
        if (tokenId == 0) revert SkillAI__SkillNotFound(skillId);
        return _credentials[tokenId];
    }

    /// @inheritdoc ISkillCredential
    function totalCredentials() external view override returns (uint256) {
        return _nextTokenId - 1;
    }

    // =========================================================================
    //                       INTERNAL HELPERS
    // =========================================================================

    function _removeFromArray(uint256[] storage arr, uint256 value) internal {
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; ++i) {
            if (arr[i] == value) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }

    /// @dev Required by AccessControl + ERC721
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
