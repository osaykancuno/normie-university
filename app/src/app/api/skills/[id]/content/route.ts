/// @file /api/skills/[id]/content
/// @notice Server-side fetch of the IPFS-pinned skill module JSON.
///         Uses Pinata's dedicated gateway first (more reliable + not flagged
///         as "phishing host" by antivirus tools that block ipfs.io), with a
///         fallback to the public gateway. Returns the parsed module so the
///         /skills/[id] page can render canonical contract addresses + steps
///         inline without sending the browser to a third-party domain.

import { getSkillById } from "@/lib/server/skills";

const PRIMARY_GW   = process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud/ipfs";
const FALLBACK_GW  = process.env.IPFS_GATEWAY   ?? "https://ipfs.io/ipfs";
const SECOND_FB_GW = "https://cloudflare-ipfs.com/ipfs";

function ipfsToHttp(uri: string, gateway: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `${gateway}/${uri.slice("ipfs://".length).replace(/^\/+/, "")}`;
  }
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return null;
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    clearTimeout(t);
    return r;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/skills/[id]/content">
) {
  const { id } = await ctx.params;
  const skillId = Number(id);
  if (!Number.isFinite(skillId) || skillId < 1) {
    return Response.json({ error: "Invalid skillId" }, { status: 400 });
  }

  const skill = await getSkillById(BigInt(skillId)).catch(() => null);
  if (!skill) return Response.json({ error: "Skill not found" }, { status: 404 });
  if (!skill.contentURI) {
    return Response.json({ skillId, contentURI: null, content: null, source: "no-uri" });
  }

  const urls = [
    ipfsToHttp(skill.contentURI, PRIMARY_GW),
    ipfsToHttp(skill.contentURI, FALLBACK_GW),
    ipfsToHttp(skill.contentURI, SECOND_FB_GW),
  ].filter((u): u is string => !!u);

  let content: unknown = null;
  let source = "unreachable";

  for (const url of urls) {
    const r = await fetchWithTimeout(url);
    if (r && r.ok) {
      try {
        content = await r.json();
        source = url;
        break;
      } catch {
        // not JSON — try next
      }
    }
  }

  return Response.json(
    { skillId, contentURI: skill.contentURI, content, source },
    {
      headers: {
        // Cache aggressively — skill content is immutable per CID
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
