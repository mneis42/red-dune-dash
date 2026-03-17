---
workflow_type: backlog-item
source: process-hardening-2026-03-17
priority: 22
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Add Backlog Reprioritize Guard Checks

## Goal

Prevent malformed filename states before commit by enforcing guard checks for backlog renames.

## Scope

- Add a guard command that validates numbered filename pattern and duplicate priority numbers.
- Fail when temporary filenames (for example prefixed with __tmp- or malformed markers) remain.
- Validate that reprioritization output matches an expected mapping summary.
- Keep guard checks compatible with existing grandfathering behavior in backlog lint (for example legacy metadata handling).
- Provide machine-readable output mode (for example JSON) for CI and script chaining.
- Do not fail legacy items only because renumbering changed their numeric prefix across policy cutoffs.
- Validate Windows-reserved filename segments and reject them with actionable diagnostics.
- Detect case-only rename conflicts and report them explicitly before apply.

## Out Of Scope

- Broad repository-wide naming checks unrelated to backlog numbering.
- Automatic filename rewrites by the guard step itself.

## Acceptance Criteria

- Guard check exits non-zero on malformed filenames or leftover temporary files.
- Guard output clearly lists offending files and expected format.
- Valid backlog state passes cleanly.
- Guard accepts valid `backlog/done/` archive files and does not report them as failures.
- Guard behavior is deterministic across macOS and Linux environments used by local dev and CI.
- Guard behavior is deterministic on Windows environments used by contributors and CI.

## Suggested Verification

- npm run test:backlog-lint
- npm run backlog:lint
- Manual negative tests with intentionally malformed filenames.

## Notes

- Guard checks should run before commit in any scripted reprioritization flow.
- Depends on the canonical reprioritization script from item 21.
