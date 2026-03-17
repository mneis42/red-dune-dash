---
workflow_type: backlog-item
source: workflow-ideas.md
idea_number: 13
priority: 9
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-16
last_updated: 2026-03-17
---

# TODO: Instruction And Workflow Checks In CI

## Goal

Mirror stable local instruction/workflow lint checks in CI to protect process-document integrity.

## Scope

- Run instruction-link/reference checks in CI.
- Ensure canonical instruction references from `AGENTS.md` remain valid.
- Detect removed required workflow docs and broken internal links.
- Keep semantic contradiction checks out of initial phase.

## Out Of Scope

- Premature semantic-policy enforcement.
- Large-scale documentation analysis with high noise.

## Acceptance Criteria

- CI catches deterministic instruction/workflow reference breakages.
- Local and CI lint behavior are aligned.
- Scope boundaries are clearly documented.

## Suggested Verification

- `npm run instruction:lint`
- `npm run verify`
- CI workflow run confirms expected pass/fail behavior.

## Notes

- This item depends on maintaining deterministic lint rules.
