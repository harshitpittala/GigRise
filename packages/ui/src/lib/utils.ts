import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard shadcn/ui class-merging helper — combines conditional class
 * names (clsx) with Tailwind conflict resolution (tailwind-merge), so a
 * later utility class always wins over an earlier conflicting one.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
