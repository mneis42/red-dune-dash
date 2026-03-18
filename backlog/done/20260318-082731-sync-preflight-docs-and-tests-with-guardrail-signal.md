---
workflow_type: backlog-item
source: pr-6-comments
priority: 17
status: done
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-18
---

# TODO: Sync Preflight Docs And Tests With Guardrail Signal

## Goal

Keep documentation and tests consistent with the final guardrail detection signal used by preflight.

## Scope

- Update docs that currently describe outdated hook signal assumptions.
- Update preflight tests/fixtures to assert the actual expected guardrail signal/path.
- Verify no stale references remain in workflow docs.

## Out Of Scope

- Functional changes to preflight matching logic unrelated to guardrail status.
- Broader documentation rewrite outside relevant sections.

## Acceptance Criteria

- Docs no longer claim `.git/hooks/pre-commit` when `.githooks/pre-push` via hooksPath is canonical.
- Preflight tests align with implemented detection behavior.
- Instruction/advisory docs remain internally consistent.

## Suggested Verification

- npm run test:preflight
- npm run instruction:lint
- Manual read-through of updated docs for consistency

## Notes

- Triggered by PR #6 review comments on documentation/test mismatch for guardrail detection.
