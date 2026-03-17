# Bug Report Instructions

This file is the canonical instruction set for agent-driven bug report work in this repository.
It is intentionally tool-agnostic and applies equally to Codex, Copilot, and comparable coding agents.

Use these instructions when the user reports a bug, broken behavior, gameplay inconsistency, defect, regression, softlock, crash, or incorrect state in the game.
If the user gives more specific instructions for the current task, follow the user's instructions first and apply this file only where it does not conflict.

## Goal

Analyze the reported bug thoroughly before implementation, turn the result into a root-level `todo.md`, ask the developer whether the fix should be implemented now or moved into the backlog, and then either execute the approved fix plan to completion or archive the plan for later.

The purpose is not only to patch the visible symptom, but to understand the bug clearly, protect gameplay consistency, identify the likely root cause, and deliver a fix that is verified, maintainable, and resistant to regression.

## Required Analysis Scope

Before any implementation starts, evaluate the bug from all of the following perspectives:

1. Reproduction clarity and reliability
2. Actual behavior versus expected behavior
3. Severity, player impact, and urgency
4. Game consistency, rules, progression, and state integrity
5. Likely root cause, affected systems, and blast radius
6. Fix strategy, complexity, and decomposition into safe steps
7. Test strategy, regression risk, and verification needs
8. Documentation, tooling, CI, and deployment impact when relevant

### What must be analyzed

- whether the bug can be reproduced reliably and under which conditions
- what the expected behavior should be in the context of the current game
- whether the issue is a regression, long-standing defect, balancing problem, or rules inconsistency
- whether the bug risks softlocks, broken saves, impossible states, incorrect scoring, UI confusion, or hidden data corruption
- which existing systems, files, and contracts are affected
- whether the visible bug is likely only a symptom of a deeper architectural or state-management issue
- how to break the fix into coherent, reviewable implementation steps
- what tests or targeted checks are required before the bug can be considered resolved

## Required Planning Output

Write the result of the analysis into a root-level `todo.md`.

Use `templates/todo-bug-report-template.md` as the default starting structure.
If that file is unavailable for any reason, use `templates/todo-template.md`.

This file must be understandable on its own and must act as the source of truth for the bug analysis and the later execution work.

### Required contents of `todo.md`

- planning model metadata
- bug title
- short bug summary
- current status
- reproduction status
- reproduction steps or current reproduction limitation
- expected behavior
- actual behavior
- severity and player impact assessment
- assumptions and unresolved questions
- explicit gameplay consistency assessment
- root-cause hypothesis or confirmed cause
- architecture and codebase impact assessment
- verification baseline before implementation begins
- prioritized fix plan
- risks and mitigations
- regression test strategy
- documentation follow-ups

### Required structure for each implementation TODO

Each implementation TODO should contain:

- execution model metadata
- priority
- concise title
- status
- objective
- planned changes
- dependencies or prerequisites
- bug risk, edge cases, or regression concerns
- verification required
- completion criteria
- relevant file references when known

### Required priority model

Use these priorities consistently:

- `P0`: Crash, softlock, broken progression, corrupted state, severe gameplay inconsistency, or any defect that must be addressed before other work can safely continue.
- `P1`: Important player-facing bug, significant regression, or high-value root-cause fix required for correct gameplay.
- `P2`: Supporting robustness, missing regression tests, maintainability work, or secondary fixes discovered while resolving the main bug.
- `P3`: Lower-priority polish, rare edge case hardening, or non-blocking cleanup linked to the bug.

## Required Workflow

Follow this workflow in order.
Do not skip steps.

### Stop-Prevention Checklist (mandatory before ending a response during a bug-report run)

Before ending any response, explicitly verify all of the following:

- Before `todo.md` was created, a new suitably named local branch was created from `origin/main` and checked out.
- All analysis work, implementation work, and any local commits are being done on that branch.
- If analysis is still in progress, the bug has not skipped straight to implementation.
- `todo.md` exists and reflects the latest bug analysis and fix plan.
- If the developer has not yet chosen between immediate implementation and backlog storage, the run is paused only at that decision gate and not earlier.
- If the developer chose immediate implementation, the highest-priority open TODO is actively being executed unless all TODOs are complete.
- If the developer chose backlog storage, `todo.md` has been moved to `backlog/{short-description}.md` and implementation has not started.
- Before every implementation commit, the relevant tests and checks for that step passed.
- If all TODOs are complete, final verification has passed and `todo.md` has been moved to `backlog/done/{timestamp}-{short-title}.md` and left uncommitted.
- If work is paused for any other reason, a real blocker is documented in `todo.md`.

If any checklist item is not satisfied, continue working instead of stopping.

### Go/No-Go Self-Test (run immediately before any final response)

Answer each item with `YES` or `NO`:

1. Before `todo.md` was created, was a new suitably named local branch created from `origin/main` and used for the rest of the workflow?
2. Has the bug been analyzed for reproduction, impact, consistency, root cause, architecture, risk, and testing before implementation?
3. Is `todo.md` fully up to date and usable as a standalone execution plan?
4. If the developer has not yet decided between implementation and backlog, is the run paused exactly at that decision gate?
5. If the developer chose immediate implementation, is there no higher-priority open TODO than the one currently being worked on?
6. If the developer chose backlog storage, has `todo.md` been moved to `backlog/{short-description}.md`?
7. Before every implementation commit so far, were the relevant tests green?
8. If all TODOs are done, has final verification passed and has `todo.md` been archived to `backlog/done/{timestamp}-{short-title}.md` without an extra commit afterward?

Decision rule:

- If any answer is `NO`, do not end the run; continue working unless the decision gate or a real blocker applies.
- End the run only when all applicable answers are `YES`.

### 1. Analyze the bug report

Before creating or replacing `todo.md`, create and check out a new suitably named local branch from `origin/main`.
Do not continue the workflow on `main` or on an unrelated existing branch.
Perform the remaining analysis, planning, backlog handling, implementation work, and all local commits on that branch.
Do not push unless the developer explicitly asks for it.

- Inspect the relevant repository context before proposing implementation work.
- Reconstruct the bug report carefully and clarify expected behavior from the current game rules and systems.
- Reproduce the issue when feasible, or document exactly why reproduction is currently blocked.
- Evaluate severity, player impact, state integrity risk, and likely regression risk.
- Identify likely root causes, affected subsystems, and whether the symptom suggests a deeper issue.
- Record the current verification baseline, including tests, linting, type checks, build steps, and any missing coverage relevant to the bug.

### 2. Create the bug-fix backlog in `todo.md`

- Create or replace the root `todo.md` with the full bug analysis and planned fix backlog.
- Record which model produced the planning document. If the runtime exposes the exact model name, write that exact name. If not, ask the developer for the model name and wait for clarification instead of recording a fallback value.
- Break the fix into incremental TODOs that can be completed and verified one by one.
- Include risks, mitigations, reproduction notes, and regression-test expectations for each meaningful step.
- Prefer plans that fix the root cause and protect architecture, readability, maintainability, extensibility, and game consistency over the smallest possible symptom-only patch.

### 3. Pause for explicit developer decision

After `todo.md` is ready, stop and ask the developer whether the bug should be fixed now or moved into the backlog.

Rules:

- Do not start coding the fix before the developer explicitly chooses immediate implementation.
- Do not create implementation commits before that choice.
- If the developer requests plan changes, update `todo.md` first and keep the decision gate in place until the revised plan is accepted.
- If the developer chooses backlog storage, move `todo.md` to `backlog/{short-description}.md` and stop without implementation work.
- Prefer a compact ASCII slug for `{short-description}`.

### 4. Execute the approved TODOs one by one

After the developer explicitly chooses immediate implementation:

- Always pick the highest-priority remaining TODO first.
- If a TODO is too large, split it into smaller TODOs in `todo.md` before implementation.
- Keep `todo.md` current so status, scope, cause analysis, and risks stay accurate.
- For each TODO that is executed, record which model performed that step. If the exact model name is unavailable, ask the developer for clarification and use that answer consistently.
- Reprioritize if newly discovered issues are more urgent than the remaining plan.
- Make cohesive local commits with English commit messages on the prepared branch from `origin/main`.
- Do not batch unrelated TODOs into one commit unless they are inseparable.

### 5. Verify every step before committing

Before each implementation commit:

- run the relevant automated tests, linters, type checks, builds, or targeted verification for that TODO
- confirm the changed behavior matches the expected gameplay behavior and does not introduce new inconsistencies
- update `todo.md` with the verification performed and the resulting status
- do not commit if the required checks for that step are failing

If a TODO cannot be completed safely with green verification, document the blocker or remaining work in `todo.md` instead of pretending it is done.

### 6. Perform final verification after all TODOs are complete

When all TODOs are marked done, perform a final verification pass over the full bug fix.

This final verification must confirm:

- the reported bug is resolved or the documented scope of the fix is fully met
- the game remains internally consistent
- no TODO was marked complete prematurely
- relevant tests are green
- regression coverage is appropriate for the defect
- documentation and technical instructions still match reality
- the resulting code is readable, maintainable, and extensible enough for the repository standard

### 7. Archive the completed plan

If the final verification is successful:

- move the root `todo.md` into `backlog/done/`
- name the file using the format `{timestamp}-{short-title}.md`
- use the current local timestamp at the time of archiving
- prefer a compact ASCII slug for `{short-title}`

Important:

- Do not create any commit after this move.
- If final verification fails, do not archive anything yet. Reopen or add the necessary TODOs in `todo.md` and continue until verification is clean.
- The archive move is intentionally left uncommitted.

## Quality Bar For Bug Fix Execution

When implementing approved TODOs, always protect:

- correctness
- game consistency
- root-cause quality
- architecture quality
- readability
- maintainability
- extensibility
- testability
- documentation accuracy

Do not accept a shortcut fix if it leaves the underlying issue half-solved, introduces fragile conditionals, or increases the chance of a similar regression later without a compelling and documented reason.

## Verification Expectations

Use the most appropriate verification available for each TODO, for example:

- automated tests
- targeted regression tests
- linting or type checks
- build verification
- manual gameplay reproduction before and after the fix
- state-transition or persistence sanity checks
- documentation updates when behavior or workflow changed

Before every implementation commit, the relevant checks must be green.

## Behavior Expectations For Agents

- Be thorough before coding.
- Be skeptical of symptom-only fixes that do not explain the bug.
- Prefer explicit reproduction notes and root-cause reasoning over guesswork.
- Keep `todo.md` readable for humans who may continue the work later.
- Record model identity honestly. Never invent or guess a more specific model name than the runtime actually exposes.
- Treat correctness, consistency, tests, architecture, readability, maintainability, and extensibility as first-class requirements.
- Do not skip the decision gate between planning and implementation.
- After approval, do not stop after individual TODOs or intermediate commits just to ask for confirmation.
- Continue until the workflow is fully complete or a real blocker is hit.
- Only interrupt for missing approval, missing permissions, conflicting instructions, missing critical information, or hard platform/runtime limits.
