(function registerPlacementSystem(globalScope) {
  const defaultPlacementSafetyConfig = Object.freeze({
    platformEdgePadding: 28,
    gemMinimumZoneWidth: 36,
    embeddedHazardLaneTolerance: 4,
    groundHazardLaneTolerance: 36,
    bugLaneTolerance: 24,
    collectibleHazardPadding: 24,
    checkpointHazardPadding: 24,
    hurtHazardPadding: 24,
    hurtBugPadding: 18,
  });

  /**
   * Creates the shared placement and safe-zone rule helpers.
   *
   * @param {Partial<typeof defaultPlacementSafetyConfig>} [overrides={}] - Optional rule overrides.
   * @returns {{config:object,spansOverlap:Function,getPlatformPlacementRange:Function,subtractBlockedInterval:Function,createBlockedPlacementInterval:Function,isHazardOnPickupLane:Function,isHazardOnPlayerLane:Function,isBugOnPlayerLane:Function,getPlatformSafeZones:Function,pickNearestSafeZoneX:Function}} Placement system.
   */
  function createPlacementSystem(overrides = {}) {
    const config = Object.freeze({ ...defaultPlacementSafetyConfig, ...overrides });

    function spansOverlap(startA, endA, startB, endB) {
      return startA < endB && endA > startB;
    }

    function getPlatformPlacementRange(platform, occupantWidth = 0, edgePadding = config.platformEdgePadding) {
      const start = platform.x + edgePadding;
      const end = platform.x + platform.w - occupantWidth - edgePadding;
      if (end < start) {
        return null;
      }

      return { start, end };
    }

    function subtractBlockedInterval(zones, blockedInterval) {
      const nextZones = [];

      zones.forEach((zone) => {
        if (!spansOverlap(zone.start, zone.end, blockedInterval.start, blockedInterval.end)) {
          nextZones.push(zone);
          return;
        }

        if (blockedInterval.start > zone.start) {
          nextZones.push({ start: zone.start, end: blockedInterval.start });
        }
        if (blockedInterval.end < zone.end) {
          nextZones.push({ start: blockedInterval.end, end: zone.end });
        }
      });

      return nextZones;
    }

    function createBlockedPlacementInterval(blockerX, blockerWidth, occupantWidth = 0, padding = 0) {
      return {
        start: blockerX - occupantWidth - padding,
        end: blockerX + blockerWidth + padding,
      };
    }

    function isHazardOnPickupLane(hazard, platform) {
      return (
        Math.abs(hazard.y - platform.y) < config.embeddedHazardLaneTolerance &&
        spansOverlap(hazard.x, hazard.x + hazard.w, platform.x, platform.x + platform.w)
      );
    }

    function isHazardOnPlayerLane(hazard, platform) {
      return (
        Math.abs(hazard.y + hazard.h - platform.y) < config.groundHazardLaneTolerance &&
        spansOverlap(hazard.x, hazard.x + hazard.w, platform.x, platform.x + platform.w)
      );
    }

    function isBugOnPlayerLane(bug, platform) {
      return (
        bug.alive &&
        Math.abs(bug.y + bug.h - platform.y) < config.bugLaneTolerance &&
        spansOverlap(bug.x, bug.x + bug.w, platform.x, platform.x + platform.w)
      );
    }

    function getPlatformSafeZones(platform, options = {}) {
      const {
        occupantWidth = 0,
        edgePadding = config.platformEdgePadding,
        minimumZoneWidth = 0,
        blockedIntervals = [],
      } = options;
      const placementRange = getPlatformPlacementRange(platform, occupantWidth, edgePadding);
      if (!placementRange) {
        return [];
      }

      let safeZones = [placementRange];
      blockedIntervals.forEach((blockedInterval) => {
        safeZones = subtractBlockedInterval(safeZones, blockedInterval);
      });

      return safeZones
        .map((zone) => ({
          start: Math.max(placementRange.start, Math.min(zone.start, placementRange.end)),
          end: Math.max(placementRange.start, Math.min(zone.end, placementRange.end)),
        }))
        .filter((zone) => zone.end >= zone.start && zone.end - zone.start >= minimumZoneWidth);
    }

    function pickNearestSafeZoneX(safeZones, preferredX) {
      if (safeZones.length === 0) {
        return null;
      }

      let bestCandidate = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      safeZones.forEach((zone) => {
        const candidate = Math.max(zone.start, Math.min(preferredX, zone.end));
        const distance = Math.abs(candidate - preferredX);
        if (distance < bestDistance) {
          bestCandidate = candidate;
          bestDistance = distance;
        }
      });

      return bestCandidate;
    }

    return {
      config,
      spansOverlap,
      getPlatformPlacementRange,
      subtractBlockedInterval,
      createBlockedPlacementInterval,
      isHazardOnPickupLane,
      isHazardOnPlayerLane,
      isBugOnPlayerLane,
      getPlatformSafeZones,
      pickNearestSafeZoneX,
    };
  }

  globalScope.RedDunePlacement = Object.freeze({
    defaultPlacementSafetyConfig,
    createPlacementSystem,
  });
})(typeof self !== "undefined" ? self : globalThis);
