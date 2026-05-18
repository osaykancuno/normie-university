"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useIsCreator } from "@/hooks/useSkillRegistry";
import { useDemoMode } from "@/hooks/useSkills";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/preview",           label: "Pre-school" },
  { href: "/skills",            label: "Catalogue" },
  { href: "/paths",             label: "Paths" },
  { href: "/agents",            label: "Agents" },
  { href: "/reputation",        label: "Leaderboard" },
  { href: "/community/normies", label: "Normies" },
  { href: "/developers",        label: "Developers" },
  { href: "/dashboard",         label: "Dashboard" },
];

export function Header() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { data: isCreator } = useIsCreator(address);
  const demo = useDemoMode();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo — Normies-inspired pixel mark + mono wordmark */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center bg-canvas pixel">
            <span className="mono text-[10px] font-bold text-ink">NU</span>
          </div>
          <span className="mono text-base font-semibold tracking-tight text-ink">
            NORMIE UNIVERSITY
          </span>
          {demo && (
            <span className="ml-2 border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft mono">
              demo
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-ink underline underline-offset-4 decoration-line-strong decoration-2"
                    : "text-ink-soft hover:text-ink"
                )}
              >
                {l.label}
              </Link>
            );
          })}
          {isCreator && (
            <Link
              href="/admin/skills/create"
              className={cn(
                "ml-2 border border-line-strong px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                pathname?.startsWith("/admin")
                  ? "bg-ink text-paper"
                  : "text-ink hover:bg-canvas"
              )}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-2">
          <ConnectButton
            showBalance={{ smallScreen: false, largeScreen: false }}
            chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
          />
        </div>
      </div>
    </header>
  );
}
