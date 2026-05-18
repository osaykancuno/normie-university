"use client";

import { useEffect, useState } from "react";

export type NormiesHolderInfo = {
  chain: { id: number; name: string };
  address: `0x${string}`;
  tokenIds: string[];
  isHolder: boolean;
  count: number;
};

export type NormieInfo = {
  tokenId: string;
  owner: `0x${string}`;
  image: { svg: string; png: string };
  traits: { trait_type: string; value: string }[];
  canvas: {
    actionPoints: number;
    level: number;
    customized: boolean;
    delegate: `0x${string}`;
    delegateSetBy: `0x${string}`;
  } | null;
};

/// Persona-layer data — Normies "Awakening" agent identity.
/// Source: https://api.normies.art/agents/*
export type Persona = {
  tokenId: string;
  name: string;
  tagline: string;
  archetype: string;
  type: string;
  personality: string[];
  communicationStyle: string;
  quirks: string[];
  backstory: string[];
  greeting: string;
  canvas: {
    level: number;
    actionPoints: number;
    customized: boolean;
    transformations: number;
    pixelDiff: { added: number; removed: number; net: number };
  };
};

export type PersonaResponse = {
  tokenId: string;
  binding: { tokenId: string; agentId: string; bound: boolean; adapter: `0x${string}` } | null;
  persona: Persona;
  agentCard: Record<string, unknown> | null;
};

/// Check whether the given EVM address holds any Normie on Ethereum mainnet.
/// Calls the NORMIE UNIVERSITY proxy (which caches + rate-limit-proofs the upstream).
export function useNormiesOf(address: `0x${string}` | undefined) {
  const [data, setData] = useState<NormiesHolderInfo | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!address) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/normies/holder/${address}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Normies lookup failed (${r.status})`);
        return (await r.json()) as NormiesHolderInfo;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  return { data, isLoading, error };
}

/// Persona-layer hook — pull the full agent identity (binding + persona +
/// A2A card) for a Normie tokenId. The persona is regenerated live from
/// on-chain state by the Normies backend, so this stays fresh.
export function usePersona(tokenId: string | number | undefined) {
  const [data, setData] = useState<PersonaResponse | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (tokenId === undefined) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/normies/agent/${tokenId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Persona lookup failed (${r.status})`);
        return (await r.json()) as PersonaResponse;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tokenId]);

  return { data, isLoading, error };
}

/// Convenience: pull persona for the FIRST Normie owned by `address`.
export function usePersonaOf(address: `0x${string}` | undefined) {
  const { data: holder } = useNormiesOf(address);
  const primary = holder?.isHolder ? holder.tokenIds[0] : undefined;
  return usePersona(primary);
}

/// Lookup a single Normie by tokenId (owner + image + traits + canvas info).
export function useNormie(tokenId: string | number | undefined) {
  const [data, setData] = useState<NormieInfo | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (tokenId === undefined) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/normies/normie/${tokenId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Normie lookup failed (${r.status})`);
        return (await r.json()) as NormieInfo;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tokenId]);

  return { data, isLoading, error };
}

// ===========================================================================
// Pre-school: persona preview BEFORE awakening
// ===========================================================================

export type PersonaPreviewResponse = {
  tokenId: string;
  persona: Persona;
  image: { svg: string; png: string };
  awakened: false;
  hint: string;
};

export function usePersonaPreview(tokenId: string | number | undefined) {
  const [data, setData] = useState<PersonaPreviewResponse | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (tokenId === undefined || tokenId === "") { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/normies/persona-preview/${tokenId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Preview failed (${r.status})`);
        return (await r.json()) as PersonaPreviewResponse;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tokenId]);

  return { data, isLoading, error };
}

// ===========================================================================
// Live canvas state — "your Normie transformed" indicator
// ===========================================================================

export type CanvasFeed = {
  tokenId: string;
  info: {
    actionPoints: number;
    level: number;
    customized: boolean;
    delegate: `0x${string}`;
    delegateSetBy: `0x${string}`;
  } | null;
  diff: {
    added: { x: number; y: number }[];
    removed: { x: number; y: number }[];
    addedCount: number;
    removedCount: number;
    netChange: number;
  } | null;
  versions: Array<{
    version: number;
    changeCount: number;
    newPixelCount: number;
    transformer: `0x${string}`;
    blockNumber: number;
    timestamp: number;
    txHash: `0x${string}`;
  }>;
  lastTransformAt: number | null;
};

export function useCanvasFeed(
  tokenId: string | number | undefined,
  pollMs = 60_000
) {
  const [data, setData] = useState<CanvasFeed | null>(null);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (tokenId === undefined) { setData(null); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = () => {
      setLoading(true);
      fetch(`/api/normies/canvas/${tokenId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: CanvasFeed | null) => { if (!cancelled && d) setData(d); })
        .finally(() => {
          if (!cancelled) setLoading(false);
          if (!cancelled) timer = setTimeout(fetchOnce, pollMs);
        });
    };
    fetchOnce();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tokenId, pollMs]);

  return { data, isLoading };
}

// ===========================================================================
// Burn history — feeds the reputation breakdown
// ===========================================================================

export type BurnHistoryResponse = {
  tokenId: string;
  summary: {
    burnsReceived: number;
    totalTokensBurned: number;
    totalApFromBurns: number;
  };
  burns: Array<{
    commitId: number;
    owner: `0x${string}`;
    receiverTokenId: string;
    tokenCount: number;
    transferredActionPoints: number;
    blockNumber: number;
    timestamp: number;
    txHash: `0x${string}`;
    revealed: boolean;
  }>;
};

export function useBurnHistory(tokenId: string | number | undefined) {
  const [data, setData] = useState<BurnHistoryResponse | null>(null);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (tokenId === undefined) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/normies/burns/${tokenId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BurnHistoryResponse | null) => { if (!cancelled && d) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tokenId]);

  return { data, isLoading };
}
