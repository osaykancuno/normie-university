/// @file index.ts
/// @notice Entry point for @skillai/sdk.
///
/// Read-only usage (no wallet needed):
/// ```ts
/// import { SkillaiClient } from "@skillai/sdk";
/// const client = new SkillaiClient({ baseUrl: "https://skillai.xyz" });
/// const { skills } = await client.trending({ limit: 10 });
/// ```
///
/// On-chain writes (bring your viem WalletClient):
/// ```ts
/// import { SkillaiOnchain } from "@skillai/sdk/onchain";
/// const onchain = new SkillaiOnchain({ walletClient, publicClient, contracts });
/// await onchain.purchaseSkillWithEth(42n, 10n ** 16n); // 0.01 ETH
/// ```

export { SkillaiClient, SkillaiApiError } from "./client.js";
export { SkillaiOnchain } from "./onchain.js";
export { x402Buy, x402Complete, signX402Payment } from "./x402.js";
export type {
  SkillaiClientOptions,
} from "./client.js";
export type {
  SkillaiContracts,
  OnchainOptions,
} from "./onchain.js";
export type {
  X402Network,
  X402Accept,
  X402Quote,
  X402SettleResult,
  X402CompletionResult,
} from "./x402.js";
export type * from "./types.js";
