/// @file ERC-8257 tool handlers — thin OpenSea-SDK wrappers over logic this app
///        already ships (reputation, identity binding, console planner, oracle).
///
/// Each handler is built with the official @opensea/tool-sdk createToolHandler,
/// so we inherit its method/JSON/schema validation, the 402 identity challenge,
/// and (for gated tools) predicateGate. The well-known manifest bytes are the
/// same objects in manifests.ts — already proven SDK-valid + hash-matching.

import "server-only";
import { z } from "zod/v4";
import { createToolHandler, predicateGate } from "@opensea/tool-sdk";
import type { ManifestDefinition } from "@opensea/tool-sdk";
import { isAddress, zeroAddress } from "viem";

import { TOOL_MANIFESTS } from "./manifests";
import { getAgentReputation } from "@/lib/server/skills";
import { resolveBoundAgent } from "@/lib/server/binding";
import { planInstruction } from "@/lib/server/console-planner";
import { verifySkillCompletion } from "@/lib/server/verifier";
import { getAddresses } from "@/lib/contracts";

type Handler = (req: Request) => Promise<Response>;

/// Our manifests are validated structurally (check-sdk-parity) but typed as
/// plain objects; hand them to the SDK as its ManifestDefinition.
const man = (slug: string) => TOOL_MANIFESTS[slug] as unknown as ManifestDefinition;

const addr = () => getAddresses();

/// Resolve an "agent" input (an identity address OR a Normie tokenId) to the
/// address the ReputationEngine is keyed by.
async function resolveAgentAddress(agent: string): Promise<`0x${string}` | null> {
  if (isAddress(agent)) return agent as `0x${string}`;
  if (/^\d+$/.test(agent)) {
    const normies = addr().MockNormies ?? addr().NormieAgentBinding;
    const r = await resolveBoundAgent(normies, BigInt(agent));
    return r?.identity ?? null;
  }
  return null;
}

// --- reputation-lookup (open) ----------------------------------------------
const reputationLookup = createToolHandler({
  manifest: man("reputation-lookup"),
  inputSchema: z.object({ agent: z.string() }),
  outputSchema: z.object({
    score: z.number().int(),
    skills: z.number().int(),
    avgLevel: z.number(),
    verified: z.boolean(),
  }),
  handler: async (input) => {
    const account = await resolveAgentAddress(input.agent);
    if (!account) throw new Error("agent must be an address or a Normie tokenId");
    const r = await getAgentReputation(account);
    return {
      score: Math.round(r.scorePercent),
      skills: r.skillCount,
      avgLevel: r.avgSkillLevel / 100,
      verified: r.avgVerifyScore > 0,
    };
  },
});

// --- identity-resolver (open) ----------------------------------------------
const identityResolver = createToolHandler({
  manifest: man("identity-resolver"),
  inputSchema: z.object({ tokenContract: z.string().optional(), tokenId: z.string() }),
  outputSchema: z.object({
    identity: z.string(),
    controller: z.string(),
    skills: z.number().int(),
  }),
  handler: async (input) => {
    const tc = input.tokenContract ?? addr().MockNormies;
    const resolved = await resolveBoundAgent(tc, BigInt(input.tokenId));
    if (!resolved) {
      return { identity: zeroAddress, controller: zeroAddress, skills: 0 };
    }
    const rep = await getAgentReputation(resolved.identity);
    return {
      identity: resolved.identity,
      controller: resolved.controller,
      skills: rep.skillCount,
    };
  },
});

// --- agent-console (Normie-gated) ------------------------------------------
// predicateGate is wired only once the tool has an on-chain id (post-register);
// until NU_TOOL_ID_AGENT_CONSOLE is set it runs open so we can rehearse.
const consoleToolId = process.env.NU_TOOL_ID_AGENT_CONSOLE;
const agentConsole = createToolHandler({
  manifest: man("agent-console"),
  inputSchema: z.object({
    intent: z.string(),
    account: z.string(),
    chainId: z.number().int().optional(),
  }),
  outputSchema: z.object({
    skill: z.string(),
    to: z.string(),
    data: z.string(),
    simulated: z.boolean(),
    edge: z.string(),
  }),
  gates: consoleToolId
    ? [predicateGate({ toolId: BigInt(consoleToolId), rpcUrl: process.env.RPC_URL })]
    : [],
  handler: async (input) => {
    const plan = await planInstruction(input.intent, input.account);
    if (!plan.ok) {
      return { skill: "(no match)", to: "", data: "", simulated: false, edge: plan.reason };
    }
    return {
      skill: plan.plan.skillName,
      to: plan.plan.tx?.to ?? "",
      data: plan.plan.tx?.data ?? "",
      simulated: false, // simulation runs client-side before the user signs
      edge: plan.plan.advantage,
    };
  },
});

// --- skill-verify (open) ----------------------------------------------------
const skillVerify = createToolHandler({
  manifest: man("skill-verify"),
  inputSchema: z.object({
    agent: z.string(),
    skillId: z.string(),
    txHash: z.string(),
    chainId: z.number().int().optional(),
  }),
  outputSchema: z.object({
    verified: z.boolean(),
    authorization: z.string(),
    reason: z.string(),
  }),
  handler: async (input) => {
    if (!isAddress(input.agent)) throw new Error("agent must be an address");
    const result = await verifySkillCompletion({
      agent: input.agent as `0x${string}`,
      skillId: BigInt(input.skillId),
      txHash: input.txHash as `0x${string}`,
    });
    return result.ok
      ? { verified: true, authorization: result.signature, reason: "" }
      : { verified: false, authorization: "", reason: result.reason };
  },
});

export const TOOL_HANDLERS: Record<string, Handler> = {
  "reputation-lookup": reputationLookup,
  "identity-resolver": identityResolver,
  "agent-console": agentConsole,
  "skill-verify": skillVerify,
};
