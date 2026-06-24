/// @file /api/normies/rarity/[id]
/// @notice Live rarity for a Normie — rank, score, fair value, floor, listing
///         and "underpriced" flag — from the official rarity index. Enriches a
///         Normie's NU agent profile with how rare / valuable it is.
///
/// Backed by https://api.normies.art/rarity/normie/{tokenId}.

import { getNormieRarity } from "@/lib/server/normies";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/normies/rarity/[id]">
) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    return Response.json({ error: "Invalid Normie id (0..9999)" }, { status: 400 });
  }
  const rarity = await getNormieRarity(n);
  if (!rarity) {
    return Response.json({ error: "Rarity unavailable" }, { status: 404 });
  }
  return Response.json(
    { tokenId: String(n), rarity },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
