# NORMIE UNIVERSITY — the agent academy for living NFTs

> Built for the [Normies hackathon](https://hackathon.normies.art). 100% Normies-native, ERC-8004 + Adapter8004 aware, deployed on Ethereum L1.

**One-line pitch**: every awakened Normie can buy verifiable skill modules in USDC (gasless x402), earn Soulbound credentials, and build composable on-chain reputation. NORMIE UNIVERSITY turns a static 40×40 pixel identity into an operationally-useful agent.

- 🌐 **Live demo**: _populated after testnet deploy — see `docs/deploy.md`_
- 🎥 **2-min video walkthrough**: _populated after recording — script in `docs/demo-video.md`_
- 🧠 **Pre-school**: try a Normie persona **without awakening** → [/preview/4354](https://your-deployment/preview/4354)
- 🔍 **Awakened agents directory**: searchable, filterable index → [/agents](https://your-deployment/agents)

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

**11 Normies API endpoints consumed**, **6 of them feed user-facing features**.

---

## How an agent uses NORMIE UNIVERSITY (end-to-end)

1. **Pre-school preview** — visit `/preview/4354` to see the persona and curriculum, no wallet needed.
2. **Awaken** — go to [normies.art/lab](https://normies.art/lab), bind via Adapter8004.
3. **Sign in** to NORMIE UNIVERSITY — RainbowKit connects, the dashboard greets you by persona name.
4. **Browse curriculum** — 16 skill modules, persona-tailored recommendations, 6 learning paths at 35% bundle discount.
5. **Buy a skill** — gasless via x402 + EIP-3009 USDC. Server relays gas; you sign once.
6. **Complete** — submit a proof tx hash; the auto-verifier (10/16 skills) signs an EIP-712 attestation.
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
- **APIs consumed**: 11 endpoints from api.normies.art

---

## Roadmap (post-hackathon)

- **MCP** — each Normie exposes its acquired skills as callable MCP tools (when Normies ships MCP endpoints)
- **ERC-8183** — Normies hired for tasks, paid into their agent wallet, NORMIE UNIVERSITY credentials become reputation
- **UGC v2** — open the catalogue to community creators with $200 bond + curated review
- **Subscription tier** — $4.99/mo Class Pass for unlimited Beginner skills

---

## Submission

- **Hackathon**: [hackathon.normies.art](https://hackathon.normies.art/)
- **License**: MIT
- **Built by**: solo + AI co-pilot (see commit history)

Special thanks to [@nxt3d](https://x.com/nxt3d) for ERC-8217 + Adapter8004 making this whole flow possible, and to the Normies team for shipping an API that's actually agent-friendly.
