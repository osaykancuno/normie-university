"use client";

import { useNormiesOf } from "@/hooks/useNormies";
import { Badge } from "@/components/ui/badge";

/// Pill shown next to an agent's identity if they hold a Normie on Ethereum
/// mainnet. Renders nothing for non-holders, so it can be unconditionally
/// included in profile / dashboard layouts.
export function NormieHolderBadge({ address }: { address: `0x${string}` | undefined }) {
  const { data, isLoading } = useNormiesOf(address);
  if (!address || isLoading) return null;
  if (!data?.isHolder) return null;
  const primary = data.tokenIds[0];
  const count = data.count;

  return (
    <Badge variant="default" className="border-violet-500/40">
      Normie #{primary}
      {count > 1 ? ` (+${count - 1})` : ""}
    </Badge>
  );
}
