---
workflow_type: backlog-item
source: review-findings-2026-03-18
priority: 4
status: open
planning_model: GPT-5.4
execution_model: GPT-5.4
created_at: 2026-03-18
last_updated: 2026-03-18
---

# TODO: Extract More Runtime Systems From Game Endless Orchestrator

## Goal

Reduce the size and change-surface of `game-endless.js` by extracting additional runtime responsibilities into named subsystems.

## Scope

- Identify the next high-value extraction candidates from the current orchestrator, especially HUD/rendering, input handling, or PWA/update UI behavior.
- Move one coherent runtime area behind a clearer subsystem boundary without changing gameplay behavior.
- Update architecture documentation so the implemented boundary matches the documented system split.
- Add or extend targeted tests around the extracted boundary so later edits are less likely to collapse back into the main file unnoticed.

## Out Of Scope

- Full rewrite of the game loop.
- Cosmetic refactors that only shuffle code without improving ownership boundaries.

## Acceptance Criteria

- At least one meaningful runtime responsibility is moved out of `game-endless.js`.
- The extracted area has a clearer interface and lower coupling than before.
- Tests or targeted verification protect the extracted behavior.
- The change reduces future re-coupling risk through explicit ownership boundaries, not just file movement.

## Suggested Verification

- `npm run check`
- `npm test`
- Manual gameplay smoke check for the extracted runtime area.

## Notes

- The repo has good subsystem direction already, but the main orchestrator is still disproportionately large and costly to change safely.
- Favor seams that other agents can work on independently after the extraction.
