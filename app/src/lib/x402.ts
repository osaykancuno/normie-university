/// @file x402.ts
/// @notice Shared types + encoders for the x402 Payment-Required HTTP standard.
///         Used by both server (build 402 responses, parse X-PAYMENT) and
///         clients (build X-PAYMENT). Compatible with Coinbase x402 v1.
///
///         Spec summary (subset we implement):
///         - 402 response carries `accepts[]` describing one or more payment
///           options. We currently only emit "scheme=exact" on USDC EIP-3009.
///         - Client retries with header `X-PAYMENT: <base64 JSON>` containing
///           `{ x402Version, scheme, network, payload }`. The payload for the
///           "exact" scheme on EVM chains is an EIP-3009 authorization +
///           signature.

import { mainnet, sepolia } from "viem/chains";

export const X402_VERSION = 1;

export type X402Network = "ethereum" | "ethereum-sepolia";

export type X402Accept = {
  scheme: "exact";
  network: X402Network;
  /// Max amount to be charged, as a decimal string in the asset's smallest unit
  /// (USDC: 6 decimals, so "750000" = 0.75 USDC).
  maxAmountRequired: string;
  /// Absolute URL of the resource being paid for.
  resource: string;
  description: string;
  mimeType: string;
  /// Address that ultimately receives the funds (the SkillMarketplace).
  payTo: `0x${string}`;
  /// Seconds the authorization remains valid after issuance.
  maxTimeoutSeconds: number;
  /// ERC-20 asset contract (USDC).
  asset: `0x${string}`;
  /// Free-form context returned to the client. We surface the EIP-712 domain
  /// fields the client needs to sign + the protocol skillId.
  extra: {
    name: string;     // ERC-712 domain name of `asset` (e.g. "USD Coin")
    version: string;  // ERC-712 domain version (e.g. "2")
    skillId?: string;
  };
};

export type X402PaymentRequiredBody = {
  x402Version: number;
  accepts: X402Accept[];
  error?: string;
};

export type Eip3009Authorization = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;        // decimal string, smallest unit
  validAfter: string;   // unix seconds, decimal string
  validBefore: string;  // unix seconds, decimal string
  nonce: `0x${string}`; // 32-byte hex
};

export type Eip3009Signature = {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
};

export type X402PaymentPayload = {
  x402Version: number;
  scheme: "exact";
  network: X402Network;
  payload: {
    signature: Eip3009Signature;
    authorization: Eip3009Authorization;
  };
};

/// Encode a payment payload for the X-PAYMENT header. Always base64.
export function encodeXPayment(payload: X402PaymentPayload): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64");
  }
  // Browser fallback
  return btoa(unescape(encodeURIComponent(json)));
}

/// Decode + validate the X-PAYMENT header. Returns null on shape mismatch.
export function decodeXPayment(header: string | null): X402PaymentPayload | null {
  if (!header) return null;
  try {
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(header, "base64").toString("utf8");
    } else {
      json = decodeURIComponent(escape(atob(header)));
    }
    const parsed = JSON.parse(json) as X402PaymentPayload;
    if (parsed?.x402Version !== X402_VERSION) return null;
    if (parsed.scheme !== "exact") return null;
    if (!parsed.payload?.authorization || !parsed.payload?.signature) return null;
    return parsed;
  } catch {
    return null;
  }
}

/// Resolve the chain object for a given x402 network slug.
export function chainForNetwork(network: X402Network) {
  return network === "ethereum" ? mainnet : sepolia;
}

/// Format a 402 response body.
export function buildPaymentRequired(opts: {
  accepts: X402Accept[];
  error?: string;
}): X402PaymentRequiredBody {
  return {
    x402Version: X402_VERSION,
    accepts: opts.accepts,
    error: opts.error ?? "Payment required",
  };
}
