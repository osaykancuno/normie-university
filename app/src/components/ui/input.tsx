import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full border border-line bg-surface px-3 py-2 text-sm text-ink",
        "placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-line-strong/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
