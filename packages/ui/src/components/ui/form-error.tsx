import { AlertCircle } from "lucide-react";
import { type HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

/**
 * FormError — DESIGN_SYSTEM.md §7 Inputs spec: "error state swaps border
 * to color.error.500 + icon, never color-only." This is the shared
 * icon+message primitive for both field-level errors (under TextField)
 * and form-level errors (e.g. a rejected Supabase auth call).
 */
export function FormError({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className={cn("flex items-center gap-1.5 text-caption text-error-500", className)}
      {...props}
    >
      <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}
