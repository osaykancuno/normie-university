/// @file /api/normies/holder/[address]
/// @notice Proxy + cached lookup of a wallet's Normie holdings.
///         Backed by https://api.normies.art/holders/{address}.

import { isAddress } from "viem";
import { getHolderTokens, NormiesApiError } from "@/lib/server/normies";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/normies/holder/[address]">
) {
  const { address } = await ctx.params;
  if (!isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const res = await getHolderTokens(address as `0x${string}`);
    return Response.json(
      {
        chain: { id: 1, name: "Ethereum" },
        address: res.address,
        tokenIds: res.tokenIds,
        isHolder: res.tokenIds.length > 0,
        count: res.tokenIds.length,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (e) {
    if (e instanceof NormiesApiError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
