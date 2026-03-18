---
workflow_type: backlog-item
source: review-findings-2026-03-18
priority: 1
status: open
planning_model: GPT-5.4
execution_model: GPT-5.4
created_at: 2026-03-18
last_updated: 2026-03-18
---

# TODO: Fix GitHub Pages PWA Subpath Update Detection

## Goal

Make service-worker routing and app update detection reliable when the app is hosted under the GitHub Pages project subpath.

## Scope

- Align `app-assets.js` and `service-worker.js` so `network-first` matching works for `/red-dune-dash/...` paths, not only for root-relative paths.
- Ensure `version.json` refresh checks and app-shell update behavior still work after deployment path normalization.
- Verify that the GitHub Pages deployment shape from `.github/workflows/deploy-pages.yml` is reflected correctly in the runtime path assumptions.
- Add targeted tests that exercise same-origin requests under a non-root pathname base.
- Keep the path-handling contract explicit in docs or in-code comments so future asset-manifest changes do not silently reintroduce root-only assumptions.

## Out Of Scope

- Replacing the current service-worker strategy with a different caching architecture.
- Broad PWA UX redesign outside update correctness.

## Acceptance Criteria

- Core app requests are classified correctly when the app runs from the GitHub Pages project path.
- Update detection can fetch fresh `version.json` data after deploys without silently falling back to stale cache behavior.
- Tests cover both root and subpath request shapes.
- The regression is protected by automated verification, not only by one manual fix.

## Suggested Verification

- `npm run test:service-worker`
- `npm test`
- Manual GitHub Pages smoke check for install/update flow after a deployment.

## Notes

- This came from the full-repository review because the current tests only exercise root URLs and miss the production hosting shape.
- Treat the added tests as the long-term guardrail against future deploy-path regressions.
- The fix should be validated against the real project-pages deployment model, not only against local root-path previews.
