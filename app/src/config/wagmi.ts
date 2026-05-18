import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ACTIVE_CHAIN } from "./chains";

/// WalletConnect Cloud requires a non-empty projectId at config build time.
/// In dev / CI we fall back to a placeholder so the build passes; injected
/// wallets (MetaMask, Coinbase Wallet, etc.) still work. For production set
/// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to a real projectId from
/// https://cloud.walletconnect.com to enable WalletConnect-based wallets.
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "skillai-dev-placeholder";

export const wagmiConfig = getDefaultConfig({
  appName: "NORMIE UNIVERSITY",
  projectId: WC_PROJECT_ID,
  chains: [ACTIVE_CHAIN],
  ssr: true,
});
