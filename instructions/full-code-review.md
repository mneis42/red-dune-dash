# Full Code Review Instructions

This file is the single source of truth for agent-driven full code reviews in this repository.
It is intentionally tool-agnostic and applies equally to Codex, Copilot, and comparable coding agents.

Use these instructions only when the task is a complete review of the whole project, not for small feature reviews or isolated file checks.
If the user gives more specific instructions for the current task, follow the user's instructions first and apply this file only where it does not conflict.

## Goal

Perform a complete review of the project and then drive the resulting improvement work to completion.

The review must cover the entire project except for the `reviews/` directory.
The purpose is not only to inspect code quality, but also to review the overall product and delivery quality of the project.

## Required Review Scope

Review all relevant files and systems in the repository except `reviews/`.
The review must explicitly include all of the following perspectives:

1. Code quality and correctness
2. Architecture and separation of responsibilities
3. Maintainability, readability, and extensibility
4. Testability
5. Documentation quality
6. Game consistency and gameplay logic
7. Build, CI, deployment, and pipeline safety
8. Test coverage, test quality, and test clarity

In practice, a full review includes root-level source files, configuration files, game logic, documentation, tests, workflow definitions in `.github/`, and any supporting files that affect runtime behavior, delivery, or maintainability, while excluding `reviews/`.

### What must be reviewed

- runtime bugs, edge cases, state issues, softlocks, and regression risks
- architecture, module boundaries, coupling, duplication, and data flow
- in-file documentation, comments, naming, and developer clarity
- Markdown documentation such as `README.md`, docs, and process files
- maintainability of the codebase as it grows
- how easily the systems can be tested and extended
- whether the game rules, interactions, UI states, and balancing assumptions are internally consistent
- whether CI/CD pipelines are correct, sufficiently hardened, and appropriate for the repository, including workflow permissions, secret handling, third-party action pinning, deploy guards, cache or artifact handling, and release safety
- whether tests are present where needed and whether those tests are meaningful, clean, and understandable

### Mandatory exclusions

- Ignore the entire `reviews/` directory while performing the review.
- Do not use previous review results as input for the current review.
- Archived review outputs may only be touched again at the very end when the current `todo.md` is moved into `reviews/`.

## Review Output

Write the complete result of the review into a root-level `todo.md`.

This file must be understandable on its own and must serve as the actionable backlog for the follow-up implementation work.

### Requirements for `todo.md`

- Use clear TODO items with explicit priorities.
- Explain each issue well enough that it is still understandable later.
- Make the backlog incremental so items can be solved one by one.
- Prefer actionable, implementation-oriented wording over vague observations.
- Group related findings when that improves clarity, but do not hide distinct problems inside one oversized TODO.
- Record the current verification baseline before implementation begins so later fixes can be compared against the real starting state.

### Required priority model

Use these priorities consistently:

- `P0`: Must be addressed first. Severe correctness, safety, softlock, broken pipeline, major consistency, or foundational architecture problems.
- `P1`: Important next work. Significant maintainability, extensibility, testability, or design problems that materially slow progress.
- `P2`: Important structural improvements that support medium-term growth.
- `P3`: Lower-priority quality, clarity, tooling, or polish improvements.

### Required structure for each TODO

Each TODO should contain:

- priority
- concise title
- problem description
- why it matters
- concrete expectation for the fix
- completion criteria
- verification performed
- remaining risk or follow-up note
- file references when helpful

## Required Workflow

Follow this workflow in order.
Do not skip steps.

### 1. Perform the full review

- Inspect the whole repository except `reviews/`.
- Evaluate the project against the full review scope listed above.
- Produce a fresh root-level `todo.md` containing the complete prioritized result.
- Record the current baseline status of relevant checks in `todo.md`, such as tests, build, linting, type checks, and pipeline health, including what passes, what fails, what is missing, and what could not be run.

### 2. Create a local commit for the review backlog

Once `todo.md` has been fully created, make a local git commit.

Requirements:

- The commit message must be in English.
- The commit must be local only.
- Do not push.

### 3. Execute the TODOs one by one

After the review backlog commit, start with the highest-priority open TODO and work through the list until everything is done.

Rules:

- Always pick the highest-priority remaining TODO first.
- Within the same priority, use reasonable engineering judgment and prefer prerequisite items first.
- If a TODO is too large to complete safely in one coherent change, split it into smaller TODOs before implementation and keep the priorities explicit.
- Implement the fix completely enough that the item can genuinely be considered done.
- Verify the change with appropriate checks before committing.
- Update `todo.md` so the current status remains accurate and understandable.
- If new problems are discovered while implementing a TODO, add them to `todo.md` with the correct priority instead of silently folding them into an unrelated item.
- Reprioritize the remaining TODOs when newly discovered issues are more urgent than the current backlog order.
- Create a new local git commit after finishing each TODO.
- Every commit message must be in English.
- Do not batch unrelated TODOs into one commit unless they are inseparable parts of the same fix.

### 4. Verify the full result after all TODOs are done

When all TODOs are marked complete, perform a final verification pass over the project.

This final verification must check:

- all TODOs are actually completed
- no TODO was marked done prematurely
- no new issues were introduced by the fixes
- the game remains internally consistent
- tests and pipelines still make sense after the changes
- documentation still matches the implemented behavior

### 5. Archive the completed TODO file

If the final verification is successful:

- move the root `todo.md` into the `reviews/` directory
- name the file using the format `yyyyMMdd-HHmmss-complete.md`
- use the current local timestamp at the time of archiving

Important:

- Do not create any commit after this move.
- If the final verification fails, do not archive anything yet. Reopen or add the necessary TODOs in `todo.md` and continue the workflow until the verification is clean.
- The final move into `reviews/` is intentionally left uncommitted. Do not "clean up" that state by making an extra commit or reverting the move.

## Quality Bar For TODO Execution

When executing TODOs, do not aim for the smallest possible patch if it leaves the underlying problem half-solved.
Prefer fixes that improve long-term clarity and reduce future fragility.

Each implementation step should leave the project in a healthier state with respect to:

- correctness
- clarity
- maintainability
- testability
- extensibility
- documentation accuracy

## Verification Expectations

Use the most appropriate verification available for each TODO, for example:

- automated tests
- targeted test additions
- linting or type checks
- pipeline validation where relevant
- manual gameplay verification where relevant
- documentation updates when behavior or architecture changes

If a TODO cannot be safely completed or verified, document the blocker clearly in `todo.md` instead of pretending the issue is resolved.

## Behavior Expectations For Agents

- Be thorough.
- Be explicit.
- Be skeptical of hidden regressions.
- Prefer root-cause fixes over cosmetic patches.
- Keep `todo.md` readable for humans who will continue the work later.
- Treat architecture, docs, pipelines, tests, and game consistency as first-class review targets, not side notes.
- Ignore `reviews/` during the review itself even if previous review files exist there.
