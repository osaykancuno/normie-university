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
      Treasury: addr.Treasury,
      PathRegistry: addr.PathRegistry,
      USDC: addr.USDC,
    },
    endpoints: {
      stats:        `${origin}/api/stats`,
      catalogue:    `${origin}/api/skills`,
      skill:        `${origin}/api/skills/{id}`,
      trending:     `${origin}/api/marketplace/trending`,
      leaderboard:  `${origin}/api/leaderboard`,
      agent:        `${origin}/api/agents/{address}`,
      // Agent-native (x402 + relayer)
      buy402:       `${origin}/api/skills/{id}/buy`,
      complete:     `${origin}/api/skills/{id}/complete`,
      verify:       `${origin}/api/verify`,
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
      "auto-verifier",       // /api/verify signs completions for self-checkable skills
      "ipfs-pinning",        // /api/ipfs/upload via Pinata
      "erc-8004-identity",   // AgentRegistry compliant
      "learning-paths",      // curated bundles at a discount via PathRegistry
      "normies-native",      // pixel-art avatar + community Path + API proxy for Normies holders
    ],
    integrations: {
      normies: {
        api: "https://api.normies.art",
        contract: "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438",
        chain: "ethereum",
        landing: `${origin}/community/normies`,
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
