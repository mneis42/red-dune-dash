# Change Review Instructions

This file is the canonical instruction set for lightweight, change-scoped code reviews in this repository.
It is intentionally tool-agnostic and applies equally to Codex, Copilot, and comparable coding agents.

Use these instructions when reviewing uncommitted changes, staged changes, a commit range, a small feature branch, or a pull request.
Do not use this file for a complete review of the whole repository. For that, use `instructions/full-code-review.md`.
If the user gives more specific instructions for the current task, follow the user's instructions first and apply this file only where it does not conflict.

## Goal

Review the proposed change set and its immediate impact with a high signal-to-noise ratio.

The purpose is to catch bugs, regressions, unsafe assumptions, missing verification, and change-specific maintainability issues without turning the task into a full repository audit.

## Required Review Scope

Review the changed files first, then expand only as far as needed to understand behavior, contracts, side effects, and regression risk.

The review should usually cover:

1. Correctness of the changed behavior
2. Regression risk in adjacent code paths
3. Test coverage and test relevance for the change
4. Documentation accuracy when behavior or workflow changed
5. Build, CI, deployment, or runtime safety when touched by the change
6. Game consistency, UX, and balancing only if the change affects them

## What To Inspect

- the diff itself
- nearby code needed to understand the diff correctly
- tests that should validate the change
- docs or instruction files that the change makes outdated
- workflow files when automation or release behavior is affected

## What Not To Do

- Do not turn a small review into a full-project audit unless the change clearly has repository-wide blast radius.
- Do not create `todo.md`.
- Do not make review-backlog commits.
- Do not stop on style-only nits unless they create a real maintenance or correctness risk.
- Do not flood the output with low-value comments.

## Output Expectations

Default to a review-only response unless the user explicitly asks for fixes.

The review output should:

- present findings first, ordered by severity
- prioritize bugs, regressions, unsafe edge cases, broken assumptions, and missing tests
- include file references when helpful
- explain why each finding matters
- suggest the expected direction of the fix when useful
- clearly distinguish confirmed issues from open questions or suspicions

If no meaningful findings are discovered, say so explicitly and mention any residual risk or testing gap.

## Recommended Severity Model

Use a lightweight severity model:

- `High`: likely bug, regression, broken contract, unsafe deployment/runtime behavior, or missing critical verification
- `Medium`: important maintainability, extensibility, or test gap that could plausibly cause defects soon
- `Low`: clarity, documentation, or minor robustness issue worth addressing but not urgent

## Review Workflow

### 1. Identify the change boundary

Understand what is being reviewed:

- uncommitted changes
- staged changes
- a commit or commit range
- a pull request
- a user-specified subset of files

### 2. Read the diff and gather the minimum surrounding context

Inspect the changed lines first.
Open additional files only when needed to confirm behavior, contracts, or side effects.

### 3. Check impact areas

Look for:

- behavior changes without matching test updates
- changed contracts without caller or consumer updates
- stale docs or instructions
- CI, deployment, or versioning changes that are incomplete
- gameplay or UX regressions in the touched area

### 4. Deliver concise findings

Prefer a short list of high-signal findings over exhaustive commentary.
If many issues exist, lead with the most severe ones and compress the rest.

### 5. Only switch to implementation if requested

If the user asks for a review, stay in review mode.
Only edit code or files when the user explicitly asks for fixes or for the review to be applied.

When posting multiline or Markdown-rich review findings back through GitHub CLI, prefer `npm run gh:safe -- pr comment ... --body-stdin` or `--body-file` instead of inline `--body` quoting.
In this agent environment, request escalated execution up front for networked `gh` commands such as `gh pr create`, `gh pr comment`, `gh pr review`, `gh pr view`, `gh pr diff`, `gh api`, and `gh run view/list`; keep sandbox `gh` usage for clearly local-only commands such as `gh help` and `gh version`.
If `gh pr view --json` lacks a needed field, describe that as a high-level subcommand field limitation and use `gh api` for the supported follow-up query instead of implying a broader GitHub API limitation.


## Run-Log Handling For Review Runs

Lightweight reviews stay low-noise, but they are not exempt from the repository run-log policy.
Use [docs/agent-run-logs.md](../docs/agent-run-logs.md) as the authority for trigger conditions, storage, anti-noise rules, and schema.

For change-review runs:

- if a triggering incident occurred during the review process, create or update the run log
- if no trigger occurred, do not write a run log for the review
- treat clean review-only runs as explicit no-log cases, not as missing workflow output
- when the review is part of a PR-ready implementation run or another workflow that requires handoff metadata, complete that workflow's explicit run-log decision checkpoint and record either `created/updated: <log path>` or `none required`

Normal review findings are not incidents by themselves.
Only create or update a run log when the review actually hits one of the trigger categories from `docs/agent-run-logs.md`, such as instruction misrouting, repeated major rework, an unexpected verification failure, or a workflow blind spot discovered after checks looked green.

## Task Packages (Canonical Insertion Point)

This section defines reusable task-package shapes for common repository work.
Packages are advisory overlays for review framing and verification depth. They do not replace the canonical routing in `AGENTS.md` and they do not create a parallel workflow.

How to use packages in this workflow:

- Keep this change-review workflow as the primary process.
- Select the package that best matches the changed behavior under review.
- Use package checks to decide review depth and missing-verification findings.
- If multiple packages apply, combine them and prioritize the highest-risk checks.

### Package: Balancing Tweak

Use when the diff changes economy, spawn rates, progression pacing, score pressure, or reward curves.

- Typical files: `game-endless.js`, `styles.css`, `README.md` (balancing notes if touched)
- Review checks:
  - verify change rationale matches game progression goals
  - verify no new softlock or unavoidable failure pattern appears
  - verify player-facing guidance remains accurate after tuning changes

### Package: PWA / Offline Reliability

Use when the diff changes installability, caching, service worker lifecycle, or asset/version manifests.

- Typical files: `service-worker.js`, `manifest.webmanifest`, `app-assets.js`, `version.json`
- Review checks:
  - verify update and cache invalidation paths are coherent
  - verify offline behavior expectations are test-backed or manually validated
  - verify versioning and cache keys move together to avoid stale clients

### Package: Gameplay Bugfix

Use when a player-facing defect is fixed in the reviewed change set.

- Typical files: `game-endless.js`, tests in `tests/`, player-facing docs in `README.md`
- Review checks:
  - verify expected-vs-actual behavior is explicit
  - verify regression coverage exists for the fixed path and adjacent edge case
  - verify fix addresses root cause rather than only symptom masking

### Package: Workflow / Docs Update

Use when process docs, instructions, templates, or CI guidance are changed.

- Typical files: `instructions/*.md`, `.github/instructions/*.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/`
- Review checks:
  - verify wording consistency across canonical and mirrored instruction files
  - verify examples and commands are actionable in this repository
  - verify workflow routing authority remains unchanged

### Package: Targeted Review Readiness

Use when validating that a small or medium diff is review-ready.

- Typical files: changed implementation files plus related tests/docs
- Review checks:
  - verify change boundary is coherent and complete for the stated intent
  - verify behavior changes have matching verification evidence
  - verify reviewer can infer risk, expected behavior, and follow-up scope quickly

## Behavior Expectations For Agents

- Be skeptical of regressions hidden behind small diffs.
- Prefer root-cause observations over style commentary.
- Keep the review concise, direct, and actionable.
- Expand the scope only when the changed code makes that necessary.
- Treat missing tests as a first-class finding when the change meaningfully alters behavior.
- Respect the repository language conventions: German for player-facing UI, English for code and active technical documentation. Historical backlog archives in `backlog/done/` are allowed to remain in their original language unless the reviewed change explicitly migrates them.
