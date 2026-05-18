/// @file /api/onboarding/claim-normie-gift
/// @notice Sponsored welcome-skill claim, gated to Normie holders.
///
/// Flow:
///   1. Verify the requesting agent holds at least one Normie on Ethereum
///      mainnet (via the Normies public API; cached server-side).
///   2. Verify the agent has not already claimed the welcome gift.
///   3. Use the server-side relayer (SPONSOR_ROLE) to call
///      `SkillMarketplace.sponsorFirstSkill(agent, GIFT_SKILL_ID)`.
///   4. Agent can then submit `completeSkill` themselves to mint the SBT.
///
/// The gift is currently the ERC-8004 Agent Registration skill (#5) — it's a
/// Beginner-tier "core literacy" skill, perfect for onboarding.

import { isAddress } from "viem";
import { isNormieHolder } from "@/lib/server/normies";
import { getPublicClient } from "@/lib/server/viem";
import { isRelayerConfigured, relaySponsorFirstSkill, relayerAddress } from "@/lib/server/relayer";
import { SKILL_MARKETPLACE_ABI, getAddresses } from "@/lib/contracts";

/// Skill id used as welcome gift. Defaults to #5 (ERC-8004 Registration).
/// Override via env in case the catalogue changes order.
const GIFT_SKILL_ID = BigInt(process.env.WELCOME_GIFT_SKILL_ID ?? "5");

export async function POST(req: Request) {
  if (!isRelayerConfigured()) {
    return Response.json(
      { error: "Sponsorship relayer not configured on this server" },
      { status: 501 }
    );
  }

  let body: { agent?: string };
  try {
    body = (await req.json()) as { agent?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.agent || !isAddress(body.agent)) {
    return Response.json({ error: "Invalid or missing 'agent' address" }, { status: 400 });
  }
  const agent = body.agent as `0x${string}`;

  // 1. Verify Normie ownership on Ethereum mainnet
  const holds = await isNormieHolder(agent);
  if (!holds) {
    return Response.json(
      {
        ok: false,
        reason: "Welcome gift is reserved for Normie holders.",
        hint: "Acquire a Normie on https://normies.art and try again.",
      },
      { status: 403 }
    );
  }

  // 2. Verify gift hasn't been claimed yet (= no purchase recorded for that skill)
  const addr = getAddresses();
  const pub = getPublicClient();
  try {
    const already = (await pub.readContract({
      address: addr.SkillMarketplace,
      abi: SKILL_MARKETPLACE_ABI,
      functionName: "hasPurchased",
      args: [agent, GIFT_SKILL_ID],
    })) as boolean;
    if (already) {
      return Response.json(
        {
          ok: false,
          reason: "Welcome gift already claimed for this address.",
        },
        { status: 409 }
      );
    }
  } catch {
    // If we can't read the marketplace (no deployment / RPC issue), we still
    // try the relay — the contract itself will revert on duplicate.
  }

  // 3. Relay the sponsored purchase
  const result = await relaySponsorFirstSkill(agent, GIFT_SKILL_ID);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason }, { status: 502 });
  }

  return Response.json({
    ok: true,
    agent,
    skillId: GIFT_SKILL_ID.toString(),
    txHash: result.txHash,
    blockNumber: result.blockNumber.toString(),
    sponsor: relayerAddress(),
    hint:
      "Purchase recorded on-chain. Submit a verifier-signed completion to /api/skills/" +
      GIFT_SKILL_ID +
      "/complete to mint your first SBT credential.",
  });
}
