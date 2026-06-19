// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script}            from "forge-std/Script.sol";
import {console2}          from "forge-std/console2.sol";
import {PixelOracleAnchor} from "../src/anchor/PixelOracleAnchor.sol";

/// @title  DeployAnchor
/// @notice Deploy the PixelOracleAnchor — the on-chain V4 trust layer for
///         NORMIE UNIVERSITY. Requires two DISTINCT signer addresses:
///         the University signer and the independent Oracle signer (2-of-2).
///
/// Required env:
///   PRIVATE_KEY        — deployer (pays gas)
///   UNIVERSITY_SIGNER  — address of the University co-signer
///   ORACLE_SIGNER      — address of the independent Oracle co-signer
contract DeployAnchor is Script {
    function run() external returns (address anchor) {
        uint256 pk        = vm.envUint("PRIVATE_KEY");
        address uni       = vm.envAddress("UNIVERSITY_SIGNER");
        address oracle    = vm.envAddress("ORACLE_SIGNER");

        console2.log("=== Deploy PixelOracleAnchor ===");
        console2.log("universitySigner:", uni);
        console2.log("oracleSigner:    ", oracle);

        vm.startBroadcast(pk);
        PixelOracleAnchor a = new PixelOracleAnchor(uni, oracle);
        vm.stopBroadcast();

        anchor = address(a);
        console2.log("PixelOracleAnchor:", anchor);
    }
}
