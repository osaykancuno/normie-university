"use client";

import { use } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { useAgentsByOwner, usePrimaryTokenId, useAgent } from "@/hooks/useAgent";
import { ReputationSummary } from "@/components/reputation/ReputationSummary";
import { AgentCredentials } from "@/components/agents/AgentCredentials";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NormieAvatar } from "@/components/normies/NormieAvatar";
import { NormieHolderBadge } from "@/components/normies/NormieHolderBadge";
import { PersonaCard } from "@/components/normies/PersonaCard";
import { shortAddress } from "@/lib/format";

export default function AgentProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = use(params);

  if (!isAddress(raw)) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[color:var(--accent-err)] bg-surface-2 p-4 text-sm text-[color:var(--accent-err)]">
          Invalid address.
        </div>
      </div>
    );
  }
  const agent = raw as `0x${string}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-ink-muted hover:text-ink-soft">
          ← Home
        </Link>
      </div>

      <AgentHeader agent={agent} />

      <div className="mt-8 space-y-8">
        <PersonaCard address={agent} />
        <ReputationSummary agent={agent} />

        <section>
          <h2 className="mb-4 text-lg font-semibold text-ink">Credentials</h2>
          <AgentCredentials agent={agent} />
        </section>
      </div>
    </div>
  );
}

function AgentHeader({ agent }: { agent: `0x${string}` }) {
  const { data: tokenIds } = useAgentsByOwner(agent);
  const { data: primaryId } = usePrimaryTokenId(agent);
  const primary = primaryId as bigint | undefined;
  const { data: profile } = useAgent(primary && primary > 0n ? primary : undefined);

  type AgentProfile = {
    tokenId: bigint;
    agentAddress: `0x${string}`;
    registrationFileURI: string;
    registeredAt: bigint;
    updatedAt: bigint;
    isActive: boolean;
  };
  const p = profile as AgentProfile | undefined;

  const count = (tokenIds as bigint[] | undefined)?.length ?? 0;
  const registered = !!p && p.registeredAt > 0n;

  return (
    <Card className="border-line bg-surface">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <NormieAvatar address={agent} size={56} className="h-14 w-14 text-xl" />
          <div>
            <div className="font-mono text-sm text-ink-soft">{shortAddress(agent, 6)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {registered ? (
                <Badge variant="success">Registered</Badge>
              ) : (
                <Badge variant="secondary">Not registered</Badge>
              )}
              <Badge variant="outline">
                {count} {count === 1 ? "token" : "tokens"}
              </Badge>
              {p?.isActive === false && registered && (
                <Badge variant="warning">Inactive</Badge>
              )}
              <NormieHolderBadge address={agent} />
            </div>
          </div>
        </div>

        {p?.registrationFileURI && (
          <a
            href={toGateway(p.registrationFileURI)}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-ink underline hover:underline"
          >
            View registration file ↗
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function toGateway(uri: string): string {
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  return uri;
}
