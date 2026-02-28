# Phína

A wine club app that digitizes themed tasting events: members snap a photo of their bottle label, the app extracts wine details with AI, and hosts run live anonymous rating rounds via push notification. A persistent database keeps a searchable history of all events and bottles.

**Live at:** [phina.appsmithery.co](https://phina.appsmithery.co)

---

## What it does

- **Events** — Host creates an event with a theme and shows a QR code at the venue.
- **Join in person** — Members scan the QR to join (no remote voting).
- **Wine entry** — Camera captures the label; AI (Perplexity Sonar) extracts producer, varietal, vintage, region, tasting notes, and more.
- **Check-in** — Name, email, and wine details (auto-filled from the photo).
- **Live rating rounds** — Host starts a round → push notification → everyone rates 👍 / 😐 / 👎. Ratings are blind until the host ends the event; then anonymous aggregates are revealed.
- **History** — Searchable repository of past events, wines, and ratings (read-only after an event ends).

---

## Stack

| Layer | Tech |
|-------|------|
| App | React Native + Expo (TypeScript), single codebase → PWA + iOS + Android |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Label AI | Perplexity Sonar API via Supabase Edge Function |
| Push | Expo Push (native), Web Push via VAPID (PWA) |
| Hosting | Digital Ocean (PWA on droplet), GoDaddy (domain), EAS Build for native |

---

## Getting started

1. **Clone and install**
   ```bash
   cd phina && npm install
   ```

2. **Environment** — copy `.env.example` to `.env` and set:
   - `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from your [Supabase](https://supabase.com) project
   - `EXPO_PUBLIC_APP_URL` (default `https://phina.appsmithery.co`)

3. **Database** — in Supabase SQL Editor, run the migrations in `supabase/migrations/` in order.

4. **Run**
   ```bash
   npx expo start
   ```
   Press `w` for web, or scan the QR with Expo Go on your phone (same Wi-Fi required; use `--tunnel` otherwise).

5. **Edge Functions** — the "Scan label" feature requires the `extract-wine-label` function deployed and `PERPLEXITY_API_KEY` set. See [Edge Functions deploy guide](docs/setup/EDGE_FUNCTIONS_MANUAL_DEPLOY.md).

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm start` | Start Expo dev server |
| `npm run web` | Start with web |
| `npm run export:web` | Build PWA to `dist/` |
| `npm run functions:serve` | Serve Edge Functions locally (requires Docker + `supabase start`) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | Expo lint |
| `npm test` | Run Jest tests |

**Security:** `overrides` in `package.json` pin patched versions of `minimatch` and `tar`. Re-run `npm audit` after upgrading Expo.

---

## Docs

| Doc | Description |
|-----|-------------|
| [System Architecture](docs/architecture/system-architecture.md) | Data model, auth, realtime, cross-platform patterns, push, security |
| [Roadmap](docs/planning/ROADMAP.md) | Product vision and release milestones |
| [Taste Graph](docs/architecture/taste-graph.md) | Preference graph architecture (v0.5+) |
| [Brand Guidelines](docs/brand-guidelines.md) | Palette, typography, UI principles |
| [Auth Setup](docs/setup/AUTH_SETUP.md) | Magic links, email auth, SMTP, redirect URLs |
| [Google OAuth Setup](docs/setup/GOOGLE_OAUTH_SETUP.md) | OAuth app config, deep link callback |
| [Expo Go OAuth](docs/setup/EXPO_GO_OAUTH_SETUP.md) | OAuth in Expo Go during development |
| [Edge Functions Deploy](docs/setup/EDGE_FUNCTIONS_MANUAL_DEPLOY.md) | Deploy via Supabase Dashboard (Windows CLI workaround) |
| [Development Build](docs/setup/DEVELOPMENT_BUILD.md) | Native push testing; Expo Go limitations |
| [Deploy (Digital Ocean)](docs/setup/DEPLOY_DIGITALOCEAN.md) | PWA deploy, nginx config, SSL |
| [Rating Rounds Auto-close](docs/setup/RATING_ROUNDS_AUTO_CLOSE.md) | Scheduled round closure config |
