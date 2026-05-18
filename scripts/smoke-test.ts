/// @file smoke-test.ts
/// @notice Post-deploy smoke check: hits the SKILLAI REST API and reads a few
///         contract values to confirm the deployment is wired up correctly.
///
/// Required env:
///   BASE_URL                 — SKILLAI deployment URL
///   RPC_URL                  — Base RPC
///   AGENT_REGISTRY_ADDRESS
///   SKILL_REGISTRY_ADDRESS
///   MARKETPLACE_ADDRESS
///   REPUTATION_ENGINE_ADDRESS
///
/// Run: npx tsx scripts/smoke-test.ts

import { createPublicClient, http, type Address } from "viem";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";

const SKILL_REGISTRY_ABI = [
  { type: "function", name: "totalSkills", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const AGENT_REGISTRY_ABI = [
  { type: "function", name: "totalAgents", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const MARKETPLACE_ABI = [
  { type: "function", name: "skillCredential", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "skillRegistry",   stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "treasury",        stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "reputationEngine",stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

type Check = { name: string; ok: boolean; detail?: string };

async function main() {
  const baseUrl = required("BASE_URL");
  const rpcUrl  = required("RPC_URL");

  const checks: Check[] = [];

  // 1. API stats round-trip
  try {
    const res = await fetch(`${baseUrl}/api/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const stats = await res.json();
    checks.push({
      name: "GET /api/stats",
      ok: typeof stats.totalAgents === "number",
      detail: `chain=${stats.chainId} agents=${stats.totalAgents} skills=${stats.totalSkills}`,
    });
  } catch (e) {
    checks.push({ name: "GET /api/stats", ok: false, detail: errMsg(e) });
  }

  // 2. API skills list
  try {
    const res = await fetch(`${baseUrl}/api/skills?limit=3`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    checks.push({
      name: "GET /api/skills",
      ok: Array.isArray(body.skills),
      detail: `${body.skills.length} skills returned`,
    });
  } catch (e) {
    checks.push({ name: "GET /api/skills", ok: false, detail: errMsg(e) });
  }

  // 3. API trending
  try {
    const res = await fetch(`${baseUrl}/api/marketplace/trending?limit=5`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    checks.push({
      name: "GET /api/marketplace/trending",
      ok: Array.isArray(body.skills),
      detail: `sort=${body.sort} count=${body.count}`,
    });
  } catch (e) {
    checks.push({ name: "GET /api/marketplace/trending", ok: false, detail: errMsg(e) });
  }

  // 4. Direct contract reads
  const agentReg = process.env.AGENT_REGISTRY_ADDRESS as Address | undefined;
  const skillReg = process.env.SKILL_REGISTRY_ADDRESS as Address | undefined;
  const market   = process.env.MARKETPLACE_ADDRESS    as Address | undefined;
  const repEng   = process.env.REPUTATION_ENGINE_ADDRESS as Address | undefined;

  if (agentReg && skillReg && market) {
    const chainId = await fetch(`${baseUrl}/api/stats`)
      .then((r) => r.json())
      .then((s) => s.chainId)
      .catch(() => 84532);
    const chain =
      chainId === 1        ? mainnet      :
      chainId === 11155111 ? sepolia      :
      chainId === 8453     ? base         : baseSepolia;
    const client = createPublicClient({ chain, transport: http(rpcUrl) });

    try {
      const total = (await client.readContract({
        address: agentReg, abi: AGENT_REGISTRY_ABI, functionName: "totalAgents",
      })) as bigint;
      checks.push({
        name: "AgentRegistry.totalAgents",
        ok: typeof total === "bigint",
        detail: `${total}`,
      });
    } catch (e) {
      checks.push({ name: "AgentRegistry.totalAgents", ok: false, detail: errMsg(e) });
    }

    try {
      const total = (await client.readContract({
        address: skillReg, abi: SKILL_REGISTRY_ABI, functionName: "totalSkills",
      })) as bigint;
      checks.push({
        name: "SkillRegistry.totalSkills",
        ok: typeof total === "bigint",
        detail: `${total}`,
      });
    } catch (e) {
      checks.push({ name: "SkillRegistry.totalSkills", ok: false, detail: errMsg(e) });
    }

    // Verify wire-up: marketplace points back at the right registries
    try {
      const [linkedReg, linkedCred, linkedTreasury, linkedRep] = await Promise.all([
        client.readContract({ address: market, abi: MARKETPLACE_ABI, functionName: "skillRegistry" }),
        client.readContract({ address: market, abi: MARKETPLACE_ABI, functionName: "skillCredential" }),
        client.readContract({ address: market, abi: MARKETPLACE_ABI, functionName: "treasury" }),
        client.readContract({ address: market, abi: MARKETPLACE_ABI, functionName: "reputationEngine" }),
      ]) as [Address, Address, Address, Address];

      const correctReg = linkedReg.toLowerCase() === skillReg.toLowerCase();
      checks.push({
        name: "Marketplace.skillRegistry() == SKILL_REGISTRY_ADDRESS",
        ok: correctReg,
        detail: correctReg ? linkedReg : `expected ${skillReg}, got ${linkedReg}`,
      });
      checks.push({
        name: "Marketplace.skillCredential set",
        ok: linkedCred !== "0x0000000000000000000000000000000000000000",
        detail: linkedCred,
      });
      checks.push({
        name: "Marketplace.treasury set",
        ok: linkedTreasury !== "0x0000000000000000000000000000000000000000",
        detail: linkedTreasury,
      });
      if (repEng) {
        const ok = linkedRep.toLowerCase() === repEng.toLowerCase();
        checks.push({
          name: "Marketplace.reputationEngine wired",
          ok,
          detail: ok ? linkedRep : `expected ${repEng}, got ${linkedRep}`,
        });
      }
    } catch (e) {
      checks.push({ name: "Marketplace wire-up reads", ok: false, detail: errMsg(e) });
    }
  } else {
    checks.push({
      name: "Contract reads",
      ok: false,
      detail: "Set AGENT_REGISTRY_ADDRESS / SKILL_REGISTRY_ADDRESS / MARKETPLACE_ADDRESS to enable",
    });
  }

  // Report
  console.log();
  console.log("SKILLAI smoke test");
  console.log("==================");
  let passed = 0;
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    console.log(`  [${mark}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    if (c.ok) passed++;
  }
  console.log(`\n${passed} / ${checks.length} checks passed.`);
  if (passed !== checks.length) process.exit(1);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
