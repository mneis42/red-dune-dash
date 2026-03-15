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

Do not turn a small review into a whole-repository audit unless the blast radius clearly requires it.
Respect repository language conventions: German for player-facing UI, English for code and technical documentation.
