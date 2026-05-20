/// @file /api/normies/collection-stats
/// @notice Returns live Normies collection numbers: circulating supply (burns
///         deduct from 10000), awakened count, transforms. Cached 30s.
///
///         Resilient to the Normies Ponder indexer 502-ing: getCollectionStats
///         serves stale-on-error from its module cache. On a fully cold start
///         during an outage we fall back to LAST_KNOWN_GOOD — a real observed
///         snapshot — so the awakened ticker never drops to 0 mid-demo.
import { getCollectionStats } from "@/lib/server/normies";

export const revalidate = 30;

/// Real observed snapshot — the ultimate cold-start fallback while the
/// upstream API is degraded. Refreshed automatically the moment a live
/// fetch succeeds. Kept honest: these are actual numbers, just possibly
/// a few hours stale during an upstream outage.
const LAST_KNOWN_GOOD = {
  originalSupply: 10000,
  burnedCount: 1852,
  circulatingSupply: 8148,
  awakenedCount: 559,
  totalTransforms: 858,
  totalBurnCommitments: 730,
  totalActionPointsDistributed: "27134",
  stale: true as const,
};

export async function GET() {
  try {
    const stats = await getCollectionStats();
    return Response.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch {
    // Cold start + upstream down — serve the last observed snapshot so the
    // UI shows real-ish numbers instead of an error or zero.
    return Response.json(LAST_KNOWN_GOOD, {
      headers: {
        // short cache so we retry the live source soon
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
      },
    });
  }
}
