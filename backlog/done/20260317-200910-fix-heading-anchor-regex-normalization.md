---
workflow_type: backlog-item
source: pr-6-comments
priority: 14
status: done
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-17
---

# TODO: Fix Heading Anchor Regex Normalization

## Goal

Correct heading normalization so anchor generation matches intended markdown anchor behavior and avoids false positives/negatives.

## Scope

- Update the regex in heading normalization to avoid unintended character ranges in character classes.
- Add/extend tests to cover punctuation and edge-case headings.
- Verify instruction-lint anchor checks still pass on repository docs.

## Out Of Scope

- Full parity with every external markdown renderer.
- Broader refactors outside heading normalization and related tests.

## Acceptance Criteria

- Punctuation such as `.` and `:` is handled according to the intended normalization contract.
- Existing and new anchor tests pass and prevent regression.
- Instruction lint runs clean against current repository docs.

## Suggested Verification

- npm run test:instruction-lint
- npm run instruction:lint
- npm run verify

## Notes

- Triggered by PR #6 review feedback on `normalizeHeadingText()` regex character class behavior.
