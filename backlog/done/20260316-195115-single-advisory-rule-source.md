---
workflow_type: feature-request
title: Single Advisory Rule Source For Change Classification And Verification Hints
overall_status: in-progress
planning_model: GPT-5.3-Codex
branch: chore/todo-template-workflows-20260316-183426
created_at: 2026-03-16
last_updated: 2026-03-16
---

# Feature Request TODO

## Feature Summary

- Summary: Introduce one machine-readable advisory rule source that maps changed file patterns to risk and verification hints for agent and CI consumers.
- Fit assessment: Strong fit. The repository already documents process-heavy workflows and can benefit from one centralized advisory source without changing canonical routing authority.
- Non-goals: No workflow rerouting, no hard policy gate, no automatic feature-vs-bug classification authority outside AGENTS.md.

## Impact Assessment

- Gameplay consistency: Indirect impact only. Better pre-change guidance should reduce accidental regressions in gameplay systems.
- Developer workflow: High positive impact. Reduces duplicate heuristics and makes recommendations consistent across tools.
- Architecture: Introduces a small configuration surface plus validation/loading code. Keeps logic explicit and reviewable.
- Long-term maintainability: Positive if schema remains small and validated.

## Verification Baseline

- Tests: pass - `npm run verify` passed, including new advisory tests.
- Build: not-run - No build step currently defined beyond existing checks.
- Lint/Typecheck: pass - Repository syntax check (`npm run check`) passed.
- Manual checks: done - Ran advisory CLI with explicit file input and validated fallback and merge output.

## Assumptions And Open Questions

- Assumption: Rule matching remains path-pattern based (glob-like), with no semantic AST analysis in v1.
- Assumption: The rule file is advisory-only and is consumed by local scripts and CI hints.
- Assumption: Existing canonical workflow routing remains unchanged in AGENTS.md and instruction files.
- Decision: Rules file path is `workflow/advisory-rules.json`.
- Decision: Unknown file paths use a generic fallback advisory.
- Decision: Multi-match strategy is merge with dedupe and stable ordering.

## Decision Gate

- Developer decision: implement-now
- Decision timestamp: 2026-03-16 19:29
- Rule: No implementation commits while decision is pending.

## TODO Index

- [x] P0 - Define rule schema and governance boundaries
- [x] P1 - Create initial advisory rule dataset
- [x] P1 - Implement deterministic matcher and merge behavior
- [x] P1 - Add local advisory preview command
- [x] P2 - Add automated tests for schema and matching behavior
- [x] P2 - Document usage, authority boundaries, and update process
- [ ] P2 - Add optional CI advisory surfacing (non-blocking)
- [x] P3 - Add maintenance helpers and rule drift checks

### P0 - Define rule schema and governance boundaries

Execution model: GPT-5.3-Codex
Status: done

Objective

Define a minimal, stable schema for advisory rules and codify non-authority governance so the feature cannot silently become a workflow router.

Planned changes

- Add JSON schema for advisory rule objects and top-level document structure.
- Add explicit fields for `match`, `area`, `riskTags`, `recommendedChecks`, `manualChecks`, `suggestedDocs`, `suggestedReading`, and `ciSignals`.
- Add required governance note in docs: AGENTS.md remains canonical routing authority.
- Define deterministic conflict handling strategy (merge vs precedence) and document it.

Dependencies / prerequisites

- None.

Risks / edge cases

- Overly broad schema can create maintenance burden.
- Missing governance language could cause future process drift.

Verification required

- Validate sample rules against schema.
- Review governance wording across AGENTS and instruction docs for consistency.

Done criteria

- Schema file exists and validates planned rule entries.
- Governance boundary is explicitly documented in at least one canonical process file.

Verification performed

- Added `workflow/advisory-rules.schema.json` and validated rule document via matcher test suite.
- Documented governance boundary explicitly in `workflow/advisory-rules.json` and `docs/advisory-rules.md`.

Remaining risk / follow-up

- Need team agreement on precedence/merge rule before consumers depend on it.

File references

- workflow-ideas.md
- AGENTS.md
- instructions/feature-request.md

### P1 - Create initial advisory rule dataset

Execution model: GPT-5.3-Codex
Status: done

Objective

Create the first production-ready advisory rules file covering core change areas in this repository.

Planned changes

- Add advisory rules for gameplay (`systems/**`, `game-endless.js`).
- Add advisory rules for PWA/offline (`service-worker.js`, `app-assets.js`, `manifest.webmanifest`).
- Add advisory rules for workflow docs (`AGENTS.md`, `instructions/**`, `README.md`, `CONTRIBUTING.md`).
- Add advisory rules for UI shell (`index.html`, `styles.css`).

Dependencies / prerequisites

- P0 schema finalized.

Risks / edge cases

- Pattern coverage gaps for nested/new folders.
- Too many recommended checks can reduce signal-to-noise.

Verification required

- Validate dataset against schema.
- Dry-run matching for representative changed file sets.

Done criteria

- Rules file committed with initial high-leverage mappings.
- At least one representative match scenario per area documented.

Verification performed

- Added `workflow/advisory-rules.json` with gameplay, pwa, workflow-docs, and ui-shell mappings.
- Validation covered in `tests/advisory-rules.test.js`.

Remaining risk / follow-up

- Expand mappings after observing real PRs and false positives.

File references

- workflow-ideas.md
- package.json
- scripts/check-syntax.js

### P1 - Implement deterministic matcher and merge behavior

Execution model: GPT-5.3-Codex
Status: done

Objective

Provide a reusable matcher utility that converts changed file lists into advisory outputs in a deterministic and testable way.

Planned changes

- Add matcher utility that accepts changed paths and rule source.
- Implement deterministic ordering of matched rules and output normalization.
- Implement documented merge behavior for multi-rule matches (dedupe arrays, stable output ordering).
- Expose machine-consumable output (JSON) for local and CI reuse.

Dependencies / prerequisites

- P0 schema decisions.
- P1 initial dataset.

Risks / edge cases

- Rule overlap can generate contradictory hints.
- Path normalization differences (macOS vs CI Linux) can break matching.

Verification required

- Unit tests for single-match, multi-match, and no-match cases.
- Snapshot tests for stable output format.

Done criteria

- Matcher module produces stable output for fixed inputs.
- Merge behavior follows documented rules and passes tests.

Verification performed

- Added deterministic matcher and merge logic in `scripts/advisory-rules.js`.
- Verified merge-dedupe behavior and ordering in `tests/advisory-rules.test.js`.

Remaining risk / follow-up

- Monitor for noisy suggestions and tune rules after initial adoption.

File references

- scripts/
- systems/

### P1 - Add local advisory preview command

Execution model: GPT-5.3-Codex
Status: done

Objective

Expose a local command to preview matched advisory hints from current changed files, without introducing blocking behavior.

Planned changes

- Add script (for example `scripts/agent-advisory.js`) that reads changed files from git and prints advisory summary.
- Add npm command (for example `npm run agent:advisory`).
- Ensure command exits successfully even when no rules match.
- Include human-readable and JSON-friendly output modes.

Dependencies / prerequisites

- Matcher utility available.

Risks / edge cases

- Git state assumptions (no repo, detached head, staged-only mode) can produce confusing output.
- Output verbosity may reduce usefulness.

Verification required

- Run against a known diff and verify expected matched hints.
- Confirm non-blocking behavior and exit code policy.

Done criteria

- Command available via package.json.
- Output clearly indicates matched areas, risk tags, and recommended checks.

Verification performed

- Added CLI command in `scripts/agent-advisory.js` with human and JSON output modes.
- Verified explicit file run: `npm run agent:advisory -- --files "systems/simulation-core.js,version.json"`.

Remaining risk / follow-up

- Consider adding scope flags (staged vs unstaged) after first adoption.

File references

- package.json
- scripts/

### P2 - Add automated tests for schema and matching behavior

Execution model: GPT-5.3-Codex
Status: done

Objective

Protect rule reliability with focused tests that catch regressions in schema compatibility and matching behavior.

Planned changes

- Add test file for schema validation pass/fail examples.
- Add matcher behavior tests for overlapping and cross-area file sets.
- Add regression fixtures for expected output content and ordering.

Dependencies / prerequisites

- P1 matcher implementation.

Risks / edge cases

- Brittle snapshots if output is not normalized.

Verification required

- `npm test` passes with new tests included.
- Targeted test command for matcher suite passes locally.

Done criteria

- New tests cover success and failure paths.
- Test docs mention how to update fixtures intentionally.

Verification performed

- Added `tests/advisory-rules.test.js` with validation, merge, and fallback coverage.
- `npm test` passed including advisory tests.

Remaining risk / follow-up

- Add additional fixtures as new directories are introduced.

File references

- tests/

### P2 - Document usage, authority boundaries, and update process

Execution model: GPT-5.3-Codex
Status: done

Objective

Document how advisory rules should be authored and consumed so behavior stays transparent and governance-safe.

Planned changes

- Add docs section describing rule schema, examples, and update checklist.
- Clarify authority boundary: advisory only, AGENTS.md remains workflow router.
- Add troubleshooting notes for false positives/false negatives.
- Document expected verification before changing rules.

Dependencies / prerequisites

- P0 and P1 completed.

Risks / edge cases

- Incomplete docs can lead to ad hoc consumer behavior.

Verification required

- Cross-read updated docs for contradictions.
- Confirm every referenced path exists.

Done criteria

- Documentation exists and is internally consistent.
- First-time contributor can update one rule without reading code internals.

Verification performed

- Added `docs/advisory-rules.md` with usage, governance, and update checklist.
- Updated `README.md` and `CONTRIBUTING.md` with advisory command guidance.

Remaining risk / follow-up

- Consider instruction-lint checks once docs format stabilizes.

File references

- README.md
- CONTRIBUTING.md
- docs/
- AGENTS.md

### P2 - Add optional CI advisory surfacing (non-blocking)

Execution model: GPT-5.3-Codex
Status: in-progress

Objective

Surface matched advisory hints in CI logs or summaries without enforcing new hard gates.

Planned changes

- Add CI step to run advisory preview against PR diff.
- Publish advisory output as job summary artifact.
- Keep step non-blocking in initial rollout.

Dependencies / prerequisites

- Local advisory command available.

Risks / edge cases

- Diff acquisition in CI can differ from local behavior.
- Noisy CI output can be ignored if not curated.

Verification required

- Validate advisory summary appears in CI on a sample PR.
- Confirm CI status unaffected when advisory script warns only.

Done criteria

- CI shows advisory hints for changed areas.
- No new false hard-fail path introduced.

Verification performed

- Added non-blocking advisory step to `.github/workflows/ci.yml`.
- CI step computes changed files from latest commit range and prints advisory hints.

Remaining risk / follow-up

- Validate on a real PR run and tune diff strategy if merge-base handling needs improvement.

File references

- .github/

### P3 - Add maintenance helpers and rule drift checks

Execution model: GPT-5.3-Codex
Status: done

Objective

Reduce long-term drift by adding lightweight maintenance support around the advisory rules.

Planned changes

- Add helper to list unmatched changed files in a diff.
- Add helper to detect dead patterns (never matched over sample history, if available).
- Add periodic review checklist for rule freshness.

Dependencies / prerequisites

- Core rule system in use.

Risks / edge cases

- Historical analysis can create false confidence with small sample sizes.

Verification required

- Run helper against at least one multi-area change set.

Done criteria

- At least one drift-check helper available and documented.

Verification performed

- Added unmatched-file helper mode via `npm run agent:advisory:unmatched`.
- Verified helper output with explicit file input; only fallback-matched files are listed.

Remaining risk / follow-up

- Decide whether to keep helpers local-only or expose in CI.

File references

- scripts/
- docs/

## Risks And Mitigations

- Risk: Advisory rules become de facto authority.
- Mitigation: Explicit governance text plus non-blocking behavior in v1 and reviews on rule changes.
- Risk: High false-positive rate reduces trust.
- Mitigation: Keep v1 rule set small, measure noise, iterate with tests.
- Risk: CI/local divergence in path matching.
- Mitigation: Normalize paths and add cross-platform test cases.

## Test Strategy

- Add focused unit tests for matcher behavior and merge logic.
- Add schema validation tests with positive and negative fixtures.
- Run existing repository baseline checks (`npm run check`, `npm test`) before merging implementation.

## Documentation Follow-ups

- [x] README updated
- [x] Relevant docs in docs/ updated
- [x] Relevant instruction or workflow files updated
