"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNormiesOf } from "@/hooks/useNormies";
import { NormieAvatar } from "@/components/normies/NormieAvatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const NORMIES_CONTRACT = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438";

export default function NormiesCommunityPage() {
  const { address } = useAccount();
  const { data } = useNormiesOf(address);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.18),transparent_60%)]"
      />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-6">
          <Badge variant="outline" className="border-line-strong text-ink-soft">
            Built for the Normies hackathon · normies.art
          </Badge>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            NORMIE UNIVERSITY is{" "}
            <span className="text-ink">
              native to the Normies collection
            </span>
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-ink-soft">
            Hold a Normie? Your agent gets a pixel-art identity, a dedicated{" "}
            <Link href="/skills" className="text-ink underline hover:underline">
              NFT-builder curriculum
            </Link>
            {" "}(ERC-721 mint, EIP-2981 royalty enforcement, Blur collection bidding),
            and a persona-tailored skill recommendation engine. We&apos;re a school
            for agents — and class is in session for the Normies hackathon.
          </p>
        </div>
      </section>

      {/* Holder check */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <Card className="border-line-strong bg-canvas">
          <CardContent className="flex flex-col items-start gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <NormieAvatar address={address} size={72} />
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-muted">
                  Your Normie identity
                </div>
                {!address ? (
                  <div className="mt-1 text-base font-semibold text-ink">
                    Connect a wallet to check your holdings.
                  </div>
                ) : data?.isHolder ? (
                  <>
                    <div className="mt-1 text-base font-semibold text-ink">
                      Verified Normie holder · {data.count}{" "}
                      {data.count === 1 ? "token" : "tokens"}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-ink-soft">
                      #{data.tokenIds.slice(0, 6).join(", #")}
                      {data.count > 6 ? ` and ${data.count - 6} more` : ""}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-base font-semibold text-ink-soft">
                    No Normies in this wallet — yet.
                  </div>
                )}
              </div>
            </div>
            {!address ? (
              <ConnectButton />
            ) : (
              <Link href="/skills">
                <Button>Browse the catalogue →</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Three benefits */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Pixel-art agent identity",
              body: "If your wallet holds a Normie, your NORMIE UNIVERSITY agent profile shows its 40×40 SVG as avatar — pulled live from the official Normies API. Your agent gets the look of the community.",
            },
            {
              title: "NFT-builder curriculum",
              body: "Three concrete skills for any agent acting on a collection: ERC-721 mint (#9), EIP-2981 royalty enforcement (#10), and Blur collection floor-bidding (#25). Persona-tailored picks surface higher for Normie holders.",
            },
            {
              title: "Production-grade API client",
              body: "We ship a server-side Normies client (rate-limit-aware, 60s caching) and a public proxy at /api/normies/* so your agent can read the collection without burning the upstream limit.",
            },
          ].map((p) => (
            <div
              key={p.title}
              className="rounded-none border border-line bg-surface p-6 backdrop-blur"
            >
              <h3 className="text-base font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* API endpoints we expose */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-xl font-semibold text-ink">NORMIE UNIVERSITY ↔ Normies endpoints</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ENDPOINTS.map((e) => (
            <Card key={e.path} className="border-line bg-surface">
              <CardContent className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="outline">{e.method}</Badge>
                  <code className="text-xs text-ink-soft">{e.path}</code>
                </div>
                <p className="text-sm text-ink-soft">{e.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Upstream contract on Ethereum mainnet:{" "}
          <code className="font-mono text-ink-soft">{NORMIES_CONTRACT}</code> ·
          {" "}Source:{" "}
          <a
            href="https://hackathon.normies.art/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink underline hover:underline"
          >
            hackathon.normies.art
          </a>
          {" "}·{" "}
          <a
            href="https://api.normies.art/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink underline hover:underline"
          >
            api.normies.art
          </a>
        </p>
      </section>
    </div>
  );
}

const ENDPOINTS = [
  { method: "GET", path: "/api/normies/holder/{address}", desc: "Cached lookup of a wallet's Normie holdings (proxies https://api.normies.art/holders)." },
  { method: "GET", path: "/api/normies/normie/{id}",      desc: "Combined Normie info: owner, traits, canvas state, image URL." },
];
