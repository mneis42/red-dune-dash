---
workflow_type: backlog-item
source: review-findings-2026-03-17
idea_number: 1
priority: 12
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Expand Backlog Lint Scope Beyond Numbered Files

## Goal

Ensure backlog template validation also covers newly created backlog items that do not follow numbered filenames.

## Scope

- Update backlog lint file discovery so it validates all relevant files directly under backlog, not only numbered patterns.
- Keep backlog/done out of this validation scope.
- Document which backlog filename patterns are considered in-scope and why.

## Out Of Scope

- Migrating historical files in backlog/done.
- Changing the archive naming convention for completed work.

## Acceptance Criteria

- A newly created backlog file such as backlog/some-feature.md is validated by backlog lint.
- Numbered prioritized files continue to be validated.
- backlog/done files remain excluded.

## Suggested Verification

- npm run test:backlog-lint
- npm run backlog:lint
- Add a temporary non-numbered backlog file fixture in tests and confirm lint behavior.

## Notes

- This addresses the gap where the feature-request workflow can create backlog/{short-description}.md files that are currently not linted.
