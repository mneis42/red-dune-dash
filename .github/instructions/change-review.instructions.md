---
applyTo: "**"
excludeAgent: "coding-agent"
---

# Change Review Instructions

Use this file for lightweight reviews of pull requests and other change-scoped diffs.
Do not use it for a complete repository review. For full reviews, follow `instructions/full-code-review.md`.

Review the changed files first and expand only as far as needed to confirm behavior, contracts, side effects, and regression risk.
Focus on correctness, regressions, missing or outdated tests, stale docs, automation impact, and runtime safety.

Keep the output high signal:

- findings first
- order by severity
- prioritize real bugs and risks over style
- mention file references when helpful
- call out missing verification when behavior changed
- say explicitly if no meaningful findings were found

When posting multiline or Markdown-rich review findings back through GitHub CLI, prefer `npm run gh:safe -- pr comment ... --body-stdin` or `--body-file` instead of inline `--body` quoting.
In this agent environment, request escalated execution up front for networked `gh` commands such as `gh pr comment`, `gh pr review`, `gh pr view`, `gh api`, and `gh run view/list`; keep sandbox `gh` usage for clearly local-only commands such as `gh help` and `gh version`.
If `gh pr view --json` lacks a needed field, describe that as a high-level subcommand field limitation and use `gh api` for the supported follow-up query instead of implying a broader GitHub API limitation.

For reusable review task-package guidance (Balancing Tweak, PWA / Offline Reliability, Gameplay Bugfix, Workflow / Docs Update, Targeted Review Readiness), follow the canonical section "Task Packages (Canonical Insertion Point)" in `instructions/change-review.md`.

Do not turn a small review into a whole-repository audit unless the blast radius clearly requires it.
Respect repository language conventions: German for player-facing UI, English for code and active technical documentation. Historical backlog archives in `backlog/done/` may remain in their original language unless the reviewed change explicitly migrates them.


Review runs follow the same low-noise run-log rule as the canonical workflow in `instructions/change-review.md`: use `docs/agent-run-logs.md` when a triggering incident occurs during the review, and do not create routine logs for clean review-only runs.
If the review is part of a PR-ready handoff workflow, still complete that workflow's explicit run-log decision checkpoint.
