---
workflow_type: backlog-item
source: pr-6-comments
priority: 18
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Make Agent Advisory CLI Entrypoint Import-Safe

## Goal

Prevent unintended execution when the advisory CLI module is imported by guarding the entrypoint.

## Scope

- Wrap CLI execution with `if (require.main === module)`.
- Export main/helpers that are useful for tests or reuse.
- Ensure file formatting hygiene (including newline at EOF).

## Out Of Scope

- Major restructuring of advisory command behavior.
- New CLI feature flags.

## Acceptance Criteria

- Importing the module does not auto-run CLI flow.
- Existing CLI behavior is unchanged when executed directly.
- Tests pass and module can be reused from other scripts.

## Suggested Verification

- npm run test:advisory
- Manual node import smoke check
- npm run verify

## Notes

- Triggered by PR #6 review nit on unconditional `main()` invocation and module reuse.
