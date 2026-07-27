"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { getQueryClient } from "@/lib/query-client";

/**
 * Global Providers (PROJECT_SETUP.md §1.1) — composes theme switching and
 * React Query. ThemeProvider uses `attribute="data-theme"` to match
 * DESIGN_SYSTEM.md §2.7's exact attribute name convention.
 */
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
