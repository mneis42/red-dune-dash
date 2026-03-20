---
workflow_type: backlog-item
source: other-origin
priority: 33
status: open
planning_model: GPT-5 Codex
execution_model: GPT-5 Codex or smaller follow-up model
created_at: 2026-03-20
last_updated: 2026-03-20
---

# TODO: Run Browser Smoke Tests In CI

## Goal

Execute the browser smoke suite automatically in GitHub Actions without making the existing verification workflow noisy or unnecessarily slow.

## Scope

- Add a dedicated CI job for browser smoke tests in GitHub Actions after the local Playwright setup is stable.
- Use a lightweight local HTTP server and deterministic test command suitable for headless CI execution.
- Keep the first rollout intentionally narrow, preferably Ubuntu plus Chromium only.
- Make the first rollout a blocking verification job for pull requests and pushes unless maintainers later choose to relax it explicitly.
- Do not expand the existing cross-platform Node matrix for the first rollout; keep browser coverage isolated to one dedicated job.
- Reuse the exact local Playwright smoke command from the prior item; CI should wrap that command, not create a second browser-test entrypoint.
- Keep browser dependency installation explicit and self-contained inside the new job so failure causes stay easy to diagnose.
- Document failure visibility and runtime expectations for the new job.
- Keep this job focused on smoke assertions only; do not add screenshot capture or visual diff generation here.
- Keep the PR scope workflow-focused: one CI job, the minimum install/setup glue, and the minimum docs or workflow comments needed to explain the job.
- If the PR also requires README or docs updates, keep them minimal and explicitly document the required `workflow-docs` plus implementation exception in handoff rather than bundling unrelated workflow cleanups.

## Out Of Scope

- Full cross-browser and cross-OS browser matrix coverage in the first rollout.
- Visual snapshot approval workflows.
- Deep mobile-device emulation coverage beyond the smoke scenarios already selected.

## Acceptance Criteria

- CI runs the browser smoke command automatically on pull requests and pushes.
- The browser test job is isolated enough that failures are easy to attribute to browser coverage rather than unrelated Node checks.
- The initial setup does not duplicate the full OS matrix unless there is a demonstrated need.
- The initial rollout treats the browser smoke job as a normal required verification step, not as advisory-only output.
- CI uses the same local smoke-test command and helper paths that contributors run locally.
- Browser install and startup failures produce job output that points clearly to the browser-smoke job rather than being hidden inside unrelated verification steps.
- Screenshot capture and visual diff artifacts remain in a separate PR-review workflow item rather than being folded into the smoke job.
- Repository docs and workflow comments explain the chosen rollout limits and future expansion path.
- The first rollout stays small enough to fit in one workflow-focused PR without also introducing baseline screenshots or review-artifact policy.
- The CI job consumes the local Playwright smoke command from the prior item rather than introducing a second browser-test entrypoint.

## Suggested Verification

- `npm run check`
- `npm test`
- Local Playwright smoke command introduced by the prior browser-test item
- GitHub Actions validation through a pull request or equivalent workflow run

## Notes

- Implement only after the local Playwright smoke suite is green and reasonably deterministic.
- Prefer a separate browser-smoke job in `.github/workflows/ci.yml` over folding browser setup directly into the existing cross-platform Node matrix.
- This item intentionally stays limited to executable smoke coverage in CI; committed screenshot refresh and PR visual artifacts remain separate follow-up items.
- If runtime or maintenance cost becomes unclear, prefer documenting a narrow first rollout over widening the matrix in this item.
