// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IPathRegistry}    from "../interfaces/IPathRegistry.sol";
import {ISkillRegistry}   from "../interfaces/ISkillRegistry.sol";
import {SkillTypes}       from "../libraries/SkillTypes.sol";
import {
    SkillAI__ZeroAddress,
    SkillAI__InsufficientPayment,
    SkillAI__WithdrawFailed,
    SkillAI__PathNotFound,
    SkillAI__PathNotActive,
    SkillAI__PathEmpty,
    SkillAI__InvalidDiscount,
    SkillAI__InvalidContentURI,
    SkillAI__SkillNotFound,
    SkillAI__SkillNotActive,
    SkillAI__UsdcNotConfigured,
    SkillAI__UsdcNotSupported
} from "../libraries/SkillTypes.sol";

/// @notice Minimal interface to the marketplace's path-aware purchase function.
interface IPathPurchaser {
    function purchaseSkillForPath(
        address agent,
        uint256 skillId,
        uint256 amount,
        bool paidInUsdc
    ) external;
}

/// @title  PathRegistry
/// @author SKILLAI
/// @notice Curated Learning Paths — bundles of skills sold at a discount.
///         The registry holds path definitions, computes the bundled price as
///         (sum of skill prices) × (1 - discountBps/10000), and dispatches
///         per-skill purchases to SkillMarketplace at a proportional rate.
/// @dev    v1: protocol-curated only (CREATOR_ROLE gated). v2 will open to
///         creators with a bond + review pipeline.
contract PathRegistry is
    IPathRegistry,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");

    // =========================================================================
    //                             CONSTANTS
    // =========================================================================

    uint16 public constant MAX_DISCOUNT_BPS = 5_000; // 50% max
    uint16 public constant BPS_DENOM        = 10_000;
    uint8  public constant MAX_SKILLS_PER_PATH = 12;

    // =========================================================================
    //                             IMMUTABLES
    // =========================================================================

    ISkillRegistry  public immutable skillRegistry;
    IPathPurchaser  public immutable marketplace;

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    address public usdcToken;

    uint256 private _nextPathId = 1;
    mapping(uint256 => Path) private _paths;

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    constructor(
        address admin_,
        address skillRegistry_,
        address marketplace_,
        address usdcToken_
    ) {
        if (admin_ == address(0) || skillRegistry_ == address(0) || marketplace_ == address(0)) {
            revert SkillAI__ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
        _grantRole(CREATOR_ROLE, admin_);

        skillRegistry = ISkillRegistry(skillRegistry_);
        marketplace   = IPathPurchaser(marketplace_);
        usdcToken     = usdcToken_;
    }

    // =========================================================================
    //                              CREATE
    // =========================================================================

    /// @inheritdoc IPathRegistry
    function createPath(PathParams calldata params)
        external
        override
        onlyRole(CREATOR_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256 pathId)
    {
        _validateParams(params);

        pathId = _nextPathId++;
        _paths[pathId] = Path({
            pathId: pathId,
            name: params.name,
            description: params.description,
            skillIds: params.skillIds,
            discountBps: params.discountBps,
            contentURI: params.contentURI,
            creator: msg.sender,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            isActive: true,
            totalPurchases: 0
        });

        emit PathCreated(
            pathId,
            msg.sender,
            params.name,
            params.skillIds,
            params.discountBps,
            block.timestamp
        );
    }

    /// @inheritdoc IPathRegistry
    function updatePath(uint256 pathId, PathParams calldata params)
        external
        override
        whenNotPaused
        nonReentrant
    {
        Path storage p = _paths[pathId];
        if (p.createdAt == 0) revert SkillAI__PathNotFound(pathId);
        if (msg.sender != p.creator && !hasRole(ADMIN_ROLE, msg.sender)) {
            // Only the original creator or an admin can update
            revert SkillAI__PathNotFound(pathId);
        }
        _validateParams(params);

        p.name = params.name;
        p.description = params.description;
        p.skillIds = params.skillIds;
        p.discountBps = params.discountBps;
        p.contentURI = params.contentURI;
        p.updatedAt = block.timestamp;

        emit PathUpdated(pathId, msg.sender, block.timestamp);
    }

    /// @inheritdoc IPathRegistry
    function deactivatePath(uint256 pathId)
        external
        override
        whenNotPaused
        nonReentrant
    {
        Path storage p = _paths[pathId];
        if (p.createdAt == 0) revert SkillAI__PathNotFound(pathId);
        if (msg.sender != p.creator && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert SkillAI__PathNotFound(pathId);
        }
        p.isActive = false;
        p.updatedAt = block.timestamp;
        emit PathDeactivated(pathId, block.timestamp);
    }

    // =========================================================================
    //                             PURCHASE
    // =========================================================================

    /// @inheritdoc IPathRegistry
    function purchasePath(uint256 pathId)
        external
        payable
        override
        nonReentrant
        whenNotPaused
    {
        Path memory p = _activePath(pathId);
        (uint256 totalEth, ) = _sumPrices(p.skillIds);
        if (totalEth == 0) revert SkillAI__UsdcNotSupported(pathId);

        uint256 priceEth = _applyDiscount(totalEth, p.discountBps);
        if (msg.value < priceEth) revert SkillAI__InsufficientPayment(msg.value, priceEth);

        // Distribute proportionally to each skill (rounding-dust collected on the last skill)
        uint256 paidSoFar = 0;
        uint256 n = p.skillIds.length;
        for (uint256 i = 0; i < n; ++i) {
            SkillTypes.Skill memory sk = skillRegistry.getSkill(p.skillIds[i]);
            uint256 share = (i == n - 1)
                ? (priceEth - paidSoFar)
                : (priceEth * sk.priceInWei) / totalEth;
            paidSoFar += share;

            // Forward the share to the marketplace which records the purchase
            (bool ok, ) = payable(address(marketplace)).call{value: share}("");
            if (!ok) revert SkillAI__WithdrawFailed();

            marketplace.purchaseSkillForPath(msg.sender, p.skillIds[i], share, false);
        }

        // Refund overpayment
        if (msg.value > priceEth) {
            uint256 refund = msg.value - priceEth;
            (bool okR, ) = payable(msg.sender).call{value: refund}("");
            if (!okR) revert SkillAI__WithdrawFailed();
        }

        _paths[pathId].totalPurchases += 1;
        emit PathPurchased(msg.sender, pathId, priceEth, false, block.timestamp);
    }

    /// @inheritdoc IPathRegistry
    function purchasePathWithUsdc(uint256 pathId)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (usdcToken == address(0)) revert SkillAI__UsdcNotConfigured();
        Path memory p = _activePath(pathId);
        (, uint256 totalUsdc) = _sumPrices(p.skillIds);
        if (totalUsdc == 0) revert SkillAI__UsdcNotSupported(pathId);

        uint256 priceUsdc = _applyDiscount(totalUsdc, p.discountBps);
        IERC20 token = IERC20(usdcToken);

        // Pull bundle price from buyer to this contract first.
        token.safeTransferFrom(msg.sender, address(this), priceUsdc);

        uint256 paidSoFar = 0;
        uint256 n = p.skillIds.length;
        for (uint256 i = 0; i < n; ++i) {
            SkillTypes.Skill memory sk = skillRegistry.getSkill(p.skillIds[i]);
            uint256 share = (i == n - 1)
                ? (priceUsdc - paidSoFar)
                : (priceUsdc * sk.priceInUsdc) / totalUsdc;
            paidSoFar += share;

            // Forward the share to the marketplace
            token.safeTransfer(address(marketplace), share);
            marketplace.purchaseSkillForPath(msg.sender, p.skillIds[i], share, true);
        }

        _paths[pathId].totalPurchases += 1;
        emit PathPurchased(msg.sender, pathId, priceUsdc, true, block.timestamp);
    }

    // =========================================================================
    //                              ADMIN
    // =========================================================================

    function setUsdcToken(address token) external onlyRole(ADMIN_ROLE) {
        if (usdcToken != address(0) && !paused()) revert SkillAI__UsdcNotConfigured();
        usdcToken = token;
    }

    function grantCreatorRole(address creator) external onlyRole(ADMIN_ROLE) {
        if (creator == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(CREATOR_ROLE, creator);
    }

    function revokeCreatorRole(address creator) external onlyRole(ADMIN_ROLE) {
        _revokeRole(CREATOR_ROLE, creator);
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // =========================================================================
    //                              VIEW
    // =========================================================================

    /// @inheritdoc IPathRegistry
    function getPath(uint256 pathId) external view override returns (Path memory) {
        Path memory p = _paths[pathId];
        if (p.createdAt == 0) revert SkillAI__PathNotFound(pathId);
        return p;
    }

    /// @inheritdoc IPathRegistry
    function getPathPriceInWei(uint256 pathId) external view override returns (uint256) {
        Path memory p = _paths[pathId];
        if (p.createdAt == 0) revert SkillAI__PathNotFound(pathId);
        (uint256 totalEth, ) = _sumPrices(p.skillIds);
        return _applyDiscount(totalEth, p.discountBps);
    }

    /// @inheritdoc IPathRegistry
    function getPathPriceInUsdc(uint256 pathId) external view override returns (uint256) {
        Path memory p = _paths[pathId];
        if (p.createdAt == 0) revert SkillAI__PathNotFound(pathId);
        (, uint256 totalUsdc) = _sumPrices(p.skillIds);
        return _applyDiscount(totalUsdc, p.discountBps);
    }

    /// @inheritdoc IPathRegistry
    function totalPaths() external view override returns (uint256) {
        return _nextPathId - 1;
    }

    // =========================================================================
    //                            INTERNAL
    // =========================================================================

    function _validateParams(PathParams calldata params) internal view {
        if (bytes(params.name).length == 0) revert SkillAI__InvalidContentURI();
        if (params.skillIds.length == 0) revert SkillAI__PathEmpty();
        if (params.skillIds.length > MAX_SKILLS_PER_PATH) revert SkillAI__PathEmpty();
        if (params.discountBps > MAX_DISCOUNT_BPS) revert SkillAI__InvalidDiscount(params.discountBps);

        // Every referenced skill must exist + be active
        for (uint256 i = 0; i < params.skillIds.length; ++i) {
            uint256 id = params.skillIds[i];
            SkillTypes.Skill memory sk = skillRegistry.getSkill(id);
            if (sk.skillId == 0) revert SkillAI__SkillNotFound(id);
            if (!sk.isActive) revert SkillAI__SkillNotActive(id);
        }
    }

    function _activePath(uint256 pathId) internal view returns (Path memory p) {
        p = _paths[pathId];
        if (p.createdAt == 0) revert SkillAI__PathNotFound(pathId);
        if (!p.isActive) revert SkillAI__PathNotActive(pathId);
    }

    function _sumPrices(uint256[] memory skillIds)
        internal
        view
        returns (uint256 totalEth, uint256 totalUsdc)
    {
        for (uint256 i = 0; i < skillIds.length; ++i) {
            SkillTypes.Skill memory sk = skillRegistry.getSkill(skillIds[i]);
            totalEth  += sk.priceInWei;
            totalUsdc += sk.priceInUsdc;
        }
    }

    function _applyDiscount(uint256 amount, uint16 discountBps)
        internal
        pure
        returns (uint256)
    {
        return (amount * (BPS_DENOM - discountBps)) / BPS_DENOM;
    }
}
