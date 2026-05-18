// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}      from "@openzeppelin/contracts/utils/Pausable.sol";

import {IValidationRegistry} from "../interfaces/IValidationRegistry.sol";
import {
    SkillAI__ZeroAddress,
    SkillAI__ValidationNotRequested,
    SkillAI__ValidationAlreadyCompleted,
    SkillAI__NotRequestedValidator,
    SkillAI__ValidatorNotAuthorized,
    SkillAI__InvalidValidationResponse
} from "../libraries/SkillTypes.sol";

/// @title  ValidationRegistry
/// @author SKILLAI
/// @notice ERC-8004 compliant Validation Registry.
///         Stores third-party attestations about agent skill execution so that
///         any external protocol can build on top of SKILLAI's reputation.
/// @dev    Roles:
///         - ADMIN_ROLE:     can authorize/revoke validators and pause
///         - VALIDATOR_ROLE: addresses allowed to be the recipient of a
///                           `validationRequest` and submit `validationResponse`
///         Anyone can CREATE a request (typically the Marketplace after a
///         purchase completes) but only the requested validator can RESPOND.
contract ValidationRegistry is IValidationRegistry, AccessControl, Pausable {
    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE     = keccak256("ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    struct ValidationRecord {
        address validatorAgent;
        address serverAgent;
        uint256 skillId;
        uint8   response;      // 0-100
        bool    completed;
        uint256 requestedAt;
        uint256 respondedAt;
    }

    /// @notice dataHash => full record
    mapping(bytes32 => ValidationRecord) private _records;

    /// @notice agent => count of completed validations (server side)
    mapping(address => uint256) private _completedOf;

    /// @notice agent => sum of all validation responses (server side)
    mapping(address => uint256) private _responseSumOf;

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    constructor(address admin) {
        if (admin == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // =========================================================================
    //                         VALIDATION FLOW
    // =========================================================================

    /// @inheritdoc IValidationRegistry
    function validationRequest(
        address validatorAgent,
        address serverAgent,
        bytes32 dataHash,
        uint256 skillId
    ) external override whenNotPaused {
        if (validatorAgent == address(0) || serverAgent == address(0)) {
            revert SkillAI__ZeroAddress();
        }
        if (!hasRole(VALIDATOR_ROLE, validatorAgent)) {
            revert SkillAI__ValidatorNotAuthorized(validatorAgent);
        }
        if (_records[dataHash].requestedAt != 0) {
            revert SkillAI__ValidationAlreadyCompleted(dataHash);
        }

        _records[dataHash] = ValidationRecord({
            validatorAgent: validatorAgent,
            serverAgent:    serverAgent,
            skillId:        skillId,
            response:       0,
            completed:      false,
            requestedAt:    block.timestamp,
            respondedAt:    0
        });

        emit ValidationRequest(validatorAgent, serverAgent, dataHash, skillId, block.timestamp);
    }

    /// @inheritdoc IValidationRegistry
    function validationResponse(bytes32 dataHash, uint8 response)
        external
        override
        whenNotPaused
    {
        ValidationRecord storage rec = _records[dataHash];
        if (rec.requestedAt == 0) revert SkillAI__ValidationNotRequested(dataHash);
        if (rec.completed) revert SkillAI__ValidationAlreadyCompleted(dataHash);
        if (msg.sender != rec.validatorAgent) {
            revert SkillAI__NotRequestedValidator(msg.sender, rec.validatorAgent);
        }
        if (response > 100) revert SkillAI__InvalidValidationResponse(response);

        rec.response    = response;
        rec.completed   = true;
        rec.respondedAt = block.timestamp;

        unchecked {
            _completedOf[rec.serverAgent]    += 1;
            _responseSumOf[rec.serverAgent]  += response;
        }

        emit ValidationResponse(dataHash, msg.sender, response, block.timestamp);
    }

    // =========================================================================
    //                          ADMIN FUNCTIONS
    // =========================================================================

    /// @notice Authorize an address to act as a validator (e.g. off-chain oracle signer)
    function grantValidatorRole(address validator) external onlyRole(ADMIN_ROLE) {
        if (validator == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(VALIDATOR_ROLE, validator);
    }

    function revokeValidatorRole(address validator) external onlyRole(ADMIN_ROLE) {
        _revokeRole(VALIDATOR_ROLE, validator);
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

    /// @inheritdoc IValidationRegistry
    function getValidation(bytes32 dataHash)
        external
        view
        override
        returns (
            address validatorAgent,
            address serverAgent,
            uint256 skillId,
            uint8   response,
            bool    completed,
            uint256 requestedAt,
            uint256 respondedAt
        )
    {
        ValidationRecord memory r = _records[dataHash];
        return (
            r.validatorAgent,
            r.serverAgent,
            r.skillId,
            r.response,
            r.completed,
            r.requestedAt,
            r.respondedAt
        );
    }

    /// @inheritdoc IValidationRegistry
    function isValidated(bytes32 dataHash) external view override returns (bool) {
        return _records[dataHash].completed;
    }

    /// @inheritdoc IValidationRegistry
    function completedValidationsOf(address agent) external view override returns (uint256) {
        return _completedOf[agent];
    }

    /// @inheritdoc IValidationRegistry
    function averageValidationScore(address agent) external view override returns (uint256) {
        uint256 n = _completedOf[agent];
        if (n == 0) return 0;
        return _responseSumOf[agent] / n;
    }
}
