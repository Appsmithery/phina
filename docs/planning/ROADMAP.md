# Phína — Product Roadmap

This is the canonical roadmap for this repo. PRDs, implementation plans (Cursor/Claude Plan Mode), and epics/issues should link back here.

## Product vision

- **Vision:** Digitize wine club tasting events — photo-based wine entry (AI label extraction), live rating rounds (push-triggered, anonymous), and searchable history — so hosts and members get a smooth, persistent experience instead of sign-in sheets and verbal spiels.
- **Target users:** Wine club hosts and members attending in-person themed tastings.
- **North-star metric:** Events completed with full photo → rate → reveal flow; member re-engagement (return visits).
- **Non-goals (v1):** Social features, e-commerce, price lookups, separate web-only product. *Later phases:* personal cellars (user-owned collections), optional payments (donations + subscription for cellar users), user preference graph and discovery (shop picker, recipe pairing).

## How to use this roadmap

- **PRDs** live in `docs/planning/PRDs/` and are referenced by stable IDs (e.g. `PRD-2026-001`). Use [PRD_Template.md](./PRDs/PRD_Template.md) and the [planning guide](./planning%20guide.md) for naming and structure.
- **Plan Mode notes** live in `docs/planning/Plans/` and use the same PRD ID (e.g. `PRD-2026-001__cursor-plan.md`).
- **Architecture docs** live in `docs/architecture/` for cross-cutting technical designs that evolve across releases (e.g. [Taste Graph](../architecture/taste-graph.md)).
- **Status conventions:** 🧠 Draft · ✅ Ready · 🛠 In progress · 🧪 Validating · 🚀 Shipped · 🧊 Parked
- When you create or update a PRD, add or update its line in **Now / Next / Later** and in the **PRD index** below.

## Now / Next / Later

### Now (active)

- **Label photo extraction — troubleshoot & finalize** — Status: 🛠 — Owner: TBD  
  - **Why:** Extraction is still not working in production; blocks core value (photo → wine details).  
  - **Exit criteria:** Reliable label extraction for representative labels (multiple styles/languages); clear error handling and fallback when extraction fails.  
  - No PRD yet; consider a short PRD for scope and verification.

### Next (queued)

- **Sign in / sign up with Google** — Add Google OAuth alongside magic-link email. Reduces friction for new and returning members. Status: 🧠 — Target: TBD — No PRD yet.
- **Personal cellars** — Wine collections not tied to events: users can build, search, and manage their own cellar (bottles they’ve had or want to try). Enables use outside event-only flow. Status: 🛠 — Target: TBD — No PRD yet. **Shipped (foundation):** Profile stats (wines rated, % liked, events attended, avg body/dryness); Add wine from My Wines (non-event); Rate personal wines anytime; optional label scan for personal wines. **Foundation:** Quantity (1–12) for Events is shipped per [PRD-2026-002](./PRDs/archive/PRD-2026-002__quantity-events-cellar.md) (archived); the same semantics will be reused for Cellar when built.
- **Payments** — Two streams: (1) **Donations** — optional one-time donate-to-project when joining events; (2) **Subscription** — $2.99/month for personal cellar users (unlocks/cellar features). Subscription tier depends on Personal cellars. Status: 🧠 — Target: TBD — No PRD yet.

### Later (ideas)

- **User preferences and social data for wines** — Users add additional metadata to their rankings (e.g. tags, tasting notes, preferred contexts) to build a per-user preferences graph. This graph informs personalized discovery in later phases (shop picker, recipe pairing). Status: 🧠 — [PRD-2026-003](./PRDs/PRD-2026-003__user-preferences-social-data-wines.md).
- **Shop wine picker (photo)** — Help a user pick a wine in a shop: user photographs a bottle/shelf, app uses preferences graph + label recognition to recommend or explain fit. Depends on user preferences phase. Status: 🧠 — No PRD yet.
- **Recipe/meal pairing** — Recommend a wine pairing from the user's preferences and cellar: user uploads a recipe doc or pastes a link; app suggests pairings. Depends on user preferences phase. Status: 🧠 — No PRD yet.
- **Dining out** — So that a user can add a bottle while they are out to dinner at a restaurant: capture pairing data (what was eaten, how it paired) on top of preferences. Later phases may use location or reservation data via integration with OpenTable/Resy and Google Maps. Depends on user preferences phase. Status: 🧠 — No PRD yet.
- **Brand application** — Apply [Brand Guidelines](../brand-guidelines.md) consistently across app (typography, palette, imagery). No PRD yet.
- **Observability** — Error tracking, basic analytics. No PRD yet.
- **Native store builds** — Google Play / App Store when accounts are ready. No PRD yet.

## Releases (milestones)

### v0.1 (MVP) — 🚀 Shipped

- **Goal:** Core loop: events, QR join, photo wine entry, live rating rounds, event close & results reveal, history.
- **Includes:** Supabase + Expo scaffold, event/QR, camera + label extraction, rating rounds, history tab, PWA deploy.

### v0.2 — 🚀 Shipped

- **Goal:** Rebrand (Phína), admin panel, domain & secrets, brand guidelines in repo.
- **Includes:** Rebrand to Phína, in-app admin (promote/demote members), phina.appsmithery.co, env/secrets strategy, CI (typecheck/lint/test + deploy to droplet), [Brand Guidelines](../brand-guidelines.md) doc.

### v0.3 (reliability & auth)

- **Goal:** Fix label extraction; add Google sign-in for lower friction.
- **Includes:** Label photo extraction troubleshooting and finalization; Sign in/up with Google (OAuth).

### v0.4 (personal cellars & monetization)

- **Goal:** Personal wine cellars (not event-tied); optional donations and subscription for cellar users.
- **Includes:** Personal cellars (user-owned wine collections); Payments (donate on event join; $2.99/mo for cellar users).

### v0.5 (user preferences & discovery foundation)

- **Goal:** Let users add metadata to their rankings and build a per-user preferences graph.
- **Includes:** User preferences and social data for wines (ranking metadata, preference graph) — [PRD-2026-003](./PRDs/PRD-2026-003__user-preferences-social-data-wines.md).
- **Architecture:** [Taste Graph](../architecture/taste-graph.md) — signal sources, weighted preference algorithm, and evolution plan.

### v0.6+ (discovery)

- **Goal:** Use the preferences graph for in-the-wild discovery: shop wine picker (photo), recipe/meal pairing (doc or link), dining out (add bottle at restaurant with pairing data; optional OpenTable/Resy/Maps).
- **Includes:** Shop wine picker (photo); Recipe/meal pairing (upload doc or link to recipe); Dining out (restaurant add-bottle, pairing data; later: location/reservation integrations).

## User preferences and discovery (later)

The **preferences graph** (see [Taste Graph architecture](../architecture/taste-graph.md)) is built from ranking metadata: today's thumbs up/meh/down, plus any new structured metadata (e.g. tags, tasting notes, preferred contexts) added in the user preferences phase. That phase is the **foundation** for:

- **Shop wine picker** — User photographs a bottle or shelf in a shop → app matches to known wines and the user's preference profile → "this fits your taste" or "you liked similar at event X."
- **Recipe/meal pairing** — User uploads a recipe doc or pastes a link → app derives a meal profile → recommends wines from the user's cellar or taste profile.
- **Dining out** — User adds a bottle while at a restaurant → capture pairing data (dish/meal, how it paired) to enrich the preferences graph; eventually integrate location or reservation context (OpenTable/Resy, Google Maps) for richer context and discovery.

Future PRDs for preferences, shop picker, and recipe pairing should reference this section and the releases above. The user preferences phase is specified in [PRD-2026-003](./PRDs/PRD-2026-003__user-preferences-social-data-wines.md).

## PRD index (by area)

| Area        | PRD ID | Title | Status |
|-------------|--------|--------|--------|
| *Planned*   | — | Label photo extraction (troubleshoot & finalize) | 🛠 Now |
| Events      | PRD-2026-002 | [Quantity (1–12) for Events and Cellar](./PRDs/archive/PRD-2026-002__quantity-events-cellar.md) (archived) | 🚀 Shipped |
| Auth        | — | Sign in/up with Google | 🧠 Next |
| Product     | — | Profile stats, cellar add wine & rate personal wines | 🚀 Shipped |
| Product     | — | Personal cellars | 🛠 In progress |
| Monetization| — | Payments (donations + $2.99/mo cellar) | 🧠 Next |
| Preferences | PRD-2026-003 | [User preferences and social data for wines](./PRDs/PRD-2026-003__user-preferences-social-data-wines.md) | 🧠 Later |
| Discovery   | — | Shop wine picker (photo) | 🧠 Later |
| Discovery   | — | Recipe/meal pairing | 🧠 Later |
| Discovery   | — | Dining out (restaurant add-bottle, pairing data, OpenTable/Resy/Maps) | 🧠 Later |
| *Add new*   | — | Use [PRD_Template](./PRDs/PRD_Template.md); assign ID and add here | — |

---

## Context (reference)

A wine club holds themed tasting events where members bring bottles, share background info, and rate each other's selections. Today this is all manual — sign-in sheets, verbal spiels, no persistent history. The app digitizes this: members snap a photo of their bottle label, the app extracts wine details automatically, and the host can trigger live rating rounds via push notification. A persistent database builds a searchable history across all events.

---

## Core Feature Set

- **Event management** — Host creates an event with a theme, generates a QR code
- **QR code join** — Members scan a QR code at the venue to join the event (physical presence required)
- **Photo-based wine entry** — Camera captures label, AI extracts producer/varietal/vintage
- **Member check-in** — Name, email, wine details (auto-filled from photo)
- **Wine lookup** — Optional background info (region, tasting notes, food pairings)
- **Live rating rounds only** — Host pushes a notification, everyone rates thumbs-up/meh/thumbs-down; ratings close when the round ends
- **Historical database** — All bottles, ratings, and events searchable over time (read-only after event)

---

## Architecture Overview

### App layer

- **Framework:** Expo React Native (managed workflow) with TypeScript, using Expo Router for file-based navigation.
- **Platforms:** Single codebase targeting iOS, Android, and web (PWA) via `expo export:web`.
- **State & data:** Supabase client + TanStack Query for data fetching, caching, and real-time updates where needed.

### Backend & data platform

- **Backend:** Supabase Postgres as the primary backend, with row-level security (RLS) for multi-tenant and per-member access control.
- **Auth:** Supabase Auth with passwordless email (magic link). Admin capability is modeled as a flag (`members.is_admin`).
- **Realtime:** Supabase real-time subscriptions (where used) for live updates, e.g. rating counts.
- **Storage:** Supabase Storage bucket(s) for label photos (and related assets).

### Label extraction & wine info

- **Edge Function:** A Supabase Edge Function (`extract-wine-label`) receives a label photo (base64), calls Perplexity Sonar Pro (vision) to extract structured fields (producer, varietal, vintage, region, etc.) and an optional AI summary.
- **Label photos:** The same Edge Function uploads the label image to a `label-photos` bucket and returns a public URL stored alongside the wine.
- **Client flow:** The client captures a photo, sends it to the Edge Function, then pre-fills the add-wine form with the extracted fields and AI summary.

### Ratings, anonymity, and rounds

- **Ratings:** Stored per wine and member, with values -1/0/1 (thumbs down/meh/up); a Postgres view (`wine_rating_summary`) exposes only aggregate counts.
- **Anonymity:** RLS prevents any client from reading other members' raw ratings; only aggregate summaries are exposed after an event ends.
- **Rounds:** `rating_rounds` records control whether a rating round is active; inserts are blocked when a round is closed, enforcing the live-rounds-only model.

### Notifications & event join

- **Push:** Expo Push Notifications on native platforms, with Web Push planned for PWA. Tokens are stored on the member record (`push_token`) and used by Edge Functions to fan out notifications (e.g. \"Start rating round\").
- **Deep links & QR:** Events expose a QR code that encodes a universal HTTPS link (e.g. `https://phina.appsmithery.co/join/{event_id}`), which deep-links into the native app when installed or falls back to the PWA in the browser.

### Distribution

- **Web:** PWA hosted on a server (currently a Digital Ocean droplet) behind a custom domain.
- **Native:** EAS Build/Submit for Android (Play Store) and iOS (App Store) when accounts are ready.

---

## Data Model (Postgres via Supabase)

```
members
  id          uuid PK
  name        text
  email       text UNIQUE
  push_token  text
  is_admin    boolean DEFAULT false
  created_at  timestamptz

events
  id          uuid PK
  title       text          -- "Alpine Night"
  theme       text          -- "alpine"
  date        date
  status      text DEFAULT 'active'  -- 'active' | 'ended'
  created_by  uuid FK → members
  created_at  timestamptz
  -- QR code encodes: wineclub://join/{id}
  -- No extra column needed; the event id IS the join token

event_members
  event_id    uuid FK → events
  member_id   uuid FK → members
  checked_in  boolean DEFAULT false
  PRIMARY KEY (event_id, member_id)

wines
  id              uuid PK
  event_id        uuid FK → events
  brought_by      uuid FK → members
  producer        text
  varietal        text
  vintage         int
  region          text
  quantity        smallint DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 12)
  label_photo_url text
  ai_summary      text          -- Sonar-generated background
  created_at      timestamptz

ratings
  id          uuid PK
  wine_id     uuid FK → wines
  member_id   uuid FK → members
  value       smallint CHECK (value IN (-1, 0, 1))  -- down/meh/up
  created_at  timestamptz
  UNIQUE (wine_id, member_id)  -- one rating per member per wine

rating_rounds
  id          uuid PK
  event_id    uuid FK → events
  wine_id     uuid FK → wines
  started_at  timestamptz
  ended_at    timestamptz          -- NULL while active, set when host closes round
  is_active   boolean DEFAULT true -- derived from ended_at, but useful for quick queries
```

**Key constraints:**

- Ratings inserts are blocked by RLS when the associated `rating_round.is_active = false`
- A Postgres view exposes anonymous aggregates only:

```sql
CREATE VIEW wine_rating_summary AS
SELECT
  wine_id,
  COUNT(*) FILTER (WHERE value = 1)  AS thumbs_up,
  COUNT(*) FILTER (WHERE value = 0)  AS meh,
  COUNT(*) FILTER (WHERE value = -1) AS thumbs_down,
  COUNT(*)                           AS total_votes
FROM ratings
GROUP BY wine_id;
```

- RLS on this view: only readable when the parent event's `status = 'ended'`
- During an active event, the host can query a vote count per round (just `COUNT(*)` on ratings for that round) but never the breakdown or who voted what

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| App (native) | React Native + Expo (TypeScript) |
| App (web/PWA) | Same codebase, Expo web export |
| Navigation | Expo Router (file-based routing) |
| State management | TanStack Query + Supabase real-time |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Wine label AI | Perplexity Sonar API (vision) via Supabase Edge Function |
| Push (native) | Expo Push Notifications |
| Push (web) | Web Push API via Supabase Edge Function |
| PWA hosting | Digital Ocean (droplet), GoDaddy (domain) |
| Native builds | EAS Build + EAS Submit |

---

## App Screen Flow (v1)

**Onboarding:**  
Email entry → Magic link → Profile setup (name)

**Main tabs:**  
[Events] · [History] · [Profile]

**Events tab:**

- Event list → Event detail
  - (Host) "Show QR Code" — full-screen QR for members to scan
  - (Host) "Add wine" for walk-in manual entry
  - (Member) Scan QR → joins event → "Add my wine" → (optional Scan label) → Set quantity (1–12) + review fields → Confirm
  - Wine list (all bottles for this event, with AI summaries; quantity shown when > 1)
    - Wine detail (photo, producer, varietal, vintage, region, quantity, AI summary)
  - (Host) "Start rating round" for a wine → push sent to all members
  - (Host) During round: sees "8 of 12 voted" (no results visible)
  - (Host) "End round" → round locked, vote count finalized
  - (Host) "End Event" → ALL results revealed as anonymous aggregates

**Rating flow (triggered by push notification):**  
Push → Opens rating screen for that wine → Thumbs up / meh / down → "Vote recorded!"  
If round is already closed: "This round has ended" (no results yet — event still active)

**Results reveal (after host ends event):**  
Every wine shows: "👍 8  😐 3  👎 1" — anonymous, no names attached. Members and host see the same aggregate view.

**History tab:**

- Browse past events and wines (read-only)
- Search/filter by producer, varietal, vintage, event theme
- Wine detail view with anonymous aggregate ratings

**Profile:**  
Name, email, push notification preferences

---

## Verification & Testing Plan

- **Label recognition accuracy** — Test with 20+ real wine label photos across styles (Old World, New World, natural wine, minimalist labels) before launch
- **Cross-platform camera** — Verify photo capture works on: native iOS, native Android, Safari mobile (PWA), Chrome mobile (PWA)
- **Push notification flow** — Test on native (both platforms) and web (Android Chrome, note iOS Safari limitations)
- **Real-time vote counts** — Verify host screen updates live as members submit ratings
- **Auth flow** — Confirm magic link works on all platforms, including deep-link back into the app/PWA
- **QR universal link** — Verify QR code opens native app when installed, falls back to PWA when not
- **PWA install prompt** — Confirm "Add to Home Screen" works on both Android Chrome and iOS Safari
- **Offline resilience** — Camera capture and local form should work offline; sync when connection returns

---

## Design Decisions (Confirmed)

- **Distribution:** Native + PWA from one Expo codebase. PWA ships first (free, no app store accounts). Android and iOS native follow as accounts are set up.
- **Ratings:** Live rounds only — host starts/ends a round, members rate during the window, ratings lock when the round closes.
- **Anonymity:** Individual votes are never exposed to any client. Results are shown as anonymous aggregates only after the host closes the entire event.
- **Event joining:** QR code at the venue encodes a universal HTTPS link — opens native app if installed, PWA in browser if not.
- **Auth:** Magic link with repeat guest recognition — returning members are auto-populated on login, no re-entering profile info.
- **Social features:** None for v1 — keeping it focused on the core loop of photo → info → rate → history.

---

## Implementation Order — v0.1 (Completed)

1. Supabase setup  
2. Expo project scaffolding  
3. Event creation & QR code  
4. Wine entry with camera  
5. Wine list & detail views  
6. Rating rounds  
7. Event close & results reveal  
8. History tab  
9. PWA deployment  
10. Native builds  

---

## v0.2 Delivered: Rebrand + Admin Panel + Domain + Secrets + Brand Guidelines

### Context

The app is now called Phína, hosted at **phina.appsmithery.co** (domain via GoDaddy; CI deploys web build to a droplet). Delivered: rebrand, in-app admin panel (promote/demote members), env/secrets strategy, and brand guidelines in repo.

### Change 1: Rebrand to "Phína"

All references updated to "Phína" with the accent. Config uses slug `phina` (ASCII-safe).

**Files created/modified:**

- `app.config.ts` — dynamic Expo config with name "Phína", slug "phina", scheme "phina"
- `app/auth/index.tsx` — change "Wine Club" heading to "Phína"
- `app/event/[id]/qr.tsx` — update `APP_BASE_URL` default to `https://phina.appsmithery.co`
- `.env.example` — all env vars documented with `EXPO_PUBLIC_APP_URL=https://phina.appsmithery.co`
- `package.json` — change name to `phina`

### Change 2: In-App Admin Panel

**New files:**

- `app/(tabs)/admin.tsx` — Admin tab screen: lists all members, toggle admin status
- `hooks/use-members.ts` — `useMembers()` query + `useToggleAdmin()` mutation
- `supabase/migrations/002_admin_update_policy.sql` — RLS policy allowing admins to update other members

**Files to modify:**

- `app/(tabs)/_layout.tsx` — add conditional Admin tab (only visible when `member?.is_admin`)

**Admin tab behavior:**

- Shows a list of all members (name, email, admin badge)
- Each row has a toggle/button to promote or demote
- An admin cannot demote themselves (safety guard to prevent lockout)
- Follows the same card-based UI pattern as the profile screen

**New RLS policy (`002_admin_update_policy.sql`):**

```sql
-- Allow admins to update any member's is_admin field
CREATE POLICY "Admins can update any member"
  ON members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND is_admin = true)
  );
```

This replaces the narrower "Members can update own profile" policy by also granting admins update access. The existing self-update policy still applies for non-admins.

**Bootstrapping the first admin:** After your first login, set `is_admin = true` on your row in the Supabase dashboard (one-time, takes 5 seconds). From there, you can promote others via the app.

### Change 3: Domain & Hosting Config

No code changes needed — infrastructure setup documented for reference:

- **Digital Ocean:** Deploy the PWA to a droplet (e.g. build with `npx expo export --platform web`, serve the `dist/` output with nginx or another static host). CI can build and deploy on push (e.g. GitHub Actions → SSH/rsync or DO App Platform).
- **GoDaddy:** Add a CNAME record pointing the app subdomain to your droplet (or to your DO load balancer / App Platform URL):
  - **Name:** phina (or subdomain as desired)
  - **Value:** your droplet’s public hostname or DO-provided URL
  - **TTL:** 600
- **SSL:** Use Let’s Encrypt (e.g. Certbot on the droplet) or Digital Ocean’s SSL options so the site is served over HTTPS.
- **Deep links:** The QR codes will encode `https://phina.appsmithery.co/join/{event_id}`

### Change 4: Secrets Management Strategy

**Principle:** Secrets live in exactly one place per environment, never in code.

| Secret | Where it lives | Who can see it |
|--------|----------------|----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | .env (local), droplet/CI env (prod) | Client-side — intentionally public, RLS is the security layer |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | .env (local), droplet/CI env (prod) | Client-side — intentionally public, same as above |
| `EXPO_PUBLIC_APP_URL` | .env (local), droplet/CI env (prod) | Client-side — just the domain, not secret |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase secrets set (prod), .env (local dev only) | Server-side only — Edge Functions. Full DB bypass, NEVER in client code |
| `PERPLEXITY_API_KEY` | supabase secrets set (prod), .env (local dev only) | Server-side only — Edge Functions (label extraction). Billed API key |
| Deployment key / SSH / DO token | GitHub Actions secrets (or local) | CI only — used for deploying PWA to Digital Ocean |
| `EXPO_TOKEN` | GitHub Actions secrets only | CI only — used for EAS Build |

### Implementation (Secrets & Config)

**Files created:**

- `.gitignore` — excludes `.env`, `.env.local`, `.env.*.local`, `.env.production`, `supabase/.env`, `supabase/.temp/`
- `.env.example` — documents every env var with placeholder values, commented-out server-side secrets, and clear tier labels
- `app.config.ts` — dynamic Expo config that reads `process.env.EXPO_PUBLIC_*` at build time (replaces static app.json)

**Rules enforced:**

- `EXPO_PUBLIC_` prefix = OK to embed in client bundle (Supabase URL, anon key, app URL)
- No `EXPO_PUBLIC_` prefix = server-only, set via `supabase secrets set` or GitHub Actions secrets
- `.env` is gitignored — developers copy `.env.example` and fill in real values
- Edge Functions access server secrets via `Deno.env.get()` — Supabase injects them automatically after `supabase secrets set`
- CI/CD secrets go in GitHub repo Settings → Secrets and variables → Actions

**Local development setup:**

```bash
cp .env.example .env
# Fill in EXPO_PUBLIC_* values from Supabase dashboard
# For Edge Function local dev:
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set PERPLEXITY_API_KEY=pplx-...
```

**Production deployment:**

```bash
# Supabase Edge Functions (run once, persists):
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set PERPLEXITY_API_KEY=pplx-...

# PWA build: set EXPO_PUBLIC_* in your deployment environment (e.g. on the Digital Ocean
# droplet or in CI that builds and deploys the web bundle). No separate "env add" CLI —
# configure in your server env, CI secrets, or build script.
```

### Verification

- `npx tsc --noEmit` — zero errors after all changes
- `git status` confirms `.env` is not tracked
- `.env.example` is committed and documents all required variables
- `app.config.ts` reads env vars dynamically (no hardcoded secrets)
- Admin tab only appears for members with `is_admin = true`
- Non-admin members see 3 tabs (Events, History, Profile); admins see 4 (Events, History, Admin, Profile)
- Admin cannot demote themselves
- "Phína" branding appears on auth screen and app metadata
- QR codes point to `phina.appsmithery.co`

---

## v0.2: Brand Guidelines + Repo Publish — Done

- **Brand guidelines:** [docs/brand-guidelines.md](../brand-guidelines.md) created (palette, typography, UI principles, imagery).
- **Config and repo:** `.env.example`, `.gitignore`, `app.config.ts` and related files tracked; repo has CI (typecheck, lint, test, deploy to droplet).

**Next steps for planning:** Create PRDs for the next initiatives (e.g. brand application, observability) using [PRD_Template](./PRDs/PRD_Template.md) and add them to the [Now / Next / Later](#now--next--later) and [PRD index](#prd-index-by-area) above.
