(function registerDebugTools(globalScope) {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toSearchParams(searchInput) {
    if (typeof URLSearchParams !== "undefined" && searchInput instanceof URLSearchParams) {
      return searchInput;
    }

    return new URLSearchParams(typeof searchInput === "string" ? searchInput : "");
  }

  function parseBooleanParam(params, key, defaultValue = false) {
    const raw = params.get(key);
    if (raw === null) {
      return defaultValue;
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
      return false;
    }

    return defaultValue;
  }

  function parseStringParam(params, key, defaultValue = null) {
    const raw = params.get(key);
    if (raw === null) {
      return defaultValue;
    }

    const value = raw.trim();
    return value === "" ? defaultValue : value;
  }

  function parseNumberParam(params, key, options = {}) {
    const {
      min = -Infinity,
      max = Infinity,
      integer = false,
      defaultValue = null,
    } = options;
    const raw = params.get(key);
    if (raw === null) {
      return defaultValue;
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return defaultValue;
    }

    const normalizedValue = integer ? Math.round(value) : value;
    return clamp(normalizedValue, min, max);
  }

  function hasDebugOverrides(params) {
    return [
      "debugEvent",
      "debugEventDelayMs",
      "debugPickup",
      "debugPickupSpawnMultiplier",
      "debugIncomeSpawnMultiplier",
      "debugBugSpawnMultiplier",
      "debugRocketSpawnMultiplier",
      "debugBacklog",
      "debugCurrencyCents",
      "debugActionScore",
      "debugProgressScore",
      "debugLives",
    ].some((key) => params.has(key));
  }

  /**
   * Creates the normalized debug and balancing configuration from query parameters.
   *
   * @param {string|URLSearchParams} [searchInput=""] - Query string such as "?debug=1&debugEvent=big-order".
   * @returns {{enabled:boolean,showPanel:boolean,specialEvent:{forceType:string|null,delayMs:number|null},pickups:{forcedType:string|null,spawnMultiplier:number},spawns:{incomeMultiplier:number,bugMultiplier:number,rocketMultiplier:number},initialRun:{backlog:number,currencyCents:number,actionScore:number,progressScore:number,lives:number}}} Parsed debug configuration.
   */
  function createDebugConfig(searchInput = "") {
    const params = toSearchParams(searchInput);
    const enabled = parseBooleanParam(params, "debug", hasDebugOverrides(params));

    return Object.freeze({
      enabled,
      showPanel: enabled && parseBooleanParam(params, "debugPanel", enabled),
      specialEvent: Object.freeze({
        forceType: parseStringParam(params, "debugEvent"),
        delayMs: parseNumberParam(params, "debugEventDelayMs", {
          min: 0,
          max: 3_600_000,
          integer: true,
          defaultValue: null,
        }),
      }),
      pickups: Object.freeze({
        forcedType: parseStringParam(params, "debugPickup"),
        spawnMultiplier: parseNumberParam(params, "debugPickupSpawnMultiplier", {
          min: 0,
          max: 10,
          defaultValue: 1,
        }),
      }),
      spawns: Object.freeze({
        incomeMultiplier: parseNumberParam(params, "debugIncomeSpawnMultiplier", {
          min: 0,
          max: 10,
          defaultValue: 1,
        }),
        bugMultiplier: parseNumberParam(params, "debugBugSpawnMultiplier", {
          min: 0,
          max: 10,
          defaultValue: 1,
        }),
        rocketMultiplier: parseNumberParam(params, "debugRocketSpawnMultiplier", {
          min: 0.1,
          max: 10,
          defaultValue: 1,
        }),
      }),
      initialRun: Object.freeze({
        backlog: parseNumberParam(params, "debugBacklog", {
          min: 0,
          max: 500,
          integer: true,
          defaultValue: 0,
        }),
        currencyCents: parseNumberParam(params, "debugCurrencyCents", {
          min: 0,
          max: 999_999,
          integer: true,
          defaultValue: 0,
        }),
        actionScore: parseNumberParam(params, "debugActionScore", {
          min: 0,
          max: 999_999,
          integer: true,
          defaultValue: 0,
        }),
        progressScore: parseNumberParam(params, "debugProgressScore", {
          min: 0,
          max: 999_999,
          integer: true,
          defaultValue: 0,
        }),
        lives: parseNumberParam(params, "debugLives", {
          min: 1,
          max: 99,
          integer: true,
          defaultValue: 3,
        }),
      }),
    });
  }

  /**
   * Scales a spawn chance while keeping the result in the valid 0..1 range.
   *
   * @param {number} baseChance - Baseline probability.
   * @param {number} [multiplier=1] - Debug multiplier where values above 1 make spawns more likely.
   * @returns {number} Adjusted probability.
   */
  function scaleChance(baseChance, multiplier = 1) {
    const normalizedChance = clamp(Number.isFinite(baseChance) ? baseChance : 0, 0, 1);
    const normalizedMultiplier = clamp(Number.isFinite(multiplier) ? multiplier : 1, 0, 10);

    if (normalizedChance === 0 || normalizedMultiplier === 0) {
      return 0;
    }
    if (normalizedChance === 1) {
      return 1;
    }

    return 1 - Math.pow(1 - normalizedChance, normalizedMultiplier);
  }

  /**
   * Scales a delay by a debug multiplier while respecting a minimum delay floor.
   *
   * @param {number} delayMs - Baseline delay in milliseconds.
   * @param {number} [multiplier=1] - Multiplier where values above 1 make the delay shorter.
   * @param {number} [minDelay=0] - Minimum resulting delay.
   * @returns {number} Adjusted delay.
   */
  function scaleDelay(delayMs, multiplier = 1, minDelay = 0) {
    const normalizedDelay = Math.max(0, Number.isFinite(delayMs) ? delayMs : 0);
    const normalizedMultiplier = clamp(Number.isFinite(multiplier) ? multiplier : 1, 0.01, 10);
    const normalizedMinDelay = Math.max(0, Number.isFinite(minDelay) ? minDelay : 0);
    return Math.max(normalizedMinDelay, Math.round(normalizedDelay / normalizedMultiplier));
  }

  /**
   * Converts a spawn multiplier into a concrete number of attempts for direct debug spawns.
   *
   * @param {number} [multiplier=1] - Requested multiplier where 0 disables and values above 1 may add extra attempts.
   * @param {number} [randomValue=Math.random()] - Optional deterministic random value for tests.
   * @returns {number} Number of spawn attempts to execute.
   */
  function getSpawnIterations(multiplier = 1, randomValue = Math.random()) {
    const normalizedMultiplier = clamp(Number.isFinite(multiplier) ? multiplier : 1, 0, 10);
    const fullIterations = Math.floor(normalizedMultiplier);
    const fractionalIterationChance = normalizedMultiplier - fullIterations;
    return fullIterations + (randomValue < fractionalIterationChance ? 1 : 0);
  }

  globalScope.RedDuneDebugTools = Object.freeze({
    createDebugConfig,
    scaleChance,
    scaleDelay,
    getSpawnIterations,
  });
})(typeof self !== "undefined" ? self : globalThis);
