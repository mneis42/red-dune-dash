---
workflow_type: backlog-item
source: agent-run-log-gap-2026-03-21
priority: 39
status: done
planning_model: GPT-5.4 Thinking
execution_model: GPT-5.2-Codex
created_at: 2026-03-21
last_updated: 2026-03-21
---

# TODO: Close Run Log Policy Gap In Change Review Workflow

## Goal

Finish the repository-wide run-log policy by making the lightweight change-review workflow explicitly handle incident logging decisions in the same low-noise way as the other canonical workflows.

## Scope

- Update `instructions/change-review.md` so the workflow explicitly addresses the run-log policy from `docs/agent-run-logs.md`.
- Decide the intended behavior for review-only runs and encode it directly in the instruction text.
- Keep the wording consistent with `AGENTS.md`: log only when a trigger occurred, and do not log clean no-incident runs.
- Extend the existing instruction guard checks so this policy cannot silently drift again.

## Out Of Scope

- Redesigning the run-log schema in `docs/agent-run-logs.md`
- Adding routine logs for successful reviews
- Expanding run-log handling into non-canonical advisory documents
- Reworking full-code-review, bug-report, or pre-PR instructions unless needed only for wording consistency

## Acceptance Criteria

- `instructions/change-review.md` explicitly defines how run-log handling works for lightweight review runs.
- The resulting behavior is unambiguous for weaker models:
  - trigger occurred => create or update a run log
  - no trigger occurred => no run log
- The instruction text does not accidentally require routine “none required” noise in normal review output unless that is a deliberate repository-wide policy decision.
- Automated instruction coverage fails if `change-review.md` loses the required run-log handling semantics in a future change.

## Suggested Verification

- `npm run check`
- `npm test`
- Manual dry run against these scenarios:
  - clean PR review with no incident
  - review run that exposes instruction misrouting
  - review run that reveals a workflow blind spot after checks looked green

## Notes

- Keep the policy aligned with `docs/agent-run-logs.md` anti-noise rules.
- Prefer one explicit canonical rule over leaving lightweight review runs to agent interpretation.
- If the chosen behavior differs from full-code-review or bug-report output style, document that difference clearly instead of implying consistency where none exists.
