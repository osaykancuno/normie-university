# SKILLAI REST API

Base URL: your deployment (e.g. `https://skillai.xyz` or `http://localhost:3000`).

All endpoints return JSON. All on-chain numerics that exceed `Number.MAX_SAFE_INTEGER`
(prices, scores) are returned as **decimal strings**; counters that fit safely are returned
as numbers. Timestamps are Unix seconds.

The API is read-only and does not require authentication, except for `/api/ipfs/upload`
which delegates to Pinata using the server's `PINATA_JWT`.

---

## `GET /api/stats`

Platform-wide counters.

```json
{
  "chainId": 84532,
  "chainName": "Base Sepolia",
  "totalAgents": 12,
  "totalSkills": 47,
  "totalCredentials": 89,
  "totalTrackedAgents": 9
}
```

---

## `GET /api/skills`

List skill modules. Supports pagination + filters.

| Query        | Type    | Default | Description                                |
|--------------|---------|---------|--------------------------------------------|
| `limit`      | int     | 50      | 1..200                                     |
| `offset`     | int     | 0       |                                            |
| `category`   | int     | —       | 0..7 (DeFi, NFT, Governance, …)            |
| `difficulty` | int     | —       | 0..3 (Beginner, Intermediate, Advanced, Expert) |
| `active`     | bool    | —       | `true` to return only active skills        |

```json
{
  "count": 2,
  "limit": 50,
  "offset": 0,
  "skills": [
    {
      "skillId": "1",
      "name": "Uniswap V3 Swap",
      "description": "...",
      "category":   { "id": 0, "label": "DeFi" },
      "difficulty": { "id": 1, "label": "Intermediate" },
      "priceInWei":  "10000000000000000",
      "priceInUsdc": "10000000",
      "prerequisites": [],
      "contentURI": "ipfs://bafy...",
      "creator": "0x...",
      "createdAt": 1714000000,
      "updatedAt": 1714000000,
      "isActive": true,
      "stats": {
        "totalPurchases": 12,
        "totalCompletions": 8,
        "ratingCount": 5,
        "averageRating": 4.6
      }
    }
  ]
}
```

---

## `GET /api/skills/:id`

Fetch one skill. Pass `?fetchContent=true` to inline the IPFS-pinned JSON module
(uses `IPFS_GATEWAY` env var, default `https://ipfs.io/ipfs`).

```json
{
  "skill": { /* same shape as above */ },
  "content": { /* parsed skill module JSON, or null */ }
}
```

---

## `GET /api/agents/:address`

Full profile: registration + credentials + reputation. Returns 400 on invalid address.

```json
{
  "agent": "0x...",
  "isRegistered": true,
  "primaryTokenId": "3",
  "tokenIds": ["3"],
  "profile": {
    "tokenId": "3",
    "registrationFileURI": "ipfs://bafy...",
    "registeredAt": 1714000000,
    "updatedAt": 1714000000,
    "isActive": true
  },
  "credentials": [
    {
      "tokenId": "12",
      "agent": "0x...",
      "skillId": "1",
      "level": 2,
      "score": "85",
      "acquiredAt": 1714000000,
      "verified": true
    }
  ],
  "reputation": {
    "agent": "0x...",
    "score": 7820,
    "scorePercent": 78.2,
    "tier": { "id": 3, "label": "Expert" },
    "skillCount": 6,
    "avgSkillLevel": 220,
    "categoryDiversity": 4,
    "avgVerifyScore": 8400,
    "lastUpdated": 1714000000
  }
}
```

### `GET /api/agents/:address/skills`

Just the credentials array.

### `GET /api/agents/:address/reputation`

Just the reputation breakdown.

---

## `GET /api/marketplace/trending`

Curated feed of active skills.

| Query   | Type | Default     | Description |
|---------|------|-------------|-------------|
| `limit` | int  | 20 (max 100)|             |
| `sort`  | enum | `trending`  | `trending` \| `new` \| `top` \| `popular` |

- **trending** — purchases weighted by `1 / sqrt(age)`
- **new**       — recency
- **top**       — average rating, tiebreak by rating count
- **popular**   — all-time purchases

```json
{ "sort": "trending", "count": 20, "skills": [ /* Skill[] */ ] }
```

---

## `GET /api/leaderboard`

Top-N agents by on-chain reputation.

| Query | Type | Default | Description |
|-------|------|---------|-------------|
| `n`   | int  | 25 (max 100) | |

```json
{
  "count": 25,
  "agents": [
    { "rank": 1, "agent": "0x...", "score": 9120, "scorePercent": 91.2 }
  ]
}
```

---

## `POST /api/ipfs/upload`

Pin a skill-module JSON to IPFS via Pinata. Returns 501 if `PINATA_JWT` is not set.
Returns 422 with `details: [{ path, message }]` if the module fails schema validation.

Request:

```json
{ "module": { /* SkillModuleV1 — see docs/skill-module-spec.md */ } }
```

Response:

```json
{
  "cid": "bafy...",
  "uri": "ipfs://bafy...",
  "gatewayUrl": "https://ipfs.io/ipfs/bafy...",
  "size": 1234
}
```

---

## Errors

All errors are JSON: `{ "error": "<message>", "details"?: any }` with appropriate
HTTP status (400, 404, 422, 500, 501).

## Server env vars

| Var                   | Required | Description                              |
|-----------------------|----------|------------------------------------------|
| `RPC_URL`             | no       | Base RPC URL (defaults to public)        |
| `IPFS_GATEWAY`        | no       | Gateway base, default `https://ipfs.io/ipfs` |
| `PINATA_JWT`          | only for `/api/ipfs/upload` | Pinata Cloud JWT     |
| `NEXT_PUBLIC_*_84532` | no       | Per-contract address overrides for Base Sepolia |
| `NEXT_PUBLIC_*_8453`  | no       | Per-contract address overrides for Base Mainnet |
