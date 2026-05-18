// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAaveV3Pool
/// @notice Minimal interface to the Aave V3 Pool contract, only the surface
///         SKILLAI Treasury needs to deploy idle USDC into a yield-bearing
///         position. The Pool address on Base mainnet:
///                 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
///         On Base Sepolia Aave is not officially deployed; the Treasury
///         exposes the integration but admins only activate it on mainnet.
interface IAaveV3Pool {
    /// @notice Supply `amount` of `asset` to the Pool and receive an equivalent
    ///         amount of the asset's aToken to `onBehalfOf`.
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /// @notice Burns `amount` of aTokens and sends underlying `asset` to `to`.
    ///         Pass type(uint256).max to withdraw the full balance.
    /// @return The actual amount withdrawn.
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /// @notice Reserve config used to look up the aToken address for an asset.
    function getReserveData(address asset) external view returns (
        // ReserveConfigurationMap (packed); we only need offsets
        uint256 configuration,
        uint128 liquidityIndex,
        uint128 currentLiquidityRate,
        uint128 variableBorrowIndex,
        uint128 currentVariableBorrowRate,
        uint128 currentStableBorrowRate,
        uint40  lastUpdateTimestamp,
        uint16  id,
        address aTokenAddress,
        address stableDebtTokenAddress,
        address variableDebtTokenAddress,
        address interestRateStrategyAddress,
        uint128 accruedToTreasury,
        uint128 unbacked,
        uint128 isolationModeTotalDebt
    );
}
