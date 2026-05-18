// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}           from "forge-std/Test.sol";
import {SkillRegistry}  from "../src/core/SkillRegistry.sol";
import {SkillTypes}     from "../src/libraries/SkillTypes.sol";
import {
    SkillAI__SkillNotFound,
    SkillAI__NotSkillCreator,
    SkillAI__InvalidContentURI,
    SkillAI__InvalidPrice,
    SkillAI__InvalidRating,
    SkillAI__ZeroAddress
} from "../src/libraries/SkillTypes.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract SkillRegistryTest is Test {
    SkillRegistry public reg;

    address public admin       = address(0xA11CE);
    address public creator     = address(0xCCCC);
    address public marketplace = address(0x1111);
    address public attacker    = address(0xDEAD);
    address public rater       = address(0xEEEE);

    function setUp() public {
        reg = new SkillRegistry(admin);
        vm.startPrank(admin);
        reg.grantMarketplaceRole(marketplace);
        reg.grantCreatorRole(creator);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    //                         HELPERS
    // ------------------------------------------------------------------

    function _validParams() internal pure returns (SkillTypes.SkillParams memory) {
        uint256[] memory prereqs = new uint256[](0);
        return SkillTypes.SkillParams({
            name: "Uniswap V3 Swap",
            description: "Execute swaps on Uniswap V3",
            category: SkillTypes.Category.DeFi,
            difficulty: SkillTypes.Difficulty.Intermediate,
            priceInWei: 0.01 ether,
            priceInUsdc: 10 * 1e6,
            prerequisites: prereqs,
            contentURI: "ipfs://QmSkillContent"
        });
    }

    // ------------------------------------------------------------------
    //                         CONSTRUCTOR
    // ------------------------------------------------------------------

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        new SkillRegistry(address(0));
    }

    function test_Constructor_SetsAdmin() public view {
        assertTrue(reg.hasRole(reg.ADMIN_ROLE(), admin));
    }

    function test_SetUp_GrantsMarketplaceRole() public view {
        assertTrue(reg.hasRole(reg.MARKETPLACE_ROLE(), marketplace));
    }

    // ------------------------------------------------------------------
    //                      CREATE SKILL
    // ------------------------------------------------------------------

    function test_CreateSkill_HappyPath() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        assertEq(id, 1);
        assertEq(reg.totalSkills(), 1);
        assertTrue(reg.isSkillActive(id));

        SkillTypes.Skill memory s = reg.getSkill(id);
        assertEq(s.creator, creator);
        assertEq(s.name, "Uniswap V3 Swap");
        assertEq(s.priceInWei, 0.01 ether);
        assertEq(uint8(s.category), uint8(SkillTypes.Category.DeFi));
        assertTrue(s.isActive);
    }

    function test_CreateSkill_RevertsIfCallerLacksCreatorRole() public {
        // Pre-build memory params so they don't consume the upcoming prank
        SkillTypes.SkillParams memory params = _validParams();
        bytes32 role = reg.CREATOR_ROLE();
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            attacker, role
        );
        vm.prank(attacker);
        vm.expectRevert(expected);
        reg.createSkill(params);
    }

    function test_GrantCreatorRole_AllowsNewPublisher() public {
        address partner = address(0xBEEF);
        vm.prank(admin);
        reg.grantCreatorRole(partner);

        vm.prank(partner);
        uint256 id = reg.createSkill(_validParams());
        assertEq(id, 1);
        assertEq(reg.getSkill(id).creator, partner);
    }

    function test_RevokeCreatorRole_BlocksFurtherPublishing() public {
        SkillTypes.SkillParams memory params = _validParams();
        bytes32 role = reg.CREATOR_ROLE();

        vm.prank(admin);
        reg.revokeCreatorRole(creator);

        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            creator, role
        );
        vm.prank(creator);
        vm.expectRevert(expected);
        reg.createSkill(params);
    }

    function test_CreateSkill_RegistersInCategoryAndCreator() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        uint256[] memory byCat = reg.getSkillsByCategory(SkillTypes.Category.DeFi);
        assertEq(byCat.length, 1);
        assertEq(byCat[0], id);

        uint256[] memory byCreator = reg.getSkillsByCreator(creator);
        assertEq(byCreator.length, 1);
        assertEq(byCreator[0], id);
    }

    function test_CreateSkill_FreeSkillAllowed() public {
        SkillTypes.SkillParams memory p = _validParams();
        p.priceInWei = 0;
        p.priceInUsdc = 0;

        vm.prank(creator);
        uint256 id = reg.createSkill(p);
        assertEq(id, 1);
    }

    function test_CreateSkill_RevertsOnEmptyContentURI() public {
        SkillTypes.SkillParams memory p = _validParams();
        p.contentURI = "";

        vm.prank(creator);
        vm.expectRevert(SkillAI__InvalidContentURI.selector);
        reg.createSkill(p);
    }

    function test_CreateSkill_RevertsOnEmptyName() public {
        SkillTypes.SkillParams memory p = _validParams();
        p.name = "";

        vm.prank(creator);
        vm.expectRevert(SkillAI__InvalidContentURI.selector);
        reg.createSkill(p);
    }

    function test_CreateSkill_RevertsOnTooHighWeiPrice() public {
        SkillTypes.SkillParams memory p = _validParams();
        p.priceInWei = 1001 ether;

        vm.prank(creator);
        vm.expectRevert(SkillAI__InvalidPrice.selector);
        reg.createSkill(p);
    }

    function test_CreateSkill_RevertsOnTooHighUsdcPrice() public {
        SkillTypes.SkillParams memory p = _validParams();
        p.priceInUsdc = 2_000_000 * 1e6;

        vm.prank(creator);
        vm.expectRevert(SkillAI__InvalidPrice.selector);
        reg.createSkill(p);
    }

    // ------------------------------------------------------------------
    //                      UPDATE SKILL
    // ------------------------------------------------------------------

    function test_UpdateSkill_ByCreator() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        SkillTypes.SkillParams memory p2 = _validParams();
        p2.name = "Uniswap V4 Swap";
        p2.priceInWei = 0.02 ether;

        vm.prank(creator);
        reg.updateSkill(id, p2);

        SkillTypes.Skill memory s = reg.getSkill(id);
        assertEq(s.name, "Uniswap V4 Swap");
        assertEq(s.priceInWei, 0.02 ether);
    }

    function test_UpdateSkill_CategoryMigration() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams()); // DeFi

        SkillTypes.SkillParams memory p2 = _validParams();
        p2.category = SkillTypes.Category.Trading;

        vm.prank(creator);
        reg.updateSkill(id, p2);

        uint256[] memory defi = reg.getSkillsByCategory(SkillTypes.Category.DeFi);
        uint256[] memory trading = reg.getSkillsByCategory(SkillTypes.Category.Trading);
        assertEq(defi.length, 0);
        assertEq(trading.length, 1);
        assertEq(trading[0], id);
    }

    function test_UpdateSkill_RevertsForAttacker() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__NotSkillCreator.selector, attacker, id));
        reg.updateSkill(id, _validParams());
    }

    function test_UpdateSkill_ByAdmin() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        SkillTypes.SkillParams memory p2 = _validParams();
        p2.name = "Admin Override";

        vm.prank(admin);
        reg.updateSkill(id, p2);

        assertEq(reg.getSkill(id).name, "Admin Override");
    }

    // ------------------------------------------------------------------
    //                    DEACTIVATE SKILL
    // ------------------------------------------------------------------

    function test_DeactivateSkill_ByCreator() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        vm.prank(creator);
        reg.deactivateSkill(id);

        assertFalse(reg.isSkillActive(id));
    }

    function test_DeactivateSkill_RevertsForAttacker() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__NotSkillCreator.selector, attacker, id));
        reg.deactivateSkill(id);
    }

    // ------------------------------------------------------------------
    //            MARKETPLACE-ONLY RECORDING FUNCTIONS
    // ------------------------------------------------------------------

    function test_RecordPurchase_OnlyMarketplace() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        bytes32 mRole = reg.MARKETPLACE_ROLE();
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            attacker,
            mRole
        ));
        reg.recordPurchase(id);

        vm.prank(marketplace);
        reg.recordPurchase(id);

        assertEq(reg.getSkill(id).totalPurchases, 1);
    }

    function test_RecordCompletion_OnlyMarketplace() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        vm.prank(marketplace);
        reg.recordCompletion(id);

        assertEq(reg.getSkill(id).totalCompletions, 1);
    }

    function test_RateSkill_OnlyMarketplace() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        vm.prank(marketplace);
        reg.rateSkill(id, 5);

        vm.prank(marketplace);
        reg.rateSkill(id, 3);

        assertEq(reg.getAverageRating(id), 400); // (5+3)/2 * 100 = 400
    }

    function test_RateSkill_RevertsOnInvalidRating() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        vm.prank(marketplace);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__InvalidRating.selector, 0));
        reg.rateSkill(id, 0);

        vm.prank(marketplace);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__InvalidRating.selector, 6));
        reg.rateSkill(id, 6);
    }

    // ------------------------------------------------------------------
    //                    VIEW FUNCTIONS
    // ------------------------------------------------------------------

    function test_GetSkill_RevertsOnUnknown() public {
        vm.expectRevert(abi.encodeWithSelector(SkillAI__SkillNotFound.selector, 999));
        reg.getSkill(999);
    }

    function test_GetAverageRating_ZeroIfNoRatings() public {
        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());
        assertEq(reg.getAverageRating(id), 0);
    }

    // ------------------------------------------------------------------
    //                    FUZZ TESTING
    // ------------------------------------------------------------------

    function testFuzz_CreateSkill_PricesWithinBounds(uint256 priceWei, uint256 priceUsdc) public {
        priceWei = bound(priceWei, 0, reg.MAX_PRICE_WEI());
        priceUsdc = bound(priceUsdc, 0, reg.MAX_PRICE_USDC());

        SkillTypes.SkillParams memory p = _validParams();
        p.priceInWei = priceWei;
        p.priceInUsdc = priceUsdc;

        vm.prank(creator);
        uint256 id = reg.createSkill(p);

        SkillTypes.Skill memory s = reg.getSkill(id);
        assertEq(s.priceInWei, priceWei);
        assertEq(s.priceInUsdc, priceUsdc);
    }

    function testFuzz_RateSkill_AverageCorrect(uint8 r1, uint8 r2, uint8 r3) public {
        r1 = uint8(bound(r1, 1, 5));
        r2 = uint8(bound(r2, 1, 5));
        r3 = uint8(bound(r3, 1, 5));

        vm.prank(creator);
        uint256 id = reg.createSkill(_validParams());

        vm.prank(marketplace); reg.rateSkill(id, r1);
        vm.prank(marketplace); reg.rateSkill(id, r2);
        vm.prank(marketplace); reg.rateSkill(id, r3);

        uint256 expected = (uint256(r1) + uint256(r2) + uint256(r3)) * 100 / 3;
        assertEq(reg.getAverageRating(id), expected);
    }
}
