# Phína — Product Roadmap

This is the canonical roadmap for this repo. PRDs, implementation plans (Claude Plan Mode), and epics/issues should link back here.

For technical architecture, data model, and infrastructure details see [System Architecture](../architecture/system-architecture.md).

## Product vision

- **Vision:** Digitize wine club tasting events — photo-based wine entry (AI label extraction), live rating rounds (push-triggered, anonymous), and searchable history — so hosts and members get a smooth, persistent experience instead of sign-in sheets and verbal spiels.
- **Target users:** Wine club hosts and members attending in-person themed tastings.
- **North-star metric:** Events completed with full photo → rate → reveal flow; member re-engagement (return visits).
- **Non-goals (v1):** Social features, e-commerce, price lookups, separate web-only product. *Later phases:* personal cellars (user-owned collections), optional payments (donations + subscription for cellar users), user preference graph and discovery (shop picker, recipe pairing).

## How to use this roadmap

- **PRDs** live in `docs/planning/PRDs/` and are referenced by stable IDs (e.g. `PRD-2026-001`). Use [PRD_Template.md](./PRDs/PRD_Template.md) and the [planning guide](./planning%20guide.md) for naming and structure.
- **Plan Mode notes** live in `docs/planning/Plans/` and use the same PRD ID (e.g. `PRD-2026-001__cursor-plan.md`).
- **Architecture docs** live in `docs/architecture/` for cross-cutting technical designs — [System Architecture](../architecture/system-architecture.md), [Taste Graph](../architecture/taste-graph.md).
- **Status conventions:** 🧠 Draft · ✅ Ready · 🛠 In progress · 🧪 Validating · 🚀 Shipped · 🧊 Parked
- When you create or update a PRD, add or update its line in **Now / Next / Later** and in the **PRD index** below.

## Now / Next / Later

### Now (active)

- **Label photo extraction — troubleshoot & finalize** — Status: 🛠 — Owner: TBD
  - **Why:** Extraction is still not working in production; blocks core value (photo → wine details).
  - **Exit criteria:** Reliable label extraction for representative labels (multiple styles/languages); clear error handling and fallback when extraction fails.

### Next (queued)

- **Personal cellars** — Wine collections not tied to events: users can build, search, and manage their own cellar. Enables use outside event-only flow. Status: 🛠 — Target: TBD — No PRD yet. **Foundation shipped:** Profile stats; Add wine from My Wines (non-event); Rate personal wines anytime; optional label scan. Quantity (1–12) per [PRD-2026-002](./PRDs/archive/PRD-2026-002__quantity-events-cellar.md).
- **Payments** — Donations (optional on event join) + Subscription ($2.99/mo for cellar users). Depends on Personal cellars. Status: 🧠 — No PRD yet.

### Later (ideas)

- **User preferences and social data for wines** — Per-user preference graph from ranking metadata (tags, tasting notes, preferred contexts). Status: 🧠 — [PRD-2026-003](./PRDs/PRD-2026-003__user-preferences-social-data-wines.md).
- **"Help me pick" (discovery)** — Wine shop photo, restaurant menu photo, cooking chat — all powered by the Taste Graph. Depends on PRD-2026-003. Status: 🧠 — [PRD-2026-004](./PRDs/PRD-2026-004__help-me-pick.md).
- **Brand application** — Apply [Brand Guidelines](../brand-guidelines.md) consistently across the app. No PRD yet.
- **Observability** — Error tracking, basic analytics. No PRD yet.
- **Native store builds** — Google Play / App Store when accounts are ready. No PRD yet.

## Releases (milestones)

### v0.1 (MVP) — 🚀 Shipped

Core loop: events, QR join, photo wine entry, live rating rounds, event close & results reveal, history. PWA deploy on Digital Ocean.

### v0.2 — 🚀 Shipped

Rebrand to Phína, in-app admin panel (promote/demote members), phina.appsmithery.co domain, env/secrets strategy, CI (typecheck/lint/test + deploy), [Brand Guidelines](../brand-guidelines.md) doc.

### v0.3 (reliability & auth) — 🛠 In progress

Fix label extraction; add Google sign-in for lower friction; cross-platform audit (Realtime subscriptions, web-compatible Share/Camera/ImagePicker).

- Google Sign-In: 🚀 Shipped
- Cross-platform audit: 🚀 Shipped
- Label extraction finalization: 🛠 In progress

### v0.4 (personal cellars & monetization)

Personal wine cellars (user-owned wine collections); payments (donate on event join; $2.99/mo for cellar users).

### v0.5 (user preferences & discovery foundation)

User preferences and social data for wines (ranking metadata, preference graph) — [PRD-2026-003](./PRDs/PRD-2026-003__user-preferences-social-data-wines.md). Architecture: [Taste Graph](../architecture/taste-graph.md).

### v0.6 — "Help me pick" (discovery)

Unified discovery feature: wine shop (bottle photo), restaurant (menu photo), cooking (chat + recipe upload). Powered by Taste Graph. [PRD-2026-004](./PRDs/PRD-2026-004__help-me-pick.md).

---

## Core Feature Set

- **Event management** — Host creates an event with a theme, generates a QR code
- **QR code join** — Members scan a QR code at the venue to join (physical presence required)
- **Photo-based wine entry** — Camera captures label; AI extracts producer, varietal, vintage, region, tasting notes, and more
- **Member check-in** — Name, email, wine details (auto-filled from photo)
- **Live rating rounds** — Host starts a round → push notification → everyone rates 👍 / 😐 / 👎; ratings are blind until the host ends the event
- **Historical database** — Searchable repository of past events, wines, and anonymous ratings (read-only after event ends)

---

## Design Decisions (Confirmed)

- **Distribution:** Native + PWA from one Expo codebase. PWA ships first (free, no app store accounts). Android and iOS native follow when accounts are ready.
- **Ratings:** Live rounds only — host starts/ends a round, members rate during the window, ratings lock when the round closes.
- **Anonymity:** Individual votes are never exposed to any client. Results are shown as anonymous aggregates only after the host closes the entire event.
- **Event joining:** QR code at the venue encodes a universal HTTPS link — opens native app if installed, PWA in browser if not.
- **Auth:** Magic link + email/password + Google OAuth. Returning members are auto-populated on login.
- **Social features:** None for v1 — focused on the core loop of photo → info → rate → history.

---

## App Screen Flow

**Onboarding:**
Email entry → Magic link / Password / Sign in with Google → Profile setup (name)

**Main tabs:**
[Events] · [History] · [Profile] · [Admin] *(admins only)*

**Events tab:**

- Event list → Event detail
  - (Host) "Show QR Code" — full-screen QR for members to scan
  - (Host) "Add wine" for walk-in manual entry
  - (Member) Scan QR → joins event → "Add my wine" → (optional Scan label) → Set quantity + review fields → Confirm
  - Wine list (all bottles for this event; AI summaries; quantity shown when > 1)
  - Wine detail (photo, producer, varietal, vintage, region, quantity, AI sections, drink window)
  - (Host) "Start rating round" for a wine → push sent to all members
  - (Host) During round: sees live vote count (no breakdown)
  - (Host) "End round" → round locked
  - (Host) "End Event" → all results revealed as anonymous aggregates

**Rating flow (triggered by push notification):**
Push → Rating screen → Thumbs up / meh / down → "Vote recorded!"
If round already closed: "This round has ended"

**Results reveal (after host ends event):**
Every wine shows: "👍 8  😐 3  👎 1" — anonymous, no names attached.

**History tab:**
Browse past events and wines (read-only). Search/filter by producer, varietal, vintage, event theme.

**Profile:**
Name, email, stats (events attended, wines rated, avg body/dryness), push notification preferences.

---

## PRD index (by area)

| Area        | PRD ID | Title | Status |
|-------------|--------|--------|--------|
| *Planned*   | — | Label photo extraction (troubleshoot & finalize) | 🛠 Now |
| Events      | PRD-2026-002 | [Quantity (1–12) for Events and Cellar](./PRDs/archive/PRD-2026-002__quantity-events-cellar.md) (archived) | 🚀 Shipped |
| Auth        | — | Sign in/up with Google | 🚀 Shipped |
| Product     | — | Profile stats, cellar add wine & rate personal wines | 🚀 Shipped |
| Product     | — | Personal cellars | 🛠 In progress |
| Monetization| — | Payments (donations + $2.99/mo cellar) | 🧠 Next |
| Preferences | PRD-2026-003 | [User preferences and social data for wines](./PRDs/PRD-2026-003__user-preferences-social-data-wines.md) | 🧠 Later |
| Discovery   | PRD-2026-004 | ["Help me pick" — shop photo, menu photo, cooking chat](./PRDs/PRD-2026-004__help-me-pick.md) | 🧠 Draft |
| *Add new*   | — | Use [PRD_Template](./PRDs/PRD_Template.md); assign ID and add here | — |
