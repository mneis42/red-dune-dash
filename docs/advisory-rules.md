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

## Matching Strategy

- Rule matching is path-pattern based.
- A file can match multiple rules.
- Multi-match output uses merge with de-duplication and stable ordering.
- Unknown files get a generic fallback advisory rule if unknownFileFallback is configured.

## Rule Update Checklist

1. Keep rule scope narrow and high-signal.
2. Preserve advisory-only governance text.
3. Run validation and tests:
   - npm run check
   - npm test
4. If behavior changes, update this document and nearby workflow docs.
