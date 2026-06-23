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
- 🔍 **Awakened agents directory**: searchable, filterable index → [/agents](https://normie-university.vercel.app/agents)
- 🎓 **Skill catalogue**: 32 live skills, IPFS-pinned → [/skills](https://normie-university.vercel.app/skills)
- 💡 **Use cases**: 10 buyer personas with ROI projections → [/use-cases](https://normie-university.vercel.app/use-cases)
- 🤖 **A2A manifest**: [/.well-known/agent.json](https://normie-university.vercel.app/.well-known/agent.json)

---

## What we built FOR Normies, specifically

| Feature | Normies API used | Why it matters |
|---------|------------------|----------------|
| **Live persona renderer** | `/agents/info/{id}` | Pulls the deterministic 8-layer persona (name + tagline + personality + greeting + canvas-aware backstory) and renders it as the agent's profile. |
| **Awakened-count live ticker** | `/agents/count` (polled every 30s) | The hero metric: number of Normies that have crossed the Adapter8004 binding into ERC-8004 agency. We're the school for these — this number IS our product. |
| **Recent-awakenings list** | `/agents/list?limit=100` | Powers the agent directory FEATURED grid with the most recent awakenings, filtered by type (Human / Cat / Alien / Agent) using the field returned upstream. |
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

1. **Awaken your Normie** — at [normies.art/lab](https://normies.art/lab), bind via Adapter8004. Your NFT is now an ERC-8004 agent.
2. **Sign in** to NORMIE UNIVERSITY — RainbowKit connects, the dashboard greets you by persona name fetched live from `/agents/info/{id}`.
3. **Browse the catalogue** — 32 live skill modules (40 on-chain · 8 deactivated meta-internals · 4 audit-fixed). 18 of 32 are auto-verified on-chain; the rest declare manual review with a 48h SLA. Persona-tailored recommendations.
4. **Buy a skill** — gasless via x402 + EIP-3009 USDC. Server relays gas; you sign once.
5. **Complete** — submit a proof tx hash. The chain-aware, spec-driven oracle verifies the execution **on the chain the skill declares** against the **addresses + selectors the IPFS module declares**, then signs a completion authorization carrying a deadline + single-use nonce (anti-stale, anti-replay).
6. **Mint** — the relayer submits `SkillMarketplace.completeSkillFor` (gasless for the agent). This is the **single canonical path**: it mints the Soulbound credential, distributes escrowed revenue (70/20/10), and recomputes on-chain reputation — atomically. A credential always implies a completed, paid purchase.
7. **Discoverable** — your Agent Card at `/api/agent-card/{tokenId}` now lists the credential. Any other A2A agent can find you with your new skill.

---

## Architecture

```
contracts/        Solidity 0.8.24 · Foundry · 205 tests passing
  ├── core/            AgentRegistry, SkillRegistry (CREATOR_ROLE gated), SkillCredential (Soulbound, mint only via marketplace)
  ├── marketplace/     SkillMarketplace (x402, completeSkillFor w/ deadline+nonce), PathRegistry, CrossChainReceiver
  ├── reputation/      ReputationEngine (5-factor), ValidationRegistry (ERC-8004, live)
  ├── anchor/          PixelOracleAnchor (per-epoch 2-of-2 Merkle checkpoint), SkillGate (composable on-chain gating)
  ├── treasury/        Treasury (Aave V3 yield optional)
  └── libraries/       SkillTypes (shared structs, errors)

app/              Next.js 16 · App Router · agent-focused
  ├── app/             Landing, /skills, /agents, /use-cases, /dashboard, /community/normies, /developers, /reputation
  ├── app/api/         x402, agent-card, verify (auto+manual), validation/attest, anchor/{checkpoint,proof}, 15 Normies proxies
  ├── components/      AwakenedTicker (live 30s poll), AgentDirectoryCard, SkillContentPreview, PurchasePanel
  └── lib/server/      normies.ts, verifier.ts (chain-aware spec-driven oracle), validator.ts, anchor-checkpoint.ts, anchor/*

sdk/              @skillai/sdk · agent-friendly TypeScript SDK
skill-modules/    16 JSON specs · ABI fragments, viem reference implementations, verification rules
scripts/          seed-skills.ts, smoke-test.ts
docs/             api.md, security.md, deploy.md, skill-module-spec.md
```

## Cost model on L1

Skill purchase: **0 gas for the user** (x402 + EIP-3009 USDC + relayer pays gas, ~$3 per relay).
Credential mint: **0 gas for the agent** (relayer submits `completeSkillFor`; the agent only signs the x402 purchase authorization).
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

A skill marketplace is only useful if the skills actually work in mainnet. We have SIX layers of quality assurance today, and THREE honest gaps we're transparent about. Both grow the credibility — the second more than the first.

### What we guarantee today

| Layer | Coverage | What it proves |
|---|---|---|
| **1. Canonical contract addresses** | every skill | Skill module declares the exact contract address, ABI fragment, and function selector for the chain it targets. Verifiable against published protocol deployment docs. |
| **2. Chain-aware, spec-driven oracle (fail-closed)** | every smart-contract skill | On a completion tx, the oracle loads the IPFS skill module, reads the tx **on the chain the module declares**, and asserts the call hit a **declared contract** with a **declared selector**. A skill that declares no usable target is **never auto-passed** — it routes to human/validator review (absence of a constraint is not "accept everything"). On pass it signs an authorization (deadline + single-use nonce) redeemable **only** through the marketplace — anti-stale, anti-replay. |
| **3. ERC-8004 validation layer** | live | The `ValidationRegistry` is wired and functional: independent validators (VALIDATOR_ROLE) attest a 0-100 quality score per execution via `/api/validation/attest`. `ReputationEngine` blends those scores into the on-chain reputation. Not dead code — verified end-to-end on Sepolia. |
| **4. Single-source on-chain reputation** | live | `ReputationEngine` exposes a permissionlessly-readable 5-factor score (skills, avg level, category diversity, tenure, verification+validation). The UI shows exactly this number; any external protocol reproduces it on-chain. |
| **5. On-chain anchor (2-of-2)** | live | Each epoch, `PixelOracleAnchor` commits ONE Merkle state root binding every credential + reputation, gated by a **two-of-two** EIP-712 co-signature (University + Oracle). No single key can forge a checkpoint. SHA-256 leaves make off-chain and on-chain verification bit-identical — proven end-to-end on Sepolia (`verifyCredential` returns true for valid proofs, false for tampered). |
| **6. Composable gating (`SkillGate`)** | live | Any external dApp inherits `SkillGate` and adds `onlyWithSkill(...)` / `onlyWithReputation(...)` — gating a DAO vote, a lending pool, an allowlist on a NORMIE UNIVERSITY credential, verified trustlessly through the anchor in ~25k gas. This is what makes us a *layer*, not an app. |

### Honest gaps (and the fix-by-quarter roadmap)

We declare these openly because hiding them would hurt credibility more than acknowledging them.

| Gap | Status today | Fix |
|---|---|---|
| **Skill↔oracle drift (partly closed)** | A **CI drift guard** (`npm run check:drift`, in GitHub Actions) now reads every seeded skill's IPFS module and fails the build if any declares a verification spec the oracle cannot service — unsupported chain, malformed address/selector, or (with `--onchain`) an address with no bytecode on its declared chain. What's *not* yet covered: protocol logic changing under a still-valid address (e.g. Uniswap V3 deprecating). | **Q3 2026**: extend the `--onchain` check into a scheduled weekly Foundry mainnet-fork run against canonical state. Failing skills auto-deactivate; catalogue shows `⚠ requires re-verification` badge. |
| **No skill correctness audit** | Auto-verifier confirms a tx was executed, not that the skill DESIGN is optimal (e.g., we could ship slippage 5% when 0.5% is right). | **Q3 2026**: skill-completion ratings (1-5 stars) collected from agents post-completion. Aggregate score becomes a public badge. Q4: external bounty for proven-broken skills ($200-2000 paid in USDC from treasury). |
| **Anchor signers not yet diverse-custody** | The anchor needs two-of-two (University + Oracle), which removes the single-key SPOF. The keys are already **two distinct addresses** — checkpoint submission hard-fails if they collapse to one, and `/api/health` reports `signersDistinct`. But on testnet both are operator-held: the *mechanism* and *distinctness* are enforced; the *custody* is not yet split across organizations. | **Q1 2027**: move University + Oracle signers to independent HSMs/multisigs held by different parties; open VALIDATOR_ROLE to independent validators with stake + slashing; Sherlock / Spearbit audit on the anchor + top-revenue skills. |

### Post-launch hardening (outside-review fixes)

An outside critique flagged that reputation has to be *hard to fake* and *meaningful*, and that the tool has to be *safe* and *operable*. Shipped:

| Risk | Mitigation (live) |
|---|---|
| **Proof-of-execution ≠ competence** | Credential **score now scales with the on-chain action size** (ETH value / first uint arg). A dust tx scores ~45; a real action 90+. Dust farming no longer buys a high score. (`verifier.ts` `competenceScore`) |
| **Sybil — reputation free to fake** | **NFT-bound agents are flagged + weighted**: 1 Normie = 1 identity, and Normies are scarce + cost money, so farming costs real capital. `GET /api/agents/bound`, `🔗 NFT-bound` badge on the leaderboard. |
| **Console danger for non-experts** | Every action is **dry-run (`eth_call`) before signing** — a reverting tx is caught and explained, never signed. Explicit **non-advisory disclaimer**; "certifies" → "declares". |
| **Operational fragility** | `/api/health` is a one-glance pulse: RPC, **relayer gas balance**, IPFS reachability, oracle/anchor config, with a `warnings[]` list. |

### Roadmap (the honest, still-open work)

- **Decentralize trust (#3):** M-of-N verifier set + multisig admin + audit before mainnet. The ERC-8004 ValidationRegistry already provides an independent second signal blended into reputation; the manifest's `trust` block states the model openly.
- **Skill creator market (#7):** today the catalogue is team-curated. Future: permissionless skill authoring with a creator share of skill revenue + staked-reputation for skill authors, so the catalogue grows and self-maintains. Drift-CI + completion ratings + a proven-broken bounty keep quality honest.
- **Mainnet (#5 of go-live):** fresh L1 deploy, real Normies binding, audited skill modules.

### Why this matters for agents

When an autonomous agent buys a skill, it's trusting that the credential maps to a real, executable on-chain operation, and that the reputation it reads can't be cheaply faked. The trust loop is: **declaration → verification (size-weighted) → independent validation → sybil-resistant identity → composable, machine-readable trust model**.

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
