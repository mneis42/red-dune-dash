---
workflow_type: backlog-item
source: other-origin
priority: 34
status: open
planning_model: GPT-5 Codex
execution_model: GPT-5 Codex or smaller follow-up model
created_at: 2026-03-20
last_updated: 2026-03-20
---

# TODO: Publish Visual Diff Artifacts For PR Review

## Goal

Generate deterministic scenario screenshots and visual diff artifacts in pull-request CI so reviewers can quickly see when appearance or scene behavior changed.

## Scope

- Add one PR-oriented browser-visual job that captures the agreed deterministic scenario set on the branch under test.
- Compare scenario screenshots against one explicit baseline source from the current default branch.
- For the first rollout, use only the three established scenes
  `boot-default`,
  `portrait-helper`,
  and `bug-wave-announce`.
- Reuse the canonical committed screenshot directory from the prior docs-refresh item as the only baseline source for these scenes; do not introduce a second committed baseline tree, external storage, multiple baseline fallbacks, or a new baseline service.
- Define the CI checkout shape explicitly: check out the PR branch normally and fetch one default-branch reference for the baseline directory, whether via a second checkout path or one equivalent explicit mechanism.
- Keep the first rollout diff implementation explicit and single-path: generate branch screenshots with the existing screenshot command, compare them against the baseline with one image-diff tool only, and do not add a second comparison backend or custom approval service.
- Define the first-rollout artifact layout explicitly:
  branch screenshots in one directory,
  baseline screenshots in one directory,
  and generated diffs in one directory under a single browser-visual artifact root.
- Name the intended first-rollout artifact directories explicitly in the implementation and keep them fixed for follow-up work:
  `artifacts/browser-visual/branch`,
  `artifacts/browser-visual/baseline`,
  and `artifacts/browser-visual/diff`.
- If a required baseline image for one of the three scenes is missing, fail the visual-artifact job with a clear message instead of silently skipping that scene.
- Define the CI expectation explicitly: the workflow should read the baseline from the checked-out default-branch content for that directory, then upload branch screenshots and visual diffs as PR artifacts.
- Keep pixel-difference reporting review-oriented in the first rollout: artifact generation should stay non-blocking when screenshots differ, and only hard infrastructure failures such as missing baseline files, capture failures, or diff-generation failures should fail the job.
- Keep the first rollout intentionally small, using the same named scenes already established for deterministic screenshot capture.
- Make artifact output easy to inspect without requiring maintainers to run the screenshot pipeline locally for every PR.
- Keep this workflow separate from the blocking browser smoke-test job so review artifacts and smoke failures stay easy to distinguish.
- Keep the PR narrowly focused on review artifacts. If small docs or workflow comments are required, keep them minimal and document the `workflow-docs` plus implementation exception explicitly in handoff rather than widening the change.

## Out Of Scope

- Blocking on broad full-game visual regression coverage.
- Auto-approving or auto-rejecting PRs solely from pixel differences in the first rollout.
- Replacing targeted browser smoke tests with screenshot diffs.

## Acceptance Criteria

- Pull-request CI publishes screenshot or visual diff artifacts for a small fixed set of deterministic scenes.
- Artifact generation uses the same scene definitions as the documentation and screenshot pipeline rather than duplicating scene setup logic.
- The fixed deterministic scene set is exactly:
  `boot-default`,
  `portrait-helper`,
  and `bug-wave-announce`.
- The first rollout uses the canonical committed screenshot directory from the docs-refresh item as one explicit baseline source from the default branch rather than inventing multiple fallback baseline mechanisms.
- The baseline directory path is named explicitly in the implementation and documentation instead of leaving storage layout to follow-up interpretation.
- The implementation names one explicit branch-output directory, one baseline-input directory, and one diff-output directory for the uploaded artifact bundle.
- The implementation uses exactly one diff-generation path and does not introduce a second comparison backend or approval workflow in the same PR.
- The first rollout uses these fixed artifact directories for uploaded outputs:
  `artifacts/browser-visual/branch`,
  `artifacts/browser-visual/baseline`,
  and `artifacts/browser-visual/diff`.
- Missing baseline files fail clearly for the affected required scene set instead of producing partial or ambiguous artifacts.
- Pixel differences by themselves do not fail the first-rollout review-artifact job; they produce inspectable artifacts, while setup or generation failures still fail clearly.
- Reviewers can tell which named scenes changed and inspect before-or-after output with minimal workflow friction.
- The first rollout keeps policy simple: artifacts are produced reliably even if maintainers defer stricter blocking rules to later work.
- The implementation remains one review-artifact PR and does not also widen the browser smoke suite or redesign screenshot scene definitions.

## Suggested Verification

- `npm run check`
- `npm test`
- Local screenshot-generation command introduced by the prior screenshot item
- Pull-request or equivalent CI run showing uploaded visual artifacts for the selected scenes

## Notes

- Implement after the deterministic scene API, Playwright smoke tests, local screenshot-capture item, committed docs-screenshot refresh item, and browser-smoke CI item are complete.
- Prefer CI artifacts or PR-linked outputs over committing review screenshots into the repository on every change.
- Keep the baseline location and comparison rule explicit in the todo implementation notes so a weaker model does not need to invent storage architecture or blocking policy.
