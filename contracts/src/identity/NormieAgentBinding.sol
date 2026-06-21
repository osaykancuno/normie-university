// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title NormieAgentBinding
/// @notice Binds an external agent NFT (e.g. a Normie) to a NORMIE UNIVERSITY
///         agent identity, following ERC-8217 "Agent NFT Identity Binding"
///         semantics. The bound NFT is the CONTROLLER of the identity:
///         `controllerOf(agentId) == ownerOf(boundToken)`. When the NFT is sold,
///         control — and therefore every credential minted to the identity —
///         transfers atomically with it. Skills follow the NFT, not the wallet.
///
///         The identity is a deterministic, non-custodial address derived from
///         the agentId. Credentials (Soulbound) are minted TO that identity, so
///         they live on the agent, while authority to act for the agent is read
///         live from the NFT owner. No private key exists for the identity — it
///         never needs to sign; the marketplace authorises actions by checking
///         `isController(caller, agentId)`.
///
///         Minimal + auditable by design. The canonical Adapter8004 (UUPS) can
///         be swapped in later without changing this interface.
contract NormieAgentBinding {
    struct Binding {
        address tokenContract;
        uint256 tokenId;
    }

    error NotTokenOwner();
    error TokenAlreadyBound(address tokenContract, uint256 tokenId);
    error AgentNotBound(uint256 agentId);

    /// @notice Next agent id (starts at 1; 0 means "no agent").
    uint256 public nextAgentId = 1;

    /// @notice agentId => bound NFT.
    mapping(uint256 => Binding) private _binding;
    /// @notice keccak(tokenContract, tokenId) => agentId (0 if unbound).
    mapping(bytes32 => uint256) public agentIdOfToken;
    /// @notice agentId => deterministic identity address.
    mapping(uint256 => address) public identityOf;

    event AgentBound(
        uint256 indexed agentId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        address identity,
        address controller
    );

    function _key(address tokenContract, uint256 tokenId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenContract, tokenId));
    }

    /// @notice Derive the deterministic identity address for an agentId.
    function _identity(uint256 agentId) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked("NORMIE-UNIVERSITY-AGENT", agentId)))));
    }

    /// @notice Bind an NFT you own to a fresh agent identity. One identity per NFT.
    /// @dev Caller must currently own the token. Binding does not move the NFT.
    function bind(address tokenContract, uint256 tokenId)
        external
        returns (uint256 agentId, address identity)
    {
        if (IERC721(tokenContract).ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        bytes32 k = _key(tokenContract, tokenId);
        if (agentIdOfToken[k] != 0) revert TokenAlreadyBound(tokenContract, tokenId);

        agentId = nextAgentId++;
        _binding[agentId] = Binding(tokenContract, tokenId);
        agentIdOfToken[k] = agentId;
        identity = _identity(agentId);
        identityOf[agentId] = identity;

        emit AgentBound(agentId, tokenContract, tokenId, identity, msg.sender);
    }

    /// @notice The NFT bound to an agent identity.
    function bindingOf(uint256 agentId) external view returns (address tokenContract, uint256 tokenId) {
        Binding memory b = _binding[agentId];
        if (b.tokenContract == address(0)) revert AgentNotBound(agentId);
        return (b.tokenContract, b.tokenId);
    }

    /// @notice The current controller of an agent identity = the live NFT owner.
    function controllerOf(uint256 agentId) public view returns (address) {
        Binding memory b = _binding[agentId];
        if (b.tokenContract == address(0)) revert AgentNotBound(agentId);
        return IERC721(b.tokenContract).ownerOf(b.tokenId);
    }

    /// @notice True if `account` currently controls the agent (owns the bound NFT).
    function isController(address account, uint256 agentId) external view returns (bool) {
        Binding memory b = _binding[agentId];
        if (b.tokenContract == address(0)) return false;
        return account == IERC721(b.tokenContract).ownerOf(b.tokenId);
    }

    /// @notice Resolve (agentId, identity) directly from an NFT. agentId 0 = unbound.
    function identityForToken(address tokenContract, uint256 tokenId)
        external
        view
        returns (uint256 agentId, address identity)
    {
        agentId = agentIdOfToken[_key(tokenContract, tokenId)];
        identity = identityOf[agentId];
    }
}
