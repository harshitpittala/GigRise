// Root-level ESLint v9 flat config.
//
// Why this file exists (root cause of the lint-staged/pre-commit failure):
// ESLint v9's flat config resolves eslint.config.{js,mjs,cjs} by searching
// upward from `process.cwd()` — it does not search downward into
// subdirectories. `pnpm lint` (via `turbo run lint`) never hit this
// because Turborepo runs each package's own "lint" script with cwd set to
// that package's directory, where a local eslint.config.mjs/js already
// sits. `lint-staged`, invoked by Husky's pre-commit hook, always runs
// from the git repository root — and until this file existed, there was
// no config discoverable from that cwd at all, so ESLint failed
// immediately with "couldn't find an eslint.config.(js|mjs|cjs) file,"
// regardless of which files were staged.
//
// This file imports the exact same shared preset every app/package's own
// eslint.config already uses (packages/config/eslint-preset.js), so a
// file linted via this root entry point (lint-staged) is checked against
// identical rules to a file linted via its own package's config
// (`pnpm lint`) — one ruleset, two valid entry points to it.
import preset from "@gigrise/config/eslint-preset.js";

export default [
  ...preset,
  {
    // Matches the next-env.d.ts ignore already present in apps/web and
    // apps/admin's own eslint.config.mjs — needed here too since this
    // config is what actually runs when lint-staged lints a staged file
    // from either app.
    ignores: ["**/next-env.d.ts"],
  },
];
