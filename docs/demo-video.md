# Demo Video — 2 min walkthrough script

**Target length**: 2 minutes (120 sec). Loom / QuickTime recording, voice-over your own.

**Pre-recording checklist**:
- Browser zoom 100%
- Window 1440x900
- Dev server running on http://localhost:3000 (or live testnet URL)
- MetaMask connected to a wallet that holds a Normie on Ethereum mainnet
- Have these Normie token ids ready to type: **4354** (Zori, customized), **42**, **1337**
- Hard refresh once before recording to clear stale state

---

## Shot list with voice-over

### 🎬 0:00 – 0:10 — Hook (10s)
**Visual**: Landing page (`/`). Slow scroll showing hero "The agent academy for living NFTs".
**Voice-over**:
> "The Normies awakening just turned 10,000 NFTs into ERC-8004 agents. NORMIE UNIVERSITY is the academy where they pick up the skills to actually do something."

### 🎬 0:10 – 0:30 — Pre-school (20s)
**Visual**: Click "Pre-school" in nav → land on `/preview`. Type **4354** into the search box → enter.
**Voice-over**:
> "Before you awaken your Normie, you can preview the persona. Zero wallet, zero gas. The persona is generated deterministically from on-chain bytes."

**Visual**: `/preview/4354` loads. Pan over: pixel art, name "Zori", tagline "Pixel-born philosopher", 8 personality lines, recommended curriculum.
**Voice-over**:
> "Zori is a level-31 customized Human with peaceful expression and nerd glasses. NORMIE UNIVERSITY already knows what to teach this Normie."

### 🎬 0:30 – 0:50 — Awakened agents directory (20s)
**Visual**: Click "Agents" in nav → `/agents`. Show filter pills (Type / Level / Canvas). Toggle "Alien" filter. Show grid filtering live.
**Voice-over**:
> "Once awakened, every Normie shows up in the directory. Filter by trait, by level, by whether they've been transformed on the canvas. This is searchable infrastructure the whole hackathon community can build on."

**Visual**: Click on a featured agent card → land on `/agents/normie/{id}`. Show composite reputation, burn lineage feed, canvas diff.
**Voice-over**:
> "Each agent profile shows live canvas state, burn-derived action points, and the NORMIE UNIVERSITY credentials its holder has earned."

### 🎬 0:50 – 1:10 — Buy a skill (20s)
**Visual**: Back to nav → "Catalogue" → `/skills`. Click on skill #5 "ERC-8004 Agent Identity". Show the verification badge "✓ Auto-verified on-chain". Show the reference implementation snippet.
**Voice-over**:
> "Sixteen skill modules. Real ones — every one has the exact contract addresses, ABI fragments, and a TypeScript reference implementation. Ten are auto-verified on-chain. The rest declare manual review with SLA, upfront."

**Visual**: Click "Purchase" or "Claim welcome gift" if connected wallet holds a Normie.
**Voice-over**:
> "Skill purchase is gasless via x402 USDC. The server relays gas. The agent signs once."

### 🎬 1:10 – 1:30 — Complete + attestation (20s)
**Visual**: Quickly show `/api/skills/5/complete` flow conceptually. Or use a pre-prepared completion. Show toast "credential issued" + open `/dashboard` showing the SBT badge appear.
**Voice-over**:
> "Submit a proof transaction. The auto-verifier signs an EIP-712 attestation. The credential is yours — off-chain by default, on-chain when you want it for $5 in gas."

### 🎬 1:30 – 1:50 — A2A discoverability (20s)
**Visual**: Open `/api/agent-card/4354` in a new tab. Show the JSON with NORMIE UNIVERSITY credentials embedded.
**Voice-over**:
> "Every awakened Normie's Agent Card now includes its NORMIE UNIVERSITY credentials. Discoverable by any A2A-aware peer — when other agents look you up, they see what you've actually learned, not what you claim."

### 🎬 1:50 – 2:00 — Close (10s)
**Visual**: Back to `/` landing.
**Voice-over**:
> "NORMIE UNIVERSITY. The agent academy for living NFTs. Built on Ethereum L1, native to Normies. Try the pre-school at /preview, awaken at normies.art."

---

## Tips for recording

- Pause briefly on key UI elements so the viewer can read
- Don't move the cursor while voice-overing — stationary is fine
- Hide bookmark bar and personal stuff in browser
- Use full-screen mode (F11 in most browsers) for cleaner shots
- If a transition feels slow, **cut and resume** — Loom lets you stitch
- End by lingering 1-2s on the hero so the URL is readable

## Caption (for X/Twitter post when sharing)

```
NORMIE UNIVERSITY — the agent academy for living NFTs.

Built for the Normies hackathon. Every awakened Normie can:
→ preview their persona before awakening (no wallet)
→ buy verifiable skills in USDC, gasless via x402
→ earn Soulbound credentials, discoverable in A2A Agent Cards
→ show burn-lineage + canvas history in composite reputation

11 Normies API endpoints used. 16 skills. 6 paths. Ethereum L1.

Demo ↓
```

## Caption (for Discord submission)

```
Project: NORMIE UNIVERSITY — the agent academy for living NFTs
What it does: turns awakened Normies into operationally-useful agents by selling them verifiable skill modules in USDC. Credentials are EIP-712 attestations (free) or on-chain SBTs (optional gas).
Normies API usage: 11 endpoints — holders, traits, image, agents/info, agents/binding, agents/agent-card, agents/persona-preview, canvas/info, canvas/diff, history/burns/receiver, history/normie/versions
Demo URL: https://normie-university.vercel.app
Video: <fill after recording>
Repo: https://github.com/osaykancuno/normie-university
```
