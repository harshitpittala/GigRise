# GigRise — Software Architecture Blueprint
**Version 1.1 — Amended: §15 Authentication synced to Supabase Auth decision**
**Prepared by:** Chief Software Architect / Principal Engineer
**Status:** Pre-implementation. No code has been written against this document yet. **v1.1 updates §15's authentication bullet points only** — everything else in this document is unchanged from v1.0. See `CHANGELOG.md` and `DECISIONS.md` ADR-001/ADR-017 for the full reasoning; `AUTHENTICATION.md` v2.0 remains the authoritative, fully-detailed specification this section only summarizes.

---

## 0. How to Read This Document

This is the single source of truth for GigRise's system design. It exists so that every future engineering decision — schema, endpoint, component, folder — has a clear parent decision to trace back to. Sections are ordered so that product intent (1–6) precedes structure (7–14) which precedes systems (15–21) which precedes operations (22–24).

Nothing below is final. It is the *first coherent draft* — the point of writing it all down in one place is to find contradictions before they're encoded in a database schema. Flag anything that looks wrong before implementation begins.

---

## 1. Product Vision

GigRise is the professional operating system for the creator and casting economy. Today, a UGC creator or actor stitches together LinkedIn (identity + network), Fiverr/Upwork (gig discovery + payment), Actors Access/Casting Networks (casting-specific workflows), and Behance (portfolio) — four disconnected surfaces, four disconnected reputations, four sets of login credentials.

GigRise unifies **professional identity, portfolio, discovery, negotiation, hiring, and payment** for two categories of talent (Creators, Actors) and two categories of hirers (Brands, Casting Directors) inside one premium, verified, trust-first network.

The wedge is **verification + trust**. Anyone can list themselves as a "creator" on Instagram. On GigRise, a verified badge means a human (or an AI-assisted reviewer) has checked identity, portfolio authenticity, and professional history. That trust layer is the moat — it's what lets a Brand hire an Actor sight-unseen and lets escrowed payment feel safe to both sides.

**One-sentence pitch:** LinkedIn's trust and network effects, Upwork's hiring and payment rails, Behance's visual portfolio, purpose-built for people who get hired because of how they look, sound, perform, or create — not just what they can code.

---

## 2. Platform Goals

| Goal | Definition of Done |
|---|---|
| **Trust-first identity** | Every professional profile is either Verified, Pending, or Rejected — never ambiguous. |
| **Two-sided liquidity** | Enough Creators/Actors that Brands find who they need in <5 searches; enough Brands/Directors that talent gets hired within 30 days of profile completion. |
| **Frictionless hiring loop** | Discover → Message → Hire → Pay → Review takes place without leaving the platform. |
| **Premium perception** | Every screen should read as enterprise-grade — this is a professional tool, not a social app. Visual language must never feel like a marketplace bargain-bin. |
| **Scale-ready from day one** | Architecture must not require a rewrite between 100 users and 10M users (see §23). Only capacity, not design, should change. |
| **Global payments-ready** | Wallet + escrow model must support multi-currency and split payouts from the outset, even if only one payment rail ships in MVP. |
| **AI-augmented, not AI-dependent** | AI accelerates verification, matching, and content generation, but the platform must be fully functional with AI features switched off. |

---

## 3. User Roles

| Role | Core Need | Primary Surface |
|---|---|---|
| **Creator** (UGC, content, influencer) | Get discovered, showcase portfolio, get hired for content/campaign work | Creator Dashboard, Portfolio, Campaign Marketplace |
| **Actor** | Get cast, submit for roles, manage reels/headshots/resume | Actor Dashboard, Casting Calls, Submissions |
| **Brand** | Find talent, run campaigns, manage contracts & payments | Brand Dashboard, Campaign Manager, CRM-lite (their own hires) |
| **Casting Director** | Post roles, review submissions, shortlist, book talent | Director Dashboard, Casting Call Manager, Submission Review |
| **Admin** | Day-to-day moderation: verification review, support tickets, content flags | Admin CRM |
| **Super Admin** | Platform-wide config: role management, financial oversight, system health, feature flags | Super Admin Console |

**Design principle:** Creator and Actor share ~80% of data model and UI (both are "Talent" at the schema level with a `talent_type` discriminator). Brand and Casting Director share ~80% (both are "Hirer" with a `hirer_type` discriminator). This is why sections 9 (Database) and 14 (Components) model them as two base entities with type-specific extensions, not four fully separate stacks.

---

## 4. Complete User Journey

```
LANDING PAGE
   │  (role-aware CTA: "Join as Talent" / "Join as Hirer")
   ▼
SIGNUP
   │  Email/OAuth capture → role selection → base profile fields
   ▼
VERIFICATION
   │  Identity doc (Talent) or Business proof (Hirer) + portfolio/company links
   │  submitted to verification queue (status: PENDING)
   ▼
APPROVAL (Admin CRM)
   │  Admin reviews → APPROVED / REJECTED / CHANGES_REQUESTED
   │  Rejected/Changes-Requested loops back to user with reason (re-submit allowed)
   ▼
DISCOVER
   │  Approved users unlock Search, Explore feed, Campaign/Casting-call boards
   │  Talent: browse Campaigns/Casting Calls. Hirer: browse Talent, post Calls.
   ▼
MESSAGING
   │  Hirer initiates OR Talent applies → thread opens → negotiation happens in-chat
   ▼
HIRING
   │  Hirer sends Offer (scope, rate, deliverable, deadline) → Talent Accepts/Counters
   │  Accepted offer creates a Contract (state machine: Offered → Accepted → In Progress → Delivered → Completed)
   ▼
PAYMENTS
   │  Hirer funds Escrow at contract acceptance → Talent delivers → Hirer releases
   │  → Funds move Escrow → Talent Wallet → Payout to bank/card
   ▼
REVIEWS
   │  Both sides leave a rating + review, visible on public profile, tied to the Contract (no review without a completed contract)
   ▼
REPEAT HIRING
   │  Hirer's "Past Collaborators" list surfaces prior Talent for one-click re-engagement
   │  Talent's profile accrues a "Repeat Hire Rate" trust signal
   └──────────────────────────────────────────────────────────────────┘
                    (loop back into Discover / Messaging)
```

**Key state machine — Verification status** (applies to both Profile and, later, to individual Portfolio items):
`DRAFT → PENDING_REVIEW → APPROVED | REJECTED | CHANGES_REQUESTED`
`CHANGES_REQUESTED → (user edits) → PENDING_REVIEW` (loop)
`REJECTED` is terminal but appealable via Support (creates a new review ticket, not a state transition).

**Key state machine — Contract:**
`DRAFT (offer sent) → ACCEPTED → FUNDED (escrow) → IN_PROGRESS → DELIVERED → COMPLETED (released) | DISPUTED → RESOLVED`

---

## 5. Feature List by Phase

### MVP (Launch-blocking)
- Auth (email + Google/Apple OAuth), role selection, session management
- Profile creation for all 4 talent/hirer types + type-specific fields
- Verification submission + Admin approval queue (manual review)
- Portfolio upload (images, short video, links) with basic compression
- Search & filter (skills, location, category, verified-only toggle)
- Campaign posting (Brand) / Casting Call posting (Director)
- Applications & Invitations (Talent applies to Call; Hirer invites Talent)
- 1:1 Messaging (text, image attachment, read receipts)
- Offer → Contract flow (manual milestone, single deliverable)
- Payments: escrow-lite (hold on platform, manual release) via one payment processor
- Reviews & ratings (post-contract only)
- Notifications: email + in-app
- Admin CRM: verification queue, user management, basic reports
- Basic public profile pages (SEO-indexable)

### Phase 2
- Multi-milestone contracts with partial releases
- Team/Agency accounts (an Agency manages multiple Actor profiles; a Brand has multiple seats/roles)
- Advanced search (Elasticsearch-backed, saved searches, talent alerts)
- Push notifications (mobile web + native shell)
- Voice notes & video messages in chat
- Typing indicators, presence ("online now")
- Wallet with withdrawal to multiple payout methods, invoicing/tax docs
- Campaign analytics dashboard for Brands (views, applications, conversion)
- Public company pages for Brands (like LinkedIn Company Pages)
- Dispute resolution workflow with evidence upload
- Referral program
- Mobile apps (React Native) sharing the same API

### Phase 3
- Agency/Team collaboration tools (shared inbox, role-based permissions within an org)
- Marketplace "Packages" (Fiverr-style fixed-price gig listings, not just campaign-driven)
- Advanced CRM automation (auto-tagging leads, saved pipelines per Brand)
- Video interview scheduling + in-platform video calls
- Subscription tiers (Pro Talent, Pro Brand) with premium placement / boosted search
- API access for enterprise Brands (bulk casting calls, ATS-style integrations)
- Internationalization (multi-language UI, multi-currency wallets at full fidelity)

### Future AI Features
- **Profile Review AI** — flags incomplete/suspicious profiles pre-human-review, drafts rejection reasons for admin to approve
- **Portfolio Review AI** — detects stock footage/reused content, verifies video authenticity signals
- **Creator/Actor Matching AI** — ranks talent against a Brand's brief using embeddings over portfolio + past-work outcomes
- **Campaign Suggestion AI** — recommends campaign structure/budget to Brands based on comparable past campaigns
- **Proposal Generator** — drafts a Talent's application message from their profile + the Call's brief
- **Resume/Reel Generator** — auto-assembles a one-page resume or 30-second reel highlight from a Talent's existing portfolio assets

---

## 6. Website Pages

**Public (unauthenticated)**
- `/` Landing
- `/login`, `/signup`, `/signup/verify-email`, `/forgot-password`, `/reset-password`
- `/talent/:handle` Public Creator/Actor profile
- `/company/:handle` Public Brand/Studio profile (Phase 2)
- `/casting-calls/:id` Public casting call preview (gated apply)
- `/pricing`, `/about`, `/trust-and-safety`, `/terms`, `/privacy`, `/help`

**Onboarding**
- `/onboarding/role` (choose Creator/Actor/Brand/Director)
- `/onboarding/profile` (multi-step form, role-specific)
- `/onboarding/verification` (document/portfolio submission)
- `/onboarding/pending` (waiting-for-approval holding page)

**Authenticated — shared**
- `/feed` (Discover/Explore home)
- `/search` (talent or campaign search depending on role)
- `/messages`, `/messages/:threadId`
- `/notifications`
- `/settings/profile`, `/settings/account`, `/settings/billing`, `/settings/notifications`, `/settings/privacy`
- `/wallet` (Phase 2 full version; MVP shows balance + history)

**Talent-specific**
- `/dashboard` (Creator/Actor home)
- `/profile/edit`
- `/portfolio/manage`
- `/campaigns` (browse), `/campaigns/:id`
- `/casting-calls` (browse), `/casting-calls/:id/apply`
- `/contracts`, `/contracts/:id`
- `/applications` (my submissions/status)

**Hirer-specific**
- `/dashboard` (Brand/Director home)
- `/company/edit` (Brand) / `/studio/edit` (Director)
- `/campaigns/new`, `/campaigns/manage`, `/campaigns/:id/applicants`
- `/casting-calls/new`, `/casting-calls/manage`, `/casting-calls/:id/submissions`
- `/talent/discover` (search-first talent browser)
- `/contracts`, `/contracts/:id`
- `/collaborators` (past-hire list, Phase 2)

**Admin**
- `/admin` (CRM home / queue overview)
- `/admin/verification` (Pending / Approved / Rejected / Changes Requested tabs)
- `/admin/users`, `/admin/users/:id`
- `/admin/reports` (flagged content/users)
- `/admin/support` (ticket queue)
- `/admin/analytics`
- `/admin/audit-logs`

**Super Admin**
- `/super-admin/roles-permissions`
- `/super-admin/feature-flags`
- `/super-admin/financials` (platform-wide payment health)
- `/super-admin/system-health`
- `/super-admin/admins` (manage admin accounts themselves)

---

## 7. Dashboard Structure

**Creator / Actor Dashboard**
- Header stat row: Profile Views · Applications Sent · Active Contracts · Wallet Balance
- "Continue where you left off" (draft applications, unread messages)
- Recommended Campaigns/Casting Calls (algorithmic, Phase 2 AI-ranked)
- Verification/profile completeness meter
- Recent activity timeline

**Brand Dashboard**
- Header stat row: Active Campaigns · Total Applicants · Active Contracts · Spend This Month
- Campaign performance cards (views/applications per campaign)
- Talent recommendations for open campaigns
- Pending offers awaiting talent response

**Casting Director Dashboard**
- Header stat row: Open Calls · Submissions Pending Review · Shortlisted · Booked
- Submission review queue (swipe/shortlist UI, Behance-meets-ATS feel)
- Calendar of casting deadlines

**Admin Dashboard**
- Queue depth widgets: Verification Pending, Support Open, Reports Open
- SLA timers (oldest pending item age)
- Team workload distribution (which admin is handling what)

**Super Admin Dashboard**
- Platform KPIs: DAU/MAU, GMV, take-rate revenue, verification approval rate, contract completion rate
- System health (API latency, error rate, queue backlogs — pulled from observability stack)
- Financial reconciliation summary

---

## 8. CRM Architecture

The Admin CRM is the operational backbone — this is where trust gets manufactured.

**Core modules:**

1. **Verification Pipeline**
   - Tabs: `Pending` → `In Review` → `Approved` / `Rejected` / `Changes Requested`
   - Each item: submitted documents, portfolio snapshot, AI pre-screen score (Phase 2+), reviewer notes, decision + reason (required on reject/changes-requested)
   - SLA clock per item; auto-escalation if unreviewed > 48h

2. **User Management**
   - Full user record: profile, verification history, contracts, reports filed against/by them, account status (Active/Suspended/Banned)
   - Bulk actions: suspend, message, export

3. **Reports & Moderation**
   - User-submitted reports (content, behavior, payment disputes) land here
   - Linked to the relevant Contract/Message/Profile for context
   - Resolution actions: dismiss, warn, suspend, escalate to dispute resolution

4. **Support Desk**
   - Ticket queue (category, priority, SLA)
   - Macros/canned responses
   - Linked to user record for full context without tab-switching

5. **Role Management**
   - Assign/revoke Admin vs Super Admin
   - Scoped permissions (e.g., an Admin can approve verifications but not touch financials) — see RBAC in §15

6. **Audit Logs**
   - Immutable, append-only log of every state-changing admin action: who, what, when, before/after values
   - Required for: verification decisions, financial adjustments, account suspensions, role changes
   - Never manually editable, exposed read-only even to Super Admin

7. **Analytics & Reports**
   - Cohort growth, funnel conversion (signup → verified → first hire), GMV trends, category-level supply/demand imbalance (e.g., "not enough verified actors in Mumbai for demand")

**Architectural note:** CRM is a *permission-scoped view over the same core database*, not a separate system. There's one `users`, one `contracts` table, etc. — the CRM just has privileged read/write access and its own audit-logged action layer. This avoids the classic mistake of building a shadow "admin database" that drifts from production truth.

---

## 9. Database Planning (Entities & Relationships)

No SQL yet — this is the entity-relationship map.

**Identity Cluster**
- `User` — base identity: email, auth credentials/OAuth links, role, account status. 1:1 with exactly one of `TalentProfile` or `HirerProfile`.
- `TalentProfile` — shared fields for Creator/Actor: display name, bio, location, categories/skills, `talent_type` (creator | actor), verification status. 1:1 with `User`.
- `HirerProfile` — shared fields for Brand/Director: company name, industry, `hirer_type` (brand | casting_director), verification status. 1:1 with `User`.
- `VerificationRequest` — 1:many from `TalentProfile`/`HirerProfile` (a profile can be re-submitted after rejection, so history matters). Holds submitted docs, status, reviewer, decision reason.
- `AgencyAccount` (Phase 2) — many:many with `TalentProfile`/`HirerProfile` via `AgencyMembership`, for teams managing multiple profiles.

**Portfolio Cluster**
- `PortfolioItem` — many:1 to `TalentProfile`. Type (image/video/link), media reference, moderation status.
- `MediaAsset` — many:1 to `PortfolioItem` (an item can have multiple renditions: original, compressed, thumbnail). Holds CDN URL, storage key, processing status.

**Discovery Cluster**
- `Campaign` — many:1 to `HirerProfile` (Brand). Brief, budget range, deliverables, status (draft/open/closed).
- `CastingCall` — many:1 to `HirerProfile` (Director). Role brief, requirements, audition instructions, status.
- `Application` — many:1 to `TalentProfile`, many:1 to `Campaign` OR `CastingCall` (polymorphic target). Status (submitted/shortlisted/rejected/hired).

**Engagement Cluster**
- `Conversation` — many:many `User` via `ConversationParticipant`.
- `Message` — many:1 to `Conversation`. Content, attachments, read receipts (`MessageReadReceipt`).
- `Offer` — many:1 to `Conversation` (offers are sent inside a thread), references `TalentProfile` + `HirerProfile`, links optionally to `Campaign`/`CastingCall`/`Application`. Terms: scope, rate, deadline, milestones.
- `Contract` — 1:1 with an accepted `Offer`. State machine status, links to `Milestone[]`.
- `Milestone` — many:1 to `Contract`. Deliverable description, amount, status.

**Financial Cluster**
- `Wallet` — 1:1 with `TalentProfile`/`HirerProfile`. Balance, currency.
- `Transaction` — many:1 to `Wallet`. Type (deposit/escrow-hold/escrow-release/payout/fee), amount, related `Contract`/`Milestone`.
- `EscrowHold` — 1:1 with `Milestone` (or `Contract` for single-deliverable MVP). Amount, funded-at, released-at.
- `Invoice` (Phase 2) — many:1 to `Contract`, generated on completion.
- `PayoutMethod` — many:1 to `Wallet` (bank account/card token — via processor, never raw data stored).

**Trust Cluster**
- `Review` — 1:1 with a completed `Contract`, bidirectional (Talent→Hirer and Hirer→Talent as two rows sharing a `contract_id`). Rating, text, visibility.
- `Report` — many:1 to reporting `User`, polymorphic target (User/Message/Contract/PortfolioItem). Status, resolution.
- `AuditLogEntry` — many:1 to acting `User` (admin), polymorphic target, before/after snapshot, timestamp. Append-only.

**Platform Cluster**
- `Notification` — many:1 to `User`. Type, payload, read status, channel (email/in-app/push).
- `SupportTicket` — many:1 to `User`, many:1 to assigned `Admin`. Category, priority, status.
- `FeatureFlag` (Super Admin) — key, rollout rules, no direct FK (global config).

**Key relationship principles:**
- Every financially-relevant state transition (`Contract`, `Milestone`, `Transaction`) is append-only/event-sourced-friendly — never destructively overwritten, so disputes and audits have full history.
- Polymorphic associations (`Application.target`, `Report.target`) use a `target_type` + `target_id` pair rather than nullable FKs to every possible table — keeps referential integrity checks centralized in application logic (or DB triggers) rather than schema sprawl.
- `TalentProfile`/`HirerProfile` splitting from `User` (rather than one giant `users` table with 40 nullable role-specific columns) is deliberate: it keeps role-specific logic isolated and makes adding a 5th role (e.g., "Agency" as a first-class role in Phase 2) additive, not a migration of every existing row.

---

## 10. API Planning

**Style:** REST over HTTPS, JSON payloads, resource-oriented. GraphQL is not adopted for v1 — REST keeps the CRM/mobile/web surface predictable and cacheable at the CDN/gateway layer; revisit only if aggregation queries become a proven pain point.

**Naming conventions**
- Plural nouns, kebab-case in paths: `/api/v1/talent-profiles`, `/api/v1/casting-calls`
- Nested resources reflect true ownership only, max 2 levels deep: `/api/v1/casting-calls/:id/submissions`, not 4-deep chains
- Actions that aren't pure CRUD are modeled as sub-resources/verbs sparingly: `POST /api/v1/offers/:id/accept`, `POST /api/v1/contracts/:id/release-milestone`
- Query params for filtering/search/pagination: `?category=actor&location=mumbai&verified=true&page=2&limit=20`
- Consistent envelope: `{ data, meta: { pagination }, errors: [] }`

**Authentication flow**
- Signup/login issues a short-lived **access token (JWT, 15 min)** + long-lived **refresh token (httpOnly, secure cookie, 30 days, rotating)**
- OAuth (Google/Apple) exchanges provider token server-side for the same JWT pair — one identity system regardless of login method
- Every request: `Authorization: Bearer <access_token>`; refresh endpoint `/api/v1/auth/refresh` rotates both tokens
- Service-to-service (e.g., worker → core API) uses signed internal service tokens, never the user JWT

**Authorization**
- JWT carries `user_id`, `role`, `verification_status` claims
- Every endpoint declares required role(s) + resource-ownership check (middleware layer, not scattered in-handler checks) — see RBAC in §15

**Versioning**
- URL-based: `/api/v1/...`. Breaking changes ship as `/api/v2/...` with v1 kept alive on a documented deprecation timeline (minimum 6 months overlap)
- Additive changes (new optional fields, new endpoints) never bump the version

**Core endpoint groups (illustrative, not exhaustive):**
```
/api/v1/auth/*                     signup, login, refresh, logout, oauth callbacks
/api/v1/users/me                   current user identity
/api/v1/talent-profiles/*          CRUD + search
/api/v1/hirer-profiles/*           CRUD + search
/api/v1/verification-requests/*    submit, status, (admin) review
/api/v1/portfolio-items/*          CRUD, upload-url issuance
/api/v1/campaigns/*                CRUD, browse
/api/v1/casting-calls/*            CRUD, browse
/api/v1/applications/*             apply, withdraw, status updates
/api/v1/conversations/*            list, create
/api/v1/conversations/:id/messages send, list (paginated, cursor-based)
/api/v1/offers/*                   create, accept, counter, decline
/api/v1/contracts/*                lifecycle, milestones
/api/v1/wallet, /api/v1/transactions
/api/v1/reviews/*
/api/v1/notifications/*
/api/v1/admin/*                    scoped to Admin/Super Admin role
```

**Real-time (not REST):** Messaging, typing indicators, notifications use a separate WebSocket gateway (`wss://realtime.gigrise.com`) authenticated via the same JWT — REST handles state, WebSocket handles push (see §18–19).

---

## 11. Folder Structure

Monorepo, since Talent/Hirer web, Admin CRM, and mobile (Phase 2) all consume the same API contracts and design tokens.

```
gigrise/
├── apps/
│   ├── web/                      # Main Talent/Hirer web app (Next.js)
│   │   ├── app/                  # Route segments (App Router)
│   │   ├── components/           # App-specific components (not shared)
│   │   ├── features/             # Feature-sliced modules (messaging, campaigns, contracts...)
│   │   ├── hooks/
│   │   ├── services/             # API client calls, scoped per domain
│   │   └── styles/
│   ├── admin/                    # Admin/Super Admin CRM (separate deploy, shared auth)
│   │   ├── app/
│   │   ├── features/             # verification-queue, user-management, audit-logs...
│   │   └── ...
│   └── mobile/                   # Phase 2 — React Native, shares packages/*
│
├── services/
│   ├── api-gateway/               # Edge auth, rate limiting, routing to services
│   ├── core-api/                  # Users, profiles, campaigns, applications, contracts
│   ├── messaging-service/         # Conversations, messages, WebSocket gateway
│   ├── payments-service/          # Wallet, escrow, transactions, payout integration
│   ├── media-service/             # Upload handling, transcoding, CDN publishing
│   ├── notification-service/      # Email/push/in-app dispatch, template rendering
│   ├── search-service/            # Search indexing + query (Elasticsearch client)
│   └── ai-service/                # Matching, review-assist, generation features (Phase 3+)
│
├── packages/
│   ├── ui/                        # Design-system component library (buttons, cards, inputs...)
│   ├── types/                     # Shared TypeScript types/interfaces (User, Contract, Offer...)
│   ├── config/                    # Shared eslint/tsconfig/tailwind config
│   ├── api-client/                # Typed fetch client generated from OpenAPI spec
│   ├── utils/                     # Pure helper functions (formatting, validation)
│   └── constants/                 # Enums, route paths, role definitions
│
├── infra/
│   ├── terraform/                 # Cloud infra as code
│   ├── docker/
│   └── k8s/                       # Manifests/Helm charts per service
│
├── docs/
│   └── ARCHITECTURE.md            # This document
│
└── scripts/                       # Codegen, migration runners, seed data
```

**Rule:** `packages/*` never imports from `apps/*` or `services/*` — dependency direction is strictly one-way inward. `services/*` never import each other's internals directly; cross-service calls go through defined API contracts (HTTP or message queue), never shared database access.

---

## 12. Design System

**Typography**
- Primary typeface: a humanist grotesque (e.g., Inter or a licensed equivalent) for UI; a distinct serif or refined display face reserved for marketing/landing headlines only — this is what separates "premium" from "generic SaaS."
- Scale: modular, 8 steps (12/14/16/18/20/24/32/40px), consistent line-height ratio (1.4 body, 1.2 headings)

**Spacing & Grid**
- 8px base unit, all spacing in multiples of 4/8
- 12-column responsive grid, max content width 1280px, gutters scale from 16px (mobile) to 32px (desktop)

**Colors**
- Neutral-dominant palette (charcoal/graphite/off-white) as the base — premium reads as restrained, not colorful
- One confident brand accent color for primary actions and verified badges
- Semantic colors: success (approval/verified), warning (pending/changes requested), danger (rejected/disputed) — kept desaturated enough to feel professional, not alarm-red
- Full light/dark theme support from day one (token-based, not hardcoded hex in components)

**Icons**
- Single icon set throughout (outline style primary, filled for active/selected states) — never mix icon families

**Buttons**
- Primary / Secondary / Tertiary(text) / Destructive — consistent height scale (sm/md/lg), loading state built into the component (spinner replaces label, width doesn't jump)

**Cards**
- Talent card, Campaign card, Contract card, Message-preview card — all share one base `Card` primitive with slot-based content, so visual consistency is structural, not a matter of remembering to copy styles

**Animations**
- Purposeful only: page-transition fade (150ms), hover elevation on cards (subtle shadow, not scale-bounce), skeleton shimmer on load. No decorative motion — premium restraint over flashiness.

**Loading States**
- Skeleton screens matching final content layout (never a centered spinner on content-heavy pages)
- Inline spinners only for button actions

**Empty States**
- Every list/feed has a designed empty state with a clear next action ("No applicants yet — share your casting call" not just "No data")

**Error States**
- Distinguish network error (retry action) vs. validation error (inline, field-level) vs. permission error (explain + redirect) — never a bare "Something went wrong"

---

## 13. UI Principles

1. **Professional over playful.** Every surface should feel like it belongs in a hiring decision, not a social feed. Inspired by LinkedIn's density and restraint — not its visual identity.
2. **Minimal chrome, maximum content.** Navigation and controls recede; portfolios, profiles, and campaign briefs are the visual focus.
3. **Predictable navigation.** Persistent top nav (Search, Messages, Notifications, Profile) + role-aware left sidebar for dashboard sections — same skeleton across every authenticated page.
4. **Progressive disclosure.** Complex flows (verification, contract creation) are stepped, never single giant forms.
5. **Responsive by default, mobile-complete.** Not a desktop app with a shrunk mobile view — every core flow (apply, message, accept offer) must work fully on mobile web.
6. **Trust signals are structural, not decorative.** Verified badges, response-time indicators, completion rates appear in the same location everywhere they're relevant — consistency builds the trust the badge itself represents.

---

## 14. Component Library

**Layout/Nav**
`AppShell`, `TopNav`, `Sidebar`, `PageHeader`, `Breadcrumbs`, `TabBar`, `Footer` (marketing only)

**Identity/Profile**
`Avatar`, `VerifiedBadge`, `ProfileCard` (compact), `ProfileHeader` (full page), `SkillTagList`, `ProfileCompletenessMeter`, `StatBlock`

**Portfolio**
`PortfolioGrid`, `PortfolioItemCard`, `MediaViewer` (image/video lightbox), `UploadDropzone`, `MediaProcessingIndicator`

**Discovery**
`SearchBar`, `FilterPanel`, `SearchResultList`, `CampaignCard`, `CastingCallCard`, `EmptyState`

**Forms**
`TextField`, `TextArea`, `Select`, `MultiSelect`, `DatePicker`, `FileUpload`, `FormStepper`, `FormError`, `RadioGroup`, `Checkbox`, `Toggle`

**Actions/Feedback**
`Button`, `IconButton`, `Modal`, `Drawer`, `Toast`, `ConfirmDialog`, `Tooltip`, `Badge`, `StatusPill` (pending/approved/rejected/disputed etc.)

**Messaging**
`ConversationList`, `ConversationListItem`, `MessageThread`, `MessageBubble`, `MessageComposer`, `TypingIndicator`, `ReadReceipt`, `VoiceNotePlayer`

**Commerce**
`OfferCard`, `ContractTimeline`, `MilestoneList`, `WalletBalanceCard`, `TransactionRow`, `EscrowStatusBadge`, `PayoutMethodCard`

**Reviews/Trust**
`RatingStars`, `ReviewCard`, `ReviewSummary`, `ReportDialog`

**Admin/CRM-specific**
`QueueTable`, `VerificationReviewPanel`, `AuditLogRow`, `SLATimer`, `AnalyticsChartCard`, `UserRecordPanel`, `TicketCard`

**Data/Loading**
`SkeletonBlock`, `DataTable` (sortable/paginated, shared by Admin CRM and Brand analytics), `Pagination`, `InfiniteScrollList`

---

## 15. Security

**Authentication**
- Identity provider: Supabase Auth (`AUTHENTICATION.md` v2.0, `DECISIONS.md` ADR-001) — owns credential storage, password hashing (bcrypt), session issuance, and OAuth exchange; GigRise builds none of this directly. **Amended from this section's original "Argon2id" specification** — see `DECISIONS.md` ADR-017 for the explicit reasoning behind accepting bcrypt as a consequence of the Supabase Auth decision.
- OAuth via Google/Apple using standard OIDC flows, handled by Supabase Auth — no custom token parsing in GigRise code
- MFA (TOTP) optional at MVP, mandatory-offer for Admin/Super Admin accounts — native Supabase Auth MFA, not custom-built (`AUTHENTICATION.md` §10.5)

**Authorization (RBAC)**
- Roles: `talent`, `hirer`, `admin`, `super_admin`, with `talent_type`/`hirer_type` as sub-discriminators, not separate permission sets
- Permissions are resource-action pairs (`verification:review`, `financials:view`, `users:suspend`) grouped into roles — Super Admin can grant an Admin a subset (e.g., verification-only admin), never the reverse
- Every mutating endpoint checks both role permission AND resource ownership (a Brand can only edit *its own* campaign, enforced at query layer via `WHERE hirer_id = :current_user`, never trusted from client payload)

**Session Handling**
- Access token short-lived (15 min), refresh token httpOnly+secure+sameSite cookie, rotated on use, revocable server-side (refresh token table with revocation flag — supports "log out all devices")
- Idle timeout + absolute session expiry both enforced

**Rate Limiting**
- Per-IP and per-user limits at the API gateway, stricter on auth endpoints (login, signup, password reset) to blunt credential stuffing
- Per-endpoint budgets for expensive operations (search, media upload) separate from general API budget

**Audit Logs**
- Every Admin/Super Admin action that changes state is written to the immutable `AuditLogEntry` table (see §9) — this is a security control as much as an operational one; it's how insider misuse gets caught
- Financial transactions get an additional signed, tamper-evident log (hash-chained entries) given payment-dispute liability

**Additional**
- All traffic TLS-only, HSTS enforced
- Secrets in a managed vault (never in env files committed to the repo), rotated on schedule
- Input validation at the API boundary (schema validation, e.g., JSON Schema/Zod) before anything touches business logic — never trust client-side validation alone
- File uploads scanned for malware before entering the media pipeline; strict content-type allowlists

---

## 16. File Upload Architecture

**Flow:** Client requests a signed upload URL from `media-service` → uploads directly to object storage (bypassing the app server for the heavy bytes) → `media-service` receives a completion webhook → kicks off async processing.

- **Images:** Resized into a standard set of renditions (thumbnail, card, full) on upload; served via CDN with on-the-fly format negotiation (WebP/AVIF where supported, JPEG fallback)
- **Videos:** Uploaded to a staging bucket → transcoding job (multiple resolutions + a compressed preview clip for feed/card previews) → published to CDN only after transcode succeeds; original retained in cold storage for re-processing needs
- **Documents** (verification IDs, business proof): Uploaded to a private, access-controlled bucket — never CDN-public, never in the same bucket as portfolio media; access requires a short-lived signed URL issued only to authorized Admin sessions
- **Compression:** Automated at ingestion (images via standard resize/re-encode pipeline; video via adaptive-bitrate transcode), never relying on the client to pre-compress
- **Storage:** Tiered — hot bucket for actively-served media, cold/archive tier for originals and rejected/inactive verification documents (cost control at scale)
- **CDN:** All public media (portfolio, avatars) served through a CDN with long cache TTL + versioned URLs (cache-bust via filename/hash, not query param, for reliable edge caching)

---

## 17. Search Architecture

Search is a **dedicated service** (`search-service`), not queries against the primary transactional database — protects write-path performance as catalog size grows and allows relevance tuning independent of schema.

- Primary datastore (Postgres) remains source of truth; a change-data-capture pipeline (or application-level dual-write with an outbox pattern) keeps the search index in sync
- Search engine: Elasticsearch/OpenSearch-class document store, one index family per searchable entity

**Creator Search / Actor Search**
- Facets: category/skill, location (radius-aware), verified-only, price range, availability, rating
- Ranking: text relevance blended with trust signals (verification status, response rate, completion rate) — never pure recency or pure keyword match, since trust is the product's differentiator
- Phase 3: embedding-based semantic search layered on top ("actors who can do a believable British accent" matching profile text + reel transcripts)

**Campaign Search**
- Facets: category, budget range, deadline, remote/on-location
- Talent-facing ranking factors in profile-fit (skills overlap) once matching AI ships

**Company/Brand Search** (Phase 2, once public company pages exist)
- Facets: industry, size, active campaigns
- Primarily supports Talent researching a Hirer before applying

**Cross-cutting:** All search indices exclude non-approved (`PENDING`/`REJECTED`) profiles and closed listings by default — visibility rules are enforced at the index-population layer, not just the query layer, so a bug in query filters can't leak unverified profiles into public search.

---

## 18. Notification Architecture

Centralized `notification-service` receives events from all other services (never each service sending emails/pushes directly) — one place to manage templates, throttling, and user preferences.

- **Event intake:** other services publish domain events (`offer.created`, `contract.completed`, `verification.approved`) to a message queue; `notification-service` consumes and fans out per user preference
- **Email:** Transactional email provider, templated (verification decisions, offer received, payment released, weekly digest)
- **In-App:** Persisted `Notification` records, read/unread state, surfaced via the notification bell + a dedicated `/notifications` page
- **Push:** Web push (Phase 2) + native push (Phase 2 mobile) for time-sensitive events (new message, offer response, casting call deadline)
- **Real-Time:** In-app notification badges update via the same WebSocket connection used for messaging (see §19) rather than polling
- **Preferences:** Per-category opt-in/out (marketing vs. transactional) — transactional/security notifications are never fully disable-able, only channel-switchable

---

## 19. Messaging Architecture

Dedicated `messaging-service` with its own datastore optimized for conversation/message access patterns (high write volume, time-ordered reads), separate from the core transactional database.

- **Chats:** Conversations scoped to exactly one Talent + one Hirer initially (group/team threads are Phase 3 with Agency accounts)
- **Media:** Images/short clips sent in-chat go through the same upload pipeline as portfolio media (§16) but land in a chat-scoped, access-controlled bucket
- **Voice Notes (Phase 2):** Recorded client-side, uploaded as compressed audio, waveform generated server-side for the player UI
- **Read Receipts:** Per-message, per-participant read timestamp; delivered via WebSocket event, persisted for reconnect/resume
- **Typing Indicators (Phase 2):** Ephemeral WebSocket-only signal, not persisted — ok to lose on reconnect
- **Delivery guarantees:** Messages persisted server-side before acknowledgment to sender; WebSocket is the fast path for real-time delivery, REST fetch is the reliable fallback/catch-up path on reconnect (offline-safe by design)
- **Moderation hook:** Automated content scanning (spam/abuse patterns, off-platform payment solicitation — a common marketplace leakage risk) runs async on message content, feeding the Report/Trust cluster without blocking delivery

---

## 20. Payment Architecture

Dedicated `payments-service`, isolated from other services more strictly than any other component — this is the one subsystem where a bug has direct financial/legal consequences.

- **Wallet:** Every Talent and Hirer has a `Wallet` (see §9). Balance is always derived from the `Transaction` ledger (event-sourced), never a mutable field that gets directly incremented — prevents drift and enables reconciliation
- **Transactions:** Every money movement (deposit, escrow-hold, escrow-release, payout, platform fee) is its own immutable `Transaction` row; wallet balance = sum of transactions, computed or cached-and-reconciled, never authoritative-in-itself
- **Escrow:** At Contract acceptance, Hirer funds move from their payment method into an `EscrowHold` tied to the Contract/Milestone — funds are *held by the platform*, not yet in the Talent's Wallet. On delivery approval, hold releases into Talent's Wallet as a `payout-eligible` balance
- **Escrow-Ready design (MVP note):** MVP may launch with a simplified "hold and manual release" model using a single payment processor's native escrow/hold capability rather than building custom fund-holding — but the `Contract`/`Milestone`/`EscrowHold` schema is designed for full custom escrow from day one so the upgrade is a processor-integration change, not a data-model rewrite
- **Invoices (Phase 2):** Auto-generated PDF on contract completion, stored alongside the `Invoice` record, downloadable by both parties (tax/accounting need)
- **Payouts:** Talent-initiated withdrawal from Wallet to a linked `PayoutMethod` (bank/card via processor tokenization — GigRise never stores raw bank details)
- **Platform fee:** Modeled as its own `Transaction` type deducted at release time, fully visible in both parties' transaction history (no hidden fee logic)
- **Reconciliation:** Daily automated job cross-checks internal ledger against payment processor's reported balance; discrepancies alert Super Admin financial dashboard (§8)

---

## 21. AI Roadmap

AI features are additive assistance layers, never a hard dependency for core flows (every AI-assisted step has a manual fallback).

| Feature | What it does | Feeds into |
|---|---|---|
| **Profile Review AI** | Pre-screens new profiles for completeness/red flags before human review, drafts suggested decision + reason | Admin CRM verification queue (§8) |
| **Portfolio Review AI** | Flags likely stock/reused media, inconsistent metadata, low-effort submissions | Portfolio moderation, verification |
| **Creator/Actor Matching AI** | Embedding-based similarity between a Campaign/Casting Call brief and Talent profiles+portfolio, ranks candidates | Discover feed, Hirer's "recommended talent" |
| **Campaign Suggestion AI** | Recommends budget/scope/deliverables based on comparable historical campaigns and their outcomes | Campaign creation flow |
| **Proposal Generator** | Drafts a Talent's application message tailored to a specific brief, using their profile as source material | Application flow (Talent always reviews/edits before send) |
| **Resume/Reel Generator** | Assembles a one-page resume or highlight reel from existing portfolio assets automatically | Profile/portfolio management |

**Implementation note:** All AI features are isolated in `services/ai-service`, called via internal API from other services — this keeps model/provider swaps, cost controls, and prompt iteration contained to one service rather than scattered inference calls across the codebase.

---

## 22. Deployment

| Environment | Purpose | Characteristics |
|---|---|---|
| **Development** | Local + shared dev cluster | Seeded data, all services running (or mocked), feature flags default-on for in-progress work, no real payment processor (sandbox mode) |
| **Staging** | Pre-production validation | Mirrors production infra topology at smaller scale, real (sandboxed) payment processor integration, used for QA and stakeholder review before release |
| **Production** | Live platform | Multi-AZ deployment, blue/green or canary release strategy for core services, real payment processing, full monitoring/alerting active |

- **CI/CD:** Every merge to main runs test suite + build; deploy to staging is automatic, deploy to production is a gated promotion (manual approval step) — at least until deployment maturity and test coverage justify full automation
- **Infra as Code:** All environments defined in Terraform/K8s manifests (see §11 `infra/`) — no manual console changes to production infra
- **Feature Flags:** New features ship dark, enabled progressively per-cohort (internal → beta users → full rollout) rather than a hard cutover, especially for anything touching payments or verification

---

## 23. Scalability — 100 Users to 10 Million

The architecture is designed so that growth is answered with **more capacity**, not **different architecture**.

1. **Stateless application services.** `core-api`, `payments-service`, etc. hold no in-memory session state — any request can be served by any instance. Scaling is horizontal (add instances behind the load balancer), never a rewrite.
2. **Database read/write separation.** Start with a single Postgres primary; as read load grows, add read replicas (search, analytics, and dashboard queries route to replicas) before any need for sharding. Sharding by `user_id`/`talent_profile_id` is the eventual escape hatch, deferred until replica capacity is actually exhausted — not designed prematurely.
3. **Search and messaging are already separate stores from day one** (§18–19), so their independent scaling needs (high write throughput, different query patterns) never bottleneck the core transactional database, and vice versa.
4. **Async by default for anything non-blocking.** Media processing, notification dispatch, search indexing, AI inference all happen via message queue + worker pool — user-facing request latency stays flat regardless of backlog size; workers scale independently of API servers.
5. **CDN-first media delivery.** Portfolio/profile media never re-traverses application servers after first upload — this is the single highest-volume traffic category and it's fully offloaded from day one.
6. **Cache aggressively at the read layer.** Public profile pages, search results, campaign listings are cacheable (short TTL + explicit invalidation on write) — reduces database load for the platform's highest-traffic, lowest-personalization pages.
7. **Service boundaries match scaling boundaries.** Because `messaging-service`, `payments-service`, `media-service`, `search-service` are already separate deployable units (§11), each can be scaled, and if needed re-platformed, independently — messaging traffic at 10M users looks nothing like payments traffic, and they shouldn't have to share a scaling profile.
8. **Multi-region readiness deferred, not precluded.** Single-region deployment is correct at MVP-to-low-millions scale; the service-oriented boundaries and stateless design mean multi-region (for latency or data-residency reasons) is an infrastructure project later, not a code rewrite.

The through-line: every "boring," service-separated decision made in sections 9–20 (dedicated search store, dedicated messaging store, event-sourced ledger, async notification dispatch, CDN-first media) exists specifically so that scaling is a capacity/ops conversation, not an engineering-roadmap item.

---

## 24. Coding Standards

**Naming conventions**
- TypeScript/JavaScript: `camelCase` for variables/functions, `PascalCase` for components/types/classes, `SCREAMING_SNAKE_CASE` for constants
- Database: `snake_case` tables and columns, singular table names avoided in favor of plural (`users`, `contracts`) for consistency
- API routes: kebab-case, plural nouns (§10)

**File naming**
- Components: `PascalCase.tsx` matching the exported component name
- Hooks: `useCamelCase.ts`
- Utilities/services: `camelCase.ts`
- One default export per file where practical; file name should make the export obvious without opening it

**Folder naming**
- `kebab-case` for all directories, feature-sliced (`features/casting-calls/`, not type-sliced dumping grounds like a single global `components/`)

**Error handling**
- Domain errors are typed/classed (`ValidationError`, `NotFoundError`, `ForbiddenError`), never bare strings thrown
- API layer maps domain errors to consistent HTTP status + error envelope (§10) — clients never parse error strings to decide behavior
- No silent catch blocks — every caught error either handled meaningfully, logged, or re-thrown

**Logging**
- Structured logging (JSON) with correlation/request IDs threaded through every service call, so one request can be traced across `api-gateway → core-api → notification-service`
- Log levels used with intent: `error` (needs attention), `warn` (degraded but functioning), `info` (state changes worth an audit trail), `debug` (dev-only detail)
- Never log secrets, passwords, tokens, or full payment details

**Reusable code**
- Shared logic lives in `packages/*` (§11), imported, never copy-pasted across `apps/`/`services/`
- Three occurrences of the same logic is the trigger to extract, not the first duplication (per project convention of avoiding premature abstraction)

**Performance**
- Pagination mandatory on every list endpoint from day one (no endpoint ever returns an unbounded collection)
- N+1 query prevention enforced via code review + query-count assertions in tests for core list/detail endpoints
- Images/video always served in a size appropriate to viewport (responsive `srcset`/CDN transforms), never full-resolution originals in feeds

**Accessibility**
- Semantic HTML first, ARIA only to fill genuine gaps
- All interactive components keyboard-navigable, focus-visible states styled (not browser-default-suppressed)
- Color is never the sole signal (status pills carry text/icon, not just color)
- Minimum WCAG AA contrast across the design system's color tokens (§12)

**SEO**
- Public profile and campaign/casting-call pages server-rendered (not client-only rendered) for crawlability
- Structured data (schema.org `Person`/`JobPosting`-equivalent markup) on public profile and casting-call pages
- Canonical URLs, meta descriptions templated per entity type, sitemap auto-generated from published/approved content only

---

## Open Questions for Founder Sign-Off

Before implementation begins, these decisions should be made explicit rather than assumed:

1. **Payment processor choice** (Stripe Connect is the natural fit for marketplace escrow + split payouts — confirm before `payments-service` design goes further).
2. **Initial launch geography** — affects currency handling priority, KYC/verification document types, and which payout rails matter for MVP.
3. **Agency accounts** — are multi-profile management accounts (talent agencies, casting studios) a Phase 2 commitment or a "someday"? This affects whether `AgencyAccount`/`AgencyMembership` should be stubbed in the MVP schema even if unused.
4. **Verification rigor at launch** — fully manual admin review, or AI-pre-screen-assisted from day one? Affects whether `ai-service` needs to exist before MVP or can genuinely wait for Phase 3.
5. **Mobile priority** — is mobile web sufficient through Phase 2, or does React Native need to move earlier if the target user base is predominantly mobile-first (likely, given Creator/Actor demographics)?

---

*End of architecture document. Implementation planning begins only after review of this document.*
