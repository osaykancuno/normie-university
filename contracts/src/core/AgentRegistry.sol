// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721}          from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAgentRegistry} from "../interfaces/IAgentRegistry.sol";
import {SkillTypes}     from "../libraries/SkillTypes.sol";
import {
    SkillAI__NotRegistered,
    SkillAI__InvalidMetadataURI,
    SkillAI__ZeroAddress,
    SkillAI__Cooldown
} from "../libraries/SkillTypes.sol";

/// @title  AgentRegistry
/// @author SKILLAI
/// @notice ERC-8004 compliant Identity Registry. Every agent is an ERC-721 NFT
///         whose tokenId is the agent's canonical on-chain identity.
/// @dev    Security features:
///         - AccessControl (ADMIN role for emergency actions)
///         - Pausable (emergency stop)
///         - ReentrancyGuard (on all state-changing functions)
///         - Rate limiting (1 registration per address per cooldown window)
///         - Immutable registration file URI validation
contract AgentRegistry is
    IAgentRegistry,
    ERC721Enumerable,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    /// @notice Minimum seconds between registrations per address (anti-spam)
    uint256 public constant REGISTRATION_COOLDOWN = 1 hours;

    /// @notice Next tokenId to be minted (starts at 1, 0 means "no agent")
    uint256 private _nextTokenId = 1;

    /// @notice tokenId => full agent profile
    mapping(uint256 => SkillTypes.AgentProfile) private _agents;

    /// @notice address => timestamp of last registration attempt (for cooldown)
    mapping(address => uint256) public lastRegistrationAt;

    /// @notice address => primary (first) tokenId. 0 if not registered.
    mapping(address => uint256) public primaryTokenId;

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    constructor(address admin) ERC721("SKILLAI Agent", "SAGENT") {
        if (admin == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // =========================================================================
    //                         WRITE FUNCTIONS
    // =========================================================================

    /// @inheritdoc IAgentRegistry
    function registerAgent(string calldata registrationFileURI)
        external
        override
        whenNotPaused
        nonReentrant
        returns (uint256 tokenId)
    {
        // Input validation
        if (bytes(registrationFileURI).length == 0) revert SkillAI__InvalidMetadataURI();

        // Rate limiting (anti-spam)
        uint256 lastTs = lastRegistrationAt[msg.sender];
        if (lastTs != 0 && block.timestamp < lastTs + REGISTRATION_COOLDOWN) {
            revert SkillAI__Cooldown(lastTs + REGISTRATION_COOLDOWN);
        }

        // Mint the agent NFT (ERC-8004 Identity)
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        // Store profile
        _agents[tokenId] = SkillTypes.AgentProfile({
            tokenId: tokenId,
            agentAddress: msg.sender,
            registrationFileURI: registrationFileURI,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            isActive: true
        });

        // Track primary token for the owner (first registered stays as primary)
        if (primaryTokenId[msg.sender] == 0) {
            primaryTokenId[msg.sender] = tokenId;
        }

        lastRegistrationAt[msg.sender] = block.timestamp;

        emit AgentRegistered(tokenId, msg.sender, registrationFileURI, block.timestamp);
    }

    /// @inheritdoc IAgentRegistry
    function updateAgent(uint256 tokenId, string calldata registrationFileURI)
        external
        override
        whenNotPaused
        nonReentrant
    {
        _requireOwnedOrAdmin(tokenId);
        if (bytes(registrationFileURI).length == 0) revert SkillAI__InvalidMetadataURI();

        SkillTypes.AgentProfile storage p = _agents[tokenId];
        p.registrationFileURI = registrationFileURI;
        p.updatedAt = block.timestamp;

        emit AgentUpdated(tokenId, p.agentAddress, registrationFileURI, block.timestamp);
    }

    /// @inheritdoc IAgentRegistry
    function deactivateAgent(uint256 tokenId)
        external
        override
        whenNotPaused
        nonReentrant
    {
        _requireOwnedOrAdmin(tokenId);

        SkillTypes.AgentProfile storage p = _agents[tokenId];
        p.isActive = false;
        p.updatedAt = block.timestamp;

        emit AgentDeactivated(tokenId, p.agentAddress, block.timestamp);
    }

    // =========================================================================
    //                         ADMIN FUNCTIONS
    // =========================================================================

    /// @notice Pause all state-changing operations (emergency)
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // =========================================================================
    //                          VIEW FUNCTIONS
    // =========================================================================

    /// @inheritdoc IAgentRegistry
    function isRegistered(address agent) external view override returns (bool) {
        uint256 tokenId = primaryTokenId[agent];
        if (tokenId == 0) return false;
        return _agents[tokenId].isActive;
    }

    /// @inheritdoc IAgentRegistry
    function isAgentActive(uint256 tokenId) external view override returns (bool) {
        if (_ownerOf(tokenId) == address(0)) return false;
        return _agents[tokenId].isActive;
    }

    /// @inheritdoc IAgentRegistry
    function getAgent(uint256 tokenId) external view override returns (SkillTypes.AgentProfile memory) {
        address owner = _ownerOf(tokenId);
        if (owner == address(0)) revert SkillAI__NotRegistered(address(0));
        return _agents[tokenId];
    }

    /// @inheritdoc IAgentRegistry
    function getAgentsByOwner(address agent) external view override returns (uint256[] memory) {
        uint256 balance = balanceOf(agent);
        uint256[] memory ids = new uint256[](balance);
        for (uint256 i = 0; i < balance; ++i) {
            ids[i] = tokenOfOwnerByIndex(agent, i);
        }
        return ids;
    }

    /// @inheritdoc IAgentRegistry
    function getPrimaryTokenId(address agent) external view override returns (uint256) {
        return primaryTokenId[agent];
    }

    /// @inheritdoc IAgentRegistry
    function totalAgents() external view override returns (uint256) {
        return _nextTokenId - 1;
    }

    /// @notice Override tokenURI to return the registration file URI (ERC-8004 compliant)
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _agents[tokenId].registrationFileURI;
    }

    // =========================================================================
    //                       INTERNAL / OVERRIDES
    // =========================================================================

    /// @dev Revert if msg.sender is neither the agent owner nor an admin
    function _requireOwnedOrAdmin(uint256 tokenId) internal view {
        address owner = _ownerOf(tokenId);
        if (owner == address(0)) revert SkillAI__NotRegistered(msg.sender);
        if (msg.sender != owner && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert SkillAI__NotRegistered(msg.sender);
        }
    }

    /// @dev Hook called on every transfer. Keep `primaryTokenId` mapping in sync.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Enumerable)
        returns (address)
    {
        address from = super._update(to, tokenId, auth);

        // Maintain primaryTokenId: if the transferred token was the primary of `from`,
        // promote the next-oldest token (if any) to primary; otherwise clear it.
        if (from != address(0) && primaryTokenId[from] == tokenId) {
            uint256 bal = balanceOf(from);
            if (bal == 0) {
                delete primaryTokenId[from];
            } else {
                // Promote the lowest remaining tokenId owned by `from`
                uint256 newPrimary = type(uint256).max;
                for (uint256 i = 0; i < bal; ++i) {
                    uint256 id = tokenOfOwnerByIndex(from, i);
                    if (id < newPrimary) newPrimary = id;
                }
                primaryTokenId[from] = newPrimary;
            }
        }

        // If `to` didn't have a primary token yet, set this one
        if (to != address(0) && primaryTokenId[to] == 0) {
            primaryTokenId[to] = tokenId;
            // Also update stored agentAddress on transfer
            _agents[tokenId].agentAddress = to;
            _agents[tokenId].updatedAt = block.timestamp;
        } else if (to != address(0) && from != address(0)) {
            // On a transfer between existing owners, update the agentAddress pointer
            _agents[tokenId].agentAddress = to;
            _agents[tokenId].updatedAt = block.timestamp;
        }

        return from;
    }

    /// @dev Required override for AccessControl + ERC721Enumerable
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
