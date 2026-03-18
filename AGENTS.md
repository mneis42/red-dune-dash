# Agent Instructions

For complete project-wide code reviews, follow the canonical instructions in [instructions/full-code-review.md](instructions/full-code-review.md).

For lightweight reviews of uncommitted changes, staged diffs, small change sets, or pull requests, follow [instructions/change-review.md](instructions/change-review.md).

For new feature ideas and feature requests, follow the planning-and-delivery workflow in [instructions/feature-request.md](instructions/feature-request.md).

For any writing-agent run that is intended to end in a PR-ready handoff, complete the mandatory pre-PR checklist in [instructions/pre-pr-checklist.md](instructions/pre-pr-checklist.md) before ending the run.

For prioritized idea files created directly under `backlog/` (for example `backlog/1-todo-*.md`), use either `templates/todo-backlog-item-template.md` (`workflow_type: backlog-item`) or `templates/todo-feature-request-template.md` (`workflow_type: feature-request`) and keep the file structure compatible with the selected template.
For new prioritized backlog-item files, always include `planning_model`, `execution_model`, `created_at`, and `last_updated` metadata in frontmatter.

For bug reports and gameplay defects, follow the bug analysis and fix workflow in [instructions/bug-report.md](instructions/bug-report.md).

For full-code-review runs, enforce the mandatory stop-prevention checklist in `instructions/full-code-review.md` before ending any response.

These instructions are intentionally shared across coding agents so the required review workflow stays the same regardless of whether the reviewer uses Codex, Copilot, or another agent.
