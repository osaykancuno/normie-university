// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SkillTypes} from "../libraries/SkillTypes.sol";

/// @title ISkillCredential
/// @notice Interface for the SkillCredential (Soulbound NFT) contract
interface ISkillCredential {
    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event CredentialMinted(
        uint256 indexed tokenId,
        address indexed agent,
        uint256 indexed skillId,
        uint8 level,
        uint256 score,
        uint256 timestamp
    );

    // =========================================================================
    //                         WRITE FUNCTIONS
    // =========================================================================

    /// @notice Mint a skill credential to an agent (callable only by Marketplace)
    /// @param agent     Address of the agent receiving the credential
    /// @param skillId   ID of the acquired skill
    /// @param level     Completion level: 1 = Base, 2 = Advanced, 3 = Expert
    /// @param score     Verification score 0-100
    /// @return tokenId  The minted token ID
    function mintCredential(
        address agent,
        uint256 skillId,
        uint8 level,
        uint256 score
    ) external returns (uint256 tokenId);

    // =========================================================================
    //                         READ FUNCTIONS
    // =========================================================================

    /// @notice Check if an agent holds a credential for a specific skill
    /// @param agent   Agent address
    /// @param skillId Skill ID
    /// @return True if the agent has a credential for this skill
    function hasSkill(address agent, uint256 skillId) external view returns (bool);

    /// @notice Get all skill IDs (credentials) held by an agent
    /// @param agent Agent address
    /// @return Array of skill IDs
    function getAgentSkills(address agent) external view returns (uint256[] memory);

    /// @notice Get all token IDs held by an agent
    /// @param agent Agent address
    /// @return Array of token IDs
    function getAgentTokenIds(address agent) external view returns (uint256[] memory);

    /// @notice Get credential details by token ID
    /// @param tokenId The ERC-721 token ID
    /// @return CredentialData struct
    function getCredentialDetails(uint256 tokenId) external view returns (SkillTypes.CredentialData memory);

    /// @notice Get credential for a specific agent + skill combination
    /// @param agent   Agent address
    /// @param skillId Skill ID
    /// @return CredentialData struct (reverts if not found)
    function getAgentSkillCredential(address agent, uint256 skillId) external view returns (SkillTypes.CredentialData memory);

    /// @notice Total number of credentials minted
    function totalCredentials() external view returns (uint256);
}
