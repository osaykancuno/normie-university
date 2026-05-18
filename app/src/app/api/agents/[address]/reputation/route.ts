/// @file /api/agents/[address]/reputation
/// @notice Just the reputation breakdown for a given agent.

import { isAddress } from "viem";
import { getAgentReputation } from "@/lib/server/skills";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/agents/[address]/reputation">
) {
  const { address } = await ctx.params;
  if (!isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }
  try {
    const reputation = await getAgentReputation(address as `0x${string}`);
    return Response.json(reputation);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
