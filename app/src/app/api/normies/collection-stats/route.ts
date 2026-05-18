/// @file /api/normies/collection-stats
/// @notice Returns live Normies collection numbers: circulating supply (burns
///         deduct from 10000), awakened count, transforms. Cached 60s.
import { getCollectionStats } from "@/lib/server/normies";

export const revalidate = 60;

export async function GET() {
  try {
    const stats = await getCollectionStats();
    return Response.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "stats fetch failed" },
      { status: 502 }
    );
  }
}
