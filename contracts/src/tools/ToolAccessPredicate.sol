// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IAccessPredicate} from "./interfaces/IAccessPredicate.sol";

/**
 * @title  ToolAccessPredicate
 * @notice ERC-8257 access predicate for NORMIE UNIVERSITY tools on Base.
 *
 *         The Normies collection lives on Ethereum L1, but the Agent Tool
 *         Registry and this predicate run on Base — so on Base we gate on a
 *         NU-controlled marker rather than reading L1 ownership. Two requirement
 *         types, combined by per-tool AND/OR logic:
 *
 *           1. HOLDING   — `account` holds >=1 of a configured ERC-721 on Base
 *                          (the "NU Normie-Verified Pass": minted by NU after it
 *                          checks real Normie ownership on L1 via RPC).
 *           2. ALLOWLIST — `account` is explicitly allowlisted for the tool
 *                          (covers sponsored / off-chain-verified callers).
 *
 *         Fail-closed by design, matching the rest of the protocol: an
 *         unconfigured tool denies, and any malfunctioning external call denies.
 *         The on-chain answer here is authoritative; the manifest `access`
 *         block is only an advisory hint.
 */
contract ToolAccessPredicate is IAccessPredicate, Ownable {
    /// @dev Standard ERC-8257 marker for "hold any token in an ERC-721 collection".
    bytes4 internal constant IERC721_HOLDING = 0xbdf8c428;
    /// @dev ERC-165 interface id of IAccessPredicate, fixed by the ERC.
    bytes4 internal constant IACCESS_PREDICATE = 0xbdf9dc18;

    struct ToolGate {
        address collection; // ERC-721 satisfying HOLDING; address(0) = no holding requirement
        bool useAllowlist; // also consult the per-tool allowlist
        RequirementLogic logic; // how HOLDING and ALLOWLIST combine when both are present
        bool configured; // unconfigured tools fail closed
    }

    mapping(uint256 toolId => ToolGate) public gates;
    mapping(uint256 toolId => mapping(address account => bool)) public allowlisted;

    event GateSet(uint256 indexed toolId, address collection, bool useAllowlist, RequirementLogic logic);
    event Allowlisted(uint256 indexed toolId, address indexed account, bool allowed);

    error NoRequirement(uint256 toolId);

    constructor(address admin) Ownable(admin) {}

    // ---------------------------------------------------------------------
    // Admin (NORMIE UNIVERSITY)
    // ---------------------------------------------------------------------

    /// @notice Configure a tool's gate. At least one of `collection` or
    ///         `useAllowlist` must be active, else there is nothing to gate on.
    function setGate(uint256 toolId, address collection, bool useAllowlist, RequirementLogic logic)
        external
        onlyOwner
    {
        if (collection == address(0) && !useAllowlist) revert NoRequirement(toolId);
        gates[toolId] = ToolGate(collection, useAllowlist, logic, true);
        emit GateSet(toolId, collection, useAllowlist, logic);
    }

    /// @notice Add/remove a caller from a tool's allowlist.
    function setAllowlisted(uint256 toolId, address account, bool allowed) external onlyOwner {
        allowlisted[toolId][account] = allowed;
        emit Allowlisted(toolId, account, allowed);
    }

    /// @notice Batch allowlist update (e.g. a cohort of verified holders).
    function setAllowlistedBatch(uint256 toolId, address[] calldata accounts, bool allowed)
        external
        onlyOwner
    {
        for (uint256 i; i < accounts.length; ++i) {
            allowlisted[toolId][accounts[i]] = allowed;
            emit Allowlisted(toolId, accounts[i], allowed);
        }
    }

    // ---------------------------------------------------------------------
    // IAccessPredicate
    // ---------------------------------------------------------------------

    /// @inheritdoc IAccessPredicate
    function hasAccess(uint256 toolId, address account, bytes calldata /* data */ )
        external
        view
        returns (bool)
    {
        ToolGate memory g = gates[toolId];
        if (!g.configured) return false; // fail-closed

        bool hasHolding = g.collection != address(0);
        bool holds = hasHolding && _holdsToken(g.collection, account);
        bool allowed = g.useAllowlist && allowlisted[toolId][account];

        if (hasHolding && g.useAllowlist) {
            return g.logic == RequirementLogic.AND ? (holds && allowed) : (holds || allowed);
        }
        if (hasHolding) return holds;
        if (g.useAllowlist) return allowed;
        return false;
    }

    /// @inheritdoc IAccessPredicate
    function name() external pure returns (string memory) {
        return "NORMIE UNIVERSITY Tool Access";
    }

    /// @inheritdoc IAccessPredicate
    function getRequirements(uint256 toolId)
        external
        view
        returns (AccessRequirement[] memory requirements, RequirementLogic logic)
    {
        ToolGate memory g = gates[toolId];
        logic = g.logic;
        // We advertise the standard HOLDING requirement; an allowlist-only gate
        // has no standard marker, so it surfaces as an empty hint (the on-chain
        // check is still authoritative).
        if (g.collection != address(0)) {
            requirements = new AccessRequirement[](1);
            requirements[0] = AccessRequirement({
                kind: IERC721_HOLDING,
                data: abi.encode(g.collection),
                label: "Hold a NORMIE UNIVERSITY Normie-Verified Pass on Base"
            });
        } else {
            requirements = new AccessRequirement[](0);
        }
    }

    /// @notice ERC-165: advertise IAccessPredicate + IERC165.
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == IACCESS_PREDICATE || interfaceId == type(IERC165).interfaceId;
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    /// @dev `balanceOf(account) > 0`, swallowing any malfunction as "no" so the
    ///      predicate can never revert the registry's staticcall.
    function _holdsToken(address collection, address account) internal view returns (bool) {
        (bool ok, bytes memory ret) =
            collection.staticcall(abi.encodeWithSignature("balanceOf(address)", account));
        if (!ok || ret.length < 32) return false;
        return abi.decode(ret, (uint256)) > 0;
    }
}
