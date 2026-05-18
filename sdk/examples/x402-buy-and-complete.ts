/// @file x402-buy-and-complete.ts
/// @notice End-to-end agent-native flow: buy a skill via x402 (gasless) and
///         get the credential minted via the relayer (also gasless).
///
/// Required env:
///   BASE_URL              — SKILLAI deployment URL
///   AGENT_PRIVATE_KEY     — agent key (signs the EIP-3009 auth)
///   RPC_URL               — Base RPC (only needed if you also want to verify
///                           the on-chain state after; the buy/complete flow
///                           goes through HTTP, no direct RPC required)
///   SKILL_ID              — id of the skill to buy
///   PROOF_TX              — optional tx hash proving the off-chain action
///                           required by some skills (e.g. a Uniswap swap)
///
/// Run: npx tsx examples/x402-buy-and-complete.ts

import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

import { SkillaiClient } from "../src/client.js";
import { x402Buy, x402Complete } from "../src/x402.js";

async function main() {
  const baseUrl = required("BASE_URL");
  const pk = required("AGENT_PRIVATE_KEY") as `0x${string}`;
  const rpcUrl = required("RPC_URL");
  const skillId = required("SKILL_ID");
  const proofTx = process.env.PROOF_TX as `0x${string}` | undefined;

  // Pick the chain from the SKILLAI manifest so we can't drift.
  const manifest = await fetch(`${baseUrl}/.well-known/agent.json`).then((r) => r.json());
  const chain = manifest.chain.id === 8453 ? base : baseSepolia;

  const account = privateKeyToAccount(pk);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const client = new SkillaiClient({ baseUrl });

  // ──────────────────────────────────────────────────────────────────────
  // Step 1 — x402 buy (gasless)
  // ──────────────────────────────────────────────────────────────────────
  console.log("→ Buying skill", skillId, "via x402…");
  const purchase = await x402Buy({
    client,
    walletClient,
    skillId,
    baseUrl,
  });
  console.log("  ✓ purchased:", purchase.txHash);

  // ──────────────────────────────────────────────────────────────────────
  // Step 2 — relayed completion (verifier signs + relayer submits)
  // ──────────────────────────────────────────────────────────────────────
  console.log("→ Requesting relayed completion…");
  const completion = await x402Complete({
    baseUrl,
    agent: account.address,
    skillId,
    txHash: proofTx,
  });

  if (!completion.ok) {
    console.log("  ✗ verifier rejected:", completion.reason);
    if (completion.hint) console.log("    hint:", completion.hint);
    process.exit(2);
  }

  console.log("  ✓ completed:", completion.txHash);
  console.log(
    `    level=${completion.level} score=${completion.score} signature=${completion.signature.slice(0, 12)}…`
  );
  console.log("Done. The credential SBT has been minted to", account.address);
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
