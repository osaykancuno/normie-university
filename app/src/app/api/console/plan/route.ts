/// @file /api/console/plan
/// @notice Agent Console planner. POST { instruction, agent? } → a safe,
///         human-readable execution plan mapped to a real certified skill.
///         Never executes anything — it only PLANS. The user signs the tx.

import { planInstruction } from "@/lib/server/console-planner";

export async function POST(req: Request) {
  let body: { instruction?: string; agent?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.instruction || typeof body.instruction !== "string") {
    return Response.json({ error: "Missing 'instruction'" }, { status: 400 });
  }
  if (body.instruction.length > 500) {
    return Response.json({ error: "Instruction too long (max 500 chars)" }, { status: 400 });
  }

  const result = await planInstruction(body.instruction, body.agent);
  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
