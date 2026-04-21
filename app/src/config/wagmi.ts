import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ACTIVE_CHAIN } from "./chains";

export const wagmiConfig = getDefaultConfig({
  appName: "SKILLAI",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [ACTIVE_CHAIN],
  ssr: true,
});
