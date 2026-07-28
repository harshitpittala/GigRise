import { type InputHTMLAttributes, forwardRef, useId } from "react";

import { cn } from "../../lib/utils";
import { FormError } from "./form-error";

/**
 * TextField — DESIGN_SYSTEM.md §7 Inputs spec: "40px height (md), label
 * always above (never placeholder-as-label — accessibility requirement,
 * §12), helper/error text below in text.caption, error state swaps border
 * to color.error.500 + icon, never color-only."
 *
 * Only the `md` (40px / h-10) size exists here — the auth forms are the
 * only consumer so far and DESIGN_SYSTEM.md doesn't call for sm/lg input
 * sizes anywhere in scope yet.
 */
export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-body-sm font-weight-medium text-text-heading">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            "h-10 rounded-md border border-border-default bg-bg-surface px-3 text-body-md text-text-heading",
            "placeholder:text-text-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500",
            "disabled:pointer-events-none disabled:opacity-50",
            error && "border-error-500",
            className,
          )}
          {...props}
        />
        {error ? (
          <FormError id={errorId}>{error}</FormError>
        ) : helperText ? (
          <p id={helperId} className="text-caption text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = "TextField";
