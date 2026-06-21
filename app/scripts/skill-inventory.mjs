#!/usr/bin/env node
/// @file scripts/skill-inventory.mjs
/// @notice Full audit of the on-chain skill catalogue: for every skill, prints
///         the verification-critical fields from its IPFS module so we can see
///         at a glance which skills are real + auto-verifiable and which are
///         placeholders that need fixing or reclassifying.

import { createPublicClient, http } from "viem";

const RPC = process.env.RPC_URL_11155111 || "https://ethereum-sepolia-rpc.publicnode.com";
const REGISTRY = process.env.SKILL_REGISTRY || "0x4d3572C0D529c4F3162aAB928D4336461823B9e7";

const REGISTRY_ABI = [
  { type: "function", name: "totalSkills", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getSkill", stateMutability: "view", inputs: [{ name: "skillId", type: "uint256" }],
    outputs: [{ type: "tuple", components: [
      { name: "skillId", type: "uint256" }, { name: "name", type: "string" }, { name: "description", type: "string" },
      { name: "category", type: "uint8" }, { name: "difficulty", type: "uint8" }, { name: "priceInWei", type: "uint256" },
      { name: "priceInUsdc", type: "uint256" }, { name: "prerequisites", type: "uint256[]" }, { name: "contentURI", type: "string" },
      { name: "creator", type: "address" }, { name: "createdAt", type: "uint256" }, { name: "updatedAt", type: "uint256" },
      { name: "isActive", type: "bool" }, { name: "totalPurchases", type: "uint256" }, { name: "totalCompletions", type: "uint256" },
      { name: "ratingSum", type: "uint256" }, { name: "ratingCount", type: "uint256" },
    ]}],
  },
];

const GATEWAYS = ["https://gateway.pinata.cloud/ipfs", "https://ipfs.io/ipfs", "https://cloudflare-ipfs.com/ipfs"];
const ipfsToHttp = (uri, gw) => uri?.startsWith("ipfs://") ? `${gw}/${uri.slice(7).replace(/^\/+/, "")}` : (uri?.startsWith("http") ? uri : null);
async function fetchModule(uri) {
  for (const gw of GATEWAYS) {
    const url = ipfsToHttp(uri, gw); if (!url) continue;
    try { const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) }); if (r.ok) return await r.json(); } catch {}
  }
  return null;
}

const CAT = ["DeFi","NFT","Governance","Security","Infrastructure","Social","Gaming","DataAnalytics","CrossChain","AI"];
const DIFF = ["beginner","intermediate","advanced","expert"];
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO = "0x0000000000000000000000000000000000000000";

function classify(mod) {
  if (!mod) return "MODULE_UNREACHABLE";
  const kind = mod.executable?.kind ?? "";
  const auto = mod.verification?.auto_verifiable;
  const addrs = (mod.executable?.contracts ?? []).map(c => c.address).filter(Boolean);
  const realAddrs = addrs.filter(a => ADDR_RE.test(a) && a.toLowerCase() !== ZERO);
  const placeholderAddrs = addrs.filter(a => !ADDR_RE.test(a) || a.toLowerCase() === ZERO);

  if (auto === false) return "MANUAL (auto_verifiable:false)";
  if (kind === "smart_contract_interaction") {
    if (realAddrs.length > 0) return `AUTO-ONCHAIN (${realAddrs.length} real addr)`;
    if (placeholderAddrs.length > 0) return `PLACEHOLDER (${placeholderAddrs.join(",")}) → fail-closed→manual`;
    return "ONCHAIN but NO addr → fail-closed→manual";
  }
  if (kind) return `OFFCHAIN kind=${kind}`;
  return "UNKNOWN kind";
}

async function main() {
  const client = createPublicClient({ transport: http(RPC) });
  const total = Number(await client.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "totalSkills" }));
  console.log(`Catalogue: ${total} skills on ${REGISTRY}\n`);

  const buckets = {};
  for (let id = 1; id <= total; id++) {
    let s; try { s = await client.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "getSkill", args: [BigInt(id)] }); } catch { continue; }
    if (!s?.name) continue;
    const mod = await fetchModule(s.contentURI);
    const cls = classify(mod);
    const bucket = cls.split(" ")[0]; buckets[bucket] = (buckets[bucket]||0)+1;
    const chain = mod?.chain?.id ?? "?";
    const active = s.isActive ? "" : " [INACTIVE]";
    console.log(`#${String(id).padStart(2)} ${active}${(CAT[s.category]||s.category).padEnd(13)} ${DIFF[s.difficulty]||s.difficulty} chain=${String(chain).padEnd(8)} ${cls}`);
    console.log(`    ${s.name}`);
  }
  console.log("\n=== summary ===");
  for (const [k,v] of Object.entries(buckets).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}`);
}
main().catch(e => { console.error(e); process.exit(1); });
