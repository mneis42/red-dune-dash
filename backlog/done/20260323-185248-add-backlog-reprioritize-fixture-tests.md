---
workflow_type: backlog-item
source: process-hardening-2026-03-17
priority: 23
status: done
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-23
---

# TODO: Add Backlog Reprioritize Fixture Tests

## Goal

Add automated fixture tests that verify safe reprioritization behavior and protect against regressions.

## Scope

- Add tests for successful two-phase rename with expected final filenames.
- Add tests for failure modes (duplicate targets, missing source, invalid filename pattern).
- Verify no partial writes remain after failed operations.
- Run tests against isolated temporary fixture directories, never against the real repository backlog tree.
- Cover dry-run output contract and apply-mode mutation contract separately.
- Add explicit edge-case tests for case-only rename conflicts and Windows-reserved names.
- Normalize fixture expectations for line endings and deterministic sorting across platforms.

## Out Of Scope

- End-to-end CI orchestration changes beyond the relevant test suites.

## Acceptance Criteria

- Reprioritize script behavior is covered by deterministic automated tests.
- Failure scenarios are asserted with clear error messages.
- Tests fail if malformed output names are produced.
- Tests assert rollback safety: failed runs leave fixture state unchanged.
- Tests are stable in local Node execution and in CI.
- Test suite remains stable on Windows, Linux, and macOS runners.

## Suggested Verification

- npm test
- npm run verify

## Notes

- Fixture-based tests are the main defense against model-specific command variance.
- Depends on item 21 and should be completed before enforcing CI gates in item 25.
- Completed on 2026-03-23 with focused fixture coverage for dry-run/apply behavior, rollback safety, temp-path protection, case-insensitive collisions, symlink escapes, and Windows cross-drive path handling.
