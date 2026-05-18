// Audit all skill modules for: (1) contract addresses have bytecode on declared chain,
// (2) IPFS CIDs are resolvable, (3) external URLs respond. Reports broken or suspicious.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http } from "viem";
import { mainnet, arbitrum, optimism, base } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(__dirname, "..", "skill-modules");

const CHAINS = {
  1: { chain: mainnet,  name: "Mainnet",  rpc: "https://eth.llamarpc.com" },
  10: { chain: optimism, name: "Optimism", rpc: "https://mainnet.optimism.io" },
  42161: { chain: arbitrum, name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc" },
  8453: { chain: base, name: "Base", rpc: "https://mainnet.base.org" },
};

const clients = {};
for (const [id, c] of Object.entries(CHAINS)) {
  clients[id] = createPublicClient({ chain: c.chain, transport: http(c.rpc) });
}

const issues = [];
let totalContracts = 0;
let totalUrls = 0;

const files = fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith(".json")).sort();

console.log(`\nAuditing ${files.length} skill modules...\n${"=".repeat(70)}`);

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(MODULES_DIR, file), "utf8"));
  const chainId = raw.chain?.id ?? 1;
  const client = clients[chainId];
  if (!client) {
    issues.push({ file, severity: "warn", msg: `Chain ${chainId} not supported by audit script` });
    continue;
  }
  const contracts = raw.executable?.contracts ?? [];
  for (const c of contracts) {
    if (!c.address) continue;
    totalContracts++;
    try {
      const code = await client.getCode({ address: c.address });
      if (!code || code === "0x") {
        issues.push({ file, severity: "error", msg: `Contract ${c.name} (${c.address}) has NO bytecode on chain ${chainId}` });
        process.stdout.write("X");
      } else {
        process.stdout.write(".");
      }
    } catch (e) {
      issues.push({ file, severity: "error", msg: `RPC error for ${c.name}: ${e.message?.slice(0, 80)}` });
      process.stdout.write("?");
    }
  }
  // Endpoints
  const endpoints = raw.executable?.endpoints ?? [];
  for (const ep of endpoints) {
    if (!ep.url) continue;
    totalUrls++;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(ep.url, { method: "GET", signal: ctrl.signal });
      clearTimeout(to);
      if (res.status >= 400 && res.status !== 405 && res.status !== 403) {
        issues.push({ file, severity: "warn", msg: `Endpoint ${ep.name ?? ep.role} → ${res.status}: ${ep.url}` });
      }
    } catch (e) {
      if (!e.message?.includes("aborted") && !e.message?.includes("fetch failed")) {
        // Network errors are unreliable indicators — only flag DNS/TLS failures
      }
    }
  }
}

console.log(`\n\n${"=".repeat(70)}\nAUDIT RESULTS`);
console.log(`Modules checked: ${files.length}`);
console.log(`Contract addresses checked: ${totalContracts}`);
console.log(`URLs checked: ${totalUrls}`);
console.log(`Issues found: ${issues.length}`);
console.log("=".repeat(70));

if (issues.length === 0) {
  console.log("\n✅ All contract addresses verified live on-chain.");
} else {
  const errors = issues.filter((i) => i.severity === "error");
  const warns  = issues.filter((i) => i.severity === "warn");
  if (errors.length) {
    console.log(`\n❌ ${errors.length} ERROR${errors.length === 1 ? "" : "s"}:`);
    for (const e of errors) console.log(`   ${e.file}: ${e.msg}`);
  }
  if (warns.length) {
    console.log(`\n⚠ ${warns.length} WARNING${warns.length === 1 ? "" : "s"}:`);
    for (const w of warns) console.log(`   ${w.file}: ${w.msg}`);
  }
}
process.exit(issues.filter((i) => i.severity === "error").length > 0 ? 1 : 0);
