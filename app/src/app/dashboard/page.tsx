"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { RegisterAgent } from "@/components/dashboard/RegisterAgent";
import { AgentCredentials } from "@/components/agents/AgentCredentials";
import { ReputationSummary } from "@/components/reputation/ReputationSummary";
import { NormieAvatar } from "@/components/normies/NormieAvatar";
import { NormieHolderBadge } from "@/components/normies/NormieHolderBadge";
import { PersonaCard } from "@/components/normies/PersonaCard";
import { PersonaCurriculum } from "@/components/normies/PersonaCurriculum";
import { NormieWelcomeGift } from "@/components/normies/NormieWelcomeGift";
import { useNormiesOf, usePersonaOf } from "@/hooks/useNormies";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/format";

export default function DashboardPage() {
  const { address } = useAccount();
  const { data: holder } = useNormiesOf(address);
  const { data: personaData } = usePersonaOf(address);
  const primaryNormie = holder?.isHolder ? holder.tokenIds[0] : null;
  const personaName = personaData?.persona?.name;

  if (!address) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="rounded-none border border-line bg-surface p-10 text-center">
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Connect a wallet to view your agent profile, published skills, and credentials.
          </p>
          <div className="mt-6 inline-block">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <NormieAvatar address={address} size={64} className="h-16 w-16 text-2xl" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              {personaName ? (
                <>Welcome back,{" "}
                  <span className="text-ink">
                    {personaName}
                  </span>
                </>
              ) : primaryNormie ? (
                <>Welcome,{" "}
                  <span className="text-ink">
                    Normie #{primaryNormie}
                  </span>
                </>
              ) : (
                "Dashboard"
              )}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span className="font-mono text-ink-soft">{shortAddress(address, 6)}</span>
              <NormieHolderBadge address={address} />
            </div>
          </div>
        </div>
        <Link href={`/agents/${address}`}>
          <Button variant="outline">View public profile →</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PersonaCard address={address} />
          <NormieWelcomeGift address={address} />
          <PersonaCurriculum address={address} />
          <section>
            <h2 className="mb-4 text-lg font-semibold text-ink">My credentials</h2>
            <AgentCredentials agent={address} />
          </section>
        </div>

        <div className="space-y-6">
          <RegisterAgent />
          <ReputationSummary agent={address} />
        </div>
      </div>
    </div>
  );
}
