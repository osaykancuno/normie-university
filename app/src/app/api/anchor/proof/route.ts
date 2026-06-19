/// @file /api/anchor/proof
/// @notice Public: returns the Merkle proof for a committed credential or
///         reputation leaf so any consumer can call
///         PixelOracleAnchor.verifyCredential / verifyReputation on-chain.
///
///         In a full deployment the epoch's leaf set is read from the DB /
///         on-chain index. For the current pre-launch build the caller passes
///         the epoch's leaf set alongside the target (the server is stateless
///         about historical epochs). Shape:
///
///         POST {
///           kind: "credential" | "reputation",
///           credentials: CredentialAttestation[],
///           reputations: ReputationAttestation[],
///           target: <one credential or reputation>
///         }

import {
  proofForCredential,
  proofForReputation,
} from "@/lib/server/anchor-checkpoint";
import type {
  CredentialAttestation,
  ReputationAttestation,
} from "@/lib/server/anchor/eip712";

export async function POST(req: Request) {
  let body: {
    kind?: string;
    credentials?: CredentialAttestation[];
    reputations?: ReputationAttestation[];
    target?: CredentialAttestation | ReputationAttestation;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const credentials = body.credentials ?? [];
  const reputations = body.reputations ?? [];
  if (!body.target) {
    return Response.json({ error: "Missing 'target'" }, { status: 400 });
  }
  if (credentials.length + reputations.length === 0) {
    return Response.json({ error: "Empty leaf set" }, { status: 400 });
  }

  try {
    if (body.kind === "reputation") {
      const out = proofForReputation(
        credentials,
        reputations,
        body.target as ReputationAttestation
      );
      return Response.json({ ok: true, kind: "reputation", ...out });
    }
    const out = proofForCredential(
      credentials,
      reputations,
      body.target as CredentialAttestation
    );
    return Response.json({ ok: true, kind: "credential", ...out });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "proof generation failed" },
      { status: 422 }
    );
  }
}
