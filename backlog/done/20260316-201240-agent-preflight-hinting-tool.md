---
workflow_type: feature-request
title: Agent Preflight Hinting Tool
overall_status: done
planning_model: GPT-5.3-Codex
branch: chore/todo-template-workflows-20260316-183426
created_at: 2026-03-16
last_updated: 2026-03-16
---

# Feature Request TODO

## Feature Summary

- Summary: Add a lightweight `agent:preflight` command that reads advisory rules and current repo state to provide non-blocking workflow guidance.
- Fit assessment: Strong fit with the current process-heavy repository setup and existing advisory rule foundation.
- Non-goals: No workflow routing authority changes, no hard gate behavior, no replacement of canonical instructions in `AGENTS.md`.

## Verification Baseline

- Tests: pass - `npm test` includes advisory, preflight, simulation, and service-worker tests.
- Build: not-run - No dedicated build step currently defined.
- Lint/Typecheck: pass - `npm run check` syntax checks available JS files.
- Manual checks: done - Ran `npm run agent:preflight -- --scope workflow-docs` and reviewed advisory output sections.

## Assumptions And Open Questions

- Assumption: Advisory rules in `workflow/advisory-rules.json` remain the single machine-readable hint source.
- Assumption: Preflight output is advisory-only and always non-blocking in v1.
- Assumption: Guardrail status is evaluated by current observable signals, not by historical execution of `npm run setup`.
- Decision: Default diff scope is staged + unstaged + untracked; `--staged` and `--unstaged` are available for focused runs.
- Decision: Hook-guardrail detection uses a concrete current-state signal via `.git/hooks/pre-commit` presence.
- Decision: Unrelated-change heuristic is explicit: files with no area intersection against task areas are flagged unrelated; task areas come from `--scope` or inferred matched areas.

## Decision Gate

- Developer decision: implement-now
- Decision timestamp: 2026-03-16
- Rule: No implementation commits while decision is pending.

## TODO Index

- [x] P0 - Define preflight contract and non-blocking policy
- [x] P1 - Implement repo-state collector and advisory matching integration
- [x] P1 - Add `npm run agent:preflight` CLI command with clear summary output
- [x] P2 - Add tests for matching, state reporting, and edge cases
- [x] P2 - Document preflight behavior and limitations
- [x] P3 - Add optional machine-readable preflight JSON mode

### P0 - Define preflight contract and non-blocking policy

Execution model: GPT-5.3-Codex
Status: done

Objective

Define exactly what `agent:preflight` reports and enforce advisory-only behavior.

Planned changes

- Specify required output sections (branch state, changed files, matched areas, recommended checks, likely docs/instructions).
- Add an explicit section for "unrelated local changes" with a deterministic heuristic and transparent rationale.
- Define explicit non-blocking exit behavior for normal usage.
- Define guardrail detection rules based on currently active signals only.
- Explicitly forbid using "setup was run at least once" as a readiness indicator.
- Define clear message format for warnings vs informational hints.

Dependencies / prerequisites

- Existing advisory rule schema and matcher.

Risks / edge cases

- Ambiguous messaging could be misread as a hard policy gate.
- Too much output can reduce practical usefulness.

Verification required

- Contract review against `workflow-ideas.md` requirements.
- Manual sample runs on clean and dirty working trees.

Done criteria

- Output contract documented in code comments or docs.
- Unrelated-change heuristic is specified and testable.
- Guardrail status detection criteria are explicit and based on current state.
- Non-blocking behavior validated for normal states.

Verification performed

- Defined and implemented explicit preflight sections for branch state, changed files, matched context, recommended checks, likely docs/instructions, unrelated changes, and guardrail state.
- Enforced non-blocking warning behavior while keeping invalid configuration (`--scope` values or invalid rules file) as explicit error exits.

Remaining risk / follow-up

- Keep v1 scope small to avoid pseudo-governance behavior.

File references

- workflow-ideas.md
- docs/advisory-rules.md
- AGENTS.md

### P1 - Implement repo-state collector and advisory matching integration

Execution model: GPT-5.3-Codex
Status: done

Objective

Collect relevant repo context and combine it with advisory rule matching.

Planned changes

- Add logic to detect current branch and whether it is `main`.
- Collect staged/unstaged changed files from git.
- Reuse `scripts/advisory-rules.js` matcher to map changed files to advisory hints.
- Include unmatched file reporting for transparency.
- Add deterministic classification for unrelated local changes (outside inferred task scope from matched areas plus optional explicit scope input).

Dependencies / prerequisites

- P0 output contract.

Risks / edge cases

- Git command behavior differences in detached HEAD or no-change states.
- Path normalization mismatches between local and CI environments.

Verification required

- Manual checks for empty diff, staged-only, unstaged-only, mixed states.
- Unit coverage for normalization and no-match fallback behavior.
- Unit coverage for unrelated-change heuristic across at least gameplay, pwa, and workflow-doc scopes.

Done criteria

- Collector returns stable structured data across supported states.
- Advisory matches are deterministic for fixed file sets.

Verification performed

- Implemented staged/unstaged/untracked collection and deterministic changed-file output.
- Integrated advisory matching via `scripts/advisory-rules.js` and added unrelated-change classification from inferred or explicit task scope.

Remaining risk / follow-up

- Consider optional `--files` override for deterministic troubleshooting.

File references

- scripts/advisory-rules.js
- scripts/agent-advisory.js

### P1 - Add `npm run agent:preflight` CLI command with clear summary output

Execution model: GPT-5.3-Codex
Status: done

Objective

Provide a one-command preflight summary that is easy to run before implementation work.

Planned changes

- Add `scripts/agent-preflight.js` CLI.
- Add `agent:preflight` script entry in `package.json`.
- Present concise sections: repo status, changed files, advisory areas, risk tags, recommended checks, docs/instructions to review.
- Include current hook-guardrail signal in output when detectable.

Dependencies / prerequisites

- P1 collector integration.

Risks / edge cases

- Output verbosity can become noisy on large diffs.
- Weak guardrail detection could produce false confidence.

Verification required

- Run command in representative local states and inspect readability.
- Ensure exit code remains non-blocking for advisory warnings.

Done criteria

- Command executes reliably in normal local repo states.
- Output provides actionable hints without implying policy authority.

Verification performed

- Added `scripts/agent-preflight.js` and `agent:preflight` / `agent:preflight:json` npm scripts.
- Performed CLI smoke test with explicit scope: `npm run agent:preflight -- --scope workflow-docs`.

Remaining risk / follow-up

- May need `--quiet` and `--json` options after first usage feedback.

File references

- package.json
- scripts/

### P2 - Add tests for matching, state reporting, and edge cases

Execution model: GPT-5.3-Codex
Status: done

Objective

Protect preflight behavior with targeted tests so advisory output stays stable.

Planned changes

- Add tests for no-change, mixed-change, and unmatched-file scenarios.
- Add tests for branch warning behavior (`main` vs non-main).
- Add tests proving that "setup executed in the past" is not used as a guardrail status signal.
- Add tests for deterministic ordering of output sections where applicable.

Dependencies / prerequisites

- P1 implementation complete.

Risks / edge cases

- Fragile snapshot tests if formatting churn is too high.

Verification required

- `npm test` green with new test coverage included.

Done criteria

- Core scenarios covered by automated tests.
- No regression in existing advisory, simulation, and service-worker tests.

Verification performed

- Added `tests/agent-preflight.test.js` for scope parsing, inferred-vs-explicit task areas, unrelated-change classification, scope validation, and human-readable output guarantees.
- Added explicit tests for no-change output behavior, mixed change-state counts, fallback-file reporting, main-branch warning output, and deterministic section ordering.
- Verified with `npm test` (all suites passing).

Remaining risk / follow-up

- Keep test strategy focused on behavior, not cosmetic spacing.

File references

- tests/
- package.json

### P2 - Document preflight behavior and limitations

Execution model: GPT-5.3-Codex
Status: done

Objective

Explain how preflight should be used and where its authority ends.

Planned changes

- Document command usage in `README.md` and/or `docs/advisory-rules.md`.
- Reiterate that routing authority remains in `AGENTS.md` and canonical instructions.
- Add short interpretation guide for warnings and recommended checks.

Dependencies / prerequisites

- CLI behavior finalized.

Risks / edge cases

- Documentation drift if output fields change later.

Verification required

- Doc link and command examples checked for accuracy.

Done criteria

- Docs contain accurate command usage and governance boundary.

Verification performed

- Documented preflight usage and behavior in `docs/advisory-rules.md`.
- Added README reference to `npm run agent:preflight` and its purpose.

Remaining risk / follow-up

- Add CI mirror documentation once CI surfacing exists.

File references

- README.md
- docs/advisory-rules.md
- AGENTS.md

### P3 - Add optional machine-readable preflight JSON mode

Execution model: GPT-5.3-Codex
Status: done

Objective

Expose structured output for future CI or tooling integration without changing governance boundaries.

Planned changes

- Add `--json` mode to preflight CLI.
- Ensure schema-like stability for top-level keys.
- Keep human-readable mode as default.

Dependencies / prerequisites

- Base CLI and collector done.

Risks / edge cases

- Premature schema lock-in if fields are unstable.

Verification required

- Basic parse test for JSON output.
- Backward compatibility check with non-JSON output mode.

Done criteria

- JSON mode available and documented as optional.

Verification performed

- Added JSON mode support via `--json` and npm script `agent:preflight:json`.
- Included stable structured output sections to support future tooling use.

Remaining risk / follow-up

- Consider aligning keys with existing advisory JSON output conventions.

File references

- scripts/
- docs/advisory-rules.md

## Documentation Follow-ups

- [x] README updated
- [x] Relevant docs in docs/ updated
- [x] Relevant instruction or workflow files updated
