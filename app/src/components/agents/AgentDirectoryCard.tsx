"use client";

import Link from "next/link";
import { usePersonaPreview } from "@/hooks/useNormies";
import { Badge } from "@/components/ui/badge";

/// Card for a single Normie agent in the directory grid.
/// Pulls persona live from /api/normies/persona-preview/{id} (cached server-side).
/// Filters are evaluated client-side once the persona has loaded.
export function AgentDirectoryCard({
  tokenId,
  typeFilter,
  levelFilter,
  stateFilter,
}: {
  tokenId: number;
  typeFilter: "all" | "Human" | "Cat" | "Alien" | "Agent";
  levelFilter: "all" | "1" | "2" | "3+";
  stateFilter: "all" | "customized" | "purist";
}) {
  const { data, isLoading } = usePersonaPreview(tokenId);

  if (isLoading || !data) {
    return (
      <div className="h-[260px] animate-pulse border border-line bg-surface" />
    );
  }

  const p = data.persona;
  const type = p.type ?? "—";
  const level = p.canvas?.level ?? 1;
  const customized = !!p.canvas?.customized;

  // Filter
  if (typeFilter !== "all" && type !== typeFilter) return null;
  if (levelFilter === "1" && level !== 1) return null;
  if (levelFilter === "2" && level !== 2) return null;
  if (levelFilter === "3+" && level < 3) return null;
  if (stateFilter === "customized" && !customized) return null;
  if (stateFilter === "purist" && customized) return null;

  return (
    <Link
      href={`/agents/normie/${tokenId}`}
      className="group block border border-line bg-surface transition-colors hover:border-line-strong"
    >
      <div className="aspect-square bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.image.svg}
          alt={`Normie #${tokenId}`}
          className="h-full w-full pixel"
        />
      </div>
      <div className="space-y-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-semibold tracking-tight text-ink">
            {p.name}
          </div>
          <span className="mono text-[10px] text-ink-muted">#{tokenId}</span>
        </div>
        {p.tagline && (
          <p className="line-clamp-1 text-xs italic text-ink-soft">
            &ldquo;{p.tagline}&rdquo;
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <Badge variant="outline">{type}</Badge>
          <Badge variant="outline">lvl {level}</Badge>
          {customized && <Badge>customized</Badge>}
        </div>
      </div>
    </Link>
  );
}
