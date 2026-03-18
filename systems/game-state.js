(function registerGameStateSystem(globalScope) {
  /**
   * Creates the mutable world state for one endless run.
   *
   * @returns {{spawn:{x:number,y:number},platforms:Array<object>,hazards:Array<object>,pickups:Array<object>,bugs:Array<object>,rockets:Array<object>,clouds:Array<object>,nextChunkX:number,lastGroundY:number}} Fresh level state.
   */
  function createLevelState() {
    return {
      spawn: { x: 120, y: 340 },
      platforms: [],
      hazards: [],
      pickups: [],
      bugs: [],
      rockets: [],
      clouds: [],
      nextChunkX: 0,
      lastGroundY: 452,
    };
  }

  /**
   * Creates the mutable player state for one run.
   *
   * @param {{x:number,y:number}} spawn - Current level spawn point.
   * @returns {{x:number,y:number,w:number,h:number,vx:number,vy:number,speed:number,maxSpeed:number,jumpPower:number,grounded:boolean,jumpsUsed:number,direction:number,lives:number,invincible:number,hurtTimer:number,pendingRespawn:boolean,forceInjuredPose:boolean,respawnVisual:string,checkpointX:number,checkpointY:number,visible:boolean}} Fresh player state.
   */
  function createPlayerState(spawn) {
    return {
      x: spawn.x,
      y: spawn.y,
      w: 54,
      h: 74,
      vx: 0,
      vy: 0,
      speed: 0.72,
      maxSpeed: 6.2,
      jumpPower: -13.5,
      grounded: false,
      // Tracks how many jumps have been used in the current airborne sequence.
      // Reset to 0 on landing. Capped at MAX_JUMPS to prevent triple/infinite jumps.
      jumpsUsed: 0,
      direction: 1,
      lives: 3,
      invincible: 0,
      hurtTimer: 0,
      pendingRespawn: false,
      forceInjuredPose: false,
      respawnVisual: "injured",
      checkpointX: spawn.x,
      checkpointY: spawn.y,
      visible: true,
    };
  }

  /**
   * Creates the cross-run scoring and resource state.
   *
   * @param {number} spawnX - Initial run x-position.
   * @returns {{currencyCents:number,actionScore:number,progressScore:number,farthestX:number}} Fresh run state.
   */
  function createRunState(spawnX) {
    return {
      currencyCents: 0,
      actionScore: 0,
      progressScore: 0,
      farthestX: spawnX,
    };
  }

  globalScope.RedDuneGameState = Object.freeze({
    createLevelState,
    createPlayerState,
    createRunState,
  });
})(typeof self !== "undefined" ? self : globalThis);
