# GigRise — CRM Specification
**Version 1.0 — Draft for Founder Review**
**Status:** Design-only. No FastAPI, no Next.js, no migrations exist yet. Subordinate to [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md), [`API_SPECIFICATION.md`](./API_SPECIFICATION.md), and [`AUTHENTICATION.md`](./AUTHENTICATION.md). Every workflow below operates on entities and permission mechanics those five documents already defined — where this document needs something none of them provide, it's flagged in-line and consolidated in §23, never silently assumed.

---

## 0. Relationship to Prior Documents — the Role-Granularity Reconciliation

This is the one reconciliation load-bearing enough to state up front rather than bury in a footnote. `ARCHITECTURE.md` §3 named only two internal roles — Admin and Super Admin. `DATABASE_ARCHITECTURE.md` §2 anticipated finer granularity than that by building a real `roles`/`permissions`/`role_permissions`/`user_roles` system (not just a `users.role` enum check), seeding four example roles (`verification_admin`, `finance_admin`, `support_admin`, `super_admin`) specifically so "an Admin can approve verifications but not touch financials" would be enforceable. `AUTHENTICATION.md` §4–5 built the coarse-role-plus-scoped-permission authorization model on top of that.

The founder's request for this document names **eight** CRM roles (Support Executive, Verification Executive, Moderator, Finance Manager, Content Manager, Operations Manager, Admin, Super Admin). This is not a new authorization system and does not contradict the prior documents — it's the granularity that system was built to hold. Concretely:
- `users.role` stays exactly `admin` for every one of the first six named roles, and `super_admin` for the last. No new `users.role` enum value is introduced.
- Each named role becomes a row in `roles` (three of the four seeded rows already match; **Moderator, Content Manager, Operations Manager are new `roles` rows this document introduces** — an additive schema change, one migration adding three lookup rows, not a redesign).
- "Admin" as its own named role in the founder's list is read here as **a generalist internal role** — staff who hold a broader combination of permission grants across queues (e.g., a team lead who can both review verifications and handle escalated support tickets) rather than a single specialist bundle. A `users` row can hold multiple `roles` via `user_roles` (`DATABASE_ARCHITECTURE.md` §2 already supports many-to-many here), so "Admin" isn't a ninth permission bundle, it's a *pattern* of holding several specialist bundles at once.
- **Super Admin** remains the sole role that can grant/revoke roles and permissions to others (`ARCHITECTURE.md` §15's "never the reverse"), and remains excluded from the two things nobody can do regardless of role — editing `audit_log_entries`, and self-approving their own verification review if they ever happen to hold a Talent/Hirer account.

---

## 1. CRM User Roles — Responsibilities, Permissions, Access

| Role | Responsibilities | Key `permissions.key` grants | Access notes |
|---|---|---|---|
| **Support Executive** | Front-line ticket triage and response; first point of contact for account/billing/how-do-I questions | `support:view`, `support:respond`, `support:escalate`, `users:view` (read-only, no edit) | Cannot view government ID documents or financial ledgers — a support question about "why was I rejected" is answered from `verification_history`/`verification_reviews` reason text, not by re-opening evidence they have no reason to see |
| **Verification Executive** | Reviews and decides on `verification_requests` — the highest-volume specialist role | `verification:review`, `documents:view`, `users:view` | This is the role most CRM headcount sits in at any real scale (§20's dashboard is largely built around this role's daily workflow) |
| **Moderator** *(new role, §0)* | Content moderation — reported profiles/messages/campaigns/reviews/media, flagged-media queue | `moderation:review`, `reports:resolve`, `documents:view` (evidence context only) | Distinct from Verification Executive: verification is a one-time gate at onboarding, moderation is ongoing post-approval content policing |
| **Finance Manager** | Escrow, refunds, payout disputes, manual ledger adjustments | `financials:view`, `financials:refund`, `financials:adjust` *(new permission, §12)* | The only role that can touch `wallet_transactions`/`payments` beyond read access; manual adjustments require the maker-checker control in §12.6 |
| **Content Manager** | Homepage curation, Featured placements, category/skill/language lookup tables, email template copy | `content:manage` | Owns the "editorial" surface of the platform — never touches verification or financial decisions |
| **Operations Manager** | Cross-cutting oversight — campaign/casting-call moderation, platform reporting, SLA monitoring across other teams' queues | `campaigns:manage`, `reports:view` (aggregate), `audit:view` | A supervisory role one level below Super Admin for day-to-day operational health, without the role-management/financial-adjustment authority Super Admin holds |
| **Admin** *(generalist, §0)* | Holds a combination of the above bundles per business need (e.g., a small team's lead) | Whatever combination `user_roles` grants them | Not a fixed permission set — defined by composition, not a new bundle |
| **Super Admin** | Full platform authority; the only role that can manage roles/permissions and system-scope settings | All `permissions` rows implicitly, **except** editing `audit_log_entries` (nobody, ever) | `ARCHITECTURE.md` §15, `AUTHENTICATION.md` §16 |

**Access level principle, restated for this document specifically:** every specialist role's dashboard (§2), queue (§3), and available actions (§5–14) show **only** what their permission grants unlock — a Support Executive's CRM home screen never renders a "Refund" button they'd get a `403` clicking anyway; the UI reflects the permission model, it doesn't gate on top of a shared everything-visible screen.

---

## 2. CRM Dashboard

Layout skeleton per `DESIGN_SYSTEM.md` §5/§8 (always-visible sidebar, stat-row + content grid) — this section is that skeleton's full widget inventory for the internal-ops context, since `DESIGN_SYSTEM.md` §8 only sketched the Admin/Super Admin dashboards at a high level.

**Widget set (role-filtered — a widget only renders if the viewer holds the permission its data depends on):**

| Widget | Data source | Visible to |
|---|---|---|
| Pending Verifications (count + SLA-breach subcount) | `verification_requests` where `status=pending_review` | Verification Executive, Admin, Super Admin |
| Approved Today / Rejected Today / Changes Requested Today | `verification_reviews` grouped by `decision`, filtered `created_at::date = today` | Verification Executive, Admin, Super Admin |
| New Signups (today / 7-day trend sparkline) | `analytics_daily_rollups` (`metric_key='signups'`) | Operations Manager, Admin, Super Admin |
| Campaigns Created / Casting Calls Created | `analytics_daily_rollups` | Content Manager, Operations Manager, Super Admin |
| Applications (today, 7-day trend) | `analytics_daily_rollups` | Operations Manager, Super Admin |
| Contracts (active count, completed today) | `contracts` | Operations Manager, Finance Manager, Super Admin |
| Payments Summary (volume, failures today) | `payments` | Finance Manager, Super Admin |
| Escrow Summary (total held, oldest unreleased) | `escrow_holds` | Finance Manager, Super Admin |
| Wallet Summary (platform-wide float, not any individual wallet) | aggregate over `wallets` | Finance Manager, Super Admin |
| Support Tickets (open count, oldest-open age, SLA-breach count) | `support_tickets` | Support Executive, Operations Manager, Admin, Super Admin |
| Platform Health (API latency/error rate, queue backlogs) | Observability tooling proxy (`API_SPECIFICATION.md` §17) | Super Admin only |
| Revenue (platform fee take, MTD) | `wallet_transactions` where `type=platform_fee` | Finance Manager, Super Admin |
| Growth Metrics (funnel: signup→verified→first-hire) | `analytics_daily_rollups` | Operations Manager, Super Admin |
| Activity Feed | Recent `audit_log_entries` relevant to the viewer's own actions/team | All roles (own-scoped), full feed for Super Admin |
| Quick Actions | Context menu: "Review next in queue," "Open oldest ticket," "View flagged content" | Role-appropriate shortcut per viewer |

**Charts:** every numeric widget above with a trend has an inline sparkline (7-day) and a "view full report" link into §14/§15 — the dashboard is a summary surface, not where deep analysis happens, matching the Stripe/HubSpot-inspired brief of "glanceable first, drillable second."

---

## 3. Verification Queue

Extends `API_SPECIFICATION.md` §5.1 and `DESIGN_SYSTEM.md` §9's tabbed `DataTable` with the full filter/action set requested.

**Filters:** `status` (draft is never queued — only `pending_review`/`changes_requested` tabs are actionable; `approved`/`rejected` tabs are historical read views), `talent_type`/`hirer_type`, `location_country`/`location_city`, `language` (via `talent_profile_languages`), `profile_completion_pct` (range), `submitted_at` (date range), free-text `search` (name/handle/email).

**Sorting:** Newest first (default), Oldest first (surfaces SLA-risk items), Priority (see below), Risk Score.

**Priority:** computed, not stored — `(hours_since_submitted × 1) + (resubmission_count × 4)` as a starting heuristic (a third-time resubmission waits less patiently than a first-time one), surfaced as a simple High/Medium/Normal badge rather than a raw number, in keeping with `DESIGN_SYSTEM.md` §1's restraint principle.

**Risk Score — flagged, not fully available at MVP:** `DATABASE_ARCHITECTURE.md` §4 explicitly deferred an `ai_prescreen_score` column until Profile Review AI ships (`ARCHITECTURE.md` §21, Phase 3+). This document specifies the *filter slot* now (`?risk_score_min=`) so the queue UI/API contract doesn't need to change when that column lands, but **the sort/filter option itself renders disabled with a "Coming soon" state until then** — never fabricating a heuristic score presented as equivalent to a real ML signal, since a false sense of risk-screening is worse than an honest absence of it.

**Bulk Selection & Bulk Actions:** checkbox-select across the queue (`DataTable`, `DESIGN_SYSTEM.md` §7). Bulk actions limited to ones with **no required per-item reason**: bulk-assign-to-reviewer, bulk-escalate. **Bulk approve/reject is deliberately not offered** — every reject/changes-requested decision requires an individually-considered reason (`DATABASE_ARCHITECTURE.md` §4's `NOT NULL` constraint, enforced per-item), and a bulk-approve button on a verification queue is precisely the kind of shortcut that erodes the trust mechanic the entire platform is built on (`ARCHITECTURE.md` §2). This is a deliberate scope exclusion, not an oversight — flagged explicitly in case the founder disagrees.

---

## 4. Profile Review Page

Full detail view (`Drawer` pattern, `DESIGN_SYSTEM.md` §9), organized top-to-bottom exactly as requested, each section's data source named so nothing here is invented beyond the database document:

1. **Personal Information** — `talent_profiles`/`hirer_profiles` base fields + `users.email`/`phone` (masked by default, revealed on explicit click — logged as an access event, since viewing a contact detail is itself sensitive).
2. **Profile Images / Cover Photo** — `media_assets` via `avatar_media_id`/`logo_media_id`.
3. **Bio** — `talent_profiles.bio` / `hirer_profiles` equivalent.
4. **Experience / Education** — `experience`, `education` tables (`DATABASE_ARCHITECTURE.md` §6).
5. **Skills / Languages** — via the join tables, rendered as `Tag` lists (`DESIGN_SYSTEM.md` §10).
6. **Portfolio / Videos** — `portfolio_images`/`portfolio_videos`, moderation status shown inline, `MediaViewer` lightbox.
7. **Social Links** — `social_links`.
8. **Government ID / Business Documents** — `documents`, rendered via a short-lived signed URL (`AUTHENTICATION.md` §15) — **every open of a government ID document is itself an audit-logged event** (`document.viewed`, actor + target user), distinct from and in addition to the review decision itself, since ID access is sensitive regardless of what decision follows.
9. **Verification History** — `verification_history` (`Timeline` component).
10. **Previous Reviews** — `verification_reviews` across all of this subject's `verification_requests` rows (full resubmission history, not just the current one).
11. **Internal Notes** — `admin_notes` (§0's distinction from immutable audit logs — editable/deletable by their author only).
12. **Audit Timeline** — the full `audit_log_entries` slice for this subject, merged chronologically with #9/#10 into one scrollable timeline for reviewer context.

---

## 5. Verification Actions

Every action's Rollback Strategy column reflects `DATABASE_ARCHITECTURE.md`'s event-sourced philosophy: **nothing here is a destructive undo** — every "reversal" is a new, separately-audited compensating action, never an edit to the original decision row.

| Action | Validation | Required Permission | Audit Log | Notifications | Email | Rollback Strategy |
|---|---|---|---|---|---|---|
| **Approve** | Request must be `pending_review` or `changes_requested` | `verification:review` | `verification.approved` | In-app to subject | Yes | No true undo — a later concern is handled via **Suspend**, not by un-approving |
| **Reject** | `reason` required (non-empty) | `verification:review` | `verification.rejected` | In-app + email | Yes | Terminal-but-appealable — appeal creates a **new** `verification_requests` row via Support, not a reopening of this one |
| **Request Changes** | `reason` required, at least one specific field/section reference recommended (not enforced, see §23) | `verification:review` | `verification.changes_requested` | In-app + email | Yes | Resolved by the user's resubmission (§6), not by an admin action |
| **Suspend** (account, not verification) | `reason` required; distinct action from verification decisions entirely — operates on `users.status`, not `verification_status` | `users:suspend` | `user.suspended` | Immediate (forces session revocation, `AUTHENTICATION.md` §6) + email | Yes | **Restore** (below) is the explicit, audited rollback |
| **Restore** | Only valid from `suspended`; `banned` is not restorable via this action (see §23 on whether Support can ever un-ban) | `users:suspend` | `user.reinstated` | In-app + email | Yes | N/A — this *is* the rollback path |
| **Delete** (profile/account) | Soft-delete only, ever, from CRM — no hard-delete affordance exists in the CRM UI at all (`DATABASE_ARCHITECTURE.md` §16) | `users:suspend` (same permission as Suspend — deletion is a stronger version of the same authority, not a separate grant) | `user.deleted` | Email (final, sent before anonymization completes) | Yes | Restorable within the 30-day recovery window (`DATABASE_ARCHITECTURE.md` §16); irreversible only after that window closes and anonymization runs |
| **Escalate** | Any reviewer, any reason (freeform) | Base role permission (any specialist can escalate) | `verification.escalated` | In-app to escalation target (Operations Manager/Super Admin) | No (internal-only) | N/A — escalation doesn't change the request's `status`, only its visibility/assignment |
| **Assign to another reviewer** | Assignee must hold `verification:review` | Any Verification Executive/Admin/Super Admin | `verification.reassigned` | In-app to new assignee | No | Reassignable again at any time — not a one-way handoff |

---

## 6. Request-Changes Workflow

1. Reviewer selects **Request Changes** from the Profile Review Page (§4/§5).
2. **Reusable templates:** a picklist of canned reasons (e.g., "Government ID photo is blurry — please re-upload a clearer copy"), sourced from `email_templates` (`DATABASE_ARCHITECTURE.md` §13) filtered to a `category='verification_changes'` — this reuses the existing table rather than inventing a parallel one, an explicit design choice for consistency with the DB doc.
3. **Custom comments:** freeform text always available alongside/instead of a template, written to `verification_comments`.
4. **Multiple comments:** `verification_comments` already supports 1:many per request (`DATABASE_ARCHITECTURE.md` §4) — a reviewer can leave several distinct, field-specific notes in one decision pass.
5. **Attach screenshots (future-ready) — flagged schema gap:** `verification_comments` currently has no attachment column. This document specifies the intended shape (`media_asset_id` nullable FK, added to `verification_comments`) so a reviewer can visually mark up what's wrong, but this is **not buildable until that column is added** to `DATABASE_ARCHITECTURE.md` §4 — flagged in §23.
6. **Required fields:** at least one comment (template or custom) is mandatory before the decision can be submitted — mirrors the reason-required enforcement already specified for Reject (§5).
7. **Status updates:** `verification_requests.status → changes_requested`, denormalized onto the profile, `verification_history` row written.
8. **Resubmission flow:** user edits the flagged sections and resubmits — a **new** `verification_requests` row is created (`DATABASE_ARCHITECTURE.md` §4's resubmission-history design), linked to the prior one for continuity of the Timeline view (§4 item 9/10), not a mutation of the old row.
9. **History:** the full back-and-forth (comments + resubmissions) renders as one continuous thread on the Profile Review Page, never fragmented across separate screens per attempt.

---

## 7. User Communication

- **Inbox:** not a new messaging channel — the CRM "Inbox" is an **aggregated view** across three existing sources: `verification_comments` (addressed to a specific user), `support_ticket_messages`, and `notifications` sent to that user. This avoids inventing a fourth communication table when the three that exist already cover every legitimate admin-to-user channel.
- **Notifications:** admin-triggered notifications (verification decisions, ticket replies) flow through the existing `notifications` table/`notification-service` (`ARCHITECTURE.md` §18) — the CRM doesn't have its own notification-sending mechanism separate from the one every other part of the platform uses.
- **Email templates:** managed via `email_templates` (§6, §17) — a Content Manager or Super Admin edits subject/body; specific templates are referenced by `key` from verification/support/onboarding flows, never hardcoded copy in application code.
- **Message history:** `support_ticket_messages` + `verification_comments`, both already timestamped and actor-attributed.
- **Status history:** `verification_history` + `application_status_history` — both already specified (`DATABASE_ARCHITECTURE.md` §4, §8), surfaced in the relevant CRM detail views.

---

## 8. Support Center

| Capability | Mechanism |
|---|---|
| Tickets | `support_tickets` (`category`, `priority`, `status`, `assigned_admin_id`) |
| Assign | `PATCH` on `assigned_admin_id`, any Support Executive/Admin/Super Admin can reassign |
| Escalate | `priority → urgent` + reassignment to Operations Manager/Super Admin; writes `support_ticket_messages` with an internal note documenting why |
| Resolve | `status → resolved`, requires at least one non-internal reply having been sent (can't silently resolve without ever responding to the user) |
| Internal discussion | `support_ticket_messages.is_internal_note=true` — visible to staff only, rendered with a distinct visual treatment (never mistakable for a customer-visible reply, `DESIGN_SYSTEM.md` §7's admin note conventions) |
| Attachments | **Flagged schema gap:** `support_ticket_messages` currently has no attachment column (`DATABASE_ARCHITECTURE.md` §10). A user describing a bug with a screenshot, or an admin sharing evidence, needs a `media_asset_id` array/join — proposed, not yet in the DB doc, flagged in §23. |
| Priority | `low`/`normal`/`high`/`urgent` (already in `support_tickets.priority`) |
| SLA | **Computed, not stored** at MVP: `sla_due_at = created_at + priority_sla_hours` where the hours-per-priority mapping lives in `platform_settings` (business-scope, §17) — this keeps SLA policy admin-configurable without a schema change if targets shift, though it means the "SLA breach" flag shown on dashboards (§2) is computed at query time rather than indexed; flagged as a candidate for an actual `sla_due_at` column later if query performance at scale demands it (a straightforward, additive migration, not a redesign). |

---

## 9. Content Moderation

| Content type | Backing mechanism | Notes |
|---|---|---|
| Reported Profiles | `reports` (`target_type=user`) | Already fully supported (`DATABASE_ARCHITECTURE.md` §10) |
| Reported Messages | `reports` (`target_type=message`) | Already supported |
| Reported Campaigns | **Flagged enum gap** | `reports.target_type` currently enumerates `user|message|contract|portfolio_item` only — `campaign` and `casting_call` are not valid values today. Proposed addition, flagged §23. |
| Reported Reviews | **Flagged enum gap** | Same issue — `review` is not currently a valid `target_type`. `API_SPECIFICATION.md` §13 already assumed this value exists (`POST /reviews/{id}/report`) without the underlying enum having been updated — this document surfaces that inconsistency explicitly rather than letting it persist silently across two documents. |
| Reported Media | `reports` (`target_type=portfolio_item`) | Already supported, or extend to explicitly cover `portfolio_images`/`portfolio_videos` distinctly once the enum expansion (above) happens anyway |
| Spam Detection | **Manual/heuristic only at MVP** | No automated spam-scoring exists in any prior document; Moderator role reviews reported content manually. AI-assisted detection is Future (§22) |
| Fake Accounts | Manual, via Reports + Verification Executive judgment during document review | No automated fake-account scoring at MVP |
| Duplicate Accounts | Manual — Moderator/Verification Executive cross-references submitted documents/handles | **AI Duplicate Profile Detection** is Future (§22); flagged as new AI-roadmap scope beyond `ARCHITECTURE.md` §21's original list |

Moderation actions (approve/remove flagged content, resolve report) reuse the `reports.status` transitions and `API_SPECIFICATION.md` §17's moderation-queue endpoints — no new action verbs beyond what's already specified there.

---

## 10. Campaign Management

**Flagged gap — status enum:** `DATABASE_ARCHITECTURE.md` §8 defines `campaigns.status` as `draft|open|closed` only. CRM-initiated **Suspend** and **Archive** require states the Brand's own lifecycle doesn't have a reason to produce itself (a Brand closes its own campaign; only an Admin suspends one for policy reasons, or archives one for platform housekeping after long closure). Proposed enum expansion: `draft|open|closed|suspended|archived` — flagged §23, needed before this module is implementable as specified.

**Flagged founder decision — pre-publish approval:** `ARCHITECTURE.md` never gated campaign *publishing* behind Admin approval (only *profile* verification gates a Hirer's ability to publish at all — `API_SPECIFICATION.md` §7's `403 unverified_hirer`). "Approve (if required)" in the founder's request implies campaign-content-level pre-approval might be wanted in addition. This document's default assumption, pending confirmation: **campaigns are post-publish moderated** (via Reports, §9), not pre-approval-gated, consistent with how `ARCHITECTURE.md` scoped the verification gate to profiles only — but this is explicitly a founder call, not an engineering one, since it changes Brand-side time-to-publish materially.

| Action | Mechanism |
|---|---|
| View | `GET /admin/campaigns` (new list endpoint, admin-scoped — not previously listed in `API_SPECIFICATION.md` §7, which only had public/owner views; flagged as an API-spec addendum) |
| Suspend | `status → suspended` (pending enum expansion above), reason required, notifies the Brand |
| Archive | `status → archived`, no reason required (housekeeping, not policy action) |
| Feature | `POST /admin/featured/campaigns` (`API_SPECIFICATION.md` §5.8) — contingent on that module's founder confirmation |
| Analytics | `GET /campaigns/{id}/analytics` (already specified) surfaced read-only in an admin context, plus platform-wide aggregate campaign metrics via `analytics_daily_rollups` |

---

## 11. User Management

Search/filter/list across `talent_profiles`/`hirer_profiles`/`admin_profiles` per the existing profile tables — no new resource beyond what `DATABASE_ARCHITECTURE.md` §3 defines. Bulk actions limited to non-decision ones (bulk-export, bulk-tag for outreach) for the same reason bulk-approve is excluded from the verification queue (§3) — a bulk suspend, in particular, is **not** offered; suspension is always a considered, individually-reasoned action.

### 11.1 Impersonation — new capability, requires careful design
Not present in any prior document. Specified here because "Impersonate user (with full audit logging)" was explicitly requested, and a capability this sensitive should never ship with an ad-hoc design:
- **Permission:** a distinct `users:impersonate` grant, held only by Super Admin by default (not bundled into general `users:view`/`users:suspend`) — impersonation is categorically more sensitive than viewing or suspending, since it means *acting as* the user.
- **Mechanism:** a special short-lived (15-minute, non-renewable) impersonation access token, carrying both `sub: <target_user_id>` (so authorization checks behave exactly as if that user were logged in) **and** an `impersonated_by: <admin_user_id>` claim that's never absent and never spoofable by the impersonating admin.
- **Scope restriction:** while impersonating, certain actions are **blocked regardless of the target user's normal permissions** — changing the target's password/email, adding/removing payout methods, and initiating a withdrawal are all disallowed during an impersonation session, since "see what the user sees for support purposes" should never become "take irreversible actions the real user didn't initiate."
- **Audit logging:** session start and end are logged (`user.impersonation_started`/`ended`, actor=admin, target=user), **and every individual action taken during the session is separately logged with both IDs attached** — not just the session boundary.
- **User-facing transparency:** the impersonated user's next login (or an immediate in-app notice, founder's choice — flagged §23) surfaces "An administrator accessed your account for support purposes on [date/time]" — impersonation should never be invisible to the person it happened to, both as a trust commitment and because several jurisdictions' privacy expectations (and likely GDPR-adjacent obligations depending on launch geography, `ARCHITECTURE.md` §24 open question) treat this as a disclosure-worthy access event.
- **Visible banner:** the CRM UI renders a persistent, impossible-to-miss banner ("Viewing as [user] — impersonation active, ends in 12:34") for the duration — never a silent context switch an admin could forget they're in.

### 11.2 Deactivate / Reactivate
Distinct from Suspend (§5) — this is the **user's own** `deactivated` state (`DATABASE_ARCHITECTURE.md` §16/§21's account-status table) surfaced to Admin for support-assisted cases (e.g., a user emails Support asking to be reactivated because they forgot their own password reset flow works). `Reactivate` here is the Admin performing the same action the user could self-serve — logged identically either way.

---

## 12. Payments

| Capability | Mechanism |
|---|---|
| Wallet (view) | `GET /admin/wallets/{id}` — read-only, `financials:view` |
| Escrow (view/manage) | `escrow_holds` — Finance Manager can view all; release/dispute-resolution release is the same action already specified (`API_SPECIFICATION.md` §8), performed on the Finance Manager's authority when resolving a dispute rather than the Hirer's own action |
| Invoices | Read-only list/regenerate (`invoices`) |
| Refund Requests | Queue of user-initiated refund requests (via Support ticket or a dedicated request — flagged: no dedicated `refund_requests` table exists; at MVP this is a `support_tickets` row with `category='refund'`, handled by Finance Manager, not a separate entity) |
| Payment Failures | `payments` where `status=failed`, surfaced for manual follow-up (retry contact, alternate payment method) |
| **Manual Adjustments (restricted)** | See below |

### 12.6 Manual Adjustment Control
A direct balance "fix" is never a raw `UPDATE` on `wallets.cached_balance_cents` — it is always a new, reason-required `wallet_transactions` row of `type='manual_adjustment'` *(new transaction type, flagged addition to `DATABASE_ARCHITECTURE.md` §12's enum)*, preserving the ledger's append-only integrity. **Recommended control (new, not previously specified, flagged for founder confirmation):** adjustments above a configurable threshold (e.g., an amount set in `platform_settings`) require a second Finance Manager or Super Admin's approval before posting — a maker-checker pattern standard in financial operations, preventing a single compromised or mistaken admin action from directly moving real money.

---

## 13. Reporting

Daily/Weekly/Monthly/Growth/Verification/Revenue/Support/Moderator reports are all views over `analytics_daily_rollups` (`DATABASE_ARCHITECTURE.md` §13), parameterized by date range and `metric_key`/`dimensions` filters — **one reporting engine, many saved report definitions**, not eight separate reporting subsystems. Export as CSV (tabular metrics) or PDF (narrative summary, reusing the same document-generation pipeline as `invoices`, `ARCHITECTURE.md` §16) is available on every report. Scheduled email delivery of a saved report definition (e.g., "send me the Verification Report every Monday") is a natural Phase 2 extension of the existing `notification-service`, not a new subsystem.

---

## 14. Analytics

| Metric | Computation |
|---|---|
| User Growth | `analytics_daily_rollups` (`signups` by day, cumulative) |
| Conversion Funnel | signup → email-verified → profile-submitted → approved → first-application/first-campaign → first-hire, each a rollup metric keyed by cohort date |
| Verification Time / Average Approval Time | `verification_reviews.created_at − verification_requests.submitted_at`, aggregated daily |
| Approval Rate / Rejection Rate | `COUNT(decision=approved)/COUNT(*)` etc. over `verification_reviews`, rolled up |
| Profile Completion | `talent_profiles.profile_completeness_pct`/`hirer_profiles` equivalent, distribution snapshot |
| Campaign Success | completed contracts ÷ published campaigns, rolled up |
| Hiring Rate | applications → hired ratio, per campaign/casting-call and platform-wide |
| Revenue | `wallet_transactions` where `type=platform_fee`, summed |
| Retention | cohort-based repeat-login / repeat-hire rate, rolled up monthly |

All of the above are pre-aggregated into `analytics_daily_rollups` by a scheduled job (`DATABASE_ARCHITECTURE.md` §13) — the Analytics screens never run these aggregations live against transactional tables, which is exactly the design property that keeps this module's performance flat as the platform scales (§19 of the DB doc).

---

## 15. Audit Logs (CRM view)

Surfaces `audit_log_entries` (`API_SPECIFICATION.md` §5.3's read-only `GET /admin/audit-logs`), with the "Who / What / When / Why / Before / After" fields the founder's request names mapping directly to `actor_id` / `action` / `created_at` / (the `reason` embedded in the relevant `before/after` diff or linked `verification_reviews.reason`) / `before_state` / `after_state`.

**Flagged schema gap — IP Address / Device:** `audit_log_entries` as specified in `DATABASE_ARCHITECTURE.md` §10 has no `ip_address`/`user_agent` columns (only `sessions` does). Since this document's founder brief explicitly requires IP/device on every audit entry, this document proposes adding `ip_address inet` and `user_agent text` (both nullable, for the rare system-triggered entries with no request context) to `audit_log_entries` — an additive column addition, flagged §23, needed before this requirement is fully satisfiable.

---

## 16. Role Management

Builds directly on `roles`/`permissions`/`role_permissions`/`user_roles` (`DATABASE_ARCHITECTURE.md` §2):
- **Create/Edit roles:** Super Admin only, `roles:manage` — creates a new `roles` row + assigns a `permissions` set via `role_permissions`.
- **Permission groups:** `permissions.key` values are namespaced (`verification:*`, `financials:*`, `content:*`) precisely so the Role Management UI can present them grouped by namespace rather than as one flat list of 30+ checkboxes.
- **Custom permissions:** Super Admin can compose a bespoke role from any combination of existing `permissions` rows — the system doesn't hardcode the eight named roles in §1 as the only possible combinations; those are the *recommended starting set*, not a ceiling.
- **Temporary permissions — flagged schema gap:** "grant X permission for 24 hours during an incident" requires an `expires_at` (nullable timestamptz) column on `user_roles`, which does not currently exist in `DATABASE_ARCHITECTURE.md` §2. Proposed addition, flagged §23 — a scheduled job would then need to sweep expired grants, analogous to the existing session/refresh-token expiry sweep (`AUTHENTICATION.md` §6).

---

## 17. Settings

| Setting | Backing mechanism |
|---|---|
| Platform Settings | `platform_settings` (`scope=business`), `DATABASE_ARCHITECTURE.md` §13 |
| Email Templates | `email_templates` |
| Homepage Management / Featured Profiles / Featured Campaigns | `homepage_content_blocks` / `featured_*` tables — contingent on `DATABASE_ARCHITECTURE.md` §19's open question #8 being resolved as "build it" |
| Categories / Skills / Languages | The lookup tables (`talent_categories`, `campaign_categories`, `casting_call_categories`, `skills`, `languages`) — Content Manager, per `DATABASE_ARCHITECTURE.md` §1.4's "admin-editable vocabulary" design |
| **Verification Rules** | **Proposed to live in `platform_settings` as structured `jsonb`** (e.g., `{talent_type: creator, required_documents: [government_id], sla_hours: 48}`), rather than a new dedicated table — reuses the existing settings mechanism instead of introducing a parallel configuration system. Flagged for founder confirmation that this is an acceptable level of structure, or whether verification rules warrant their own first-class table if they're expected to grow complex (e.g., per-category document requirements, conditional rules) — noted §23. |

---

## 18. Search

**Global CRM Search:** one search bar across Users, Verification Requests, Support Tickets, Campaigns/Casting Calls — a CRM-scoped application of the same `pg_trgm`/`tsvector` pattern already specified for public search (`DATABASE_ARCHITECTURE.md` §17), not a separate search stack.

**Advanced Filters:** per-module filters as specified in §3 (verification), §8 (support), §11 (users).

**Saved Filters / Recent Searches — flagged, same class of gap already noted in `API_SPECIFICATION.md` §26.x-3** for the public Discover search: no backing table exists yet for persisting a staff member's filter presets or search history. Proposed as a small `admin_saved_filters` table (`admin_id`, `module`, `filter_json`, `label`) if adopted — flagged §23, shares the same underlying gap as the public-facing feature, so resolving one's schema approach likely resolves both.

---

## 19. Notifications (CRM-internal)

- **Real-time:** WebSocket channel (`ARCHITECTURE.md` §19's gateway), used for queue-count badge updates and incoming-ticket alerts without a page refresh.
- **Email:** SLA-breach and escalation summaries (digest, not per-item, to avoid alert fatigue) via `notification-service`.
- **Internal alerts:** in-app toast/banner for time-sensitive events (a ticket just escalated to you, a verification request just reassigned to you).
- **Escalations:** an escalated item's assignee change (§5) itself triggers a notification to the new assignee; a repeated escalation (escalated twice without resolution) additionally notifies the relevant specialist's manager tier (Operations Manager/Super Admin) — a simple, config-driven repeat-escalation rule, not a complex workflow engine.

---

## 20. UI/UX — Desktop, Laptop, Tablet (No Mobile Admin)

Consistent with `DESIGN_SYSTEM.md` §5's explicit choice that the CRM always shows a full, non-collapsible sidebar, and with this founder request's explicit "do not design for mobile admins":

- **Desktop (≥1280px, `bp.md` upper range + `bp.lg`):** Full sidebar (240px expanded) + three-zone content (queue/list, detail drawer, contextual panel) — the reference layout every screen in §2–18 above assumes by default.
- **Laptop (1024–1279px, lower `bp.md`):** Sidebar auto-collapses to the 72px icon rail (`DESIGN_SYSTEM.md` §6) to preserve content width for dense `DataTable`s; detail drawers become full-width overlays instead of a side-by-side split, since 1024px isn't wide enough for queue-list + drawer + contextual panel simultaneously without cramping the table.
- **Tablet (`bp.sm`, 640–1023px):** Single-column, one-screen-at-a-time navigation (queue → tap a row → full-screen detail view → back) rather than any split-pane layout; bulk-selection controls remain available but the dashboard's stat-row grid drops to 2 columns (`DESIGN_SYSTEM.md` §5's responsive grid rule). This is the **minimum supported CRM breakpoint** — genuinely below-tablet (phone-width) admin access is explicitly out of scope per the founder's brief, and no layout is specified for it.

---

## 21. Security (CRM-specific)

- **Session timeout:** stricter than the general user idle policy in `AUTHENTICATION.md` §6 (14-day idle expiry) — **flagged new parameter, proposed 30-minute active-idle auto-lock** for CRM sessions specifically (re-requires a password/MFA re-entry, not a full logout, to resume), given the sensitivity of what a CRM session can see/do. Needs founder confirmation of the exact duration, but the *principle* — CRM idle timeout should be materially shorter than the general platform's — is a standard internal-tooling security practice worth adopting regardless of the exact number.
- **Sensitive actions require confirmation dialogs:** Suspend, Delete, Reject, Manual Adjustment, Impersonate — every one of these opens a `Dialog` (`DESIGN_SYSTEM.md` §7) restating the consequence before the action fires, not just a bare button click.
- **Permission checks:** the same four-layer model as the rest of the platform (`AUTHENTICATION.md` §14) — CRM screens are not a special case architecturally, just a higher-privilege consumer of the same authorization stack.
- **IP logging / Device logging:** covered by the `sessions` table for login context and the proposed `audit_log_entries` IP/device columns (§15) for action-level context — the same underlying mechanism, applied at two different granularities (session-level vs. per-action).

---

## 22. Future Modules

| Module | Reconciliation with `ARCHITECTURE.md` §21 |
|---|---|
| AI-Assisted Verification | Already on the roadmap as "Profile Review AI" / "Portfolio Review AI" |
| **AI Fraud Detection** | **New — not in `ARCHITECTURE.md` §21's original list.** Would sit alongside Profile Review AI but is a distinct model concern (transaction/behavior-pattern anomaly detection vs. document/profile content review) — flagged as a roadmap addition needing reconciliation with that document |
| **AI Duplicate Profile Detection** | **New** — supports §9's manual duplicate-account workflow; likely shares infrastructure with Portfolio Review AI's media-fingerprinting approach but is conceptually distinct (identity matching, not content-authenticity checking) |
| AI Moderation | Extends the existing Portfolio Review AI concept to messages/reviews, not just portfolio media |
| **AI Support Assistant** | **New** — a support-ticket-drafting/triage assistant, distinct in kind from every other AI feature in `ARCHITECTURE.md` §21 (which are all applicant/talent-facing or verification-facing) — this is the first *internal-tooling* AI feature proposed anywhere in the documentation set, worth its own line item in that roadmap rather than being silently folded in here |

All four "new" items above should be explicitly added to `ARCHITECTURE.md` §21 rather than left to live only in this document, so the AI roadmap stays the single source of truth for what's planned — flagged in §23.

---

## 23. Implementation Readiness

### 23.1 Founder Decisions Still Required
1. **Exact permission bundles per named role** (§1) — this document proposes reasonable defaults; final grants need sign-off before `role_permissions` seed data is written.
2. **Campaign pre-publish approval** (§10) — post-publish moderation only (this document's default) vs. requiring Admin approval before a campaign goes live.
3. **Impersonation disclosure mechanism** (§11.1) — immediate in-app notice vs. next-login notice, and confirmation this feature is wanted at all given its sensitivity.
4. **Manual adjustment maker-checker threshold** (§12.6) — whether to require it at all, and at what amount.
5. **CRM idle-timeout duration** (§21) — proposed 30 minutes, needs a specific number signed off.
6. **Verification Rules structure** (§17) — `platform_settings` jsonb (proposed) vs. a dedicated first-class table.
7. **Refund Requests** (§12) — accept the "support ticket with category=refund" approach at MVP, or build a dedicated entity now.

### 23.2 Missing Business Rules
- Which specific profile-edit fields trigger re-verification (inherited, unresolved, from `AUTHENTICATION.md` §21.1-4 — this document's Profile Review Page assumes an answer exists without depending on which one).
- Exact SLA-hour targets per ticket priority and per verification-request type (§8, §3) — this document specifies *where* the config lives (`platform_settings`), not the numbers themselves.
- Whether a `banned` account is ever reversible by Support/Admin action, or only by Super Admin, or never (§5's Restore action note).
- Whether resubmission after **Rejected** (not just Changes Requested) is ever permitted without a Support-mediated appeal, or strictly Support-gated as this document assumes (§5).

### 23.3 Potential Operational Bottlenecks
- **Verification Executive throughput** is the platform's hard ceiling on supply-side growth (`ARCHITECTURE.md` §2's growth goal depends on it) — the SLA-timer/priority design (§3) surfaces this risk but doesn't solve it; headcount planning against submission-volume forecasts is an operational decision this document can't make.
- **Single-reviewer Reject/Changes-Requested requirement** (deliberately no bulk-decision path, §3) trades throughput for quality — worth monitoring once real volume exists to see if it becomes the actual bottleneck rather than a theoretical one.
- **Manual Refund Requests** (§12, no dedicated entity at MVP) could become unwieldy inside general Support tickets once refund volume grows — flagged as a likely fast-follow to promote into its own resource.

### 23.4 Future CRM Improvements
- AI-assisted risk scoring in the verification queue (§3), once `ARCHITECTURE.md` §21's Profile Review AI ships.
- Scheduled/subscribed reports (§13) rather than only on-demand generation.
- A dedicated Refund Requests entity (§23.3) once volume justifies it.
- Trusted-reviewer fast-lane (a Verification Executive with a strong track record gets a lighter-touch second review, or none, on straightforward resubmissions) — a process idea, not an architectural one, worth considering once approval-rate/quality data exists.

### 23.5 Recommended Implementation Order
1. Roles/Permissions seed data + the three new `roles` rows (§0/§1) — nothing else in this document is reachable without this.
2. Verification Queue + Profile Review Page + core actions (§3–5) — the highest-value, highest-volume workflow; ship before anything else in the CRM.
3. Request-Changes workflow (§6) — depends on (2), ships alongside it.
4. Audit log IP/device columns (§15) and `admin_notes` — wire into (2) as it's built, not retrofitted after (mirrors `AUTHENTICATION.md` §21.4's same principle for auth events).
5. Support Center (§8) and User Communication (§7) — can build in parallel with (2)–(4), independent workflow.
6. User Management + Content Moderation (§9, §11), excluding Impersonation pending founder sign-off (§23.1-3).
7. Payments/Finance module (§12) — depends on `payments-service`/wallet infrastructure existing first (`ARCHITECTURE.md` §20).
8. Reporting/Analytics (§13–14) — depends on `analytics_daily_rollups` rollup jobs existing (`DATABASE_ARCHITECTURE.md` §13).
9. Settings/Content Manager tools (§17), Homepage/Featured (contingent), Role Management self-service UI (§16) — lowest urgency, ship last.

---

*End of CRM specification. Subordinate to `ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `API_SPECIFICATION.md`, and `AUTHENTICATION.md`; awaits founder resolution of §23.1 before implementation begins.*
