// Compare each Normies upstream endpoint with our proxy. Verifies:
// - Proxy returns 200
// - Response is valid JSON
// - Key fields expected by UI components are present
// Run: node audit-api-wiring.mjs

const PROD     = "https://normie-university.vercel.app";
const UPSTREAM = "https://api.normies.art";

const TEST_TOKEN  = 4354;       // Zori — awakened, customized
const TEST_TOKEN2 = 8362;       // Yoko — awakened, customized
const TEST_TOKEN3 = 42;         // not awakened (or burned)
const TEST_ADDR   = "0x8a8035f056af830b7205c58c1dc037f826fc2b92"; // Zori holder

const CHECKS = [
  {
    name: "Holders by address",
    upstream: `/holders/${TEST_ADDR}`,
    proxy:    `/api/normies/holder/${TEST_ADDR}`,
    requiredProxyFields: ["chain", "address", "tokenIds", "isHolder", "count"],
  },
  {
    name: "Normie metadata (owner + traits + canvas)",
    upstream: `/normie/${TEST_TOKEN}/metadata`,
    proxy:    `/api/normies/normie/${TEST_TOKEN}`,
    requiredProxyFields: ["tokenId", "owner", "image", "traits"],
  },
  {
    name: "Agent persona (awakened)",
    upstream: `/agents/info/${TEST_TOKEN}`,
    proxy:    `/api/normies/agent/${TEST_TOKEN}`,
    requiredProxyFields: ["tokenId", "binding", "persona"],
    nestedChecks: [
      ["binding.bound", true],
      ["persona.name", "Zori"],
      ["persona.canvas.level", 31],
    ],
  },
  {
    name: "Persona preview (pre-school)",
    upstream: `/agents/persona-preview/${TEST_TOKEN}`,
    proxy:    `/api/normies/persona-preview/${TEST_TOKEN}`,
    requiredProxyFields: ["tokenId", "persona", "image"],
  },
  {
    name: "Canvas feed (info + diff + versions)",
    upstream: null, // composite
    proxy:    `/api/normies/canvas/${TEST_TOKEN}`,
    requiredProxyFields: ["tokenId", "info", "diff", "versions"],
    nestedChecks: [
      ["info.level", 31],
      ["info.customized", true],
      ["diff.addedCount", "number"],
    ],
  },
  {
    name: "Burn history received",
    upstream: `/history/burns/receiver/${TEST_TOKEN}`,
    proxy:    `/api/normies/burns/${TEST_TOKEN}`,
    requiredProxyFields: ["tokenId", "summary", "burns"],
    nestedChecks: [
      ["summary.burnsReceived", "number"],
    ],
  },
  {
    name: "Collection stats (live awakened + burns)",
    upstream: `/history/stats`,
    proxy:    `/api/normies/collection-stats`,
    requiredProxyFields: ["originalSupply", "burnedCount", "circulatingSupply", "awakenedCount"],
  },
  {
    name: "Awakened list (recent ERC-8004 binds)",
    upstream: `/agents/list?limit=10`,
    proxy:    `/api/normies/awakened-list?limit=10`,
    requiredProxyFields: ["count", "items"],
    nestedChecks: [
      ["items.length", "number"],
    ],
  },
  {
    name: "A2A Agent Card (extended w/ NORMIE UNIVERSITY skills)",
    upstream: `/agents/agent-card/${TEST_TOKEN}`,
    proxy:    `/api/agent-card/${TEST_TOKEN}`,
    requiredProxyFields: ["name", "description"],
  },
  {
    name: "Yoko #8362 awakened binding",
    upstream: `/agents/binding/${TEST_TOKEN2}`,
    proxy:    `/api/normies/agent/${TEST_TOKEN2}`,
    requiredProxyFields: ["binding", "persona"],
    nestedChecks: [
      ["binding.bound", true],
      ["binding.agentId", "32683"],
    ],
  },
];

function getDeep(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

const out = [];
for (const c of CHECKS) {
  const result = { name: c.name, errors: [], ok: true };
  // Upstream sanity
  if (c.upstream) {
    try {
      const r = await fetch(`${UPSTREAM}${c.upstream}`);
      if (!r.ok) result.errors.push(`upstream HTTP ${r.status} for ${c.upstream}`);
    } catch (e) { result.errors.push(`upstream fetch failed: ${e.message}`); }
  }
  // Proxy
  let body = null;
  try {
    const r = await fetch(`${PROD}${c.proxy}`);
    if (!r.ok) result.errors.push(`proxy HTTP ${r.status} for ${c.proxy}`);
    body = await r.json();
    if (body.error) result.errors.push(`proxy returned error: ${body.error}`);
  } catch (e) { result.errors.push(`proxy fetch failed: ${e.message}`); }

  // Required fields
  if (body && c.requiredProxyFields) {
    for (const f of c.requiredProxyFields) {
      if (body[f] === undefined) result.errors.push(`missing required field: ${f}`);
    }
  }
  // Nested checks
  if (body && c.nestedChecks) {
    for (const [path, expected] of c.nestedChecks) {
      const v = getDeep(body, path);
      if (expected === "number") {
        if (typeof v !== "number") result.errors.push(`${path} expected number, got ${typeof v} (${v})`);
      } else {
        if (v !== expected) result.errors.push(`${path} expected ${expected}, got ${JSON.stringify(v)}`);
      }
    }
  }

  result.ok = result.errors.length === 0;
  out.push(result);
}

console.log("\n" + "=".repeat(70));
console.log("NORMIES API ↔ NORMIE UNIVERSITY proxy wiring audit");
console.log("=".repeat(70));
let passes = 0, fails = 0;
for (const r of out) {
  const icon = r.ok ? "✅" : "❌";
  console.log(`\n${icon} ${r.name}`);
  if (!r.ok) {
    r.errors.forEach((e) => console.log(`   • ${e}`));
    fails++;
  } else passes++;
}
console.log("\n" + "=".repeat(70));
console.log(`SUMMARY: ${passes} passed · ${fails} failed · ${out.length} total`);
console.log("=".repeat(70));
process.exit(fails > 0 ? 1 : 0);
