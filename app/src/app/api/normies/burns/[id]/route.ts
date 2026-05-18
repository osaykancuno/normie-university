/// @file /api/normies/burns/[id]
/// @notice Burn-history feed for a Normie. Returns every burn commitment
///         whose Action Points were directed to this token, plus the
///         aggregate AP earned via burn-bequest.
///
///         NORMIE UNIVERSITY feeds this into the reputation breakdown: AP-from-burns
///         is one of the loudest "this agent has been around" signals.

import { getBurnsReceivedBy } from "@/lib/server/normies";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/normies/burns/[id]">
) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    return Response.json({ error: "Invalid Normie id (0..9999)" }, { status: 400 });
  }

  const burns = await getBurnsReceivedBy(n, 50);
  const totalApFromBurns = burns.reduce(
    (sum, b) => sum + Number(b.transferredActionPoints ?? 0),
    0
  );
  const totalTokensBurned = burns.reduce(
    (sum, b) => sum + Number(b.tokenCount ?? 0),
    0
  );

  return Response.json(
    {
      tokenId: String(n),
      summary: {
        burnsReceived: burns.length,
        totalTokensBurned,
        totalApFromBurns,
      },
      burns: burns.slice(0, 20),
    },
    {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    }
  );
}
