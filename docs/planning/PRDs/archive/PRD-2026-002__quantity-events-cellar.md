---
prd_id: PRD-2026-002
title: "Quantity field (1-12) for Events and Cellar"
status: Complete
archived: true
owner: "[name/agent]"
area: "Events"
target_release: "v0.x"
roadmap: "../../ROADMAP.md"
plans:
  cursor: "Quantity field Events and Cellar (in Cursor plan store; see Related Plan File below)"
  claude: "../../Plans/PRD-2026-002__claude-plan.md"
---

# PRD-2026-002: Quantity field (1-12) for Events and Cellar

> **Status:** 🚀 Complete (archived)  
> **Priority:** P2 (Medium)  
> **Owner:** [Name]  
> **Target Release:** v0.x  
> See [planning guide](../../planning%20guide.md) for PRD naming, IDs, and when to update the roadmap.

---

## Problem Statement

Members adding wines to an event (via the scan-label / add-wine flow) cannot indicate how many bottles they are contributing. The app currently treats each submission as a single bottle. Event hosts and members need to record quantity (e.g. 2 bottles of the same wine) for accurate event inventory and, in the future, for personal cellar cataloguing where quantity is also relevant (e.g. "3 bottles in cellar").

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Quantity captured per event wine | Not captured | Stored for all new/updated wines | DB and UI show quantity |
| Event wine list clarity | Single-bottle assumption | Quantity visible when > 1 | Manual check of event wine list |
| Reuse for Cellar | N/A | Same 1-12 semantics designed for Cellar | Cellar PRD/design references this field |

---

## Solution Overview

Add a **Quantity** integer field with allowed range **1–12** to the wine entry flow. **Phase 1** implements it for the **Event**-linked workflow only: add-wine form captures quantity, it is stored in the `wines` table, and displayed in the event wine list (and wine detail) where relevant. **Phase 2** (later) is the **Cellar** object type (see [ROADMAP.md](../../ROADMAP.md) — Personal cellars): the same quantity concept (1–12) will be used when building user-owned wine collections; this PRD does not implement Cellar, only establishes the field and semantics for Events so Cellar can reuse them.

### User Stories

- **As a** member adding wine to an event, **I want** to enter how many bottles (1–12) I'm adding, **so that** the event reflects the correct number of bottles.
- **As a** host or member viewing an event's wines, **I want** to see quantity when more than one bottle of the same wine is added, **so that** I can see inventory at a glance.
- **As a** product owner, **I want** quantity to be designed once (1–12) for Events, **so that** the same semantics can be reused for the future Cellar (personal collection) feature without re-specifying.

---

## Functional Requirements

### Core Features

1. **Quantity input in add-wine flow**
   - User selects quantity (1–12) on the Add wine screen (event-linked) via a **drop-down selector; single choice only** (no free-text or multi-select).
   - Options are the integers 1 through 12; default selection is 1. No validation needed beyond the fixed options.
   - Quantity is not extracted from the label (scan flow unchanged); it is user input only. When the user returns from Scan label, quantity is preserved (not overwritten by extraction).
   - Acceptance criteria: User selects 1–12 from the drop-down on add-wine; value is saved with the wine and shown where wines are displayed.

2. **Quantity persisted for Events**
   - The `wines` table stores `quantity` (integer, 1–12, default 1). Existing rows receive default 1 via migration.
   - Add-wine insert includes `quantity`; TypeScript types include `quantity` for Wine Row/Insert/Update.
   - Acceptance criteria: New and updated wines have quantity in DB; existing wines have quantity = 1 after migration.

3. **Quantity displayed in Event workflow**
   - Event wine list shows quantity when relevant (e.g. when quantity > 1: "2× Producer Varietal Vintage" or "Qty: 2").
   - Wine detail screen (event/[id]/wine/[wineId]) shows quantity.
   - Acceptance criteria: Event list and wine detail reflect stored quantity.

### Edge Cases & Error Handling

- **Existing wines (pre-migration):** Default quantity to 1 in migration and in UI when value is null/undefined.
- **Out-of-range input:** N/A for UI (drop-down only allows 1–12). DB CHECK constraint rejects invalid values if ever sent.
- **Scan then edit:** User sets quantity, taps Scan label, returns with extracted data; quantity field retains the value (extraction does not set quantity).

---

## Technical Context

### Relevant Files & Directories

```
app/event/[id]/add-wine.tsx
app/event/[id]/index.tsx
app/event/[id]/wine/[wineId].tsx
lib/last-label-extraction.ts
types/database.ts
supabase/migrations/
```

### Key Dependencies

- Supabase (existing) — `wines` table and RLS; no new services.
- Expo / React Native — form and navigation unchanged except new quantity field.

### Database/Schema Changes

- **New migration:** Add column `quantity` to `wines`:
  - Type: `integer` or `smallint`.
  - Constraint: `CHECK (quantity >= 1 AND quantity <= 12)`.
  - Default: `1`.
- **Types:** Update `types/database.ts`: add `quantity: number` (and optional for Insert/Update with default 1) to `wines` Row/Insert/Update.

### API Changes

None. Supabase client continues to read/insert/update `wines`; new column is included in select and insert payloads.

### Architecture Notes

- Quantity is stored on the wine record (event wines today; same concept for Cellar later). Do not create an event-only or Cellar-only quantity table; keep one semantics (1–12) for reuse.
- Label extraction (`last-label-extraction`) does not provide quantity; add-wine form owns quantity state and does not overwrite it when applying extraction.

---

## Implementation Handoff

### Critical Files to Modify

| File | Purpose | Key Changes |
|------|---------|-------------|
| `supabase/migrations/00X_add_wines_quantity.sql` | Schema | Add `quantity` to `wines` (1–12, default 1). |
| `types/database.ts` | Types | Add `quantity` to wines Row/Insert/Update. |
| `app/event/[id]/add-wine.tsx` | Add wine form | Quantity state (default 1), input 1–12, include in insert. |
| `app/event/[id]/index.tsx` | Event wine list | Display quantity when > 1 (or always). |
| `app/event/[id]/wine/[wineId].tsx` | Wine detail | Show quantity. |

### Root Cause Analysis

**Current behavior:** Each wine entry is implicitly one bottle; no quantity field.  
**Expected behavior:** User can enter 1–12 bottles; value stored and displayed.  
**Root cause:** Quantity was not in the original event/wine scope; added as enhancement for inventory and future Cellar reuse.

### Implementation Constraints

- DO NOT remove or change existing wines columns (producer, varietal, vintage, region, label_photo_url, ai_summary, etc.).
- MUST preserve backward compatibility: existing wines get quantity = 1; API and types allow optional quantity with default 1 where appropriate.
- DO NOT implement Cellar in this PRD; only Events workflow and DB + types.

### Verification Commands

```bash
# Lint / typecheck
npm run lint
npx tsc --noEmit

# Manual verification
# 1. Run app; join/create event; Add wine. Set quantity 2; add wine. Confirm event list shows quantity.
# 2. Open wine detail; confirm quantity shown.
# 3. Add wine via Scan label; set quantity 3; confirm saved. Return from scan with extraction; confirm quantity unchanged.
```

### Decisions Made

- [x] **Quantity on add-wine form (not on scan-label):** Quantity is user input, not from AI; add-wine is the single place for wine metadata before submit.
- [x] **Range 1–12:** Covers event and cellar use cases without unbounded input; can be extended later if needed.
- [x] **Default 1:** Existing rows and omitted input behave as one bottle; no breaking change.
- [x] **Phase 1 = Events only; Cellar referenced but not built:** Aligns with roadmap (Quantity built first for Events; Cellar will reuse semantics).
- [x] **Quantity control = drop-down selector (single choice):** UI uses a picker/drop-down with options 1–12; no free number input or stepper, to keep input constrained and consistent.

### Related Plan File

[Cursor plan: Quantity field Events and Cellar](.cursor/plans/quantity_field_events_and_library_39da5d12.plan.md) — implementation plan (links to this PRD). Implement the steps in that plan for a complete solution; quantity UI is a drop-down selector (single choice, 1–12) per this PRD.

---

## Implementation Guidance

### Suggested Approach

1. Add migration for `wines.quantity` (CHECK 1–12, default 1).
2. Update `types/database.ts` for wines Row/Insert/Update.
3. Add quantity state and **drop-down selector** (single choice, options 1–12) to add-wine screen; include quantity in insert; preserve quantity when returning from scan (do not overwrite from extraction).
4. Update event wine list to show quantity when > 1 (or always).
5. Update wine detail screen to show quantity.

### Testing Requirements

- [ ] Manual QA: add wine with quantity 1, 2, 12; confirm DB and list/detail.
- [ ] Manual QA: add wine, scan label, return; confirm quantity preserved.
- [ ] Optional: unit test for 1–12 validation or migration.

### Out of Scope

- Cellar object type or Cellar-specific UI/API.
- Changes to scan-label or extract-wine-label beyond add-wine form (no quantity in extraction).
- Quantity outside 1–12 (e.g. 0 or > 12) in this PRD.

---

## Design & UX

- **Add wine screen:** Add a "Quantity" control as a **drop-down selector (single choice)**. Label: "Quantity (bottles)" or "Quantity". Options: 1 through 12; default selection 1. Only one value can be selected; no free-text or stepper. Place between existing fields and "Add wine" button.
- **Event wine list:** When quantity > 1, show e.g. "2× Producer Varietal Vintage" or a small "Qty: 2" in secondary text.
- **Wine detail:** Display "Quantity: 2" (or similar) in the wine metadata section.

**Key Interactions:**
- User sets quantity 1–12 on add-wine → submits → wine is stored with that quantity.
- User opens event wine list → sees quantity when > 1 (or always).
- User opens wine detail → sees quantity.

---

## Rollout Plan

| Phase | Description | Audience | Success Gate |
|-------|-------------|----------|--------------|
| 1 | Quantity in Events (add-wine, DB, list, detail) | All event users | Quantity saved and displayed; no regressions. |
| 2 | (Later) Cellar reuses quantity 1–12 | Cellar users | See Personal cellars PRD when it exists. |

### Feature Flags

No feature flag for Phase 1; quantity is always available on add-wine and display.

---

## Open Questions

- [ ] Display preference: show "1×" for single bottle in list for consistency, or only show quantity when > 1?

---

## References

- [ROADMAP.md](../../ROADMAP.md) — Personal cellars (Phase 2); Quantity built first for Events.
- Cursor plan (Quantity field Events and Cellar) — implementation plan linking to this PRD; see Related Plan File above.

---

## PRD creation & updating (good practices)

- **ID & filename:** PRD-2026-002; filename `PRD-2026-002__quantity-events-cellar.md`.
- **Roadmap:** Listed in ROADMAP.md under Next (Quantity / Events) and referenced in Personal cellars section; PRD index updated.
- **Plans:** Cursor/Claude plan in `docs/planning/Plans/PRD-2026-002__cursor-plan.md` when created.

---

## Changelog

| Date       | Author   | Change        |
|------------|----------|---------------|
| 2026-02-23 | [Author] | Initial draft |
| 2026-02-23 | [Author] | UI: quantity input = drop-down selector (single choice, 1–12). Plan references PRD; PRD references plan. |
| 2026-02-24 | [Author] | Renamed Library → Cellar (title, filename, references). |
| 2026-02-24 | [Author] | Marked Complete; archived. Quantity (1–12) shipped for Events; Cellar will reuse semantics when built. |
