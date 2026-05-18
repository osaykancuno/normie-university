"use client";

import { usePersonaOf } from "@/hooks/useNormies";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NormieAvatar } from "./NormieAvatar";

/// Rich identity card for a Normie holder — pulls the live persona (name,
/// tagline, personality, canvas state) from the Normies agent API and lays
/// it out as the primary identity surface in NORMIE UNIVERSITY dashboards & profiles.
///
/// Renders nothing for non-holders so it can be unconditionally embedded.
export function PersonaCard({ address }: { address: `0x${string}` | undefined }) {
  const { data, isLoading } = usePersonaOf(address);

  if (!address) return null;
  if (isLoading) {
    return (
      <Card className="border-line bg-surface">
        <CardContent className="p-6">
          <div className="h-32 animate-pulse rounded-md bg-surface-2" />
        </CardContent>
      </Card>
    );
  }
  if (!data?.persona) return null;

  const p = data.persona;
  const diffSign = p.canvas.pixelDiff.net > 0
    ? `+${p.canvas.pixelDiff.net}`
    : `${p.canvas.pixelDiff.net}`;

  return (
    <Card className="border-line-strong bg-canvas">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-4">
          <NormieAvatar address={address} size={96} className="h-24 w-24 text-3xl" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                {p.name}
              </h2>
              <Badge variant="outline" className="border-line-strong">
                Normie #{p.tokenId}
              </Badge>
              <Badge variant="default">{p.type}</Badge>
            </div>
            <p className="mt-1 text-sm italic text-ink-soft">
              &ldquo;{p.tagline}&rdquo;
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {p.archetype}
            </p>
          </div>
        </div>

        {/* Canvas stats — the on-chain biography in one line */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-line/60 bg-surface/40 p-3 text-xs sm:grid-cols-4">
          <Stat label="Level" value={String(p.canvas.level)} />
          <Stat label="Action Points" value={p.canvas.actionPoints.toLocaleString()} />
          <Stat label="Transforms" value={String(p.canvas.transformations)} />
          <Stat label="Pixel net" value={diffSign} />
        </div>

        {/* Personality top 4 lines */}
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-ink-muted">
            Personality
          </div>
          <ul className="space-y-1 text-sm leading-relaxed text-ink-soft">
            {p.personality.slice(0, 4).map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-ink underline">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Communication style + greeting */}
        <div className="space-y-2 rounded-lg border border-line/60 bg-surface/40 p-3 text-xs">
          <div>
            <span className="text-ink-muted">Style: </span>
            <span className="text-ink-soft">{p.communicationStyle}</span>
          </div>
          <div className="border-t border-line pt-2 italic text-ink-soft">
            &ldquo;{p.greeting}&rdquo;
          </div>
        </div>

        {data.binding?.bound && data.binding.agentId && (
          <div className="text-xs text-ink-muted">
            ERC-8004 agent #{data.binding.agentId} · bound via Adapter8004
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="font-semibold text-ink">{value}</div>
    </div>
  );
}
