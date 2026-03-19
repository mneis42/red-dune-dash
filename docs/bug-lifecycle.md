# Bug Lifecycle

This document defines the current bug lifecycle model and transition points for future backlog and reactivation mechanics.

## Goal

Bugs should not exist only as temporary world entities or as two loose counters. The game keeps an explicit lifecycle model that can distinguish meaningful state transitions.

This matters for:

- HUD semantics
- scoring and balance rules
- future backlog mechanics
- future event effects such as `refactoring`

## Current Status Values

- `active-world`
- `missed`
- `backlog`
- `resolved`
- `reactivated`

## Meaning Of Each Status

### `active-world`

The bug currently exists as an active world entity and can:

- hit the player
- be defeated
- later leave the active world area and be removed by cleanup

### `missed`

The bug was spawned during the run but was not resolved and is no longer present as an active world entity.

Today this mostly happens when a living bug leaves the active world range and cleanup removes the entity.

### `backlog`

Reserved future status for bugs that are explicitly moved into a gameplay backlog system.

The status is technically prepared but not yet part of normal gameplay.

### `resolved`

The bug was successfully resolved during the run, typically by defeating it.

### `reactivated`

Reserved future status for bugs made active again from backlog or other historical state.

The status is technically prepared but not yet part of normal gameplay.

## Current Transitions

Currently active transitions:

- spawn -> `active-world`
- `active-world` -> `resolved`
- `active-world` -> `missed`

Planned but not yet active:

- `missed` -> `backlog`
- `backlog` -> `reactivated`
- `reactivated` -> `resolved`

## Current Ledger

The game derives a bug ledger from lifecycle data with:

- `spawnedInRun`
- `resolvedInRun`
- `openInRun`
- `activeInWorld`
- `missedInRun`
- `backlog`
- `reactivatedInRun`

Important semantics:

- `openInRun` means unresolved bugs in the current run
- `openInRun` is not only "currently visible enemies"
- `openInRun` is not automatically the same as a future long-term backlog

## Design Rules For Future Features

### Backlog Gems

A future gem that revives old bugs should not resurrect removed world entities directly. It should operate on bug records with status `backlog` or `missed`.

### Refactoring Events

A `refactoring` event should primarily operate on lifecycle status, not only on currently visible world entities. This enables credible cleanup of multiple historical bugs.

### HUD Semantics

Until dedicated backlog gameplay exists, "Open Bugs" in the HUD refers to unresolved bugs in the current run. If a dedicated backlog is introduced later, it should be shown separately and explicitly.

## Invariants

- every world bug receives a stable lifecycle entry
- world entities are not the source of truth for bug history
- cleanup may remove world entities without losing lifecycle state
- `resolved` and `missed` remain in the ledger even after entities are gone
