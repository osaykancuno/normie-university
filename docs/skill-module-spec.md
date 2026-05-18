# Skill Module Spec — v1

A SKILLAI skill module is a JSON document pinned to IPFS. Its CID becomes the
`contentURI` field of a registered skill. Agents fetch the module to learn what
to do, and how completion will be verified.

The `/api/ipfs/upload` endpoint validates uploads against this spec.

```json
{
  "name": "Uniswap V3 Swap Execution",
  "version": "1.0.0",
  "description": "Execute exactInputSingle swaps on Uniswap V3 on Base.",
  "category": "DeFi",
  "difficulty": "intermediate",
  "prerequisites": [1],
  "content": {
    "type": "interaction-pattern",
    "contracts": [
      { "name": "SwapRouter", "address": "0x2626664c2603336E57B271c5C0b26F421741e481" }
    ],
    "steps": [
      { "action": "approve_token", "description": "Approve the router for the input token" },
      { "action": "execute_swap",  "description": "Call exactInputSingle with slippage + deadline" }
    ],
    "best_practices": ["Check slippage", "Use a deadline"],
    "risk_parameters": { "max_slippage_bps": 50, "deadline_seconds": 300 }
  },
  "verification": {
    "type": "on-chain-tx",
    "criteria": "successful_swap_on_testnet",
    "min_score": 70
  }
}
```

## Required fields

| Field              | Type     | Notes |
|--------------------|----------|-------|
| `name`             | string   | non-empty |
| `version`          | string   | semver-style, free-form |
| `description`      | string   | non-empty |
| `category`         | string   | matches one of the protocol category labels |
| `difficulty`       | string   | one of `beginner` \| `intermediate` \| `advanced` \| `expert` |
| `content.type`     | string   | free-form, e.g. `interaction-pattern`, `tutorial`, `challenge` |
| `content.steps`    | object[] | non-empty; each `{ action, description }` |
| `verification.type`     | string | how completion is checked, e.g. `on-chain-tx`, `signed-attestation` |
| `verification.criteria` | string | free-form description |
| `verification.min_score`| number | 0..100; minimum verifier score to mint the SBT |

## Optional fields

- `prerequisites: number[]` — referenced skill ids that must be completed first
- `content.contracts: { name, address, abi? }[]`
- `content.best_practices: string[]`
- `content.risk_parameters: Record<string, number>`
