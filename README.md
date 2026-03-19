# Curious Tiger: Red Dune Dash

Red Dune Dash is a browser-first endless runner about a Mars tiger chasing bugs, collecting coins, surviving engineering-themed hazards, and grabbing rockets for extra lives. The game combines arcade platforming with light serious-gaming ideas that make software-development challenges feel playful and accessible.

▶ **[Play the game](https://mneis42.github.io/red-dune-dash)**

This repository is also an experiment in AI-assisted software delivery. The goal is to learn how far current AI agents can take a game project with minimal human coding, where they already work well, where they struggle, and which instructions, workflows, and safeguards make them more reliable.

## Why This Repo Exists

- Explore how much of day-to-day game development can already be delegated to AI agents.
- Capture practical limits, failure modes, and mitigation patterns for agent-driven delivery.
- Build a workflow where humans mainly steer, review, and refine instead of writing most code by hand.
- Gradually move more of implementation, testing, review, deployment, and maintenance into automated agent-supported flows.

## Project Goals

- Keep the game playable in modern desktop and mobile browsers.
- Support PWA installation and useful offline behavior.
- Use GitHub Actions as the default safety net for verification and deployment.
- Make the project easy to continue through clear instructions, tests, and repository-level conventions.
- Preserve a high signal-to-noise workflow for both human contributors and coding agents.

## Product Direction

- Genre: endless runner / jump-and-run
- Theme: Mars tiger vs. bugs, coins, rockets, and software-inspired obstacles
- Tone: accessible, playful, slightly educational
- Primary audience: German-speaking developers and players
- UI language: German
- Preferred language for code, documentation, instruction files, and commit messages: English

## Current Stack

- HTML, CSS, and vanilla JavaScript
- Canvas-based rendering
- Browser `localStorage` for persistent highscores
- Service worker and web manifest for PWA support
- Node-based smoke and system tests
- GitHub Actions for CI and GitHub Pages deployment

## Repository Layout

- `index.html` - app entry point and HUD shell
- `styles.css` - layout, responsive UI, and visual presentation
- `game-endless.js` - main endless-run gameplay loop and orchestration
- `systems/` - modular gameplay and simulation subsystems
- `assets/` - sprites and game graphics
- `icons/` - PWA icons
- `app-assets.js` - central asset manifest for runtime and caching
- `service-worker.js` - offline and update behavior
- `tests/` - Node-based tests for simulation logic and service worker behavior
- `docs/` - focused technical documentation for core subsystems
- `instructions/` - reusable instruction files for AI-agent workflows
- `reviews/` - stored review outputs
- `AGENTS.md` - repository-level instructions for coding agents

## Local Development

Run the local repository setup once after cloning:

```powershell
npm run setup
```

This configures the repository-local Git hooks from `.githooks/`. The current setup blocks direct pushes from `main` and nudges contributors toward feature branches and pull requests. The hard enforcement still lives on GitHub via branch protection.

You can open `index.html` directly, but a small local server is recommended for service-worker and PWA testing.

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Verification

Run the existing checks locally with npm:

```powershell
npm test
```

For syntax validation, use:

```powershell
npm run check
```

To run the full local verification flow:

```powershell
npm run verify
```

To enforce the technical documentation language policy directly:

```powershell
npm run docs:language:lint
```

If you want to run the suites individually, you can also use:

```powershell
npm run test:simulation
npm run test:service-worker
```

For advisory change hints based on changed file paths, run:

```powershell
npm run agent:advisory
```

For machine-readable output, use:

```powershell
npm run agent:advisory:json
```

For one unified local-change/postflight summary (changed files, checks, docs, impact, risks, and open questions), run:

```powershell
npm run agent:summary
```

If you want the command to execute recommended checks and include real outcomes, run:

```powershell
npm run agent:summary -- --run-checks
```

To turn a selected backlog item into a lightweight execution brief with a branch suggestion, run:

```powershell
npm run backlog:branch -- --file backlog/<path-to-backlog-item>.md
```

For machine-readable output, add `--json`:

```powershell
npm run backlog:branch -- --file backlog/<path-to-backlog-item>.md --json
```

The GitHub Actions workflows also run the same syntax and test steps before deployment.

Core workflow verification in CI now runs as an OS matrix on Linux, macOS, and Windows for:

- `npm run check`
- `npm test`
- `npm run instruction:lint`
- `npm run docs:language:lint`
- `npm run backlog:lint`

Deployment remains Linux-only by design, and the advisory hint step is kept as a non-blocking Linux job.

## Branch Workflow

- Do not push directly from `main`.
- Create a feature branch for each change.
- Push the feature branch and open a pull request against `main`.
- Use `npm run setup` after cloning so the local Git hook guardrail is active.

## Automation Status

The repository already includes:

- CI for JavaScript syntax checks
- Automated gameplay and service-worker tests
- GitHub Pages deployment from `main`
- Version stamping during deployment for cache-safe releases
- Pinned GitHub Action SHAs for more predictable workflow execution

This is the baseline. Over time, more of the full development workflow should become agent-driven and automation-backed.

## Working Principles

- Prefer small, verifiable increments over large speculative rewrites.
- Keep tests, docs, and instructions in sync with behavior changes.
- Treat instruction files as product infrastructure, not as optional notes.
- Optimize for workflows where a human can guide and approve without needing to write much code.
- Document friction honestly so the repo remains useful as an AI-agent benchmark and learning artifact.

## Debug And PWA Notes

The debug mode is activated with query parameters and is documented in `docs/debug-tools.md`.

Examples:

- `?debug=1&debugEvent=big-order`
- `?debug=1&debugPickup=score-boost&debugBacklog=5`

For offline testing, use a local HTTP server instead of `file://`. The service worker reads from `app-assets.js`, and production deployments replace the repository placeholder in `version.json` with a commit-based version during the GitHub Pages workflow.

## Controls

- `A` / `D` or left/right arrow keys: move
- `W`, `Space`, or up arrow: jump
- `R`: restart

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the expected workflow, language conventions, testing expectations, and collaboration model for both humans and AI agents.

For repository-specific agent instructions, see [AGENTS.md](AGENTS.md).

For the advisory change-rule model and governance boundaries, see [docs/advisory-rules.md](docs/advisory-rules.md).

For local preflight hints before implementation (branch warning, changed-file advisory mapping, advisory review-depth recommendation, documentation-drift hints, unrelated-change hints, and guardrail signal), run `npm run agent:preflight`.

For instruction and workflow link validation (process docs path and heading consistency), run `npm run instruction:lint`.

For full repository reviews, the canonical instructions live in [instructions/full-code-review.md](instructions/full-code-review.md).

## Structured Run Logs

Structured run logs are intentionally limited to friction or failure incidents and are stored only in `logs/agent-runs/`.

Use the trigger categories and minimal schema documented in [docs/agent-run-logs.md](docs/agent-run-logs.md).

Do not create routine "all green" logs. Keep one log per triggering incident and append follow-ups to the same file when the root cause is unchanged.
