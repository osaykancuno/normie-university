// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SkillTypes} from "../libraries/SkillTypes.sol";

/// @title ISkillMarketplace
/// @notice Interface for the SkillMarketplace contract
interface ISkillMarketplace {
    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event SkillPurchased(
        address indexed agent,
        uint256 indexed skillId,
        uint256 amount,
        bool paidInUsdc,
        uint256 timestamp
    );

    event SkillCompleted(
        address indexed agent,
        uint256 indexed skillId,
        uint8 level,
        uint256 score,
        uint256 timestamp
    );

    event RevenueDistributed(
        uint256 indexed skillId,
        address indexed creator,
        uint256 creatorShare,
        uint256 protocolShare,
        uint256 reserveShare
    );

    event PurchaseRefunded(
        address indexed agent,
        uint256 indexed skillId,
        uint256 amount,
        uint256 timestamp
    );

    // =========================================================================
    //                         WRITE FUNCTIONS
    // =========================================================================

    /// @notice Purchase a skill with ETH
    /// @param skillId ID of the skill to purchase
    function purchaseSkill(uint256 skillId) external payable;

    /// @notice Purchase a skill with USDC
    /// @param skillId ID of the skill to purchase
    function purchaseSkillWithUsdc(uint256 skillId) external;

    /// @notice Complete a skill and submit proof (off-chain signed verification)
    /// @param skillId   ID of the skill to complete
    /// @param level     Achieved level (1-3)
    /// @param score     Achieved score (0-100)
    /// @param signature ECDSA signature from authorized verifier
    function completeSkill(
        uint256 skillId,
        uint8 level,
        uint256 score,
        bytes calldata signature
    ) external;

    /// @notice Request a refund for an unfinished skill (after 30 days)
    /// @param skillId ID of the skill to refund
    function requestRefund(uint256 skillId) external;

    // =========================================================================
    //                         READ FUNCTIONS
    // =========================================================================

    /// @notice Check if an agent has purchased a skill
    function hasPurchased(address agent, uint256 skillId) external view returns (bool);

    /// @notice Check if an agent has completed a skill
    function hasCompleted(address agent, uint256 skillId) external view returns (bool);

    /// @notice Get purchase record for an agent + skill
    function getPurchase(address agent, uint256 skillId) external view returns (SkillTypes.Purchase memory);

    /// @notice Get the USDC token address used for payments
    function usdcTokenAddress() external view returns (address);

    /// @notice Get total platform revenue collected (in wei)
    function totalProtocolRevenue() external view returns (uint256);
}
