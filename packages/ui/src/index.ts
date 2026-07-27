// Phase 0 (Environment & Repository Setup): exports the shared cn()
// utility, the theme.css token file (imported via
// "@gigrise/ui/styles/theme.css"), and the Button component — added to
// close IMPLEMENTATION_PLAN.md task P0-T7's acceptance criterion ("A
// Button component renders with correct gold/indigo tokens in both
// themes").
//
// No other components exist yet — the rest of the component library
// (Card, StatusPill, etc., DESIGN_SYSTEM.md §7) is added once real
// frontend feature work begins (Phase 4+), not preemptively here.
export { cn } from "./lib/utils";
export { Button, type ButtonProps } from "./components/ui/button";
