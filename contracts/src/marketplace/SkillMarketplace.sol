// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA}           from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {ISkillMarketplace, IERC3009} from "../interfaces/ISkillMarketplace.sol";
import {ISkillRegistry}              from "../interfaces/ISkillRegistry.sol";
import {ISkillCredential}            from "../interfaces/ISkillCredential.sol";
import {IReputationEngine}           from "../interfaces/IReputationEngine.sol";
import {SkillTypes}                  from "../libraries/SkillTypes.sol";
import {
    SkillAI__ZeroAddress,
    SkillAI__SkillNotFound,
    SkillAI__SkillNotActive,
    SkillAI__PrerequisiteNotMet,
    SkillAI__InsufficientPayment,
    SkillAI__AlreadyPurchased,
    SkillAI__AlreadyCompleted,
    SkillAI__PurchaseNotFound,
    SkillAI__NotCompleted,
    SkillAI__AlreadyRated,
    SkillAI__InvalidRating,
    SkillAI__InvalidScore,
    SkillAI__InvalidLevel,
    SkillAI__InvalidSignature,
    SkillAI__UsdcNotSupported,
    SkillAI__UsdcNotConfigured,
    SkillAI__RefundNotReady,
    SkillAI__WithdrawFailed
} from "../libraries/SkillTypes.sol";

/// @title  SkillMarketplace
/// @author SKILLAI
/// @notice Central marketplace for agent skill purchases on SKILLAI.
/// @dev    Supports three payment rails (ETH, USDC approve, USDC EIP-3009/x402),
///         escrow until completion, refunds after 30 days, revenue split
///         70% creator / 20% protocol / 10% reserve. Orchestrates minting of
///         the Soulbound credential and triggers reputation recomputation.
contract SkillMarketplace is
    ISkillMarketplace,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20     for IERC20;
    using ECDSA         for bytes32;
    using MessageHashUtils for bytes32;

    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE       = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE    = keccak256("VERIFIER_ROLE");
    bytes32 public constant CROSS_CHAIN_ROLE = keccak256("CROSS_CHAIN_ROLE");
    /// @notice Granted to a trusted PathRegistry contract that bundles skills
    ///         into discounted Learning Paths. The path registry has already
    ///         received funds from the agent and dispatches per-skill purchases
    ///         at a proportional rate (lower than the regular skill price).
    bytes32 public constant PATH_ROLE        = keccak256("PATH_ROLE");
    /// @notice Granted to a trusted server-side account (relayer + Normie-
    ///         ownership verifier) that can record gifted skill acquisitions
    ///         at amount=0 — used for first-time onboarding sponsorship.
    ///         The role can ONLY record amount=0 purchases (enforced in
    ///         sponsorFirstSkill); it has no other capabilities.
    bytes32 public constant SPONSOR_ROLE     = keccak256("SPONSOR_ROLE");

    // =========================================================================
    //                             CONSTANTS
    // =========================================================================

    uint256 public constant CREATOR_BPS  = 7_000; // 70%
    uint256 public constant PROTOCOL_BPS = 2_000; // 20%
    uint256 public constant RESERVE_BPS  = 1_000; // 10%
    uint256 public constant BPS_DENOM    = 10_000;

    uint256 public constant REFUND_WINDOW = 30 days;

    // =========================================================================
    //                             IMMUTABLES
    // =========================================================================

    ISkillRegistry   public immutable skillRegistry;
    ISkillCredential public immutable skillCredential;
    address          public immutable treasury;

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    /// @notice USDC token (EIP-3009 compliant on Base). 0x0 disables USDC payments.
    address public usdcToken;

    /// @notice Reputation engine (optional — can be set later)
    IReputationEngine public reputationEngine;

    /// @notice agent => skillId => Purchase record
    mapping(address => mapping(uint256 => SkillTypes.Purchase)) private _purchases;

    /// @notice agent => skillId => has rated?
    mapping(address => mapping(uint256 => bool)) private _hasRated;

    /// @notice Lifetime revenue sent to the protocol (treasury) in ETH wei
    uint256 public totalProtocolRevenueEth;

    /// @notice Lifetime revenue sent to the protocol (treasury) in USDC units
    uint256 public totalProtocolRevenueUsdc;

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    constructor(
        address admin_,
        address skillRegistry_,
        address skillCredential_,
        address treasury_,
        address usdcToken_ // may be address(0) at deploy, set later
    ) {
        if (
            admin_ == address(0) ||
            skillRegistry_ == address(0) ||
            skillCredential_ == address(0) ||
            treasury_ == address(0)
        ) revert SkillAI__ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        skillRegistry   = ISkillRegistry(skillRegistry_);
        skillCredential = ISkillCredential(skillCredential_);
        treasury        = treasury_;
        usdcToken       = usdcToken_;
    }

    // =========================================================================
    //                         PURCHASE (ETH)
    // =========================================================================

    /// @inheritdoc ISkillMarketplace
    function purchaseSkill(uint256 skillId)
        external
        payable
        override
        nonReentrant
        whenNotPaused
    {
        SkillTypes.Skill memory sk = _fetchActiveSkill(skillId);
        if (msg.value < sk.priceInWei) {
            revert SkillAI__InsufficientPayment(msg.value, sk.priceInWei);
        }

        _preCheck(msg.sender, skillId);

        _recordPurchase(msg.sender, skillId, msg.value, false);

        // Refund any overpayment to caller
        if (msg.value > sk.priceInWei) {
            uint256 refund = msg.value - sk.priceInWei;
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            if (!ok) revert SkillAI__WithdrawFailed();
        }

        skillRegistry.recordPurchase(skillId);
        emit SkillPurchased(msg.sender, skillId, sk.priceInWei, false, block.timestamp);
    }

    // =========================================================================
    //                         PURCHASE (USDC — approve)
    // =========================================================================

    /// @inheritdoc ISkillMarketplace
    function purchaseSkillWithUsdc(uint256 skillId)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (usdcToken == address(0)) revert SkillAI__UsdcNotConfigured();

        SkillTypes.Skill memory sk = _fetchActiveSkill(skillId);
        if (sk.priceInUsdc == 0) revert SkillAI__UsdcNotSupported(skillId);

        _preCheck(msg.sender, skillId);

        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), sk.priceInUsdc);
        _recordPurchase(msg.sender, skillId, sk.priceInUsdc, true);

        skillRegistry.recordPurchase(skillId);
        emit SkillPurchased(msg.sender, skillId, sk.priceInUsdc, true, block.timestamp);
    }

    // =========================================================================
    //                      PURCHASE (USDC — EIP-3009 / x402)
    // =========================================================================

    /// @inheritdoc ISkillMarketplace
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
    ) external override nonReentrant whenNotPaused {
        if (usdcToken == address(0)) revert SkillAI__UsdcNotConfigured();

        SkillTypes.Skill memory sk = _fetchActiveSkill(skillId);
        if (sk.priceInUsdc == 0) revert SkillAI__UsdcNotSupported(skillId);
        if (value < sk.priceInUsdc) {
            revert SkillAI__InsufficientPayment(value, sk.priceInUsdc);
        }

        _preCheck(from, skillId);

        // Pull USDC via EIP-3009. The authorization binds `from` → `address(this)`
        // for exactly `value`, so we are safe against replay or redirection.
        IERC3009(usdcToken).receiveWithAuthorization(
            from,
            address(this),
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        _recordPurchase(from, skillId, value, true);
        skillRegistry.recordPurchase(skillId);
        emit SkillPurchased(from, skillId, value, true, block.timestamp);
    }

    // =========================================================================
    //                    PURCHASE (CROSS-CHAIN)
    // =========================================================================

    /// @notice Record a sponsored first-skill purchase for `agent` at zero
    ///         price. Only callable by SPONSOR_ROLE — typically a server-side
    ///         relayer that has verified the agent qualifies (e.g. Normie
    ///         holder, first-time user). Mints no funds, records the purchase
    ///         so the agent can then complete the skill and earn the SBT.
    function sponsorFirstSkill(address agent, uint256 skillId)
        external
        onlyRole(SPONSOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (agent == address(0)) revert SkillAI__ZeroAddress();
        _fetchActiveSkill(skillId);
        _preCheck(agent, skillId);
        _recordPurchase(agent, skillId, 0, false);
        skillRegistry.recordPurchase(skillId);
        emit SkillPurchased(agent, skillId, 0, false, block.timestamp);
    }

    /// @notice Record a path-bundled skill purchase. Only the trusted
    ///         PathRegistry can call this. The registry has already received
    ///         the bundled price and computes the proportional `amount` to
    ///         attribute to this skill (and so to its creator). Funds must be
    ///         already at this contract's address before the call.
    function purchaseSkillForPath(
        address agent,
        uint256 skillId,
        uint256 amount,
        bool paidInUsdc
    ) external onlyRole(PATH_ROLE) nonReentrant whenNotPaused {
        if (agent == address(0)) revert SkillAI__ZeroAddress();
        SkillTypes.Skill memory sk = _fetchActiveSkill(skillId);
        if (paidInUsdc && sk.priceInUsdc == 0) revert SkillAI__UsdcNotSupported(skillId);

        _preCheck(agent, skillId);
        _recordPurchase(agent, skillId, amount, paidInUsdc);
        skillRegistry.recordPurchase(skillId);
        emit SkillPurchased(agent, skillId, amount, paidInUsdc, block.timestamp);
    }

    /// @inheritdoc ISkillMarketplace
    /// @dev Called by the trusted CrossChainReceiver after funds have been
    ///      delivered via LayerZero. The receiver is responsible for moving
    ///      the funds into this contract BEFORE calling.
    function purchaseSkillCrossChain(
        address onBehalfOf,
        uint256 skillId,
        uint256 amount,
        bool paidInUsdc
    ) external override onlyRole(CROSS_CHAIN_ROLE) nonReentrant whenNotPaused {
        if (onBehalfOf == address(0)) revert SkillAI__ZeroAddress();

        SkillTypes.Skill memory sk = _fetchActiveSkill(skillId);
        uint256 required = paidInUsdc ? sk.priceInUsdc : sk.priceInWei;
        if (required == 0) {
            if (paidInUsdc) revert SkillAI__UsdcNotSupported(skillId);
        }
        if (amount < required) revert SkillAI__InsufficientPayment(amount, required);

        _preCheck(onBehalfOf, skillId);
        _recordPurchase(onBehalfOf, skillId, amount, paidInUsdc);
        skillRegistry.recordPurchase(skillId);
        emit SkillPurchased(onBehalfOf, skillId, amount, paidInUsdc, block.timestamp);
    }

    // =========================================================================
    //                            COMPLETE
    // =========================================================================

    /// @inheritdoc ISkillMarketplace
    function completeSkill(
        uint256 skillId,
        uint8 level,
        uint256 score,
        bytes calldata signature
    ) external override nonReentrant whenNotPaused {
        _completeFor(msg.sender, skillId, level, score, signature);
    }

    /// @inheritdoc ISkillMarketplace
    function completeSkillFor(
        address agent,
        uint256 skillId,
        uint8 level,
        uint256 score,
        bytes calldata signature
    ) external override nonReentrant whenNotPaused {
        if (agent == address(0)) revert SkillAI__ZeroAddress();
        _completeFor(agent, skillId, level, score, signature);
    }

    function _completeFor(
        address agent,
        uint256 skillId,
        uint8 level,
        uint256 score,
        bytes calldata signature
    ) internal {
        SkillTypes.Purchase storage p = _purchases[agent][skillId];
        if (p.purchasedAt == 0) revert SkillAI__PurchaseNotFound(agent, skillId);
        if (p.completed) revert SkillAI__AlreadyCompleted(agent, skillId);
        if (p.refunded) revert SkillAI__PurchaseNotFound(agent, skillId);
        if (level < 1 || level > 3) revert SkillAI__InvalidLevel(level);
        if (score > 100) revert SkillAI__InvalidScore(score);

        // Verify signature: signed(agent, skillId, level, score, chainId, marketplace).
        // The verifier signature binds the agent address, so msg.sender is irrelevant.
        bytes32 payload = keccak256(
            abi.encodePacked(agent, skillId, level, score, block.chainid, address(this))
        );
        address signer = payload.toEthSignedMessageHash().recover(signature);
        if (!hasRole(VERIFIER_ROLE, signer)) revert SkillAI__InvalidSignature();

        p.completed = true;

        // Mint the Soulbound credential to the agent
        skillCredential.mintCredential(agent, skillId, level, score);

        // Record completion stats
        skillRegistry.recordCompletion(skillId);

        // Distribute escrowed payment
        _distribute(skillId, p.amountPaid, p.paidInUsdc);

        // Best-effort reputation update (reverts are swallowed to not brick completion)
        if (address(reputationEngine) != address(0)) {
            try reputationEngine.updateReputation(agent) {} catch {}
        }

        emit SkillCompleted(agent, skillId, level, score, block.timestamp);
    }

    // =========================================================================
    //                            REFUND
    // =========================================================================

    /// @inheritdoc ISkillMarketplace
    function requestRefund(uint256 skillId) external override nonReentrant whenNotPaused {
        SkillTypes.Purchase storage p = _purchases[msg.sender][skillId];
        if (p.purchasedAt == 0 || p.refunded) {
            revert SkillAI__PurchaseNotFound(msg.sender, skillId);
        }
        if (p.completed) revert SkillAI__AlreadyCompleted(msg.sender, skillId);

        uint256 availableAt = p.purchasedAt + REFUND_WINDOW;
        if (block.timestamp < availableAt) revert SkillAI__RefundNotReady(availableAt);

        p.refunded = true;
        uint256 amount = p.amountPaid;

        if (p.paidInUsdc) {
            IERC20(usdcToken).safeTransfer(msg.sender, amount);
        } else {
            (bool ok, ) = payable(msg.sender).call{value: amount}("");
            if (!ok) revert SkillAI__WithdrawFailed();
        }

        emit PurchaseRefunded(msg.sender, skillId, amount, block.timestamp);
    }

    // =========================================================================
    //                            RATE
    // =========================================================================

    /// @inheritdoc ISkillMarketplace
    function rateSkill(uint256 skillId, uint8 rating) external override whenNotPaused {
        if (rating < 1 || rating > 5) revert SkillAI__InvalidRating(rating);

        SkillTypes.Purchase memory p = _purchases[msg.sender][skillId];
        if (!p.completed) revert SkillAI__NotCompleted(msg.sender, skillId);
        if (_hasRated[msg.sender][skillId]) revert SkillAI__AlreadyRated(msg.sender, skillId);

        _hasRated[msg.sender][skillId] = true;
        skillRegistry.rateSkill(skillId, rating);

        emit SkillRated(msg.sender, skillId, rating, block.timestamp);
    }

    // =========================================================================
    //                         ADMIN FUNCTIONS
    // =========================================================================

    /// @notice Set or replace the USDC token address used for escrow.
    /// @dev    SECURITY: Once set, the token can only be changed while the
    ///         contract is paused. This prevents a silent token swap that
    ///         would corrupt the (token, amount) accounting of in-flight
    ///         purchases. To migrate USDC: pause -> wait for refund window /
    ///         drain -> setUsdcToken -> unpause. Setting from zero (initial
    ///         configuration) is allowed without pause.
    function setUsdcToken(address token) external onlyRole(ADMIN_ROLE) {
        if (usdcToken != address(0) && !paused()) {
            revert SkillAI__UsdcNotConfigured();
        }
        usdcToken = token; // address(0) allowed to disable
    }

    function setReputationEngine(address engine) external onlyRole(ADMIN_ROLE) {
        reputationEngine = IReputationEngine(engine);
    }

    function grantVerifierRole(address verifier) external onlyRole(ADMIN_ROLE) {
        if (verifier == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(VERIFIER_ROLE, verifier);
    }

    function revokeVerifierRole(address verifier) external onlyRole(ADMIN_ROLE) {
        _revokeRole(VERIFIER_ROLE, verifier);
    }

    function grantCrossChainRole(address receiver) external onlyRole(ADMIN_ROLE) {
        if (receiver == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(CROSS_CHAIN_ROLE, receiver);
    }

    function revokeCrossChainRole(address receiver) external onlyRole(ADMIN_ROLE) {
        _revokeRole(CROSS_CHAIN_ROLE, receiver);
    }

    function grantPathRole(address registry) external onlyRole(ADMIN_ROLE) {
        if (registry == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(PATH_ROLE, registry);
    }

    function revokePathRole(address registry) external onlyRole(ADMIN_ROLE) {
        _revokeRole(PATH_ROLE, registry);
    }

    function grantSponsorRole(address sponsor) external onlyRole(ADMIN_ROLE) {
        if (sponsor == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(SPONSOR_ROLE, sponsor);
    }

    function revokeSponsorRole(address sponsor) external onlyRole(ADMIN_ROLE) {
        _revokeRole(SPONSOR_ROLE, sponsor);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // =========================================================================
    //                         VIEW FUNCTIONS
    // =========================================================================

    /// @inheritdoc ISkillMarketplace
    function hasPurchased(address agent, uint256 skillId) external view override returns (bool) {
        SkillTypes.Purchase memory p = _purchases[agent][skillId];
        return p.purchasedAt != 0 && !p.refunded;
    }

    /// @inheritdoc ISkillMarketplace
    function hasCompleted(address agent, uint256 skillId) external view override returns (bool) {
        return _purchases[agent][skillId].completed;
    }

    /// @inheritdoc ISkillMarketplace
    function getPurchase(address agent, uint256 skillId)
        external
        view
        override
        returns (SkillTypes.Purchase memory)
    {
        SkillTypes.Purchase memory p = _purchases[agent][skillId];
        p.agent = agent;
        p.skillId = skillId;
        return p;
    }

    /// @inheritdoc ISkillMarketplace
    function usdcTokenAddress() external view override returns (address) {
        return usdcToken;
    }

    /// @inheritdoc ISkillMarketplace
    function totalProtocolRevenue() external view override returns (uint256) {
        return totalProtocolRevenueEth;
    }

    // =========================================================================
    //                         INTERNAL HELPERS
    // =========================================================================

    function _fetchActiveSkill(uint256 skillId) internal view returns (SkillTypes.Skill memory sk) {
        sk = skillRegistry.getSkill(skillId);
        if (sk.skillId == 0) revert SkillAI__SkillNotFound(skillId);
        if (!sk.isActive) revert SkillAI__SkillNotActive(skillId);
    }

    function _preCheck(address agent, uint256 skillId) internal view {
        SkillTypes.Purchase memory existing = _purchases[agent][skillId];
        if (existing.purchasedAt != 0 && !existing.refunded) {
            revert SkillAI__AlreadyPurchased(agent, skillId);
        }

        // Prerequisites: agent must own credentials for every prereq skillId
        uint256[] memory prereqs = skillRegistry.getSkill(skillId).prerequisites;
        for (uint256 i = 0; i < prereqs.length; ++i) {
            if (!skillCredential.hasSkill(agent, prereqs[i])) {
                revert SkillAI__PrerequisiteNotMet(prereqs[i]);
            }
        }
    }

    function _recordPurchase(
        address agent,
        uint256 skillId,
        uint256 amount,
        bool paidInUsdc
    ) internal {
        _purchases[agent][skillId] = SkillTypes.Purchase({
            agent:       agent,
            skillId:     skillId,
            amountPaid:  amount,
            paidInUsdc:  paidInUsdc,
            purchasedAt: block.timestamp,
            completed:   false,
            refunded:    false
        });
    }

    function _distribute(uint256 skillId, uint256 amount, bool paidInUsdc) internal {
        SkillTypes.Skill memory sk = skillRegistry.getSkill(skillId);
        address creator = sk.creator;

        uint256 creatorShare  = (amount * CREATOR_BPS)  / BPS_DENOM;
        uint256 protocolShare = (amount * PROTOCOL_BPS) / BPS_DENOM;
        // Remainder goes to the reserve (also collected by the treasury).
        // Using subtraction instead of separate division avoids rounding-dust loss.
        uint256 reserveShare  = amount - creatorShare - protocolShare;
        uint256 treasuryShare = protocolShare + reserveShare;

        if (paidInUsdc) {
            IERC20(usdcToken).safeTransfer(creator, creatorShare);
            IERC20(usdcToken).safeTransfer(treasury, treasuryShare);
            totalProtocolRevenueUsdc += treasuryShare;
        } else {
            (bool ok1, ) = payable(creator).call{value: creatorShare}("");
            if (!ok1) revert SkillAI__WithdrawFailed();
            (bool ok2, ) = payable(treasury).call{value: treasuryShare}("");
            if (!ok2) revert SkillAI__WithdrawFailed();
            totalProtocolRevenueEth += treasuryShare;
        }

        emit RevenueDistributed(skillId, creator, creatorShare, protocolShare, reserveShare);
    }

    // Allow direct ETH transfers (e.g. from the cross-chain receiver)
    receive() external payable {}
}
