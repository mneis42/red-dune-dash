---
workflow_type: backlog-item
source: review-findings-2026-03-17
idea_number: 2
priority: 13
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Enforce Feature-Request Template For New Backlog Ideas

## Goal

Prevent ambiguity by enforcing one canonical template path for new idea-to-backlog entries.

## Scope

- Decide and document that new backlog idea files must use workflow_type: feature-request.
- Update AGENTS and related workflow guidance to remove dual-path wording for new idea files.
- Update backlog lint to fail new idea files that use unsupported workflow types for this path.

## Out Of Scope

- Rewriting all historical backlog-item files retroactively.
- Changing bug-report or full-code-review template behavior.

## Acceptance Criteria

- AGENTS clearly states the required template/workflow_type for new idea files.
- Backlog lint rejects new idea backlog files that do not follow the chosen feature-request structure.
- Tests cover at least one valid and one invalid case for the new rule.

## Suggested Verification

- npm run test:backlog-lint
- npm run backlog:lint
- npm run verify

## Notes

- Keep compatibility rules explicit so contributors understand whether legacy backlog-item files are grandfathered or must migrate.
