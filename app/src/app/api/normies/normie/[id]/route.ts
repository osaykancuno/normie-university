/// @file /api/normies/normie/[id]
/// @notice Proxy + cached lookup of a single Normie's metadata, owner, and canvas info.
///         Combines several upstream calls into one response for the agent profile UI.

import { getNormieOwner, getNormieTraits, getNormieCanvasInfo, normieImageUrl } from "@/lib/server/normies";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/normies/normie/[id]">
) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    return Response.json({ error: "Invalid Normie id (0..9999)" }, { status: 400 });
  }

  const [owner, traits, canvas] = await Promise.all([
    getNormieOwner(n),
    getNormieTraits(n),
    getNormieCanvasInfo(n),
  ]);

  if (!owner) {
    return Response.json({ error: "Normie not found" }, { status: 404 });
  }

  return Response.json(
    {
      tokenId: owner.tokenId,
      owner: owner.owner,
      image: { svg: normieImageUrl(n, "svg"), png: normieImageUrl(n, "png") },
      traits: traits?.attributes ?? [],
      canvas,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
