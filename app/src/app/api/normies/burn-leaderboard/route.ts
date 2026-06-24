/// @file /api/normies/burn-leaderboard
/// @notice Community leaderboard — wallets ranked by recursive burn count into
///         their customized Normies (a real on-chain commitment signal). From
///         the official rarity index.
///
/// Backed by https://api.normies.art/rarity/recursive-burn-holders.

import { getBurnLeaderboard } from "@/lib/server/normies";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const board = await getBurnLeaderboard(limit);
  if (!board) {
    return Response.json({ error: "Leaderboard unavailable" }, { status: 503 });
  }
  return Response.json(
    { updatedAt: board.updatedAt ?? null, totalWallets: board.totalWallets ?? null, items: board.items ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
