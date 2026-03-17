---
workflow_type: backlog-item
source: pr-6-comments
priority: 19
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Align AGENTS Rule Text With Backlog Lint Cutoff

## Goal

Remove ambiguity by making AGENTS wording match the actual lint enforcement/grandfathering behavior for metadata fields.

## Scope

- Clarify AGENTS wording to explicitly state current cutoff or update lint to match stated policy.
- Keep legacy handling explicit and auditable.
- Add/adjust tests if policy interpretation changes.

## Out Of Scope

- Full migration of all historical backlog files.
- Unrelated process-document rewrites.

## Acceptance Criteria

- AGENTS text and backlog lint behavior are consistent.
- Contributors can infer required metadata for new items without ambiguity.
- Verification tooling enforces the documented behavior.

## Suggested Verification

- npm run backlog:lint
- npm run test:backlog-lint
- npm run instruction:lint

## Notes

- Triggered by PR #6 review feedback about wording vs enforcement mismatch.
