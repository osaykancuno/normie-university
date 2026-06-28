import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Agent Tools (ERC-8257) · NORMIE UNIVERSITY",
  description:
    "NORMIE UNIVERSITY tools published to OpenSea's Agent Tool Registry (ERC-8257) — callable by any AI agent.",
};

/// The public registry coordinates, filled once the tools are registered.
/// Until then the cards show "Pending registration".
const OPENSEA_TOOLS = process.env.NEXT_PUBLIC_OPENSEA_TOOLS_URL ?? null;

type Tool = {
  slug: string;
  name: string;
  gated: boolean;
  summary: string;
  io: string;
};

const TOOLS: Tool[] = [
  {
    slug: "agent-console",
    name: "Plain-English Action Planner",
    gated: true,
    summary:
      "Turn an intent (\"stake 1 ETH on Lido\") into a certified skill + the exact transaction, with the best-rate edge. Non-custodial: returns a plan, never signs.",
    io: "intent, account → skill, to, data, edge",
  },
  {
    slug: "skill-verify",
    name: "Skill Completion Verifier",
    gated: false,
    summary:
      "Submit a proof tx; the fail-closed oracle checks it hit a declared contract + selector on the declared chain and returns a completion authorization (deadline + nonce).",
    io: "agent, skillId, txHash → verified, authorization",
  },
  {
    slug: "reputation-lookup",
    name: "Agent Reputation Lookup",
    gated: false,
    summary:
      "Read an agent's trustless 5-factor reputation straight from the on-chain ReputationEngine. Open, read-only.",
    io: "agent → score, skills, avgLevel, verified",
  },
  {
    slug: "identity-resolver",
    name: "Skills-Follow-the-NFT Resolver",
    gated: false,
    summary:
      "Resolve a Normie to its ERC-8004 identity and live controller (controllerOf == ownerOf) — the education that transfers when the NFT is sold.",
    io: "tokenId → identity, controller, skills",
  },
];

export default function ToolsPage() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.18),transparent_60%)]"
      />

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <Badge variant="outline" className="border-line-strong text-ink-soft">
          ERC-8257 · OpenSea Agent Tool Registry
        </Badge>
        <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-ink md:text-5xl">
          Our capabilities, as tools any agent can call
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-soft">
          NORMIE UNIVERSITY publishes its core abilities to{" "}
          <span className="text-ink">OpenSea&apos;s Agent Tool Registry</span> (ERC-8257).
          Each tool is a signed on-chain entry with a machine-readable manifest, x402-native
          payments, and on-chain access gating — discoverable and invocable by any AI agent.
        </p>
        <p className="mt-3 max-w-3xl text-sm text-ink-muted">
          First wave is <span className="text-ink-soft">free</span>; the Action Planner is{" "}
          <span className="text-ink-soft">gated to Normie holders</span> via the canonical
          ERC-721 owner predicate (gate checked on Ethereum, against the real Normies collection).
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          {TOOLS.map((t) => (
            <Card key={t.slug} className="border-line bg-surface">
              <CardContent className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant={t.gated ? "default" : "outline"}>
                    {t.gated ? "Normie-gated" : "Open"}
                  </Badge>
                  <code className="text-xs text-ink-muted">{t.slug}</code>
                </div>
                <h3 className="text-lg font-semibold text-ink">{t.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t.summary}</p>
                <div className="mt-4 font-mono text-xs text-ink-muted">{t.io}</div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <a
                    href={`/.well-known/ai-tool/${t.slug}.json`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-ink underline hover:underline"
                  >
                    Manifest →
                  </a>
                  {OPENSEA_TOOLS ? (
                    <a
                      href={OPENSEA_TOOLS}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-ink underline hover:underline"
                    >
                      View on OpenSea →
                    </a>
                  ) : (
                    <span className="text-ink-faint">Pending registration</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-xs text-ink-muted">
          Built on the official{" "}
          <a
            href="https://www.npmjs.com/package/@opensea/tool-sdk"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink-soft underline hover:underline"
          >
            @opensea/tool-sdk
          </a>
          . Manifests are RFC-8785 canonicalized and committed on-chain as a keccak256 hash;
          our independent canonicalizer is verified byte-for-byte against the SDK.
        </p>
      </section>
    </div>
  );
}
