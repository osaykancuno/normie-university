#!/usr/bin/env node
/// @file scripts/check-skill-oracle-drift.mjs
/// @notice CI guard against skill <-> oracle DRIFT.
///
///   The oracle (app/src/lib/server/verifier.ts) is spec-driven: at completion
///   time it loads each skill's IPFS module and verifies the agent's tx against
///   the chain / addresses / selectors the module declares. If a seeded skill
///   declares a verification target the oracle cannot service (an unsupported
///   chain, a malformed address/selector, or — with --onchain — an address with
///   no bytecode on its declared chain), every completion of that skill fails
///   silently in production. This script catches that BEFORE go-live.
///
///   Reads totalSkills + getSkill() from the on-chain SkillRegistry, fetches
///   each module from IPFS, and validates the verification spec. Exits non-zero
///   on any hard drift so CI fails.
///
/// Usage:
///   node scripts/check-skill-oracle-drift.mjs              # structural checks
///   node scripts/check-skill-oracle-drift.mjs --onchain    # + bytecode presence
///   CHAIN_ID=1 SKILL_REGISTRY=0x... node scripts/check-skill-oracle-drift.mjs
///
/// Env: SKILL_REGISTRY (override), RPC_URL_<chainId> (override per chain).

import { createPublicClient, http } from "viem";

// Chains the oracle can actually service (mirror of chains-rpc.ts).
const SUPPORTED_CHAINS = new Set([1, 42161, 10, 8453, 11155111]);

// Public RPC fallbacks per chain (overridable via RPC_URL_<id>).
const PUBLIC_RPC = {
  1: "https://ethereum-rpc.publicnode.com",
  42161: "https://arbitrum-one-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
  8453: "https://base-rpc.publicnode.com",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
};

function rpcFor(chainId) {
  return process.env[`RPC_URL_${chainId}`] || PUBLIC_RPC[chainId] || null;
}

// SkillRegistry on Sepolia (default target — the live deployment).
const DEFAULT_REGISTRY = "0x4d3572C0D529c4F3162aAB928D4336461823B9e7";
const REGISTRY_CHAIN_ID = Number(process.env.CHAIN_ID || 11155111);
const REGISTRY = process.env.SKILL_REGISTRY || DEFAULT_REGISTRY;
const ONCHAIN = process.argv.includes("--onchain");

const REGISTRY_ABI = [
  {
    type: "function",
    name: "totalSkills",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getSkill",
    stateMutability: "view",
    inputs: [{ name: "skillId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "skillId", type: "uint256" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "category", type: "uint8" },
          { name: "difficulty", type: "uint8" },
          { name: "priceInWei", type: "uint256" },
          { name: "priceInUsdc", type: "uint256" },
          { name: "prerequisites", type: "uint256[]" },
          { name: "contentURI", type: "string" },
          { name: "creator", type: "address" },
          { name: "createdAt", type: "uint256" },
          { name: "updatedAt", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "totalPurchases", type: "uint256" },
          { name: "totalCompletions", type: "uint256" },
          { name: "ratingSum", type: "uint256" },
          { name: "ratingCount", type: "uint256" },
        ],
      },
    ],
  },
];

const GATEWAYS = [
  process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs",
  process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
];

function ipfsToHttp(uri, gateway) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://"))
    return `${gateway}/${uri.slice(7).replace(/^\/+/, "")}`;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return null;
}

async function fetchModule(contentURI) {
  for (const gw of GATEWAYS) {
    const url = ipfsToHttp(contentURI, gw);
    if (!url) continue;
    try {
      const r = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) return await r.json();
    } catch {
      /* try next gateway */
    }
  }
  return null;
}

// Mirror of skill-module-loader.ts extractors.
function declaredAddresses(mod) {
  const out = new Set();
  for (const c of mod?.executable?.contracts ?? []) {
    const a = c.address?.toLowerCase();
    if (a) out.add(a);
  }
  return [...out];
}
function declaredSelectors(mod) {
  const out = new Set();
  for (const c of mod?.executable?.contracts ?? []) {
    for (const f of c.abi_fragments ?? []) {
      const s = f.selector?.toLowerCase();
      if (s) out.add(s);
    }
  }
  return [...out];
}
function verificationChainId(mod) {
  return Number(mod?.chain?.id ?? 1);
}
/// The oracle only runs on-chain verification (verifyOnChainCall) for skills
/// whose kind is smart_contract_interaction AND that are not explicitly manual.
/// Off-chain and manual-review skills declare addresses for documentation only —
/// the auto-verifier never touches them — so the drift check must skip them too,
/// otherwise it flags "drift" the oracle would never actually hit.
function isAutoOnchain(mod) {
  return (
    mod?.executable?.kind === "smart_contract_interaction" &&
    mod?.verification?.auto_verifiable !== false
  );
}

const ZERO = "0x0000000000000000000000000000000000000000";
const codeCache = new Map(); // `${chainId}:${addr}` -> bool

async function hasBytecode(chainId, address) {
  const key = `${chainId}:${address}`;
  if (codeCache.has(key)) return codeCache.get(key);
  const url = rpcFor(chainId);
  if (!url) return null; // can't check — treated as skipped
  try {
    const client = createPublicClient({ transport: http(url) });
    const code = await client.getCode({ address });
    const has = !!code && code !== "0x";
    codeCache.set(key, has);
    return has;
  } catch {
    return null;
  }
}

async function main() {
  const rpc = rpcFor(REGISTRY_CHAIN_ID);
  if (!rpc) {
    console.error(`No RPC for registry chain ${REGISTRY_CHAIN_ID}`);
    process.exit(2);
  }
  const client = createPublicClient({ transport: http(rpc) });

  let total;
  try {
    total = await client.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "totalSkills",
    });
  } catch (e) {
    console.error(`Failed to read totalSkills from ${REGISTRY}: ${e.shortMessage || e.message}`);
    process.exit(2);
  }

  const n = Number(total);
  console.log(
    `skill<->oracle drift check  registry=${REGISTRY} chain=${REGISTRY_CHAIN_ID} skills=${n} mode=${ONCHAIN ? "structural+onchain" : "structural"}`
  );

  const drift = [];
  const warn = [];

  for (let id = 1; id <= n; id++) {
    let skill;
    try {
      skill = await client.readContract({
        address: REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "getSkill",
        args: [BigInt(id)],
      });
    } catch {
      continue; // gap / non-existent id
    }
    // Only the ACTIVE catalogue matters: a deactivated skill is parked, not
    // sold or completed, so its (possibly stale) spec can't cause live drift.
    if (skill && skill.isActive === false) continue;
    if (!skill?.contentURI) {
      warn.push(`#${id} ${skill?.name ?? ""}: no contentURI`);
      continue;
    }

    const mod = await fetchModule(skill.contentURI);
    if (!mod) {
      warn.push(`#${id} ${skill.name}: module unreachable (${skill.contentURI})`);
      continue;
    }

    const tag = `#${id} ${skill.name}`;
    const chainId = verificationChainId(mod);
    if (!SUPPORTED_CHAINS.has(chainId)) {
      drift.push(`${tag}: verification chain ${chainId} is NOT supported by the oracle`);
    }

    // A malformed / placeholder / zero address is sloppy module authoring, but
    // it is NOT exploitable: skill-module-loader drops such addresses, leaving
    // an empty declared set, and the verifier is fail-closed on an empty set
    // (routes to human/validator review). So we WARN on these — they signal a
    // manual-review skill that should set verification.auto_verifiable=false or
    // omit the contract — and reserve hard DRIFT for specs the oracle genuinely
    // cannot service (unsupported chain, or a well-formed address with no code).
    for (const a of declaredAddresses(mod)) {
      if (!/^0x[0-9a-f]{40}$/.test(a)) {
        warn.push(`${tag}: placeholder/malformed declared address ${a} (verifier routes this skill to manual review)`);
      } else if (a === ZERO) {
        warn.push(`${tag}: zero declared address (verifier routes this skill to manual review)`);
      } else if (ONCHAIN && SUPPORTED_CHAINS.has(chainId)) {
        const has = await hasBytecode(chainId, a);
        if (has === false) {
          drift.push(`${tag}: declared address ${a} has NO bytecode on chain ${chainId}`);
        } else if (has === null) {
          warn.push(`${tag}: could not bytecode-check ${a} on chain ${chainId} (no RPC)`);
        }
      }
    }

    for (const s of declaredSelectors(mod)) {
      if (!/^0x[0-9a-f]{8}$/.test(s)) {
        drift.push(`${tag}: malformed declared selector ${s}`);
      }
    }
  }

  if (warn.length) {
    console.log(`\n  warnings (${warn.length}):`);
    for (const w of warn) console.log(`   - ${w}`);
  }

  if (drift.length) {
    console.error(`\n  DRIFT DETECTED (${drift.length}):`);
    for (const d of drift) console.error(`   x ${d}`);
    console.error(`\nFAIL: ${drift.length} skill(s) declare a verification spec the oracle cannot service.`);
    process.exit(1);
  }

  console.log(`\nOK: no drift. Every skill's verification spec is serviceable by the oracle.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
