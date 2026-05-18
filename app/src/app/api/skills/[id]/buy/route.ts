/// @file /api/skills/[id]/buy
/// @notice x402-compliant purchase endpoint for autonomous AI agents.
///
///         Flow:
///           1. Agent does GET /api/skills/:id/buy → 402 Payment Required with
///              an `accepts[]` array describing the EIP-3009 USDC authorization
///              the agent must sign.
///           2. Agent signs locally and retries with `X-PAYMENT: <base64>`.
///           3. Server validates the auth, relays
///              `purchaseSkillWithAuthorization` on-chain (paying gas), and
///              returns 200 with `{ skillId, txHash, completionEndpoint }`.
///
///         The agent never holds ETH — gas is paid by the relayer key. Funds
///         flow agent→marketplace via EIP-3009 inside the on-chain call.

import type { NextRequest } from "next/server";
import { isAddress } from "viem";
import { getSkillById } from "@/lib/server/skills";
import { isRelayerConfigured, relayPurchaseWithAuth, relayerAddress } from "@/lib/server/relayer";
import { getAddresses } from "@/lib/contracts";
import { ACTIVE_CHAIN } from "@/config/chains";
import {
  buildPaymentRequired,
  decodeXPayment,
  encodeXPayment,
  type X402Network,
  type X402PaymentPayload,
} from "@/lib/x402";

const NETWORK: X402Network = ACTIVE_CHAIN.id === 1 ? "ethereum" : "ethereum-sepolia";

function absoluteUrl(req: NextRequest, path: string): string {
  // Prefer the public-facing origin if NEXT_PUBLIC_SITE_URL is set; fall back
  // to the request's own origin so dev/local works without config.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(path, explicit).toString();
  return new URL(path, req.url).toString();
}

// ===========================================================================
// GET — quote
// ===========================================================================

export async function GET(req: NextRequest, ctx: RouteContext<"/api/skills/[id]/buy">) {
  const { id } = await ctx.params;
  let skillId: bigint;
  try {
    skillId = BigInt(id);
  } catch {
    return Response.json({ error: "Invalid skillId" }, { status: 400 });
  }

  const skill = await getSkillById(skillId);
  if (!skill) {
    return Response.json({ error: "Skill not found" }, { status: 404 });
  }
  if (!skill.isActive) {
    return Response.json({ error: "Skill is not active" }, { status: 410 });
  }

  const priceUsdc = BigInt(skill.priceInUsdc);
  if (priceUsdc === 0n) {
    return Response.json(
      {
        error:
          "This skill does not accept USDC. x402 only supports USDC; pay with ETH via /api/skills/:id (UI) or call purchaseSkill on-chain directly.",
      },
      { status: 422 }
    );
  }

  const addr = getAddresses();
  const body = buildPaymentRequired({
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        maxAmountRequired: priceUsdc.toString(),
        resource: absoluteUrl(req, `/api/skills/${skill.skillId}/buy`),
        description: `Purchase NORMIE UNIVERSITY skill #${skill.skillId}: ${skill.name}`,
        mimeType: "application/json",
        payTo: addr.SkillMarketplace,
        maxTimeoutSeconds: 300,
        asset: addr.USDC,
        extra: {
          name: "USD Coin",
          version: "2",
          skillId: skill.skillId,
        },
      },
    ],
  });

  return Response.json(body, { status: 402 });
}

// ===========================================================================
// POST — settle
// ===========================================================================

export async function POST(req: NextRequest, ctx: RouteContext<"/api/skills/[id]/buy">) {
  const { id } = await ctx.params;
  let skillId: bigint;
  try {
    skillId = BigInt(id);
  } catch {
    return Response.json({ error: "Invalid skillId" }, { status: 400 });
  }

  if (!isRelayerConfigured()) {
    return Response.json(
      {
        error:
          "Relayer is not configured on this server. Set RELAYER_PRIVATE_KEY in the env. The relayer key must hold ETH on the target chain to cover gas.",
      },
      { status: 501 }
    );
  }

  // Parse X-PAYMENT header
  const headerXp = req.headers.get("x-payment");
  let payment: X402PaymentPayload | null = decodeXPayment(headerXp);

  // Some agents prefer to put the payload in the body instead of the header.
  // We support both — read the body as a fallback only.
  if (!payment) {
    try {
      const bodyJson = (await req.json()) as { xPayment?: string } | X402PaymentPayload;
      if ("xPayment" in bodyJson && typeof bodyJson.xPayment === "string") {
        payment = decodeXPayment(bodyJson.xPayment);
      } else if ((bodyJson as X402PaymentPayload).x402Version) {
        payment = bodyJson as X402PaymentPayload;
      }
    } catch {
      /* ignore */
    }
  }

  if (!payment) {
    return Response.json(
      { error: "Missing or malformed X-PAYMENT" },
      { status: 400 }
    );
  }

  // Validate scheme + network
  if (payment.scheme !== "exact" || payment.network !== NETWORK) {
    return Response.json(
      {
        error: `Unsupported scheme/network. Expected exact/${NETWORK}, got ${payment.scheme}/${payment.network}.`,
      },
      { status: 422 }
    );
  }

  const auth = payment.payload.authorization;
  const sig = payment.payload.signature;

  // Validate the authorization shape
  if (!isAddress(auth.from) || !isAddress(auth.to)) {
    return Response.json({ error: "Invalid auth addresses" }, { status: 400 });
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(auth.nonce)) {
    return Response.json({ error: "Invalid auth nonce" }, { status: 400 });
  }

  // Validate auth is destined for the marketplace + matches the skill price
  const skill = await getSkillById(skillId);
  if (!skill) return Response.json({ error: "Skill not found" }, { status: 404 });
  if (!skill.isActive) {
    return Response.json({ error: "Skill is not active" }, { status: 410 });
  }
  const addr = getAddresses();
  if (auth.to.toLowerCase() !== addr.SkillMarketplace.toLowerCase()) {
    return Response.json(
      { error: "Authorization 'to' must be the SkillMarketplace address" },
      { status: 422 }
    );
  }
  if (BigInt(auth.value) < BigInt(skill.priceInUsdc)) {
    return Response.json(
      {
        error: `Authorization value too low. Required ${skill.priceInUsdc}, got ${auth.value}.`,
      },
      { status: 422 }
    );
  }
  // Validity window must not be expired
  const now = Math.floor(Date.now() / 1000);
  if (Number(auth.validBefore) <= now) {
    return Response.json({ error: "Authorization expired" }, { status: 422 });
  }

  // Relay
  const result = await relayPurchaseWithAuth(skillId, auth, sig);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 502 });
  }

  // Echo a tiny X-PAYMENT-RESPONSE header so x402 clients can confirm settlement
  const settled = encodeXPayment(payment);
  return Response.json(
    {
      ok: true,
      skillId: skill.skillId,
      agent: auth.from,
      txHash: result.txHash,
      blockNumber: result.blockNumber.toString(),
      relayer: relayerAddress(),
      completionEndpoint: absoluteUrl(req, `/api/skills/${skill.skillId}/complete`),
    },
    {
      status: 200,
      headers: { "X-PAYMENT-RESPONSE": settled },
    }
  );
}
