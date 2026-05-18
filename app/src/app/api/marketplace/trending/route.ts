/// @file /api/marketplace/trending
/// @notice Trending skills — ranked by purchases weighted by recency.
///         ?limit=20 (default 20, max 100)
///         ?sort=trending|new|top|popular (default trending)

import { listSkills, type ApiSkill } from "@/lib/server/skills";
import type { NextRequest } from "next/server";

type SortKey = "trending" | "new" | "top" | "popular";

function sortSkills(skills: ApiSkill[], sort: SortKey): ApiSkill[] {
  const now = Math.floor(Date.now() / 1000);
  switch (sort) {
    case "new":
      return [...skills].sort((a, b) => b.createdAt - a.createdAt);
    case "top":
      return [...skills].sort((a, b) => {
        const ar = a.stats.averageRating ?? 0;
        const br = b.stats.averageRating ?? 0;
        return br - ar || b.stats.ratingCount - a.stats.ratingCount;
      });
    case "popular":
      return [...skills].sort(
        (a, b) => b.stats.totalPurchases - a.stats.totalPurchases
      );
    case "trending":
    default:
      return [...skills].sort((a, b) => {
        const ageA = Math.max(1, now - a.createdAt);
        const ageB = Math.max(1, now - b.createdAt);
        return (
          b.stats.totalPurchases / Math.sqrt(ageB) -
          a.stats.totalPurchases / Math.sqrt(ageA)
        );
      });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
    const sortParam = (url.searchParams.get("sort") ?? "trending") as SortKey;
    const sort: SortKey = ["trending", "new", "top", "popular"].includes(sortParam)
      ? sortParam
      : "trending";

    const all = await listSkills({ limit: 200, onlyActive: true });
    const sorted = sortSkills(all, sort).slice(0, limit);

    return Response.json({
      sort,
      count: sorted.length,
      skills: sorted,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
