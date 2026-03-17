---
workflow_type: backlog-item
source: pr-6-comments
priority: 15
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Make CI Advisory Diff Range PR-Aware

## Goal

Make advisory CI hints robust by deriving changed files from a reliable diff range in both push and pull_request contexts.

## Scope

- Update CI checkout depth so diff base commits are available.
- Replace unconditional `HEAD~1..HEAD` logic with event-aware base/head selection.
- Keep the advisory step non-blocking while reducing noise and false output.

## Out Of Scope

- Turning advisory hints into a blocking gate.
- Expanding CI coverage beyond diff-range correctness for this step.

## Acceptance Criteria

- PR runs compute changed files from PR base/head context.
- Push runs still compute changed files without frequent missing-commit errors.
- Advisory step output quality improves and remains non-blocking.

## Suggested Verification

- Manual CI run for a pull_request event
- Manual CI run for a push event
- npm run agent:advisory -- --files <sample>

## Notes

- Triggered by PR #6 review feedback about `fetch-depth: 1` and `HEAD~1` fragility.
