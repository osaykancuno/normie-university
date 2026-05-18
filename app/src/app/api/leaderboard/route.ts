/// @file /api/leaderboard
/// @notice Top-N agents by on-chain reputation.

import { getLeaderboard } from "@/lib/server/skills";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const n = Math.min(100, Math.max(1, Number(url.searchParams.get("n") ?? 25)));
    const rows = await getLeaderboard(n);
    return Response.json({
      count: rows.length,
      agents: rows.map((r, i) => ({
        rank: i + 1,
        agent: r.agent,
        score: r.score,
        scorePercent: r.score / 100,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
