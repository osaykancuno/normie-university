/// @file /api/anchor/checkpoint
/// @notice Admin/operator: build + 2-of-2 co-sign + submit a PixelOracleAnchor
///         checkpoint for an epoch. Requires UNIVERSITY_SIGNER_PRIVATE_KEY +
///         ORACLE_SIGNER_PRIVATE_KEY + RELAYER_PRIVATE_KEY server-side.
///
///         Gated by ANCHOR_ADMIN_SECRET (Bearer) so only the operator can
///         trigger an on-chain checkpoint. POST body:
///         {
///           epochId: string, anchorBlock?: string,
///           credentials: CredentialAttestation[],
///           reputations: ReputationAttestation[]
///         }

import {
  buildAndSubmitCheckpoint,
  isAnchorConfigured,
} from "@/lib/server/anchor-checkpoint";
import type {
  CredentialAttestation,
  ReputationAttestation,
} from "@/lib/server/anchor/eip712";

export async function POST(req: Request) {
  if (!isAnchorConfigured()) {
    return Response.json(
      { error: "Anchor not configured (signers or anchor address missing)" },
      { status: 501 }
    );
  }

  // Operator gate
  const secret = process.env.ANCHOR_ADMIN_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: {
    epochId?: string;
    anchorBlock?: string;
    credentials?: CredentialAttestation[];
    reputations?: ReputationAttestation[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.epochId) {
    return Response.json({ error: "Missing 'epochId'" }, { status: 400 });
  }
  let epochId: bigint;
  let anchorBlock: bigint;
  try {
    epochId = BigInt(body.epochId);
    anchorBlock = BigInt(body.anchorBlock ?? "0");
  } catch {
    return Response.json({ error: "Invalid epochId/anchorBlock" }, { status: 400 });
  }

  const result = await buildAndSubmitCheckpoint({
    epochId,
    anchorBlock,
    credentials: body.credentials ?? [],
    reputations: body.reputations ?? [],
  });

  if (!result.ok) {
    return Response.json(result, { status: 502 });
  }
  return Response.json(result);
}
