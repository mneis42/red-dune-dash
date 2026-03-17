---
workflow_type: backlog-item
source: review-findings-2026-03-17
priority: 28
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Harden Local Hook Portability Across Platforms

## Goal

Make local guardrail behavior reliable across Windows, Linux, and macOS when using repository hooks.

## Scope

- Validate `.githooks/pre-push` execution assumptions on all supported contributor platforms.
- Add a fallback strategy when shell hook execution is unavailable or inconsistent (with clear diagnostics and recovery guidance).
- Ensure `npm run setup` and preflight status reporting reflect actual runtime hook capability, not only configured paths.
- Add targeted tests and docs for platform-specific edge cases.

## Out Of Scope

- Replacing GitHub branch protection with local hook-only enforcement.
- Introducing unrelated hook policies beyond current protected-branch guardrail intent.

## Acceptance Criteria

- Contributors receive consistent guardrail behavior signals on Windows, Linux, and macOS.
- Setup and preflight clearly distinguish configured hooks from executable hooks.
- Fallback path is documented and test-covered for environments where shell-based hook execution is degraded.
- No regression in existing branch-protection guardrail behavior.

## Suggested Verification

- `npm run test:preflight`
- `npm run agent:preflight`
- Manual local checks on Windows, Linux, and macOS using configured and intentionally degraded hook-execution scenarios.

## Notes

- This item complements guardrail-path alignment work by closing runtime portability gaps in local hook execution.
