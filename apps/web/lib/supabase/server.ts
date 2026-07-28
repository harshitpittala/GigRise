import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client — used from Server Components, Server
 * Actions, and Route Handlers. Reads/writes the request's cookie jar
 * directly (AUTHENTICATION.md §7's "SDK's server-side helpers attach it
 * to requests"), which is what keeps the access/refresh token out of
 * client-readable JavaScript entirely.
 *
 * The try/catch around `setAll` is the standard, documented pattern for
 * this client: Server Components can't set cookies (Next.js throws), but
 * that's harmless here because the middleware below (middleware.ts) is
 * what actually refreshes and persists the session on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore since
            // middleware.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}
