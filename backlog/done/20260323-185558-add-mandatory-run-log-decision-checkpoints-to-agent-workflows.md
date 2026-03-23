---
workflow_type: backlog-item
source: agent-run-log-gap-2026-03-21
priority: 36
status: done
planning_model: GPT-5.4 Thinking
execution_model: GPT-5.4 Thinking or smaller follow-up model
created_at: 2026-03-21
last_updated: 2026-03-21
---

# TODO: Add Mandatory Run Log Decision Checkpoints To Agent Workflows

## Goal

Prevent missed incident logs by adding one explicit run-log decision checkpoint to the repository’s mandatory agent workflows.

## Scope

- Update the mandatory pre-PR workflow so agents must explicitly decide whether a run log is required before PR handoff.
- Update the bug workflow stop-prevention checklist so agents must explicitly verify whether a triggering incident occurred and whether a run log was created or updated when required.
- Add the same explicit decision point to other canonical agent workflows that can realistically encounter friction or failure incidents during normal repository work.
- Keep the output lightweight by allowing only two states when no incident happened: `none required` or an equivalent short explicit negative result.

## Out Of Scope

- Expanding the underlying trigger definitions themselves.
- Adding new repository-wide telemetry, analytics, or routine execution logs.
- Requiring a run-log status line in workflows that are purely read-only if that would add noise without decision value.

## Acceptance Criteria

- Mandatory workflow files contain an explicit checkpoint that asks whether a run-log trigger occurred during the run.
- The checkpoint requires log creation or update only when a trigger actually occurred.
- The checkpoint allows a concise explicit `none required` result when no trigger occurred.
- Agents can no longer finish a PR-ready or bug-fix run without making the run-log decision visible in workflow output.

## Suggested Verification

- `npm run check`
- `npm test`
- Manual dry run of at least one no-incident scenario and one triggered-incident scenario against the updated workflow text

## Notes

- Keep the checkpoint binary and low-noise.
- Prefer wording that makes skipping the decision impossible, but makes unnecessary logging equally impossible.
