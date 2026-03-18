---
workflow_type: backlog-item
source: review-findings-2026-03-18
priority: 3
status: open
planning_model: GPT-5.4
execution_model: GPT-5.4
created_at: 2026-03-18
last_updated: 2026-03-18
---

# TODO: Unblock Full Code Review Workflow When Model Name Is Hidden

## Goal

Make the canonical full-review workflow executable even in runtimes that do not expose an exact model identifier.

## Scope

- Update the full-review instructions so missing exact model metadata has one explicit non-blocking fallback path.
- Keep honesty requirements for model attribution while avoiding mandatory dead ends during repository reviews.
- Align related templates or agent-facing guidance if they currently assume model identity is always observable.
- Add wording that makes the fallback reusable across future agent runtimes instead of solving only one tool-specific case.

## Out Of Scope

- Rewriting the complete full-review workflow.
- Relaxing model attribution rules for cases where the exact model is actually visible.

## Acceptance Criteria

- A full-code-review run can complete without waiting indefinitely for unavailable model metadata.
- The documented fallback remains truthful and does not guess a more specific model than the runtime exposes.
- Relevant docs and templates no longer contradict the executable workflow.
- The instructions make the prevention rule explicit enough that future workflow edits do not reintroduce the same blocker accidentally.

## Suggested Verification

- `npm run instruction:lint`
- Manual walkthrough of the full-review instructions against a runtime with hidden model details.

## Notes

- This addresses a workflow blocker, not a product feature gap.
- Prefer one canonical fallback rule rather than duplicating exceptions across multiple instruction files.
