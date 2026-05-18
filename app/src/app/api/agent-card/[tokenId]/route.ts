/// @file /api/agent-card/[tokenId]
/// @notice Extended A2A Agent Card for an Awakened Normie — combines Normies'
///         canonical persona + NORMIE UNIVERSITY's skill credentials into a single
///         A2A-discoverable JSON document. Other agents that crawl the A2A
///         graph can find a Normie + see its acquired skills in one round-trip.
///
///         Spec ref: https://github.com/a2aproject/A2A
///         Source persona: https://api.normies.art/agents/agent-card/{tokenId}

import { getA2AAgentCard, getPersona, getAgentBinding } from "@/lib/server/normies";
import { getAgentCredentials } from "@/lib/server/skills";
import { isAddress } from "viem";

async function findHolder(tokenId: number): Promise<`0x${string}` | null> {
  // Try Normies API first
  const ownerData = await fetch(`https://api.normies.art/normie/${tokenId}/owner`, {
    headers: { accept: "application/json" },
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (ownerData?.owner && isAddress(ownerData.owner)) {
    return ownerData.owner as `0x${string}`;
  }
  return null;
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/agent-card/[tokenId]">
) {
  const { tokenId } = await ctx.params;
  const n = Number(tokenId);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    return Response.json({ error: "Invalid Normie tokenId (0..9999)" }, { status: 400 });
  }

  const [persona, binding, baseCard, holder] = await Promise.all([
    getPersona(n),
    getAgentBinding(n),
    getA2AAgentCard(n).catch(() => null),
    findHolder(n),
  ]);

  if (!persona) {
    return Response.json({ error: "Persona unavailable" }, { status: 404 });
  }

  // Pull NORMIE UNIVERSITY credentials for the current holder (best-effort; if our
  // contracts aren't deployed yet, returns empty array).
  let credentials = holder ? await getAgentCredentials(holder).catch(() => []) : [];

  // We expose the credentials as A2A "skills" — each credential is a thing
  // the agent has provably learned (verified by NORMIE UNIVERSITY's verifier).
  const a2aSkills = credentials.map((c) => ({
    id: `skill:${c.skillId}`,
    name: `NORMIE UNIVERSITY Skill #${c.skillId}`,
    description: `Soulbound credential issued on completion. Level ${c.level}, score ${c.score}.`,
    tags: ["skillai", "credential", c.verified ? "verified" : "unverified"],
  }));

  // Resulting Agent Card — extends the base card from Normies with NORMIE UNIVERSITY fields.
  const card = {
    // A2A v0.2 protocol baseline
    name: persona.name,
    description: `${persona.tagline} — ${persona.archetype}`,
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/agents/${holder ?? ""}`,
    version: "1.0.0",
    // Skills the agent advertises to other agents
    skills: [
      // Base capabilities from Normies' own card, if present
      ...(Array.isArray((baseCard as { skills?: unknown[] })?.skills)
        ? ((baseCard as { skills: unknown[] }).skills as object[])
        : []),
      // Plus our credentials
      ...a2aSkills,
    ],
    // Extension namespace for NORMIE UNIVERSITY-specific data
    "x-skillai": {
      tokenId: String(n),
      personaName: persona.name,
      personaTagline: persona.tagline,
      type: persona.type,
      canvas: persona.canvas,
      credentials: credentials.map((c) => ({
        skillId: c.skillId,
        tokenId: c.tokenId,
        level: c.level,
        score: c.score,
        acquiredAt: c.acquiredAt,
        verified: c.verified,
      })),
      binding: binding ?? null,
      holder: holder ?? null,
      reputation: {
        // Lightweight derived score: # of verified credentials + average level
        skillCount: credentials.length,
        verifiedCount: credentials.filter((c) => c.verified).length,
        averageLevel:
          credentials.length === 0
            ? 0
            : credentials.reduce((s, c) => s + c.level, 0) / credentials.length,
      },
      links: {
        profile: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/agents/${holder ?? ""}`,
        catalogue: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/skills`,
      },
    },
  };

  return Response.json(card, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
