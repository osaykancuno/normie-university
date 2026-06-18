// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script}            from "forge-std/Script.sol";
import {console2}          from "forge-std/console2.sol";
import {SkillMarketplace}  from "../src/marketplace/SkillMarketplace.sol";
import {SkillRegistry}     from "../src/core/SkillRegistry.sol";
import {SkillCredential}   from "../src/core/SkillCredential.sol";

/// @title  RedeployMarketplace
/// @notice Surgical redeploy of ONLY the SkillMarketplace (new completeSkill
///         signature with deadline + nonce). Everything else — SkillRegistry,
///         SkillCredential, ReputationEngine, Treasury, the 40 seeded skills —
///         stays in place. We just:
///           1. deploy the new marketplace pointing at the existing registry/
///              credential/treasury/usdc,
///           2. re-grant MARKETPLACE_ROLE on registry + credential to the new
///              marketplace and revoke it from the old one,
///           3. re-wire reputation engine + verifier role on the new market.
///
/// Required env:
///   PRIVATE_KEY            — admin/deployer (testnet)
///   VERIFIER_ADDRESS       — granted VERIFIER_ROLE on the new marketplace
///   OLD_MARKETPLACE        — current marketplace to de-authorize
///   SKILL_REGISTRY         — existing
///   SKILL_CREDENTIAL       — existing
///   TREASURY               — existing
///   REPUTATION_ENGINE      — existing (optional)
///   USDC_ADDRESS           — existing test USDC
contract RedeployMarketplace is Script {
    function run() external returns (address newMarketplace) {
        uint256 pk        = vm.envUint("PRIVATE_KEY");
        address admin     = vm.addr(pk);
        address verifier  = vm.envOr("VERIFIER_ADDRESS", admin);
        address oldMkt    = vm.envAddress("OLD_MARKETPLACE");
        address registry  = vm.envAddress("SKILL_REGISTRY");
        address credential= vm.envAddress("SKILL_CREDENTIAL");
        address treasury  = vm.envAddress("TREASURY");
        address repEng    = vm.envOr("REPUTATION_ENGINE", address(0));
        address usdc      = vm.envOr("USDC_ADDRESS", address(0));

        console2.log("=== Redeploy SkillMarketplace ===");
        console2.log("admin:     ", admin);
        console2.log("old market:", oldMkt);

        vm.startBroadcast(pk);

        // 1. New marketplace
        SkillMarketplace market = new SkillMarketplace(
            admin, registry, credential, treasury, usdc
        );

        // 2. Re-authorize on registry + credential, de-authorize old
        SkillRegistry(registry).grantMarketplaceRole(address(market));
        SkillRegistry(registry).revokeMarketplaceRole(oldMkt);

        SkillCredential(credential).grantMarketplaceRole(address(market));
        SkillCredential(credential).revokeMarketplaceRole(oldMkt);

        // 3. Wire reputation + verifier
        if (repEng != address(0)) {
            market.setReputationEngine(repEng);
        }
        market.grantVerifierRole(verifier);

        vm.stopBroadcast();

        newMarketplace = address(market);
        console2.log("NEW marketplace:", newMarketplace);
    }
}
