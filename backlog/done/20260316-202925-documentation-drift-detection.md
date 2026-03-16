---
workflow_type: feature-request
title: Documentation Drift Detection
overall_status: done
planning_model: GPT-5.3-Codex
branch: chore/todo-template-workflows-20260316-183426
created_at: 2026-03-16
last_updated: 2026-03-16
---

# Feature Request TODO

## Feature Summary

- Summary: Add advisory documentation-drift detection so code changes proactively hint required doc updates.
- Fit assessment: High fit with the repository goal of treating docs and workflow files as first-class product infrastructure.
- Non-goals: No hard blocking gate, no automatic doc rewrites, no workflow-routing authority changes.

## Verification Baseline

- Tests: pass - `npm run test:preflight`, `npm test`.
- Build: not-run - No dedicated build step in this repository.
- Lint/Typecheck: pass - `npm run check`.
- Manual checks: done - `npm run agent:preflight -- --scope workflow-docs` reviewed drift section.

## Assumptions And Open Questions

- Assumption: `workflow/advisory-rules.json` remains the single advisory source for change classification.
- Assumption: Drift detection output is advisory and non-blocking in v1.
- Decision: Drift hints are integrated into existing `agent:preflight` output.
- Decision: JSON output is included in v1.
- Decision: Gameplay/system drift uses a fixed initial mapping list for higher precision.
- Decision: `CONTRIBUTING.md` is updated only when process/usage changes materially.

## Decision Gate

- Developer decision: implement-now
- Decision timestamp: 2026-03-16 20:25
- Rule: No implementation commits while decision is pending.

## TODO Index

- [x] P1 - Define deterministic drift mappings and hint contract
- [x] P1 - Integrate drift hints into CLI output flow
- [x] P2 - Add regression tests and documentation updates

### P1 - Define deterministic drift mappings and hint contract

Execution model: GPT-5.3-Codex
Status: done

Objective

Define deterministic advisory mappings from changed-file areas to documentation follow-up hints.

Planned changes

- Specify exact mapping rules for gameplay/system changes, PWA/service-worker changes, and workflow/instruction changes.
- Define output contract fields for advisory documentation follow-up hints.
- Ensure wording is clearly advisory and non-blocking.

Dependencies / prerequisites

- Existing advisory matcher in `scripts/advisory-rules.js`.
- Existing rule set in `workflow/advisory-rules.json`.

Risks / edge cases

- Overly broad hints can create noise and erode trust.
- Missing hints for cross-area changes can underreport drift risk.
- Documentation path changes can stale the hint map.

Verification required

- Rule contract review against workflow-idea examples.
- Manual sample mapping table reviewed for the three canonical change areas.

Done criteria

- Gameplay/system changes suggest relevant docs entries and README review.
- PWA/service-worker changes suggest offline/PWA documentation review.
- Workflow/instruction changes suggest README, CONTRIBUTING, AGENTS, and instructions review.
- No blocking behavior introduced.

Verification performed

- Added fixed mapping profiles for gameplay, pwa, and workflow-docs in preflight.
- Confirmed advisory-only wording in text output and result payload.

Remaining risk / follow-up

- Evaluate false-positive rate after first real tasks and tune hint granularity.

File references

- workflow-ideas.md
- scripts/advisory-rules.js
- workflow/advisory-rules.json

### P1 - Integrate drift hints into CLI output flow

Execution model: GPT-5.3-Codex
Status: done

Objective

Expose documentation-drift hints in the existing command flow with clear and actionable output.

Planned changes

- Decide whether hints are integrated into agent preflight output or emitted by a dedicated command.
- Implement output formatting for human-readable and JSON mode where applicable.
- Keep behavior advisory-only with no exit-code blocking for warnings.

Dependencies / prerequisites

- Mapping contract from previous item.
- Existing CLI output patterns in `scripts/agent-preflight.js`.

Risks / edge cases

- Output noise if hints are repeated per file without deduplication.
- Inconsistent output between text and JSON mode.

Verification required

- `npm run check`
- CLI smoke runs for gameplay, PWA, and workflow-doc diffs.

Done criteria

- Drift hint section appears in CLI output when applicable.
- Text output and JSON output remain consistent.
- Warnings remain non-blocking.

Verification performed

- `npm run check` passed.
- `npm run test:preflight` passed.
- `npm run agent:preflight -- --scope workflow-docs` shows documentation drift section in CLI output.

Remaining risk / follow-up

- Tune deduplication and phrasing based on first real usage.

File references

- scripts/agent-preflight.js
- scripts/agent-advisory.js

### P2 - Add regression tests and documentation updates

Execution model: GPT-5.3-Codex
Status: done

Objective

Protect drift-hint behavior with tests and document expected usage and limits.

Planned changes

- Add tests for positive mapping cases, mixed-area diffs, and no-hint paths.
- Document behavior and limitations in docs and contributor-facing guidance.
- Ensure workflow docs stay aligned with advisory-only governance.

Dependencies / prerequisites

- Implemented mapping and CLI integration.

Risks / edge cases

- Test fixtures may become brittle if output formatting changes.
- Documentation drift if commands or output fields evolve.

Verification required

- `npm test`
- `npm run verify`

Done criteria

- Tests cover core and edge drift-hint scenarios.
- `README.md` and `docs/advisory-rules.md` include updated drift-hint guidance.
- If relevant, `CONTRIBUTING.md` reflects new usage notes.

Verification performed

- `npm test` passed.
- `npm run verify` passed.
- Updated docs in `README.md` and `docs/advisory-rules.md`.

Remaining risk / follow-up

- Reassess hint precision after first two to three real tasks.

File references

- tests/agent-preflight.test.js
- README.md
- docs/advisory-rules.md
- CONTRIBUTING.md

## Documentation Follow-ups

- [x] README updated
- [x] Relevant docs in docs/ updated
- [x] Relevant instruction or workflow files updated
