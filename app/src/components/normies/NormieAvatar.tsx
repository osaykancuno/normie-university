"use client";

import { useNormiesOf } from "@/hooks/useNormies";
import { cn } from "@/lib/utils";

/// Renders a Normie pixel-art avatar for the given address if the wallet
/// holds at least one Normie. Falls back to a NORMIE UNIVERSITY gradient placeholder
/// otherwise, so the component is safe to drop into any profile slot.
///
/// Source: https://api.normies.art/normie/{id}/image.svg
export function NormieAvatar({
  address,
  size = 56,
  className,
}: {
  address: `0x${string}` | undefined;
  size?: number;
  className?: string;
}) {
  const { data } = useNormiesOf(address);
  const px = `${size}px`;

  if (!address) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-none bg-surface-2 text-ink-muted",
          className
        )}
        style={{ width: px, height: px }}
      >
        ?
      </div>
    );
  }

  if (data?.isHolder && data.tokenIds.length > 0) {
    const tokenId = data.tokenIds[0];
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://api.normies.art/normie/${tokenId}/image.svg`}
        alt={`Normie #${tokenId}`}
        width={size}
        height={size}
        className={cn(
          "rounded-none bg-[#e3e5e4] ring-1 ring-line-strong",
          className
        )}
        style={{ imageRendering: "pixelated" }}
      />
    );
  }

  // Default fallback — NORMIE UNIVERSITY gradient
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-none bg-gradient-to-br from-ink to-line-strong font-bold text-white",
        className
      )}
      style={{ width: px, height: px, fontSize: size * 0.36 }}
    >
      {address.slice(2, 4).toUpperCase()}
    </div>
  );
}
