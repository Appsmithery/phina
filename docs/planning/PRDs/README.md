# PRD Index

Product Requirements Documents (PRDs) live here. Each PRD has a **stable ID** (`PRD-YYYY-NNN`) used in filenames, the [ROADMAP](../ROADMAP.md), and Plan Mode notes.

## Naming convention

- **ID format:** `PRD-YYYY-NNN` (e.g. `PRD-2026-001`). Optional domain tag: `PRD-2026-001-Admin`.
- **Filename:** `PRD-YYYY-NNN__short-slug.md` (e.g. `PRD-2026-001__admin-panel.md`).
- **H1 in doc:** `# PRD-YYYY-NNN: Title`
- **Plans:** `docs/planning/Plans/PRD-YYYY-NNN__cursor-plan.md` (and `__claude-plan.md` if used).

Do not change the PRD ID when renaming; only the slug may change.

## Template and practices

- **New PRD:** Copy [PRD_Template.md](./PRD_Template.md), fill the YAML frontmatter and sections.
- **Roadmap:** Add the PRD to [ROADMAP.md](../ROADMAP.md) under Now / Next / Later and the PRD index table.
- **Status:** Keep PRD status and roadmap in sync (Draft → Ready → In progress → Shipped / Parked).

See the [planning guide](../planning%20guide.md) for full conventions and migration notes.

## Current PRDs

| PRD ID | Title | Status | Area |
|--------|--------|--------|------|
| PRD-2026-002 | [Quantity (1–12) for Events and Cellar](./archive/PRD-2026-002__quantity-events-cellar.md) (archived) | 🚀 Shipped | Events |
| PRD-2026-003 | [User preferences and social data for wines](./PRD-2026-003__user-preferences-social-data-wines.md) | 🧠 Draft | Preferences |
| PRD-2026-004 | ["Help me pick" — discovery](./PRD-2026-004__help-me-pick.md) | 🧠 Draft | Discovery |

Shipped or completed PRDs may be moved to `archive/` and marked archived in the doc; the PRD index in [ROADMAP.md](../ROADMAP.md) links to the archived path.
