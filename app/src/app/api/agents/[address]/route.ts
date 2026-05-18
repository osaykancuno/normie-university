/// @file /api/agents/[address]
/// @notice Agent profile: registration, skill credentials, reputation.

import { isAddress } from "viem";
import {
  getAgentProfile,
  getAgentCredentials,
  getAgentReputation,
} from "@/lib/server/skills";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/agents/[address]">
) {
  try {
    const { address } = await ctx.params;
    if (!isAddress(address)) {
      return Response.json({ error: "Invalid address" }, { status: 400 });
    }
    const agent = address as `0x${string}`;

    const [profile, credentials, reputation] = await Promise.all([
      getAgentProfile(agent),
      getAgentCredentials(agent),
      getAgentReputation(agent).catch(() => null),
    ]);

    return Response.json({
      ...profile,
      credentials,
      reputation,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
