# GigRise

The professional operating system for the creator and casting economy — connecting Creators, Actors, Brands, and Casting Directors in one verified, trust-first network.

**This repository is in early scaffold state.** No product features exist yet — see [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) for the phased build order currently underway.

## Start Here

Every architectural, product, and process decision behind this codebase is documented in [`docs/`](./docs/) before it's implemented. Read these, in order, before making any change:

1. [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — product vision, roles, feature roadmap
2. [`DATABASE_ARCHITECTURE.md`](./docs/DATABASE_ARCHITECTURE.md) — data model
3. [`DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) — visual/UX system
4. [`API_SPECIFICATION.md`](./docs/API_SPECIFICATION.md) — REST API contract
5. [`AUTHENTICATION.md`](./docs/AUTHENTICATION.md) — Supabase Auth integration, RBAC
6. [`CRM_SPECIFICATION.md`](./docs/CRM_SPECIFICATION.md) — internal operations tooling
7. [`PROJECT_SETUP.md`](./docs/PROJECT_SETUP.md) — tech stack, repo/folder conventions, CI/CD
8. [`CROSS_DOCUMENT_REVIEW.md`](./docs/CROSS_DOCUMENT_REVIEW.md) — pre-implementation consistency audit
9. [`CHANGELOG.md`](./docs/CHANGELOG.md) — every amendment to any document above
10. [`DECISIONS.md`](./docs/DECISIONS.md) — architecture decision record (the _why_)
11. [`IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — phased execution roadmap
12. [`MASTER_DEVELOPMENT_GUIDE.md`](./docs/MASTER_DEVELOPMENT_GUIDE.md) — **the rules every change in this repo must follow**

## Repository Structure

```
gigrise/
├── apps/
│   ├── web/       # Talent/Hirer web app — Next.js 15
│   ├── admin/     # Admin/Super Admin CRM — Next.js 15
│   └── api/       # Backend — FastAPI (Python, managed with uv)
├── packages/
│   ├── ui/        # Shared component library (empty until frontend feature work begins)
│   ├── types/     # Shared TypeScript types, generated from the OpenAPI spec once it exists
│   ├── utils/     # Shared pure TS helpers
│   └── config/    # Shared ESLint/TSConfig presets
├── docs/          # The eleven documents above — the single source of truth
├── scripts/       # One-off/maintenance scripts (seed data, codegen) — empty at this stage
├── shared/        # Non-code brand/illustration assets — empty at this stage
└── config/        # Repo-root tooling config (commitlint; CI/Renovate config deferred)
```

## Prerequisites

- Node.js ≥ 20, [pnpm](https://pnpm.io/) 9.x
- Python ≥ 3.12, [uv](https://docs.astral.sh/uv/)
- Git

## Setup

```bash
pnpm install
cd apps/api && uv sync && cd ../..
cp .env.example .env.local                       # backend (apps/api) reads this
cp apps/web/.env.example apps/web/.env.local       # Next.js apps read their OWN .env.local,
cp apps/admin/.env.example apps/admin/.env.local   # not one from the monorepo root
# fill in real values locally; never commit any .env.local
```

## Common Commands

| Command           | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | Run all apps in development mode (via Turborepo) |
| `pnpm build`      | Build all apps/packages                          |
| `pnpm lint`       | Lint all apps/packages                           |
| `pnpm format`     | Format the repo with Prettier                    |
| `pnpm type-check` | Type-check all TypeScript packages               |

## Current Status

**Phase 0.1 — Repository & Monorepo Foundation** (per `IMPLEMENTATION_PLAN.md` Phase 0). No authentication, no database, no APIs, no UI pages, and no business logic exist yet — this is intentional and matches the current phase's explicit scope. Do not add any of those without first checking `docs/IMPLEMENTATION_PLAN.md` for the phase that governs them.

## How to Contribute

Read [`docs/MASTER_DEVELOPMENT_GUIDE.md`](./docs/MASTER_DEVELOPMENT_GUIDE.md) before opening a pull request — it defines coding rules, git workflow, testing requirements, and the checklist every PR must satisfy.
