#!/usr/bin/env node
/// @file scripts/revamp-catalogue.mjs
/// @notice One-shot catalogue revamp: add 13 NEW real, on-chain auto-verifiable
///         skills (verified addresses + selectors) and deactivate the 13
///         manual / placeholder / off-chain-without-verifier skills. Result:
///         every active skill is auto-verifiable on-chain.
///
///   - Generates each module JSON (written to /skill-modules for the repo).
///   - Pre-checks every declared address has bytecode on its declared chain.
///   - Pins to IPFS via Pinata (PINATA_JWT) and createSkill() on-chain.
///   - deactivateSkill() the old IDs.
///
/// Env: PINATA_JWT, RPC_URL (Sepolia), PRIVATE_KEY (deployer/admin),
///      SKILL_REGISTRY (default = live Sepolia). DRY_RUN=1 to skip on-chain.
///
/// Run: node scripts/revamp-catalogue.mjs            (executes)
///      DRY_RUN=1 node scripts/revamp-catalogue.mjs  (no chain writes)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, parseEther, parseUnits, toFunctionSelector } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // app/scripts
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULES_DIR = path.resolve(REPO_ROOT, "skill-modules");
const DRY = process.env.DRY_RUN === "1";

// --- env -------------------------------------------------------------------
function readEnvLocal() {
  const p = path.resolve(__dirname, "..", ".env.local"); // app/.env.local
  const env = {};
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
  }
  return env;
}
const ENV = { ...readEnvLocal(), ...process.env };
const PINATA_JWT = ENV.PINATA_JWT;
const RPC_URL = ENV.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PRIVATE_KEY = ENV.PRIVATE_KEY || ENV.VERIFIER_PRIVATE_KEY; // deployer = admin
const REGISTRY = ENV.SKILL_REGISTRY || "0x4d3572C0D529c4F3162aAB928D4336461823B9e7";

// --- pricing tiers ---------------------------------------------------------
const PRICE = {
  beginner:     { wei: parseEther("0.0002"), usdc: parseUnits("0.49", 6) },
  intermediate: { wei: parseEther("0.0012"), usdc: parseUnits("2.99", 6) },
  advanced:     { wei: parseEther("0.004"),  usdc: parseUnits("9.99", 6) },
  expert:       { wei: parseEther("0.010"),  usdc: parseUnits("24.99", 6) },
};
const CAT = { DeFi: 0, NFT: 1, Governance: 2, Social: 3, Trading: 4, Security: 5, CrossChain: 6, Custom: 7 };
const DIFF = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };
const CHAIN_NAME = { 1: "Ethereum Mainnet", 8453: "Base", 10: "OP Mainnet" };

// --- the 13 new skills -----------------------------------------------------
// sel: declared 4-byte selector (omit when ambiguous → address-only verify).
const S = (sig) => toFunctionSelector(sig);
const NEW = [
  { file: "41-rocketpool-reth.json", name: "Rocket Pool rETH Staking", cat: "DeFi", diff: "beginner", chain: 1,
    desc: "Stake ETH into Rocket Pool's decentralised node network and receive rETH, a value-accruing liquid staking token. No 32-ETH minimum, no node to run.",
    useCase: "Agent has idle ETH. Deposits into Rocket Pool → receives rETH that appreciates vs ETH as staking rewards accrue. Fully decentralised validator set, redeemable on secondary markets any time.",
    contracts: [
      { role: "deposit_pool", name: "RocketDepositPool", address: "0xDD3f50F8A6CafbE9b31a427582963f465E745AF8", sel: S("deposit()") },
      { role: "reth", name: "rETH", address: "0xae78736Cd615f374D3085123A210448E74Fc6393" },
    ],
    criteria: "Tx target is RocketDepositPool, function deposit() (payable). Post-tx rETH.balanceOf(agent) increased." },

  { file: "42-etherfi-eeth.json", name: "ether.fi eETH Liquid Restaking", cat: "DeFi", diff: "beginner", chain: 1,
    desc: "Deposit ETH into ether.fi and receive eETH — a natively-restaked liquid token earning both Ethereum staking and EigenLayer restaking rewards.",
    useCase: "Agent stakes ETH via ether.fi LiquidityPool → eETH (auto-restaked on EigenLayer) → double yield with one tx, liquid and composable across DeFi.",
    contracts: [
      { role: "liquidity_pool", name: "ether.fi LiquidityPool", address: "0x308861A430be4cce5502d0A12724771Fc6DaF216", sel: S("deposit()") },
      { role: "eeth", name: "eETH", address: "0x35fA164735182de50811E8e2E824cFb9B6118ac2" },
    ],
    criteria: "Tx target is ether.fi LiquidityPool, function deposit() (payable). Post-tx eETH.balanceOf(agent) increased." },

  { file: "43-renzo-ezeth.json", name: "Renzo ezETH Restaking", cat: "DeFi", diff: "intermediate", chain: 1,
    desc: "Restake ETH through Renzo's EigenLayer strategy manager and mint ezETH, a liquid restaking token with diversified AVS exposure.",
    useCase: "Agent deposits ETH into Renzo RestakeManager → ezETH → exposure to a managed basket of EigenLayer AVSs without picking operators manually.",
    contracts: [
      { role: "restake_manager", name: "Renzo RestakeManager", address: "0x74a09653A083691711cF8215a6ab074BB4e99ef5", sel: S("depositETH()") },
      { role: "ezeth", name: "ezETH", address: "0xbf5495Efe5DB9ce00f80364C8B423567e58d2110" },
    ],
    criteria: "Tx target is Renzo RestakeManager, function depositETH() (payable). Post-tx ezETH.balanceOf(agent) increased." },

  { file: "44-kelp-rseth.json", name: "Kelp DAO rsETH Restaking", cat: "DeFi", diff: "intermediate", chain: 1,
    desc: "Deposit ETH into Kelp DAO's liquid restaking pool to mint rsETH, accruing EigenLayer points and AVS rewards.",
    useCase: "Agent restakes ETH via Kelp LRTDepositPool → rsETH → liquid restaking position usable as collateral while earning restaking yield.",
    contracts: [
      { role: "deposit_pool", name: "Kelp LRTDepositPool", address: "0x036676389e48133B63a802f8635AD39E752D375D", sel: S("depositETH(uint256,string)") },
      { role: "rseth", name: "rsETH", address: "0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7" },
    ],
    criteria: "Tx target is Kelp LRTDepositPool, function depositETH. Post-tx rsETH.balanceOf(agent) increased." },

  { file: "45-ethena-susde.json", name: "Ethena sUSDe Staking", cat: "DeFi", diff: "beginner", chain: 1,
    desc: "Stake USDe into the sUSDe ERC-4626 vault to earn Ethena's protocol yield (funding + staking). One standard 4626 deposit.",
    useCase: "Agent holds USDe. Deposits into sUSDe (ERC-4626) → earns the sUSDe yield, redeemable to USDe after the cooldown. Dollar-denominated, no IL.",
    contracts: [
      { role: "susde", name: "sUSDe (ERC-4626)", address: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497", sel: S("deposit(uint256,address)") },
      { role: "usde", name: "USDe", address: "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3" },
    ],
    criteria: "Tx target is sUSDe, function deposit(assets,receiver), receiver == agent. Post-tx sUSDe.balanceOf(agent) increased." },

  { file: "46-sky-susds.json", name: "Sky sUSDS Savings", cat: "DeFi", diff: "beginner", chain: 1,
    desc: "Deposit USDS into sUSDS (Sky/MakerDAO successor) — an ERC-4626 vault paying the Sky Savings Rate. Zero liquidation risk.",
    useCase: "Agent parks USDS in sUSDS → earns the Sky Savings Rate, fully liquid, redeemable any block. The successor to the DAI Savings Rate.",
    contracts: [
      { role: "susds", name: "sUSDS (ERC-4626)", address: "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD", sel: S("deposit(uint256,address)") },
      { role: "usds", name: "USDS", address: "0xdC035D45d973E3EC169d2276DDab16f1e407384F" },
    ],
    criteria: "Tx target is sUSDS, function deposit(assets,receiver), receiver == agent. Post-tx sUSDS.balanceOf(agent) increased." },

  { file: "47-frax-sfrxeth.json", name: "Frax sfrxETH Staking", cat: "DeFi", diff: "intermediate", chain: 1,
    desc: "Deposit frxETH into sfrxETH (ERC-4626) to capture the full Frax ETH staking yield concentrated to sfrxETH holders.",
    useCase: "Agent converts ETH→frxETH then deposits into sfrxETH (4626) → receives the concentrated staking yield (frxETH stakers get all validator rewards).",
    contracts: [
      { role: "sfrxeth", name: "sfrxETH (ERC-4626)", address: "0xac3E018457B222d93114458476f3E3416Abbe38F", sel: S("deposit(uint256,address)") },
      { role: "frxeth", name: "frxETH", address: "0x5E8422345238F34275888049021821E8E08CAa1f" },
    ],
    criteria: "Tx target is sfrxETH, function deposit(assets,receiver), receiver == agent. Post-tx sfrxETH.balanceOf(agent) increased." },

  { file: "48-balancer-v2-swap.json", name: "Balancer V2 Vault Swap", cat: "DeFi", diff: "intermediate", chain: 1,
    desc: "Execute a single swap through the Balancer V2 Vault — the canonical entrypoint routing all Balancer pool trades.",
    useCase: "Agent swaps tokenIn→tokenOut through a Balancer weighted/stable pool via Vault.swap(), getting Balancer's pool liquidity in one call.",
    contracts: [
      { role: "vault", name: "Balancer V2 Vault", address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", sel: S("swap((bytes32,uint8,address,address,uint256,bytes),(address,bool,address,bool),uint256,uint256)") },
    ],
    criteria: "Tx target is the Balancer V2 Vault, function swap(...). Token balances changed consistent with the swap." },

  { file: "49-1inch-v6-swap.json", name: "1inch Aggregation Swap (V6)", cat: "DeFi", diff: "intermediate", chain: 1,
    desc: "Swap via the 1inch Aggregation Router V6 — best-price routing across hundreds of liquidity sources in a single tx.",
    useCase: "Agent gets optimal execution by routing a swap through 1inch V6, which splits across DEXes for minimal slippage.",
    contracts: [
      // selector omitted: V6 exposes many swap entrypoints (swap/unoswap/clipper…) — verify by router address.
      { role: "router", name: "1inch Aggregation Router V6", address: "0x111111125421cA6dc452d289314280a0f8842A65" },
    ],
    criteria: "Tx target is the 1inch Aggregation Router V6. Token balances changed consistent with a swap." },

  { file: "50-uniswap-universal-router.json", name: "Uniswap Universal Router Swap", cat: "DeFi", diff: "advanced", chain: 1,
    desc: "Execute swaps through Uniswap's Universal Router — the unified entrypoint for V2/V3/V4 routing with Permit2 and command batching.",
    useCase: "Agent batches an approve (via Permit2) + multi-hop swap into one Universal Router execute() call for gas-efficient best execution.",
    contracts: [
      { role: "universal_router", name: "Uniswap Universal Router", address: "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af", sel: S("execute(bytes,bytes[],uint256)") },
      { role: "permit2", name: "Permit2", address: "0x000000000022D473030F116dDEE9F6B43aC78BA3" },
    ],
    criteria: "Tx target is the Universal Router, function execute(...). Token balances changed consistent with the routed swap." },

  { file: "51-lido-wsteth-wrap.json", name: "Lido wstETH Wrap", cat: "DeFi", diff: "beginner", chain: 1,
    desc: "Wrap rebasing stETH into wstETH — the non-rebasing, DeFi-composable form of Lido staked ETH used as collateral everywhere.",
    useCase: "Agent holds stETH but needs a non-rebasing token for an LP/lending position. Calls wstETH.wrap(stETH) → wstETH, value-accruing and composable.",
    contracts: [
      { role: "wsteth", name: "wstETH", address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", sel: S("wrap(uint256)") },
      { role: "steth", name: "stETH", address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" },
    ],
    criteria: "Tx target is wstETH, function wrap(uint256). Post-tx wstETH.balanceOf(agent) increased." },

  { file: "52-aerodrome-base-swap.json", name: "Aerodrome Swap (Base)", cat: "DeFi", diff: "intermediate", chain: 8453,
    desc: "Swap on Base through Aerodrome — the dominant Solidly-style AMM on Base — via its canonical Router.",
    useCase: "Agent operating on Base swaps tokens through Aerodrome's router using stable/volatile routes for deep Base-native liquidity.",
    contracts: [
      { role: "router", name: "Aerodrome Router", address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", sel: S("swapExactTokensForTokens(uint256,uint256,(address,address,bool,address)[],address,uint256)") },
    ],
    criteria: "Tx target is the Aerodrome Router on Base (8453), function swapExactTokensForTokens. Token balances changed consistent with the swap." },

  { file: "53-velodrome-op-swap.json", name: "Velodrome Swap (Optimism)", cat: "DeFi", diff: "intermediate", chain: 10,
    desc: "Swap on Optimism through Velodrome — the leading Solidly-style AMM on OP Mainnet — via its canonical Router.",
    useCase: "Agent operating on Optimism swaps tokens through Velodrome's router across stable/volatile routes for deep OP-native liquidity.",
    contracts: [
      { role: "router", name: "Velodrome Router", address: "0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858", sel: S("swapExactTokensForTokens(uint256,uint256,(address,address,bool,address)[],address,uint256)") },
    ],
    criteria: "Tx target is the Velodrome Router on Optimism (10), function swapExactTokensForTokens. Token balances changed consistent with the swap." },
];

const DEACTIVATE_IDS = [3, 6, 9, 10, 14, 19, 21, 22, 25, 30, 32, 33, 36];

// --- module builder --------------------------------------------------------
function buildModule(spec) {
  const contracts = spec.contracts.map((c) => {
    const out = { role: c.role, name: c.name, address: c.address };
    if (c.sel) out.abi_fragments = [{ type: "function", selector: c.sel, stateMutability: "nonpayable" }];
    return out;
  });
  return {
    spec_version: "skillai/skill-module/v2",
    name: spec.name,
    version: "1.0.0",
    description: spec.desc,
    category: spec.cat,
    difficulty: spec.diff,
    chain: { id: spec.chain, name: CHAIN_NAME[spec.chain] },
    prerequisites: [],
    use_case: spec.useCase,
    executable: {
      kind: "smart_contract_interaction",
      contracts,
      steps: [
        { id: "interact", action: "call", target: "$" + spec.contracts[0].role.toUpperCase(), function: "main", params: {} },
      ],
    },
    verification: { auto_verifiable: true, criteria: spec.criteria, min_score: 90 },
  };
}

// --- abis ------------------------------------------------------------------
const REGISTRY_ABI = [
  { type: "function", name: "createSkill", stateMutability: "nonpayable",
    inputs: [{ name: "params", type: "tuple", components: [
      { name: "name", type: "string" }, { name: "description", type: "string" },
      { name: "category", type: "uint8" }, { name: "difficulty", type: "uint8" },
      { name: "priceInWei", type: "uint256" }, { name: "priceInUsdc", type: "uint256" },
      { name: "prerequisites", type: "uint256[]" }, { name: "contentURI", type: "string" },
    ]}], outputs: [{ name: "skillId", type: "uint256" }] },
  { type: "function", name: "deactivateSkill", stateMutability: "nonpayable", inputs: [{ name: "skillId", type: "uint256" }], outputs: [] },
];

const PUBLIC_RPC = { 1: "https://ethereum-rpc.publicnode.com", 8453: "https://base-rpc.publicnode.com", 10: "https://optimism-rpc.publicnode.com" };
async function assertBytecode(chain, addr) {
  const c = createPublicClient({ transport: http(PUBLIC_RPC[chain]) });
  const code = await c.getCode({ address: addr });
  if (!code || code === "0x") throw new Error(`NO bytecode for ${addr} on chain ${chain}`);
}

async function pin(module, name) {
  const r = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataContent: module, pinataMetadata: { name } }),
  });
  if (!r.ok) throw new Error(`Pinata pin failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).IpfsHash;
}

async function main() {
  if (!PINATA_JWT) throw new Error("PINATA_JWT missing");
  console.log(`Revamp catalogue · registry=${REGISTRY} · DRY_RUN=${DRY}`);

  // 1. Build + write + verify all modules first (fail fast before any chain write).
  const prepared = [];
  for (const spec of NEW) {
    const mod = buildModule(spec);
    for (const c of spec.contracts) await assertBytecode(spec.chain, c.address);
    fs.writeFileSync(path.join(MODULES_DIR, spec.file), JSON.stringify(mod, null, 2) + "\n");
    prepared.push({ spec, mod });
    console.log(`  ✓ ${spec.file} — ${spec.contracts.length} addr verified on chain ${spec.chain}`);
  }
  console.log(`\nAll ${prepared.length} modules built + addresses verified.`);

  if (DRY) { console.log("DRY_RUN — skipping IPFS pin + on-chain writes."); return; }

  const account = privateKeyToAccount(PRIVATE_KEY);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
  const pub = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
  console.log(`\nSigner ${account.address}`);

  // 2. Pin + createSkill for each new module.
  for (const { spec, mod } of prepared) {
    const cid = await pin(mod, spec.file);
    const tier = PRICE[spec.diff];
    const params = {
      name: mod.name, description: mod.description, category: CAT[spec.cat], difficulty: DIFF[spec.diff],
      priceInWei: tier.wei, priceInUsdc: tier.usdc, prerequisites: [], contentURI: `ipfs://${cid}`,
    };
    const hash = await wallet.writeContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "createSkill", args: [params] });
    const rcpt = await pub.waitForTransactionReceipt({ hash });
    console.log(`  + created ${spec.name}  ipfs://${cid}  (${rcpt.status})`);
  }

  // 3. Deactivate the old manual/placeholder skills.
  for (const id of DEACTIVATE_IDS) {
    const hash = await wallet.writeContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "deactivateSkill", args: [BigInt(id)] });
    const rcpt = await pub.waitForTransactionReceipt({ hash });
    console.log(`  - deactivated #${id}  (${rcpt.status})`);
  }

  console.log("\nDone. Re-run `npm run check:drift:onchain` to confirm a clean catalogue.");
}
main().catch((e) => { console.error(e); process.exit(1); });
