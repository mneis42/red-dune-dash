# Pre-PR Checklist For Writing Agents

Use this checklist before creating a PR or handing off a PR-ready coding run.
The checklist is mandatory for writing-agent runs that are intended for review.

## Purpose

Catch predictable review objections early and keep change sets small, verifiable, and easy to review.

## Mandatory Checklist

1. Scope check
   - Confirm the stated task scope in one sentence.
   - Confirm all touched files are necessary for that scope.

2. Smallest-change check
   - Confirm the diff is the smallest viable implementation for the intended behavior.
   - List any removed or deferred non-essential edits.

3. Touched-files review
   - Count touched files as unique changed paths in the current change set.
   - Group touched files by repository area:
     - `gameplay`: `systems/**`, `game-endless.js`
     - `pwa`: `service-worker.js`, `app-assets.js`, `manifest.webmanifest`
     - `ui-shell`: `index.html`, `styles.css`
     - `tooling`: `scripts/**`, `tests/**`, `package.json`
     - `workflow-docs`: `AGENTS.md`, `CONTRIBUTING.md`, `README.md`, `instructions/**`, `docs/**`, `backlog/**`, `workflow/**`

4. Split-decision check
   - Evaluate thresholds using touched-file count:
     - `1-5`: default no-split path
     - `6-9`: no-split allowed only with a short explicit justification
     - `10+`: split required before PR or handoff
   - Record one explicit decision:
     - `no-split-default`
     - `no-split-with-justification`
     - `split-required`

5. Hard split triggers (take precedence over file-count thresholds)
   - Cross-scope trigger: if one PR-ready change set mixes `workflow-docs` with any implementation area (`gameplay`, `pwa`, `ui-shell`, `tooling`), split is required unless a short explicit exception is documented in handoff.

6. Advisory split signals (guidance, not hard policy)
   - Deep-plus-six signal: if review depth is `deep` and touched files are `6+`, consider splitting or document why the combined diff is still reviewable.
   - Broad-contract signal: if a contract change affects `3+` consumer files, consider splitting or document why the combined diff is still inseparable and reviewable.

7. Relevant tests/checks review
   - Run checks relevant to touched areas.
   - Record each check as `pass`, `fail`, `not-run`, or `skipped-unsafe`.

8. Skipped-check justification
   - For every `not-run` or `skipped-unsafe` check, provide a short justification.

9. Run-log decision checkpoint
   - Complete a run-log decision checkpoint using [docs/agent-run-logs.md](../docs/agent-run-logs.md): explicitly decide whether a trigger occurred during the run.
   - If a trigger occurred, create or update the run log and record `created/updated: <log path>`.
   - If no trigger occurred, record `none required` explicitly.
   - Do not infer `none required` only from the absence of `logs/agent-runs/` changes; the decision must still be supplied explicitly.

10. Docs/instruction impact review
   - State whether docs or instruction updates were required.
   - List updated docs/instructions or state why none were needed.

11. Backlog sync review
   - Check whether the branch makes any open prioritized backlog item done, obsolete, or superseded.
   - If yes, update or archive that backlog item in the same branch before PR handoff.
   - Record which backlog paths were checked or state `none affected`.

12. Likely reviewer objections self-review
   - List likely objections and whether each is resolved, accepted-risk, or deferred.

13. Remaining risks
   - List residual risks explicitly, or state `none`.

## Handoff Output Requirements

The checklist outcome must appear in the existing `npm run agent:summary` handoff flow.
Do not create a separate summary format.

Minimum handoff fields:

- touched-file count
- matched/touched scope areas
- split decision and trigger reasons
- checks run and skipped-check justifications
- run-log decision checkpoint
- docs/instruction impact
- backlog sync review result
- likely reviewer objections
- remaining risks

## Concise Example

Task: align one instruction sentence with current hook behavior.

- scope: update wording for hook signal path only
- touched-files: `2` (`instructions/`, `.github/instructions/`)
- split-decision: `no-split-default` (`1-5` touched files)
- hard triggers: none
- checks: `npm run instruction:lint=pass`, `npm run test:preflight=pass`
- skipped checks: none
- run-log decision checkpoint: none required
- docs/instruction impact: instruction docs updated in both canonical and mirrored locations
- backlog sync review: none affected
- likely reviewer objections: wording mismatch risk resolved
- remaining risks: none
