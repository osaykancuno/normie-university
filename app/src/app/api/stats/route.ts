/// @file /api/stats
/// @notice Platform-wide counters: agents, skills, credentials, ranked agents,
///         PLUS live Normies collection stats (circulating supply adjusts for
///         ongoing burns).

import { getPlatformStats } from "@/lib/server/skills";
import { getCollectionStats } from "@/lib/server/normies";
import { ACTIVE_CHAIN } from "@/config/chains";

export async function GET() {
  try {
    const [stats, normies] = await Promise.all([
      getPlatformStats(),
      getCollectionStats().catch(() => null),
    ]);
    return Response.json({
      chainId: ACTIVE_CHAIN.id,
      chainName: ACTIVE_CHAIN.name,
      ...stats,
      normies: normies ?? undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
