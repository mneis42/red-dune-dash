---
workflow_type: backlog-item
source: review-findings-2026-03-17
priority: 27
status: open
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Add Cross-Platform Verification Matrix For Core Workflow

## Goal

Validate the core local development verification path consistently on Windows, Linux, and macOS.

## Scope

- Add a CI matrix job for the core workflow checks (`npm run check`, `npm test`, `npm run instruction:lint`, `npm run backlog:lint`).
- Keep command contracts platform-neutral and avoid shell-specific one-off glue for core verification.
- Ensure output categories and failure interpretation stay consistent across operating systems.
- Document the matrix scope and rationale in workflow docs so contributors know what is guaranteed cross-platform.

## Out Of Scope

- Expanding deploy-only steps to non-Linux runners when deployment target remains Linux-hosted.
- Adding broad performance benchmarking to this matrix.

## Acceptance Criteria

- CI runs the core verification matrix on Windows, Linux, and macOS.
- Equivalent repository states produce equivalent pass/fail outcomes across runners.
- Failures are actionable and mapped to the same check categories on every OS.
- Documentation states what is covered by the matrix and what is intentionally excluded.

## Suggested Verification

- `npm run verify`
- CI dry run that includes one expected-pass and one expected-fail case across all three OS runners.

## Notes

- This closes the gap where cross-platform support is a repository goal but only Linux CI execution is currently guaranteed for core verification.
