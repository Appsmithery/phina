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

- **Wine entry** — Camera captures the label; AI extracts producer, varietal, vintage, region, tasting notes, and more.
- **Wine detail** — Full AI-extracted profile per bottle: producer, varietal, vintage, region, AI tasting summary, drink window.

**The personal data layer** — the blind-tasting data moat

- **History** — Searchable repository of past events, wines, and anonymous ratings (read-only after an event ends).
- **Taste profile** — Preferences accumulated across events from genuinely blind rounds: no label bias, no price anchoring.

---

## Stack

| Layer    | Tech                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------- |
| App      | React Native + Expo (TypeScript), single codebase → PWA + iOS + Android                                 |
| Backend  | Supabase (Postgres, Auth, Storage, Edge Functions)                                                      |
| Label AI | Perplexity Sonar API via Supabase Edge Function                                                         |
| Push     | Expo Push (native), Web Push via VAPID (PWA)                                                            |
| Hosting  | DigitalOcean (PWA on droplet), EAS Build/Update (native delivery), Supabase (backend), GoDaddy (domain) |

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

5. **Edge Functions**
   - The "Scan label" flow requires `extract-wine-label` deployed with `PERPLEXITY_API_KEY` set.
   - The bottle image flow requires `generate-bottle-image` deployed with `GEMINI_API_KEY` set.
   - The JWT-protected AI functions in this repo must be deployed with gateway JWT verification disabled because they verify the user JWT internally via JWKS:
     - `npm run functions:deploy:extract-wine-label`
     - `npm run functions:deploy:generate-bottle-image`
     - `npm run functions:deploy:generate-wine-summary`
   - If you deploy from the Supabase Dashboard instead of the CLI, turn off **Verify JWT** / **Verify JWT with legacy secret** for those three functions.

## Supabase Production

- Hosted Supabase Auth production settings are managed in the Supabase dashboard, not through `supabase/config.toml`.
- Before launch, work through [docs/SUPABASE_PRODUCTION.md](D:/APPS/phina/docs/SUPABASE_PRODUCTION.md) for:
  - auth URL configuration and email templates
  - Resend SMTP for Supabase Auth using `mail.phina.appsmithery.co`
  - custom SMTP with link tracking disabled
  - RLS / Security Advisor checks
  - owner MFA, availability, and recovery settings
- For the exact Resend-to-Supabase SMTP values, use [docs/RESEND_SUPABASE_AUTH.md](D:/APPS/phina/docs/RESEND_SUPABASE_AUTH.md).

## Native release model

- The **droplet** hosts the web/PWA build only.
- **iOS/Android binaries** are built through **Expo EAS** and distributed via TestFlight,
  the App Store, Play internal testing, and Google Play.
- **Supabase** remains the backend for both web and native clients.
- In a **development build**, seeing your PC's `192.168.x.x:8081` Metro address is
  expected because the dev client pulls JS from your local machine.
- For release workflow details and cost assumptions, see
  `docs/MOBILE_RELEASES.md`.
