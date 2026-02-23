Here’s a repo-friendly way to keep PRDs + Cursor/Claude “Plan Mode” notes aligned to a single product vision: a single canonical **roadmap** (plus PRD index), and a PRD ID + filename convention so agents cross-link everything consistently.

**In this repo:**
- Roadmap: `docs/planning/ROADMAP.md`
- PRDs: `docs/planning/PRDs/` — use [PRD_Template.md](./PRDs/PRD_Template.md)
- PRD index: [PRDs/README.md](./PRDs/README.md)
- Plan Mode notes: `docs/planning/Plans/` (same PRD ID in filename)

## PRD naming + numbering convention

Your `docs/PRDs/` folder currently mixes styles like `PRD_ ... .md`, `PRD_research_session_reliability.md`, and non-PRD docs like `Excel-Chat-Sidecar-Implementation.md`.  To align agents, you want one stable identifier that never changes even if a title changes.

**Recommended PRD ID format (stable + sortable):**

- `PRD-YYYY-NNN` (example: `PRD-2026-001`)
- Optional domain tag for quick scanning: `PRD-2026-001-RAG` or `PRD-2026-001-INGEST`

**Recommended PRD file name format (human + stable):**

- `docs/PRDs/PRD-2026-001__short-slug.md`
- Example: `docs/PRDs/PRD-2026-004__session-scoped-precise-retrieval.md`

**Rules**

- The PRD ID goes in: filename, H1 title line, and roadmap references.
- Slug can change if you really need it, but prefer not to rename files; if you do rename, keep the PRD ID identical.
- Any “Plan Mode” notes get their own file keyed by the same PRD ID:
    - `docs/planning/Plans/PRD-2026-001__cursor-plan.md`
    - `docs/planning/Plans/PRD-2026-001__claude-plan.md`

This is designed to coexist with your existing PRD template at `docs/PRDs/PRD_Template.md` while making future PRDs consistently linkable.

## Markdown roadmap template (drop-in file)

Create: `docs/ROADMAP.md`

```md
# Product Roadmap

This is the canonical roadmap for this repo. PRDs, implementation plans (Cursor/Claude Plan Mode), and epics/issues should link back here.

## Product vision
- Vision: <1–2 sentences>
- Target users: <who>
- North-star metric: <metric>
- Non-goals: <what we will not do>

## How to use this roadmap
- PRDs live in `docs/PRDs/` and are referenced by stable IDs like `PRD-2026-001`.
- Plan Mode notes live in `docs/Plans/` and use the same PRD ID.
- Status conventions:
  - 🧠 Draft, ✅ Ready, 🛠 In progress, 🧪 Validating, 🚀 Shipped, 🧊 Parked

## Now / Next / Later
### Now (active)
- [PRD-YYYY-NNN](./PRDs/PRD-YYYY-NNN__short-slug.md) — <Title> — Status: 🛠 — Owner: <agent/person> — Target: <date>
  - Plans: [Cursor](./Plans/PRD-YYYY-NNN__cursor-plan.md), [Claude](./Plans/PRD-YYYY-NNN__claude-plan.md)
  - Progress: <1 line: what’s done / what’s blocked>
  - Exit criteria: <1 line>

### Next (queued)
- [PRD-YYYY-NNN](./PRDs/PRD-YYYY-NNN__short-slug.md) — <Title> — Status: ✅ — Target: <date>

### Later (ideas)
- PRD candidate: <short title> (no ID yet) — Why: <1 line>

## Releases (milestones)
### v0.1 (MVP)
- Goal: <one sentence>
- Includes: PRD-2026-001, PRD-2026-002, ...

### v0.2
- Goal: <one sentence>
- Includes: ...

## PRD index (by area)
### Ingestion
- PRD-2026-001 — <Title> — Status: <status>

### Retrieval / RAG
- PRD-2026-00X — <Title> — Status: <status>

### Observability
- PRD-2026-00Y — <Title> — Status: <status>
```

This gives your agents “quick context” in one place, while still linking out to the PRD and Plan Mode notes per initiative. It also matches your existing structure with `docs/PRDs/` already in the repo.

## Minimal PRD template additions

You already have `docs/PRDs/PRD_Template.md`.  Add a small “metadata block” at the top so agents can reliably parse and link PRDs back to the roadmap:

```md
---
prd_id: PRD-2026-001
title: "<Title>"
status: Draft
owner: "<name/agent>"
area: "<Ingestion|RAG|UI|Observability|...>"
target_release: "v0.1"
roadmap: "../ROADMAP.md"
plans:
  cursor: "../Plans/PRD-2026-001__cursor-plan.md"
  claude: "../Plans/PRD-2026-001__claude-plan.md"
---

# PRD-2026-001: <Title>
```

Keep the rest of your template as-is; the key is that ID + links become mandatory and consistent.

## How to migrate your existing PRDs

You have multiple PRDs already in `docs/PRDs/` (e.g., “Dynamic IR Site Document Ingestion”, “IR Site URL Discovery Waterfall”, “Session-Scoped-Precise-Retrieval”, etc.).  Migration approach:

- Assign PRD IDs in chronological order of when you want them tackled (not necessarily when created).
- Rename files to the new convention (optional but recommended), and update each PRD’s H1 to include the PRD ID.
- For non-PRD “plan” docs (like `Excel-Chat-Sidecar-Implementation.md`), move them into `docs/Plans/` and rename to match the PRD they support (or create a PRD for them if needed).

If you want, tell me whether you prefer IDs to reflect *creation order* or *execution priority*, and I’ll map your current PRD files into an initial `PRD-2026-###` sequence and update `docs/planning/ROADMAP.md` accordingly.

---

## PRD creation checklist

When **creating** a new PRD:

1. Copy `docs/planning/PRDs/PRD_Template.md` and rename to `PRD-YYYY-NNN__short-slug.md`.
2. Set the next available ID (check [ROADMAP](../ROADMAP.md) and [PRDs/README](./PRDs/README.md) for existing IDs).
3. Fill the YAML frontmatter: `prd_id`, `title`, `status`, `owner`, `area`, `target_release`, `roadmap`, `plans`.
4. Add the PRD to [ROADMAP.md](../ROADMAP.md): under **Now** / **Next** / **Later** and in the **PRD index** table.
5. If using Plan Mode, create `docs/planning/Plans/PRD-YYYY-NNN__cursor-plan.md` (or `__claude-plan.md`) and link from the PRD frontmatter.

## When to update the roadmap

- **New PRD:** Add a line in Now/Next/Later and in the PRD index; link to the PRD file and any plan files.
- **Status change:** When a PRD moves (e.g. Ready → In progress, In progress → Shipped), update both the PRD’s frontmatter and the roadmap line.
- **New release/milestone:** Add a release block under “Releases (milestones)” and list the PRDs or themes it includes.
- **Priority change:** Move the PRD between Now / Next / Later and adjust the one-line progress or exit criteria.

