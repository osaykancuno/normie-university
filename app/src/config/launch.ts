/// @file launch.ts
/// @notice Launch-stage flag. While in "coming_soon" the app is a public
///         preview: wallet connection and skill purchases are intentionally
///         disabled so nobody mistakes the demo for a live mainnet product.
///         Flip NEXT_PUBLIC_LAUNCH_MODE to "live" at mainnet launch.

export type LaunchMode = "coming_soon" | "live";

export const LAUNCH_MODE: LaunchMode =
  process.env.NEXT_PUBLIC_LAUNCH_MODE === "live" ? "live" : "coming_soon";

/// True while the product is in pre-launch preview. Components use this to
/// swap the wallet ConnectButton for a "coming soon" affordance and to gate
/// any flow that would otherwise attempt an on-chain transaction.
export const IS_COMING_SOON = LAUNCH_MODE === "coming_soon";
