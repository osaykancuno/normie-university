// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title MockNormies
/// @notice A TESTNET-ONLY stand-in for the Normies collection (which lives on
///         Ethereum mainnet). Lets anyone mint a "Normie" on Sepolia so the
///         agent-binding flow — bind, earn skills, transfer, watch the skills
///         follow the new owner — can be demonstrated end-to-end without real
///         mainnet Normies. NOT for production.
contract MockNormies is ERC721 {
    uint256 public nextId = 1;

    constructor() ERC721("Mock Normies (testnet)", "mNORMIE") {}

    /// @notice Mint a test Normie to the caller.
    function mint() external returns (uint256 id) {
        id = nextId++;
        _safeMint(msg.sender, id);
    }

    /// @notice Mint a specific tokenId (useful to mirror a real Normie id).
    function mintId(uint256 id) external {
        _safeMint(msg.sender, id);
    }
}
