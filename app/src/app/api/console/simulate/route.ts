/// @file /api/console/simulate
/// @notice Dry-runs a built Console transaction with eth_call on its target
///         chain BEFORE the user signs, so a tx that would revert (paused
///         contract, bad params, missing approval, insufficient balance) is
///         caught and explained — not signed and lost to gas. Pure read; signs
///         nothing, moves nothing.

import { isAddress, type Hex } from "viem";
import { getProviderForChain } from "@/lib/server/chains-rpc";

export async function POST(req: Request) {
  let body: { chainId?: number; from?: string; to?: string; data?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { chainId, from, to, data } = body;
  if (!chainId || !from || !to || !isAddress(from) || !isAddress(to)) {
    return Response.json({ error: "Missing/invalid chainId, from or to" }, { status: 400 });
  }
  let value: bigint;
  try {
    value = BigInt(body.value ?? "0");
  } catch {
    return Response.json({ error: "Invalid value" }, { status: 400 });
  }

  const client = getProviderForChain(chainId);
  if (!client) {
    return Response.json({ ok: null, reason: `No RPC for chain ${chainId} — simulation skipped` });
  }

  try {
    await client.call({
      account: from as `0x${string}`,
      to: to as `0x${string}`,
      data: (data ?? "0x") as Hex,
      value,
    });
    return Response.json({ ok: true });
  } catch (e) {
    // viem surfaces the revert reason / short message here.
    const reason =
      (e as { shortMessage?: string })?.shortMessage ??
      (e instanceof Error ? e.message.split("\n")[0] : "Transaction would revert");
    return Response.json({ ok: false, reason });
  }
}
