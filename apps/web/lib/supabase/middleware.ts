import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Session-refresh helper, invoked by the root middleware.ts on every
 * request. This is deliberately session-refresh ONLY — no route
 * protection, no redirect logic, no role/permission checks. Route
 * guarding is Phase 2 (RBAC & Authorization) territory
 * (IMPLEMENTATION_PLAN.md task P2-T4, "Frontend route-guard utility") —
 * adding it here now would be exactly the kind of premature milestone
 * work this phase's scope explicitly excludes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Required: this call is what actually refreshes an expiring session.
  // Removing it (even though the result isn't used directly here) would
  // silently break session persistence — the standard Supabase SSR
  // pattern, not a GigRise-specific detail.
  await supabase.auth.getUser();

  return supabaseResponse;
}
