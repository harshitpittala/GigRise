# GigRise — Cross-Document Architecture Review
**Version 1.0 — CTO-Level Pre-Implementation Review**
**Status:** Analysis only. This document modifies nothing — it identifies what the seven prior documents require before implementation begins. No document was edited to produce this review.

**Documents reviewed (cover to cover):** `ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `API_SPECIFICATION.md`, `AUTHENTICATION.md`, `CRM_SPECIFICATION.md`, `PROJECT_SETUP.md`.

---

## 0. Method

Each of the seven documents already flagged its own open questions and reconciliation notes as it was written — that self-flagging is a real strength (§12 scores it accordingly) and this review does not simply re-list all of it as if newly discovered. Instead: §1 gives a short per-document verdict; §2 runs the full requested checklist, **distinguishing previously-flagged items (marked ✅ *already flagged*) from genuinely new findings surfaced by reading all seven documents together** (marked 🆕 *new*); §3–8 drill into the specific review angles the founder asked for; §9–14 are the synthesized deliverables.

---

## 1. Per-Document Verdict

| Document | Verdict |
|---|---|
| **ARCHITECTURE.md** | Sound foundation; two of its five open questions are now implicitly resolved by later documents (payment processor, launch geography) but never explicitly closed out; its AI roadmap (§21) is now stale relative to CRM/API additions |
| **DATABASE_ARCHITECTURE.md** | The most rigorous document in the set; several enums/columns need small additive amendments (consolidated §10); its auth-adjacent portions (`users`, `sessions`, `refresh_tokens`, `oauth_accounts`) are structurally superseded by the Supabase Auth decision made three documents later |
| **DESIGN_SYSTEM.md** | Strong system, but written *before* API/Auth/CRM — several UI surfaces those later documents introduced (MFA enrollment, impersonation banner, maker-checker approval dialog, temporary-permission UI, Availability indicator) have no corresponding component spec |
| **API_SPECIFICATION.md** | Comprehensive and internally consistent; several endpoints reference database entities that don't exist yet (flagged at the time, still open); a handful of endpoints referenced by later documents (`GET /admin/campaigns`) were never added back into it |
| **AUTHENTICATION.md** | Conceptually excellent RBAC/verification/audit design; its *credential and session mechanics* (§2, §6–10) are the one part of the entire documentation set that will not be built as literally written, once Supabase Auth is adopted three documents later |
| **CRM_SPECIFICATION.md** | Thorough operational design; introduces the single most sensitive unresolved feature in the project (impersonation) and several schema gaps of its own |
| **PROJECT_SETUP.md** | Correctly identifies and reconciles the Supabase Auth conflict — but the reconciliation stops at "who owns sessions," not "what happens to the specific claim/MFA/reset mechanics AUTHENTICATION.md designed" (§5 closes this gap); also silently drops `ARCHITECTURE.md` §11's infra/Kubernetes folder structure without reconciling it |

---

## 2. Full Checklist

### 2.1 Contradictions
- ✅ *already flagged* — Supabase Auth vs. `AUTHENTICATION.md`'s custom token/session design (`PROJECT_SETUP.md` §0.1). **Still the largest single item in this entire review** — see §5.
- 🆕 **JWT claim content is unaddressed by the Supabase reconciliation.** `AUTHENTICATION.md` §1.2 specifies custom JWT claims (`talent_type`/`hirer_type`, `verification_status`, `permissions[]`) embedded directly in the access token. Supabase-issued JWTs don't carry these by default — they require a **Custom Access Token Hook** (a Supabase-specific configuration mechanism) to inject them. `PROJECT_SETUP.md` §0.1 addresses *who issues the token* but never addresses *whether the token's contents still match what `AUTHENTICATION.md` and `API_SPECIFICATION.md` §1.2 assume every downstream service can read off the JWT directly*. This blocks a correct implementation of every permission check described as "claims-based" in `AUTHENTICATION.md`/`API_SPECIFICATION.md` until resolved.
- 🆕 **Access token lifetime mismatch.** `AUTHENTICATION.md` §6 specifies a 15-minute access token. Supabase Auth's default is 1 hour, and while configurable, `PROJECT_SETUP.md` never states that this configuration will actually be changed to match. A silent default-value mismatch here would materially change the security posture `AUTHENTICATION.md` §18/§19 reasons about (a longer-lived token widens the theft-damage window).
- 🆕 **Payment processor enum is stale.** `DATABASE_ARCHITECTURE.md` §12 defines `payments.processor` as `stripe | other` — written when `ARCHITECTURE.md` §24 was still asking "confirm payment processor (Stripe Connect is the natural fit)." `PROJECT_SETUP.md` §0.3 later confirms **Razorpay**, but the enum in the database document was never updated to include it. This is a clean, traceable example of the exact "documentation drift" this review exists to catch: an open question got answered three documents later, and the answer never propagated back.
- ✅ *already flagged* — `reports.target_type` enum missing `campaign`/`casting_call`/`review` (`CRM_SPECIFICATION.md` §9), the latter already silently assumed to exist by `API_SPECIFICATION.md` §13.

### 2.2 Duplicate Concepts
- ✅ *already flagged and reconciled at the time* — Bookmarks/Saved Profiles, Reviews/Ratings, System/Platform Settings, Push Notifications' two lifecycles — all resolved within `DATABASE_ARCHITECTURE.md` itself, no residual duplication.
- 🆕 **"Guest" (AUTHENTICATION.md §4) vs. "public" (API_SPECIFICATION.md §1.9) are the same concept under two names.** Harmless in practice (both mean "unauthenticated"), but worth standardizing on one term before it's implemented as two different-looking checks in two different codebases (frontend route guards vs. API auth middleware).
- 🆕 **Permission-key vocabulary is defined piecemeal across three documents**, not once. `DATABASE_ARCHITECTURE.md` §2 seeds only three illustrative keys; `API_SPECIFICATION.md` and `CRM_SPECIFICATION.md` each introduce additional keys as needed (`content:manage`, `campaigns:manage`, `audit:view`, `users:impersonate`, `financials:adjust`, etc.) without ever being consolidated into one canonical list. Low risk of contradiction (nothing conflicts), but real risk of **inconsistent spelling/namespacing** once multiple engineers implement against scattered mentions rather than one seed-data table.
- 🆕 **Audit log `action` string vocabulary has the identical problem** — `verification.approved`, `user.suspended`, `auth.login_succeeded`, `role.permission_granted`, etc. are each introduced in whichever document happened to need them, with no single appendix enumerating the full set.

### 2.3 Missing Database Fields / Missing Enums (consolidated)
| Table | Missing | Source | Status |
|---|---|---|---|
| `payments.processor` | `razorpay` value | This review | 🆕 new |
| `verification_comments` | `media_asset_id` (screenshot attachments) | `CRM_SPECIFICATION.md` §6 | ✅ already flagged |
| `support_ticket_messages` | attachment support | `CRM_SPECIFICATION.md` §8 | ✅ already flagged |
| `reports.target_type` | `campaign`, `casting_call`, `review` | `CRM_SPECIFICATION.md` §9 | ✅ already flagged |
| `campaigns.status` / `casting_calls.status` | `suspended`, `archived` | `CRM_SPECIFICATION.md` §10 | ✅ already flagged |
| `audit_log_entries` | `ip_address`, `user_agent` | `CRM_SPECIFICATION.md` §15 | ✅ already flagged |
| `user_roles` | `expires_at` (temporary permissions) | `CRM_SPECIFICATION.md` §16 | ✅ already flagged |
| `wallet_transactions.type` | `manual_adjustment` | `CRM_SPECIFICATION.md` §12.6 | ✅ already flagged |
| `talent_profiles` | `availability_status`, `available_from` | `API_SPECIFICATION.md` §4.5 | ✅ already flagged |
| — (new table) | `saved_searches` | `API_SPECIFICATION.md` §6 | ✅ already flagged |
| — (new table) | `recent_searches` / trending-search support | `API_SPECIFICATION.md` §15 | ✅ already flagged |
| `conversation_participants` | `archived_at` | `API_SPECIFICATION.md` §9 | ✅ already flagged |
| — (new table, admin-side) | `admin_saved_filters` | `CRM_SPECIFICATION.md` §18 | ✅ already flagged |
| `wallet_transactions` | self-referential `reverses_transaction_id` for refund traceability | This review | 🆕 new, low-priority (nice-to-have, not a blocker — a refund is already correctly typed and linked to its contract/milestone, just not explicitly linked to the original charge transaction it reverses) |
| `users`, `sessions`, `refresh_tokens`, `oauth_accounts` | **Entire table set needs redefinition** per the Supabase Auth decision | `PROJECT_SETUP.md` §0.1 | ✅ already flagged, but see §5 — this is bigger than a column addition |

### 2.4 Missing API Endpoints (consolidated)
- ✅ `GET /admin/campaigns` (admin-scoped campaign list) — flagged in `CRM_SPECIFICATION.md` §10 as an `API_SPECIFICATION.md` addendum, never actually added back to that document.
- ✅ `POST /auth/verify-email/resend` — flagged as an addendum in `AUTHENTICATION.md` §8, same situation.
- 🆕 **No endpoint exists for the CRM's `admin_saved_filters` or the public-facing `saved_searches`**, even as a stub — both were flagged as schema gaps, but since the schema doesn't exist, there's also no corresponding endpoint contract yet in either spec. Not a new *problem*, but worth noting the gap is two-layered (schema **and** endpoint), not just schema.
- 🆕 **No endpoint exists for MFA-related actions being surfaced anywhere in `API_SPECIFICATION.md`** — `AUTHENTICATION.md` §10.5 describes `POST /auth/mfa/enroll` / `/confirm` / `/verify`, but these were never added to `API_SPECIFICATION.md`'s own endpoint tables (§2). A minor cross-document completeness gap — the endpoints are specified, just in the wrong document relative to where a reader would expect to find the full auth endpoint list.

### 2.5 Missing Permissions
Covered under §2.2's "permission vocabulary is scattered" finding — no permission *check* is missing from any workflow (every action in `CRM_SPECIFICATION.md` and `API_SPECIFICATION.md` names a permission), the gap is that the vocabulary has never been consolidated into one authoritative seed list.

### 2.6 Missing Indexes
No new gaps found beyond `DATABASE_ARCHITECTURE.md` §18.1's own blanket rule ("every foreign key gets an index") — this rule, if actually followed during migration-writing, covers every table added via reconciliation notes throughout the document (e.g., `casting_calls`, `application_status_history`). The one thing worth flagging: **the blanket rule needs to be explicitly re-verified against the tables added in later reconciliation notes** (§2.3 above) once those columns are actually added, since a new FK added after the fact is exactly the kind of thing that's easy to forget an index for.

### 2.7 Broken Workflows
None found that are actually broken end-to-end — every requested workflow (registration→verification→approval, apply→offer→contract→escrow→release→review, verification-changes-requested→resubmit) traces cleanly through all seven documents. The closest thing to a "broken" workflow is **campaign moderation**, which is broken only in the sense that `campaigns.status` lacks the `suspended`/`archived` states `CRM_SPECIFICATION.md` §10 assumes exist — already flagged, consolidated in §2.3.

### 2.8 Security Gaps
- ✅ Impersonation disclosure mechanism unconfirmed (`CRM_SPECIFICATION.md` §11.1/§23.1).
- ✅ Manual wallet adjustment maker-checker threshold unconfirmed (`CRM_SPECIFICATION.md` §12.6/§23.1).
- ✅ CRM idle-timeout duration unconfirmed (`CRM_SPECIFICATION.md` §21/§23.1).
- 🆕 **No document specifies what happens to an in-flight impersonation session if the impersonated user's account is suspended mid-session**, or vice versa (an admin's own access revoked while impersonating). A small but real edge case in an already-sensitive feature — worth resolving alongside the rest of the impersonation design, not after.
- 🆕 **Password reset / email verification / MFA now have two possible implementations in flight** (Supabase's native flows vs. `AUTHENTICATION.md`'s custom-token versions) with no document stating which one is authoritative — see §5. Until resolved, this is a security-relevant ambiguity, not just an efficiency one: two half-implemented reset flows is worse than either one alone.

### 2.9 Performance Issues
No new issues found — `DATABASE_ARCHITECTURE.md` §18 and `API_SPECIFICATION.md` §25's caching/pagination/lazy-loading design is consistently applied everywhere it's referenced in later documents. `PROJECT_SETUP.md` §13 correctly implements rather than reinvents these tiers.

### 2.10 Scalability Risks
No new risks — every document's scalability section (`ARCHITECTURE.md` §23, `DATABASE_ARCHITECTURE.md` §18.6, `AUTHENTICATION.md` §19) tells the same consistent story, and `PROJECT_SETUP.md` §0.2 correctly frames the Supabase-single-instance MVP reality as the first rung of that same ladder rather than a contradiction of it. One thing worth watching operationally rather than architecturally: **Verification Executive throughput** (`CRM_SPECIFICATION.md` §23.3) remains the platform's actual growth ceiling regardless of how well the software scales.

### 2.11 Documentation Drift
- 🆕 **`ARCHITECTURE.md` §11's infra folder (`infra/terraform/`, `infra/docker/`, `infra/k8s/`) is absent from `PROJECT_SETUP.md` §2's actual repository structure, with no reconciliation note explaining why.** This is the clearest unaddressed drift in the set: either managed hosting (Supabase + likely a platform like Vercel for the Next.js apps) has made Kubernetes/Terraform unnecessary at MVP scale — which would be a reasonable, `§0.2`-consistent call — or the folder was simply dropped without the decision being made explicitly. Needs an explicit reconciliation note in `PROJECT_SETUP.md`, the same treatment §0 already gave the Auth and datastore questions.
- 🆕 **`apps/mobile/` (`ARCHITECTURE.md` §11, Phase 2 React Native) is likewise absent from `PROJECT_SETUP.md` §2** with no note that it's deferred rather than abandoned. Low priority (it's genuinely Phase 2), but a one-line note would prevent a future reader from wondering if mobile was quietly descoped.
- ✅ Two of `ARCHITECTURE.md` §24's five open questions (payment processor, launch geography) are now implicitly answered by `PROJECT_SETUP.md` §0.3 but never explicitly closed out in `ARCHITECTURE.md` itself or in a changelog (which doesn't exist yet — `PROJECT_SETUP.md` §15.3 already flags this).
- 🆕 **`ARCHITECTURE.md` §21's AI roadmap is now stale** — `CRM_SPECIFICATION.md` §22 and `API_SPECIFICATION.md` §16 between them add four AI features (Fraud Detection, Duplicate Profile Detection, Support Assistant, Caption Generator) that don't appear in the original roadmap document, each individually flagged at the time but never actually merged back into `ARCHITECTURE.md` §21.

### 2.12 Naming Inconsistencies
- ✅ "Chats" (founder's CRM request) vs. `conversations` (canonical) — already reconciled explicitly in `API_SPECIFICATION.md` §9.
- 🆕 "Guest" vs. "public" (§2.2).
- No other material naming inconsistencies found — `talent_type`/`hirer_type`, `verification_status`, and every core enum are spelled identically across all seven documents, which is a genuine strength worth noting positively.

### 2.13 Folder Inconsistencies
- 🆕 The infra folder drop (§2.11) is the only real folder-structure inconsistency found. `apps/web`, `apps/admin`, `packages/*` are consistent between `ARCHITECTURE.md` §11 and `PROJECT_SETUP.md` §2. `services/*` from `ARCHITECTURE.md` §11 is correctly reinterpreted as internal `apps/api/services/*` packages in `PROJECT_SETUP.md` §4, with the reasoning explicit (§0.2) — this is a good reconciliation, not a drift.

### 2.14 Role Inconsistencies
None found. The eight CRM roles (`CRM_SPECIFICATION.md` §0–1) map cleanly onto the four-role/scoped-permission model established in `DATABASE_ARCHITECTURE.md` §2 and used consistently in `AUTHENTICATION.md` §4–5 and `API_SPECIFICATION.md` §1.9 — this is one of the strongest threads running through the entire documentation set.

### 2.15 Authentication Inconsistencies
Covered fully in §5 — this is the dominant finding of the entire review.

### 2.16 Verification Inconsistencies
None found — `verification_status`'s five values (`draft`/`pending_review`/`approved`/`rejected`/`changes_requested`) are used identically in `DATABASE_ARCHITECTURE.md` §4, `DESIGN_SYSTEM.md` §9, `API_SPECIFICATION.md` §5.1, `AUTHENTICATION.md` §12, and `CRM_SPECIFICATION.md` §3–6, with no drift anywhere.

### 2.17 CRM Inconsistencies
Covered in §6.

### 2.18 Payment Inconsistencies
- 🆕 The `processor` enum staleness (§2.1, §2.3) is the only real inconsistency. Everything else — the `payments`/`wallet_transactions` split, escrow-as-internal-ledger design, Razorpay Route mapping — is consistent across `DATABASE_ARCHITECTURE.md` §12, `API_SPECIFICATION.md` §14, and `PROJECT_SETUP.md` §0.3.

### 2.19 Search Inconsistencies
- 🆕 **No Elasticsearch/OpenSearch tool is named anywhere in `PROJECT_SETUP.md`'s tech stack**, despite `DATABASE_ARCHITECTURE.md` §17 and `API_SPECIFICATION.md` §6/§15 both describing a migration path to one. The MVP path (Postgres `tsvector`/`pg_trgm`, which Supabase supports natively) is fully covered — this is a low-priority forward gap, not an MVP blocker, but should be noted so it isn't rediscovered as a surprise when that migration is actually due.
- Naming disambiguation between Discover search and Quick/Command search (`DESIGN_SYSTEM.md` §6 vs. `API_SPECIFICATION.md` §15) was already explicitly handled at the time — no residual confusion found.

### 2.20 AI Inconsistencies
- ✅ Already covered in §2.11 (stale roadmap) and consolidated in §10's amendment table.
- 🆕 **`PROJECT_SETUP.md`'s tech stack section names no AI/ML provider or infrastructure at all** for `services/ai` — reasonable, since every AI feature across the documentation set is explicitly Phase 3+/future, but worth an explicit "not yet chosen, out of scope for MVP stack" note rather than silence, so a future reader doesn't wonder if it was forgotten.

### 2.21 Deployment Inconsistencies
- 🆕 **No concrete hosting platform is named** in `PROJECT_SETUP.md` §10 (it says "a CI/CD-connected hosting platform," generically) — combined with the infra-folder drop (§2.11), this means the blue/green/canary deployment strategy `ARCHITECTURE.md` §22 and `PROJECT_SETUP.md` §10 both describe has no concrete implementation path specified yet. Not a blocker for early development (local + Staging can proceed without this being settled), but it is a gap that should close before the first Production deploy is attempted.

---

## 3. Database Review

**Every endpoint has database support?** Yes, with the explicitly flagged exceptions already consolidated in §2.3/§2.4 (Availability, Saved/Recent Searches, admin filters) — every other endpoint across all of `API_SPECIFICATION.md`'s twenty-plus modules maps to a real table or view.

**Every workflow has required tables?** Yes, including the subtle ones — resubmission history (`verification_requests` as 1:many, not overwritten), event-sourced financial ledger (`wallet_transactions`), append-only audit trail. The one workflow whose tables are structurally incomplete is campaign moderation (missing status enum values, §2.3/§2.7).

**Every enum supports every state?** No — `payments.processor` (missing `razorpay`), `campaigns.status`/`casting_calls.status` (missing `suspended`/`archived`), `reports.target_type` (missing three values), `wallet_transactions.type` (missing `manual_adjustment`) are all incomplete relative to what later documents assume. All four are small, additive fixes.

**Foreign keys:** Consistently modeled throughout, including the deliberate use of polymorphic `target_type`/`target_id` pairs where a true FK isn't appropriate (`DATABASE_ARCHITECTURE.md` §9's explicit reasoning for this pattern) — no missing or dangling FK relationships found.

**Indexes:** Sound blanket policy (§2.6); no specific missing index found beyond the general reminder to re-verify it against later-added columns.

**Audit logging:** Comprehensive in design (`DATABASE_ARCHITECTURE.md` §10, broadened in `AUTHENTICATION.md` §16 to cover self-service security events) — but its IP/device columns are missing (§2.3), and its `action` vocabulary is scattered rather than canonical (§2.2).

---

## 4. API Review

**Maps correctly to the database?** Yes, module-for-module, with the flagged exceptions above. The reconciliation discipline `API_SPECIFICATION.md` itself practiced (collapsing "search creators/actors/brands/directors" into one faceted endpoint, refusing to build four near-identical "Reports" tables, etc.) held up under this review — nothing new contradicts the DB schema beyond what's already listed.

**Authentication/Authorization:** Fully specified at the API layer (`API_SPECIFICATION.md` §1.2, §20) — but structurally dependent on the Supabase Auth resolution (§5). Until that's resolved, the *mechanism* by which a request arrives authenticated is genuinely unsettled, even though the *authorization* logic layered on top of it (role/permission checks) is sound regardless of which mechanism wins.

**Validation, Pagination, Filtering, Sorting, Rate Limits, Error Responses:** All internally consistent — one global convention (§1 of that document) applied without exception across every module reviewed. This is the document's strongest property and it held up completely under cross-document scrutiny.

---

## 5. Authentication Review — Supabase Integration Decision

**Should the custom authentication design be (A) Replaced completely, (B) Adapted, or (C) Kept?**

### Recommendation: **B — Adapted**

Neither extreme is correct. **(C) Keep as-written** would mean building a parallel custom credential/session system alongside Supabase Auth, which is both wasted engineering effort and a larger attack surface than necessary — password hashing, JWT signing, refresh rotation, and MFA are exactly the kind of security-critical, easy-to-get-subtly-wrong code that's better delegated to a managed provider with its own security team and audit history. **(A) Replace completely** would mean discarding the RBAC/permission model, the verification-workflow design, and the audit-logging architecture too — but none of that is actually in conflict with Supabase Auth; it's built on top of whatever issues the identity token, and Supabase Auth issues a perfectly good one to build on top of.

### Exactly what gets adapted, table by table:

| `AUTHENTICATION.md` section | Disposition | Detail |
|---|---|---|
| §2 Registration flow mechanics, §3 Login flow mechanics | **Superseded** | Supabase Auth's `signUp`/`signInWithPassword` client SDK calls replace the custom `POST /auth/signup`/`login` handlers; the *branching logic* (suspended/banned/pending_review outcomes) is **kept**, reimplemented as a post-authentication check in `apps/api` middleware rather than inside a custom login endpoint |
| §6 Sessions/Refresh Tokens/Rotation | **Superseded** | Supabase Auth owns session and refresh-token lifecycle internally; the `sessions`/`refresh_tokens` tables as separately-modeled entities (`DATABASE_ARCHITECTURE.md` §2) are not built as originally specified |
| §7 Web vs. Mobile storage | **Adapted** | The *principle* (never `localStorage`, OS Keychain/Keystore on mobile) is unchanged and still correct — it's now implemented via the Supabase client SDKs' own secure-storage adapters rather than custom token-handling code |
| §8 Email Verification, §9 Password Reset | **Superseded** | Supabase Auth's built-in flows replace the custom-token versions — configured to send via Resend (Supabase supports custom SMTP), preserving the "Resend is the email provider" decision (`PROJECT_SETUP.md` §1.4) without needing our own token-issuance code |
| §10.5 TOTP MFA | **Superseded** | Supabase Auth has native TOTP MFA support — the enrollment/verification flow is Supabase's, not a custom build |
| §1.2 JWT claims | **Adapted, requires new work not yet specified anywhere** | Must be implemented via a Supabase Custom Access Token Hook to inject `role`, `talent_type`/`hirer_type`, `verification_status`, and resolved `permissions[]` — this hook needs its own short spec before implementation (§9's Critical Blockers) |
| §4–5 RBAC roles/permission matrices | **Kept, fully unaffected** | This entire layer sits on top of whichever token issuer wins and never assumed a specific one |
| §12 Verification-status × account-status combined access table | **Kept, fully unaffected** | Same reasoning |
| §13 Admin verification workflow authorization | **Kept, fully unaffected** | Same reasoning |
| §14 Four-layer authorization model | **Kept, layer 1 reinterpreted** | Layer 1 (frontend route guards) now reads Supabase's session object instead of a custom-decoded JWT; layers 2–4 (gateway, service, RLS) are unaffected and arguably *strengthened*, since Supabase RLS policies are natively built around `auth.uid()` — exactly the pattern `DATABASE_ARCHITECTURE.md` §1.6/§15 already assumed |
| §15 File security (signed URLs) | **Kept, unaffected** | Governed by Supabase Storage's own RLS-backed signed-URL mechanism, which is what `PROJECT_SETUP.md` §0.4 already assumes |
| §16 Audit logging | **Kept, unaffected** — one addition needed | Login/logout events now originate from Supabase Auth webhooks/events rather than a custom endpoint, but still need to land in `audit_log_entries` exactly as designed — this is an integration detail, not a design change |
| §10.1–10.4 Password rules, lockout, rate limiting, bot detection | **Adapted** | Supabase has some native rate-limiting; `API_SPECIFICATION.md` §1.7's stricter tiered limits and the account-level lockout logic (§10.2) likely still need to be enforced at the gateway layer on top of Supabase's baseline, not assumed to be fully covered by it — needs explicit confirmation of what Supabase's plan tier actually provides before assuming this gap is closed |
| §17 Error codes | **Mostly kept, some need remapping** | Supabase Auth returns its own error shapes on its own endpoints (during the login/signup call itself); `API_SPECIFICATION.md` §19's envelope still governs everything *after* that point (every GigRise-owned endpoint) — the two error surfaces need an explicit translation layer at the API gateway so a frontend never has to handle two different error shapes depending on which call failed |
| §18–19 Security best practices, Scalability | **Kept as principles**, arguably improved — Supabase manages the stateless-verification infrastructure §19 reasons about, rather than GigRise having to build and scale it |

**Documents requiring amendment as a direct result of this decision:** `AUTHENTICATION.md` (§2, §6–10, primarily), `DATABASE_ARCHITECTURE.md` §2 (`users` redefined as an `auth.users` extension; `sessions`/`refresh_tokens`/`oauth_accounts` removed or repurposed), `DATABASE_ARCHITECTURE.md` §16 (GDPR anonymization must now call the Supabase Admin API to scrub `auth.users`, not just `UPDATE public.users` — a genuinely new finding from this review, since anonymization was written assuming GigRise owned the `email` column directly). `PROJECT_SETUP.md` §0.1 already anticipates most of this but should be treated as the *summary*, not the full amendment — the actual detailed rewrite still needs to happen in the two source documents.

---

## 6. CRM Review

| Area | Finding |
|---|---|
| Verification workflow | Fully consistent end-to-end across all seven documents — no gaps beyond the already-flagged screenshot-attachment schema gap (§2.3) |
| Support workflow | Consistent; attachment support and SLA-column gaps already flagged (§2.3) |
| Moderation | Blocked on the `reports.target_type` enum expansion (§2.3) — otherwise well-specified |
| Analytics | Consistently reads from `analytics_daily_rollups` everywhere it's referenced — no live-aggregation anti-pattern found anywhere in the reviewed documents |
| Permissions | Sound design, scattered vocabulary (§2.2/§2.5) |
| Audit logs | Sound design, missing IP/device columns (§2.3) |
| Queue states | Consistent with the `verification_status` enum everywhere; the deliberate exclusion of bulk-approve/bulk-suspend (`CRM_SPECIFICATION.md` §3) is a considered trade-off, not a gap |

---

## 7. Project Setup Review

| Area | Finding |
|---|---|
| Folder structure | Sound, with the infra-folder and mobile-folder drift noted in §2.11/§2.13 |
| Monorepo | Consistent pnpm-workspace design, clear `packages/*` boundary discipline |
| Dependencies | Sound strategy (lockfiles, weekly automated updates, security-patch auto-merge) — no gaps found |
| CI/CD | Sound pipeline design; blocked on naming an actual hosting platform (§2.21) before the deployment stage is concrete rather than generic |
| Environment variables | Complete relative to the stack as specified, correctly scoped (server-only secrets never reach `NEXT_PUBLIC_*`) — will need additions once the Auth reconciliation (§5) and infra decisions (§2.11) are finalized |
| Deployment | Sound strategy, generic on specifics (§2.21) |

---

## 8. Design Review — UI Coverage Check

Cross-referencing every workflow/page/dashboard required by `ARCHITECTURE.md`, `API_SPECIFICATION.md`, `AUTHENTICATION.md`, and `CRM_SPECIFICATION.md` against `DESIGN_SYSTEM.md`'s component/page inventory — the following have **no corresponding UI specification**, because they were introduced in documents written after `DESIGN_SYSTEM.md`:

1. **MFA enrollment/verification screens** (`AUTHENTICATION.md` §10.5) — no component or page spec exists.
2. **Impersonation banner** (`CRM_SPECIFICATION.md` §11.1) — referenced by name in that document but never given a formal component spec in `DESIGN_SYSTEM.md` §7.
3. **Maker-checker approval dialog** for manual wallet adjustments (`CRM_SPECIFICATION.md` §12.6) — no spec.
4. **Temporary-permission UI** in Role Management (`CRM_SPECIFICATION.md` §16) — no spec.
5. **Availability indicator** on talent profiles (`API_SPECIFICATION.md` §4.5) — no spec, and contingent on the underlying schema gap being resolved first anyway.
6. **Saved Searches / Recent Searches management UI** — no spec, same schema contingency.
7. **Refund Request submission UI** (`CRM_SPECIFICATION.md` §12) — no spec.

Everything else requested across all seven documents — every dashboard variant (§8 of `DESIGN_SYSTEM.md`), every profile type, the verification queue and review drawer, messaging, settings, auth screens — has a defined UI. This is a good ratio (7 gaps against dozens of fully-specified surfaces) and entirely attributable to document sequencing, not design oversight.

---

## 9. Implementation Readiness

### 9.1 Critical Blockers
1. **The Supabase Auth reconciliation is not yet a document, only a recommendation (§5).** No auth-related code should be written until `AUTHENTICATION.md` and `DATABASE_ARCHITECTURE.md` §2/§16 are actually amended to reflect it.
2. **JWT custom-claims mechanism (Custom Access Token Hook) is unspecified.** Every "claims-based" permission check in the API/Auth documents depends on it.
3. **`payments.processor` enum doesn't include `razorpay`.** Trivial to fix, but blocks correct payment-integration schema from day one if missed.

### 9.2 High Priority
4. Consolidate the permission-key and audit-action vocabularies into one canonical seed-data appendix (§2.2/§2.5).
5. Resolve the six CRM-flagged schema gaps (§2.3) — all small, additive, but block the modules that depend on them.
6. Confirm impersonation's disclosure mechanism and whether it ships at all (§2.8).
7. Confirm the manual-adjustment maker-checker control and threshold (§2.8).
8. Name a concrete hosting platform and resolve the infra/Kubernetes folder question (§2.11/§2.21).

### 9.3 Medium Priority
9. Add the 7 missing UI specs to `DESIGN_SYSTEM.md` (§8).
10. Merge the four new AI features into `ARCHITECTURE.md` §21's roadmap (§2.11/§2.20).
11. Add the two missing endpoints (`GET /admin/campaigns`, `POST /auth/verify-email/resend`) and the MFA endpoint set formally into `API_SPECIFICATION.md`.
12. Resolve `saved_searches`/`recent_searches` schema approach (shared gap across public Discover and CRM search).

### 9.4 Low Priority
13. Standardize "Guest" vs. "public" terminology.
14. Add a `reverses_transaction_id` self-reference to `wallet_transactions` for refund traceability.
15. Note explicitly in `PROJECT_SETUP.md` that `apps/mobile` and an AI/ML provider are intentionally deferred, not forgotten.
16. Create `docs/CHANGELOG.md` (already flagged as a dependency in `PROJECT_SETUP.md` §15.3).

---

## 10. Document Amendments Required

| Document | Section | Reason | Impact | Priority |
|---|---|---|---|---|
| `AUTHENTICATION.md` | §2, §3, §6–10 | Supabase Auth supersedes custom credential/session mechanics | High — blocks all auth implementation | Critical |
| `DATABASE_ARCHITECTURE.md` | §2 | `users`/`sessions`/`refresh_tokens`/`oauth_accounts` redefinition per Supabase Auth | High — blocks schema/migration work | Critical |
| `DATABASE_ARCHITECTURE.md` | §16 | GDPR anonymization must target `auth.users` via Supabase Admin API, not just `public.users` | Medium — legal/compliance correctness | High |
| `DATABASE_ARCHITECTURE.md` | §12 | `payments.processor` enum missing `razorpay` | Low effort, blocks correct payments schema | Critical |
| `DATABASE_ARCHITECTURE.md` | §8, §10, §4, §2 | Six CRM-flagged schema gaps (status enums, attachment columns, IP/device columns, `expires_at`) | Medium — blocks specific CRM/moderation modules | High |
| `API_SPECIFICATION.md` | §7, §2 | Add `GET /admin/campaigns`, `POST /auth/verify-email/resend`, MFA endpoint set | Low — documentation completeness | Medium |
| `ARCHITECTURE.md` | §21 | Merge four new AI features into the roadmap | Low — documentation completeness | Medium |
| `ARCHITECTURE.md` | §24 | Explicitly close out the two implicitly-resolved open questions | Low — documentation hygiene | Medium |
| `DESIGN_SYSTEM.md` | §7 | Add 7 missing component/page specs (§8 above) | Medium — blocks specific feature UI work | Medium |
| `PROJECT_SETUP.md` | §2, §10 | Reconcile the dropped infra/Kubernetes folder and name a concrete hosting platform | Medium — blocks Production deployment planning | High |
| `PROJECT_SETUP.md` | §1 | Explicit note on AI/ML provider and `apps/mobile` deferral | Low — documentation hygiene | Low |
| *(new)* `docs/CHANGELOG.md` | — | Doesn't exist yet, referenced by `PROJECT_SETUP.md` §14 | Low — process hygiene | Low |

---

## 11. Consolidated Founder Decisions (deduplicated, single list)

1. **Supabase Auth reconciliation** — confirm the adaptation approach in §5 before any auth code is written. *(Highest priority in this entire review.)*
2. Confirm India-inclusive launch geography (implicitly answered by choosing Razorpay).
3. Confirm JWT access-token lifetime — keep 15 minutes (requires reconfiguring Supabase's default) or adopt Supabase's default and amend `AUTHENTICATION.md` instead.
4. Confirm the 90-day absolute refresh-token ceiling (or whichever equivalent Supabase setting replaces it).
5. MFA enforcement level for Admin/Super Admin — mandatory-offer vs. hard-mandatory.
6. Which specific profile fields remain editable during `pending_review` (blocks precise profile-edit implementation — raised independently in three separate documents).
7. Failed-login audit retention policy (full retention vs. sampled/aggregated).
8. Can a single user ever hold more than one profile type (Talent *and* Hirer simultaneously)?
9. Are Followers *and* Connections both shipping, and at what phase?
10. Is Homepage/Featured Content module wanted at MVP?
11. Should Subscriptions/Plans/Coupons tables ship (dormant) in the MVP migration, or wait for a Phase-3-specific migration?
12. Exact permission bundles per named CRM role.
13. Campaign pre-publish approval — post-publish moderation only (current default) vs. requiring Admin sign-off before a campaign goes live.
14. Impersonation — confirm it ships at all, and its disclosure mechanism.
15. Manual wallet-adjustment maker-checker threshold.
16. CRM session idle-timeout duration.
17. Verification Rules configuration structure — `platform_settings` jsonb vs. a dedicated table.
18. Refund Requests — generic support ticket (current MVP default) vs. a dedicated entity now.
19. Review edit window duration.
20. Whether a `banned` account is ever reversible, and by whom.
21. Whether resubmission after **Rejected** (not just Changes Requested) is ever permitted without a Support-mediated appeal.
22. Package manager confirmation (pnpm/uv, or existing team preference).
23. Concrete hosting platform and whether Terraform/Kubernetes are still needed given managed-hosting choices (new, from this review).
24. Exact SLA-hour targets per support-ticket priority and per verification-request type.

---

## 12. Implementation Score

| Dimension | Score | Justification |
|---|---|---|
| Architecture | 90% | Coherent, scalable, internally consistent; loses points only for the stale AI roadmap and the unreconciled infra-folder drop |
| Database | 85% | Exceptionally rigorous design; loses points for ~10 small enum/column gaps and the larger structural impact of the Auth decision on `users`/`sessions` |
| Security | 80% | Strong RBAC/RLS/audit-logging design and a genuinely well-thought-out impersonation control; loses points for several unconfirmed sensitive-action policies (impersonation disclosure, maker-checker threshold, CRM idle timeout) |
| API | 85% | Comprehensive, consistent conventions applied without exception; loses points for a few endpoints specified in one document but not reflected back into `API_SPECIFICATION.md` itself |
| CRM | 85% | Thorough operational coverage of every requested workflow; loses points for the same schema gaps and several founder-decision-blocked specifics |
| Authentication | 65% | Conceptually the strongest RBAC/verification design in the set, but **as literally written, will not be the system that gets built** once Supabase Auth is adopted — this is a real, structural gap, not a minor deduction |
| Scalability | 90% | Consistent, well-reasoned scaling story from 100 to 10M users across every document, correctly carried through the Supabase-MVP interpretation |
| Maintainability | 88% | Strong doc-to-code traceability requirements (PR checklist, service-boundary-shaped monolith) and an unusually high rate of self-flagged reconciliation notes throughout — the kind of documentation that makes drift *findable*, which is exactly what this review demonstrated |
| Documentation | 92% | The highest score in this table, deservedly — seven documents, thousands of cross-references, and this review's own §2 found relatively few genuinely new issues after actively looking for them across all of it |
| Deployment Readiness | 60% | The weakest operational area — no concrete hosting platform named, `CHANGELOG.md` doesn't exist, infra story unreconciled, external accounts unprovisioned |
| **Overall Readiness** | **80%** | A strong, unusually self-aware architectural foundation with one major structural item (Auth) and a bounded, mostly-small list of amendments standing between this document set and responsible first-line-of-code |

---

## 13. GO / NO GO

## **GO WITH CHANGES**

This is not a "go back to the drawing board" situation — the architectural foundation across all seven documents is coherent, the entities are consistent, the workflows trace end-to-end, and the documentation set has already caught the overwhelming majority of its own inconsistencies before this review even started (evidenced by how much of §2's checklist resolves to "✅ already flagged" rather than "🆕 new"). But it is also not ready for a `git init` on the application code today: the Supabase Auth reconciliation is a structural change to two finalized documents that hasn't actually been written yet, only recommended (§5); a handful of database enums are stale relative to decisions made in later documents; and a short list of sensitive-action policies (impersonation, manual financial adjustments, CRM session timeout) are still open. None of these are redesigns — every one is a bounded, well-understood amendment. Close them, then begin coding with real confidence rather than provisional confidence.

---

## 14. Roadmap — Exact Next Steps Before Coding

1. **Founder decision session** covering the consolidated list in §11 — this single session likely resolves 80% of what's blocking implementation, since most items are quick founder calls, not open engineering problems.
2. **Write the Supabase Auth amendment** to `AUTHENTICATION.md` and `DATABASE_ARCHITECTURE.md` §2/§16, using §5 of this review as the specification for what changes — this is the one item that should not be batched with the smaller fixes below, because everything else in the auth/RBAC chain depends on it being settled first.
3. **Apply the small schema amendments** (§2.3's table) as one batch update to `DATABASE_ARCHITECTURE.md` — enum expansions and column additions, no structural changes, can be done in a single focused pass.
4. **Consolidate the permission-key and audit-action vocabularies** into an explicit seed-data appendix in `DATABASE_ARCHITECTURE.md` §2/§10.
5. **Add the 7 missing UI specs** to `DESIGN_SYSTEM.md` §7 and merge the 4 new AI features into `ARCHITECTURE.md` §21.
6. **Resolve the infra/hosting question** — name a concrete platform in `PROJECT_SETUP.md`, explicitly state whether Terraform/Kubernetes are still needed at MVP scale.
7. **Create `docs/CHANGELOG.md`** and record every amendment made in steps 2–6 as its first entries — establishing the practice from day one rather than retrofitting it later.
8. **Only then**, begin `PROJECT_SETUP.md` §15.5's recommended first coding milestone: the reconciled identity/RBAC foundation, built and tested end-to-end, before any product feature is built on top of it.

---

*End of cross-document review. No prior document was modified in producing this analysis.*
