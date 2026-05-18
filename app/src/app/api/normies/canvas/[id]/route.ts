/// @file /api/normies/canvas/[id]
/// @notice Canvas state + transformation history for a Normie. Used to power
///         the live "your Normie just transformed" indicator on agent
///         profiles and to render the canvas-diff visualization.

import {
  getCanvasDiff,
  getCanvasVersions,
  getNormieCanvasInfo,
} from "@/lib/server/normies";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/normies/canvas/[id]">
) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    return Response.json({ error: "Invalid Normie id (0..9999)" }, { status: 400 });
  }

  const [info, diff, versions] = await Promise.all([
    getNormieCanvasInfo(n),
    getCanvasDiff(n),
    getCanvasVersions(n, 10),
  ]);

  return Response.json(
    {
      tokenId: String(n),
      info,
      diff,
      versions,
      lastTransformAt: versions[0]?.timestamp ?? null,
    },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    }
  );
}
