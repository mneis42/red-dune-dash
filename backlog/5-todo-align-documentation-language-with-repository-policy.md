---
workflow_type: backlog-item
source: review-findings-2026-03-18
priority: 5
status: open
planning_model: GPT-5.4
execution_model: GPT-5.4
created_at: 2026-03-18
last_updated: 2026-03-18
---

# TODO: Align Documentation Language With Repository Policy

## Goal

Reduce contributor and agent friction by aligning technical documentation language with the repository's stated English-first documentation policy.

## Scope

- Audit technical docs and workflow-adjacent notes for language-policy drift.
- Decide which German documents should be translated, explicitly exempted, or kept only when they are intentionally player-facing.
- Update policy docs if the real preferred-language rule is meant to be bilingual instead of English-first.
- Add one durable rule or review checkpoint so future docs do not silently drift back into mixed policy without an intentional exception.

## Out Of Scope

- Translating player-facing in-game UI text.
- Rewriting docs whose main issue is technical accuracy rather than language.

## Acceptance Criteria

- The repo has one consistent documented language policy for technical docs.
- High-value technical and workflow docs no longer contradict that policy in practice.
- Contributors can tell which content is expected to be English and which exceptions are intentional.
- The chosen rule is reflected in the documentation workflow strongly enough to prevent the same ambiguity from reappearing by default.

## Suggested Verification

- `npm run instruction:lint`
- Manual doc audit across `README.md`, `CONTRIBUTING.md`, `docs/`, and workflow notes.
- Confirm that any documented exceptions are explicit rather than implicit.

## Notes

- This is mainly a maintainability and collaboration issue for an agent-heavy repository, not a player-facing localization task.
