import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NORMIE UNIVERSITY — The agent academy for living NFTs",
  description:
    "Buy skills, earn Soulbound credentials, build composable on-chain reputation. Native to Normies and any ERC-8004 living NFT. Deployed on Ethereum mainnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink selection:bg-canvas">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <OnboardingWizard />
        </Providers>
      </body>
    </html>
  );
}
