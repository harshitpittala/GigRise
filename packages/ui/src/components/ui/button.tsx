import { Loader2 } from "lucide-react";
import { type VariantProps, cva } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/utils";

/**
 * Button — DESIGN_SYSTEM.md §7: "Primary (gold fill), Secondary (indigo
 * outline), Tertiary (text-only, indigo), Destructive (error-red outline,
 * fills solid on hover). Sizes sm/md/lg (32/40/48px height). Every button
 * has a loading state where the label is replaced by a spinner at fixed
 * width (no layout shift)."
 *
 * This is the first component in `packages/ui` — added specifically to
 * satisfy IMPLEMENTATION_PLAN.md Phase 0 task P0-T7's acceptance
 * criterion ("A Button component renders with correct gold/indigo tokens
 * in both themes"), which the token/theme wiring alone (done in a prior
 * phase) never actually proved end-to-end. It is shared design-system
 * infrastructure, not a GigRise product feature — it has no knowledge of
 * any domain concept (talent, campaigns, contracts, etc.).
 */
const buttonVariants = cva(
  // Base styles common to every variant: §3's "600 semibold, all headings
  // and buttons"; §17's radius-md (8px); §13's press micro-interaction
  // (1px translate-down, 100ms) applied via the `active:` variant.
  "inline-flex items-center justify-center gap-2 rounded-md font-ui text-body-md font-weight-semibold " +
    "transition-[transform,background-color,border-color,color,box-shadow] duration-[var(--duration-instant)] " +
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500",
  {
    variants: {
      variant: {
        // Primary: gold fill (§2.2) — the platform's single "premium
        // moment" per screen (§1) — never used more than once per view.
        primary: "bg-gold-500 text-neutral-0 hover:bg-gold-700",
        // Secondary: indigo outline — the default interactive action color (§2.3).
        secondary: "border border-indigo-500 bg-transparent text-indigo-500 hover:bg-indigo-100",
        // Tertiary: text-only, indigo, no border/fill until hovered.
        tertiary: "bg-transparent text-indigo-500 hover:bg-hover-surface",
        // Destructive: error-red outline, "fills solid on hover" (§7, verbatim).
        destructive:
          "border border-error-500 text-error-500 hover:bg-error-500 hover:text-neutral-0",
      },
      size: {
        // 32/40/48px heights (§7) — these map directly onto
        // @gigrise/ui's spacing tokens (space.8/10/12 = 32/40/48px, §4),
        // which is why the plain Tailwind h-8/h-10/h-12 utilities already
        // resolve to the exact right values here.
        sm: "h-8 px-3 text-body-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), "relative", className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {/* Loading state: spinner replaces the label at a FIXED width — the
            label stays in the layout (invisible, not removed) so the
            button never resizes when isLoading toggles (§7, verbatim: "no
            layout shift"). */}
        {isLoading && <Loader2 aria-hidden="true" className="absolute h-4 w-4 animate-spin" />}
        <span className={cn(isLoading && "invisible")}>{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";
