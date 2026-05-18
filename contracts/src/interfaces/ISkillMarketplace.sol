// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SkillTypes} from "../libraries/SkillTypes.sol";

/// @title ISkillMarketplace
/// @notice Interface for the SkillMarketplace contract
/// @dev Supports three payment rails:
///      1. Native ETH (on Base L2)
///      2. USDC via ERC-20 approve + transferFrom
///      3. USDC via EIP-3009 `transferWithAuthorization` (x402 HTTP 402 compatible — Moltbook / MoltMart)
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

    event SkillRated(
        address indexed agent,
        uint256 indexed skillId,
        uint8 rating,
        uint256 timestamp
    );

    // =========================================================================
    //                         WRITE FUNCTIONS
    // =========================================================================

    /// @notice Purchase a skill with ETH
    function purchaseSkill(uint256 skillId) external payable;

    /// @notice Purchase a skill with USDC (requires prior ERC-20 approve)
    function purchaseSkillWithUsdc(uint256 skillId) external;

    /// @notice Purchase a skill with USDC using EIP-3009 transferWithAuthorization (x402-compatible)
    /// @dev    The payer signs off-chain. The marketplace then pulls the signed authorization
    ///         from USDC in a single transaction — no prior approval needed.
    function purchaseSkillWithAuthorization(
        uint256 skillId,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @notice Purchase a skill on behalf of an agent — used by trusted cross-chain bridges.
    /// @dev    Restricted to CROSS_CHAIN_ROLE. Funds must already have landed in the
    ///         marketplace before this call (LayerZero receiver takes care of that).
    function purchaseSkillCrossChain(
        address onBehalfOf,
        uint256 skillId,
        uint256 amount,
        bool paidInUsdc
    ) external;

    /// @notice Complete a skill (agent submits proof signed by an off-chain VERIFIER)
    function completeSkill(
        uint256 skillId,
        uint8 level,
        uint256 score,
        bytes calldata signature
    ) external;

    /// @notice Relayed variant of completeSkill — anyone (typically a relayer
    ///         paying gas for an x402-style agent flow) can submit a verifier
    ///         signature on behalf of `agent`. The signature payload is bound
    ///         to `agent`, so authority comes from the verifier, not from
    ///         msg.sender. The credential mints to `agent`, the reputation
    ///         updates for `agent`, and the rating-allowlist tracks `agent`.
    function completeSkillFor(
        address agent,
        uint256 skillId,
        uint8 level,
        uint256 score,
        bytes calldata signature
    ) external;

    /// @notice Request a refund for an unfinished skill (after REFUND_WINDOW)
    function requestRefund(uint256 skillId) external;

    /// @notice Rate a completed skill (1-5)
    function rateSkill(uint256 skillId, uint8 rating) external;

    // =========================================================================
    //                         READ FUNCTIONS
    // =========================================================================

    function hasPurchased(address agent, uint256 skillId) external view returns (bool);
    function hasCompleted(address agent, uint256 skillId) external view returns (bool);
    function getPurchase(address agent, uint256 skillId) external view returns (SkillTypes.Purchase memory);
    function usdcTokenAddress() external view returns (address);
    function totalProtocolRevenue() external view returns (uint256);
}

/// @notice Minimal EIP-3009 interface used to pull USDC with an off-chain authorization.
///         This is the primitive that powers x402 payments (Moltbook / MoltMart flow).
interface IERC3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
