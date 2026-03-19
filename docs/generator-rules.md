# Generator Rules

This document describes current world-generator rules and invariants for `Red Dune Dash`.

## Goal

The generator must satisfy three goals simultaneously:

- build the world forward endlessly without visible gaps
- add optional content such as platforms, pickups, bugs, and hazards
- avoid unfair or unplayable layouts

Additionally, failed optional content generation must never block core world progression.

## Core Flow

Generation currently runs across three levels:

### `initLevel()`

Seeds the beginning of the run with:

- a fixed opening sequence of ground platforms
- an initial pickup
- an initial bug
- additional pre-generated chunks ahead

### `generateUntil(targetX)`

Calls `generateChunk()` repeatedly until the world extends far enough ahead of player and camera space.

### `generateChunk()`

Builds exactly one new base chunk:

1. compute gap to previous chunk
2. create new ground platform
3. evaluate optional ground decoration
4. evaluate optional plate or bonus platforms
5. finally advance `level.nextChunkX` and `level.lastGroundY`

## Transactional Optional Content

Optional chunk features (for example elevated bonus platforms) may fail.

To avoid leaving partial state behind, the generator uses a small rollback model:

- `createChunkFeatureSnapshot()`
- `commitChunkFeatureAttempt(...)`
- `restoreChunkFeatureSnapshot(...)`

Rollback includes, among other things:

- added platforms
- temporarily changed hazards
- newly added pickups
- newly added bugs
- newly allocated bug-lifecycle IDs

This ensures:

- failed optional features can simply produce a simpler chunk
- the chunk remains valid
- world progression still advances exactly once

## Current Fairness Rules

### Ground Chunks

- ground Y varies only within bounded range `world.floorYMin` to `world.floorYMax`
- chunk width and gap width stay inside controlled random intervals
- ground hazards appear only on sufficiently wide segments with side safety margins

### Elevated Platforms

Optional plate and bonus platforms must pass multiple checks:

- no platform overlap
- enough underpass clearance
- helper platform via `ensureStepPlatform(...)` when needed for high placements
- at least one plausible approach via `hasReachableApproach(...)`

If a high platform would be unplayable without support, it is not kept.

### Hazard Corrections

In specific cases, hazards are removed under critical areas when otherwise required traversal would become unplayable.

This is intentionally a fairness correction for conflicts between:

- high platform placement
- required approach lane
- already placed ground hazard

It is not intended as a global bypass rule.

### Pickups And Bugs

Detailed pickup and bug placement on platforms uses shared helpers:

- pickup typing through the pickup system
- safe zones through the placement system

This keeps exact placement semantics outside direct chunk-construction logic.

## Event And Debug Influence

Decorative probabilities are no longer read only from hard-coded values. The generator now also considers:

- `specialEventSystem.getChunkGenerationRules()`
- debug multipliers for pickup and bug spawn chance families

Important semantics:

- events and debug options may change density and risk
- they should not invalidate core traversal constraints

## Extension Points

Future features such as `refactoring`, new platform types, or new pickup families should attach via:

- new chunk rule values exposed through event definitions
- new spawn decisions through pickup and placement systems
- new traversal checks through named helpers instead of inline logic in `generateChunk()`

Avoid stacking new feature types as additional scattered branch blocks in the same generation flow.

## Invariants

- each chunk advances `level.nextChunkX` and `level.lastGroundY` exactly once
- optional content may fail without blocking world progression
- failed optional attempts leave no partial world objects behind
- traversal fairness has priority over maximum decoration density
- pickup placement and safe-pose details stay in shared systems, not duplicated in generator code
