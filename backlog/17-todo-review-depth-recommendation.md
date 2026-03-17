---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 6
priority: 2
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-16
last_updated: 2026-03-17
---

# TODO: Review-Depth Recommendation Without Workflow Replacement

## Goal

Add risk-based review-depth recommendations while preserving canonical task routing in `AGENTS.md`.

## Scope

- Reuse advisory rule metadata for review-depth hints.
- Define depth recommendations for contained, cross-cutting, and high-risk workflow/PWA changes.
- Define explicit depth tiers (`light`, `standard`, `deep`) with concise criteria and expected review outcomes per tier.
- Keep recommendation logic rule-based (area/risk metadata), not fixed file-count thresholds.
- Ensure recommendations cannot override feature, bug, or change-review workflow selection.
- Define mixed-risk precedence rule: if a diff touches multiple tiers, the highest-risk tier wins.

## Out Of Scope

- Any automatic rerouting of tasks away from canonical instruction files.
- Hard-gating based on review depth in v1.
- Hard numeric thresholds (for example "N files always means deep") as the primary decision rule.

## Acceptance Criteria

- Recommendation logic is advisory only.
- Documentation states that `AGENTS.md` remains canonical routing authority.
- Edge cases for mixed-risk diffs are handled explicitly.
- Output includes a short rationale per recommendation so contributors can audit why a depth was suggested.

## Suggested Verification

- `npm run check`
- `npm test`
- Manual scenario checks for low-risk and high-risk diffs.

## Notes

- Keep output actionable and concise to avoid alert fatigue.
