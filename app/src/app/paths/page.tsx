import Link from "next/link";
import { Badge } from "@/components/ui/badge";

// Curated curricula — static content based on real active skill IDs.
// Bundled purchase via PathRegistry will ship with mainnet; until then this
// page acts as the curriculum-architecture catalogue. Every skill_id below
// resolves to an active, IPFS-pinned, on-chain skill on Sepolia.
type Curriculum = {
  id: string;
  icon: string;
  title: string;
  tagline: string;
  audience: string;
  skills: { id: number; name: string; price: string; difficulty: string }[];
  total: string;
  bundleNote: string;
  whyOrder: string;
};

// Mirrors the 5 real on-chain learning paths created in PathRegistry
// (totalPaths=5). Same names, skill ids, ordering and discounts — every skill
// referenced here is ACTIVE in SkillRegistry and auto-verifiable on-chain.
const CURRICULA: Curriculum[] = [
  {
    id: "liquid-staking-foundations",
    icon: "🥩",
    title: "Liquid Staking Foundations",
    tagline: "Master Ethereum liquid staking end-to-end and get a composable, value-accruing token.",
    audience: "Holders of idle ETH who want staking yield without running a validator.",
    skills: [
      { id: 24, name: "Lido ETH → stETH Liquid Staking", price: "$0.49", difficulty: "Beginner" },
      { id: 41, name: "Rocket Pool rETH Staking",        price: "$0.49", difficulty: "Beginner" },
      { id: 42, name: "ether.fi eETH Liquid Restaking",  price: "$0.49", difficulty: "Beginner" },
      { id: 51, name: "Lido wstETH Wrap",                price: "$0.49", difficulty: "Beginner" },
    ],
    total: "$1.96",
    bundleNote: "Bundle live on-chain — atomic purchase at launch: $1.67 (−15%).",
    whyOrder: "Start with Lido stETH (#24), the deepest-liquidity LST. Diversify the validator set with Rocket Pool (#41) and ether.fi (#42), then wrap into the non-rebasing wstETH (#51) that DeFi uses as collateral.",
  },
  {
    id: "restaking-pro",
    icon: "♻️",
    title: "Restaking Pro",
    tagline: "Go beyond staking into EigenLayer restaking for layered AVS yield.",
    audience: "ETH stakers who want extra restaking yield on top of base staking rewards.",
    skills: [
      { id: 43, name: "Renzo ezETH Restaking",                 price: "$2.99", difficulty: "Intermediate" },
      { id: 44, name: "Kelp DAO rsETH Restaking",              price: "$2.99", difficulty: "Intermediate" },
      { id: 23, name: "EigenLayer Restaking with AVS Selection", price: "$9.99", difficulty: "Advanced" },
    ],
    total: "$15.97",
    bundleNote: "Bundle live on-chain — atomic purchase at launch: $12.78 (−20%).",
    whyOrder: "Mint liquid restaking tokens via Renzo (#43) and Kelp (#44) first — they manage the operator set for you. Then take direct control with native EigenLayer restaking + AVS selection (#23).",
  },
  {
    id: "stablecoin-yield-engine",
    icon: "💵",
    title: "Stablecoin Yield Engine",
    tagline: "Put dollars to work with zero liquidation risk across three ERC-4626 vaults.",
    audience: "Holders of idle stablecoins who want savings-rate yield, no IL, fully liquid.",
    skills: [
      { id: 45, name: "Ethena sUSDe Staking", price: "$0.49", difficulty: "Beginner" },
      { id: 46, name: "Sky sUSDS Savings",    price: "$0.49", difficulty: "Beginner" },
      { id: 39, name: "Maker sDAI — DSR Savings", price: "$0.49", difficulty: "Beginner" },
    ],
    total: "$1.47",
    bundleNote: "Bundle live on-chain — atomic purchase at launch: $1.25 (−15%).",
    whyOrder: "Three battle-tested ERC-4626 dollar vaults: Ethena sUSDe (#45) for protocol yield, Sky sUSDS (#46) and Maker sDAI (#39) for the savings rate. Same deposit pattern, different risk/yield profiles.",
  },
  {
    id: "dex-execution-master",
    icon: "🔁",
    title: "DEX Execution Master",
    tagline: "Best execution across the majors — routers, aggregators and stable pools.",
    audience: "Active traders who lose 2-3% per trade to bad routing.",
    skills: [
      { id: 1,  name: "Uniswap V3 Swap Execution",    price: "$2.99", difficulty: "Intermediate" },
      { id: 48, name: "Balancer V2 Vault Swap",       price: "$2.99", difficulty: "Intermediate" },
      { id: 49, name: "1inch Aggregation Swap (V6)",  price: "$2.99", difficulty: "Intermediate" },
      { id: 50, name: "Uniswap Universal Router Swap", price: "$9.99", difficulty: "Advanced" },
      { id: 38, name: "Curve Stable Pool LP",         price: "$2.99", difficulty: "Intermediate" },
    ],
    total: "$21.95",
    bundleNote: "Bundle live on-chain — atomic purchase at launch: $16.46 (−25%).",
    whyOrder: "Learn the direct venues first — Uniswap V3 (#1), Balancer (#48), Curve (#38) — then layer on aggregation: 1inch (#49) for best-price routing and the Universal Router (#50) for batched, Permit2-powered execution.",
  },
  {
    id: "multi-chain-defi",
    icon: "🌉",
    title: "Multi-Chain DeFi",
    tagline: "Operate beyond mainnet — Base, Optimism and Arbitrum, plus bridging.",
    audience: "Agents that need to act wherever liquidity and incentives live, not just on L1.",
    skills: [
      { id: 52, name: "Aerodrome Swap (Base)",      price: "$2.99", difficulty: "Intermediate" },
      { id: 53, name: "Velodrome Swap (Optimism)",  price: "$2.99", difficulty: "Intermediate" },
      { id: 26, name: "Across Cross-Chain Bridge",  price: "$2.99", difficulty: "Intermediate" },
      { id: 40, name: "GMX V2 Perpetual Trading",   price: "$9.99", difficulty: "Advanced" },
    ],
    total: "$18.96",
    bundleNote: "Bundle live on-chain — atomic purchase at launch: $15.17 (−20%).",
    whyOrder: "Swap on Base via Aerodrome (#52) and on Optimism via Velodrome (#53), move liquidity across chains with Across (#26), then trade perps on Arbitrum with GMX V2 (#40). One curriculum, four chains.",
  },
];

export const metadata = {
  title: "Curricula — NORMIE UNIVERSITY",
  description: "Curated agent curricula: each bundle is a real, ordered path through the active skill catalogue, mapped to a concrete buyer persona.",
};

export default function CurriculaPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <div className="mb-3">
          <Badge>Curricula</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Curated paths through the catalogue.
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-soft">
          Five themed curricula, each a real ordered sequence of active skills
          and a live bundle in the on-chain PathRegistry. Atomic bundled
          purchase opens with the launch release at a 15-25% discount versus
          buying skills individually. Pick the curriculum that matches your
          goal, take the skills in the suggested order, earn one Soulbound
          credential per skill.
        </p>
        <p className="mt-3 text-xs mono text-ink-muted">
          Every skill_id below resolves to an active, IPFS-pinned, on-chain
          skill at <code className="text-ink-soft">SkillRegistry</code>.
        </p>
      </header>

      <div className="space-y-8">
        {CURRICULA.map((c) => (
          <section key={c.id} className="border border-line bg-surface p-6">
            <div className="flex items-start gap-4">
              <div className="text-3xl">{c.icon}</div>
              <div className="flex-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="text-xl font-semibold text-ink">{c.title}</h2>
                  <span className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                    {c.skills.length} skills · total {c.total}
                  </span>
                </div>
                <p className="mt-1 text-sm italic text-ink-soft">{c.tagline}</p>
                <p className="mt-1 text-[11px] mono text-ink-muted">For: {c.audience}</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                The path
              </div>
              <ol className="mt-2 space-y-1.5">
                {c.skills.map((s, i) => (
                  <li key={s.id}>
                    <Link
                      href={`/skills/${s.id}`}
                      className="flex items-center gap-3 border border-line bg-paper px-3 py-2 transition-colors hover:border-line-strong"
                    >
                      <span className="mono text-[11px] text-ink-faint tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="mono text-[10px] text-ink-muted">#{s.id}</span>
                      <span className="flex-1 text-sm text-ink">{s.name}</span>
                      <span className="hidden sm:inline mono text-[10px] text-ink-muted">
                        {s.difficulty}
                      </span>
                      <span className="mono text-xs text-ink-soft">{s.price}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="border border-line bg-paper p-3 text-xs">
                <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                  Why this order
                </div>
                <p className="mt-1 leading-relaxed text-ink-soft">{c.whyOrder}</p>
              </div>
              <div className="border border-line bg-paper p-3 text-xs">
                <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                  Bundle pricing (mainnet)
                </div>
                <p className="mt-1 leading-relaxed text-ink-soft">{c.bundleNote}</p>
                <Link
                  href="/skills"
                  className="mt-2 inline-block mono text-[11px] text-ink underline decoration-line-strong decoration-1 underline-offset-2 hover:opacity-70"
                >
                  Browse individual skills →
                </Link>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12 border border-line-strong bg-canvas p-6 text-center">
        <h2 className="text-lg font-semibold text-ink">Not sure which curriculum fits?</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The use-cases page maps 10 buyer personas to concrete skills, with
          annualized ROI projections.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/use-cases"
            className="border border-line-strong bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 mono"
          >
            Pick by use case →
          </Link>
          <Link
            href="/skills"
            className="border border-line-strong px-5 py-2 text-sm font-semibold text-ink hover:bg-paper mono"
          >
            Browse the catalogue →
          </Link>
        </div>
      </section>
    </div>
  );
}
