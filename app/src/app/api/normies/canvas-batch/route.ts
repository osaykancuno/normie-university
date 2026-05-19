/// @file /api/normies/canvas-batch
/// @notice Batched per-token canvas summary. Used by /agents to compute
///         filter counts (level + customized) over the recently-awakened
///         pool without making 100 separate fetches from the browser.
///         Per-token result is server-cached via getPersonaPreview, so
///         this endpoint is effectively free once the cards on /agents
///         have warmed the same cache.
///
/// GET /api/normies/canvas-batch?ids=4354,8362,9999
/// → { items: [{ tokenId, level, customized, type }] }

import { getNormieCanvasInfo, getPersonaPreview } from "@/lib/server/normies";

export const revalidate = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200); // hard cap

  if (ids.length === 0) {
    return Response.json({ items: [] });
  }

  const items = await Promise.all(
    ids.map(async (id) => {
      try {
        // /normie/{id}/canvas/info is the slimmest authoritative source for
        // level + customized (it works for every minted token, including
        // not-yet-awakened ones). Persona-preview gives us 'type' alongside.
        const [canvas, persona] = await Promise.all([
          getNormieCanvasInfo(id),
          getPersonaPreview(id),
        ]);
        return {
          tokenId: id,
          level:      canvas?.level ?? null,
          customized: canvas?.customized ?? null,
          type:       persona?.type ?? null,
        };
      } catch {
        return { tokenId: id, level: null, customized: null, type: null };
      }
    })
  );

  return Response.json(
    { count: items.length, items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
