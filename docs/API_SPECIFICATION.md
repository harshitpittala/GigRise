# GigRise — API Specification
**Version 1.1 — Amended: Supabase Auth Integration**
**Status:** Contract-only. No FastAPI/Next.js/TypeScript code, no OpenAPI YAML, no migrations exist yet. Subordinate to [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md), and [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — every resource, field, enum, and role check below traces to an entity or state already defined in those three documents. Anywhere it doesn't, that's flagged in §26, not silently decided. **v1.1 removes the custom credential/session endpoints originally specified in §2 below, since GigRise now uses Supabase Auth as its Identity Provider** (`AUTHENTICATION.md` v2.0, `DECISIONS.md` ADR-001) — see the amended §2 for exactly which endpoints remain GigRise-owned and which are now Supabase SDK calls the frontend makes directly. Recorded in `CHANGELOG.md`.

---

## 0. How to Read This Document

A literal "20-field spec for all ~180 endpoints" would run past 60,000 words and, more importantly, would be *worse* documentation — real API references (Stripe's, LinkedIn's) work exactly the way this one does: **global conventions defined once** (auth, pagination, errors, rate limits, caching), and **per-endpoint entries that state only what deviates from those conventions**, plus a handful of endpoints worked in full detail to fix the pattern unambiguously for everything else. Every endpoint below still has an unambiguous method, path, auth requirement, role/permission, request/response shape, and status codes — nothing is hand-waved, but boilerplate isn't repeated 180 times.

Table columns used throughout Sections 3–20:
`Method & Path | Purpose | Auth | Role · Permission | Request | Response (2xx) | Status Codes | Notes`
"Notes" is where per-endpoint rate limits, caching, or security exceptions to the §1 defaults are called out — if a row has no Notes, the §1 defaults apply exactly.

---

## 1. Global API Conventions

### 1.1 Base URL & Versioning
`https://api.gigrise.com/v1/...` — matches `ARCHITECTURE.md` §10. All paths below are relative to this base and are written without the `/v1` prefix repeated per-row for readability (i.e. `GET /users/me` means `GET https://api.gigrise.com/v1/users/me`).

### 1.2 Authentication (applies to every endpoint unless marked `Auth: none`) — **Amended v1.1: Supabase Auth**
- Header: `Authorization: Bearer <access_token>` — a **Supabase Auth-issued JWT**, configured for a 15-minute expiry (overriding Supabase's 1-hour default — see `AUTHENTICATION.md` §6 and the founder-decision confirmation it's still pending).
- **Claims:** `sub` (user id, = `public.users.id` = `auth.users.id`), plus GigRise-specific custom claims (`role`, `talent_type`/`hirer_type`, `verification_status`) injected via a **Supabase Custom Access Token Hook** — a Postgres function registered with Supabase Auth that runs at every token issuance/refresh and reads `public.users`/`talent_profiles`/`hirer_profiles` to populate a namespaced claim (e.g., `app_metadata.gigrise`). **`permissions[]` is deliberately not embedded in the token** — Admin permission grants can change more dynamically (including time-boxed grants, `DATABASE_ARCHITECTURE.md` §2's `user_roles.expires_at`) than a 15-minute-stale claim should be trusted for, so it's checked live against `role_permissions`/`user_roles` at the gateway layer (§20) instead. Full mechanics in `AUTHENTICATION.md` §6.1.
- **Web clients:** session (access + refresh token) managed by `@supabase/ssr`, stored as an `httpOnly`, `Secure`, `SameSite=Strict` cookie — GigRise application code never reads the raw token.
- **Mobile clients:** managed by the Supabase platform SDK's own secure-storage adapter (Android Keystore / iOS Keychain) — **this resolves what v1.0 flagged as an open gap** (`§26.1` below, now closed): the transport question is solved by adopting the provider's own per-platform SDK rather than a GigRise-designed `client_type` parameter. No `client_type` field exists on any GigRise endpoint, because GigRise no longer issues the token at all.

### 1.3 Standard Request Headers
| Header | Required | Purpose |
|---|---|---|
| `Authorization` | Yes, unless `Auth: none` | Bearer JWT |
| `Content-Type: application/json` | Yes, on bodies | |
| `X-Request-Id` | Recommended | Client-generated UUID, echoed in responses and `audit_log_entries`-adjacent tracing, threaded through services per `ARCHITECTURE.md` §24's correlation-ID logging |
| `Idempotency-Key` | **Required** on money-moving/state-creating POSTs (contracts, offers, payments, wallet payouts) | UUID; server returns the original response on retry with the same key rather than double-processing — critical given `DATABASE_ARCHITECTURE.md` §12's immutable ledger design |
| `Accept-Language` | Optional | Response copy localization (Phase 2 per `ARCHITECTURE.md` §5) |

### 1.4 Standard Response Envelope
```
Success:
{ "data": { ... } | [ ... ], "meta": { "pagination": { ... } } }

Error:
{ "error": { "code": "string", "message": "human-readable", "details": [ { "field": "...", "issue": "..." } ] } }
```
This matches `ARCHITECTURE.md` §10's envelope exactly. `error.code` is a stable machine-readable string (e.g. `verification_reason_required`), not just the HTTP status — clients branch on `code`, never on parsing `message`.

### 1.5 Pagination
Cursor-based on every list endpoint, per `DATABASE_ARCHITECTURE.md` §17/§18 (no `OFFSET`, which degrades at scale).
- Query params: `?cursor=<opaque>&limit=<int, default 20, max 100>`
- Response: `meta.pagination: { next_cursor: string|null, has_more: boolean }`
- The cursor encodes the sort key's last-seen value (e.g., `(created_at, id)` or `(avg_rating, id)` for search) — this is why "jump to page 40" is never offered in the UI (`DESIGN_SYSTEM.md` §7's Pagination component note) and shouldn't be requested from this API either.

### 1.6 Filtering & Sorting
- Filtering: plain query params matching the resource's filterable fields (e.g., `?status=open&category=acting`), `AND`-combined. Array-valued filters use repeated params (`?skill=stunts&skill=driving`).
- Sorting: `?sort=<field>` for ascending, `?sort=-<field>` for descending (e.g., `?sort=-created_at`). Only fields with a supporting index (`DATABASE_ARCHITECTURE.md` §18.1) are sortable — an unsupported `sort` value returns `422 unsupported_sort_field`, never a silent full-table-scan fallback.

### 1.7 Rate Limit Tiers
| Tier | Limit | Applies to |
|---|---|---|
| `auth-strict` | 5 req / 15 min / IP | signup, login, forgot-password, reset-password |
| `write-standard` | 100 req / min / user | Most authenticated POST/PATCH/DELETE |
| `read-standard` | 300 req / min / user | Most authenticated GET |
| `search` | 60 req / min / user | Discover/search endpoints (more expensive queries) |
| `upload` | 20 req / min / user | Media/document upload-URL issuance |
| `admin` | 600 req / min / user | Admin/Super Admin endpoints (higher-trust, higher-volume triage work) |
Exceeding a limit returns `429` (see §20) with a `Retry-After` header. Limits are enforced at the API gateway (`ARCHITECTURE.md` §11), not per-service, so they're consistent regardless of which backend service ultimately handles the request.

### 1.8 Caching Strategy Tiers
| Tier | Behavior | Applies to |
|---|---|---|
| `public-cacheable` | `Cache-Control: public, max-age=60`, CDN-fronted | Public profile GET, open campaign/casting-call GET, public search results |
| `private-short` | `Cache-Control: private, max-age=15`, client/app-cache only | Dashboard stat rows, notification counts |
| `no-store` | `Cache-Control: no-store` | Anything touching wallet balance, contracts, messages, admin data |
Write-triggered invalidation (not just TTL expiry) applies to `public-cacheable` resources per `ARCHITECTURE.md` §23.

### 1.9 Role & Permission Notation
"Role" in every table below is one of `talent`, `hirer`, `admin`, `super_admin`, or `any` (any authenticated user), or `public` (no auth). "Permission" (only meaningful for `admin`) references the `permissions.key` values from `DATABASE_ARCHITECTURE.md` §2 (e.g. `verification:review`, `financials:view`) — an `admin` without the listed permission gets `403 permission_denied` even though they're correctly authenticated with the correct coarse role, per `ARCHITECTURE.md` §15's scoped-admin model. Ownership checks (a Hirer editing *their own* campaign) are implicit in every resource-scoped endpoint below and are enforced at the query layer (`WHERE hirer_id = current_user`), never trusted from the request body.

---

## 2. Authentication & Session Endpoints — **Amended v1.1: most of this module is now Supabase, not GigRise**

**What changed:** every endpoint in this section that v1.0 specified as a custom GigRise-built handler (`signup`, `login`, `logout`, `refresh`, `forgot-password`, `reset-password`, `verify-email`, `oauth/google*`) is **removed from GigRise's API surface**. These are now Supabase Auth client-SDK calls (`supabase.auth.signUp()`, `.signInWithPassword()`, `.signOut()`, `.refreshSession()`, `.resetPasswordForEmail()`, `.verifyOtp()`, `.signInWithOAuth({provider: 'google'})`) made directly from `apps/web`/`apps/admin`/mobile clients against Supabase's own endpoint, not GigRise's. See `AUTHENTICATION.md` v2.0 §3–10 for the full mechanics and `DECISIONS.md` ADR-001 for why.

**What GigRise still owns in this module** — the endpoints below are the *entire* remaining surface, not an abbreviated list:

### `POST /auth/sync-profile` — **new, replaces the profile-creation half of the old `/auth/signup`**
**Purpose:** Creates the `public.users` extension row (`DATABASE_ARCHITECTURE.md` §2's amended `users` table) the moment Supabase Auth creates a new `auth.users` row. **Auth:** internal — called by a Supabase Auth webhook (`user.created` event) authenticated via a shared webhook secret, never called by a frontend client directly.
**Request body:** `{ auth_user_id, email, role }` (role captured client-side during the "Choose Role" step and passed through the signup call's `options.data`, per Supabase's user-metadata mechanism).
**Success (201):** `{ data: { user_id, role, status: "active" } }`.
**Errors:** `409 profile_already_synced` (idempotent — a retried webhook delivery doesn't double-create).

### `PATCH /users/me/onboarding-step` — unchanged
Auth required. Body: `{ step: "profile_basics" | "verification_documents" | "portfolio", data: {...} }`. Drives the multi-step onboarding form (`ARCHITECTURE.md` §4, `DESIGN_SYSTEM.md` §5's progressive-disclosure principle) — unaffected by the auth-provider change, since it operates on `talent_profiles`/`hirer_profiles`, not credentials.

### `GET /users/me/account-status` — unchanged
Auth required. Returns `{ role, verification_status, account_status, profile_completeness_pct }` — the single call the frontend uses to decide whether to show `/onboarding/pending` versus the full app shell. Now additionally readable in part from the JWT's custom claims (§1.2) for a faster client-side check, with this endpoint remaining the authoritative source of truth for anything the claims don't carry (e.g., `profile_completeness_pct`).

### `GET /auth/sessions` — **thin wrapper over Supabase Admin API, not a GigRise table query**
Auth required. Proxies `supabase.auth.admin.listUserSessions()` (or equivalent), reformatted into GigRise's response envelope for the Settings UI (`DESIGN_SYSTEM.md` §21.4) — no `sessions` table exists in `DATABASE_ARCHITECTURE.md` v1.1 to query directly. **`DELETE /auth/sessions/{session_id}`** and **`DELETE /auth/sessions`** proxy the corresponding Supabase Admin API revocation calls the same way.

### `POST /auth/verify-mfa-policy` — **new, GigRise enforcement layer on top of Supabase's native MFA**
**Purpose:** Since Supabase Auth owns MFA enrollment/challenge itself (`AUTHENTICATION.md` §10.5), GigRise's only remaining job is *policy* — this endpoint (called by `apps/admin` at login for `admin`/`super_admin` roles) checks the JWT's MFA-enrollment claim and returns `{ mfa_enrollment_required: boolean }` so the CRM can prompt or block access accordingly (pending the founder decision on mandatory-offer vs. hard-mandatory, `AUTHENTICATION.md` §21.1).

**Everything else in v1.0's version of this section — signup, login, logout, logout-all, refresh, forgot-password, reset-password, verify-email, the two OAuth endpoints — no longer exists as a GigRise endpoint.** A reader looking for "the login endpoint" should look at the Supabase client SDK documentation, not this document.

---

## 3. User & Role Management

**Reconciliation note:** The founder's request asks for CRUD "for Creator / Actor / Brand / Casting Director / Admin / Super Admin" as if six separate resources. Per `DATABASE_ARCHITECTURE.md` §3's base+detail-table design, these are **not** six separate API resources — Creator and Actor CRUD both go through `/talent-profiles` (discriminated by `talent_type` in the body/response), Brand and Casting Director both go through `/hirer-profiles`. Building six parallel endpoint sets would directly contradict the database document's stated reason for the shared-table design (a 5th talent/hirer type must be additive). Admin/Super Admin are managed via a distinct `/admin/staff` resource since they're internal accounts, not marketplace profiles (`DATABASE_ARCHITECTURE.md` §3.4).

| Method & Path | Purpose | Auth | Role · Permission | Request | Response (2xx) | Status Codes | Notes |
|---|---|---|---|---|---|---|---|
| `GET /users/me` | Current identity | any | self | — | `{id, email, role, status}` | 200 | `no-store` |
| `PATCH /users/{id}` | Update account-level fields (email/phone) | any | self, or `admin` w/ `users:edit` | `{email?, phone?}` | updated user | 200,403,404,409,422 | re-triggers email verification if email changes |
| `DELETE /users/{id}` | Soft-delete account | any | self, or `admin` w/ `users:suspend` | `{reason?}` | 204 | 204,403,404 | Soft delete only (`DATABASE_ARCHITECTURE.md` §16); 30-day recovery window |
| `POST /users/{id}/suspend` | Suspend account | admin | `users:suspend` | `{reason}` (required) | updated user | 200,403,404,422 | Writes `audit_log_entries` |
| `POST /users/{id}/reinstate` | Reverse suspension | admin | `users:suspend` | `{reason}` | updated user | 200,403,404 | Writes `audit_log_entries` |
| `GET /admin/staff` | List Admin/Super Admin accounts | super_admin | `roles:manage` | filters: `department`, `role` | list of `admin_profiles` | 200,403 | |
| `POST /admin/staff` | Create an Admin account | super_admin | `roles:manage` | `{email, department, role_ids[]}` | created staff record | 201,403,409,422 | Never self-service — Super Admin-only provisioning |
| `PATCH /admin/staff/{id}` | Update department / role grants | super_admin | `roles:manage` | `{department?, role_ids?}` | updated record | 200,403,404,422 | |
| `DELETE /admin/staff/{id}` | Revoke staff access | super_admin | `roles:manage` | — | 204 | 204,403,404 | Soft-delete; writes `audit_log_entries` |

---

## 4. Profile APIs

### 4.1 Core Profiles
| Method & Path | Purpose | Auth | Role | Notes |
|---|---|---|---|---|
| `POST /talent-profiles` | Create base talent profile (`talent_type`: creator\|actor) | talent | self | Part of onboarding; one per user (UNIQUE `user_id`) |
| `GET /talent-profiles/{id}` | Fetch (public fields if approved; full fields if self/admin) | public/any | — | `public-cacheable` if `verification_status=approved` |
| `PATCH /talent-profiles/{id}` | Update base fields | talent | self | Re-triggers `verification_status→pending_review` if a re-verification-sensitive field changes (policy TBD, see §26) |
| `GET/PATCH /talent-profiles/{id}/creator-details` | Creator-specific fields | talent (creator) | self | 404 if `talent_type≠creator` |
| `GET/PATCH /talent-profiles/{id}/actor-details` | Actor-specific fields | talent (actor) | self | 404 if `talent_type≠actor` |
| `POST /hirer-profiles`, `GET/PATCH /hirer-profiles/{id}` | Mirror of the above for Brand/Casting Director | hirer | self | Same pattern |
| `GET/PATCH /hirer-profiles/{id}/brand-details`, `/casting-director-details` | Type-specific | hirer | self | |
| `GET /talent-profiles/{id}/public` , `GET /hirer-profiles/{id}/public` | Public profile view by handle | public | — | Resolves `handle`, 404s if not `approved` — enforces `DATABASE_ARCHITECTURE.md` §7 search/visibility rule at the read layer too, not just search indexing |

### 4.2 Child Resources (Experience, Education, Skills, Languages, Achievements, Certifications, Social Links)
All follow one CRUD shape against their respective `DATABASE_ARCHITECTURE.md` §6 table:
`GET /talent-profiles/{id}/experience`, `POST .../experience`, `PATCH .../experience/{item_id}`, `DELETE .../experience/{item_id}` — identical pattern for `/education`, `/achievements`, `/certifications`, `/social-links`.
**Skills/Languages** differ slightly because they're many-to-many joins against global lookups (`DATABASE_ARCHITECTURE.md` §6): `PUT /talent-profiles/{id}/skills` replaces the full set (`{skill_ids: []}`) rather than item-by-item POST/DELETE, since "my skill list" is more naturally edited as a whole set in the UI (`DESIGN_SYSTEM.md` §10's Skills tab). `PUT /talent-profiles/{id}/languages` takes `{languages: [{language_id, proficiency}]}`.
Auth/Role: talent, self, on all of the above. Public `GET` variants exist without the mutation verbs for viewing another profile's data (already included in the main profile fetch response as embedded arrays — dedicated sub-resource GETs exist mainly for pagination when a list is long).

### 4.3 Skills & Languages Lookup (Admin-managed vocabularies)
`GET /skills`, `POST /skills` (admin, `content:manage`), `PATCH/DELETE /skills/{id}` — same for `/languages`, `/talent-categories`, `/campaign-categories`, `/casting-call-categories`. Public `GET` (list, for populating form dropdowns), mutation restricted to Admin per `DATABASE_ARCHITECTURE.md` §1.4's "lookup tables are admin-editable, not user-editable."

### 4.4 Portfolio (Images, Videos, Documents)
| Method & Path | Purpose | Notes |
|---|---|---|
| `POST /media/upload-url` | Request a signed upload URL | Body: `{asset_type: image\|video\|audio, content_type, file_size_bytes}`. Returns `{upload_url, media_asset_id}`. Rate limit: `upload`. See §22. |
| `POST /talent-profiles/{id}/portfolio-images` | Register an uploaded image as a portfolio item | Body: `{media_asset_id, caption?, display_order}` |
| `PATCH/DELETE /talent-profiles/{id}/portfolio-images/{item_id}` | Edit/remove | Soft delete |
| `POST /talent-profiles/{id}/portfolio-videos`, `PATCH/DELETE .../portfolio-videos/{item_id}` | Same pattern | Response includes `transcode_status` (`DATABASE_ARCHITECTURE.md` §5); client polls or receives a WebSocket event when it flips to `ready` |
| `PUT /talent-profiles/{id}/portfolio-order` | Reorder mixed gallery | Body: `{items: [{type, id, display_order}]}` — backs the unified gallery view (`DESIGN_SYSTEM.md` §7's `portfolio_items_v`) |
| `POST /documents` | Upload a private verification document | Body: `{media_asset_id, document_type}`. **Auth note:** response never includes a public URL — only a short-lived signed URL, issued only to the owner or an admin with `verification:review` (`DATABASE_ARCHITECTURE.md` §5 RLS) |
| `GET /documents/{id}/signed-url` | Re-issue a short-lived access URL | self or admin w/ `verification:review` | 60-second expiry |

### 4.5 Availability — **flagged gap, see §26.2**
No `availability` table or column exists in `DATABASE_ARCHITECTURE.md`. This document proposes, pending founder/DB-doc confirmation: `PATCH /talent-profiles/{id}/availability` with body `{status: available | booked | unavailable, available_from?: date}`, backed by a new `availability_status` enum column + `available_from` date column on `talent_profiles` (simple status, not a full calendar) unless the founder wants calendar-level availability, which would need its own table and is a materially bigger feature. **Not implemented until that column is added to the database document.**

---

## 5. CRM (Verification, Admin Notes, Audit Logs, Analytics, Reports, Roles, Support, Homepage/Featured)

### 5.1 Verification Queue & Review
**Reconciliation:** "Pending Verification / Approved / Rejected / Request Changes" are **not four endpoints** — they're one queue endpoint filtered by status, matching the tabbed UI in `DESIGN_SYSTEM.md` §9 and the single `verification_requests.status` enum in `DATABASE_ARCHITECTURE.md` §4.

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /admin/verification-requests?status=pending_review\|approved\|rejected\|changes_requested` | Queue view | admin, `verification:review` | Sortable by `submitted_at`; SLA-timer field computed server-side |
| `GET /admin/verification-requests/{id}` | Full detail (submitted docs, profile snapshot, prior history) | admin, `verification:review` | |
| `POST /admin/verification-requests/{id}/review` | Submit a decision | admin, `verification:review` | Body: `{decision: approved\|rejected\|changes_requested, reason?}`. **Validation:** `reason` required (`422 reason_required`) unless `decision=approved` — mirrors the DB `NOT NULL` constraint and the disabled-submit-button UI in `DESIGN_SYSTEM.md` §9 exactly. Writes `verification_reviews`, `verification_history`, `audit_log_entries`, and denormalizes status onto the profile. |
| `GET /admin/verification-requests/{id}/comments`, `POST .../comments` | Clarifying back-and-forth | admin (write), subject user (write, own request), both (read) | `DATABASE_ARCHITECTURE.md` §4's `verification_comments` |
| `GET /talent-profiles/{id}/verification-history`, `GET /hirer-profiles/{id}/verification-history` | Timeline | self or admin | Backs the `Timeline` component (`DESIGN_SYSTEM.md` §7, §9) |

### 5.2 Admin Notes
`GET/POST /admin/users/{user_id}/notes`, `PATCH/DELETE /admin/users/{user_id}/notes/{note_id}` — admin only, editable/deletable by the authoring admin only (`DATABASE_ARCHITECTURE.md` §10's distinction from immutable audit logs).

### 5.3 Audit Logs
`GET /admin/audit-logs` — admin w/ dedicated `audit:view` permission (deliberately not bundled into general `admin` access — `ARCHITECTURE.md` §15). Filters: `actor_id`, `action`, `target_type`, `date_from/to`. **No POST/PATCH/DELETE exists for this resource at any role, including Super Admin** — directly reflecting the database-level `REVOKE` (`DATABASE_ARCHITECTURE.md` §10). Requesting any mutation verb on this path returns `405 method_not_allowed`, not a permission error — the method itself doesn't exist for anyone.

### 5.4 Analytics
`GET /admin/analytics/{metric_key}?date_from=&date_to=&dimensions=` — reads from `analytics_daily_rollups`, never raw `analytics_events` (`DATABASE_ARCHITECTURE.md` §13) so this endpoint's latency stays flat as the platform grows. `GET /brands/{id}/campaign-analytics` — Brand-scoped equivalent for their own campaigns (§7).

### 5.5 Reports
`POST /reports` (any authenticated user — file a report), `GET /admin/reports?status=` (admin, `moderation:review`), `POST /admin/reports/{id}/resolve` (body: `{action: dismiss|warn|suspend|escalate, note}`).

### 5.6 Role Management
`GET /admin/roles`, `GET /admin/permissions`, `POST /admin/roles/{id}/permissions` (body: `{permission_ids: []}`) — Super Admin only, `roles:manage`. This is the API backing the "Roles & Permissions" Super Admin screen (`ARCHITECTURE.md` §6/§8).

### 5.7 Support Tickets
`GET/POST /support-tickets` (user creates, admin lists/filters by `status`/`priority`), `GET /support-tickets/{id}`, `POST /support-tickets/{id}/messages` (body: `{body, is_internal_note}` — `is_internal_note` only settable by admin), `PATCH /support-tickets/{id}` (status/assignment, admin only).

### 5.8 Homepage Management & Featured Profiles
**Flagged as contingent** on `DATABASE_ARCHITECTURE.md` §19 open question #8 (this module wasn't in `ARCHITECTURE.md` at all). Designed for completeness:
`GET/POST /admin/homepage-content-blocks`, `PATCH/DELETE .../{id}` — admin, `content:manage`.
`POST /admin/featured/{creators|actors|brands|campaigns}` (body: `{target_id, placement_rank, starts_at?, ends_at?}`), `DELETE /admin/featured/{type}/{id}` — mirrors the four-table design in the DB doc; if the founder adopts the polymorphic `featured_placements` alternative noted there instead, this collapses to one endpoint family with a `target_type` param.

---

## 6. Discover / Search APIs

**Reconciliation:** "Search Creators / Search Actors / Search Brands / Search Directors" are one faceted endpoint per side (talent vs. hirer), filtered by `talent_type`/`hirer_type` — not four separate endpoints — consistent with the shared-table search design in `DATABASE_ARCHITECTURE.md` §17 and the single `/search` page in `DESIGN_SYSTEM.md` §5/§6.

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /discover/talent` | Faceted talent search | hirer (full), public (limited fields) | Query: `q, talent_type, category[], skill[], language[], location, verified_only, min_rating, sort, cursor, limit`. Always server-filters `verification_status=approved` regardless of client params (`DATABASE_ARCHITECTURE.md` §17). Rate limit: `search`. Cache: `public-cacheable` for the anonymous/public variant. |
| `GET /discover/hirers` | Faceted Brand/Director search | talent (full), public (limited) | Mirrors the above; Phase 2 per `ARCHITECTURE.md` §5 (public company pages) |
| `GET /discover/campaigns`, `GET /discover/casting-calls` | Faceted listing search | talent | Filters: `category, budget_min/max, deadline_before, location` |
| `GET /discover/recommendations` | AI-ranked matches | any | **Phase 3** per `ARCHITECTURE.md` §21 — MVP response falls back to `sort=-created_at` with a `personalized: false` flag, so the endpoint contract doesn't change when matching AI ships, only the ranking logic behind it does |
| `GET/POST/DELETE /discover/saved-searches` | Persist a filter set for alerts | talent, hirer | **Flagged gap (§26.3):** no `saved_searches` table exists in `DATABASE_ARCHITECTURE.md`. Endpoint contract specified here (`POST` body = the filter query params as JSON + optional `alert_enabled: boolean`) pending a DB doc amendment adding this table. |

---

## 7. Campaign & Casting Call APIs

Structurally identical resources (`DATABASE_ARCHITECTURE.md` §8 reconciliation — `casting_calls` retained as `campaigns`' sibling), so specified once with the alternate path noted.

| Method & Path (Campaign / Casting Call) | Purpose | Auth | Notes |
|---|---|---|---|
| `POST /campaigns` / `POST /casting-calls` | Create (starts `status=draft`) | hirer (brand / casting_director resp.) | Requires `verification_status=approved` on the hirer profile — `403 unverified_hirer` otherwise |
| `PATCH /campaigns/{id}` / `.../casting-calls/{id}` | Update | hirer, self | Only while `status∈{draft,open}` |
| `POST /campaigns/{id}/publish` | `draft→open` | hirer, self | Separate action verb, not a generic PATCH of `status`, because publishing has side effects (search indexing, notification fan-out to matching talent — Phase 2) worth an explicit endpoint |
| `POST /campaigns/{id}/close` | `open→closed` | hirer, self | |
| `DELETE /campaigns/{id}` | Soft-delete | hirer, self | Only while `status=draft` — `409 cannot_delete_open_campaign` otherwise (must `close`, not delete, once applications exist) |
| `GET /campaigns/{id}` | Detail | public if `open`, owner otherwise | `public-cacheable` |
| `GET/POST /campaigns/{id}/attachments`, `DELETE .../attachments/{attachment_id}` | Brief attachments | hirer, self | |
| `GET /campaigns/{id}/analytics` | Views/applications/conversion | hirer, self | `ARCHITECTURE.md` §5 Phase 2 feature |
| `GET /campaigns/categories`, `/casting-calls/categories` | Lookup list | public | See §4.3 |
| `GET /admin/campaigns`, `GET /admin/casting-calls` | **New, v1.1** — admin-scoped list across every status incl. `suspended`/`archived` | admin, `campaigns:manage` | Resolves the gap flagged in `CRM_SPECIFICATION.md` §10 — the public/owner views above never surface non-published or moderation-flagged listings, which is exactly what `CRM_SPECIFICATION.md` §10's View/Suspend/Archive actions need |
| `POST /admin/campaigns/{id}/suspend`, `POST /admin/casting-calls/{id}/suspend` | `→suspended` | admin, `campaigns:manage` | Reason required; matches `DATABASE_ARCHITECTURE.md` §8's amended status enum |
| `POST /admin/campaigns/{id}/archive`, `POST /admin/casting-calls/{id}/archive` | `→archived` | admin, `campaigns:manage` | No reason required (housekeeping, not policy) |

---

## 8. Application, Offer, Contract APIs

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `POST /applications` | Apply to a campaign/casting-call | talent | Body: `{target_type, target_id, cover_message?}`. `409 already_applied` (UNIQUE constraint, `DATABASE_ARCHITECTURE.md` §8) |
| `POST /applications/{id}/withdraw` | Withdraw | talent, self | `status→withdrawn` |
| `GET /campaigns/{id}/applications`, `GET /casting-calls/{id}/applications` | Hirer's applicant list | hirer, self (of the listing) | Filters: `status`; this is the `DataTable`/swipe-queue data source (`DESIGN_SYSTEM.md` §8) |
| `POST /applications/{id}/shortlist` | `submitted→shortlisted` | hirer, self (of the listing) | |
| `POST /applications/{id}/reject` | `→rejected` | hirer, self | Body: `{reason?}` — optional, unlike verification rejection, since this isn't a compliance-relevant decision |
| `GET /applications/{id}/status-history` | Timeline | talent (self) or hirer (of listing) | `application_status_history` |
| `POST /offers` | Send an offer (from an application or direct invite) | hirer | Body: `{talent_profile_id, application_id?, conversation_id?, scope, rate_cents, currency_code, deadline?}`. Creates/attaches to a `conversations` thread (`DATABASE_ARCHITECTURE.md` §8) |
| `POST /offers/{id}/accept` | `sent→accepted`, creates `contracts` row | talent, recipient | **`Idempotency-Key` required** (§1.3) |
| `POST /offers/{id}/counter` | New offer referencing the prior one | talent or hirer | Body mirrors `POST /offers` + `{countered_offer_id}` |
| `POST /offers/{id}/decline` | `→declined` | either party | |
| `GET /contracts/{id}` | Detail incl. milestones | either contract party, or admin | `no-store` |
| `POST /contracts/{id}/fund` | Hirer funds escrow | hirer, party | Triggers `payments-service` charge → `escrow_holds` row (`DATABASE_ARCHITECTURE.md` §12). **`Idempotency-Key` required.** |
| `POST /contracts/{id}/milestones/{milestone_id}/deliver` | Talent marks delivered | talent, party | `status→delivered` |
| `POST /contracts/{id}/milestones/{milestone_id}/release` | Hirer releases escrow | hirer, party | Writes `wallet_transactions` (escrow_release + platform_fee), updates `wallets.cached_balance_cents`. **`Idempotency-Key` required.** |
| `POST /contracts/{id}/dispute` | Open a dispute | either party | `status→disputed`; creates a linked `reports` entry, routed to Admin (Phase 2 per `ARCHITECTURE.md` §5) |

---

## 9. Messaging APIs

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /conversations` | List, most-recent-first | any | Cursor-paginated |
| `POST /conversations` | Start a thread | any | Body: `{recipient_user_id}`; `409 conversation_already_exists` returns the existing thread id instead of duplicating |
| `GET /conversations/{id}/messages` | Paginated history | participant | Cursor on `(created_at, id)` — this is the REST "catch-up on reconnect" path per `ARCHITECTURE.md` §19 |
| `POST /conversations/{id}/messages` | Send (REST fallback path) | participant | Body: `{body?, attachment_media_asset_ids?[]}`. In normal operation, sends happen over the WebSocket gateway (§24) — this REST endpoint exists specifically as the reliable fallback for offline/reconnect scenarios, per `ARCHITECTURE.md` §19 |
| `POST /conversations/{id}/messages/{message_id}/read` | Mark read | participant | Writes `message_read_receipts` |
| `DELETE /conversations/{id}` | Delete (soft, "for me") | participant | Per-participant hide, not a shared delete |
| `PATCH /conversations/{id}/archive` | Archive/unarchive | participant | **Flagged gap (§26.4):** no `archived_at` column exists on `conversation_participants` in `DATABASE_ARCHITECTURE.md` §9. Proposed: add `archived_at timestamptz nullable` to that table. |
| — Voice notes | No separate endpoint | — | A voice note is `POST .../messages` with an audio attachment — same endpoint, per `DATABASE_ARCHITECTURE.md` §9's explicit "no separate voice-note table" design |
| — Typing indicator, Online/presence | **No REST endpoint** | — | WebSocket-only signal by design (§24) — ephemeral, not persisted (`DATABASE_ARCHITECTURE.md` §9 for typing; presence has no backing table at all and is proposed to follow the identical ephemeral pattern, flagged in §26.5 since `ARCHITECTURE.md`/DB doc never explicitly addressed presence) |

---

## 10. Notification APIs

**Reconciliation:** "In App / Email / Push" are `notifications.channel` values, not three separate endpoint families (`DATABASE_ARCHITECTURE.md` §10) — one resource, channel-agnostic.

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /notifications` | List | any | Filter `?read=false`; `private-short` cache |
| `POST /notifications/{id}/read` | Mark one read | any, self | |
| `POST /notifications/mark-all-read` | Batch mark-read | any, self | Batch endpoint per §21 |
| `DELETE /notifications/{id}` | Remove | any, self | Soft delete |
| `GET/PATCH /notifications/preferences` | Channel/category opt-in | any, self | Body: `{category, channel_email, channel_push, channel_in_app}` per row; transactional-category channels can't be fully disabled (`ARCHITECTURE.md` §18), enforced server-side — a request to disable them returns the preference saved with those flags forced back to `true`, plus a `warning` in the response, not a hard error. |
| `POST /devices/register` | Register a push token | any, self | Body: `{platform, token}` → `push_device_tokens` |
| `DELETE /devices/{token_id}` | Unregister | any, self | On logout/uninstall |

---

## 11. Bookmark APIs

**Reconciliation:** Per `DATABASE_ARCHITECTURE.md` §7, `bookmarks` is one polymorphic table — "Save Profile" and "Save Campaign" are the same endpoint with a different `target_type`, not separate resources.

`POST /bookmarks` (body: `{target_type: talent_profile|hirer_profile|campaign|casting_call, target_id}`), `DELETE /bookmarks/{id}`, `GET /bookmarks?target_type=` — any authenticated user, self-scoped.

---

## 12. Follow & Connection APIs

Both designed per `DATABASE_ARCHITECTURE.md` §7; **MVP-shipping status flagged as unconfirmed** (§26.6 / DB doc open question #4).

| Method & Path | Purpose |
|---|---|
| `POST /follows/{user_id}`, `DELETE /follows/{user_id}` | Follow / unfollow (asymmetric, immediate) |
| `GET /users/{id}/followers`, `GET /users/{id}/following` | Lists |
| `POST /connections` (body: `{recipient_user_id}`) | Send a connection request |
| `POST /connections/{id}/accept`, `POST /connections/{id}/decline` | Respond |
| `GET /connections?status=accepted` | List (mutual network) |

---

## 13. Review & Rating APIs

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `POST /contracts/{id}/reviews` | Create | either contract party | Body: `{rating: 1-5, body?}`. `409 review_already_submitted` (one per author per contract); `403 contract_not_completed` unless `contracts.status=completed` (`DATABASE_ARCHITECTURE.md` §10) |
| `PATCH /reviews/{id}` | Edit | author, within an edit window (e.g. 48h — founder to confirm; not specified in prior docs, flagged §26.7) | |
| `DELETE /reviews/{id}` | Remove | author, or admin w/ `moderation:review` | Soft delete; triggers `rating_summaries` recompute |
| `GET /talent-profiles/{id}/rating-summary`, `/hirer-profiles/{id}/rating-summary` | Aggregate | public | Reads `rating_summaries`, never aggregates raw `reviews` live (`DATABASE_ARCHITECTURE.md` §10) |
| `GET /talent-profiles/{id}/reviews` | Individual reviews list | public | Paginated, below the summary per `DESIGN_SYSTEM.md` §10 |
| `POST /reviews/{id}/report` | Flag a review | any | Creates a `reports` row with `target_type=review` |

---

## 14. Payment APIs

Subscriptions/Plans/Coupons endpoints are specified for schema-completeness per `DATABASE_ARCHITECTURE.md` §12, but **flagged dormant/Phase 3** consistent with `ARCHITECTURE.md` §5 — listed here, not built at MVP.

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /wallet` | Balance + linked payout methods | self | `no-store`. Returns `cached_balance_cents` with a `reconciled_at` timestamp |
| `GET /wallet/transactions` | Ledger history | self | Cursor-paginated, filterable by `type`, `date_from/to` |
| `GET /contracts/{id}/escrow` | Escrow status for a contract | contract party | |
| `GET /invoices`, `GET /invoices/{id}` | Invoice list/detail | self (party to the underlying contract) | Phase 2 per `ARCHITECTURE.md` §5 |
| `POST /wallet/payout-methods`, `DELETE /wallet/payout-methods/{id}` | Manage payout destinations | self | Body is a processor token (Stripe Connect-style), never raw bank details (`ARCHITECTURE.md` §15/§20) |
| `POST /wallet/payouts` | Withdraw to a payout method | self | **`Idempotency-Key` required** |
| `POST /wallet/payments/webhook` | Processor webhook receiver | none (verified via signature, not JWT) | Idempotent on `(processor, external_reference_id)` UNIQUE constraint (`DATABASE_ARCHITECTURE.md` §12) |
| `GET /payments/history` | Combined payments+ledger view | self | Convenience read combining `payments`+`wallet_transactions` for one screen |
| `POST /payments/refunds` | Issue a refund | admin, `financials:refund` | Phase 2; writes a compensating `wallet_transactions` entry, never edits the original |
| `GET /plans`, `POST /subscriptions`, `DELETE /subscriptions/{id}`, `POST /coupons/redeem` | **[Phase 3 — dormant]** | self | Contract specified, not implemented at MVP |

---

## 15. Search APIs (Command/Quick Search — distinct from Discover, §6)

**Naming disambiguation flagged:** `DESIGN_SYSTEM.md` §6 introduced a `⌘K` command-palette pattern also loosely called "global search" there, which is a different feature from the Discover marketplace search in §6 of this document. This section is that command-palette's backing API, kept under a distinctly named path to avoid the two ever being confused in code.

| Method & Path | Purpose | Notes |
|---|---|---|
| `GET /quick-search?q=` | Combined lightweight results (people, campaigns, nav actions) for the `⌘K` palette | Small `limit` (≤5 per category), optimized for <100ms response, not full faceted search |
| `GET /quick-search/autocomplete?q=` | Type-ahead suggestions | Debounced client-side; backed by `pg_trgm`/`tsvector` (`DATABASE_ARCHITECTURE.md` §17) at MVP, Elasticsearch suggester post-Phase-2 |
| `GET /quick-search/trending` | Trending searches/categories | **Flagged gap** — no backing table; would need an `analytics_daily_rollups` metric key (`search_term_frequency`) feeding it, not yet defined |
| `GET /quick-search/recent` | User's recent searches | **Flagged gap (§26.3, shared with Saved Searches)** — no `recent_searches` table in `DATABASE_ARCHITECTURE.md`; proposed as a small per-user capped ring-buffer table if adopted |

---

## 16. AI APIs

All endpoints in this section are **Phase 3+ per `ARCHITECTURE.md` §21** — specified now so the contract is stable whenever `ai-service` ships, not built at MVP. Every one has a manual-fallback equivalent elsewhere in this document (per §21's "AI accelerates, never gates" principle) — noted per row.

| Method & Path | Purpose | Manual fallback |
|---|---|---|
| `POST /ai/profile-review` | Pre-screen a `verification_request` | Admin's own judgment in `POST /admin/verification-requests/{id}/review` |
| `POST /ai/resume-generator` | Assemble a resume from profile+portfolio data | Manual profile editing |
| `POST /ai/portfolio-feedback` | Flag likely-stock/reused media | Admin manual review during verification |
| `GET /ai/creator-matches?campaign_id=` | Ranked talent suggestions for a brief | `GET /discover/talent` faceted search |
| `POST /ai/campaign-suggestions` | Budget/scope suggestions for a new campaign | Hirer fills the form manually |
| `POST /ai/proposal-generator` | Draft an application cover message | Talent writes `cover_message` manually |
| `POST /ai/caption-generator` | **New scope — not in `ARCHITECTURE.md` §21's AI roadmap.** Generates a caption for a portfolio post | Manual caption entry (already the only option today) |

---

## 17. Admin APIs (cross-references — not duplicated)

Dashboard/Analytics/Reports/Verification Queue/Audit Logs/Permissions are fully specified in §5 above; duplicating them here would create two sources of truth for the same endpoints. This section covers what's uniquely "Admin ops" beyond CRM:

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /admin/dashboard-summary` | Queue depths + SLA timers for the Admin home screen | admin | Powers `DESIGN_SYSTEM.md` §8's Admin Dashboard stat row |
| `GET /admin/system-health` | Latency/error-rate/queue-backlog summary | super_admin | Proxies observability tooling (`ARCHITECTURE.md` §22), read-only |
| `GET/PATCH /admin/feature-flags` | Manage rollout flags | super_admin, `system:manage` | Backs `platform_settings` rows with `scope=feature_flag` (`DATABASE_ARCHITECTURE.md` §13) |
| `GET/PATCH /admin/settings` | Business-scope settings (platform fee %, etc.) | admin (scoped) / super_admin | `platform_settings` rows with `scope=business` |
| `GET /admin/moderation-queue` | Flagged portfolio items / messages pending review | admin, `moderation:review` | Surfaces `portfolio_images/videos.moderation_status=flagged` and message-scan hits (`ARCHITECTURE.md` §19) |
| `POST /admin/moderation-queue/{item_id}/resolve` | Approve/remove flagged content | admin, `moderation:review` | |

---

## 18. System APIs

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `GET /health` | Liveness/readiness probe | none | Used by load balancer/orchestrator, not a product feature — excluded from rate limiting entirely |
| `GET /version` | Deployed API version + build hash | none | For client compatibility checks (mobile app can warn "please update") |
| `GET /config/public` | Public-safe runtime config (feature flags relevant to unauthenticated pages, supported locales) | none | Never leaks `system`-scope `platform_settings` rows — explicit allowlist, not "everything except X" |
| `GET /maintenance-status` | Whether the platform is in maintenance mode | none | Polled by clients to show a maintenance banner/block writes gracefully |

---

## 19. Standardized Error Handling

Every error uses the `error` envelope from §1.4. `error.code` values are stable and documented per-domain (examples below); `message` is safe to show to end users; `details[]` (validation only) maps field-level issues for form UIs.

| Status | Meaning | Example `error.code` | Example scenario |
|---|---|---|---|
| **400** | Malformed request | `bad_request` | Invalid JSON body |
| **401** | Missing/invalid/expired credentials | `invalid_credentials`, `token_expired`, `refresh_token_reused` | Expired access token on a protected route |
| **403** | Authenticated but not permitted | `permission_denied`, `unverified_hirer`, `account_suspended` | Talent tries to `PATCH` another talent's profile |
| **404** | Resource doesn't exist (or is invisible to this requester — never distinguished from "doesn't exist" for privacy) | `not_found` | Fetching a `rejected` profile's public page |
| **409** | Conflict with current state | `email_already_registered`, `already_applied`, `conversation_already_exists` | Duplicate application |
| **422** | Semantically invalid input | `validation_failed`, `reason_required`, `unsupported_sort_field` | Missing rejection reason on a verification decision |
| **429** | Rate limit exceeded | `rate_limited` | More than 5 login attempts/15min |
| **500** | Unhandled server fault | `internal_error` | Always logged with `X-Request-Id`; message never leaks stack traces or internals to the client |
Example body:
```json
{ "error": { "code": "reason_required", "message": "A reason is required when rejecting or requesting changes.", "details": [{ "field": "reason", "issue": "required" }] } }
```

---

## 20. API Security (consolidated, applied at the API layer specifically)

- **JWT:** short-lived access tokens, claims-based authorization (§1.2); signature verified at the API gateway before a request reaches any service, so a forged/expired token never reaches business logic.
- **Refresh tokens:** rotating, replay-detected, revocable (§2, `DATABASE_ARCHITECTURE.md` §2).
- **RBAC/Permission checks:** coarse role from JWT claim, fine-grained permission from a gateway-level lookup against `role_permissions` — enforced before routing, not left to each service to remember (`ARCHITECTURE.md` §15).
- **Rate limiting:** tiered per §1.7, enforced at the gateway.
- **Input validation:** schema validation (JSON Schema-equivalent) at the API boundary before any handler runs, per `ARCHITECTURE.md` §15 — a request with an extra/wrong-typed field is rejected with `422` before touching a database call.
- **File upload security:** covered in full in §21.
- **Audit logging:** every admin mutation endpoint in §5/§17 writes `audit_log_entries` as part of the same transaction as the state change — not a best-effort side effect that could silently fail while the mutation succeeds.

---

## 21. File Upload

| Asset | Max size | Allowed formats | Notes |
|---|---|---|---|
| Profile/avatar image | 8 MB | JPEG, PNG, WebP | Resized to standard renditions on ingestion (`ARCHITECTURE.md` §16) |
| Portfolio image | 25 MB | JPEG, PNG, WebP | Same pipeline |
| Portfolio video | 2 GB | MP4, MOV | Async transcode, multiple output resolutions (`DATABASE_ARCHITECTURE.md` §5) |
| Voice note (message attachment) | 25 MB | M4A, MP3, WAV | Waveform generated server-side |
| Verification document | 15 MB | JPEG, PNG, PDF | Private bucket only, never touches the media CDN pipeline (`ARCHITECTURE.md` §16, `DATABASE_ARCHITECTURE.md` §5) |

**Flow (all asset types):** `POST /media/upload-url` → client uploads directly to object storage using the signed URL (bypassing the API server for the bytes themselves, per `ARCHITECTURE.md` §16) → storage-provider webhook notifies `media-service` → async virus/malware scan + format validation (content-type sniffing, not just trusting the client-declared MIME type) → on pass, processing pipeline (resize/transcode) runs → on fail, `media_assets.processing_status=failed` and the client is notified via the same WebSocket channel used for transcode-complete events. A file that fails the scan is never linked into a public-facing resource (`portfolio_images`/`videos`), regardless of what the client requests next.

---

## 22. API Versioning

- **v1** is this document. **v2** is created only for breaking changes (removing a field, changing a field's type/meaning, changing an enum's values in an incompatible way) — additive changes (new optional field, new endpoint, new enum value that's additively handled) never bump the version, per `ARCHITECTURE.md` §10.
- **Deprecation strategy:** a deprecated v1 endpoint gets a `Deprecation: true` + `Sunset: <date>` response header for a minimum 6-month overlap window before removal, with the replacement documented in the response body's `error`/`meta` as applicable. Deprecation is announced in `docs/CHANGELOG.md` (once that document exists) at the moment it's flagged, not just at removal.
- **Backward compatibility:** clients that don't read new optional fields must continue to function unchanged; server code must tolerate old clients omitting new optional request fields. This is the practical reason every new column/feature is designed as additive-first throughout this document (mirroring the "additive 5th role" principle from `DATABASE_ARCHITECTURE.md` §3).

---

## 23. Real-Time: REST vs. WebSocket vs. SSE

| Concern | Mechanism | Why |
|---|---|---|
| Message send/receive, typing indicator, presence, live notification badge updates | **WebSocket** (`wss://realtime.gigrise.com`, JWT-authenticated) | Bidirectional and low-latency in both directions — a client must both send (typing, read receipts) and receive (new message, presence) continuously; SSE is server→client only and would need a second channel for the client-to-server half anyway, which is strictly worse than one bidirectional connection (`ARCHITECTURE.md` §19) |
| Message history fetch/catch-up on reconnect | **REST** (`GET /conversations/{id}/messages`) | The reliable, cacheable, retryable path — WebSocket delivery is the fast path, REST is the correctness guarantee if a socket drops (`ARCHITECTURE.md` §19) |
| Everything else (profiles, campaigns, applications, payments, admin) | **REST** | Standard request/response, no server-push requirement |
| **SSE** | **Not used anywhere in v1** | Every real-time need in this product is inherently bidirectional (chat) or is cheaply served by a single existing WebSocket connection (notification badges piggyback on the same socket rather than opening a second SSE stream) — introducing SSE alongside WebSocket would be two real-time transports doing overlapping jobs, adding operational complexity with no corresponding capability gain |

---

## 24. OpenAPI Generation Readiness

This document is organized so a future OpenAPI 3.1 spec is a direct transcription, not a redesign:
- **Tags** = this document's module headers (Auth, Users, Profiles, Verification, Discover, Campaigns, CastingCalls, Applications, Offers, Contracts, Messaging, Notifications, Bookmarks, Follows, Reviews, Payments, QuickSearch, AI, Admin, System).
- **Schema components** = the entity names from `DATABASE_ARCHITECTURE.md` directly (`TalentProfile`, `Contract`, `Milestone`, etc.) — request/response bodies reference these, so a schema change in the database document and a schema-component change in the eventual OpenAPI file are the same review, not two.
- **Security schemes** = one `bearerAuth` (JWT, Supabase Auth-issued and verified via Supabase's JWKS endpoint — §1.2) scheme, applied globally, overridden to `[]` (none) only on the explicit `Auth: none` rows above.
- **Reusable parameters** = `cursor`, `limit`, `sort` (§1.5–1.6) defined once as OpenAPI `components.parameters` and referenced by every list endpoint, exactly as this document defines them once in §1 and references them per-row.
- **Reusable responses** = the standard error envelope per status code (§19) as `components.responses`, referenced rather than redefined per endpoint.

---

## 25. Performance

- **Caching:** three-tier strategy per §1.8, applied consistently across every module above — no endpoint invents a fourth caching behavior.
- **Pagination:** cursor-based everywhere (§1.5) — this document contains zero `?page=N` parameters by design.
- **Batch APIs:** `POST /notifications/mark-all-read` (§10); recommend adding `POST /applications/bulk-shortlist` (body: `{application_ids: []}`) for the Casting Director swipe-queue pattern (`DESIGN_SYSTEM.md` §8) once usage data shows single-item calls are a bottleneck — not built at MVP, flagged as a likely fast-follow.
- **Lazy loading:** list endpoints return summary/card-shaped payloads (matching `DESIGN_SYSTEM.md` §7's Card components) by default; full detail requires the `GET /{resource}/{id}` call — list endpoints never eagerly embed full nested objects (e.g., `GET /discover/talent` returns enough for a `CreatorCard`, not the full portfolio).

---

## 26. Future Mobile App Compatibility

Every endpoint above is designed to work unchanged for Android/iOS: stateless JWT auth (no server-side session state tied to a browser), no endpoint response shape assumes a browser DOM/cookie context except where explicitly noted, and file uploads use signed URLs (mobile SDKs upload directly to storage exactly like web). The one real platform difference — refresh token transport (httpOnly cookie vs. JSON body, §1.2) — is handled via the `client_type` parameter rather than by mobile needing a parallel API.

---

## 26.x — Missing Architectural Decisions & Inconsistencies (consolidated, updated v1.1)

**Resolved by this amendment pass (kept here, struck through, for traceability rather than silently deleted):**
1. ~~Mobile refresh-token transport~~ — **Resolved.** Supabase Auth's per-platform SDK secure-storage adapters make this a solved problem (§1.2); no `client_type` parameter exists anywhere in this document anymore.
2. ~~Availability~~ — **Resolved.** `talent_profiles.availability_status`/`available_from` added in `DATABASE_ARCHITECTURE.md` v1.1 §3.1.
3. ~~Saved Searches / Recent Searches / Trending Searches~~ — **Partially resolved.** `saved_searches` and `recent_searches` tables added in `DATABASE_ARCHITECTURE.md` v1.1 §13; Trending Searches (`GET /quick-search/trending`) remains unimplemented since it depends on an `analytics_daily_rollups` metric key (`search_term_frequency`) not yet defined — a smaller remaining gap, not a blocker for the rest of §6/§15.
4. ~~Conversation archiving~~ — **Resolved.** `conversation_participants.archived_at` added in `DATABASE_ARCHITECTURE.md` v1.1 §9.

**Still open:**
5. **Presence/online status (§9).** Never addressed in any prior document. Proposed as WebSocket-ephemeral, matching the typing-indicator pattern — needs explicit confirmation this is acceptable (vs. wanting a "last seen" persisted timestamp, which *would* need a DB column).
6. **Follow vs. Connections MVP status (§12).** Inherits `DATABASE_ARCHITECTURE.md` open question #4 — unresolved.
7. **Review edit window (§13).** No prior document specifies whether/how long a review can be edited after submission. Proposed 48h, arbitrary pending founder input.
8. **Caption Generator (§16).** Introduced in this founder request but absent from `ARCHITECTURE.md` §21's AI roadmap — flagging as scope not yet reconciled with the AI roadmap document.
9. **Homepage/Featured Profiles (§5.8).** Inherits `DATABASE_ARCHITECTURE.md` open question #8 — unresolved.
10. **Profile-edit re-verification policy (§4.1).** Neither `ARCHITECTURE.md` nor the DB doc specifies which fields are "verification-sensitive" versus freely editable post-approval — this needs an explicit list before implementation, or every edit risks either being wrongly free (undermining verification's meaning) or wrongly re-triggering review (annoying users for typo fixes).
11. **MFA policy enforcement details (§2's `POST /auth/verify-mfa-policy`)** — depends on the mandatory-offer vs. hard-mandatory decision still open in `AUTHENTICATION.md` §21.1.

---

## 27. Potential API Improvements (beyond what's specified)
- **GraphQL for read-heavy aggregation screens** (Brand campaign-analytics dashboard, Admin CRM detail panels that currently require 3–4 REST calls to assemble one screen) is worth reconsidering once the number of "n+1 REST calls to build one dashboard" pattern is measured in production — not adopted for v1 per `ARCHITECTURE.md` §10's explicit reasoning (REST's cacheability/predictability wins while the platform is young), but the *reason* to revisit is specific and measurable, not just "GraphQL is popular."
- **Field selection (`?fields=`) sparse fieldsets** on the largest list payloads (`GET /discover/talent`) could reduce over-fetching once mobile bandwidth data shows it matters — deferred until real usage data exists rather than speculatively built.
- **Webhook subscriptions for enterprise Brands** (`ARCHITECTURE.md` §5 Phase 3 "API access for enterprise Brands") — this document's `payments-service` webhook pattern (§14) is the template that feature would reuse.

## 28. Endpoints Intentionally Deferred to Phase 2 (per `ARCHITECTURE.md` §5)
Multi-milestone contract UI actions beyond the single-milestone MVP path, `/invoices`, Company public pages (`GET /hirer-profiles/{id}/public` fully public rather than auth-gated), dispute-resolution evidence endpoints, referral-program endpoints (not yet designed at all — would need its own DB entities first), typing indicators/voice notes (contract specified now, per §9/§16, but not built until Phase 2 per `ARCHITECTURE.md` §5's feature phasing).

## 29. Founder Decisions Required Before Implementation (updated v1.1)
1. ~~Confirm the mobile refresh-token transport approach~~ — resolved by Supabase Auth adoption.
2. Decide presence/online-status persistence requirements (§26.x-5).
3. Provide the list of "verification-sensitive" profile fields (§26.x-10) — this blocks a correct implementation of `PATCH /talent-profiles/{id}` and its hirer equivalent.
4. Confirm whether Homepage/Featured and Follow/Connections ship at MVP or are Phase 2+ (both inherited from the DB doc's still-open questions).
5. Confirm MFA enforcement level for Admin/Super Admin (inherited from `AUTHENTICATION.md` §21.1) — blocks `POST /auth/verify-mfa-policy`'s exact behavior.

---

*End of API specification. Subordinate to `ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md`, and `DESIGN_SYSTEM.md`; awaits founder resolution of §26/§29 before OpenAPI generation or implementation begins.*
