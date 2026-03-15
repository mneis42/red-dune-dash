# Copilot Instructions

For complete project-wide code reviews, follow the canonical instructions in [../instructions/full-code-review.md](../instructions/full-code-review.md).

These instructions are intentionally shared across coding agents so the required review workflow stays the same regardless of whether the reviewer uses Codex, Copilot, or another agent.

For long-running workflows, do not ask for confirmation between planned steps.
Execute as many steps as possible in one uninterrupted run.
Do not send intermediate progress updates unless the user explicitly asks for them.
Only interrupt when blocked by missing permissions, conflicting instructions, missing critical information, or hard platform or runtime limits.
If interrupted by a platform limit, resume from the next unfinished step on the user's next message without asking whether to continue.
