"use client";

import { useState, useRef, useEffect } from "react";

/// Drop-in replacement for RainbowKit's <ConnectButton/> while the product
/// is in pre-launch preview. It does NOT open a wallet modal — clicking it
/// reveals a short explainer so visitors understand the demo isn't live
/// yet and no wallet is needed. Prevents "connect → buy" confusion.
export function ComingSoonButton({
  variant = "solid",
}: {
  /// "solid" — header pill; "block" — full-width in panels
  variant?: "solid" | "block";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className={variant === "block" ? "relative w-full" : "relative"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          variant === "block"
            ? "w-full border border-line-strong bg-ink px-4 py-2.5 text-sm font-semibold text-paper mono uppercase tracking-wide hover:opacity-90"
            : "shrink-0 border border-line-strong bg-ink px-3 py-1.5 text-[12px] font-semibold text-paper mono uppercase tracking-wide hover:opacity-90"
        }
      >
        Launching soon
      </button>

      {open && (
        <div
          className={
            "absolute right-0 z-50 mt-2 w-[300px] border border-line-strong bg-paper p-4 text-left shadow-[0_8px_32px_rgba(0,0,0,0.12)]" +
            (variant === "block" ? " left-0 right-auto w-full" : "")
          }
        >
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent-warn)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--accent-warn)]" />
            </span>
            <span className="mono text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-warn)]">
              Public preview
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
            NORMIE UNIVERSITY is in final testing. Wallet connection and skill
            purchases go live with the audited mainnet release —{" "}
            <strong className="text-ink">coming soon</strong>.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            For now you can browse the full catalogue, inspect every skill
            module, and explore the agent directory — no wallet needed, nothing
            to spend.
          </p>
        </div>
      )}
    </div>
  );
}
