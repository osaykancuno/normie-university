/// @file /api/skills
/// @notice List skill modules. Supports pagination + category/difficulty filters.
///         GET /api/skills?limit=50&offset=0&category=0&difficulty=1&active=true

import { listSkills } from "@/lib/server/skills";
import type { NextRequest } from "next/server";

function parseInt10(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit      = Math.min(200, parseInt10(url.searchParams.get("limit")) ?? 50);
    const offset     = Math.max(0, parseInt10(url.searchParams.get("offset")) ?? 0);
    const category   = parseInt10(url.searchParams.get("category"));
    const difficulty = parseInt10(url.searchParams.get("difficulty"));
    const activeParam = url.searchParams.get("active");
    const onlyActive = activeParam === null ? undefined : activeParam === "true";

    const skills = await listSkills({ limit, offset, category, difficulty, onlyActive });

    return Response.json({
      count: skills.length,
      limit,
      offset,
      skills,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
