# Taste Graph

> Living architecture document for Phína's per-user taste profile system.
> Updated as the system evolves from v0-foundation through v0.5 (preferences) and v0.6+ (discovery).

---

## Overview

The **Taste Graph** is the per-user model of wine preferences built from rating signals and wine attributes. It answers questions like "does this user prefer full-bodied reds or light whites?" and will eventually power downstream discovery features (shop wine picker, recipe/meal pairing, dining-out recommendations).

### Design principles

1. **Implicit over explicit** — Derive preferences from ratings the user is already submitting; don't force extra work.
2. **Additive metadata** — Optional structured fields (body, sweetness, etc.) enrich the graph but are never required.
3. **Member-scoped and private** — A member's taste profile is visible only to them; it is never exposed to other members or hosts.
4. **Progressive refinement** — Start with simple weighted averages; graduate to richer models (embeddings, collaborative filtering) as data and use cases grow.

---

## Current state (shipped)

### Signal sources

| Source | Table / View | Fields used | Since |
|--------|-------------|-------------|-------|
| Rating value | `ratings` | `value` (-1 / 0 / 1) | v0.1 |
| Body preference | `ratings` | `body` (light / medium / full) | migration 014 |
| Sweetness preference | `ratings` | `sweetness` (dry / off-dry / sweet) | migration 014 |
| Rating confidence | `ratings` | `confidence` (0.0–1.0) | migration 014 |
| Wine color | `wines` | `color` (red / white / skin-contact) | migration 016 |
| Sparkling flag | `wines` | `is_sparkling` (boolean) | migration 016 |

### Schema (relevant columns)

```
ratings
  value       smallint  CHECK (value IN (-1, 0, 1))
  body        text      CHECK (body IN ('light', 'medium', 'full'))
  sweetness   text      CHECK (sweetness IN ('dry', 'off-dry', 'sweet'))
  confidence  real      CHECK (confidence >= 0 AND confidence <= 1)
  wine_id     uuid FK → wines
  member_id   uuid FK → members

wines
  color         text     CHECK (color IN ('red', 'white', 'skin-contact'))
  is_sparkling  boolean  DEFAULT false
```

### Weighted preference algorithm (v0, client-side)

Implemented in `app/(tabs)/profile.tsx` inside the `stats` useMemo. Each preference axis is computed identically:

```
Preference axis = weighted average of trait numeric values,
                  weighted by the rating's sentiment.
```

**Weight map (`PREF_WEIGHT`):**

| Rating value | Semantic | Weight |
|-------------|----------|--------|
| 1 (thumbs up) | Liked | 3 |
| 0 (meh) | Neutral | 1 |
| -1 (thumbs down) | Disliked | 0 |

Disliked wines contribute zero weight — a "thumbs down" doesn't push the preference toward or away from that trait, it is simply excluded. Liked wines are weighted 3x relative to mehs, so the profile skews toward what the user actively enjoys.

**Trait encoding (ordinal 1–3):**

| Axis | 1 | 2 | 3 |
|------|---|---|---|
| Body | light | medium | full |
| Sweetness (dryness) | dry | off-dry | sweet |
| Color | red | skin-contact | white |

**Computation:**

```
for each rating with a non-null trait:
  w = PREF_WEIGHT[rating.value]
  if w == 0: skip
  sumW  += w
  sumWV += w * traitToNum(trait)

result = sumW > 0 ? round(sumWV / sumW, 1) : null
```

Result is `null` (displayed as "Not enough data") when no ratings with non-null traits and positive weight exist.

### Data access pattern

```
supabase
  .from("ratings")
  .select("value, body, sweetness, wine_id, wines!ratings_wine_id_fkey(color)")
  .eq("member_id", member.id)
```

Joins through the `ratings_wine_id_fkey` foreign key to pull `color` from the `wines` table. RLS policy `"Members can read own ratings"` (migration 014) ensures members only see their own data.

### UI (profile screen)

Three horizontal scale widgets on the Profile tab, each showing a marker on a 1–3 continuum:

- **Body:** Light ←→ Full
- **Dryness:** Dry ←→ Sweet
- **Color:** Red ←→ White

Marker position = `((prefValue - 1) / 2) * 100%`. Shows "Not enough data" when null.

Additionally, four stat tiles: Wines Rated, % Liked, Events attended, Favorites count.

---

## Planned evolution

### v0.5 — Preferences metadata (PRD-2026-003)

**Goal:** Let users attach optional metadata to ratings so the graph becomes richer.

Planned additions (schema TBD, see open questions in PRD):

- **Tags** — free-text or controlled vocabulary (e.g. "great with cheese", "too tannic").
- **Tasting notes** — short free-text note per rating.
- **Context** — when/how the wine was consumed (e.g. "with food", "solo", "party").

These fields are additive — the existing thumbs/body/sweetness/confidence flow is unchanged.

### v0.6+ — Discovery consumers

Features that will read from the Taste Graph:

| Feature | How it uses the graph | Status |
|---------|----------------------|--------|
| **Shop wine picker** | User photographs a bottle → match against preference profile → "fits your taste" | 🧠 Later |
| **Recipe/meal pairing** | User provides a recipe → derive meal profile → recommend wines from taste profile | 🧠 Later |
| **Dining out** | User adds a bottle at a restaurant → capture pairing data to enrich the graph | 🧠 Later |

---

## Architecture considerations

### Client-side vs server-side computation

Currently the weighted preference is computed **entirely on the client** inside `useMemo`. This is fine while:

- The computation is simple (single pass, O(n) over ratings).
- The result is only displayed to the owning member.
- The dataset per member is small (tens to low hundreds of ratings).

**When to move server-side:**

- When discovery features need to query across preference profiles (e.g. "wines similar to what users like you enjoyed").
- When the algorithm becomes expensive (embeddings, collaborative filtering).
- When the result needs to be cached or materialized for latency (e.g. a Postgres materialized view or Edge Function).

### Potential server-side representations

| Approach | Pros | Cons | When |
|----------|------|------|------|
| Materialized view / Postgres function | Simple, no new infra | Limited to SQL-expressible logic | v0.5 if needed |
| Edge Function computing profile on demand | Flexible, can call external APIs | Cold start latency | v0.6 |
| Embedding vector per member (pgvector) | Enables similarity search across members and wines | Requires embedding model, more complex | v0.6+ |

### Privacy model

- `ratings` RLS: members can only SELECT their own rows (migration 014).
- `wines` and `wines_with_price_privacy`: readable by all authenticated users (wine metadata is not sensitive; price is gated by the view).
- Future preference metadata must follow the same member-only pattern.
- Discovery features that compare across users must do so server-side (Edge Function with service role key) and return only recommendations, never raw preference data of other members.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-24 | Initial document — captures shipped v0 weighted preference algorithm, signal sources, schema, and planned evolution toward v0.5/v0.6+. |
