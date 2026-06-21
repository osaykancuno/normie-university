#!/usr/bin/env node
/// @file scripts/seed-paths.mjs
/// @notice Seed real on-chain learning PATHS (curated skill bundles sold at a
///         discount) into PathRegistry, built only from ACTIVE auto-verifiable
///         skills. createPath validates every skill is active on-chain, so this
///         can only reference a real, working catalogue.
///
/// Env: PINATA_JWT, RPC_URL (Sepolia), PRIVATE_KEY (deployer w/ CREATOR_ROLE),
///      PATH_REGISTRY (default = live Sepolia). DRY_RUN=1 to skip chain writes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.env.DRY_RUN === "1";

function readEnvLocal() {
  const p = path.resolve(__dirname, "..", ".env.local");
  const env = {};
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
  }
  return env;
}
const ENV = { ...readEnvLocal(), ...process.env };
const PINATA_JWT = ENV.PINATA_JWT;
const RPC_URL = ENV.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PRIVATE_KEY = ENV.PRIVATE_KEY || ENV.VERIFIER_PRIVATE_KEY;
const REGISTRY = ENV.PATH_REGISTRY || "0x16555d59EaE75Ebba1B07dD46520C42Be6a59472";

// --- the 5 curated paths (skillIds must be ACTIVE on-chain) ----------------
const PATHS = [
  { name: "Liquid Staking Foundations",
    description: "Master Ethereum liquid staking end-to-end: stake via Lido, Rocket Pool and ether.fi, then wrap into the composable wstETH used as collateral across DeFi.",
    skillIds: [24, 41, 42, 51], discountBps: 1500 },
  { name: "Restaking Pro",
    description: "Go beyond staking into EigenLayer restaking — mint ezETH and rsETH through Renzo and Kelp, and restake natively via EigenLayer for layered AVS yield.",
    skillIds: [43, 44, 23], discountBps: 2000 },
  { name: "Stablecoin Yield Engine",
    description: "Put dollars to work with zero liquidation risk: Ethena sUSDe, Sky sUSDS savings, and the Maker DSR via sDAI — three battle-tested ERC-4626 yield vaults.",
    skillIds: [45, 46, 39], discountBps: 1500 },
  { name: "DEX Execution Master",
    description: "Best-execution trading across the majors: Uniswap V3 + Universal Router, Balancer V2, Curve stable pools, and 1inch aggregation for optimal routing.",
    skillIds: [1, 48, 49, 50, 38], discountBps: 2500 },
  { name: "Multi-Chain DeFi",
    description: "Operate beyond mainnet: swap on Base via Aerodrome and on Optimism via Velodrome, bridge with Across, and trade perps on Arbitrum with GMX V2.",
    skillIds: [52, 53, 26, 40], discountBps: 2000 },
];

const REGISTRY_ABI = [
  { type: "function", name: "createPath", stateMutability: "nonpayable",
    inputs: [{ name: "params", type: "tuple", components: [
      { name: "name", type: "string" }, { name: "description", type: "string" },
      { name: "skillIds", type: "uint256[]" }, { name: "discountBps", type: "uint16" },
      { name: "contentURI", type: "string" },
    ]}], outputs: [{ name: "pathId", type: "uint256" }] },
  { type: "function", name: "totalPaths", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

async function pin(content, name) {
  const r = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataContent: content, pinataMetadata: { name } }),
  });
  if (!r.ok) throw new Error(`Pinata pin failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).IpfsHash;
}

async function main() {
  if (!PINATA_JWT) throw new Error("PINATA_JWT missing");
  console.log(`Seed paths · registry=${REGISTRY} · DRY_RUN=${DRY}`);
  for (const p of PATHS) {
    console.log(`  • ${p.name}  skills=[${p.skillIds.join(",")}]  -${p.discountBps / 100}%`);
  }
  if (DRY) { console.log("DRY_RUN — no chain writes."); return; }

  const account = privateKeyToAccount(PRIVATE_KEY);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
  const pub = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
  console.log(`\nSigner ${account.address}`);

  for (const p of PATHS) {
    const cid = await pin(
      { type: "skillai/learning-path/v1", name: p.name, description: p.description, skillIds: p.skillIds, discountBps: p.discountBps },
      `path-${p.name}`
    );
    const params = {
      name: p.name, description: p.description,
      skillIds: p.skillIds.map((n) => BigInt(n)), discountBps: p.discountBps,
      contentURI: `ipfs://${cid}`,
    };
    const hash = await wallet.writeContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "createPath", args: [params] });
    const rcpt = await pub.waitForTransactionReceipt({ hash });
    console.log(`  + ${p.name}  ipfs://${cid}  (${rcpt.status})`);
  }

  const total = await pub.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "totalPaths" });
  console.log(`\nDone. totalPaths = ${total}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
