/// @file /api/tools/<slug>
/// @notice Invocation endpoint for our ERC-8257 tools. Each slug maps to an
///         @opensea/tool-sdk handler (method/schema validation, 402 identity
///         challenge, predicateGate). The matching manifest is served at
///         /.well-known/ai-tool/<slug>.json.

import { TOOL_HANDLERS } from "@/lib/erc8257/tools";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const handler = TOOL_HANDLERS[slug];
  if (!handler) {
    return new Response(JSON.stringify({ error: "Unknown tool" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return handler(req);
}
