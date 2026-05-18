// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20}    from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20}     from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAaveV3Pool} from "../../src/interfaces/external/IAaveV3Pool.sol";

/// @notice 1:1 aToken with the underlying. Yield is simulated by minting more
///         aTokens to a holder via `accrueYield(holder, amount)`.
contract MockAToken is ERC20 {
    address public immutable mockPool;
    constructor(string memory n, string memory s, address pool_)
        ERC20(n, s)
    {
        mockPool = pool_;
    }
    function mint(address to, uint256 amount) external {
        require(msg.sender == mockPool, "only pool");
        _mint(to, amount);
    }
    function burn(address from, uint256 amount) external {
        require(msg.sender == mockPool, "only pool");
        _burn(from, amount);
    }
    /// Test helper: mint extra aTokens to simulate yield accrual.
    function accrueYield(address holder, uint256 amount) external {
        _mint(holder, amount);
    }
}

/// @notice Minimal Aave V3 Pool mock — supports supply/withdraw for a single
///         underlying asset registered via `setReserve`. The pool holds the
///         underlying 1:1 and the user receives a non-rebasing aToken.
contract MockAaveV3Pool is IAaveV3Pool {
    using SafeERC20 for IERC20;

    mapping(address => address) public aTokenOf;

    function setReserve(address asset, address aToken) external {
        aTokenOf[asset] = aToken;
    }

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16
    ) external override {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        MockAToken(aTokenOf[asset]).mint(onBehalfOf, amount);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external override returns (uint256) {
        if (amount == type(uint256).max) {
            amount = MockAToken(aTokenOf[asset]).balanceOf(msg.sender);
        }
        MockAToken(aTokenOf[asset]).burn(msg.sender, amount);
        IERC20(asset).safeTransfer(to, amount);
        return amount;
    }

    function getReserveData(address asset) external view override returns (
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
    ) {
        return (
            0, 0, 0, 0, 0, 0, 0, 0,
            aTokenOf[asset],
            address(0), address(0), address(0),
            0, 0, 0
        );
    }
}
