# Contributing

## Purpose

This project is intentionally used as an AI-agent delivery experiment. Contributions should improve not only the game, but also the repeatability, clarity, and reliability of the workflow around it.

## Default Contribution Style

- Prefer an agent-first workflow whenever it is practical.
- Keep human-written code to a minimum when an agent can reasonably implement the change.
- Use humans primarily for steering, review, prioritization, and small corrective edits when that is more efficient.
- Document important friction points so the repository stays useful as a learning artifact.

## Language Rules

- Player-facing UI text should be German unless there is a clear product reason not to.
- Code, code comments, documentation, instruction files, and commit messages should default to English.
- When introducing new docs, prefer concise English that is easy for both humans and agents to follow.

## Before You Change Code

1. Read the relevant repository instructions first.
2. Check whether an existing document in `docs/`, `instructions/`, or `AGENTS.md` already defines the expected behavior.
3. Prefer updating the documented workflow instead of inventing a parallel one.
4. Run `npm run setup` after cloning to enable the repository-local Git hooks.
5. Make the smallest change that solves the problem cleanly.

## Branch And PR Workflow

- Treat `main` as a protected branch.
- Do your work on a feature branch, not directly on `main`.
- Open a pull request for every change that should land in `main`.
- The local `.githooks/pre-push` hook blocks direct pushes from `main` after `npm run setup` has been executed.
- GitHub branch protection remains the source of truth; the local hook is an additional guardrail.

## Implementation Expectations

- Preserve the browser-first nature of the game.
- Keep desktop and mobile usage in mind.
- Maintain PWA support and avoid breaking offline behavior.
- Prefer small, testable, modular changes over large rewrites.
- Update nearby documentation when behavior, architecture, or workflow meaningfully changes.

## Verification Expectations

Run the available checks when your change touches related areas:

```powershell
npm run check
npm test
```

For the full local verification flow, you can also use `npm run verify`.

You can also run `npm run test:simulation` or `npm run test:service-worker` when only one suite is relevant.

For advisory, non-blocking change hints based on touched file paths, run `npm run agent:advisory`.

For a unified local-change/postflight summary suitable for commits, PRs, or handoffs, run `npm run agent:summary`.

Backlog hygiene guardrails are enforced by `npm run backlog:lint`:

- Duplicate normalized TODO topics inside prioritized `backlog/<number>-*.md` files are rejected.
- Open-vs-done topic collisions between prioritized `backlog/<number>-*.md` files and `backlog/done/` are rejected.
- If `backlog/done/` frontmatter contains `status`, it must be `done`.

If you do not run a relevant check, say so explicitly in your summary or pull request.

The CI workflow runs the same core verification categories on Linux, macOS, and Windows:

- `npm run check`
- `npm test`
- `npm run instruction:lint`
- `npm run backlog:lint`

Deploy-only behavior remains Linux-only, and advisory change hints stay non-blocking on Linux.

## Reviews

- If you are performing a complete repository review, follow `AGENTS.md`.
- The canonical full-review workflow lives in `instructions/full-code-review.md`.
- Review feedback should prioritize bugs, regressions, risk, and missing tests over stylistic preferences.

## Pull Requests And Commits

- Keep commits focused and readable.
- Prefer English commit messages.
- Explain user-visible impact, test coverage, and known risks in the pull request description.
- If an AI agent produced most of the change, that is fine; clarity and verifiability matter more than authorship style.

## Good Contributions

- Improve gameplay without breaking existing controls or pacing.
- Strengthen tests, docs, or instructions so future agent runs are more reliable.
- Reduce ambiguity in architecture, balancing rules, or deployment behavior.
- Make automation more trustworthy and easier to maintain.

## Avoid

- Large undocumented rewrites.
- Silent behavior changes without tests or docs.
- Adding parallel instructions that conflict with existing repository guidance.
- Introducing avoidable complexity when a smaller change would do.
