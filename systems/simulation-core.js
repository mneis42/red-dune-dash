(function registerSimulationCore(globalScope) {
  /**
   * Clamps a numeric value into a closed interval.
   *
   * @param {number} value - Value to clamp.
   * @param {number} min - Lower bound.
   * @param {number} max - Upper bound.
   * @returns {number} Clamped value.
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Calculates the current euro-per-hour value from run duration and collected currency.
   *
   * @param {number} currencyCents - Collected currency in cents.
   * @param {number} worldTimeMs - Elapsed run time in milliseconds.
   * @returns {number} Rounded euros per hour.
   */
  function calculateEuroRatePerHour(currencyCents, worldTimeMs) {
    if (worldTimeMs <= 0 || currencyCents <= 0) {
      return 0;
    }

    return Math.round((currencyCents * 3_600_000) / worldTimeMs / 100);
  }

  /**
   * Calculates the bug-side balance multiplier from unresolved bug pressure.
   *
   * @param {number} outstandingBugs - Count of unresolved bugs in the current run.
   * @returns {number} Bug-side balance multiplier.
   */
  function calculateBugBalanceMultiplier(outstandingBugs) {
    if (outstandingBugs <= 0) {
      return 1.35;
    }
    if (outstandingBugs <= 2) {
      return 1.15;
    }
    if (outstandingBugs <= 4) {
      return 1;
    }
    if (outstandingBugs <= 6) {
      return 0.8;
    }
    return 0.6;
  }

  /**
   * Calculates the income-side balance multiplier from the current euro rate.
   *
   * @param {number} euroRatePerHour - Current euro-per-hour value.
   * @returns {number} Income-side balance multiplier.
   */
  function calculateIncomeBalanceMultiplier(euroRatePerHour) {
    if (euroRatePerHour >= 90) {
      return 1.25;
    }
    if (euroRatePerHour >= 60) {
      return 1.1;
    }
    if (euroRatePerHour >= 30) {
      return 1;
    }
    if (euroRatePerHour >= 15) {
      return 0.9;
    }
    return 0.75;
  }

  /**
   * Calculates the overall run balance multiplier from bug pressure and income momentum.
   *
   * @param {object} input - Balance input values.
   * @param {number} input.outstandingBugs - Count of unresolved bugs.
   * @param {number} input.euroRatePerHour - Current euro-per-hour value.
   * @returns {number} Combined run balance multiplier.
   */
  function calculateRunBalanceMultiplier(input) {
    return (
      calculateBugBalanceMultiplier(input.outstandingBugs) +
      calculateIncomeBalanceMultiplier(input.euroRatePerHour)
    ) / 2;
  }

  /**
   * Calculates the current progress-score target from distance and balance.
   *
   * @param {object} input - Progress score inputs.
   * @param {number} input.farthestX - Farthest reached x-position in the run.
   * @param {number} input.spawnX - Run spawn x-position.
   * @param {number} input.distanceDivisor - Distance-to-score divisor.
   * @param {number} input.runBalanceMultiplier - Current run balance multiplier.
   * @returns {number} Current progress-score target.
   */
  function calculateProgressScoreTarget(input) {
    const baseDistanceScore = Math.floor(Math.max(0, input.farthestX - input.spawnX) / input.distanceDivisor);
    return Math.floor(baseDistanceScore * input.runBalanceMultiplier);
  }

  /**
   * Locks in monotonic progress score so forward progress never reduces already-earned progress points.
   *
   * @param {number} currentProgressScore - Previously stored progress score.
   * @param {number} progressTarget - Current live progress target.
   * @returns {number} Monotonic progress score.
   */
  function lockProgressScore(currentProgressScore, progressTarget) {
    return Math.max(currentProgressScore, progressTarget);
  }

  /**
   * Creates the public score breakdown from stored action and progress score.
   *
   * @param {number} actionScore - Additive action score.
   * @param {number} progressScore - Locked progress score.
   * @returns {{action:number,progress:number,total:number}} Score breakdown.
   */
  function calculateScoreBreakdown(actionScore, progressScore) {
    return {
      action: actionScore,
      progress: progressScore,
      total: actionScore + progressScore,
    };
  }

  /**
   * Calculates the income-source spawn multiplier from unresolved bug pressure.
   *
   * @param {number} outstandingBugs - Count of unresolved bugs.
   * @returns {number} Spawn multiplier in the range 0.18..1.
   */
  function calculateIncomeSourceSpawnMultiplier(outstandingBugs) {
    return clamp(1 - outstandingBugs * 0.08, 0.18, 1);
  }

  /**
   * Decides whether an income source should spawn using an injectable random sampler.
   *
   * @param {object} input - Spawn decision inputs.
   * @param {number} input.baseChance - Baseline spawn chance before pressure is applied.
   * @param {number} input.outstandingBugs - Count of unresolved bugs.
   * @param {number} input.randomValue - Random float in the range 0..1.
   * @returns {boolean} True when the income source should spawn.
   */
  function shouldSpawnIncomeSource(input) {
    const threshold = clamp(
      input.baseChance * calculateIncomeSourceSpawnMultiplier(input.outstandingBugs),
      0,
      1
    );
    return input.randomValue < threshold;
  }

  /**
   * Creates a deterministic pseudo-random number generator.
   *
   * @param {number} seed - Unsigned integer seed.
   * @returns {() => number} Function returning floats in the range 0..1.
   */
  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Creates a deterministic random sampler from a finite sequence of float values.
   *
   * @param {number[]} values - Sequence of values in the range 0..1.
   * @param {number} [fallback=0] - Value returned once the sequence is exhausted.
   * @returns {() => number} Function returning the next configured value.
   */
  function createSequenceRandom(values, fallback = 0) {
    const queue = [...values];
    return () => (queue.length > 0 ? queue.shift() : fallback);
  }

  globalScope.RedDuneSimulationCore = Object.freeze({
    clamp,
    calculateEuroRatePerHour,
    calculateBugBalanceMultiplier,
    calculateIncomeBalanceMultiplier,
    calculateRunBalanceMultiplier,
    calculateProgressScoreTarget,
    lockProgressScore,
    calculateScoreBreakdown,
    calculateIncomeSourceSpawnMultiplier,
    shouldSpawnIncomeSource,
    createSeededRandom,
    createSequenceRandom,
  });
})(typeof self !== "undefined" ? self : globalThis);
