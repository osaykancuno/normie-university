// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}             from "forge-std/Test.sol";
import {AgentRegistry}    from "../src/core/AgentRegistry.sol";
import {SkillRegistry}    from "../src/core/SkillRegistry.sol";
import {SkillCredential}  from "../src/core/SkillCredential.sol";
import {Treasury}         from "../src/treasury/Treasury.sol";
import {SkillMarketplace} from "../src/marketplace/SkillMarketplace.sol";
import {PathRegistry}     from "../src/marketplace/PathRegistry.sol";
import {IPathRegistry}    from "../src/interfaces/IPathRegistry.sol";
import {MockUSDC}         from "./mocks/MockUSDC.sol";
import {SkillTypes}       from "../src/libraries/SkillTypes.sol";
import {
    SkillAI__InsufficientPayment,
    SkillAI__PathNotFound,
    SkillAI__PathNotActive,
    SkillAI__PathEmpty,
    SkillAI__InvalidDiscount,
    SkillAI__AlreadyPurchased
} from "../src/libraries/SkillTypes.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract PathRegistryTest is Test {
    AgentRegistry    public agentReg;
    SkillRegistry    public skillReg;
    SkillCredential  public cred;
    Treasury         public treasury;
    SkillMarketplace public market;
    PathRegistry     public pathReg;
    MockUSDC         public usdc;

    address public admin    = address(0xA11CE);
    address public creator  = address(0xCCCC);
    address public agent    = address(0xAAAA);
    address public attacker = address(0xDEAD);

    uint256 public constant PRICE_ETH_BEGINNER = 0.0004 ether; // $1
    uint256 public constant PRICE_ETH_INTER    = 0.002 ether;  // $5
    uint256 public constant PRICE_USDC_BEGINNER = 1 * 1e6;
    uint256 public constant PRICE_USDC_INTER    = 5 * 1e6;

    function setUp() public {
        agentReg = new AgentRegistry(admin);
        skillReg = new SkillRegistry(admin);
        cred     = new SkillCredential(admin);
        treasury = new Treasury(admin);
        usdc     = new MockUSDC();

        market = new SkillMarketplace(
            admin, address(skillReg), address(cred), address(treasury), address(usdc)
        );
        pathReg = new PathRegistry(
            admin, address(skillReg), address(market), address(usdc)
        );

        vm.startPrank(admin);
        skillReg.grantMarketplaceRole(address(market));
        skillReg.grantCreatorRole(creator);
        cred.grantMarketplaceRole(address(market));
        market.grantPathRole(address(pathReg));
        vm.stopPrank();

        vm.deal(agent, 10 ether);
        usdc.mint(agent, 10_000 * 1e6);
    }

    function _createSkill(uint256 priceEth, uint256 priceUsdc) internal returns (uint256 id) {
        uint256[] memory prereqs = new uint256[](0);
        SkillTypes.SkillParams memory p = SkillTypes.SkillParams({
            name: "Test Skill",
            description: "x",
            category: SkillTypes.Category.DeFi,
            difficulty: SkillTypes.Difficulty.Beginner,
            priceInWei: priceEth,
            priceInUsdc: priceUsdc,
            prerequisites: prereqs,
            contentURI: "ipfs://x"
        });
        vm.prank(creator);
        id = skillReg.createSkill(p);
    }

    function _pathParams(uint256[] memory ids, uint16 discountBps)
        internal
        pure
        returns (IPathRegistry.PathParams memory)
    {
        return IPathRegistry.PathParams({
            name: "DeFi Fundamentals",
            description: "Path of foundational DeFi skills",
            skillIds: ids,
            discountBps: discountBps,
            contentURI: "ipfs://path"
        });
    }

    // ------------------------------------------------------------------
    //                        CREATE PATH
    // ------------------------------------------------------------------

    function test_CreatePath_HappyPath() public {
        uint256 s1 = _createSkill(PRICE_ETH_BEGINNER, PRICE_USDC_BEGINNER);
        uint256 s2 = _createSkill(PRICE_ETH_INTER,    PRICE_USDC_INTER);
        uint256[] memory ids = new uint256[](2);
        ids[0] = s1; ids[1] = s2;

        vm.prank(admin);
        uint256 pid = pathReg.createPath(_pathParams(ids, 2500));
        assertEq(pid, 1);
        assertEq(pathReg.totalPaths(), 1);

        IPathRegistry.Path memory p = pathReg.getPath(pid);
        assertEq(p.name, "DeFi Fundamentals");
        assertEq(p.skillIds.length, 2);
        assertEq(p.discountBps, 2500);
        assertTrue(p.isActive);
    }

    function test_CreatePath_RevertsForNonCreator() public {
        uint256 s1 = _createSkill(PRICE_ETH_BEGINNER, PRICE_USDC_BEGINNER);
        uint256[] memory ids = new uint256[](1); ids[0] = s1;
        IPathRegistry.PathParams memory params = _pathParams(ids, 2500);
        bytes32 role = pathReg.CREATOR_ROLE();
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, role
        );
        vm.prank(attacker);
        vm.expectRevert(expected);
        pathReg.createPath(params);
    }

    function test_CreatePath_RevertsOnEmptySkillList() public {
        uint256[] memory ids = new uint256[](0);
        IPathRegistry.PathParams memory params = _pathParams(ids, 2500);
        vm.prank(admin);
        vm.expectRevert(SkillAI__PathEmpty.selector);
        pathReg.createPath(params);
    }

    function test_CreatePath_RevertsOnDiscountTooHigh() public {
        uint256 s1 = _createSkill(PRICE_ETH_BEGINNER, PRICE_USDC_BEGINNER);
        uint256[] memory ids = new uint256[](1); ids[0] = s1;
        IPathRegistry.PathParams memory params = _pathParams(ids, 6000); // > MAX_DISCOUNT_BPS=5000
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__InvalidDiscount.selector, uint16(6000)));
        pathReg.createPath(params);
    }

    // ------------------------------------------------------------------
    //                        PURCHASE PATH (ETH)
    // ------------------------------------------------------------------

    function test_PurchasePath_Eth_RecordsAllSkillsAndEscrows() public {
        // Path of 2 skills, total $6 → 25% off → $4.50
        uint256 s1 = _createSkill(PRICE_ETH_BEGINNER, PRICE_USDC_BEGINNER); // $1
        uint256 s2 = _createSkill(PRICE_ETH_INTER,    PRICE_USDC_INTER);    // $5
        uint256[] memory ids = new uint256[](2); ids[0] = s1; ids[1] = s2;

        vm.prank(admin);
        uint256 pid = pathReg.createPath(_pathParams(ids, 2500));

        uint256 totalRegular = PRICE_ETH_BEGINNER + PRICE_ETH_INTER;
        uint256 priceEth     = pathReg.getPathPriceInWei(pid);
        assertEq(priceEth, (totalRegular * 7500) / 10_000);

        uint256 marketBalBefore = address(market).balance;

        vm.prank(agent);
        pathReg.purchasePath{value: priceEth}(pid);

        // Both purchases recorded (escrowed)
        assertTrue(market.hasPurchased(agent, s1));
        assertTrue(market.hasPurchased(agent, s2));
        // Bundle ETH ended up in the marketplace as escrow until completion
        assertEq(address(market).balance - marketBalBefore, priceEth);
        // PathRegistry holds no leftover ETH
        assertEq(address(pathReg).balance, 0);

        // Per-skill purchase amounts sum to exactly priceEth (no dust loss)
        SkillTypes.Purchase memory p1 = market.getPurchase(agent, s1);
        SkillTypes.Purchase memory p2 = market.getPurchase(agent, s2);
        assertEq(p1.amountPaid + p2.amountPaid, priceEth);
    }

    function test_PurchasePath_RevertsOnUnderpayment() public {
        uint256 s1 = _createSkill(PRICE_ETH_BEGINNER, PRICE_USDC_BEGINNER);
        uint256 s2 = _createSkill(PRICE_ETH_INTER,    PRICE_USDC_INTER);
        uint256[] memory ids = new uint256[](2); ids[0] = s1; ids[1] = s2;

        vm.prank(admin);
        uint256 pid = pathReg.createPath(_pathParams(ids, 2500));
        uint256 needed = pathReg.getPathPriceInWei(pid);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__InsufficientPayment.selector, needed - 1, needed
        ));
        pathReg.purchasePath{value: needed - 1}(pid);
    }

    function test_PurchasePath_RefundsOverpayment() public {
        uint256 s1 = _createSkill(PRICE_ETH_BEGINNER, PRICE_USDC_BEGINNER);
        uint256[] memory ids = new uint256[](1); ids[0] = s1;
        vm.prank(admin);
        uint256 pid = pathReg.createPath(_pathParams(ids, 2500));

        uint256 priceEth = pathReg.getPathPriceInWei(pid);
        uint256 sent = priceEth + 0.5 ether;
        uint256 balBefore = agent.balance;

        vm.prank(agent);
        pathReg.purchasePath{value: sent}(pid);

        // Spent exactly priceEth
        assertEq(balBefore - agent.balance, priceEth);
    }

    function test_PurchasePath_RevertsIfAlreadyPurchasedOneSkill() public {
        // Buy skill #1 individually first, then try to buy a path containing it.
        uint256 s1 = _createSkill(PRICE_ETH_BEGINNER, PRICE_USDC_BEGINNER);
        uint256 s2 = _createSkill(PRICE_ETH_INTER,    PRICE_USDC_INTER);

        vm.prank(agent);
        market.purchaseSkill{value: PRICE_ETH_BEGINNER}(s1);

        uint256[] memory ids = new uint256[](2); ids[0] = s1; ids[1] = s2;
        vm.prank(admin);
        uint256 pid = pathReg.createPath(_pathParams(ids, 2500));
        uint256 priceEth = pathReg.getPathPriceInWei(pid);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__AlreadyPurchased.selector, agent, s1
        ));
        pathReg.purchasePath{value: priceEth}(pid);
    }

    // ------------------------------------------------------------------
    //                        PURCHASE PATH (USDC)
    // ------------------------------------------------------------------

    function test_PurchasePath_Usdc_HappyPath() public {
        uint256 s1 = _createSkill(0, PRICE_USDC_BEGINNER);
        uint256 s2 = _createSkill(0, PRICE_USDC_INTER);
        uint256[] memory ids = new uint256[](2); ids[0] = s1; ids[1] = s2;

        vm.prank(admin);
        uint256 pid = pathReg.createPath(_pathParams(ids, 2500));

        uint256 priceUsdc = pathReg.getPathPriceInUsdc(pid);
        assertEq(priceUsdc, ((PRICE_USDC_BEGINNER + PRICE_USDC_INTER) * 7500) / 10_000);

        vm.prank(agent);
        usdc.approve(address(pathReg), priceUsdc);
        vm.prank(agent);
        pathReg.purchasePathWithUsdc(pid);

        assertTrue(market.hasPurchased(agent, s1));
        assertTrue(market.hasPurchased(agent, s2));
    }

    // ------------------------------------------------------------------
    //                       PATH ACL — purchaseSkillForPath
    // ------------------------------------------------------------------

    function test_MarketplacePurchaseSkillForPath_RevertsForNonPathRole() public {
        uint256 s1 = _createSkill(PRICE_ETH_BEGINNER, PRICE_USDC_BEGINNER);
        bytes32 role = market.PATH_ROLE();
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, role
        );
        vm.prank(attacker);
        vm.expectRevert(expected);
        market.purchaseSkillForPath(agent, s1, 1, false);
    }

    // ------------------------------------------------------------------
    //                       DEACTIVATE PATH
    // ------------------------------------------------------------------

    function test_DeactivatePath_BlocksPurchase() public {
        uint256 s1 = _createSkill(PRICE_ETH_BEGINNER, PRICE_USDC_BEGINNER);
        uint256[] memory ids = new uint256[](1); ids[0] = s1;
        vm.prank(admin);
        uint256 pid = pathReg.createPath(_pathParams(ids, 2500));

        vm.prank(admin);
        pathReg.deactivatePath(pid);

        uint256 priceEth = pathReg.getPathPriceInWei(pid);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__PathNotActive.selector, pid));
        pathReg.purchasePath{value: priceEth}(pid);
    }
}
