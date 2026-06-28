/// @file scripts/check-sdk-parity.ts
/// @notice Proves our manifests are ERC-8257-compliant AND that our independent
///         canonicalizer produces the SAME keccak256 as OpenSea's official SDK.
///         If these match, our served bytes will pass the registry's on-chain
///         verification — confirmed before spending anything on registration.
///
/// Run: ERC8257_CREATOR_ADDRESS=0x... npx tsx scripts/check-sdk-parity.ts

import { computeManifestHash, validateManifest } from "@opensea/tool-sdk";
import { manifestHash as ourHash } from "../src/lib/erc8257/canonicalize";
import { TOOL_MANIFESTS } from "../src/lib/erc8257/manifests";

let failures = 0;

for (const [slug, manifest] of Object.entries(TOOL_MANIFESTS)) {
  const res = validateManifest(manifest);
  const ours = ourHash(manifest);
  let sdk: string | null = null;
  try {
    sdk = computeManifestHash(manifest);
  } catch (e) {
    sdk = `ERROR: ${(e as Error).message}`;
  }

  const schemaOk = res.success;
  const hashOk = sdk === ours;
  const line = `${slug.padEnd(20)} schema:${schemaOk ? "ok " : "FAIL"} hash:${hashOk ? "match" : "MISMATCH"}`;
  console.log((schemaOk && hashOk ? "  ✓ " : "  ✗ ") + line);

  if (!schemaOk) {
    failures++;
    console.error("    schema issues:", JSON.stringify(res.error?.issues ?? res.error, null, 2));
  }
  if (!hashOk) {
    failures++;
    console.error("    ours:", ours);
    console.error("    sdk :", sdk);
  }
}

console.log(
  failures === 0
    ? "\nParity OK — manifests are SDK-valid and our hash == OpenSea's. Safe to register."
    : `\n${failures} parity failure(s).`,
);
process.exit(failures === 0 ? 0 : 1);
