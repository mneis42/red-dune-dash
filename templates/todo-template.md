---
workflow_type: <full-code-review|feature-request|bug-report|other>
title: <short-title>
overall_status: <open|in-progress|blocked|done>
planning_model: <exact-model-name>
branch: <branch-name>
created_at: <YYYY-MM-DD>
last_updated: <YYYY-MM-DD>
---

# Red Dune Dash TODO

Dieses Dokument ist die einzige Quelle fuer Prioritaeten, Ausfuehrungsstatus und Verifikation im aktuellen Run.

Model note: If the exact model name is not visible in runtime, ask the developer for the model name and wait for the answer. Do not write fallback values.

## Allowed Values

- Status values: open, in-progress, blocked, done
- Priority values: P0, P1, P2, P3

## Priority Model

- P0: severe correctness, safety, softlock, broken pipeline, or prerequisite architecture risk
- P1: core behavior or major maintainability and testability risk
- P2: important structural growth and robustness work
- P3: non-blocking quality and polish work

## Context

- Background: <brief context>
- Target state: <what should be true after completion>
- Non-goals: <explicitly out-of-scope>

## Verification Baseline

- Tests: <pass|fail|not-run> - <details>
- Build: <pass|fail|not-run> - <details>
- Lint/Typecheck: <pass|fail|not-run> - <details>
- Manual checks: <done|open> - <details>

## Assumptions And Open Questions

- Assumption: <...>
- Open question: <...>

## TODO Index

Rule: The checkbox state and the detailed status must match.

- [ ] P0 - <short title>
- [ ] P1 - <short title>
- [ ] P2 - <short title>
- [ ] P3 - <short title>

## TODO Item Template

Copy this block for each item and replace all placeholders.

### <P0|P1|P2|P3> - <Title>

Execution model: <exact-model-name>
Status: <open|in-progress|blocked|done>

Objective

<one concise objective>

Problem

<problem description>

Why it matters

<impact and risk>

Planned changes

- <change 1>
- <change 2>

Dependencies / prerequisites

- <dependency or none>

Risks / edge cases

- <risk or edge case>

Verification required

- <required tests/checks>

Done criteria

- <acceptance criterion 1>
- <acceptance criterion 2>

Verification performed

- <check + result>

Remaining risk / follow-up

- <remaining risk or none>

File references

- <path/to/file>

## Optional Blocks By Workflow

Optional (feature-request or bug-report only): Decision gate

- Developer decision: <implement-now|move-to-backlog|pending>
- Decision timestamp: <YYYY-MM-DD HH:MM>
- If pending: no implementation commits are allowed.

Optional (full-code-review only): Final archive gate

- Final verification: <pass|fail|not-run>
- Archive target: <reviews/YYYYMMDD-HHmmss-complete.md>
- Note: move to archive is intentionally left uncommitted.

## Documentation Follow-ups

- [ ] README updated
- [ ] Relevant docs in docs/ updated
- [ ] Relevant instruction or workflow files updated
