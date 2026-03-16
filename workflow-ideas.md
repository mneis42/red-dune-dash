# Workflow Ideas

This repository already treats agent-assisted software delivery as part of the product itself, not as an afterthought. The current baseline is intentionally small: local setup via `npm run setup`, JavaScript syntax checks via `npm run check`, automated simulation and service-worker tests via `npm test`, a combined `npm run verify`, GitHub Actions for CI, and GitHub Pages deployment from `main`. Any workflow expansion should build on that baseline instead of pretending broader automation already exists.

Two constraints matter throughout this document:

1. Workflow ideas here describe **future expansion**, not guaranteed current automation.
2. **Routing authority stays in `AGENTS.md` and the canonical instruction files.** Any machine-readable rule source introduced later must remain advisory and discovery-oriented unless the repo explicitly promotes parts of it into a canonical document.

The current `check` script validates a fixed list of JavaScript files with `node --check`; it does not currently validate HTML or CSS. The local setup script is described as a hook-enabler for repository-local Git guardrails, not as a durable state marker that can be reliably inferred later.

## Design principles

- Keep a strict distinction between **current baseline**, **near-term additions**, and **later-stage automation**.
- Prefer **one machine-readable advisory rule source** with multiple consumers over several overlapping scripts that drift apart.
- Keep **canonical task workflow selection** in `AGENTS.md`.
- Treat the rule source as **advisory/discovery only**, never as a second workflow constitution.
- Expand CI/CD in steps that match the real repository size and available metadata.
- Optimize for **repeatability, signal-to-noise ratio, and learning value**, not for theatrical “autonomy”.

## Current baseline

The repository already has several important workflow anchors:

- `AGENTS.md` routes work by task type to the canonical instruction files for full review, change review, feature requests, and bug reports.
- `feature-request.md` and `bug-report.md` require branch creation from `origin/main`, a root-level `todo.md`, a decision gate before implementation, and verification before each implementation commit.
- `README.md` and `CONTRIBUTING.md` define the repository-local hook guardrail, the branch/PR workflow, and the currently available checks.
- `package.json` currently exposes only `setup`, `check`, `test`, `test:simulation`, `test:service-worker`, and `verify`.
- `scripts/check-syntax.js` currently checks only a fixed list of JavaScript files.

This means future workflow ideas should be written as **proposed expansion** and should avoid implying that broader validation already exists.

## Near-term ideas with the highest leverage

### 1. Single advisory rule source for change classification and verification hints

Introduce one small machine-readable rule file that maps file patterns to advisory metadata such as:

- affected area
- risk tags
- recommended checks
- manual smoke checks
- likely documentation follow-ups
- suggested reading
- CI relevance

This should replace the earlier split between “automatic change-type detection” and a separate “verification matrix”. Those are not two different systems. They are the same decision model with different consumers.

Critical governance rule:

- This rule source is **not** allowed to become routing authority.
- It may suggest likely instruction files to read, but it may not decide whether a task is a feature request, bug workflow, change review, or full review.
- `AGENTS.md` remains the only canonical routing entry point unless the repository explicitly changes that policy later.

Possible shape:

```json
{
  "rules": [
    {
      "match": ["systems/**", "game-endless.js"],
      "area": "gameplay",
      "riskTags": ["game-balance", "cross-system-behavior"],
      "recommendedChecks": ["npm run check", "npm run test:simulation"],
      "manualChecks": [],
      "suggestedDocs": ["docs/", "README.md"],
      "suggestedReading": ["AGENTS.md", "instructions/feature-request.md", "instructions/bug-report.md"],
      "ciSignals": ["syntax", "simulation-tests"]
    },
    {
      "match": ["service-worker.js", "app-assets.js", "manifest.webmanifest"],
      "area": "pwa",
      "riskTags": ["offline", "caching", "installability"],
      "recommendedChecks": ["npm run check", "npm run test:service-worker"],
      "manualChecks": [
        "run under local HTTP server",
        "offline reload smoke check",
        "installability sanity check",
        "cache/update path smoke check after asset or version changes"
      ],
      "suggestedDocs": ["README.md", "docs/"],
      "suggestedReading": ["AGENTS.md", "instructions/change-review.md"],
      "ciSignals": ["syntax", "service-worker-tests"]
    },
    {
      "match": ["README.md", "CONTRIBUTING.md", "AGENTS.md", "instructions/**"],
      "area": "workflow-docs",
      "riskTags": ["process-drift", "instruction-consistency"],
      "recommendedChecks": ["npm run check"],
      "manualChecks": ["cross-read nearby docs for contradiction risk"],
      "suggestedDocs": ["README.md", "CONTRIBUTING.md", "AGENTS.md", "instructions/"],
      "suggestedReading": ["AGENTS.md"],
      "ciSignals": ["instruction-lint"]
    },
    {
      "match": ["index.html", "styles.css"],
      "area": "ui-shell",
      "riskTags": ["layout", "responsive-behavior"],
      "recommendedChecks": [],
      "manualChecks": ["responsive smoke check on mobile and desktop"],
      "suggestedDocs": ["README.md"],
      "suggestedReading": ["AGENTS.md", "instructions/change-review.md"],
      "ciSignals": []
    }
  ]
}
```

Why it helps:

- It creates one source of advisory truth instead of several half-overlapping heuristics.
- It is honest about today’s validation coverage.
- It can later feed preflight, summary generation, doc-drift hints, and CI routing without silently becoming the workflow authority.

### 2. Agent preflight as a hinting tool, not a fake gate

Add a lightweight `agent:preflight` command that reads the advisory rule source and reports the current working situation.

It should answer things like:

- Are we on `main`?
- Are there unrelated local changes already present?
- Which files are currently changed?
- Which advisory rules matched those files?
- Which checks are recommended right now?
- Which docs or instruction files are likely relevant?
- Does the local hook guardrail appear active?

Important corrections:

- Do **not** check whether `npm run setup` “was executed at least once”. That is too fuzzy.
- The better question is whether the expected guardrail appears active now.
- “Unrelated local changes” should use a simple explicit heuristic, for example: uncommitted files outside the current task scope inferred from user intent plus matched rule areas.

Possible command:

```text
npm run agent:preflight
```

Why it helps:

- It reduces avoidable workflow mistakes early.
- It strengthens the existing repository conventions without inventing new mandatory gates.
- It stays aligned with the current tooling reality.

### 3. Documentation drift detection

Add a small helper that warns when code changes probably require documentation updates.

Examples:

- gameplay/system changes -> suggest matching `docs/` files and `README.md` review
- service worker / PWA changes -> suggest offline and PWA doc review
- workflow or instruction changes -> suggest `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and `instructions/` review

This should remain advisory at first.

Why it helps:

The repository explicitly treats docs and instruction files as part of product infrastructure. Drift should be visible early.

### 4. Instruction linting

Add a validator for repository process files.

Start small:

- referenced files exist
- linked paths still resolve
- canonical instruction files referenced by `AGENTS.md` still exist
- no obvious broken internal links
- no missing section anchors for explicitly referenced headings

Only later attempt semantic contradiction checks across documents. That is useful, but also much noisier and easier to overengineer.

Why it helps:

This repo depends heavily on workflow documents being correct, current, and mutually consistent.

### 5. Structured run logs with explicit triggers

Store short run logs only for clearly defined events, not for every routine task.

Good trigger examples:

- `npm run verify` failed unexpectedly
- instruction files appeared to conflict
- an agent needed more than one major rework round
- a human had to rescue or redirect a misleading agent run
- a change passed checks but still exposed a workflow blind spot

Each log should be intentionally short and structured.

Suggested minimal schema:

- date
- task type
- short goal
- changed files
- checks run and outcomes
- failure or friction category
- human correction needed
- missing or misleading guardrail
- one concrete improvement proposal

Suggested storage:

- keep these logs in a dedicated folder such as `agent-runs/` or `logs/agent-runs/`
- do **not** mix them into `reviews/` or backlog artifacts

Why it helps:

The repo explicitly exists to learn where agents succeed, fail, and need safeguards. That learning should become comparable over time without creating paperwork sludge.

## Medium-term workflow additions

### 6. Review-depth recommendation, never workflow replacement

Use the advisory rule source to suggest review depth based on change risk.

Examples:

- small diff inside one contained subsystem -> lighter review depth may be enough
- cross-cutting gameplay changes -> deeper review recommended
- workflow, deployment, service-worker, or instruction changes -> high review depth recommended

Critical rule:

This must **not** override canonical task workflow selection from `AGENTS.md`.

- A feature request still follows `instructions/feature-request.md`.
- A bug report still follows `instructions/bug-report.md`.
- A lightweight local diff review still follows `instructions/change-review.md`.

The automation may recommend *how deeply to review*, but not silently reroute a bug or feature task into a different process just because the diff looks small.

Why it helps:

It adds risk-sensitive review guidance without undermining the repository’s task discipline.

### 7. Unified summary generation

The earlier ideas for a “postflight summary” and a separate “local change summary from diff context” should be merged into one tool.

Possible command:

```text
npm run agent:summary
```

Possible output fields:

- changed files
- checks run and outcomes
- affected docs
- user-visible impact
- risks and open questions
- copyable short block for commit / PR / handoff

Why it helps:

One summary tool is easier to maintain and easier to teach than two almost identical ones.

### 8. Standardized task packages inside existing instructions

Add reusable task shapes for common work types, but keep them inside the current instruction system instead of creating a competing workflow layer.

Examples:

- balancing tweak
- PWA/offline fix
- gameplay bugfix
- workflow-doc update
- targeted review

Why it helps:

It reduces prompt variance while preserving the current canonical instruction entry points.

### 9. Backlog-to-branch helper

When selecting a backlog item, prepare:

- a branch name suggestion
- a short execution brief
- likely files to inspect first
- likely checks to run

Keep it intentionally light. Do not create a whole artifact factory for every small task.

Why it helps:

It shortens the path from backlog entry to execution without bloating the repo into process soup.

## CI/CD and automation expansion ideas

The repository already uses GitHub Actions for validation and deployment, and the README explicitly describes that as the current safety net. Future CI/CD work should therefore grow from the existing baseline rather than jump directly into heavy bots or complicated PR intelligence.

### 10. CI that consumes the same advisory rule source

Once the local advisory rule source exists, CI should reuse it where that adds dependable value.

Good early uses:

- surface matched areas for changed files
- select advisory notes for likely docs to review
- flag high-risk areas touched by the diff
- choose which optional validation jobs to enqueue later

Important governance rule:

- CI may consume the rule source for hints and orchestration.
- CI must not use it to bypass the canonical process documents.
- If CI ever blocks on rule-derived logic, the blocking rule must be documented clearly in a canonical repo document first.

Why it helps:

Local and CI automation stay aligned instead of inventing separate heuristics.

### 11. Expand validation coverage honestly before adding clever commentary

The current repository should first improve real validation coverage before adding too many semantic workflow hints.

Examples of worthwhile expansion:

- add explicit validation for HTML or CSS only when the repo chooses a tool worth maintaining
- add targeted smoke-test helpers for PWA behavior under local HTTP conditions
- harden service-worker update-path testing when caching behavior changes
- add deployment-relevant checks only when they reflect actual failure modes seen in the repo

Why it helps:

A repo gains more from one trustworthy validation signal than from ten clever but shaky comments.

### 12. CI hints based on robust signals first

Add advisory CI hints only when the signal is reliable.

Prefer signals like:

- file matches
- changed paths
- job execution status
- check outcomes
- touched workflow or doc files

Be cautious with signals like:

- “tests were not mentioned in the PR text”
- “docs were not mentioned in the summary”
- any free-text heuristics that generate nagging noise

A good progression would be:

1. robust machine signals only
2. optional human-facing advisory messages
3. only much later, selective policy enforcement where false positives are very unlikely

Why it helps:

This keeps CI useful instead of turning it into a hall monitor with a kazoo.

### 13. Instruction and workflow checks in CI

Once local instruction linting is stable, mirror it in CI.

Examples:

- `AGENTS.md` references resolve
- instruction file paths still exist
- required workflow docs are not accidentally removed
- internal links remain valid

Only later consider semantic checks such as contradiction detection or missing mirrored updates across workflow docs.

Why it helps:

This repo depends unusually heavily on process docs. CI should eventually protect that surface area too.

### 14. Progressive policy gates instead of instant hard blocking

If the repository adds more workflow-aware CI, introduce enforcement in stages.

Suggested progression:

- stage 1: advisory notes only
- stage 2: warnings for obviously risky cases
- stage 3: hard failures only for narrow, high-confidence conditions

Examples of candidates for eventual hard gating:

- broken instruction references
- direct pushes to protected branches
- missing required generated artifact for a canonical workflow that explicitly mandates it
- broken mandatory validation job

Why it helps:

It prevents the repo from becoming hostile to contributors before the automation is mature enough to deserve authority.

### 15. Deployment hardening after validation maturity

The repository already deploys from `main`. Later CI/CD work can strengthen that path once validation is trustworthy.

Possible additions:

- deployment jobs that clearly separate verify/build/deploy phases
- visible deploy metadata for commit, branch, and workflow run
- rollback notes or playbooks for broken deploys
- smoke checks against the deployed artifact where that is cheap and reliable

Why it helps:

Deployment hardening matters, but it should sit on top of trustworthy validation rather than compensate for weak local or CI verification.

## Anti-patterns to avoid

- Building a second workflow constitution in JSON while `AGENTS.md` and `instructions/` quietly say something else.
- Pretending HTML, CSS, or browser-behavior validation already exists when it does not.
- Letting review-depth suggestions silently reroute bug or feature workflows.
- Logging every tiny agent action until the learning signal drowns in process foam.
- Adding CI commentary that is more fragile than the code it comments on.
- Shipping “smart” automation before the repository has one clean rule source and one honest baseline.

## Recommended implementation order

1. Define the single advisory rule source and document its governance boundaries.
2. Build `agent:preflight` as a hinting tool on top of that rule source.
3. Add documentation-drift hints and basic instruction linting.
4. Introduce structured run logs with explicit triggers and a dedicated storage location.
5. Merge summary concepts into one `agent:summary` command.
6. Let CI consume the same advisory rule source for hints.
7. Expand real validation coverage where the repo actually needs it.
8. Add conservative CI hints based on robust signals.
9. Introduce narrow hard gates only after the automation earns trust.
10. Harden deployment flows after validation maturity.

## Bottom line

The fastest path to success for this repository is not to build a grand autonomous agent operating system. It is to build a repo that:

- tells agents where they are,
- shows which checks and docs are likely relevant,
- keeps canonical process authority in the existing instruction files,
- and records a small amount of real evidence about where agents still go off the rails.

That is less glamorous than prompt wizardry, but much more likely to produce reusable workflow lessons for future projects.
