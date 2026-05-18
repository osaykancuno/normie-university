/// @file /api/normies/awakened-list
/// @notice Returns the most recently awakened agents. Used to populate the
///         FEATURED grid on /agents with real, currently-existing tokens
///         (so we never link to burned or non-awakened Normies).
import { getAwakenedList } from "@/lib/server/normies";

export const revalidate = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "24") || 24, 100);
  try {
    const items = await getAwakenedList(limit);
    return Response.json({ count: items.length, items }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "awakened list fetch failed" },
      { status: 502 }
    );
  }
}
