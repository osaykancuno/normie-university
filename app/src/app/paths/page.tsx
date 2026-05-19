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

const CURRICULA: Curriculum[] = [
  {
    id: "yield-stack",
    icon: "🌾",
    title: "The Yield Stack",
    tagline: "Set-and-forget income across the major lending + LST + farming protocols.",
    audience: "Holders of idle stablecoins or ETH who want APY without active management.",
    skills: [
      { id: 24, name: "Lido stETH Staking",          price: "$0.49",  difficulty: "Beginner" },
      { id: 2,  name: "Aave V3 Supply & Withdraw",   price: "$0.49",  difficulty: "Beginner" },
      { id: 37, name: "Compound V3 Supply",          price: "$0.49",  difficulty: "Beginner" },
      { id: 39, name: "Maker sDAI (DSR)",            price: "$0.49",  difficulty: "Beginner" },
      { id: 18, name: "Multi-Protocol Yield Router", price: "$9.99",  difficulty: "Advanced" },
      { id: 20, name: "Pendle PT/YT",                price: "$9.99",  difficulty: "Advanced" },
    ],
    total: "$21.94",
    bundleNote: "Buy the bundle on mainnet: ~$15.99 (−27%).",
    whyOrder: "Start with the cheap deposits (#24 / #2 / #37 / #39) to feel the rate market. Then the router (#18) makes the choice automatic. Pendle (#20) is the optional yield-tokenization upgrade.",
  },
  {
    id: "defi-trader",
    icon: "📈",
    title: "The DeFi Trader",
    tagline: "Best execution + sandwich protection on every swap.",
    audience: "Active traders who size up and lose 2-3% per trade to bad routing or MEV.",
    skills: [
      { id: 1,  name: "Uniswap V3 Swap",           price: "$2.99",  difficulty: "Intermediate" },
      { id: 21, name: "UniswapX Best Execution",   price: "$2.99",  difficulty: "Intermediate" },
      { id: 19, name: "Anti-MEV via Flashbots",    price: "$2.99",  difficulty: "Intermediate" },
      { id: 40, name: "GMX V2 Perp Trading",       price: "$9.99",  difficulty: "Advanced" },
      { id: 12, name: "Arbitrage Detection",       price: "$24.99", difficulty: "Expert" },
    ],
    total: "$43.95",
    bundleNote: "Buy the bundle on mainnet: ~$31.99 (−27%).",
    whyOrder: "Get the swap primitive (#1), then intent-based routing (#21) and private submission (#19) before going leveraged on GMX (#40). Arbitrage detection (#12) closes the loop.",
  },
  {
    id: "leveraged-defi",
    icon: "⚠️",
    title: "Leveraged Borrower Safety",
    tagline: "Avoid liquidation, rebalance LPs, recover after price moves.",
    audience: "Anyone running collateralized positions on Aave or running concentrated Uniswap V3 LPs.",
    skills: [
      { id: 17, name: "Aave V3 Health-Factor Manager", price: "$9.99",  difficulty: "Advanced" },
      { id: 27, name: "Uniswap V3 LP Rebalance",       price: "$24.99", difficulty: "Expert" },
      { id: 38, name: "Curve Stable Pool LP",          price: "$2.99",  difficulty: "Intermediate" },
    ],
    total: "$37.97",
    bundleNote: "Buy the bundle on mainnet: ~$27.99 (−26%).",
    whyOrder: "Health-factor first (#17) — one avoided liquidation pays for the whole bundle 50-500x over. Then LP rebalancing (#27) keeps your capital productive. Curve (#38) adds stable LP exposure.",
  },
  {
    id: "nft-builder",
    icon: "🖼️",
    title: "NFT Builder",
    tagline: "Mint, enforce royalties, snipe floors. Native to Normies.",
    audience: "Normie holders who want their agent operating on the collection — buying, listing, royalty-aware.",
    skills: [
      { id: 9,  name: "ERC-721 Mint",        price: "$0.49", difficulty: "Beginner" },
      { id: 10, name: "EIP-2981 Royalty",    price: "$2.99", difficulty: "Intermediate" },
      { id: 25, name: "Blur Collection Bid", price: "$2.99", difficulty: "Intermediate" },
    ],
    total: "$6.47",
    bundleNote: "Buy the bundle on mainnet: ~$4.99 (−23%).",
    whyOrder: "Mint primitive (#9), then royalty enforcement (#10), then active floor-bidding (#25). Bundle priced for Normie holders — class is in session.",
  },
  {
    id: "dao-power",
    icon: "🏛️",
    title: "DAO Power Voter",
    tagline: "Vote on 20 DAOs in one batch, harvest bribes, claim every vesting cliff.",
    audience: "Holders with significant governance-token exposure across multiple protocols.",
    skills: [
      { id: 29, name: "Multi-DAO Snapshot Voting", price: "$0.49", difficulty: "Beginner" },
      { id: 28, name: "Convex Bribe Harvester",    price: "$2.99", difficulty: "Intermediate" },
      { id: 30, name: "Token Vesting Auto-Claim",  price: "$2.99", difficulty: "Intermediate" },
    ],
    total: "$6.47",
    bundleNote: "Buy the bundle on mainnet: ~$4.99 (−23%).",
    whyOrder: "Batched voting (#29) saves the most time. Bribe harvesting (#28) and vesting auto-claim (#30) are the recurring revenue legs.",
  },
  {
    id: "agent-native",
    icon: "🤖",
    title: "Builder of Agents",
    tagline: "ERC-7702 delegation, EAS attestations, zk-proofs. Compose your own agent.",
    audience: "Devs building autonomous agents — including agents that build agents.",
    skills: [
      { id: 33, name: "ERC-7702 EOA Delegation", price: "$24.99", difficulty: "Expert" },
      { id: 35, name: "EAS Attestation Issuance", price: "$2.99",  difficulty: "Intermediate" },
      { id: 14, name: "zk-Proof Verification",   price: "$24.99", difficulty: "Expert" },
      { id: 6,  name: "Safe Multisig Tx",        price: "$9.99",  difficulty: "Advanced" },
    ],
    total: "$62.96",
    bundleNote: "Buy the bundle on mainnet: ~$44.99 (−29%).",
    whyOrder: "Delegation primitive first (#33) so your EOA gains batch + session keys. EAS (#35) lets you attest to anything. zk (#14) gives privacy. Safe (#6) for production custody.",
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
          Six themed curricula, each a real ordered sequence of active skills.
          Bundled atomic purchase will ship with the mainnet release at a
          25-30% discount versus buying skills individually. Until then, this
          page is the architecture: pick the curriculum that matches your goal,
          buy the skills in the suggested order, earn one Soulbound credential
          per skill.
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
