# GigRise — Architecture Decision Record (ADR)

This is the canonical log of *why*, not just *what*. Every document in `docs/` states design decisions inline, but the reasoning behind the biggest ones is scattered across seven-plus documents written at different times. This file consolidates the major decisions in one place, in the standard ADR shape (Context → Decision → Consequences), so a future engineer can find "why did we choose X" without re-reading the entire documentation set.

**Status key:** `Accepted` (settled, build against it), `Accepted — pending founder confirmation` (the recommended default, not yet formally signed off), `Superseded` (replaced by a later ADR, kept for history).

---

## ADR-001: Use Supabase Auth as the Identity Provider
**Status:** Accepted
**Context:** `AUTHENTICATION.md` v1.0 designed a fully custom authentication system — self-owned password hashing, self-issued JWTs, hand-built session/refresh-token rotation with replay detection, custom TOTP MFA. When `PROJECT_SETUP.md` selected Supabase as the database/storage/realtime platform, it became clear that also building a from-scratch credential/session system alongside Supabase's own built-in identity product (Supabase Auth / GoTrue) would mean maintaining two overlapping pieces of security-critical infrastructure — one bespoke, one managed — for no corresponding benefit.
**Decision:** Supabase Auth owns credential storage, password verification, session issuance, refresh-token rotation, email verification, password reset, OAuth exchange, and MFA. GigRise builds none of this itself. `public.users` becomes a 1:1 extension of Supabase's `auth.users`, keyed by the same UUID. Everything GigRise-specific — RBAC, the verification workflow, CRM permissions, audit logging, business logic — sits on top of whichever token Supabase issues, unchanged.
**Consequences:** Positive — removes an entire category of key-management and credential-storage risk from GigRise's own operational surface; Supabase's refresh-token rotation already includes reuse detection, which is the same protection `AUTHENTICATION.md` v1.0 designed custom, now free. Negative — password hashing becomes Supabase's bcrypt rather than the originally-specified Argon2id (see ADR-017); JWT custom claims require a Supabase Custom Access Token Hook, a new integration point that didn't exist in the pre-Supabase design; `AUTHENTICATION.md` and `DATABASE_ARCHITECTURE.md` required a structural amendment (v2.0 and v1.1 respectively) rather than an additive one.

## ADR-002: Override Supabase's default access-token lifetime to 15 minutes
**Status:** Accepted — pending founder confirmation of the exact figure
**Context:** `AUTHENTICATION.md` v1.0 specified a 15-minute access token as a deliberate security parameter (bounding the theft-damage window). Supabase Auth's project default is 1 hour.
**Decision:** Reconfigure the Supabase project's JWT expiry setting to 15 minutes rather than silently inheriting the 1-hour default, preserving the original security posture `AUTHENTICATION.md` reasoned about.
**Consequences:** Slightly more frequent token refreshes (negligible cost, refresh is a stateless, cheap operation); requires this setting to be part of initial Supabase project provisioning, not an afterthought — flagged as a dependency in `AUTHENTICATION.md` §21.5.

## ADR-003: Use Razorpay as the payment processor
**Status:** Accepted
**Context:** `ARCHITECTURE.md` §24 left the payment processor as an open question, suggesting Stripe Connect as the natural marketplace-escrow fit. `PROJECT_SETUP.md` §0.3 confirmed Razorpay instead, which strongly implies an India-inclusive launch geography (also previously an open question).
**Decision:** Razorpay is the processor. Since Razorpay's escrow-adjacent primitive (Route, for split settlements) is less turnkey than Stripe Connect's marketplace tooling, GigRise's own `escrow_holds`/`wallet_transactions` ledger (already designed as the source of truth, not the processor) holds the actual escrow state; Razorpay is used only as the money-in/money-out rail via its Orders API, Route, and RazorpayX for payouts.
**Consequences:** No schema redesign needed — the `payments` vs. `wallet_transactions` split was already the correct division of responsibility regardless of processor. The `payments.processor` enum needed a small, previously-missed update from `stripe|other` to `razorpay|other` (closed in this pass). Launch geography should be explicitly confirmed as India-inclusive rather than left implicit.

## ADR-004: Use FastAPI for the backend
**Status:** Accepted
**Context:** The backend needed to serve a large, precisely-specified REST contract (`API_SPECIFICATION.md`) with strong request/response validation and minimal drift between the documented contract and the implemented one.
**Decision:** FastAPI + Pydantic + SQLAlchemy + Alembic. FastAPI's automatic OpenAPI generation, driven directly by the same Pydantic models that validate requests, means the documented contract and the generated API documentation are structurally the same artifact — directly serving `API_SPECIFICATION.md` §24's stated goal that the document be "organized so generating an OpenAPI spec later is straightforward."
**Consequences:** Validation-at-the-boundary (`ARCHITECTURE.md` §15's security principle) is enforced by construction, not by developer discipline. Postgres RLS policies fall outside SQLAlchemy/Alembic's native modeling and must be written as raw SQL within migrations — a known, accepted tooling gap, not a blocker.

## ADR-005: Use Next.js 15 for both frontend apps
**Status:** Accepted
**Context:** Public profile and campaign pages need to be SEO-indexable (`ARCHITECTURE.md` §24); the Admin CRM and Talent/Hirer app share a large component library and design token system.
**Decision:** Next.js 15 (App Router) for both `apps/web` and `apps/admin`, server-rendering public/SEO-relevant pages, sharing `packages/ui`/`packages/types` across both apps.
**Consequences:** One framework, one deployment model (Vercel, per the hosting decision in `PROJECT_SETUP.md` §10.1), one component library serving two apps — directly reduces the risk of visual/behavioral drift between the CRM and the main product that a fully separate tech stack per app would risk.

## ADR-006: Shared `TalentProfile`/`HirerProfile` base tables (class-table inheritance) instead of one table per concrete type
**Status:** Accepted
**Context:** The founder's original request implied six separate profile tables (Creator, Actor, Brand, Casting Director, Admin, Super Admin). Modeling each as a fully independent table would mean a future fifth talent type or third hirer type requires touching every table and query that already assumed exactly two types per side.
**Decision:** One shared base table per side (`talent_profiles`, `hirer_profiles`) carrying every field common to both concrete types, plus a 1:1 detail-extension table per concrete type (`creator_profile_details`, `actor_profile_details`, etc.) for type-specific fields.
**Consequences:** Adding a new talent/hirer type later is one new detail table + one new enum value — every table that references `talent_profiles.id` (applications, contracts, reviews, search) is completely untouched. The cost is one extra join when reading full type-specific detail, judged worth it for the addressed extensibility property.

## ADR-007: Event-sourced wallet ledger (`wallet_transactions` as source of truth, not a mutable balance field)
**Status:** Accepted
**Context:** GigRise handles real money (escrow, payouts, platform fees) and needs the same auditability and dispute-resolution integrity real accounting systems require.
**Decision:** `wallets.cached_balance_cents` is a cache, recomputed and periodically reconciled; the actual balance is always `SUM(wallet_transactions.amount_cents)`. No transaction row is ever updated or deleted — a correction is a new, compensating transaction (`manual_adjustment`, `refund`, etc.).
**Consequences:** Every financial dispute is resolvable by replaying the ledger, not by trusting a single mutable number. `wallet_transactions` has no `UPDATE`/`DELETE` grant for any role, enforced at the database privilege level, the same treatment given to `audit_log_entries` — this is a deliberate, structural parallel between "money history" and "security history," both immutable for the same underlying reason.

## ADR-008: Cursor-based pagination everywhere, never `OFFSET`
**Status:** Accepted
**Context:** `OFFSET`-based pagination degrades badly at scale (the database still has to scan and discard every skipped row) and doesn't handle concurrent inserts/deletes gracefully (items can shift between pages).
**Decision:** Every list endpoint uses `?cursor=<opaque>&limit=<n>`, encoding the last-seen sort key. No endpoint in the entire API specification accepts a `?page=N` parameter.
**Consequences:** The UI never offers "jump to page 40" (`DESIGN_SYSTEM.md` §7's Pagination component reflects this constraint honestly rather than implying a capability that doesn't cheaply exist) — a deliberate UX trade-off in exchange for pagination performance that stays flat as tables grow into the tens of millions of rows.

## ADR-009: Ship one FastAPI monolith at MVP, organized into service-shaped internal modules
**Status:** Accepted
**Context:** `ARCHITECTURE.md` §11 sketched `messaging-service`, `payments-service`, `media-service`, etc. as separately deployable services. Adopting Supabase (a single managed Postgres instance) made a literal day-one microservice split both premature and, for the database layer, not actually possible without operating multiple Postgres instances.
**Decision:** `apps/api` is one FastAPI application at MVP, with an internal `services/` package per `ARCHITECTURE.md` §11's original service names (`services/messaging/`, `services/payments/`, etc.) — the code is already boundary-shaped, so extracting any one of them into its own deployment later is a deployment change, not a rewrite.
**Consequences:** Faster initial build, lower operational overhead, no premature infrastructure investment — directly consistent with `ARCHITECTURE.md` §23's "scale capacity, not architecture" principle. The trade is that until a service is actually extracted, it shares a process and a failure domain with every other module — an accepted risk at MVP scale, revisited only once a specific module's load profile genuinely diverges from the others'.

## ADR-010: Manual (human) verification at launch, not AI-automated
**Status:** Accepted
**Context:** GigRise's core differentiator is trust — a Verified badge should mean a human confirmed identity and portfolio authenticity, not an algorithm's guess. `ARCHITECTURE.md` §21 designed AI-assisted review as an *accelerant* for human reviewers, explicitly not a replacement, deferred to Phase 3.
**Decision:** Every verification decision (approve/reject/request-changes) is made by a human Verification Executive at launch. AI pre-screening is future scope, and even once built, is designed to draft a *suggestion* for a human to approve, never to auto-decide.
**Consequences:** Verification Executive throughput becomes the platform's actual growth ceiling (`CRM_SPECIFICATION.md` §23.3) — an operational, headcount-planning risk rather than a technical one, explicitly flagged rather than hidden behind an assumption that AI would solve it early.

## ADR-011: No profile is ever public automatically — CRM-mediated verification gates every marketplace-facing action
**Status:** Accepted
**Context:** This is the founding premise of the entire platform (`ARCHITECTURE.md` §2), restated here because it's the decision every other document's access-control logic ultimately traces back to.
**Decision:** `verification_status` starts at `draft` for every new profile and must pass through an explicit CRM-mediated `pending_review → approved` transition before the profile is discoverable, before the account can apply/hire, and before it appears in search. This gate is orthogonal to and independent of `account_status` (§12 of `AUTHENTICATION.md`) — a fully "active" account can still be functionally restricted by an unapproved verification state.
**Consequences:** Every feature built on top of this platform must check `verification_status`, not just `account_status`, before granting marketplace access — a rule enforced at all four authorization layers (`AUTHENTICATION.md` §14), not left to any single layer to remember.

## ADR-012: UUIDv7 primary keys, generated application-side
**Status:** Accepted
**Context:** Sequential integer IDs leak business metrics and enable enumeration attacks; random UUIDv4 avoids that but fragments B-tree indexes under high insert volume.
**Decision:** UUIDv7 (time-ordered, non-sequential-looking) primary keys everywhere, generated in the FastAPI/Python application layer rather than as a Postgres column default, since Supabase's managed Postgres doesn't guarantee a UUIDv7-generating extension is available.
**Consequences:** Good index locality at scale, non-guessable IDs, and — not incidentally — a natural future sharding key (`talent_profile_id`/`hirer_profile_id`) if GigRise ever reaches the scale where that's the right lever (`DATABASE_ARCHITECTURE.md` §18.6).

## ADR-013: REST, not GraphQL, for the v1 API
**Status:** Accepted — revisit conditionally
**Context:** GraphQL's aggregation flexibility is attractive for dashboard-style screens that otherwise need several REST calls stitched together client-side.
**Decision:** REST for v1, specifically because its per-resource cacheability (`API_SPECIFICATION.md` §1.8's three-tier caching model) and predictable, easily-audited contract shape matter more while the platform and its API contract are both still young and rapidly reviewed against five other documents.
**Consequences:** Some dashboard screens do require multiple round trips at MVP. `API_SPECIFICATION.md` §27 explicitly names the condition under which this should be revisited — a measured "N REST calls per dashboard screen is now a proven bottleneck," not GraphQL's general popularity — so this decision has a stated, falsifiable trigger for reversal rather than being permanent by default.

## ADR-014: Postgres RLS as defense-in-depth beneath application-layer RBAC, never a replacement for it
**Status:** Accepted
**Context:** Supabase makes RLS a first-class, easy-to-reach-for tool; it would be possible (and tempting) to rely on RLS as the *only* authorization boundary.
**Decision:** Application code (FastAPI service/repository layer) still enforces every ownership and permission check explicitly. RLS is the backstop that holds even if application code has a bug — not a substitute for writing the check in the first place.
**Consequences:** Two places to get an authorization rule right instead of one — more work, deliberately, because it means a single missed `WHERE` clause in application code is a bug, not a breach. This is directly reinforced, not weakened, by the Supabase Auth decision (ADR-001): Supabase RLS's native `auth.uid()` pattern is exactly the ownership-check idiom `DATABASE_ARCHITECTURE.md` already assumed.

## ADR-015: A two-tier accent color system (Spotlight Gold + Trust Indigo) instead of one brand color
**Status:** Accepted
**Context:** The brief called for a premium, distinctive identity that doesn't read as "another indigo/blue SaaS dashboard" (Linear, Stripe, Vercel all lean the same direction) or "generic corporate blue" (LinkedIn).
**Decision:** Gold (muted, entertainment-industry-adjacent — marquee/award connotation) is reserved exclusively for the brand's premium moments (primary CTA, Verified badge). Indigo handles all other interactive/informational UI. The two never share an element.
**Consequences:** A genuinely distinctive visual identity that still reads as restrained and professional rather than decorative — the trade is that this discipline must be maintained as the component library grows; a future contributor reaching for gold "because it looks nice" on a non-premium element would erode the exact signal this system is built to protect.

## ADR-016: Defer Terraform/Kubernetes until a managed-hosting ceiling is actually reached
**Status:** Accepted
**Context:** `ARCHITECTURE.md` §11 originally sketched an infra-as-code/Kubernetes layer. Adopting Supabase (managed database/auth/storage/realtime) plus Vercel/Render (managed application hosting) means there is no infrastructure left in GigRise's own operational scope to write Terraform or Kubernetes manifests for at MVP.
**Decision:** No `infra/terraform/` or `infra/k8s/` folder exists in the repository at MVP. These are added back, additively, only when GigRise outgrows a specific managed service (e.g., a self-hosted Postgres cluster past Supabase's ceiling).
**Consequences:** Faster initial setup, no premature operations investment — consistent with `ARCHITECTURE.md` §23's scaling philosophy applied to infrastructure specifically, not just application architecture.

## ADR-017: Accept bcrypt (via Supabase Auth) over the originally-specified Argon2id
**Status:** Accepted
**Context:** `AUTHENTICATION.md` v1.0 and `DATABASE_ARCHITECTURE.md` v1.0 specified Argon2id for password hashing. Supabase Auth's internal implementation uses bcrypt and doesn't expose a choice of algorithm.
**Decision:** Accept bcrypt as a consequence of ADR-001, rather than either rejecting Supabase Auth over this detail or attempting to layer a custom hash on top of a managed identity provider (which isn't how Supabase Auth is designed to be used).
**Consequences:** This is stated plainly rather than glossed over: bcrypt is a very slightly weaker default than Argon2id under certain modern cost-tuning comparisons, but remains an industry-standard, well-audited algorithm, and Supabase's implementation is maintained by a team whose product is identity infrastructure specifically. Judged an acceptable trade for not maintaining bespoke credential-storage code at all — flagged in `AUTHENTICATION.md` §21.1 as one of the items the founder should explicitly sign off on, precisely because it wasn't the original assumption.

## ADR-018: Adopt Turborepo alongside pnpm workspaces
**Status:** Accepted
**Context:** `PROJECT_SETUP.md` §6 originally specified pnpm workspaces only, with no build-orchestration tool named. During Phase 0.1 (Repository & Monorepo Foundation) implementation, the founder explicitly requested Turborepo be configured, overriding the as-written document — a new external dependency not previously named in `PROJECT_SETUP.md` §1, which `MASTER_DEVELOPMENT_GUIDE.md` §29 requires an ADR for.
**Decision:** Turborepo orchestrates `dev`/`build`/`lint`/`type-check`/`test` across every workspace package, including `apps/api` (Python/FastAPI), via a thin `package.json` wrapper in `apps/api` whose npm scripts shell out to `uv` — this keeps one uniform task-runner interface across a mixed TypeScript/Python monorepo rather than Turborepo only covering the JS/TS packages.
**Consequences:** Gains task-graph caching and parallelization (`turbo run build` only rebuilds what changed) at the cost of one more tool in the stack and one more piece of root-level config (`turbo.json`) to keep in sync as new packages are added. Since `apps/api`'s real dependency management is still `uv`/`pyproject.toml` — Turborepo only orchestrates *when* its scripts run, never *what* they install — this doesn't change any decision `PROJECT_SETUP.md` §1.2 made about the Python toolchain itself.

## ADR-019: Adopt Netlify instead of Vercel for `apps/web`/`apps/admin` hosting
**Status:** Accepted
**Context:** `PROJECT_SETUP.md` §10.1 named Vercel as the hosting platform for both Next.js apps. During deployment setup, the founder provisioned a Netlify project instead — a new external dependency not previously named in `PROJECT_SETUP.md` §1, which `MASTER_DEVELOPMENT_GUIDE.md` §29 requires an ADR for. This supersedes the Vercel-specific reasoning in ADR-004's consequences and ADR-016's context (both mentioned Vercel only as a supporting detail of other decisions, not as their own subject).
**Decision:** Netlify hosts both `apps/web` and `apps/admin` — same monorepo, same repository, connected via Netlify's native pnpm-workspace/monorepo support (base directory per site, root-level install). `@netlify/plugin-nextjs` (Netlify's official Next.js runtime, auto-detected) provides App Router/server-component support equivalent to what Vercel would have given natively.
**Consequences:** Loses Vercel's zero-config first-party Next.js integration in favor of a plugin-mediated one — functionally equivalent for this stack's needs (SSR, route handlers, middleware), but any brand-new Next.js feature lands on Netlify slightly after it lands on Vercel, since Vercel ships it first-party. `PROJECT_SETUP.md` §10.1 and its blue/green/preview-deployment description are updated to describe Netlify's deploy-preview/rollback model instead of Vercel's, per this ADR.

---

## How to Add a New ADR
Number sequentially, never renumber or delete a past ADR — if a decision changes, add a new ADR that marks the old one `Superseded` and explains why (the same pattern `AUTHENTICATION.md` v2.0 used for its own relationship to v1.0). Every ADR here should be traceable to at least one line in `CHANGELOG.md` if it resulted in a document amendment.
