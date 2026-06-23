/// @file /api/console/warm
/// @notice Warmup endpoint for the Agent Console. Primes the catalogue cache so
///         the first real /api/console/plan request doesn't pay the cold-start
///         cost. Pinged by a Vercel cron (see vercel.json) every few minutes.
///         GET so cron can trigger it. Optionally gated by CRON_SECRET (Vercel
///         sends it as a Bearer token when configured).

import { warmConsoleCatalogue } from "@/lib/server/console-planner";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const skills = await warmConsoleCatalogue();
  return Response.json({ warmed: true, skills }, { headers: { "Cache-Control": "no-store" } });
}
