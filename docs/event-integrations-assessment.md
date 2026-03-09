# Event Integration Assessment: Frictionless Event Creation

**Date:** March 2026
**Scope:** Partiful, CellarTracker, and adjacent platforms for reducing friction in Phína event creation and wine management.

---

## Executive Summary

Phína's current event flow is already lean — host fills four fields, gets a QR code, guests scan on arrival. The real friction lives in two adjacent jobs:

1. **Getting people in the door before the event** — there's no invite layer in Phína; hosts use other apps for that and then separately create a Phína event. These two steps are disconnected.
2. **Loading wines into an event** — label scanning with Perplexity AI is excellent but requires bottles to be physically present. Hosts who plan ahead and track their cellar elsewhere are doing double entry.

The integrations below address both problems in order of feasibility.

---

## 1. Partiful

### What It Is
Partiful is a social event RSVP app popular for intimate gatherings — exactly Phína's audience. It handles invitations, RSVPs, guest messaging, and event pages with a polished mobile-first UX.

### API Status
**No public API.** Partiful is a consumer app with no documented developer program as of early 2026. Integration must be indirect.

### Integration Options

#### Option A — Phína Join Link Embedded in Partiful (Available Now, Zero Engineering)
The simplest and highest-value path: when a host creates a Phína event, the app auto-generates a join URL (`phina.app/join/{eventId}`). The host copies this into the Partiful event description or notes field.

**Friction reduction:** guests RSVP on Partiful (familiar), see the Phína link in the event, and tap to join before they arrive. Check-in on arrival becomes a formality.

**What to build in Phína:** a prominent "Share Join Link" CTA immediately after event creation, with one-tap copy and native share sheet. Currently the join link is only accessible via the QR code screen (`/event/{id}/qr`), which is host-facing only.

```
Current flow:  Create event → event detail → tap QR → show QR
Proposed:      Create event → "Share invite link" sheet → one tap to copy/share
```

The share sheet would expose Partiful, WhatsApp, iMessage, email, and any other installed app simultaneously via the OS share API — no Partiful-specific code needed.

#### Option B — Deep Link from Partiful Event to Phína Join (Future, Requires Partiful's Help)
If Partiful ever adds universal link support or a "connect your app" integration marketplace, Phína could register to appear as an option on Partiful event pages. This would let guests tap directly from Partiful into the Phína join flow.

**Dependency:** Partiful product decision. Not actionable today.

#### Option C — Partiful RSVP Sync → Phína Guest Pre-registration (Future, Requires Partiful API)
If Partiful opened a webhook or API, confirmed RSVPs could automatically pre-register as `event_members` in Phína (with `checked_in: false`). On arrival, the host would see a list of expected guests, making check-in a confirmation rather than a discovery.

This would require storing a Partiful event ID on Phína's `events` table and a background sync function.

**Dependency:** Partiful API. Not actionable today, but the Phína schema is already compatible — `event_members` accepts pre-registration without check-in.

### Recommendation
**Build Option A now.** A prominent post-creation share sheet costs 1–2 days and eliminates the most common piece of feedback: "I had to send the link separately." Options B and C go on the future roadmap pending Partiful's API availability.

---

## 2. CellarTracker

### What It Is
CellarTracker (cellartracker.com) is the dominant personal wine cellar management platform — 15M+ wines in its community database, detailed tasting notes, drink-window tracking, and community ratings. Many serious wine enthusiasts already log their cellar there.

### API Status
**Unofficial XML/tab API exists.** CellarTracker exposes personal cellar data via authenticated GET requests (no OAuth — basic username/password in query params):

```
GET https://www.cellartracker.com/list.aspx
  ?User={username}
  &Password={password}
  &Type=List
  &Format=tab
  &Location=0
  &Quantity=1
```

Returns tab-delimited rows with: wine ID, name, vintage, producer, varietal, country, region, appellation, quantity, location, drink-from/until, price paid, and more.

A public wine database search also exists:
```
GET https://www.cellartracker.com/wine.aspx?iWine={wineId}
```

**Caveats:** This API is not publicly documented or officially supported. CellarTracker has tolerated third-party use (mobile apps like Delectable and Vivino have used it) but there are no SLA or stability guarantees. Credentials are passed in plaintext over HTTPS — acceptable for a user-initiated import but should not be stored long-term.

### Integration Options

#### Option A — One-Time Cellar Import (High Value, Moderate Effort)
Allow users to connect their CellarTracker account once to bulk-import their cellar into Phína's `wines` table.

**User flow:**
1. User taps "Import from CellarTracker" in Settings
2. Enters CellarTracker username + password (used for one request, never stored)
3. Phína Edge Function fetches the tab-delimited list, parses it, creates wine records
4. User reviews imported wines (flagging duplicates) before confirming

**Field mapping:**

| CellarTracker | Phína `wines` table |
|---|---|
| `Vintage` | `vintage` |
| `Producer` | `producer` |
| `Varietal` | `varietal` |
| `Country` + `Region` + `Appellation` | `region` (concatenated) |
| `Quantity` | `quantity` |
| `BeginConsume` / `EndConsume` | `drink_from` / `drink_until` |
| `Price` | `price_cents` |
| `Color` | `color` |
| CT wine ID | stored in `wine_attributes` as `ct_wine_id` for future sync |

Fields Phína has that CT does not: `label_photo_url`, `display_photo_url`, AI-generated content (`ai_summary`, `ai_tasting_notes`, etc.), `wine_attributes.oak`, etc. These would be blank on import and populated on demand (user taps "Enrich with AI" on any imported wine, triggering `generate-wine-summary`).

**Implementation sketch:**

```typescript
// supabase/functions/import-cellartracker/index.ts
// Deno Edge Function — user credentials never leave the function
const params = new URLSearchParams({
  User: username,
  Password: password,
  Type: "List",
  Format: "tab",
  Location: "0",
  Quantity: "1",
});
const res = await fetch(`https://www.cellartracker.com/list.aspx?${params}`);
const tsv = await res.text();
// parse TSV, map fields, insert into wines table via service role key
```

**Why an Edge Function:** keeps CellarTracker credentials server-side and never in the client bundle. The function runs with the user's JWT to write to their `wines` rows.

#### Option B — Wine Lookup During Add-Wine Flow (High Value, Low Effort)
When a user is manually entering a wine (no label available), offer "Search CellarTracker" as a lookup to pre-populate fields. This supplements the existing Perplexity label-scan path.

**User flow:** User types "Giacomo Conterno Barolo" → Phína searches CT's wine database → returns matching wines with vintage options → user selects → fields pre-fill.

This could use CT's public wine search (no auth required for lookup-only operations).

#### Option C — Consumed-Wine Sync Back to CellarTracker (Medium Value, Medium Effort)
When a user marks a wine as `status: "consumed"` in Phína, optionally decrement the quantity in CellarTracker. This keeps both systems in sync for users who manage their cellar in CT as the source of truth.

**Dependency:** Requires the user's CT ID stored on the wine record (populated at import time — see `ct_wine_id` in Option A). CT's API for writes (consuming a bottle) is even less documented; this may require form submission simulation.

### Recommendation
**Build Option A as a one-time import** — it's the highest-value integration for users who already maintain a CellarTracker cellar. The import creates immediate value (all wines already in Phína), and the AI enrichment path is already built. **Option B** is a low-effort quality-of-life improvement for manual entry. **Option C** is nice-to-have but depends on CT write API reliability.

---

## 3. Calendar Integration (Google Calendar / Apple Calendar)

### What It Is
Native OS calendar integration — when a Phína event is created, add it to the host's calendar with the join link embedded.

### API Status
**Available now on all platforms.** Expo provides `expo-calendar` for native (iOS/Android) calendar access. For web, the universal approach is generating an `.ics` file (iCal format) that any calendar app can import, or generating a Google Calendar "add event" deep link.

### Integration Options

#### Option A — "Add to Calendar" on Event Creation (Low Effort, High Polish)
After creating a Phína event, offer a single "Add to Calendar" button that:
- **Native (iOS/Android):** Uses `expo-calendar` to write an event with title, date, notes containing the join URL
- **Web (PWA):** Generates a `.ics` download OR opens `https://calendar.google.com/calendar/render?action=TEMPLATE&...` with pre-filled fields

**Value:** The event appears in the host's calendar with the join link attached — they can forward the calendar invite to guests who use calendar-based coordination.

#### Option B — Shareable Calendar Invite for Guests (Medium Effort)
Generate a `.ics` file from the Phína event that guests can add to their calendar. The event would include:
- Title: event name from Phína
- Date/time
- Notes: "Join the tasting at phina.app/join/{eventId}"
- Optionally: a list of wines if pre-loaded

This is a static file generated by a Supabase Edge Function — no external API dependency.

### Recommendation
**Option A is a 1-day add** using `expo-calendar` for native and a Google Calendar deep link for web. It improves host workflow without requiring new permissions. **Option B** adds a guest-facing shareable artifact that complements the Partiful sharing flow.

---

## 4. Vivino

### What It Is
The largest wine community app (80M+ users), with community ratings, professional reviews, and a massive wine database. Users already have Vivino ratings for many wines.

### API Status
**No public API.** Vivino has no documented developer program. Past third-party integrations used undocumented internal endpoints, which Vivino has intermittently blocked.

### Integration Potential
- **Wine database enrichment:** Vivino's wine data (producer, region, community rating) could supplement Perplexity extraction for unrecognized labels
- **Rating comparison:** Display community Vivino ratings alongside Phína blind ratings to show how a group's blind assessment compares to crowdsourced consensus — this would be a compelling differentiator
- **Share to Vivino:** Let users log a tasting as a Vivino check-in from Phína's wine detail screen

### Recommendation
**Monitor for API availability.** The rating-comparison angle is genuinely differentiated (blind group taste vs. crowd consensus) and worth pursuing if Vivino opens a partner API. No actionable path today without reverse-engineering their internal API, which carries ToS and reliability risk.

---

## 5. Wine-Searcher

### What It Is
A wine pricing and merchant availability database with coverage across 100K+ merchants worldwide. Used for price discovery and purchase sourcing.

### API Status
**Commercial API available** (Wine-Searcher Pro subscription or direct B2B partnership). Pricing data is available programmatically.

### Integration Potential
- **Price intelligence in cellar:** Display current market value of wines in storage alongside the purchase price already tracked in Phína (`price_cents`)
- **Wine detail screen enrichment:** "Where to buy" links for wines in events
- **Drink window + value alerts:** Notify users when a wine approaches its drink window and is currently at peak market price

### Recommendation
**Low priority until Phína has revenue to support the API cost.** The cellar `price_cents` field is already in the schema — price display is table-stakes for serious collectors. Worth a partnership conversation when Phína reaches the collector audience segment.

---

## 6. Contacts Integration (Guest Pre-invitation)

### What It Is
iOS Contacts / Google Contacts access to build a guest list UI within Phína — host selects contacts, Phína sends them the join link via SMS/iMessage.

### API Status
**Available via `expo-contacts`** (requires permission). Sending via native SMS requires `expo-sms` (iOS/Android) or a Twilio/AWS SNS backend for web.

### Integration Potential
Replace the "host shows QR code at the door" model with a pre-event invite sent directly from Phína to the guest list. Guests receive a link they can tap before arriving — no QR scan required. This also enables:
- Pre-registration (Phína can pre-populate `event_members` when a guest taps their link)
- Guest count visibility before the event
- Push notification opt-in before the event

### Recommendation
**Medium-term roadmap.** This changes the event access model from QR-only to link + QR, which meaningfully expands the guest experience. Requires careful thought about whether the "physical presence" requirement (currently enforced socially by the QR-at-venue model) should remain or be relaxed. The `event_members` schema already supports pre-registration (`checked_in: false`).

---

## 7. Other Platforms: Quick Take

| Platform | API Status | Phína Fit | Priority |
|---|---|---|---|
| **Eventbrite** | Public API | Low — too formal/ticketed for intimate tastings | Skip |
| **Luma** | Limited API | Medium — growing events platform, similar Partiful use case | Watch |
| **Notion/Airtable** | Public APIs | Export wine/event data for wine clubs that log externally | Low |
| **Instagram** | Graph API | Share tasting results as story cards post-event | Nice-to-have |
| **WhatsApp Business** | Cloud API | Programmatic invite sending (alternative to SMS) | Low |
| **OpenTable/Resy** | Fragmented | Restaurant context; not core | Skip |

---

## Integration Roadmap

### Phase 1 — Zero New Dependencies (Weeks 1–3)
| Feature | Effort | What It Fixes |
|---|---|---|
| Post-creation "Share Invite Link" sheet | 1 day | Disconnected Partiful/WhatsApp/iMessage invite flow |
| "Add to Calendar" on event creation | 1 day | Host never has the Phína join link in their calendar |
| Manual wine search via CellarTracker wine DB | 2 days | Manual wine entry friction (no label available) |

### Phase 2 — One-Time Import (Weeks 4–8)
| Feature | Effort | What It Fixes |
|---|---|---|
| CellarTracker cellar import (Edge Function) | 3–4 days | Double entry for users who track cellar in CT |
| AI enrichment of imported wines on demand | 1 day | Imported wines lack tasting notes / AI content |
| Guest shareable `.ics` calendar invite | 1 day | No guest-facing calendar artifact |

### Phase 3 — Platform Relationships Required
| Feature | Dependency | What It Enables |
|---|---|---|
| Partiful RSVP sync | Partiful API | Pre-registered guest list, smoother check-in |
| Vivino rating comparison | Vivino API | Blind vs. crowd-consensus rating display |
| Wine-Searcher price intelligence | Commercial API | Current market value in cellar |
| Contacts-based pre-invitation | Internal decision on access model | Pre-event invite flow, no QR required |

---

## Key Design Principle for All Integrations

Phína's value is the **experience at the table** — the blind reveal, the live reaction, the shared discovery. Integrations should reduce friction *before* the event (invites, cellar setup) and *after* (sharing results) without touching the core tasting experience. Nothing should compromise the real-time blind integrity or make the in-room UX more complex.

Each integration should be **optional and additive** — a Phína event works perfectly without any of them.
