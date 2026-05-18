# SKILLAI Deploy Runbook

End-to-end procedure to ship SKILLAI on Base Sepolia (testnet) or Base Mainnet.

The flow is:
1. **Deploy + verify contracts** with Foundry
2. **Wire up** the role grants (auto if `ADMIN_ADDRESS == deployer`, manual if multisig)
3. **Configure the frontend** with the addresses
4. **Deploy the frontend** (Vercel)
5. **Seed** 8 example skills onto the registry
6. **Smoke test** the deployment
7. **Beta** — share the URL with testers

---

## 0. Prerequisites

| Tool | Version |
|------|---------|
| Foundry (`forge`, `cast`) | ≥ 1.0 |
| Node.js | ≥ 20 |
| Vercel CLI (optional) | latest |

Funded testnet wallet:
- Base Sepolia ETH from <https://www.alchemy.com/faucets/base-sepolia>
- Base Sepolia USDC from <https://faucet.circle.com/>

External services:
- **Pinata Cloud** account → JWT for `PINATA_JWT`
- **WalletConnect Cloud** projectId for `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- **Basescan** API key for `BASESCAN_API_KEY` (contract verification)

---

## 1. Deploy contracts (Base Sepolia)

```bash
cd contracts
cp .env.example .env
# fill PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, BASESCAN_API_KEY
source .env

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

Outputs:
- `contracts/deployments/84532.json` — addresses (machine-readable)
- `contracts/deployments/84532.env`  — env snippet for the frontend
- `contracts/broadcast/Deploy.s.sol/84532/run-latest.json` — Foundry's tx log

If `ADMIN_ADDRESS == deployer` (default) the role wiring runs automatically in
the same script. Otherwise:

```bash
# ...from the multisig signer
export SKILL_REGISTRY=0x...     # from deployments/84532.json
export SKILL_CREDENTIAL=0x...
export MARKETPLACE=0x...
export CROSS_CHAIN_RECEIVER=0x...
export REPUTATION_ENGINE=0x...
export VERIFIER_ADDRESS=0x...   # optional

forge script script/WireUp.s.sol:WireUp \
  --rpc-url base_sepolia \
  --broadcast
```

### Verify on Basescan manually (if `--verify` failed)

```bash
forge verify-contract <CONTRACT_ADDRESS> \
  src/marketplace/SkillMarketplace.sol:SkillMarketplace \
  --chain base-sepolia \
  --etherscan-api-key $BASESCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address,address)" \
    $ADMIN $SKILL_REGISTRY $SKILL_CREDENTIAL $TREASURY $USDC)
```

---

## 2. Configure the frontend

```bash
cd app
cp .env.example .env.local

# Paste contracts/deployments/84532.env into .env.local then add:
#   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<from walletconnect.com>
#   PINATA_JWT=<from pinata.cloud>
#   RPC_URL=<your dedicated RPC if any, else default>

npm install
npm run build         # local sanity check
npm run dev           # http://localhost:3000
```

---

## 3. Deploy frontend to Vercel

```bash
cd app
npx vercel --prod

# In Vercel dashboard → Settings → Environment Variables:
#   - paste every NEXT_PUBLIC_*_84532 (or _8453) from .env.local
#   - PINATA_JWT (kept server-side, not exposed)
#   - RPC_URL (server-side)
#   - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
#   - NEXT_PUBLIC_NETWORK = testnet | mainnet
```

`vercel.json` already enables permissive CORS on `/api/*` so external agents
can call the read endpoints without preflight friction.

---

## 4. Seed example skills

The seed script publishes the 8 skill modules in `skill-modules/` to IPFS via
your deployed `/api/ipfs/upload` endpoint, then registers them on-chain.

```bash
cd <repo root>
export BASE_URL=https://your-vercel-url.vercel.app
export RPC_URL=https://sepolia.base.org
export CREATOR_PRIVATE_KEY=0x...                  # any funded wallet
export SKILL_REGISTRY_ADDRESS=0x...               # from deployments/84532.json
export CHAIN=base-sepolia

npx tsx scripts/seed-skills.ts
```

Output: 8 skills created, each with an `ipfs://...` `contentURI` and ETH/USDC
prices from the seed catalogue.

---

## 5. Smoke test

```bash
export BASE_URL=https://your-vercel-url.vercel.app
export RPC_URL=https://sepolia.base.org
export AGENT_REGISTRY_ADDRESS=0x...
export SKILL_REGISTRY_ADDRESS=0x...
export MARKETPLACE_ADDRESS=0x...
export REPUTATION_ENGINE_ADDRESS=0x...

npx tsx scripts/smoke-test.ts
```

Expected output: `8 / 8 checks passed.` Any failure prints the offending check
plus the underlying reason; fix and re-run.

---

## 6. Beta walkthrough (manual)

Connect a test wallet on Base Sepolia, then run through the happy path:

1. Visit `/dashboard` → click **Register agent** with an `ipfs://` registration file URI.
2. Visit `/skills` → pick a seeded skill → **Purchase** in ETH (or **Approve USDC** + **Purchase**).
3. Off-chain: have the verifier (one of `VERIFIER_ROLE` keys) sign a completion proof.
   ```ts
   const payload = keccak256(abi.encodePacked(agent, skillId, level, score, chainId, marketplace));
   const signature = await wallet.signMessage(payload); // EIP-191
   ```
4. Visit `/skills/<id>` while connected as the buyer → submit `completeSkill(skillId, level, score, sig)`.
5. Confirm the SBT shows up on `/agents/<your_address>` and the reputation score updates.
6. Visit `/reputation` to confirm leaderboard is populated.

---

## 7. Mainnet promotion

Once the testnet has been beaten on for ~2 weeks:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_mainnet \
  --broadcast \
  --verify
```

Mainnet checklist (from `docs/security.md` §Deploy-time):

- [ ] `ADMIN_ADDRESS` set to a Gnosis Safe / governance multisig
- [ ] Deployer renounces `DEFAULT_ADMIN_ROLE` after handover (`renounceRole`)
- [ ] `VERIFIER_ROLE` granted to keys NOT held by the admin multisig
- [ ] `usdcToken` set to `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- [ ] Pause every contract first; smoke-test on Sepolia exhaustively
- [ ] All contracts verified on Basescan with matching constructor args
- [ ] Frontend env switched to `NEXT_PUBLIC_NETWORK=mainnet`

---

## Rollback / emergency response

| Scenario | Response |
|----------|----------|
| Vulnerability disclosed | Pause every contract via `ADMIN_ROLE`. `Treasury.withdrawEth/withdrawErc20` still work while paused — sweep to safe multisig if needed. |
| Frontend exploit | Revert the Vercel deployment; contracts are untouched. |
| Pinata outage | API endpoint returns 501; uploads fail gracefully. Frontend still works in read mode. |
| Bridge compromise | Revoke `BRIDGE_ROLE` on `CrossChainReceiver` for the affected adapter. |
| Verifier key leak | Revoke `VERIFIER_ROLE`; rotate keys; re-sign in-flight completions with the new verifier. |
