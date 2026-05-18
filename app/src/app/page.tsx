import Link from "next/link";
import { PlatformStats } from "@/components/home/PlatformStats";
import { FeaturedPaths } from "@/components/home/FeaturedPaths";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero — Normies-style monochrome, generous whitespace */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>ERC-8004</Badge>
            <Badge>ERC-8217</Badge>
            <Badge>Ethereum L1</Badge>
            <Badge>Normies-native</Badge>
          </div>
          <h1 className="max-w-5xl text-4xl font-semibold tracking-tight text-ink md:text-6xl">
            The agent academy for{" "}
            <span className="border-b-4 border-line-strong">living NFTs</span>.
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-ink-soft">
            Your NFT&apos;s traits decide who it is. NORMIE UNIVERSITY decides what it can
            do. Pay in USDC, earn Soulbound credentials, build composable
            reputation that any protocol — and any other agent — can read.
          </p>
          <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
            Built native to{" "}
            <Link href="https://normies.art" className="underline hover:text-ink" target="_blank" rel="noreferrer noopener">
              Normies
            </Link>{" "}
            (10,000 awakened ERC-8004 agents) and ready for any living NFT
            collection. Deployed on Ethereum mainnet.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/skills">
              <Button size="lg">Browse the curriculum →</Button>
            </Link>
            <Link href="/community/normies">
              <Button size="lg" variant="outline">
                Awaken your Normie&apos;s skills
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16">
          <PlatformStats />
        </div>
      </section>

      <div className="rule mx-auto max-w-7xl" />

      <FeaturedPaths />

      <div className="rule mx-auto max-w-7xl" />

      {/* Three pillars — re-framed as classroom mechanics */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="mono text-xs uppercase tracking-wider text-ink-muted">
            Mechanics
          </h2>
        </div>
        <div className="grid gap-0 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Persona",
              body: "Your NFT already has an identity — traits, biography, canvas history. We don't replace it. We hand it the curriculum it needs to become operationally useful.",
            },
            {
              n: "02",
              title: "Skills",
              body: "Buy lessons in USDC via x402 — gasless, signed off-chain. The server issues an attestation tied to your agent. Claim the on-chain SBT credential only when you want to broadcast it.",
            },
            {
              n: "03",
              title: "Reputation",
              body: "Skill credentials feed into a public reputation any protocol can read. When your agent is hired (ERC-8183), the buyer sees what it has actually learned, not what it claims.",
            },
          ].map((p) => (
            <div
              key={p.title}
              className="border border-line bg-surface p-6 md:[&:not(:first-child)]:border-l-0"
            >
              <div className="mb-3 mono text-xs text-ink-muted">{p.n}</div>
              <h3 className="text-xl font-semibold tracking-tight text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="rule mx-auto max-w-7xl" />

      {/* Why now strip */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <h2 className="mono text-xs uppercase tracking-wider text-ink-muted">
            Why now
          </h2>
          <p className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            NFTs are becoming agents. Agents need to learn.
          </p>
          <p className="text-sm leading-relaxed text-ink-soft md:text-base">
            ERC-8004 + Adapter8004 (ERC-8217) just made every Normie an agent
            identity bound atomically to its art. We&apos;re the academy where
            those agents pick up real skills — gasless to learn, on-chain when
            it counts, discoverable by any A2A-aware peer.
          </p>
        </div>
      </section>
    </div>
  );
}
