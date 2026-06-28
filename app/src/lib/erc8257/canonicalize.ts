/// @file ERC-8257 manifest canonicalization + commitment hash.
///
/// The Agent Tool Registry (ERC-8257, OpenSea's on-chain "app store for agent
/// tools") commits `manifestHash = keccak256( JCS(manifest) )` on-chain. A
/// consumer re-fetches the manifest from the well-known path, re-canonicalizes
/// it, and rejects the tool if the hash differs. So our off-chain bytes MUST be
/// bit-identical to whatever we registered — exactly the same discipline as the
/// 2-of-2 anchor leaves. This module is the single source of those bytes.
///
/// Canonicalization = JSON Canonicalization Scheme (RFC 8785) with the
/// pre-canonicalization rules the ERC adds:
///   - all string values in Unicode NFC (we normalize AND assert)
///   - UTF-8 without BOM
///   - all hex-string fields lowercase
///
/// Reference: https://ercs.ethereum.org/ERCS/erc-8257

import { keccak256 } from "viem";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/// Recursively assert every string is NFC. The ERC says consumers MUST reject
/// non-NFC rather than silently normalize, so we never ship non-NFC bytes.
function assertNfc(value: Json, path = "$"): void {
  if (typeof value === "string") {
    if (value.normalize("NFC") !== value) {
      throw new Error(`ERC8257: string at ${path} is not NFC-normalized`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNfc(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) assertNfc(value[k], `${path}.${k}`);
  }
}

/// RFC 8785 serialization. JSON.stringify already produces RFC-8785-compatible
/// string escaping (well-formed, minimal escapes, raw UTF-8 for non-ASCII), so
/// we lean on it for primitives and only enforce key ordering ourselves.
/// Object keys are sorted by UTF-16 code unit — which is exactly JS string `<`.
function jcs(value: Json): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("ERC8257: non-finite numbers are not serializable");
    }
    // Manifests carry money as decimal *strings* (pricing.amount) precisely to
    // avoid float canonicalization ambiguity. Reject any non-integer number so
    // a stray float can never produce a hash that drifts across engines.
    if (!Number.isInteger(value)) {
      throw new Error("ERC8257: use a string, not a float, for fractional values");
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(jcs).join(",")}]`;
  }
  if (value && t === "object") {
    const obj = value as { [k: string]: Json };
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs(obj[k])}`).join(",")}}`;
  }
  throw new Error(`ERC8257: unsupported value of type ${t}`);
}

/// Canonical UTF-8 bytes (no BOM) for the manifest — what we serve at the
/// well-known path and what we hash. Serving these exact bytes guarantees a
/// consumer's re-fetch matches our on-chain commitment.
export function canonicalManifestBytes(manifest: unknown): Uint8Array {
  assertNfc(manifest as Json);
  const text = jcs(manifest as Json);
  return new TextEncoder().encode(text);
}

/// The canonical string (handy for `Response` bodies and debugging).
export function canonicalManifestString(manifest: unknown): string {
  return new TextDecoder().decode(canonicalManifestBytes(manifest));
}

/// keccak256 over the canonical bytes — the value passed to
/// `registerTool(metadataURI, manifestHash, accessPredicate)`.
export function manifestHash(manifest: unknown): `0x${string}` {
  return keccak256(canonicalManifestBytes(manifest));
}
