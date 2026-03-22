---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 14
priority: 10
status: done
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-16
last_updated: 2026-03-22
---

# TODO: Progressive Policy Gates Instead Of Instant Hard Blocking

## Goal

Define staged enforcement for workflow-aware CI to avoid premature contributor friction.

## Scope

- Define stage 1 advisory-only mode.
- Define stage 2 warning mode for clearly risky cases.
- Define stage 3 hard-fail mode for narrow high-confidence conditions.
- Document candidate hard gates (broken instruction refs, protected-branch violations, missing mandatory canonical artifacts, broken mandatory validation jobs).

## Out Of Scope

- Broad hard-blocking rules without maturity evidence.
- Immediate strict enforcement across all workflow hints.

## Acceptance Criteria

- Enforcement stages are explicit and documented.
- Hard-fail conditions are narrow and high-confidence.
- Rollout can be audited and adjusted with minimal churn.

## Suggested Verification

- `npm run check`
- `npm test`
- `npm run instruction:lint`
- CI/advisory output review across staged scenarios.

## Notes

- Adoption should follow measured signal quality, not automation ambition.
- Completed by:
  - documenting the staged rollout and candidate hard gates in `docs/advisory-rules.md`
  - exposing stage 2 warning mode and stage 3 candidate hard-gate status in `scripts/agent-advisory.js`
  - covering the new policy output with `tests/agent-advisory.test.js`
