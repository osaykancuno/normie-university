// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}      from "@openzeppelin/contracts/utils/Pausable.sol";

import {IReputationEngine}   from "../interfaces/IReputationEngine.sol";
import {ISkillCredential}    from "../interfaces/ISkillCredential.sol";
import {ISkillRegistry}      from "../interfaces/ISkillRegistry.sol";
import {IAgentRegistry}      from "../interfaces/IAgentRegistry.sol";
import {IValidationRegistry} from "../interfaces/IValidationRegistry.sol";
import {SkillTypes}          from "../libraries/SkillTypes.sol";
import {SkillAI__ZeroAddress} from "../libraries/SkillTypes.sol";

/// @title  ReputationEngine
/// @author SKILLAI
/// @notice Reputation scoring engine for AI agents on SKILLAI.
///         Composable: any external protocol (Moltbook, DeFi apps) can read
///         the score permissionlessly and without trust assumptions.
///
/// @dev    Score is computed as a 0-10000 basis-point value, split into 5 factors:
///
///           Weight | Factor                 | Source
///           -------|------------------------|---------------------------------
///            30%   | Number of skills       | SkillCredential.getAgentSkills()
///            25%   | Avg skill level        | SkillCredential credentials
///            15%   | Category diversity     | SkillRegistry per-skill category
///            10%   | Time on platform       | AgentRegistry registeredAt
///            20%   | Avg verification score | SkillCredential.score + ValidationRegistry
///
///         Tiers: Novice(<2000) / Apprentice(<4000) / Skilled(<6000) /
///                Expert(<8000) / Master(>=8000)
contract ReputationEngine is IReputationEngine, AccessControl, Pausable {
    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // =========================================================================
    //                             CONSTANTS
    // =========================================================================

    /// @notice Total score cap in basis points
    uint256 public constant MAX_SCORE = 10_000;

    /// @notice Number of skills required to max out the "skill count" factor
    uint256 public constant SKILL_COUNT_CAP = 10;

    /// @notice Seconds that max-out the "time on platform" factor (~1 year)
    uint256 public constant TIME_ON_PLATFORM_CAP = 365 days;

    /// @notice Number of distinct categories in the enum (see SkillTypes.Category)
    uint256 public constant CATEGORY_COUNT = 8;

    // Weights (basis points, sum to MAX_SCORE)
    uint256 public constant W_SKILL_COUNT  = 3_000;
    uint256 public constant W_AVG_LEVEL    = 2_500;
    uint256 public constant W_DIVERSITY    = 1_500;
    uint256 public constant W_TIME         = 1_000;
    uint256 public constant W_VERIFY_SCORE = 2_000;

    // =========================================================================
    //                             IMMUTABLES
    // =========================================================================

    ISkillCredential    public immutable skillCredential;
    ISkillRegistry      public immutable skillRegistry;
    IAgentRegistry      public immutable agentRegistry;
    IValidationRegistry public immutable validationRegistry;

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    /// @notice Cached reputation per agent
    mapping(address => SkillTypes.ReputationData) private _reputations;

    /// @notice All agents that have ever had reputation computed (for leaderboard)
    address[] private _trackedAgents;
    mapping(address => bool) private _isTracked;

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    constructor(
        address admin_,
        address skillCredential_,
        address skillRegistry_,
        address agentRegistry_,
        address validationRegistry_
    ) {
        if (
            admin_ == address(0) ||
            skillCredential_ == address(0) ||
            skillRegistry_ == address(0) ||
            agentRegistry_ == address(0) ||
            validationRegistry_ == address(0)
        ) revert SkillAI__ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);

        skillCredential    = ISkillCredential(skillCredential_);
        skillRegistry      = ISkillRegistry(skillRegistry_);
        agentRegistry      = IAgentRegistry(agentRegistry_);
        validationRegistry = IValidationRegistry(validationRegistry_);
    }

    // =========================================================================
    //                         UPDATE REPUTATION
    // =========================================================================

    /// @inheritdoc IReputationEngine
    /// @dev Permissionless: anyone can trigger a recompute (Marketplace does it
    ///      after every completion). Cost stays bounded because the function
    ///      reads bounded arrays from SkillCredential.
    function updateReputation(address agent) external override whenNotPaused {
        if (agent == address(0)) revert SkillAI__ZeroAddress();

        SkillTypes.ReputationData memory prev = _reputations[agent];
        SkillTypes.ReputationData memory next = _computeReputation(agent);

        _reputations[agent] = next;

        if (!_isTracked[agent]) {
            _isTracked[agent] = true;
            _trackedAgents.push(agent);
        }

        emit ReputationUpdated(agent, prev.score, next.score, next.tier, block.timestamp);
    }

    // =========================================================================
    //                         VIEW FUNCTIONS
    // =========================================================================

    /// @inheritdoc IReputationEngine
    function getReputation(address agent) external view override returns (uint256) {
        return _reputations[agent].score;
    }

    /// @inheritdoc IReputationEngine
    function getReputationData(address agent)
        external
        view
        override
        returns (SkillTypes.ReputationData memory)
    {
        return _reputations[agent];
    }

    /// @inheritdoc IReputationEngine
    function getReputationTier(address agent)
        external
        view
        override
        returns (SkillTypes.ReputationTier)
    {
        return _reputations[agent].tier;
    }

    /// @notice Compute — but do NOT store — reputation for an agent.
    ///         Useful for off-chain previews and integration tests.
    function previewReputation(address agent)
        external
        view
        returns (SkillTypes.ReputationData memory)
    {
        return _computeReputation(agent);
    }

    /// @notice Total number of agents ever scored (size of leaderboard candidate set)
    function totalTrackedAgents() external view returns (uint256) {
        return _trackedAgents.length;
    }

    /// @inheritdoc IReputationEngine
    /// @dev Simple O(n*k) selection — fine for a view function, no gas cost.
    function getLeaderboard(uint256 n)
        external
        view
        override
        returns (address[] memory agents, uint256[] memory scores)
    {
        uint256 total = _trackedAgents.length;
        uint256 k = n > total ? total : n;

        agents = new address[](k);
        scores = new uint256[](k);

        // Copy tracked agents + scores into memory for ranking
        address[] memory pool = new address[](total);
        uint256[] memory pts  = new uint256[](total);
        for (uint256 i = 0; i < total; ++i) {
            address a = _trackedAgents[i];
            pool[i] = a;
            pts[i]  = _reputations[a].score;
        }

        // Select top-k
        for (uint256 i = 0; i < k; ++i) {
            uint256 bestIdx = i;
            for (uint256 j = i + 1; j < total; ++j) {
                if (pts[j] > pts[bestIdx]) bestIdx = j;
            }
            if (bestIdx != i) {
                (pool[i], pool[bestIdx]) = (pool[bestIdx], pool[i]);
                (pts[i],  pts[bestIdx])  = (pts[bestIdx],  pts[i]);
            }
            agents[i] = pool[i];
            scores[i] = pts[i];
        }
    }

    // =========================================================================
    //                         ADMIN FUNCTIONS
    // =========================================================================

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // =========================================================================
    //                         INTERNAL — SCORING
    // =========================================================================

    function _computeReputation(address agent)
        internal
        view
        returns (SkillTypes.ReputationData memory r)
    {
        uint256[] memory skillIds = skillCredential.getAgentSkills(agent);
        uint256 n = skillIds.length;

        r.skillCount  = n;
        r.lastUpdated = block.timestamp;

        if (n == 0) {
            r.tier = SkillTypes.ReputationTier.Novice;
            return r;
        }

        // --- Factor inputs (kept in a packed struct to keep stack shallow) ---
        (uint256 avgLevelX100, uint256 avgCred) = _aggregateCredentials(agent, n);
        uint256 distinct = _countCategories(skillIds);
        uint256 verify   = _blendVerify(agent, avgCred);
        uint256 timeOn   = _timeOnPlatform(agent);

        r.avgSkillLevel     = avgLevelX100;
        r.categoryDiversity = distinct;
        r.avgVerifyScore    = verify;

        uint256 total = _composeScore(n, avgLevelX100, distinct, timeOn, verify);
        r.score = total;
        r.tier  = _tierOf(total);
    }

    function _aggregateCredentials(address agent, uint256 n)
        internal
        view
        returns (uint256 avgLevelX100, uint256 avgCred)
    {
        uint256[] memory tokenIds = skillCredential.getAgentTokenIds(agent);
        uint256 levelSum = 0;
        uint256 credSum  = 0;
        for (uint256 i = 0; i < n; ++i) {
            SkillTypes.CredentialData memory c = skillCredential.getCredentialDetails(tokenIds[i]);
            levelSum += uint256(c.level);
            credSum  += c.score;
        }
        avgLevelX100 = (levelSum * 100) / n;
        avgCred      = credSum / n;
    }

    function _countCategories(uint256[] memory skillIds) internal view returns (uint256 distinct) {
        bool[CATEGORY_COUNT] memory seen;
        uint256 n = skillIds.length;
        for (uint256 i = 0; i < n; ++i) {
            SkillTypes.Skill memory sk = skillRegistry.getSkill(skillIds[i]);
            uint256 cat = uint256(uint8(sk.category));
            if (cat < CATEGORY_COUNT && !seen[cat]) {
                seen[cat] = true;
                ++distinct;
            }
        }
    }

    function _blendVerify(address agent, uint256 avgCred) internal view returns (uint256) {
        uint256 valN = validationRegistry.completedValidationsOf(agent);
        if (valN == 0) return avgCred;
        uint256 valAvg = validationRegistry.averageValidationScore(agent);
        return (avgCred + valAvg) / 2;
    }

    function _timeOnPlatform(address agent) internal view returns (uint256) {
        if (!agentRegistry.isRegistered(agent)) return 0;
        uint256 primaryTok = agentRegistry.getPrimaryTokenId(agent);
        SkillTypes.AgentProfile memory prof = agentRegistry.getAgent(primaryTok);
        if (block.timestamp <= prof.registeredAt) return 0;
        return block.timestamp - prof.registeredAt;
    }

    function _composeScore(
        uint256 n,
        uint256 avgLevelX100,
        uint256 distinct,
        uint256 timeOn,
        uint256 verify
    ) internal pure returns (uint256 total) {
        uint256 fCount = n >= SKILL_COUNT_CAP
            ? W_SKILL_COUNT
            : (n * W_SKILL_COUNT) / SKILL_COUNT_CAP;

        uint256 lvlNum = avgLevelX100 > 100 ? avgLevelX100 - 100 : 0;
        uint256 fLevel = (lvlNum * W_AVG_LEVEL) / 200;
        if (fLevel > W_AVG_LEVEL) fLevel = W_AVG_LEVEL;

        uint256 fDiv = (distinct * W_DIVERSITY) / CATEGORY_COUNT;

        uint256 fTime = timeOn >= TIME_ON_PLATFORM_CAP
            ? W_TIME
            : (timeOn * W_TIME) / TIME_ON_PLATFORM_CAP;

        uint256 fVerify = (verify * W_VERIFY_SCORE) / 100;

        total = fCount + fLevel + fDiv + fTime + fVerify;
        if (total > MAX_SCORE) total = MAX_SCORE;
    }

    function _tierOf(uint256 score) internal pure returns (SkillTypes.ReputationTier) {
        if (score >= 8_000) return SkillTypes.ReputationTier.Master;
        if (score >= 6_000) return SkillTypes.ReputationTier.Expert;
        if (score >= 4_000) return SkillTypes.ReputationTier.Skilled;
        if (score >= 2_000) return SkillTypes.ReputationTier.Apprentice;
        return SkillTypes.ReputationTier.Novice;
    }
}
