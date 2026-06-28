/// @file scripts/register-tool.ts
/// @notice Prepares the ERC-8257 `registerTool` transaction(s) for NORMIE
///         UNIVERSITY tools, computing each `manifestHash` with the SAME
///         canonicalizer that serves the bytes — so on-chain commitment and
///         served manifest can never drift.
///
/// SAFE BY DEFAULT: prints the exact tx (to / function / args / calldata) so you
/// can execute it from YOUR wallet or a Safe. It does NOT send anything and
/// never asks for a private key.
///
/// Usage:
///   TOOL_ORIGIN=https://normie-university.vercel.app \
///   TOOL_REGISTRY=0x<opensea_toolregistry_on_base> \
///   TOOL_PREDICATE=0x<deployed_ToolAccessPredicate> \
///   npx tsx scripts/register-tool.ts
///
/// Env:
///   TOOL_REGISTRY   OpenSea ToolRegistry address on Base (required to emit calldata)
///   TOOL_PREDICATE  deployed ToolAccessPredicate (used for tools with an `access` block)
///   NEXT_PUBLIC_TOOL_ORIGIN / TOOL_ORIGIN   public origin serving the manifests

import { encodeFunctionData, isAddress, zeroAddress } from "viem";
import { manifestHash } from "../src/lib/erc8257/canonicalize";
import { CREATOR_ADDRESS, TOOL_MANIFESTS, TOOL_ORIGIN } from "../src/lib/erc8257/manifests";

const REGISTRY = (process.env.TOOL_REGISTRY ?? "").toLowerCase();
const PREDICATE = (process.env.TOOL_PREDICATE ?? "").toLowerCase();

// ERC-8257 IToolRegistry.registerTool
const REGISTER_ABI = [
  {
    type: "function",
    name: "registerTool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadataURI", type: "string" },
      { name: "manifestHash", type: "bytes32" },
      { name: "accessPredicate", type: "address" },
    ],
    outputs: [{ name: "toolId", type: "uint256" }],
  },
] as const;

function main() {
  // Hard stop: a zero/invalid creator would be rejected by the registry (or,
  // worse, produce a hash that mismatches the wallet you later register from).
  if (!isAddress(CREATOR_ADDRESS) || CREATOR_ADDRESS === zeroAddress) {
    console.error(
      "ABORT: ERC8257_CREATOR_ADDRESS is unset/zero. Set it to your creator wallet\n" +
        "(the SAME wallet you will register from) and re-run.",
    );
    process.exit(1);
  }
  if (!TOOL_ORIGIN.startsWith("https://")) {
    console.error("ABORT: TOOL_ORIGIN must be an https:// origin.");
    process.exit(1);
  }

  const registryOk = isAddress(REGISTRY);
  const predicateOk = isAddress(PREDICATE);

  console.log("ERC-8257 registration plan");
  console.log("origin   :", TOOL_ORIGIN);
  console.log("registry :", registryOk ? REGISTRY : "(set TOOL_REGISTRY to emit calldata)");
  console.log("predicate:", predicateOk ? PREDICATE : "(set TOOL_PREDICATE for gated tools)");
  console.log("");

  for (const [slug, manifest] of Object.entries(TOOL_MANIFESTS)) {
    const metadataURI = `${TOOL_ORIGIN}/.well-known/ai-tool/${slug}.json`;
    const hash = manifestHash(manifest);
    const gated = Boolean((manifest as Record<string, unknown>).access);
    const predicate = gated
      ? predicateOk
        ? (PREDICATE as `0x${string}`)
        : null
      : zeroAddress;

    console.log(`── ${slug} ${gated ? "(Normie-gated)" : "(open)"}`);
    console.log("   metadataURI :", metadataURI);
    console.log("   manifestHash:", hash);
    console.log(
      "   predicate   :",
      predicate ?? "MISSING — set TOOL_PREDICATE (this tool is gated)",
    );

    if (registryOk && predicate) {
      const data = encodeFunctionData({
        abi: REGISTER_ABI,
        functionName: "registerTool",
        args: [metadataURI, hash, predicate],
      });
      console.log("   ── send this transaction from your creator wallet ──");
      console.log("   to   :", REGISTRY);
      console.log("   value: 0");
      console.log("   data :", data);
    }
    console.log("");
  }

  console.log(
    "Reminder: the wallet you send these from MUST equal `creatorAddress` in the\n" +
      "manifests (set ERC8257_CREATOR_ADDRESS to it before deploying), or OpenSea\n" +
      "rejects the registration. Prefer the official @opensea/tool-sdk if available.",
  );
}

main();
