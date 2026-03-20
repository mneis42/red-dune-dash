---
workflow_type: backlog-item
source: other-origin
priority: 31
status: open
planning_model: GPT-5 Codex
execution_model: GPT-5 Codex or smaller follow-up model
created_at: 2026-03-20
last_updated: 2026-03-20
---

# TODO: Add Local Screenshot Capture Command For Deterministic Browser Scenes

## Goal

Add one deterministic local screenshot-capture command that reuses the browser automation stack and scene API so later docs and review workflows do not need to invent their own capture path.

## Scope

- Add one deterministic screenshot-generation entrypoint that uses the established browser automation setup rather than a separate capture toolchain.
- Limit the first rollout to exactly these three capture targets and no broader gallery:
  `boot-default`,
  `portrait-helper`,
  and `bug-wave-announce`.
- Write generated files to one explicit local output directory intended for generated artifacts, not directly into committed README or docs image paths.
- Define one small manifest or naming rule for the output files so later docs-refresh and PR-review items can consume the same filenames without guesswork.
- Reuse the deterministic scene API so capture scripts can reach target states quickly and reproducibly without relying on free-running randomness.
- Reuse the same named scenes that later PR-review screenshot capture can consume, but do not add CI artifact publishing or visual diff logic in this item.
- Keep the implementation tooling-focused: one command, one reusable capture helper path, and only the minimum technical note required to describe outputs.
- Do not commit refreshed documentation images in this item.
- Prefer an implementation-only PR. If one minimal technical doc update is required for correctness, document the `workflow-docs` plus implementation exception explicitly in handoff.

## Out Of Scope

- Updating README or gameplay docs to reference new screenshots.
- Committing refreshed repository screenshots into final docs asset locations.
- Large galleries covering every gameplay mechanic or event.
- Pixel-perfect visual regression approval workflows.
- Automatic committing of refreshed documentation screenshots on every routine CI run.
- PR-oriented artifact uploads or baseline comparison logic.

## Acceptance Criteria

- A contributor can run one documented command to generate the selected scene screenshots locally.
- The first rollout produces only a small, fixed screenshot set with named target scenes.
- Screenshot capture uses deterministic scene setup rather than manual gameplay.
- The selected screenshot set is exactly:
  `boot-default`,
  `portrait-helper`,
  and `bug-wave-announce`.
- At least one selected screenshot demonstrates a staged event scene through `bug-wave-announce`.
- The implementation writes outputs to one explicit generated-artifact directory with stable filenames or a small manifest.
- The same named scenes and output naming scheme can be reused by later docs-refresh and PR-review screenshot capture without requiring a second, incompatible scene-definition layer.
- Documentation explains the command, the generated output location, and that committed docs images are handled in a later item.
- The implementation remains a tooling-focused PR and does not also introduce PR-review artifact publication or docs-asset refresh.

## Suggested Verification

- `npm run check`
- `npm test`
- Local Playwright smoke command introduced by the prior browser-test item
- New screenshot-generation command introduced by the implementation
- Manual inspection that generated images match the documented target scenes and land in the documented output path

## Notes

- Implement only after the browser test-hook and Playwright smoke-test items are complete.
- This item intentionally stabilizes the local capture command and output contract before later docs-refresh and CI artifact work.
- The next item should consume the generated outputs and move only the curated subset into committed documentation paths.
- Keep this focused on reusable scenario capture; CI-specific smoke execution and PR artifact publishing belong in later items.
