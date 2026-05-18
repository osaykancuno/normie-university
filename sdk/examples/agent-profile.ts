/// @file agent-profile.ts
/// @notice Read-only example: fetch an agent's profile, credentials, reputation.
///
/// Run: BASE_URL=http://localhost:3000 AGENT=0xabc... npx tsx examples/agent-profile.ts

import { SkillaiClient } from "../src/client.js";
import type { Address } from "../src/types.js";

async function main() {
  const agent = (process.env.AGENT ?? "") as Address;
  if (!agent) throw new Error("Set AGENT=0x... env var");

  const client = new SkillaiClient({
    baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
  });

  const profile = await client.getAgent(agent);

  console.log(`Agent ${profile.agent}`);
  console.log(`  registered:    ${profile.isRegistered}`);
  console.log(`  primaryToken:  ${profile.primaryTokenId}`);
  if (profile.reputation) {
    console.log(
      `  reputation:    ${profile.reputation.scorePercent.toFixed(2)}% (${profile.reputation.tier.label})`
    );
  }
  console.log(`  credentials:   ${profile.credentials.length}`);
  for (const c of profile.credentials) {
    console.log(
      `    - skill #${c.skillId} · level ${c.level} · score ${c.score}` +
        (c.verified ? " ✓" : " (unverified)")
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
