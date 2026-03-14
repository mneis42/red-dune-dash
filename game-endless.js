const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
const activeTouchControls = new Map();
const hudEffects = [];
let jumpButtonGlow = 0;
let activeHudInfo = null;
let statusMessage = "Bereit für den Start";
let orientationLocked = false;
let deferredInstallPrompt = null;
let showInstallHelp = false;
let installButtonRect = null;
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Ignore registration failures in unsupported/local preview environments.
    });
  });
}

function syncCanvasOnlyMode() {
  document.body.classList.add("canvas-only");
}

function shouldShowInstallPrompt() {
  return isTouchDevice && !isStandalone;
}

function isIosInstallFallback() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  showInstallHelp = false;
  installButtonRect = null;
});

const mobileHud = {
  topBar: { x: 18, y: 18, w: 924, h: 74 },
  leftPad: { cx: 94, cy: 462, r: 58 },
  rightPad: { cx: 232, cy: 462, r: 58 },
  jumpPad: { cx: 850, cy: 450, r: 72 },
};

const STORAGE_KEY = "marsTigerHighscore";

const spriteSources = {
  run: ["assets/run1.png", "assets/run2.png", "assets/run3.png", "assets/run4.png", "assets/run5.png", "assets/run6.png"],
  standing: "assets/standing.png",
  jumpUp: "assets/jump-up.png",
  jumpDown: "assets/jump-down.png",
  bug: "assets/bug.png",
  gameOver: "assets/game-over.png",
  rocketFromLeft: "assets/rocket-from-left.png",
  rocketFromRight: "assets/rocket-from-right.png",
};

const sprites = {
  run: spriteSources.run.map((src) => {
    const image = new Image();
    image.src = src;
    return image;
  }),
  standing: new Image(),
  jumpUp: new Image(),
  jumpDown: new Image(),
  bug: new Image(),
  gameOver: new Image(),
  rocketFromLeft: new Image(),
  rocketFromRight: new Image(),
};

sprites.standing.src = spriteSources.standing;
sprites.jumpUp.src = spriteSources.jumpUp;
sprites.jumpDown.src = spriteSources.jumpDown;
sprites.bug.src = spriteSources.bug;
sprites.gameOver.src = spriteSources.gameOver;
sprites.rocketFromLeft.src = spriteSources.rocketFromLeft;
sprites.rocketFromRight.src = spriteSources.rocketFromRight;

const world = {
  gravity: 0.68,
  floorYMin: 414,
  floorYMax: 474,
};

const keys = {
  left: false,
  right: false,
};

const level = {
  spawn: { x: 120, y: 340 },
  platforms: [],
  hazards: [],
  gems: [],
  bugs: [],
  rockets: [],
  clouds: [],
  nextChunkX: 0,
  lastGroundY: 452,
};

const player = {
  x: level.spawn.x,
  y: level.spawn.y,
  w: 54,
  h: 74,
  vx: 0,
  vy: 0,
  speed: 0.72,
  maxSpeed: 6.2,
  jumpPower: -13.5,
  grounded: false,
  direction: 1,
  lives: 3,
  gems: 0,
  score: 0,
  invincible: 0,
  farthestX: level.spawn.x,
  checkpointX: level.spawn.x,
  checkpointY: level.spawn.y,
  visible: true,
};

let highScore = loadHighScore();
let cameraX = 0;
let gameState = "ready";
let lastTime = 0;
let runFrameIndex = 0;
let runFrameTimer = 0;
let rocketSpawnTimer = 0;

function loadHighScore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score) {
  highScore = Math.max(highScore, score);
  try {
    window.localStorage.setItem(STORAGE_KEY, String(highScore));
  } catch {
    // Ignore localStorage failures.
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isPortraitMobileView() {
  return isTouchDevice && window.innerHeight > window.innerWidth;
}

async function requestLandscapeLock() {
  if (!isTouchDevice || orientationLocked) {
    return;
  }

  try {
    if (!document.fullscreenElement && canvas.requestFullscreen) {
      await canvas.requestFullscreen();
    }
  } catch {
    // Ignore fullscreen failures on browsers that require stricter gestures.
  }

  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock("landscape");
      orientationLocked = true;
    }
  } catch {
    // Ignore unsupported orientation lock errors.
  }
}

window.addEventListener("resize", syncCanvasOnlyMode);
window.addEventListener("orientationchange", syncCanvasOnlyMode);

function getTotalScore() {
  return player.score + Math.floor(Math.max(0, player.farthestX - level.spawn.x) / 12);
}

function syncHighScore() {
  const total = getTotalScore();
  if (total > highScore) {
    saveHighScore(total);
  }
}

function updateTouchInputState() {
  let leftPressed = false;
  let rightPressed = false;

  activeTouchControls.forEach((action) => {
    if (action === "left") {
      leftPressed = true;
    }
    if (action === "right") {
      rightPressed = true;
    }
  });

  keys.left = leftPressed;
  keys.right = rightPressed;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function pointInCircle(point, circle) {
  const dx = point.x - circle.cx;
  const dy = point.y - circle.cy;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function getTouchAction(point) {
  if (!point) {
    return null;
  }

  if (pointInCircle(point, mobileHud.leftPad)) {
    return "left";
  }
  if (pointInCircle(point, mobileHud.rightPad)) {
    return "right";
  }
  if (pointInCircle(point, mobileHud.jumpPad)) {
    return "jump";
  }
  return "tap";
}

function createPlatform(x, y, w, h, kind) {
  return { x, y, w, h, kind };
}

function createBug(x, y, minX, maxX, speed) {
  return { x, y, w: 46, h: 38, minX, maxX, vx: speed, alive: true };
}

function createRocket(fromLeft) {
  const w = 110;
  const h = 44;
  const y = randomInt(70, 170);
  const x = fromLeft ? cameraX - w - 80 : cameraX + canvas.width + 80;
  const vx = fromLeft ? randomBetween(3.6, 4.8) : -randomBetween(3.6, 4.8);
  return { x, y, w, h, vx, fromLeft, active: true };
}

function createCloud(x) {
  return {
    x,
    y: randomInt(50, 190),
    w: randomInt(90, 170),
    h: randomInt(28, 52),
    vx: randomBetween(0.12, 0.32),
    puff: randomBetween(0.85, 1.2),
  };
}

function createHitEffect(x, y, emoji) {
  return { x, y, emoji };
}

function getHudStats() {
  return [
    {
      key: "gems",
      emoji: "💵",
      label: "Moneten",
      value: String(player.gems),
      accent: "#8df28b",
      sectionX: 30,
      valueX: 93,
      info: { cx: 202, cy: 41, r: 8 },
      target: { x: 58, y: 56 },
      tooltip: ["Jedes Dollar-Symbol erhöht Moneten um 1.", "Zeigt alle eingesammelten Dollar-Symbole."],
    },
    {
      key: "lives",
      emoji: "🚀",
      label: "Leben",
      value: String(player.lives),
      accent: "#ffd27d",
      sectionX: 254,
      valueX: 317,
      info: { cx: 428, cy: 41, r: 8 },
      target: { x: 282, y: 56 },
      tooltip: ["Treffer und Stürze kosten ein Leben.", "Raketen schenken dir ein Extraleben."],
    },
    {
      key: "score",
      emoji: "⭐",
      label: "Punkte",
      value: String(getTotalScore()),
      accent: "#fff1b8",
      sectionX: 478,
      valueX: 543,
      info: { cx: 650, cy: 41, r: 8 },
      target: { x: 506, y: 56 },
      tooltip: ["Dollar-Symbol: 50", "Bug besiegen: 150", "Rakete einsammeln: 250", "Distanz: laufend"],
    },
    {
      key: "highscore",
      emoji: "🏆",
      label: "Highscore",
      value: String(highScore),
      accent: "#ffbc7e",
      sectionX: 702,
      valueX: 767,
      info: { cx: 890, cy: 41, r: 8 },
      target: { x: 730, y: 56 },
      tooltip: ["Dein bester Gesamtwert.", "Wird lokal im Browser gespeichert."],
    },
  ];
}

function getHudStatByKey(key) {
  return getHudStats().find((stat) => stat.key === key) ?? null;
}

function getHudInfoHit(point) {
  return getHudStats().find((stat) => pointInCircle(point, stat.info)) ?? null;
}

function spawnHudEmoji(worldX, worldY, emoji, statKey) {
  const targetStat = getHudStatByKey(statKey);
  if (!targetStat) {
    return;
  }

  hudEffects.push({
    emoji,
    t: 0,
    duration: 900,
    startX: worldX - cameraX,
    startY: worldY,
    targetX: targetStat.target.x,
    targetY: targetStat.target.y,
  });
}

function updateHudEffects(delta) {
  for (let i = hudEffects.length - 1; i >= 0; i -= 1) {
    hudEffects[i].t += delta;
    if (hudEffects[i].t >= hudEffects[i].duration) {
      hudEffects.splice(i, 1);
    }
  }
}

function drawHudEffects() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  hudEffects.forEach((effect) => {
    const progress = clamp(effect.t / effect.duration, 0, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    const arcLift = Math.sin(progress * Math.PI) * 22;
    const x = effect.startX + (effect.targetX - effect.startX) * eased;
    const y = effect.startY + (effect.targetY - effect.startY) * eased - arcLift;
    const scale = 1 - progress * 0.18;
    const alpha = 1 - progress * 0.88;

    ctx.globalAlpha = alpha;
    ctx.font = `${Math.round(28 * scale)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(effect.emoji, x, y);
  });

  ctx.restore();
}

function wrapTextLines(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
      return;
    }
    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function removeHazardsUnderSpan(startX, endX) {
  level.hazards = level.hazards.filter((hazard) => hazard.x + hazard.w <= startX || hazard.x >= endX);
}

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
  if (Math.random() < 0.55) {
    addGemOnPlatform(step);
  }
  if (Math.random() < 0.18) {
    addBugOnPlatform(step);
  }
  return true;
}

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

function isTooCloseToGround(platform, groundY) {
  return groundY - platform.y < 68;
}

function initLevel() {
  level.platforms = [];
  level.hazards = [];
  level.gems = [];
  level.bugs = [];
  level.rockets = [];
  level.clouds = [];
  level.nextChunkX = 0;
  level.lastGroundY = 452;

  for (let i = 0; i < 6; i += 1) {
    level.clouds.push(createCloud(i * 240 + randomInt(0, 80)));
  }

  level.platforms.push(createPlatform(0, 470, 360, 70, "ground"));
  level.platforms.push(createPlatform(360, 456, 260, 84, "ground"));
  level.platforms.push(createPlatform(660, 440, 260, 100, "ground"));
  level.gems.push({ x: 780, y: 394, r: 14, collected: false });
  level.bugs.push(createBug(450, 418, 390, 560, 1.15));

  level.nextChunkX = 960;
  level.lastGroundY = 440;
  generateUntil(2600);
}

function addGroundHazard(segment) {
  if (segment.w < 220 || Math.random() > 0.28) {
    return;
  }

  const safeMargin = 36;
  const width = randomInt(36, 74);
  const height = randomInt(22, 28);
  const hazardX = randomInt(segment.x + safeMargin, segment.x + segment.w - width - safeMargin);
  level.hazards.push({
    x: hazardX,
    y: segment.y - height + 4,
    w: width,
    h: height,
  });
}

function getSafeGemX(platform) {
  const edgePadding = 28;
  const safeZones = [{ start: platform.x + edgePadding, end: platform.x + platform.w - edgePadding }];
  const overlappingHazards = level.hazards.filter(
    (hazard) => hazard.x < platform.x + platform.w && hazard.x + hazard.w > platform.x && Math.abs(hazard.y - platform.y) < 4
  );

  if (overlappingHazards.length > 0) {
    return null;
  }

  overlappingHazards.forEach((hazard) => {
    const nextZones = [];
    safeZones.forEach((zone) => {
      const blockedStart = hazard.x - 24;
      const blockedEnd = hazard.x + hazard.w + 24;

      if (blockedEnd <= zone.start || blockedStart >= zone.end) {
        nextZones.push(zone);
        return;
      }
      if (blockedStart > zone.start) {
        nextZones.push({ start: zone.start, end: blockedStart });
      }
      if (blockedEnd < zone.end) {
        nextZones.push({ start: blockedEnd, end: zone.end });
      }
    });
    safeZones.splice(0, safeZones.length, ...nextZones);
  });

  const validZones = safeZones.filter((zone) => zone.end - zone.start >= 36);
  if (validZones.length === 0) {
    return null;
  }

  validZones.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const bestZone = validZones[0];
  return (bestZone.start + bestZone.end) / 2;
}

function addGemOnPlatform(platform) {
  if (platform.w < 90) {
    return;
  }

  const gemX = getSafeGemX(platform);
  if (gemX === null) {
    return;
  }

  level.gems.push({
    x: gemX,
    y: platform.y - 32,
    r: 14,
    collected: false,
  });
}

function addBugOnPlatform(platform) {
  if (platform.w < 120) {
    return;
  }

  const patrolMargin = 18;
  const bugX = clamp(platform.x + platform.w * 0.5 - 23, platform.x + patrolMargin, platform.x + platform.w - 46 - patrolMargin);
  const speed = (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.8, 1.5);
  level.bugs.push(createBug(bugX, platform.y - 38, platform.x + patrolMargin, platform.x + platform.w - patrolMargin, speed));
}

function generateChunk() {
  const gapWidth = randomInt(78, 122);
  const x = level.nextChunkX + gapWidth;
  const width = randomInt(180, 340);
  const groundY = clamp(level.lastGroundY + randomInt(-18, 18), world.floorYMin, world.floorYMax);
  const ground = createPlatform(x, groundY, width, canvas.height - groundY, "ground");
  level.platforms.push(ground);

  let groundHasHazard = false;
  if (Math.random() < 0.48) {
    addGroundHazard(ground);
    groundHasHazard = true;
  }
  if (Math.random() < 0.55) {
    addGemOnPlatform(ground);
  }
  if (Math.random() < 0.33) {
    addBugOnPlatform(ground);
  }

  if (Math.random() < 0.58) {
    const plateWidth = randomInt(96, 170);
    const plateX = x + randomInt(10, Math.max(12, width - plateWidth - 12));
    const plateY = groundY - randomInt(82, 156);
    const plate = createPlatform(plateX, plateY, plateWidth, 18, "plate");
    if (!platformCollides(plate, 10) && !isTooCloseToGround(plate, groundY)) {
      const tooHighFromGround = groundY - plateY > 124;
      let shouldPlacePlate = true;
      if (tooHighFromGround) {
        const hasStep = ensureStepPlatform(plate, groundY);
        if (!hasStep && groundHasHazard) {
          removeHazardsUnderSpan(plate.x - 18, plate.x + plate.w + 18);
          groundHasHazard = false;
        }
        shouldPlacePlate = hasStep;
      } else if (groundHasHazard) {
        const overlapsHazardLane = level.hazards.some(
          (hazard) => hazard.x < plate.x + plate.w && hazard.x + hazard.w > plate.x
        );
        if (overlapsHazardLane && plateY < groundY - 90) {
          removeHazardsUnderSpan(plate.x - 18, plate.x + plate.w + 18);
          groundHasHazard = false;
        }
      }
      if (shouldPlacePlate && !hasReachableApproach(plate, ground)) {
        shouldPlacePlate = false;
      }

      if (!shouldPlacePlate) {
        return;
      }

      level.platforms.push(plate);

      if (Math.random() < 0.72) {
        addGemOnPlatform(plate);
      }
      if (Math.random() < 0.3) {
        addBugOnPlatform(plate);
      }
    }
  }

  if (Math.random() < 0.22) {
    const bonusWidth = randomInt(82, 130);
    const bonusX = x + width + randomInt(26, 80);
    const bonusY = clamp(groundY - randomInt(96, 152), 240, 390);
    const bonus = createPlatform(bonusX, bonusY, bonusWidth, 18, "plate");
    if (!platformCollides(bonus, 10) && !isTooCloseToGround(bonus, groundY)) {
      const tooHighFromGround = groundY - bonusY > 124;
      let shouldPlaceBonus = true;
      if (tooHighFromGround) {
        const hasStep = ensureStepPlatform(bonus, groundY);
        if (!hasStep) {
          removeHazardsUnderSpan(bonus.x - 18, bonus.x + bonus.w + 18);
          shouldPlaceBonus = false;
        }
      }
      if (shouldPlaceBonus && !hasReachableApproach(bonus, ground)) {
        shouldPlaceBonus = false;
      }
      if (!shouldPlaceBonus) {
        return;
      }
      level.platforms.push(bonus);
      addGemOnPlatform(bonus);
    }
  }

  level.nextChunkX = x + width;
  level.lastGroundY = groundY;
}

function generateUntil(targetX) {
  while (level.nextChunkX < targetX) {
    generateChunk();
  }
}

function cleanupWorld() {
  const cutoffX = cameraX - 900;
  level.platforms = level.platforms.filter((platform) => platform.x + platform.w > cutoffX);
  level.hazards = level.hazards.filter((hazard) => hazard.x + hazard.w > cutoffX);
  level.gems = level.gems.filter((gem) => gem.collected || gem.x + gem.r > cutoffX);
  level.bugs = level.bugs.filter((bug) => !bug.alive || bug.x + bug.w > cutoffX);
  level.rockets = level.rockets.filter((rocket) => rocket.x + rocket.w > cutoffX && rocket.x < cameraX + canvas.width + 900);
}

function resetPlayer(fullReset = false) {
  if (fullReset) {
    initLevel();
    player.lives = 3;
    player.gems = 0;
    player.score = 0;
    player.farthestX = level.spawn.x;
    player.checkpointX = level.spawn.x;
    player.checkpointY = level.spawn.y;
    gameState = "playing";
    activeHudInfo = null;
    cameraX = 0;
    rocketSpawnTimer = 700 + randomInt(0, 320);
    statusMessage = "Endloslauf gestartet";
  }

  player.x = player.checkpointX;
  player.y = player.checkpointY;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.direction = 1;
  player.invincible = 0;
  player.visible = true;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectCollision(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function updateCheckpoint(platform) {
  if (platform.kind !== "ground") {
    return;
  }

  if (player.x > player.checkpointX + 80) {
    player.checkpointX = player.x;
    player.checkpointY = platform.y - player.h;
  }
}

function handleMovement() {
  if (gameState !== "playing" || isPortraitMobileView()) {
    return;
  }

  generateUntil(cameraX + canvas.width * 3);

  level.clouds.forEach((cloud) => {
    cloud.x += cloud.vx;
  });
  const cloudResetX = cameraX - 260;
  level.clouds.forEach((cloud) => {
    if (cloud.x - cameraX > canvas.width + 180) {
      cloud.x = cloudResetX;
      cloud.y = randomInt(50, 190);
      cloud.w = randomInt(90, 170);
      cloud.h = randomInt(28, 52);
      cloud.vx = randomBetween(0.12, 0.32);
      cloud.puff = randomBetween(0.85, 1.2);
    }
  });

  rocketSpawnTimer -= 1;
  if (rocketSpawnTimer <= 0) {
    level.rockets.push(createRocket(Math.random() > 0.5));
    rocketSpawnTimer = randomInt(850, 1450);
  }

  if (keys.left) {
    player.vx -= player.speed;
    player.direction = -1;
  }
  if (keys.right) {
    player.vx += player.speed;
    player.direction = 1;
  }
  if (!keys.left && !keys.right) {
    player.vx *= 0.82;
  }

  player.vx = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.vx));
  player.vy += world.gravity;

  const previousY = player.y;
  player.x += player.vx;
  player.y += player.vy;
  player.grounded = false;

  level.platforms.forEach((platform) => {
    if (!overlaps(player, platform)) {
      return;
    }

    const cameFromAbove = previousY + player.h <= platform.y + 8 && player.vy >= 0;
    if (cameFromAbove) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.grounded = true;
      updateCheckpoint(platform);
      return;
    }

    const cameFromBelow = previousY >= platform.y + platform.h - 8 && player.vy < 0;
    if (cameFromBelow) {
      player.y = platform.y + platform.h;
      player.vy = Math.max(1.5, Math.abs(player.vy) * 0.2);
      return;
    }

    if (player.x + player.w / 2 < platform.x + platform.w / 2) {
      player.x = platform.x - player.w;
    } else {
      player.x = platform.x + platform.w;
    }
    player.vx *= -0.2;
  });

  player.x = Math.max(0, player.x);
  player.farthestX = Math.max(player.farthestX, player.x);

  if (player.y > canvas.height + 180) {
    loseLife("Der Tiger ist in einen Krater gestürzt");
  }

  if (player.invincible > 0) {
    player.invincible -= 1;
  }

  level.hazards.forEach((hazard) => {
    if (player.invincible > 0) {
      return;
    }
    if (overlaps(player, hazard)) {
      loseLife("Autsch, scharfe Lavasteine");
    }
  });

  level.gems.forEach((gem) => {
    if (gem.collected) {
      return;
    }
    if (circleRectCollision(gem, player)) {
      gem.collected = true;
      const moneyEffect = createHitEffect(gem.x, gem.y, "💵");
      const scoreEffect = createHitEffect(gem.x + 16, gem.y - 8, "⭐");
      spawnHudEmoji(moneyEffect.x, moneyEffect.y, moneyEffect.emoji, "gems");
      spawnHudEmoji(scoreEffect.x, scoreEffect.y, scoreEffect.emoji, "score");
      player.gems += 1;
      player.score += 50;
      statusMessage = "Moneten geborgen";
    }
  });

  level.bugs.forEach((bug) => {
    if (!bug.alive) {
      return;
    }

    bug.x += bug.vx;
    if (bug.x <= bug.minX || bug.x + bug.w >= bug.maxX) {
      bug.vx *= -1;
      bug.x = clamp(bug.x, bug.minX, bug.maxX - bug.w);
    }

    if (!overlaps(player, bug)) {
      return;
    }

    const stomped = player.vy > 1 && previousY + player.h <= bug.y + 10;
    if (stomped) {
      bug.alive = false;
      const scoreEffect = createHitEffect(bug.x + bug.w / 2, bug.y + 6, "⭐");
      spawnHudEmoji(scoreEffect.x, scoreEffect.y, scoreEffect.emoji, "score");
      player.vy = -8.5;
      player.score += 150;
      statusMessage = "Bug besiegt. Punkte eingesackt";
      return;
    }

    if (player.invincible <= 0) {
      loseLife("Ein Bug hat den Tiger erwischt");
    }
  });

  level.rockets.forEach((rocket) => {
    if (!rocket.active) {
      return;
    }

    rocket.x += rocket.vx;
    if (overlaps(player, rocket)) {
      rocket.active = false;
      const lifeEffect = createHitEffect(rocket.x + rocket.w / 2 - 12, rocket.y + rocket.h / 2, "🚀");
      const scoreEffect = createHitEffect(rocket.x + rocket.w / 2 + 16, rocket.y + rocket.h / 2 - 10, "⭐");
      spawnHudEmoji(lifeEffect.x, lifeEffect.y, lifeEffect.emoji, "lives");
      spawnHudEmoji(scoreEffect.x, scoreEffect.y, scoreEffect.emoji, "score");
      player.lives += 1;
      player.score += 250;
      statusMessage = "Rakete erwischt. Extraleben erhalten";
    }
  });
  level.rockets = level.rockets.filter((rocket) => rocket.active);

  cameraX = Math.max(0, player.x - canvas.width * 0.35);
  cleanupWorld();
  syncHighScore();
}

function updateAnimation(delta) {
  const movingOnGround = player.grounded && Math.abs(player.vx) > 0.35;

  if (!movingOnGround) {
    runFrameIndex = 0;
    runFrameTimer = 0;
    return;
  }

  runFrameTimer += delta;
  if (runFrameTimer >= 90) {
    runFrameTimer = 0;
    runFrameIndex = (runFrameIndex + 1) % sprites.run.length;
  }
}

function loseLife(message) {
  player.lives -= 1;
  player.invincible = 75;

  if (player.lives <= 0) {
    gameState = "lost";
    saveHighScore(getTotalScore());
    statusMessage = "Game over. Drücke R für einen Neustart";
    player.vx = 0;
    player.vy = 0;
    return;
  }

  statusMessage = message;
  player.x = player.checkpointX;
  player.y = player.checkpointY;
  player.vx = 0;
  player.vy = 0;
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#271339");
  sky.addColorStop(0.45, "#813954");
  sky.addColorStop(1, "#cf6c45");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-cameraX * 0.18, 0);
  ctx.fillStyle = "rgba(255, 220, 170, 0.18)";
  ctx.beginPath();
  ctx.arc(740, 112, 68, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 168, 106, 0.15)";
  for (let i = 0; i < 14; i += 1) {
    const ridgeX = i * 300;
    const ridgeY = 405 + (i % 3) * 18;
    const ridgeW = 220 + (i % 4) * 30;
    ctx.beginPath();
    ctx.moveTo(ridgeX, canvas.height);
    ctx.quadraticCurveTo(ridgeX + ridgeW * 0.45, ridgeY, ridgeX + ridgeW, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 40; i += 1) {
    const starX = 120 + i * 130;
    const starY = 70 + (i % 4) * 30;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillRect(starX, starY, 2, 2);
  }

  level.clouds.forEach((cloud) => {
    const x = cloud.x - cameraX * 0.18;
    const y = cloud.y;
    ctx.fillStyle = "rgba(255, 244, 234, 0.11)";
    ctx.beginPath();
    ctx.ellipse(x, y, cloud.w * 0.28, cloud.h * 0.34, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.2, y - cloud.h * 0.18, cloud.w * 0.24, cloud.h * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.42, y, cloud.w * 0.3, cloud.h * 0.38, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.62, y + cloud.h * 0.04, cloud.w * 0.22, cloud.h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawPlatform(platform) {
  const x = platform.x - cameraX;
  const gradient = ctx.createLinearGradient(x, platform.y, x, platform.y + platform.h);
  gradient.addColorStop(0, platform.kind === "ground" ? "#e07b48" : "#f2a35c");
  gradient.addColorStop(1, platform.kind === "ground" ? "#7e3720" : "#8e4723");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, platform.y, platform.w, platform.h);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x, platform.y, platform.w, 6);
}

function drawHazard(hazard) {
  const x = hazard.x - cameraX;
  ctx.fillStyle = "#4c170f";
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + i * (hazard.w / 4), hazard.y + hazard.h);
    ctx.lineTo(x + i * (hazard.w / 4) + hazard.w / 8, hazard.y);
    ctx.lineTo(x + i * (hazard.w / 4) + hazard.w / 4, hazard.y + hazard.h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGem(gem, time) {
  if (gem.collected) {
    return;
  }

  const bob = Math.sin(time / 180 + gem.x * 0.01) * 4;
  const x = gem.x - cameraX;
  const y = gem.y + bob;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#77f26b";
  ctx.strokeStyle = "#1f7c2d";
  ctx.lineWidth = 2.5;
  ctx.font = "700 28px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText("$", 0, 0);
  ctx.fillText("$", 0, 0);
  ctx.restore();
}

function drawBug(bug, time) {
  if (!bug.alive) {
    return;
  }

  const x = bug.x - cameraX;
  const y = bug.y + Math.sin(time / 170 + bug.x * 0.03) * 1.5;
  const facing = bug.vx < 0 ? -1 : 1;

  ctx.save();
  ctx.translate(x + bug.w / 2, y + bug.h);
  ctx.scale(facing, 1);
  ctx.translate(-bug.w / 2, -bug.h);

  if (sprites.bug.complete) {
    ctx.drawImage(sprites.bug, -10, -14, 66, 52);
  } else {
    ctx.fillStyle = "#5d1f14";
    ctx.fillRect(0, 0, bug.w, bug.h);
  }

  ctx.restore();
}

function drawRocket(rocket) {
  const x = rocket.x - cameraX;
  const sprite = rocket.fromLeft ? sprites.rocketFromLeft : sprites.rocketFromRight;

  if (sprite.complete) {
    ctx.drawImage(sprite, x, rocket.y, rocket.w, rocket.h);
    return;
  }

  ctx.fillStyle = "#d8ddd9";
  ctx.fillRect(x, rocket.y, rocket.w, rocket.h);
}

function drawTiger() {
  if (!player.visible) {
    return;
  }

  const x = player.x - cameraX;
  const blink = player.invincible > 0 && Math.floor(player.invincible / 5) % 2 === 0;

  if (blink) {
    return;
  }

  ctx.save();
  ctx.translate(x + player.w / 2, player.y + player.h);
  ctx.scale(player.direction, 1);
  ctx.translate(-player.w / 2, -player.h);

  let sprite = sprites.run[runFrameIndex];
  if (!player.grounded) {
    sprite = player.vy < 0 ? sprites.jumpUp : sprites.jumpDown;
  } else if (Math.abs(player.vx) <= 0.35) {
    sprite = sprites.standing;
  }

  if (sprite && sprite.complete) {
    ctx.drawImage(sprite, -36, player.h - 166, 126, 166);
  } else {
    ctx.fillStyle = "#d8732c";
    ctx.beginPath();
    ctx.arc(27, 27, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawHud() {
  const stats = getHudStats();
  const leftActive = keys.left;
  const rightActive = keys.right;

  ctx.save();
  ctx.font = "700 18px Trebuchet MS";
  ctx.textBaseline = "middle";

  const panel = mobileHud.topBar;
  ctx.fillStyle = "rgba(14, 10, 18, 0.54)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 22);
  ctx.fill();
  ctx.stroke();

  stats.forEach((stat) => {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "700 16px Trebuchet MS";
    ctx.fillText(stat.label, stat.sectionX + 28, 38);
    ctx.fillStyle = stat.accent;
    ctx.font = `700 19px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(stat.emoji, stat.sectionX + 28, 60);
    ctx.font = "700 24px Trebuchet MS";
    ctx.fillText(String(stat.value), stat.valueX, 61);

    ctx.fillStyle = activeHudInfo === stat.key ? "rgba(255, 201, 126, 0.95)" : "rgba(255,255,255,0.2)";
    ctx.strokeStyle = activeHudInfo === stat.key ? "rgba(255, 241, 223, 0.9)" : "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(stat.info.cx, stat.info.cy, stat.info.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = activeHudInfo === stat.key ? "#5f260d" : "rgba(255,255,255,0.9)";
    ctx.font = "700 11px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("?", stat.info.cx, stat.info.cy + 1);
    ctx.textAlign = "left";
  });

  [241, 469, 693].forEach((x) => {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 28);
    ctx.lineTo(x, 88);
    ctx.stroke();
  });

  if (statusMessage && gameState === "playing") {
    ctx.fillStyle = "rgba(10, 7, 14, 0.44)";
    ctx.beginPath();
    ctx.roundRect(18, 98, 420, 32, 14);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 236, 214, 0.92)";
    ctx.font = "700 15px Trebuchet MS";
    ctx.fillText(statusMessage, 32, 119);
  }

  if (activeHudInfo) {
    const stat = stats.find((entry) => entry.key === activeHudInfo);
    if (stat) {
      ctx.font = "14px Trebuchet MS";
      const wrappedLines = stat.tooltip.flatMap((line) => wrapTextLines(line, stat.key === "score" ? 222 : 192));
      const tooltipWidth = stat.key === "score" ? 250 : 220;
      const tooltipX = clamp(stat.sectionX - 6, 18, canvas.width - tooltipWidth - 18);
      const tooltipY = panel.y + panel.h + 12;
      const tooltipHeight = 46 + wrappedLines.length * 22;

      ctx.fillStyle = "rgba(18, 12, 24, 0.96)";
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fff0e0";
      ctx.font = "700 15px Trebuchet MS";
      ctx.fillText(`${stat.emoji} ${stat.label}`, tooltipX + 14, tooltipY + 22);
      ctx.font = "14px Trebuchet MS";
      wrappedLines.forEach((line, index) => {
        ctx.fillText(line, tooltipX + 14, tooltipY + 50 + index * 22);
      });
    }
  }

  const jumpActive = jumpButtonGlow > 0;

  const drawControl = (circle, glyph, active, accent, glyphSize) => {
    const glowAlpha = active ? 0.16 : 0.06;
    const radiusBoost = active ? 8 : 0;

    ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(circle.cx, circle.cy, circle.r + radiusBoost, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = active ? accent : "rgba(255, 255, 255, 0.24)";
    ctx.strokeStyle = active ? "rgba(255, 255, 255, 0.48)" : "rgba(255, 255, 255, 0.24)";
    ctx.lineWidth = active ? 4 : 3;
    ctx.beginPath();
    ctx.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = active ? "#5a2a12" : "rgba(72, 36, 18, 0.72)";
    ctx.font = `700 ${glyphSize}px Trebuchet MS`;
    ctx.textAlign = "center";
    ctx.fillText(glyph, circle.cx, circle.cy + 2);
    ctx.textAlign = "left";
  };

  if (isTouchDevice) {
    drawControl(mobileHud.leftPad, "◀", leftActive, "rgba(255, 255, 255, 0.36)", 34);
    drawControl(mobileHud.rightPad, "▶", rightActive, "rgba(255, 255, 255, 0.36)", 34);
    drawControl(mobileHud.jumpPad, "▲", jumpActive, "rgba(255, 255, 255, 0.42)", 42);

    if (gameState === "ready") {
      ctx.fillStyle = "rgba(255, 244, 226, 0.92)";
      ctx.font = "700 18px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText("Tippe auf Springen oder ins Bild zum Start", canvas.width / 2, 108);
      ctx.textAlign = "left";
    }
  }

  ctx.restore();
}

function drawOverlay() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(8, 5, 12, 0.42)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff6ea";
  ctx.font = "700 50px Trebuchet MS";
  if (gameState === "ready") {
    installButtonRect = null;
    ctx.fillText("Curious Tiger: Red Dune Dash", canvas.width / 2, 150);
    ctx.font = "24px Trebuchet MS";
    ctx.fillStyle = "#ffd1aa";
    ctx.fillText("Bekämpfe Bugs, sammle Moneten und überlebe die Marsduenen.", canvas.width / 2, 196);
    ctx.font = "700 34px Trebuchet MS";
    ctx.fillStyle = "#fff6ea";
    ctx.fillText(isTouchDevice ? "Tippe zum Starten" : "Leertaste fuer den Start", canvas.width / 2, 256);
    ctx.font = "22px Trebuchet MS";
    ctx.fillStyle = "#ffd1aa";
    ctx.fillText(
      isTouchDevice ? "Tippe auf das Spiel oder auf Springen" : "A / D laufen   W oder Leertaste springen   R neu starten",
      canvas.width / 2,
      298
    );

    if (shouldShowInstallPrompt()) {
      const hintY = 344;
      const buttonWidth = 204;
      const buttonHeight = 44;
      const buttonX = canvas.width / 2 - buttonWidth / 2;
      const buttonY = 364;

      ctx.font = "18px Trebuchet MS";
      ctx.fillStyle = "rgba(255, 240, 221, 0.9)";
      ctx.fillText(
        deferredInstallPrompt || isIosInstallFallback()
          ? "Installiere das Spiel fuer schnelleren Zugriff auf deinem Geraet"
          : "Installation wird verfuegbar, sobald dein Browser sie anbietet",
        canvas.width / 2,
        hintY
      );

      if (deferredInstallPrompt || isIosInstallFallback()) {
        installButtonRect = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };
        ctx.fillStyle = "rgba(255, 214, 156, 0.92)";
        ctx.strokeStyle = "rgba(255, 247, 234, 0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#4c2412";
        ctx.font = "700 20px Trebuchet MS";
        ctx.fillText("Als App installieren", canvas.width / 2, buttonY + 26);
      }

      if (showInstallHelp && isIosInstallFallback()) {
        const helpWidth = 336;
        const helpHeight = 108;
        const helpX = canvas.width / 2 - helpWidth / 2;
        const helpY = buttonY + 58;
        ctx.fillStyle = "rgba(18, 12, 24, 0.96)";
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(helpX, helpY, helpWidth, helpHeight, 18);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = "#fff0e0";
        ctx.font = "700 16px Trebuchet MS";
        ctx.fillText("iPhone / iPad:", helpX + 16, helpY + 24);
        ctx.font = "15px Trebuchet MS";
        ctx.fillText("1. Safari Teilen-Menue oeffnen", helpX + 16, helpY + 50);
        ctx.fillText("2. 'Zum Home-Bildschirm' waehlen", helpX + 16, helpY + 74);
        ctx.fillText("3. Danach vom Home-Screen starten", helpX + 16, helpY + 98);
        ctx.textAlign = "center";
      }
    }
  } else if (gameState === "lost") {
    installButtonRect = null;
    ctx.fillText("Game over", canvas.width / 2, 175);
    ctx.font = "24px Trebuchet MS";
    ctx.fillStyle = "#ffd1aa";
    ctx.fillText(
      isTouchDevice ? `Highscore: ${highScore}. Tippe für einen neuen Lauf` : `Highscore: ${highScore}. Drücke R für einen neuen Lauf`,
      canvas.width / 2,
      220
    );

    if (sprites.gameOver.complete) {
      const maxWidth = 250;
      const aspectRatio = sprites.gameOver.naturalWidth > 0 ? sprites.gameOver.naturalHeight / sprites.gameOver.naturalWidth : 1;
      const drawWidth = maxWidth;
      const drawHeight = drawWidth * aspectRatio;
      const drawX = canvas.width - drawWidth - 18;
      const drawY = canvas.height - drawHeight - 18;
      ctx.drawImage(sprites.gameOver, drawX, drawY, drawWidth, drawHeight);
    }
  }
  ctx.restore();
}

function drawRotateOverlay() {
  ctx.save();
  ctx.fillStyle = "rgba(8, 5, 12, 0.78)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff6ea";
  ctx.font = `700 58px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText("📱", canvas.width / 2, canvas.height / 2 - 56);
  ctx.font = "700 34px Trebuchet MS";
  ctx.fillText("Bitte ins Querformat drehen", canvas.width / 2, canvas.height / 2 + 8);
  ctx.fillStyle = "#ffd1aa";
  ctx.font = "22px Trebuchet MS";
  ctx.fillText("Das Spiel ist mobil fuer Landscape optimiert", canvas.width / 2, canvas.height / 2 + 50);
  ctx.restore();
}

function render(time) {
  drawBackground();
  level.platforms.forEach(drawPlatform);
  level.hazards.forEach(drawHazard);
  level.gems.forEach((gem) => drawGem(gem, time));
  level.bugs.forEach((bug) => drawBug(bug, time));
  level.rockets.forEach(drawRocket);
  drawTiger();

  if (gameState !== "playing") {
    drawOverlay();
  }

  drawHud();
  drawHudEffects();

  if (isPortraitMobileView()) {
    drawRotateOverlay();
  }
}

function gameLoop(time) {
  const delta = time - lastTime;
  lastTime = time;

  if (delta < 100) {
    jumpButtonGlow = Math.max(0, jumpButtonGlow - 1);
    updateHudEffects(delta);
    handleMovement();
    updateAnimation(delta);
  }

  render(time);
  requestAnimationFrame(gameLoop);
}

function tryJump() {
  if (isPortraitMobileView()) {
    return;
  }

  if (gameState === "ready") {
    gameState = "playing";
    statusMessage = "Endloslauf gestartet";
    player.visible = true;
    player.x = 42;
    player.y = -160;
    player.vx = 0.8;
    player.vy = 2.2;
    player.grounded = false;
    player.direction = 1;
    return;
  }
  if (gameState !== "playing") {
    return;
  }
  if (player.grounded) {
    player.vy = player.jumpPower;
    player.grounded = false;
  }
}

window.addEventListener("keydown", (event) => {
  const code = event.code;
  if (code === "KeyA" || code === "ArrowLeft") {
    keys.left = true;
  }
  if (code === "KeyD" || code === "ArrowRight") {
    keys.right = true;
  }
  if (code === "KeyW" || code === "Space" || code === "ArrowUp") {
    event.preventDefault();
    tryJump();
  }
  if (code === "KeyR") {
    resetPlayer(true);
  }
});

window.addEventListener("keyup", (event) => {
  const code = event.code;
  if (code === "KeyA" || code === "ArrowLeft") {
    keys.left = false;
  }
  if (code === "KeyD" || code === "ArrowRight") {
    keys.right = false;
  }
});

canvas.addEventListener("pointerdown", (event) => {
  const point = getCanvasPoint(event);
  const infoHit = point ? getHudInfoHit(point) : null;

  if (point && installButtonRect && pointInRect(point, installButtonRect)) {
    event.preventDefault();
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(() => {
        deferredInstallPrompt = null;
      });
    } else if (isIosInstallFallback()) {
      showInstallHelp = !showInstallHelp;
    }
    return;
  }

  if (infoHit) {
    event.preventDefault();
    activeHudInfo = activeHudInfo === infoHit.key ? null : infoHit.key;
    return;
  }

  activeHudInfo = null;

  if (event.pointerType === "mouse") {
    return;
  }

  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  requestLandscapeLock();
  const action = getTouchAction(point);

  if (gameState === "lost") {
    resetPlayer(true);
    return;
  }

  if (action === "left" || action === "right") {
    activeTouchControls.set(event.pointerId, action);
    updateTouchInputState();
    return;
  }

  if (action === "jump") {
    jumpButtonGlow = 8;
    tryJump();
    return;
  }

  if (gameState === "ready" || gameState === "playing") {
    jumpButtonGlow = 8;
    tryJump();
  }
});

const releaseTouchControl = (event) => {
  if (!activeTouchControls.has(event.pointerId)) {
    return;
  }

  event.preventDefault();
  activeTouchControls.delete(event.pointerId);
  updateTouchInputState();
};

canvas.addEventListener("pointerup", releaseTouchControl);
canvas.addEventListener("pointercancel", releaseTouchControl);
canvas.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse") {
    return;
  }
  releaseTouchControl(event);
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

resetPlayer(true);
gameState = "ready";
statusMessage = "Bereit für den Start";
player.visible = false;
player.x = -999;
player.y = -999;
syncCanvasOnlyMode();
requestAnimationFrame(gameLoop);
