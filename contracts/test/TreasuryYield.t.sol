// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}     from "forge-std/Test.sol";
import {Treasury} from "../src/treasury/Treasury.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockAaveV3Pool, MockAToken} from "./mocks/MockAaveV3Pool.sol";
import {MockWrappedTokenGatewayV3, MockAWETH} from "./mocks/MockWrappedTokenGatewayV3.sol";
import {SkillAI__ZeroAddress} from "../src/libraries/SkillTypes.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TreasuryYieldTest is Test {
    Treasury public treasury;
    MockUSDC public usdc;
    MockAaveV3Pool public pool;
    MockWrappedTokenGatewayV3 public gateway;
    MockAToken public aUsdc;
    MockAWETH public aWeth;

    address public admin    = address(0xA11CE);
    address public attacker = address(0xDEAD);

    function setUp() public {
        treasury = new Treasury(admin);
        usdc = new MockUSDC();

        pool = new MockAaveV3Pool();
        aUsdc = new MockAToken("Aave USDC", "aUSDC", address(pool));
        pool.setReserve(address(usdc), address(aUsdc));

        gateway = new MockWrappedTokenGatewayV3();
        aWeth = gateway.aWeth();

        vm.prank(admin);
        treasury.configureAave(address(pool), address(gateway));

        // Fund the treasury
        vm.deal(address(treasury), 10 ether);
        usdc.mint(address(treasury), 100_000 * 1e6);
    }

    // ------------------------------------------------------------------
    //                       CONFIGURATION
    // ------------------------------------------------------------------

    function test_ConfigureAave_OnlyAdmin() public {
        bytes32 role = treasury.ADMIN_ROLE();
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, role
        );
        vm.prank(attacker);
        vm.expectRevert(expected);
        treasury.configureAave(address(pool), address(gateway));
    }

    function test_ConfigureAave_CanDisableWithZeroAddresses() public {
        vm.prank(admin);
        treasury.configureAave(address(0), address(0));
        assertEq(address(treasury.aavePool()), address(0));
        assertEq(address(treasury.aaveEthGateway()), address(0));
    }

    // ------------------------------------------------------------------
    //                       SUPPLY / WITHDRAW ETH
    // ------------------------------------------------------------------

    function test_SupplyEthToYield_MintsAWeth() public {
        uint256 amount = 5 ether;
        vm.prank(admin);
        treasury.supplyEthToYield(amount);

        assertEq(aWeth.balanceOf(address(treasury)), amount);
        assertEq(treasury.aaveEthPrincipal(), amount);
        assertEq(address(treasury).balance, 10 ether - amount);
    }

    function test_SupplyEthToYield_RevertsIfAaveNotConfigured() public {
        vm.prank(admin);
        treasury.configureAave(address(0), address(0));

        vm.prank(admin);
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        treasury.supplyEthToYield(1 ether);
    }

    function test_WithdrawEthFromYield_BurnsAWethAndReturnsEth() public {
        vm.prank(admin);
        treasury.supplyEthToYield(5 ether);

        // Simulate yield accrual: extra 0.1 aWETH minted to treasury, and the
        // gateway needs the corresponding ETH to honour the withdrawal
        aWeth.accrueYield(address(treasury), 0.1 ether);
        vm.deal(address(gateway), address(gateway).balance + 0.1 ether);

        uint256 ethBefore = address(treasury).balance;

        vm.prank(admin);
        treasury.withdrawEthFromYield(5.1 ether, address(aWeth));

        // ETH back in treasury, aWETH burned
        assertEq(address(treasury).balance, ethBefore + 5.1 ether);
        assertEq(aWeth.balanceOf(address(treasury)), 0);
        // Principal goes to 0 (we withdrew more than principal — capped at principal)
        assertEq(treasury.aaveEthPrincipal(), 0);
    }

    // ------------------------------------------------------------------
    //                       SUPPLY / WITHDRAW USDC
    // ------------------------------------------------------------------

    function test_SupplyUsdcToYield_HappyPath() public {
        uint256 amount = 10_000 * 1e6;

        vm.prank(admin);
        treasury.supplyUsdcToYield(address(usdc), amount);

        assertEq(aUsdc.balanceOf(address(treasury)), amount);
        assertEq(treasury.aaveUsdcPrincipal(), amount);
        assertEq(usdc.balanceOf(address(treasury)), 100_000 * 1e6 - amount);
    }

    function test_SupplyUsdcToYield_OnlyAdmin() public {
        bytes32 role = treasury.ADMIN_ROLE();
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, role
        );
        vm.prank(attacker);
        vm.expectRevert(expected);
        treasury.supplyUsdcToYield(address(usdc), 1);
    }

    function test_WithdrawUsdcFromYield_ReturnsPrincipalPlusYield() public {
        uint256 amount = 10_000 * 1e6;
        vm.prank(admin);
        treasury.supplyUsdcToYield(address(usdc), amount);

        // Simulate yield: extra 200 aUSDC accrued
        aUsdc.accrueYield(address(treasury), 200 * 1e6);
        // Pool needs the underlying to honour the withdrawal
        usdc.mint(address(pool), 200 * 1e6);

        vm.prank(admin);
        uint256 withdrawn = treasury.withdrawUsdcFromYield(address(usdc), type(uint256).max);

        // Full principal + yield withdrawn
        assertEq(withdrawn, 10_200 * 1e6);
        assertEq(usdc.balanceOf(address(treasury)), 100_000 * 1e6 + 200 * 1e6);
        // aUSDC balance is now zero
        assertEq(aUsdc.balanceOf(address(treasury)), 0);
        // Principal goes to 0
        assertEq(treasury.aaveUsdcPrincipal(), 0);
    }

    // ------------------------------------------------------------------
    //                       VIEWS
    // ------------------------------------------------------------------

    function test_AaveUsdcYield_ReportsAccruedAmount() public {
        uint256 amount = 5_000 * 1e6;
        vm.prank(admin);
        treasury.supplyUsdcToYield(address(usdc), amount);

        assertEq(treasury.aaveUsdcYield(address(usdc)), 0);

        aUsdc.accrueYield(address(treasury), 73 * 1e6);
        assertEq(treasury.aaveUsdcYield(address(usdc)), 73 * 1e6);
    }

    function test_AaveUsdcYield_IsZeroIfPoolNotConfigured() public {
        vm.prank(admin);
        treasury.configureAave(address(0), address(0));
        assertEq(treasury.aaveUsdcYield(address(usdc)), 0);
    }

    function test_ATokenBalance_ReturnsAaveBalance() public {
        uint256 amount = 3_000 * 1e6;
        vm.prank(admin);
        treasury.supplyUsdcToYield(address(usdc), amount);
        assertEq(treasury.aTokenBalance(address(usdc)), amount);
    }
}
