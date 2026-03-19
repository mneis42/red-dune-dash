# Debug Tools

This document describes current debug and balancing tools for `Red Dune Dash`.

## Goal

Complex gameplay situations should be reproducible on demand without requiring long manual runs to reach specific event or resource states.

## Activation

Debug configuration is enabled through query parameters.

Example:

```text
?debug=1&debugEvent=big-order&debugPickup=score-boost&debugBacklog=5
```

If at least one debug override is provided, debug mode activates automatically.

## Available Query Parameters

- `debug=1`
  Explicitly enables debug mode.
- `debugPanel=0|1`
  Hides or shows the debug panel by default.
- `debugEvent=<type>`
  Forces a specific special event type for manual event starts, for example `big-order`.
- `debugEventDelayMs=<number>`
  Forces event wait time in milliseconds.
- `debugPickup=<type>`
  Forces a specific pickup type for automatic currency-related pickups where possible.
- `debugPickupSpawnMultiplier=<number>`
  Scales pickup-related spawn chances.
- `debugIncomeSpawnMultiplier=<number>`
  Scales spawn probability for income and coin sources.
- `debugBugSpawnMultiplier=<number>`
  Scales bug-related spawn chances and direct event spawn attempts.
- `debugRocketSpawnMultiplier=<number>`
  Scales rocket spawn rate.
- `debugBacklog=<number>`
  Prefills backlog records when starting a new run.
- `debugCurrencyCents=<number>`
  Start value for coin currency.
- `debugActionScore=<number>`
  Start value for action score.
- `debugProgressScore=<number>`
  Start value for progress score.
- `debugLives=<number>`
  Start value for lives.

## In-Game Hotkeys

- `F3`
  Toggle debug panel visibility.
- `F6`
  Execute the current special-event debug step:
  `idle -> announce -> active -> complete`.
- `F7`
  Spawn the configured debug pickup into the current scene.
- `F8`
  Add one additional backlog record.

## Visible Debug Panel

When debug mode is active, the panel includes:

- event configuration and current event phase
- spawn multipliers
- forced pickup type
- configured start values for resources and backlog
- current world counts for pickups, bugs, and rockets
- current run values for currency, open bugs, score, and balance

## Highscore Rule

Debug runs do not persist highscores to `localStorage`.

This prevents balancing or content tests from polluting normal progression highscores.
