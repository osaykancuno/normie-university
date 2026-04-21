// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SkillTypes} from "../libraries/SkillTypes.sol";

/// @title IAgentRegistry
/// @notice Interface for the AgentRegistry contract
interface IAgentRegistry {
    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event AgentRegistered(address indexed agent, string metadataURI, uint256 timestamp);
    event AgentUpdated(address indexed agent, string metadataURI, uint256 timestamp);
    event AgentDeactivated(address indexed agent, uint256 timestamp);

    // =========================================================================
    //                         WRITE FUNCTIONS
    // =========================================================================

    /// @notice Register a new agent on the platform
    /// @param metadataURI IPFS URI pointing to agent metadata JSON
    function registerAgent(string calldata metadataURI) external;

    /// @notice Update an existing agent's metadata
    /// @param metadataURI New IPFS URI
    function updateAgent(string calldata metadataURI) external;

    /// @notice Deactivate an agent (callable by agent or admin)
    /// @param agent Address of the agent to deactivate
    function deactivateAgent(address agent) external;

    // =========================================================================
    //                         READ FUNCTIONS
    // =========================================================================

    /// @notice Check if an address is a registered (active) agent
    /// @param agent Address to check
    /// @return True if registered and active
    function isRegistered(address agent) external view returns (bool);

    /// @notice Get the full profile of an agent
    /// @param agent Address of the agent
    /// @return AgentProfile struct
    function getAgent(address agent) external view returns (SkillTypes.AgentProfile memory);

    /// @notice Get total number of registered agents
    function totalAgents() external view returns (uint256);
}
