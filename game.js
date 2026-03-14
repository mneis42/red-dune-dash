const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const gemCountEl = document.getElementById("gemCount");
const lifeCountEl = document.getElementById("lifeCount");
const scoreCountEl = document.getElementById("scoreCount");
const statusTextEl = document.getElementById("statusText");

const spriteSources = {
  run: [
    "assets/run1.png",
    "assets/run2.png",
    "assets/run3.png",
    "assets/run4.png",
    "assets/run5.png",
    "assets/run6.png",
  ],
  jumpUp: "assets/jump-up.png",
  jumpDown: "assets/jump-down.png",
  bug: "assets/bug.png",
};

const sprites = {
  run: spriteSources.run.map((src) => {
    const image = new Image();
    image.src = src;
    return image;
  }),
  jumpUp: new Image(),
  jumpDown: new Image(),
  bug: new Image(),
};

sprites.jumpUp.src = spriteSources.jumpUp;
sprites.jumpDown.src = spriteSources.jumpDown;
sprites.bug.src = spriteSources.bug;

const world = {
  width: 2200,
  height: canvas.height,
  gravity: 0.68,
};

const keys = {
  left: false,
  right: false,
  jump: false,
};

const level = {
  spawn: { x: 120, y: 390 },
  platforms: [
    { x: 0, y: 470, w: 420, h: 70, kind: "ground" },
    { x: 500, y: 470, w: 250, h: 70, kind: "ground" },
    { x: 870, y: 470, w: 290, h: 70, kind: "ground" },
    { x: 1240, y: 470, w: 340, h: 70, kind: "ground" },
    { x: 1670, y: 470, w: 350, h: 70, kind: "ground" },
    { x: 2090, y: 470, w: 160, h: 70, kind: "ground" },
    { x: 270, y: 378, w: 110, h: 18, kind: "plate" },
    { x: 620, y: 335, w: 120, h: 18, kind: "plate" },
    { x: 988, y: 315, w: 100, h: 18, kind: "plate" },
    { x: 1410, y: 360, w: 140, h: 18, kind: "plate" },
    { x: 1770, y: 302, w: 120, h: 18, kind: "plate" },
  ],
  hazards: [
    { x: 432, y: 470, w: 50, h: 24 },
    { x: 770, y: 470, w: 72, h: 26 },
    { x: 1174, y: 470, w: 48, h: 24 },
    { x: 1604, y: 470, w: 42, h: 22 },
    { x: 2035, y: 470, w: 42, h: 22 },
  ],
  gems: [
    { x: 350, y: 330, r: 14, collected: false },
    { x: 650, y: 286, r: 14, collected: false },
    { x: 1020, y: 266, r: 14, collected: false },
    { x: 1478, y: 312, r: 14, collected: false },
    { x: 1828, y: 250, r: 14, collected: false },
  ],
  finish: { x: 2140, y: 348, w: 36, h: 122 },
  bugs: [
    { x: 565, y: 432, w: 46, h: 38, minX: 520, maxX: 690, vx: 1.2, alive: true },
    { x: 1285, y: 432, w: 46, h: 38, minX: 1260, maxX: 1510, vx: 1.4, alive: true },
    { x: 1735, y: 264, w: 46, h: 38, minX: 1775, maxX: 1840, vx: 1, alive: true },
  ],
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
};

let cameraX = 0;
let gameState = "ready";
let lastTime = 0;
let runFrameIndex = 0;
let runFrameTimer = 0;

function resetPlayer(fullReset = false) {
  player.x = level.spawn.x;
  player.y = level.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.direction = 1;
  player.invincible = 0;

  if (fullReset) {
    player.lives = 3;
    player.gems = 0;
    player.score = 0;
    level.gems.forEach((gem) => {
      gem.collected = false;
    });
    level.bugs.forEach((bug) => {
      bug.alive = true;
    });
    gameState = "playing";
    statusTextEl.textContent = "Marsmission laeuft";
  }
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function circleRectCollision(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function handleMovement() {
  if (gameState !== "playing") {
    return;
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
      return;
    }

    if (player.x + player.w / 2 < platform.x + platform.w / 2) {
      player.x = platform.x - player.w;
    } else {
      player.x = platform.x + platform.w;
    }
    player.vx *= -0.2;
  });

  player.x = Math.max(0, Math.min(world.width - player.w, player.x));

  if (player.y > canvas.height + 180) {
    loseLife("Der Tiger ist in einen Krater gestuerzt");
  }

  if (player.invincible > 0) {
    player.invincible -= 1;
  }

  level.hazards.forEach((hazard) => {
    if (player.invincible > 0) {
      return;
    }
    if (overlaps(player, { x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h })) {
      loseLife("Autsch, scharfe Lavasteine");
    }
  });

  level.gems.forEach((gem) => {
    if (gem.collected) {
      return;
    }
    if (circleRectCollision(gem, player)) {
      gem.collected = true;
      player.gems += 1;
      statusTextEl.textContent = "Sternensplitter geborgen";
    }
  });

  level.bugs.forEach((bug) => {
    if (!bug.alive) {
      return;
    }

    bug.x += bug.vx;
    if (bug.x <= bug.minX || bug.x + bug.w >= bug.maxX) {
      bug.vx *= -1;
      bug.x = Math.max(bug.minX, Math.min(bug.maxX - bug.w, bug.x));
    }

    if (!overlaps(player, bug)) {
      return;
    }

    const stomped = player.vy > 1 && player.y + player.h - player.vy <= bug.y + 10;
    if (stomped) {
      bug.alive = false;
      player.vy = -8.5;
      player.score += 150;
      statusTextEl.textContent = "Bug besiegt. Punkte eingesackt";
      return;
    }

    if (player.invincible <= 0) {
      loseLife("Ein Bug hat den Tiger erwischt");
    }
  });

  if (player.gems === level.gems.length && overlaps(player, level.finish)) {
    gameState = "won";
    statusTextEl.textContent = "Portal erreicht. Mission geschafft";
  }

  if (player.gems < level.gems.length && overlaps(player, level.finish)) {
    statusTextEl.textContent = "Das Portal startet erst mit allen Splittern";
  }

  cameraX = Math.max(0, Math.min(player.x - canvas.width * 0.35, world.width - canvas.width));
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
    statusTextEl.textContent = "Mission gescheitert. Druecke R";
    player.vx = 0;
    player.vy = 0;
    return;
  }

  statusTextEl.textContent = message;
  player.x = level.spawn.x;
  player.y = level.spawn.y;
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
  [[120, 420, 180], [520, 410, 240], [980, 430, 220], [1500, 425, 250], [1910, 400, 220]].forEach(([x, y, w]) => {
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.quadraticCurveTo(x + w * 0.4, y, x + w, canvas.height);
    ctx.closePath();
    ctx.fill();
  });

  for (let i = 0; i < 40; i += 1) {
    const x = 120 + i * 130;
    const y = 70 + (i % 4) * 30;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

function drawPlatform(platform) {
  const x = platform.x - cameraX;
  const y = platform.y;
  const gradient = ctx.createLinearGradient(x, y, x, y + platform.h);
  gradient.addColorStop(0, platform.kind === "ground" ? "#e07b48" : "#f2a35c");
  gradient.addColorStop(1, platform.kind === "ground" ? "#7e3720" : "#8e4723");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, platform.w, platform.h);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x, y, platform.w, 6);
}

function drawHazard(hazard) {
  const x = hazard.x - cameraX;
  const y = hazard.y;
  ctx.fillStyle = "#4c170f";
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + i * (hazard.w / 4), y + hazard.h);
    ctx.lineTo(x + i * (hazard.w / 4) + hazard.w / 8, y);
    ctx.lineTo(x + i * (hazard.w / 4) + hazard.w / 4, y + hazard.h);
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
  ctx.rotate(time / 1000);
  ctx.fillStyle = "#ffe079";
  ctx.beginPath();
  ctx.moveTo(0, -gem.r);
  ctx.lineTo(gem.r * 0.8, 0);
  ctx.lineTo(0, gem.r);
  ctx.lineTo(-gem.r * 0.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFinish() {
  const x = level.finish.x - cameraX;
  const y = level.finish.y;
  ctx.fillStyle = "#ffe1bf";
  ctx.fillRect(x + 12, y, 10, level.finish.h);

  ctx.fillStyle = player.gems === level.gems.length ? "#7efac3" : "#ffc14a";
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 10);
  ctx.quadraticCurveTo(x + 72, y + 28, x + 24, y + 48);
  ctx.lineTo(x + 24, y + 10);
  ctx.closePath();
  ctx.fill();

  if (player.gems === level.gems.length) {
    ctx.strokeStyle = "rgba(126, 250, 195, 0.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + 20, y + 25, 32, 0, Math.PI * 2);
    ctx.stroke();
  }
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

function drawTiger() {
  const x = player.x - cameraX;
  const y = player.y;
  const blink = player.invincible > 0 && Math.floor(player.invincible / 5) % 2 === 0;

  if (blink) {
    return;
  }

  ctx.save();
  ctx.translate(x + player.w / 2, y + player.h);
  ctx.scale(player.direction, 1);
  ctx.translate(-player.w / 2, -player.h);

  let sprite = sprites.run[runFrameIndex];

  if (!player.grounded) {
    sprite = player.vy < 0 ? sprites.jumpUp : sprites.jumpDown;
  } else if (Math.abs(player.vx) <= 0.35) {
    sprite = sprites.run[0];
  }

  if (sprite && sprite.complete) {
    const spriteWidth = 126;
    const spriteHeight = 166;
    const drawX = -36;
    const drawY = player.h - spriteHeight;
    ctx.drawImage(sprite, drawX, drawY, spriteWidth, spriteHeight);
  } else {
    ctx.fillStyle = "#d8732c";
    ctx.beginPath();
    ctx.arc(27, 27, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function updateHud() {
  gemCountEl.textContent = `${player.gems} / ${level.gems.length}`;
  lifeCountEl.textContent = String(player.lives);
  scoreCountEl.textContent = String(player.score);
}

function drawOverlay() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(8, 5, 12, 0.42)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff6ea";
  ctx.font = "700 42px Trebuchet MS";
  if (gameState === "ready") {
    ctx.fillText("Leertaste fuer den Start", canvas.width / 2, 210);
    ctx.font = "24px Trebuchet MS";
    ctx.fillStyle = "#ffd1aa";
    ctx.fillText("Sammle alle 5 Sternensplitter und aktiviere das Portal", canvas.width / 2, 260);
  } else if (gameState === "won") {
    ctx.fillText("Mission geschafft", canvas.width / 2, 220);
    ctx.font = "24px Trebuchet MS";
    ctx.fillStyle = "#c5ffdf";
    ctx.fillText("Dein Mars Tiger hat die Duenen gemeistert. R fuer eine neue Runde", canvas.width / 2, 268);
  } else if (gameState === "lost") {
    ctx.fillText("Neustart der Mission", canvas.width / 2, 220);
    ctx.font = "24px Trebuchet MS";
    ctx.fillStyle = "#ffd1aa";
    ctx.fillText("Die Marslandschaft war zu wild. Druecke R und versuche es nochmal", canvas.width / 2, 268);
  }
  ctx.restore();
}

function render(time) {
  drawBackground();

  level.platforms.forEach(drawPlatform);
  level.hazards.forEach(drawHazard);
  level.gems.forEach((gem) => drawGem(gem, time));
  level.bugs.forEach((bug) => drawBug(bug, time));
  drawFinish();
  drawTiger();
  updateHud();

  if (gameState !== "playing") {
    drawOverlay();
  }
}

function gameLoop(time) {
  const delta = time - lastTime;
  lastTime = time;

  if (delta < 100) {
    handleMovement();
    updateAnimation(delta);
  }
  render(time);
  requestAnimationFrame(gameLoop);
}

function tryJump() {
  if (gameState === "ready") {
    gameState = "playing";
    statusTextEl.textContent = "Marsmission laeuft";
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

resetPlayer(true);
gameState = "ready";
statusTextEl.textContent = "Bereit fuer den Start";
requestAnimationFrame(gameLoop);
