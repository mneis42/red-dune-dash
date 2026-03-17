---
workflow_type: backlog-item
source: process-hardening-2026-03-17
priority: 26
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Decouple Backlog Metadata Requirements From Filename Number

## Goal

Prevent renumbering side effects from retroactively invalidating legacy backlog files due to number-based metadata cutoffs.

## Scope

- Replace pure filename-number cutoff logic with a stable policy boundary (for example creation date, explicit legacy marker, or tracked migration version).
- Update backlog lint and related tests to enforce metadata requirements without coupling to mutable priority numbers.
- Document the policy boundary clearly in AGENTS and lint output.

## Out Of Scope

- Mandatory migration of all historical backlog files in one step.
- Rewriting unrelated backlog content.

## Acceptance Criteria

- Reprioritizing filenames does not by itself create new metadata lint failures for unchanged legacy files.
- New backlog files still require the enhanced metadata fields.
- Tests cover at least one legacy and one new file under the updated policy.

## Suggested Verification

- npm run test:backlog-lint
- npm run backlog:lint
- npm run verify

## Notes

- This mitigates a concrete regression risk observed after reprioritization moved legacy items from 12+ positions.
- Should be completed before turning item 25 into a hard CI gate.
