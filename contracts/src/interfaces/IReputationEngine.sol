// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SkillTypes} from "../libraries/SkillTypes.sol";

/// @title IReputationEngine
/// @notice Interface for the ReputationEngine contract.
///         Any on-chain protocol can query agent reputation without permission.
interface IReputationEngine {
    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event ReputationUpdated(
        address indexed agent,
        uint256 oldScore,
        uint256 newScore,
        SkillTypes.ReputationTier tier,
        uint256 timestamp
    );

    // =========================================================================
    //                         WRITE FUNCTIONS
    // =========================================================================

    /// @notice Trigger a reputation recalculation for an agent
    ///         Callable by anyone (Marketplace calls it automatically on completion)
    /// @param agent Address of the agent
    function updateReputation(address agent) external;

    // =========================================================================
    //                         READ FUNCTIONS
    // =========================================================================

    /// @notice Get the current reputation score of an agent (0-10000)
    /// @param agent Address of the agent
    /// @return score Reputation score in basis points
    function getReputation(address agent) external view returns (uint256 score);

    /// @notice Get full reputation data for an agent
    /// @param agent Address of the agent
    /// @return ReputationData struct
    function getReputationData(address agent) external view returns (SkillTypes.ReputationData memory);

    /// @notice Get the reputation tier of an agent
    /// @param agent Address of the agent
    /// @return tier Enum value of the tier
    function getReputationTier(address agent) external view returns (SkillTypes.ReputationTier tier);

    /// @notice Get the top N agents by reputation score
    /// @param n Number of top agents to return
    /// @return agents Array of agent addresses
    /// @return scores Array of corresponding scores
    function getLeaderboard(uint256 n) external view returns (address[] memory agents, uint256[] memory scores);
}
