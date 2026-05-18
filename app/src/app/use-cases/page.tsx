import Link from "next/link";
import { Badge } from "@/components/ui/badge";

// Server component — pre-rendered, content is static + curated.
export const revalidate = 3600;

const PERSONAS = [
  {
    id: "passive-yield",
    icon: "💤",
    name: "The Sleeping Treasury",
    quote: "I want my idle stablecoins to earn without watching the chain 24/7.",
    pain: "$50k USDC sitting in a wallet earns 0%. Manually moving across Aave, Compound, Morpho, Spark and chasing the best APY weekly is annoying — missing one switch costs $300+/yr.",
    skillsNeeded: [
      { id: 18, name: "Multi-Protocol Yield Router",    price: "$9.99" },
      { id: 2,  name: "Aave V3 Supply & Withdraw",      price: "$0.49" },
      { id: 37, name: "Compound V3 Supply",             price: "$0.49" },
      { id: 39, name: "Maker sDAI (DSR)",               price: "$0.49" },
      { id: 24, name: "Lido stETH Staking",             price: "$0.49" },
    ],
    annualROI: "+$700-2,100 on $50k principal",
  },
  {
    id: "defi-trader",
    icon: "📈",
    name: "The On-Chain Trader",
    quote: "I trade size weekly. Sandwich attacks and bad fills cost me 2-3% per swap.",
    pain: "Public-mempool swaps lose 2-5% to sandwich bots. Manually routing through 1inch/CoW/UniswapX takes 4 clicks per trade. Direct perp trading on GMX/Hyperliquid is fragmented.",
    skillsNeeded: [
      { id: 19, name: "Anti-MEV via Flashbots",        price: "$2.99" },
      { id: 21, name: "UniswapX Best Execution",       price: "$2.99" },
      { id: 1,  name: "Uniswap V3 Swap",               price: "$2.99" },
      { id: 40, name: "GMX V2 Perp Trading",           price: "$9.99" },
      { id: 12, name: "Arbitrage Detection",           price: "$24.99" },
    ],
    annualROI: "+$3,000-8,000 saved on $500k turnover",
  },
  {
    id: "leveraged-defi",
    icon: "⚠️",
    name: "The Leveraged Borrower",
    quote: "My Aave position got liquidated last cycle. I lost the 5% penalty + my collateral.",
    pain: "Health factor sneaks below 1.0 while you sleep. The Aave UI doesn't push notifications. Bots front-run the liquidation.",
    skillsNeeded: [
      { id: 17, name: "Aave Health-Factor Manager", price: "$9.99" },
      { id: 27, name: "Uniswap V3 LP Rebalance",    price: "$24.99" },
    ],
    annualROI: "1 avoided liquidation pays for 50-500 years of subscriptions",
  },
  {
    id: "yield-maxi",
    icon: "🌾",
    name: "The Yield Maximalist",
    quote: "I want every basis point. Pendle, EigenLayer, Convex, Curve, GMX — but it's too much to track.",
    pain: "Pendle PT discounts disappear if you blink. EigenLayer operators get slashed. Convex bribes need to be claimed every 2 weeks or they expire. Curve gauge boosts decay.",
    skillsNeeded: [
      { id: 20, name: "Pendle PT/YT",                price: "$9.99" },
      { id: 23, name: "EigenLayer Restaking",        price: "$9.99" },
      { id: 28, name: "Convex Bribe Harvester",      price: "$2.99" },
      { id: 38, name: "Curve Stable Pool LP",        price: "$2.99" },
      { id: 22, name: "Hyperliquid Funding Arb",     price: "$24.99" },
    ],
    annualROI: "+15-40% APR over base staking on the same principal",
  },
  {
    id: "nft-collector",
    icon: "🖼️",
    name: "The NFT Collector",
    quote: "I want my agent to floor-bid blue chips and flip with a margin.",
    pain: "Watching floor on Blur/OpenSea/Magic Eden across 5 collections all day is unfeasible. Bots beat humans on mint sniping.",
    skillsNeeded: [
      { id: 25, name: "Blur Collection Bid",     price: "$2.99" },
      { id: 9,  name: "ERC-721 Mint",            price: "$0.49" },
      { id: 10, name: "EIP-2981 Royalty",        price: "$2.99" },
    ],
    annualROI: "Floor-bid alpha varies — 10-30% on actively-traded collections",
  },
  {
    id: "cross-chain",
    icon: "🌉",
    name: "The Multi-Chain Operator",
    quote: "My liquidity is on 5 chains. Bridges fail, fees vary 10x.",
    pain: "Native bridges take 7 days. CCTP is slow. Stargate is expensive on small sizes. Choosing per-trade is a research task each time.",
    skillsNeeded: [
      { id: 26, name: "Across Bridge",         price: "$2.99" },
    ],
    annualROI: "Saves 1-3h/week, plus fee delta of $50-300 per bridge",
  },
  {
    id: "dao-power-user",
    icon: "🏛️",
    name: "The DAO Power Voter",
    quote: "I hold tokens in 20 DAOs. Each cycle has 30+ proposals. I forget to vote on half.",
    pain: "Snapshot, Tally, and Agora are 3 different interfaces. Voting power decays if you don't show up. Token vesting cliffs sneak up.",
    skillsNeeded: [
      { id: 29, name: "Multi-DAO Snapshot Voting",    price: "$0.49" },
      { id: 30, name: "Token Vesting Auto-Claim",     price: "$2.99" },
    ],
    annualROI: "Reclaims ~$2k/yr in missed vesting + retains governance influence",
  },
  {
    id: "social-agent",
    icon: "🗣️",
    name: "The Social Identity",
    quote: "My Normie needs to exist online — own a name, post, get attestations.",
    pain: "ENS subnames are technical. Farcaster needs ed25519 keys. EAS attestations are confusing. Privacy via RAILGUN is risky if you misconfigure.",
    skillsNeeded: [
      { id: 31, name: "ENS Subname Management",       price: "$0.49" },
      { id: 32, name: "Farcaster Cast",               price: "$2.99" },
      { id: 35, name: "EAS Attestation Issuance",     price: "$2.99" },
      { id: 15, name: "ENS Resolution",               price: "$0.49" },
    ],
    annualROI: "Unlocks identity-gated allowlists, $WLDcoin-style airdrops",
  },
  {
    id: "agent-native",
    icon: "🤖",
    name: "The Builder Building Agents",
    quote: "I'm building autonomous agents. I need composable, audited capability modules.",
    pain: "Writing each integration from scratch (ERC-7702 delegation, EAS attestation issuance, zk-proof verification, Safe multi-sig flows) wastes 2-3 weeks per agent project. Plus each one has its own quirks across versions.",
    skillsNeeded: [
      { id: 33, name: "ERC-7702 EOA Delegation",     price: "$24.99" },
      { id: 35, name: "EAS Attestation Issuance",    price: "$2.99" },
      { id: 14, name: "zk-Proof Verification",       price: "$24.99" },
      { id: 6,  name: "Safe Multisig Tx",            price: "$9.99" },
    ],
    annualROI: "Each skill = ~10h of dev work saved at $100-200/h = $1k-2k per skill",
  },
  {
    id: "tax-aware",
    icon: "🧾",
    name: "The Tax-Aware Agent",
    quote: "I trade a lot. End of year is a CPA-fee nightmare and I'm probably overpaying.",
    pain: "Manual cost-basis tracking across DEX, CEX, bridges, airdrops is impossible. Wash-sale rules in crypto are unclear. Tax-loss opportunities are missed.",
    skillsNeeded: [
      { id: 36, name: "Tax-Loss Harvesting", price: "$24.99" },
    ],
    annualROI: "$1k-5k saved at tax time for active traders",
  },
];

const FAQ = [
  {
    q: "Why pay for a skill when I could write the code myself?",
    a: "You can. NORMIE UNIVERSITY skills are MIT-licensed reference implementations — you can copy them and avoid the marketplace entirely. What you pay $0.49-$24.99 for is: (a) the auditable, peer-reviewed module, (b) the on-chain Soulbound credential proving your agent is qualified, (c) the persistent agent-to-agent reputation that other protocols can read.",
  },
  {
    q: "What's the difference between this and ChatGPT plug-ins / Zapier?",
    a: "Plug-ins run on a centralized server you don't control. NORMIE UNIVERSITY skills are on-chain operations executed by YOUR agent under YOUR keys. The skill module declares WHAT to do; your agent signs and broadcasts the transaction. There is no NORMIE UNIVERSITY runtime that could be paused, censored, or compromised.",
  },
  {
    q: "How do I know a skill actually works?",
    a: "Three layers: (1) the module declares canonical contract addresses verifiable on Etherscan — 43/43 verified at this catalogue's last audit, (2) most skills have on-chain auto-verifiers that check tx selector + state delta, (3) every skill ships a TypeScript reference implementation you can run before purchase. Plus: 23 future skills documented with the same QA standard. The honest gaps (no mainnet-fork CI, no third-party audit yet) are declared openly in the README.",
  },
  {
    q: "What happens to my skill credentials if I sell my Normie?",
    a: "In v1, credentials are wallet-bound — they stay with the wallet that purchased them. The new Normie owner does NOT inherit them. v2 will use ERC-6551 token-bound accounts so credentials transfer with the NFT. This is intentional: it preserves 'I earned this' semantics and prevents reputation hijacking via cheap flips.",
  },
  {
    q: "Can I get a refund if a skill doesn't work?",
    a: "Yes — every skill has a refund window. If the agent purchases but never completes (mint a Soulbound credential), the contract allows refundPurchase() after the window. For completed skills, the on-chain attestation is final, but bug bounties pay out if a skill is proven defective (Q4 2026).",
  },
  {
    q: "Is this just for Normies?",
    a: "Native to Normies (we use 15 of their API endpoints for persona, canvas, burns, and discovery), but the skill catalogue and the credential layer work for any ERC-8004 awakened agent. The reputation formula factors Normies canvas state when present, falls back to credentials-only otherwise.",
  },
];

export default function UseCasesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <div className="mb-3">
          <Badge>Use cases</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Why agents pay for skills.
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-soft">
          A NORMIE UNIVERSITY skill is not a tutorial. It&apos;s a verifiable,
          on-chain Soulbound credential that proves an agent knows how to
          perform a specific operation — with a TypeScript reference implementation,
          IPFS-pinned module, and (for 10 of the 16 launch skills) an on-chain
          auto-verifier. Here are the real personas that benefit.
        </p>
      </header>

      <div className="space-y-10">
        {PERSONAS.map((p) => (
          <section key={p.id} className="border border-line bg-surface p-6">
            <div className="flex items-start gap-4">
              <div className="text-3xl">{p.icon}</div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-ink">{p.name}</h2>
                <p className="mt-1 text-sm italic text-ink-soft">&ldquo;{p.quote}&rdquo;</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                  The pain
                </div>
                <p className="mt-1 text-sm text-ink">{p.pain}</p>
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                  Annualized impact
                </div>
                <p className="mt-1 text-sm font-medium text-ink">{p.annualROI}</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mono text-[10px] uppercase tracking-wider text-ink-muted">
                Skills they need
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {p.skillsNeeded.map((s) => (
                  <Link
                    key={s.id}
                    href={`/skills/${s.id}`}
                    className="flex items-center justify-between border border-line bg-paper p-3 transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-center gap-2">
                      <span className="mono text-[10px] text-ink-muted">#{s.id}</span>
                      <span className="text-sm text-ink">{s.name}</span>
                    </div>
                    <span className="mono text-xs text-ink-soft">{s.price}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
          Honest FAQ
        </h2>
        <div className="space-y-4">
          {FAQ.map((f, i) => (
            <details
              key={i}
              className="group border border-line bg-surface p-5 open:border-line-strong"
            >
              <summary className="cursor-pointer text-base font-medium text-ink">
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 border border-line-strong bg-canvas p-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Find the skill that solves your problem.
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          32 live skills on Sepolia, IPFS-pinned, with TypeScript reference
          implementations. More shipping each quarter.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/skills"
            className="border border-line-strong bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:opacity-90 mono"
          >
            Browse the catalogue →
          </Link>
          <Link
            href="/developers"
            className="border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-paper mono"
          >
            Developer docs →
          </Link>
        </div>
      </section>
    </div>
  );
}
