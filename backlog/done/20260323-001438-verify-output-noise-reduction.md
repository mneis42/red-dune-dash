---
workflow_type: feature-request
title: Reduce `npm run verify` output noise while preserving clear failure signal
overall_status: done
planning_model: CODEX GPT-5.4
branch: feature/verify-output-reduction
created_at: 2026-03-22
last_updated: 2026-03-23
---

# Feature Request TODO

## Feature Summary

- Summary: Make `npm run verify` materially shorter and easier to scan while keeping a clear failure signal in compact mode and moving richer debugging detail into `npm run verify:verbose`.
- Fit assessment: This fits the repository well because the project already values low-noise workflows, explicit guardrails, and compact handoff output. A quieter verify flow should improve local iteration speed and reduce review fatigue without changing product behavior.
- Default command behavior: `npm run verify` is compact by default; `npm run verify:verbose` is the debugging-oriented companion mode.
- Non-goals: Replacing the current test coverage, weakening repository checks, changing pass/fail semantics, or introducing a new backlog workflow type.

## Verification Baseline

- Tests: pass - `npm test` passed on 2026-03-22 during analysis; output is verbose mainly because each test file prints `ok - ...` for every passing test and nested `npm run` banners repeat for each subcommand.
- Build: not-run - there is no separate build step in the current `verify` script.
- Lint/Typecheck: pass - `npm run check`, `npm run instruction:lint`, `npm run docs:language:lint`, and `npm run backlog:lint` all passed on 2026-03-22 during analysis.
- Manual checks: pass - compact `npm run verify` and verbose suite output were inspected on 2026-03-23 (`npm run verify`, `RED_DUNE_TEST_OUTPUT=verbose node tests/simulation-core.test.js`).

## Assumptions And Open Questions

- Assumption: Existing repository scripts and tests can be adjusted without introducing external test tooling.
- Resolved decision: `npm run verify` is compact by default and `npm run verify:verbose` is the debugging-oriented companion command.
- Resolved decision: Compact `npm test` output shows exactly one summary line per run plus failed-test identifiers and a hint to rerun `npm run verify:verbose`.
- Resolved decision: Verbose test output shows successful and failed tests individually with suite name, test name, and outcome.
- Resolved decision: Successful non-test steps should use a short, scan-friendly style aligned with `docs:language:lint`.
- Resolved decision: A shared runner script may orchestrate `verify`, `test`, and related steps while keeping named `npm` scripts as the public entry points.
- Resolved decision: Step-level failure collection uses `--max-failures`, defaulting to `5`, while top-level `verify` continues through all major stages.

## Decision Gate

- Developer decision: implement now
- Decision timestamp: 2026-03-23
- Output decision: `npm run verify` is compact by default.
- Debugging decision: Per-test success output is reserved for verbose/debugging workflows, not the default verify flow.
- Runner decision: Use a shared Node-based runner behind existing named `npm` scripts where needed.
- Failure-limit decision: Per-step failure collection uses `--max-failures` with default `5`; top-level `verify` still continues through all major stages.
- Rule: Execute the highest-priority open TODO first and keep `todo.md` current during implementation.

## TODO Index

- [x] P0 - Decide compact-vs-verbose command contract and preserve clear failure signal
- [x] P1 - Reduce nested `npm` banner noise in verify and test orchestration
- [x] P1 - Replace per-test success spam with one per-run summary while keeping failure detail
- [x] P2 - Add regression coverage for compact and verbose output contracts
- [x] P2 - Update workflow docs for the new verification ergonomics

## TODO Item Template

### P0 - Decide compact-vs-verbose command contract and preserve clear failure signal

Execution model: CODEX GPT-5.4
Status: done

Objective

Define the output contract before implementation so `npm run verify` becomes materially quieter by default without making failures hard to scan.

Planned changes

- Define `npm run verify` as the compact default command.
- Define `npm run verify:verbose` as the debugging-oriented companion command.
- Define the compact test-output contract:
  - exactly one summary line per `npm test` run
  - summary reports outcome counts such as `ok`, `failed`, `skipped`, or `warnings`
  - only categories with values greater than `0` are shown
  - successful tests do not print per-test or per-suite lines
  - failed tests print only suite name, test name, and `failed`
  - compact failure output includes a short hint to rerun `npm run verify:verbose` for debugging detail
- Define the verbose test-output contract:
  - successful and failed tests are printed individually
  - each test shows at least suite name, test name, and outcome
  - verbose mode may include richer debugging detail than today
- Define the non-test success contract:
  - successful steps such as `check` and lint commands stay short and easy to scan
  - the success style should align with the current `docs:language:lint` ergonomics
- Identify repo-internal scripts or tests that currently rely on the existing stdout shape.

Dependencies / prerequisites

- None.

Risks / edge cases

- A compact contract that still prints too much will not solve the noise problem.
- A compact contract that hides too much will make failures harder to triage.
- Output-shape changes may require repo-internal test or script updates.

Verification required

- Review the final contract against `package.json` and repo-internal tests.
- Confirm the contract is explicit enough to guide implementation and regression coverage.

Done criteria

- A documented decision exists for compact and verbose command behavior.
- The compact and verbose test-output rules are explicit.
- The non-test success-output style is explicit.
- Repo-internal stdout dependencies are identified at a high level.

Verification performed

- Decision updated on 2026-03-23 to immediate implementation.
- Implemented compact-vs-verbose command contract in `package.json`, `scripts/task-runner.js`, and `scripts/test-harness.js`.
- Verified compact default with `npm test` and `npm run verify` on 2026-03-23.
- Verified verbose per-test output with `RED_DUNE_TEST_OUTPUT=verbose node tests/simulation-core.test.js` on 2026-03-23.

Remaining risk / follow-up

- Future outcome categories such as `skipped` or `warnings` are not yet emitted by current suites, but the summary formatter leaves room for them.

File references

- package.json
- tests/simulation-core.test.js
- tests/service-worker.test.js
- tests/instruction-lint.test.js

### P1 - Reduce nested `npm` banner noise in verify and test orchestration

Execution model: CODEX GPT-5.4
Status: done

Objective

Shorten verification output by removing repetitive command banners while preserving stage boundaries and failing command visibility in the compact default flow.

Planned changes

- Introduce a small shared Node-based runner to orchestrate `verify`, `test`, and related grouped steps instead of relying on deeply nested `npm run ... && ...` chains.
- Keep the existing named `npm` scripts as the public entry points, but allow their implementations to delegate to the shared runner where useful.
- Keep clear stage naming based on the existing script identities so contributors and agents can still tell whether `check`, `test`, or a specific lint failed.
- Let top-level `verify` continue through all major stages even when an earlier stage fails, while step-level runners may stop after reaching `--max-failures`.
- Avoid shell patterns that would reduce portability or obscure exit status propagation.

Dependencies / prerequisites

- P0 decision on command contract.

Risks / edge cases

- Excessive quieting could make it unclear which stage is currently running.
- Script changes may affect tests or documentation that assume specific command names or fail-fast behavior.
- Continuing top-level `verify` after a failure must still produce a reliable final non-zero exit.

Verification required

- Run the relevant verification command(s) after script changes.
- Confirm failing commands still surface their stage identity.
- Confirm top-level `verify` reports all major stage failures while step-level runners respect `--max-failures`.

Done criteria

- Repetitive nested `npm` banners are materially reduced.
- Contributors can still identify the failing stage without rerunning in a debugger.
- Existing named `npm` scripts remain recognizable entry points.
- The new runner behavior is explicit for top-level continuation and step-level failure limits.

Verification performed

- `npm test` passed on 2026-03-23 with compact output and no nested `npm run` banner chain.
- `npm run verify` passed on 2026-03-23 while continuing through the top-level stages via the shared runner.

Remaining risk / follow-up

- Shared runner coverage should remain in sync if new top-level verification stages are added later.

File references

- package.json

### P1 - Replace per-test success spam with one per-run summary while keeping failure detail

Execution model: CODEX GPT-5.4
Status: done

Objective

Make passing test output compact in the default `npm run verify` path while preserving clear failed-test identification and richer debugging detail in verbose mode.

Planned changes

- Introduce a small shared test-runner helper or consistent pattern for local node-based test files.
- Change successful test reporting from per-test lines to exactly one aggregate summary line per `npm test` run.
- Ensure verbose mode can still expose more detailed success output when intentionally requested.
- In compact mode, print failed tests as suite name, test name, and `failed`, then show a short hint to rerun `npm run verify:verbose`.
- Include additional outcome categories such as `skipped` or `warnings` in the compact summary only when their count is greater than `0`.

Dependencies / prerequisites

- P0 decision on compact-vs-verbose behavior.

Risks / edge cases

- Touching many test files could create a broad diff and require careful consistency checks.
- Some async test files may need slightly different handling than synchronous ones.

Verification required

- Run `npm test` and confirm successful suites produce shorter output.
- Intentionally inspect at least one failure path or simulate one in a focused test to ensure compact and verbose behavior both match the contract.

Done criteria

- Passing tests no longer print one line per success in compact mode.
- Compact mode prints exactly one per-run outcome summary for `npm test`.
- Failed tests in compact mode identify the suite and test name and show `failed`.
- Verbose mode prints successful and failed tests individually with suite name, test name, and outcome.

Verification performed

- `npm test` passed on 2026-03-23 with one aggregate summary line; the exact passing-test count increased as follow-up runner regression coverage was added in the same branch and is currently `tests: 214 ok`.
- Verbose suite output was inspected on 2026-03-23 via `RED_DUNE_TEST_OUTPUT=verbose node tests/simulation-core.test.js`.

Remaining risk / follow-up

- Future suite-specific outcome types would need explicit helper support if they move beyond `ok` and `failed`.

File references

- tests/simulation-core.test.js
- tests/service-worker.test.js
- tests/instruction-lint.test.js
- tests/backlog-template-lint.test.js
- tests/agent-summary.test.js

### P2 - Add regression coverage for compact and verbose output contracts

Execution model: CODEX GPT-5.4
Status: done

Objective

Prevent future regressions where output becomes noisy again or compact mode starts hiding critical failure details.

Planned changes

- Add focused tests around any new output-formatting helpers.
- Add tests for command parsing and mode selection for the compact default plus verbose companion command.
- Verify repository scripts preserve the intended exit-code behavior for top-level continuation plus step-level `--max-failures`.

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

- Added `tests/task-runner.test.js` for argument parsing, failure-limit behavior, and top-level continuation.
- `node tests/task-runner.test.js` passed on 2026-03-23.
- `npm test` and `npm run verify` both passed on 2026-03-23 after the runner changes.

Remaining risk / follow-up

- Need to balance stability of assertions against flexibility of message wording.

File references

- package.json
- tests/
- scripts/

### P2 - Update workflow docs for the new verification ergonomics

Execution model: CODEX GPT-5.4
Status: done

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

- Updated `README.md` on 2026-03-23 to document `npm run test:verbose` and `npm run verify:verbose`.
- `npm run verify` passed on 2026-03-23 after the README update.

Remaining risk / follow-up

- Need to keep docs focused on usage, not exact cosmetic output text.

File references

- README.md
- AGENTS.md
- instructions/pre-pr-checklist.md

## Documentation Follow-ups

- [x] README updated
- [x] Relevant docs in `docs/` reviewed; no changes required
- [x] Relevant instruction or workflow files reviewed; no changes required

## Pre-PR Exception Note

- Exception type: documented no-split exception for a mixed `workflow-docs` + `tooling` branch.
- Rationale: the README and archived workflow record changed only because this branch introduced new public verification entry points and updated the verification evidence for the same runner work; splitting the doc updates from the implementation would leave either stale commands or stale branch-local verification history in one side of the split.
- Reviewer concern: broader review surface than a tooling-only branch.
- Mitigation: verification for the combined branch was rerun after the follow-up fixes (`npm run check`, `npm test`, `npm run verify`), and the workflow-doc changes remain limited to command guidance and branch-local archived evidence for the same feature.
