---
workflow_type: backlog-item
source: review-findings-2026-03-18
priority: 2
status: done
planning_model: GPT-5.4
execution_model: GPT-5.4
created_at: 2026-03-18
last_updated: 2026-03-20
---

# TODO: Reconcile Open Backlog With Actual Implementation State

## Goal

Restore trust in the prioritized backlog by closing, updating, or rewriting items that no longer match the repository reality.

## Scope

- Audit open prioritized backlog entries against the current codebase, workflows, and tests.
- Close or rewrite backlog items that are already implemented, partially implemented, or superseded.
- Resolve priority drift between filename numbering, frontmatter `priority`, and tool assumptions that still read the filename as the priority signal.
- Add or document a repeatable review/validation step that keeps backlog state aligned after future workflow or tooling changes.
- Decide which lightweight guardrail is appropriate for this repo and document it explicitly.
- Start with the currently suspected stale-or-drifted items from the 2026-03-18 review:
- `backlog/12-todo-instruction-workflow-checks-in-ci.md`
- `backlog/14-todo-ci-consumes-advisory-rules.md`
- `backlog/29-todo-add-backlog-deduplication-guardrails.md`
- `backlog/9-todo-align-agents-rule-text-with-backlog-lint-cutoff.md`
- the current group with filename/frontmatter priority drift (`9`, `11`, `12`, `13`, `14`, `15`, `16`)
- Candidate guardrails may include:
- a periodic backlog-reconciliation checklist tied to review or release-style passes
- a script that flags likely stale open items based on implemented commands, checks, or workflow steps
- a policy that backlog items affected by a change must be updated or closed in the same branch when their acceptance criteria become true

## Out Of Scope

- Implementing every still-valid backlog item immediately.
- Replacing the current backlog system with a new planning format.

## Acceptance Criteria

- Open backlog items reflect real remaining work instead of stale history.
- Any intentional distinction between filename number and frontmatter priority is documented and tool-compatible, or the drift is removed.
- Helper tooling and human-facing docs no longer point at inconsistent backlog priorities.
- There is an explicit guardrail, checklist step, or automated validation plan aimed at catching backlog-state drift before it accumulates again.
- The selected guardrail defines its trigger, owner, and expected follow-up action clearly enough that another agent can execute it without inventing a parallel workflow.

## Suggested Verification

- `npm run backlog:lint`
- `npm run test:backlog-lint`
- `npm run test:backlog-branch`
- Manual spot-check of revised open items against current CI/workflow behavior.
- If automation is introduced, run it against at least one intentionally stale example or equivalent fixture scenario.

## Notes

- This review found multiple open backlog entries whose acceptance criteria already appear satisfied by the current repository state.
- If automation is added, keep false positives low; stale-backlog detection is only useful if maintainers trust it.
- Prefer one small, trusted guardrail over a broad but noisy backlog-policing system.
- The initial candidate list above is a starting point for the reconciliation pass, not proof that every listed item should be closed unchanged.
- Reconciled in this pass: the CI instruction/workflow check item, the advisory-rule CI consumption item, the AGENTS/lint cutoff wording item, and the backlog deduplication guardrails item were archived as done.
- Selected guardrail: the mandatory pre-PR checklist now includes a backlog sync review, and `npm run agent:summary` reports its result in the handoff output.
