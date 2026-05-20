"use client";

import Link from "next/link";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useIsCreator } from "@/hooks/useSkillRegistry";
import { useDemoMode } from "@/hooks/useSkills";
import { ACTIVE_CHAIN } from "@/config/chains";
import { IS_COMING_SOON } from "@/config/launch";
import { AwakenedTicker } from "@/components/layout/AwakenedTicker";
import { ComingSoonButton } from "@/components/layout/ComingSoonButton";
import { cn } from "@/lib/utils";

const IS_TESTNET = (ACTIVE_CHAIN.id as number) !== 1 && (ACTIVE_CHAIN.id as number) !== 8453;

/// Tier 1 — always visible on desktop, also surfaced in mobile menu.
const NAV_LINKS_PRIMARY = [
  { href: "/skills",    label: "Catalogue" },
  { href: "/agents",    label: "Agents" },
  { href: "/use-cases", label: "Use cases" },
  { href: "/dashboard", label: "Dashboard" },
];

/// Tier 2 — only on larger desktops (lg+); on mobile they're in the menu.
/// Learning Paths intentionally hidden while we're on testnet — re-enable
/// once the bundled-purchase flow ships with real USDC on mainnet.
const NAV_LINKS_SECONDARY = [
  { href: "/reputation",        label: "Leaderboard" },
  { href: "/community/normies", label: "Normies" },
  { href: "/developers",        label: "Developers" },
];

const ALL_NAV = [...NAV_LINKS_PRIMARY, ...NAV_LINKS_SECONDARY];

export function Header() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { data: isCreator } = useIsCreator(address);
  const demo = useDemoMode();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      {/* Preview ribbon — makes it unmistakable the product isn't live yet */}
      {(IS_TESTNET || IS_COMING_SOON) && (
        <div className="border-b border-line bg-canvas">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-3 py-1 text-[11px] sm:px-6 lg:px-8">
            <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[color:var(--accent-warn)]" />
            <span className="mono truncate uppercase tracking-wider text-ink-soft">
              <span className="sm:hidden">Public preview · launching soon</span>
              <span className="hidden sm:inline">
                Public preview — wallet connect &amp; skill purchases launch with the mainnet release. Browsing is free, no wallet needed.
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-6 lg:px-8">
        {/* Logo — single line, never wraps */}
        <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
          <div className="flex h-7 w-7 items-center justify-center bg-canvas pixel">
            <span className="mono text-[10px] font-bold text-ink">NU</span>
          </div>
          <span className="mono whitespace-nowrap text-sm font-semibold tracking-tight text-ink sm:text-base">
            <span className="sm:hidden">NORMIE U.</span>
            <span className="hidden sm:inline">NORMIE UNIVERSITY</span>
          </span>
          {(IS_COMING_SOON || IS_TESTNET) && (
            <span className="ml-1 hidden border border-[color:var(--accent-warn)] bg-paper px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-warn)] mono md:inline-block">
              preview
            </span>
          )}
          {demo && !IS_TESTNET && !IS_COMING_SOON && (
            <span className="ml-1 hidden border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft mono md:inline-block">
              demo
            </span>
          )}
        </Link>

        {/* Desktop nav — tier 1 always (md+), tier 2 only on lg+ */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
          {NAV_LINKS_PRIMARY.map((l) => (
            <NavItem key={l.href} link={l} pathname={pathname} />
          ))}
          {NAV_LINKS_SECONDARY.map((l) => (
            <div key={l.href} className="hidden lg:flex">
              <NavItem link={l} pathname={pathname} />
            </div>
          ))}
        </nav>

        {/* Spacer for mobile */}
        <div className="flex-1 md:hidden" />

        {/* Admin (creator-only) — compact button */}
        {/* Live awakened-count ticker — our hero metric */}
        <div className="hidden lg:inline-flex shrink-0">
          <AwakenedTicker />
        </div>
        <div className="hidden md:inline-flex lg:hidden shrink-0">
          <AwakenedTicker compact />
        </div>

        {isCreator && (
          <Link
            href="/admin/skills/create"
            className={cn(
              "hidden shrink-0 border border-line-strong px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors lg:inline-block",
              pathname?.startsWith("/admin")
                ? "bg-ink text-paper"
                : "text-ink hover:bg-canvas"
            )}
          >
            Admin
          </Link>
        )}

        {/* Wallet — replaced by a 'Launching soon' affordance during the
            public preview so nobody tries to connect-and-buy. */}
        <div className="shrink-0 flex items-center">
          {IS_COMING_SOON ? (
            <ComingSoonButton />
          ) : (
            <ConnectButton
              showBalance={false}
              chainStatus={{ smallScreen: "none", largeScreen: "icon" }}
              accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
              label="Connect"
            />
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="shrink-0 inline-flex h-9 w-9 items-center justify-center border border-line text-ink hover:bg-canvas md:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            {menuOpen ? (
              <path d="M3 3l10 10M13 3L3 13" />
            ) : (
              <>
                <path d="M2 4h12" />
                <path d="M2 8h12" />
                <path d="M2 12h12" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="border-t border-line bg-paper md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-0 px-3 py-2 sm:px-6">
            {ALL_NAV.map((l) => {
              const active = pathname === l.href || pathname?.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "border-b border-line/60 px-2 py-2.5 text-sm font-medium last:border-b-0",
                    active ? "bg-canvas text-ink" : "text-ink-soft hover:text-ink"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
            {isCreator && (
              <Link
                href="/admin/skills/create"
                onClick={() => setMenuOpen(false)}
                className="border-t border-line-strong px-2 py-2.5 text-sm font-semibold uppercase tracking-wide text-ink mono"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function NavItem({
  link,
  pathname,
}: {
  link: { href: string; label: string };
  pathname: string | null;
}) {
  const active = pathname === link.href || pathname?.startsWith(link.href + "/");
  return (
    <Link
      href={link.href}
      className={cn(
        "whitespace-nowrap px-2 py-2 text-[13px] font-medium transition-colors xl:px-3 xl:text-sm",
        active
          ? "text-ink underline underline-offset-4 decoration-line-strong decoration-2"
          : "text-ink-soft hover:text-ink"
      )}
    >
      {link.label}
    </Link>
  );
}
