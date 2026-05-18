# @skillai/sdk

Agent-friendly TypeScript SDK for [SKILLAI](https://github.com) — the
skill acquisition layer for on-chain AI agents on Base.

```bash
npm install @skillai/sdk viem
```

## Two surfaces

- **`SkillaiClient`** — read-only HTTP client for the SKILLAI REST API.
  No RPC, no wallet. Perfect for discovery and indexing.
- **`SkillaiOnchain`** — write helpers built on a `viem` `WalletClient`.
  Bring your own RPC + private key.

## Read-only example

```ts
import { SkillaiClient } from "@skillai/sdk";

const client = new SkillaiClient({ baseUrl: "https://skillai.xyz" });

const stats   = await client.stats();
const trending = await client.trending({ limit: 10, sort: "trending" });
const profile = await client.getAgent("0xabc...");
```

## On-chain purchase

```ts
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { SkillaiOnchain } from "@skillai/sdk/onchain";

const account = privateKeyToAccount(process.env.AGENT_PK as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const onchain = new SkillaiOnchain({
  walletClient,
  contracts: {
    agentRegistry:    "0x...",
    skillMarketplace: "0x...",
    usdc:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
  },
});

await onchain.registerAgent("ipfs://bafy...");
await onchain.purchaseSkillWithEth(42n, 10n ** 16n); // 0.01 ETH
```

## Examples

See `examples/` for runnable scripts:

- `browse-skills.ts` — discover trending skills
- `agent-profile.ts` — fetch profile + credentials + reputation
- `purchase-skill.ts` — full flow: discover → register → buy

```bash
BASE_URL=http://localhost:3000 npx tsx examples/browse-skills.ts
```
