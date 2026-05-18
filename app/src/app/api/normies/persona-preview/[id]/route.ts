/// @file /api/normies/persona-preview/[id]
/// @notice Preview the deterministic persona of a Normie BEFORE the holder
///         awakens it via Adapter8004. Lets prospective owners (or curious
///         visitors) see what the agent will become — and lets NORMIE UNIVERSITY
///         pre-render a tailored curriculum without requiring on-chain
///         registration.
///
/// Backed by https://api.normies.art/agents/persona-preview/{tokenId}.

import { getPersonaPreview, normieImageUrl } from "@/lib/server/normies";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/normies/persona-preview/[id]">
) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    return Response.json({ error: "Invalid Normie id (0..9999)" }, { status: 400 });
  }
  const persona = await getPersonaPreview(n);
  if (!persona) {
    return Response.json({ error: "Preview unavailable" }, { status: 404 });
  }
  return Response.json(
    {
      tokenId: String(n),
      persona,
      image: { svg: normieImageUrl(n, "svg"), png: normieImageUrl(n, "png") },
      awakened: false,
      hint: "This is a deterministic preview. To activate the agent on-chain, the holder must register it via Adapter8004 at https://normies.art/lab.",
    },
    {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    }
  );
}
