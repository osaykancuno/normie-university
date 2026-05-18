/// @file /api/stats
/// @notice Platform-wide counters: agents, skills, credentials, ranked agents.

import { getPlatformStats } from "@/lib/server/skills";
import { ACTIVE_CHAIN } from "@/config/chains";

export async function GET() {
  try {
    const stats = await getPlatformStats();
    return Response.json({
      chainId: ACTIVE_CHAIN.id,
      chainName: ACTIVE_CHAIN.name,
      ...stats,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
