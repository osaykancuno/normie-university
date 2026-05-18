# NORMIE UNIVERSITY — the agent academy for living NFTs

> Built for the [Normies hackathon](https://hackathon.normies.art). 100% Normies-native, ERC-8004 + Adapter8004 aware, deployed on Ethereum L1.

**One-line pitch**: every awakened Normie can buy verifiable skill modules in USDC (gasless x402), earn Soulbound credentials, and build composable on-chain reputation. NORMIE UNIVERSITY turns a static 40×40 pixel identity into an operationally-useful agent.

> ## ⚠️ Demo / Testnet disclosure
>
> This is the **hackathon demo build**. It runs on **Ethereum Sepolia testnet** (chainId 11155111) with **test USDC** from the Circle faucet — no real funds change hands and no agent is at financial risk. The header carries a permanent `TESTNET` ribbon while the demo is in this mode.
>
> The deployer / admin / verifier / relayer roles on Sepolia are held by a single **testnet-only key** generated for this hackathon, never funded with real ETH and treated as public. The key only controls demo contracts; rotating it does not affect future mainnet deployments.
>
> **Going to mainnet** (Ethereum L1, real USDC) requires a fresh deploy with a separate, secured admin multisig and an audited skill module pass. See "Trust model" below for the planned QA pipeline.

- 🌐 **Live demo**: **https://normie-university.vercel.app** (Ethereum Sepolia)
- 📦 **Repo**: https://github.com/osaykancuno/normie-university
- 🧠 **Pre-school**: try a Normie persona **without awakening**
- 🔍 **Awakened agents directory**: searchable, filterable index 
- 🤖 **A2A manifest**: [/.well-known/agent.json](https://normie-university.vercel.app/.well-known/agent.json)

---

## What we built FOR Normies, specifically

| Feature | Normies API used | Why it matters |
|---------|------------------|----------------|
| **Pre-school persona preview** | `/agents/persona-preview/{id}` | See your Normie's agent identity BEFORE awakening. Drives top-of-funnel for normies.art/lab. |
| **Live persona renderer** | `/agents/info/{id}` | Pulls the deterministic 8-layer persona (name + tagline + personality + greeting + canvas-aware backstory) and renders it as the agent's profile. |
| **A2A Agent Card extension** | `/agents/agent-card/{id}` + our skill credentials | We publish an enriched Agent Card at `/api/agent-card/{tokenId}` that includes NORMIE UNIVERSITY credentials — discoverable by any A2A peer. |
| **Awakened directory** | `/holders/{address}`, `/agents/binding/{id}`, `/agents/info/{id}` | Searchable index of awakened Normies filterable by type / level / customized state. A directory the rest of the hackathon community can use. |
| **Canvas-aware reputation** | `/normie/{id}/canvas/info`, `/canvas/diff`, `/history/normie/{id}/versions` | Live transformation feed. Surfaces "your Normie just transformed" with diff visualization. |
| **Burn lineage → reputation** | `/history/burns/receiver/{id}` | Burn-derived Action Points feed our composite reputation formula `√((canvasAP + burnAP) × credentials) × 10`. |
| **Pixel avatar everywhere** | `/normie/{id}/image.svg` | Agent profile, dashboard, leaderboard — every face is the canonical Normie pixel art. |
| **Persona-tailored curriculum** | `/agents/info/{id}` → traits → recommendation engine | "Pixel-born philosopher (Human/Peaceful/Nerd-Glasses) → ZK Proof Verification" — recommendations actually derived from the persona. |
| **Welcome-gift gating** | `/holders/{address}` ownership check | Sponsored first skill, free, gated to Normie holders only. |

**15 Normies API endpoints consumed**, **6 of them feed user-facing features**.

---

## How an agent uses NORMIE UNIVERSITY (end-to-end)

1. **Pre-school preview** — visit `/preview/4354` to see the persona and curriculum, no wallet needed.
2. **Awaken** — go to [normies.art/lab](https://normies.art/lab), bind via Adapter8004.
3. **Sign in** to NORMIE UNIVERSITY — RainbowKit connects, the dashboard greets you by persona name.
4. **Browse curriculum** — 36 skill modules, persona-tailored recommendations, 6 learning paths at 35% bundle discount.
5. **Buy a skill** — gasless via x402 + EIP-3009 USDC. Server relays gas; you sign once.
6. **Complete** — submit a proof tx hash; the auto-verifier (18/36 skills) signs an EIP-712 attestation.
7. **(Optional) Mint on-chain** — call `SkillCredential.mintFromAttestation()` for permanent SBT (~$5-15 gas). Most users skip this; the attestation is enough for A2A discovery.
8. **Discoverable** — your Agent Card now lists the credential. Any other A2A agent can find you with your new skill.

---

## Architecture

```
contracts/        Solidity 0.8.24 · Foundry · 189 tests passing
  ├── core/            AgentRegistry, SkillRegistry (CREATOR_ROLE gated), SkillCredential (lazy mint EIP-712)
  ├── marketplace/     SkillMarketplace (x402, sponsorFirstSkill, completeSkillFor), PathRegistry, CrossChainReceiver
  ├── reputation/      ReputationEngine, ValidationRegistry
  ├── treasury/        Treasury (Aave V3 yield optional)
  └── libraries/       SkillTypes (shared structs, errors)

app/              Next.js 16 · App Router · 40 routes
  ├── app/             Landing, /skills, /paths, /preview, /agents, /dashboard, /community/normies, /developers
  ├── app/api/         x402 endpoints, agent-card, attestation, onboarding, normies proxies
  ├── components/      PersonaCard, NormieAvatar, TraitRecommendations, OnboardingWizard
  └── lib/server/      normies.ts (cached API client), verifier.ts (10 auto rules + 6 manual SLA)

sdk/              @skillai/sdk · agent-friendly TypeScript SDK
skill-modules/    16 JSON specs · ABI fragments, viem reference implementations, verification rules
scripts/          seed-skills.ts, smoke-test.ts
docs/             api.md, security.md, deploy.md, skill-module-spec.md
```

## Cost model on L1

Skill purchase: **0 gas for the user** (x402 + EIP-3009 USDC + relayer pays gas, ~$3 per relay).
Credential mint: **0 gas by default** (server-signed EIP-712 attestation).
On-chain commit (optional): **~$5-15 gas, user pays** if they want a permanent SBT.

Pricing tiers:
- Beginner $0.49 · Intermediate $2.99 · Advanced $9.99 · Expert $24.99
- Learning Paths: **-35% bundle discount**, atomic 1-tx purchase

---

## Quick start (local)

```bash
git clone <repo>
cd SkillAI/app
cp .env.example .env.local       # WalletConnect projectId provided, set RPC_URL
npm install
npm run dev                       # http://localhost:3000
```

In demo mode (no contracts deployed yet) you'll see 15 mock skills + 5 paths + a demo leaderboard. Connect a wallet that owns a Normie on Ethereum mainnet and you'll get persona-aware UI.

## Deploy to Ethereum Sepolia

```bash
cd contracts
cp .env.example .env              # fill PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY
forge script script/Deploy.s.sol:Deploy --rpc-url sepolia --broadcast --verify
# → paste deployments/11155111.env into app/.env.local
cd .. && npx tsx scripts/seed-skills.ts
npx tsx scripts/smoke-test.ts
```

Full runbook: [`docs/deploy.md`](./docs/deploy.md).

---

## Tech inventory

- **Standards**: ERC-721, ERC-2981 (royalty), ERC-2612 (permit), EIP-3009 (transferWithAuthorization / x402), ERC-8004 (trustless agents), ERC-8217 (agent NFT binding), EIP-712, EIP-191, A2A
- **Frontend**: Next.js 16 + wagmi 3 + viem 2 + RainbowKit 2 + Tailwind v4
- **Contracts**: Solidity 0.8.24 + Foundry · viaIR · 189 unit + 5 invariant tests · OpenZeppelin v5
- **Chain**: Ethereum L1 (Sepolia testnet, Mainnet production)
- **APIs consumed**: 15 endpoints from api.normies.art (holders, traits, image, agents/info, agents/binding, agents/agent-card, agents/persona-preview, agents/count, agents/list, canvas/info, canvas/diff, history/burns/receiver, history/normie/versions, history/stats, normie/owner)

---

## Trust model — what we guarantee and what we don't

A skill marketplace is only useful if the skills actually work in mainnet. We have FOUR layers of quality assurance today, and THREE honest gaps we're transparent about. Both grow the credibility — the second more than the first.

### What we guarantee today

| Layer | Coverage | What it proves |
|---|---|---|
| **1. Canonical contract addresses** | 36/36 skills | Skill module declares the exact mainnet address, ABI fragment, and function selector. Verifiable against published protocol deployment docs. |
| **2. Auto-verifier on-chain** | 18/36 skills | After a user submits a completion tx, our verifier reads the tx, asserts the function call targeted the declared contract with matching selector + post-state delta. Issues an EIP-712 attestation on pass. |
| **3. Manual review SLA** | 18/36 skills (complex) | Skills like zk-proof verification and MEV protection are reviewed within 48h by the team. Declared upfront in the skill module. |
| **4. TypeScript reference impl** | 36/36 skills | Every `/skill-modules/N.json` ships an `executable.steps` array that's runnable as TypeScript. Agents can `import` and call directly. |

### Honest gaps (and the fix-by-quarter roadmap)

We declare these openly because hiding them would hurt credibility more than acknowledging them.

| Gap | Status today | Fix |
|---|---|---|
| **No mainnet-fork CI** | Skills work because we hand-tested them on mainnet during development. But if Uniswap V3 deprecates tomorrow, our skill #1 breaks silently. | **Q3 2026**: Foundry weekly fork-test runs against canonical mainnet state. Failing skills auto-deactivate; catalogue shows `⚠ requires re-verification` badge. |
| **No skill correctness audit** | Auto-verifier confirms a tx was executed, not that the skill DESIGN is optimal (e.g., we could ship slippage 5% when 0.5% is right). | **Q3 2026**: skill-completion ratings (1-5 stars) collected from agents post-completion. Aggregate score becomes a public badge. Q4: external bounty for proven-broken skills ($200-2000 paid in USDC from treasury). |
| **No third-party trust oracle** | Only NORMIE UNIVERSITY's internal review process today. No external attestation. | **Q1 2027**: Sherlock / Spearbit-style audit competition on the top-10 highest-revenue skills. Audit reports published in `/audits/`. |

### Why this matters for agents

When an autonomous agent buys a skill, it's trusting that the credential maps to a real, executable on-chain operation. If we lie or drift, agents waste gas, lose funds, or get stuck. The trust loop must include: **declaration → verification → continuous re-validation → community signal**. Layers 1-4 give us today's loop; the three quarterly milestones close the long-tail risk.

---

## Roadmap (post-hackathon)

- **NFT-bound credentials via ERC-6551** — v1 anchors Soulbound credentials to the **purchasing wallet** (immutable on-chain). v2 will mint to each Normie's ERC-6551 token-bound account so credentials transparently follow the NFT on sale/transfer. Until then, wallet-bound is intentional: it preserves "I earned this" semantics and protects against reputation hijacking via cheap NFT flips. Read the design note in `contracts/src/core/SkillCredential.sol`.
- **Skill catalogue expansion** — ship 4 new skills per quarter, prioritized by community demand signal (yield routing, anti-MEV, Pendle, Aave health-factor, MCP/A2A, zkML). The first 20 candidates have been audited and 4 of them have shipped in the v1 batch (#37-40).
- **MCP** — each Normie exposes its acquired skills as callable MCP tools (when Normies ships MCP endpoints)
- **ERC-8183** — Normies hired for tasks, paid into their agent wallet, NORMIE UNIVERSITY credentials become reputation
- **UGC v2** — open the catalogue to community creators with $200 bond + curated review
- **Subscription tier** — $4.99/mo Class Pass for unlimited Beginner skills
- **Trust infrastructure (Q3 2026 - Q1 2027)** — see "Trust model" above for the three concrete milestones closing today's honest gaps.

---

## Submission

- **Hackathon**: [hackathon.normies.art](https://hackathon.normies.art/)
- **Category**: AI / Agent
- **License**: MIT — see [`LICENSE`](./LICENSE)
- **Built by**: [@OsayKancuno](https://x.com/OsayKancuno) + AI co-pilot (see commit history)

Special thanks to [@nxt3d](https://x.com/nxt3d) for ERC-8217 + Adapter8004 making this whole flow possible, and to the Normies team for shipping an API that's actually agent-friendly.
