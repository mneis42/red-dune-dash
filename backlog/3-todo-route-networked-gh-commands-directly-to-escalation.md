---
workflow_type: backlog-item
source: review-findings-2026-03-20
priority: 3
status: open
planning_model: GPT-5 Codex
execution_model: GPT-5 Codex
created_at: 2026-03-20
last_updated: 2026-03-20
---

# TODO: Route Networked Gh Commands Directly To Escalation

## Goal

Avoid predictable sandbox network failures by sending GitHub CLI actions with live API requirements directly through escalated execution.

## Scope

- Classify which `gh` commands are effectively network-required in this agent environment.
- Update workflow helpers or instructions so networked `gh` actions request escalation before the first attempt.
- Keep purely local or cached `gh` usage in the sandbox when it does not depend on live GitHub API access.
- Add clear operator-facing guidance explaining why some `gh` commands intentionally skip sandbox-first execution.

## Out Of Scope

- Broad escalation of all shell commands regardless of need.
- Replacing `gh` with direct HTTP tooling or a different GitHub client.

## Acceptance Criteria

- Agent workflows do not first attempt known network-dependent `gh` actions in the sandbox when sandbox networking is unavailable.
- PR creation, commenting, reviews, and similar live GitHub actions request escalation up front.
- Documentation or helper logic clearly distinguishes local-safe versus network-required `gh` usage.
- Regression coverage or fixture-backed validation exists for the command classification where feasible.

## Suggested Verification

- Targeted tests for any helper that decides whether a command should request escalation.
- Manual validation that `gh pr create`, `gh pr comment`, and `gh pr review` choose escalated execution immediately.
- Manual validation that local-only `gh` usage still runs without unnecessary escalation when no network access is needed.

## Notes

- This item follows the 2026-03-20 friction logs where GitHub CLI operations repeatedly failed in the sandbox before succeeding after escalation.
