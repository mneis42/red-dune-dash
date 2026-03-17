# Agent Run Logs

This document defines when to write a structured run log, where to store it, and which fields are required.

## Scope

Run logs are for friction and failure learning only. They are not a routine activity log.

## Storage Location

Store all run logs in `logs/agent-runs/`.

Do not store these logs in `reviews/`, `backlog/`, or other folders.

## Trigger Conditions

Create a run log when at least one of these incidents occurs:

- unexpected `npm run verify` failure
- instruction conflict that blocked or misdirected work
- repeated rework (more than one major rework round for the same goal)
- human rescue or redirection after a misleading agent run
- workflow blind spot discovered after checks were green

## Anti-Noise Rules

- write one log per triggering incident
- do not write routine "all green" logs
- if follow-up notes share the same root cause, update the same log file instead of creating a new one

## Required Schema

Each log entry must include the following fields:

- `date`
- `task_type`
- `short_goal`
- `changed_files`
- `checks`
- `friction_category`
- `human_correction_needed`
- `missing_or_misleading_guardrail`
- `improvement_proposal`

## Example Template

Use this baseline and keep entries short:

```yaml
date: 2026-03-17
task_type: change-review
short_goal: Align instruction link validation behavior with docs
changed_files:
  - scripts/validate-instruction-links.js
  - tests/instruction-lint.test.js
checks:
  - name: npm run check
    outcome: pass
  - name: npm test
    outcome: fail
friction_category: repeated-rework
human_correction_needed: true
missing_or_misleading_guardrail: Preflight did not highlight test fixture mismatch risk.
improvement_proposal: Add fixture drift hint when instruction-lint fixtures are touched.
```
