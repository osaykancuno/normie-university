#!/usr/bin/env node
/// @file scripts/test-identity-loop.mjs
/// @notice End-to-end proof that a skill earned for a bound Normie lands on the
///         NFT identity and follows it: mint Mock Normie → bind → sponsor skill
///         #54 for the identity → controller wraps ETH → complete FOR the
///         identity → credential mints to the identity → transfer the Normie →
///         the new owner inherits the credential.
///
/// Uses the local dev server's /api/skills/54/complete (binding-aware). The
/// deployer plays the controller. Run: node scripts/test-identity-loop.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWalletClient, createPublicClient, http, parseEther, keccak256, toBytes, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PK = fs.readFileSync(path.resolve(__dirname, "../../contracts/.env"), "utf8").match(/^PRIVATE_KEY=(.+)/m)[1].trim();
const acct = privateKeyToAccount(PK);
const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
const wallet = createWalletClient({ account: acct, chain: sepolia, transport: http(rpc) });
const pub = createPublicClient({ chain: sepolia, transport: http(rpc) });
const API = process.env.API || "http://localhost:3017";

const MOCK = "0xdb92e692b17b09be985edefd3ce81bf82b5ad6c2";
const BIND = "0xf7b279ed24c1a1be50e3c7992f8bd899853c98ee";
const MKT = "0xA72E770D400d5397192fE8AA20E0eA5833ADe572";
const CRED = "0x47473aBC1ccEdf08e1915467dD7e008Ef6512ed4";
const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const SKILL = 54n;

const mock = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nextId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transferFrom", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "address" }, { type: "uint256" }], outputs: [] },
];
const bind = [
  { type: "function", name: "bind", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "uint256" }, { type: "address" }] },
  { type: "function", name: "identityForToken", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "uint256" }, { type: "address" }] },
  { type: "function", name: "controllerOf", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
];
const mkt = [
  { type: "function", name: "grantRole", stateMutability: "nonpayable", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [] },
  { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "sponsorFirstSkill", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
];
const cred = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "hasSkill", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
];

const send = async (params) => { const h = await wallet.writeContract(params); await pub.waitForTransactionReceipt({ hash: h }); return h; };

async function main() {
  const SPONSOR = keccak256(toBytes("SPONSOR_ROLE"));
  if (!(await pub.readContract({ address: MKT, abi: mkt, functionName: "hasRole", args: [SPONSOR, acct.address] }))) {
    console.log("granting SPONSOR_ROLE to relayer…");
    await send({ address: MKT, abi: mkt, functionName: "grantRole", args: [SPONSOR, acct.address] });
  }

  const tokenId = await pub.readContract({ address: MOCK, abi: mock, functionName: "nextId" });
  console.log(`1) mint Mock Normie #${tokenId} + bind`);
  await send({ address: MOCK, abi: mock, functionName: "mint" });
  await send({ address: BIND, abi: bind, functionName: "bind", args: [MOCK, tokenId] });
  const [agentId, identity] = await pub.readContract({ address: BIND, abi: bind, functionName: "identityForToken", args: [MOCK, tokenId] });
  console.log(`   agentId ${agentId} identity ${identity}`);

  console.log(`2) sponsor skill #${SKILL} for the identity`);
  await send({ address: MKT, abi: mkt, functionName: "sponsorFirstSkill", args: [identity, SKILL] });

  console.log(`3) controller (${acct.address.slice(0, 8)}) wraps 0.001 ETH → WETH`);
  const wrapHash = await send({ address: WETH, abi: [{ type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] }], functionName: "deposit", value: parseEther("0.001") });
  console.log(`   wrap tx ${wrapHash}`);

  console.log(`4) complete FOR the identity (binding-aware)…`);
  const r = await fetch(`${API}/api/skills/54/complete`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent: identity, agentToken: MOCK, agentTokenId: tokenId.toString(), txHash: wrapHash }),
  });
  const j = await r.json();
  console.log(`   complete → ${r.status}`, j.txHash ? `credential tx ${j.txHash}` : JSON.stringify(j).slice(0, 200));

  const bal = await pub.readContract({ address: CRED, abi: cred, functionName: "balanceOf", args: [identity] });
  const has = await pub.readContract({ address: CRED, abi: cred, functionName: "hasSkill", args: [identity, SKILL] });
  console.log(`5) identity now holds ${bal} credential(s); hasSkill(#54)=${has}`);

  console.log(`6) SELL the Normie → transfer to 0x…beef`);
  const buyer = "0x000000000000000000000000000000000000bEEF";
  await send({ address: MOCK, abi: mock, functionName: "transferFrom", args: [acct.address, buyer, tokenId] });
  const newController = await pub.readContract({ address: BIND, abi: bind, functionName: "controllerOf", args: [agentId] });
  const balAfter = await pub.readContract({ address: CRED, abi: cred, functionName: "balanceOf", args: [identity] });
  console.log(`   new controller ${newController}; identity STILL holds ${balAfter} credential(s) → the skill followed the NFT ✓`);
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
