"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";

import { wagmiConfig } from "@/config/wagmi";

/// Root client-side providers — wagmi, react-query, RainbowKit.
/// Theme palette aligned with the Normies-inspired NORMIE UNIVERSITY design:
///   ink (charcoal) #48494b · paper (cream) #f5f4f0 · canvas #e3e5e4
/// Squared corners + monospace mark match the rest of the UI.
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: "#48494b",          // ink — charcoal
            accentColorForeground: "#f5f4f0", // paper — cream
            borderRadius: "none",            // squared, matches Normies aesthetic
            fontStack: "system",
            overlayBlur: "small",
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
