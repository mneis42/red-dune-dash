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

## Trigger Matrix

Use the matrix below to classify repository-shaped incidents quickly.
If a concrete example matches what happened, create or update a run log.
If only the non-trigger example matches, do not log it.

| Trigger category | Create or update a run log when... | Do not create a run log when... |
| --- | --- | --- |
| unexpected `npm run verify` failure | `npm run verify` fails in a way the current task did not predict, such as an instruction-doc change exposing a broken workflow link or a supposedly ready branch failing repository verification before handoff. If `npm run verify` is unavailable for the task, apply the same rule to the required equivalent verification step you actually used. | A change intentionally breaks a check during normal local iteration and the next edit fixes it before handoff, or a review note asks for one missing test and that test is then added normally. |
| instruction conflict or misrouting | `AGENTS.md`, `instructions/`, or another canonical workflow source points the run in conflicting directions, such as one file routing the task to a lightweight review while another requires a full workflow for the same situation, and the conflict blocks or misdirects progress. | The instructions are consistent and simply require reading more than one file, or the agent chose the wrong file first and corrected itself without any conflicting repository guidance. |
| repeated rework for the same goal | The same PR goal needs more than one major rework round because an earlier approach missed the real requirement, such as rewriting the run-log policy once for wording and then again because the acceptance criteria still lacked non-trigger examples and borderline-case guidance. | Normal drafting, one review/fix pass, routine wording cleanup, or standard code review comments that tighten an otherwise correct change. |
| human rescue or redirection | A human has to correct a misleading run, restart the work with a new direction, or point out that the branch solved the wrong problem after the agent presented it as ready. | The human only supplies the original task, answers a normal clarification question, or requests an extra polish pass after the change is already on target. |
| workflow blind spot discovered after checks were green | Checks looked green enough to proceed, but a workflow hole appears afterward, such as local checks passing while a required PR handoff field is still missing or a supposedly safe workflow update still leaves agents unable to classify an incident consistently. | Checks pass and the remaining feedback is only about preference, phrasing, or optional follow-up ideas rather than a hidden workflow failure. |

## Borderline Cases

Use these tie-breakers to avoid both under-logging and blanket logging:

- Normal iteration is not repeated rework. A first draft, one fix pass, and final cleanup for the same change is expected work.
- Normal code review findings are not incidents by themselves. Log only when the findings reveal one of the trigger categories above.
- Expected failed experiments are not incidents when the failure was part of deliberate exploration and did not mislead the run status.
- Clean successful runs do not need logs, even when the task was large or required careful verification.
- Repeated follow-up notes with the same root cause belong in the same log file instead of creating a new one.

## Anti-Noise Rules

- write one log per triggering incident
- do not write routine "all green" logs
- do not write logs for normal iteration, normal review findings, or clean successful runs
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
