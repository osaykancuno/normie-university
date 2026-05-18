// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script}            from "forge-std/Script.sol";
import {console2}          from "forge-std/console2.sol";
import {AgentRegistry}     from "../src/core/AgentRegistry.sol";
import {SkillRegistry}     from "../src/core/SkillRegistry.sol";
import {SkillCredential}   from "../src/core/SkillCredential.sol";
import {Treasury}          from "../src/treasury/Treasury.sol";
import {SkillMarketplace}  from "../src/marketplace/SkillMarketplace.sol";
import {CrossChainReceiver} from "../src/marketplace/CrossChainReceiver.sol";
import {PathRegistry}       from "../src/marketplace/PathRegistry.sol";
import {ValidationRegistry} from "../src/reputation/ValidationRegistry.sol";
import {ReputationEngine}  from "../src/reputation/ReputationEngine.sol";

/// @title  Deploy
/// @notice One-shot deploy of every SKILLAI v1 contract on Base Sepolia or
///         Base Mainnet, plus the role wiring required for the system to
///         function.
///
/// Required env:
///   PRIVATE_KEY          — deployer key (will be admin until handover)
///   ADMIN_ADDRESS        — final admin (multisig on mainnet); defaults to deployer
///   USDC_ADDRESS         — canonical USDC on the target chain
///                          84532 default: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
///                          8453  default: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
///   VERIFIER_ADDRESS     — optional; granted VERIFIER_ROLE if set
///   BRIDGE_ADDRESS       — optional; granted BRIDGE_ROLE on CrossChainReceiver
///
/// Run:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url base_sepolia \
///     --broadcast \
///     --verify
contract Deploy is Script {
    struct Deployed {
        address agentRegistry;
        address skillRegistry;
        address skillCredential;
        address treasury;
        address validationRegistry;
        address reputationEngine;
        address marketplace;
        address crossChainReceiver;
        address pathRegistry;
        address usdc;
        address admin;
        uint256 chainId;
    }

    function run() external returns (Deployed memory d) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer   = vm.addr(deployerPk);
        address admin      = vm.envOr("ADMIN_ADDRESS", deployer);

        address usdc = vm.envOr("USDC_ADDRESS", _defaultUsdc());

        console2.log("=== SKILLAI Deploy ===");
        console2.log("chainId:  ", block.chainid);
        console2.log("deployer: ", deployer);
        console2.log("admin:    ", admin);
        console2.log("usdc:     ", usdc);

        vm.startBroadcast(deployerPk);

        // 1. Core registries
        AgentRegistry agentReg = new AgentRegistry(admin);
        SkillRegistry skillReg = new SkillRegistry(admin);
        SkillCredential cred   = new SkillCredential(admin);

        // 2. Treasury
        Treasury treasury = new Treasury(admin);

        // 3. Reputation stack
        ValidationRegistry vreg = new ValidationRegistry(admin);
        ReputationEngine repEng = new ReputationEngine(
            admin,
            address(agentReg),
            address(skillReg),
            address(cred),
            address(vreg)
        );

        // 4. Marketplace
        SkillMarketplace market = new SkillMarketplace(
            admin,
            address(skillReg),
            address(cred),
            address(treasury),
            usdc
        );

        // 5. Cross-chain receiver
        CrossChainReceiver xchain = new CrossChainReceiver(
            admin,
            address(market),
            usdc
        );

        // 6. Path registry (Learning Paths v1)
        PathRegistry pathReg = new PathRegistry(
            admin,
            address(skillReg),
            address(market),
            usdc
        );

        vm.stopBroadcast();

        // 6. Wire-up phase: must be done from `admin`. If admin == deployer we
        //    can do it inline; otherwise it must be done by the multisig.
        if (admin == deployer) {
            vm.startBroadcast(deployerPk);
            _wireUp(admin, agentReg, skillReg, cred, treasury, market, xchain, repEng, pathReg);
            vm.stopBroadcast();
        } else {
            console2.log(
                "ADMIN_ADDRESS differs from deployer - run WireUp.s.sol from the admin multisig"
            );
        }

        d = Deployed({
            agentRegistry:      address(agentReg),
            skillRegistry:      address(skillReg),
            skillCredential:    address(cred),
            treasury:           address(treasury),
            validationRegistry: address(vreg),
            reputationEngine:   address(repEng),
            marketplace:        address(market),
            crossChainReceiver: address(xchain),
            pathRegistry:       address(pathReg),
            usdc:               usdc,
            admin:              admin,
            chainId:            block.chainid
        });

        _log(d);
        _writeAddressesJson(d);
    }

    function _defaultUsdc() internal view returns (address) {
        // Ethereum Sepolia — Circle test USDC
        if (block.chainid == 11155111) {
            return 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        }
        // Ethereum Mainnet — Circle USDC
        if (block.chainid == 1) {
            return 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
        }
        // Base Sepolia — legacy support
        if (block.chainid == 84532) {
            return 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        }
        // Base Mainnet — legacy support
        if (block.chainid == 8453) {
            return 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        }
        return address(0);
    }

    function _wireUp(
        address admin,
        AgentRegistry,
        SkillRegistry skillReg,
        SkillCredential cred,
        Treasury treasury,
        SkillMarketplace market,
        CrossChainReceiver xchain,
        ReputationEngine repEng,
        PathRegistry pathReg
    ) internal {
        // SkillRegistry needs to know the marketplace (recordPurchase / recordCompletion / rateSkill)
        skillReg.grantMarketplaceRole(address(market));

        // SkillCredential mint must come from the marketplace
        cred.grantMarketplaceRole(address(market));

        // Cross-chain receiver must be allowed to call purchaseSkillCrossChain
        market.grantCrossChainRole(address(xchain));

        // PathRegistry must be allowed to dispatch bundled purchases
        market.grantPathRole(address(pathReg));

        // Wire reputation engine into the marketplace
        market.setReputationEngine(address(repEng));

        // Optional verifier
        address verifier = vm.envOr("VERIFIER_ADDRESS", address(0));
        if (verifier != address(0)) {
            market.grantVerifierRole(verifier);
        }

        // Optional bridge (LayerZero / Axelar / CCIP adapter)
        address bridge = vm.envOr("BRIDGE_ADDRESS", address(0));
        if (bridge != address(0)) {
            xchain.grantBridgeRole(bridge);
        }

        // Optional publisher key (separate from admin) to seed the catalogue
        // without exposing the multisig signers to seed transactions.
        address publisher = vm.envOr("CREATOR_ADDRESS", address(0));
        if (publisher != address(0)) {
            skillReg.grantCreatorRole(publisher);
            pathReg.grantCreatorRole(publisher);
        }

        // Optional Aave V3 yield deployment — admin can wire it later via
        // Treasury.configureAave(); we surface it here for one-shot bootstrap.
        // On Base mainnet:
        //   AAVE_POOL=0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
        //   AAVE_ETH_GATEWAY=<from Aave address-book at deploy time>
        // On Base Sepolia Aave is not officially deployed — leave unset.
        address aavePool       = vm.envOr("AAVE_POOL",        address(0));
        address aaveEthGateway = vm.envOr("AAVE_ETH_GATEWAY", address(0));
        if (aavePool != address(0) || aaveEthGateway != address(0)) {
            treasury.configureAave(aavePool, aaveEthGateway);
        }

        // Silence "admin unused" warning
        admin;
    }

    function _log(Deployed memory d) internal pure {
        console2.log("");
        console2.log("=== Deployed Contracts ===");
        console2.log("AgentRegistry:      ", d.agentRegistry);
        console2.log("SkillRegistry:      ", d.skillRegistry);
        console2.log("SkillCredential:    ", d.skillCredential);
        console2.log("Treasury:           ", d.treasury);
        console2.log("ValidationRegistry: ", d.validationRegistry);
        console2.log("ReputationEngine:   ", d.reputationEngine);
        console2.log("SkillMarketplace:   ", d.marketplace);
        console2.log("CrossChainReceiver: ", d.crossChainReceiver);
        console2.log("PathRegistry:       ", d.pathRegistry);
    }

    /// @notice Writes deployments/<chainId>.json and an .env.local snippet.
    ///         Foundry's --broadcast already produces broadcast/<chainId>.json
    ///         but this is shaped for the Next.js frontend to consume.
    function _writeAddressesJson(Deployed memory d) internal {
        string memory chain = vm.toString(d.chainId);
        string memory j1 = string.concat(
            "{\n",
            '  "chainId": ',           chain, ",\n",
            '  "admin": "',            vm.toString(d.admin),              '",\n',
            '  "usdc": "',             vm.toString(d.usdc),               '",\n',
            '  "agentRegistry": "',    vm.toString(d.agentRegistry),      '",\n',
            '  "skillRegistry": "',    vm.toString(d.skillRegistry),      '",\n',
            '  "skillCredential": "',  vm.toString(d.skillCredential),    '",\n'
        );
        string memory j2 = string.concat(
            '  "treasury": "',         vm.toString(d.treasury),           '",\n',
            '  "validationRegistry": "', vm.toString(d.validationRegistry), '",\n',
            '  "reputationEngine": "', vm.toString(d.reputationEngine),   '",\n',
            '  "marketplace": "',      vm.toString(d.marketplace),        '",\n',
            '  "crossChainReceiver": "', vm.toString(d.crossChainReceiver), '",\n',
            '  "pathRegistry": "',     vm.toString(d.pathRegistry),       '"\n',
            "}\n"
        );
        vm.writeFile(string.concat("deployments/", chain, ".json"), string.concat(j1, j2));

        // Also emit an env snippet the frontend can paste into .env.local
        _writeEnvSnippet(d, chain);
    }

    function _writeEnvSnippet(Deployed memory d, string memory chain) internal {
        string memory net =
            (d.chainId == 1 || d.chainId == 8453) ? "mainnet" : "testnet";
        string memory part1 = string.concat(
            "# SKILLAI deployment on chain ", chain, "\n",
            "NEXT_PUBLIC_NETWORK=", net, "\n",
            "NEXT_PUBLIC_AGENT_REGISTRY_",   chain, "=", vm.toString(d.agentRegistry),   "\n",
            "NEXT_PUBLIC_SKILL_REGISTRY_",   chain, "=", vm.toString(d.skillRegistry),   "\n",
            "NEXT_PUBLIC_SKILL_CREDENTIAL_", chain, "=", vm.toString(d.skillCredential), "\n",
            "NEXT_PUBLIC_SKILL_MARKETPLACE_",chain, "=", vm.toString(d.marketplace),     "\n"
        );
        string memory part2 = string.concat(
            "NEXT_PUBLIC_REPUTATION_ENGINE_",   chain, "=", vm.toString(d.reputationEngine),   "\n",
            "NEXT_PUBLIC_TREASURY_",            chain, "=", vm.toString(d.treasury),           "\n",
            "NEXT_PUBLIC_VALIDATION_REGISTRY_", chain, "=", vm.toString(d.validationRegistry), "\n",
            "NEXT_PUBLIC_CROSS_CHAIN_RECEIVER_",chain, "=", vm.toString(d.crossChainReceiver), "\n",
            "NEXT_PUBLIC_PATH_REGISTRY_",       chain, "=", vm.toString(d.pathRegistry),       "\n"
        );
        vm.writeFile(
            string.concat("deployments/", chain, ".env"),
            string.concat(part1, part2)
        );
    }
}
