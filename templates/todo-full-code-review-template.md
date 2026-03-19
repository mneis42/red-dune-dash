---
workflow_type: full-code-review
title: <review-title>
overall_status: <open|in-progress|blocked|done>
planning_model: <exact-model-name-or-runtime-model-hidden>
branch: <branch-name-from-origin-main>
created_at: <YYYY-MM-DD>
last_updated: <YYYY-MM-DD>
---

# Full Code Review TODO

Model note: If the exact model name is not visible in runtime, write runtime-model-hidden and add a short note that the runtime did not expose an exact model identifier.

## Scope

- Include full repository except reviews/
- Include code, docs, tests, workflows, runtime safety

## Verification Baseline

- Tests: <pass|fail|not-run> - <details>
- Build: <pass|fail|not-run> - <details>
- Lint/Typecheck: <pass|fail|not-run> - <details>
- Manual checks: <done|open> - <details>

## TODO Index

- [ ] P0 - <title>
- [ ] P1 - <title>
- [ ] P2 - <title>
- [ ] P3 - <title>

## TODO Item Template

### <P0|P1|P2|P3> - <Title>

Execution model: <exact-model-name-or-runtime-model-hidden>
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

Verification required

- <required tests/checks>

Done criteria

- <criterion 1>
- <criterion 2>

Verification performed

- <check + result>

Remaining risk / follow-up

- <remaining risk or none>

File references

- <path/to/file>

## Final Archive Gate

- Final verification: <pass|fail|not-run>
- Archive target: <reviews/YYYYMMDD-HHmmss-complete.md>
- Note: archive move is intentionally left uncommitted.
