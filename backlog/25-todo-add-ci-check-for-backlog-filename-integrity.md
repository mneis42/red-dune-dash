---
workflow_type: backlog-item
source: process-hardening-2026-03-17
priority: 25
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Add CI Check For Backlog Filename Integrity

## Goal

Enforce backlog filename integrity in CI so malformed rename results are caught before merge.

## Scope

- Add a CI step that runs backlog lint and the new reprioritize guard checks.
- Keep this check deterministic and low-noise.
- Emit actionable failure messages with offending filenames.
- Roll out in stages: advisory visibility first, then blocking enforcement after signal quality is confirmed.
- Keep scope limited to backlog filename integrity to avoid policy sprawl in this step.
- Run the relevant integrity checks in a matrix for Windows, Linux, and macOS.
- Keep CI output consistent across operating systems (same error categories and format).

## Out Of Scope

- Blocking unrelated workflow checks not tied to backlog naming integrity.

## Acceptance Criteria

- CI fails when malformed backlog filenames are present.
- CI passes for valid numbered backlog states and done archive files.
- Failure output is concise and actionable.
- Stage-transition criteria are documented (for example one cycle of clean advisory signal before enabling hard fail).
- CI check remains fast and does not materially increase pipeline runtime.
- CI matrix confirms equivalent pass/fail behavior on Windows, Linux, and macOS.

## Suggested Verification

- npm run backlog:lint
- npm run verify
- CI dry run on a branch with one intentionally malformed backlog filename.
- CI matrix dry run with one valid and one intentionally malformed backlog filename case.

## Notes

- This is the final safety net after local script and test hardening.
- Depends on items 21 to 23 to avoid enforcing behavior before tooling and tests are ready.
