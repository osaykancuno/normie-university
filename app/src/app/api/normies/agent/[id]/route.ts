/// @file /api/normies/agent/[id]
/// @notice Aggregates Normies agent-layer data for a tokenId:
///         binding, persona, and A2A Agent Card — into one cached response.
///         Powers the persona-first UX of NORMIE UNIVERSITY.

import { getAgentBinding, getPersona, getA2AAgentCard, NormiesApiError } from "@/lib/server/normies";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/normies/agent/[id]">
) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    return Response.json({ error: "Invalid Normie tokenId (0..9999)" }, { status: 400 });
  }

  let bindingRaw: Awaited<ReturnType<typeof getAgentBinding>> = null;
  let persona: Awaited<ReturnType<typeof getPersona>> = null;
  let agentCard: Awaited<ReturnType<typeof getA2AAgentCard>> = null;
  try {
    [bindingRaw, persona, agentCard] = await Promise.all([
      getAgentBinding(n),
      getPersona(n),
      getA2AAgentCard(n).catch(() => null),
    ]);
  } catch (e) {
    // Upstream degraded (502 / timeout). Surface a 502 so the client can tell
    // an outage apart from a genuine 404 'burned token'.
    const status = e instanceof NormiesApiError ? (e.status >= 500 ? 502 : e.status) : 502;
    return Response.json(
      { error: "Normies API degraded", upstream: status },
      { status: 502 }
    );
  }

  if (!persona) {
    // getPersona returned null → genuine upstream 404 (token not found).
    return Response.json({ error: "Persona unavailable" }, { status: 404 });
  }

  // Normies API ships binding as `{ binding: { id, agentId, tokenContract, ... } }`.
  // Flatten + derive `bound` boolean so the client doesn't have to guess
  // (presence of an agentId means the token is awakened to ERC-8004).
  // `raw` is preserved for debug.
  type RawBindingEnvelope = { binding?: { agentId?: string; tokenContract?: string; id?: string; standard?: number } };
  const env = (bindingRaw ?? {}) as RawBindingEnvelope;
  const inner = env.binding;
  const bound = !!inner?.agentId && inner.agentId !== "0";
  const binding = bound && inner
    ? {
        bound: true,
        tokenId: String(n),
        agentId: String(inner.agentId),
        adapter: (inner.tokenContract ?? "0x0") as `0x${string}`,
        standard: inner.standard ?? 0,
        raw: inner,
      }
    : { bound: false, tokenId: String(n), agentId: null, adapter: null as `0x${string}` | null };

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
