# Placement Rules

This document describes current fairness and safety rules for placement, collisions, and safe player positions in `Red Dune Dash`.

## Goal

Multiple systems need the same core model:

- pickups should spawn in visible, fair, reachable positions
- checkpoints should not create death loops
- hurt and respawn poses should not place players directly inside hazards or living bugs

Instead of duplicating similar placement math across systems, the game uses shared horizontal platform safe zones.

## Core Model

Each placement rule follows three steps:

1. determine usable platform range
2. subtract blocked intervals
3. choose the nearest valid target position in the remaining safe zones

Key terms:

- `Placement Range`: horizontal platform range after edge padding
- `Blocked Interval`: excluded range caused by hazard, bug, or another fairness rule
- `Safe Zone`: remaining valid range after all blocked intervals are removed

## Current Guarantees

### Collectibles On Platforms

Gems are treated as point placements:

- side edge padding is applied
- embedded hazards on the same platform lane carve safe zones
- if no sufficiently wide safe zone remains, no gem is placed

Important consequence:

- a hazard on a platform does not automatically block all placement
- only actually blocked sub-ranges are removed

### Checkpoints On Ground Platforms

Checkpoints are treated as safe player positions:

- player width is included in safe-zone calculations
- floor hazards on the same player lane block relevant intervals
- preferred position remains player-near, but only inside valid safe zones

Goal:

- no respawn directly on or too close to hazards
- minimal unnatural checkpoint jumps

### Hurt And Respawn Poses

Safe hurt poses reuse platform safe-zone logic from checkpoints, but with more blockers:

- floor hazards on the same player lane
- living bugs on the same player lane

Result:

- impacts keep the player as close as possible to the hit point
- follow-up hits at the same location are actively reduced

## Lane Rules

Not every hazard or bug on screen blocks every placement. Lane checks are intentionally separated:

- pickup lane: embedded hazards on the same platform top
- player lane: hazards on the platform run lane
- bug lane: living bugs on the platform run lane

This separation is important so future pickup types can add lane-specific rules without duplicating collision math.

## Generator Fairness

World generation still applies additional platform-level fairness checks:

- no platform overlap
- enough underpass clearance
- at least one plausible approach
- optional content may fail without invalidating the chunk

These checks complement safe-zone logic; they do not replace it.

## Extension Points

New pickup families should build on the same model:

- custom edge-padding needs
- custom minimum safe-zone width
- custom blocker types
- custom lane semantics

Examples:

- a rare event item may require wider safe zones
- a backlog gem may intentionally avoid platforms with active bugs
- a shield pickup may allow tighter hazard proximity than a currency gem

## Invariants

- placement relies on explicit safe zones instead of scattered special cases
- hazards block only the lanes where they are semantically relevant
- checkpoints and hurt poses include player width as a safety constraint
- if no safe zone exists, placement is skipped instead of implicitly forced
