// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ToolAccessPredicate} from "../src/tools/ToolAccessPredicate.sol";
import {IAccessPredicate} from "../src/tools/interfaces/IAccessPredicate.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {MockNormies} from "../src/mocks/MockNormies.sol";

/// @dev A "collection" whose balanceOf reverts, to prove the predicate swallows
///      malfunctions and fail-closes rather than reverting the registry call.
contract RevertingCollection {
    function balanceOf(address) external pure returns (uint256) {
        revert("boom");
    }
}

contract ToolAccessPredicateTest is Test {
    ToolAccessPredicate internal pred;
    MockNormies internal pass; // the NU Base "Normie-Verified Pass"

    address internal admin = address(0xA11CE);
    address internal holder = address(0xBEEF);
    address internal stranger = address(0xCAFE);

    uint256 internal constant TOOL = 1;

    function setUp() public {
        pred = new ToolAccessPredicate(admin);
        pass = new MockNormies();
        // give `holder` a pass
        vm.prank(holder);
        pass.mint();
    }

    // --- fail-closed defaults ------------------------------------------------

    function test_UnconfiguredTool_DeniesEveryone() public view {
        assertFalse(pred.hasAccess(TOOL, holder, ""));
        assertFalse(pred.hasAccess(TOOL, stranger, ""));
    }

    function test_SetGate_RequiresAtLeastOneRequirement() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ToolAccessPredicate.NoRequirement.selector, TOOL));
        pred.setGate(TOOL, address(0), false, IAccessPredicate.RequirementLogic.OR);
    }

    function test_OnlyOwner_CanConfigure() public {
        vm.prank(stranger);
        vm.expectRevert();
        pred.setGate(TOOL, address(pass), false, IAccessPredicate.RequirementLogic.OR);
    }

    // --- holding gate --------------------------------------------------------

    function test_HoldingGate_GrantsHolderDeniesStranger() public {
        vm.prank(admin);
        pred.setGate(TOOL, address(pass), false, IAccessPredicate.RequirementLogic.OR);

        assertTrue(pred.hasAccess(TOOL, holder, ""));
        assertFalse(pred.hasAccess(TOOL, stranger, ""));
    }

    function test_HoldingGate_FollowsTheNFT() public {
        vm.prank(admin);
        pred.setGate(TOOL, address(pass), false, IAccessPredicate.RequirementLogic.OR);
        assertTrue(pred.hasAccess(TOOL, holder, ""));

        // holder sells the pass -> access moves with it
        vm.prank(holder);
        pass.transferFrom(holder, stranger, 1);

        assertFalse(pred.hasAccess(TOOL, holder, ""));
        assertTrue(pred.hasAccess(TOOL, stranger, ""));
    }

    // --- allowlist gate ------------------------------------------------------

    function test_AllowlistGate() public {
        vm.startPrank(admin);
        pred.setGate(TOOL, address(0), true, IAccessPredicate.RequirementLogic.OR);
        pred.setAllowlisted(TOOL, stranger, true);
        vm.stopPrank();

        assertTrue(pred.hasAccess(TOOL, stranger, ""));
        assertFalse(pred.hasAccess(TOOL, holder, ""));
    }

    function test_AllowlistBatch() public {
        address[] memory cohort = new address[](2);
        cohort[0] = holder;
        cohort[1] = stranger;

        vm.startPrank(admin);
        pred.setGate(TOOL, address(0), true, IAccessPredicate.RequirementLogic.OR);
        pred.setAllowlistedBatch(TOOL, cohort, true);
        vm.stopPrank();

        assertTrue(pred.hasAccess(TOOL, holder, ""));
        assertTrue(pred.hasAccess(TOOL, stranger, ""));
    }

    // --- AND / OR combination ------------------------------------------------

    function test_OrLogic_EitherSatisfies() public {
        vm.startPrank(admin);
        pred.setGate(TOOL, address(pass), true, IAccessPredicate.RequirementLogic.OR);
        pred.setAllowlisted(TOOL, stranger, true); // stranger has no pass but is allowlisted
        vm.stopPrank();

        assertTrue(pred.hasAccess(TOOL, holder, "")); // via holding
        assertTrue(pred.hasAccess(TOOL, stranger, "")); // via allowlist
    }

    function test_AndLogic_RequiresBoth() public {
        vm.startPrank(admin);
        pred.setGate(TOOL, address(pass), true, IAccessPredicate.RequirementLogic.AND);
        pred.setAllowlisted(TOOL, holder, true);
        vm.stopPrank();

        assertTrue(pred.hasAccess(TOOL, holder, "")); // holds AND allowlisted
        assertFalse(pred.hasAccess(TOOL, stranger, "")); // neither

        // holder loses allowlist -> AND fails even though they still hold
        vm.prank(admin);
        pred.setAllowlisted(TOOL, holder, false);
        assertFalse(pred.hasAccess(TOOL, holder, ""));
    }

    // --- malfunction safety --------------------------------------------------

    function test_RevertingCollection_DeniesNotReverts() public {
        RevertingCollection bad = new RevertingCollection();
        vm.prank(admin);
        pred.setGate(TOOL, address(bad), false, IAccessPredicate.RequirementLogic.OR);

        // must return false, never bubble the revert up to the registry
        assertFalse(pred.hasAccess(TOOL, holder, ""));
    }

    // --- ERC-165 + requirements hint ----------------------------------------

    function test_SupportsInterface() public view {
        assertTrue(pred.supportsInterface(0xbdf9dc18)); // IAccessPredicate
        assertTrue(pred.supportsInterface(type(IERC165).interfaceId));
        assertFalse(pred.supportsInterface(0xffffffff));
    }

    function test_GetRequirements_AdvertisesHolding() public {
        vm.prank(admin);
        pred.setGate(TOOL, address(pass), false, IAccessPredicate.RequirementLogic.OR);

        (IAccessPredicate.AccessRequirement[] memory reqs, IAccessPredicate.RequirementLogic logic) =
            pred.getRequirements(TOOL);

        assertEq(reqs.length, 1);
        assertEq(reqs[0].kind, bytes4(0xbdf8c428)); // IERC721Holding
        assertEq(abi.decode(reqs[0].data, (address)), address(pass));
        assertEq(uint8(logic), uint8(IAccessPredicate.RequirementLogic.OR));
    }

    function test_GetRequirements_AllowlistOnly_EmptyHint() public {
        vm.prank(admin);
        pred.setGate(TOOL, address(0), true, IAccessPredicate.RequirementLogic.OR);

        (IAccessPredicate.AccessRequirement[] memory reqs,) = pred.getRequirements(TOOL);
        assertEq(reqs.length, 0); // no standard marker for an allowlist
    }
}
