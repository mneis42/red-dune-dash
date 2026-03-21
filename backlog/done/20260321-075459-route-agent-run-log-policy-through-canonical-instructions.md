---
workflow_type: backlog-item
source: agent-run-log-gap-2026-03-21
priority: 35
status: done
planning_model: GPT-5.4 Thinking
execution_model: GPT-5.4 Thinking or smaller follow-up model
created_at: 2026-03-21
last_updated: 2026-03-21
---

# TODO: Route Agent Run Log Policy Through Canonical Instructions

## Goal

Make friction and failure logging part of the canonical repository workflow so agents reliably discover the rule without producing routine noise logs.

## Scope

- Update `AGENTS.md` so it explicitly routes agents to `docs/agent-run-logs.md` when a triggering incident occurs.
- Keep the routing wording explicit that run logs are required only for triggering incidents and must not be written for normal all-green runs.
- Ensure the canonical wording makes `docs/agent-run-logs.md` authoritative for trigger conditions, storage location, anti-noise behavior, and schema.
- Keep the change limited to instruction routing and wording clarity; do not redesign the log schema in this item.

## Out Of Scope

- Adding new trigger categories beyond what is already intended by the run-log policy.
- Changing handoff output fields or stop-prevention checklists in workflow-specific instruction files.
- Adding lint rules, tests, or automation that validate run-log routing.

## Acceptance Criteria

- `AGENTS.md` explicitly tells agents to create or update a run log when a trigger from `docs/agent-run-logs.md` occurs.
- The routing text also states that no log should be written when no trigger occurred.
- The repository has one clear canonical place for run-log policy details instead of relying on developers to remind agents manually.
- The change does not introduce routine activity logging or “all green” logging expectations.

## Suggested Verification

- `npm run check`
- `npm test`
- Manual review of `AGENTS.md` and `docs/agent-run-logs.md` for wording consistency and non-conflicting routing

## Notes

- Keep the policy simple: trigger happened means log; no trigger means no log.
- Prefer explicit wording such as `create or update` so related follow-up notes reuse the same incident log when appropriate.
