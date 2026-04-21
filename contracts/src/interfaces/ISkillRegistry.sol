// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SkillTypes} from "../libraries/SkillTypes.sol";

/// @title ISkillRegistry
/// @notice Interface for the SkillRegistry contract
interface ISkillRegistry {
    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event SkillCreated(uint256 indexed skillId, address indexed creator, string name, uint256 timestamp);
    event SkillUpdated(uint256 indexed skillId, address indexed creator, uint256 timestamp);
    event SkillDeactivated(uint256 indexed skillId, address indexed by, uint256 timestamp);
    event SkillPurchaseRecorded(uint256 indexed skillId, uint256 totalPurchases);
    event SkillCompletionRecorded(uint256 indexed skillId, uint256 totalCompletions);
    event SkillRated(uint256 indexed skillId, address indexed rater, uint8 rating);

    // =========================================================================
    //                         WRITE FUNCTIONS
    // =========================================================================

    /// @notice Create and register a new skill on the platform
    /// @param params Skill creation parameters
    /// @return skillId The ID assigned to the new skill
    function createSkill(SkillTypes.SkillParams calldata params) external returns (uint256 skillId);

    /// @notice Update an existing skill (only creator or admin)
    /// @param skillId ID of the skill to update
    /// @param params Updated parameters
    function updateSkill(uint256 skillId, SkillTypes.SkillParams calldata params) external;

    /// @notice Deactivate a skill (only creator or admin)
    /// @param skillId ID of the skill to deactivate
    function deactivateSkill(uint256 skillId) external;

    /// @notice Record a purchase (callable only by Marketplace)
    /// @param skillId ID of the purchased skill
    function recordPurchase(uint256 skillId) external;

    /// @notice Record a completion (callable only by Marketplace)
    /// @param skillId ID of the completed skill
    function recordCompletion(uint256 skillId) external;

    /// @notice Rate a skill (only agents who completed it)
    /// @param skillId ID of the skill
    /// @param rating Rating between 1 and 5
    function rateSkill(uint256 skillId, uint8 rating) external;

    // =========================================================================
    //                         READ FUNCTIONS
    // =========================================================================

    /// @notice Get a skill by ID
    /// @param skillId ID of the skill
    /// @return Skill struct
    function getSkill(uint256 skillId) external view returns (SkillTypes.Skill memory);

    /// @notice Check if a skill exists and is active
    /// @param skillId ID to check
    function isSkillActive(uint256 skillId) external view returns (bool);

    /// @notice Get all skills by category
    /// @param category Category to filter by
    /// @return Array of skill IDs
    function getSkillsByCategory(SkillTypes.Category category) external view returns (uint256[] memory);

    /// @notice Get all skills created by a specific address
    /// @param creator Creator address
    /// @return Array of skill IDs
    function getSkillsByCreator(address creator) external view returns (uint256[] memory);

    /// @notice Get total number of skills ever created
    function totalSkills() external view returns (uint256);

    /// @notice Get the average rating for a skill (scaled by 100, e.g. 450 = 4.5)
    /// @param skillId ID of the skill
    function getAverageRating(uint256 skillId) external view returns (uint256);
}
