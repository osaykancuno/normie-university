/// @file /api/agents/[address]/skills
/// @notice Just the credentials list for a given agent.

import { isAddress } from "viem";
import { getAgentCredentials } from "@/lib/server/skills";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/agents/[address]/skills">
) {
  const { address } = await ctx.params;
  if (!isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }
  try {
    const credentials = await getAgentCredentials(address as `0x${string}`);
    return Response.json({
      agent: address,
      count: credentials.length,
      credentials,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
