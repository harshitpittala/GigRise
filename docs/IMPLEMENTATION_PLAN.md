# GigRise — Master Implementation Plan
**Version 1.0 — Execution Roadmap**
**Status:** Planning document. No source code is written against this yet. This is the first document in the series to describe *sequence and execution*, not *design* — it does not introduce new architecture, it schedules the architecture already finalized in the ten documents below.

**Source of truth (read-only inputs to this plan):** `ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md` (v1.1), `DESIGN_SYSTEM.md` (v1.1), `API_SPECIFICATION.md` (v1.1), `AUTHENTICATION.md` (v2.0), `CRM_SPECIFICATION.md`, `PROJECT_SETUP.md` (v1.1), `CROSS_DOCUMENT_REVIEW.md`, `CHANGELOG.md`, `DECISIONS.md`. None of these were modified to produce this plan.

---

## 0. How to Read This Document

Every phase below follows one template (Purpose, Features, Dependencies, Database/Backend/Frontend/CRM/API work, Authentication impact, Testing requirements, Definition of Done, Complexity, Order, Risks, Rollback) followed by a compact task table per feature (`Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria`). Complexity is sized **relatively** (S/M/L/XL), not in calendar time — this plan has no visibility into team size or velocity, and fabricating "3.5 weeks" would be false precision dressed up as a schedule. Where a phase's dependency structure required deviating from the founder's example ordering, that deviation is stated and justified inline, never applied silently — the same discipline every prior document in this set has held to.

**One structural adaptation made up front:** the founder's example order lists **Phase 4 – Verification Workflow** before **Phase 5 – User Profiles**. Verification operates on `talent_profiles`/`hirer_profiles` rows (`DATABASE_ARCHITECTURE.md` §3–4) — a verification request cannot exist before the profile it verifies does. This plan swaps the two: **Phase 4 is User Profiles & Onboarding, Phase 5 is Verification Workflow**, which depends on it. This is the only reordering in the entire plan; every other phase follows the founder's given sequence.

---

## 1. Phase Overview

| # | Phase | Depends on | Complexity |
|---|---|---|---|
| 0 | Environment & Repository Setup | — | M |
| 1 | Authentication & Identity | 0 | M |
| 2 | RBAC & Authorization | 1 | M |
| 3 | Admin CRM Foundation | 2 | M |
| 4 | User Profiles & Onboarding *(swapped, see §0)* | 2 | L |
| 5 | Verification Workflow *(swapped, see §0)* | 3, 4 | L |
| 6 | Search & Discovery | 4, 5 | M |
| 7 | Campaigns & Casting Calls | 4, 5 | M |
| 8 | Applications & Hiring | 6, 7 | L |
| 9 | Messaging | 4, 8 (soft) | M |
| 10 | Notifications | 1–9 (cross-cutting) | M |
| 11 | Wallet & Payments | 8 | XL |
| 12 | Analytics | 3, most prior phases (read-only) | M |
| 13 | AI Features | 5, 6, 7, 8 (all Phase 3+, deferred) | L (deferred) |
| 14 | Testing & Security Hardening | all functional phases | L |
| 15 | Production Deployment | 14 | M |

---

## Phase 0 — Environment & Repository Setup

**Purpose:** Stand up the monorepo, tooling, and every external account this project depends on, so Phase 1 begins against a working, empty skeleton rather than improvising infrastructure mid-feature.
**Depends on:** Nothing — the true starting point.
**Features:** Monorepo scaffold; package managers; CI pipeline skeleton; Supabase/Vercel/Render/Razorpay/Resend/Cloudinary/Sentry account provisioning; environment variable management.
**Database work:** None yet — Supabase project created, empty.
**Backend work:** `apps/api` FastAPI skeleton with health check (`API_SPECIFICATION.md` §18) and structured logging wired up.
**Frontend work:** `apps/web`/`apps/admin` Next.js skeletons, `packages/ui`/`packages/types`/`packages/config` scaffolds, Tailwind theme extended with `DESIGN_SYSTEM.md` §17 tokens.
**CRM work:** None yet.
**API work:** `GET /health`, `GET /version` only (`API_SPECIFICATION.md` §18).
**Authentication impact:** None yet — this phase precedes identity entirely.
**Testing requirements:** CI pipeline itself is the test — a PR that touches nothing should still pass lint/type-check/build for all three apps.
**Definition of Done:** All three apps build and deploy to Staging via the pipeline in `PROJECT_SETUP.md` §10; every external account in §15.3 is provisioned; `.env.example` files list every variable from §5 with no real secrets committed.
**Estimated complexity:** M — mostly configuration, but touches every tool in the stack at once.
**Estimated implementation order:** 1st, no parallelization possible (everything else depends on this existing).
**Potential risks:** Underestimating how many external accounts need provisioning before anything else can start; a missing Supabase project blocks every subsequent phase.
**Rollback considerations:** Trivial — nothing user-facing exists yet. Rollback is deleting/recreating infra accounts, not a data-migration concern.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P0-T1 | Create monorepo structure (`apps/`, `packages/`, `docs/`, `scripts/`, `shared/`, `config/`) per `PROJECT_SETUP.md` §2 | — | Critical | S | Structure matches §2 exactly; empty apps build |
| P0-T2 | Configure pnpm workspaces + `uv` for `apps/api` | P0-T1 | Critical | S | `pnpm install` and `uv sync` succeed from repo root |
| P0-T3 | Provision Supabase project (Auth, Storage, Realtime, Postgres) | — | Critical | M | Project reachable; connection string in Staging env |
| P0-T4 | Provision Vercel (web, admin) + Render (api) hosting | P0-T1 | Critical | M | A "hello world" deploy succeeds on both platforms |
| P0-T5 | Provision Razorpay, Resend, Cloudinary, Sentry accounts | — | High | S | Sandbox/test credentials available in Staging env |
| P0-T6 | GitHub Actions pipeline: lint → type-check → build (`PROJECT_SETUP.md` §10) | P0-T2 | Critical | M | Pipeline runs and passes on an empty-diff PR |
| P0-T7 | Tailwind theme + design tokens wired into `packages/ui` (`DESIGN_SYSTEM.md` §17) | P0-T1 | High | M | A `Button` component renders with correct gold/indigo tokens in both themes |
| P0-T8 | `docs/CHANGELOG.md` process adopted for all future phases | — | Medium | S | First phase's completion is logged there |

---

## Phase 1 — Authentication & Identity

**Purpose:** Stand up Supabase Auth as GigRise's Identity Provider and prove the reconciled architecture (`AUTHENTICATION.md` v2.0, `DECISIONS.md` ADR-001) actually works end-to-end, before any feature that depends on "who is logged in" is built.
**Depends on:** Phase 0.
**Features:** Email/password signup+login via Supabase SDK; `public.users` profile-sync integration; Custom Access Token Hook (JWT claims); session management (Active Sessions, logout/logout-all); Google OAuth; email verification; password reset.
**Database work:** `public.users` as `auth.users` extension (`DATABASE_ARCHITECTURE.md` §2, amended); `roles`/`permissions`/`role_permissions`/`user_roles` tables created (seed data deferred to Phase 2, but tables exist now since the Access Token Hook reads from them).
**Backend work:** `POST /auth/sync-profile` webhook handler; JWT verification middleware (JWKS-based); Supabase error → GigRise error envelope translation layer (`AUTHENTICATION.md` §8/§9/§17).
**Frontend work:** Auth screens (`DESIGN_SYSTEM.md` §19.1), MFA enrollment/challenge UI (§19.2) built but not yet policy-enforced, Session Management & Security Center screen (§19.6).
**CRM work:** None yet — Admin/Super Admin accounts can be created via `apps/api` seed script only, not yet through CRM UI (that's Phase 3).
**API work:** `AUTHENTICATION.md`/`API_SPECIFICATION.md` §2's amended endpoint set — `POST /auth/sync-profile`, `PATCH /users/me/onboarding-step`, `GET /users/me/account-status`, `GET/DELETE /auth/sessions`.
**Authentication impact:** This *is* the authentication phase — every subsequent phase depends on it.
**Testing requirements:** Unit (JWT claim parsing, webhook signature verification); Integration (signup → webhook → `public.users` row exists, real Supabase test project); API (every endpoint in §2 against its documented contract); E2E (full signup → email verify → login → logout journey in Playwright); Manual QA (test on real Android/iOS Supabase SDK secure storage, not just web).
**Definition of Done:** A user can sign up, verify email, log in, see correct custom claims in their JWT, view/revoke their own sessions, and log out — all without any GigRise-owned password/session table existing.
**Estimated complexity:** M — the mechanics are provider-managed; the genuinely new work (Custom Access Token Hook, error translation layer) is narrow but must be exactly right.
**Estimated implementation order:** 2nd, no parallelization — every later phase needs a working identity layer.
**Potential risks:** Custom Access Token Hook misconfiguration silently serving stale/missing claims (`AUTHENTICATION.md` §5.1) — the single highest-impact bug this phase can produce, since it fails invisibly (the app "mostly works" until an authorization check reads a missing claim). JWT expiry left at Supabase's 1-hour default instead of the confirmed 15-minute figure (§6) if the settings pass is skipped.
**Rollback considerations:** Supabase Auth is external state — a bad migration here means a) fixing the Custom Access Token Hook function (a Postgres function, redeployable without touching user data) or b) in the worst case, users re-verifying email, which is disruptive but not destructive. No GigRise-owned credential data exists to corrupt.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P1-T1 | Configure Supabase Auth project settings (15-min JWT expiry, password policy, refresh rotation) | P0-T3 | Critical | S | Settings match `AUTHENTICATION.md` §6/§10.1 exactly |
| P1-T2 | Implement Custom Access Token Hook (Postgres function) | P1-T1, P2-T1 (roles tables must exist) | Critical | L | Decoded JWT contains `role`, `talent_type`/`hirer_type`, `verification_status` claims correctly for every test account state |
| P1-T3 | `public.users` schema + `user.created` webhook listener | P1-T1 | Critical | M | New Supabase signup produces a matching `public.users` row within the same request cycle |
| P1-T4 | Signup/Login/Logout screens (web) | P0-T7 | Critical | M | Matches `DESIGN_SYSTEM.md` §19.1 exactly; uses `@supabase/ssr` |
| P1-T5 | Supabase error → GigRise envelope translation layer | P1-T3 | High | M | Every error code in `AUTHENTICATION.md` §17's table is reproduced correctly from a forced Supabase failure |
| P1-T6 | Active Sessions / Security Center screen | P1-T3 | High | M | Lists real sessions via Supabase Admin API; revoke works |
| P1-T7 | Google OAuth provider configuration | P1-T1 | Medium | S | OAuth login produces the same `public.users` sync as email signup |
| P1-T8 | Email verification + password reset flows (Resend SMTP) | P1-T1 | Critical | M | Both flows work end-to-end with Resend-delivered email |

---

## Phase 2 — RBAC & Authorization

**Purpose:** Make the four-layer authorization model (`AUTHENTICATION.md` §14) real — coarse role checks, fine-grained permissions, resource-ownership checks, and RLS — before any resource-owning feature ships.
**Depends on:** Phase 1 (JWT claims must exist to check against).
**Features:** Permission-key seed data (canonical list, `DATABASE_ARCHITECTURE.md` §2); `roles`/`role_permissions`/`user_roles` fully populated for the eight CRM roles (`CRM_SPECIFICATION.md` §1); API gateway RBAC middleware; RLS policy pattern established on the first real table.
**Database work:** Seed `roles`/`permissions` rows; RLS policy template proven against one real table (`talent_profiles`, built as a thin shell in this phase, fully fleshed out in Phase 4).
**Backend work:** Gateway-level role/permission-check middleware (`API_SPECIFICATION.md` §1.9/§20); ownership-check pattern in `repositories/` (`PROJECT_SETUP.md` §4).
**Frontend work:** Route-guard utility consuming JWT claims (layer 1, `AUTHENTICATION.md` §14).
**CRM work:** Super Admin's Role Management screen — read-only view of seeded roles at this stage; full CRUD comes with Phase 3's CRM foundation.
**API work:** No new business endpoints — this phase is entirely about the *enforcement layer* every future endpoint will use.
**Authentication impact:** Extends Phase 1 — this is where "authenticated" becomes "authorized."
**Testing requirements:** Unit (permission-check function against every role/permission combination); Integration (RLS policy denies a cross-tenant read even when application code is bypassed, proving layer 4 independently of layer 3); API (a 403 is returned for every wrong-role/wrong-permission test case); Manual QA (Super Admin can grant/revoke, Admin without a permission is correctly blocked).
**Definition of Done:** Every one of the 18 canonical permission keys (`DATABASE_ARCHITECTURE.md` §2) exists as a seeded row; a test suite proves each of the 8 CRM roles gets exactly its intended permission set; RLS is proven to block an unauthorized read even with a deliberately broken application-layer check.
**Estimated complexity:** M — the data model is simple; the risk is entirely in getting the enforcement layering right.
**Estimated implementation order:** 3rd, no parallelization — every resource-owning phase from here on depends on this.
**Potential risks:** A missing ownership check in `repositories/` that RLS alone doesn't catch until a real cross-tenant data leak is tested for explicitly — this is why the RLS-proof test above is a Definition-of-Done item, not optional.
**Rollback considerations:** Permission seed data is easily corrected (it's configuration, not user data). A bad RLS policy is higher-stakes — test in Staging against realistic multi-tenant fixture data before promoting.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P2-T1 | Seed `roles`/`permissions`/`role_permissions` canonical data | P1-T3 | Critical | S | Matches `DATABASE_ARCHITECTURE.md` §2's 18-key list and `CRM_SPECIFICATION.md` §1's 8 roles exactly |
| P2-T2 | Gateway RBAC middleware (coarse role + fine permission check) | P2-T1 | Critical | L | A request with a valid JWT but wrong role/permission returns `403 permission_denied` before reaching business logic |
| P2-T3 | RLS policy template + first proof-of-concept table | P2-T1 | Critical | L | A raw SQL query as a different user cannot read another user's row, independent of application code |
| P2-T4 | Frontend route-guard utility | P1-T4 | High | M | An unauthorized route redirects before any protected component renders |
| P2-T5 | Temporary-permission expiry sweep job (`user_roles.expires_at`) | P2-T1 | Medium | S | A time-boxed grant is automatically revoked past its `expires_at` |

---

## Phase 3 — Admin CRM Foundation

**Purpose:** Stand up `apps/admin`'s shell — navigation, dashboard skeleton, staff account management — so every subsequent CRM-touching phase (Verification, Support, Moderation, Payments) has a home to plug into rather than each inventing its own admin surface.
**Depends on:** Phase 2 (needs real RBAC to gate admin routes).
**Features:** CRM app shell (always-visible sidebar, `DESIGN_SYSTEM.md` §5/§20); Admin/Super Admin staff account CRUD (`API_SPECIFICATION.md` §3); Role Management full CRUD; Audit Log viewer (read-only); CRM dashboard skeleton (widgets wired to real data as later phases ship the data they display).
**Database work:** `admin_profiles` table (`DATABASE_ARCHITECTURE.md` §3.4); `audit_log_entries` fully wired as the write-target for every admin action from this phase forward.
**Backend work:** `POST/PATCH/DELETE /admin/staff`, `GET/PATCH /admin/roles`/`/permissions` (`API_SPECIFICATION.md` §3/§5.6).
**Frontend work:** `AppSidebar`/`AppTopNav` for the CRM context (`DESIGN_SYSTEM.md` §6), CRM Dashboard layout (§8), Audit Log `DataTable` (§7/§9).
**CRM work:** This phase *is* the CRM foundation.
**API work:** Staff/role management endpoints; audit log read endpoint (`GET /admin/audit-logs`).
**Authentication impact:** Confirms the MFA-enforcement-for-Admin policy decision (`AUTHENTICATION.md` §21.1) needs to be resolved before this phase's Definition of Done, since it gates CRM login.
**Testing requirements:** Unit (audit log write on every admin mutation); Integration (a staff account created by Super Admin can log in and sees only its granted permissions' UI); API (staff CRUD contract tests); Manual QA (visually confirm the always-visible sidebar behavior across Desktop/Laptop/Tablet per `DESIGN_SYSTEM.md` §20 — no mobile layout to check, by design).
**Definition of Done:** A Super Admin can create a scoped Admin account, grant it a specific role bundle, that Admin can log in and see exactly the CRM surface their permissions unlock, and every action either of them takes is visible in the Audit Log with no missing entries.
**Estimated complexity:** M — mostly composition of already-specified components, but the audit-logging discipline established here must be airtight since every later phase depends on the pattern being correct from day one (`AUTHENTICATION.md` §21.4's "wire in as built, not retrofitted" principle).
**Estimated implementation order:** 4th, can partially parallelize with the tail end of Phase 2 (RBAC middleware and CRM shell UI don't block each other).
**Potential risks:** Skipping the audit-log-on-every-mutation discipline now, planning to "add it later" — explicitly warned against in `AUTHENTICATION.md` §21.4 as the exact mistake that's hard to catch retroactively.
**Rollback considerations:** Low risk — this phase has no real user-facing data yet, only internal staff accounts.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P3-T1 | CRM app shell (sidebar, top nav, dashboard skeleton) | P2-T4 | Critical | M | Matches `DESIGN_SYSTEM.md` §5/§6/§8 layout exactly at Desktop/Laptop/Tablet |
| P3-T2 | Staff account CRUD (Super Admin only) | P2-T2 | Critical | M | Super Admin can create/edit/revoke an Admin; non-Super-Admins get `403` |
| P3-T3 | Role Management UI (assign role bundles, temporary permissions) | P2-T1, P2-T5 | High | M | Matches `CRM_SPECIFICATION.md` §16 and `DESIGN_SYSTEM.md` §19.5 |
| P3-T4 | Audit Log viewer | P2-T2 | Critical | M | Read-only, no edit/delete UI anywhere; filterable by actor/action/date |
| P3-T5 | MFA enrollment prompt for new Admin/Super Admin accounts | P1-T2 (MFA UI) | High | S | New staff account is prompted per the resolved enforcement policy |

---

## Phase 4 — User Profiles & Onboarding *(reordered before Verification, see §0)*

**Purpose:** Build the full Talent/Hirer profile data model and the onboarding flow that populates it — the prerequisite for everything from Phase 5 onward.
**Depends on:** Phase 2 (RLS/ownership pattern must exist to protect profile data correctly from day one).
**Features:** `talent_profiles`/`hirer_profiles` base + detail tables; onboarding multi-step flow; portfolio (images/videos/documents); skills/languages/experience/education/certifications/achievements/social-links; availability status.
**Database work:** The entirety of `DATABASE_ARCHITECTURE.md` §3, §5, §6 — base profiles, detail extensions, portfolio media tables, lookup tables (skills/categories/languages), child history tables.
**Backend work:** Full `API_SPECIFICATION.md` §4 endpoint set; `media-service` upload-URL issuance (`ARCHITECTURE.md` §16) against Supabase Storage (images/docs) and Cloudinary (video).
**Frontend work:** Onboarding `FormStepper` flow (`DESIGN_SYSTEM.md` §5), Profile pages for all four types (§10), Portfolio Gallery (§7).
**CRM work:** None directly — profiles created here start at `verification_status=draft`, invisible to CRM until Phase 5 submits them.
**API work:** `/talent-profiles`, `/hirer-profiles`, and every child-resource endpoint in §4.
**Authentication impact:** None beyond already-established RBAC — a user editing their own profile is the textbook ownership-check case layer 3/4 already proves in Phase 2.
**Testing requirements:** Unit (profile-completeness calculation); Integration (multi-step onboarding persists partial state correctly across steps); API (every CRUD endpoint in §4); E2E (full onboarding flow, both Talent and Hirer paths); Manual QA (upload a real video through Cloudinary's transcode pipeline and confirm `transcode_status` transitions correctly).
**Definition of Done:** A user can complete the entire onboarding flow for their role/type, upload portfolio media that successfully transcodes/publishes, and see their own profile rendered correctly — all while `verification_status` remains `draft` (Phase 5 is what changes that).
**Estimated complexity:** L — the largest single data model in the platform (`DATABASE_ARCHITECTURE.md` §3, §5, §6 combined) and the first phase to exercise the media pipeline.
**Estimated implementation order:** 5th. Portfolio/media work can parallelize with basic profile CRUD once the base tables exist.
**Potential risks:** Video transcode pipeline (Cloudinary) failure modes not being surfaced clearly to the user — a stuck `processing` state with no feedback is a real UX failure mode worth explicit handling, not just a documented enum value.
**Rollback considerations:** Profile data is user-generated from this point forward — any schema fix after real users have entered data must be additive (new nullable column), never a destructive column drop, per the platform-wide backward-compatibility principle (`API_SPECIFICATION.md` §22).

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P4-T1 | `talent_profiles`/`hirer_profiles` base tables + detail extensions | P2-T3 | Critical | L | Matches `DATABASE_ARCHITECTURE.md` §3 exactly, RLS proven per-owner |
| P4-T2 | Onboarding `FormStepper` flow (both Talent and Hirer paths) | P4-T1 | Critical | L | Partial completion persists; resuming mid-flow works |
| P4-T3 | Portfolio image/video upload + Cloudinary transcode integration | P4-T1, P0-T5 | Critical | L | Upload → processing → published CDN URL, all three states visible in UI |
| P4-T4 | Skills/Languages/Categories lookup tables + join tables | P4-T1 | High | M | Admin-editable via Content Manager (Phase 3's CRM foundation) |
| P4-T5 | Experience/Education/Achievements/Certifications/Social Links CRUD | P4-T1 | Medium | M | Standard CRUD per `API_SPECIFICATION.md` §4.2 |
| P4-T6 | Availability status field | P4-T1 | Low | S | `available`/`booked`/`unavailable` + date, per `DATABASE_ARCHITECTURE.md` v1.1 |
| P4-T7 | Document upload (Government ID, business docs) to private Supabase Storage bucket | P4-T1 | Critical | M | Never accessible via public URL; only signed URLs (`AUTHENTICATION.md` §15) |

---

## Phase 5 — Verification Workflow *(reordered after Profiles, see §0)*

**Purpose:** Build the trust mechanism the entire platform's value proposition depends on (`ARCHITECTURE.md` §2, `DECISIONS.md` ADR-010/ADR-011).
**Depends on:** Phase 3 (CRM foundation, needed for the review queue UI) and Phase 4 (profiles must exist to verify).
**Features:** Submit-for-verification action; `verification_requests`/`reviews`/`comments`/`history`; CRM verification queue with filters/priority/bulk-assign; Profile Review Page; Approve/Reject/Request-Changes/Escalate/Assign actions; resubmission loop.
**Database work:** `DATABASE_ARCHITECTURE.md` §4 in full, including the v1.1 `media_asset_id` addition to `verification_comments`.
**Backend work:** Full verification endpoint set (`API_SPECIFICATION.md` §5.1).
**Frontend work:** Verification Queue `DataTable` + Drawer review pattern (`DESIGN_SYSTEM.md` §9); Approve/Reject/Request-Changes dialogs with UI-enforced reason requirement.
**CRM work:** The single largest CRM feature — Verification Executive's entire daily workflow.
**API work:** `/verification-requests/*`, `/admin/verification-requests/*`.
**Authentication impact:** First real exercise of `verification_status` gating discovery/hiring (Phase 6+) — proves the combined access table (`AUTHENTICATION.md` §12) actually works.
**Testing requirements:** Unit (reason-required validation at the API layer, matching the DB constraint); Integration (resubmission creates a new `verification_requests` row, preserves history correctly); E2E (full submit → review → changes-requested → resubmit → approve loop); Manual QA (SLA timer visual states, priority sort).
**Definition of Done:** A submitted profile reaches an Admin's queue, every decision path (approve/reject/changes-requested/escalate/reassign) works exactly as `CRM_SPECIFICATION.md` §5 specifies, and `verification_status` correctly gates what the profile owner can do next per §12's combined table.
**Estimated complexity:** L — the state machine is simple, but the CRM UI (queue, drawer, three-layer reason-required enforcement) is the most operationally important surface in the product and deserves the scrutiny that complexity rating implies.
**Estimated implementation order:** 6th. The **Internal Demo checkpoint** (§7 below) lands here.
**Potential risks:** The still-open founder decision on which profile fields are "verification-sensitive" (re-triggering review) — flagged repeatedly across `API_SPECIFICATION.md`, `AUTHENTICATION.md`, and `CRM_SPECIFICATION.md` — blocks a fully correct implementation of the profile-edit-during-approved-status flow. Build the submit/review/decide loop first; this specific edge case can follow once the founder decision lands.
**Rollback considerations:** `verification_history` is append-only by design — there is no "rollback" of a decision, only a new compensating action (Suspend, re-review), consistent with the ledger-style philosophy applied wherever GigRise reasons about important state.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P5-T1 | `verification_requests`/`reviews`/`comments`/`history` schema | P4-T1 | Critical | M | Matches `DATABASE_ARCHITECTURE.md` §4 v1.1 exactly |
| P5-T2 | Submit-for-verification action (profile → queue) | P5-T1 | Critical | S | `verification_status` flips to `pending_review`, request row created |
| P5-T3 | CRM Verification Queue (filters, priority, bulk-assign/escalate only) | P5-T1, P3-T1 | Critical | L | Matches `CRM_SPECIFICATION.md` §3 exactly; no bulk-approve/reject exists |
| P5-T4 | Profile Review Page (Drawer) | P5-T1, P4-T7 | Critical | L | All 12 sections from `CRM_SPECIFICATION.md` §4 render correctly |
| P5-T5 | Approve/Reject/Request-Changes/Escalate/Assign actions | P5-T3, P5-T4 | Critical | M | Reason-required enforced at UI+API+DB for reject/changes-requested |
| P5-T6 | Resubmission flow (Changes Requested → edit → new request) | P5-T2, P5-T5 | High | M | New `verification_requests` row created, linked to prior for Timeline continuity |

---

## Phase 6 — Search & Discovery

**Purpose:** Make approved profiles and open listings findable — the demand-side entry point into the marketplace.
**Depends on:** Phase 4 (profiles), Phase 5 (only `approved` profiles are ever surfaced).
**Features:** Faceted Talent/Hirer search; campaign/casting-call search; saved searches; quick/command search (`⌘K`).
**Database work:** `tsvector`/`pg_trgm` indexes (`DATABASE_ARCHITECTURE.md` §17); `saved_searches`/`recent_searches` tables (v1.1 addition).
**Backend work:** `/discover/*` endpoints; `search_sync_status` outbox pattern scaffolding (even though Elasticsearch migration itself is a later, unscheduled phase per `PROJECT_SETUP.md` §2.0a).
**Frontend work:** Discovery search page (`DESIGN_SYSTEM.md` §5/§6); Command Search palette (§6).
**CRM work:** None directly.
**API work:** `API_SPECIFICATION.md` §6 and §15.
**Authentication impact:** Enforces the "always filter to `verification_status=approved`" rule at the query layer, not just the UI — a security-relevant detail, not just a feature one.
**Testing requirements:** Unit (ranking/filter logic); Integration (an unapproved profile never appears in results, tested adversarially — a raw query bypassing the API should still be blocked by the same RLS approved-only policy); API (facet/sort/pagination contract tests); Manual QA (typo-tolerance via `pg_trgm`).
**Definition of Done:** Talent/Hirer/Campaign search all return correct, paginated, `approved`-only results; the Command Search palette resolves quick navigation and lightweight content search.
**Estimated complexity:** M.
**Estimated implementation order:** 7th, parallelizable with the early part of Phase 7 (Campaigns) since search just needs *a* listing type to index against first.
**Potential risks:** Full-text search relevance quality at MVP scale (`tsvector`) may feel worse than a dedicated search engine — this is accepted and explicitly deferred (`DATABASE_ARCHITECTURE.md` §17), not a bug to over-engineer around now.
**Rollback considerations:** Search indices are derived data — always rebuildable from source tables, never a source of truth themselves. Low risk.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P6-T1 | `tsvector`/`pg_trgm` indexes + faceted talent/hirer search endpoint | P5-T5 | Critical | M | Only `approved` rows ever returned, verified adversarially |
| P6-T2 | Saved Searches + Recent Searches | P6-T1 | Medium | S | Matches `DATABASE_ARCHITECTURE.md` v1.1 `saved_searches`/`recent_searches` |
| P6-T3 | Command Search (`⌘K`) palette | P6-T1 | Medium | M | Sub-100ms response for combined nav+content search |

---

## Phase 7 — Campaigns & Casting Calls

**Purpose:** Give Hirers the ability to post work — the demand-side supply of the marketplace.
**Depends on:** Phase 4 (Hirer profiles must be `approved`, per Phase 5).
**Features:** Campaign/Casting Call CRUD; publish/close/suspend/archive lifecycle; attachments; categories; analytics (basic).
**Database work:** `DATABASE_ARCHITECTURE.md` §8, including the v1.1 `suspended`/`archived` status enum extension.
**Backend work:** `API_SPECIFICATION.md` §7, including the v1.1 `GET /admin/campaigns` addition.
**Frontend work:** Campaign/Casting Call creation forms, public listing pages, `CampaignCard`/`CastingCallCard` (`DESIGN_SYSTEM.md` §7).
**CRM work:** Admin campaign moderation view (suspend/archive), per `CRM_SPECIFICATION.md` §10 — contingent on the still-open founder decision about pre-publish approval (§10's flagged gap); this phase ships the post-publish-moderation default, easily extended to pre-approval later without a redesign.
**API work:** Full §7 endpoint set.
**Authentication impact:** `403 unverified_hirer` enforcement on listing creation — exercises `verification_status` gating on the demand side, mirroring what Phase 6 did for the supply side.
**Testing requirements:** Unit (status transition validity, e.g. can't delete a campaign with applications); Integration (publish triggers search indexing); API (lifecycle endpoint contract tests); Manual QA (attachment upload, category selection).
**Definition of Done:** A verified Hirer can create, publish, close, and (as Admin) suspend/archive a campaign or casting call; the listing appears correctly in Phase 6's search once published.
**Estimated complexity:** M.
**Estimated implementation order:** 7th (parallel with Phase 6, as noted there).
**Potential risks:** The open founder decision on pre-publish approval — if it resolves toward "yes, gate it," this phase's publish action needs a CRM-approval step inserted, which is an additive change to the state machine (`draft → pending_approval → open`), not a redesign, but should be flagged as a likely near-term follow-up.
**Rollback considerations:** Soft-delete only, matching every other user-generated entity in the platform.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P7-T1 | Campaign/Casting Call CRUD + status lifecycle | P5-T5 | Critical | M | Matches `DATABASE_ARCHITECTURE.md` §8 v1.1 exactly |
| P7-T2 | Attachments + category lookup integration | P7-T1 | Medium | S | Reuses `media_assets`/`campaign_categories` patterns |
| P7-T3 | Admin moderation view (Suspend/Archive) | P7-T1, P3-T1 | High | M | Matches `CRM_SPECIFICATION.md` §10; requires `GET /admin/campaigns` |
| P7-T4 | Basic campaign analytics (views/applications) | P7-T1 | Low | S | Phase 2 feature per `ARCHITECTURE.md` §5, stubbed acceptable at MVP |

---

## Phase 8 — Applications & Hiring

**Purpose:** Close the loop from "found each other" to "agreed to work together" — apply, shortlist, offer, accept, contract.
**Depends on:** Phase 6 (discovery) and Phase 7 (listings to apply to).
**Features:** Apply/withdraw; shortlist/reject; offer/counter/accept/decline; contract creation (through `accepted` state — funding/release is Phase 11).
**Database work:** `DATABASE_ARCHITECTURE.md` §8 (`applications`, `application_status_history`) and the `offers`/`contracts`/`milestones` tables.
**Backend work:** `API_SPECIFICATION.md` §8 in full, up to and including `POST /contracts/{id}` creation — **`fund`/`release` endpoints are stubbed to return `501` until Phase 11 ships**, an explicit, documented cross-phase dependency rather than a silent gap.
**Frontend work:** Application flow, `OfferCard`/`ContractTimeline`/`MilestoneList` (`DESIGN_SYSTEM.md` §7).
**CRM work:** None directly — this is a peer-to-peer workflow.
**API work:** Full §8 endpoint set (funding/release deferred).
**Authentication impact:** None beyond established ownership checks (an applicant can only withdraw their own application; a Hirer can only shortlist applicants to their own listing).
**Testing requirements:** Unit (offer/contract state machine transitions); Integration (application → offer → accept → contract row created correctly); E2E (full hire flow, Talent and Hirer perspectives); Manual QA (Casting Director's swipe-queue review pattern, `DESIGN_SYSTEM.md` §8).
**Definition of Done:** A Talent can apply, a Hirer can shortlist/reject/offer, both sides can negotiate via counter-offers, and an accepted offer produces a `contracts` row in `accepted` state — everything up to the point money needs to move.
**Estimated complexity:** L — the state machine (application → offer → contract) has the most branching logic of any workflow outside verification.
**Estimated implementation order:** 8th. The **Closed Alpha checkpoint** (pending Phase 9/10) becomes reachable once this phase and Messaging exist.
**Potential risks:** Shipping "hiring" without escrow live could create a trust gap (a Hirer accepts an offer with no visible funding commitment) — mitigate with clear UI messaging that payment happens in a following step, not by rushing Phase 11 forward out of order.
**Rollback considerations:** `application_status_history`/contract states are append-only; no destructive rollback path needed, matching the platform-wide event-sourced pattern.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P8-T1 | Apply/Withdraw + Application Status History | P6-T1, P7-T1 | Critical | M | `409 already_applied` enforced; withdrawal is self-service |
| P8-T2 | Shortlist/Reject (Hirer-side applicant review) | P8-T1 | Critical | M | Casting Director swipe-queue UI per `DESIGN_SYSTEM.md` §8 |
| P8-T3 | Offer/Counter/Accept/Decline | P8-T1 | Critical | L | State machine matches `DATABASE_ARCHITECTURE.md` §8 exactly |
| P8-T4 | Contract creation (through `accepted` state) | P8-T3 | Critical | M | `fund`/`release` endpoints stubbed `501`, documented as Phase 11 dependency |

---

## Phase 9 — Messaging

**Purpose:** Let Talent and Hirer negotiate and communicate — the connective tissue between discovery and hiring.
**Depends on:** Phase 4 (users must exist to message). Soft dependency on Phase 8 for offer-in-thread rendering — core conversation/message functionality can be built in parallel with Phase 8, integrated at the end.
**Features:** Conversations/messages; attachments; read receipts; archive; real-time delivery (WebSocket) with REST catch-up fallback; typing indicators/presence (ephemeral, no persistence).
**Database work:** `DATABASE_ARCHITECTURE.md` §9, including the v1.1 `conversation_participants.archived_at` addition.
**Backend work:** WebSocket gateway (Supabase Realtime, per `PROJECT_SETUP.md` §0.2/§1.3); `API_SPECIFICATION.md` §9 REST fallback endpoints.
**Frontend work:** Conversation List, Chat Window, attachment/read-receipt UI (`DESIGN_SYSTEM.md` §11).
**CRM work:** Admin read access to flagged conversations only (moderation context), never general browsing (`CRM_SPECIFICATION.md` §9).
**API work:** Full §9 endpoint set.
**Authentication impact:** Real-time channel authenticated via the same Supabase-issued JWT — no separate auth mechanism for WebSocket vs. REST.
**Testing requirements:** Unit (message ordering/pagination); Integration (WebSocket delivery + REST catch-up produce identical final state after a simulated disconnect); E2E (two-party conversation, attachment send, archive); Manual QA (typing indicator ephemeral behavior on reconnect).
**Definition of Done:** Two users can message each other in real time, attachments work, read receipts update live, and a dropped connection recovers correctly via the REST catch-up path with no message loss.
**Estimated complexity:** M.
**Estimated implementation order:** 8th, parallel with Phase 8 (per the soft-dependency note above); integration point (offers-in-thread) lands once both are functional.
**Potential risks:** WebSocket reconnect edge cases (message ordering after a flaky connection) are the classic messaging-feature bug class — budget real device/network testing, not just happy-path E2E.
**Rollback considerations:** Messages are soft-deletable ("unsend") per-participant; no destructive delete path exists.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P9-T1 | Conversations/Messages schema + REST endpoints | P4-T1 | Critical | M | Matches `DATABASE_ARCHITECTURE.md` §9 v1.1 |
| P9-T2 | Real-time delivery via Supabase Realtime | P9-T1 | Critical | L | New message appears live without a page refresh |
| P9-T3 | Attachments, read receipts, archive | P9-T1 | High | M | Reuses `media_assets`; archive is per-participant |
| P9-T4 | Typing indicator + presence (ephemeral, WebSocket-only) | P9-T2 | Low | S | No backing table; confirmed lost silently on reconnect, by design |
| P9-T5 | Offer-in-thread rendering integration | P9-T1, P8-T3 | Medium | S | An `OfferCard` renders inline in the conversation it belongs to |

---

## Phase 10 — Notifications

**Purpose:** Close the loop on every async event generated by Phases 1–9 — a verification decision, a new message, an offer — so users don't have to poll the app to find out something happened.
**Depends on:** Cross-cutting — depends on every phase that produces a notifiable event (1 through 9), though it can be built incrementally alongside them rather than strictly after.
**Features:** In-app/email/push notifications; preferences; mark-read/delete; real-time badge updates.
**Database work:** `notifications`/`notification_preferences`/`push_device_tokens`/`push_notification_log` (`DATABASE_ARCHITECTURE.md` §10, §13).
**Backend work:** `notification-service` internal module (`ARCHITECTURE.md` §18); event-driven fan-out from every producing phase.
**Frontend work:** Notification bell/panel, preferences screen (`DESIGN_SYSTEM.md` §6).
**CRM work:** None directly.
**API work:** `API_SPECIFICATION.md` §10.
**Authentication impact:** None beyond standard ownership.
**Testing requirements:** Unit (preference-respecting fan-out logic, transactional-category override); Integration (a verification decision from Phase 5 produces a real notification); Manual QA (push delivery on real devices, once mobile exists — web/in-app is the MVP-critical path).
**Definition of Done:** Every event type already specified across Phases 1–9 (verification decision, new message, offer received, contract completed) produces a correctly-preferenced notification.
**Estimated complexity:** M.
**Estimated implementation order:** Threaded through Phases 3–9 incrementally, formally completed as its own phase once every event producer exists — this is the one phase in the plan that's genuinely continuous rather than a single discrete block, and should be resourced accordingly (a small amount of work per prior phase, not one large phase at the end).
**Potential risks:** Retrofitting notification hooks onto already-shipped features is exactly the kind of gap that gets missed — the same principle already stated for audit logging (`AUTHENTICATION.md` §21.4) applies here identically.
**Rollback considerations:** Notifications are the lowest-stakes data in the platform — a missed notification is a UX bug, not a data-integrity incident.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P10-T1 | `notifications`/`notification_preferences` schema + core fan-out service | P1-T3 | Critical | M | Transactional categories cannot be fully disabled, per `ARCHITECTURE.md` §18 |
| P10-T2 | Notification bell/panel (real-time badge via WebSocket) | P10-T1, P9-T2 | High | M | Badge updates live without polling |
| P10-T3 | Per-phase event wiring (verification, messaging, offers, etc.) | P10-T1 + relevant phase | High | M (repeated, small each time) | Each event type produces exactly one notification, no duplicates |
| P10-T4 | Push device token registration (mobile, when it ships) | P10-T1 | Low | S | Deferred until `apps/mobile` exists (Phase 2+ per `ARCHITECTURE.md` §5) |

---

## Phase 11 — Wallet & Payments

**Purpose:** Make hiring real by moving actual money — escrow, release, payouts, platform fee — through Razorpay.
**Depends on:** Phase 8 (contracts must exist to fund/release against).
**Features:** Wallet balance; escrow fund/release; payout methods; payment history; manual adjustments (Finance Manager, maker-checker); refunds.
**Database work:** `DATABASE_ARCHITECTURE.md` §12 in full, including the v1.1 `razorpay` processor enum and `manual_adjustment`/`reverses_transaction_id` additions.
**Backend work:** Razorpay Orders/Route/RazorpayX integration; webhook receiver (idempotent on `(processor, external_reference_id)`); ledger-write discipline (every money movement is a new `wallet_transactions` row, never an update).
**Frontend work:** Wallet balance card, `EscrowStatusBadge`, `TransactionRow`, Maker-Checker Approval Dialog (`DESIGN_SYSTEM.md` §19.4).
**CRM work:** Finance Manager's escrow/refund/manual-adjustment workflows (`CRM_SPECIFICATION.md` §12).
**API work:** `API_SPECIFICATION.md` §14 in full — this phase finally implements the `fund`/`release` endpoints Phase 8 stubbed.
**Authentication impact:** `financials:*` permission enforcement is the highest-stakes RBAC check in the platform — this phase is where a permission-check bug has direct monetary consequence, not just a data-exposure consequence.
**Testing requirements:** Unit (ledger arithmetic, idempotency key handling); Integration (Razorpay sandbox webhook → correct `wallet_transactions` rows, tested for double-delivery); API (escrow fund/release contract tests); Manual QA (a real sandbox transaction end-to-end, including a forced webhook retry to prove idempotency); **Security review mandatory before this phase can close** (`PROJECT_SETUP.md` §12).
**Definition of Done:** A Hirer can fund escrow for a real (sandbox) contract, a Talent can be paid out on release, the platform fee is correctly deducted and visible to both parties, and a manual adjustment above threshold requires a second Finance Manager's approval.
**Estimated complexity:** XL — the highest-stakes phase in the platform; correctness here is non-negotiable in a way no other phase's bugs are (a UI bug is embarrassing, a ledger bug is a financial liability).
**Estimated implementation order:** 9th. The **Private Beta checkpoint** (§7 below) depends on this phase being complete and specifically security-reviewed.
**Potential risks:** Razorpay Route's split-settlement model being less turnkey than Stripe Connect's marketplace tooling (`DECISIONS.md` ADR-003) means more of the escrow logic lives in GigRise's own ledger than it might with a different processor — this is an accepted, deliberate trade, but it means more surface area for GigRise-side bugs specifically in the fund/release logic, not the processor integration itself.
**Rollback considerations:** Never a destructive rollback — every correction is a new compensating `wallet_transactions` row (`refund`, `manual_adjustment`), per the platform's event-sourced ledger design (`DECISIONS.md` ADR-007). A bad deploy here is fixed by a code rollback plus, if needed, a manually-authored compensating transaction — never a database rollback of financial history.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P11-T1 | Wallet/`wallet_transactions` ledger schema | P8-T4 | Critical | L | Balance always derivable as `SUM(wallet_transactions)`, never independently mutable |
| P11-T2 | Razorpay integration (Orders, Route, RazorpayX) + webhook receiver | P11-T1 | Critical | XL | Idempotent under simulated duplicate webhook delivery |
| P11-T3 | Escrow fund/release, wired into Phase 8's stubbed endpoints | P11-T1, P11-T2 | Critical | L | Contract lifecycle completes end-to-end for the first time |
| P11-T4 | Manual adjustment + maker-checker approval dialog | P11-T1, P3-T2 | High | M | Above-threshold adjustment requires a second Finance Manager |
| P11-T5 | Refunds | P11-T2 | Medium | M | Writes a compensating transaction referencing the original via `reverses_transaction_id` |
| **Mandatory** | **Security review of this entire phase** | P11-T1–T5 | Critical | — | Sign-off required before Phase 11 is considered done, regardless of feature completeness |

---

## Phase 12 — Analytics

**Purpose:** Give Operations Manager/Super Admin/Finance Manager the platform-health visibility every prior phase's CRM work assumed would eventually exist.
**Depends on:** Most prior phases (read-only consumer of their data) — practically, this phase's value compounds the more of Phases 1–11 exist, but it can start as soon as Phase 3's CRM foundation and Phase 10's event pipeline exist.
**Features:** `analytics_daily_rollups` scheduled aggregation; CRM Analytics screens; growth/funnel/verification-time/approval-rate/revenue/retention metrics.
**Database work:** `DATABASE_ARCHITECTURE.md` §13 — `analytics_events` (raw) + `analytics_daily_rollups` (aggregated) + the scheduled rollup job.
**Backend work:** Rollup job (cron-scheduled); `API_SPECIFICATION.md` §5.4.
**Frontend work:** `AnalyticsChartCard` grid (`DESIGN_SYSTEM.md` §7/§8).
**CRM work:** This phase *is* the CRM Analytics module (`CRM_SPECIFICATION.md` §14).
**API work:** `GET /admin/analytics/{metric_key}`.
**Authentication impact:** None beyond `reports:view`/`financials:view` permission gating on specific metrics.
**Testing requirements:** Unit (rollup aggregation correctness against known fixture data); Integration (dashboard never queries raw `analytics_events` directly — enforced by code review, not just a runtime test); Manual QA (visual correctness of every chart against manually-computed expected values).
**Definition of Done:** Every metric named in `CRM_SPECIFICATION.md` §14 renders correctly from `analytics_daily_rollups`, and dashboard load time stays flat regardless of platform age (proven by testing against a large synthetic `analytics_events` fixture).
**Estimated complexity:** M.
**Estimated implementation order:** Can begin as early as Phase 3/10 are done, but realistically most valuable once Phases 4–11 are producing real events — treat as a rolling background phase, similar to Notifications.
**Potential risks:** A dashboard query accidentally hitting raw `analytics_events` instead of the rollup table would be invisible in a demo and only surface as a performance problem at real scale — worth an explicit code-review checklist item, not just a one-time test.
**Rollback considerations:** Purely derived, read-only data — trivially rebuildable, no risk to source-of-truth tables.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P12-T1 | `analytics_events` ingestion + `analytics_daily_rollups` scheduled job | P10-T1 | Critical | M | Rollup runs nightly, idempotent on reruns |
| P12-T2 | CRM Analytics dashboard screens | P12-T1, P3-T1 | High | M | Every metric in `CRM_SPECIFICATION.md` §14 renders |
| P12-T3 | Brand-facing campaign analytics | P12-T1, P7-T1 | Medium | S | Phase 2 feature per `ARCHITECTURE.md` §5; can ship after MVP |

---

## Phase 13 — AI Features *(Phase 3+, deferred)*

**Purpose:** Everything in `ARCHITECTURE.md` §21's AI roadmap, plus the four additions flagged across `CRM_SPECIFICATION.md` §22 and `API_SPECIFICATION.md` §16 — Profile/Portfolio Review AI, Creator Matching, Campaign Suggestions, Proposal/Resume Generators, Caption Generator, Fraud Detection, Duplicate Profile Detection, AI Support Assistant.
**Depends on:** Phases 5, 6, 7, 8 (needs real verification, search, campaign, and hiring data to train/assist against meaningfully).
**Features:** Listed above — every one has a manual fallback already built in an earlier phase (`ARCHITECTURE.md` §21's "AI accelerates, never gates" principle), meaning this phase adds capability, it doesn't unblock anything.
**Database work:** `services/ai` module scaffold only at this stage (`PROJECT_SETUP.md` §2.0a already flags no provider is chosen yet).
**Backend work:** Deferred pending AI provider selection — explicitly out of scope for this plan's near-term phases.
**Frontend work:** AI-assist affordances layered onto already-existing screens (e.g., a "Generate proposal" button on the application form built in Phase 8) — additive UI, not new pages.
**CRM work:** AI-assisted risk scoring in the verification queue (contingent on Phase 5 existing) and an AI Support Assistant for Support Executives.
**API work:** `API_SPECIFICATION.md` §16, all endpoints — every one Phase-3-flagged, none built at MVP.
**Authentication impact:** None.
**Testing requirements:** Deferred — will require its own evaluation methodology (model-output-quality testing) distinct from the deterministic testing used everywhere else in this plan, worth scoping separately when this phase is actually prioritized.
**Definition of Done:** Not applicable at this planning horizon — this phase is explicitly a placeholder, not a committed scope.
**Estimated complexity:** L (deferred) — sized only to flag that AI feature work is not "quick" once undertaken, not to commit to a schedule.
**Estimated implementation order:** Last among functional phases, and only after founder confirmation that AI investment is prioritized over further core-platform hardening.
**Potential risks:** Committing engineering time here before the core platform (Phases 1–12) is stable would be a sequencing mistake — every AI feature is explicitly additive per `ARCHITECTURE.md` §21, and building acceleration for a workflow that isn't solid yet is premature optimization of the wrong kind.
**Rollback considerations:** N/A at this stage.

### Feature Tasks
Deliberately not decomposed into tasks at this planning horizon — per `ARCHITECTURE.md` §21 and `CRM_SPECIFICATION.md` §22, this phase requires its own founder-approved scoping pass (including AI provider selection, which `PROJECT_SETUP.md` explicitly left unchosen) before task-level planning is meaningful. Producing a detailed task breakdown now would imply a commitment this plan doesn't make.

---

## Phase 14 — Testing & Security Hardening

**Purpose:** The comprehensive, cross-cutting pass before Production Launch — not a replacement for each phase's own testing (which is continuous, per every phase above), but the point where the *whole system* is tested together.
**Depends on:** All functional phases (1–12) substantially complete.
**Features:** Full regression E2E suite across every user journey; load testing (`k6`, `PROJECT_SETUP.md` §9); security review (OWASP ZAP baseline + manual review of every auth/payment-touching change); accessibility audit (WCAG 2.2 AA, `DESIGN_SYSTEM.md` §12); dependency/SAST scanning sweep.
**Database work:** Confirm every index flagged `[PARTITION CANDIDATE]` in `DATABASE_ARCHITECTURE.md` still matches real usage patterns at this point; run the RLS-adversarial test suite (from Phase 2) against the full, real schema, not just the proof-of-concept table.
**Backend work:** Load test the highest-traffic endpoints named in `API_SPECIFICATION.md` §25/`DATABASE_ARCHITECTURE.md` §18.4 (`/discover/talent`, `/messages`).
**Frontend work:** Cross-browser/cross-breakpoint visual regression pass; `prefers-reduced-motion` and keyboard-navigation audits (`DESIGN_SYSTEM.md` §12/§13).
**CRM work:** Full CRM workflow regression (verification, support, moderation, payments) with real (sandbox) data volume.
**API work:** Contract-test every endpoint in `API_SPECIFICATION.md` against its documented shape — a drift-detection pass, not new functionality.
**Authentication impact:** Full penetration-test-style review of the Supabase Auth integration specifically — the Custom Access Token Hook, the RBAC middleware, and RLS policies together, since this is the one area where a subtle bug has platform-wide consequence.
**Testing requirements:** This phase *is* the testing requirement — see Features above.
**Definition of Done:** Every quality gate in §5 below passes for the entire platform, not just per-phase; a security sign-off is recorded; a load test confirms acceptable latency at a defined target concurrency.
**Estimated complexity:** L.
**Estimated implementation order:** 2nd-to-last. The **Public Beta checkpoint** depends on this phase.
**Potential risks:** Discovering a structural issue this late (e.g., an RLS gap that only shows up under real data volume) is the most expensive class of bug to fix at this stage — mitigated by every prior phase's own Definition of Done already requiring its local tests to pass, so this phase should mostly *confirm*, not *discover*.
**Rollback considerations:** N/A — this is a testing phase, not a deploy.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P14-T1 | Full E2E regression suite across every user journey | Phases 1–12 | Critical | L | Every journey in `ARCHITECTURE.md` §4 passes unattended |
| P14-T2 | Load testing on highest-traffic endpoints | Phases 6, 9 | Critical | M | Documented latency targets met at defined concurrency |
| P14-T3 | Security review (auth, RBAC, RLS, payments) | Phases 1, 2, 11 | Critical | L | Formal sign-off recorded; no critical/high findings open |
| P14-T4 | Accessibility audit (WCAG 2.2 AA) | All frontend phases | High | M | Automated (axe-core) + manual keyboard-nav pass both clean |
| P14-T5 | Dependency/SAST scanning sweep | All phases | High | S | No unaddressed critical/high findings |

---

## Phase 15 — Production Deployment

**Purpose:** Go live.
**Depends on:** Phase 14 complete.
**Features:** Production environment cutover; monitoring/alerting fully live; rollback rehearsal; launch runbook.
**Database work:** Final migration review; confirm partitioning thresholds (`DATABASE_ARCHITECTURE.md` §18.2) are still "not yet needed" at actual launch volume, not just MVP-assumed volume.
**Backend work:** Production Supabase/Render/Vercel environments fully separated from Staging credentials (`PROJECT_SETUP.md` §12).
**Frontend work:** Production build verification, CDN cache warm-up for public pages.
**CRM work:** Confirm every CRM role's staff account is provisioned in Production (not just Staging test accounts).
**API work:** Final OpenAPI spec generation from the live FastAPI app, published as the authoritative reference.
**Authentication impact:** Production Supabase Auth project fully configured (not a copy of Staging settings assumed correct) — JWT expiry, MFA policy, and password rules independently verified in Production.
**Testing requirements:** Smoke test suite against Production immediately post-deploy; synthetic uptime monitoring live before traffic is directed at it.
**Definition of Done:** Production is live, monitored, and a rollback has been rehearsed (not just documented) at least once before real user traffic depends on it.
**Estimated complexity:** M.
**Estimated implementation order:** Last.
**Potential risks:** Production/Staging credential drift (a setting correct in Staging but never applied to Production) — the exact failure mode `PROJECT_SETUP.md` §12's "fully separate credential sets" principle exists to prevent; verify explicitly, don't assume parity.
**Rollback considerations:** Blue/green via Vercel's promote model (frontend) and Render's rolling-deploy model (backend), per `PROJECT_SETUP.md` §10.1 — rollback is redeploying the previous known-good commit SHA, rehearsed once in this phase specifically so it isn't first attempted during a real incident.

### Feature Tasks
| Task ID | Description | Dependencies | Priority | Difficulty | Acceptance Criteria |
|---|---|---|---|---|---|
| P15-T1 | Production environment provisioning (Supabase, Vercel, Render) | Phase 14 | Critical | M | Fully separate credentials from Staging, independently verified |
| P15-T2 | Monitoring/alerting live (Sentry, uptime, log aggregation) | P15-T1 | Critical | M | An injected test error is visible in Sentry within minutes |
| P15-T3 | Rollback rehearsal | P15-T1 | Critical | S | A deliberate bad deploy is rolled back successfully, timed |
| P15-T4 | Launch runbook + on-call assignment | P15-T1–T3 | High | S | Documented, assigned, not theoretical |

---

## 2. Global Testing Strategy (applies to every phase above)

Per `PROJECT_SETUP.md` §9's tool selection — this section states the *pattern*, not a per-phase repeat:
- **Unit Tests:** Vitest/React Testing Library (frontend), pytest (backend) — run on every PR, no exceptions.
- **Integration Tests:** pytest against a real ephemeral Postgres/Supabase test project — specifically proves RLS behavior, not just application-layer logic.
- **API Tests:** FastAPI `TestClient` contract tests against the documented `API_SPECIFICATION.md` shape — one suite that doubles as drift detection between code and documentation.
- **End-to-End Tests:** Playwright, one suite per user journey (`ARCHITECTURE.md` §4) — run on every `main` merge, not just at Phase 14.
- **Manual QA Checklist:** each phase's own section above lists its phase-specific manual checks; a running master checklist accumulates across phases and is fully executed once at Phase 14.

---

## 3. Deployment Checkpoints

| Checkpoint | Ready after | What's true at this point |
|---|---|---|
| **Internal Demo** | Phase 5 | Auth, RBAC, CRM foundation, profiles, and verification all work — the team can demo the core trust loop internally. No real external users. |
| **Closed Alpha** | Phase 10 | Discovery, campaigns, hiring, messaging, and notifications all work. A small trusted external cohort can complete a full hire loop — payments still sandboxed/manual. |
| **Private Beta** | Phase 11 (with its mandatory security review passed) | Real (sandbox-to-live-transition) payments work. Invite-only broader user base. |
| **Public Beta** | Phase 14 | Full regression, load, security, and accessibility passes complete. Open signups, monitoring live, support processes staffed. |
| **Production Launch** | Phase 15 | Full public launch. |

---

## 4. Quality Gates (apply at the close of every phase, not just at the end of the project)

No phase is complete until:
1. All tests for that phase pass (unit, integration, API, and any E2E journeys the phase completes).
2. Linting (ESLint/Ruff) and type-checking (`tsc`/`mypy`) pass with zero suppressed warnings introduced by the phase.
3. The relevant sections of `docs/*.md` are updated if the phase's implementation revealed a genuine specification gap (logged in `CHANGELOG.md`, per the standing process) — implementation should confirm the docs, not silently diverge from them.
4. A security review has occurred for any phase touching authentication, authorization, or payments (Phases 1, 2, 11 mandatorily; others as needed).
5. Performance is acceptable against that phase's relevant target (no `OFFSET` pagination introduced anywhere, no N+1 query pattern in a list endpoint, per `ARCHITECTURE.md` §24's standing coding rules).

---

## 5. Risk Register (by phase)

| Phase | Key Risk | Mitigation |
|---|---|---|
| 1 | Custom Access Token Hook silently serves stale/missing claims | Explicit test suite asserting every claim for every account state before any dependent phase begins |
| 2 | Ownership check missing in application code, undetected because RLS alone masks the gap in testing | Adversarial RLS test that deliberately disables the application-layer check and confirms RLS still blocks it |
| 4 | Video transcode failures with poor user feedback | Explicit UI state for `failed` transcode status, not just `queued`/`processing`/`ready` |
| 5 | "Verification-sensitive fields" founder decision still open | Ship the core submit/review/decide loop first; treat the edge case as a fast-follow, not a blocker |
| 7 | Pre-publish approval founder decision could add a state to the campaign lifecycle later | Design the `draft→open` transition as a single, replaceable step so inserting an approval gate is additive |
| 8 | Hiring shipped before escrow is live could create a trust gap | Explicit UI messaging that funding is a following step; do not rush Phase 11 to compensate |
| 11 | Ledger bugs have direct financial consequence | Mandatory security review before phase close; every correction is a new compensating transaction, never a mutation |
| 12 | Dashboard accidentally queries raw event tables instead of rollups | Code-review checklist item, not just a runtime test |
| 13 | Premature AI investment before core platform is stable | Explicitly sequenced last among functional phases, pending founder prioritization |
| 14 | Structural issues discovered late are the most expensive to fix | Every phase's own Definition of Done already requires passing tests, so Phase 14 mostly confirms rather than discovers |
| 15 | Staging/Production credential drift | Independently verify every setting in Production; never assume parity |

---

## 6. Project Timeline

**Critical path:** Phase 0 → 1 → 2 → 3 → 4 → 5 → (6 and 7 in parallel) → 8 → 11 → 14 → 15. This is the longest unavoidable chain — every phase on it blocks the next.

**Parallel work opportunities:**
- Phase 6 (Search) and Phase 7 (Campaigns) can be built simultaneously once Phase 5 completes — different engineers, no shared blocking dependency.
- Phase 9 (Messaging)'s core conversation/message functionality can be built in parallel with Phase 8 (Applications & Hiring), integrating only at the offer-in-thread feature.
- Phase 10 (Notifications) and Phase 12 (Analytics) are both "rolling" phases best resourced as a continuous small allocation threaded through Phases 3–11, not single discrete blocks at the end.
- Phase 13 (AI) has no forced position on the critical path at all — it can start whenever the founder prioritizes it, any time after Phase 8.

**Founder review checkpoints** (recommended, tied to the Deployment Checkpoints in §3):
1. **After Phase 2** — confirm RBAC/permission bundles match the founder's actual operational structure before CRM foundation is built on top of it.
2. **After Phase 5 (Internal Demo)** — the first point the founder can see the core trust loop working end-to-end; a natural gate before committing further engineering time to discovery/hiring features.
3. **After Phase 8/9 (Closed Alpha)** — before inviting real external users, confirm the hire+messaging loop feels right.
4. **After Phase 11 (Private Beta)** — the payments phase is the highest-stakes in the platform; a founder (and ideally a second technical reviewer's) sign-off here is warranted beyond the mandatory engineering security review.
5. **After Phase 14 (Public Beta)** — final go/no-go before opening signups broadly.

---

## 7. Final Output

### Recommended First Coding Milestone
Not a feature — **Phase 1's Custom Access Token Hook, tested end-to-end against every claim every later phase depends on**, exactly as `AUTHENTICATION.md` §21.4 and `PROJECT_SETUP.md` §15.5 already concluded independently of this plan. Every other phase in this document assumes that foundation is correct; it should be the first thing proven, not assumed.

### Recommended First Git Commit
An empty-but-real monorepo scaffold (Phase 0, tasks P0-T1/P0-T2): the folder structure from `PROJECT_SETUP.md` §2 with placeholder `apps/web`, `apps/admin`, `apps/api` that each build and deploy successfully with no functionality — proving the pipeline before proving any feature. Commit message: `chore: scaffold monorepo structure per PROJECT_SETUP.md §2`.

### Recommended Branching Strategy
Trunk-based, exactly as `PROJECT_SETUP.md` §7 specifies: short-lived feature branches off `main`, `main` always deployable to Staging, gated manual promotion to Production. No long-lived `develop` branch. Branch names should reference the phase/task ID they implement (e.g., `feat/p5-t3-verification-queue`) so a reviewer can immediately locate the relevant phase in this document.

### Recommended Review Process
Every PR reviewed against `PROJECT_SETUP.md` §7's checklist, with one addition specific to this plan: **a PR should name which Task ID(s) it completes**, so progress against this roadmap is traceable directly from git history, not inferred after the fact. Phases 1, 2, and 11 (identity, authorization, payments) warrant a second reviewer beyond standard PR review, given their platform-wide blast radius.

### Most Critical Engineering Risks
1. **The Custom Access Token Hook (Phase 1)** — the single piece of genuinely new, unprecedented code in the entire reconciled architecture; a subtle bug here is invisible until an authorization check downstream fails in a confusing way.
2. **RLS/ownership-check completeness (Phase 2)**, since the whole four-layer authorization model's value depends on layer 3 and layer 4 actually being independently correct, not just "probably fine because the other layer would catch it."
3. **The Wallet & Payments ledger (Phase 11)** — the one phase where a bug has direct financial consequence rather than a UX or data-exposure consequence.

### Overall Implementation Confidence
**High.** Every phase in this plan traces to an already-finalized, internally-consistent specification across ten prior documents, with dependencies made explicit and no circular requirements (the one ordering conflict found — Verification before Profiles — was resolved and stated, not silently inherited). The engineering path from here is executional, not exploratory: what's left is building carefully in the order above, closing the founder decisions this document doesn't resolve on its own, and treating Phases 1, 2, and 11 with the elevated scrutiny their blast radius warrants.

---

*End of implementation plan. Subordinate to all ten prior documents; does not alter any of them. Recorded as a new document in `CHANGELOG.md`.*
