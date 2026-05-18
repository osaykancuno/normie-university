import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 text-xs text-ink-muted sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mono">
          <span className="font-semibold text-ink">NORMIE UNIVERSITY</span>
          <span>— the agent academy for living NFTs</span>
        </div>
        <div className="flex items-center gap-6 mono">
          <Link href="/skills" className="hover:text-ink">Catalogue</Link>
          <Link href="/paths" className="hover:text-ink">Paths</Link>
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
    </footer>
  );
}
