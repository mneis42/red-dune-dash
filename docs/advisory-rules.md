# Advisory Rules

This repository uses a single machine-readable advisory rule source in workflow/advisory-rules.json.

The purpose is to provide discovery hints for changed files, such as:

- affected area
- risk tags
- recommended checks
- manual smoke checks
- suggested docs and reading
- CI signal hints

## Governance Boundary

This rule source is advisory only.

- Canonical workflow routing stays in AGENTS.md.
- Instruction files in instructions/ remain the authoritative execution workflows.
- Advisory output may suggest reading or checks, but it must not reroute feature, bug, or review workflows.

## CI Hint Rollout

CI hinting follows an explicit phased rollout so low-noise machine signals land before more interpretive messaging:

- Phase 1: robust machine signals only. `agent:advisory` may use changed paths, touched workflow/docs files, explicit CI job status, and explicit check outcomes passed in by the workflow run.
- Phase 2: optional human-facing advisory messaging layered on top of the same reliable signals.
- Phase 3: selective policy enforcement only for narrow, high-confidence cases with low false-positive risk.

Phase changes are qualitative maintainer decisions based on observed trustworthiness, usefulness, and noise. There is no required numeric gate in v1.

## Progressive Policy Gates

The phased rollout is now reflected in both documentation and `agent:advisory` output so contributors can see which signals are advisory, warning-only, or selective hard-fail candidates.

The canonical machine-readable source for these policy-gate definitions is `workflow/advisory-rules.json`. This section mirrors that source for human-readable review and is covered by a consistency test.

- Stage 1 advisory-only mode is active:
  - changed-path classification, suggested reading, and recommended checks remain non-blocking
  - canonical workflow routing still stays in `AGENTS.md` and `instructions/`
- Stage 2 warning mode is active:
  - `agent:advisory` surfaces non-blocking warnings when explicit CI runtime signals show risky states such as failed, cancelled, or skipped matched checks/jobs
  - warning mode uses deterministic inputs only: matched rule signals, supplied job status, and supplied check outcomes
- Stage 3 hard-fail mode is selective:
  - only narrow, high-confidence policy gates should block
  - candidate hard gates and current repo status are listed below

### Stage 3 Candidate Hard Gates

1. `broken-instruction-references`
   - Current repo status: enforced
   - Enforcement path: `npm run instruction:lint` in CI
   - Scope: broken local instruction links/anchors, missing canonical references, missing required workflow coverage
2. `missing-mandatory-canonical-artifacts`
   - Current repo status: partial coverage only, not a single enforced hard-fail gate
   - Current coverage: deterministic lint checks cover some canonical workflow files and backlog structure, but template-artifact existence is not enforced as one complete CI gate
   - Scope: required canonical workflow files, prioritized backlog structure, and template/backlog artifacts
3. `broken-mandatory-validation-jobs`
   - Current repo status: enforced
   - Enforcement path: `verify-linux-signals` and the compatibility `test` gate in CI
   - Scope: required deterministic validation jobs going red
4. `protected-branch-violations`
   - Current repo status: candidate only, not a CI hard-fail gate
   - Current coverage: local `.githooks/pre-push` protection plus `agent:preflight` guardrail visibility
   - Promotion rule: keep local/preflight-only until maintainers explicitly decide the CI false-positive risk is acceptably low

This means the repository already combines advisory and warning-only workflow hints with a narrow set of deterministic hard failures, but it does not yet promote protected-branch enforcement into CI policy blocking.

## File Locations

- Rules: workflow/advisory-rules.json
- JSON schema reference: workflow/advisory-rules.schema.json
- Schema ID strategy: `workflow/advisory-rules.schema.json` intentionally omits `$id` to avoid publishing a misleading local-only canonical URI.
- Local matcher and validator: scripts/advisory-rules.js
- Local CLI summary command: scripts/agent-advisory.js
- Progressive policy gate metadata: `workflow/advisory-rules.json` (`policyGates`)

## Local Usage

Run advisory hints for local changes:

```bash
npm run agent:advisory
```

Use explicit file list:

```bash
npm run agent:advisory -- --files "systems/simulation-core.js,service-worker.js"
```

Emit machine-readable JSON:

```bash
npm run agent:advisory:json
```

List only files that required the fallback rule:

```bash
npm run agent:advisory:unmatched
```

Run preflight hints before implementation work:

```bash
npm run agent:preflight
```

Use explicit task scope to classify unrelated local changes with higher precision:

```bash
npm run agent:preflight -- --scope gameplay,pwa
```

Emit machine-readable preflight JSON:

```bash
npm run agent:preflight:json
```

Run unified summary generation for local-change and postflight-style handoff contexts:

```bash
npm run agent:summary
```

Run recommended checks and include command outcomes in the same summary output:

```bash
npm run agent:summary -- --run-checks
```

For PR-ready handoff usage, pass the explicit run-log decision so the summary does not infer `none required` only from an unchanged diff:

```bash
npm run agent:summary -- --run-log-decision none-required
```

Include check logs explicitly in JSON/human output when checks are executed:

```bash
npm run agent:summary -- --run-checks --include-logs
```

Emit machine-readable summary JSON:

```bash
npm run agent:summary -- --json
```

Run instruction and workflow markdown consistency checks:

```bash
npm run instruction:lint
```

This lint is focused on process docs and instruction references. It validates local markdown links and explicit heading anchors for the workflow surface (`AGENTS.md`, root process docs, `instructions/`, and `.github/` instruction docs).

## Matching Strategy

- Rule matching is path-pattern based.
- A file can match multiple rules.
- Multi-match output uses merge with de-duplication and stable ordering.
- Unknown files get a generic fallback advisory rule if unknownFileFallback is configured.
- CI runtime signal evaluation is deterministic and only reflects explicit job/check outcomes that the current workflow run supplied.

## Preflight Behavior Notes

- `agent:preflight` is advisory-only and remains non-blocking for warnings.
- The command reports whether the current branch is `main`.
- The command reports changed files and matched advisory context.
- The command reports an advisory review-depth recommendation (`light`, `standard`, `deep`) with short rationale and expected outcomes.
- Mixed-risk diffs follow explicit precedence: highest-risk tier wins.
- Review-depth recommendations never replace task routing; canonical workflow routing remains in `AGENTS.md` and instruction files.
- The command reports documentation-drift hints with a fixed initial mapping:
   - gameplay area changes suggest gameplay/system docs plus README review.
   - pwa area changes suggest offline/PWA documentation review.
   - workflow-docs area changes suggest README, CONTRIBUTING, AGENTS, and instructions review.
- The command reports unrelated local changes using this heuristic:
   - a file is unrelated when none of its matched areas intersects with task areas.
   - task areas come from `--scope` when provided; otherwise from inferred matched areas.
- Canonical guardrail signal is `core-hooks-path-pre-push-checked` with configured `core.hooksPath` and expected `<core.hooksPath>/pre-push` path (typically `.githooks/pre-push`).
- If `core.hooksPath` is not configured, preflight falls back to `legacy-git-hooks-pre-commit-checked` on `.git/hooks/pre-commit`.
- The command reports current observable state only and does not infer readiness from past `npm run setup` runs.

## Summary Behavior Notes

- `agent:summary` is a single canonical summary command for both local-change and postflight-style usage.
- The command always reports changed files, checks and outcomes, affected docs/instructions, user-visible impact, risks, and open questions.
- The command includes a copy-ready short block for commit messages, PR descriptions, or handoff text.
- Without `--run-checks`, recommended checks are listed as `not-run` to avoid overstating validation coverage.
- Check execution uses a safe allowlist-style parser (`npm test` and `npm run <script>`), not shell execution.
- Check logs are not included for passing checks unless `--include-logs` is explicitly set.

## Rule Update Checklist

1. Keep rule scope narrow and high-signal.
2. Preserve advisory-only governance text.
3. Run validation and tests:
   - npm run check
   - npm test
4. If behavior changes, update this document and nearby workflow docs.
