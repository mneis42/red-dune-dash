---
workflow_type: backlog-item
source: pr-6-comments
priority: 20
status: done
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-18
---

# TODO: Resolve Schema ID And Template Language Nits

## Goal

Address low-risk consistency nits from review for schema ID usage and template language conventions.

## Scope

- Decide whether to keep, replace, or remove schema `$id` that points to a local-only URL.
- Align technical template language with repository convention (English for technical docs).
- Keep behavior unchanged while improving clarity and editor/tooling compatibility.

## Out Of Scope

- Expanding schema semantics or introducing cross-repo schema references.
- Broad copyediting beyond directly impacted template/doc lines.

## Acceptance Criteria

- Schema ID strategy is explicit and does not mislead validators/editors.
- Technical template wording follows repository language convention.
- All related tests and lint checks remain green.

## Suggested Verification

- npm run instruction:lint
- npm run verify
- Manual schema/editor sanity check

## Notes

- Triggered by PR #6 nit comments on schema `$id` and mixed-language template line.
