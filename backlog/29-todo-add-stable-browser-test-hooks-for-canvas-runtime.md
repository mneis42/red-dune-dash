---
workflow_type: backlog-item
source: other-origin
priority: 29
status: open
planning_model: GPT-5 Codex
execution_model: GPT-5 Codex or smaller follow-up model
created_at: 2026-03-20
last_updated: 2026-03-20
---

# TODO: Add Stable Browser Test Hooks For Canvas Runtime

## Goal

Expose a minimal, low-risk browser scenario API so automated UI checks and screenshot capture can load deterministic gameplay scenes without brittle canvas pixel assertions or raw full-state mutation.

## Scope

- Define one explicit test-only browser surface, preferably `window.__RED_DUNE_TEST_API__`, centered on loading named deterministic scenes or scenarios.
- Keep the public contract semantic rather than structural: expose one primary command such as `loadScene(name)` and do not accept arbitrary internal game-state objects.
- Keep the first rollout to one documented API shape only:
  `loadScene(name)` for setup,
  `getStatus()` for read-only inspection,
  and no additional mutating commands.
- Keep the first rollout intentionally narrow by supporting exactly these named scenes and no others:
  `boot-default`,
  `portrait-helper`,
  and `bug-wave-announce`.
- Allow only these read-only status fields in the first rollout:
  `gameState`,
  `pauseReason`,
  `debugEnabled`,
  and `activeEventPhase`.
- Define the scene semantics explicitly so follow-up items do not have to rediscover them:
  `boot-default` means the app is booted without debug query parameters and without a startup error overlay;
  `portrait-helper` means the rotate-screen helper is visible and gameplay is paused for portrait mode;
  `bug-wave-announce` means the bug-wave event is in its announce/countdown phase and is stable enough for repeated screenshots.
- If randomness affects a selected scene, make determinism explicit through a stable preset, seeded setup, or equivalent reproducible control.
- Gate the API so it is available only in explicit test mode and does not become part of normal gameplay behavior.
- Define the first-rollout test-mode entry mechanism explicitly in the implementation doc and keep it to one path only, for example a dedicated query parameter or other narrow startup flag.
- Add deterministic startup hooks or fixtures where needed so browser tests and screenshot jobs can trigger key states quickly.
- Place the API wiring close to the browser runtime bootstrap rather than scattering hooks across unrelated modules.
- Document the intended contract in one small technical doc section close to the implementation so a smaller follow-up model can add tests or screenshot capture without rediscovering hidden runtime details.
- Include one short implementation note naming the intended source-of-truth module or file for scene definitions so later items do not duplicate them elsewhere.
- Prefer an implementation-only PR. If one minimal doc update is required for correctness, keep it tightly scoped and call out the required `workflow-docs` plus implementation exception in the handoff instead of widening the change.

## Out Of Scope

- Full gameplay refactors solely for test convenience.
- Broad internal-state exposure that would create a long-term public runtime API.
- Free-form mutation hooks for arbitrary world editing or raw whole-state injection.
- Pixel-perfect screenshot testing of canvas rendering.

## Acceptance Criteria

- A browser automation test can load a stable, documented named scene without depending on manual gameplay or canvas image diffing.
- The implementation exposes only one narrow test API object and does not spread test hooks across unrelated globals.
- The public setup contract is scene-oriented and does not accept arbitrary raw internal state objects.
- The first rollout exposes only `loadScene(name)` and `getStatus()` as documented entrypoints.
- The exposed hooks are explicitly test-only and do not alter normal production behavior.
- The first rollout documents exactly these supported scenes:
  `boot-default`,
  `portrait-helper`,
  and `bug-wave-announce`.
- The first rollout documents exactly these supported status fields:
  `gameState`,
  `pauseReason`,
  `debugEnabled`,
  and `activeEventPhase`.
- At least one deterministic path exists for quickly reaching a paused UI-oriented scenario and one deterministic event scenario suitable for automated screenshots.
- If scene randomness exists internally, repeated runs of the same named scene produce stable screenshot-ready output unless the underlying intended presentation changed.
- Documentation names the supported test hooks and warns against extending them casually.
- Documentation names one explicit test-mode activation path and one source-of-truth location for scene definitions.

## Suggested Verification

- `npm run check`
- `npm test`
- Targeted local browser smoke check against the new test hook contract.

## Notes

- This item should land before introducing a larger Playwright suite.
- Keeping the API narrow makes the follow-up work much more suitable for a weaker model.
- The later items should reuse the exact scene names from this todo instead of inventing aliases.
- This item should remain implementation-focused; do not add Playwright setup, CI jobs, or screenshot artifact publishing here.
