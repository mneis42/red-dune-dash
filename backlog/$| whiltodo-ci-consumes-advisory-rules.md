---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 10
priority: 6
status: open
created_at: 2026-03-16
---

# TODO: CI Consumption Of Advisory Rule Source

## Goal

Reuse the local advisory rule source in CI for aligned hints and orchestration.

## Scope

- Surface matched areas for changed files.
- Emit advisory notes for likely documentation follow-ups.
- Highlight high-risk areas touched by a diff.
- Prepare selective optional-job routing where reliable.
- Define one shared interpretation contract so local and CI consumers produce equivalent rule outputs for the same file set.

## Out Of Scope

- Using advisory rules to bypass canonical process documents.
- Undocumented blocking behavior based on rule-derived logic.
- Any hard CI blocking from rule-derived logic before that rule is explicitly documented in a canonical repository workflow document.

## Acceptance Criteria

- CI and local tooling use the same advisory rule source.
- Governance boundaries are documented clearly.
- Behavior is initially advisory unless explicitly promoted in canonical docs.
- If any rule-derived CI gate is introduced later, its policy source is traceable to a canonical document and linked in implementation notes.

## Suggested Verification

- `npm run check`
- `npm test`
- CI dry run or workflow validation on representative diffs.

## Notes

- Keep rule interpretation deterministic across local and CI contexts.
