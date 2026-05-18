// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IWrappedTokenGatewayV3
/// @notice Aave V3 helper contract that wraps native ETH into WETH and
///         supplies it to the Pool atomically. On Base mainnet:
///                 0x8be473dCfA93132658821E67CfEB684a8077b09f
///         (Address subject to change — read the Aave address-book at deploy
///         time. The Treasury stores it as a settable parameter.)
interface IWrappedTokenGatewayV3 {
    /// @notice Wrap msg.value into WETH and supply it to the Pool, minting
    ///         aWETH to `onBehalfOf`.
    function depositETH(
        address pool,
        address onBehalfOf,
        uint16 referralCode
    ) external payable;

    /// @notice Burn aWETH and withdraw `amount` of ETH to `to`.
    ///         Requires aWETH approval to the gateway beforehand.
    function withdrawETH(
        address pool,
        uint256 amount,
        address to
    ) external;
}
