/// @file x402.ts
/// @notice Client-side helpers for the SKILLAI x402 agent flow:
///           1. fetch quote (402)
///           2. sign EIP-3009 USDC authorization
///           3. retry with X-PAYMENT, get tx hash
///           4. (optionally) request relayed completion
///
///         Bring your own viem WalletClient — the SDK never touches keys.

import {
  hexToBytes,
  parseSignature,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";

import type { SkillaiClient } from "./client.js";

export type X402Network = "ethereum" | "ethereum-sepolia";

export type X402Accept = {
  scheme: "exact";
  network: X402Network;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: Address;
  maxTimeoutSeconds: number;
  asset: Address;
  extra: { name: string; version: string; skillId?: string };
};

export type X402Quote = {
  x402Version: number;
  accepts: X402Accept[];
  error?: string;
};

export type X402SettleResult = {
  ok: true;
  skillId: string;
  agent: Address;
  txHash: Hex;
  blockNumber: string;
  relayer: Address;
  completionEndpoint: string;
};

export type X402CompletionResult =
  | {
      ok: true;
      agent: Address;
      skillId: string;
      level: number;
      score: number;
      txHash: Hex;
      blockNumber: string;
      relayer: Address;
      signature: Hex;
    }
  | { ok: false; reason: string; hint?: string };

/// Random 32-byte nonce for EIP-3009.
function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex as Hex;
}

function chainIdFor(network: X402Network): number {
  return network === "ethereum" ? 1 : 11155111;
}

/// Sign an EIP-3009 ReceiveWithAuthorization for `accept`.
/// Returns the X-PAYMENT base64 envelope ready for the retry POST.
export async function signX402Payment(opts: {
  walletClient: WalletClient;
  accept: X402Accept;
}): Promise<{ xPayment: string; nonce: Hex }> {
  const { walletClient, accept } = opts;
  const account = walletClient.account;
  if (!account) throw new Error("WalletClient has no account");

  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(now - 60);
  const validBefore = BigInt(now + accept.maxTimeoutSeconds);
  const nonce = randomNonce();

  const domain = {
    name: accept.extra.name,
    version: accept.extra.version,
    chainId: chainIdFor(accept.network),
    verifyingContract: accept.asset,
  } as const;

  const types = {
    ReceiveWithAuthorization: [
      { name: "from",        type: "address" },
      { name: "to",          type: "address" },
      { name: "value",       type: "uint256" },
      { name: "validAfter",  type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce",       type: "bytes32" },
    ],
  } as const;

  const message = {
    from: account.address,
    to: accept.payTo,
    value: BigInt(accept.maxAmountRequired),
    validAfter,
    validBefore,
    nonce,
  } as const;

  const sig = await walletClient.signTypedData({
    account,
    domain,
    types,
    primaryType: "ReceiveWithAuthorization",
    message,
  });

  const { v, r, s } = parseSignature(sig);

  const payload = {
    x402Version: 1,
    scheme: "exact" as const,
    network: accept.network,
    payload: {
      signature: { v: Number(v ?? 0), r, s },
      authorization: {
        from: account.address,
        to: accept.payTo,
        value: accept.maxAmountRequired,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };

  const json = JSON.stringify(payload);
  const xPayment =
    typeof Buffer !== "undefined"
      ? Buffer.from(json, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(json)));

  return { xPayment, nonce };
}

/// Full x402 buy flow: GET → 402 → sign → POST → 200.
export async function x402Buy(opts: {
  client: SkillaiClient;
  walletClient: WalletClient;
  skillId: bigint | number | string;
  baseUrl?: string;
  fetch?: typeof fetch;
}): Promise<X402SettleResult> {
  const f = opts.fetch ?? fetch;
  // Resolve baseUrl: explicit > the SkillaiClient option (private). Caller can
  // pass it directly to avoid surface coupling.
  const base = (opts.baseUrl ??
    // @ts-expect-error — read private for convenience
    opts.client.baseUrl) as string;

  const url = `${base}/api/skills/${opts.skillId}/buy`;

  // 1. Quote
  const qRes = await f(url, { method: "GET" });
  if (qRes.status !== 402) {
    const body = await qRes.json().catch(() => ({}));
    throw new Error(`Expected 402 quote, got ${qRes.status}: ${JSON.stringify(body)}`);
  }
  const quote = (await qRes.json()) as X402Quote;
  const accept = quote.accepts?.[0];
  if (!accept) throw new Error("402 response did not include any accepts");

  // 2. Sign
  const { xPayment } = await signX402Payment({
    walletClient: opts.walletClient,
    accept,
  });

  // 3. Settle
  const settleRes = await f(url, {
    method: "POST",
    headers: { "X-PAYMENT": xPayment },
  });
  const body = await settleRes.json();
  if (!settleRes.ok) {
    throw new Error(`Settle failed (${settleRes.status}): ${body?.error ?? "unknown"}`);
  }
  return body as X402SettleResult;
}

/// Request a relayed completion (verifier signs + relayer submits on-chain).
/// Returns either { ok:true, txHash, signature, ... } or { ok:false, reason }.
export async function x402Complete(opts: {
  baseUrl: string;
  agent: Address;
  skillId: bigint | number | string;
  txHash?: Hex;
  fetch?: typeof fetch;
}): Promise<X402CompletionResult> {
  const f = opts.fetch ?? fetch;
  const url = `${opts.baseUrl}/api/skills/${opts.skillId}/complete`;
  const res = await f(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent: opts.agent, txHash: opts.txHash }),
  });
  const body = await res.json();
  if (res.status === 422 && body && body.ok === false) {
    return body as X402CompletionResult;
  }
  if (!res.ok) {
    throw new Error(`Completion failed (${res.status}): ${body?.error ?? "unknown"}`);
  }
  return body as X402CompletionResult;
}

// Silence "unused" for the hex helper in some bundlers
void hexToBytes;
