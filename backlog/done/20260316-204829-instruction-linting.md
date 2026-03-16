---
workflow_type: feature-request
title: Instruction Linting
overall_status: done
planning_model: GPT-5.3-Codex
branch: chore/todo-template-workflows-20260316-183426
created_at: 2026-03-16
last_updated: 2026-03-16
---

# Feature Request TODO

## Feature Summary

- Summary: Add an instruction linting workflow that validates repository process documentation links and references.
- Fit assessment: High fit because workflow documents are core infrastructure in this repository and currently rely on manual consistency checks.
- Non-goals: No semantic contradiction engine in v1 and no workflow-routing authority changes.

## Verification Baseline

- Tests: pass - `npm run test:instruction-lint`, `npm test`.
- Build: not-run - No dedicated build step in this repository.
- Lint/Typecheck: pass - `npm run check`.
- Manual checks: done - `npm run instruction:lint` on current repository returned zero issues.

## Assumptions And Open Questions

- Assumption: `AGENTS.md` remains the canonical routing entry point.
- Assumption: Initial lint checks are deterministic file/link/reference validations only.
- Decision: v1 instruction lint runs explicitly in `npm run verify`.

## Decision Gate

- Developer decision: implement-now
- Decision timestamp: 2026-03-16 21:05
- Rule: No implementation commits while decision is pending.

## TODO Index

- [x] P1 - Define instruction-lint scope and rule contract
- [x] P1 - Implement instruction-lint script and command wiring
- [x] P2 - Add tests and documentation for instruction linting

### P1 - Define instruction-lint scope and rule contract

Execution model: GPT-5.3-Codex
Status: done

Objective

Define a precise and low-noise v1 rule set for instruction linting.

Planned changes

- Define required v1 checks: path exists, linked paths resolve, canonical instruction files referenced by `AGENTS.md` exist, obvious internal links are valid, and referenced section anchors resolve.
- Define output structure and severity levels for lint findings.
- Define v1 exclusions to avoid false positives.

Dependencies / prerequisites

- Existing workflow docs and instruction files.

Risks / edge cases

- Overly strict rules can cause noisy failures.
- Weak rules can miss broken process links.

Verification required

- Rule contract review against existing docs and references.

Done criteria

- Rule contract is explicit, deterministic, and scoped to robust checks.
- Exclusions and limitations are documented.

Verification performed

- Rule set implemented in `scripts/instruction-lint.js` as deterministic checks for local path validity, canonical AGENTS references, and markdown heading anchors.
- Current process docs validated with `npm run instruction:lint` (zero findings).

Remaining risk / follow-up

- Revisit rule strictness after first real lint runs.

File references

- AGENTS.md
- instructions/change-review.md
- instructions/full-code-review.md
- README.md
- CONTRIBUTING.md

### P1 - Implement instruction-lint script and command wiring

Execution model: GPT-5.3-Codex
Status: done

Objective

Implement a runnable instruction-lint check integrated with project scripts.

Planned changes

- Add script logic to validate file existence and internal references.
- Add package script entry for instruction linting.
- Ensure non-zero exit code for actionable failures only.

Dependencies / prerequisites

- Finalized rule contract from previous item.

Risks / edge cases

- Path normalization issues across environments.
- Broken references hidden by ambiguous markdown parsing.

Verification required

- `npm run check`
- New instruction-lint command smoke run

Done criteria

- Lint script reports clear findings and exits correctly.
- Command can be executed consistently in local workflow.

Verification performed

- `npm run check` passed (includes `scripts/instruction-lint.js` syntax validation).
- `npm run instruction:lint` passed (checked process markdown surface, zero issues).

Remaining risk / follow-up

- Consider optional machine-readable output format in follow-up.

File references

- scripts/
- package.json
- instructions/

### P2 - Add tests and documentation for instruction linting

Execution model: GPT-5.3-Codex
Status: done

Objective

Protect lint behavior with tests and document expected usage.

Planned changes

- Add test coverage for passing and failing reference scenarios.
- Document command usage and expected failure classes.
- Document advisory vs enforcement expectations.

Dependencies / prerequisites

- Implemented lint script and command.

Risks / edge cases

- Tests becoming brittle when docs evolve.
- Documentation drift if command behavior changes.

Verification required

- `npm test`
- `npm run verify`

Done criteria

- Tests cover core checks and representative edge cases.
- README and workflow docs explain how to run and interpret linting.

Verification performed

- `npm run test:instruction-lint` passed.
- `npm test` passed.
- `npm run verify` passed.

Remaining risk / follow-up

- Evaluate whether CI should enforce this as warning-only first.

File references

- tests/
- README.md
- docs/
- instructions/

## Documentation Follow-ups

- [x] README updated
- [x] Relevant docs in docs/ updated
- [ ] Relevant instruction or workflow files updated
