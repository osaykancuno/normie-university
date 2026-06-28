// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title  NormieVerifiedPass
 * @notice A soulbound ERC-721 on Base that attests "this wallet controls a
 *         Normie on Ethereum L1." It is the Base-side bridge for ERC-8257
 *         Normie-gating: the Normies collection lives on L1, the OpenSea tool
 *         registry + access predicate live on Base, so NU verifies L1 ownership
 *         off-chain (RPC) and mints a pass here. `ToolAccessPredicate` then
 *         gates tools on `balanceOf(account) > 0`.
 *
 * Security model — read carefully:
 *   - Minting is restricted to MINTER_ROLE (the NU verification backend). If
 *     anyone could mint, the gating would be worthless. This role is the trust
 *     anchor and MUST be held by a secured signer / multisig, never the public
 *     testnet key.
 *   - Passes are SOULBOUND (non-transferable) so access cannot be resold
 *     independently of the underlying Normie.
 *   - Passes are REVOCABLE: when a wallet sells its Normie, the backend re-checks
 *     L1 ownership and calls `revoke` to burn the stale pass. On-chain we cannot
 *     observe an L1 transfer, so revocation is the backend's responsibility.
 *   - At most ONE pass per wallet, keeping `balanceOf` a clean 0/1 signal.
 */
contract NormieVerifiedPass is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextId = 1;

    /// @notice wallet => its pass tokenId (0 if none).
    mapping(address => uint256) public passOf;
    /// @notice tokenId => the L1 Normie id this pass attests.
    mapping(uint256 => uint256) public attestedNormie;

    string private _base;

    error AlreadyHasPass(address account);
    error Soulbound();
    error ZeroAddress();

    event PassIssued(address indexed to, uint256 indexed tokenId, uint256 indexed normieId);
    event PassRevoked(address indexed from, uint256 indexed tokenId);

    /// @param admin   DEFAULT_ADMIN_ROLE holder (NU multisig).
    /// @param minter  MINTER_ROLE holder (NU verification backend signer).
    constructor(address admin, address minter, string memory baseURI)
        ERC721("Normie-Verified Pass", "NVPASS")
    {
        if (admin == address(0) || minter == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _base = baseURI;
    }

    // ---------------------------------------------------------------------
    // Verification backend (MINTER_ROLE)
    // ---------------------------------------------------------------------

    /// @notice Issue a pass to `to`, attesting control of L1 Normie `normieId`.
    ///         Reverts if `to` already holds a pass (one per wallet).
    function issue(address to, uint256 normieId) external onlyRole(MINTER_ROLE) returns (uint256 id) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf(to) != 0) revert AlreadyHasPass(to);
        id = _nextId++;
        passOf[to] = id;
        attestedNormie[id] = normieId;
        _safeMint(to, id);
        emit PassIssued(to, id, normieId);
    }

    /// @notice Burn a pass (e.g. the holder sold the underlying Normie).
    function revoke(uint256 tokenId) external onlyRole(MINTER_ROLE) {
        address owner = _requireOwned(tokenId);
        delete passOf[owner];
        delete attestedNormie[tokenId];
        _burn(tokenId);
        emit PassRevoked(owner, tokenId);
    }

    // ---------------------------------------------------------------------
    // Soulbound enforcement
    // ---------------------------------------------------------------------

    /// @dev Allow mint (from==0) and burn (to==0); block wallet-to-wallet moves.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    // ---------------------------------------------------------------------
    // Views / admin
    // ---------------------------------------------------------------------

    function _baseURI() internal view override returns (string memory) {
        return _base;
    }

    function setBaseURI(string calldata baseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _base = baseURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
