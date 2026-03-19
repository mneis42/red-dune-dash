# Pickup Model

This document describes the current pickup system in `Red Dune Dash`.

## Goal

Pickups should not only be "visible gems with currency effect". Each pickup type should have an explicit gameplay definition with:

- spawn rules
- telegraphing
- render metadata
- gameplay effect
- HUD target for fly-to feedback

## Current Structure

Pickup logic lives in `systems/pickup-system.js`.

The system exposes two layers:

- `createPickupDefinitions(config)` for run-specific type definitions
- `createPickupSystem(definitions)` for runtime helpers that spawn, place, render, and apply effects

## Current Pickup Types

### `currency`

- can spawn on platforms
- uses safe pickup zones
- grants coin currency and action score
- sends HUD feedback to currency and score

### `extra-life`

- currently collected through rockets
- increases `player.lives`
- grants additional action score
- is modeled as a dedicated pickup effect, not as a collision-loop special case

### Prepared Extension Slots

The following definition slots are already prepared, even though their spawn logic is currently disabled:

- `backlog-revival`
- `score-boost`
- `temporary-shield`
- `event-trigger`

## Important Separation

A pickup entity is intentionally a lightweight runtime object. Gameplay meaning and effect live in its type definition, not in the entity itself.

This means:

- collisions only collect "pickup X of type Y"
- the gameplay effect is applied through `pickupSystem.applyEffect(...)`
- new pickup types do not require collision-loop special cases

## Future Feature Integration

### Backlog Pickups

A future pickup that revives old bugs should interact with the bug lifecycle model instead of resurrecting old world entities directly.

### Refactoring Or Event Pickups

An event-triggering pickup should not mutate rendering or generator logic directly. It should use explicit hooks into the event system.

## Invariants

- `level.pickups` contains only active runtime entities in the current run
- pickup types define their own effects
- spawn rules and effects may differ per pickup type
- new pickup families should be addable without copying current `currency` logic
