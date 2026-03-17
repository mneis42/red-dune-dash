---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 12
priority: 8
status: open
created_at: 2026-03-16
---

# TODO: CI Hints Based On Robust Signals First

## Goal

Introduce CI advisory hints only where signals are reliable and low-noise.

## Scope

- Prioritize file matches, changed paths, job status, check outcomes, and touched docs/workflow files.
- Avoid brittle free-text heuristics in early phases.
- Define phased rollout explicitly:
	- phase 1: robust machine signals only
	- phase 2: optional human-facing advisory messages
	- phase 3: selective policy enforcement only for high-confidence, low-false-positive cases
- Use qualitative phase-transition decisions by maintainers based on observed reliability and usefulness (no mandatory numeric gate in v1).

## Out Of Scope

- Policing PR text for inferred intent.
- Noisy checks with frequent false positives.

## Acceptance Criteria

- Hint logic is based on robust, reproducible signals.
- False-positive risk is explicitly minimized.
- Rollout progression is documented.
- Exit criteria are defined qualitatively for moving between phases (maintainer assessment of signal reliability, usefulness, and noise).

## Suggested Verification

- `npm run check`
- `npm test`
- CI simulation on representative low/high-risk changes.

## Notes

- Favor trustworthiness over breadth of hinting.
