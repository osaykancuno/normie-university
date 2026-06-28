// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {NormieVerifiedPass} from "../src/tools/NormieVerifiedPass.sol";

contract NormieVerifiedPassTest is Test {
    NormieVerifiedPass internal pass;

    address internal admin = address(0xA11CE);
    address internal minter = address(0x5168E5); // "SIGNER"
    address internal alice = address(0xA11C3);
    address internal bob = address(0xB0B);

    function setUp() public {
        pass = new NormieVerifiedPass(admin, minter, "https://normie-university.vercel.app/pass/");
    }

    function test_Constructor_RejectsZeroRoles() public {
        vm.expectRevert(NormieVerifiedPass.ZeroAddress.selector);
        new NormieVerifiedPass(address(0), minter, "");
        vm.expectRevert(NormieVerifiedPass.ZeroAddress.selector);
        new NormieVerifiedPass(admin, address(0), "");
    }

    function test_OnlyMinter_CanIssue() public {
        vm.prank(alice);
        vm.expectRevert();
        pass.issue(alice, 42);
    }

    function test_Issue_RecordsAttestation() public {
        vm.prank(minter);
        uint256 id = pass.issue(alice, 42);

        assertEq(pass.ownerOf(id), alice);
        assertEq(pass.balanceOf(alice), 1);
        assertEq(pass.passOf(alice), id);
        assertEq(pass.attestedNormie(id), 42);
    }

    function test_OnePassPerWallet() public {
        vm.startPrank(minter);
        pass.issue(alice, 1);
        vm.expectRevert(abi.encodeWithSelector(NormieVerifiedPass.AlreadyHasPass.selector, alice));
        pass.issue(alice, 2);
        vm.stopPrank();
    }

    function test_Soulbound_TransferReverts() public {
        vm.prank(minter);
        uint256 id = pass.issue(alice, 1);

        vm.prank(alice);
        vm.expectRevert(NormieVerifiedPass.Soulbound.selector);
        pass.transferFrom(alice, bob, id);
    }

    function test_Soulbound_ApproveReverts() public {
        vm.prank(minter);
        uint256 id = pass.issue(alice, 1);

        vm.startPrank(alice);
        vm.expectRevert(NormieVerifiedPass.Soulbound.selector);
        pass.approve(bob, id);
        vm.expectRevert(NormieVerifiedPass.Soulbound.selector);
        pass.setApprovalForAll(bob, true);
        vm.stopPrank();
    }

    function test_Revoke_BurnsAndClearsState() public {
        vm.startPrank(minter);
        uint256 id = pass.issue(alice, 7);
        pass.revoke(id);
        vm.stopPrank();

        assertEq(pass.balanceOf(alice), 0);
        assertEq(pass.passOf(alice), 0);
        assertEq(pass.attestedNormie(id), 0);

        // wallet can be re-issued after revocation (e.g. bought another Normie)
        vm.prank(minter);
        uint256 id2 = pass.issue(alice, 9);
        assertEq(pass.balanceOf(alice), 1);
        assertGt(id2, id);
    }

    function test_OnlyMinter_CanRevoke() public {
        vm.prank(minter);
        uint256 id = pass.issue(alice, 1);

        vm.prank(alice);
        vm.expectRevert();
        pass.revoke(id);
    }
}
