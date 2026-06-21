// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {NormieAgentBinding} from "../src/identity/NormieAgentBinding.sol";
import {MockNormies} from "../src/mocks/MockNormies.sol";

/// @notice Deploys the agent-binding layer for the Sepolia prototype:
///         NormieAgentBinding (ERC-8217-style) + MockNormies (testnet stand-in
///         for the mainnet Normies collection).
contract DeployBinding is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        MockNormies normies = new MockNormies();
        NormieAgentBinding binding = new NormieAgentBinding();

        vm.stopBroadcast();

        console2.log("MockNormies         :", address(normies));
        console2.log("NormieAgentBinding  :", address(binding));
    }
}
