---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 5
priority: 1
status: done
created_at: 2026-03-16
last_updated: 2026-03-18
---

# TODO: Structured Run Logs With Explicit Triggers

## Goal

Introduce short, structured run logs for clearly defined friction and failure triggers.

## Scope

- Define trigger conditions (unexpected verify failure, instruction conflict, repeated rework, human rescue, blind spot after green checks).
- Define a minimal schema for comparable records over time.
- Define storage location (`logs/agent-runs/`) without mixing with review/backlog artifacts.
- Define anti-noise rules (one log per triggering incident, no routine "all green" logging, and dedupe follow-up notes for the same root cause).

## Out Of Scope

- Logging every routine task.
- Automatic telemetry or external analytics.

## Acceptance Criteria

- Trigger list is explicit and low-noise.
- Log schema is documented and intentionally short, with explicit required fields:
	- date
	- task type
	- short goal
	- changed files
	- checks run and outcomes
	- failure or friction category
	- human correction needed
	- missing or misleading guardrail
	- one concrete improvement proposal
- Storage path is documented and consistent with repository structure.
- Storage path is fixed to `logs/agent-runs/`.

## Suggested Verification

- `npm run check`
- Manual review against `workflow-ideas.md` trigger and schema requirements.

## Notes

- Keep this advisory and lightweight to avoid process overhead.
