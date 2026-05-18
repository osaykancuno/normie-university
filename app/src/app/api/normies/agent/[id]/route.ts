/// @file /api/normies/agent/[id]
/// @notice Aggregates Normies agent-layer data for a tokenId:
///         binding, persona, and A2A Agent Card — into one cached response.
///         Powers the persona-first UX of NORMIE UNIVERSITY.

import { getAgentBinding, getPersona, getA2AAgentCard } from "@/lib/server/normies";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/normies/agent/[id]">
) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    return Response.json({ error: "Invalid Normie tokenId (0..9999)" }, { status: 400 });
  }

  const [binding, persona, agentCard] = await Promise.all([
    getAgentBinding(n),
    getPersona(n),
    getA2AAgentCard(n).catch(() => null),
  ]);

  if (!persona) {
    return Response.json({ error: "Persona unavailable" }, { status: 404 });
  }

  return Response.json(
    {
      tokenId: String(n),
      binding,
      persona,
      agentCard,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
