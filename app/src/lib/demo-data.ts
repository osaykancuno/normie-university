/// @file demo-data.ts
/// @notice In-memory demo catalogue used to populate the UI when no contracts
///         are deployed yet. Activates automatically when the active chain's
///         SkillRegistry address is the zero address. Lets stakeholders preview
///         the experience end-to-end without spending gas to deploy.
///
///         Keep this dataset in sync with /skill-modules/*.json — these are the
///         canonical 15 launch products.

import { parseEther, parseUnits } from "viem";
import type { Skill } from "@/hooks/useSkills";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/// Sentinel "demo creator" address (clearly fake) so the UI shows a deterministic byline.
const DEMO_CREATOR = "0x5111A100000000000000000000000000000000Ab" as `0x${string}`;

const NOW = Math.floor(Date.now() / 1000);
const day = (n: number) => BigInt(NOW - n * 86_400);

function mk(args: {
  id: number;
  name: string;
  description: string;
  category: number;
  difficulty: number;
  ethStr: string;
  usdcStr: string;
  prereqs?: number[];
  contentURI: string;
  daysAgo: number;
  totalPurchases: number;
  totalCompletions: number;
  ratingSum: number;
  ratingCount: number;
}): Skill {
  return {
    skillId: BigInt(args.id),
    name: args.name,
    description: args.description,
    category: args.category,
    difficulty: args.difficulty,
    priceInWei: parseEther(args.ethStr as `${number}`),
    priceInUsdc: parseUnits(args.usdcStr, 6),
    prerequisites: (args.prereqs ?? []).map((p) => BigInt(p)),
    contentURI: args.contentURI,
    creator: DEMO_CREATOR,
    createdAt: day(args.daysAgo),
    updatedAt: day(args.daysAgo),
    isActive: true,
    totalPurchases: BigInt(args.totalPurchases),
    totalCompletions: BigInt(args.totalCompletions),
    ratingSum: BigInt(args.ratingSum),
    ratingCount: BigInt(args.ratingCount),
  };
}

// Categories: DeFi=0, NFT=1, Governance=2, Social=3, Trading=4, Security=5, CrossChain=6, Custom=7
// Difficulty: Beginner=0, Intermediate=1, Advanced=2, Expert=3

// Pricing tiers (community-aligned, L1 cost-optimized):
//   Beginner     : $0.49 USDC  (acquisition tool, 5-min skill)
//   Intermediate : $2.99 USDC  (sweet spot)
//   Advanced     : $9.99 USDC  (premium, sub-$10 psychological threshold)
//   Expert       : $24.99 USDC (margin maker for serious agents)
// ETH equivalents kept as approximate $0.0001-conversion @ $2.5K/ETH; on
// L1 mainnet the primary payment rail is USDC via x402 (gasless for user).
export const DEMO_SKILLS: Skill[] = [
  mk({
    id: 1, name: "Uniswap V3 Swap Execution",
    description: "Execute exactInputSingle swaps on Uniswap V3. Covers slippage protection, deadline enforcement, and gas-aware routing.",
    category: 0, difficulty: 1,
    ethStr: "0.0012", usdcStr: "2.99",
    contentURI: "ipfs://demo-bafy01-uniswap-v3-swap",
    daysAgo: 12, totalPurchases: 187, totalCompletions: 154, ratingSum: 690, ratingCount: 142,
  }),
  mk({
    id: 2, name: "Aave V3 Supply & Withdraw",
    description: "Supply and withdraw assets on Aave V3. Foundation for all yield-bearing strategies.",
    category: 0, difficulty: 0,
    ethStr: "0.0002", usdcStr: "0.49",
    contentURI: "ipfs://demo-bafy02-aave-v3-supply",
    daysAgo: 14, totalPurchases: 423, totalCompletions: 378, ratingSum: 1737, ratingCount: 362,
  }),
  mk({
    id: 3, name: "ERC-20 Permit (EIP-2612)",
    description: "Save gas by approving ERC-20 spends with off-chain EIP-2612 signatures. Foundation skill for x402 / gasless friendly agents.",
    category: 0, difficulty: 1,
    ethStr: "0.0012", usdcStr: "2.99",
    contentURI: "ipfs://demo-bafy03-erc20-permit",
    daysAgo: 11, totalPurchases: 156, totalCompletions: 131, ratingSum: 600, ratingCount: 128,
  }),
  mk({
    id: 4, name: "x402 / EIP-3009 USDC Payment",
    description: "Pay any HTTP service or smart contract in USDC using a single signed authorization (EIP-3009). The cornerstone of agent-native commerce.",
    category: 0, difficulty: 2, prereqs: [3],
    ethStr: "0.004", usdcStr: "9.99",
    contentURI: "ipfs://demo-bafy04-x402-payment",
    daysAgo: 9, totalPurchases: 92, totalCompletions: 71, ratingSum: 343, ratingCount: 68,
  }),
  mk({
    id: 5, name: "ERC-8004 Agent Registration",
    description: "Register an agent identity on an ERC-8004 Identity Registry, including a structured agent.json file pinned to IPFS.",
    category: 3, difficulty: 0,
    ethStr: "0.0002", usdcStr: "0.49",
    contentURI: "ipfs://demo-bafy05-erc8004-registration",
    daysAgo: 18, totalPurchases: 612, totalCompletions: 591, ratingSum: 2700, ratingCount: 560,
  }),
  mk({
    id: 6, name: "Safe (Gnosis) Multisig Transaction",
    description: "Propose, co-sign, and execute a Safe multisig transaction. Essential for any agent acting on behalf of a treasury or DAO.",
    category: 2, difficulty: 2, prereqs: [3],
    ethStr: "0.004", usdcStr: "9.99",
    contentURI: "ipfs://demo-bafy06-safe-multisig-tx",
    daysAgo: 7, totalPurchases: 64, totalCompletions: 48, ratingSum: 230, ratingCount: 46,
  }),
  mk({
    id: 7, name: "MEV Protection Basics",
    description: "Protect agent transactions from sandwich attacks and front-running. Slippage bounds, private mempools, and Flashbots-style relays.",
    category: 5, difficulty: 2, prereqs: [1],
    ethStr: "0.004", usdcStr: "9.99",
    contentURI: "ipfs://demo-bafy07-mev-protection",
    daysAgo: 6, totalPurchases: 78, totalCompletions: 60, ratingSum: 296, ratingCount: 58,
  }),
  mk({
    id: 8, name: "Cross-Chain Skill Purchase",
    description: "Buy a NORMIE UNIVERSITY skill from any L2 with bridge infra. Funds bridged to L1, credential minted on L1, agent stays on its home chain.",
    category: 6, difficulty: 3, prereqs: [4, 5],
    ethStr: "0.010", usdcStr: "24.99",
    contentURI: "ipfs://demo-bafy08-cross-chain-purchase",
    daysAgo: 4, totalPurchases: 31, totalCompletions: 21, ratingSum: 99, ratingCount: 19,
  }),
  mk({
    id: 9, name: "ERC-721 Minting (OpenZeppelin)",
    description: "Mint an ERC-721 token using a standard OpenZeppelin-style mint function. Foundation skill for any NFT-touching agent.",
    category: 1, difficulty: 0,
    ethStr: "0.0002", usdcStr: "0.49",
    contentURI: "ipfs://demo-bafy09-erc721-mint",
    daysAgo: 13, totalPurchases: 312, totalCompletions: 281, ratingSum: 1295, ratingCount: 273,
  }),
  mk({
    id: 10, name: "EIP-2981 Royalty Enforcement",
    description: "Read EIP-2981 royalty info from any NFT collection and route the correct payment to the creator on every secondary sale.",
    category: 1, difficulty: 1, prereqs: [9],
    ethStr: "0.0012", usdcStr: "2.99",
    contentURI: "ipfs://demo-bafy10-eip2981-royalty",
    daysAgo: 10, totalPurchases: 121, totalCompletions: 95, ratingSum: 444, ratingCount: 92,
  }),
  mk({
    id: 11, name: "Sushiswap V2 Trading",
    description: "Execute optimal swaps on Sushiswap V2 (Ethereum mainnet) — classic constant-product AMM. Route building (direct vs WETH-bridge), slippage protection, deadline enforcement.",
    category: 4, difficulty: 1, prereqs: [1],
    ethStr: "0.0012", usdcStr: "2.99",
    contentURI: "ipfs://demo-bafy11-sushiswap-v2-trading",
    daysAgo: 8, totalPurchases: 142, totalCompletions: 116, ratingSum: 545, ratingCount: 112,
  }),
  mk({
    id: 12, name: "Cross-DEX Arbitrage Detection",
    description: "Detect and execute profitable arbitrage between Uniswap V3, Sushiswap V2, and Curve on Ethereum mainnet. Gas-aware sizing, atomic flash-loan execution via Aave V3.",
    category: 4, difficulty: 3, prereqs: [1, 7, 11],
    ethStr: "0.010", usdcStr: "24.99",
    contentURI: "ipfs://demo-bafy12-arbitrage-detection",
    daysAgo: 3, totalPurchases: 24, totalCompletions: 14, ratingSum: 65, ratingCount: 13,
  }),
  mk({
    id: 13, name: "Snapshot Off-Chain Governance Voting",
    description: "Cast off-chain governance votes on Snapshot.org via EIP-712 signatures. Strategy verification, weight calculation, lifecycle awareness.",
    category: 2, difficulty: 1, prereqs: [3],
    ethStr: "0.0012", usdcStr: "2.99",
    contentURI: "ipfs://demo-bafy13-snapshot-voting",
    daysAgo: 16, totalPurchases: 198, totalCompletions: 164, ratingSum: 738, ratingCount: 158,
  }),
  mk({
    id: 14, name: "ZK Proof Verification (Groth16)",
    description: "Verify a Groth16 zero-knowledge proof on-chain using a precompiled verifier. Foundation for privacy-preserving agent attestations.",
    category: 5, difficulty: 3,
    ethStr: "0.010", usdcStr: "24.99",
    contentURI: "ipfs://demo-bafy14-zk-proof-verification",
    daysAgo: 2, totalPurchases: 18, totalCompletions: 9, ratingSum: 44, ratingCount: 9,
  }),
  mk({
    id: 15, name: "ENS Resolution",
    description: "Resolve an ENS (.eth) name to an Ethereum address and do a forward+reverse roundtrip to defend against spoofing. Human-readable agent addressing on L1.",
    category: 7, difficulty: 0,
    ethStr: "0.0002", usdcStr: "0.49",
    contentURI: "ipfs://demo-bafy15-ens-resolution",
    daysAgo: 17, totalPurchases: 287, totalCompletions: 253, ratingSum: 1180, ratingCount: 247,
  }),
  mk({
    id: 16, name: "Normies On-Chain Data Integration",
    description: "Read and use Normies (https://normies.art) on-chain data — pixel bitmaps, traits, holders, canvas transforms, agent persona API — to render NFT-native agent UX or build analytics.",
    category: 1, difficulty: 1, prereqs: [9],
    ethStr: "0.0012", usdcStr: "2.99",
    contentURI: "ipfs://demo-bafy16-normies-api-integration",
    daysAgo: 1, totalPurchases: 17, totalCompletions: 9, ratingSum: 41, ratingCount: 9,
  }),
];

/// Demo platform stats — tuned to look "live" but obviously not production.
export const DEMO_STATS = {
  totalAgents: 1_842,
  totalSkills: DEMO_SKILLS.length,
  totalCredentials: DEMO_SKILLS.reduce((s, sk) => s + Number(sk.totalCompletions), 0),
  totalTrackedAgents: 1_271,
};

// ---------------------------------------------------------------------------
// Learning Paths — curated bundles of skills sold at a discount.
// ---------------------------------------------------------------------------

export type DemoPath = {
  pathId: bigint;
  name: string;
  description: string;
  skillIds: bigint[];
  discountBps: number; // 2500 = 25%
  contentURI: string;
  isActive: boolean;
  totalPurchases: bigint;
};

const path = (
  id: number,
  name: string,
  description: string,
  skillIds: number[],
  discountBps: number,
  totalPurchases: number
): DemoPath => ({
  pathId: BigInt(id),
  name,
  description,
  skillIds: skillIds.map((s) => BigInt(s)),
  discountBps,
  contentURI: `ipfs://demo-path-${id}`,
  isActive: true,
  totalPurchases: BigInt(totalPurchases),
});

export const DEMO_PATHS: DemoPath[] = [
  path(
    1,
    "DeFi Fundamentals",
    "Foundational skills for any agent that wants to operate safely on DeFi: supply on lending, sign permits, execute swaps, defend against MEV.",
    [2, 3, 1, 7], // Aave Supply + ERC-20 Permit + Uniswap V3 + MEV Protection
    3500,         // 35% off — community bundle discount
    142
  ),
  path(
    2,
    "Agent Identity & Payments",
    "Make your agent first-class on the agentic web: ERC-8004 identity, EIP-2612 permits, x402 gasless payments — the trio every credible agent needs.",
    [5, 3, 4],
    3500,
    96
  ),
  path(
    3,
    "Trading Specialist",
    "Build an autonomous trading agent: route across DEXs, defend against sandwich attacks, and capture cross-DEX arbitrage atomically.",
    [1, 11, 7, 12],
    3500,
    58
  ),
  path(
    4,
    "Governance Operator",
    "Operate on behalf of treasuries and DAOs: sign EIP-712 votes on Snapshot, propose and co-sign Safe multisig transactions.",
    [3, 13, 6],
    3500,
    34
  ),
  path(
    5,
    "Cross-Chain Master",
    "Operate on every chain like it's your home: x402 payments, ERC-8004 identity, full cross-chain skill acquisition over LayerZero / Axelar / CCIP.",
    [3, 4, 5, 8],
    3000, // 30% off — flagship advanced path
    23
  ),
  path(
    6,
    "Normies Builder Path",
    "Native curriculum for the Awakened Normies. ERC-721 mint, EIP-2981 royalty enforcement, and Normies API integration including persona + A2A Agent Card — everything an agent needs to operate inside its own collection.",
    [9, 10, 16],
    3500, // 35% off — community-aligned flagship
    8
  ),
];

/// Compute the regular and discounted USDC price of a path (in 6-decimals units).
export function computePathPriceUsdc(p: DemoPath): { regular: bigint; discounted: bigint } {
  let regular = 0n;
  for (const id of p.skillIds) {
    const sk = DEMO_SKILLS.find((s) => s.skillId === id);
    if (sk) regular += sk.priceInUsdc;
  }
  const discounted = (regular * BigInt(10_000 - p.discountBps)) / 10_000n;
  return { regular, discounted };
}

/// Compute the regular and discounted ETH price of a path (in wei).
export function computePathPriceWei(p: DemoPath): { regular: bigint; discounted: bigint } {
  let regular = 0n;
  for (const id of p.skillIds) {
    const sk = DEMO_SKILLS.find((s) => s.skillId === id);
    if (sk) regular += sk.priceInWei;
  }
  const discounted = (regular * BigInt(10_000 - p.discountBps)) / 10_000n;
  return { regular, discounted };
}

export function getDemoPathById(id: bigint | undefined): DemoPath | undefined {
  if (id === undefined) return undefined;
  return DEMO_PATHS.find((p) => p.pathId === id);
}

/// Mock leaderboard — 12 agents with realistic-looking distribution.
export const DEMO_LEADERBOARD: { agent: `0x${string}`; score: number }[] = [
  { agent: "0xA1ce0000000000000000000000000000000A1Ce1", score: 9_240 },
  { agent: "0xb0b0000000000000000000000000000000000B0B", score: 8_810 },
  { agent: "0xc0Ffee0000000000000000000000000000Coffee", score: 8_120 },
  { agent: "0xDA00DA0000000000000000000000000000DA0DA0", score: 7_640 },
  { agent: "0xE5e5000000000000000000000000000000E5e5E5", score: 6_980 },
  { agent: "0xfacE000000000000000000000000000000FacE00", score: 6_410 },
  { agent: "0x9999990000000000000000000000000000999999", score: 5_750 },
  { agent: "0x8a8a8a0000000000000000000000000000B8a8B8", score: 5_120 },
  { agent: "0x7777770000000000000000000000000000777777", score: 4_530 },
  { agent: "0x6c6c6c0000000000000000000000000000C6c6C6", score: 3_980 },
  { agent: "0x5d5d5d000000000000000000000000000D5d5d5d", score: 3_410 },
  { agent: "0x4e4e4e000000000000000000000000000E4e4e4e", score: 2_870 },
];

/// Quick lookup by id for the detail page.
export function getDemoSkillById(id: bigint | undefined): Skill | undefined {
  if (id === undefined) return undefined;
  return DEMO_SKILLS.find((s) => s.skillId === id);
}

/// True if the given chain's SkillRegistry isn't deployed → activate demo.
export function isDemoMode(skillRegistry: `0x${string}` | undefined): boolean {
  return !skillRegistry || skillRegistry === ZERO;
}
