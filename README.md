# phína

**Run a blind tasting in minutes. Scan. Rate. Reveal.**

Phína turns any wine club night, themed tasting, or dinner party into a smooth, memorable experience. A host creates an event and shows a QR code at the venue. Members snap their bottle label — AI extracts the wine details instantly. The host opens rating rounds: everyone votes 👍 / 😐 / 👎 blind, ratings lock, and the full anonymous results reveal together at the end. No sign-in sheets. No paper scorecards. No bias.

**Live at:** [phina.appsmithery.co](https://phina.appsmithery.co)

---

## What it does

**The live group experience** — what no other wine app has
- **Events** — Host creates an event with a theme and shows a QR code at the venue.
- **Join in person** — Members scan the QR to join (physical presence required; no remote voting).
- **Live rating rounds** — Host starts a round → push notification → everyone votes blind. Ratings lock when the host ends the round.
- **Results reveal** — Host ends the event → all wines show anonymous aggregate scores simultaneously. No individual votes are ever exposed.

**The knowledge layer** — for the curious drinker
- **Wine entry** — Camera captures the label; AI (Perplexity Sonar) extracts producer, varietal, vintage, region, tasting notes, and more.
- **Wine detail** — Full AI-extracted profile per bottle: producer, varietal, vintage, region, AI tasting summary, drink window.

**The personal data layer** — the blind-tasting data moat
- **History** — Searchable repository of past events, wines, and anonymous ratings (read-only after an event ends).
- **Taste profile** — Preferences accumulated across events from genuinely blind rounds: no label bias, no price anchoring.

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
