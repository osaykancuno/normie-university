# Hackathon Submission — copy-paste into the form at hackathon.normies.art

Form URL: https://hackathon.normies.art

> **Demo / testnet build.** Everything described below runs on Ethereum Sepolia
> with test USDC. The admin/deployer/verifier key on Sepolia is a single
> hackathon-only key, never funded with real ETH, treated as public.
> Mainnet release will be a separate deploy under a multisig — see the
> "Trust model" section in the README.

---

## Project Name

```
NORMIE UNIVERSITY
```

## Team / Builder Name

```
osaykancuno (solo)
```

## Email

```
osaykancuno@gmail.com
```

## Project Category

```
AI / Agent
```

> Reason: NORMIE UNIVERSITY is the skill-acquisition layer for Normies awakened as ERC-8004 agents. Persona-aware curriculum, on-chain Soulbound credentials, A2A-discoverable.

## Project Description (recommended max 800 chars)

```
NORMIE UNIVERSITY is the agent academy for living NFTs — the school where awakened Normies actually learn to do things.

Every awakened Normie (529 of 8,149 circulating today) can:
• Preview their persona before awakening — no wallet, no gas
• Buy verifiable skill modules in USDC, gasless via x402
• Earn Soulbound credentials, embedded in their A2A Agent Card
• Build composite reputation from canvas + burn lineage + skills

16 real skill modules deployed on-chain (Sepolia, mainnet-ready), each with canonical contract addresses, ABI fragments, IPFS-pinned via Pinata, TypeScript reference implementations. 10/16 carry auto-verification.

15 Normies API endpoints integrated. Live circulating supply (adjusts for ongoing burns). MIT licensed.
```

## Demo URL (required)

```
https://normie-university.vercel.app
```

**Quick judge tour** (3 clicks, no wallet needed):
1. `/preview/4354` — meet Zori, a Level 31 awakened Normie, persona generated from on-chain bytes
2. `/agents` — browse the live list of recently awakened agents (pulled from /agents/list)
3. `/skills/1` — see a real skill module: Uniswap V3 Swap, with on-chain auto-verification and IPFS-pinned content

## Source Code URL

```
https://github.com/osaykancuno/normie-university
```

## Twitter / X Handle

```
[your X handle here]
```

## License Confirmation

✅ Yes — MIT License. See [`LICENSE`](./LICENSE) file.

---

## Evidence map — answers to the 4 evaluation criteria

### 1. Creativity

- **Novel framing**: "school for awakened NFTs" turns Normies' agent identity from a static trait into an operational reputation graph
- **Pre-school flow**: persona preview without awakening — top-of-funnel for normies.art/lab discovery
- **Composite reputation**: `√((canvas AP + burn-derived AP) × earned credentials) × 10` — first formula that combines Normies-native gameplay (canvas, burns) with off-chain achievements (skills)
- **Agent-native pricing**: 4 tiers from $0.49 (Beginner) to $24.99 (Expert), all in USDC

### 2. Technical execution

- **9 smart contracts** deployed on Ethereum Sepolia (chainId 11155111) with full role-based access control
  - AgentRegistry, SkillRegistry, SkillCredential (Soulbound ERC-721), SkillMarketplace, ReputationEngine, ValidationRegistry, Treasury, PathRegistry, CrossChainReceiver
- **189 unit tests + 5 invariant tests** in Foundry · viaIR · OpenZeppelin v5
- **Standards implemented**: ERC-721 (Soulbound), ERC-2981 (royalty), ERC-2612 (permit), EIP-3009 (transferWithAuthorization / x402), ERC-8004 (trustless agents), ERC-8217 / Adapter8004 (agent NFT binding), EIP-712, EIP-191
- **x402 gasless purchase flow**: server relayer pays gas, agent signs once, EIP-712 attestation issued
- **Lazy-mint SBT**: attestation off-chain (free), on-chain commit only when holder wants permanent proof
- **Auto-verifier on-chain** for 10/16 skills via tx selector + state-delta assertions
- **IPFS pinning via Pinata** — every skill module pinned, CID immutable
- **Soulbound enforcement**: `transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll` all revert

### 3. Use of the Normies API

**15 endpoints integrated** (live, server-cached, rate-limit-proofed):

Core:
- `/normie/{id}/owner` · `/normie/{id}/traits` · `/normie/{id}/metadata` · `/normie/{id}/image.svg|png`
- `/holders/{address}`

Canvas:
- `/normie/{id}/canvas/info` · `/normie/{id}/canvas/diff`

Agents (Awakened):
- `/agents/info/{id}` · `/agents/binding/{id}` · `/agents/persona-preview/{id}` · `/agents/agent-card/{id}`
- `/agents/count` · `/agents/list`

History (live supply):
- `/history/stats` · `/history/burns/receiver/{id}` · `/history/normie/{id}/versions`

Real-time supply numbers everywhere — no hardcoded "10,000". Burn process correctly reflected: 8,149 circulating · 1,851 burned · 529 awakened (numbers update every 60s).

### 4. Overall polish

- **Live URL**: https://normie-university.vercel.app (Ethereum Sepolia, fully operational)
- **Visual consistency with Normies**: monochrome cream/charcoal palette, pixel-style mark, mono typography
- **E2E tested** in headless Chromium against production — 10/10 pass
- **Pre-school onboarding**: try without a wallet, no signup
- **A2A discovery**: `/.well-known/agent.json` manifest, plus extended Agent Card per Normie at `/api/agent-card/{tokenId}`
- **Documentation**: README, demo script (`docs/demo-video.md`), skills roadmap (`docs/skills-roadmap.md`), API docs, security docs, deploy runbook
- **Honest trust model**: README declares 4 QA layers + 3 honest gaps + fix-by-quarter roadmap (mainnet-fork CI Q3 2026, third-party audit Q1 2027)
- **39 future skills documented** in `docs/skills-roadmap.md`, tiered by ROI and pricing rationale

---

## What to mention to judges if they DM you

- **Run an E2E test yourself**: `cd app && npm i -D playwright && npx playwright install chromium && node e2e-test.mjs` — 10/10 pass in ~60s
- **Inspect on-chain state**: Sepolia explorer `https://sepolia.etherscan.io/address/0x4d3572C0D529c4F3162aAB928D4336461823B9e7` shows 16 skills with real IPFS CIDs
- **Verify Soulbound**: call `transferFrom` on SkillCredential `0x47473aBC1ccEdf08e1915467dD7e008Ef6512ed4` — it always reverts
- **A2A manifest** for any awakened Normie: `https://normie-university.vercel.app/api/agent-card/4354`
