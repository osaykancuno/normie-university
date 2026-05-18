// E2E client-side test against https://normie-university.vercel.app
// Captures console errors, network failures, and verifies key DOM content.
import { chromium } from "playwright";

const BASE = "https://normie-university.vercel.app";

const PAGES = [
  {
    path: "/",
    expect: ["NORMIE UNIVERSITY", "agent academy"],
    name: "Landing",
  },
  {
    path: "/preview",
    expect: ["Pre-school", "preview"],
    name: "Pre-school input",
  },
  {
    path: "/preview/4354",
    expect: ["Zori", "Human"],
    name: "Persona preview (Zori)",
  },
  {
    path: "/agents",
    expect: ["directory", "filter", "Awakened"],
    name: "Agent directory",
    expectAny: true,
  },
  {
    path: "/agents/normie/4354",
    expect: ["Zori", "Combat readiness", "Canvas"],
    name: "Awakened agent profile (THE FIX)",
    expectAny: true,
  },
  {
    path: "/skills",
    expect: ["Catalogue", "skill"],
    name: "Skill catalogue",
    expectAny: true,
  },
  {
    path: "/skills/1",
    expect: ["Uniswap", "swap"],
    name: "Skill detail #1",
    expectAny: true,
  },
  {
    path: "/paths",
    expect: ["path", "learning"],
    name: "Learning paths",
    expectAny: true,
  },
  {
    path: "/developers",
    expect: ["SDK", "API"],
    name: "Developers",
    expectAny: true,
  },
  {
    path: "/.well-known/agent.json",
    expect: ["NORMIE UNIVERSITY", "skillai/agent-manifest"],
    name: "A2A manifest",
  },
];

const results = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

for (const page of PAGES) {
  const tab = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  tab.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      // Ignore noisy/expected
      if (t.includes("favicon")) return;
      if (t.includes("Failed to load resource: net::ERR_") && t.includes("favicon")) return;
      consoleErrors.push(t.slice(0, 200));
    }
  });
  tab.on("pageerror", (err) => pageErrors.push(`${err.message.slice(0, 200)}`));
  tab.on("requestfailed", (req) => {
    const u = req.url();
    if (u.includes("favicon")) return;
    if (u.includes("walletconnect.org") || u.includes("walletconnect.com")) return; // WC websocket noise
    failedRequests.push(`${req.failure()?.errorText} ${u.slice(0, 120)}`);
  });

  let status = "?";
  try {
    const resp = await tab.goto(BASE + page.path, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    status = resp ? resp.status() : "no-response";
  } catch (e) {
    status = `nav-timeout: ${e.message.slice(0, 80)}`;
  }

  // Wait a bit for hydration + post-mount fetches
  await tab.waitForTimeout(3000);

  const html = await tab.content();
  const lower = html.toLowerCase();
  const found = page.expect.map((e) => ({
    needle: e,
    hit: lower.includes(e.toLowerCase()),
  }));
  const allFound = page.expectAny
    ? found.some((f) => f.hit)
    : found.every((f) => f.hit);
  const missing = found.filter((f) => !f.hit).map((f) => f.needle);

  results.push({
    name: page.name,
    path: page.path,
    status,
    contentOK: allFound,
    missingNeedles: missing,
    consoleErrors,
    pageErrors,
    failedRequests,
  });

  await tab.close();
}

await browser.close();

// Print report
console.log("\n" + "=".repeat(70));
console.log("NORMIE UNIVERSITY · E2E client-side test report");
console.log("=".repeat(70));

let passes = 0;
let fails = 0;
for (const r of results) {
  const ok = r.contentOK && r.pageErrors.length === 0 && r.status === 200;
  if (ok) passes++;
  else fails++;
  const icon = ok ? "✅" : "❌";
  console.log(`\n${icon} ${r.name}`);
  console.log(`   path: ${r.path}  status: ${r.status}`);
  if (!r.contentOK) console.log(`   ⚠ missing needles: ${r.missingNeedles.join(", ")}`);
  if (r.pageErrors.length) {
    console.log(`   💥 page errors:`);
    r.pageErrors.forEach((e) => console.log(`      - ${e}`));
  }
  if (r.consoleErrors.length) {
    console.log(`   📢 console errors:`);
    r.consoleErrors.slice(0, 5).forEach((e) => console.log(`      - ${e}`));
  }
  if (r.failedRequests.length) {
    console.log(`   🔌 failed requests:`);
    r.failedRequests.slice(0, 5).forEach((e) => console.log(`      - ${e}`));
  }
}

console.log("\n" + "=".repeat(70));
console.log(`SUMMARY: ${passes} passed · ${fails} failed · ${PAGES.length} total`);
console.log("=".repeat(70));
process.exit(fails > 0 ? 1 : 0);
