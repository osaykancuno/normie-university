// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title  MockUSDC
/// @notice Minimal USDC mock with 6 decimals and a trivial EIP-3009-like
///         `receiveWithAuthorization` for testing x402 purchase flows.
/// @dev    The signature check is intentionally simplified: we only verify
///         that `v=27/28` and non-zero r/s. Real USDC uses EIP-712 and nonces.
///         Nonce tracking is real (prevents replay within the test suite).
contract MockUSDC is ERC20 {
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Simplified EIP-3009 receiveWithAuthorization for tests
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp > validAfter, "not yet valid");
        require(block.timestamp < validBefore, "expired");
        require(!authorizationState[from][nonce], "nonce used");
        require(v == 27 || v == 28, "bad v");
        require(r != bytes32(0) && s != bytes32(0), "bad sig");
        // receiveWithAuthorization requires msg.sender == to
        require(msg.sender == to, "caller not to");

        authorizationState[from][nonce] = true;
        _transfer(from, to, value);
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp > validAfter, "not yet valid");
        require(block.timestamp < validBefore, "expired");
        require(!authorizationState[from][nonce], "nonce used");
        require(v == 27 || v == 28, "bad v");
        require(r != bytes32(0) && s != bytes32(0), "bad sig");

        authorizationState[from][nonce] = true;
        _transfer(from, to, value);
    }
}
