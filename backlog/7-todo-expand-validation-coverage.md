---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 11
priority: 7
status: open
created_at: 2026-03-16
---

# TODO: Expand Validation Coverage Before Extra Commentary

## Goal

Increase trustworthy validation coverage in high-value areas before adding more semantic workflow commentary.

## Scope

- Evaluate maintainable HTML/CSS validation option.
- Add targeted PWA smoke-test helpers under local HTTP conditions.
- Improve service-worker update-path testing for caching changes.
- Add deployment-relevant checks tied to observed failure modes.

## Out Of Scope

- Adding low-confidence advisory checks with weak signal quality.
- Expanding tooling without clear maintenance ownership.

## Acceptance Criteria

- At least one concrete validation expansion is implemented and stable.
- New checks target real repository risks.
- Documentation reflects new coverage and limits.

## Suggested Verification

- `npm run verify`
- Targeted new test commands introduced by the implementation.
- Manual PWA smoke checks where applicable.

## Notes

- Reliability is more valuable than quantity of checks.
