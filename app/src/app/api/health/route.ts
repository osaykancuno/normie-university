/// @file /api/health
/// @notice Operator readiness probe. Reports whether the oracle + anchor are
///         wired for the live deployment WITHOUT leaking secrets: only booleans
///         and public signer addresses are returned. Useful as a Vercel /
///         uptime check before go-live and to confirm env is set per chain.

import { ACTIVE_CHAIN } from "@/config/chains";
import { getAddresses } from "@/lib/contracts";
import {
  isAnchorConfigured,
  anchorSignerDiagnostics,
} from "@/lib/server/anchor-checkpoint";

export async function GET() {
  const addr = getAddresses();
  const anchorCfg = isAnchorConfigured();
  const signers = anchorSignerDiagnostics();

  const oracle = {
    verifierConfigured: !!process.env.VERIFIER_PRIVATE_KEY,
    relayerConfigured: !!process.env.RELAYER_PRIVATE_KEY,
    validatorConfigured: !!process.env.VALIDATOR_PRIVATE_KEY,
  };

  const anchor = {
    configured: anchorCfg,
    address: addr.PixelOracleAnchor,
    // 2-of-2 is only meaningful with two DISTINCT signers — surface it.
    signersConfigured: signers.configured,
    signersDistinct: signers.configured ? signers.distinct : false,
    university: signers.configured ? signers.university : null,
    oracle: signers.configured ? signers.oracle : null,
  };

  // Ready iff the core completion path (verifier + relayer) is wired. The
  // anchor is an additional trust layer; we report it but don't block on it.
  const ready = oracle.verifierConfigured && oracle.relayerConfigured;
  // Degraded if the anchor is configured but its 2-of-2 collapses to one key.
  const anchorHealthy = !anchor.configured || (anchor.signersConfigured && anchor.signersDistinct);

  return Response.json(
    {
      ok: ready && anchorHealthy,
      ready,
      chain: { id: ACTIVE_CHAIN.id, name: ACTIVE_CHAIN.name },
      oracle,
      anchor,
      marketplace: addr.SkillMarketplace,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
