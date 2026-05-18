// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20}    from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20}     from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWrappedTokenGatewayV3} from "../../src/interfaces/external/IWrappedTokenGatewayV3.sol";

/// @notice 1:1 aWETH for the mock — same accrueYield helper as MockAToken.
contract MockAWETH is ERC20 {
    address public immutable gateway;
    constructor(address gateway_) ERC20("Aave WETH", "aWETH") { gateway = gateway_; }
    function mint(address to, uint256 amount) external {
        require(msg.sender == gateway, "only gateway");
        _mint(to, amount);
    }
    function burn(address from, uint256 amount) external {
        require(msg.sender == gateway, "only gateway");
        _burn(from, amount);
    }
    function accrueYield(address holder, uint256 amount) external {
        _mint(holder, amount);
    }
}

/// @notice Minimal mock for the Aave V3 WrappedTokenGateway. Holds ETH 1:1 and
///         mints aWETH on deposit. On withdraw burns aWETH and sends ETH back.
contract MockWrappedTokenGatewayV3 is IWrappedTokenGatewayV3 {
    using SafeERC20 for IERC20;
    MockAWETH public immutable aWeth;

    constructor() {
        aWeth = new MockAWETH(address(this));
    }

    function depositETH(
        address /*pool*/,
        address onBehalfOf,
        uint16
    ) external payable override {
        aWeth.mint(onBehalfOf, msg.value);
    }

    function withdrawETH(
        address /*pool*/,
        uint256 amount,
        address to
    ) external override {
        if (amount == type(uint256).max) {
            amount = aWeth.balanceOf(msg.sender);
        }
        // The caller must have approved this contract to pull aWETH; we use
        // transferFrom to mimic the real gateway behaviour.
        IERC20(address(aWeth)).safeTransferFrom(msg.sender, address(this), amount);
        aWeth.burn(address(this), amount);
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "eth transfer failed");
    }

    receive() external payable {}
}
