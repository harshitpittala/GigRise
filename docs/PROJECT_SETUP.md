# GigRise — Project Setup & Engineering Handbook
**Version 1.2 — Amended: Turborepo Added**
**Status:** Specification, now partially realized. `IMPLEMENTATION_PLAN.md` Phase 0.1 (Repository & Monorepo Foundation) has been implemented — the monorepo skeleton, tooling config, and empty app/package scaffolds described in this document now exist in the repository. No feature code (auth, database models, APIs, business logic, UI pages) exists yet; those remain governed by their respective later phases. Subordinate to [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md), [`API_SPECIFICATION.md`](./API_SPECIFICATION.md), [`AUTHENTICATION.md`](./AUTHENTICATION.md), and [`CRM_SPECIFICATION.md`](./CRM_SPECIFICATION.md). **v1.0's §0.1 flagged the Supabase Auth conflict as something needing a follow-up amendment — that amendment is now `AUTHENTICATION.md` v2.0, and this document's §0.1 below is updated to point to it as settled rather than pending.** v1.1 resolved two gaps `CROSS_DOCUMENT_REVIEW.md` §2.11/§2.21 identified: the silently-dropped Terraform/Kubernetes folder from `ARCHITECTURE.md` §11 (§2.1 below) and the absence of a concretely-named hosting platform (§10.1 below). **v1.2 adds Turborepo** to §6's package-management tooling, per the founder's explicit request during Phase 0.1 implementation (`DECISIONS.md` ADR-018). Recorded in `CHANGELOG.md`.

---

## 0. Stack-Driven Reconciliation — Read This Before Anything Else

Choosing a concrete tech stack is the first point in this project where a tool choice actively reshapes an already-finalized document, rather than just implementing what was already specified in tool-agnostic terms. Two decisions in particular need explicit treatment:

### 0.1 Supabase Auth vs. `AUTHENTICATION.md`'s custom auth design — the big one
`AUTHENTICATION.md` designed a fully bespoke authentication system: a self-owned `users` table holding `password_hash` directly, self-issued RS256 JWTs, custom `sessions`/`refresh_tokens` tables with hand-built rotation and replay detection, custom TOTP enrollment, custom account-lockout logic. **Supabase Auth (GoTrue) is a hosted identity service that owns all of this itself** — it has its own internal `auth.users` table, issues its own JWTs (signed with Supabase-managed keys, verifiable via its JWKS endpoint), manages its own sessions/refresh-token rotation, and has built-in TOTP MFA and OAuth provider handling. Adopting it as requested **does** conflict with `AUTHENTICATION.md` §2 and `DATABASE_ARCHITECTURE.md` §2 if read literally — it does not merely implement them.

**Resolution adopted for this document (flagged for a follow-up amendment to those two documents, not silently overriding them):**
- Supabase Auth becomes the credential/session authority. It owns email/password verification, password hashing, OAuth code exchange, JWT issuance, and refresh-token rotation.
- GigRise's own `public.users` table (`DATABASE_ARCHITECTURE.md` §2) is **redefined as a 1:1 extension of `auth.users`**, keyed by the same UUID (`public.users.id = auth.users.id`), holding only GigRise-specific fields (`role`, `status`, `mfa_enabled` mirrored from Supabase for query convenience) — **not** `password_hash`, which no longer belongs to our schema at all.
- `sessions` and `refresh_tokens` (`DATABASE_ARCHITECTURE.md` §2) are **superseded by Supabase Auth's own session management** and are not built as originally specified. GigRise's FastAPI backend verifies the Supabase-issued JWT (via JWKS) rather than signing its own.
- `oauth_accounts` (`DATABASE_ARCHITECTURE.md` §2) is likewise superseded — Supabase Auth's `auth.identities` table already tracks linked providers.
- **What remains fully valid, unaffected by this change:** the `roles`/`permissions`/`role_permissions`/`user_roles` RBAC layer (`DATABASE_ARCHITECTURE.md` §2, `AUTHENTICATION.md` §4–5), the entire verification workflow (§4 of `AUTHENTICATION.md`), account lockout/rate-limiting *policy* (now enforced via Supabase Auth's configuration + our own gateway-level rate limiting rather than hand-rolled tables), audit logging, and every RLS-based authorization pattern — all of that sits **on top of** whichever service issues the identity token, and none of it assumed a specific issuer.
- **Status: resolved.** The amendment pass this section called for has been completed — `AUTHENTICATION.md` v2.0 and `DATABASE_ARCHITECTURE.md` v1.1 now reflect this reconciliation directly rather than describing the pre-Supabase custom design. This §0.1 remains in place as the historical record of *why* the change happened, per `DECISIONS.md` ADR-001; the two amended documents are the authoritative *current* specification.

### 0.2 Supabase as a single Postgres instance vs. `ARCHITECTURE.md` §11's per-service datastores
`ARCHITECTURE.md` §11 sketched `messaging-service`, `payments-service`, `media-service`, etc. as separately deployable services, implying separate datastores per §23's scaling narrative ("dedicated search store, dedicated messaging store... from day one"). Supabase is one managed Postgres instance — at MVP, **every table in `DATABASE_ARCHITECTURE.md` lives in that one database**, including `messages`, `conversations`, and `wallet_transactions`. This document treats this as a **deliberate MVP-stage interpretation, not a contradiction**, because `ARCHITECTURE.md` §23 itself frames physical service/datastore separation as something to activate "once volume justifies it," not a day-one requirement. Concretely: GigRise ships as **one FastAPI monolith (`apps/api`) organized into internal modules matching the `services/*` names from `ARCHITECTURE.md` §11** (§4 below) — the code is already service-boundary-shaped, so extracting `messaging-service` into its own deployment and datastore later is a deployment change, not a rewrite, which is exactly the property §23 was optimizing for in the first place.

### 0.3 Razorpay implicitly answers an open founder question
`ARCHITECTURE.md` §24 listed "initial launch geography" as an open founder decision, suggesting Stripe Connect as the natural payment-processor fit. Choosing **Razorpay** (India-focused, though it supports international cards) strongly implies an India-first (or India-inclusive) launch geography — Razorpay's escrow-adjacent primitive is **Route** (split settlements) rather than Stripe Connect's more turnkey marketplace-escrow tooling, so GigRise's escrow behavior (`DATABASE_ARCHITECTURE.md` §12) will be implemented as **our own `escrow_holds`/`wallet_transactions` ledger holding the true escrow state, with Razorpay used only as the money-in/money-out rail** (via Orders API + Route + RazorpayX for payouts) — this was already the correct division of responsibility per the DB doc's design (`payments` = external processor events, `wallet_transactions` = internal ledger), so no schema change is needed, only a processor-specific implementation detail. **Flagged as effectively resolving `ARCHITECTURE.md` §24 open question #2** — recommend the founder confirm this explicitly rather than let it stay implicit.

### 0.4 Cloudinary + Supabase Storage split
Not a conflict — a clean mapping onto `ARCHITECTURE.md` §16's tiered storage design: **Supabase Storage** handles images and private documents (government IDs, business docs) using its native bucket-level RLS policies, which map directly onto the access-control rules already specified in `AUTHENTICATION.md` §15; **Cloudinary** handles video specifically, since its transcoding/adaptive-bitrate pipeline is purpose-built for the `portfolio_videos.transcode_status` workflow (`DATABASE_ARCHITECTURE.md` §5) in a way generic object storage isn't. Two storage providers, one clear division of labor.

### 0.5 UUIDv7 generation (implementation note, not a conflict)
`DATABASE_ARCHITECTURE.md` §1.1 specifies UUIDv7 primary keys. Supabase's managed Postgres does not guarantee a UUIDv7-generating extension is available server-side — UUIDv7 values are generated **application-side, in the FastAPI/Python layer**, at insert time, rather than via a Postgres column default. This is purely an implementation detail, noted here so it isn't rediscovered as a surprise during migration-writing.

---

## 1. Tech Stack — Choices & Justification

### 1.1 Frontend
| Tool | Why |
|---|---|
| **Next.js 15** | Server-rendered React needed for SEO-indexable public profiles/campaigns (`ARCHITECTURE.md` §24), file-based routing matches the page list in `ARCHITECTURE.md` §6 directly, one framework serves both the Talent/Hirer web app and the Admin CRM as separate apps in the same monorepo |
| **React** | Component model matches `DESIGN_SYSTEM.md` §7's component library directly — one primitive (`Card`) composed into specialized variants is a React pattern, not a coincidence |
| **TypeScript** | Every entity in `DATABASE_ARCHITECTURE.md` and every payload shape in `API_SPECIFICATION.md` is typed data — TypeScript lets those types be shared (`packages/types`) rather than re-declared per app, directly serving `ARCHITECTURE.md` §11's "shared types package" folder |
| **Tailwind CSS** | Utility classes map cleanly onto `DESIGN_SYSTEM.md` §17's token dictionary (`space.*`, `color.*`, `radius.*` become Tailwind theme extensions) — the design system was written token-first specifically so this mapping is direct, not translated |
| **shadcn/ui** | Un-styled-by-default, Radix-based primitives (accessible keyboard/ARIA behavior out of the box, satisfying `DESIGN_SYSTEM.md` §12) that get **restyled via Tailwind theme tokens**, never used with shadcn's default visual style — this is a behavior/accessibility library, not a visual-identity shortcut |
| **Framer Motion** | Implements the exact restrained motion durations/easings specified in `DESIGN_SYSTEM.md` §13 (150–220ms, no bounce/scale) and respects `prefers-reduced-motion` natively |
| **React Query** | Server-state caching that matches `API_SPECIFICATION.md` §1.8's three-tier caching model and cursor-pagination (§1.5) — its cache invalidation model is a natural fit for the "write-triggered invalidation" pattern already specified there |
| **React Hook Form** | Uncontrolled-input performance for the CRM's dense forms (`CRM_SPECIFICATION.md` §4's Profile Review Page) and the multi-step onboarding flow (`ARCHITECTURE.md` §4) |
| **Zod** | Schema validation that mirrors the Pydantic models on the backend (§1.2) — the same logical validation rules exist in two languages by necessity, but both are generated from/checked against the same `API_SPECIFICATION.md` contract, not independently invented |

### 1.2 Backend
| Tool | Why |
|---|---|
| **FastAPI** | Async Python framework whose automatic OpenAPI generation directly serves `API_SPECIFICATION.md` §24's stated goal ("organized so generating an OpenAPI spec later is straightforward") — FastAPI *is* that generation step, driven by the Pydantic models below |
| **SQLAlchemy** | ORM layer mapping directly onto every table in `DATABASE_ARCHITECTURE.md` — chosen over a raw query builder because the RBAC ownership checks (`WHERE hirer_id = current_user`, `AUTHENTICATION.md` §14 layer 3) benefit from a consistent query-construction layer that's easy to code-review for missing scope clauses |
| **Alembic** | Migration tool for SQLAlchemy — every table/column/enum change proposed across the prior six documents becomes one Alembic revision; RLS policies (`DATABASE_ARCHITECTURE.md` §1.6, §15) are written as raw SQL within Alembic migrations, since neither SQLAlchemy nor Alembic natively models Postgres RLS — flagged here as an implementation detail, not a tooling gap |
| **Pydantic** | Request/response schema validation matching `API_SPECIFICATION.md`'s envelope and per-endpoint shapes exactly — the same models FastAPI uses to generate OpenAPI docs are the models that validate input at the API boundary, satisfying `ARCHITECTURE.md` §15's "validate at the boundary" security principle by construction, not by discipline |

### 1.3 Database, Storage, Auth, Realtime
| Tool | Why |
|---|---|
| **PostgreSQL via Supabase** | Directly the target engine `DATABASE_ARCHITECTURE.md` was written for (native `ENUM`, RLS, `tsvector`, partitioning) — Supabase adds managed hosting, connection pooling, and the Auth/Storage/Realtime products below on top of vanilla Postgres |
| **Supabase Storage** | Images/documents, per §0.4 |
| **Cloudinary** | Video specifically, per §0.4 |
| **Supabase Auth** | Identity/session provider, per §0.1 — the most consequential choice in this stack, reconciled above rather than glossed over |
| **Supabase Realtime** | WebSocket layer for messaging/notifications (`ARCHITECTURE.md` §19, §18) — Postgres-native (listens to table changes via logical replication), which fits naturally now that messaging tables live in the same Supabase Postgres instance (§0.2) |

### 1.4 Email, Payments
| Tool | Why |
|---|---|
| **Resend** | Transactional email provider (`ARCHITECTURE.md` §18) — developer-friendly API and template model fits the `email_templates` table design (`DATABASE_ARCHITECTURE.md` §13) directly |
| **Razorpay** | Payment processor, per §0.3 |

---

## 2. Repository Structure (Monorepo)

```
gigrise/
├── apps/
│   ├── web/            # Next.js — Talent/Hirer web app (public + authenticated)
│   ├── admin/           # Next.js — Admin/Super Admin CRM (separate deploy, per DESIGN_SYSTEM.md §5's "always-visible sidebar" surface)
│   └── api/              # FastAPI — single backend service at MVP (§0.2), internally module-separated per ARCHITECTURE.md §11's service names
├── packages/
│   ├── ui/                # Shared shadcn/ui + Tailwind component library (DESIGN_SYSTEM.md §7)
│   ├── types/             # Shared TypeScript types generated from the OpenAPI spec (API_SPECIFICATION.md §24) — single source of truth for both apps/web and apps/admin
│   ├── config/            # Shared ESLint/TSConfig/Tailwind config
│   └── utils/             # Pure TS helper functions
├── docs/                  # This document and its nine siblings (ARCHITECTURE, DATABASE_ARCHITECTURE, DESIGN_SYSTEM,
│                          # API_SPECIFICATION, AUTHENTICATION, CRM_SPECIFICATION, CROSS_DOCUMENT_REVIEW, CHANGELOG, DECISIONS)
├── scripts/                # One-off/maintenance scripts: seed data, codegen (OpenAPI→TS types), migration helpers
├── shared/                 # Non-code shared assets: logo/brand files, illustration source files (DESIGN_SYSTEM.md §16)
└── config/                  # Repo-root tooling config: CI workflow definitions, Renovate/Dependabot config, commitlint config
```

**Why `apps/api` is one FastAPI app, not seven** — restated from §0.2: internally, it's organized to mirror `ARCHITECTURE.md` §11's service list exactly (§4 below), so the migration path to physically separate services later is "move a folder into its own deploy," not "figure out where the boundaries should have been."

### 2.0a Two more intentional omissions, noted explicitly rather than left silent (v1.1)
`apps/mobile/` (`ARCHITECTURE.md` §11, React Native) is **deferred, not forgotten** — it's Phase 2 per `ARCHITECTURE.md` §5's feature phasing, and its absence from §2's structure reflects that timing, not a descoping decision. Similarly, **no AI/ML provider is named anywhere in §1's tech stack** — every AI feature across the documentation set (`ARCHITECTURE.md` §21, `CRM_SPECIFICATION.md` §22) is Phase 3+, so `services/ai/`'s internal folder (§4) exists as a placeholder module boundary today with no chosen provider behind it yet; this is intentional, not an oversight, per `CROSS_DOCUMENT_REVIEW.md` §2.20.

### 2.1 Why `infra/terraform/`, `infra/k8s/` (`ARCHITECTURE.md` §11) don't appear above — v1.1 reconciliation
`ARCHITECTURE.md` §11 sketched a Terraform + Kubernetes/Helm infra layer as part of the repo structure. `CROSS_DOCUMENT_REVIEW.md` §2.11 correctly flagged that this document's actual structure (above) silently dropped it without explanation — that silence is resolved here, not by re-adding the folder, but by stating the reasoning explicitly: **at MVP scale, GigRise's entire infrastructure is managed hosting** — Supabase (database, auth, storage, realtime) and the hosting platform named in §10.1 (application deploys) — neither of which is provisioned via Terraform/Kubernetes manifests maintained in this repo. Writing Terraform for infrastructure a managed platform already provisions would be pure overhead with no corresponding benefit at this scale, and would contradict `ARCHITECTURE.md` §23's own "scale capacity, not architecture" principle by prematurely building an operations layer for a scale the platform hasn't reached.
**Future migration path (not a redesign):** if GigRise later needs infrastructure a managed platform doesn't provide — a self-hosted Postgres cluster past Supabase's ceiling, a Kubernetes deployment for a physically-separated `messaging-service` (per §0.2's extraction path) — `infra/terraform/` and `infra/k8s/` are added back as new, additive folders at that point, each scoped to the specific piece of infrastructure that's outgrown its managed equivalent. This is the same "additive, not a rewrite" property this document already applies to service extraction (§0.2) and API versioning (`API_SPECIFICATION.md` §22), now stated for infrastructure too.

---

## 3. Frontend Structure (`apps/web`, mirrored in `apps/admin`)

```
app/                # Next.js App Router — route segments matching ARCHITECTURE.md §6's page list 1:1
components/         # App-specific components not generic enough for packages/ui
features/           # Feature-sliced modules (messaging/, campaigns/, contracts/, verification/...) —
                     # each folder owns its own components, hooks, and API-service calls for that domain
hooks/               # Shared, cross-feature hooks (useAuth, useCurrentUser, useDebounce)
services/            # Typed API-client calls, one file per API_SPECIFICATION.md module (campaigns.ts, offers.ts...)
lib/                 # Framework glue: React Query client setup, Supabase client init, Zod schema re-exports
types/               # App-local types not promoted to packages/types (yet)
constants/           # Enums/route paths mirrored from packages/types where they overlap with backend enums
styles/              # Tailwind entry point + any global CSS not expressible as a token
```

**Naming conventions** (extends `ARCHITECTURE.md` §24, made stack-concrete): components `PascalCase.tsx` matching their export; hooks `useCamelCase.ts`; feature folders `kebab-case` (`casting-calls/`, not `castingCalls/`); one component per file, file name is the component name — no `index.tsx` barrel files hiding what's actually exported, since that pattern makes the "three occurrences triggers extraction" rule (`ARCHITECTURE.md` §24) harder to audit by grep.

---

## 4. Backend Structure (`apps/api`)

```
api/            # FastAPI routers — one file per API_SPECIFICATION.md module (auth.py, campaigns.py, verification.py...),
                    # each router's prefix/tags match that document's §-numbered module exactly, so a reviewer can
                    # open api/campaigns.py next to API_SPECIFICATION.md §7 and read them side by side
core/               # App bootstrap: settings loader (env vars, §6), Supabase JWT verification middleware, dependency-injection wiring
models/             # SQLAlchemy ORM models — one module per DATABASE_ARCHITECTURE.md cluster (identity.py, financial.py...)
schemas/            # Pydantic request/response models — mirrors API_SPECIFICATION.md's documented shapes exactly
services/           # Business logic, organized as internal packages named after ARCHITECTURE.md §11's service list:
                     # services/messaging/, services/payments/, services/media/, services/notification/, services/search/, services/ai/
                     # — this is the §0.2 "service-boundary-shaped monolith" made concrete
repositories/       # Query layer — every ownership-scoped query (AUTHENTICATION.md §14 layer 3) lives here, never inline in a router
middlewares/        # Rate limiting (API_SPECIFICATION.md §1.7), request-ID injection, RBAC permission checks (layer 2)
workers/            # Async job handlers: media transcoding callbacks, notification fan-out, analytics rollups, scheduled sweeps
                     # (expired-token cleanup, SLA-breach checks — CRM_SPECIFICATION.md §2)
utils/               # Pure helper functions (money formatting, UUIDv7 generation per §0.5)
```

**Responsibilities, stated as a rule:** a router in `api/` never queries the database directly — it calls a `services/` function, which calls a `repositories/` function. This isn't bureaucracy for its own sake; it's what makes the RBAC four-layer model (`AUTHENTICATION.md` §14) auditable — layer-3 ownership checks are all discoverable in one folder (`repositories/`) rather than scattered inline across 180 endpoint handlers.

---

## 5. Environment Variables

Grouped by concern. **Values are never written in this document** — this is a specification of what must exist, not a `.env` file.

| Group | Variable | Purpose |
|---|---|---|
| **Frontend** | `NEXT_PUBLIC_API_BASE_URL` | Points the Next.js apps at `apps/api` |
| | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-side, safe to expose) |
| | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (RLS-scoped, safe to expose) |
| | `NEXT_PUBLIC_REALTIME_URL` | Supabase Realtime WebSocket endpoint |
| **Backend** | `API_ENV` | `development` \| `staging` \| `production` (`ARCHITECTURE.md` §22) |
| | `API_PORT`, `API_HOST` | Bind address |
| | `LOG_LEVEL` | Structured-logging verbosity (`ARCHITECTURE.md` §24) |
| **Database** | `DATABASE_URL` | Postgres connection string (via Supabase connection pooler) |
| | `DATABASE_POOL_SIZE` | SQLAlchemy pool sizing |
| **Supabase** | `SUPABASE_URL` | Server-side project URL |
| | `SUPABASE_SERVICE_ROLE_KEY` | Server-only, RLS-bypassing key — used exclusively in `apps/api`'s trusted server context, **never** shipped to any frontend bundle |
| | `SUPABASE_JWT_SECRET` / `SUPABASE_JWKS_URL` | For FastAPI to verify Supabase-issued JWTs server-side (§0.1) |
| **Auth/Security** | `SESSION_IDLE_TIMEOUT_MINUTES` | CRM idle-lock duration (`CRM_SPECIFICATION.md` §21, pending founder confirmation of the exact number) |
| | `RATE_LIMIT_REDIS_URL` | Shared counter store for `API_SPECIFICATION.md` §1.7's rate-limit tiers (`AUTHENTICATION.md` §19's scalability note) |
| **Email** | `RESEND_API_KEY` | Resend API credential |
| | `EMAIL_FROM_ADDRESS` | Sender identity for transactional email |
| **Payments** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | API credentials |
| | `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification (`API_SPECIFICATION.md` §14's `payments/webhook` idempotency/verification) |
| **Cloudinary** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Video upload/transcode credentials |
| **Analytics** | `ANALYTICS_WRITE_KEY` | Product analytics ingestion (feeds `analytics_events`, `DATABASE_ARCHITECTURE.md` §13) |
| | `SENTRY_DSN` (×2: web, api) | Error tracking (§11 below) |

Every server-only secret above (`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, etc.) is scoped exclusively to `apps/api`'s runtime environment — the frontend apps only ever hold `NEXT_PUBLIC_*`-prefixed values, enforced by Next.js's own build-time convention (a non-prefixed variable is simply unavailable client-side, which is a useful structural guardrail, not just a naming convention).

---

## 6. Package Management

- **JavaScript/TypeScript:** **pnpm** with workspaces — chosen over npm/yarn for its strict, non-flattened `node_modules` (prevents a package from silently depending on a hoisted transitive dependency it never declared) and fast, disk-efficient installs across a monorepo with multiple `apps/*`.
- **Build orchestration — amended (v1.2):** **Turborepo** runs `dev`/`build`/`lint`/`type-check`/`test` across every workspace package via `turbo.json`'s task graph, including `apps/api` through a thin `package.json` wrapper whose scripts shell out to `uv` — one uniform task-runner interface across the mixed TypeScript/Python monorepo. Added during Phase 0.1 implementation, per the founder's explicit request; see `DECISIONS.md` ADR-018 for the full reasoning and trade-offs. This does not change the Python toolchain decision below — Turborepo only orchestrates *when* `uv` runs, never *what* it installs.
- **Python:** **uv** (or Poetry as a fallback) for `apps/api` — fast, lockfile-based dependency resolution consistent with the same "reproducible install" philosophy as pnpm's lockfile.
- **Dependency strategy:** every direct dependency is pinned via the lockfile (`pnpm-lock.yaml`, `uv.lock`); no floating version ranges in application code beyond what the lockfile already resolves. New dependencies require a one-line justification in the PR description (§8) — not bureaucracy, just enough friction to stop an unnecessary left-pad-class dependency from entering the tree.
- **Versioning strategy:** the monorepo itself is not published as versioned packages (it's an application, not a library) — `packages/*` are workspace-referenced by path, not semver, since they only ever have one consumer set (this repo's own apps). Automated dependency updates (Renovate or Dependabot) run on a weekly cadence, grouped by ecosystem, with CI required to pass before merge — security patches are the one category auto-merged after CI passes, everything else requires review.

---

## 7. Git Workflow

- **Branch strategy:** trunk-based. `main` is always deployable to Staging (`ARCHITECTURE.md` §22); short-lived feature branches (`feat/verification-queue-filters`, `fix/escrow-release-race`) branch from and merge back into `main` via PR. A `production` branch (or tag-based release, either acceptable) is what's promoted from `main` via the gated manual-approval step already specified in `ARCHITECTURE.md` §22 — no long-lived `develop` branch, which would just be a second place for merge conflicts to accumulate.
- **Commit conventions:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) — machine-parseable for changelog generation (§14) and consistent with this project's own documentation-commit history so far.
- **Pull request rules:** every PR requires (a) at least one approving review, (b) all CI checks green (§10), (c) a linked issue/task, (d) for anything touching `models/`, `schemas/`, or RLS policies, an explicit note confirming which `DATABASE_ARCHITECTURE.md`/`API_SPECIFICATION.md` section it implements — keeping the docs-to-code traceability this entire project has been built around from drifting once code exists.
- **Code review checklist:** does it match the relevant spec document (not just "does it work")? Does it introduce a new abstraction where three occurrences didn't yet exist (`ARCHITECTURE.md` §24)? Are ownership/RBAC checks present at the `repositories/` layer, not just the router? Are new environment variables added to §5 of this document in the same PR? Is a new audit-logged action actually writing to `audit_log_entries`, not just performing its side effect?

---

## 8. Coding Standards

- **TypeScript:** `strict: true` non-negotiable; no `any` without an inline comment justifying it; discriminated unions preferred over optional-field soup for polymorphic shapes (e.g., `talent_type: 'creator' | 'actor'` narrows the rest of the object, mirroring `DATABASE_ARCHITECTURE.md` §3's class-table-inheritance pattern in the type system itself).
- **Python:** type hints mandatory on every function signature (Pydantic models everywhere feasible); **Ruff** for linting, **Black** for formatting, **mypy** for static type checking — all three run in CI (§10), none configurable per-developer preference.
- **Naming conventions:** per `ARCHITECTURE.md` §24, restated as stack-concrete — TS: `camelCase`/`PascalCase`/`SCREAMING_SNAKE_CASE`; Python: `snake_case` functions/variables, `PascalCase` classes, matching PEP 8.
- **Folder conventions:** `kebab-case` directories everywhere, both TS and Python (Python's own convention would suggest `snake_case` folders, but this project standardizes on `kebab-case` for cross-language consistency in a monorepo where both live side by side — a deliberate override of Python's usual folder convention, flagged so it isn't "fixed" by a future contributor half-way through).
- **Import conventions:** absolute imports from a configured base path (`@/features/campaigns/...` in TS, `api.services.campaigns` in Python) — no `../../../../` relative-import chains.
- **Error handling:** typed/classed domain errors (`ARCHITECTURE.md` §24) — in FastAPI, custom exception classes mapped to the `API_SPECIFICATION.md` §19 error envelope via a single global exception handler, so every endpoint gets consistent error shape without repeating try/except boilerplate per router.
- **Logging:** structured JSON, correlation ID threaded via the `X-Request-Id` header (`API_SPECIFICATION.md` §1.3) through every log line in a request's lifecycle — `ARCHITECTURE.md` §24's logging principle, made concrete.
- **Reusable code:** shared logic lives in `packages/*` (TS) or `api/utils`+`api/services` (Python) — never copy-pasted across `apps/*`; three occurrences triggers extraction, not the first duplication.
- **Documentation:** docstrings/comments only where the *why* isn't obvious from the code (`ARCHITECTURE.md`'s own stated principle for this entire project) — no restating what a well-named function already says.

---

## 9. Testing Strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit (frontend) | Vitest + React Testing Library | Components, hooks, pure utils — no network calls, mocked `services/` layer |
| Unit (backend) | pytest | `services/`, `repositories/`, `utils/` in isolation, mocked DB session |
| Integration | pytest + a real (test-database) Postgres instance | Full request→router→service→repository→DB round trip against a seeded test schema, verifying RLS policies actually behave as `DATABASE_ARCHITECTURE.md` §15 specifies — not just that application-layer checks pass |
| API | pytest + FastAPI's `TestClient`, validated against the OpenAPI spec | Every endpoint in `API_SPECIFICATION.md` gets at least one contract test asserting its response matches its documented schema |
| End-to-End | Playwright | Full user journeys per `ARCHITECTURE.md` §4 (signup→verify→approve→discover→hire→pay→review) run against a staging-like environment, one suite per journey |
| Performance | k6 | Load-tests the highest-traffic endpoints flagged in `API_SPECIFICATION.md` §25/`DATABASE_ARCHITECTURE.md` §18.4 (`/discover/talent`, `/messages`) before each major release |
| Security | OWASP ZAP (automated scan) + manual review for auth-critical changes | CI-gated baseline scan on every PR touching `api/` routers; manual security review required for anything touching `middlewares/`, `models/` RLS, or payment flows |
| Accessibility | axe-core (automated) + manual keyboard-navigation pass | Enforces `DESIGN_SYSTEM.md` §12's WCAG 2.2 AA target — automated checks catch contrast/ARIA issues, manual pass catches the keyboard-flow issues automation can't |

---

## 10. CI/CD

### 10.1 Hosting Platform — v1.1 addition, resolves `CROSS_DOCUMENT_REVIEW.md` §2.21
**`apps/web` and `apps/admin` (Next.js): Vercel.** The natural fit for Next.js 15 specifically (built by the same team, first-class support for the App Router/server components this stack already commits to) — its per-PR preview deployments and instant-rollback model also directly satisfy §10's blue/green-equivalent deployment behavior for the frontend apps without any custom pipeline work.
**`apps/api` (FastAPI): a container-based platform** (Render, Fly.io, or Railway are all suitable — the specific choice is a founder/team-familiarity call, not an architectural one, since all three support the same container-image-plus-health-check deployment model §10 already assumes) — recommended default: **Render**, for its straightforward managed-Postgres-adjacent tooling and native GitHub Actions integration, though this is explicitly a recommendation pending founder confirmation, not a locked-in decision the way Vercel is for the Next.js apps (there's no equivalent "built by the same team" argument for the FastAPI side).
This resolves the "no concrete hosting platform named" gap identified in the cross-document review — the blue/green/canary strategy below is no longer describing a hypothetical platform, it's describing Vercel's preview/promote model (frontend) and Render's (or the chosen alternative's) rolling-deploy-with-health-check model (backend).

- **Environments:** Development (local + a shared dev Supabase project), Staging (auto-deployed from every `main` merge, real sandboxed Razorpay/Resend/Cloudinary integration), Production (gated manual promotion) — exactly `ARCHITECTURE.md` §22's three-environment model.
- **GitHub Actions pipeline (per PR):** lint (ESLint/Ruff) → type-check (`tsc`/`mypy`) → unit tests → build (`apps/web`, `apps/admin`, `apps/api`) → integration tests (against an ephemeral test-database container) → security baseline scan (§9). All required to pass before merge is allowed.
- **Build pipeline:** Next.js apps build to static+server output per Next.js 15's conventions; `apps/api` builds a container image. Both are versioned by commit SHA, never `latest`, so a rollback (below) is unambiguous about exactly what it's rolling back to.
- **Deployment pipeline:** merge to `main` → auto-deploy to Staging → manual approval gate → deploy to Production, using a blue/green or canary strategy per `ARCHITECTURE.md` §22 — new code serves a small traffic percentage first, full cutover only after health checks (§11) stay green for a defined bake period.
- **Rollback strategy:** because every deploy is a specific commit-SHA-tagged artifact, rollback is redeploying the previous known-good SHA, not reverting a merge and rebuilding — faster, and doesn't require a rushed revert-PR under incident pressure. Database migrations (Alembic) are written to be backward-compatible with the previous application version for at least one deploy cycle (additive-first, per `API_SPECIFICATION.md` §22's versioning philosophy applied to the schema layer too) — so a code rollback never strands the database in a state the old code can't read.

---

## 11. Monitoring

- **Logging:** structured JSON, centralized (e.g., a log-aggregation service), correlation-ID-searchable (§8).
- **Metrics:** request latency/error-rate per endpoint, queue depths (verification/support, `CRM_SPECIFICATION.md` §2), database connection-pool saturation.
- **Error Tracking:** Sentry (or equivalent) on both `apps/web`/`apps/admin` and `apps/api`, capturing the same `X-Request-Id` for cross-referencing a frontend error against its backend log line.
- **Performance Monitoring:** Core Web Vitals on the frontend (Next.js-native reporting), p50/p95/p99 latency on the backend per endpoint — the Super Admin's System Health dashboard (`CRM_SPECIFICATION.md` §2) proxies this data, it doesn't reimplement it.
- **Health Checks:** `GET /health` (`API_SPECIFICATION.md` §18) checked by the deployment platform's load balancer and by an external uptime monitor independent of the hosting platform itself (so a full-platform outage is still detected from the outside).

---

## 12. Security

- **Secrets Management:** a managed secrets store (e.g., the hosting platform's built-in secrets manager, or Doppler/Vault) — never committed to the repo, never in CI logs (masked by default in GitHub Actions for any variable registered as a secret).
- **Environment Management:** Development/Staging/Production each have fully separate credential sets (separate Supabase projects, separate Razorpay test/live keys) — a staging credential must never be capable of touching production data, enforced by using genuinely separate provider accounts/projects, not just separate `.env` files pointed at the same backend.
- **Dependency Scanning:** Dependabot/Renovate + `npm audit`/`pip-audit` in CI, blocking merge on any newly-introduced critical/high vulnerability.
- **Static Analysis:** ESLint (with security-focused rule sets) for TS, Bandit for Python — both in the CI pipeline (§10), not optional/local-only.
- **Code Scanning:** CodeQL (or equivalent SAST) on every PR, plus a scheduled full-repo scan weekly independent of PR activity.

---

## 13. Performance

- **Image Optimization:** Next.js `<Image>` component + Cloudinary/Supabase Storage transform URLs for responsive `srcset` generation — never a full-resolution original served into a feed (`ARCHITECTURE.md` §24).
- **Code Splitting:** Next.js route-based splitting by default; manual `dynamic()` imports for heavy, rarely-used components (the CRM's `AnalyticsChartCard` charting library, the video editor/uploader) so they don't bloat the initial bundle of pages that don't need them.
- **Caching:** implements `API_SPECIFICATION.md` §1.8's three tiers concretely — `public-cacheable` responses get real HTTP cache headers honored by a CDN in front of `apps/web`; React Query implements `private-short`/client-side caching; `no-store` responses bypass all of the above by design.
- **Lazy Loading:** portfolio galleries and long lists (`DataTable`, `DESIGN_SYSTEM.md` §7) load via cursor-paginated infinite scroll, never a full unbounded fetch.
- **Database Optimization:** every index flagged in `DATABASE_ARCHITECTURE.md` §18 exists from the first migration that creates its table, not added reactively after a slow-query report — the doc already tells us where they're needed.
- **API Optimization:** sparse/summary payloads on list endpoints (`API_SPECIFICATION.md` §25's "lazy loading" principle) — a detail fetch is a deliberate second call, never implicitly eager-loaded into a list response.

---

## 14. Documentation Maintenance

- **Adding a new module:** if it fits within an existing document's scope (a new endpoint, a new table, a new component), it's added there via a normal PR — it does **not** spawn a new competing doc file, per the standing instruction from this project's very first architecture pass.
- **Recording architecture changes:** any change to an already-finalized document (this one included) gets a dated entry in `docs/CHANGELOG.md` — **not yet created**, flagged as a dependency in §15.3 — summarizing what changed and why, so the six-and-growing document set has one place that answers "what changed since last time," rather than requiring a diff of every file.
- **New standalone documents** (e.g., a future `MOBILE_APP.md` once React Native work starts) follow the same pattern established across this entire series: subordinate to everything before it, explicit reconciliation notes for anything that doesn't cleanly fit, an Implementation Readiness section at the end.
- **This document's own §0** is the template for how a stack/tooling decision that reshapes prior documents should be handled going forward — flagged prominently, resolved concretely, never silently absorbed.

---

## 15. Implementation Readiness

### 15.1 Remaining Founder Decisions
1. **Confirm the Supabase Auth reconciliation (§0.1)** — this is the single most consequential open item across the entire documentation set at this point; it should be resolved before a single auth-related migration is written.
2. **Confirm India-inclusive launch geography (§0.3)**, given Razorpay's implication — resolves `ARCHITECTURE.md` §24's open question #2.
3. Every open item already listed in `AUTHENTICATION.md` §21.1 and `CRM_SPECIFICATION.md` §23.1 remains open and is not resolved by this document.
4. Confirm `pnpm`/`uv` as the package managers, or state a preference (e.g., existing team familiarity with Yarn/Poetry) before the first `package.json`/`pyproject.toml` is committed.

### 15.2 Technical Risks
- **The Supabase Auth reconciliation, if left ambiguous, is the highest-risk item in this document** — building against the original `AUTHENTICATION.md` custom-token design while also wiring up Supabase Auth would produce two half-built, conflicting identity systems.
- **RLS policies written as raw SQL inside Alembic migrations** (§1.2) are easy to get subtly wrong and hard to unit-test the same way ORM code is — recommend a dedicated integration-test suite (§9) specifically asserting RLS behavior per role, not just trusting the policy SQL reads correctly.
- **Video transcoding via Cloudinary + escrow via Razorpay Route** are both third-party-dependent critical paths with no in-house fallback — worth confirming SLA/uptime expectations from both vendors before launch commitments are made around them.

### 15.3 External Services to Configure
Supabase project (Auth, Storage, Realtime, Postgres), Cloudinary account, Razorpay merchant account (+ Route/RazorpayX enablement for escrow/payouts), Resend account + verified sending domain, Sentry project (×2), a CI/CD-connected hosting platform for `apps/web`/`apps/admin`/`apps/api`, a secrets manager, `docs/CHANGELOG.md` (create it — referenced throughout §14 but doesn't exist yet).

### 15.4 Development Prerequisites
Node.js + pnpm installed, Python + uv installed, Docker (for local Postgres + integration test containers), access credentials for every service in §15.3 (development-tier, never production credentials on a local machine), this entire `docs/` folder read — literally, per this document's own opening instruction inherited from every document before it.

### 15.5 Recommended First Coding Milestone
**Not a feature — the Supabase Auth reconciliation itself, implemented and tested end-to-end** (signup → email verify → login → JWT verified by FastAPI → RBAC permission check → RLS-enforced query), before any product feature (verification queue, campaigns, messaging) is built on top of an identity layer that hasn't been proven to actually work as reconciled in §0. Every other document in this series assumes a working, correctly-scoped identity/authorization foundation — that foundation should be the first thing that exists in code, and the first thing tested against `AUTHENTICATION.md`'s RBAC matrices (§5 of that document) before anything else is built on top of it.

---

## Review

### Technical Strengths
- The stack maps cleanly onto nearly everything already specified — FastAPI+Pydantic directly serves the OpenAPI-readiness goal from `API_SPECIFICATION.md`, Tailwind+shadcn map directly onto `DESIGN_SYSTEM.md`'s token dictionary, and the "one FastAPI monolith, internally service-shaped" approach preserves `ARCHITECTURE.md` §11's extraction path without premature microservice overhead.
- Testing strategy explicitly includes an RLS-behavior integration suite, not just application-layer test coverage — this matters because RLS is exactly the kind of thing that looks correct on read and fails silently in practice.

### Scalability
No new concerns beyond what `ARCHITECTURE.md` §23 and `DATABASE_ARCHITECTURE.md` §18.6 already established — Supabase's single-instance-at-MVP reality is explicitly framed as the first rung of that existing scaling ladder, not a ceiling.

### Maintainability
The docs-to-code traceability requirement in the PR checklist (§7) and the "update, don't fork" documentation-maintenance rule (§14) are the two things most likely to keep this six-document (soon seven) specification from drifting out of sync with the actual codebase as it grows.

### Deployment Readiness
The three-environment/gated-promotion/rollback-by-SHA model is standard and sound; the main gap is operational, not architectural — `docs/CHANGELOG.md` doesn't exist yet and several external accounts (§15.3) need provisioning before Staging can be real rather than theoretical.

### Risks Before Coding
The Supabase Auth reconciliation (§0.1) dominates every other risk in this document — it's a structural change to two already-finalized documents, discovered as a consequence of a tooling choice rather than a product requirement, and it should not be left implicit.

### Recommendations for Implementation
Resolve §15.1's four items first, especially #1. Then build exactly what §15.5 recommends — the auth foundation, proven end-to-end against `AUTHENTICATION.md`'s permission matrices — before any feature work starts, since every other document in this series was written assuming that foundation already works correctly.

---

*End of project setup specification. Subordinate to all six prior documents, with the explicit exception noted in §0; awaits founder resolution of §15.1 before implementation begins.*
