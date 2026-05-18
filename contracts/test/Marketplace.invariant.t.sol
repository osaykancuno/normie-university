// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}             from "forge-std/Test.sol";
import {StdInvariant}     from "forge-std/StdInvariant.sol";
import {AgentRegistry}    from "../src/core/AgentRegistry.sol";
import {SkillRegistry}    from "../src/core/SkillRegistry.sol";
import {SkillCredential}  from "../src/core/SkillCredential.sol";
import {Treasury}         from "../src/treasury/Treasury.sol";
import {SkillMarketplace} from "../src/marketplace/SkillMarketplace.sol";
import {MockUSDC}         from "./mocks/MockUSDC.sol";
import {SkillTypes}       from "../src/libraries/SkillTypes.sol";

/// @title  Handler — fuzz the Marketplace through allowed surface area
/// @notice The handler bounds inputs to non-trivial values and tracks
///         ghost variables the invariant suite asserts on.
contract MarketplaceHandler is Test {
    SkillMarketplace public immutable market;
    SkillRegistry    public immutable skillReg;
    SkillCredential  public immutable cred;
    Treasury         public immutable treasury;
    MockUSDC         public immutable usdc;

    address public immutable creator;
    address public immutable verifier;
    uint256 public immutable verifierPk;

    /// Track which agents we've used so we can build call lists deterministically
    address[] public agents;
    mapping(address => bool) internal _seen;

    /// One skill is enough for invariant exploration
    uint256 public skillId;

    uint256 public constant PRICE_ETH  = 0.01 ether;
    uint256 public constant PRICE_USDC = 10 * 1e6;

    /// Ghost: total ETH ever paid in via purchaseSkill
    uint256 public ghostEthIn;
    /// Ghost: total ETH ever paid out (refunds + creator + treasury)
    uint256 public ghostEthOut;

    /// Ghost: total USDC ever pulled in via purchaseSkillWithUsdc
    uint256 public ghostUsdcIn;
    /// Ghost: total USDC ever paid out (refunds + creator + treasury)
    uint256 public ghostUsdcOut;

    constructor(
        SkillMarketplace _market,
        SkillRegistry _skillReg,
        SkillCredential _cred,
        Treasury _treasury,
        MockUSDC _usdc,
        address _creator,
        address _verifier,
        uint256 _verifierPk,
        uint256 _skillId
    ) {
        market     = _market;
        skillReg   = _skillReg;
        cred       = _cred;
        treasury   = _treasury;
        usdc       = _usdc;
        creator    = _creator;
        verifier   = _verifier;
        verifierPk = _verifierPk;
        skillId    = _skillId;
    }

    function _agent(uint256 seed) internal returns (address a) {
        a = address(uint160(uint256(keccak256(abi.encode("agent", seed % 16)))));
        if (!_seen[a]) {
            _seen[a] = true;
            agents.push(a);
            vm.deal(a, 100 ether);
            usdc.mint(a, 1_000_000 * 1e6);
        }
    }

    function purchaseEth(uint256 seed) external {
        address a = _agent(seed);
        if (market.hasPurchased(a, skillId)) return;
        vm.prank(a);
        try market.purchaseSkill{value: PRICE_ETH}(skillId) {
            ghostEthIn += PRICE_ETH;
        } catch {}
    }

    function purchaseUsdc(uint256 seed) external {
        address a = _agent(seed);
        if (market.hasPurchased(a, skillId)) return;
        vm.prank(a);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(a);
        try market.purchaseSkillWithUsdc(skillId) {
            ghostUsdcIn += PRICE_USDC;
        } catch {}
    }

    function complete(uint256 seed, uint8 levelSeed, uint256 scoreSeed) external {
        if (agents.length == 0) return;
        address a = agents[seed % agents.length];
        if (!market.hasPurchased(a, skillId)) return;
        if (market.hasCompleted(a, skillId)) return;

        uint8 level = uint8((levelSeed % 3) + 1);    // 1..3
        uint256 score = scoreSeed % 101;              // 0..100

        bytes32 payload = keccak256(abi.encodePacked(
            a, skillId, level, score, block.chainid, address(market)
        ));
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", payload)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, ethHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        SkillTypes.Purchase memory p = market.getPurchase(a, skillId);
        bool paidUsdc = p.paidInUsdc;
        uint256 amountPaid = p.amountPaid;

        vm.prank(a);
        try market.completeSkill(skillId, level, score, sig) {
            if (paidUsdc) ghostUsdcOut += amountPaid;
            else          ghostEthOut  += amountPaid;
        } catch {}
    }

    function refund(uint256 seed) external {
        if (agents.length == 0) return;
        address a = agents[seed % agents.length];
        if (!market.hasPurchased(a, skillId)) return;
        if (market.hasCompleted(a, skillId)) return;

        // Jump past refund window
        vm.warp(block.timestamp + 31 days);

        SkillTypes.Purchase memory p = market.getPurchase(a, skillId);
        uint256 amount = p.amountPaid;
        bool paidUsdc = p.paidInUsdc;

        vm.prank(a);
        try market.requestRefund(skillId) {
            if (paidUsdc) ghostUsdcOut += amount;
            else          ghostEthOut  += amount;
        } catch {}
    }

    function agentsLength() external view returns (uint256) {
        return agents.length;
    }
}

contract MarketplaceInvariantTest is StdInvariant, Test {
    AgentRegistry    public agentReg;
    SkillRegistry    public skillReg;
    SkillCredential  public cred;
    Treasury         public treasury;
    SkillMarketplace public market;
    MockUSDC         public usdc;

    MarketplaceHandler public handler;

    address public admin    = address(0xA11CE);
    address public creator  = address(0xCCCC);

    uint256 public verifierPk = 0xA11CEDEADBEEF;
    address public verifier;

    function setUp() public {
        verifier = vm.addr(verifierPk);

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

        // Create one skill that supports both ETH and USDC
        uint256[] memory prereqs = new uint256[](0);
        SkillTypes.SkillParams memory p = SkillTypes.SkillParams({
            name: "Inv Skill",
            description: "Invariant test skill",
            category: SkillTypes.Category.DeFi,
            difficulty: SkillTypes.Difficulty.Beginner,
            priceInWei: 0.01 ether,
            priceInUsdc: 10 * 1e6,
            prerequisites: prereqs,
            contentURI: "ipfs://inv"
        });
        vm.prank(creator);
        uint256 skillId = skillReg.createSkill(p);

        handler = new MarketplaceHandler(
            market, skillReg, cred, treasury, usdc, creator, verifier, verifierPk, skillId
        );

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = handler.purchaseEth.selector;
        selectors[1] = handler.purchaseUsdc.selector;
        selectors[2] = handler.complete.selector;
        selectors[3] = handler.refund.selector;
        targetSelector(StdInvariant.FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// I1 — A purchase can never be both completed and refunded.
    function invariant_NoCompletedAndRefunded() public view {
        uint256 n = handler.agentsLength();
        for (uint256 i = 0; i < n; ++i) {
            address a = handler.agents(i);
            SkillTypes.Purchase memory p = market.getPurchase(a, handler.skillId());
            // hasPurchased returns true only when not refunded; so a refunded
            // purchase will not have completed=true. We assert the inverse here.
            assertFalse(p.completed && p.refunded, "completed && refunded");
        }
    }

    /// I2 — Marketplace ETH balance + ETH paid out >= ETH paid in.
    ///      Equality holds when there are no in-flight (uncompleted, unrefunded) purchases.
    function invariant_EthAccounting() public view {
        uint256 inv = address(market).balance + handler.ghostEthOut();
        assertGe(inv, handler.ghostEthIn(), "eth accounting underflow");
    }

    /// I3 — USDC balance + paid out >= paid in.
    function invariant_UsdcAccounting() public view {
        uint256 inv = usdc.balanceOf(address(market)) + handler.ghostUsdcOut();
        assertGe(inv, handler.ghostUsdcIn(), "usdc accounting underflow");
    }

    /// I4 — `_purchases[*][skillId].purchasedAt > 0` only if the agent has a credential
    ///      (after completion) or has never completed (escrow held). Specifically:
    ///      hasCompleted -> hasSkill credential.
    function invariant_CompletedHasCredential() public view {
        uint256 n = handler.agentsLength();
        uint256 sId = handler.skillId();
        for (uint256 i = 0; i < n; ++i) {
            address a = handler.agents(i);
            if (market.hasCompleted(a, sId)) {
                assertTrue(cred.hasSkill(a, sId), "completed but no credential");
            }
        }
    }

    /// I5 — Once completed, a purchase can never be refunded by the agent.
    ///      Implicitly checked by I1 + flow — but we also assert hasPurchased
    ///      remains true for completed agents (refund clears it).
    function invariant_CompletedRemainsPurchased() public view {
        uint256 n = handler.agentsLength();
        uint256 sId = handler.skillId();
        for (uint256 i = 0; i < n; ++i) {
            address a = handler.agents(i);
            if (market.hasCompleted(a, sId)) {
                assertTrue(market.hasPurchased(a, sId), "completed lost purchase flag");
            }
        }
    }
}
