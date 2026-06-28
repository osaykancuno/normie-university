// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {NormieVerifiedPass} from "../src/tools/NormieVerifiedPass.sol";
import {ToolAccessPredicate} from "../src/tools/ToolAccessPredicate.sol";

/**
 * @notice Deploys the ERC-8257 tool layer on Base:
 *           - NormieVerifiedPass  (soulbound Base-side proof of L1 Normie control)
 *           - ToolAccessPredicate (the gate OpenSea's registry calls)
 *
 * Env:
 *   PRIVATE_KEY      deployer (becomes nothing special; roles below are explicit)
 *   TOOLS_ADMIN      DEFAULT_ADMIN_ROLE / predicate owner — USE A MULTISIG on mainnet
 *   TOOLS_MINTER     MINTER_ROLE for the pass — the NU verification backend signer
 *   PASS_BASE_URI    metadata base URI for the pass (optional)
 *
 * Gates are NOT wired here: toolIds only exist after registration on the
 * OpenSea ToolRegistry, so call `predicate.setGate(toolId, pass, ...)` afterwards.
 */
contract DeployTools is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("TOOLS_ADMIN");
        address minter = vm.envAddress("TOOLS_MINTER");
        string memory baseURI = vm.envOr("PASS_BASE_URI", string(""));

        require(admin != address(0) && minter != address(0), "admin/minter unset");

        vm.startBroadcast(pk);

        NormieVerifiedPass pass = new NormieVerifiedPass(admin, minter, baseURI);
        ToolAccessPredicate predicate = new ToolAccessPredicate(admin);

        vm.stopBroadcast();

        console2.log("NormieVerifiedPass  :", address(pass));
        console2.log("ToolAccessPredicate :", address(predicate));
        console2.log("admin (owner)       :", admin);
        console2.log("minter (backend)    :", minter);
        console2.log("");
        console2.log("Next: register tools, then for each Normie-gated toolId run");
        console2.log("  predicate.setGate(toolId, <NormieVerifiedPass>, false, 1 /*OR*/)");
    }
}
