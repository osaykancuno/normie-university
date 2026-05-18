/// @file pinata.ts (server)
/// @notice Minimal Pinata client for pinning JSON skill modules.
///         Uses the Pinning API + a JWT stored in PINATA_JWT env var.
///         Docs: https://docs.pinata.cloud/api-reference/endpoint/pin-json

import "server-only";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_ENDPOINT =
  process.env.PINATA_ENDPOINT ||
  "https://api.pinata.cloud/pinning/pinJSONToIPFS";

export type PinnedResult = {
  cid: string;
  uri: `ipfs://${string}`;
  gatewayUrl: string;
  size: number;
};

export class PinataError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "PinataError";
  }
}

export function isPinataConfigured(): boolean {
  return !!PINATA_JWT;
}

export async function pinJson(
  data: unknown,
  opts?: { name?: string; keyvalues?: Record<string, string> }
): Promise<PinnedResult> {
  if (!PINATA_JWT) {
    throw new PinataError(
      "PINATA_JWT is not configured on the server. Set it in .env.local to enable IPFS uploads."
    );
  }

  const body: Record<string, unknown> = { pinataContent: data };
  if (opts?.name || opts?.keyvalues) {
    body.pinataMetadata = {
      name: opts?.name,
      keyvalues: opts?.keyvalues,
    };
  }

  const res = await fetch(PINATA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PinataError(
      `Pinata pin failed (${res.status}): ${text.slice(0, 300)}`,
      res.status
    );
  }

  const json = (await res.json()) as {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
  };

  const gateway = (
    process.env.IPFS_GATEWAY ||
    process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
    "https://ipfs.io/ipfs"
  ).replace(/\/$/, "");

  return {
    cid: json.IpfsHash,
    uri: `ipfs://${json.IpfsHash}`,
    gatewayUrl: `${gateway}/${json.IpfsHash}`,
    size: json.PinSize,
  };
}
