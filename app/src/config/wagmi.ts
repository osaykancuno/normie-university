import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { ACTIVE_CHAIN } from "./chains";

/// WalletConnect Cloud projectId. Optional now: injected/browser-extension
/// wallets (MetaMask, Brave, Coinbase extension, Rabby…) connect WITHOUT
/// WalletConnect, so a missing/invalid/un-allowlisted projectId can never block
/// them. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (https://cloud.reown.com) to
/// also enable QR / mobile WalletConnect wallets.
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "skillai-dev-placeholder";

/// injectedWallet + metaMaskWallet are listed FIRST and do not depend on
/// WalletConnect — the desktop browser-extension path is always available.
/// walletConnect-based wallets are offered too, but only matter when a real
/// projectId is configured.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [injectedWallet, metaMaskWallet, coinbaseWallet],
    },
    {
      groupName: "More",
      wallets: [rainbowWallet, walletConnectWallet],
    },
  ],
  { appName: "NORMIE UNIVERSITY", projectId: WC_PROJECT_ID }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [ACTIVE_CHAIN],
  // Transports for every chain id the union type allows; only ACTIVE_CHAIN is
  // actually used at runtime.
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
});
