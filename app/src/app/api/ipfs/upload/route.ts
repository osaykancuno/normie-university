/// @file /api/ipfs/upload
/// @notice Pin a skill-module JSON to IPFS via Pinata.
///         POST body: { module: SkillModuleV1 }
///         Returns:    { cid, uri: "ipfs://<cid>", gatewayUrl, size }
///
///         The endpoint validates the module against the v1 schema before
///         uploading, so malformed modules never reach IPFS. For production
///         you should also authenticate the caller (wallet signature or API
///         key) — the current implementation trusts the pinning service's
///         own rate limits via PINATA_JWT.

import { pinJson, isPinataConfigured, PinataError } from "@/lib/server/pinata";
import { validateSkillModule } from "@/lib/skill-module-schema";

export async function POST(req: Request) {
  if (!isPinataConfigured()) {
    return Response.json(
      {
        error:
          "IPFS upload is not configured. Set PINATA_JWT on the server or upload the JSON to any other IPFS pinning service and pass the ipfs:// URI manually.",
      },
      { status: 501 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const module = (body as { module?: unknown })?.module ?? body;
  const validation = validateSkillModule(module);
  if (!validation.ok) {
    return Response.json(
      { error: "Invalid skill module", details: validation.errors },
      { status: 422 }
    );
  }

  try {
    const result = await pinJson(validation.value, {
      name: `skillai-${validation.value.name.slice(0, 40)}-${validation.value.version}`,
      keyvalues: {
        protocol: "skillai",
        version: "1",
        category: validation.value.category,
        difficulty: validation.value.difficulty,
      },
    });
    return Response.json(result);
  } catch (e) {
    if (e instanceof PinataError) {
      return Response.json({ error: e.message }, { status: e.status ?? 500 });
    }
    const message = e instanceof Error ? e.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
