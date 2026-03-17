---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 7
priority: 3
status: open
created_at: 2026-03-16
---

# TODO: Unified Summary Generation

## Goal

Provide one summary tool that covers local-change and postflight summary needs in a single command.

## Scope

- Define command contract (for example `npm run agent:summary`).
- Emit changed files, checks and outcomes, affected docs, user impact, risks, and open questions.
- Provide concise copy-ready output for commit, PR, or handoff contexts.

## Out Of Scope

- Multiple overlapping summary commands with duplicated logic.
- Workflow-routing decisions.

## Acceptance Criteria

- One canonical summary command exists.
- Output fields align with `workflow-ideas.md` and existing repository workflows.
- Output stays useful without overstating validation coverage.

## Suggested Verification

- `npm run check`
- `npm test`
- Manual snapshot checks for representative diffs.

## Notes

- Prefer deterministic signals over free-text inference.
