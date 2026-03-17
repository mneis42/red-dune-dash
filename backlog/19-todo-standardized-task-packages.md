---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 8
priority: 4
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-16
last_updated: 2026-03-17
---

# TODO: Standardized Task Packages In Existing Instructions

## Goal

Add reusable task-package shapes inside existing instruction files to reduce prompt variance.

## Scope

- Define compact task-package sections for balancing tweaks, PWA/offline fixes, gameplay bugfixes, workflow-doc updates, and targeted reviews.
- Integrate packages into existing instruction files instead of adding a competing workflow layer.
- Define canonical insertion points (for example in `instructions/feature-request.md`, `instructions/bug-report.md`, and `instructions/change-review.md`) so package lookup is deterministic.
- Keep all package definitions aligned with canonical entry points.

## Out Of Scope

- New parallel workflow constitution.
- Replacing current feature/bug/review instructions.

## Acceptance Criteria

- Package definitions are discoverable and concise.
- Existing instruction authority and routing remain unchanged.
- Examples are practical for this repository size.
- Package sections remain synchronized across relevant instruction files with no contradictory guidance.

## Suggested Verification

- `npm run check`
- Manual consistency review across `AGENTS.md` and `instructions/` documents.

## Notes

- Prioritize maintainability of instruction docs over abstraction depth.
