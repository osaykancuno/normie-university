/// @file /api/health
/// @notice Operator readiness + liveness probe. Reports whether the oracle +
///         anchor are wired AND whether the live infrastructure the flows depend
///         on is healthy — relayer gas, RPC, IPFS — so a non-technical operator
///         gets a single "is everything ok" pulse. No secrets are leaked: only
///         booleans, public addresses, and a coarse balance.

import { formatEther, parseEther } from "viem";
import { ACTIVE_CHAIN } from "@/config/chains";
import { getAddresses } from "@/lib/contracts";
import { getPublicClient } from "@/lib/server/viem";
import { relayerAddress } from "@/lib/server/relayer";
import { isAnchorConfigured, anchorSignerDiagnostics } from "@/lib/server/anchor-checkpoint";

// Below this the relayer can't reliably pay gas for completions / sponsorships.
const RELAYER_MIN = parseEther("0.02");

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export async function GET() {
  const addr = getAddresses();
  const signers = anchorSignerDiagnostics();

  const oracle = {
    verifierConfigured: !!process.env.VERIFIER_PRIVATE_KEY,
    relayerConfigured: !!process.env.RELAYER_PRIVATE_KEY,
    validatorConfigured: !!process.env.VALIDATOR_PRIVATE_KEY,
  };
  const anchor = {
    configured: isAnchorConfigured(),
    address: addr.PixelOracleAnchor,
    signersConfigured: signers.configured,
    signersDistinct: signers.configured ? signers.distinct : false,
    university: signers.configured ? signers.university : null,
    oracle: signers.configured ? signers.oracle : null,
  };

  // --- live infrastructure checks -----------------------------------------
  const client = getPublicClient();
  const relayer = relayerAddress();

  const blockNumber = await withTimeout(client.getBlockNumber(), 4000).catch(() => null);
  const rpcOk = blockNumber !== null;

  let relayerBalanceEth: string | null = null;
  let relayerLowGas = false;
  if (relayer && rpcOk) {
    const bal = await withTimeout(client.getBalance({ address: relayer }), 4000).catch(() => null);
    if (bal !== null) {
      relayerBalanceEth = formatEther(bal);
      relayerLowGas = bal < RELAYER_MIN;
    }
  }

  // Gateway reachability (any HTTP response = up). The module loader falls back
  // across Pinata → ipfs.io → cloudflare, so this is a warning signal, not a
  // hard failure.
  // Probe the gateways the loader actually uses; up if ANY responds (the loader
  // falls back across them). Universal "hello" CID, GET, any HTTP status = up.
  const CID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
  const gateways = [
    process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs",
    process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs",
  ];
  const probes = await Promise.all(
    gateways.map((g) =>
      withTimeout(fetch(`${g}/${CID}`).then((r) => r.status > 0).catch(() => false), 5000)
    )
  );
  const ipfsOk = probes.some((p) => p === true);

  const infra = {
    rpcOk,
    blockNumber: blockNumber !== null ? blockNumber.toString() : null,
    relayer,
    relayerBalanceEth,
    relayerLowGas,
    ipfsOk,
  };

  const warnings: string[] = [];
  if (!oracle.verifierConfigured || !oracle.relayerConfigured) warnings.push("Oracle signer key(s) missing — completions are disabled.");
  if (anchor.configured && !anchor.signersDistinct) warnings.push("Anchor 2-of-2 signers are identical.");
  if (!rpcOk) warnings.push("RPC unreachable.");
  if (relayerLowGas) warnings.push(`Relayer is low on gas (${relayerBalanceEth} ETH) — top it up or completions will fail.`);
  if (!ipfsOk) warnings.push("Primary IPFS gateway unreachable — module loading falls back to ipfs.io/cloudflare.");

  const ready = oracle.verifierConfigured && oracle.relayerConfigured;
  const anchorHealthy = !anchor.configured || (anchor.signersConfigured && anchor.signersDistinct);
  // IPFS is a warning (fallback gateways exist), not a hard gate on `ok`.
  const ok = ready && anchorHealthy && rpcOk && !relayerLowGas;

  return Response.json(
    {
      ok,
      ready,
      warnings,
      chain: { id: ACTIVE_CHAIN.id, name: ACTIVE_CHAIN.name },
      oracle,
      anchor,
      infra,
      marketplace: addr.SkillMarketplace,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
