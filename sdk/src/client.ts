/// @file client.ts
/// @notice Read-only HTTP client for the SKILLAI REST API.
///         No wallet or RPC needed — perfect for agent discovery flows.

import type {
  Address,
  Skill,
  Credential,
  Reputation,
  AgentProfileResponse,
  PlatformStats,
  LeaderboardEntry,
  Path,
  SortKey,
} from "./types.js";

export type SkillaiClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
};

const DEFAULT_BASE_URL = "https://skillai.xyz";

export class SkillaiClient {
  private baseUrl: string;
  private _fetch: typeof fetch;
  private headers: Record<string, string>;

  constructor(opts: SkillaiClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this._fetch = opts.fetch ?? fetch;
    this.headers = { accept: "application/json", ...(opts.headers ?? {}) };
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await this._fetch(url, { headers: this.headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new SkillaiApiError(
        `GET ${path} failed (${res.status}): ${body.slice(0, 300)}`,
        res.status
      );
    }
    return res.json() as Promise<T>;
  }

  /// Platform-wide counters.
  stats(): Promise<PlatformStats> {
    return this.get<PlatformStats>("/api/stats");
  }

  /// List skill modules with pagination + filters.
  listSkills(
    opts: {
      limit?: number;
      offset?: number;
      category?: number;
      difficulty?: number;
      active?: boolean;
    } = {}
  ): Promise<{ count: number; limit: number; offset: number; skills: Skill[] }> {
    const q = new URLSearchParams();
    if (opts.limit      !== undefined) q.set("limit",      String(opts.limit));
    if (opts.offset     !== undefined) q.set("offset",     String(opts.offset));
    if (opts.category   !== undefined) q.set("category",   String(opts.category));
    if (opts.difficulty !== undefined) q.set("difficulty", String(opts.difficulty));
    if (opts.active     !== undefined) q.set("active",     String(opts.active));
    const qs = q.toString();
    return this.get(`/api/skills${qs ? `?${qs}` : ""}`);
  }

  /// Fetch a single skill. Pass fetchContent=true to inline the IPFS JSON.
  getSkill(
    skillId: string | number | bigint,
    opts: { fetchContent?: boolean } = {}
  ): Promise<{ skill: Skill; content: unknown | null }> {
    const qs = opts.fetchContent ? "?fetchContent=true" : "";
    return this.get(`/api/skills/${skillId}${qs}`);
  }

  /// Full agent profile: registration, credentials, reputation.
  getAgent(address: Address): Promise<AgentProfileResponse> {
    return this.get(`/api/agents/${address}`);
  }

  /// Just the credentials for an agent.
  getAgentCredentials(
    address: Address
  ): Promise<{ agent: Address; count: number; credentials: Credential[] }> {
    return this.get(`/api/agents/${address}/skills`);
  }

  /// Just the reputation breakdown.
  getAgentReputation(address: Address): Promise<Reputation> {
    return this.get(`/api/agents/${address}/reputation`);
  }

  /// Marketplace feed, sorted by one of the preset rankings.
  trending(
    opts: { limit?: number; sort?: SortKey } = {}
  ): Promise<{ sort: SortKey; count: number; skills: Skill[] }> {
    const q = new URLSearchParams();
    if (opts.limit !== undefined) q.set("limit", String(opts.limit));
    if (opts.sort  !== undefined) q.set("sort",  opts.sort);
    const qs = q.toString();
    return this.get(`/api/marketplace/trending${qs ? `?${qs}` : ""}`);
  }

  /// Top-N agents by reputation.
  leaderboard(
    n = 25
  ): Promise<{ count: number; agents: LeaderboardEntry[] }> {
    return this.get(`/api/leaderboard?n=${n}`);
  }

  /// Learning Paths — curated bundles sold at a discount.
  listPaths(): Promise<{ count: number; paths: Path[] }> {
    return this.get("/api/paths");
  }

  getPath(pathId: string | number | bigint): Promise<{ path: Path }> {
    return this.get(`/api/paths/${pathId}`);
  }

  /// Pin a skill-module JSON to IPFS via the SKILLAI upload endpoint.
  /// Requires PINATA_JWT on the server. Returns { cid, uri, gatewayUrl, size }.
  async pinSkillModule(module: unknown): Promise<{
    cid: string;
    uri: `ipfs://${string}`;
    gatewayUrl: string;
    size: number;
  }> {
    const res = await this._fetch(`${this.baseUrl}/api/ipfs/upload`, {
      method: "POST",
      headers: { ...this.headers, "content-type": "application/json" },
      body: JSON.stringify({ module }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new SkillaiApiError(body?.error ?? "Upload failed", res.status);
    }
    return body;
  }

  /// Request an auto-verifier signature for a completed skill. Returns the
  /// signed payload the agent submits to `SkillMarketplace.completeSkill`.
  /// The server-side verifier evaluates the on-chain rule for the skill and
  /// signs only on success. On failure returns a 422 with `{ ok:false, reason }`.
  async requestVerification(opts: {
    agent: Address;
    skillId: bigint | number | string;
    txHash?: `0x${string}`;
  }): Promise<
    | {
        ok: true;
        agent: Address;
        skillId: string;
        level: number;
        score: number;
        signature: `0x${string}`;
        marketplace: Address;
        chainId: number;
      }
    | { ok: false; reason: string; hint?: string }
  > {
    const res = await this._fetch(`${this.baseUrl}/api/verify`, {
      method: "POST",
      headers: { ...this.headers, "content-type": "application/json" },
      body: JSON.stringify({
        agent: opts.agent,
        skillId: String(opts.skillId),
        txHash: opts.txHash,
      }),
    });
    const body = await res.json();
    if (res.status === 422 && body && body.ok === false) {
      return body;
    }
    if (!res.ok) {
      throw new SkillaiApiError(body?.error ?? "Verification request failed", res.status);
    }
    return body;
  }
}

export class SkillaiApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "SkillaiApiError";
  }
}
