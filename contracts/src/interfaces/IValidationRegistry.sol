// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  IValidationRegistry
/// @notice ERC-8004 Validation Registry interface.
///         Tracks validation requests and responses from third-party validators
///         who attest to the correctness of an agent's skill execution.
/// @dev    A "validator" is an off-chain (or on-chain) oracle registered by the
///         protocol that signs attestations. The registry stores the result on
///         chain so any protocol (Moltbook, external DeFi apps) can read it.
interface IValidationRegistry {
    // =========================================================================
    //                              EVENTS
    // =========================================================================

    /// @notice Emitted when a new validation request is created (ERC-8004)
    event ValidationRequest(
        address indexed validatorAgent,
        address indexed serverAgent,
        bytes32 indexed dataHash,
        uint256 skillId,
        uint256 timestamp
    );

    /// @notice Emitted when a validator submits the response for a request (ERC-8004)
    event ValidationResponse(
        bytes32 indexed dataHash,
        address indexed validator,
        uint8 response,
        uint256 timestamp
    );

    // =========================================================================
    //                         WRITE FUNCTIONS
    // =========================================================================

    /// @notice Create a validation request. The validator agent is expected
    ///         to answer off-chain and then submit the response via
    ///         `validationResponse`.
    /// @param validatorAgent Address of the validator
    /// @param serverAgent    Address of the agent whose work is being validated
    /// @param dataHash       keccak256 commitment of the payload to be validated
    /// @param skillId        SkillId this validation is about
    function validationRequest(
        address validatorAgent,
        address serverAgent,
        bytes32 dataHash,
        uint256 skillId
    ) external;

    /// @notice Validator submits the response (0-100 score) for a previous request.
    /// @dev    msg.sender must be the validator that was requested.
    /// @param dataHash The commitment from `validationRequest`
    /// @param response Integer score 0-100 (100 = perfect)
    function validationResponse(bytes32 dataHash, uint8 response) external;

    // =========================================================================
    //                         READ FUNCTIONS
    // =========================================================================

    /// @notice Full validation record
    function getValidation(bytes32 dataHash)
        external
        view
        returns (
            address validatorAgent,
            address serverAgent,
            uint256 skillId,
            uint8   response,
            bool    completed,
            uint256 requestedAt,
            uint256 respondedAt
        );

    /// @notice Whether a dataHash has a completed validation
    function isValidated(bytes32 dataHash) external view returns (bool);

    /// @notice Total validations ever completed for an agent (used by ReputationEngine)
    function completedValidationsOf(address agent) external view returns (uint256);

    /// @notice Average validation response score for an agent (0-100, 0 if none)
    function averageValidationScore(address agent) external view returns (uint256);
}
