# Copilot Instructions

For complete project-wide code reviews, follow the canonical instructions in [../instructions/full-code-review.md](../instructions/full-code-review.md).

For lightweight reviews of local changes or pull requests, follow [../instructions/change-review.md](../instructions/change-review.md).

For any writing-agent run that is intended to end in a PR-ready handoff, complete the mandatory pre-PR checklist in [../instructions/pre-pr-checklist.md](../instructions/pre-pr-checklist.md) before ending the run.

These instructions are intentionally shared across coding agents so the required review workflow stays the same regardless of whether the reviewer uses Codex, Copilot, or another agent.

For long-running workflows, do not ask for confirmation between planned steps.
Execute as many steps as possible in one uninterrupted run.
Do not send intermediate progress updates unless the user explicitly asks for them.
Only interrupt when blocked by missing permissions, conflicting instructions, missing critical information, or hard platform or runtime limits.
If interrupted by a platform limit, resume from the next unfinished step on the user's next message without asking whether to continue.

For `gh` usage in this agent environment, request escalated execution up front for commands that typically need live GitHub API access, such as `gh pr create`, `gh pr comment`, `gh pr review`, `gh pr view`, `gh pr diff`, `gh api`, and `gh run view/list`. Keep sandbox execution for clearly local-only `gh` commands such as `gh help` or `gh version`.
If `gh pr view --json` does not expose a needed field, describe that as a high-level subcommand field limitation and use `gh api` for the supported follow-up query instead of implying a broader GitHub API limitation.

For full-code-review runs, enforce the mandatory stop-prevention checklist in [../instructions/full-code-review.md](../instructions/full-code-review.md) before ending any response.
