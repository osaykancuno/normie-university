/// @file seed-skills.ts
/// @notice Seed the SkillRegistry with the 8 example skill modules in /skill-modules.
///         Pins each module to IPFS via the SKILLAI /api/ipfs/upload endpoint
///         (which uses Pinata), then calls SkillRegistry.createSkill on-chain.
///
/// Required env:
///   BASE_URL                — SKILLAI deployment URL (e.g. http://localhost:3000)
///   CREATOR_PRIVATE_KEY     — hex private key of the seed creator (0x...)
///   RPC_URL                 — Base Sepolia / Mainnet RPC
///   SKILL_REGISTRY_ADDRESS  — deployed SkillRegistry
///   CHAIN                   — "base-sepolia" (default) | "base"
///
/// Run: npx tsx scripts/seed-skills.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(__dirname, "..", "skill-modules");

// ---------------------------------------------------------------------------
// Catalogue: maps each module file to on-chain params
// ---------------------------------------------------------------------------

type CategoryName =
  | "DeFi" | "NFT" | "Governance" | "Social"
  | "Trading" | "Security" | "CrossChain" | "Custom";
const CATEGORY: Record<CategoryName, number> = {
  DeFi: 0, NFT: 1, Governance: 2, Social: 3,
  Trading: 4, Security: 5, CrossChain: 6, Custom: 7,
};

type DifficultyName = "beginner" | "intermediate" | "advanced" | "expert";
const DIFFICULTY: Record<DifficultyName, number> = {
  beginner: 0, intermediate: 1, advanced: 2, expert: 3,
};

/// Tier-based pricing (Fase 1 confirmed):
///   Beginner     : $1
///   Intermediate : $5
///   Advanced     : $15
///   Expert       : $30
/// ETH equivalents assume ~$2,500/ETH; testnet only — adjust for mainnet.
/// Community pricing (aggressive volume tier — set Nov 2025):
///   Beginner     $0.49  (4 skills)
///   Intermediate $2.99  (6 skills)
///   Advanced     $9.99  (3 skills)
///   Expert       $24.99 (3 skills)
/// ETH ≈ priced at ~$2,500/ETH. Adjust per market at deploy time.
const CATALOGUE: Array<{
  file: string;
  priceInWei: bigint;
  priceInUsdc: bigint;
}> = [
  // Intermediate $2.99
  { file: "01-uniswap-v3-swap.json",         priceInWei: parseEther("0.0012"), priceInUsdc: parseUnits("2.99",  6) },
  // Beginner $0.49
  { file: "02-aave-v3-supply.json",          priceInWei: parseEther("0.0002"), priceInUsdc: parseUnits("0.49",  6) },
  // Intermediate $2.99
  { file: "03-erc20-permit.json",            priceInWei: parseEther("0.0012"), priceInUsdc: parseUnits("2.99",  6) },
  // Advanced $9.99
  { file: "04-x402-payment.json",            priceInWei: parseEther("0.004"),  priceInUsdc: parseUnits("9.99",  6) },
  // Beginner $0.49
  { file: "05-erc8004-registration.json",    priceInWei: parseEther("0.0002"), priceInUsdc: parseUnits("0.49",  6) },
  // Advanced $9.99
  { file: "06-safe-multisig-tx.json",        priceInWei: parseEther("0.004"),  priceInUsdc: parseUnits("9.99",  6) },
  // Advanced $9.99
  { file: "07-mev-protection.json",          priceInWei: parseEther("0.004"),  priceInUsdc: parseUnits("9.99",  6) },
  // Expert $24.99
  { file: "08-cross-chain-purchase.json",    priceInWei: parseEther("0.010"),  priceInUsdc: parseUnits("24.99", 6) },
  // Beginner $0.49
  { file: "09-erc721-mint.json",             priceInWei: parseEther("0.0002"), priceInUsdc: parseUnits("0.49",  6) },
  // Intermediate $2.99
  { file: "10-eip2981-royalty.json",         priceInWei: parseEther("0.0012"), priceInUsdc: parseUnits("2.99",  6) },
  // Intermediate $2.99
  { file: "11-sushiswap-v2-trading.json",    priceInWei: parseEther("0.0012"), priceInUsdc: parseUnits("2.99",  6) },
  // Expert $24.99
  { file: "12-arbitrage-detection.json",     priceInWei: parseEther("0.010"),  priceInUsdc: parseUnits("24.99", 6) },
  // Intermediate $2.99
  { file: "13-snapshot-voting.json",         priceInWei: parseEther("0.0012"), priceInUsdc: parseUnits("2.99",  6) },
  // Expert $24.99
  { file: "14-zk-proof-verification.json",   priceInWei: parseEther("0.010"),  priceInUsdc: parseUnits("24.99", 6) },
  // Beginner $0.49
  { file: "15-ens-resolution.json",          priceInWei: parseEther("0.0002"), priceInUsdc: parseUnits("0.49",  6) },
  // Intermediate $2.99
  { file: "16-normies-api-integration.json", priceInWei: parseEther("0.0012"), priceInUsdc: parseUnits("2.99",  6) },
];

// SkillRegistry.createSkill ABI fragment
const SKILL_REGISTRY_ABI = [
  {
    type: "function",
    name: "createSkill",
    stateMutability: "nonpayable",
    inputs: [{
      name: "params",
      type: "tuple",
      components: [
        { name: "name",          type: "string" },
        { name: "description",   type: "string" },
        { name: "category",      type: "uint8"  },
        { name: "difficulty",    type: "uint8"  },
        { name: "priceInWei",    type: "uint256"},
        { name: "priceInUsdc",   type: "uint256"},
        { name: "prerequisites", type: "uint256[]" },
        { name: "contentURI",    type: "string" },
      ],
    }],
    outputs: [{ name: "skillId", type: "uint256" }],
  },
] as const;

// ---------------------------------------------------------------------------

async function main() {
  const baseUrl  = required("BASE_URL");
  const pk       = required("CREATOR_PRIVATE_KEY") as `0x${string}`;
  const rpcUrl   = required("RPC_URL");
  const registry = required("SKILL_REGISTRY_ADDRESS") as Address;
  const chainName = process.env.CHAIN ?? "sepolia";
  const chainId  =
    chainName === "mainnet"      ? mainnet      :
    chainName === "sepolia"      ? sepolia      :
    chainName === "base"         ? base         :
    chainName === "base-sepolia" ? baseSepolia  : sepolia;

  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, chain: chainId, transport: http(rpcUrl) });
  const publicClient = createPublicClient({ chain: chainId, transport: http(rpcUrl) });

  console.log(`Seeding from ${account.address} on chain ${chainId.id}`);

  for (const item of CATALOGUE) {
    const filePath = path.join(MODULES_DIR, item.file);
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // 1. Pin to IPFS via the API (or deterministic placeholder if SKIP_IPFS=1)
    let pinned: { uri: string; cid: string };
    if (process.env.SKIP_IPFS === "1") {
      const { createHash } = await import("node:crypto");
      const hash = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
      pinned = { cid: `placeholder-${hash.slice(0, 20)}`, uri: `ipfs://placeholder/${hash}` };
      process.stdout.write(`  ${item.file} → ${pinned.cid} (SKIP_IPFS)\n`);
    } else {
      process.stdout.write(`  ${item.file} → IPFS...`);
      const pinRes = await fetch(`${baseUrl}/api/ipfs/upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ module: raw }),
      });
      if (!pinRes.ok) {
        console.log(` FAILED (${pinRes.status})`);
        const err = await pinRes.text().catch(() => "");
        throw new Error(`Pinata pin failed: ${err.slice(0, 200)}`);
      }
      pinned = await pinRes.json();
      process.stdout.write(` ${pinned.cid}\n`);
    }

    // 2. createSkill on-chain
    const params = {
      name:          raw.name,
      description:   raw.description,
      category:      CATEGORY[raw.category as CategoryName] ?? CATEGORY.Custom,
      difficulty:    DIFFICULTY[raw.difficulty as DifficultyName] ?? 0,
      priceInWei:    item.priceInWei,
      priceInUsdc:   item.priceInUsdc,
      prerequisites: (raw.prerequisites ?? []).map((p: number) => BigInt(p)),
      contentURI:    pinned.uri,
    };

    process.stdout.write(`    createSkill...`);
    const txHash = await wallet.writeContract({
      address: registry,
      abi: SKILL_REGISTRY_ABI,
      functionName: "createSkill",
      args: [params],
    });
    process.stdout.write(` ${txHash}\n`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") throw new Error(`createSkill reverted for ${item.file}`);
  }

  console.log("\nDone. All skills published.");
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
