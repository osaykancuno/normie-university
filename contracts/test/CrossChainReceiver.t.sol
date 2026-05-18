// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}                from "forge-std/Test.sol";
import {AgentRegistry}       from "../src/core/AgentRegistry.sol";
import {SkillRegistry}       from "../src/core/SkillRegistry.sol";
import {SkillCredential}     from "../src/core/SkillCredential.sol";
import {Treasury}            from "../src/treasury/Treasury.sol";
import {SkillMarketplace}    from "../src/marketplace/SkillMarketplace.sol";
import {CrossChainReceiver}  from "../src/marketplace/CrossChainReceiver.sol";
import {MockUSDC}            from "./mocks/MockUSDC.sol";
import {SkillTypes}          from "../src/libraries/SkillTypes.sol";
import {IAccessControl}      from "@openzeppelin/contracts/access/IAccessControl.sol";
import {
    SkillAI__ZeroAddress,
    SkillAI__InsufficientPayment
} from "../src/libraries/SkillTypes.sol";

contract CrossChainReceiverTest is Test {
    AgentRegistry      public agentReg;
    SkillRegistry      public skillReg;
    SkillCredential    public cred;
    Treasury           public treasury;
    SkillMarketplace   public market;
    CrossChainReceiver public receiver;
    MockUSDC           public usdc;

    address public admin    = address(0xA11CE);
    address public bridge   = address(0xB1DA);
    address public creator  = address(0xCCCC);
    address public agent    = address(0xAAAA);
    address public attacker = address(0xDEAD);

    uint256 constant PRICE_ETH  = 0.01 ether;
    uint256 constant PRICE_USDC = 10 * 1e6;

    function setUp() public {
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

        receiver = new CrossChainReceiver(admin, address(market), address(usdc));

        vm.startPrank(admin);
        skillReg.grantMarketplaceRole(address(market));
        skillReg.grantCreatorRole(creator);
        cred.grantMarketplaceRole(address(market));
        market.grantCrossChainRole(address(receiver));
        receiver.grantBridgeRole(bridge);
        vm.stopPrank();

        vm.deal(bridge, 100 ether);
        usdc.mint(bridge, 10_000 * 1e6);
    }

    function _createSkill(uint256 priceWei, uint256 priceUsdc) internal returns (uint256) {
        uint256[] memory prereqs = new uint256[](0);
        SkillTypes.SkillParams memory p = SkillTypes.SkillParams({
            name: "S", description: "d",
            category: SkillTypes.Category.DeFi,
            difficulty: SkillTypes.Difficulty.Intermediate,
            priceInWei: priceWei, priceInUsdc: priceUsdc,
            prerequisites: prereqs,
            contentURI: "ipfs://Q"
        });
        vm.prank(creator);
        return skillReg.createSkill(p);
    }

    // =========================================================================
    //                           CONSTRUCTOR
    // =========================================================================

    function test_Constructor_RevertsOnZero() public {
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        new CrossChainReceiver(address(0), address(market), address(usdc));

        vm.expectRevert(SkillAI__ZeroAddress.selector);
        new CrossChainReceiver(admin, address(0), address(usdc));
    }

    function test_Constructor_SetsRolesAndImmutable() public view {
        assertTrue(receiver.hasRole(receiver.ADMIN_ROLE(), admin));
        assertTrue(receiver.hasRole(receiver.BRIDGE_ROLE(), bridge));
        assertEq(address(receiver.marketplace()), address(market));
    }

    // =========================================================================
    //                          CROSS-CHAIN PURCHASE (ETH)
    // =========================================================================

    function test_CrossChainPurchase_Eth_HappyPath() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);

        vm.prank(bridge);
        receiver.handleCrossChainPurchase{value: PRICE_ETH}(
            agent, skillId, PRICE_ETH, false, 1, keccak256("n1")
        );

        assertTrue(market.hasPurchased(agent, skillId));
        assertEq(address(market).balance, PRICE_ETH);
        assertEq(receiver.totalInboundEth(), PRICE_ETH);
    }

    function test_CrossChainPurchase_Eth_RevertsOnUnderpay() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);

        vm.prank(bridge);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__InsufficientPayment.selector, PRICE_ETH - 1, PRICE_ETH
        ));
        receiver.handleCrossChainPurchase{value: PRICE_ETH - 1}(
            agent, skillId, PRICE_ETH, false, 1, keccak256("n1")
        );
    }

    // =========================================================================
    //                       CROSS-CHAIN PURCHASE (USDC)
    // =========================================================================

    function test_CrossChainPurchase_Usdc_HappyPath() public {
        uint256 skillId = _createSkill(0, PRICE_USDC);

        // Bridge pre-funds the receiver with USDC (simulating LZ delivery)
        vm.prank(bridge);
        usdc.transfer(address(receiver), PRICE_USDC);

        vm.prank(bridge);
        receiver.handleCrossChainPurchase(
            agent, skillId, PRICE_USDC, true, 100, keccak256("n2")
        );

        assertTrue(market.hasPurchased(agent, skillId));
        assertEq(usdc.balanceOf(address(market)), PRICE_USDC);
        assertEq(receiver.totalInboundUsdc(), PRICE_USDC);
    }

    // =========================================================================
    //                           ACCESS CONTROL
    // =========================================================================

    function test_HandleCrossChain_RevertsForNonBridge() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        bytes32 role = receiver.BRIDGE_ROLE();
        vm.deal(attacker, 10 ether);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            attacker,
            role
        ));
        receiver.handleCrossChainPurchase{value: PRICE_ETH}(
            agent, skillId, PRICE_ETH, false, 1, keccak256("x")
        );
    }

    function test_RevokeBridge_BlocksFurtherUse() public {
        uint256 skillId = _createSkill(PRICE_ETH, 0);
        vm.prank(admin);
        receiver.revokeBridgeRole(bridge);

        bytes32 role = receiver.BRIDGE_ROLE();
        vm.prank(bridge);
        vm.expectRevert(abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            bridge,
            role
        ));
        receiver.handleCrossChainPurchase{value: PRICE_ETH}(
            agent, skillId, PRICE_ETH, false, 1, keccak256("x")
        );
    }

    // =========================================================================
    //                             RESCUE
    // =========================================================================

    function test_RescueErc20() public {
        usdc.mint(address(receiver), 1_000 * 1e6);
        vm.prank(admin);
        receiver.rescueErc20(address(usdc), admin, 1_000 * 1e6);
        assertEq(usdc.balanceOf(admin), 1_000 * 1e6);
    }

    function test_RescueEth() public {
        vm.deal(address(receiver), 1 ether);
        vm.prank(admin);
        receiver.rescueEth(payable(admin), 1 ether);
        assertEq(admin.balance, 1 ether);
    }
}
