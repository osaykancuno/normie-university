/// @file browse-skills.ts
/// @notice Read-only example: discover trending SKILLAI skill modules.
///
/// Run: BASE_URL=http://localhost:3000 npx tsx examples/browse-skills.ts

import { SkillaiClient } from "../src/client.js";

async function main() {
  const client = new SkillaiClient({
    baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
  });

  const stats = await client.stats();
  console.log(`Platform on chain ${stats.chainId} (${stats.chainName}):`);
  console.log(`  agents:      ${stats.totalAgents}`);
  console.log(`  skills:      ${stats.totalSkills}`);
  console.log(`  credentials: ${stats.totalCredentials}`);
  console.log();

  const { skills } = await client.trending({ limit: 5, sort: "trending" });
  console.log(`Top ${skills.length} trending skills:`);
  for (const s of skills) {
    console.log(
      `  #${s.skillId} [${s.category.label}/${s.difficulty.label}] ${s.name}`
    );
    console.log(
      `     price: ${s.priceInWei} wei or ${s.priceInUsdc} USDC (6d) · purchases: ${s.stats.totalPurchases}`
    );
    console.log(`     uri:   ${s.contentURI}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
