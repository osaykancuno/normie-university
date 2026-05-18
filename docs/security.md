# SKILLAI Security Notes — Audit Prep

This document is the internal security review of the SKILLAI v1 contracts.
It is the starting point for any external auditor. It enumerates every contract
in scope, the trust assumptions, the controls in place, the findings from the
internal review, and the test coverage that exercises them.

## Scope

| Contract                      | LOC | Role |
|-------------------------------|-----|------|
| `core/AgentRegistry.sol`      | 275 | ERC-8004 Identity Registry. Mints agent NFTs. |
| `core/SkillRegistry.sol`      | ~250 | Catalogue of skill modules with creator economics. |
| `core/SkillCredential.sol`    | 252 | ERC-721 Soulbound credentials minted on completion. |
| `marketplace/SkillMarketplace.sol` | 499 | ETH / USDC / x402 escrow, distribute, refund, rate. |
| `marketplace/CrossChainReceiver.sol` | 175 | Bridge-agnostic cross-chain entry point. |
| `reputation/ReputationEngine.sol` | ~270 | Five-factor reputation scoring + leaderboard. |
| `reputation/ValidationRegistry.sol` | ~150 | ERC-8004 Validation Registry. |
| `treasury/Treasury.sol`       | ~320 | Holds protocol + reserve fees. Optional Aave V3 yield deployment. |
| `marketplace/PathRegistry.sol` | ~330 | Curated Learning Paths (skill bundles at a discount). |
| `libraries/SkillTypes.sol`    | ~180 | Shared structs, enums, custom errors. |

External dependencies: **OpenZeppelin Contracts v5** (AccessControl, Pausable,
ReentrancyGuard, ERC721, ERC721Enumerable, SafeERC20, ECDSA, MessageHashUtils).

## Trust assumptions

| Role / Actor          | Granted to                 | Privileges |
|-----------------------|----------------------------|-----------|
| `DEFAULT_ADMIN_ROLE`  | initial deployer admin     | manage all roles |
| `ADMIN_ROLE`          | governance multisig        | pause, role grants, parameter setters |
| `MARKETPLACE_ROLE`    | `SkillMarketplace`         | mint SBT credentials, increment counters |
| `VERIFIER_ROLE`       | trusted off-chain verifiers| sign completion proofs |
| `CROSS_CHAIN_ROLE`    | `CrossChainReceiver`       | call `purchaseSkillCrossChain` |
| `BRIDGE_ROLE`         | LayerZero / Axelar / CCIP adapters | call `handleCrossChainPurchase` |
| `VALIDATOR_ROLE`      | trusted validators         | submit ERC-8004 validation responses |

The protocol is **not** trustless against `ADMIN_ROLE`. Admins can:
- Pause every contract
- Grant/revoke verifier and bridge roles
- Burn fraudulent credentials (`SkillCredential.adminBurn`)
- Drain the treasury

For mainnet deployment the `ADMIN_ROLE` must be a Gnosis Safe / governance
multisig. The deployer should `renounceRole(DEFAULT_ADMIN_ROLE)` after handing
over `ADMIN_ROLE` to the multisig.

## Defenses in place

| Control               | Where                                         |
|-----------------------|-----------------------------------------------|
| Reentrancy guards     | All fund-moving entry points (`purchaseSkill`, `purchaseSkillWithUsdc`, `purchaseSkillWithAuthorization`, `purchaseSkillCrossChain`, `completeSkill`, `requestRefund`, `withdrawEth`, `withdrawErc20`, `handleCrossChainPurchase`) |
| Access control        | OpenZeppelin AccessControl on every privileged operation |
| Pausable              | Every external write path; **withdrawals on Treasury intentionally NOT pausable** so admins can rescue funds during an emergency |
| Input validation      | Zero-address checks, score bounds (0..100), level bounds (1..3), rating bounds (1..5), price caps |
| Rate limiting         | 1-hour cooldown between agent registrations per address |
| Signature binding     | `completeSkill` payload binds `(agent, skillId, level, score, chainid, marketplace)` — no replay across chains or contracts |
| Soulbound enforcement | `SkillCredential` reverts on `transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll` |
| Pull-payment safety   | Distribute uses low-level `call` with explicit success check |
| Rounding-dust safety  | Reserve share computed via subtraction, not separate division (no wei lost) |
| Bridge-agnostic       | Cross-chain entry trusts an opaque `BRIDGE_ROLE` — adapters can be plugged in / replaced without touching core |

Solidity `^0.8.24` provides built-in overflow/underflow protection.

## Findings (internal review)

### Resolved

#### F-1 (Medium) — Treasury withdrawals were blocked when paused
**Status: FIXED.**
`withdrawEth` / `withdrawErc20` previously had `whenNotPaused`. In an
emergency-pause scenario this would have prevented admins from rescuing funds
into a safer multisig. The modifier was removed from both functions; deposits
remain paused. New test: `Treasury.t.sol :: test_Pause_AllowsWithdrawForEmergencyRescue`.

#### F-2 (Medium) — `setUsdcToken` could silently swap tokens during in-flight escrow
**Status: FIXED.**
Originally `SkillMarketplace.setUsdcToken` was unconditionally callable by
admin. If an admin swapped the USDC address while purchases were escrowed in
the previous token, refunds and creator payouts would have used the wrong
token — corrupting accounting and potentially trapping funds.

Now `setUsdcToken` reverts when the previous value is non-zero unless the
contract is paused. The intended migration flow is: pause → wait for refund
window / drain → setUsdcToken → unpause. Setting from zero (initial config)
is still allowed without pause. New test:
`SkillMarketplace.t.sol :: test_SetUsdcToken_RevertsWhenNotPausedAndAlreadySet`.

#### F-3 (Low) — `getAgent` returned a misleading error parameter
**Status: FIXED.**
`AgentRegistry.getAgent(tokenId)` previously reverted with
`SkillAI__NotRegistered(msg.sender)` when the token id did not exist, even
though `msg.sender` was unrelated to the lookup. Now reverts with
`SkillAI__NotRegistered(address(0))` to make it clear the token, not the
caller, is the missing entity.

### New surface — Aave V3 Treasury yield (post-pivot)

The Treasury can deploy idle ETH and USDC into Aave V3 to earn passive yield
on escrowed and treasury-held funds. Activation is **opt-in** via
`Treasury.configureAave(pool, ethGateway)` — left at `address(0)` by default,
no yield deployment happens.

**Threat model & mitigations:**

| Risk | Mitigation |
|------|-----------|
| Aave Pool getting paused / borked | Treasury can `withdraw*FromYield` any time; the Pool's pause mechanism still allows withdrawals |
| Bad debt / shortfall event on Aave | Realised loss = `principal - aTokenBalance`. We track principal explicitly so accounting stays honest even on loss |
| Misconfigured `aWeth` address in `withdrawEthFromYield` | Admin-only, only impacts approve allowance — no fund loss path |
| Gateway address rotated by Aave | Admin reconfigures via `configureAave`. Existing aWETH balance can still be withdrawn through `Pool.withdraw` directly |
| Yield interest re-deposits in a tax-jurisdiction-sensitive way | Off-chain concern; admin should report aaveUsdcYield() periodically |

Aave is not deployed on Base Sepolia, so the integration only activates in
production on Base mainnet. Tests use a local mock that mirrors the Pool's
supply/withdraw/getReserveData surface and an aWETH gateway mock.

### Acknowledged (won't-fix or design-by-tradeoff)

#### F-4 (Medium) — Griefing via failing creator/treasury ETH receiver
**Status: ACCEPTED RISK.**
If a creator address is a contract that reverts on receive, `_distribute`
reverts and the entire `completeSkill` flow fails for that purchase. The
agent can still get a refund after `REFUND_WINDOW` (30 days) since `p.completed`
was never set.

Mitigation options:
- Pull-payment escrow per (creator, token) pair
- Skipping a failed creator and allocating their share to the reserve

We accept the risk for v1 because (a) the agent has a deterministic refund
path and (b) revenue split is announced loudly to creators. The pull-payment
pattern would be the canonical fix in v2.

#### F-5 (Medium) — Verifier signature replay window
**Status: ACCEPTED RISK / DOCUMENTED.**
`completeSkill` does not include a signature nonce or expiry. The signature
is bound to `(agent, skillId, level, score, chainid, marketplace)`, so it
cannot be replayed against a different skill, agent, or contract — and once
`p.completed = true` the same (agent, skillId) cannot complete twice.

What it **does** allow: an agent who receives a verifier signature can hold
onto it and use it later. Verifiers should treat their signatures as
short-lived and only sign when they expect immediate use. v2 will add
`(nonce, validUntil)` to the payload.

#### F-6 (Low) — `notifyUsdcDeposit` is permissionless
**Status: ACCEPTED.**
Anyone can call `Treasury.notifyUsdcDeposit(token, amount)` and inflate
`totalUsdcCollected` without actually depositing. The counter is advisory —
all withdrawals use the real on-chain balance. The function exists so the
Marketplace can keep human-readable accounting in sync with its inflows;
abuse is harmless.

#### F-7 (Low) — Orphan ETH in Marketplace `receive()`
**Status: ACCEPTED.**
The Marketplace's `receive()` accepts arbitrary ETH (necessary for the
cross-chain flow). If anyone donates ETH directly, it becomes locked because
no admin sweep exists. Acceptable: there's no intended path that produces
orphan ETH, and donors are explicitly choosing to send to a contract.

### Notes for auditors

- **N-1.** `SkillCredential.adminBurn` does not emit a structured event with
  `(agent, skillId)`. Consider adding before mainnet for indexing convenience.
- **N-2.** `AgentRegistry._update` does an O(N) loop to find the next
  `primaryTokenId` after a transfer. For agents holding many tokens this is
  a gas concern. Capping or using a doubly-linked list is a v2 optimisation.
- **N-3.** Reputation scaling: `ReputationEngine.getReputation` returns a
  basis-points-like value (0..10000). External integrators should not assume
  the upper bound is fixed; document via versioned interface.
- **N-4.** `CrossChainReceiver.handleCrossChainPurchase` relies on the bridge
  to enforce nonce uniqueness. If a bridge implementation forgets, replay is
  possible. Each bridge adapter is responsible for asserting `nonce` was not
  consumed before forwarding.

## Test coverage

Total: **181 tests passing across 12 suites**, including 5 stateful invariant
tests with 256 fuzz runs each (~3,840 randomized calls per invariant).

```
AgentRegistry.t.sol         24 tests   (incl. 2 fuzz: 1000 runs each)
SkillRegistry.t.sol         ~25 tests   (incl. CREATOR_ROLE gate)
SkillCredential.t.sol       ~20 tests
Treasury.t.sol              13 tests
TreasuryYield.t.sol         11 tests    (Aave supply/withdraw + yield accrual)
ValidationRegistry.t.sol    15 tests
SkillMarketplace.t.sol      30 tests   (incl. completeSkillFor relay tests)
ReputationEngine.t.sol      11 tests
CrossChainReceiver.t.sol    9 tests
PathRegistry.t.sol          11 tests    (path bundles + accounting)
Integration.t.sol           7 tests    (full happy path + multi-agent flow)
Marketplace.invariant.t.sol 5 invariants
```

### Marketplace invariants

| ID | Property |
|----|----------|
| I1 | A purchase is never both `completed` AND `refunded`. |
| I2 | `address(market).balance + ghostEthOut >= ghostEthIn` (no ETH disappears). |
| I3 | Same for USDC: `usdc.balanceOf(market) + ghostUsdcOut >= ghostUsdcIn`. |
| I4 | If `hasCompleted(agent, skillId)`, then `cred.hasSkill(agent, skillId)` (every completion mints a credential). |
| I5 | Once completed, `hasPurchased` remains true (no refund-after-complete). |

## Static analysis

Slither has not been run as part of this internal pass (not installed in the
local environment). Pre-audit checklist:

```
pip install slither-analyzer
cd contracts && slither src/ \
    --filter-paths "node_modules|lib" \
    --exclude-informational
```

Recommended additional tooling for the external audit:
- **Echidna** for property-based fuzzing of the same invariants
- **Halmos** for symbolic execution of `completeSkill` and `_distribute`
- **Mythril** for taint analysis on `purchaseSkillWithAuthorization` (sig recovery)

## Gas footprint (avg)

| Function                         | Gas (avg) |
|----------------------------------|-----------|
| `registerAgent`                  | ~335k |
| `createSkill`                    | ~385k |
| `purchaseSkill` (ETH)            | ~188k |
| `purchaseSkillWithUsdc`          | ~234k |
| `purchaseSkillWithAuthorization` | ~180k |
| `completeSkill` (mint SBT + reputation) | ~540k |
| `requestRefund`                  | ~67k |
| `rateSkill`                      | ~67k |
| `withdrawEth`                    | ~56k |

These figures are acceptable on Base L2. The most expensive flow is
`completeSkill`; the bulk of cost comes from the SBT mint + the reputation
recompute. Optimizations are out of scope for v1.

## Deploy-time checklist

Before mainnet:

1. [ ] `ADMIN_ROLE` granted to a Gnosis Safe / governance multisig.
2. [ ] Deployer renounces `DEFAULT_ADMIN_ROLE` after handover.
3. [ ] `VERIFIER_ROLE` granted only to keys held by trusted validators
       (not the same key as `ADMIN_ROLE`).
4. [ ] `MARKETPLACE_ROLE` granted to `SkillMarketplace` on both
       `SkillRegistry` and `SkillCredential`.
5. [ ] `CROSS_CHAIN_ROLE` granted to `CrossChainReceiver` only.
6. [ ] `BRIDGE_ROLE` granted only to whitelisted adapter contracts.
7. [ ] `usdcToken` set to canonical Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
8. [ ] Treasury and reputation engine wired in via setters and verified by reads.
9. [ ] Pause every contract; run a smoke test on Base Sepolia first.
10. [ ] Verify all contracts on Basescan with matching constructor args.
