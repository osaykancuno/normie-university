import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/// Normies-style badges — flat, mono, bordered. No rounded pills.
const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider mono",
  {
    variants: {
      variant: {
        default:     "border border-line-strong text-ink bg-surface",
        secondary:   "border border-line text-ink-soft bg-surface-2",
        outline:     "border border-line text-ink bg-transparent",
        success:     "border border-[color:var(--accent-ok)] text-[color:var(--accent-ok)] bg-transparent",
        warning:     "border border-[color:var(--accent-warn)] text-[color:var(--accent-warn)] bg-transparent",
        destructive: "border border-[color:var(--accent-err)] text-[color:var(--accent-err)] bg-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
