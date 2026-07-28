/**
 * Auth route-group layout — DESIGN_SYSTEM.md §5: "Authentication: Centered
 * single card, container.sm width, no app shell, no sidebar." Applies to
 * /login and /signup (this phase, P1-T4). Forgot/reset password (P1-T8)
 * will land in this same group once built, since §19.1 places all four
 * screens in this identical layout.
 *
 * A route group (parentheses) keeps URLs flat (`/login`, not
 * `/auth/login`) per ARCHITECTURE.md §6's page list, while still sharing
 * this minimal-chrome shell distinct from the app shell other routes use.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-app p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
