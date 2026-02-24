---
prd_id: PRD-2026-003
title: "User preferences and social data for wines"
status: Draft
owner: "[name/agent]"
area: "Preferences"
target_release: "v0.5"
roadmap: "../ROADMAP.md"
plans:
  cursor: "../Plans/PRD-2026-003__cursor-plan.md"
  claude: "../Plans/PRD-2026-003__claude-plan.md"
---

# PRD-2026-003: User preferences and social data for wines

> **Status:** 🧠 Draft  
> **Priority:** P2 (Medium)  
> **Owner:** [Name]  
> **Target Release:** v0.5  
> See [planning guide](../planning%20guide.md) for PRD naming, IDs, and when to update the roadmap.  
> **Roadmap:** [User preferences and discovery (later)](../ROADMAP.md#user-preferences-and-discovery-later) — this PRD is the foundation for v0.6+ discovery (shop wine picker, recipe/meal pairing).

---

## Problem Statement

Members rate wines at events (thumbs up / meh / thumbs down), but we do not capture any structured preference metadata. Without that, we cannot build a per-user taste profile or "preferences graph." That blocks future discovery features: helping a user pick a wine in a shop from a photo, or recommending a pairing from a recipe or meal. Users have no way to record why they liked or disliked a wine (e.g. tags, tasting notes, context) so the app can learn their preferences over time.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|---------------------|
| Preference metadata per rating | None | Optional metadata stored for ratings | DB and analytics |
| Preferences graph utility | N/A | Data model and storage support per-user preference queries | Schema and APIs in place |
| Readiness for discovery features | N/A | v0.6+ shop picker and recipe pairing can consume preference data | Dependency satisfied for v0.6 PRDs |

---

## Solution Overview

Let users add **additional metadata to their rankings** (e.g. tags, tasting notes, preferred contexts) so we can build a **per-user preferences graph**. This PRD covers: (1) data model and storage for rating-level metadata, (2) UI for users to attach that metadata when rating or after the event (within product policy), and (3) a clear path for v0.6+ discovery features (shop wine picker, recipe/meal pairing) to consume this data. The preferences graph is built from existing thumbs up/meh/down plus the new structured metadata. See [ROADMAP — User preferences and discovery (later)](../ROADMAP.md#user-preferences-and-discovery-later).

### User Stories

- **As a** member who has rated a wine, **I want** to add optional tags or a short note (e.g. "great with cheese", "too tannic"), **so that** the app can learn my preferences over time.
- **As a** product owner, **I want** a per-user preferences graph derived from ratings and metadata, **so that** we can power shop wine picker (photo) and recipe/meal pairing in v0.6+.
- **As a** member, **I want** my preference data to be private and used only for my own recommendations, **so that** I trust the app with my taste profile.

---

## Functional Requirements

### Core Features

1. **Rating-level preference metadata**
   - Users can attach optional structured metadata to a rating: e.g. tags (free or from a controlled set), short tasting note, and/or context (e.g. "with food", "solo").
   - Metadata is stored with the rating (or in a linked table) and is scoped to the member who rated; only that member (and system/recommendation logic) can use it for their preferences graph.
   - Acceptance criteria: Each rating can carry optional metadata; data is persisted and queryable per member for building a preference profile.

2. **UI for adding metadata to ratings**
   - When rating a wine (thumbs up/meh/down), users have an optional step or inline control to add tags/notes/context.
   - Where appropriate (e.g. post-event history), users can add or edit preference metadata for wines they have already rated.
   - Acceptance criteria: Users can add and edit preference metadata in the rating flow or from history; changes are saved and reflected in the preferences graph inputs.

3. **Preferences graph foundation**
   - The system aggregates a member's ratings plus metadata into a representation (preferences graph) that can be queried for "wines similar to what this user liked" or "user's taste profile."
   - This PRD defines the data model and storage; the exact algorithm (e.g. embedding, rules, or hybrid) can be refined in implementation or a follow-on PRD. v0.6+ discovery features will consume this.
   - Acceptance criteria: Data model and APIs support per-member preference queries; roadmap section "User preferences and discovery (later)" is satisfied for v0.5.

### Edge Cases & Error Handling

- **Anonymous ratings:** Preference metadata is only for identified members; no metadata on anonymous or legacy ratings without a member.
- **Privacy:** Preference data is not exposed to other members or hosts; only the owning member and backend logic (e.g. recommendation) can use it. RLS and product policy must enforce this.
- **Event-ended:** If metadata can be added after an event, only the member's own ratings are editable; no change to aggregate results or anonymity.

---

## Technical Context

### Relevant Files & Directories

```
app/event/[id]/rate/[wineId].tsx
app/(tabs)/library.tsx
types/database.ts
supabase/migrations/
docs/planning/ROADMAP.md  (User preferences and discovery section)
```

### Key Dependencies

- Supabase (existing) — `ratings` table and RLS; possibly new columns or tables for metadata.
- Existing rating flow — thumbs up/meh/down; metadata is additive.

### Database/Schema Changes

- **Ratings:** Extend or link to ratings so each (member_id, wine_id) rating can store optional preference metadata (e.g. tags array, tasting_note text, context enum or text). Exact schema TBD in implementation (new columns on `ratings` vs. separate `rating_metadata` table).
- **Types:** Update `types/database.ts` (and any views) to include new fields; ensure RLS allows members to read/write only their own preference data.

### API Changes

- Supabase client: insert/update ratings (or rating metadata) with new fields. No new Edge Functions required for v0.5 unless preference aggregation is done server-side.

### Architecture Notes

- Preference metadata is **member-scoped and private**. It feeds only that member's preferences graph and future recommendation features (shop picker, recipe pairing).
- v0.6+ PRDs (Shop wine picker, Recipe/meal pairing) will consume the preferences graph; this PRD does not implement those features, only the foundation.

---

## Implementation Handoff

### Critical Files to Modify

| File | Purpose | Key Changes |
|------|---------|-------------|
| `supabase/migrations/0XX_rating_preference_metadata.sql` | Schema | Add columns or table for rating-level preference metadata; RLS for member-only access. |
| `types/database.ts` | Types | Add types for rating metadata (tags, note, context). |
| `app/event/[id]/rate/[wineId].tsx` | Rating screen | Optional UI to add tags/note/context when submitting vote; persist with rating. |
| (TBD) History / library | Optional | Allow adding or editing preference metadata for past ratings. |

### Root Cause Analysis

**Current behavior:** Ratings store only value (-1, 0, 1); no structured preference metadata.  
**Expected behavior:** Users can attach optional metadata to ratings; system can build a per-user preferences graph for v0.6+ discovery.  
**Root cause:** Original scope was event-only anonymous aggregates; preference learning was deferred to a later phase (now v0.5).

### Implementation Constraints

- DO NOT expose any member's preference metadata to other members or hosts; RLS and API must enforce member-only read/write.
- MUST preserve existing rating flow and anonymity (aggregate results unchanged); metadata is additive.
- DO NOT implement shop wine picker or recipe/meal pairing in this PRD; those are v0.6+.

### Verification Commands

```bash
npm run lint
npx tsc --noEmit

# Manual: rate a wine, add tags/note; confirm stored. Query as same member only.
```

### Decisions Made

- [x] **Metadata is optional:** Users can rate without adding metadata; graph still uses thumbs up/meh/down.
- [x] **Member-scoped and private:** Preference data used only for that member's recommendations; see ROADMAP.
- [x] **v0.5 = foundation only:** Shop picker and recipe pairing are separate PRDs (v0.6+).

### Related Plan File

Plan files: see YAML `plans` (e.g. `../Plans/PRD-2026-003__cursor-plan.md`). Create when entering implementation.

---

## Implementation Guidance

### Suggested Approach

1. Design and add migration for rating preference metadata (columns or table; RLS).
2. Update TypeScript types for ratings and any new views.
3. Add optional metadata UI to the rating screen; submit with rating.
4. (Optional) Add or edit metadata from history/library for past ratings.
5. Document or implement minimal "preferences graph" query path for v0.6+ consumption.

### Testing Requirements

- [ ] Manual QA: add metadata to a rating; confirm persistence and member-only visibility.
- [ ] RLS: verify other members cannot read or write another member's preference metadata.

### Out of Scope

- Shop wine picker (photo) — v0.6+; see [ROADMAP](../ROADMAP.md).
- Recipe/meal pairing — v0.6+; see [ROADMAP](../ROADMAP.md).
- Public or social sharing of preference data.

---

## Design & UX

- **Rating screen:** After or alongside thumbs up/meh/down, optional field(s) for tags (e.g. chips or free text), short tasting note (text), and/or context (e.g. "with food"). Submit with vote.
- **History / library:** If in scope, allow user to open a wine they rated and add or edit preference metadata (no change to vote value or aggregate results).

**Key Interactions:**
- User rates wine → optionally adds tags/note/context → submits → rating and metadata saved.
- Backend (or future v0.6 service) queries member's ratings + metadata to build preferences graph.

---

## Rollout Plan

| Phase | Description | Audience | Success Gate |
|-------|-------------|----------|--------------|
| 1 | Preference metadata in rating flow and DB | All members who rate | Metadata optional, stored, member-only. |
| 2 | (v0.6+) Shop picker and recipe pairing consume preferences graph | Discovery users | See v0.6+ PRDs. |

### Feature Flags

TBD; optional feature flag to enable metadata UI if rolling out gradually.

---

## Open Questions

- [ ] Exact schema: new columns on `ratings` vs. separate `rating_metadata` table?
- [ ] Tag model: free-text only, or controlled vocabulary (and who maintains it)?
- [ ] Where can users edit metadata after the event: only from Library, or also from event history?

---

## References

- [ROADMAP.md — User preferences and discovery (later)](../ROADMAP.md#user-preferences-and-discovery-later) — preferences graph, shop picker, recipe pairing.
- [ROADMAP.md — v0.5 (user preferences & discovery foundation)](../ROADMAP.md#v05-user-preferences--discovery-foundation).
- [ROADMAP.md — v0.6+ (discovery)](../ROADMAP.md#v06-discovery).

---

## PRD creation & updating (good practices)

- **ID & filename:** PRD-2026-003; filename `PRD-2026-003__user-preferences-social-data-wines.md`.
- **Roadmap:** Listed in [ROADMAP.md](../ROADMAP.md) under Later (User preferences and social data for wines) and PRD index (Preferences); v0.5 Includes references this PRD.
- **Plans:** Cursor/Claude plan in `docs/planning/Plans/PRD-2026-003__cursor-plan.md` when created.

---

## Changelog

| Date       | Author   | Change                    |
|------------|----------|---------------------------|
| 2026-02-24 | [Author] | Initial draft; tied to ROADMAP v0.5 and User preferences and discovery (later). |
