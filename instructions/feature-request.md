# Feature Request Instructions

This file is the canonical instruction set for agent-driven feature request work in this repository.
It is intentionally tool-agnostic and applies equally to Codex, Copilot, and comparable coding agents.

Use these instructions when the user wants to add a new feature, extend the game with a new idea, or turn a product idea into a planned and executable implementation backlog.
If the user gives more specific instructions for the current task, follow the user's instructions first and apply this file only where it does not conflict.

## Goal

Analyze the feature idea thoroughly before implementation, turn the result into a root-level `todo.md`, ask the developer whether the feature should be implemented now or moved into the backlog, and then either execute the approved plan to completion or archive the plan for later.

The purpose is not only to implement a request, but to ensure the idea fits the existing game and codebase without harming consistency, clarity, architecture, maintainability, or delivery quality.

## Required Analysis Scope

Before any implementation starts, evaluate the feature idea from all of the following perspectives:

1. Game fit and internal consistency
2. Impact on player experience, game rules, and balancing assumptions
3. Scope, complexity, and decomposition into incremental work
4. Architecture, module boundaries, and integration points
5. Maintainability, readability, extensibility, and long-term ownership
6. Test strategy, verification needs, and regression risk
7. Documentation, tooling, CI, and deployment impact when relevant
8. Risks, unknowns, assumptions, and open questions

### What must be analyzed

- whether the idea matches the current game vision and mechanics
- whether it introduces contradictions, awkward edge cases, or inconsistent states
- whether the feature should be implemented as proposed, adjusted, reduced, or rejected
- which existing systems, files, and contracts are affected
- how to break the work into coherent, reviewable implementation steps
- what tests are required before the feature can be considered complete
- what architectural or gameplay risks need mitigation
- what documentation or process updates will be required

## Required Planning Output

Write the result of the analysis into a root-level `todo.md`.

Use `templates/todo-feature-request-template.md` as the default starting structure.
If that file is unavailable for any reason, use `templates/todo-template.md`.

This file must be understandable on its own and must act as the source of truth for the feature plan and the later execution work.

### Required contents of `todo.md`

- planning model metadata
- feature title
- short feature summary
- current status
- assumptions and unresolved questions
- explicit fit assessment for the existing game
- impact assessment for gameplay consistency and user experience
- architecture and codebase impact assessment
- verification baseline before implementation begins
- prioritized implementation plan
- risks and mitigations
- test strategy
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
- risks or edge cases
- verification required
- completion criteria
- relevant file references when known

### Required priority model

Use these priorities consistently:

- `P0`: Mandatory prerequisite, blocking architecture work, severe consistency risk, or anything required before safe implementation can continue.
- `P1`: Core feature behavior required for a correct and usable implementation.
- `P2`: Important supporting work for robustness, maintainability, tests, docs, or follow-up integration.
- `P3`: Nice-to-have polish that is explicitly non-blocking.

## Required Workflow

Follow this workflow in order.
Do not skip steps.

### Stop-Prevention Checklist (mandatory before ending a response during a feature-request run)

Before ending any response, explicitly verify all of the following:

- Before `todo.md` was created, a new suitably named local branch was created from `origin/main` and checked out.
- All analysis work, implementation work, and any local commits are being done on that branch.
- If analysis is still in progress, the feature idea has not skipped straight to implementation.
- `todo.md` exists and reflects the latest analysis and implementation plan.
- If the developer has not yet chosen between immediate implementation and backlog storage, the run is paused only at that decision gate and not earlier.
- If the developer chose immediate implementation, the highest-priority open TODO is actively being executed unless all TODOs are complete.
- If the developer chose backlog storage, `todo.md` has been moved to `backlog/{short-description}.md` and implementation has not started.
- Before every implementation commit, the relevant tests and checks for that step passed.
- For PR-ready handoff responses after implementation, the mandatory checklist in [instructions/pre-pr-checklist.md](pre-pr-checklist.md) has been completed and reflected in the existing summary flow.
- If all TODOs are complete, final verification has passed and `todo.md` has been moved to `backlog/done/{timestamp}-{short-title}.md` and left uncommitted.
- If work is paused for any other reason, a real blocker is documented in `todo.md`.

If any checklist item is not satisfied, continue working instead of stopping.

### Go/No-Go Self-Test (run immediately before any final response)

Answer each item with `YES` or `NO`:

1. Before `todo.md` was created, was a new suitably named local branch created from `origin/main` and used for the rest of the workflow?
2. Has the feature idea been analyzed for game fit, consistency, architecture, risk, and testing before implementation?
3. Is `todo.md` fully up to date and usable as a standalone execution plan?
4. If the developer has not yet decided between implementation and backlog, is the run paused exactly at that decision gate?
5. If the developer chose immediate implementation, is there no higher-priority open TODO than the one currently being worked on?
6. If the developer chose backlog storage, has `todo.md` been moved to `backlog/{short-description}.md`?
7. Before every implementation commit so far, were the relevant tests green?
8. If all TODOs are done, has final verification passed and has `todo.md` been archived to `backlog/done/{timestamp}-{short-title}.md` without an extra commit afterward?
9. If handing off a PR-ready implementation result, was [instructions/pre-pr-checklist.md](pre-pr-checklist.md) completed and reflected in the existing summary flow?

Decision rule:

- If any answer is `NO`, do not end the run; continue working unless the approval gate or a real blocker applies.
- End the run only when all applicable answers are `YES`.

### 1. Analyze the feature request

Before creating or replacing `todo.md`, create and check out a new suitably named local branch from `origin/main`.
Do not continue the workflow on `main` or on an unrelated existing branch.
Perform the remaining analysis, planning, backlog handling, implementation work, and all local commits on that branch.
Do not push unless the developer explicitly asks for it.

- Inspect the relevant repository context before proposing implementation work.
- Evaluate whether the idea fits the current game, systems, UI, progression, and technical direction.
- Identify contradictions, missing requirements, risky assumptions, and likely integration points.
- If the original request should be reshaped for consistency or feasibility, say so explicitly in `todo.md`.
- Record the current verification baseline, including tests, linting, type checks, build steps, and any missing coverage relevant to the feature.

### 2. Create the planning backlog in `todo.md`

- Create or replace the root `todo.md` with the full analysis and planned implementation backlog.
- Record which model produced the planning document. If the runtime exposes the exact model name, write that exact name. If not, ask the developer for the model name and wait for clarification instead of recording a fallback value.
- Break the feature into incremental TODOs that can be completed and verified one by one.
- Include risks, mitigations, and test expectations for each meaningful step.
- Prefer plans that protect architecture, readability, maintainability, extensibility, and game consistency over the fastest possible implementation path.

### 3. Pause for explicit developer decision

After `todo.md` is ready, stop and ask the developer whether the feature should be implemented now or moved into the backlog.

Rules:

- Do not start coding the feature before the developer explicitly chooses immediate implementation.
- Do not create implementation commits before that choice.
- If the developer requests plan changes, update `todo.md` first and keep the decision gate in place until the revised plan is accepted.
- If the developer chooses backlog storage, move `todo.md` to `backlog/{short-description}.md` and stop without implementation work.
- Prefer a compact ASCII slug for `{short-description}`.

### 4. Execute the approved TODOs one by one

After the developer explicitly chooses immediate implementation:

- Always pick the highest-priority remaining TODO first.
- If a TODO is too large, split it into smaller TODOs in `todo.md` before implementation.
- Keep `todo.md` current so status, scope, and risks stay accurate.
- For each TODO that is executed, record which model performed that step. If the exact model name is unavailable, ask the developer for clarification and use that answer consistently.
- Reprioritize if newly discovered issues are more urgent than the remaining plan.
- Make cohesive local commits with English commit messages on the prepared branch from `origin/main`.
- Do not batch unrelated TODOs into one commit unless they are inseparable.

### 5. Verify every step before committing

Before each implementation commit:

- run the relevant automated tests, linters, type checks, builds, or targeted verification for that TODO
- confirm the changed behavior remains consistent with the game and the approved plan
- update `todo.md` with the verification performed and the resulting status
- do not commit if the required checks for that step are failing

If a TODO cannot be completed safely with green verification, document the blocker or remaining work in `todo.md` instead of pretending it is done.

### 6. Perform final verification after all TODOs are complete

When all TODOs are marked done, perform a final verification pass over the full feature.

This final verification must confirm:

- the approved feature scope was actually implemented
- the game remains internally consistent
- no TODO was marked complete prematurely
- relevant tests are green
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

## Quality Bar For Feature Execution

When implementing approved TODOs, always protect:

- correctness
- game consistency
- architecture quality
- readability
- maintainability
- extensibility
- testability
- documentation accuracy

Do not accept a shortcut implementation if it weakens the codebase in those areas without a compelling and documented reason.

## Verification Expectations

Use the most appropriate verification available for each TODO, for example:

- automated tests
- targeted new tests
- linting or type checks
- build verification
- manual gameplay verification
- architecture or state-transition sanity checks
- documentation updates when behavior or workflow changed

Before every implementation commit, the relevant checks must be green.

## Task Packages (Canonical Insertion Point)

This section defines reusable task-package shapes for common repository work.
Packages are advisory overlays for planning and execution detail. They do not replace the canonical routing in `AGENTS.md` and they do not create a parallel workflow.

How to use packages in this workflow:

- Keep this feature-request workflow as the primary process.
- Select the package that best matches the implementation slice.
- Add package-specific checks and completion criteria into `todo.md` TODO items.
- If multiple packages apply, combine them and keep the stricter verification set.

### Package: Balancing Tweak

Use when adjusting economy, spawn rates, progression pacing, score pressure, or reward curves.

- Typical files: `game-endless.js`, `styles.css`, `README.md` (balancing notes if needed)
- Required checks:
  - manual before/after gameplay comparison for early, mid, and pressure phases
  - verify no softlock or unavoidable failure state was introduced
  - verify score/reward changes do not invalidate visible player guidance

### Package: PWA / Offline Reliability

Use when changing installability, cache behavior, service worker lifecycle, or asset versioning.

- Typical files: `service-worker.js`, `manifest.webmanifest`, `app-assets.js`, `version.json`
- Required checks:
  - verify first load and repeat load behavior
  - verify offline fallback or cache-hit behavior after an initial online visit
  - verify update behavior when `version.json` and cached assets diverge

### Package: Gameplay Bugfix

Use when a player-facing gameplay defect is fixed as part of the feature delivery.

- Typical files: `game-endless.js`, tests in `tests/`, player-facing docs in `README.md`
- Required checks:
  - reproduce baseline behavior before fix (or document why reproduction is blocked)
  - verify fix for the reported path and at least one adjacent edge case
  - add or update regression checks where practical

### Package: Workflow / Docs Update

Use when implementation affects process docs, instructions, templates, CI guardrails, or contributor workflows.

- Typical files: `instructions/*.md`, `.github/instructions/*.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/`
- Required checks:
  - verify changed guidance is consistent across canonical and mirrored instruction files
  - verify command examples exist and are executable in this repository context
  - verify no wording contradicts routing authority in `AGENTS.md`

### Package: Targeted Review Readiness

Use before handing off a contained change set for lightweight review.

- Typical files: changed implementation files plus related tests/docs
- Required checks:
  - ensure diff boundary is intentional and coherent
  - ensure behavior changes are covered by tests or explicit manual verification notes
  - ensure reviewer-facing context is present (risk, scope, and expected behavior)

## Behavior Expectations For Agents

- Be thorough before coding.
- Challenge feature ideas that do not fit the current game or architecture.
- Prefer explicit trade-off documentation over silent assumptions.
- Keep `todo.md` readable for humans who may continue the work later.
- Record model identity honestly. Never invent or guess a more specific model name than the runtime actually exposes.
- Treat consistency, tests, architecture, readability, maintainability, and extensibility as first-class requirements.
- Do not skip the approval gate between planning and implementation.
- After approval, do not stop after individual TODOs or intermediate commits just to ask for confirmation.
- Continue until the workflow is fully complete or a real blocker is hit.
- Only interrupt for missing approval, missing permissions, conflicting instructions, missing critical information, or hard platform/runtime limits.
