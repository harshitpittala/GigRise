import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

/**
 * Font configuration (PROJECT_SETUP.md §1.1 / DESIGN_SYSTEM.md §3).
 * No display-serif font is loaded here — see the note in globals.css:
 * the CRM has no marketing/landing pages, so the display typeface (which
 * DESIGN_SYSTEM.md §3 reserves exclusively for those) is never used here.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GigRise Admin",
  description: "GigRise Admin/CRM — repository scaffold (Phase 0.2). No product UI yet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
