/// @file /api/normies/collection-stats
/// @notice Returns live Normies collection numbers: circulating supply (burns
///         deduct from 10000), awakened count, transforms. Cached 60s.
import { getCollectionStats } from "@/lib/server/normies";

export const revalidate = 30;

export async function GET() {
  try {
    const stats = await getCollectionStats();
    return Response.json(stats, {
      headers: {
        // Live metric — short CDN cache so the awakened count feels real-time
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "stats fetch failed" },
      { status: 502 }
    );
  }
}
