# config/

Repo-root tooling config: CI workflow definitions, Renovate/Dependabot config, commitlint config (`PROJECT_SETUP.md` §2).

At Phase 0.1 (Repository & Monorepo Foundation) this holds only `commitlint.config.js`, since Conventional Commits enforcement (`MASTER_DEVELOPMENT_GUIDE.md` §5) is part of the Husky setup this phase includes. GitHub Actions workflow files and Renovate/Dependabot config are explicitly deferred to Phase 0's CI-pipeline sub-task (`IMPLEMENTATION_PLAN.md` Phase 0, task P0-T6) — not part of this task's scope.
