# GigRise — Design System
**Version 1.1 — Amended: UI Coverage Gaps Closed**
**Status:** Design-only. No components, no CSS, no Figma file exist yet. Subordinate to [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md) — every visual decision here must render a real entity/state/relationship from those two documents, not an invented one. **v1.1 adds §21, a new section covering seven UI surfaces** (MFA, Impersonation Banner, Maker-Checker Dialog, Temporary Permissions, Session Management, Security Center, Authentication Screens) that were introduced by `AUTHENTICATION.md`, `API_SPECIFICATION.md`, and `CRM_SPECIFICATION.md` — all written *after* this document's v1.0 — and were flagged as missing in `CROSS_DOCUMENT_REVIEW.md` §8. Nothing in §1–20 below was altered; this is a pure addition, recorded in `CHANGELOG.md`.

---

## 0. Relationship to the Prior Two Documents

`ARCHITECTURE.md` §12–14 already committed to several foundational choices — an 8px-based spacing rhythm, a humanist-grotesque UI typeface with a separate display face for marketing, a single icon family, 150ms fade transitions, a defined component list. This document does not re-litigate those; it **extends them to full specification** (exact scale values, exact hex tokens, exact component anatomy) and reconciles them against the states `DATABASE_ARCHITECTURE.md` actually defines — e.g., a `StatusPill` isn't styled with "whatever states seem right," it's styled with the exact five `verification_status` values the database enforces (`draft`, `pending_review`, `approved`, `rejected`, `changes_requested`), because a sixth visual state with no backing enum value would be a design system lying about what the product does.

Where this document introduces something neither prior document anticipated (e.g., a command-palette search pattern), it's flagged inline as new scope, consistent with how both prior documents flagged their own reconciliations.

---

## 1. Brand Identity

### Mission
GigRise exists so that being hired for how you look, sound, perform, or create is as structured, trustworthy, and professional an experience as being hired for how you code. The brand has to *earn* that seriousness visually — this is not a marketplace that happens to look nice, it's a professional instrument that happens to serve a creative industry.

### Personality
**Confident restraint.** Not LinkedIn's corporate blue conservatism, not Fiverr's marketplace-bazaar energy, not Behance's purely aesthetic playground. GigRise sits at the intersection: the visual precision of Linear/Vercel's engineering tools, applied to an industry that's usually served by cluttered casting-network UIs from the 2000s. The brand should feel like the calm, obviously-correct choice in a category that's never had one.

### Visual Language
- **Neutral-dominant, accent-disciplined.** The interface is 90% carefully-graded grayscale. Color is spent deliberately, not decoratively — every non-neutral pixel should be doing semantic or brand work.
- **Two-tier accent system (the distinctive identity move):**
  - **Spotlight Gold** — a muted, antique-bronze gold, never bright/neon. Reserved for the brand's single "premium moment" per screen: primary CTAs, the Verified badge glow, subscription/premium indicators. It's a deliberate nod to the entertainment industry's own visual vocabulary (marquee lights, award-show gold) without becoming gaudy or literal.
  - **Trust Indigo** — a deep blue-violet used for links, informational states, active/selected UI, and secondary actions. It carries LinkedIn's blue-as-trust lineage into something less generic-corporate.
  - These two never compete on the same element — gold means "this is the platform's premium/verified moment," indigo means "this is interactive." A button is never both.
- **Typography does more work than color.** Given the accent-disciplined palette, hierarchy is established primarily through type scale and spacing, the way Notion and Linear do it — not through a rainbow of badge colors.

### Brand Principles
1. **Earn attention, don't demand it.** No autoplay-loud gradients, no bouncing badges.
2. **Every screen should survive a screenshot in a pitch deck.** If a dashboard looks cluttered or cheap in a static screenshot, it fails the brand test regardless of how it behaves.
3. **Trust is rendered consistently, not decoratively.** The Verified badge, rating display, and completion indicators appear in the same visual position and style everywhere they're relevant (§7, §10) — consistency *is* the trust signal.
4. **Restraint scales; decoration doesn't.** A design that relies on custom illustration or bespoke color-per-feature breaks down as the product grows to dozens of screens. A design built on disciplined tokens (§17) doesn't.

### Tone (writing voice within the UI)
Direct, professional, warm without being casual. "Your profile is under review" not "We're checking things out! 🎬" No exclamation points in system copy. Error messages state what happened and what to do next, never apologize performatively ("Oops!"). Empty states are the one place personality is allowed to show slightly more warmth, because they're addressed to a person having a quiet moment, not interrupting a task.

---

## 2. Color System

All values below are **draft token values** — final hex calibration happens in Figma against real contrast testing, but the *structure* (which roles exist, how many steps, how dark/light map) is the part that shouldn't change later.

### 2.1 Neutral Scale (`color.neutral.*`)
The base of ~90% of the UI. Cool-graphite, not warm-gray — reinforces the "engineering precision" half of the brand.

| Token | Hex | Typical use |
|---|---|---|
| neutral.0 | #FFFFFF | Light-mode surface (cards, modals) |
| neutral.50 | #F7F7F8 | Light-mode app background |
| neutral.100 | #EDEEF1 | Light-mode subtle fill (hover, table stripe) |
| neutral.200 | #DBDDE3 | Borders (light mode default) |
| neutral.300 | #C2C5CE | Disabled borders/icons |
| neutral.400 | #9498A3 | Placeholder text, disabled text |
| neutral.500 | #6B707C | Secondary/muted body text |
| neutral.600 | #4E525C | Body text (light mode) |
| neutral.700 | #383B42 | Headings (light mode) |
| neutral.800 | #24262B | Dark-mode surface |
| neutral.900 | #16171B | Dark-mode app background |
| neutral.950 | #0D0E10 | Dark-mode deepest background (rare) |

### 2.2 Primary — Spotlight Gold (`color.gold.*`)
| Token | Hex | Use |
|---|---|---|
| gold.100 | #F5E9D3 | Verified-badge background tint |
| gold.300 | #D9B876 | Hover state of gold elements |
| gold.500 | #B8863A | **Primary brand accent** — primary CTA fill, Verified badge icon |
| gold.700 | #8C6425 | Primary CTA active/pressed |
| gold.900 | #5C4118 | Text-on-gold-tint (accessible pairing) |

### 2.3 Secondary — Trust Indigo (`color.indigo.*`)
| Token | Hex | Use |
|---|---|---|
| indigo.100 | #E4E3FB | Info banner background, selected-row tint |
| indigo.300 | #A8A4F0 | Hover state |
| indigo.500 | #5B4FE9 | **Interactive default** — links, secondary buttons, active nav item, focus ring base |
| indigo.700 | #4038B0 | Active/pressed |
| indigo.900 | #262163 | Text-on-indigo-tint |

### 2.4 Semantic Colors
Deliberately distinct hues from both brand accents so a status is never mistaken for a brand moment.

| Role | Token | Hex (500 step) | Backing states |
|---|---|---|---|
| Success | `color.success.500` | #1E9E64 | `verification_status=approved`, `contract.status=completed`, delivery confirmations |
| Warning | `color.warning.500` | #C77C22 | `verification_status=pending_review`/`changes_requested`, `contract.status=disputed` pending, SLA-nearing-breach |
| Error | `color.error.500` | #D33A3A | `verification_status=rejected`, form validation errors, failed payments |
| Information | `color.info.500` | (= indigo.500) | Reuses Trust Indigo deliberately — informational and interactive share one hue family so the palette doesn't grow a third blue |

Each semantic role gets a 100-step tint (background) and 700-step shade (text-on-tint), mirroring the structure in §2.1–2.3, for accessible pairing in banners/pills.

### 2.5 Backgrounds & Surfaces
| Token | Light | Dark | Use |
|---|---|---|---|
| `bg.app` | neutral.50 | neutral.900 | Page background |
| `bg.surface` | neutral.0 | neutral.800 | Cards, modals, dropdowns |
| `bg.surface-raised` | neutral.0 + shadow.md | neutral.800 + border | Popovers, elevated menus |
| `bg.overlay` | rgba(13,14,16,0.48) | rgba(0,0,0,0.64) | Modal/drawer scrim |

### 2.6 Borders & Hover States
| Token | Light | Dark |
|---|---|---|
| `border.default` | neutral.200 | neutral.700 |
| `border.strong` | neutral.300 | neutral.600 |
| `hover.surface` | neutral.100 | neutral.700 (at 60% opacity over surface) |
| `hover.overlay-on-color` | +8% black mix | +8% white mix |

**Rule:** hover states are never a hue shift, only a lightness/opacity shift — keeps the two-tier accent discipline (§1) from leaking into ten shades of "slightly different gold" across component states.

### 2.7 Light Mode vs. Dark Mode Palette Mapping
Both themes use the *same token names* with different values (per `bg.*`/`border.*` tables above) — no component ever hardcodes a light-only or dark-only color. Dark mode is not an inverted light mode; neutral.900 is not simply neutral.50 inverted — it's calibrated separately so gold and indigo both stay legible and non-neon against it (gold in particular tends to look sickly on pure black without a warmth adjustment, which is why `bg.app` dark stops at neutral.900, not neutral.950).

### 2.8 Contrast Guidelines
- Body text on `bg.app`/`bg.surface`: minimum 4.5:1 (WCAG AA), targeting 7:1 (AAA) where it costs nothing (headings, primary body copy).
- Large text (≥24px or ≥19px bold) and UI component boundaries: minimum 3:1.
- Gold and Indigo 500-steps are calibrated to pass 4.5:1 against `neutral.0` for text use; when used as a *fill* (button background), text-on-fill uses `neutral.0` (light) verified separately, since fill-contrast and text-contrast are different checks that a "just make it look right" approach silently fails.
- No status is ever communicated by color alone (§12) — every semantic color pairs with an icon or text label at the component level, checked in §7's Status Chip and Badge specs.

---

## 3. Typography

### Font Family
Consistent with `ARCHITECTURE.md` §12: **UI typeface** — a humanist grotesque (Inter or a licensed equivalent) for all product surfaces. **Display typeface** — a refined serif or distinctive display sans, reserved *exclusively* for marketing/landing headlines (never inside the authenticated app) — this exclusivity rule is what keeps the display face feeling special rather than diluted.
Monospace (`font.mono`) — a neutral coding-style monospace, used narrowly for IDs, transaction references, and audit-log diffs in the Admin CRM (§9) where visual alignment of alphanumeric strings matters.

### Type Scale
| Token | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `text.display-lg` | 56px | 1.1 | 600 | Landing hero only |
| `text.display-sm` | 36px | 1.15 | 600 | Landing section headers |
| `text.heading-xl` | 28px | 1.25 | 600 | Page titles (Dashboard, Profile) |
| `text.heading-lg` | 22px | 1.3 | 600 | Section headers within a page |
| `text.heading-md` | 18px | 1.35 | 600 | Card titles, modal titles |
| `text.heading-sm` | 16px | 1.4 | 600 | Table headers, compact section labels |
| `text.body-lg` | 16px | 1.5 | 400 | Primary reading body (bios, messages) |
| `text.body-md` | 14px | 1.5 | 400 | Default UI body — the most-used token in the system |
| `text.body-sm` | 13px | 1.45 | 400 | Secondary/muted inline text |
| `text.caption` | 12px | 1.4 | 500 | Timestamps, helper text, form hints |
| `text.overline` | 11px | 1.3 | 600, uppercase, +0.04em tracking | Section eyebrows, table column labels |

### Letter Spacing
Default 0 for body copy; headings ≥24px get -0.01em (tightening large type is standard practice for a refined feel); `text.overline` is the sole exception with positive tracking, since uppercase caps read better spaced out.

### Font Weights Used
400 (regular, body), 500 (medium, emphasis inline / captions), 600 (semibold, all headings and buttons). **No 700/bold anywhere in the UI type scale** — deliberate restraint; if something needs to be louder than 600-semibold, that's a sizing problem, not a weight problem, per the brand's "confident restraint" principle (§1).

### Responsive Typography
Display and Heading-xl/lg scale down one step at the `sm` breakpoint (§4) rather than using fluid `clamp()`-style continuous scaling — discrete steps keep every screenshot at every breakpoint matching a named, designed value rather than an arbitrary interpolated size. Body/caption scales are constant across breakpoints (14px body text should read the same on mobile as desktop; only headline theatrics compress).

---

## 4. Spacing System

### The 4px Grid
Every dimension in the system — padding, margin, gap, icon size, component height — is a multiple of 4px. This reconciles with `ARCHITECTURE.md` §12's "8px base unit, multiples of 4/8": 4px is the atomic unit (used for fine adjustments like icon-to-label gaps), 8px is the *primary rhythm* most spacing actually uses. Nothing in the system ever uses 3px, 5px, 10px, etc.

### Spacing Scale (`space.*`)
| Token | Value | Typical use |
|---|---|---|
| space.1 | 4px | Icon-to-text gap, tight inline spacing |
| space.2 | 8px | Compact padding, chip/tag internal padding |
| space.3 | 12px | Form field internal padding |
| space.4 | 16px | Default card padding, standard gap between form fields |
| space.5 | 20px | — |
| space.6 | 24px | Card-to-card gap in a grid, section internal padding |
| space.8 | 32px | Section-to-section gap on a page |
| space.10 | 40px | — |
| space.12 | 48px | Page-top padding on desktop |
| space.16 | 64px | Landing page section separation |
| space.20 | 80px | Landing hero vertical rhythm |

### Container Widths
| Token | Value | Use |
|---|---|---|
| `container.sm` | 640px | Auth forms, single-column settings panels |
| `container.md` | 960px | Profile pages, messaging |
| `container.lg` | 1280px | Standard dashboard/CRM max-width (matches `ARCHITECTURE.md` §12) |
| `container.xl` | 1440px | Ultra-wide cap — content never exceeds this even on a 32" monitor (§14) |

### Margins & Padding Rules
- Page-level horizontal padding: 16px (mobile) → 24px (tablet) → 32px (desktop), never edge-to-edge content on any breakpoint.
- Card padding: `space.4` (compact cards, e.g. stat tiles) or `space.6` (content cards, e.g. profile sections).
- Form field vertical rhythm: `space.4` between fields, `space.6` between form sections.

### Responsive Breakpoints
| Token | Range | Device class |
|---|---|---|
| `bp.xs` | <640px | Mobile |
| `bp.sm` | 640–1023px | Tablet |
| `bp.md` | 1024–1439px | Desktop |
| `bp.lg` | ≥1440px | Ultra-wide |

---

## 5. Layout System

General rule across every authenticated surface: **fixed top nav (64px) + optional collapsible sidebar (§6) + centered content column capped at `container.lg`/`container.xl`.** This one skeleton, reused everywhere, is what makes the product feel coherent across 40+ screens rather than assembled from parts (`ARCHITECTURE.md` §13, principle 3).

- **Landing Page:** No app-shell — full-bleed marketing layout, its own header/footer, uses the display typeface freely. Sections: hero, role-aware value props (talent vs. hirer split), trust/social-proof band, featured campaigns/talent (Phase 2, per `DATABASE_ARCHITECTURE.md` §11's flagged Featured Content module), final CTA, footer.
- **Dashboard:** App shell + a top stat-row (full width, `space.6` gap cards) + a two-column body below `bp.md` (main content ~70%, contextual sidebar ~30% — recommendations, activity) collapsing to single-column stacked below `bp.sm`.
- **CRM (Admin):** App shell with **always-visible sidebar** (never collapsible — Admins live in this surface all day, unlike Talent/Hirer who visit occasionally) + a dense two-pane layout for review screens (queue list left, detail/decision panel right) — see §9.
- **Profile:** Full-width header band (cover + avatar + identity + primary CTA) at `container.xl`, then content below constrained to `container.md` for readability, tabbed sections (Portfolio / Experience / Reviews).
- **Messaging:** Fixed three-pane on desktop (conversation list ~320px | thread flexible | optional context panel ~280px showing the other party's mini-profile + active contract), collapsing to two-pane on tablet (context panel hidden behind a toggle) and single-pane on mobile (list → thread is a full navigation, not a split).
- **Settings:** Two-column: fixed-width left settings nav (§6) + `container.sm` content column — deliberately narrower than other pages since settings forms shouldn't stretch to 1280px of whitespace.
- **Authentication:** Centered single card, `container.sm` width, no app shell, no sidebar — the one surface that's intentionally minimal-chrome to keep focus on the single task.

### Device Layouts
- **Mobile (<640px):** Bottom tab bar replaces top nav + sidebar entirely (§6). Single-column everything. Cards go full-width minus page padding.
- **Tablet (640–1023px):** Sidebar collapses to icon-only rail by default (expandable on tap); two-column grids where desktop has three.
- **Desktop (1024–1439px):** Full sidebar + top nav; standard grid counts as specified per component.
- **Ultra-wide (≥1440px):** Content stays capped at `container.xl`; the surplus becomes increased side margins, never stretched cards/tables — a Stripe/Vercel-dashboard-inspired discipline that keeps data-dense screens from becoming unreadable rivers of whitespace between sparse columns.

---

## 6. Navigation

### Top Navigation (`AppTopNav`, 64px height, sticky)
Left: GigRise logo (links to role-appropriate dashboard home). Center-left: **global search** trigger (see below). Right, in order: Notifications bell (badge count), Messages icon (unread count), Avatar menu (profile/settings/theme toggle/logout). Persistent across every authenticated page except Admin CRM, which additionally pins the sidebar (§5).

### Sidebar (`AppSidebar`)
Role-aware — renders a different item set per `users.role` (never a static list with items hidden by CSS; the nav model itself is role-conditional, matching the RBAC principle in `ARCHITECTURE.md` §15). Two widths: expanded (240px, icon+label) and collapsed (72px, icon-only with tooltip on hover) — user-toggleable on desktop/tablet, always expanded on Admin CRM (§5).

Talent sidebar: Dashboard, Discover, Applications, Contracts, Wallet. Hirer sidebar: Dashboard, Campaigns/Casting Calls, Talent Discovery, Contracts, Collaborators (Phase 2). Admin sidebar: Verification Queue, Users, Reports, Support, Analytics, Audit Logs. Super Admin adds: Roles & Permissions, Feature Flags, Financials, System Health.

### Mobile Navigation
Bottom tab bar (5 items max, role-specific: e.g. Talent = Home / Discover / Messages / Applications / Profile). Overflow items (Settings, Wallet, etc.) live behind the Profile tab's menu, not a hamburger — bottom-tab-first is the more "native app" feeling pattern and matches how Talent/Actor users are more likely to be mobile-first (per `ARCHITECTURE.md` §24 founder open question on mobile priority).

### Breadcrumbs
Used only where navigation depth genuinely exceeds two levels (e.g., `Admin → Verification Queue → User Record → Verification Request #...`) — never on top-level pages, to avoid the LinkedIn-CRM-clutter failure mode the brand is explicitly avoiding.

### Search
Two distinct search surfaces, deliberately not merged:
1. **Global Command Search** (`⌘K` / `Ctrl+K`, Linear/Vercel-inspired) — an overlay palette for *navigation and quick actions* ("go to my contracts," "message [name]," "open verification queue"). New scope beyond both prior documents — flagged as a genuine addition, not implied by `ARCHITECTURE.md` §17's search architecture, which was about *talent/campaign discovery*, not app navigation. Recommend confirming as in-scope; it's cheap to build once the component library exists but is additive, not required for MVP.
2. **Discovery Search** (`/search`, per `ARCHITECTURE.md` §17) — the full faceted talent/campaign search experience, a dedicated page with filter rail + result grid, not an overlay.

### Notifications
Bell icon opens a **panel** (not a full navigation) showing the 10 most recent, grouped by day, each row showing icon-by-type + text + relative timestamp, with a "View all" link to `/notifications` for the full paginated history — mirrors the `notifications` table's `read_at`/`type` structure directly (`DATABASE_ARCHITECTURE.md` §10).

---

## 7. Component Library

Names below match `ARCHITECTURE.md` §14 where that document already named a component — extended here with full anatomy/state specs rather than renamed, to keep the two documents in lockstep.

**Buttons** — Primary (gold fill, §1), Secondary (indigo outline), Tertiary (text-only, indigo), Destructive (error-red outline, fills solid on hover). Sizes sm/md/lg (32/40/48px height). Every button has a loading state where the label is replaced by a spinner at fixed width (no layout shift) — per `ARCHITECTURE.md` §12.

**Inputs / TextField / TextArea** — 40px height (md), label always above (never placeholder-as-label — accessibility requirement, §12), helper/error text below in `text.caption`, error state swaps border to `color.error.500` + icon, never color-only.

**Dropdown / Select / MultiSelect** — Trigger matches TextField height for visual rhythm; panel uses `bg.surface-raised` + `shadow.md`; multi-select renders chosen items as removable `Tag`s inside the trigger once >0 selected.

**Cards** — One base `Card` primitive (radius `radius.md`, `bg.surface`, `border.default`, optional `shadow.sm` on hover) with slot-based content — every specialized card below (Campaign, Creator, Actor, Brand, Statistics, Analytics) is this primitive with a different content slot, never a separately-styled component, per `ARCHITECTURE.md` §12.

**Tables (`DataTable`)** — Shared by Admin CRM queues and Brand analytics (`ARCHITECTURE.md` §14). Sticky header, sortable columns (chevron indicator), row hover = `hover.surface`, zebra-striping optional per context (off by default in CRM for a cleaner look, on for dense analytics tables). Row height 48px default, 40px "compact" mode for CRM queues reviewing hundreds of items.

**Dialog / Modal** — Centered, `container.sm` max-width, `bg.overlay` scrim, entrance = fade+scale from 98%→100% over 150ms (§13). Used for single-decision interactions (confirm, approve/reject — §9).

**Drawer** — Slides from the right, used for "review without losing your place in a list" patterns (e.g., reviewing a submission from a queue without a full page navigation) — the CRM's primary review pattern, see §9.

**Tooltip** — 4px offset, `neutral.800`/`neutral.700` background regardless of theme (tooltips are always "dark chip" style, even in light mode — a common, legible pattern), appears after 400ms hover delay to avoid noisy flicker.

**Badge** — Small, filled, for counts (notification/message unread counts) — circular for counts ≤99, "99+" text beyond.

**Tags** — Rectangular, `radius.sm`, used for skills/categories on profiles — neutral-100 fill by default; never colored per-category (resisting the temptation to color-code skill tags, which historically becomes an unmaintainable rainbow at scale — ties to §18 future scalability).

**Avatars** — Circular, 5 sizes (24/32/40/56/96px), fallback = initials on a deterministic neutral-tint background (hashed from user ID, not random, so a user's fallback color is stable across sessions).

**Tabs** — Underline style (not pill/boxed) — thinner visual weight suits the restrained brand; active tab uses Trust Indigo underline + `text.heading-sm` weight bump.

**Pagination** — Cursor-based UI (Prev/Next + no arbitrary page-number jumping past page 3) reflecting the cursor-based backend pagination in `DATABASE_ARCHITECTURE.md` §17 — the UI should never imply "jump to page 40" is possible when the underlying query pattern doesn't cheaply support it.

**Search Bars** — Two visual variants matching §6's two search surfaces: an inline `SearchBar` (bordered field + icon) for Discovery pages, and the overlay Command Search's distinct full-screen-dim treatment.

**File Upload / Video Upload** — Dropzone with drag state (border becomes indigo dashed, background tints indigo.100), shows per-file progress bar during signed-URL upload, then a processing-state chip (`queued`/`processing`/`ready`/`failed`) once handed to `media-service` — directly reflecting `portfolio_videos.transcode_status` (`DATABASE_ARCHITECTURE.md` §5). Video upload additionally shows a generated thumbnail once available.

**Portfolio Gallery** — Responsive masonry-ish grid (CSS grid with `auto-fill`, not true masonry, for predictable row heights) — 4 columns desktop / 2 tablet / 1 mobile, images and videos visually unified via the `portfolio_items_v` view concept from the database doc (§5) even though they're two underlying tables.

**Status Chips (`StatusPill`)** — The single component backing every status in the system. Fixed mapping, never ad-hoc:
| State (from DB enum) | Color | Icon |
|---|---|---|
| draft | neutral | pencil |
| pending_review | warning | clock |
| approved | success | check |
| rejected | error | x |
| changes_requested | warning (distinct icon from pending) | edit |
Contract states (`accepted`→`completed`, `disputed`) reuse the identical component with their own enum mapping — one component, many enum-bound configs, never a bespoke pill per feature.

**Timeline** — Vertical connected-dot timeline, used for `verification_history` and `application_status_history` rendering (`DATABASE_ARCHITECTURE.md` §4, §8) — each node = one status transition, timestamp + actor.

**Verification Badge** — A small gold checkmark glyph, fixed position immediately right of the display name everywhere a name appears (card, profile header, message thread header) — never resized or recolored per-context, since consistency of this exact element *is* the trust mechanic (§1).

**Campaign / Creator / Actor / Brand Cards** — All `Card` primitive instances (see above) with type-specific content slots: Creator/Actor cards lead with avatar+Verified badge+headline+top skill tags+rating; Brand cards lead with logo+company name+active campaign count; Campaign cards lead with title+budget range+applicant count+deadline countdown.

**Statistics / Analytics Cards** — `StatBlock` (single big number + label + trend arrow) for dashboard header rows (`ARCHITECTURE.md` §7); `AnalyticsChartCard` (title + small chart + optional filter) for CRM/Brand analytics screens — chart rendering itself follows the platform's separate data-visualization guidance, not restated here.

**Empty States** — Icon/illustration (§16) + one-sentence explanation + one primary action, never just "No data." (`ARCHITECTURE.md` §12).

**Loading States / Skeletons** — Skeleton shape always matches the real content's final layout (a profile-card skeleton has the same avatar-circle + two text-bars shape the loaded card will have) — never a generic centered spinner on content-heavy pages.

**Error States** — Three distinct visual treatments per `ARCHITECTURE.md` §12: inline field-level (red text under the input), page-level network/server error (illustration + retry button), and permission error (explanation + redirect CTA, no retry button since retrying won't help).

---

## 8. Dashboard Design

All dashboards share the §5 layout skeleton (stat row + two-column body). What differs is content, not structure — this is deliberate: a Brand switching to review a Casting Director's dashboard-style CRM report should feel zero navigational disorientation.

- **Creator / Actor Dashboard:** Stat row = Profile Views · Applications Sent · Active Contracts · Wallet Balance (`ARCHITECTURE.md` §7). Main column = "Continue where you left off" list + Recommended Campaigns/Calls grid (3-col desktop). Sidebar column = profile-completeness `StatBlock` with a progress ring, recent activity timeline (Timeline component, §7).
- **Brand Dashboard:** Stat row = Active Campaigns · Total Applicants · Active Contracts · Spend This Month. Main column = Campaign performance `AnalyticsChartCard` grid. Sidebar = pending-offer list awaiting talent response.
- **Casting Director Dashboard:** Stat row = Open Calls · Submissions Pending · Shortlisted · Booked. Main column = a **swipeable submission review queue** (a distinctive, higher-density card-stack pattern — the one dashboard that deliberately breaks from the generic stat-row-plus-grid template, because casting review is a fundamentally different task rhythm: fast, high-volume, binary-decision-per-item, closer to Tinder's card-swipe pattern than a data table). Sidebar = deadline calendar.
- **Admin Dashboard:** Queue-depth `StatBlock`s (Verification Pending / Support Open / Reports Open) each with an SLA-timer sub-label; main column = the day's oldest-pending-item list across all queues, sorted by age — the Admin's job is triage, so the dashboard leads with "what's been waiting longest," not a generic activity feed.
- **Super Admin Dashboard:** Platform KPI `StatBlock` row (DAU/MAU, GMV, take-rate revenue, approval rate, completion rate) + a System Health `AnalyticsChartCard` (latency/error-rate, pulled from observability tooling, rendered read-only) + Financial reconciliation summary card flagging any drift (`DATABASE_ARCHITECTURE.md` §12's reconciliation job surfaces here).

---

## 9. CRM Design

The Admin CRM is the one surface allowed to be denser and more table-heavy than the rest of the product (`ARCHITECTURE.md` §13's "minimal chrome" principle bends here deliberately — Admins process volume, they don't browse).

- **Pending Verification (queue view):** `DataTable`, compact row height, columns = Applicant, Type (Creator/Actor/Brand/Director), Submitted, SLA Timer (color shifts neutral→warning→error as it approaches/breaches the 48h SLA from `DATABASE_ARCHITECTURE.md` §4), Status `StatusPill`. Tabs across the top: Pending / In Review / Approved / Rejected / Changes Requested — matching the exact `verification_status` enum, no extra tab invented.
- **Review Screen:** Opens as a `Drawer` (§7), not a full navigation, so the Admin's place in the queue is never lost. Two-pane: left = submitted evidence (documents via `MediaViewer`, portfolio snapshot, profile field summary), right = decision panel (Approve / Reject / Request Changes buttons + reviewer notes field) + a `Timeline` of this subject's full `verification_history`.
- **Approve Dialog:** Single confirm `Dialog` — no reason field required (matches `DATABASE_ARCHITECTURE.md` §4's `verification_reviews.reason` being optional only when `decision='approved'`).
- **Reject Dialog / Request Changes Dialog:** Same `Dialog` shape, but the reason `TextArea` is **required** — submit button stays disabled until populated, a direct UI enforcement of the database's `NOT NULL when decision != approved` constraint, so the constraint is never discovered only via a failed API call.
- **Analytics:** `AnalyticsChartCard` grid — cohort growth, funnel conversion, GMV trend, category supply/demand imbalance (`ARCHITECTURE.md` §8).
- **Audit Logs:** Read-only `DataTable`, monospace (`font.mono`) for actor IDs/target IDs, no row ever has an edit or delete affordance anywhere in the UI — visually reinforcing the database-level `REVOKE` on this table (`DATABASE_ARCHITECTURE.md` §10). Filterable by actor, action type, date range; each row expandable to show the before/after `jsonb` diff.

---

## 10. Profile Design

Shared header band (§5) across all four profile types: cover area, avatar, display name + Verified badge, headline, primary CTA (context-dependent: "Message" for a Hirer viewing Talent, "Edit Profile" for the owner). Below the header, a `Tabs` row scoped per type:

- **Creator:** Portfolio (images/videos, §7 gallery) · About (bio, niche, platforms) · Skills · Reviews.
- **Actor:** Reel (video hero, pinned above the gallery) · Portfolio · Experience · Skills & Languages · Reviews.
- **Brand:** About (company info) · Active Campaigns · Reviews (from Talent they've worked with — reputation cuts both ways per `ARCHITECTURE.md` §4).
- **Casting Director:** About (studio info) · Open Casting Calls · Reviews.
- **Portfolio tab:** the gallery component from §7, moderation-filtered (flagged `portfolio_images`/`videos.moderation_status` rows never render publicly).
- **Experience / Education tab:** chronological reverse-order list, each entry a compact card (title, org, date range, description) per `DATABASE_ARCHITECTURE.md` §6.
- **Skills tab:** `Tag` list (§7) grouped by category, sourced from the `talent_profile_skills`/`categories` join tables — never free-text, so it stays filterable in Discovery search (`ARCHITECTURE.md` §17).
- **Reviews tab:** Leads with the `rating_summaries` aggregate (big number + star breakdown bar chart, per `DATABASE_ARCHITECTURE.md` §10's reconciliation of Reviews vs. Ratings) above the individual `Review` cards list — the aggregate is the first thing seen, individual reviews are supporting evidence below it.
- **Projects/Videos:** Not a separate schema entity per the database doc — rendered as the video subset of Portfolio, given its own visual prominence (larger thumbnails, autoplay-muted preview on hover) rather than a literal separate tab, since a distinct "Projects" table doesn't exist in `DATABASE_ARCHITECTURE.md` and inventing separate UI for it would misrepresent the data model.

---

## 11. Messaging

- **Conversation List:** Each row = avatar + name + Verified badge (small) + last message preview (truncated) + relative timestamp + unread `Badge`. Sorted by most-recent-activity.
- **Chat Window:** Message bubbles left/right by sender, `text.body-md`, timestamp on hover/tap (not always visible — reduces visual noise per the brand's restraint principle). Attached `Offer`/`Contract` cards (§7's Card primitive again) render inline in the thread when a negotiation reaches that stage — messaging and hiring are visually one continuous surface, not two disconnected systems.
- **Attachments:** Inline image/file preview, using the same `MediaViewer` lightbox as portfolio media (§7) — one viewer component, two contexts.
- **Voice Notes (Phase 2):** A compact waveform player bubble — per `DATABASE_ARCHITECTURE.md` §9, this is just a `messages` row with an audio attachment, so visually it's the same bubble shape with a waveform instead of text/image content, not a structurally different message type.
- **Read Receipts:** Small checkmark under the sender's own last message (single = sent, double + indigo tint = read) — directly reflects `message_read_receipts` (`DATABASE_ARCHITECTURE.md` §9).
- **Typing Indicators (Phase 2):** Three-dot animated indicator, appears/disappears purely via WebSocket signal — explicitly not persisted anywhere (`DATABASE_ARCHITECTURE.md` §9 confirms no backing table), so the UI must be able to silently drop this state on reconnect without it ever being "missing data," just an ephemeral signal that expired.

---

## 12. Accessibility

- **Target:** WCAG 2.2 Level AA across the product; AAA contrast where achievable at no design cost (§2.8).
- **Keyboard Navigation:** Every interactive component (§7) is reachable and operable via keyboard alone — logical tab order matching visual layout, `Escape` closes any Dialog/Drawer/overlay, arrow keys navigate within composite widgets (Tabs, MultiSelect options, the Command Search palette).
- **Focus States:** A visible focus ring (2px, Trust Indigo, 2px offset) on every focusable element — never suppressed via `outline: none` without a replacement, per `ARCHITECTURE.md` §24.
- **ARIA:** Semantic HTML first (native `<button>`, `<nav>`, `<table>`); ARIA roles/labels used only to fill genuine gaps — e.g., the Command Search palette (a custom widget) needs `role="dialog"` + `aria-modal` + proper listbox semantics since there's no native element for it; a plain `DataTable` needs none beyond correct table markup.
- **Contrast Ratios:** Enforced as a token-level property (§2), not a per-component afterthought — any new color addition to the palette must be checked against `bg.app`/`bg.surface` in both themes before it's allowed into the token set.
- **Motion sensitivity:** All animation (§13) respects `prefers-reduced-motion` — transitions collapse to instant/near-instant, skeleton shimmer becomes a static tint, for users who've opted out of motion at the OS level.

---

## 13. Motion Design

Kept "subtle and premium" per the founder's explicit brief — motion should confirm what happened, never perform for its own sake.

- **Page Transitions:** 150ms fade (per `ARCHITECTURE.md` §12) — no slide/zoom between routes; route changes should feel instant, not cinematic.
- **Micro-interactions:** Button press = 1px translate-down + shadow reduction (100ms); checkbox/toggle = a quick fill-wipe (150ms); form field focus = border color transition (120ms) — every duration under 200ms, since anything longer starts to feel like the UI is being deliberately slow.
- **Hover Animations:** Card elevation (shadow.sm → shadow.md, 120ms) on hoverable cards; no scale/bounce anywhere (§1's restraint principle stated explicitly against decorative motion).
- **Loading Animations:** Skeleton shimmer — a slow (1.6s loop) diagonal light sweep, low-contrast, never a spinner on content-shaped loading (§7).
- **Modal/Drawer Animations:** Modal = fade+scale 98%→100% (200ms ease-out); Drawer = slide-in from the edge (220ms ease-out) with the scrim fading in slightly faster (150ms) than the panel slides, so the dimming reads as "immediate" while the panel motion reads as "considered."
- **Notification Animations:** Toast slides in from top-right (220ms), auto-dismisses after 5s with a subtle progress-bar countdown on the toast edge itself (not a separate element) — one visual cue instead of two.

---

## 14. Responsive Design

Mobile-first build order (per `ARCHITECTURE.md` §13's "mobile web must fully support every core flow," not a shrunk desktop view): every component's default/base styles target `bp.xs`, with `bp.sm`/`bp.md`/`bp.lg` as progressive enhancements, never the reverse. Grid column counts step up predictably: 1 (mobile) → 2 (tablet) → 3 (desktop) → capped-width-with-more-margin, not more columns (ultra-wide) — see §5's explicit ultra-wide discipline, which is the detail most competitor products in this space get wrong (stretched, sparse dashboards on large monitors).

---

## 15. Iconography

Single icon family throughout (per `ARCHITECTURE.md` §12) — outline style as the default/inactive state, filled variant of the same glyph for active/selected states (nav items, selected tab icon) — never a mix of two different icon sets' visual language.

**Sizes:** 16px (inline with `text.body-sm`/`caption`), 20px (default UI icon — buttons, nav), 24px (section headers, empty-state icons at small scale). All on the 4px grid (§4).

**Usage rules:** Icons never appear without an accompanying text label in primary navigation (icon-only is reserved for the collapsed sidebar rail and mobile tab bar, both of which use tooltips/labels-on-press as a fallback); an icon's color always follows the current text color of its context (never independently colored) except within `StatusPill`, where the icon *is* the semantic-color carrier by design (§7).

---

## 16. Illustrations

A restrained, geometric line-art style — abstract shapes and simple compositions built from the brand's own color tokens (neutral base + a single gold or indigo accent per illustration, never a full-color scene), explicitly not cartoon-mascot or stock-illustration style, which would undercut the "premium professional instrument" positioning (§1).

- **Empty States:** One small illustration (≤120px) + headline + one action, per context (empty inbox, no applications yet, no search results).
- **Onboarding:** Slightly larger illustrations (≤200px) at each step of the verification/profile-setup flow, giving warmth to what is otherwise a form-heavy process.
- **Errors:** A distinct, deliberately "quieter" illustration treatment (monochrome neutral only, no accent color) for 404/500 pages — errors shouldn't borrow the same visual warmth as a success moment.
- **Success Screens:** The one place a small amount of gold-accent celebratory illustration is allowed to feel slightly more expressive (e.g., verification approved, first contract completed) — bounded to these specific moments so it stays meaningful rather than diluted.

---

## 17. Design Tokens

A consolidated reference — the canonical token names referenced throughout this document, organized by category. This is the naming contract implementation will build against.

**Color:** `color.neutral.{0,50,100,200,300,400,500,600,700,800,900,950}`, `color.gold.{100,300,500,700,900}`, `color.indigo.{100,300,500,700,900}`, `color.success.{100,500,700}`, `color.warning.{100,500,700}`, `color.error.{100,500,700}`, `color.info.*` (aliases indigo), `bg.{app,surface,surface-raised,overlay}`, `border.{default,strong}`.

**Spacing:** `space.{1,2,3,4,5,6,8,10,12,16,20}` (§4), `container.{sm,md,lg,xl}`, `bp.{xs,sm,md,lg}`.

**Radius:** `radius.sm` (4px — tags, small chips), `radius.md` (8px — cards, inputs, buttons), `radius.lg` (12px — modals, drawers), `radius.full` (999px — avatars, circular badges).

**Shadows:** `shadow.sm` (subtle 1px card resting elevation), `shadow.md` (hover-elevated cards, dropdown panels), `shadow.lg` (modals) — all using a neutral-900-based low-opacity shadow color, never pure black, and calibrated separately (lower opacity, cooler tint) for dark mode so shadows don't just disappear against a dark background.

**Typography:** `font.family.{ui,display,mono}`, `text.{display-lg,display-sm,heading-xl,heading-lg,heading-md,heading-sm,body-lg,body-md,body-sm,caption,overline}` (§3), `font.weight.{regular,medium,semibold}` (400/500/600 — no 700 token exists, deliberately, §3).

**Animation:** `motion.duration.{instant:100ms,fast:150ms,base:200ms,slow:220ms}`, `motion.easing.{ease-out,ease-in-out}`, `motion.shimmer-loop:1.6s`.

---

## 18. Future Scalability

The system is built so that a new module (subscriptions/plans UI once Phase 3 ships per `DATABASE_ARCHITECTURE.md` §12's flagged open question, Agency/Team accounts, a fifth talent type) is a **composition exercise, not a redesign**:
- A new talent type reuses `talent_profiles`' shared header + adds one new profile tab — no new page skeleton (§5, §10).
- A new dashboard stat is a new `StatBlock` in an existing stat row — no new layout primitive.
- A new status anywhere in the product maps onto the existing `StatusPill` config table (§7) — never a bespoke pill.
- A new admin queue (e.g., a future Dispute Resolution queue) reuses the exact Pending Verification pattern (§9) — tabbed `DataTable` + Drawer review pattern — since that pattern was built generic enough (queue + detail-drawer + decision-dialog) to serve any future admin review workflow, not just verification.
- New semantic color needs (should they ever arise) must pass the §2.8 contrast checklist before entering the token set — the palette grows by rule, not by designer preference in the moment.

---

## 19. Authentication & Security UI Surfaces (v1.1 Addition)

Seven surfaces introduced by `AUTHENTICATION.md`, `API_SPECIFICATION.md`, and `CRM_SPECIFICATION.md` after this document's v1.0 shipped — closing the gap identified in `CROSS_DOCUMENT_REVIEW.md` §8. Every one reuses existing primitives from §7 rather than inventing new visual language, consistent with §18's "composition exercise, not a redesign" principle.

### 19.1 Authentication Screens
Login, Signup, Forgot Password, Reset Password — rendered inside the minimal-chrome Auth layout already specified in §5 (`container.sm`, no app shell). **Amended for Supabase Auth (`AUTHENTICATION.md` v2.0):** these screens call the Supabase client SDK directly rather than a GigRise endpoint, but the visual design is unaffected — same `TextField`/`Button`/`FormError` primitives (§7), same restrained motion (§13). The one new state: an **MFA challenge step** (§19.2) that can appear between "submit credentials" and "land in the app," rendered as a second card in the same Auth layout, not a modal — keeping it inside the same minimal-chrome container that owns the rest of the auth flow.

### 19.2 MFA Enrollment & Challenge
- **Enrollment** (Settings → Security Center, §19.6): a `FormStepper` (§7) of two steps — (1) QR code display + secret fallback text using `MediaViewer`-adjacent framing, (2) a 6-digit `TextField` (numeric, large type, auto-advancing focus) to confirm a code from the user's authenticator app. Success reveals 10 single-use recovery codes in a copyable `Card` with an explicit "save these now, you won't see them again" `Badge`-style warning (warning semantic color, §2.4).
- **Challenge** (at login, §19.1): the same 6-digit `TextField` pattern, presented as a second Auth-layout card immediately after credential submission — never combined into one form, since the user shouldn't be able to type a TOTP code before the server has confirmed the password is even correct.
- **Admin/Super Admin prompt:** a non-dismissible-until-acted-on `Dialog` (§7) shown once at first post-signup login for these roles, offering "Enroll now" / "Remind me later" (pending the mandatory-offer vs. hard-mandatory decision, `AUTHENTICATION.md` §21.1) — if that decision resolves to hard-mandatory, "Remind me later" is simply not rendered, a config toggle on the same component, not a different one.

### 19.3 Impersonation Banner
A full-width, non-dismissible banner pinned to the top of the CRM app shell (above `AppTopNav`, §6) for the duration of an impersonation session (`CRM_SPECIFICATION.md` §11.1) — `color.warning` background (never `color.error`, since impersonation is an authorized action, not a fault state, but it must never be mistaken for normal operation either), containing: "Viewing as **[user name]** — impersonation active" + a live countdown (`00:14:32`) + an "End Session" `Button` (secondary variant). The banner's presence is the only thing distinguishing an impersonated view from the admin's own session — no other visual change occurs, deliberately, so the admin sees the product exactly as the user does.

### 19.4 Maker-Checker Approval Dialog
For manual wallet adjustments above the configured threshold (`CRM_SPECIFICATION.md` §12.6): a `Dialog` requiring a **second** Finance Manager/Super Admin's action, structurally distinct from the standard confirmation `Dialog` (§7) — it renders the requesting admin's name, reason, and amount as read-only context, then requires the approving admin to type the exact amount as a confirmation step (not just click "Approve") before the adjustment posts. This extra friction is intentional, not an oversight — it's the one dialog in the entire system designed to be slightly harder to click through than every other confirmation, because the action it gates is real money moving outside the normal escrow flow.

### 19.5 Temporary Permissions UI
Within Role Management (`CRM_SPECIFICATION.md` §16): the existing permission-grant `Checkbox` list (§7) gains an optional `DatePicker` (§7) per grant, labeled "Expires on" — left blank, the grant is permanent (today's default behavior, unchanged); set, a small `StatusPill`-style countdown badge (`color.warning` once inside 24 hours of expiry) appears next to that permission in the role's detail view. No new component — a `DatePicker` and a `StatusPill` composed onto the existing Role Management screen.

### 19.6 Session Management & Security Center
**Security Center** is a new, consolidated `/settings/security` page (extending the Settings layout, §5) that gathers what was previously scattered across "Active Sessions" and implicit auth state into one screen: Active Sessions list (`DataTable`-lite, one row per session — device label, location approximation, last-active timestamp, "This device" `Badge`, individual "Revoke" + a top-level "Log out all other devices" `Button`), MFA status + "Manage MFA" entry point into §19.2, Password change, and (read-only) linked OAuth providers. This is a pure information-architecture consolidation — every element already existed conceptually in `AUTHENTICATION.md` §6/§11; §19.6 just gives it one home instead of leaving a reader to infer where it lives.

---

## UI Principles
1. Confident restraint over decoration — every non-neutral pixel earns its place (§1).
2. One shared page skeleton across the whole authenticated app (§5) — familiarity compounds, novelty per-screen doesn't.
3. Status and trust signals render identically everywhere they appear (§7, §9) — consistency *is* the credibility mechanic.
4. Density is earned, not default — most of the product is spacious (§4); only the Admin CRM (§9) and data tables trade space for throughput, deliberately.

## UX Principles
1. Every list has a designed empty state and a clear next action (§7) — a blank screen is a dead end, never acceptable.
2. Every destructive or hard-to-reverse admin decision (reject, request changes, suspend) requires an explicit reason, enforced in the UI before the API is ever called (§9) — the interface should make the correct, accountable path the only path.
3. Mobile is not a lesser experience of the same flows (§14) — every core loop (apply, message, accept an offer) is fully mobile-capable.
4. Motion informs, never entertains (§13) — if a proposed animation doesn't communicate state change or hierarchy, it doesn't ship.

## Component Naming Rules
`PascalCase` for every component (matches `ARCHITECTURE.md` §24): base primitives are unprefixed (`Card`, `Button`, `Badge`); composed/specialized components prefix with their domain when the name would otherwise be ambiguous (`CampaignCard`, `CreatorCard` — both are `Card` compositions, named for what they render, not how); CRM-only components live under an `Admin`-scoped naming convention in the folder structure (`ARCHITECTURE.md` §11's `apps/admin/`) but keep plain names in code (`QueueTable`, not `AdminQueueTable` — the folder already scopes it, the name doesn't need to repeat that).

## Figma Structure Recommendation
```
GigRise Design System (Figma)
├── 📄 Foundations        — color, type, spacing, radius, shadow, icon grid (Sections 2–4, 15 of this doc)
├── 📄 Components         — one frame per component in §7, each with all variants/states as Figma variants
├── 📄 Patterns           — composed patterns that aren't single components: the CRM queue+drawer pattern (§9),
│                            the two-tier search pattern (§6), the dashboard stat-row+two-column skeleton (§5)
├── 📄 Templates          — one full-page template per surface in §5 (Dashboard ×6 role variants, Profile ×4
│                            type variants, Messaging, Settings, Auth) — built entirely from Components + Patterns,
│                            never custom-drawn elements, so template drift from the system is structurally prevented
├── 📄 Flows              — end-to-end click-through prototypes per `ARCHITECTURE.md` §4's user journey
└── 📄 Illustrations       — the illustration set from §16, organized by usage context
```
Component variants within Figma should use the same enum vocabulary as the database where one exists (e.g., the `StatusPill` component's Figma variant property is literally named `verification_status` with the five enum values as options) — this keeps design and schema from drifting into two different vocabularies for the same concept.

## Future Design Improvements
- Once real usage data exists, revisit whether the Casting Director's swipe-card dashboard pattern (§8) actually outperforms a table view for high-volume casting directors (100+ submissions/call) — the card-stack assumption should be validated, not assumed permanent.
- The two-tier accent system (Gold/Indigo, §1) should be pressure-tested against real logo/marketing exploration before final calibration — token *structure* is set here, exact hex values are not final until a dedicated brand-identity pass (logo, marketing site) happens alongside this system, not after it.
- Command Search (§6) is flagged as new scope beyond the prior two documents — recommend a lightweight product spec before it's built, since "what actions belong in it" is a product decision, not just a design one.
- Illustration style (§16) is specified directionally; commissioning an actual illustrator/illustration system should happen before Phase 2, not blocked on it, since empty states can launch MVP with simple icon-only treatments as a placeholder.

---

*End of design system document. Subordinate to `ARCHITECTURE.md` and `DATABASE_ARCHITECTURE.md`; awaits founder review before any Figma or component-code work begins.*
