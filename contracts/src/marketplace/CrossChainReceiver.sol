// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISkillMarketplace} from "../interfaces/ISkillMarketplace.sol";
import {
    SkillAI__ZeroAddress,
    SkillAI__InsufficientPayment,
    SkillAI__WithdrawFailed
} from "../libraries/SkillTypes.sol";

/// @title  CrossChainReceiver
/// @author SKILLAI
/// @notice Bridge-agnostic entry point that lets agents buy SKILLAI skills from
///         any chain with ERC-8004-aware infra (Ethereum L1, Optimism, Arbitrum,
///         Polygon, Solana via Wormhole, etc.) and have the credential minted on Base.
/// @dev    This contract is deliberately bridge-agnostic: it trusts any address
///         granted the `BRIDGE_ROLE`. In production we plug in:
///           - LayerZero v2 OApp (calls `handleCrossChainPurchase` from lzReceive)
///           - Axelar (via AxelarExecutable adapter)
///           - CCIP (via Chainlink router adapter)
///         Each adapter is a thin wrapper granted BRIDGE_ROLE at deploy time,
///         so we never couple the core flow to a single bridge vendor — a
///         critical property given the cross-chain landscape churn.
contract CrossChainReceiver is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // =========================================================================
    //                             IMMUTABLES
    // =========================================================================

    ISkillMarketplace public immutable marketplace;

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    /// @notice USDC token on this chain (Base). Must match the one the marketplace uses.
    address public usdcToken;

    /// @notice Lifetime inbound ETH volume
    uint256 public totalInboundEth;
    /// @notice Lifetime inbound USDC volume
    uint256 public totalInboundUsdc;

    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event CrossChainPurchaseReceived(
        address indexed onBehalfOf,
        uint256 indexed skillId,
        uint32 indexed srcChainId,
        uint256 amount,
        bool paidInUsdc,
        bytes32 nonce
    );

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    constructor(address admin_, address marketplace_, address usdcToken_) {
        if (admin_ == address(0) || marketplace_ == address(0)) {
            revert SkillAI__ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        marketplace = ISkillMarketplace(marketplace_);
        usdcToken   = usdcToken_;
    }

    // =========================================================================
    //                      CROSS-CHAIN PURCHASE ENTRY
    // =========================================================================

    /// @notice Handle a cross-chain purchase delivered by an authorized bridge.
    /// @dev    The bridge is expected to have already delivered the matching funds
    ///         to this contract (native ETH via msg.value, or USDC via prior
    ///         transfer in the same bundle).
    /// @param onBehalfOf The agent address on Base who will own the credential
    /// @param skillId    The skill being purchased
    /// @param amount     Exact amount transferred for this purchase
    /// @param paidInUsdc True if USDC was transferred, false if native ETH
    /// @param srcChainId Source chain id (for telemetry — LZ EID, CCIP selector, etc.)
    /// @param nonce      Bridge-specific unique id (replay protection is done by the bridge)
    function handleCrossChainPurchase(
        address onBehalfOf,
        uint256 skillId,
        uint256 amount,
        bool paidInUsdc,
        uint32 srcChainId,
        bytes32 nonce
    )
        external
        payable
        onlyRole(BRIDGE_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (onBehalfOf == address(0)) revert SkillAI__ZeroAddress();

        if (paidInUsdc) {
            if (usdcToken == address(0)) revert SkillAI__ZeroAddress();
            // USDC must already be in this contract; forward it to marketplace.
            IERC20(usdcToken).safeTransfer(address(marketplace), amount);
            totalInboundUsdc += amount;
        } else {
            if (msg.value < amount) revert SkillAI__InsufficientPayment(msg.value, amount);
            (bool ok, ) = payable(address(marketplace)).call{value: amount}("");
            if (!ok) revert SkillAI__WithdrawFailed();
            totalInboundEth += amount;
        }

        marketplace.purchaseSkillCrossChain(onBehalfOf, skillId, amount, paidInUsdc);

        emit CrossChainPurchaseReceived(onBehalfOf, skillId, srcChainId, amount, paidInUsdc, nonce);
    }

    // =========================================================================
    //                         ADMIN FUNCTIONS
    // =========================================================================

    function setUsdcToken(address token) external onlyRole(ADMIN_ROLE) {
        usdcToken = token;
    }

    function grantBridgeRole(address bridge) external onlyRole(ADMIN_ROLE) {
        if (bridge == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(BRIDGE_ROLE, bridge);
    }

    function revokeBridgeRole(address bridge) external onlyRole(ADMIN_ROLE) {
        _revokeRole(BRIDGE_ROLE, bridge);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Rescue tokens accidentally sent here (stuck bridge remnants, airdrops, etc.)
    function rescueErc20(address token, address to, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (token == address(0) || to == address(0)) revert SkillAI__ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueEth(address payable to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (to == address(0)) revert SkillAI__ZeroAddress();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert SkillAI__WithdrawFailed();
    }

    receive() external payable {}
}
