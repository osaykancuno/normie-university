import Link from "next/link";
import { ACTIVE_CHAIN } from "@/config/chains";

const IS_TESTNET = (ACTIVE_CHAIN.id as number) !== 1 && (ACTIVE_CHAIN.id as number) !== 8453;

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 text-xs text-ink-muted sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-1 mono sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">NORMIE UNIVERSITY</span>
            <span className="hidden sm:inline">— the agent academy for living NFTs</span>
          </div>
          <span className="hidden text-ink-faint sm:inline">·</span>
          <span className="text-ink-muted">
            built by{" "}
            <a
              href="https://x.com/OsayKancuno"
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink-soft underline decoration-line-strong decoration-1 underline-offset-2 hover:text-ink"
            >
              @OsayKancuno
            </a>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mono">
          <Link href="/skills" className="hover:text-ink">Catalogue</Link>
          <Link href="/use-cases" className="hover:text-ink">Use cases</Link>
          <Link href="/developers" className="hover:text-ink">Developers</Link>
          <Link href="/community/normies" className="hover:text-ink">Normies</Link>
          <a
            href="https://normies.art"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-ink"
          >
            normies.art ↗
          </a>
        </div>
      </div>
      {IS_TESTNET && (
        <div className="border-t border-line bg-canvas/40">
          <div className="mx-auto max-w-7xl px-4 py-3 text-[10px] mono text-ink-muted sm:px-6 lg:px-8">
            <strong className="text-ink-soft">Demo build · Ethereum {ACTIVE_CHAIN.name}.</strong>{" "}
            All transactions on this site use test USDC from the Circle faucet — no real funds are
            transferred or at risk. Skill credentials minted here are valid only on the demo
            network. The mainnet release will be deployed under a multisig with a different admin
            key. <Link href="https://github.com/osaykancuno/normie-university#%EF%B8%8F-demo--testnet-disclosure" target="_blank" rel="noreferrer noopener" className="underline hover:text-ink">Read the full disclosure ↗</Link>
          </div>
        </div>
      )}
    </footer>
  );
}
