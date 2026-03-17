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

## File Locations

- Rules: workflow/advisory-rules.json
- JSON schema reference: workflow/advisory-rules.schema.json
- Local matcher and validator: scripts/advisory-rules.js
- Local CLI summary command: scripts/agent-advisory.js

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

## Preflight Behavior Notes

- `agent:preflight` is advisory-only and remains non-blocking for warnings.
- The command reports whether the current branch is `main`.
- The command reports changed files and matched advisory context.
- The command reports documentation-drift hints with a fixed initial mapping:
   - gameplay area changes suggest gameplay/system docs plus README review.
   - pwa area changes suggest offline/PWA documentation review.
   - workflow-docs area changes suggest README, CONTRIBUTING, AGENTS, and instructions review.
- The command reports unrelated local changes using this heuristic:
   - a file is unrelated when none of its matched areas intersects with task areas.
   - task areas come from `--scope` when provided; otherwise from inferred matched areas.
- Hook guardrail status prefers configured `core.hooksPath` with `.githooks/pre-push` as primary signal.
- If `core.hooksPath` is not configured, a legacy fallback signal checks `.git/hooks/pre-commit`.
- The command reports current observable state only and does not infer readiness from past `npm run setup` runs.

## Rule Update Checklist

1. Keep rule scope narrow and high-signal.
2. Preserve advisory-only governance text.
3. Run validation and tests:
   - npm run check
   - npm test
4. If behavior changes, update this document and nearby workflow docs.
