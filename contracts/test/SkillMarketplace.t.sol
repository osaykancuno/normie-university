// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}              from "forge-std/Test.sol";
import {AgentRegistry}     from "../src/core/AgentRegistry.sol";
import {SkillRegistry}     from "../src/core/SkillRegistry.sol";
import {SkillCredential}   from "../src/core/SkillCredential.sol";
import {Treasury}          from "../src/treasury/Treasury.sol";
import {SkillMarketplace}  from "../src/marketplace/SkillMarketplace.sol";
import {MockUSDC}          from "./mocks/MockUSDC.sol";
import {SkillTypes}        from "../src/libraries/SkillTypes.sol";
import {IAccessControl}    from "@openzeppelin/contracts/access/IAccessControl.sol";
import {
    SkillAI__InsufficientPayment,
    SkillAI__AlreadyPurchased,
    SkillAI__AlreadyCompleted,
    SkillAI__PurchaseNotFound,
    SkillAI__NotCompleted,
    SkillAI__AlreadyRated,
    SkillAI__InvalidRating,
    SkillAI__InvalidLevel,
    SkillAI__InvalidSignature,
    SkillAI__PrerequisiteNotMet,
    SkillAI__UsdcNotSupported,
    SkillAI__UsdcNotConfigured,
    SkillAI__RefundNotReady,
    SkillAI__ZeroAddress,
    SkillAI__SkillNotFound,
    SkillAI__SkillNotActive
} from "../src/libraries/SkillTypes.sol";

contract SkillMarketplaceTest is Test {
    AgentRegistry     public agentReg;
    SkillRegistry     public skillReg;
    SkillCredential   public cred;
    Treasury          public treasury;
    SkillMarketplace  public market;
    MockUSDC          public usdc;

    address public admin    = address(0xA11CE);
    address public creator  = address(0xCCCC);
    address public agent;
    address public buyer    = address(0xBBBB);
    address public attacker = address(0xDEAD);

    uint256 public verifierPk = 0xA11CEDEADBEEF;
    address public verifier;

    uint256 constant PRICE_ETH  = 0.01 ether;
    uint256 constant PRICE_USDC = 10 * 1e6;

    function setUp() public {
        verifier = vm.addr(verifierPk);
        agent    = vm.addr(0xAAAA);

        agentReg = new AgentRegistry(admin);
        skillReg = new SkillRegistry(admin);
        cred     = new SkillCredential(admin);
        treasury = new Treasury(admin);
        usdc     = new MockUSDC();

        market = new SkillMarketplace(
            admin,
            address(skillReg),
            address(cred),
            address(treasury),
            address(usdc)
        );

        vm.startPrank(admin);
        skillReg.grantMarketplaceRole(address(market));
        skillReg.grantCreatorRole(creator);
        cred.grantMarketplaceRole(address(market));
        market.grantVerifierRole(verifier);
        vm.stopPrank();

        // Fund buyers
        vm.deal(agent, 10 ether);
        vm.deal(buyer, 10 ether);
        usdc.mint(agent, 10_000 * 1e6);
        usdc.mint(buyer, 10_000 * 1e6);
    }

    // =========================================================================
    //                               HELPERS
    // =========================================================================

    function _createSkill(uint256 priceWei, uint256 priceUsdc)
        internal
        returns (uint256 skillId)
    {
        uint256[] memory prereqs = new uint256[](0);
        SkillTypes.SkillParams memory p = SkillTypes.SkillParams({
            name: "Uniswap V3 Swap",
            description: "Swap on Uniswap V3",
            category: SkillTypes.Category.DeFi,
            difficulty: SkillTypes.Difficulty.Intermediate,
            priceInWei: priceWei,
            priceInUsdc: priceUsdc,
            prerequisites: prereqs,
            contentURI: "ipfs://QmSkill"
        });
        vm.prank(creator);
        skillId = skillReg.createSkill(p);
    }

    function _signCompletion(
        address a,
        uint256 skillId,
        uint8 level,
        uint256 score
    ) internal view returns (bytes memory) {
        bytes32 payload = keccak256(abi.encodePacked(
            a, skillId, level, score, block.chainid, address(market)
        ));
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", payload)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // =========================================================================
    //                             CONSTRUCTOR
    // =========================================================================

    function test_Constructor_RevertsOnZeroAdmin() public {
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        new SkillMarketplace(address(0), address(skillReg), address(cred), address(treasury), address(usdc));
    }

    // =========================================================================
    //                          PURCHASE (ETH)
    // =========================================================================

    function test_PurchaseEth_HappyPath() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);

        vm.prank(agent);
        market.purchaseSkill{value: PRICE_ETH}(skillId);

        assertTrue(market.hasPurchased(agent, skillId));
        assertEq(address(market).balance, PRICE_ETH);
        assertEq(skillReg.getSkill(skillId).totalPurchases, 1);
    }

    function test_PurchaseEth_RefundsOverpayment() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        uint256 balBefore = agent.balance;

        vm.prank(agent);
        market.purchaseSkill{value: PRICE_ETH + 0.5 ether}(skillId);

        assertEq(agent.balance, balBefore - PRICE_ETH);
        assertEq(address(market).balance, PRICE_ETH);
    }

    function test_PurchaseEth_RevertsOnUnderpayment() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__InsufficientPayment.selector, PRICE_ETH - 1, PRICE_ETH
        ));
        market.purchaseSkill{value: PRICE_ETH - 1}(skillId);
    }

    function test_PurchaseEth_RevertsOnDoublePurchase() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent);
        market.purchaseSkill{value: PRICE_ETH}(skillId);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__AlreadyPurchased.selector, agent, skillId
        ));
        market.purchaseSkill{value: PRICE_ETH}(skillId);
    }

    function test_PurchaseEth_RevertsOnInactiveSkill() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(creator);
        skillReg.deactivateSkill(skillId);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__SkillNotActive.selector, skillId));
        market.purchaseSkill{value: PRICE_ETH}(skillId);
    }

    function test_PurchaseEth_RevertsOnPrerequisiteMissing() public {
        uint256 skillA = _createSkill(PRICE_ETH, 0);

        uint256[] memory prereqs = new uint256[](1);
        prereqs[0] = skillA;
        SkillTypes.SkillParams memory p = SkillTypes.SkillParams({
            name: "Advanced", description: "d",
            category: SkillTypes.Category.DeFi,
            difficulty: SkillTypes.Difficulty.Advanced,
            priceInWei: PRICE_ETH, priceInUsdc: 0,
            prerequisites: prereqs,
            contentURI: "ipfs://Q"
        });
        vm.prank(creator);
        uint256 skillB = skillReg.createSkill(p);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__PrerequisiteNotMet.selector, skillA
        ));
        market.purchaseSkill{value: PRICE_ETH}(skillB);
    }

    // =========================================================================
    //                       PURCHASE (USDC — approve)
    // =========================================================================

    function test_PurchaseUsdc_HappyPath() public {
        uint256 skillId = _createSkill(0, PRICE_USDC);

        vm.prank(agent);
        usdc.approve(address(market), PRICE_USDC);

        vm.prank(agent);
        market.purchaseSkillWithUsdc(skillId);

        assertTrue(market.hasPurchased(agent, skillId));
        assertEq(usdc.balanceOf(address(market)), PRICE_USDC);
    }

    function test_PurchaseUsdc_RevertsIfSkillHasNoUsdcPrice() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__UsdcNotSupported.selector, skillId
        ));
        market.purchaseSkillWithUsdc(skillId);
    }

    function test_PurchaseUsdc_RevertsIfUsdcNotConfigured() public {
        uint256 skillId = _createSkill(0, PRICE_USDC);

        // Pausing is required before swapping the USDC token away from a
        // non-zero value (defense against silent token swap during in-flight
        // purchases). See SkillMarketplace.setUsdcToken.
        vm.prank(admin);
        market.pause();
        vm.prank(admin);
        market.setUsdcToken(address(0));
        vm.prank(admin);
        market.unpause();

        vm.prank(agent);
        vm.expectRevert(SkillAI__UsdcNotConfigured.selector);
        market.purchaseSkillWithUsdc(skillId);
    }

    function test_SetUsdcToken_RevertsWhenNotPausedAndAlreadySet() public {
        // usdcToken is already set in setUp(), so swapping without pausing
        // first must revert to protect in-flight escrow.
        vm.prank(admin);
        vm.expectRevert(SkillAI__UsdcNotConfigured.selector);
        market.setUsdcToken(address(0xdead));
    }

    // =========================================================================
    //                    PURCHASE (USDC — EIP-3009 / x402)
    // =========================================================================

    function test_PurchaseWithAuthorization_HappyPath() public {
        uint256 skillId = _createSkill(0, PRICE_USDC);

        vm.warp(block.timestamp + 10);

        // Mock signature (MockUSDC just checks v/r/s are non-zero)
        vm.prank(agent);
        market.purchaseSkillWithAuthorization(
            skillId,
            agent,
            PRICE_USDC,
            0,                       // validAfter
            block.timestamp + 1 hours, // validBefore
            bytes32(uint256(1)),
            27,
            bytes32(uint256(1)),
            bytes32(uint256(2))
        );

        assertTrue(market.hasPurchased(agent, skillId));
        assertEq(usdc.balanceOf(address(market)), PRICE_USDC);
    }

    function test_PurchaseWithAuthorization_RevertsOnUnderpay() public {
        uint256 skillId = _createSkill(0, PRICE_USDC);

        vm.warp(block.timestamp + 10);

        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__InsufficientPayment.selector, PRICE_USDC - 1, PRICE_USDC
        ));
        market.purchaseSkillWithAuthorization(
            skillId,
            agent,
            PRICE_USDC - 1,
            0,
            block.timestamp + 1 hours,
            bytes32(uint256(1)),
            27,
            bytes32(uint256(1)),
            bytes32(uint256(2))
        );
    }

    // =========================================================================
    //                            COMPLETE
    // =========================================================================

    function test_Complete_HappyPath_MintsAndSplitsEth() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);

        vm.prank(agent);
        market.purchaseSkill{value: PRICE_ETH}(skillId);

        uint256 creatorBalBefore = creator.balance;
        uint256 treasuryBalBefore = address(treasury).balance;

        bytes memory sig = _signCompletion(agent, skillId, 2, 85);
        vm.prank(agent);
        market.completeSkill(skillId, 2, 85, sig);

        assertTrue(market.hasCompleted(agent, skillId));
        assertTrue(cred.hasSkill(agent, skillId));

        // 70% creator, 30% treasury
        assertEq(creator.balance - creatorBalBefore, (PRICE_ETH * 7000) / 10000);
        assertEq(address(treasury).balance - treasuryBalBefore, PRICE_ETH - (PRICE_ETH * 7000) / 10000);
    }

    // ------------------------------------------------------------------
    //                       SPONSOR FIRST SKILL
    // ------------------------------------------------------------------

    function test_SponsorFirstSkill_HappyPath() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);

        address sponsor = address(0xBEEF);
        vm.prank(admin);
        market.grantSponsorRole(sponsor);

        vm.prank(sponsor);
        market.sponsorFirstSkill(agent, skillId);

        assertTrue(market.hasPurchased(agent, skillId));
        SkillTypes.Purchase memory p = market.getPurchase(agent, skillId);
        assertEq(p.amountPaid, 0);
        assertEq(p.paidInUsdc, false);
        assertEq(p.purchasedAt, block.timestamp);
    }

    function test_SponsorFirstSkill_AgentCanThenComplete() public {
        // Sponsored purchase → agent completes normally → SBT minted.
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        address sponsor = address(0xBEEF);
        vm.prank(admin);
        market.grantSponsorRole(sponsor);
        vm.prank(sponsor);
        market.sponsorFirstSkill(agent, skillId);

        bytes memory sig = _signCompletion(agent, skillId, 1, 70);
        vm.prank(agent);
        market.completeSkill(skillId, 1, 70, sig);

        assertTrue(cred.hasSkill(agent, skillId));
    }

    function test_SponsorFirstSkill_RevertsForNonSponsor() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        bytes32 role = market.SPONSOR_ROLE();
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, role
        );
        vm.prank(attacker);
        vm.expectRevert(expected);
        market.sponsorFirstSkill(agent, skillId);
    }

    function test_SponsorFirstSkill_RevertsIfAlreadyPurchased() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);

        // Agent buys normally first
        vm.prank(agent);
        market.purchaseSkill{value: PRICE_ETH}(skillId);

        // Sponsor tries to gift the same skill
        address sponsor = address(0xBEEF);
        vm.prank(admin);
        market.grantSponsorRole(sponsor);
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__AlreadyPurchased.selector, agent, skillId
        ));
        market.sponsorFirstSkill(agent, skillId);
    }

    function test_CompleteFor_RelayerCanCompleteForAgent() public {
        // Agent buys, then a third-party relayer (e.g. our x402 relayer)
        // submits the verifier-signed completion on behalf of the agent.
        uint256 skillId = _createSkill(PRICE_ETH, 0);

        vm.prank(agent);
        market.purchaseSkill{value: PRICE_ETH}(skillId);

        bytes memory sig = _signCompletion(agent, skillId, 2, 85);

        address relayer = address(0xBEEF);
        vm.prank(relayer);
        market.completeSkillFor(agent, skillId, 2, 85, sig);

        assertTrue(market.hasCompleted(agent, skillId));
        assertTrue(cred.hasSkill(agent, skillId));
        // Credential mints to AGENT, not relayer
        assertEq(cred.balanceOf(agent), 1);
        assertEq(cred.balanceOf(relayer), 0);
    }

    function test_CompleteFor_RevertsOnZeroAgent() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        bytes memory sig = _signCompletion(address(0), skillId, 2, 85);
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        market.completeSkillFor(address(0), skillId, 2, 85, sig);
    }

    function test_CompleteFor_SignatureBoundToAgent() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent);
        market.purchaseSkill{value: PRICE_ETH}(skillId);

        // Signature for agent A used to try to complete agent B's purchase.
        bytes memory sigForAgent = _signCompletion(agent, skillId, 2, 85);

        address otherAgent = address(0xDEADC0DE);
        vm.deal(otherAgent, 1 ether);
        vm.prank(otherAgent);
        market.purchaseSkill{value: PRICE_ETH}(skillId);

        // Submitting agent's signature against otherAgent's purchase MUST revert
        vm.expectRevert(SkillAI__InvalidSignature.selector);
        market.completeSkillFor(otherAgent, skillId, 2, 85, sigForAgent);
    }

    function test_Complete_SplitsUsdc() public {
        uint256 skillId = _createSkill(0, PRICE_USDC);

        vm.prank(agent); usdc.approve(address(market), PRICE_USDC);
        vm.prank(agent); market.purchaseSkillWithUsdc(skillId);

        bytes memory sig = _signCompletion(agent, skillId, 3, 99);
        vm.prank(agent);
        market.completeSkill(skillId, 3, 99, sig);

        assertEq(usdc.balanceOf(creator), (PRICE_USDC * 7000) / 10000);
        assertEq(usdc.balanceOf(address(treasury)), PRICE_USDC - (PRICE_USDC * 7000) / 10000);
    }

    function test_Complete_RevertsOnInvalidSignature() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent); market.purchaseSkill{value: PRICE_ETH}(skillId);

        // Sign with wrong key
        bytes32 payload = keccak256(abi.encodePacked(
            agent, skillId, uint8(2), uint256(85), block.chainid, address(market)
        ));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payload));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xDEADBEEF, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(agent);
        vm.expectRevert(SkillAI__InvalidSignature.selector);
        market.completeSkill(skillId, 2, 85, badSig);
    }

    function test_Complete_RevertsIfNotPurchased() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        bytes memory sig = _signCompletion(agent, skillId, 1, 50);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__PurchaseNotFound.selector, agent, skillId
        ));
        market.completeSkill(skillId, 1, 50, sig);
    }

    function test_Complete_RevertsIfAlreadyCompleted() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent); market.purchaseSkill{value: PRICE_ETH}(skillId);
        bytes memory sig = _signCompletion(agent, skillId, 2, 85);
        vm.prank(agent); market.completeSkill(skillId, 2, 85, sig);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__AlreadyCompleted.selector, agent, skillId
        ));
        market.completeSkill(skillId, 2, 85, sig);
    }

    function test_Complete_RevertsOnInvalidLevel() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent); market.purchaseSkill{value: PRICE_ETH}(skillId);

        bytes memory sig = _signCompletion(agent, skillId, 4, 85);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__InvalidLevel.selector, uint8(4)));
        market.completeSkill(skillId, 4, 85, sig);
    }

    // =========================================================================
    //                            REFUND
    // =========================================================================

    function test_Refund_HappyPath() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent); market.purchaseSkill{value: PRICE_ETH}(skillId);

        uint256 balBefore = agent.balance;
        vm.warp(block.timestamp + 30 days + 1);

        vm.prank(agent);
        market.requestRefund(skillId);

        assertEq(agent.balance - balBefore, PRICE_ETH);
        assertFalse(market.hasPurchased(agent, skillId));
    }

    function test_Refund_RevertsBefore30Days() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent); market.purchaseSkill{value: PRICE_ETH}(skillId);
        uint256 availableAt = market.getPurchase(agent, skillId).purchasedAt + 30 days;

        vm.warp(block.timestamp + 15 days);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__RefundNotReady.selector, availableAt
        ));
        market.requestRefund(skillId);
    }

    function test_Refund_RevertsIfCompleted() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent); market.purchaseSkill{value: PRICE_ETH}(skillId);
        bytes memory sig = _signCompletion(agent, skillId, 2, 85);
        vm.prank(agent); market.completeSkill(skillId, 2, 85, sig);

        vm.warp(block.timestamp + 30 days + 1);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__AlreadyCompleted.selector, agent, skillId
        ));
        market.requestRefund(skillId);
    }

    function test_Refund_Usdc() public {
        uint256 skillId = _createSkill(0, PRICE_USDC);
        vm.prank(agent); usdc.approve(address(market), PRICE_USDC);
        vm.prank(agent); market.purchaseSkillWithUsdc(skillId);

        uint256 balBefore = usdc.balanceOf(agent);
        vm.warp(block.timestamp + 30 days + 1);
        vm.prank(agent);
        market.requestRefund(skillId);
        assertEq(usdc.balanceOf(agent) - balBefore, PRICE_USDC);
    }

    // =========================================================================
    //                             RATING
    // =========================================================================

    function test_Rate_OnlyAfterCompletion() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__NotCompleted.selector, agent, skillId
        ));
        market.rateSkill(skillId, 5);
    }

    function test_Rate_HappyPath() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent); market.purchaseSkill{value: PRICE_ETH}(skillId);
        bytes memory sig = _signCompletion(agent, skillId, 2, 85);
        vm.prank(agent); market.completeSkill(skillId, 2, 85, sig);

        vm.prank(agent);
        market.rateSkill(skillId, 5);

        assertEq(skillReg.getAverageRating(skillId), 500);
    }

    function test_Rate_RevertsOnDoubleRate() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent); market.purchaseSkill{value: PRICE_ETH}(skillId);
        bytes memory sig = _signCompletion(agent, skillId, 2, 85);
        vm.prank(agent); market.completeSkill(skillId, 2, 85, sig);

        vm.prank(agent); market.rateSkill(skillId, 5);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__AlreadyRated.selector, agent, skillId
        ));
        market.rateSkill(skillId, 4);
    }

    function test_Rate_RevertsOnInvalidRating() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(agent); market.purchaseSkill{value: PRICE_ETH}(skillId);
        bytes memory sig = _signCompletion(agent, skillId, 2, 85);
        vm.prank(agent); market.completeSkill(skillId, 2, 85, sig);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SkillAI__InvalidRating.selector, uint8(6)));
        market.rateSkill(skillId, 6);
    }
}
