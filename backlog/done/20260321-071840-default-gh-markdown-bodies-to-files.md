---
workflow_type: backlog-item
source: review-findings-2026-03-20
priority: 2
status: done
planning_model: GPT-5 Codex
execution_model: GPT-5 Codex
created_at: 2026-03-20
last_updated: 2026-03-21
---

# TODO: Default Gh Markdown Bodies To Files

## Goal

Prevent shell-quoting failures in agent-driven GitHub CLI workflows by defaulting multiline or Markdown-rich bodies to file-based input.

## Scope

- Route `gh pr create`, `gh pr comment`, and `gh pr review` body content through temporary files by default when the content is multiline or contains Markdown/code formatting.
- Keep plain inline bodies available only for short single-line text that does not need shell-sensitive quoting.
- Update workflow helpers or instructions so file-based body handling is the default documented path.
- Add focused regression coverage for backticks, fenced code, and multiline review text.

## Out Of Scope

- Rewriting unrelated GitHub workflow behavior.
- Changing the semantic review policy for when to use comments versus formal review actions.

## Acceptance Criteria

- Multiline GitHub CLI bodies no longer rely on fragile shell interpolation.
- Content containing backticks or fenced code is posted successfully through the default workflow path.
- Agent guidance and any helper scripts consistently prefer body files over inline quoted Markdown.
- Regression coverage exists for the quoting cases that triggered the 2026-03-20 friction logs.

## Suggested Verification

- Targeted automated tests for any helper that assembles `gh` invocations.
- Manual validation of `gh pr comment` and `gh pr create` using multiline Markdown content with inline code and fenced code blocks.
- Confirmation that the default path uses file-backed bodies rather than inline `--body` strings for multiline content.

## Notes

- This item addresses both PR review and PR creation friction from 2026-03-20 where inline shell quoting broke Markdown-heavy `gh` commands.
