/// @file scripts/check-erc8257.ts
/// @notice Locks ERC-8257 manifest canonicalization bit-for-bit and validates
///         every NORMIE UNIVERSITY tool manifest. Run: `npx tsx scripts/check-erc8257.ts`.
///
/// The registry verifies keccak256(JCS(manifest)) on-chain, so a silent drift
/// in our canonicalizer would invalidate every listed tool. This is the guard.

import {
  canonicalManifestString,
  manifestHash,
} from "../src/lib/erc8257/canonicalize";
import { TOOL_MANIFESTS } from "../src/lib/erc8257/manifests";

let failures = 0;
const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  failures++;
};
const ok = (m: string) => console.log(`  ✓ ${m}`);

// 1) Byte-exact canonicalization vector (key sorting + raw UTF-8 + arrays).
console.log("JCS canonicalization vector:");
{
  const fixture = { b: 1, a: "café", c: { y: [3, 1, 2], x: true } };
  const expected = '{"a":"café","b":1,"c":{"x":true,"y":[3,1,2]}}';
  const got = canonicalManifestString(fixture);
  got === expected
    ? ok("sorted keys, raw UTF-8, array order preserved")
    : fail(`canonical mismatch\n    expected: ${expected}\n    got:      ${got}`);

  // keccak256 must be deterministic across runs.
  manifestHash(fixture) === manifestHash(fixture)
    ? ok("manifestHash deterministic")
    : fail("manifestHash non-deterministic");
}

// 2) Non-NFC input must be rejected, never silently normalized.
console.log("NFC enforcement:");
{
  const nonNfc = { name: "café" }; // e + combining acute (NFD)
  try {
    canonicalManifestString(nonNfc);
    fail("non-NFC string was accepted");
  } catch {
    ok("non-NFC string rejected");
  }
}

// 3) Floats must be rejected (money is carried as decimal strings).
console.log("Float guard:");
{
  try {
    canonicalManifestString({ amount: 0.1 });
    fail("float was accepted");
  } catch {
    ok("float rejected (use string)");
  }
}

// 4) Validate every NU tool manifest against ERC-8257 field rules.
const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const ADDR_RE = /^0x[0-9a-f]{40}$/;
const HEX_LOWER = /^0x[0-9a-f]*$/;
const ZERO = "0x0000000000000000000000000000000000000000";
let zeroCreator = false;

console.log("Tool manifests:");
for (const [slug, m] of Object.entries(TOOL_MANIFESTS)) {
  const errs: string[] = [];
  if (!SLUG_RE.test(slug) || slug.length > 64) errs.push("bad slug");
  for (const f of ["type", "name", "description", "endpoint", "inputs", "outputs", "creatorAddress"]) {
    if ((m as Record<string, unknown>)[f] == null) errs.push(`missing ${f}`);
  }
  const creator = String((m as Record<string, unknown>).creatorAddress ?? "");
  if (!ADDR_RE.test(creator)) errs.push("creatorAddress not lowercase 0x-hex");
  // ERC-8257 forbids the zero address. Unset env => zero placeholder: warn (so
  // local/CI runs stay green) but registration is hard-blocked in register-tool.ts.
  if (creator === ZERO) zeroCreator = true;
  const endpoint = String((m as Record<string, unknown>).endpoint ?? "");
  if (!endpoint.startsWith("https://")) errs.push("endpoint not https");

  const pricing = (m as Record<string, unknown>).pricing as
    | Array<Record<string, string>>
    | undefined;
  if (pricing) {
    if (pricing.length === 0) errs.push("pricing present but empty");
    for (const p of pricing) {
      for (const f of ["amount", "asset", "recipient", "protocol"]) {
        if (!p[f]) errs.push(`pricing missing ${f}`);
      }
      const assetChain = p.asset?.split("/")[0]; // eip155:8453
      const recipChain = p.recipient?.split(":").slice(0, 2).join(":");
      if (assetChain !== recipChain) errs.push("pricing asset/recipient chain mismatch");
    }
  }

  const access = (m as Record<string, unknown>).access as
    | { logic?: string; requirements?: Array<Record<string, unknown>> }
    | undefined;
  if (access) {
    if (!["AND", "OR"].includes(access.logic ?? "")) errs.push("access.logic invalid");
    for (const r of access.requirements ?? []) {
      const kind = String(r.kind ?? "");
      const data = String(r.data ?? "");
      if (!/^0x[0-9a-f]{8}$/.test(kind)) errs.push("access.kind not 0x+8 lowercase hex");
      if (!HEX_LOWER.test(data) || data.length % 2 !== 0) errs.push("access.data not even lowercase hex");
    }
  }

  if (errs.length) {
    fail(`${slug}: ${errs.join("; ")}`);
  } else {
    ok(`${slug} → ${manifestHash(m)}`);
  }
}

if (zeroCreator) {
  console.warn(
    "\n⚠ creatorAddress is the zero placeholder — set ERC8257_CREATOR_ADDRESS to your\n" +
      "  creator wallet before registering (registration is hard-blocked until then).",
  );
}

console.log(
  failures === 0
    ? `\nAll ERC-8257 checks passed (${Object.keys(TOOL_MANIFESTS).length} tools).`
    : `\n${failures} check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
