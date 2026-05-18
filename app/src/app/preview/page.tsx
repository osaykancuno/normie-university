"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/// Pre-school landing — visitors enter a Normie tokenId and see a preview
/// of the persona BEFORE awakening. Drives both Normies-curious traffic and
/// pre-purchase intent: "see who your Normie will be, then come back and
/// equip them with skills."
export default function PreviewIndexPage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = Number(input.trim());
    if (!Number.isInteger(n) || n < 0 || n > 9999) {
      setError("Enter a Normie token id between 0 and 9999.");
      return;
    }
    router.push(`/preview/${n}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge>Pre-school</Badge>
        <Badge variant="outline">No wallet needed</Badge>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">
        Meet your Normie&apos;s{" "}
        <span className="border-b-4 border-line-strong">agent</span>{" "}
        before awakening.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        Every Normie&apos;s personality is generated deterministically from
        on-chain bytes — traits, canvas state, transformation count. Type any
        token id and we&apos;ll show you the persona it will become, with a
        curriculum already tailored to its traits.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Normie token id (0–9999)"
          inputMode="numeric"
          className="sm:max-w-xs"
        />
        <Button type="submit">Preview persona →</Button>
      </form>

      {error && (
        <p className="mt-3 text-xs text-[color:var(--accent-err)]">{error}</p>
      )}

      <div className="rule my-12" />

      <div className="grid gap-0 md:grid-cols-3">
        {[
          {
            n: "01",
            title: "Look",
            body: "Pixel art rendered live from the Normies API. Canvas-aware: customized Normies show their current state.",
          },
          {
            n: "02",
            title: "Persona",
            body: "Name, tagline, 8-layer personality, communication style, quirks, and greeting — regenerated from on-chain bytes every call.",
          },
          {
            n: "03",
            title: "Curriculum",
            body: "Type, traits, level, and canvas history feed our recommendation engine. See the skills that match this Normie before you commit.",
          },
        ].map((c) => (
          <div
            key={c.title}
            className="border border-line bg-surface p-6 md:[&:not(:first-child)]:border-l-0"
          >
            <div className="mb-3 mono text-xs text-ink-muted">{c.n}</div>
            <h3 className="text-lg font-semibold text-ink">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-ink-muted">
        Try a few:{" "}
        {[42, 100, 1337, 4354, 7777].map((id, i) => (
          <span key={id}>
            <Link href={`/preview/${id}`} className="underline hover:text-ink">
              #{id}
            </Link>
            {i < 4 ? "  ·  " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}
