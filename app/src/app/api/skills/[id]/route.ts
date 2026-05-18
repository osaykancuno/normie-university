/// @file /api/skills/[id]
/// @notice Skill detail. If ?fetchContent=true is set and the contentURI is
///         resolvable over an IPFS gateway, the JSON module is inlined too.

import { getSkillById } from "@/lib/server/skills";
import type { NextRequest } from "next/server";

const IPFS_GATEWAY =
  process.env.IPFS_GATEWAY ||
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
  "https://ipfs.io/ipfs";

function toGateway(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY.replace(/\/$/, "")}/${uri.slice("ipfs://".length)}`;
  }
  return uri;
}

async function fetchContent(uri: string, timeoutMs = 4000): Promise<unknown | null> {
  if (!uri) return null;
  const url = toGateway(uri);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json") && !uri.endsWith(".json")) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/skills/[id]">
) {
  try {
    const { id } = await ctx.params;
    let skillId: bigint;
    try {
      skillId = BigInt(id);
    } catch {
      return Response.json({ error: "Invalid skillId" }, { status: 400 });
    }

    const skill = await getSkillById(skillId);
    if (!skill) {
      return Response.json({ error: "Skill not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const includeContent = url.searchParams.get("fetchContent") === "true";
    const content = includeContent ? await fetchContent(skill.contentURI) : null;

    return Response.json({ skill, content });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
