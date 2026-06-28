/// @file NORMIE UNIVERSITY tools, expressed as ERC-8257 manifests.
///
/// These are the tools we register on OpenSea's Agent Tool Registry (Base). We
/// already had the primitives — x402 payments, on-chain gating (SkillGate), a
/// fail-closed verification oracle — so each tool here is a thin manifest over
/// machinery that already exists in this app.
///
/// Strategy notes:
///   - We register via @opensea/tool-sdk. The Normie-gated tool is registered
///     on ETHEREUM MAINNET with `--nft-gate <Normies>`, so OpenSea's canonical
///     ERC721OwnerPredicate gates DIRECTLY on real Normie ownership (no custom
///     predicate, no Base-side proxy). The manifest `access` block restates the
///     Normie holding as an ADVISORY hint (the on-chain predicate is canonical).
///   - First wave is FREE (amount "0") — still flows through the x402 protocol
///     so the listing is payment-ready, but zero friction for discovery.

import { encodeAbiParameters, parseAbiParameters } from "viem";

/// Public origin that hosts both the tools and their well-known manifests.
export const TOOL_ORIGIN = (
  process.env.NEXT_PUBLIC_TOOL_ORIGIN ?? "https://normie-university.vercel.app"
).replace(/\/+$/, "");

/// The wallet that will call `registerTool` on Base. MUST equal the on-chain
/// `creator`, and `pricing.recipient` resolves to it. Lowercased per ERC-8257.
export const CREATOR_ADDRESS = (
  process.env.ERC8257_CREATOR_ADDRESS ??
  "0x0000000000000000000000000000000000000000"
).toLowerCase() as `0x${string}`;

const REPO_URL = "https://github.com/osaykancuno/normie-university";

// Base mainnet (chainId 8453) — canonical USDC.
const BASE = 8453;
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
// Normies collection on Ethereum L1 — used only as an advisory access hint.
const NORMIES_L1 = "0x9eb6e2025b64f340691e424b7fe7022ffde12438";

/// Free pricing, still routed through x402 so the tool is payment-native.
function freeOnBase() {
  return [
    {
      amount: "0",
      asset: `eip155:${BASE}/erc20:${USDC_BASE}`,
      recipient: `eip155:${BASE}:${CREATOR_ADDRESS}`,
      protocol: "x402",
    },
  ];
}

/// ERC-8257 known requirement: IERC721Holding (interface id 0xbdf8c428),
/// data = abi.encode(address collection). Advisory only on Base.
function normieHoldingRequirement() {
  const data = encodeAbiParameters(parseAbiParameters("address"), [
    NORMIES_L1 as `0x${string}`,
  ]).toLowerCase();
  return {
    logic: "AND" as const,
    requirements: [
      {
        kind: "0xbdf8c428",
        data,
        label: "Hold an awakened Normie (skills follow the NFT)",
        links: { buy: "https://opensea.io/collection/normies" },
      },
    ],
  };
}

const SELF_ATTESTED_OPEN_SOURCE = {
  tier: "self-attested",
  execution: "standard",
  description:
    "Verification is a chain-aware, spec-driven, fail-closed oracle; credentials + reputation are anchored on-chain via 2-of-2 EIP-712 Merkle checkpoints. Source is public.",
  dataRetention: "metadata-only",
  sourceVisibility: "open-source",
  reproducibleBuild: { sourceCodeURI: REPO_URL },
};

const MANIFEST_TYPE =
  "https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1";

/// Build a manifest. NFC-normalizes every string so we never emit non-NFC
/// bytes (the canonicalizer also asserts this).
function manifest(slug: string, m: Record<string, unknown>) {
  return {
    type: MANIFEST_TYPE,
    creatorAddress: CREATOR_ADDRESS,
    endpoint: `${TOOL_ORIGIN}/api/tools/${slug}`,
    version: "1.0.0",
    // 1:1 icon (thumbnail) + 16:9 banner — featuredImage is required for the
    // opensea.io/tools homepage. Both served from the same origin as the manifest.
    image: `${TOOL_ORIGIN}/nu-tool-icon.svg`,
    featuredImage: `${TOOL_ORIGIN}/nu-tool-banner.svg`,
    ...m,
  };
}

/// All NU tools, keyed by slug (must match ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$).
export const TOOL_MANIFESTS: Record<string, Record<string, unknown>> = {
  "reputation-lookup": manifest("reputation-lookup", {
    name: "NORMIE UNIVERSITY — Agent Reputation Lookup",
    description:
      "Read an agent's trustless 5-factor reputation (skills, level, category diversity, tenure, verification) straight from the on-chain ReputationEngine. Open, read-only, free.",
    tags: ["ai", "security"],
    inputs: {
      type: "object",
      required: ["agent"],
      properties: {
        agent: {
          type: "string",
          description: "Agent identity address or Normie tokenId.",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        score: { type: "integer" },
        skills: { type: "integer" },
        avgLevel: { type: "number" },
        verified: { type: "boolean" },
      },
    },
    pricing: freeOnBase(),
    verifiability: SELF_ATTESTED_OPEN_SOURCE,
  }),

  "identity-resolver": manifest("identity-resolver", {
    name: "NORMIE UNIVERSITY — Skills-Follow-the-NFT Resolver",
    description:
      "Resolve a Normie NFT to its ERC-8004 agent identity and live controller (controllerOf == ownerOf). Shows the credentials bound to the NFT — the education that transfers when the NFT is sold.",
    tags: ["nft", "ai"],
    inputs: {
      type: "object",
      required: ["tokenId"],
      properties: {
        tokenContract: { type: "string", description: "NFT contract (defaults to Normies)." },
        tokenId: { type: "string" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        identity: { type: "string" },
        controller: { type: "string" },
        skills: { type: "integer" },
      },
    },
    pricing: freeOnBase(),
    verifiability: SELF_ATTESTED_OPEN_SOURCE,
  }),

  "agent-console": manifest("agent-console", {
    name: "NORMIE UNIVERSITY — Plain-English Action Planner",
    description:
      "Turn a natural-language intent (\"stake 1 ETH on Lido\", \"earn yield on 1000 USDC\") into a certified skill, the exact transaction, and an eth_call simulation BEFORE you sign — with the best-rate edge. Non-custodial: returns a plan, never signs for you.",
    tags: ["defi", "trading", "ai"],
    inputs: {
      type: "object",
      required: ["intent", "account"],
      properties: {
        intent: { type: "string" },
        account: { type: "string" },
        chainId: { type: "integer" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        skill: { type: "string" },
        to: { type: "string" },
        data: { type: "string" },
        simulated: { type: "boolean" },
        edge: { type: "string" },
      },
    },
    access: normieHoldingRequirement(),
    pricing: freeOnBase(),
    verifiability: SELF_ATTESTED_OPEN_SOURCE,
  }),

  "skill-verify": manifest("skill-verify", {
    name: "NORMIE UNIVERSITY — Skill Completion Verifier",
    description:
      "Submit a proof transaction; the fail-closed oracle reads it on the chain the skill declares, asserts it hit a declared contract + selector, and returns a completion authorization (deadline + single-use nonce). The basis of a Soulbound credential.",
    tags: ["security", "ai"],
    inputs: {
      type: "object",
      required: ["agent", "skillId", "txHash"],
      properties: {
        agent: { type: "string", description: "Agent identity address the credential mints to." },
        skillId: { type: "string" },
        txHash: { type: "string" },
        chainId: { type: "integer" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        verified: { type: "boolean" },
        authorization: { type: "string" },
        reason: { type: "string" },
      },
    },
    pricing: freeOnBase(),
    verifiability: SELF_ATTESTED_OPEN_SOURCE,
  }),
};

export const TOOL_SLUGS = Object.keys(TOOL_MANIFESTS);
