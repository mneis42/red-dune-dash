---
workflow_type: feature-request
title: Reduce `npm run verify` output noise while preserving failure signal
overall_status: open
planning_model: CODEX GPT-5.4
branch: feature/verify-output-reduction
created_at: 2026-03-22
last_updated: 2026-03-22
---

# Feature Request TODO

## Feature Summary

- Summary: Make `npm run verify` materially shorter and easier to scan without hiding failing checks, test names for failures, stack traces, or which verification stage failed.
- Fit assessment: This fits the repository well because the project already values low-noise workflows, explicit guardrails, and compact handoff output. A quieter verify flow should improve local iteration speed and reduce review fatigue without changing product behavior.
- Default command behavior: `npm run verify` is compact by default; a verbose companion mode may exist for debugging, but compact output is the primary user path.
- Non-goals: Replacing the current test coverage, weakening repository checks, changing pass/fail semantics, or introducing a new backlog workflow type.

## Verification Baseline

- Tests: pass - `npm test` passed on 2026-03-22 during analysis; output is verbose mainly because each test file prints `ok - ...` for every passing test and nested `npm run` banners repeat for each subcommand.
- Build: not-run - there is no separate build step in the current `verify` script.
- Lint/Typecheck: pass - `npm run check`, `npm run instruction:lint`, `npm run docs:language:lint`, and `npm run backlog:lint` all passed on 2026-03-22 during analysis.
- Manual checks: open - no side-by-side manual comparison of compact vs verbose verification output has been performed yet.

## Assumptions And Open Questions

- Assumption: A verbose opt-in mode should preserve today’s detail level for debugging.
- Assumption: Per-test success output is only needed during debugging, not as routine signal in the default verify flow.
- Assumption: Existing repository scripts and tests can be adjusted without introducing external test tooling.

## Decision Gate

- Developer decision: pending
- Decision timestamp: 2026-03-22 22:25
- Output decision: `npm run verify` is compact by default.
- Debugging decision: Per-test success output is reserved for verbose/debugging workflows, not the default verify flow.
- Rule: No implementation commits while decision is pending.

## TODO Index

- [ ] P0 - Decide compact-vs-verbose command contract and preserve failure diagnostics
- [ ] P1 - Reduce nested `npm` banner noise in verify and test orchestration
- [ ] P1 - Replace per-test success spam with per-suite summaries while keeping failure detail
- [ ] P2 - Add regression coverage for compact and verbose output contracts
- [ ] P2 - Update workflow docs for the new verification ergonomics

## TODO Item Template

### P0 - Decide compact-vs-verbose command contract and preserve failure diagnostics

Execution model: CODEX GPT-5.4
Status: open

Objective

Define the intended output contract before implementation so the compact default does not accidentally hide important failure information.

Planned changes

- Define the verbose companion command and the detail it preserves beyond the compact default.
- Define the minimum failure signal that must remain visible for all modes.
- Identify any scripts whose current stdout format is implicitly relied upon by repository workflows or tests.

Dependencies / prerequisites

- None.

Risks / edge cases

- A compact mode that suppresses too much detail could slow down debugging.
- A default-behavior change could surprise contributors if not documented clearly.

Verification required

- Review the final command contract against current `package.json` scripts and test runners.
- Confirm that failure output requirements are explicit before implementation starts.

Done criteria

- A documented decision exists that `npm run verify` is compact by default and that a verbose companion mode is available.
- Failure-detail requirements are explicit enough to guide implementation and tests.

Verification performed

- Not run yet.

Remaining risk / follow-up

- Need developer decision on implement-now vs move-to-backlog before coding.

File references

- package.json
- tests/simulation-core.test.js
- tests/service-worker.test.js
- tests/instruction-lint.test.js

### P1 - Reduce nested `npm` banner noise in verify and test orchestration

Execution model: CODEX GPT-5.4
Status: open

Objective

Shorten verification output by removing repetitive command banners while preserving stage boundaries and failing command visibility in the compact default flow.

Planned changes

- Update `package.json` script composition so nested `npm run` invocations are quieter on success.
- Add or wire a verbose companion command so fuller progress output remains intentionally available.
- Keep clear stage naming so contributors can still tell whether `check`, `test`, or a specific lint failed.
- Avoid shell patterns that would reduce portability or obscure exit status propagation.

Dependencies / prerequisites

- P0 decision on command contract.

Risks / edge cases

- Excessive quieting could make it unclear which stage is currently running.
- Script changes may affect tests or documentation that assume specific command names.

Verification required

- Run the relevant verification command(s) after script changes.
- Confirm failing commands still surface their stage identity.

Done criteria

- Repetitive nested `npm` banners are materially reduced.
- Contributors can still identify the failing stage without rerunning in a debugger.

Verification performed

- Not run yet.

Remaining risk / follow-up

- May still need per-suite labels if quieter `npm` banners remove too much structure.

File references

- package.json

### P1 - Replace per-test success spam with per-suite summaries while keeping failure detail

Execution model: CODEX GPT-5.4
Status: open

Objective

Make passing test output compact in the default `npm run verify` path while preserving full visibility into failing test names and errors.

Planned changes

- Introduce a small shared test-runner helper or consistent pattern for local node-based test files.
- Change successful test reporting from per-test lines to concise per-suite summaries.
- Ensure verbose mode can still expose more detailed success output when intentionally requested.
- Keep `not ok - ...` lines, stack traces, and non-zero exits unchanged or stronger on failures.

Dependencies / prerequisites

- P0 decision on compact-vs-verbose behavior.

Risks / edge cases

- Touching many test files could create a broad diff and require careful consistency checks.
- Some async test files may need slightly different handling than synchronous ones.

Verification required

- Run `npm test` and confirm successful suites produce shorter output.
- Intentionally inspect at least one failure path or simulate one in a focused test to ensure detail remains adequate.

Done criteria

- Passing test suites print concise summaries instead of one line per passing assertion/test.
- Failing tests still identify the suite, test name, and underlying error.

Verification performed

- Not run yet.

Remaining risk / follow-up

- Shared helper extraction should stay simple to avoid turning output cleanup into a framework migration.

File references

- tests/simulation-core.test.js
- tests/service-worker.test.js
- tests/instruction-lint.test.js
- tests/backlog-template-lint.test.js
- tests/agent-summary.test.js

### P2 - Add regression coverage for compact and verbose output contracts

Execution model: CODEX GPT-5.4
Status: open

Objective

Prevent future regressions where output becomes noisy again or compact mode starts hiding critical failure details.

Planned changes

- Add focused tests around any new output-formatting helpers.
- Add tests for command parsing and mode selection for the compact default plus verbose companion command.
- Verify repository scripts continue to fail fast with correct exit codes.

Dependencies / prerequisites

- P1 script and test-runner changes.

Risks / edge cases

- Over-testing exact strings could make harmless wording changes too brittle.
- Under-testing may miss a regression that restores noisy success output.

Verification required

- Run targeted tests for any new helpers plus the full relevant verify/test commands.

Done criteria

- Output behavior is covered at the helper or script-contract level.
- Exit-code behavior remains unchanged.

Verification performed

- Not run yet.

Remaining risk / follow-up

- Need to balance stability of assertions against flexibility of message wording.

File references

- package.json
- tests/
- scripts/

### P2 - Update workflow docs for the new verification ergonomics

Execution model: CODEX GPT-5.4
Status: open

Objective

Keep repository documentation aligned with the new verification entry points and expected output modes.

Planned changes

- Update any README or workflow docs that mention `npm run verify` behavior.
- Document the recommended default command and the debugging path if a verbose mode exists.
- Ensure wording stays consistent with existing low-noise workflow guidance.

Dependencies / prerequisites

- P0 and P1 decisions implemented.

Risks / edge cases

- Docs can easily drift if command names change during implementation.
- Over-documenting output wording can make future cleanup harder.

Verification required

- Run instruction and docs-related linting after updates.

Done criteria

- User-facing workflow docs match the implemented verify behavior.
- No stale command guidance remains.

Verification performed

- Not run yet.

Remaining risk / follow-up

- Need to keep docs focused on usage, not exact cosmetic output text.

File references

- README.md
- AGENTS.md
- instructions/pre-pr-checklist.md

## Documentation Follow-ups

- [ ] README updated
- [ ] Relevant docs in docs/ updated
- [ ] Relevant instruction or workflow files updated
