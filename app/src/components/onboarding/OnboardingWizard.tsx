"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { IS_COMING_SOON } from "@/config/launch";
import { ComingSoonButton } from "@/components/layout/ComingSoonButton";
import { useNormiesOf, usePersonaOf } from "@/hooks/useNormies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "skillai:onboarded:v1";

/// First-visit 3-step onboarding wizard.
///   1. Welcome / framing
///   2. Connect wallet (RainbowKit ConnectButton)
///   3. Claim free welcome gift (only if Normie holder) OR browse catalogue
///
/// Stays out of the way of returning users via localStorage. Skippable at
/// any step. Mounts at the root layout so every page can trigger it.
export function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { address } = useAccount();
  const { data: holder } = useNormiesOf(address);
  const { data: personaData } = usePersonaOf(address);
  const isNormie = !!holder?.isHolder;
  const persona = personaData?.persona;

  // On mount: open if user hasn't dismissed before. Defer to client only.
  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setOpen(true);
    } catch { /* SSR / privacy mode → no-op */ }
  }, []);

  // Auto-advance from step 2 → 3 once wallet connects
  useEffect(() => {
    if (step === 2 && address) setStep(3);
  }, [step, address]);

  const dismiss = () => {
    try { window.localStorage.setItem(STORAGE_KEY, String(Date.now())); }
    catch { /* no-op */ }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-none border border-line bg-surface shadow-2xl">
        {/* Close */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 text-sm text-ink-muted hover:text-ink"
        >
          ✕
        </button>

        {/* Steps indicator */}
        <div className="flex gap-1 px-6 pt-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1 flex-1 rounded-none transition-colors",
                n <= step ? "" : "bg-surface-2"
              )}
            />
          ))}
        </div>

        <div className="space-y-5 p-6">
          {step === 1 && (
            <>
              <Badge variant="outline" className="border-line-strong text-ink-soft">
                Welcome to the academy
              </Badge>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                The agent academy for{" "}
                <span className="text-ink">
                  living NFTs
                </span>
              </h2>
              <p className="text-sm leading-relaxed text-ink-soft">
                Your NFT&apos;s traits decide who it is. NORMIE UNIVERSITY decides what it
                can do. Buy lessons in USDC (gasless via x402), earn Soulbound
                credentials, build composable reputation that any protocol — and
                any other agent — can read.
              </p>
              <p className="text-xs leading-relaxed text-ink-muted">
                Native to <strong className="text-ink-soft">Normies</strong>{" "}
                — a 10,000-piece on-chain NFT collection on Ethereum L1 (live
                supply adjusted for ongoing burn). Open to any living NFT.
              </p>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)}>Enter →</Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Badge variant="outline" className="border-line-strong text-ink-soft">
                Step 2 · Sign in
              </Badge>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                Connect your wallet
              </h2>
              <p className="text-sm leading-relaxed text-ink-soft">
                Use any Web3 wallet — MetaMask, Coinbase Wallet, Rainbow,
                WalletConnect. We never see your private keys. Browsing is
                always free; you only sign when you buy.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex justify-center">
                  {IS_COMING_SOON ? <ComingSoonButton /> : <ConnectButton />}
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-center text-xs text-ink-muted hover:text-ink-soft"
                >
                  Skip — I&apos;ll connect later
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Badge variant="outline" className="border-line-strong text-ink-soft">
                Step 3 · Your first skill
              </Badge>
              {isNormie ? (
                <>
                  <h2 className="text-2xl font-semibold tracking-tight text-ink">
                    Welcome,{" "}
                    <span className="text-ink">
                      {persona?.name ?? `Normie #${holder?.tokenIds[0]}`}
                    </span>
                  </h2>
                  {persona?.tagline && (
                    <p className="-mt-1 text-xs italic text-ink-soft">
                      &ldquo;{persona.tagline}&rdquo;
                      {persona.canvas?.level ? ` · Level ${persona.canvas.level}` : ""}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-ink-soft">
                    {persona?.greeting ? (
                      <span className="block italic text-ink-soft">
                        &ldquo;{persona.greeting}&rdquo;
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm leading-relaxed text-ink-soft">
                    You qualify for a sponsored welcome gift: the{" "}
                    <strong className="text-ink">Aave V3 Supply &amp; Withdraw</strong>{" "}
                    skill, on us. Claim it from your dashboard.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/dashboard" onClick={dismiss}>
                      <Button>Claim welcome gift →</Button>
                    </Link>
                    <Link href="/skills" onClick={dismiss}>
                      <Button variant="outline">Browse curriculum</Button>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold tracking-tight text-ink">
                    You&apos;re in.
                  </h2>
                  <p className="text-sm leading-relaxed text-ink-soft">
                    Explore <strong className="text-ink">32 curated skill modules</strong>{" "}
                    across DeFi, NFT, Trading, Governance, Cross-Chain, Security
                    and agent-native primitives. Each purchase mints a Soulbound
                    credential to your wallet on completion.
                  </p>
                  <div className="rounded-md border border-line-strong bg-canvas p-3 text-xs text-ink-soft">
                    💡 Hold a <Link href="https://normies.art" target="_blank" rel="noreferrer noopener" className="text-ink underline hover:underline">Normie</Link>?
                    Reconnect with that wallet for a persona-tailored curriculum.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/skills" onClick={dismiss}>
                      <Button>Browse catalogue →</Button>
                    </Link>
                    <Link href="/use-cases" onClick={dismiss}>
                      <Button variant="outline">See use cases</Button>
                    </Link>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
