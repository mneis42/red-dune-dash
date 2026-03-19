# Respawn Fairness

This document describes current respawn, damage, and resume fairness guarantees in `Red Dune Dash`.

## Goal

Damage should be meaningful, but should avoid unfair death chains or player-control collapse.

The game uses layered protections:

- safe checkpoints
- safe hurt poses
- short invulnerability windows
- countdown before actual respawn
- explicit resume fairness rules after pause or app context switches

## Checkpoint Model

Checkpoints are not arbitrary markers. They are derived safe player positions.

Current rules:

- checkpoints are updated only on `ground` platforms
- player must be clearly ahead of the current checkpoint
- target position is selected via `getSafeCheckpointX(...)`
- hazards on the same player lane block checkpoint ranges

Goal:

- no respawn directly on hazards
- no jittery checkpoint repositioning from tiny movements

## Hurt Poses Instead Of Instant Respawn

Not all damage teleports the player directly to checkpoint.

For visible hit states, the game uses:

- `hurtTimer`
- `pendingRespawn`
- `forceInjuredPose`
- `respawnVisual`

This enables:

- clear hit feedback
- short readability window for mistakes
- controlled respawn after feedback instead of same-frame hard teleport

## Safe Hurt Position

When visible hurt pose is used, position is not accepted blindly.

Instead:

- `moveToSafeInjuredPose(...)` first searches for supporting floor
- `getSafePlatformPoseX(...)` removes hazard and living-bug intervals
- if no meaningful platform is found, system falls back to last checkpoint

Important behavior:

- pose tries to stay near impact point
- safety has priority over visual exactness

## Damage Types

### Crater Fall

- costs one life
- uses countdown notice instead of frozen ground pose
- returns to checkpoint after countdown

### Hazard Hit

- costs one life
- uses safe hurt pose
- avoids immediate follow-up hits on same run lane

### Bug Hit

- costs one life
- also uses safe hurt pose
- falling bugs and running bugs share same fairness model with slight feedback variation

### Bug Stomp

- explicitly not damage
- resolves bug
- grants upward bounce and score

## Invulnerability And Respawn Timing

After damage, player receives temporary invulnerability:

- longer for visible hurt-state flows
- shorter for direct-reset flows without full hurt phase

Additional behavior:

- while `hurtTimer > 0`, active movement simulation is paused
- actual checkpoint respawn happens only after countdown expires

This prevents multi-hit chains in the same moment and avoids forcing active movement during hit feedback.

## Pause And Resume Fairness

The game explicitly distinguishes pause reasons:

- `manual`
- `portrait`
- `background`

Current rules:

- manual pause may resume directly
- background resume uses a safety countdown
- portrait-to-landscape resume also uses countdown
- active simulation is blocked during resume and hurt countdowns

Goal:

- app switches and rotation changes should not cause unfair instant hits
- player receives a small reaction window after resume

## Extension Points

Future features such as `refactoring`, new backlog hazards, or more complex boss/event phases should keep the same principles:

- hit feedback should remain readable
- respawns should originate from safe positions
- resume contexts need explicit reaction windows
- new fairness rules should attach to placement or respawn helpers rather than being duplicated across every damage branch

## Invariants

- checkpoints move forward only to safe ground positions
- visible hurt poses do not intentionally place players into hazards or living bugs when a safe alternative exists
- countdown phases block active movement and provide reaction time
- background and portrait resume must be handled more conservatively than intentional manual pause
- damage feedback and safety placement are separate concerns: visuals may vary, safety logic should stay consistent
