---
workflow_type: backlog-item
source: pr-6-comments
priority: 16
status: done
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Align Preflight Guardrail Detection With Hooks Path

## Goal

Ensure preflight guardrail detection reflects the repository's actual hook setup (`core.hooksPath` and `.githooks/pre-push`).

## Scope

- Update guardrail detection to prefer configured hooksPath and expected primary hook.
- Keep a documented fallback path for legacy setups if needed.
- Align user-facing note text with real detection behavior.

## Out Of Scope

- Redesigning hook installation scripts.
- Introducing new mandatory hooks.

## Acceptance Criteria

- Preflight reports guardrail status correctly when `.githooks/pre-push` is configured.
- False "inactive" reports are reduced for valid local setups.
- Output signal/path labels remain clear and stable.

## Suggested Verification

- npm run test:preflight
- npm run agent:preflight
- Manual check with configured and unconfigured hooksPath setups

## Notes

- Triggered by PR #6 review feedback about mismatch between detection and `setup-hooks` behavior.
