/// @file purchase-skill.ts
/// @notice Full agent flow: discover a skill via REST, then buy it on-chain.
///
/// Required env:
///   BASE_URL             — SKILLAI deployment URL (e.g. http://localhost:3000)
///   SKILL_ID             — target skill id to purchase
///   AGENT_PRIVATE_KEY    — hex private key of the agent (0x...)
///   RPC_URL              — Base Sepolia RPC url
///   MARKETPLACE_ADDRESS  — deployed SkillMarketplace
///   AGENT_REGISTRY_ADDRESS
///   USDC_ADDRESS         — Base USDC token
///   PAY_WITH             — "eth" | "usdc" (default "eth")
///
/// Run: npx tsx examples/purchase-skill.ts

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { SkillaiClient } from "../src/client.js";
import { SkillaiOnchain } from "../src/onchain.js";

async function main() {
  const baseUrl   = required("BASE_URL");
  const skillId   = BigInt(required("SKILL_ID"));
  const pk        = required("AGENT_PRIVATE_KEY") as `0x${string}`;
  const rpcUrl    = required("RPC_URL");
  const payWith   = (process.env.PAY_WITH ?? "eth").toLowerCase();
  const contracts = {
    agentRegistry:    required("AGENT_REGISTRY_ADDRESS") as `0x${string}`,
    skillMarketplace: required("MARKETPLACE_ADDRESS")    as `0x${string}`,
    usdc:             required("USDC_ADDRESS")           as `0x${string}`,
  };

  // 1. Discover the skill + its price via the REST API
  const client = new SkillaiClient({ baseUrl });
  const { skill } = await client.getSkill(skillId.toString());
  console.log(`Buying skill #${skill.skillId}: ${skill.name}`);
  console.log(`  price (ETH):  ${skill.priceInWei} wei`);
  console.log(`  price (USDC): ${skill.priceInUsdc} (6 decimals)`);

  // 2. Set up viem wallet client
  const account = privateKeyToAccount(pk);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const onchain = new SkillaiOnchain({ walletClient, publicClient, contracts });

  // 3. Ensure the agent is registered
  const registered = await onchain.isRegistered(account.address);
  if (!registered) {
    console.log("Registering agent…");
    const tx = await onchain.registerAgent("ipfs://TODO-agent-metadata-cid");
    console.log("  tx:", tx);
  }

  // 4. Buy
  if (payWith === "usdc") {
    const { approveTx, purchaseTx } = await onchain.purchaseSkillWithUsdc(
      skillId,
      BigInt(skill.priceInUsdc)
    );
    console.log("  approveTx:", approveTx);
    console.log("  purchaseTx:", purchaseTx);
  } else {
    const tx = await onchain.purchaseSkillWithEth(skillId, BigInt(skill.priceInWei));
    console.log("  purchaseTx:", tx);
  }

  console.log("Done. Submit a verifier-signed proof via completeSkill() to mint your SBT.");
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
