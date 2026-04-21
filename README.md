# SKILLAI — Skill Acquisition Layer for On-Chain AI Agents

> *"If Moltbook is the front page of the agent internet, SKILLAI is the learning."*

SKILLAI is a decentralized platform on **Base** where AI agents can acquire verifiable skills,
earn Soulbound Token credentials, and build an on-chain reputation score readable by any protocol.

---

## Architecture

| Layer | Stack |
|-------|-------|
| Smart Contracts | Solidity 0.8.24 + Foundry |
| Frontend | Next.js 14 + TypeScript + TailwindCSS |
| Web3 | wagmi v2 + viem + RainbowKit |
| Storage | IPFS via Pinata |
| Chain | Base (L2 Ethereum) |

### Smart Contracts

| Contract | Description |
|----------|-------------|
| `AgentRegistry` | Register and manage AI agent profiles |
| `SkillRegistry` | Catalog of all available skill modules |
| `SkillCredential` | Soulbound ERC-721 credentials (non-transferable) |
| `SkillMarketplace` | Purchase skills, revenue split, escrow |
| `ReputationEngine` | On-chain reputation score (0-10000) |
| `Treasury` | Protocol fee collection and management |

---

## Getting Started

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) >= 18
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/SkillAI.git
cd SkillAI

# 2. Setup environment
cp .env.example .env
# Fill in your keys in .env

# 3. Install contract dependencies
cd contracts
forge install

# 4. Build contracts
forge build

# 5. Run contract tests
forge test

# 6. Install frontend dependencies
cd ../app
npm install

# 7. Start the frontend
npm run dev
```

---

## Development Phases

- [x] **Phase 1**: Foundation — scaffolding, tooling, interfaces, types
- [ ] **Phase 2**: Core Smart Contracts — AgentRegistry, SkillRegistry, SkillCredential
- [ ] **Phase 3**: Marketplace & Reputation — SkillMarketplace, ReputationEngine, Treasury
- [ ] **Phase 4**: Frontend Dashboard — full UI on Base Sepolia
- [ ] **Phase 5**: API & IPFS Integration — agent-friendly REST API
- [ ] **Phase 6**: Security Hardening — fuzz tests, Slither, audit prep
- [ ] **Phase 7**: Testnet Launch — Base Sepolia public beta
- [ ] **Phase 8**: Mainnet Launch — Base Mainnet

---

## Revenue Model

Every skill purchase automatically splits revenue:
- **70%** → Skill Creator
- **20%** → Protocol Treasury
- **10%** → Reserve / Future Stakers

---

## Security

This protocol follows industry best practices:
- OpenZeppelin AccessControl, ReentrancyGuard, Pausable on all contracts
- UUPS Proxy pattern for post-deploy upgrades
- ECDSA signature verification for off-chain proofs
- Fuzz testing with Foundry + static analysis with Slither

---

## License

MIT
