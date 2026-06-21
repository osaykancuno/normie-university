// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NormieAgentBinding} from "../src/identity/NormieAgentBinding.sol";
import {MockNormies} from "../src/mocks/MockNormies.sol";

contract NormieAgentBindingTest is Test {
    NormieAgentBinding binding;
    MockNormies normies;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        binding = new NormieAgentBinding();
        normies = new MockNormies();
    }

    function _mintAndBind(address who) internal returns (uint256 tokenId, uint256 agentId, address identity) {
        vm.prank(who);
        tokenId = normies.mint();
        vm.prank(who);
        (agentId, identity) = binding.bind(address(normies), tokenId);
    }

    function test_Bind_SetsControllerToOwner() public {
        (uint256 tokenId, uint256 agentId, address identity) = _mintAndBind(alice);
        assertEq(agentId, 1);
        assertTrue(identity != address(0));
        assertEq(binding.controllerOf(agentId), alice);
        assertTrue(binding.isController(alice, agentId));
        assertFalse(binding.isController(bob, agentId));

        (address tc, uint256 ti) = binding.bindingOf(agentId);
        assertEq(tc, address(normies));
        assertEq(ti, tokenId);
    }

    /// THE core property: selling the NFT moves control of the agent identity.
    function test_TransferNFT_MovesControl() public {
        (uint256 tokenId, uint256 agentId, address identity) = _mintAndBind(alice);
        assertEq(binding.controllerOf(agentId), alice);

        // Alice sells her Normie to Bob.
        vm.prank(alice);
        normies.transferFrom(alice, bob, tokenId);

        // Control — and any credentials minted to `identity` — now follow Bob.
        assertEq(binding.controllerOf(agentId), bob);
        assertTrue(binding.isController(bob, agentId));
        assertFalse(binding.isController(alice, agentId));

        // The identity address itself is stable across the sale.
        assertEq(binding.identityOf(agentId), identity);
    }

    function test_IdentityIsDeterministicAndStable() public {
        (, uint256 agentId, address identity) = _mintAndBind(alice);
        assertEq(binding.identityOf(agentId), identity);
        // identity is independent of the controller, so it survives transfers.
        (uint256 a2, address i2) = binding.identityForToken(address(normies), 1);
        assertEq(a2, agentId);
        assertEq(i2, identity);
    }

    function test_Bind_RevertsIfNotOwner() public {
        vm.prank(alice);
        uint256 tokenId = normies.mint();
        vm.prank(bob);
        vm.expectRevert(NormieAgentBinding.NotTokenOwner.selector);
        binding.bind(address(normies), tokenId);
    }

    function test_Bind_RevertsIfAlreadyBound() public {
        (uint256 tokenId, , ) = _mintAndBind(alice);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(NormieAgentBinding.TokenAlreadyBound.selector, address(normies), tokenId)
        );
        binding.bind(address(normies), tokenId);
    }

    function test_UnboundQueriesRevertOrZero() public {
        vm.expectRevert(abi.encodeWithSelector(NormieAgentBinding.AgentNotBound.selector, uint256(99)));
        binding.controllerOf(99);
        assertFalse(binding.isController(alice, 99));
        (uint256 agentId, address identity) = binding.identityForToken(address(normies), 1234);
        assertEq(agentId, 0);
        assertEq(identity, address(0));
    }

    function test_TwoNormies_IndependentIdentities() public {
        (, uint256 a1, address i1) = _mintAndBind(alice);
        (, uint256 a2, address i2) = _mintAndBind(bob);
        assertTrue(a1 != a2);
        assertTrue(i1 != i2);
        assertEq(binding.controllerOf(a1), alice);
        assertEq(binding.controllerOf(a2), bob);
    }
}
