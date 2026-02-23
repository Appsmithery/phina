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

## Docs

- [Roadmap & architecture](docs/ROADMAP.md) — Context, data model, screen flow, and implementation order.
