import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client — same pattern as apps/web/lib/supabase/client.ts.
 * See that file's comment for the full explanation.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
