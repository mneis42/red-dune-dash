---
workflow_type: backlog-item
source: review-findings-2026-03-20
priority: 1
status: done
planning_model: GPT-5
execution_model: GPT-5
created_at: 2026-03-20
last_updated: 2026-03-20
---

# TODO: Align Docs Language Lint Scope With Backlog Policy

## Goal

Update the documentation and review messaging so they match the intended docs-language-lint policy for backlog files.

## Scope

- Document that `docs:language:lint` applies to all Markdown files under `backlog/`.
- Keep `backlog/done/` explicitly excluded as the historical archive area.
- Align README wording, PR-ready workflow messaging, and related backlog notes to this policy.

## Out Of Scope

- Changing the lint implementation away from the current `backlog/**` minus `backlog/done/**` behavior.
- Expanding unrelated documentation-language rules beyond this backlog policy clarification.

## Acceptance Criteria

- Documentation clearly states that all Markdown files under `backlog/` are in scope.
- Documentation clearly states that files under `backlog/done/` are excluded.
- PR or handoff wording no longer describes the rule as limited to prioritized backlog items.

## Suggested Verification

- Review updated wording in README and any PR-facing summary text for consistency with the intended rule.
- Confirm no remaining active docs describe the lint scope as limited to prioritized backlog items.

## Notes

- Policy decision on 2026-03-20: the rule should apply to all files under `backlog/`, except files under `backlog/done/`.
- This TODO is therefore a documentation-alignment follow-up, not an implementation-scope decision.
