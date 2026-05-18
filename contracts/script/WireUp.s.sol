// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script}            from "forge-std/Script.sol";
import {console2}          from "forge-std/console2.sol";
import {SkillRegistry}     from "../src/core/SkillRegistry.sol";
import {SkillCredential}   from "../src/core/SkillCredential.sol";
import {SkillMarketplace}  from "../src/marketplace/SkillMarketplace.sol";
import {CrossChainReceiver} from "../src/marketplace/CrossChainReceiver.sol";

/// @title  WireUp
/// @notice Stand-alone wire-up step for deployments where ADMIN_ADDRESS is a
///         multisig that signs the configuration after the deploy.
///         Run with the multisig signer / Safe transaction.
///
/// Required env (read from deployments/<chainId>.json):
///   SKILL_REGISTRY      / SKILL_CREDENTIAL  / MARKETPLACE  / CROSS_CHAIN_RECEIVER
///   REPUTATION_ENGINE   (optional)
///   VERIFIER_ADDRESS    (optional)
///   BRIDGE_ADDRESS      (optional)
contract WireUp is Script {
    function run() external {
        SkillRegistry      skillReg = SkillRegistry     (vm.envAddress("SKILL_REGISTRY"));
        SkillCredential    cred     = SkillCredential   (vm.envAddress("SKILL_CREDENTIAL"));
        SkillMarketplace   market   = SkillMarketplace  (payable(vm.envAddress("MARKETPLACE")));
        CrossChainReceiver xchain   = CrossChainReceiver(payable(vm.envAddress("CROSS_CHAIN_RECEIVER")));

        address repEng   = vm.envOr("REPUTATION_ENGINE", address(0));
        address verifier = vm.envOr("VERIFIER_ADDRESS",  address(0));
        address bridge   = vm.envOr("BRIDGE_ADDRESS",    address(0));

        vm.startBroadcast();

        skillReg.grantMarketplaceRole(address(market));
        cred.grantMarketplaceRole(address(market));
        market.grantCrossChainRole(address(xchain));

        if (repEng   != address(0)) market.setReputationEngine(repEng);
        if (verifier != address(0)) market.grantVerifierRole(verifier);
        if (bridge   != address(0)) xchain.grantBridgeRole(bridge);

        // Optional separate publisher key for seeding the catalogue
        address publisher = vm.envOr("CREATOR_ADDRESS", address(0));
        if (publisher != address(0)) skillReg.grantCreatorRole(publisher);

        vm.stopBroadcast();

        console2.log("Wire-up complete on chainId", block.chainid);
    }
}
