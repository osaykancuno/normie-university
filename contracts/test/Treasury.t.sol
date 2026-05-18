// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}            from "forge-std/Test.sol";
import {Treasury}        from "../src/treasury/Treasury.sol";
import {MockUSDC}        from "./mocks/MockUSDC.sol";
import {IAccessControl}  from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {
    SkillAI__ZeroAddress,
    SkillAI__WithdrawFailed
} from "../src/libraries/SkillTypes.sol";

contract TreasuryTest is Test {
    Treasury  public treasury;
    MockUSDC  public usdc;

    address public admin    = address(0xA11CE);
    address public payer    = address(0xBEEF);
    address public attacker = address(0xDEAD);
    address public recipient = address(0xCAFE);

    function setUp() public {
        treasury = new Treasury(admin);
        usdc     = new MockUSDC();
        vm.deal(payer, 100 ether);
        usdc.mint(payer, 10_000 * 1e6);
    }

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        new Treasury(address(0));
    }

    function test_Constructor_SetsAdmin() public view {
        assertTrue(treasury.hasRole(treasury.ADMIN_ROLE(), admin));
    }

    // =========================================================================
    //                            DEPOSIT (ETH)
    // =========================================================================

    function test_Receive_AccountsEth() public {
        vm.prank(payer);
        (bool ok, ) = address(treasury).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(treasury.ethBalance(), 1 ether);
        assertEq(treasury.totalEthCollected(), 1 ether);
    }

    function test_DepositEth_AccountsEth() public {
        vm.prank(payer);
        treasury.depositEth{value: 2 ether}();
        assertEq(treasury.totalEthCollected(), 2 ether);
    }

    // =========================================================================
    //                          DEPOSIT (USDC)
    // =========================================================================

    function test_NotifyUsdc_Accumulates() public {
        vm.prank(payer);
        treasury.notifyUsdcDeposit(address(usdc), 500 * 1e6);
        assertEq(treasury.totalUsdcCollected(), 500 * 1e6);
    }

    function test_NotifyUsdc_RevertsOnZeroToken() public {
        vm.prank(payer);
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        treasury.notifyUsdcDeposit(address(0), 1);
    }

    // =========================================================================
    //                          WITHDRAW (ETH)
    // =========================================================================

    function test_WithdrawEth_ByAdmin() public {
        vm.deal(address(treasury), 5 ether);

        vm.prank(admin);
        treasury.withdrawEth(payable(recipient), 3 ether);

        assertEq(recipient.balance, 3 ether);
        assertEq(treasury.ethBalance(), 2 ether);
        assertEq(treasury.totalEthWithdrawn(), 3 ether);
    }

    function test_WithdrawEth_RevertsForNonAdmin() public {
        vm.deal(address(treasury), 1 ether);
        bytes32 adminRole = treasury.ADMIN_ROLE();
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            attacker,
            adminRole
        ));
        treasury.withdrawEth(payable(recipient), 1 ether);
    }

    function test_WithdrawEth_RevertsOnZeroRecipient() public {
        vm.deal(address(treasury), 1 ether);
        vm.prank(admin);
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        treasury.withdrawEth(payable(address(0)), 1 ether);
    }

    // =========================================================================
    //                          WITHDRAW (USDC)
    // =========================================================================

    function test_WithdrawErc20_ByAdmin() public {
        usdc.mint(address(treasury), 1_000 * 1e6);

        vm.prank(admin);
        treasury.withdrawErc20(address(usdc), recipient, 400 * 1e6);

        assertEq(usdc.balanceOf(recipient), 400 * 1e6);
        assertEq(usdc.balanceOf(address(treasury)), 600 * 1e6);
        assertEq(treasury.totalUsdcWithdrawn(), 400 * 1e6);
    }

    function test_WithdrawErc20_RevertsOnZero() public {
        vm.prank(admin);
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        treasury.withdrawErc20(address(0), recipient, 1);
    }

    // =========================================================================
    //                            PAUSABLE
    // =========================================================================

    function test_Pause_BlocksDeposit() public {
        vm.prank(admin);
        treasury.pause();

        vm.prank(payer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        treasury.depositEth{value: 1 ether}();
    }

    /// @notice Withdrawals are intentionally NOT blocked by `whenNotPaused` so
    ///         admins can rescue funds during emergencies.
    function test_Pause_AllowsWithdrawForEmergencyRescue() public {
        vm.deal(address(treasury), 1 ether);
        vm.prank(admin);
        treasury.pause();

        // Withdrawal must succeed even when paused.
        vm.prank(admin);
        treasury.withdrawEth(payable(recipient), 1 ether);

        assertEq(recipient.balance, 1 ether);
        assertEq(address(treasury).balance, 0);
    }
}
