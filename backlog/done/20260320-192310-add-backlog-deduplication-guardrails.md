---
workflow_type: backlog-item
source: review-findings-2026-03-18
priority: 29
status: done
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-18
last_updated: 2026-03-20
---

# TODO: Add Backlog Deduplication Guardrails

## Goal

Prevent duplicate backlog items and open-vs-done collisions from being committed.

## Scope

- Add a repository check that detects duplicate normalized TODO titles inside `backlog/`.
- Add a repository check that detects title collisions across `backlog/` and `backlog/done/`.
- Add a check that rejects `status: open` entries inside `backlog/done/`.
- Integrate these checks into the existing validation workflow used by contributors and CI.

## Out Of Scope

- Replacing current backlog numbering or reprioritization semantics.
- Automatic rewriting or renaming of backlog files.

## Acceptance Criteria

- Validation fails with actionable error output when duplicate backlog topics exist.
- Validation fails when an open backlog item has already been archived in `backlog/done/`.
- Validation fails when a `backlog/done/` item is not marked `status: done`.
- Checks run locally and in CI through existing repo verification entry points.

## Suggested Verification

- `npm run check`
- Add fixtures that cover duplicate open items, open-vs-done collisions, and invalid done status.

## Notes

- Normalize titles by stripping numeric prefixes and timestamp prefixes before comparison.
