// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SkillTypes} from "../libraries/SkillTypes.sol";

/// @title IAgentRegistry
/// @notice Interface for the SKILLAI AgentRegistry, an ERC-8004 Identity Registry compliant contract.
/// @dev Each agent is an ERC-721 NFT. The tokenId acts as canonical identity across
///      any ERC-8004 aware protocol (e.g. Moltbook, MoltMart).
interface IAgentRegistry {
    // =========================================================================
    //                              EVENTS
    // =========================================================================

    /// @notice ERC-8004 compliant event emitted when a new agent registers
    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed agent,
        string registrationFileURI,
        uint256 timestamp
    );

    /// @notice Emitted when an agent updates their registration file URI
    event AgentUpdated(
        uint256 indexed tokenId,
        address indexed agent,
        string registrationFileURI,
        uint256 timestamp
    );

    /// @notice Emitted when an agent is deactivated
    event AgentDeactivated(uint256 indexed tokenId, address indexed agent, uint256 timestamp);

    // =========================================================================
    //                         WRITE FUNCTIONS
    // =========================================================================

    /// @notice Register a new agent on the platform (ERC-8004 Identity)
    /// @param registrationFileURI ERC-8004 registration file URI (IPFS or HTTPS)
    /// @return tokenId The ERC-721 tokenId assigned to the new agent
    function registerAgent(string calldata registrationFileURI) external returns (uint256 tokenId);

    /// @notice Update an existing agent's registration file URI
    /// @param tokenId The agent's ERC-721 identity
    /// @param registrationFileURI New registration file URI
    function updateAgent(uint256 tokenId, string calldata registrationFileURI) external;

    /// @notice Deactivate an agent (callable by agent owner or admin)
    /// @param tokenId The agent's ERC-721 identity
    function deactivateAgent(uint256 tokenId) external;

    // =========================================================================
    //                         READ FUNCTIONS
    // =========================================================================

    /// @notice Check if an address controls a registered (active) agent
    /// @param agent Address to check
    /// @return True if the address owns at least one active agent NFT
    function isRegistered(address agent) external view returns (bool);

    /// @notice Check if a specific tokenId is a registered active agent
    /// @param tokenId The agent's ERC-721 identity
    function isAgentActive(uint256 tokenId) external view returns (bool);

    /// @notice Get the full profile of an agent by tokenId
    /// @param tokenId The agent's ERC-721 identity
    /// @return AgentProfile struct
    function getAgent(uint256 tokenId) external view returns (SkillTypes.AgentProfile memory);

    /// @notice Get the agent profile(s) owned by an address
    /// @param agent Address of the owner
    /// @return Array of tokenIds owned
    function getAgentsByOwner(address agent) external view returns (uint256[] memory);

    /// @notice Get the primary (first-registered) tokenId for an address
    /// @param agent Address of the owner
    /// @return tokenId Primary tokenId (0 if none)
    function getPrimaryTokenId(address agent) external view returns (uint256);

    /// @notice Get total number of registered agents (minted tokens, active or not)
    function totalAgents() external view returns (uint256);
}
