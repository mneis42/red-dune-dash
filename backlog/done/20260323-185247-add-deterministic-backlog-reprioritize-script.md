---
workflow_type: backlog-item
source: process-hardening-2026-03-17
priority: 21
status: done
planning_model: GPT-5.3-Codex
execution_model: GPT-5.3-Codex
created_at: 2026-03-17
last_updated: 2026-03-23
---

# TODO: Add Deterministic Backlog Reprioritize Script

## Goal

Provide one canonical script to reprioritize numbered backlog items without shell quoting hazards.

## Scope

- Add a script that reads an explicit old-to-new priority mapping and performs two-phase renames.
- Reject incomplete mappings, duplicate target priorities, and missing source files.
- Support dry-run output before any file system mutation.
- Keep implementation Node-only and shell-agnostic so behavior is stable across agent models and local shells.
- Expose one canonical npm script entry point so contributors do not need ad-hoc command sequences.
- Normalize and validate paths with Node path utilities so separator differences do not affect behavior.
- Detect and reject case-collision targets that can fail on case-insensitive file systems.

## Out Of Scope

- Automatic prioritization decisions.
- Rewriting item content beyond filename changes.

## Acceptance Criteria

- Reprioritization can be executed with one deterministic command.
- Script fails fast on invalid mappings and leaves clear diagnostics.
- Dry-run and apply modes both produce predictable output.
- Apply mode does not mutate files when preconditions fail.
- Output summary includes planned rename count and explicit old->new path pairs.
- Script behavior is consistent on Windows, Linux, and macOS for the same mapping input.

## Suggested Verification

- npm run test:backlog-lint
- npm run backlog:lint
- Manual dry-run and apply on a local fixture set.

## Notes

- This hardens workflow execution against multiline shell and REPL state issues.
- Align with repository goal of high signal-to-noise workflows by replacing fragile manual command chains.
- Reprioritization can move legacy items across numeric policy cutoffs; implementation must define how metadata/lint expectations are handled after renumbering.
- Completed on 2026-03-23 with `scripts/backlog-reprioritize.js`, the `backlog:reprioritize` npm entrypoint, README usage guidance, and cross-platform/path-safety guardrails.
