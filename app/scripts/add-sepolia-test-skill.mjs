#!/usr/bin/env node
/// @file scripts/add-sepolia-test-skill.mjs
/// @notice Adds ONE Sepolia-native skill so the Agent Console signing flow can
///         be tested end-to-end with FREE testnet ETH (no mainnet funds at
///         risk). Wrapping ETH→WETH on Sepolia is a real, beginner-friendly,
///         self-contained action whose contract lives on the same chain as the
///         marketplace — so the user can connect, sign, and complete on Sepolia.
///
/// Env: PINATA_JWT, RPC_URL (Sepolia), PRIVATE_KEY (deployer), SKILL_REGISTRY.
/// Run: node scripts/add-sepolia-test-skill.mjs   (DRY_RUN=1 to preview)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, parseEther, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.env.DRY_RUN === "1";
function envLocal() {
  const p = path.resolve(__dirname, "..", ".env.local"); const e = {};
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].trim(); }
  return e;
}
const ENV = { ...envLocal(), ...process.env };
const PINATA_JWT = ENV.PINATA_JWT;
const RPC_URL = ENV.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PRIVATE_KEY = ENV.PRIVATE_KEY || ENV.VERIFIER_PRIVATE_KEY;
const REGISTRY = ENV.SKILL_REGISTRY || "0x4d3572C0D529c4F3162aAB928D4336461823B9e7";

const MODULE = {
  spec_version: "skillai/skill-module/v2",
  name: "Wrap ETH → WETH (Sepolia testnet)",
  version: "1.0.0",
  description:
    "Wrap native ETH into WETH (Wrapped Ether) by depositing into the canonical WETH9 contract. The simplest possible on-chain action — and the testnet starter skill used to demo the Agent Console signing flow end-to-end on Sepolia.",
  category: "DeFi",
  difficulty: "beginner",
  chain: { id: 11155111, name: "Sepolia" },
  prerequisites: [],
  use_case:
    "An agent needs WETH (the ERC-20 form of ETH) to interact with DEXes and DeFi. It deposits ETH into WETH9 and receives WETH 1:1, withdrawable any time.",
  executable: {
    kind: "smart_contract_interaction",
    contracts: [
      { role: "weth", name: "WETH9 (Sepolia)", address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        abi_fragments: [{ type: "function", name: "deposit", selector: "0xd0e30db0", stateMutability: "payable" }] },
    ],
    steps: [{ id: "wrap", action: "call", target: "$WETH", function: "deposit", params: { value: "$AMOUNT" } }],
  },
  verification: {
    auto_verifiable: true,
    criteria: "Tx target is the Sepolia WETH9 contract, function deposit() (payable), sender == agent. Post-tx WETH.balanceOf(agent) increased by the deposited amount.",
    min_score: 80,
  },
};

const REGISTRY_ABI = [
  { type: "function", name: "createSkill", stateMutability: "nonpayable",
    inputs: [{ name: "params", type: "tuple", components: [
      { name: "name", type: "string" }, { name: "description", type: "string" },
      { name: "category", type: "uint8" }, { name: "difficulty", type: "uint8" },
      { name: "priceInWei", type: "uint256" }, { name: "priceInUsdc", type: "uint256" },
      { name: "prerequisites", type: "uint256[]" }, { name: "contentURI", type: "string" },
    ]}], outputs: [{ name: "skillId", type: "uint256" }] },
  { type: "function", name: "totalSkills", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

async function pin(content, name) {
  const r = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST", headers: { Authorization: `Bearer ${PINATA_JWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataContent: content, pinataMetadata: { name } }),
  });
  if (!r.ok) throw new Error(`pin failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).IpfsHash;
}

async function main() {
  console.log(`Add Sepolia test skill · registry=${REGISTRY} · DRY=${DRY}`);
  console.log(`  ${MODULE.name} → WETH9 ${MODULE.executable.contracts[0].address}`);
  if (DRY) return;
  if (!PINATA_JWT) throw new Error("PINATA_JWT missing");

  const account = privateKeyToAccount(PRIVATE_KEY);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
  const pub = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

  const cid = await pin(MODULE, "41plus-sepolia-weth-wrap");
  const params = {
    name: MODULE.name, description: MODULE.description, category: 0, difficulty: 0,
    priceInWei: parseEther("0.0002"), priceInUsdc: parseUnits("0.49", 6), prerequisites: [],
    contentURI: `ipfs://${cid}`,
  };
  const hash = await wallet.writeContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "createSkill", args: [params] });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  const total = await pub.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "totalSkills" });
  console.log(`  created (${rcpt.status}) ipfs://${cid} — totalSkills now ${total} (new skill id = ${total})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
