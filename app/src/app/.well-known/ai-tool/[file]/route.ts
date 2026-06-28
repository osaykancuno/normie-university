/// @file /.well-known/ai-tool/<slug>.json
/// @notice ERC-8257 tool manifests. OpenSea's Agent Tool Registry commits
///         keccak256(JCS(manifest)) on-chain; a consumer re-fetches THIS file
///         and rejects the tool on any byte/hash mismatch. So we serve the
///         exact canonical bytes the hash was computed over — no framework
///         re-serialization in between.
///
/// Path note: the ERC mandates the literal segment `<slug>.json`, so the
/// dynamic segment captures the filename and we strip the extension.

import { TOOL_MANIFESTS } from "@/lib/erc8257/manifests";
import { canonicalManifestString } from "@/lib/erc8257/canonicalize";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  const slug = file.endsWith(".json") ? file.slice(0, -5) : file;
  const manifest = TOOL_MANIFESTS[slug];

  if (!manifest) {
    return new Response(JSON.stringify({ error: "Unknown tool" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // Canonical bytes — identical to what we registered on Base.
  const body = canonicalManifestString(manifest);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
