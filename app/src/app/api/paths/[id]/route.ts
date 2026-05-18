/// @file /api/paths/[id]
/// @notice Learning Path detail.

import { getPathById } from "@/lib/server/skills";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/paths/[id]">
) {
  const { id } = await ctx.params;
  let pathId: bigint;
  try {
    pathId = BigInt(id);
  } catch {
    return Response.json({ error: "Invalid pathId" }, { status: 400 });
  }

  const path = await getPathById(pathId);
  if (!path) {
    return Response.json({ error: "Path not found" }, { status: 404 });
  }
  return Response.json({ path });
}
