---
workflow_type: backlog-item
source: agent-run-log-gap-2026-03-21
priority: 37
status: done
planning_model: GPT-5.4 Thinking
execution_model: GPT-5.4 Thinking or smaller follow-up model
created_at: 2026-03-21
last_updated: 2026-03-21
---

# TODO: Make Agent Run Log Triggers Operational For Weaker Models

## Goal

Translate the current friction and failure policy into concrete trigger rules and examples that weaker models can apply consistently without over-logging.

## Scope

- Expand `docs/agent-run-logs.md` with a short trigger matrix that maps abstract categories to concrete repository-relevant examples.
- Clarify borderline cases so agents can distinguish true incidents from normal iteration, expected failed experiments, or routine review comments.
- Add explicit anti-noise examples for cases that must not create a run log.
- Keep the policy focused on friction and failure learning only, with short examples rather than a long essay.

## Out Of Scope

- Changing the required run-log schema fields.
- Adding automation that creates log files automatically.
- Turning the document into a generic troubleshooting guide for all repository work.

## Acceptance Criteria

- Each trigger category has at least one concrete positive example and one non-trigger example.
- The document makes repeated rework, instruction conflict, human rescue, misleading green checks, and unexpected verification failures easier to classify consistently.
- The document explicitly states that normal iteration, normal code review findings, and clean successful runs do not require logs.
- The resulting policy is short enough that weaker models can apply it without inventing new categories or defaulting to blanket logging.

## Suggested Verification

- `npm run check`
- `npm test`
- Manual review using a small scenario table: no-incident run, one-trigger run, repeated-follow-up run sharing the same root cause

## Notes

- Prefer repository-shaped examples such as misleading instruction routing, green checks with workflow failure, or repeated rework for the same PR goal.
- Keep examples concrete enough that agents do not need human interpretation for obvious cases.
