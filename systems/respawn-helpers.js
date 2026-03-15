(function registerRespawnHelpers(globalScope) {
  /**
   * Creates shared helpers for checkpoint and hurt-pose placement.
   *
   * These helpers are browserfrei und arbeiten nur auf den uebergebenen Level-/Player-Objekten
   * sowie dem Placement-System, damit sie sowohl im Browser als auch in Node-Tests genutzt
   * werden koennen.
   *
   * @param {object} options - Respawn dependencies.
   * @param {{platforms:Array<object>, hazards:Array<object>, bugs:Array<object>}} options.level - Mutable level state.
   * @param {{w:number,h:number,checkpointX:number,checkpointY:number}} options.player - Player state (Breite, Hoehe, Checkpoint).
   * @param {object} options.placementSystem - Placement helpers (isHazardOnPlayerLane, isBugOnPlayerLane, getPlatformSafeZones etc.).
   * @param {object} options.placementSafetyConfig - Placement safety config (checkpointHazardPadding, hurtHazardPadding, hurtBugPadding).
   * @param {Function} options.getHazardState - Hazard-Zustandshelfer `(hazard) => { active, top, baseY, height }`.
   * @returns {{
   *   hitsHazardWithPlayerCenter:Function,
   *   getSafeCheckpointX:Function,
   *   getSupportingPlatformAt:Function,
   *   getSafePlatformPoseX:Function,
   *   moveToSafeInjuredPose:Function,
   * }} Respawn helpers.
   */
  function createRespawnHelpers(options) {
    const { level, player, placementSystem, placementSafetyConfig, getHazardState } = options;

    function hitsHazardWithPlayerCenter(hazard) {
      const hazardState = getHazardState(hazard);
      if (!hazardState.active || hazardState.height <= 0) {
        return false;
      }

      const centerBandRadius = 15;
      const playerCenterX = player.x + player.w / 2;
      const centerBandLeft = playerCenterX - centerBandRadius;
      const centerBandRight = playerCenterX + centerBandRadius;
      const overlapsVertically = player.y < hazardState.baseY && player.y + player.h > hazardState.top;
      return (
        overlapsVertically &&
        centerBandRight >= hazard.x &&
        centerBandLeft <= hazard.x + hazard.w
      );
    }

    function getSafeCheckpointX(platform) {
      const safeZones = placementSystem.getPlatformSafeZones(platform, {
        occupantWidth: player.w,
        blockedIntervals: level.hazards
          .filter((hazard) => placementSystem.isHazardOnPlayerLane(hazard, platform))
          .map((hazard) =>
            placementSystem.createBlockedPlacementInterval(
              hazard.x,
              hazard.w,
              player.w,
              placementSafetyConfig.checkpointHazardPadding
            )
          ),
      });
      const safeX = placementSystem.pickNearestSafeZoneX(safeZones, player.x);
      if (safeX === null) {
        const placementRange = placementSystem.getPlatformPlacementRange(platform, player.w);
        return placementRange ? placementRange.start : platform.x;
      }

      return safeX;
    }

    function getSupportingPlatformAt(playerX, preferredY) {
      const supportingPlatforms = level.platforms.filter((platform) => {
        const overlapsX = playerX + player.w > platform.x && playerX < platform.x + platform.w;
        return overlapsX;
      });

      if (supportingPlatforms.length === 0) {
        return null;
      }

      const playerFeetY = preferredY + player.h;
      const platformsBelow = supportingPlatforms.filter((platform) => platform.y >= playerFeetY - 8);
      const candidatePlatforms = platformsBelow.length > 0 ? platformsBelow : supportingPlatforms;
      candidatePlatforms.sort((a, b) => a.y - b.y);
      return candidatePlatforms[0];
    }

    function getSafePlatformPoseX(platform, preferredX) {
      const blockedIntervals = [
        ...level.hazards
          .filter((hazard) => placementSystem.isHazardOnPlayerLane(hazard, platform))
          .map((hazard) =>
            placementSystem.createBlockedPlacementInterval(
              hazard.x,
              hazard.w,
              player.w,
              placementSafetyConfig.hurtHazardPadding
            )
          ),
        ...level.bugs
          .filter((bug) => placementSystem.isBugOnPlayerLane(bug, platform))
          .map((bug) =>
            placementSystem.createBlockedPlacementInterval(
              bug.x,
              bug.w,
              player.w,
              placementSafetyConfig.hurtBugPadding
            )
          ),
      ];
      const safeZones = placementSystem.getPlatformSafeZones(platform, {
        occupantWidth: player.w,
        blockedIntervals,
      });
      const safeX = placementSystem.pickNearestSafeZoneX(safeZones, preferredX);
      if (safeX === null) {
        const placementRange = placementSystem.getPlatformPlacementRange(platform, player.w);
        return placementRange ? placementRange.start : platform.x;
      }

      return safeX;
    }

    function moveToSafeInjuredPose(preferredX, preferredY) {
      const clampedX = Math.max(0, preferredX);
      const platform = getSupportingPlatformAt(clampedX, preferredY);
      if (platform === null) {
        return {
          x: player.checkpointX,
          y: player.checkpointY,
        };
      }

      return {
        x: getSafePlatformPoseX(platform, clampedX),
        y: platform.y - player.h,
      };
    }

    return {
      hitsHazardWithPlayerCenter,
      getSafeCheckpointX,
      getSupportingPlatformAt,
      getSafePlatformPoseX,
      moveToSafeInjuredPose,
    };
  }

  globalScope.RedDuneRespawnHelpers = Object.freeze({
    createRespawnHelpers,
  });
})(typeof self !== "undefined" ? self : globalThis);
