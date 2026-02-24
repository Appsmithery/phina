# Phína — Product Roadmap

This is the canonical roadmap for this repo. PRDs, implementation plans (Cursor/Claude Plan Mode), and epics/issues should link back here.

## Product vision

- **Vision:** Digitize wine club tasting events — photo-based wine entry (AI label extraction), live rating rounds (push-triggered, anonymous), and searchable history — so hosts and members get a smooth, persistent experience instead of sign-in sheets and verbal spiels.
- **Target users:** Wine club hosts and members attending in-person themed tastings.
- **North-star metric:** Events completed with full photo → rate → reveal flow; member re-engagement (return visits).
- **Non-goals (v1):** Social features, e-commerce, price lookups, separate web-only product. *Later phases:* personal libraries (user-owned collections), optional payments (donations + subscription for library users).

## How to use this roadmap

- **PRDs** live in `docs/planning/PRDs/` and are referenced by stable IDs (e.g. `PRD-2026-001`). Use [PRD_Template.md](./PRDs/PRD_Template.md) and the [planning guide](./planning%20guide.md) for naming and structure.
- **Plan Mode notes** live in `docs/planning/Plans/` and use the same PRD ID (e.g. `PRD-2026-001__cursor-plan.md`).
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
- **Personal libraries** — Wine collections not tied to events: users can build, search, and manage their own library (bottles they’ve had or want to try). Enables use outside event-only flow. Status: 🧠 — Target: TBD — No PRD yet. **Foundation:** Quantity (1–12) is implemented first for Events per [PRD-2026-002](./PRDs/PRD-2026-002__quantity-events-library.md); the same quantity semantics will be reused for Library when built.
- **Quantity (1–12) for Events** — Add quantity input to the scan/add-wine flow and persist in DB for event wines; prepares reuse for Library. Status: 🧠 — Target: TBD — [PRD-2026-002](./PRDs/PRD-2026-002__quantity-events-library.md).
- **Payments** — Two streams: (1) **Donations** — optional one-time donate-to-project when joining events; (2) **Subscription** — $2.99/month for personal library users (unlocks/library features). Subscription tier depends on Personal libraries. Status: 🧠 — Target: TBD — No PRD yet.

### Later (ideas)

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

### v0.4 (personal libraries & monetization)

- **Goal:** Personal wine libraries (not event-tied); optional donations and subscription for library users.
- **Includes:** Personal libraries (user-owned wine collections); Payments (donate on event join; $2.99/mo for library users).

### v0.5+

- **Goal:** TBD (e.g. brand application, observability, native store builds).

## PRD index (by area)

| Area        | PRD ID | Title | Status |
|-------------|--------|--------|--------|
| *Planned*   | — | Label photo extraction (troubleshoot & finalize) | 🛠 Now |
| Events      | PRD-2026-002 | Quantity (1–12) for Events and Library | 🧠 Draft |
| Auth        | — | Sign in/up with Google | 🧠 Next |
| Product     | — | Personal libraries | 🧠 Next |
| Monetization| — | Payments (donations + $2.99/mo library) | 🧠 Next |
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

## Key Architecture Decisions

### 1. Cross-Platform Framework

| Option | Pros | Cons |
|--------|------|------|
| **React Native (Expo)** | JS/TS ecosystem, OTA updates, Expo handles camera/push/builds, huge community | Performance ceiling for heavy animation (not relevant here) |
| **Flutter** | Fast rendering, single codebase compiles to native | Dart is a smaller talent pool, less native-feeling on iOS |
| **Capacitor/Ionic** | Web devs can contribute easily | Feels like a wrapped website, camera integration is weaker |

**Recommendation:** React Native with Expo (SDK 52+). The app is form-driven with camera and push notifications — Expo's managed workflow handles both out of the box. OTA updates via EAS mean you can ship fixes without app store review cycles. TypeScript throughout.

Expo also supports web export (`npx expo export:web`), so the same codebase produces a PWA alongside native iOS/Android builds — no separate web project needed.

### 2. Backend & Database

| Option | Pros | Cons |
|--------|------|------|
| **Supabase** | Postgres under the hood, row-level security, real-time subscriptions, auth built-in, generous free tier | Less mature than Firebase for push notifications |
| **Firebase** | Mature push (FCM), Firestore real-time | NoSQL (Firestore) makes relational queries harder — events-to-wines-to-ratings is inherently relational |
| **Custom (Node + Postgres on Railway/Fly)** | Full control | More to build and maintain for a club-scale app |

**Recommendation:** Supabase. The data model is relational (events have many wines, wines have many ratings, members attend many events). Postgres handles this naturally. Supabase gives you:

- Auth (email/magic link — no password friction for club members)
- Row-level security (hosts can manage events, members can only rate)
- Real-time subscriptions (vote count updates live for the host; full results revealed on event close)
- Edge Functions for server-side logic (calling Perplexity Sonar API, sending push notifications)
- Storage bucket for wine label photos

### 3. Wine Label Recognition (the "magic" feature)

| Option | Pros | Cons |
|--------|------|------|
| **Perplexity Sonar API** | Vision + web-grounded; reads labels with artistic/non-standard fonts, extracts structured data in one call, can return wine background info; OpenAI-compatible API | API cost per call |
| **Google Cloud Vision OCR** | Raw text extraction is reliable | Returns raw text — you still need an LLM to parse "producer" vs "varietal" vs "vintage" from unstructured label text |
| **Pre-trained wine label models** | Purpose-built | Hard to find, not maintained, limited |

**Recommendation:** Perplexity Sonar API (sonar-pro). A single API call can:

- Extract structured fields: `{ producer, varietal, vintage, region, appellation }`
- Optionally return background info about the wine (saves a second lookup call)

This is the right tool because wine labels are notoriously varied in layout — some are minimal, some are ornate, some are in foreign languages. An LLM with vision handles this variance far better than rigid OCR + regex parsing.

The call would be made from a Supabase Edge Function (server-side), so the API key never touches the client.

### 4. Wine Lookup / Background Info

Two approaches, not mutually exclusive:

- **Sonar-generated summary** — When extracting label info, also ask the model: "Provide a 2–3 sentence summary of this wine's region, typical flavor profile, and any notable facts a dinner guest would find interesting." This is in the same API call and conversational.
- **External wine API** — Wine-Searcher or similar for price/rating data. These APIs tend to be expensive or unreliable. Not worth it for v1.

**Recommendation:** Sonar-generated summary in the same vision call. One API call, two outputs. If a member wants to give a spiel, they have a cheat sheet right on their phone.

### 5. Push Notifications & Live Rating (Live Rounds Only)

| Option | Pros | Cons |
|--------|------|------|
| **Expo Push Notifications** | Works on both platforms, simple token management, free | Expo's servers as intermediary |
| **Firebase Cloud Messaging directly** | Industry standard | More setup, need to handle APNs certificates separately |

**Recommendation:** Expo Push Notifications (native) + Web Push API (PWA). Flow:

1. On app open, register for push and store the Expo push token in Supabase (`members.push_token`)
2. Host taps "Start rating round" for a specific wine
3. Supabase Edge Function sends push to all members checked into that event
4. Notification deep-links to rating screen for that wine
5. Member taps thumbs-up / meh / thumbs-down → confirmation shown ("Vote recorded!")
6. Host sees only a count of how many members have voted (e.g. "8 of 12 voted") — not the results
7. Host taps "End round" — round is locked, no more votes accepted
8. Repeat for each wine…
9. Host taps "End Event" — all results revealed as anonymous aggregates for every wine

This keeps ratings blind and unbiased. The big reveal at the end adds a fun moment to the evening.

### 6. Event Joining via QR Code

Members scan a QR code displayed by the host at the venue. The QR encodes a universal link like `https://wineclub.app/join/{event_id}`. This:

- Ensures physical presence (no remote vote-bombing)
- Is dead simple — no codes to type, no links to fish out of a group text
- Works for both native and PWA users — the URL opens the native app if installed, or falls back to the PWA in the browser
- Works naturally with Expo's deep linking / Expo Router

The host's event detail screen shows a full-screen QR code they can display on a phone or cast to a screen.

### 7. Auth Strategy (Repeat Guest Friendly)

Wine club members aren't power users — minimize friction, but recognize returning members.

**Recommendation:** Magic link (passwordless email auth) via Supabase Auth.

- **First visit:** Scan QR → prompted for email → magic link sent → tap link → enter name → joined the event
- **Returning guest:** Scan QR → prompted for email → magic link sent → tap link → recognized automatically (name, profile already populated) → joined the event instantly
- Supabase Auth handles session persistence, so if the member is still logged in on their phone from last time, scanning the QR just adds them to the new event with zero friction
- The host/admin role is a flag on the member's profile row (`is_admin`)

### 8. Anonymized Ratings & Post-Event Reveal

Ratings are blind and anonymous to prevent groupthink and social pressure:

- **During the event:** No one (including the host) can see individual ratings or aggregate results while a round is active or after it closes — until the host explicitly ends the entire event
- **After event closes:** The host taps "End Event", which:
  - Locks all remaining open rounds
  - Reveals aggregate results for every wine: "12 thumbs up, 3 meh, 1 thumbs down"
  - Results are anonymous — no names attached to individual votes, ever
  - Everyone in the event sees the same aggregate view
- **In history:** Past events show the same anonymous aggregate results

**Implementation via Row-Level Security (RLS):**

- The `ratings` table stores `member_id` (needed to enforce one-vote-per-member), but RLS policies prevent any client query from reading `member_id` on other people's ratings
- A Postgres view (`wine_rating_summary`) exposes only aggregate counts: `thumbs_up_count`, `meh_count`, `thumbs_down_count`
- This view is only accessible when `events.status = 'ended'` (enforced by RLS)
- Even the host cannot see who voted what — the raw ratings table is never exposed to any client

### 9. Distribution Strategy: Native + PWA

Three distribution channels from one codebase:

| Channel | How | Push notifications |
|---------|-----|--------------------|
| **PWA (web)** | Host on your own server (e.g. Digital Ocean droplet), domain via GoDaddy; members visit URL in browser | Web Push API (works on Android Chrome; iOS Safari 16.4+ supports it but requires user opt-in) |
| **Android (Play Store)** | EAS Build → Google Play internal testing → production | Expo Push (via FCM) — full support |
| **iOS (App Store)** | EAS Build → TestFlight → App Store | Expo Push (via APNs) — full support |

**When:** Day 1 — PWA, no app store accounts needed. Android when ready ($25 one-time). iOS when you have Apple Developer account ($99/yr).

**Phased rollout plan:**

1. **Phase 1 (immediate):** Build and deploy as a PWA. Host the web build on your own infrastructure (e.g. Digital Ocean droplet); domain via GoDaddy. Members scan the QR code at the event, it opens in their browser, and they get the full experience — camera, ratings, wine info. Push notifications work on Android; on iOS web, fall back to in-app polling (the rating screen auto-refreshes when a round starts).
2. **Phase 2 (when ready):** Ship to Google Play ($25). Android users get native push and a home screen icon. PWA continues to work as a fallback.
3. **Phase 3 (when you have Apple Developer account):** Ship to App Store. iOS users get native push. PWA still works for anyone who hasn't installed.

**QR code is the glue:** The QR encodes a universal HTTPS link (`https://wineclub.app/join/{event_id}`). If the native app is installed, the OS opens it (via Associated Domains on iOS / App Links on Android). If not, the browser opens the PWA. Zero friction either way.

**Platform-aware code:** Use `Platform.OS` checks (or `Platform.select`) for the few spots where behavior differs:

- **Camera:** expo-camera on native, `<input type="file" accept="image/*" capture="environment">` on web (opens the phone's camera the same way)
- **Push registration:** Expo Push on native, Web Push API on web
- **QR scanning:** expo-camera barcode scanner on native, web QR scanner library on web (or just handle the URL directly since the QR opens a link)

Everything else — Supabase client, auth, forms, real-time subscriptions, TanStack Query — is 100% cross-platform with no branching.

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

## Proposed Tech Stack Summary

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
  - (Member) Scan QR → joins event → "Add my wine" → Camera → Review extracted info → Confirm
  - Wine list (all bottles for this event, with AI summaries)
    - Wine detail (photo, producer, varietal, vintage, region, AI summary)
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
