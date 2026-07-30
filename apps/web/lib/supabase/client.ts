import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (AUTHENTICATION.md §7: "Web (Browser):
 * httpOnly cookie, managed by @supabase/ssr — GigRise's Next.js apps
 * never read the raw token from JS"). Used from Client Components only —
 * Server Components/Actions use ./server.ts instead, since they need the
 * request's cookie jar rather than the browser's.
 *
 * Not yet connected to a real project — no Supabase project has been
 * provisioned yet (IMPLEMENTATION_PLAN.md task P0-T3, still blocked on
 * external account creation). This file is the client-construction
 * architecture that will work unchanged once real
 * NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY values exist.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
