---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 15
priority: 11
status: open
created_at: 2026-03-16
---

# TODO: Deployment Hardening After Validation Maturity

## Goal

Strengthen deployment flow reliability after validation signals are mature and trustworthy.

## Scope

- Separate verify/build/deploy phases clearly in deployment workflows.
- Add visible deploy metadata (commit, branch, workflow run).
- Add rollback notes or playbook for broken deployments.
- Add cheap and reliable smoke checks against deployed artifact where practical.
- Define minimum validation-maturity prerequisites before starting this item (stable mandatory checks, acceptable flaky-rate, and clear ownership of failing signals).

## Out Of Scope

- Using deployment hardening to compensate for weak validation quality.
- Introducing high-cost or flaky smoke checks.

## Acceptance Criteria

- Deployment workflow phases are explicit and observable.
- Basic rollback guidance is documented and accessible.
- Deployment metadata can be traced to source changes.
- Hardening steps are aligned with repository size and maintenance capacity.
- Start condition is documented and tied to prior validation-maturity outcomes, not calendar timing.

## Suggested Verification

- `npm run verify`
- CI workflow dry run or validation for deploy pipeline changes.
- Manual smoke check against deployed artifact (if configured).

## Notes

- This item should follow, not precede, validation-maturity work.
