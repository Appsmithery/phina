---
prd_id: PRD-2026-004
title: "Help me pick"
status: Draft
owner: "[TBD]"
area: "Discovery"
target_release: "v0.6"
roadmap: "../ROADMAP.md"
plans:
  cursor: "../Plans/PRD-2026-004__cursor-plan.md"
  claude: "../Plans/PRD-2026-004__claude-plan.md"
---

# PRD-2026-004: Help me pick

> **Status:** 🧠 Draft
> **Priority:** P1 (High)
> **Owner:** [TBD]
> **Target Release:** v0.6
> See [planning guide](../planning%20guide.md) for PRD naming, IDs, and when to update the roadmap.
> **Depends on:** [PRD-2026-003 (User preferences)](./PRD-2026-003__user-preferences-social-data-wines.md), [Taste Graph](../../architecture/taste-graph.md)

---

## Problem Statement

Users build a taste profile through event ratings and personal wine logging, but there is no way to *use* that profile in the real world. When a user is standing in a wine shop, reading a restaurant wine list, or planning a meal, the app offers no guidance. The roadmap currently splits this into three separate Later ideas (shop wine picker, recipe/meal pairing, dining out), each with its own PRD pipeline, despite sharing the same underlying need: "given what I like, help me choose." Consolidating them into a single contextual discovery feature reduces scope fragmentation, ships a cohesive UX, and lets us iterate on one AI pipeline instead of three.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Discovery sessions per active user per month | 0 | ≥ 2 within 60 days of launch | Analytics event `help_me_pick_session_start` |
| Recommendation acceptance rate | N/A | ≥ 40% of sessions end with user saving or rating a recommendation | Analytics event `recommendation_accepted` |
| Context adoption (all three modes used) | N/A | ≥ 20% of users try more than one mode within 30 days | Distinct `context` values per user |
| Taste Graph enrichment | Baseline ratings only | ≥ 30% of discovery sessions produce a new rating or note | Rating/note writes after discovery |

---

## Solution Overview

A single entry point — **"Help me pick"** — accessible from the main tab bar or a floating action button. The user chooses (or the app infers) one of three **contexts**, each with a tailored input method but sharing the same Taste Graph–powered recommendation engine:

| Context | Primary input | Secondary input | Output |
|---------|--------------|-----------------|--------|
| **Wine shop** | Multi-bottle photo (shelf or group of labels) | Optional filters (budget, occasion, pairing) | Ranked picks from the photographed bottles with taste-match explanation |
| **Restaurant** | Menu/wine-list photo | Optional filters (course, budget, mood) | Top picks from the menu with taste-match explanation |
| **Cooking** | Chat message and/or document upload (recipe PDF/image/URL) | Conversational follow-ups | Wine pairing recommendation(s) with explanation |

All three contexts feed results back into the Taste Graph: the user can save a recommended wine, rate it later, or add notes — closing the loop.

### User Stories

- **As a** wine club member standing in a shop, **I want** to photograph the shelf and get instant recommendations matched to my taste, **so that** I buy wines I'll enjoy without guesswork.
- **As a** diner at a restaurant, **I want** to photograph the wine list and get ranked suggestions that match my preferences and my meal, **so that** I order confidently.
- **As a** home cook planning a dinner, **I want** to share a recipe (photo, PDF, or link) and have a conversation about what wine to pair, **so that** my meal and wine complement each other.
- **As a** returning user, **I want** my past discovery sessions to refine future recommendations, **so that** the app gets better at picking for me over time.

---

## Functional Requirements

### Core Features

#### 1. Dedicated tab — "Help me pick"

- A new **"Help me pick"** tab in the bottom tab bar, alongside Events, Cellar, Admin, and Profile.
- The tab landing screen shows three context cards (Wine shop, Restaurant, Cooking). Tapping a card navigates to that context's dedicated sub-page.
- Admin tab visibility rules are unchanged (admin-only); "Help me pick" is visible to all authenticated users.
- Acceptance criteria: "Help me pick" tab is always present in the footer; each context card navigates to its own sub-page in ≤ 1 tap.

#### 2. Wine shop context — multi-bottle photo ingestion

- Camera flow supports **multi-photo capture**: user can take 1–5 photos of a shelf, display, or individual bottles before submitting.
- Each photo is sent to an Edge Function that performs **batch label extraction** — identifying multiple bottles per image where possible.
- Extracted bottles are listed in a review screen; user can remove false positives or add manual entries.
- User can set optional **search parameters** (filters): budget range, occasion (e.g. "dinner party", "gift"), food pairing intent (free text or tag).
- After confirmation, the Taste Graph recommendation engine scores each bottle against the user's profile + filters and returns a **ranked list** with per-bottle explanations ("matches your preference for full-bodied reds; similar to [wine you rated 👍 at Event X]").
- Acceptance criteria: multi-photo capture → batch extraction → ranked recommendations with explanations, incorporating Taste Graph and user filters.

#### 3. Restaurant context — menu photo

- Camera flow for **single or multi-photo** capture of a wine list or menu page.
- Edge Function extracts wine entries from the menu image (OCR + structured parsing).
- User can set optional **search parameters**: course they're ordering (appetizer, entrée, dessert), budget ceiling, mood (adventurous vs. safe pick).
- Recommendation engine scores extracted wines against Taste Graph + filters → ranked suggestions with explanations.
- If the menu image is low quality or extraction confidence is low, prompt the user to retake or manually enter wines.
- Acceptance criteria: menu photo → extraction of wine-list items → ranked recommendations with taste-match explanations.

#### 4. Cooking context — chat interface with document upload

- Chat-style UI: user types a message ("I'm making coq au vin tonight, what should I drink?") or uploads a document (recipe image, PDF, URL).
- The system parses the recipe/message to derive a **meal profile** (protein, sauce, dominant flavors, richness, regional origin if applicable).
- The recommendation engine suggests 1–3 wines that pair well, drawing from the user's Taste Graph and optionally from their cellar inventory (if personal cellars exist).
- Conversational follow-ups supported: user can refine ("something cheaper", "I don't like Pinot Noir", "what about a white instead?").
- Acceptance criteria: user can submit a recipe or description via chat and receive contextual pairing recommendations; follow-up messages refine results.

#### 5. Recommendation engine (shared)

- Consumes the member's Taste Graph (weighted preferences, rating history, metadata from PRD-2026-003).
- Accepts a set of candidate wines (from photo extraction, menu extraction, or general wine knowledge).
- Accepts optional user-defined filters/parameters per context.
- Returns ranked results with natural-language explanations grounded in the user's taste profile.
- Implementation: Supabase Edge Function calling an LLM (e.g. Perplexity Sonar or OpenAI) with structured prompt containing taste profile + candidates + filters.
- Acceptance criteria: engine returns ranked, explained recommendations; recommendations are demonstrably personalized (different users get different rankings for the same input).

#### 6. Feedback loop

- From any recommendation result, the user can: **save** the wine to their cellar (creating a `wines` record not tied to an event), **rate** it immediately (thumbs up/meh/down), or **dismiss** it.
- Saves and ratings feed back into the Taste Graph, improving future recommendations.
- Discovery sessions are logged (context, input summary, recommendations shown, user actions) for future analytics and model improvement.
- Acceptance criteria: user can save or rate from recommendation results; new ratings appear in Taste Graph computations.

### Edge Cases & Error Handling

- **Poor photo quality / no bottles detected:** Show a clear message ("No bottles found — try a closer photo or better lighting") with a retake option.
- **Menu extraction yields zero wines:** Prompt user to retake or switch to manual entry; don't show an empty recommendation list.
- **User has no Taste Graph data (new user):** Fall back to general popularity or sommelier-style heuristics; show a nudge ("Rate more wines to get personalized picks").
- **Offline:** Camera capture works offline; extraction and recommendations require connectivity. Queue the captured photos and process when back online, or show a clear offline message.
- **Rate limiting / cost:** LLM calls per session are bounded (e.g. max 10 chat turns in cooking mode); display a friendly limit message.
- **Multi-bottle extraction duplicates:** Deduplicate by producer + varietal + vintage before scoring.

---

## Technical Context

### Relevant Files & Directories

```
lib/last-label-extraction.ts          — WineExtraction interface (reuse/extend)
app/scan-label.tsx                    — existing single-label camera flow (reference)
app/event/[id]/scan-label.tsx         — event-scoped label scan (reference)
supabase/functions/extract-wine-label/ — existing extraction Edge Function (extend for batch)
app/(tabs)/profile.tsx                — Taste Graph client-side computation (reference)
docs/architecture/taste-graph.md      — Taste Graph architecture
```

### Key Dependencies

- **Perplexity Sonar Pro (or equivalent vision LLM):** Label and menu extraction; recommendation generation.
- **Supabase Edge Functions:** Orchestration of extraction + recommendation pipeline.
- **Supabase Storage:** Uploaded photos (label-photos bucket, potentially a new discovery-photos bucket).
- **Taste Graph (PRD-2026-003 + existing signals):** Member preference data consumed by the recommendation engine.
- **expo-camera:** Multi-photo capture on native; web fallback via file picker.

### Database/Schema Changes

| Change | Description |
|--------|-------------|
| `discovery_sessions` table | Logs each "Help me pick" session: `id`, `member_id`, `context` (shop/restaurant/cooking), `input_summary` (JSONB), `created_at`. |
| `discovery_recommendations` table | Per-session recommendations: `id`, `session_id FK`, `wine_candidate` (JSONB — extracted wine data), `rank`, `explanation`, `user_action` (saved/rated/dismissed/null). |
| `wines` — nullable `event_id` | If not already nullable, allow wines to exist without an event (personal cellar + discovery saves). |
| RLS | `discovery_sessions` and `discovery_recommendations` are member-scoped (read/write own only). |

### API Changes

| Endpoint / Function | Method | Description |
|---------------------|--------|-------------|
| `extract-wine-batch` | Edge Function (POST) | Accepts 1–5 images, returns array of `WineExtraction` objects. Extends existing `extract-wine-label` logic. |
| `extract-menu` | Edge Function (POST) | Accepts 1–3 menu images, returns array of parsed wine-list entries (name, price, description). |
| `recommend-wines` | Edge Function (POST) | Accepts `{ member_id, candidates: WineExtraction[], filters: {...}, context }`, fetches Taste Graph, returns ranked recommendations with explanations. |
| `parse-recipe` | Edge Function (POST) | Accepts text, image, PDF, or URL; returns a structured meal profile (JSONB). |

### Architecture Notes

- The **recommendation engine** runs server-side (Edge Function with service role key) so it can read the member's full rating history without exposing raw data to the client. It calls an LLM with a structured prompt containing the serialized taste profile, candidate wines, and filters.
- **Batch extraction** reuses the existing Perplexity Sonar vision call but with a modified prompt requesting multiple wine entries per image. The existing `normalizeWineExtraction` pattern is extended to handle arrays.
- **Chat (cooking context)** is implemented as a stateful conversation: each message sends the conversation history + meal profile + taste profile to the LLM. Session state is managed client-side (in-memory or AsyncStorage) with the `discovery_sessions` table as the persistence layer.
- **Privacy:** The recommendation engine reads the member's own data only. No cross-member data is used in v0.6. Future collaborative filtering (if any) would be a separate, server-side-only feature.

---

## Implementation Handoff

### Critical Files to Modify

| File | Purpose | Key Changes |
|------|---------|-------------|
| `supabase/migrations/0XX_discovery_tables.sql` | Schema | Create `discovery_sessions` and `discovery_recommendations`; RLS policies. |
| `supabase/functions/extract-wine-batch/index.ts` | New Edge Function | Multi-image batch extraction. |
| `supabase/functions/extract-menu/index.ts` | New Edge Function | Menu/wine-list OCR + structured parsing. |
| `supabase/functions/recommend-wines/index.ts` | New Edge Function | Taste Graph–powered ranking and explanation. |
| `supabase/functions/parse-recipe/index.ts` | New Edge Function | Recipe → meal profile extraction. |
| `app/(tabs)/pick.tsx` | New tab screen | "Help me pick" landing — three context cards. |
| `app/(tabs)/_layout.tsx` | Tab layout | Add "Help me pick" tab (all authenticated users). |
| `app/pick/shop.tsx` | New sub-page | Wine shop flow: multi-photo capture → review → recommendations. |
| `app/pick/restaurant.tsx` | New sub-page | Restaurant flow: menu photo → review → recommendations. |
| `app/pick/cooking.tsx` | New sub-page | Cooking chat interface. |
| `app/pick/results.tsx` | New sub-page | Shared recommendation results with save/rate/dismiss actions. |
| `lib/taste-graph.ts` | New module | Extract Taste Graph computation from `profile.tsx` into a shared module consumable by recommendation logic (or serialize for Edge Function). |

### Implementation Constraints

- DO NOT modify the existing event-based rating flow or anonymity model.
- DO NOT expose any member's Taste Graph data to other members.
- MUST reuse the existing `WineExtraction` interface shape; extend, don't replace.
- MUST preserve the existing `extract-wine-label` Edge Function (batch function is a new, separate function).
- DO NOT implement collaborative filtering or cross-member recommendations in this PRD.

### Verification Commands

```bash
npm run typecheck
npm run lint

# Manual verification:
# 1. Open "Help me pick" → select Wine shop → capture 2 photos → verify batch extraction → verify ranked recommendations
# 2. Open "Help me pick" → select Restaurant → capture menu photo → verify wine-list extraction → verify recommendations
# 3. Open "Help me pick" → select Cooking → type a recipe description → verify pairing recommendation → send a follow-up → verify refined result
# 4. From any recommendation, tap "Save" → verify wine appears in cellar
# 5. Rate a saved discovery wine → verify it appears in Taste Graph on profile
```

### Decisions Made

- [x] **Single feature, not three PRDs:** Consolidates shop picker, restaurant, and cooking pairing into one "Help me pick" feature with three contexts. Rationale: shared recommendation engine, shared UX pattern, simpler roadmap.
- [x] **Server-side recommendation engine:** Taste Graph is read and scored server-side via Edge Function to protect member data privacy. Rationale: privacy model requires service role access.
- [x] **Batch extraction as a new Edge Function:** Separate from `extract-wine-label` to avoid breaking the existing single-label flow. Rationale: different prompt structure and response shape.
- [x] **Chat for cooking only:** The restaurant and shop flows are photo-first, not conversational. Cooking is inherently iterative ("what about a white instead?") so chat is the right UX. Rationale: match input modality to real-world behavior.
- [x] **Feedback loop through existing rating system:** Discovery recommendations feed into the same `ratings` + `wines` tables, not a parallel system. Rationale: one Taste Graph, one data model.
- [x] **Dedicated bottom tab:** "Help me pick" is a tab in the footer alongside Events, Cellar, Admin (admin-only), and Profile — not a FAB. Each context (shop, restaurant, cooking) gets its own sub-page within the tab's navigation stack. Rationale: maximizes discoverability; consistent with existing tab-based navigation.

---

## Implementation Guidance

### Suggested Approach

1. **Schema & types:** Create `discovery_sessions` and `discovery_recommendations` tables with RLS. Update TypeScript types.
2. **Extract Taste Graph module:** Refactor the weighted preference computation out of `profile.tsx` into `lib/taste-graph.ts` so it can be serialized and sent to Edge Functions.
3. **Batch extraction Edge Function:** Build `extract-wine-batch` by extending the existing Sonar prompt to handle multiple bottles per image and multiple images per request.
4. **Menu extraction Edge Function:** Build `extract-menu` with an OCR-optimized prompt for wine list parsing.
5. **Recipe parsing Edge Function:** Build `parse-recipe` to accept text, image, or URL and return a structured meal profile.
6. **Recommendation Edge Function:** Build `recommend-wines` that takes candidates + taste profile + filters and returns ranked results with explanations.
7. **UI — entry point:** Build the "Help me pick" screen with context selector.
8. **UI — wine shop flow:** Multi-photo capture → batch extraction review → filters → results.
9. **UI — restaurant flow:** Menu photo capture → extraction review → filters → results.
10. **UI — cooking chat:** Chat interface with document upload → pairing recommendations → follow-ups.
11. **UI — shared results screen:** Recommendation cards with save/rate/dismiss; feedback loop to Taste Graph.
12. **Analytics:** Instrument session start, context selection, recommendation shown, and user actions.

### Testing Requirements

- [ ] Unit tests for Taste Graph module (`lib/taste-graph.ts`) — preference computation with known inputs.
- [ ] Edge Function integration tests for each new function (mock LLM responses).
- [ ] Manual QA: end-to-end flow for each context (shop, restaurant, cooking).
- [ ] RLS verification: member A cannot read member B's discovery sessions or recommendations.
- [ ] Offline handling: camera capture works offline; extraction shows connectivity error gracefully.
- [ ] Performance: batch extraction with 5 images completes within 30 seconds.

### Out of Scope

- Collaborative filtering or cross-member recommendations (future, requires privacy design).
- Location-based features (OpenTable/Resy/Google Maps integration) — deferred to a later release.
- Price lookup from external databases — use only what's visible in the photo or user-supplied.
- In-app wine purchasing or e-commerce links.
- Cellar inventory matching in shop/restaurant contexts (future enhancement; cooking context may optionally reference cellar if available).

---

## Design & UX

### Tab & navigation

"Help me pick" is a dedicated bottom tab (icon + label) in the main tab bar, sitting alongside Events, Cellar, Admin (admin-only), and Profile. Tapping the tab opens the context-selection landing screen with three illustrated cards:

| Card | Icon/illustration | Tagline |
|------|-------------------|---------|
| Wine shop | Bottle + shelf | "Photo the shelf, I'll pick for you" |
| Restaurant | Wine glass + menu | "Snap the wine list, I'll suggest" |
| Cooking | Pot + chat bubble | "Tell me what you're making" |

Each card navigates to a **dedicated sub-page** for that context. The sub-pages live under the "Help me pick" tab's navigation stack so the user can always go back to the context selector.

### Key Interactions

- **Wine shop sub-page:** Tap card → navigate to shop screen → camera opens → capture 1–5 photos → "Done" → extraction review list → optional filters bottom sheet → "Find my picks" → ranked results.
- **Restaurant sub-page:** Tap card → navigate to restaurant screen → camera opens → capture 1–3 photos → extraction review → optional filters → "Find my picks" → ranked results.
- **Cooking sub-page:** Tap card → navigate to cooking chat screen → type or upload → assistant responds with pairing → user can follow up or accept.
- **Results (shop/restaurant):** Each recommendation card shows: wine name, brief taste-match explanation, match score (e.g. 92%), save/rate/dismiss actions. Tapping a card expands to full detail (extraction fields + AI explanation).
- **Cooking results:** Inline in chat as rich message cards with save/rate actions.
- **Back navigation:** Each sub-page has a back arrow returning to the "Help me pick" landing. Tab bar remains visible throughout.

---

## Rollout Plan

| Phase | Description | Audience | Success Gate |
|-------|-------------|----------|--------------|
| 1 | Recommendation engine + wine shop context | Internal testers | Batch extraction works; recommendations are personalized. |
| 2 | Add restaurant context | Internal testers | Menu extraction works; recommendations quality ≥ shop. |
| 3 | Add cooking chat context | Internal testers | Chat is coherent; pairing recommendations are sensible. |
| 4 | GA — all three contexts | All users | Adoption metrics met (see Success Metrics). |

### Feature Flags

- Flag name: `help_me_pick_enabled`
- Default state: off (enabled for testers in phases 1–3, GA in phase 4)
- Per-context flags (optional): `help_me_pick_shop`, `help_me_pick_restaurant`, `help_me_pick_cooking`

---

## Open Questions

- [ ] **LLM provider for recommendations:** Continue with Perplexity Sonar, or use OpenAI / Anthropic for the recommendation + chat steps? Sonar's web grounding may help with wine knowledge; chat quality may be better with other providers.
- [ ] **Batch extraction prompt design:** Should multi-bottle extraction be one call per image or one call with all images? (Cost vs. accuracy trade-off.)
- [ ] **Menu OCR quality:** Is Sonar vision sufficient for OCR on printed wine lists, or do we need a dedicated OCR step (e.g. Google Cloud Vision) before the LLM?
- [ ] **Cellar integration in cooking context:** If the user has a personal cellar, should cooking mode suggest wines from their cellar first, or only general recommendations?
- [ ] **Session persistence:** Should discovery sessions persist across app restarts (AsyncStorage) or be ephemeral?
- [x] **Tab bar vs. FAB:** Decided: dedicated bottom tab alongside Events, Cellar, Admin, and Profile. Each context has its own sub-page under the tab's navigation stack.
- [ ] **Offline photo queuing:** Worth building queued upload for offline-captured photos, or simply require connectivity?

---

## References

- [ROADMAP.md](../ROADMAP.md) — v0.5 (preferences foundation) and v0.6 (discovery).
- [PRD-2026-003: User preferences and social data for wines](./PRD-2026-003__user-preferences-social-data-wines.md) — prerequisite for Taste Graph data.
- [Taste Graph architecture](../../architecture/taste-graph.md) — signal sources, weighted preference algorithm, evolution plan.
- [Existing label extraction Edge Function](../../supabase/functions/extract-wine-label/index.ts) — base for batch extraction.

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-02-25 | [Agent] | Initial draft — consolidates shop picker, restaurant, and cooking pairing into unified "Help me pick" discovery feature for v0.6. |
