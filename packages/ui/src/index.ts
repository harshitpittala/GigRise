// Phase 0 (Environment & Repository Setup): exports the shared cn()
// utility, the theme.css token file (imported via
// "@gigrise/ui/styles/theme.css"), and the Button component — added to
// close IMPLEMENTATION_PLAN.md task P0-T7's acceptance criterion ("A
// Button component renders with correct gold/indigo tokens in both
// themes").
//
// Phase 1.2 (P1-T4, Signup/Login/Logout screens) adds Card, TextField,
// and FormError — the remaining DESIGN_SYSTEM.md §7 primitives those
// screens require. The rest of the component library (StatusPill, etc.)
// is still added once real frontend feature work begins (Phase 4+).
export { cn } from "./lib/utils";
export { Button, type ButtonProps } from "./components/ui/button";
export { Card } from "./components/ui/card";
export { TextField, type TextFieldProps } from "./components/ui/text-field";
export { FormError } from "./components/ui/form-error";
