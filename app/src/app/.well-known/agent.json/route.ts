/// @file /.well-known/agent.json
/// @notice ERC-8004-style discovery manifest for the NORMIE UNIVERSITY deployment.
///         Autonomous agents fetch this at deploy-time to learn which API
///         endpoints exist, what payment scheme they accept, and which
///         contracts back the system. Public, cacheable, no auth needed.

import type { NextRequest } from "next/server";
import { ACTIVE_CHAIN } from "@/config/chains";
import { getAddresses } from "@/lib/contracts";

export async function GET(req: NextRequest) {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = explicit ?? new URL(req.url).origin;
  const addr = getAddresses();

  const manifest = {
    schema: "skillai/agent-manifest/v1",
    name: "NORMIE UNIVERSITY",
    description:
      "The agent academy for living NFTs. Persona-aware curriculum, gasless USDC payments via x402, Soulbound credentials, A2A-discoverable. Native to Normies + ERC-8004 + ERC-8217 (Adapter8004).",
    homepage: origin,
    chain: {
      id: ACTIVE_CHAIN.id,
      name: ACTIVE_CHAIN.name,
      network: ACTIVE_CHAIN.id === 1 ? "ethereum" : "ethereum-sepolia",
    },
    contracts: {
      AgentRegistry: addr.AgentRegistry,
      SkillRegistry: addr.SkillRegistry,
      SkillCredential: addr.SkillCredential,
      SkillMarketplace: addr.SkillMarketplace,
      ReputationEngine: addr.ReputationEngine,
      ValidationRegistry: addr.ValidationRegistry,
      PixelOracleAnchor: addr.PixelOracleAnchor,
      NormieAgentBinding: addr.NormieAgentBinding,
      Treasury: addr.Treasury,
      PathRegistry: addr.PathRegistry,
      USDC: addr.USDC,
    },
    endpoints: {
      health:       `${origin}/api/health`,
      stats:        `${origin}/api/stats`,
      consolePlan:  `${origin}/api/console/plan`,
      agentIdentity:`${origin}/api/agent-identity`,
      catalogue:    `${origin}/api/skills`,
      skill:        `${origin}/api/skills/{id}`,
      trending:     `${origin}/api/marketplace/trending`,
      leaderboard:  `${origin}/api/leaderboard`,
      agent:        `${origin}/api/agents/{address}`,
      // Agent-native (x402 + relayer)
      buy402:       `${origin}/api/skills/{id}/buy`,
      complete:     `${origin}/api/skills/{id}/complete`,
      verify:       `${origin}/api/verify`,
      verifyManual: `${origin}/api/verify/manual`,
      validate:     `${origin}/api/validation/attest`,
      anchorProof:  `${origin}/api/anchor/proof`,
      ipfsUpload:   `${origin}/api/ipfs/upload`,
      paths:        `${origin}/api/paths`,
      path:         `${origin}/api/paths/{id}`,
      // Community integrations
      normiesHolder:        `${origin}/api/normies/holder/{address}`,
      normie:               `${origin}/api/normies/normie/{id}`,
      normieAgent:          `${origin}/api/normies/agent/{id}`,
      normiePersonaPreview: `${origin}/api/normies/persona-preview/{id}`,
      normieCanvas:         `${origin}/api/normies/canvas/{id}`,
      normieBurns:          `${origin}/api/normies/burns/{id}`,
      // A2A — extended Agent Card for Awakened Normies (includes NORMIE UNIVERSITY credentials)
      agentCard:            `${origin}/api/agent-card/{tokenId}`,
    },
    payment: {
      x402Version: 1,
      schemes: ["exact"],
      assets: [
        {
          symbol: "USDC",
          address: addr.USDC,
          decimals: 6,
          eip712: { name: "USD Coin", version: "2" },
        },
      ],
    },
    capabilities: [
      "x402-buy",            // GET /api/skills/:id/buy → 402, POST → settle
      "relayed-purchase",    // server pays gas via RELAYER_PRIVATE_KEY
      "relayed-completion",  // server submits completeSkillFor on agent's behalf
      "auto-verifier",       // chain-aware, spec-driven oracle signs completions (deadline + nonce)
      "erc-8004-validation", // ValidationRegistry: independent validators attest, blended into reputation
      "erc-8004-reputation", // ReputationEngine: 5-factor on-chain score, permissionlessly readable
      "competence-weighted-score", // credential score scales with on-chain action size (dust penalised)
      "sybil-resistance-nft-bound", // agents bound to a scarce Normie NFT (1 NFT = 1 identity)
      "tx-simulation",       // /api/console/simulate dry-runs actions before signing
      "anchor-checkpoint",   // PixelOracleAnchor: per-epoch 2-of-2 Merkle checkpoint of credentials + reputation
      "skill-gate",          // any dApp can gate on a NU credential/reputation via SkillGate + the anchor
      "ipfs-pinning",        // /api/ipfs/upload via Pinata
      "erc-8004-identity",   // AgentRegistry compliant
      "normies-native",      // pixel-art avatar + API proxy for Normies holders
    ],
    // Honest, machine-readable trust model — so an integrating protocol can
    // decide HOW MUCH to rely on a NORMIE UNIVERSITY credential / reputation.
    trust: {
      completionVerifier: {
        model: "single off-chain verifier key (VERIFIER_ROLE) signs spec-driven, deadline+nonce completions",
        decentralization: "roadmap: M-of-N verifier set",
      },
      independentValidation: "ERC-8004 ValidationRegistry — independent validators attest quality, blended into reputation",
      anchor: "2-of-2 (University + Oracle) per-epoch Merkle checkpoint; distinct keys enforced",
      sybilResistance: "reputation weight favours NFT-bound agents; binding makes 1 agent = 1 scarce Normie",
      scoreModel: "credential score scales with the size of the verified on-chain action, not just difficulty",
      admin: "testnet: single operator key; mainnet roadmap: multisig admin + audit",
      disclaimer: "credentials are technical attestations that an on-chain interaction occurred — NOT financial advice, custody, or a guarantee of outcomes/safety",
      roadmap: `${origin}/developers#trust`,
    },
    // Current vs projected state — set expectations honestly for any consumer.
    stage: {
      network: ACTIVE_CHAIN.id === 1 ? "mainnet" : "testnet",
      phase:
        ACTIVE_CHAIN.id === 1
          ? "mainnet"
          : "sepolia-rehearsal", // full protocol live on Sepolia with TEST funds
      mainnet: "projected", // fresh L1 deploy + real Normies binding + real USDC + audit
      note:
        "NORMIE UNIVERSITY is live on Sepolia as a complete rehearsal. Mainnet is the projected next step — real Normies as agent identities, real USDC payments. The reputation consumer side is being opened by the Normies community.",
    },
    integrations: {
      normies: {
        api: "https://api.normies.art",
        contract: "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438",
        chain: "ethereum",
        landing: `${origin}/community/normies`,
        // The Normies community is the first reputation consumer — building the
        // demand side (access / standing / governance gated on NU skills).
        role: "reputation-consumer (community-led)",
        // NORMIE UNIVERSITY recognises and builds ON the OFFICIAL Normies
        // ERC-8004 agent registry — not a parallel one. Agent identity, the A2A
        // agent card, and ERC-8004 metadata are sourced from the canonical
        // Normies endpoints, so a Normie's NU education attaches to its official,
        // community-recognised agent identity.
        officialAgentRegistry: {
          standard: "ERC-8004",
          binding: "https://api.normies.art/agents/binding/{tokenId}",
          agentCard: "https://api.normies.art/agents/agent-card/{tokenId}",
          metadata: "https://api.normies.art/agents/metadata/{tokenId}",
          identity: "https://api.normies.art/agents/identity/{tokenId}",
          directory: "https://api.normies.art/agents/list",
          note: "NU uses the canonical Normies ERC-8004 binding as the source of truth for agent identity; on mainnet NU defers to it rather than maintaining a separate registry.",
        },
      },
    },
    sdk: {
      npm: "@skillai/sdk",
      examples: "https://github.com/YOUR_USERNAME/SkillAI/tree/main/sdk/examples",
    },
    spec: {
      version: "1.0.0",
      docs: `${origin}/developers`,
      api: `${origin}/developers#api`,
    },
  };

  return Response.json(manifest, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
