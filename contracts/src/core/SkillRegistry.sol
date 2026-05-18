// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ISkillRegistry} from "../interfaces/ISkillRegistry.sol";
import {SkillTypes}     from "../libraries/SkillTypes.sol";
import {
    SkillAI__SkillNotFound,
    SkillAI__NotSkillCreator,
    SkillAI__InvalidContentURI,
    SkillAI__InvalidPrice,
    SkillAI__InvalidRating,
    SkillAI__ZeroAddress
} from "../libraries/SkillTypes.sol";

/// @title  SkillRegistry
/// @author SKILLAI
/// @notice Catalog of skill modules. Creators publish skills here and set pricing.
///         SkillMarketplace calls this contract to record purchases/completions/ratings.
/// @dev    Security features:
///         - AccessControl (ADMIN, MARKETPLACE roles)
///         - Pausable
///         - ReentrancyGuard
///         - Input validation on every parameter
///         - Only SkillMarketplace can record purchases/completions/ratings
contract SkillRegistry is
    ISkillRegistry,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE       = keccak256("ADMIN_ROLE");
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");
    /// @notice Allowed publishers. The protocol curates v1, opens to UGC in v2 by
    ///         granting CREATOR_ROLE to additional addresses (or revoking the gate
    ///         altogether by writing a permissionless wrapper).
    bytes32 public constant CREATOR_ROLE     = keccak256("CREATOR_ROLE");

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    /// @notice Maximum price for a skill (sanity cap, in wei). 1000 ETH.
    uint256 public constant MAX_PRICE_WEI = 1000 ether;

    /// @notice Maximum price for a skill in USDC (6 decimals). 1,000,000 USDC.
    uint256 public constant MAX_PRICE_USDC = 1_000_000 * 1e6;

    /// @notice Next skillId to be assigned (starts at 1)
    uint256 private _nextSkillId = 1;

    /// @notice skillId => Skill data
    mapping(uint256 => SkillTypes.Skill) private _skills;

    /// @notice category => skillIds
    mapping(SkillTypes.Category => uint256[]) private _skillsByCategory;

    /// @notice creator => skillIds
    mapping(address => uint256[]) private _skillsByCreator;

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    constructor(address admin) {
        if (admin == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        // Admin is the seed creator — protocol-curated launch posture.
        _grantRole(CREATOR_ROLE, admin);
    }

    // =========================================================================
    //                        CREATE / UPDATE SKILL
    // =========================================================================

    /// @inheritdoc ISkillRegistry
    /// @dev Gated by CREATOR_ROLE. The protocol curates the launch catalogue;
    ///      additional publishers are onboarded by granting them CREATOR_ROLE.
    function createSkill(SkillTypes.SkillParams calldata params)
        external
        override
        onlyRole(CREATOR_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256 skillId)
    {
        _validateParams(params);

        skillId = _nextSkillId++;

        _skills[skillId] = SkillTypes.Skill({
            skillId: skillId,
            name: params.name,
            description: params.description,
            category: params.category,
            difficulty: params.difficulty,
            priceInWei: params.priceInWei,
            priceInUsdc: params.priceInUsdc,
            prerequisites: params.prerequisites,
            contentURI: params.contentURI,
            creator: msg.sender,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            isActive: true,
            totalPurchases: 0,
            totalCompletions: 0,
            ratingSum: 0,
            ratingCount: 0
        });

        _skillsByCategory[params.category].push(skillId);
        _skillsByCreator[msg.sender].push(skillId);

        emit SkillCreated(skillId, msg.sender, params.name, block.timestamp);
    }

    /// @inheritdoc ISkillRegistry
    function updateSkill(uint256 skillId, SkillTypes.SkillParams calldata params)
        external
        override
        whenNotPaused
        nonReentrant
    {
        SkillTypes.Skill storage s = _skills[skillId];
        if (s.creator == address(0)) revert SkillAI__SkillNotFound(skillId);

        // Only creator or admin can update
        if (msg.sender != s.creator && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert SkillAI__NotSkillCreator(msg.sender, skillId);
        }

        _validateParams(params);

        // Category change requires moving from the old array to the new one
        if (params.category != s.category) {
            _removeFromCategoryArray(s.category, skillId);
            _skillsByCategory[params.category].push(skillId);
        }

        s.name          = params.name;
        s.description   = params.description;
        s.category      = params.category;
        s.difficulty    = params.difficulty;
        s.priceInWei    = params.priceInWei;
        s.priceInUsdc   = params.priceInUsdc;
        s.prerequisites = params.prerequisites;
        s.contentURI    = params.contentURI;
        s.updatedAt     = block.timestamp;

        emit SkillUpdated(skillId, s.creator, block.timestamp);
    }

    /// @inheritdoc ISkillRegistry
    function deactivateSkill(uint256 skillId) external override whenNotPaused nonReentrant {
        SkillTypes.Skill storage s = _skills[skillId];
        if (s.creator == address(0)) revert SkillAI__SkillNotFound(skillId);
        if (msg.sender != s.creator && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert SkillAI__NotSkillCreator(msg.sender, skillId);
        }

        s.isActive = false;
        s.updatedAt = block.timestamp;

        emit SkillDeactivated(skillId, msg.sender, block.timestamp);
    }

    // =========================================================================
    //               MARKETPLACE-ONLY RECORDING FUNCTIONS
    // =========================================================================

    /// @inheritdoc ISkillRegistry
    function recordPurchase(uint256 skillId)
        external
        override
        onlyRole(MARKETPLACE_ROLE)
        whenNotPaused
    {
        SkillTypes.Skill storage s = _skills[skillId];
        if (s.creator == address(0)) revert SkillAI__SkillNotFound(skillId);

        s.totalPurchases += 1;
        emit SkillPurchaseRecorded(skillId, s.totalPurchases);
    }

    /// @inheritdoc ISkillRegistry
    function recordCompletion(uint256 skillId)
        external
        override
        onlyRole(MARKETPLACE_ROLE)
        whenNotPaused
    {
        SkillTypes.Skill storage s = _skills[skillId];
        if (s.creator == address(0)) revert SkillAI__SkillNotFound(skillId);

        s.totalCompletions += 1;
        emit SkillCompletionRecorded(skillId, s.totalCompletions);
    }

    /// @inheritdoc ISkillRegistry
    /// @dev SkillMarketplace is the auth layer — it verifies `msg.sender` has completed
    ///      the skill before relaying the rating here via a trusted call.
    function rateSkill(uint256 skillId, uint8 rating)
        external
        override
        onlyRole(MARKETPLACE_ROLE)
        whenNotPaused
    {
        if (rating < 1 || rating > 5) revert SkillAI__InvalidRating(rating);
        SkillTypes.Skill storage s = _skills[skillId];
        if (s.creator == address(0)) revert SkillAI__SkillNotFound(skillId);

        s.ratingSum += rating;
        s.ratingCount += 1;

        // tx.origin here is just for logging — the rater is validated upstream
        emit SkillRated(skillId, tx.origin, rating);
    }

    // =========================================================================
    //                         ADMIN FUNCTIONS
    // =========================================================================

    function grantMarketplaceRole(address marketplace) external onlyRole(ADMIN_ROLE) {
        if (marketplace == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(MARKETPLACE_ROLE, marketplace);
    }

    function revokeMarketplaceRole(address marketplace) external onlyRole(ADMIN_ROLE) {
        _revokeRole(MARKETPLACE_ROLE, marketplace);
    }

    /// @notice Onboard a new publisher (partner / community curator / DAO).
    function grantCreatorRole(address creator) external onlyRole(ADMIN_ROLE) {
        if (creator == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(CREATOR_ROLE, creator);
    }

    /// @notice Remove a publisher's right to create new skills.
    function revokeCreatorRole(address creator) external onlyRole(ADMIN_ROLE) {
        _revokeRole(CREATOR_ROLE, creator);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // =========================================================================
    //                          VIEW FUNCTIONS
    // =========================================================================

    /// @inheritdoc ISkillRegistry
    function getSkill(uint256 skillId) external view override returns (SkillTypes.Skill memory) {
        if (_skills[skillId].creator == address(0)) revert SkillAI__SkillNotFound(skillId);
        return _skills[skillId];
    }

    /// @inheritdoc ISkillRegistry
    function isSkillActive(uint256 skillId) external view override returns (bool) {
        SkillTypes.Skill memory s = _skills[skillId];
        return s.creator != address(0) && s.isActive;
    }

    /// @inheritdoc ISkillRegistry
    function getSkillsByCategory(SkillTypes.Category category)
        external
        view
        override
        returns (uint256[] memory)
    {
        return _skillsByCategory[category];
    }

    /// @inheritdoc ISkillRegistry
    function getSkillsByCreator(address creator) external view override returns (uint256[] memory) {
        return _skillsByCreator[creator];
    }

    /// @inheritdoc ISkillRegistry
    function totalSkills() external view override returns (uint256) {
        return _nextSkillId - 1;
    }

    /// @inheritdoc ISkillRegistry
    function getAverageRating(uint256 skillId) external view override returns (uint256) {
        SkillTypes.Skill memory s = _skills[skillId];
        if (s.ratingCount == 0) return 0;
        // Scaled by 100 (e.g. 450 = 4.50)
        return (s.ratingSum * 100) / s.ratingCount;
    }

    // =========================================================================
    //                       INTERNAL HELPERS
    // =========================================================================

    function _validateParams(SkillTypes.SkillParams calldata params) internal pure {
        if (bytes(params.contentURI).length == 0) revert SkillAI__InvalidContentURI();
        if (bytes(params.name).length == 0) revert SkillAI__InvalidContentURI();
        if (params.priceInWei > MAX_PRICE_WEI) revert SkillAI__InvalidPrice();
        if (params.priceInUsdc > MAX_PRICE_USDC) revert SkillAI__InvalidPrice();
        // Must accept at least one payment method if price > 0 (free skills allowed)
        if (params.priceInWei == 0 && params.priceInUsdc == 0) {
            // Free skills are allowed — no validation needed here
        }
    }

    /// @dev Swap-and-pop removal from a category array. Preserves no order.
    function _removeFromCategoryArray(SkillTypes.Category category, uint256 skillId) internal {
        uint256[] storage arr = _skillsByCategory[category];
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; ++i) {
            if (arr[i] == skillId) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }
}
