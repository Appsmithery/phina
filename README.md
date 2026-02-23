# Phína

A wine club app that digitizes themed tasting events: members snap a photo of their bottle label, the app extracts wine details with AI, and hosts run live anonymous rating rounds via push notification. A persistent database keeps a searchable history of all events and bottles.

**Live at:** [phina.appsmithery.co](https://phina.appsmithery.co)

---

## What it does

- **Events** — Host creates an event with a theme and shows a QR code at the venue.
- **Join in person** — Members scan the QR to join (no remote voting).
- **Wine entry** — Camera captures the label; AI (Perplexity Sonar) extracts producer, varietal, vintage, region and optional background summary.
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
   - For label scanning (Scan label on Add wine): set `PERPLEXITY_API_KEY` in `.env` for local Edge Function runs, and `supabase secrets set PERPLEXITY_API_KEY=pplx-...` for deployed functions. Get a key at [Perplexity API](https://perplexity.ai/account/api).
3. **Database**
   - In Supabase: SQL Editor → run the migrations in `supabase/migrations/` in order (e.g. `001_initial.sql`).
   - In Authentication → Providers, enable Email and optionally disable "Confirm email" for magic links during dev. **If you never receive the magic link email**, see [Auth setup](docs/AUTH_SETUP.md) (redirect URLs, SMTP, and team email limits).
4. **Assets**
   - Add app icon and splash images under `assets/` (see `assets/README.md`). If missing, you may need to point `app.config.ts` at placeholder assets to run.
5. **Run**
   ```bash
   npx expo start
   ```
   Then press `w` for web, or scan with Expo Go for native.

**Edge Functions (label extraction)**

The “Scan label” feature calls the `extract-wine-label` Edge Function. You can either run it locally (needs Docker) or deploy it to your hosted project (no Docker).

- **Local (requires [Docker Desktop](https://docs.docker.com/desktop))**
  1. Start the local Supabase stack: `npx supabase start`
  2. Serve the function: `npm run functions:serve` (or `npx supabase functions serve extract-wine-label`)
  3. Point the app at local Supabase (e.g. set `EXPO_PUBLIC_SUPABASE_URL` to the URL from `supabase start`) so the app calls the local function.
- **Deploy to hosted project (no Docker)**  
  Use your existing Supabase project URL; the app will call the deployed function.
  1. Link the CLI to your project: `npx supabase link --project-ref YOUR_REF` (ref from Supabase dashboard URL).
  2. Deploy: `npx supabase functions deploy extract-wine-label`
  3. Set the secret: `npx supabase secrets set PERPLEXITY_API_KEY=pplx-...`
  Your app already uses `EXPO_PUBLIC_SUPABASE_URL`; once the function is deployed and the secret set, “Scan label” will use it.

**Scripts**

| Command | Description |
|--------|-------------|
| `npm start` | Start Expo dev server |
| `npm run web` | Start with web |
| `npm run export:web` | Build PWA to `dist/` |
| `npm run functions:serve` | Serve `extract-wine-label` locally (requires `supabase start` + Docker) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | Expo lint |
| `npm test` | Run Jest tests |

**Security:** We use `overrides` in `package.json` to pin patched versions of `minimatch` and `tar`. Most other audit findings are in transitive Expo/Jest/React Native deps; fixing them with `npm audit fix --force` would apply breaking version changes. Re-run `npm audit` after upgrading Expo (e.g. `npx expo install expo@latest`) when newer SDKs ship with updated dependencies.

---

## Docs

- [Roadmap & architecture](docs/ROADMAP.md) — Context, data model, screen flow, and implementation order.
