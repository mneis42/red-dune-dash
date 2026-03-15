(function registerGeneratorHelpers(globalScope) {
  /**
   * Creates shared generator helpers for optional chunk features, fair placement and rollback.
   *
   * These helpers are intentionally browserfrei und arbeiten nur auf den übergebenen Level-/Bug-/Player-Objekten,
   * damit sie sowohl im Browser als auch in Node-Tests genutzt werden können.
   *
   * @param {object} options - Generator dependencies.
   * @param {{platforms: Array<object>, hazards: Array<object>, pickups: Array<object>, bugs: Array<object>}} options.level - Mutable level state of the current run.
   * @param {{state:{nextId:number,records:Map<number,{id:number,status:string}>}}} options.bugLifecycleSystem - Bug lifecycle system used for this run.
   * @param {{h:number}} options.player - Player state (only height is required for clearance checks).
   * @param {Function} options.randomInt - Random integer helper `(min, max) => number`.
   * @param {Function} options.randomBetween - Random float helper `(min, max) => number`.
   * @param {Function} options.clamp - Clamp helper `(value, min, max) => number`.
   * @param {Function} options.createPlatform - Factory for platform objects `(x, y, w, h, kind) => object`.
   * @param {Function} options.addGemOnPlatform - Callback to optionally decorate a helper platform with a gem.
   * @param {Function} options.addBugOnPlatform - Callback to optionally decorate a helper platform with a bug.
   * @returns {{removeHazardsUnderSpan:Function,createChunkFeatureSnapshot:Function,restoreChunkFeatureSnapshot:Function,commitChunkFeatureAttempt:Function,ensureStepPlatform:Function,hasReachableApproach:Function,platformCollides:Function,isTooCloseToGround:Function}}
   */
  function createGeneratorHelpers(options) {
    const {
      level,
      bugLifecycleSystem,
      player,
      randomInt,
      randomBetween,
      clamp,
      createPlatform,
      addGemOnPlatform,
      addBugOnPlatform,
    } = options;

    const bugLifecycle = bugLifecycleSystem.state;

    /**
     * Removes floor hazards that overlap a horizontal span.
     *
     * @param {number} startX - Start of the span.
     * @param {number} endX - End of the span.
     */
    function removeHazardsUnderSpan(startX, endX) {
      level.hazards = level.hazards.filter((hazard) => hazard.x + hazard.w <= startX || hazard.x >= endX);
    }

    /**
     * Captures the mutable generation state that optional chunk features may change.
     *
     * @returns {{platformCount:number, hazards:Array<object>, pickupCount:number, bugCount:number, bugLifecycleNextId:number}} Snapshot.
     */
    function createChunkFeatureSnapshot() {
      return {
        platformCount: level.platforms.length,
        hazards: [...level.hazards],
        pickupCount: level.pickups.length,
        bugCount: level.bugs.length,
        bugLifecycleNextId: bugLifecycle.nextId,
      };
    }

    /**
     * Restores the mutable generation state after a failed optional chunk feature attempt.
     *
     * @param {{platformCount:number, hazards:Array<object>, pickupCount:number, bugCount:number, bugLifecycleNextId:number}} snapshot - State to restore.
     */
    function restoreChunkFeatureSnapshot(snapshot) {
      level.platforms.length = snapshot.platformCount;
      level.hazards = snapshot.hazards;
      level.pickups.length = snapshot.pickupCount;
      level.bugs.length = snapshot.bugCount;
      bugLifecycle.records.forEach((record, bugId) => {
        if (bugId >= snapshot.bugLifecycleNextId) {
          bugLifecycle.records.delete(bugId);
        }
      });
      bugLifecycle.nextId = snapshot.bugLifecycleNextId;
    }

    /**
     * Runs an optional chunk feature and rolls back all intermediate generation side effects when it fails.
     *
     * @param {() => boolean} attemptFeature - Returns true when the optional feature should be kept.
     * @returns {boolean} True when the feature was committed.
     */
    function commitChunkFeatureAttempt(attemptFeature) {
      const snapshot = createChunkFeatureSnapshot();
      if (attemptFeature()) {
        return true;
      }

      restoreChunkFeatureSnapshot(snapshot);
      return false;
    }

    /**
     * Checks whether a generated platform overlaps existing platforms with optional padding.
     *
     * @param {{x:number, y:number, w:number, h:number}} candidate - Platform candidate.
     * @param {number} [padding=18] - Extra spacing around both platforms.
     * @returns {boolean} True when a collision is detected.
     */
    function platformCollides(candidate, padding = 18) {
      return level.platforms.some((platform) => {
        return !(
          candidate.x + candidate.w + padding <= platform.x ||
          candidate.x >= platform.x + platform.w + padding ||
          candidate.y + candidate.h + padding <= platform.y ||
          candidate.y >= platform.y + platform.h + padding
        );
      });
    }

    /**
     * Checks whether an elevated platform leaves enough clearance to move underneath it.
     *
     * @param {{y:number, h:number}} platform - Platform to inspect.
     * @param {number} groundY - Ground y-position.
     * @returns {boolean} True when the underpass would be too tight for the player.
     */
    function isTooCloseToGround(platform, groundY) {
      const clearance = groundY - (platform.y + platform.h);
      return clearance < player.h + 10;
    }

    /**
     * Adds an intermediate helper platform when a generated platform would otherwise be too high.
     *
     * @param {{x:number, y:number, w:number, h:number, kind:string}} targetPlatform - Platform that needs support.
     * @param {number} groundY - Ground y-position of the current chunk.
     * @returns {boolean} True when a reachable setup exists after processing.
     */
    function ensureStepPlatform(targetPlatform, groundY) {
      const heightDelta = groundY - targetPlatform.y;
      if (heightDelta <= 124) {
        return true;
      }

      const stepWidth = clamp(Math.floor(targetPlatform.w * 0.7), 88, 130);
      const stepHeight = 18;
      const stepY = clamp(targetPlatform.y + 58, groundY - 112, groundY - 72);
      const desiredX = targetPlatform.x - randomInt(74, 120);
      const stepX = Math.max(level.nextChunkX + 10, desiredX);
      const step = createPlatform(stepX, stepY, stepWidth, stepHeight, "plate");

      if (platformCollides(step, 8)) {
        return false;
      }

      level.platforms.push(step);
      if (randomBetween(0, 1) < 0.55) {
        addGemOnPlatform(step);
      }
      if (randomBetween(0, 1) < 0.18) {
        addBugOnPlatform(step);
      }
      return true;
    }

    /**
     * Checks whether a platform has at least one plausible approach from nearby support geometry.
     *
     * @param {{x:number, y:number, w:number, h:number, kind:string}} targetPlatform - Platform to validate.
     * @param {{x:number, y:number, w:number, h:number, kind:string}} ground - Ground platform in the same chunk.
     * @returns {boolean} True when the platform can be approached.
     */
    function hasReachableApproach(targetPlatform, ground) {
      const supports = level.platforms.filter((platform) => {
        if (platform.x + platform.w < targetPlatform.x - 150) {
          return false;
        }
        if (platform.x > targetPlatform.x + targetPlatform.w + 40) {
          return false;
        }
        return platform.y > targetPlatform.y;
      });

      const supportPool = [...supports, ground];
      return supportPool.some((platform) => {
        const verticalGain = platform.y - targetPlatform.y;
        const horizontalGap = targetPlatform.x - (platform.x + platform.w);
        return verticalGain <= 126 && horizontalGap <= 138;
      });
    }

    return {
      removeHazardsUnderSpan,
      createChunkFeatureSnapshot,
      restoreChunkFeatureSnapshot,
      commitChunkFeatureAttempt,
      ensureStepPlatform,
      hasReachableApproach,
      platformCollides,
      isTooCloseToGround,
    };
  }

  globalScope.RedDuneGeneratorHelpers = Object.freeze({
    createGeneratorHelpers,
  });
})(typeof self !== "undefined" ? self : globalThis);
