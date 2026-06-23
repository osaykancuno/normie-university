/// @file /api/agents/bound
/// @notice The set of agent identities currently bound to an NFT (sybil-
///         resistant). Used to flag verified agents in the leaderboard /
///         profiles. Read-only; cached server-side.

import { getBoundIdentities } from "@/lib/server/binding";

export async function GET() {
  const map = await getBoundIdentities();
  const agents = [...map.entries()].map(([identity, info]) => ({
    identity,
    tokenContract: info.tokenContract,
    tokenId: info.tokenId.toString(),
  }));
  return Response.json(
    { count: agents.length, agents, addresses: agents.map((a) => a.identity) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
