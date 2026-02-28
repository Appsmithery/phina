# Phína — System Architecture

Phína digitizes wine club tasting events: members photograph bottle labels, AI extracts wine details, and hosts run anonymous live rating rounds via push notification. The app runs as a single React Native/Expo codebase targeting iOS, Android, and PWA. All data lives in Supabase (Postgres + Auth + Storage + Edge Functions); the client never talks to any other backend.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| App (native) | React Native + Expo (TypeScript) |
| App (web/PWA) | Same codebase, Expo web export |
| Navigation | Expo Router (file-based routing) |
| Data fetching | TanStack Query v5 (React Query) |
| Realtime | Supabase Realtime (`postgres_changes`) |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Wine label AI | Perplexity Sonar API (vision) via Edge Function |
| Push (native) | Expo Push Notifications |
| Push (web) | Web Push API via VAPID, via Edge Function |
| PWA hosting | Digital Ocean (droplet + nginx), GoDaddy (domain) |
| Native builds | EAS Build + EAS Submit |

---

## App Layer

- **Framework:** Expo React Native (managed workflow), TypeScript throughout.
- **Navigation:** Expo Router with file-based routing under `app/`. Stack screens at root; bottom tabs under `app/(tabs)/`. Auth screens under `app/(auth)/`.
- **Key directories:**
  - `app/` — screens (file-based routes)
  - `components/` — shared UI components
  - `lib/` — utilities and context (`supabase.ts`, `supabase-context.tsx`, `theme.ts`, `alert.ts`, etc.)
  - `hooks/` — React Query hooks (data fetching and mutations)
  - `types/` — TypeScript types, including `database.ts` (canonical DB schema)
  - `supabase/` — migrations, edge functions
- **State management:** No global state store; TanStack Query handles server state. `SupabaseContext` provides session, member, and auth helpers app-wide.

---

## Backend

Supabase provides the entire backend:

- **Postgres** — primary database with RLS (row-level security) as the access control layer
- **Auth** — email magic link, email + password, Google OAuth (PKCE flow)
- **Storage** — `label-photos` bucket for wine label images uploaded during extraction
- **Edge Functions** (Deno) — `extract-wine-label` (label AI), `send-rating-round-push` (push fan-out)
- **Realtime** — `postgres_changes` subscriptions for live sync across clients

The Supabase anon key is intentionally public (embedded in the client bundle); RLS policies enforce per-member access. The service role key never leaves Edge Functions.

---

## Data Model

```
members
  id              uuid PK                         -- matches auth.users.id
  name            text
  email           text UNIQUE
  push_token      text                            -- Expo push token (native)
  is_admin        boolean DEFAULT false
  created_at      timestamptz

events
  id              uuid PK
  title           text                            -- e.g. "Alpine Night"
  theme           text                            -- e.g. "alpine"
  date            date
  status          text DEFAULT 'active'           -- 'active' | 'ended'
  created_by      uuid FK → members
  created_at      timestamptz

event_members
  event_id        uuid FK → events
  member_id       uuid FK → members
  checked_in      boolean DEFAULT false
  PRIMARY KEY (event_id, member_id)

event_favorites
  event_id        uuid FK → events
  member_id       uuid FK → members
  wine_id         uuid FK → wines
  created_at      timestamptz
  PRIMARY KEY (event_id, member_id, wine_id)

wines
  id              uuid PK
  event_id        uuid FK → events (nullable for personal cellar wines)
  brought_by      uuid FK → members
  producer        text
  varietal        text
  vintage         int
  region          text
  quantity        smallint DEFAULT 1 CHECK (1..12)
  label_photo_url text                            -- Supabase Storage public URL
  ai_summary      text                            -- short Sonar-generated summary
  ai_overview     text                            -- detailed overview
  ai_geography    text                            -- region/terroir background
  ai_production   text                            -- producer/winemaking notes
  ai_tasting_notes text                           -- tasting notes
  ai_pairings     text                            -- food pairing suggestions
  color           text CHECK ('red','white','skin-contact')
  is_sparkling    boolean DEFAULT false
  drink_from      int                             -- suggested drinking window start (year)
  drink_until     int                             -- suggested drinking window end (year)
  price_range     text
  price_cents     int
  status          text DEFAULT 'storage'          -- 'storage' | 'consumed'
  date_consumed   date
  created_at      timestamptz

ratings
  id              uuid PK
  wine_id         uuid FK → wines
  member_id       uuid FK → members
  value           smallint CHECK (-1, 0, 1)       -- thumbs down / meh / thumbs up
  body            text CHECK ('light','medium','full')
  sweetness       text CHECK ('dry','off-dry','sweet')
  confidence      numeric
  created_at      timestamptz
  UNIQUE (wine_id, member_id)

rating_rounds
  id              uuid PK
  event_id        uuid FK → events
  wine_id         uuid FK → wines
  started_at      timestamptz
  ended_at        timestamptz                     -- NULL while active
  is_active       boolean DEFAULT true
```

**Views:**

- `wine_rating_summary` — aggregate counts per wine (`thumbs_up`, `meh`, `thumbs_down`, `total_votes`); readable only when the parent event is ended (RLS). Raw per-member ratings are never exposed to clients.
- `wines_with_price_privacy` — wines with price fields nulled out for non-owners.

**Functions:**

- `get_event_wine_ratings(p_event_id)` — returns aggregate rating counts for all wines in an event.

---

## Authentication

Three methods, all via Supabase Auth:

1. **Magic link** — passwordless email; user clicks link → deep-linked back into app
2. **Email + password** — standard sign-up/sign-in
3. **Google OAuth** — PKCE flow; native uses `expo-web-browser` for the auth session; deep link callback (`phina://`) or web callback route passes the session back to the app

After sign-in, `SupabaseProvider` calls `fetchMember(userId)` to ensure a row exists in `members` and keeps the `member` object in context.

**Setup guides:** [AUTH_SETUP.md](../setup/AUTH_SETUP.md) · [GOOGLE_OAUTH_SETUP.md](../setup/GOOGLE_OAUTH_SETUP.md) · [EXPO_GO_OAUTH_SETUP.md](../setup/EXPO_GO_OAUTH_SETUP.md)

---

## Label Extraction

The `extract-wine-label` Edge Function powers the "Scan label" feature:

1. Client captures a photo (native: `expo-camera`; web: `<input type="file">`) and base64-encodes it
2. Client calls `supabase.functions.invoke("extract-wine-label", { body: { image: dataUrl } })`
3. Edge Function calls **Perplexity Sonar** (vision model) with the image and a structured extraction prompt
4. Sonar returns structured fields: producer, varietal, vintage, region, color, is_sparkling, drink window, and several AI text sections (overview, geography, production notes, tasting notes, pairings)
5. Edge Function uploads the label photo to `label-photos` Storage bucket and returns the public URL alongside extracted fields
6. Client stores the result in module-level state (`last-label-extraction.ts`) and navigates back; the add/edit wine form reads the extraction on focus and pre-fills all fields

**Requires:** `PERPLEXITY_API_KEY` Supabase secret. See [EDGE_FUNCTIONS_MANUAL_DEPLOY.md](../setup/EDGE_FUNCTIONS_MANUAL_DEPLOY.md) for deployment.

---

## Ratings & Anonymity

- **Rounds model:** A `rating_rounds` record controls whether voting is open. The host starts a round for a specific wine; an RLS policy blocks rating inserts when `rating_rounds.is_active = false`.
- **During a round:** The host sees a live vote count (total only — no breakdown, no member names). Members see a pending state until the event ends.
- **After event ends:** The host calls "End Event" → event `status` set to `ended` → `wine_rating_summary` view becomes readable for all event members → anonymous aggregates (👍 / 😐 / 👎 counts) are revealed. Individual votes are never exposed to any client.
- **Favorites:** Members can mark a wine as a favorite per event via `event_favorites`; this is a personal preference signal, visible only to the member who set it.

---

## Realtime Sync

`EventDetailScreen` subscribes to `postgres_changes` for the current event on mount:

```
supabase.channel(`event:{id}`)
  .on("postgres_changes", { table: "events",        filter: `id=eq.{id}` }, ...)
  .on("postgres_changes", { table: "wines",          filter: `event_id=eq.{id}` }, ...)
  .on("postgres_changes", { table: "rating_rounds",  filter: `event_id=eq.{id}` }, ...)
  .on("postgres_changes", { table: "event_members",  filter: `event_id=eq.{id}` }, ...)
  .subscribe()
```

Each change handler calls `queryClient.invalidateQueries(...)` with the matching query key, triggering a background refetch for connected clients.

**QueryClient defaults** (`app/_layout.tsx`):
- `staleTime: 30_000` — data is considered fresh for 30 seconds; no redundant refetches within a session
- `refetchOnWindowFocus: true` — refetch when the browser tab regains focus (web)
- **AppState resume** (`supabase-context.tsx`) — `queryClient.invalidateQueries()` (all queries) is called when the app returns to foreground on native

Realtime is enabled for `events`, `wines`, `rating_rounds`, and `event_members` via `supabase/migrations/025_enable_realtime.sql`.

---

## Cross-Platform Compatibility

The app runs on iOS, Android, and Web (PWA) from one codebase. Platform differences are handled at the boundary:

| Concern | Native | Web |
|---------|--------|-----|
| Alerts | `Alert.alert()` | `window.alert()` / `window.confirm()` |
| Share | `Share.share()` (RN) | `navigator.share` → `navigator.clipboard.writeText` → `window.prompt` |
| Camera | `expo-camera` (`CameraView`) | `<input type="file" accept="image/*" capture="environment">` |
| Image picker | `expo-image-picker` | `<input type="file" accept="image/*">` |

**Pattern for native-only modules** (avoids bundler errors on web):

```typescript
let CameraView: typeof import("expo-camera").CameraView | undefined;
if (Platform.OS !== "web") {
  const cam = require("expo-camera") as typeof import("expo-camera");
  CameraView = cam.CameraView;
}
```

All alert calls route through `lib/alert.ts` (`showAlert`), which wraps `Alert.alert` on native and `window.alert`/`window.confirm` on web.

---

## Push Notifications

- **Native (iOS/Android):** Expo Push Notifications. On sign-in, `registerPushTokenIfNeeded` (called from `SupabaseProvider`) requests permission and upserts the Expo push token to `members.push_token`.
- **Web (PWA):** Web Push API via VAPID. A separate registration flow stores a `PushSubscription` object. The `send-rating-round-push` Edge Function reads stored tokens/subscriptions and fans out to all event members.
- **Trigger:** Host taps "Start rating round" → app calls `supabase.functions.invoke("send-rating-round-push", { body: { event_id, wine_id } })` → Edge Function reads all members' tokens and sends pushes.
- **Deep link from push:** Notification payload includes `data.url` (e.g. `/event/:id/rate/:wineId`); `_layout.tsx` listens for `Notifications.addNotificationResponseReceivedListener` and calls `router.push(url)`.

See [DEVELOPMENT_BUILD.md](../setup/DEVELOPMENT_BUILD.md) for testing push on device.

---

## QR Codes & Deep Linking

- **Join link format:** `https://phina.appsmithery.co/join/{event_id}` — a universal HTTPS link
- **QR behavior:** Opens the native app if installed (universal link), falls back to the PWA in a browser if not — no special "install the app" step needed
- **OAuth deep link callback:** `phina://` scheme (native) or `/auth/callback` route (web) returns the OAuth session to the app after Google sign-in; handled in `app/_layout.tsx` and `app/(auth)/callback.tsx`

---

## Security

- **RLS is the primary access control layer.** Every table has policies; the anon key grants only what RLS allows.
- **Anon key** is intentionally public — embedded in the client bundle. This is Supabase's standard model; RLS replaces server-side auth middleware.
- **Service role key** is server-only — used only inside Edge Functions via `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`. Never in client code.
- **Secrets strategy:** `EXPO_PUBLIC_*` vars are client-safe (Supabase URL, anon key, app URL). All other secrets (service role key, Perplexity API key, VAPID key) are set via `supabase secrets set` and accessed only in Edge Functions.
- **`overrides` in `package.json`** pin patched versions of `minimatch` and `tar` to address known CVEs in transitive deps.

---

## Related Docs

- [Taste Graph](./taste-graph.md) — preference signal sources, weighted algorithm, evolution plan (v0.5+)
- [Brand Guidelines](../brand-guidelines.md) — palette, typography, UI principles
- [Roadmap](../planning/ROADMAP.md) — product vision and release milestones
- [Auth Setup](../setup/AUTH_SETUP.md) — email auth, magic links, SMTP
- [Google OAuth Setup](../setup/GOOGLE_OAUTH_SETUP.md) — OAuth app config, redirect URLs
- [Edge Functions Deploy](../setup/EDGE_FUNCTIONS_MANUAL_DEPLOY.md) — manual deploy via Supabase Dashboard
- [Development Build](../setup/DEVELOPMENT_BUILD.md) — native push testing
- [Deploy (Digital Ocean)](../setup/DEPLOY_DIGITALOCEAN.md) — PWA deploy and nginx config
- [Rating Rounds Auto-close](../setup/RATING_ROUNDS_AUTO_CLOSE.md) — scheduled round closure
