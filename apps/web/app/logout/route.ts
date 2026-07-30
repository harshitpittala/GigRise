import { NextResponse } from "next/server";

import { createClient } from "../../lib/supabase/server";

/**
 * Logout — POST-only Route Handler (no UI, so it sits outside the
 * `(auth)` group). AUTHENTICATION.md §6: Supabase owns session
 * invalidation; this just calls signOut() and redirects to /login.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url));
}
