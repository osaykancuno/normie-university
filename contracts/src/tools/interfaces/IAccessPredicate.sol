// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title  IAccessPredicate (ERC-8257)
 * @notice The access-gating interface OpenSea's Agent Tool Registry calls (via
 *         staticcall) to decide whether `account` may invoke a tool. A tool
 *         registration may attach one predicate address; `address(0)` means the
 *         tool is open.
 *
 * Reference: https://ercs.ethereum.org/ERCS/erc-8257
 */
interface IAccessPredicate {
    enum RequirementLogic {
        AND,
        OR
    }

    struct AccessRequirement {
        bytes4 kind; // ERC-165-style marker (e.g. IERC721Holding = 0xbdf8c428)
        bytes data; // ABI-encoded payload, shape determined by `kind`
        string label; // human-readable hint (max 256 UTF-8 bytes)
    }

    /// @notice True if `account` may use `toolId`. MUST be view; the registry
    ///         treats a revert/malfunction as "no access" (fail-closed).
    function hasAccess(uint256 toolId, address account, bytes calldata data)
        external
        view
        returns (bool);

    /// @notice Human-readable predicate name.
    function name() external view returns (string memory);

    /// @notice Preflight hint: what a caller needs and how requirements combine.
    function getRequirements(uint256 toolId)
        external
        view
        returns (AccessRequirement[] memory requirements, RequirementLogic logic);
}
