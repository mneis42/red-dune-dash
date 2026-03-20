---
workflow_type: backlog-item
source: other-origin
priority: 32
status: open
planning_model: GPT-5 Codex
execution_model: GPT-5 Codex or smaller follow-up model
created_at: 2026-03-20
last_updated: 2026-03-20
---

# TODO: Refresh Curated Documentation Screenshots From Browser Scenes

## Goal

Update the small committed documentation screenshot set by copying from the deterministic local capture pipeline so README and docs visuals stay current without mixing capture-tool design into docs work.

## Scope

- Consume the local screenshot-generation command and output contract established in the prior item.
- Limit the first rollout to exactly these three committed documentation screenshots and no broader gallery:
  `boot-default`,
  `portrait-helper`,
  and `bug-wave-announce`.
- Copy or refresh only one curated repository-owned screenshot directory intended for committed docs assets.
- Make that curated committed screenshot directory the canonical baseline source for later PR visual-diff review work; do not introduce a second committed screenshot tree for the same scenes.
- Update only the minimum README or docs references needed to point at the curated committed images if those references are currently missing or stale.
- Keep the file naming aligned with the prior screenshot-capture item rather than inventing a second naming scheme.
- Keep this item docs-assets-focused: committed images, their documented location, and the minimum usage text needed for contributors.

## Out Of Scope

- Changing the screenshot-generation command or capture helper architecture from the prior item.
- CI artifact publication or baseline diff logic.
- Expanding the committed screenshot set beyond the three established scenes.
- Broad README or docs rewrites unrelated to screenshot refresh.

## Acceptance Criteria

- The repository contains one small committed documentation screenshot set for exactly:
  `boot-default`,
  `portrait-helper`,
  and `bug-wave-announce`.
- That committed screenshot set lives in one explicit canonical path that later PR visual-diff work reuses as its baseline source.
- A contributor can follow the docs to regenerate the local outputs and then refresh the curated committed screenshot directory without guessing paths or filenames.
- README or docs references, if updated, point to the curated committed screenshot paths rather than to generated temporary output directories.
- The item stays reviewable as one docs-assets PR and does not also redesign the capture pipeline or introduce PR-review artifacts.

## Suggested Verification

- `npm run check`
- `npm test`
- Local screenshot-generation command introduced by the prior item
- Manual inspection that committed docs images match the intended scenes and that referenced paths resolve correctly

## Notes

- Implement only after the local screenshot-capture command exists and its output filenames are stable.
- This split keeps tooling changes and committed docs-asset churn in separate PRs so the review stays smaller and easier to verify.
- Later PR-review artifact work should reuse the same scene names and, where practical, the same curated filenames.
