# Skills Roadmap — what we ship, what we shipping next

Today: **36 skills live on Ethereum Sepolia** (mainnet-ready). All have real contract addresses, ABI fragments, TypeScript reference implementations, and IPFS-pinned Pinata modules. 18/36 carry on-chain auto-verification; the rest declare manual review with a 48h SLA upfront.

The first 16 covered foundational DeFi/NFT/identity operations. The second batch (17-36) added the high-demand verticals previously gathered as candidates: Aave health-factor, multi-protocol yield routing, Flashbots anti-MEV, Pendle, UniswapX, Hyperliquid funding-rate arb, EigenLayer restaking, Lido staking, Blur NFT bidding, Across bridging, Uniswap V3 LP rebalancing, Convex bribery harvest, multi-DAO Snapshot voting, token vesting claim, ENS subnames, Farcaster casting, ERC-7702 delegation, MCP server registration, EAS attestation, tax-loss harvesting.

This document also tracks the **next 23 skill candidates** sourced from continued agent-operator demand signals. Each skill is scored on three axes:

- **$$$** — willingness to pay (target USDC price)
- **🔥** — frequency of use (one-off vs daily)
- **🔧** — verification complexity (auto vs manual)

Skills are grouped into 4 tiers based on the implied annualized value to the agent owner. We ship in tier order: highest ROI first.

---

## 🥇 Tier S — high-stake automation (target $19.99-49.99)

These skills directly save or earn money for the agent owner. ROI is obvious in one event. Premium pricing justified.

| # | Skill | Why agents pay | Pain today | Verification |
|---|---|---|---|---|
| 17 | **Aave V3 / Morpho health-factor manager** | Auto-deleverage before liquidation. One avoided liquidation = $500-5000 saved | Custom bots or $30/mo SaaS (DeFiSaver) | Auto: read `HealthFactor`, assert > threshold post-tx |
| 18 | **Multi-protocol yield router (Aave/Compound/Morpho/Spark)** | 3-7% APY delta on $10k stable = $300-700/yr. Compounded daily | DefiLlama shows, doesn't execute | Auto: ERC-4626 share delta verification |
| 19 | **Anti-MEV bundling via Flashbots / MEV Blocker** | Avg sandwich loss 2-5% per public-mempool swap | Most users don't know it exists | Auto: tx targeted at `BlockBuilder` not public mempool |
| 20 | **Pendle PT/YT split + recombine** | Yield tokenization: 15-30% APY on stables via PT discount | UI confusing, agents skip it | Auto: verify SY → PT+YT mint via Pendle Router |
| 21 | **Cross-DEX best-execution (UniswapX / CoWSwap / 1inch Fusion)** | 0.1-1.5% better fill than direct swap | Users pay slippage they don't measure | Auto: compare actual vs spot at block.timestamp |
| 22 | **Hyperliquid funding-rate arb (perp + spot delta-neutral)** | 15-50% APR market-neutral when funding goes positive | Manual monitoring, 24/7 attention | Auto: assert `perpPosition + spotPosition ≈ 0` |
| 23 | **EigenLayer / Symbiotic restaking with slashing-aware allocation** | 4-12% extra APR on staked ETH | New, fragmented, risky if uninformed | Manual: AVS shortlist + risk scoring |
| 24 | **Multi-chain wallet sweeping (consolidate to L1 cold storage)** | Saves time + reduces attack surface | Bridge fees, fat-finger risk | Auto: balance assertions across N chains |

---

## 🥈 Tier A — high-frequency, mid-value (target $4.99-14.99)

Used weekly or daily. Cumulative value > $100/yr per agent. Sweet spot for the catalogue.

| # | Skill | Use case |
|---|---|---|
| 25 | **NFT floor monitor + auto-bid (Blur / OpenSea / Magic Eden)** | Floor-sweep at 0.95× spot, auto-list at 1.05× |
| 26 | **Mint sniping with priority gas + sybil resistance** | Public mints with bot competition |
| 27 | **Cross-chain bridge with best-rate routing (Hop / Across / Stargate / DLN)** | Daily op for multi-chain users |
| 28 | **Uniswap V3 LP single-tick rebalancing** | LP positions decay if price moves outside range |
| 29 | **Tornado / RAILGUN / Privacy Pools privacy hop (OFAC-screened)** | Privacy without sanctions risk |
| 30 | **ERC-7702 EOA→smart-account delegation setup** | Smart-account wave 2025; one-time per wallet |
| 31 | **Lido / Rocketpool / Frax stETH wrap optimizer** | Choose best peg/discount across LSTs |
| 32 | **Mev-Share order-flow auction submission** | Earn back MEV captured from your txs |
| 33 | **Account abstraction paymaster sponsorship orchestration** | UX-grade gasless flows for end-users |
| 34 | **Convex/Curve gauge vote bribery harvesting** | Recurring $50-500/wk for $CVX holders |

---

## 🥉 Tier B — low ticket, high volume (target $0.49-2.99)

Mass-market. Each skill is small but the volume is enormous. Aim for 1000+ acquisitions per skill.

| # | Skill | Use case |
|---|---|---|
| 35 | **Multi-DAO delegate voting (Snapshot + Tally + Agora)** | Vote on 20 DAOs in one batched tx |
| 36 | **Token vesting claim + reinvest (OP / ARB / ENA / IMX / ENS airdrops)** | Recurring monthly claim cycles |
| 37 | **ENS subname management (set/transfer/resolve)** | ~4M ENS holders |
| 38 | **Farcaster cast scheduling + auto-reply** | 100k+ active casters |
| 39 | **Polymarket position management** | Growing prediction market |
| 40 | **Multi-sig (Safe) tx proposal + execution** | Already shipped (skill #6) ✓ |
| 41 | **Chainlink Functions trigger + result attestation** | Off-chain compute on-chain |
| 42 | **Token-bound account (ERC-6551) creation + management** | NFT-tied wallets |
| 43 | **Permit2 batch approval management** | Reduce approval txs across protocols |
| 44 | **EAS attestation issuance** | Reputation primitives |

---

## 🎓 Tier Alpha — agent-native, new category (target $9.99-29.99)

Skills that don't exist anywhere because the agent category is too new. NORMIE UNIVERSITY can be the first to ship them.

| # | Skill | Why it matters |
|---|---|---|
| 45 | **MCP server registration + tool exposure** | Opens the agent to Claude / OpenAI / MCP ecosystem |
| 46 | **A2A protocol discovery + capability negotiation** | Agents pay each other for sub-tasks |
| 47 | **zkML inference attestation (EZKL / Modulus)** | Prove "the AI thought X" on-chain |
| 48 | **Verifiable LLM call via Galadriel / Ritual** | Output of LLM with cryptographic proof |
| 49 | **Cross-chain reputation aggregation (CCIP-broadcast EAS)** | Portable agent reputation |
| 50 | **Agent escrow + dispute resolution (ERC-8183)** | Required for paid-task economy |
| 51 | **Auto-DCA into / out of position** | Set-and-forget weekly buys |
| 52 | **Allowlist/whitelist enrollment automation** | Get on lists without manual signups |
| 53 | **Onchain identity reveal/proof (ZK-passport, World ID, Polygon ID)** | Selective disclosure |
| 54 | **Block-builder bribe optimization** | Maximize MEV capture for stakers |
| 55 | **Tax-loss harvesting + cost-basis tracking** | $300-1000 saved at tax season |
| 56 | **Compliance / OFAC pre-flight check** | Avoid sanctions automatically |

---

## How priorities are set

Demand signal is collected from:

1. **`/skills/request` form** (planned for v1.1 — community proposes + upvotes)
2. **Discord polls** in the Normies community
3. **On-chain query patterns** observed in our own AgentRegistry
4. **Stripe analytics** once mainnet payments are live

We ship the next 4 skills every quarter, prioritizing whichever tier has the highest cumulative demand × revenue projection.

## Pricing principles

- **Tier S** prices are anchored to 0.5-1 month of equivalent SaaS (DeFiSaver = $30/mo, so a one-time skill is $19.99-49.99)
- **Tier A** prices to 1-5% of a single use's value (a $500 bridge → $5 skill)
- **Tier B** prices to "below decision threshold" — < $3 = no question asked
- **Tier Alpha** prices premium because no alternative exists

All prices in USDC. Paid via x402 gasless. Credentials are Soulbound (non-transferable, non-revocable except admin-burn).

## Quality assurance (see also: README "Honest gaps")

Every skill ships with:
- Canonical contract address(es) for the target chain
- ABI fragment with function selectors
- 3+ end-to-end test cases on mainnet fork (post v1.1)
- Verifier definition: auto-on-chain | manual-48h | hybrid
- Reference TypeScript implementation in `/skill-modules/`
- Risk parameter documentation (slippage caps, deadline, etc.)

After v1.1, weekly mainnet-fork CI re-validates every skill against current state. Skills that fail are auto-deactivated and the catalogue page surfaces a `⚠ requires re-verification` badge.

---

*Last updated: 2026-05-18. Maintained alongside `/skill-modules/*.json`.*
