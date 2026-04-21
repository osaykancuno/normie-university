// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}           from "forge-std/Test.sol";
import {AgentRegistry}  from "../src/core/AgentRegistry.sol";
import {SkillTypes}     from "../src/libraries/SkillTypes.sol";
import {
    SkillAI__InvalidMetadataURI,
    SkillAI__ZeroAddress,
    SkillAI__NotRegistered,
    SkillAI__Cooldown
} from "../src/libraries/SkillTypes.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable}       from "@openzeppelin/contracts/utils/Pausable.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;

    address public admin    = address(0xA11CE);
    address public alice    = address(0xAAAA);
    address public bob      = address(0xBBBB);
    address public attacker = address(0xDEAD);

    string constant URI_ALICE = "ipfs://QmAlice";
    string constant URI_BOB   = "ipfs://QmBob";

    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed agent,
        string registrationFileURI,
        uint256 timestamp
    );
    event AgentUpdated(
        uint256 indexed tokenId,
        address indexed agent,
        string registrationFileURI,
        uint256 timestamp
    );
    event AgentDeactivated(uint256 indexed tokenId, address indexed agent, uint256 timestamp);

    function setUp() public {
        registry = new AgentRegistry(admin);
    }

    // =========================================================================
    //                          CONSTRUCTOR
    // =========================================================================

    function test_Constructor_SetsAdminRoles() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(registry.ADMIN_ROLE(), admin));
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        new AgentRegistry(address(0));
    }

    function test_Constructor_InitialStateIsZero() public view {
        assertEq(registry.totalAgents(), 0);
        assertEq(registry.totalSupply(), 0);
    }

    // =========================================================================
    //                        REGISTER AGENT
    // =========================================================================

    function test_RegisterAgent_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(1, alice, URI_ALICE, block.timestamp);

        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);

        assertEq(tokenId, 1);
        assertEq(registry.ownerOf(1), alice);
        assertEq(registry.balanceOf(alice), 1);
        assertEq(registry.totalAgents(), 1);
        assertTrue(registry.isRegistered(alice));
        assertTrue(registry.isAgentActive(1));
        assertEq(registry.primaryTokenId(alice), 1);

        SkillTypes.AgentProfile memory p = registry.getAgent(1);
        assertEq(p.tokenId, 1);
        assertEq(p.agentAddress, alice);
        assertEq(p.registrationFileURI, URI_ALICE);
        assertTrue(p.isActive);
    }

    function test_RegisterAgent_MultipleDifferentOwners() public {
        vm.prank(alice);
        uint256 aliceId = registry.registerAgent(URI_ALICE);
        vm.prank(bob);
        uint256 bobId = registry.registerAgent(URI_BOB);

        assertEq(aliceId, 1);
        assertEq(bobId, 2);
        assertEq(registry.totalAgents(), 2);
        assertEq(registry.primaryTokenId(alice), 1);
        assertEq(registry.primaryTokenId(bob), 2);
    }

    function test_RegisterAgent_RevertsOnEmptyURI() public {
        vm.prank(alice);
        vm.expectRevert(SkillAI__InvalidMetadataURI.selector);
        registry.registerAgent("");
    }

    function test_RegisterAgent_RevertsOnCooldown() public {
        vm.prank(alice);
        registry.registerAgent(URI_ALICE);

        // Cache before prank to avoid consuming it in a view call
        uint256 availableAt = block.timestamp + registry.REGISTRATION_COOLDOWN();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__Cooldown.selector, availableAt));
        registry.registerAgent(URI_BOB);
    }

    function test_RegisterAgent_SucceedsAfterCooldown() public {
        vm.prank(alice);
        registry.registerAgent(URI_ALICE);

        vm.warp(block.timestamp + registry.REGISTRATION_COOLDOWN() + 1);

        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_BOB);
        assertEq(tokenId, 2);
        assertEq(registry.balanceOf(alice), 2);
        // Primary stays on the first token
        assertEq(registry.primaryTokenId(alice), 1);
    }

    function test_RegisterAgent_RevertsWhenPaused() public {
        vm.prank(admin);
        registry.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.registerAgent(URI_ALICE);
    }

    // =========================================================================
    //                        UPDATE AGENT
    // =========================================================================

    function test_UpdateAgent_ByOwner() public {
        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);

        vm.warp(block.timestamp + 10);

        vm.expectEmit(true, true, false, true);
        emit AgentUpdated(tokenId, alice, "ipfs://QmNew", block.timestamp);

        vm.prank(alice);
        registry.updateAgent(tokenId, "ipfs://QmNew");

        SkillTypes.AgentProfile memory p = registry.getAgent(tokenId);
        assertEq(p.registrationFileURI, "ipfs://QmNew");
        assertEq(p.updatedAt, block.timestamp);
    }

    function test_UpdateAgent_ByAdmin() public {
        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);

        vm.prank(admin);
        registry.updateAgent(tokenId, "ipfs://QmAdmin");

        SkillTypes.AgentProfile memory p = registry.getAgent(tokenId);
        assertEq(p.registrationFileURI, "ipfs://QmAdmin");
    }

    function test_UpdateAgent_RevertsForNonOwner() public {
        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__NotRegistered.selector, attacker));
        registry.updateAgent(tokenId, "ipfs://QmMalicious");
    }

    function test_UpdateAgent_RevertsOnEmptyURI() public {
        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);

        vm.prank(alice);
        vm.expectRevert(SkillAI__InvalidMetadataURI.selector);
        registry.updateAgent(tokenId, "");
    }

    // =========================================================================
    //                      DEACTIVATE AGENT
    // =========================================================================

    function test_DeactivateAgent_ByOwner() public {
        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);

        vm.expectEmit(true, true, false, true);
        emit AgentDeactivated(tokenId, alice, block.timestamp);

        vm.prank(alice);
        registry.deactivateAgent(tokenId);

        assertFalse(registry.isRegistered(alice));
        assertFalse(registry.isAgentActive(tokenId));
        assertEq(registry.ownerOf(tokenId), alice); // NFT still held
    }

    function test_DeactivateAgent_RevertsForNonOwner() public {
        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__NotRegistered.selector, attacker));
        registry.deactivateAgent(tokenId);
    }

    // =========================================================================
    //                         VIEW FUNCTIONS
    // =========================================================================

    function test_GetAgent_RevertsForInexistentToken() public {
        vm.expectRevert();
        registry.getAgent(999);
    }

    function test_GetAgentsByOwner() public {
        vm.prank(alice);
        registry.registerAgent(URI_ALICE);

        vm.warp(block.timestamp + registry.REGISTRATION_COOLDOWN() + 1);
        vm.prank(alice);
        registry.registerAgent("ipfs://QmAlice2");

        uint256[] memory ids = registry.getAgentsByOwner(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_TokenURI_ReturnsRegistrationFileURI() public {
        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);
        assertEq(registry.tokenURI(tokenId), URI_ALICE);
    }

    // =========================================================================
    //                            NFT TRANSFER
    // =========================================================================

    function test_Transfer_UpdatesAgentAddressAndPrimary() public {
        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);

        vm.prank(alice);
        registry.transferFrom(alice, bob, tokenId);

        assertEq(registry.ownerOf(tokenId), bob);
        assertEq(registry.primaryTokenId(alice), 0);
        assertEq(registry.primaryTokenId(bob), tokenId);

        SkillTypes.AgentProfile memory p = registry.getAgent(tokenId);
        assertEq(p.agentAddress, bob);
    }

    function test_Transfer_PromotesNewPrimaryWhenMultipleTokens() public {
        vm.prank(alice);
        registry.registerAgent(URI_ALICE);

        vm.warp(block.timestamp + registry.REGISTRATION_COOLDOWN() + 1);
        vm.prank(alice);
        uint256 t2 = registry.registerAgent("ipfs://QmAlice2");

        // alice transfers t1 (her primary) to bob
        vm.prank(alice);
        registry.transferFrom(alice, bob, 1);

        // alice's new primary should be t2
        assertEq(registry.primaryTokenId(alice), t2);
    }

    // =========================================================================
    //                         ADMIN / PAUSE
    // =========================================================================

    function test_Pause_OnlyAdmin() public {
        // Cache role before prank to avoid consuming it in a view call
        bytes32 adminRole = registry.ADMIN_ROLE();

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            attacker,
            adminRole
        ));
        registry.pause();
    }

    function test_Unpause_RestoresFunctionality() public {
        vm.prank(admin);
        registry.pause();

        vm.prank(admin);
        registry.unpause();

        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);
        assertEq(tokenId, 1);
    }

    // =========================================================================
    //                         FUZZ TESTING
    // =========================================================================

    function testFuzz_RegisterAgent_ManyAddresses(address[10] memory agents) public {
        uint256 expected = 0;
        for (uint256 i = 0; i < agents.length; ++i) {
            address a = agents[i];
            if (a == address(0) || a.code.length > 0) continue; // skip precompiles / zero
            if (registry.balanceOf(a) > 0) continue; // skip duplicates in fuzz input

            vm.prank(a);
            registry.registerAgent("ipfs://Qm");
            expected++;
        }
        assertEq(registry.totalAgents(), expected);
    }

    function testFuzz_UpdateAgent_URIPreserved(string memory newURI) public {
        vm.assume(bytes(newURI).length > 0 && bytes(newURI).length < 512);

        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(URI_ALICE);

        vm.prank(alice);
        registry.updateAgent(tokenId, newURI);

        SkillTypes.AgentProfile memory p = registry.getAgent(tokenId);
        assertEq(p.registrationFileURI, newURI);
    }
}
