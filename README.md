# Phína

A wine club app that digitizes themed tasting events: members snap a photo of their bottle label, the app extracts wine details with AI, and hosts run live anonymous rating rounds via push notification. A persistent database keeps a searchable history of all events and bottles.

**Live at:** [phina.appsmithery.co](https://phina.appsmithery.co)

---

## What it does

- **Events** — Host creates an event with a theme and shows a QR code at the venue.
- **Join in person** — Members scan the QR to join (no remote voting).
- **Wine entry** — Camera captures the label; AI (Claude Vision) extracts producer, varietal, vintage, region and optional background summary.
- **Check-in** — Name, email, and wine details (auto-filled from the photo).
- **Live rating rounds** — Host starts a round → push notification → everyone rates 👍 / 😐 / 👎. Ratings are blind until the host ends the event; then anonymous aggregates are revealed.
- **History** — Searchable repository of past events, wines, and ratings (read-only after an event ends).

---

## Stack

| Layer | Tech |
|-------|------|
| App | React Native + Expo (TypeScript), single codebase → PWA + iOS + Android |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Label AI | Claude Vision API via Supabase Edge Function |
| Push | Expo Push (native), Web Push (PWA) |
| Hosting | Vercel (PWA), EAS Build for native |

---

## Development

1. **Clone and install**
   ```bash
   cd phina && npm install
   ```
2. **Environment**
   - Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from your [Supabase](https://supabase.com) project.
   - Optional: set `EXPO_PUBLIC_APP_URL` (default `https://phina.appsmithery.co`).
3. **Database**
   - In Supabase: SQL Editor → run the migrations in `supabase/migrations/` in order (e.g. `001_initial.sql`).
   - In Authentication → Providers, enable Email and optionally disable "Confirm email" for magic links during dev.
4. **Assets**
   - Add app icon and splash images under `assets/` (see `assets/README.md`). If missing, you may need to point `app.config.ts` at placeholder assets to run.
5. **Run**
   ```bash
   npx expo start
   ```
   Then press `w` for web, or scan with Expo Go for native.

---

## Docs

- [Roadmap & architecture](docs/ROADMAP.md) — Context, data model, screen flow, and implementation order.
