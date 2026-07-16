# GigRise — Master Development Guide
**Version 1.0**
**Audience:** Every future Claude coding session (and every human engineer) working on this codebase, starting from the first line of production code.
**Status:** Operational, not architectural. This document invents nothing — every rule below traces to a decision already made in one of the eleven documents in `docs/`. Where this guide says "never do X," a prior document already explains *why*; this document exists so that reasoning becomes an enforceable habit, not something re-derived per session.

**If you are a Claude session reading this before writing code:** read every file in `docs/` first, in this order — `ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `API_SPECIFICATION.md`, `AUTHENTICATION.md`, `CRM_SPECIFICATION.md`, `PROJECT_SETUP.md`, `CROSS_DOCUMENT_REVIEW.md`, `CHANGELOG.md`, `DECISIONS.md`, `IMPLEMENTATION_PLAN.md`. Treat all eleven as finalized. If something you're asked to build contradicts them, stop and say so — do not silently resolve the conflict by picking a side, and do not silently implement the contradiction either.

---

## 1. Project Rules

1. The eleven documents in `docs/` are the single source of truth. Code implements them; code never redefines them.
2. If implementation reveals a genuine gap or inconsistency in the docs, that is a **documentation task first, a code task second** — update the relevant doc (with a `CHANGELOG.md` entry) before or alongside the code that depends on the fix, never after, and never silently.
3. Every non-trivial decision made during coding that isn't already covered by an existing ADR gets a new entry in `DECISIONS.md` (see §31).
4. `IMPLEMENTATION_PLAN.md` is the execution order. Do not build a Phase-N feature whose stated dependencies (Phase N-1, etc.) aren't done, even if it looks easy in isolation — the plan's phase ordering exists specifically to prevent building on an unfinished foundation.
5. When a founder decision is listed as open (in `CROSS_DOCUMENT_REVIEW.md` §11 or any phase's task list in `IMPLEMENTATION_PLAN.md`), do not silently pick a default and proceed as if it were resolved. Surface it and wait, or implement the documented interim default explicitly labeled as such.

## 2. Coding Rules

Per `PROJECT_SETUP.md` §8, restated as hard rules:
- TypeScript: `strict: true`, no bare `any` without an inline comment justifying it, discriminated unions over optional-field soup for polymorphic shapes.
- Python: type hints mandatory on every function signature; Ruff + Black + mypy, all three CI-enforced, none locally overridable.
- Naming: `camelCase`/`PascalCase`/`SCREAMING_SNAKE_CASE` in TS; `snake_case` functions/variables, `PascalCase` classes in Python (PEP 8).
- Folders: `kebab-case` everywhere, both languages — a deliberate cross-language override of Python's usual `snake_case` folder convention, so don't "fix" it.
- Imports: absolute from a configured base path. No `../../../../` chains.
- **Three occurrences triggers extraction, not the first duplication** (`ARCHITECTURE.md` §24) — but also never extract an abstraction for a hypothetical fourth case that doesn't exist yet.

## 3. Documentation Rules

- A change to any finalized `docs/*.md` file is never silent: state what changed, why, and log it in `CHANGELOG.md` with Date/Document/Section/Reason/Impact, exactly as every amendment in the existing changelog already does.
- A new module small enough to fit inside an existing document's scope is added there, not spun into a new competing file.
- A new capability big enough to need its own document follows the pattern every document in this set already follows: state its subordinate relationship to prior docs, flag reconciliation notes explicitly, end with an Implementation Readiness section.
- Prose in `docs/` explains *why*; code comments explain *why* only where it isn't obvious from a well-named identifier (`ARCHITECTURE.md` §24). Neither restates *what* the code already says.

## 4. Git Workflow & Branch Strategy

Per `PROJECT_SETUP.md` §7:
- Trunk-based. `main` is always deployable to Staging.
- Short-lived feature branches off `main`, named `<type>/<phase>-<task-id>-<short-description>` (e.g., `feat/p5-t3-verification-queue`), so a reviewer can locate the relevant `IMPLEMENTATION_PLAN.md` phase immediately.
- No long-lived `develop` branch.
- Production is promoted from `main` via the gated manual-approval step (`PROJECT_SETUP.md` §10) — never a direct push to Production.
- Never force-push a shared branch; never rewrite `main` history.

## 5. Commit Message Format

Conventional Commits, per `PROJECT_SETUP.md` §7: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`. Reference the Task ID from `IMPLEMENTATION_PLAN.md` where applicable: `feat(p8-t3): implement offer accept/counter/decline`. A commit that only touches `docs/` uses `docs:` and still gets its own `CHANGELOG.md` entry if it amends a finalized document.

## 6. Pull Request Checklist

Every PR must:
- [ ] Link the `IMPLEMENTATION_PLAN.md` Task ID(s) it completes.
- [ ] Pass all CI stages (lint, type-check, unit, integration, API contract tests) with zero suppressed warnings introduced by the PR.
- [ ] Include or update tests for every new/changed behavior (§9).
- [ ] Update the relevant `docs/*.md` file(s) if the PR reveals or resolves a specification gap, with a matching `CHANGELOG.md` entry.
- [ ] Note explicitly if it touches `models/`, `schemas/`, RLS policies, authentication, or payments — these categories require a second reviewer (§23).
- [ ] Contain no new environment variable that isn't also added to `PROJECT_SETUP.md` §5.
- [ ] Contain no TODO/FIXME left unexplained — either it's tracked as a follow-up task with a Task ID, or it's resolved before merge.

## 7. Testing Rules

Per `PROJECT_SETUP.md` §9 and `IMPLEMENTATION_PLAN.md` §2:
- Unit tests (Vitest/pytest) required for all new business logic — no PR merges with reduced coverage on the files it touches.
- Integration tests required for anything touching RLS or cross-service ownership checks — assert the database *actually* blocks an unauthorized read, don't just assert the application code calls the right query.
- API contract tests required for any new/changed endpoint, asserting the response matches `API_SPECIFICATION.md`'s documented shape exactly.
- E2E tests (Playwright) required for any change to a full user journey named in `ARCHITECTURE.md` §4.
- **Never skip a test to unblock a merge.** A failing test blocks the merge until the underlying issue is fixed or the test is proven wrong (not silenced) with the reasoning stated in the PR.

## 8. Definition of Done

A feature, task, or phase is done only when (per `IMPLEMENTATION_PLAN.md` §4's quality gates, restated as the canonical DoD for every unit of work in this project):
1. All tests for the change pass.
2. Linting and type-checking pass with zero new suppressions.
3. Documentation is updated if the change revealed a spec gap, logged in `CHANGELOG.md`.
4. A security review has occurred if the change touches auth, RBAC, RLS, or payments.
5. Performance is acceptable against the relevant standard (§10) — no `OFFSET` pagination, no N+1 query in a list endpoint.
6. Accessibility is unregressed for any UI change (§12).

## 9. Performance Standards

- Cursor-based pagination only, everywhere (`API_SPECIFICATION.md` §1.5, `DECISIONS.md` ADR-008). **Never introduce `?page=N`/`OFFSET` pagination anywhere in this codebase.**
- Every index flagged in `DATABASE_ARCHITECTURE.md` §18 exists from the migration that creates its table — not added reactively after a slow-query report.
- List endpoints return summary/card-shaped payloads; full detail is a deliberate second call, never implicitly eager-loaded (`API_SPECIFICATION.md` §25).
- Respect the three-tier caching model (`public-cacheable` / `private-short` / `no-store`, `API_SPECIFICATION.md` §1.8) — never invent a fourth caching behavior ad hoc.
- Images/video always served at a size appropriate to viewport; never a full-resolution original in a feed.

## 10. Security Standards

- Every endpoint enforces all four authorization layers (`AUTHENTICATION.md` §14): frontend guard, gateway role/permission check, service-level ownership check, database RLS. A missing layer-3 ownership check is a bug even if RLS happens to also catch it — both must be independently correct.
- Never trust a client-supplied ID for an ownership decision — always `WHERE owner_id = current_user` at the query layer.
- Secrets never committed to the repo; server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, Razorpay keys, etc.) never reach a `NEXT_PUBLIC_*`-prefixed variable or any frontend bundle.
- Every admin mutation writes to `audit_log_entries` in the same transaction as the state change — never a best-effort side effect that could silently fail while the mutation succeeds.
- Manual financial adjustments above the configured threshold require the maker-checker second approval (`CRM_SPECIFICATION.md` §12.6) — never bypassable, including by Super Admin.
- Impersonation (once/if built) always renders the non-dismissible banner and blocks credential/payout-method changes during the session (`CRM_SPECIFICATION.md` §11.1) — never a silent context switch.

## 11. Accessibility Standards

Per `DESIGN_SYSTEM.md` §12: WCAG 2.2 AA minimum across the product. Every interactive component keyboard-operable; visible focus rings never suppressed without a replacement; color never the sole signal of state (status pills carry icon + text); `prefers-reduced-motion` respected on every animation. A UI PR that regresses any of this fails review regardless of how the feature otherwise looks.

## 12. Error Handling Standards

- Domain errors are typed/classed, never bare strings thrown (`ARCHITECTURE.md` §24).
- Every GigRise-owned endpoint returns the standard error envelope (`API_SPECIFICATION.md` §1.4/§19): `{ error: { code, message, details } }` — `code` is stable and machine-readable, never just the HTTP status restated.
- Supabase Auth errors are mapped through the translation layer (`AUTHENTICATION.md` §8/§9/§17) before reaching the frontend — the frontend never branches on "was this a Supabase error or a GigRise error."
- No silent `catch` blocks. Every caught error is handled meaningfully, logged, or re-thrown.

## 13. Logging Standards

Structured JSON, correlation-ID-threaded via `X-Request-Id` through every service call (`ARCHITECTURE.md` §24, `PROJECT_SETUP.md` §11). Log levels used with intent (`error`/`warn`/`info`/`debug`). **Never log secrets, passwords, tokens, or full payment details** — and per `AUTHENTICATION.md` §10.1, never log or persist a password in any form, including in an audit-log `before_state`/`after_state` diff.

## 14. API Development Rules

- Every endpoint must already exist in `API_SPECIFICATION.md`, or be added there in the same PR that implements it (not after). **Never invent an API endpoint the spec doesn't define** — if a feature needs one that isn't there, that's a documentation PR first.
- Follow the global conventions in `API_SPECIFICATION.md` §1 exactly: cursor pagination, standard envelope, standard error format, standard rate-limit tiers. Never deviate per-endpoint without updating §1 itself to reflect a new global rule.
- New Pydantic schemas mirror `API_SPECIFICATION.md`'s documented request/response shapes field-for-field.
- A router never queries the database directly — router → `services/` → `repositories/` (`PROJECT_SETUP.md` §4), so ownership checks stay discoverable in one place.

## 15. Database Migration Rules

- Every schema change traces to `DATABASE_ARCHITECTURE.md`. **Never invent a database field, table, or enum value that isn't specified there** — add it to the document first (with a `CHANGELOG.md` entry), then migrate.
- Migrations are additive-first: new nullable columns, new tables, new enum values appended — never a destructive column drop or type change against a table with real user data, without an explicit, reviewed migration plan for the existing rows.
- RLS policies are written as raw SQL within Alembic migrations (`PROJECT_SETUP.md` §1.2) and covered by the adversarial RLS test pattern established in `IMPLEMENTATION_PLAN.md` Phase 2 — a new table with owner-scoped data ships with its RLS policy in the same migration, never as a follow-up.
- UUIDv7 primary keys, generated application-side, on every new table (`DATABASE_ARCHITECTURE.md` §1.1, `DECISIONS.md` ADR-012).
- Financial tables (`wallet_transactions` and anything like it) are append-only by construction — no `UPDATE`/`DELETE` grant, ever, for any role.

## 16. Frontend Development Rules

- Build from `packages/ui`'s existing primitives first (`Card`, `Button`, `Badge`, etc., `DESIGN_SYSTEM.md` §7) — a new "specialized" component is a composition of an existing primitive with a different content slot, never a parallel implementation.
- Every new color/spacing/radius/shadow value comes from the token dictionary (`DESIGN_SYSTEM.md` §17) — never a hardcoded hex/px value in component code.
- Mobile-first base styles for every shared component (`DESIGN_SYSTEM.md` §14), except CRM-only components, which are explicitly exempt since the CRM has no supported mobile layout (`CRM_SPECIFICATION.md` §20).
- Motion stays within the defined duration/easing tokens (`DESIGN_SYSTEM.md` §13) — no new animation pattern introduced ad hoc.

## 17. Backend Development Rules

- `apps/api` stays one FastAPI application organized into `services/` packages matching `ARCHITECTURE.md` §11's names (`PROJECT_SETUP.md` §0.2, `DECISIONS.md` ADR-009) — do not begin extracting a physically separate service without an explicit decision that a specific module's load profile has actually diverged enough to justify it.
- Business logic lives in `services/`, queries in `repositories/`, request/response shape in `schemas/` — never collapse these layers for convenience on a "simple" endpoint, since today's simple endpoint is tomorrow's precedent.

## 18. CRM Development Rules

- Every CRM screen/action maps to a named role and permission from the canonical list (`DATABASE_ARCHITECTURE.md` §2's appendix, `CRM_SPECIFICATION.md` §1) — never gate a CRM feature on the coarse `admin` role alone when a specific permission exists for it.
- **Never add a bulk-approve or bulk-reject action to the verification queue** — this was a deliberate, explicit exclusion (`CRM_SPECIFICATION.md` §3), not an oversight, because every reject/changes-requested decision requires an individually-considered reason.
- Reject and Request-Changes actions enforce a non-empty reason at all three layers (UI disabled-submit, API `422`, database `NOT NULL`) — never remove any one of the three layers, even if it seems redundant.
- Audit-log every admin mutation as it's built, not retrofitted after (`AUTHENTICATION.md` §21.4) — this is the exact mistake flagged repeatedly across the documentation set as easy to miss.

## 19. Authentication Rules

- **Never change the authentication architecture without a corresponding ADR in `DECISIONS.md` and amendments to `AUTHENTICATION.md`/`DATABASE_ARCHITECTURE.md`.** Supabase Auth is the Identity Provider (`DECISIONS.md` ADR-001) — GigRise never builds a parallel credential store, never issues its own JWTs, never hand-rolls session/refresh-token tables.
- The Custom Access Token Hook is the only sanctioned mechanism for injecting `role`/`talent_type`/`hirer_type`/`verification_status` into the JWT (`AUTHENTICATION.md` §5.1) — never smuggle additional claims in through another path.
- `permissions[]` is never embedded in the JWT — always checked live against `role_permissions`/`user_roles` (`AUTHENTICATION.md` §5.1).
- Access token lifetime stays at the confirmed 15 minutes (`AUTHENTICATION.md` §6) — never silently revert to Supabase's 1-hour default.
- Tokens are never handled as raw values in application code, never stored in `localStorage`/`sessionStorage` on web — the Supabase SDK owns storage on every platform (`AUTHENTICATION.md` §7).

## 20. RBAC Rules

- **Never bypass RBAC**, including for internal tooling, scripts, or "just this once" admin convenience — every action goes through the same four-layer model as every other request, with no back door.
- Coarse role (`talent`/`hirer`/`admin`/`super_admin`) gates broad access; fine-grained `permissions` gate specific admin actions — never conflate the two, and never grant a broad coarse-role check where a specific permission already exists for the narrower need.
- Role/permission grants are Super-Admin-exclusive to create (`ARCHITECTURE.md` §15) — never build a path for an Admin to grant themselves or another Admin a new permission.
- A temporary permission grant (`user_roles.expires_at`) must have its expiry enforced by the sweep job, not just displayed in the UI as a countdown — the UI reflecting an expired-looking grant that's still technically active is a bug, not a cosmetic issue.

## 21. Code Review Checklist (for the reviewer)

- [ ] Does the change match the relevant `docs/*.md` section — not just "does it work"?
- [ ] Does it introduce a new abstraction where three occurrences didn't yet exist (§2)?
- [ ] Are ownership/RBAC checks present at the `repositories/` layer, not just the router (§20)?
- [ ] Is a new audit-logged action actually writing to `audit_log_entries`, not just performing its side effect (§10, §18)?
- [ ] Are new environment variables added to `PROJECT_SETUP.md` §5 in the same PR?
- [ ] Does a new endpoint/table/enum value already exist in `API_SPECIFICATION.md`/`DATABASE_ARCHITECTURE.md`, or is this PR also amending those documents (§14, §15)?
- [ ] Does the PR touch auth/RBAC/RLS/payments, and if so, has a second reviewer signed off (§6)?

## 22. Refactoring Rules

- Refactor only what the current task requires — a bug fix doesn't need surrounding cleanup, a one-shot operation doesn't need a helper (per this project's own standing engineering principle, restated here as policy).
- A refactor that changes a documented contract (API shape, database schema, component prop shape used across `packages/ui`) requires the same documentation-first discipline as a new feature — update the doc, then the code.
- Never refactor and add functionality in the same PR — a reviewer should be able to verify "this refactor changed nothing observable" independently of "this PR added X."

## 23. Technical Debt Rules

- A deliberately deferred piece of work (e.g., a Phase-13 AI feature's manual fallback staying in place, per `ARCHITECTURE.md` §21's "accelerates, never gates" principle) is not technical debt — it's a documented, intentional scope boundary. Don't "fix" it without a decision to actually build the deferred feature.
- Genuine technical debt (a shortcut taken under time pressure) gets a tracked follow-up task with an `IMPLEMENTATION_PLAN.md`-style Task ID and a one-line reason in the PR that introduced it — never an undocumented TODO with no owner or plan.
- A `501`-stubbed endpoint (e.g., Phase 8's `fund`/`release` before Phase 11 ships, `IMPLEMENTATION_PLAN.md` Phase 8) is a documented cross-phase dependency, not debt — don't quietly implement a half version of it to make the stub disappear before its real dependency is ready.

## 24. Deployment Rules

Per `PROJECT_SETUP.md` §10: three environments (Development, Staging, Production), fully separate credentials per environment — never point a Staging build at Production Supabase/Razorpay/Resend credentials or vice versa. Every deploy is a specific commit-SHA-tagged artifact. Rollback is redeploying the previous known-good SHA, never a rushed revert-PR under incident pressure. Database migrations stay backward-compatible with the previous application version for at least one deploy cycle.

## 25. Bug Fix Workflow

1. Reproduce the bug and write a failing test that captures it before touching the fix.
2. Fix the minimum surface area required — no drive-by refactoring (§22).
3. Confirm the fix against the relevant `docs/*.md` section: is this actually a bug, or is the code correctly implementing a spec that itself needs to change? If the latter, this is a documentation task, handled per §3, not a silent code-only fix.
4. PR references the bug, includes the now-passing regression test, and is reviewed per §21.

## 26. Feature Development Workflow

1. Locate the feature's phase and Task ID in `IMPLEMENTATION_PLAN.md`. If it isn't there, that's a planning gap — surface it before starting, don't build ungoverned scope.
2. Confirm every listed dependency (prior phase/task) is actually done, not just "probably fine."
3. Build database → backend → frontend, in that order, matching each layer against its respective spec document as you go — not all three simultaneously guessing at each other's shape.
4. Write tests alongside the implementation, not after (§7).
5. Update `docs/*.md` and `CHANGELOG.md` if the feature revealed any gap (§3).
6. Open a PR per §6, reviewed per §21.

## 27. Hotfix Workflow

1. A hotfix is for Production-breaking issues only — branch directly off the deployed Production SHA, not off a `main` that may already contain unreleased work.
2. Minimum viable fix, no scope creep, no refactoring.
3. Fast-tracked review still requires the elevated second-reviewer rule (§6) if it touches auth/RBAC/RLS/payments — a hotfix under pressure is exactly when that safeguard matters most, not when it's safe to skip.
4. Back-merge the hotfix into `main` immediately after Production deploy, so the next regular release doesn't silently revert it.
5. Log the incident and the fix in `CHANGELOG.md` even though it's not a documentation amendment in the usual sense — an operational record of what broke and why matters the same way an architecture amendment does.

## 28. Release Workflow

1. `main` → auto-deploy to Staging → full regression suite (`IMPLEMENTATION_PLAN.md` §2) → manual approval gate → Production, per `PROJECT_SETUP.md` §10.
2. Confirm environment-variable parity intentionally, not by assumption (`IMPLEMENTATION_PLAN.md` Phase 15's specific warning about Staging/Production credential drift).
3. Smoke-test Production immediately post-deploy.
4. Tag the release; update `CHANGELOG.md` with what shipped.

## 29. Architecture Decision Rules

Write a new ADR in `DECISIONS.md` when a decision:
- Changes or reverses a previous ADR (mark the old one `Superseded`, never delete it).
- Introduces a new external dependency/vendor not already named in `PROJECT_SETUP.md` §1.
- Changes a cross-cutting pattern used in more than one module (e.g., a new caching tier, a new pagination style).
- Involves a real trade-off worth a future engineer understanding *why*, not just *what* (following the honesty precedent set by ADR-017's bcrypt-vs-Argon2id note — state the trade-off plainly, don't gloss over it).
Do **not** write an ADR for a routine implementation choice already fully determined by an existing document — that's just following the spec, not deciding something new.

---

## 30. What Claude Must Never Do

This list is not exhaustive by design — if something isn't listed here but clearly contradicts a prior document's stated reasoning, treat it as covered by the same spirit.

1. **Never invent a database field, table, or enum value** that isn't in `DATABASE_ARCHITECTURE.md`. Add it to the document first.
2. **Never invent an API endpoint** that isn't in `API_SPECIFICATION.md`. Add it to the document first.
3. **Never bypass RBAC**, for any reason, including internal scripts, admin convenience, or "temporary" debugging access.
4. **Never change the authentication architecture** (Supabase Auth as Identity Provider) without a new ADR and matching amendments to `AUTHENTICATION.md`/`DATABASE_ARCHITECTURE.md`.
5. **Never change the database schema without updating `DATABASE_ARCHITECTURE.md`** in the same change.
6. **Never change an API contract without updating `API_SPECIFICATION.md`** in the same change.
7. **Never create a duplicate component** where an existing `packages/ui` primitive already covers the need — compose, don't reinvent.
8. **Never duplicate business logic** across `services/` modules or across frontend/backend — shared logic lives in one place, referenced, not copy-pasted.
9. **Never skip a test** to unblock a merge, and never comment out a failing test instead of fixing or justifying it.
10. **Never ignore a linting error** or merge with a suppressed warning that wasn't already present before the PR.
11. **Never ignore a TypeScript or mypy error** — `any`/`# type: ignore` requires an inline justification comment, not silence.
12. **Never add bulk-approve/bulk-reject to the verification queue** — a deliberate, permanent exclusion (`CRM_SPECIFICATION.md` §3).
13. **Never remove the three-layer reason-required enforcement** on Reject/Request-Changes actions (UI + API + database) — all three must always be present together.
14. **Never mutate `wallet_transactions` or `audit_log_entries`** — both are append-only by design; a correction is always a new row, never an edit.
15. **Never store a token in `localStorage`/`sessionStorage`**, or handle a raw Supabase Auth token directly in application code outside the SDK's own storage adapters.
16. **Never expose a server-only secret** (`SUPABASE_SERVICE_ROLE_KEY`, Razorpay secret key, etc.) to any frontend bundle or `NEXT_PUBLIC_*` variable.
17. **Never introduce `OFFSET`-based pagination** — cursor-based only, everywhere.
18. **Never silently pick a default for an open founder decision** listed in `CROSS_DOCUMENT_REVIEW.md` §11 or flagged elsewhere — surface it, or implement the documented interim default and label it as such.
19. **Never build a physically separate microservice deployment** for a `services/` module without an explicit decision that its load profile has diverged enough to justify the extraction (`DECISIONS.md` ADR-009).
20. **Never hard-delete** a soft-deletable entity from application code — deletion is always `deleted_at`, recoverable within the stated window, except where a scheduled purge job explicitly and separately handles permanent erasure.
21. **Never skip the maker-checker approval** on an above-threshold manual financial adjustment, for any role including Super Admin.
22. **Never leave impersonation invisible** — the banner and time-boxed session are mandatory, not optional, whenever this feature exists.

---

## 31. Development Checklist — Complete Before Every Pull Request

- [ ] I have read the relevant sections of `docs/*.md` for the area I'm changing, not just the ticket/task description.
- [ ] My change maps to a real Task ID in `IMPLEMENTATION_PLAN.md`, or I've flagged that it doesn't and why.
- [ ] I have not invented a database field, table, endpoint, enum value, or permission key — everything I use already exists in the docs, or I've updated the docs in this same PR.
- [ ] I have not duplicated an existing component, service function, or query — I checked for an existing one first.
- [ ] Every ownership/ RBAC/permission check is present at all four layers where applicable (frontend guard, gateway, service/repository, RLS) — not just the layer that was easiest to add.
- [ ] Every new admin-facing mutation writes to `audit_log_entries` in the same transaction as its side effect.
- [ ] Unit, integration, and API contract tests are written and passing for everything I changed; E2E tests are updated if I touched a full user journey.
- [ ] Linting and type-checking pass with zero new suppressions.
- [ ] No `OFFSET` pagination, no N+1 query in a list endpoint, no hardcoded design-token value outside `packages/ui`'s token system.
- [ ] No secret, token, or password appears in a log line, an audit-log diff, or a frontend bundle.
- [ ] Accessibility is unregressed: keyboard operability, focus rings, color-plus-icon/text status signaling, `prefers-reduced-motion` all intact.
- [ ] Any new environment variable is added to `PROJECT_SETUP.md` §5.
- [ ] Any documentation gap this work revealed is fixed in the relevant `docs/*.md` file, with a `CHANGELOG.md` entry.
- [ ] Any new significant decision is recorded as an ADR in `DECISIONS.md`.
- [ ] If this PR touches authentication, RBAC, RLS, or payments, a second reviewer is tagged before merge.
- [ ] My commit messages follow Conventional Commits and reference the relevant Task ID.
- [ ] I have not left an unexplained TODO — every one is either resolved or tracked as a follow-up task.

---

*End of master development guide. This document does not introduce new architecture — it operationalizes the eleven documents that precede it. If a future need arises that isn't covered here, resolve it in the spirit of those eleven documents' own stated reasoning, and add the resulting rule back into this guide so the next session doesn't have to re-derive it.*
