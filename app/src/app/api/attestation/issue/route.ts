/// @file /api/attestation/issue
/// @notice Server-side EIP-712 attestation issuance for lazy-mint credentials.
///
/// Flow:
///   1. Agent triggers skill completion (already verified — auto or manual)
///   2. Server signs an EIP-712 SkillAttestation with ATTESTATION_SIGNER key
///   3. Agent receives { signature, deadline, agent, skillId, level, score }
///   4. Agent can later call SkillCredential.mintFromAttestation() to mint
///      a permanent on-chain SBT — they pay gas at that time
///
/// This is the L1 cost-optimised path: skill purchases happen off-chain
/// (x402 USDC), credentials are server-signed attestations (free), and only
/// the explicit on-chain commit costs gas. Most users never need to mint.

import { isAddress, type Hex, hexToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { verifySkillCompletion } from "@/lib/server/verifier";
import { getAddresses } from "@/lib/contracts";
import { ACTIVE_CHAIN } from "@/config/chains";

const ATTESTATION_TYPEHASH = "SkillAttestation(address agent,uint256 skillId,uint8 level,uint256 score,uint256 deadline)";

const DEFAULT_VALIDITY = 30 * 24 * 3600; // 30 days

function isConfigured(): boolean {
  return !!process.env.ATTESTATION_SIGNER_PRIVATE_KEY;
}

export async function POST(req: Request) {
  if (!isConfigured()) {
    return Response.json(
      {
        error:
          "Attestation signer is not configured on this server. Set ATTESTATION_SIGNER_PRIVATE_KEY and grant ATTESTATION_SIGNER role on SkillCredential to the corresponding address.",
      },
      { status: 501 }
    );
  }

  let body: { agent?: string; skillId?: string; txHash?: string };
  try {
    body = (await req.json()) as { agent?: string; skillId?: string; txHash?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.agent || !isAddress(body.agent)) {
    return Response.json({ error: "Invalid or missing 'agent' address" }, { status: 400 });
  }
  if (!body.skillId) {
    return Response.json({ error: "Missing 'skillId'" }, { status: 400 });
  }
  let skillId: bigint;
  try { skillId = BigInt(body.skillId); }
  catch { return Response.json({ error: "Invalid 'skillId'" }, { status: 400 }); }
  let txHash: Hex | undefined;
  if (body.txHash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(body.txHash)) {
      return Response.json({ error: "Invalid 'txHash'" }, { status: 400 });
    }
    txHash = body.txHash as Hex;
  }

  // Step 1 — Verify completion (runs the auto-verifier rule)
  const verified = await verifySkillCompletion({
    agent: body.agent as `0x${string}`,
    skillId,
    txHash,
  });
  if (!verified.ok) {
    return Response.json(verified, { status: 422 });
  }

  // Step 2 — Sign EIP-712 attestation
  const pk = process.env.ATTESTATION_SIGNER_PRIVATE_KEY as Hex;
  const account = privateKeyToAccount(pk);
  const addr = getAddresses();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_VALIDITY);

  const signature = await account.signTypedData({
    domain: {
      name: "NORMIE UNIVERSITY Credential",
      version: "1",
      chainId: ACTIVE_CHAIN.id,
      verifyingContract: addr.SkillCredential,
    },
    types: {
      SkillAttestation: [
        { name: "agent",    type: "address" },
        { name: "skillId",  type: "uint256" },
        { name: "level",    type: "uint8"   },
        { name: "score",    type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "SkillAttestation",
    message: {
      agent: verified.agent,
      skillId: BigInt(verified.skillId),
      level: verified.level,
      score: BigInt(verified.score),
      deadline,
    },
  });

  void hexToBytes; // keep import for runtime parity
  void ATTESTATION_TYPEHASH; // typehash is computed in-contract; we expose it for clients that want to verify locally

  return Response.json({
    ok: true,
    attestation: {
      agent: verified.agent,
      skillId: verified.skillId,
      level: verified.level,
      score: verified.score,
      deadline: deadline.toString(),
      signature,
      signer: account.address,
    },
    typehash: ATTESTATION_TYPEHASH,
    domain: {
      name: "NORMIE UNIVERSITY Credential",
      version: "1",
      chainId: ACTIVE_CHAIN.id,
      verifyingContract: addr.SkillCredential,
    },
    onchain: {
      contract: addr.SkillCredential,
      function: "mintFromAttestation",
      args: [verified.agent, verified.skillId, verified.level, verified.score, deadline.toString(), signature],
      hint: "Submit this to SkillCredential.mintFromAttestation(...) when you want a permanent on-chain SBT. You pay ~$5-15 in gas at submission time. Most agents skip this and rely on the off-chain attestation alone.",
    },
  });
}
