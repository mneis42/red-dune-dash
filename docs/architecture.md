# Architecture

This document describes the current system split in `Red Dune Dash`.

## Goal

`game-endless.js` is no longer the only location for gameplay rules. Core domain systems now live in dedicated files and are consumed by the main file through orchestration.

This reduces coupling for future features such as:

- new pickup types
- new event types
- backlog mechanics
- additional spawn and fairness rules

## Current Systems

### `systems/game-state.js`

Responsible for the base shape of run-state objects:

- `level`
- `player`
- `runState`

Benefit:

- startup and reset structures no longer live only as anonymous literals in the main file
- state boundaries are explicit

### `systems/bug-lifecycle-system.js`

Responsible for domain bug lifecycle behavior:

- status values
- lifecycle ledger
- reset
- registration
- status transitions
- aggregate counters

Benefit:

- bug history is a dedicated system
- HUD, cleanup, and future backlog effects use the same source

### `systems/placement-system.js`

Responsible for safe zones and placement rules:

- platform placement ranges
- blocked intervals
- hazard and bug lane checks
- safe zones
- nearest valid safe X-position selection

Benefit:

- placement logic for pickups, checkpoints, and hurt poses no longer exists as scattered math in the main file

### `systems/pickup-system.js`

Responsible for typed pickups and their domain rules:

- pickup types
- pickup definitions
- platform spawn rules
- telegraphing durations
- render metadata
- pickup effects

Benefit:

- pickups are not implicitly "coin symbols"
- new pickup families can be introduced through definitions and effect hooks
- collision code does not need to know domain effect internals

### `systems/debug-tools.js`

Responsible for development and balancing configuration:

- query-parameter debug runs
- spawn multipliers
- start values for resources and backlog
- helper functions for spawn probability and delay handling

Benefit:

- debug settings stay separable from gameplay logic
- balancing tools are centrally documented and testable
- future debug shortcuts and content tools can reuse the same configuration model

### `systems/simulation-core.js`

Responsible for browser-free core rules and deterministic balancing logic:

- score and progression rules
- balance multipliers
- income spawn rules
- deterministic random helpers

Benefit:

- core rules are testable without canvas or DOM
- balancing changes can be protected by Node-based tests

### `systems/special-event-system.js`

Responsible for event lifecycle and event definitions:

- phase model
- scheduler
- event definitions
- runtime state
- status messages
- event effects for chunk rules and spawn multipliers

Benefit:

- events are modeled as a dedicated system
- `game-endless.js` consumes an event API instead of defining event behavior inline

## Role Of `game-endless.js`

`game-endless.js` remains the orchestration layer for:

- browser and canvas setup
- input handling
- world simulation
- generation flow
- rendering
- HUD drawing
- PWA UI behavior

Important direction:

- central domain rules no longer live only here
- new features can be placed into explicit named systems

## Core Reference Documents

The most relevant domain and architecture decisions are currently documented in:

- `docs/run-model.md`
- `docs/bug-lifecycle.md`
- `docs/event-model.md`
- `docs/pickup-model.md`
- `docs/placement-rules.md`
- `docs/generator-rules.md`
- `docs/respawn-fairness.md`
- `docs/simulation-core.md`
- `docs/debug-tools.md`
- `docs/asset-manifest.md`

Therefore:

- `architecture.md` focuses primarily on system boundaries
- each domain-specific doc defines rules, invariants, and extension points for its scope

## System Boundaries For Upcoming Work

Likely next candidates for additional separation:

- rendering and HUD system
- input system
- PWA install and update system

## Invariants

- domain rules should prefer named system files
- `game-endless.js` should orchestrate rather than duplicate rule definitions
- new gameplay mechanics should first map to an existing system or introduce a new explicit system
