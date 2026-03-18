---
workflow_type: backlog-item
source: agent-review-friction
priority: P1
status: open
planning_model: GPT-5.4 Thinking
execution_model: GPT-5.4 Thinking
created_at: 2026-03-18
last_updated: 2026-03-18
---

# TODO: Add a mandatory pre-PR checklist for writing agents

## Goal

Reduce review churn in agent-authored pull requests by adding one canonical pre-PR checklist that writing agents must complete before PR creation or PR handoff.

## Scope

- Add one canonical checklist document for writing agents before PR creation or PR handoff.
- Define mandatory self-review items for scope control, smallest viable diff, verification, touched-file discipline, and docs/instruction impact.
- Integrate the checklist into the existing instruction flow so it is required for PR-ready coding runs instead of optional guidance.
- Reflect checklist outcomes in the existing agent handoff summary flow instead of creating a parallel reporting format.
- Add lightweight repository-native validation where practical.
- Add tests or lint coverage for new workflow guardrails when the repository already has a suitable validation path.

## Out Of Scope

- Replacing the current PR and review workflow with a separate orchestration system.
- Building an external agent runner or vendor-specific workflow.
- Solving all PR quality issues with automation alone.
- Introducing a second summary or reporting system alongside the existing one.
- Turning this into a general planning framework beyond pre-PR readiness.

## Acceptance Criteria

- A canonical checklist file exists in the repository and is clearly intended for code-writing agents before PR creation or PR handoff.
- The checklist includes at least:
  - scope check
  - smallest-change check
  - touched-files review
  - split-decision check
  - relevant tests/checks review
  - skipped-check justification
  - docs/instruction impact review
  - likely reviewer objections self-review
  - explicit remaining risks section
- The relevant instruction files reference the checklist and require agents to complete it before ending a coding run intended for PR review.
- The checklist defines explicit split triggers with unambiguous thresholds:
  - `1-5` touched files: default no-split path
  - `6-9` touched files: no-split allowed only with short explicit justification
  - `10+` touched files: split required before PR or handoff
- The checklist defines hard cross-scope split rules using existing repository areas, with cross-scope triggers taking precedence over file-count thresholds.
- Mixed `workflow-docs` and implementation-area changes in one PR-ready change set require a split unless the handoff documents a short explicit exception.
- A `deep` review-depth recommendation with `6+` touched files requires a split unless the handoff documents a short explicit exception.
- A broad contract change affecting `3+` consumer files requires a split unless the change is inseparable and the handoff documents a short explicit exception.
- The guidance does not conflict with `AGENTS.md` routing authority.
- Checklist outcome reporting is integrated into the existing `npm run agent:summary` flow, or into a documented canonical successor, rather than introducing a parallel summary format.
- Verification guidance is risk-based: agents run relevant checks for touched areas and explicitly justify skipped checks in handoff output.
- Any changed workflow guidance remains consistent across canonical and mirrored instruction locations where applicable.
- If enforcement is added, it is lightweight, repository-native, and covered by tests or existing lint-style validation where practical.

## Suggested Verification

- Run `npm run instruction:lint`
- Run `npm run backlog:lint`
- Run relevant checks for the touched scope and confirm skipped checks are explicitly justified in the handoff summary.
- Run the existing agent summary flow for at least one representative change and verify that checklist outcomes are reflected in the output.
- Manually verify that:
  - `AGENTS.md` remains the routing authority
  - `CONTRIBUTING.md` does not contradict the new checklist flow
  - the checklist can be followed by a writing agent without extra interpretation
  - the workflow does not create a parallel instruction or summary system

## Notes

- The main intent is to catch common review issues before Copilot or another reviewer sees the PR.
- Prefer a short enforceable checklist over a long aspirational document.
- Keep the checklist optimized for agent-written changes, not only for human contributors.
- Favor minimum-diff behavior and explicit verification evidence.
- Recalibrate thresholds after 10-15 PRs if review churn or false-split rate shows the policy is too strict or too loose.

---

## Proposed TODO Breakdown

### P1 - Create the canonical pre-PR checklist document

Execution model: GPT-5.4 Thinking  
Status: open

Objective

Create one canonical checklist file that code-writing agents must use before PR creation or PR handoff.

Planned changes

- Add a checklist document under `instructions/` or another clearly canonical workflow location.
- Define mandatory sections for:
  - scope boundary
  - smallest viable diff
  - touched-file counting basis (unique changed paths in the current change set)
  - split decision and short no-split justification when applicable
  - threshold evaluation (`1-5` default, `6-9` justified no-split, `10+` split required)
  - hard cross-scope trigger evaluation using existing repository areas
  - `deep` plus `6+` files trigger evaluation and exception path
  - broad contract-change trigger evaluation (`3+` consumers)
  - trigger precedence statement (hard cross-scope triggers override file-count thresholds)
  - verification performed
  - skipped-check justification
  - docs/instructions impact
  - expected reviewer objections
  - remaining risk
- Keep the checklist short enough to be used on every agent-authored change.

Dependencies / prerequisites

- Review current routing and instruction authority in `AGENTS.md`.

Risks / edge cases

- Checklist becomes too verbose and gets ignored.
- Checklist duplicates existing rules without adding enforcement value.

Verification required

- Manual consistency review against `AGENTS.md` and `CONTRIBUTING.md`.

Done criteria

- One canonical checklist file exists.
- It is clearly scoped to code-writing agents before PR or handoff.
- It avoids conflicting with existing workflow authority.

Verification performed

- Not yet.

Remaining risk / follow-up

- The checklist may still be treated as advisory until instruction files explicitly require it.

File references

- `AGENTS.md`
- `CONTRIBUTING.md`
- `instructions/`

### P1 - Integrate the checklist into writing-agent instructions

Execution model: GPT-5.4 Thinking  
Status: open

Objective

Make the checklist mandatory in the relevant instruction flow so writing agents must complete it before ending a coding run intended for PR review.

Planned changes

- Update the relevant canonical instruction files for coding or change delivery.
- Add a mandatory handoff gate referencing the checklist.
- Require explicit checklist completion in the final agent handoff summary for PR-ready changes.
- Keep wording aligned across canonical and mirrored instruction locations where needed.

Dependencies / prerequisites

- Canonical checklist document created first.

Risks / edge cases

- Multiple instruction files may need aligned wording.
- Poor placement may make the checklist easy to skip.

Verification required

- Manual review of all changed instruction files for consistency.
- Run `npm run instruction:lint` if the repository lint covers instruction consistency.

Done criteria

- Writing-agent instructions explicitly require the checklist before PR or handoff.
- The rule is written as mandatory, not optional advice.
- No instruction text creates a conflicting parallel workflow.

Verification performed

- Not yet.

Remaining risk / follow-up

- Mirrored instruction locations may need updates as well.

File references

- `AGENTS.md`
- `instructions/`
- `.github/instructions/`

### P2 - Extend the existing handoff summary with checklist outcomes

Execution model: GPT-5.4 Thinking  
Status: open

Objective

Ensure checklist outcomes are visible in agent handoffs so reviewers can assess readiness quickly without introducing a separate summary format.

Planned changes

- Extend the existing summary flow to include:
  - scope
  - touched-file count
  - split decision
  - verification run
  - skipped checks
  - docs updated or not
  - known risks
  - reviewer watch-outs
- Reuse the current `agent:summary` flow, or a documented canonical successor, instead of inventing a separate reporting path.

Dependencies / prerequisites

- Checklist content finalized.

Risks / edge cases

- Summary becomes redundant if it repeats checklist text verbatim.
- Agents may provide boilerplate instead of concrete evidence.

Verification required

- Manual validation with one or two representative change scenarios.

Done criteria

- Checklist outcomes are represented in the existing summary flow.
- Reviewers can infer readiness and residual risk quickly.
- No parallel summary format is introduced.

Verification performed

- Not yet.

Remaining risk / follow-up

- Keep the summary concise so extra checklist fields do not reduce readability.

File references

- `CONTRIBUTING.md`
- `instructions/`
- summary-related scripts or docs

### P2 - Add lightweight validation

Execution model: GPT-5.4 Thinking  
Status: open

Objective

Prevent the checklist from becoming dead documentation by adding lightweight repository-native validation where practical.

Planned changes

- Evaluate whether existing workflow or instruction lint can validate required checklist references.
- Add a small validation rule or test if the repository already has a suitable mechanism.
- Keep enforcement lightweight and maintainable.

Dependencies / prerequisites

- Checklist and instruction integration completed.

Risks / edge cases

- Over-engineering a process problem into brittle automation.
- False positives if validation depends on wording that is too rigid.

Verification required

- Run relevant automated checks.
- Confirm failures are understandable and actionable.

Done criteria

- There is at least one practical validation point, or a documented reason why enforcement remains manual for now.
- Any new validation is tested where practical.

Verification performed

- Not yet.

Remaining risk / follow-up

- Some checklist quality dimensions may remain human-judgment based.

File references

- `package.json`
- workflow or lint scripts
- `tests/`
- `instructions/`

### P3 - Add one concise example

Execution model: GPT-5.4 Thinking  
Status: open

Objective

Make the workflow easier to follow by adding one short example of a good pre-PR self-review.

Planned changes

- Add one concise example showing checklist completion for a small change.
- Demonstrate what “smallest possible diff” and “likely reviewer objections” look like in practice.

Dependencies / prerequisites

- Checklist wording stable.

Risks / edge cases

- Example becomes a cargo-cult template.

Verification required

- Manual review for clarity and brevity.

Done criteria

- One short example exists.
- It improves usability without bloating the workflow.

Verification performed

- Not yet.

Remaining risk / follow-up

- Can be deferred if the checklist is already clear enough.

File references

- new checklist document
- relevant docs if needed
