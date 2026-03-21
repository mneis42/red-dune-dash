---
workflow_type: backlog-item
source: agent-run-log-gap-2026-03-21
priority: 38
status: done
planning_model: GPT-5.4 Thinking
execution_model: GPT-5.4 Thinking or smaller follow-up model
created_at: 2026-03-21
last_updated: 2026-03-21
---

# TODO: Add Guard Checks For Agent Run Log Instruction Coverage

## Goal

Prevent future instruction drift by adding automated checks that fail when canonical agent workflows stop routing incident logging correctly.

## Scope

- Add targeted validation for the required run-log routing statements in `AGENTS.md` and the relevant canonical workflow instruction files.
- Add fixture-style tests or equivalent coverage for the required wording or structural expectations around run-log decision checkpoints.
- Ensure the checks verify both sides of the policy: trigger means log, no trigger means no log.
- Keep the checks narrow and maintainable so they protect instruction coverage without becoming brittle wording snapshots.

## Out Of Scope

- Validating the content quality of individual incident log files.
- Enforcing a specific natural-language sentence as the only allowed wording.
- Adding CI checks for every advisory documentation paragraph in `docs/`.

## Acceptance Criteria

- Automated validation fails if canonical workflow routing stops mentioning required run-log handling.
- Automated validation fails if the mandatory workflows no longer include an explicit run-log decision checkpoint where this repository expects one.
- The checks allow reasonable wording changes as long as the policy meaning stays intact.
- The validation protects against regression where agents again only log incidents when reminded manually by a developer.

## Suggested Verification

- `npm run check`
- `npm test`
- Run the new or updated validation command directly if it is split from the existing test flow

## Notes

- Prefer the same style of narrow guard checks already used elsewhere in the repository for workflow and instruction integrity.
- Keep fixtures and assertions focused on routing presence and decision semantics, not prose perfection.
