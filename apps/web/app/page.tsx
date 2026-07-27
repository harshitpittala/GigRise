import { Button } from "@gigrise/ui";

export default function Home() {
  // Still a placeholder scaffold, not a product page — Phase 0 excludes
  // application pages and features. The Button variants below exist only
  // to satisfy IMPLEMENTATION_PLAN.md task P0-T7's acceptance criterion
  // ("A Button component renders with correct gold/indigo tokens in both
  // themes"), which the theme/token wiring alone never actually proved.
  // Real pages are built starting with IMPLEMENTATION_PLAN.md's later phases.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <p>GigRise — apps/web scaffold. No product UI yet.</p>
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tertiary">Tertiary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="primary" isLoading>
          Loading
        </Button>
      </div>
    </main>
  );
}
