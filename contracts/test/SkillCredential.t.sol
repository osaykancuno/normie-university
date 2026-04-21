// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}             from "forge-std/Test.sol";
import {SkillCredential}  from "../src/core/SkillCredential.sol";
import {SkillTypes}       from "../src/libraries/SkillTypes.sol";
import {
    SkillAI__TransferNotAllowed,
    SkillAI__ZeroAddress,
    SkillAI__AlreadyCompleted,
    SkillAI__InvalidScore,
    SkillAI__InvalidLevel,
    SkillAI__SkillNotFound
} from "../src/libraries/SkillTypes.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract SkillCredentialTest is Test {
    SkillCredential public cred;

    address public admin       = address(0xA11CE);
    address public marketplace = address(0x1111);
    address public alice       = address(0xAAAA);
    address public bob         = address(0xBBBB);
    address public attacker    = address(0xDEAD);

    function setUp() public {
        cred = new SkillCredential(admin);
        vm.prank(admin);
        cred.grantMarketplaceRole(marketplace);
    }

    // ------------------------------------------------------------------
    //                         CONSTRUCTOR
    // ------------------------------------------------------------------

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        new SkillCredential(address(0));
    }

    function test_Constructor_SetsAdmin() public view {
        assertTrue(cred.hasRole(cred.ADMIN_ROLE(), admin));
    }

    function test_SetUp_GrantsMarketplaceRole() public view {
        assertTrue(cred.hasRole(cred.MARKETPLACE_ROLE(), marketplace));
    }

    // ------------------------------------------------------------------
    //                         MINT
    // ------------------------------------------------------------------

    function test_MintCredential_HappyPath() public {
        vm.prank(marketplace);
        uint256 tokenId = cred.mintCredential(alice, 42, 2, 85);

        assertEq(tokenId, 1);
        assertEq(cred.ownerOf(1), alice);
        assertEq(cred.totalCredentials(), 1);
        assertTrue(cred.hasSkill(alice, 42));

        SkillTypes.CredentialData memory d = cred.getCredentialDetails(tokenId);
        assertEq(d.agent, alice);
        assertEq(d.skillId, 42);
        assertEq(d.level, 2);
        assertEq(d.score, 85);
        assertTrue(d.verified);
    }

    function test_MintCredential_RevertsIfNotMarketplace() public {
        bytes32 mRole = cred.MARKETPLACE_ROLE();
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            attacker,
            mRole
        ));
        cred.mintCredential(alice, 1, 1, 50);
    }

    function test_MintCredential_RevertsOnZeroAgent() public {
        vm.prank(marketplace);
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        cred.mintCredential(address(0), 1, 1, 50);
    }

    function test_MintCredential_RevertsOnInvalidSkillId() public {
        vm.prank(marketplace);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__SkillNotFound.selector, 0));
        cred.mintCredential(alice, 0, 1, 50);
    }

    function test_MintCredential_RevertsOnInvalidLevel() public {
        vm.prank(marketplace);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__InvalidLevel.selector, 0));
        cred.mintCredential(alice, 1, 0, 50);

        vm.prank(marketplace);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__InvalidLevel.selector, 4));
        cred.mintCredential(alice, 1, 4, 50);
    }

    function test_MintCredential_RevertsOnInvalidScore() public {
        vm.prank(marketplace);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__InvalidScore.selector, 101));
        cred.mintCredential(alice, 1, 1, 101);
    }

    function test_MintCredential_RevertsOnDuplicate() public {
        vm.prank(marketplace);
        cred.mintCredential(alice, 42, 2, 85);

        vm.prank(marketplace);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__AlreadyCompleted.selector, alice, 42));
        cred.mintCredential(alice, 42, 1, 70);
    }

    function test_MintCredential_MultipleSkillsSameAgent() public {
        vm.prank(marketplace);
        cred.mintCredential(alice, 1, 1, 70);

        vm.prank(marketplace);
        cred.mintCredential(alice, 2, 2, 85);

        vm.prank(marketplace);
        cred.mintCredential(alice, 3, 3, 95);

        uint256[] memory skills = cred.getAgentSkills(alice);
        assertEq(skills.length, 3);

        uint256[] memory tokens = cred.getAgentTokenIds(alice);
        assertEq(tokens.length, 3);
    }

    // ------------------------------------------------------------------
    //                   SOULBOUND TRANSFERS
    // ------------------------------------------------------------------

    function test_Transfer_Reverts() public {
        vm.prank(marketplace);
        uint256 tokenId = cred.mintCredential(alice, 42, 2, 85);

        vm.prank(alice);
        vm.expectRevert(SkillAI__TransferNotAllowed.selector);
        cred.transferFrom(alice, bob, tokenId);
    }

    function test_SafeTransfer_Reverts() public {
        vm.prank(marketplace);
        uint256 tokenId = cred.mintCredential(alice, 42, 2, 85);

        vm.prank(alice);
        vm.expectRevert(SkillAI__TransferNotAllowed.selector);
        cred.safeTransferFrom(alice, bob, tokenId, "");
    }

    function test_Approve_Reverts() public {
        vm.prank(marketplace);
        uint256 tokenId = cred.mintCredential(alice, 42, 2, 85);

        vm.prank(alice);
        vm.expectRevert(SkillAI__TransferNotAllowed.selector);
        cred.approve(bob, tokenId);
    }

    function test_SetApprovalForAll_Reverts() public {
        vm.prank(marketplace);
        cred.mintCredential(alice, 42, 2, 85);

        vm.prank(alice);
        vm.expectRevert(SkillAI__TransferNotAllowed.selector);
        cred.setApprovalForAll(bob, true);
    }

    // ------------------------------------------------------------------
    //                      ADMIN BURN
    // ------------------------------------------------------------------

    function test_AdminBurn_ByAdmin() public {
        vm.prank(marketplace);
        uint256 tokenId = cred.mintCredential(alice, 42, 2, 85);

        vm.prank(admin);
        cred.adminBurn(tokenId);

        assertFalse(cred.hasSkill(alice, 42));
        vm.expectRevert();
        cred.ownerOf(tokenId);

        assertEq(cred.getAgentSkills(alice).length, 0);
        assertEq(cred.getAgentTokenIds(alice).length, 0);
    }

    function test_AdminBurn_RevertsForNonAdmin() public {
        vm.prank(marketplace);
        uint256 tokenId = cred.mintCredential(alice, 42, 2, 85);

        bytes32 adminRole = cred.ADMIN_ROLE();
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            attacker,
            adminRole
        ));
        cred.adminBurn(tokenId);
    }

    // ------------------------------------------------------------------
    //                      VIEW FUNCTIONS
    // ------------------------------------------------------------------

    function test_GetCredentialDetails_RevertsIfNotExists() public {
        vm.expectRevert(abi.encodeWithSelector(SkillAI__SkillNotFound.selector, 999));
        cred.getCredentialDetails(999);
    }

    function test_GetAgentSkillCredential_RevertsIfNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(SkillAI__SkillNotFound.selector, 42));
        cred.getAgentSkillCredential(alice, 42);
    }

    function test_GetAgentSkillCredential_Found() public {
        vm.prank(marketplace);
        uint256 tokenId = cred.mintCredential(alice, 42, 2, 85);

        SkillTypes.CredentialData memory d = cred.getAgentSkillCredential(alice, 42);
        assertEq(d.tokenId, tokenId);
        assertEq(d.agent, alice);
        assertEq(d.skillId, 42);
    }

    function test_HasSkill_FalseIfNotMinted() public view {
        assertFalse(cred.hasSkill(alice, 42));
    }

    // ------------------------------------------------------------------
    //                      FUZZ TESTING
    // ------------------------------------------------------------------

    function testFuzz_MintCredential_ValidInputs(
        address agent,
        uint256 skillId,
        uint8 level,
        uint256 score
    ) public {
        vm.assume(agent != address(0) && agent.code.length == 0);
        skillId = bound(skillId, 1, 1e6);
        level = uint8(bound(level, 1, 3));
        score = bound(score, 0, 100);

        vm.prank(marketplace);
        uint256 tokenId = cred.mintCredential(agent, skillId, level, score);

        SkillTypes.CredentialData memory d = cred.getCredentialDetails(tokenId);
        assertEq(d.agent, agent);
        assertEq(d.skillId, skillId);
        assertEq(d.level, level);
        assertEq(d.score, score);
        assertTrue(cred.hasSkill(agent, skillId));
    }
}
