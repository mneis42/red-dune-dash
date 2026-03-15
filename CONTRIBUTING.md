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
4. Make the smallest change that solves the problem cleanly.

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

If you do not run a relevant check, say so explicitly in your summary or pull request.

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
