---
prd_id: PRD-YYYY-NNN
title: "[Feature Name]"
status: Draft
owner: "[name/agent]"
area: "[Events|Admin|Auth|RAG|UI|Observability|...]"
target_release: "v0.x"
roadmap: "../ROADMAP.md"
plans:
  cursor: "../Plans/PRD-YYYY-NNN__cursor-plan.md"
  claude: "../Plans/PRD-YYYY-NNN__claude-plan.md"
---

# PRD-YYYY-NNN: [Feature Name]

> **Status:** 🧠 Draft | In Review | ✅ Ready | 🛠 In Progress | 🧪 Validating | 🚀 Shipped | 🧊 Parked  
> **Priority:** P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)
> **Owner:** [Name]
> **Target Release:** [Version or Date]  
> See [planning guide](../planning%20guide.md) for PRD naming, IDs, and when to update the roadmap.

---

## Problem Statement

[2-3 sentences describing the user problem or business need this feature addresses. Be specific about who is affected and what pain point exists.]

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| [e.g., Task completion rate] | [Baseline] | [Goal] | [How you'll measure] |
| [e.g., User engagement] | [Baseline] | [Goal] | [How you'll measure] |

---

## Solution Overview

[1 paragraph summary of the proposed solution and how it addresses the problem.]

### User Stories

- **As a** [user type], **I want** [capability], **so that** [benefit].
- **As a** [user type], **I want** [capability], **so that** [benefit].

---

## Functional Requirements

### Core Features

1. **[Feature Component 1]**
   - [Specific requirement]
   - [Specific requirement]
   - Acceptance criteria: [How we know it's done]

2. **[Feature Component 2]**
   - [Specific requirement]
   - [Specific requirement]
   - Acceptance criteria: [How we know it's done]

### Edge Cases & Error Handling

- [Scenario]: [Expected behavior]
- [Scenario]: [Expected behavior]

---

## Technical Context

<!-- This section provides implementation context for Claude Code -->

### Relevant Files & Directories

```
/path/to/relevant/directory/
/path/to/specific/file.ts
/path/to/related/component/
```

### Key Dependencies

- [Package/Service]: [Version if relevant] — [Why it's relevant]
- [Package/Service]: [Version if relevant] — [Why it's relevant]

### Database/Schema Changes

[Describe any data model changes, new tables, or migrations needed. Write "None" if not applicable.]

### API Changes

[Describe any new endpoints, modified contracts, or integration changes. Write "None" if not applicable.]

### Architecture Notes

[Any architectural decisions, patterns to follow, or constraints to be aware of.]

---

## Implementation Handoff

<!-- This section bridges PRD requirements to Claude Code execution. Fill this out after requirements are approved. -->

### Critical Files to Modify

| File | Purpose | Key Changes |
|------|---------|-------------|
| [path/to/file.py] | [What this file does] | [What needs to change] |
| [path/to/file.py] | [What this file does] | [What needs to change] |

### Root Cause Analysis

<!-- For bug fixes or improvements, document why the current behavior exists -->

**Current behavior:** [What happens now]
**Expected behavior:** [What should happen]
**Root cause:** [Why the gap exists - be specific about code/architecture]

### Implementation Constraints

<!-- Things Claude should NOT do during implementation -->

- DO NOT modify: [files/patterns to preserve]
- DO NOT remove: [code/features that must stay]
- MUST preserve: [backward compatibility, API contracts, etc.]

### Verification Commands

<!-- How to test that the implementation works -->

```bash
# Build/lint check
[command]

# Run tests
[command]

# Manual verification
[step-by-step commands to verify feature works]
```

### Decisions Made

<!-- Resolved questions from planning phase - prevents re-asking -->

- [x] [Decision 1]: **[Choice made]** — [Brief rationale]
- [x] [Decision 2]: **[Choice made]** — [Brief rationale]

### Related Plan File

<!-- Link to Cursor/Claude plan files; paths are in the frontmatter `plans` -->

Plan files: see YAML `plans` (e.g. `../Plans/PRD-YYYY-NNN__cursor-plan.md`) (if applicable)

---

## Implementation Guidance

### Suggested Approach

1. [First logical step]
2. [Second logical step]
3. [Third logical step]

### Testing Requirements

- [ ] Unit tests for [specific functionality]
- [ ] Integration tests for [specific flow]
- [ ] Manual QA checklist: [link or inline]

### Out of Scope

- [Explicitly excluded item 1]
- [Explicitly excluded item 2]

---

## Design & UX

[Link to Figma/design specs, or describe the expected UI/UX behavior. Include screenshots or mockups if available.]

**Key Interactions:**
- [User action] → [System response]
- [User action] → [System response]

---

## Rollout Plan

| Phase | Description | Audience | Success Gate |
|-------|-------------|----------|--------------|
| 1 | [e.g., Internal testing] | [e.g., Team only] | [e.g., No critical bugs] |
| 2 | [e.g., Beta release] | [e.g., 10% of users] | [e.g., Error rate < 1%] |
| 3 | [e.g., GA] | [e.g., All users] | — |

### Feature Flags

- Flag name: `[feature_flag_name]`
- Default state: [on/off]

---

## Open Questions

- [ ] [Question that needs resolution before or during implementation]
- [ ] [Question that needs resolution before or during implementation]

---

## References

- [Design spec](link)
- [Technical RFC](link)
- [Related PRD](link)
- [User research](link)

---

## PRD creation & updating (good practices)

- **ID & filename:** Use stable `PRD-YYYY-NNN` (e.g. `PRD-2026-001`) in the filename and H1. File name: `PRD-2026-001__short-slug.md`. Do not change the ID if you rename the file.
- **Roadmap:** Every PRD must be listed in [ROADMAP.md](../ROADMAP.md) under Now / Next / Later or the PRD index. Update the roadmap when status changes (e.g. Ready → In progress → Shipped).
- **Plans:** Implementation notes from Cursor/Claude Plan Mode go in `docs/planning/Plans/` with the same PRD ID (e.g. `PRD-2026-001__cursor-plan.md`).
- **Changelog:** Log material changes (scope, decisions, status) in the Changelog table below.

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| [YYYY-MM-DD] | [Name] | Initial draft |
