/// @file /api/paths
/// @notice List all Learning Paths.

import { listPaths } from "@/lib/server/skills";

export async function GET() {
  try {
    const paths = await listPaths();
    return Response.json({ count: paths.length, paths });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
