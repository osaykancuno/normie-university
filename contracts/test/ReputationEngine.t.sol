// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}               from "forge-std/Test.sol";
import {AgentRegistry}      from "../src/core/AgentRegistry.sol";
import {SkillRegistry}      from "../src/core/SkillRegistry.sol";
import {SkillCredential}    from "../src/core/SkillCredential.sol";
import {ValidationRegistry} from "../src/reputation/ValidationRegistry.sol";
import {ReputationEngine}   from "../src/reputation/ReputationEngine.sol";
import {SkillTypes}         from "../src/libraries/SkillTypes.sol";
import {SkillAI__ZeroAddress} from "../src/libraries/SkillTypes.sol";

contract ReputationEngineTest is Test {
    AgentRegistry      public agentReg;
    SkillRegistry      public skillReg;
    SkillCredential    public cred;
    ValidationRegistry public valReg;
    ReputationEngine   public rep;

    address public admin       = address(0xA11CE);
    address public marketplace = address(0x1111);
    address public creator     = address(0xCCCC);
    address public validator   = address(0xBEEF);
    address public alice       = address(0xAAAA);
    address public bob         = address(0xBBBB);

    function setUp() public {
        agentReg = new AgentRegistry(admin);
        skillReg = new SkillRegistry(admin);
        cred     = new SkillCredential(admin);
        valReg   = new ValidationRegistry(admin);

        rep = new ReputationEngine(
            admin,
            address(cred),
            address(skillReg),
            address(agentReg),
            address(valReg)
        );

        vm.startPrank(admin);
        skillReg.grantMarketplaceRole(marketplace);
        skillReg.grantCreatorRole(creator);
        cred.grantMarketplaceRole(marketplace);
        valReg.grantValidatorRole(validator);
        vm.stopPrank();
    }

    // =========================================================================
    //                              HELPERS
    // =========================================================================

    function _createSkill(SkillTypes.Category cat) internal returns (uint256) {
        uint256[] memory prereqs = new uint256[](0);
        SkillTypes.SkillParams memory p = SkillTypes.SkillParams({
            name: "S", description: "d",
            category: cat,
            difficulty: SkillTypes.Difficulty.Intermediate,
            priceInWei: 0.01 ether,
            priceInUsdc: 10 * 1e6,
            prerequisites: prereqs,
            contentURI: "ipfs://Q"
        });
        vm.prank(creator);
        return skillReg.createSkill(p);
    }

    function _mintCredential(address a, uint256 skillId, uint8 level, uint256 score) internal {
        vm.prank(marketplace);
        cred.mintCredential(a, skillId, level, score);
    }

    // =========================================================================
    //                           CONSTRUCTOR
    // =========================================================================

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        new ReputationEngine(
            admin, address(0), address(skillReg), address(agentReg), address(valReg)
        );
    }

    function test_Constructor_SetsImmutables() public view {
        assertEq(address(rep.skillCredential()),    address(cred));
        assertEq(address(rep.skillRegistry()),      address(skillReg));
        assertEq(address(rep.agentRegistry()),      address(agentReg));
        assertEq(address(rep.validationRegistry()), address(valReg));
    }

    // =========================================================================
    //                         NOVICE (no skills)
    // =========================================================================

    function test_NoSkills_NoviceTier() public {
        rep.updateReputation(alice);
        assertEq(rep.getReputation(alice), 0);
        assertEq(uint8(rep.getReputationTier(alice)), uint8(SkillTypes.ReputationTier.Novice));
    }

    // =========================================================================
    //                       REGISTRATION + 1 SKILL
    // =========================================================================

    function test_SingleSkill_BumpsScore() public {
        vm.prank(alice);
        agentReg.registerAgent("ipfs://alice");

        uint256 sid = _createSkill(SkillTypes.Category.DeFi);
        _mintCredential(alice, sid, 2, 80);

        rep.updateReputation(alice);
        SkillTypes.ReputationData memory d = rep.getReputationData(alice);

        assertGt(d.score, 0);
        assertEq(d.skillCount, 1);
        assertEq(d.avgSkillLevel, 200);
        assertEq(d.categoryDiversity, 1);
        assertEq(d.avgVerifyScore, 80);
    }

    // =========================================================================
    //                         MULTIPLE SKILLS
    // =========================================================================

    function test_ManySkills_MultipleCategories_IncreaseScore() public {
        vm.prank(alice);
        agentReg.registerAgent("ipfs://alice");

        uint256 s1 = _createSkill(SkillTypes.Category.DeFi);
        uint256 s2 = _createSkill(SkillTypes.Category.NFT);
        uint256 s3 = _createSkill(SkillTypes.Category.Trading);

        _mintCredential(alice, s1, 3, 95);
        _mintCredential(alice, s2, 2, 80);
        _mintCredential(alice, s3, 3, 90);

        rep.updateReputation(alice);
        SkillTypes.ReputationData memory d = rep.getReputationData(alice);

        assertEq(d.skillCount, 3);
        assertEq(d.categoryDiversity, 3);
        // avgLevel = (3+2+3)/3 * 100 = ~266
        assertEq(d.avgSkillLevel, uint256((3 + 2 + 3) * 100) / 3);
        // avgCred = (95+80+90)/3 = 88
        assertEq(d.avgVerifyScore, uint256(95 + 80 + 90) / 3);

        assertGt(d.score, 2_000);
    }

    // =========================================================================
    //                    VALIDATION SCORES BLEND
    // =========================================================================

    function test_ValidationScoresBlendedIntoReputation() public {
        vm.prank(alice);
        agentReg.registerAgent("ipfs://alice");

        uint256 sid = _createSkill(SkillTypes.Category.DeFi);
        _mintCredential(alice, sid, 2, 100);

        // Request validation, validator scores 50
        reg_request(validator, alice, sid);
        vm.prank(validator);
        valReg.validationResponse(keccak256(abi.encode(alice, sid, uint8(0))), 50);

        rep.updateReputation(alice);
        SkillTypes.ReputationData memory d = rep.getReputationData(alice);
        // Blend: (credScore 100 + valAvg 50) / 2 = 75
        assertEq(d.avgVerifyScore, 75);
    }

    function reg_request(address v, address a, uint256 sid) internal {
        bytes32 h = keccak256(abi.encode(a, sid, uint8(0)));
        valReg.validationRequest(v, a, h, sid);
    }

    // =========================================================================
    //                    TIME ON PLATFORM FACTOR
    // =========================================================================

    function test_TimeOnPlatform_FullYearMaxesFactor() public {
        vm.prank(alice);
        agentReg.registerAgent("ipfs://alice");

        uint256 sid = _createSkill(SkillTypes.Category.DeFi);
        _mintCredential(alice, sid, 1, 50);

        rep.updateReputation(alice);
        uint256 earlyScore = rep.getReputation(alice);

        vm.warp(block.timestamp + 365 days);
        rep.updateReputation(alice);
        uint256 lateScore = rep.getReputation(alice);

        assertGt(lateScore, earlyScore);
    }

    // =========================================================================
    //                    LEADERBOARD
    // =========================================================================

    function test_Leaderboard_OrdersByScore() public {
        vm.prank(alice); agentReg.registerAgent("ipfs://a");
        vm.prank(bob);   agentReg.registerAgent("ipfs://b");

        uint256 s1 = _createSkill(SkillTypes.Category.DeFi);
        uint256 s2 = _createSkill(SkillTypes.Category.NFT);
        uint256 s3 = _createSkill(SkillTypes.Category.Trading);

        // Alice: 3 skills
        _mintCredential(alice, s1, 3, 95);
        _mintCredential(alice, s2, 3, 95);
        _mintCredential(alice, s3, 3, 95);

        // Bob: 1 skill
        _mintCredential(bob, s1, 1, 50);

        rep.updateReputation(alice);
        rep.updateReputation(bob);

        (address[] memory agents, uint256[] memory scores) = rep.getLeaderboard(2);
        assertEq(agents.length, 2);
        assertEq(agents[0], alice);
        assertEq(agents[1], bob);
        assertGt(scores[0], scores[1]);
    }

    function test_Leaderboard_CapsAtTotal() public {
        vm.prank(alice); agentReg.registerAgent("ipfs://a");
        uint256 sid = _createSkill(SkillTypes.Category.DeFi);
        _mintCredential(alice, sid, 1, 50);
        rep.updateReputation(alice);

        (address[] memory agents, ) = rep.getLeaderboard(100);
        assertEq(agents.length, 1);
    }

    // =========================================================================
    //                    PREVIEW (non-mutating)
    // =========================================================================

    function test_Preview_DoesNotStoreScore() public {
        uint256 sid = _createSkill(SkillTypes.Category.DeFi);
        _mintCredential(alice, sid, 2, 80);

        SkillTypes.ReputationData memory preview = rep.previewReputation(alice);
        assertGt(preview.score, 0);

        // Not yet stored
        assertEq(rep.getReputation(alice), 0);
    }

    // =========================================================================
    //                    TIER THRESHOLDS
    // =========================================================================

    function test_TierThresholds() public {
        // Alice: register + many high-quality skills → should reach Expert/Master
        vm.prank(alice); agentReg.registerAgent("ipfs://a");

        uint256[] memory sids = new uint256[](8);
        sids[0] = _createSkill(SkillTypes.Category.DeFi);
        sids[1] = _createSkill(SkillTypes.Category.NFT);
        sids[2] = _createSkill(SkillTypes.Category.Governance);
        sids[3] = _createSkill(SkillTypes.Category.Social);
        sids[4] = _createSkill(SkillTypes.Category.Trading);
        sids[5] = _createSkill(SkillTypes.Category.Security);
        sids[6] = _createSkill(SkillTypes.Category.CrossChain);
        sids[7] = _createSkill(SkillTypes.Category.Custom);

        for (uint256 i = 0; i < 8; ++i) {
            _mintCredential(alice, sids[i], 3, 100);
        }

        vm.warp(block.timestamp + 365 days);
        rep.updateReputation(alice);

        // Should be at least Skilled, likely Expert/Master
        uint8 tier = uint8(rep.getReputationTier(alice));
        assertGe(tier, uint8(SkillTypes.ReputationTier.Skilled));
    }
}
