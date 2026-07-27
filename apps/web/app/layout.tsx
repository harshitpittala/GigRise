import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

/**
 * Font configuration (PROJECT_SETUP.md §1.1 / DESIGN_SYSTEM.md §3).
 *
 * Provisional placeholder choices, not a locked brand decision —
 * DESIGN_SYSTEM.md §3 specifies "Inter or a licensed equivalent" (ui) and
 * "a refined serif or distinctive display sans... reserved exclusively for
 * marketing/landing headlines" (display), acknowledging in §21 that final
 * brand identity/typeface calibration is a separate future pass. Inter
 * (ui), Fraunces (display), JetBrains Mono (mono) are reasonable concrete
 * choices for that placeholder, swappable without touching any other file
 * since every component reads the semantic --font-ui/--font-display/--font-mono
 * variables, never a font name directly.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const displaySerif = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GigRise",
  description: "GigRise — repository scaffold (Phase 0.2). No product UI yet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${displaySerif.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
