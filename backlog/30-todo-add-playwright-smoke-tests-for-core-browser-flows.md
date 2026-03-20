---
workflow_type: backlog-item
source: other-origin
priority: 30
status: open
planning_model: GPT-5 Codex
execution_model: GPT-5 Codex or smaller follow-up model
created_at: 2026-03-20
last_updated: 2026-03-20
---

# TODO: Add Playwright Smoke Tests For Core Browser Flows

## Goal

Add a small, high-signal browser smoke suite that covers startup and key UI/runtime flows which current Node-only tests do not exercise.

## Scope

- Introduce Playwright with the smallest maintainable local setup that can run against a lightweight local server.
- Keep the first rollout file boundary narrow: Playwright config, one browser test directory, the minimum package-script glue, and only the smallest doc note needed to run the suite locally.
- Add smoke tests for exactly this first required flow set and no broader browser journey coverage:
  app boot without page errors,
  debug-mode startup via existing query parameters,
  and portrait-helper behavior.
- Use the deterministic browser scenario API from the prior item whenever a test would otherwise rely on timing-heavy manual setup.
- Use these scene names from the prior item directly when needed:
  `boot-default` for normal startup assertions and `portrait-helper` for rotate-screen assertions.
- Keep the first rollout runner and browser target explicit: one Playwright test project only, running Chromium only.
- Do not add more than 3 required smoke tests in the first rollout.
- Do not add the optional highscore persistence check in the first rollout; defer it unless the first three tests are already in place and still fit without widening the harness.
- Add one local run script for the suite and document only the minimum local usage needed to run it deterministically.
- Keep the local server strategy explicit in the implementation: use one lightweight static-server path and do not introduce a second app-specific dev server.
- Store browser-test helpers in one obvious place so later screenshot and CI items can reuse them instead of forking helper logic.
- Prefer an implementation-only PR. If one minimal README or docs update is required for correctness, document the `workflow-docs` plus implementation exception explicitly in handoff and do not bundle broader workflow text cleanup.

## Out Of Scope

- Exhaustive end-to-end gameplay coverage.
- Pixel-diff visual regression testing across many browsers and devices.
- Deep automation of install-prompt or app-store-like PWA flows.

## Acceptance Criteria

- The repository has a documented Playwright entrypoint with one deterministic local run command.
- Smoke tests cover these three browser-level behaviors not already protected by existing Node tests:
  normal app boot without startup errors,
  debug-mode startup behavior,
  and portrait-helper visibility behavior.
- The portrait-helper test uses the named `portrait-helper` scene instead of a long timing-dependent setup path.
- The debug-mode startup test uses existing debug query parameters rather than inventing a second debug-only setup contract.
- The suite avoids fragile timing-only assertions where a state-based assertion is possible.
- The suite does not depend on ad hoc random gameplay progression to reach its asserted states.
- The implementation adds only one local browser-test command and one local server path for that command.
- The first rollout runs exactly one Playwright project and targets Chromium only.
- Shared browser-test helpers live in one reusable location rather than being embedded ad hoc inside multiple tests.
- The first rollout keeps the harness small enough that it can be reviewed as one local-testing PR without also changing CI policy or screenshot artifact workflows.
- The added coverage is small enough that a weaker model can extend it incrementally without rewriting the harness.

## Suggested Verification

- `npm run check`
- `npm test`
- New targeted Playwright command introduced by the implementation.

## Notes

- Implement after the browser test-hook item so the test suite can assert runtime state reliably.
- The first rollout should touch only the Playwright harness, its tests, and the minimum script/docs glue needed to run them locally.
- This item is local-test focused; CI wiring belongs in the next item, and screenshot capture belongs in later items.
