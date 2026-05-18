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

  const stats = [
    { label: "Agents Registered", value: formatNum(agents) },
    { label: "Skill Modules",     value: formatNum(skills) },
    { label: "Credentials Issued",value: formatNum(credentials) },
    { label: "Ranked Agents",     value: formatNum(tracked) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="border-line bg-surface backdrop-blur">
          <CardContent className="flex flex-col gap-1 p-5">
            <div className="text-xs uppercase tracking-wider text-ink-muted">{s.label}</div>
            <div className="text-2xl font-semibold text-ink">{s.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
