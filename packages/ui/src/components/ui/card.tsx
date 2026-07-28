import { type HTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/utils";

/**
 * Card — DESIGN_SYSTEM.md §7: "One base Card primitive (radius radius.md,
 * bg.surface, border.default, optional shadow.sm on hover) with slot-based
 * content." Added for Phase 1.2 (P1-T4) to host the auth screens' single
 * card per §19.1/§5 ("Centered single card, container.sm width, no app
 * shell, no sidebar"). Deliberately no header/footer sub-components yet —
 * the auth forms only need the plain surface.
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-md border border-border-default bg-bg-surface p-8 hover:shadow-sm",
        className,
      )}
      {...props}
    />
  ),
);

Card.displayName = "Card";
