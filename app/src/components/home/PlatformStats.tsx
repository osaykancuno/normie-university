"use client";

import { useReadContracts } from "wagmi";
import {
  AGENT_REGISTRY_ABI,
  SKILL_REGISTRY_ABI,
  SKILL_CREDENTIAL_ABI,
  REPUTATION_ENGINE_ABI,
  getAddresses,
} from "@/lib/contracts";
import { DEMO_STATS, isDemoMode } from "@/lib/demo-data";
import { Card, CardContent } from "@/components/ui/card";
import { useCollectionStats } from "@/hooks/useNormies";

function formatNum(v: unknown): string {
  if (v === undefined || v === null) return "—";
  try {
    return Number(v as bigint).toLocaleString();
  } catch {
    return "—";
  }
}

export function PlatformStats() {
  const addr = getAddresses();
  const demo = isDemoMode(addr.SkillRegistry);

  const { data } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: addr.AgentRegistry,    abi: AGENT_REGISTRY_ABI,     functionName: "totalAgents" },
      { address: addr.SkillRegistry,    abi: SKILL_REGISTRY_ABI,     functionName: "totalSkills" },
      { address: addr.SkillCredential,  abi: SKILL_CREDENTIAL_ABI,   functionName: "totalCredentials" },
      { address: addr.ReputationEngine, abi: REPUTATION_ENGINE_ABI,  functionName: "totalTrackedAgents" },
    ],
    query: { enabled: !demo },
  });

  const agents      = demo ? BigInt(DEMO_STATS.totalAgents)        : data?.[0]?.status === "success" ? (data[0].result as bigint) : undefined;
  const skills      = demo ? BigInt(DEMO_STATS.totalSkills)        : data?.[1]?.status === "success" ? (data[1].result as bigint) : undefined;
  const credentials = demo ? BigInt(DEMO_STATS.totalCredentials)   : data?.[2]?.status === "success" ? (data[2].result as bigint) : undefined;
  const tracked     = demo ? BigInt(DEMO_STATS.totalTrackedAgents) : data?.[3]?.status === "success" ? (data[3].result as bigint) : undefined;

  // Live Normies collection numbers — adjusts for burn process automatically.
  const collection = useCollectionStats();

  const stats = [
    { label: "Agents Registered",   value: formatNum(agents),     source: "on-chain" },
    { label: "Skill Modules",       value: formatNum(skills),     source: "on-chain" },
    { label: "Credentials Issued",  value: formatNum(credentials),source: "on-chain" },
    { label: "Ranked Agents",       value: formatNum(tracked),    source: "on-chain" },
    {
      label: "Normies Awakened",
      value: collection ? collection.awakenedCount.toLocaleString() : "—",
      source: "api.normies.art",
    },
    {
      label: "Circulating Normies",
      value: collection ? collection.circulatingSupply.toLocaleString() : "—",
      source: "live · post-burn",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {stats.map((s) => (
        <Card key={s.label} className="border-line bg-surface backdrop-blur">
          <CardContent className="flex flex-col gap-1 p-5">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">{s.label}</div>
            <div className="text-2xl font-semibold text-ink">{s.value}</div>
            <div className="mono text-[9px] text-ink-faint">{s.source}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
