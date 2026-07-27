# config/

Repo-root tooling config: CI workflow definitions, Renovate/Dependabot config, commitlint config (`PROJECT_SETUP.md` §2).

Holds `commitlint.config.js` (Conventional Commits enforcement, `MASTER_DEVELOPMENT_GUIDE.md` §5, delivered during monorepo foundation work). GitHub Actions workflow files (`.github/workflows/ci.yml`) and Dependabot config (`.github/dependabot.yml`) — per `IMPLEMENTATION_PLAN.md` Phase 0 task P0-T6 — live under the repository's `.github/` directory rather than here, since that's the path GitHub itself requires for both; this folder's own purpose statement (repo-root tooling config) still covers them conceptually, they just can't physically live at `config/` and be discovered by GitHub's tooling.
