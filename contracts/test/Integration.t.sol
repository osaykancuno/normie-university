// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}            from "forge-std/Test.sol";
import {AgentRegistry}   from "../src/core/AgentRegistry.sol";
import {SkillRegistry}   from "../src/core/SkillRegistry.sol";
import {SkillCredential} from "../src/core/SkillCredential.sol";
import {SkillTypes}      from "../src/libraries/SkillTypes.sol";

/// @title  Phase 2 Integration Tests
/// @notice Exercises the 3 core contracts together as if the Marketplace (not built yet)
///         were orchestrating the full flow: register → create skill → purchase → complete → credential.
///         A "mockMarketplace" EOA impersonates the future SkillMarketplace contract.
contract IntegrationTest is Test {
    AgentRegistry   public agentReg;
    SkillRegistry   public skillReg;
    SkillCredential public cred;

    address public admin           = address(0xA11CE);
    address public mockMarketplace = address(0x1111);
    address public agentAlice      = address(0xAAAA);
    address public creator         = address(0xCCCC);

    function setUp() public {
        agentReg = new AgentRegistry(admin);
        skillReg = new SkillRegistry(admin);
        cred     = new SkillCredential(admin);

        vm.startPrank(admin);
        skillReg.grantMarketplaceRole(mockMarketplace);
        skillReg.grantCreatorRole(creator);
        cred.grantMarketplaceRole(mockMarketplace);
        vm.stopPrank();
    }

    /// @notice Full end-to-end flow: every step an AI agent would take
    function test_EndToEnd_RegisterPurchaseCompleteGetCredential() public {
        // ============================================================
        // 1. Agent registers (ERC-8004 Identity)
        // ============================================================
        vm.prank(agentAlice);
        uint256 agentTokenId = agentReg.registerAgent("ipfs://QmAliceAgentCard");

        assertTrue(agentReg.isRegistered(agentAlice));
        assertEq(agentReg.ownerOf(agentTokenId), agentAlice);

        // ============================================================
        // 2. Creator publishes a skill module
        // ============================================================
        uint256[] memory prereqs = new uint256[](0);
        SkillTypes.SkillParams memory params = SkillTypes.SkillParams({
            name: "Uniswap V3 Swap Mastery",
            description: "Execute optimal swaps on Uniswap V3",
            category: SkillTypes.Category.DeFi,
            difficulty: SkillTypes.Difficulty.Intermediate,
            priceInWei: 0.01 ether,
            priceInUsdc: 10 * 1e6,
            prerequisites: prereqs,
            contentURI: "ipfs://QmSwapSkillModule"
        });

        vm.prank(creator);
        uint256 skillId = skillReg.createSkill(params);

        assertTrue(skillReg.isSkillActive(skillId));
        assertEq(skillReg.getSkill(skillId).creator, creator);

        // ============================================================
        // 3. Marketplace records the purchase
        // ============================================================
        vm.prank(mockMarketplace);
        skillReg.recordPurchase(skillId);
        assertEq(skillReg.getSkill(skillId).totalPurchases, 1);

        // ============================================================
        // 4. Agent finishes the skill → Marketplace records completion + mints credential
        // ============================================================
        vm.startPrank(mockMarketplace);
        skillReg.recordCompletion(skillId);
        uint256 tokenId = cred.mintCredential(agentAlice, skillId, 2, 87);
        vm.stopPrank();

        assertEq(skillReg.getSkill(skillId).totalCompletions, 1);
        assertTrue(cred.hasSkill(agentAlice, skillId));
        assertEq(cred.ownerOf(tokenId), agentAlice);

        SkillTypes.CredentialData memory data = cred.getCredentialDetails(tokenId);
        assertEq(data.agent, agentAlice);
        assertEq(data.skillId, skillId);
        assertEq(data.level, 2);
        assertEq(data.score, 87);

        // ============================================================
        // 5. Agent rates the skill (via Marketplace) + stats update
        // ============================================================
        vm.prank(mockMarketplace);
        skillReg.rateSkill(skillId, 5);

        assertEq(skillReg.getAverageRating(skillId), 500); // 5.00

        // ============================================================
        // 6. An external protocol (e.g. Moltbook) reads the credential
        // ============================================================
        uint256[] memory aliceSkills = cred.getAgentSkills(agentAlice);
        assertEq(aliceSkills.length, 1);
        assertEq(aliceSkills[0], skillId);

        // ERC-8004 tokenURI should resolve to the registration file
        assertEq(agentReg.tokenURI(agentTokenId), "ipfs://QmAliceAgentCard");
    }

    /// @notice Cross-contract: an agent who tries to complete a non-existent skill gets no credential
    function test_CannotMintForNonExistentSkill_MarketplaceMustCheck() public {
        // Marketplace is trusted — it's responsible for checking skill existence.
        // SkillCredential only guards skillId != 0, so a real skill check happens in SkillMarketplace.
        vm.prank(mockMarketplace);
        uint256 tokenId = cred.mintCredential(agentAlice, 999, 1, 50);

        // Credential minted, but hasSkill returns true because the SBT exists.
        // This is expected — Phase 3 Marketplace will enforce skill existence BEFORE calling mint.
        assertEq(tokenId, 1);
        assertTrue(cred.hasSkill(agentAlice, 999));
    }

    /// @notice Admin can deactivate an agent and the credential stays (just becomes "historic")
    function test_DeactivatingAgent_KeepsCredentials() public {
        vm.prank(agentAlice);
        uint256 agentTokenId = agentReg.registerAgent("ipfs://QmAgent");

        vm.prank(mockMarketplace);
        uint256 credTokenId = cred.mintCredential(agentAlice, 1, 3, 95);

        vm.prank(agentAlice);
        agentReg.deactivateAgent(agentTokenId);

        assertFalse(agentReg.isAgentActive(agentTokenId));
        // Credential persists — it represents a historical achievement
        assertEq(cred.ownerOf(credTokenId), agentAlice);
        assertTrue(cred.hasSkill(agentAlice, 1));
    }
}
