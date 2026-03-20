---
workflow_type: backlog-item
source: review-findings-2026-03-20
priority: 1
status: done
planning_model: GPT-5 Codex
execution_model: GPT-5 Codex
created_at: 2026-03-20
last_updated: 2026-03-20
---

# TODO: Harden Git Commit And Push Verification

## Goal

Make agent-driven `git commit` and `git push` flows resilient to transient index locks and misleading push success states.

## Scope

- Detect transient `git index.lock` contention and retry once only after confirming the lock is gone.
- Add a post-push verification step that compares local `HEAD` with the tracked remote ref instead of trusting CLI success text alone.
- Surface a clear warning or retry path when the remote branch did not advance after an apparently successful push.
- Cover the new behavior with focused tests or fixtures where the current tool architecture allows it.

## Out Of Scope

- Replacing Git's native locking model.
- Introducing automatic force-push or destructive recovery behavior.

## Acceptance Criteria

- A transient `index.lock` failure triggers controlled recovery guidance or a safe retry path.
- Agent push workflows detect when `origin/<branch>` still lags behind local `HEAD` after a nominally successful push.
- The agent reports push state from verified refs, not from optimistic command output alone.
- Regression coverage exists for the lock-handling and stale-remote detection path where feasible.

## Suggested Verification

- Targeted automated tests for the git guardrail helper or workflow script that owns commit/push status reporting.
- Manual dry-run validation with a simulated stale `index.lock` scenario.
- Manual validation that a push is only reported as complete after remote ref verification succeeds.

## Notes

- This backlog item comes from the 2026-03-20 friction log where commit/push recovery required human correction after a lock conflict and stale remote state.
