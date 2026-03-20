(function registerHudRuntime(globalScope) {
  const MOBILE_HUD_LAYOUT = Object.freeze({
    topBar: Object.freeze({ x: 0, y: 0, w: 960, h: 44 }),
    leftPad: Object.freeze({ cx: 94, cy: 462, r: 58 }),
    rightPad: Object.freeze({ cx: 232, cy: 462, r: 58 }),
    jumpPad: Object.freeze({ cx: 850, cy: 450, r: 72 }),
  });

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
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

  function wrapTextLines(ctx, text, maxWidth) {
    const words = String(text).split(" ");
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

  function formatRunDuration(timeMs) {
    const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatEuroAmount(cents) {
    return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
  }

  function createHudRuntime(options = {}) {
    const scoreConfig = options.scoreConfig ?? {
      gemPickup: 30,
      bugDefeat: 120,
      rocketPickup: 200,
    };
    const layout = options.layout ?? MOBILE_HUD_LAYOUT;

    let activeInfoKey = null;
    const effects = [];

    function getTouchAction(point) {
      if (!point) {
        return null;
      }

      if (pointInCircle(point, layout.leftPad)) {
        return "left";
      }
      if (pointInCircle(point, layout.rightPad)) {
        return "right";
      }
      if (pointInCircle(point, layout.jumpPad)) {
        return "jump";
      }
      return "tap";
    }

    function clearActiveInfo() {
      activeInfoKey = null;
    }

    function toggleActiveInfo(key) {
      activeInfoKey = activeInfoKey === key ? null : key;
      return activeInfoKey;
    }

    function getActiveInfoKey() {
      return activeInfoKey;
    }

    function createBugLedger(counts) {
      const safeCounts = counts ?? {};
      const openInRun =
        (safeCounts.activeWorld ?? 0) +
        (safeCounts.missed ?? 0) +
        (safeCounts.backlog ?? 0) +
        (safeCounts.reactivated ?? 0);

      return {
        spawnedInRun: safeCounts.totalKnown ?? 0,
        resolvedInRun: safeCounts.resolved ?? 0,
        openInRun,
        activeInWorld: safeCounts.activeWorld ?? 0,
        missedInRun: safeCounts.missed ?? 0,
        backlog: safeCounts.backlog ?? 0,
        reactivatedInRun: safeCounts.reactivated ?? 0,
      };
    }

    function createRunModel(context) {
      return {
        resources: {
          currencyCents: context.runState.currencyCents,
          lives: context.player.lives,
          euroRatePerHour: context.euroRatePerHour,
        },
        bugs: context.bugLedger,
        score: context.scoreBreakdown,
        balanceMultiplier: context.balanceMultiplier,
      };
    }

    function createHudStats(context) {
      const runModel = context.runModel;
      return [
        {
          key: "bugsOpen",
          emoji: "🐞",
          label: "Offene Bugs",
          value: String(runModel.bugs.openInRun),
          accent: "#ffc48c",
          sectionX: 24,
          valueX: 64,
          hitArea: { x: 0, y: 0, w: 192, h: 44 },
          target: { x: 52, y: 42 },
          tooltip: [
            "Zeigt offene Bugs im aktuellen Run.",
            `Im Run gespawnt: ${runModel.bugs.spawnedInRun}`,
            `Aktiv in der Welt: ${runModel.bugs.activeInWorld}`,
            `Verpasst: ${runModel.bugs.missedInRun}`,
            `Im Run geloest: ${runModel.bugs.resolvedInRun}`,
            `Backlog: ${runModel.bugs.backlog}`,
            "Je mehr offene Bugs, desto seltener kommen Einnahmequellen um Moneten zu verdienen.",
          ],
        },
        {
          key: "gems",
          emoji: "€",
          label: "Moneten",
          value: formatEuroAmount(runModel.resources.currencyCents),
          accent: "#ffe37a",
          sectionX: 216,
          valueX: 256,
          hitArea: { x: 192, y: 0, w: 192, h: 44 },
          target: { x: 244, y: 42 },
          tooltip: [
            "Jedes Euro-Symbol bringt 10 ct.",
            "Moneten sind die direkte Einkommens-Ressource dieses Runs.",
            "Weitere Ressourcenarten koennen spaeter hinzukommen, ohne diese Anzeige umzudeuten.",
          ],
        },
        {
          key: "euroRate",
          emoji: "€/h",
          label: "Euro pro Stunde",
          value: String(runModel.resources.euroRatePerHour),
          accent: "#ffe8a3",
          sectionX: 408,
          valueX: 456,
          hitArea: { x: 384, y: 0, w: 192, h: 44 },
          target: { x: 436, y: 42 },
          tooltip: [
            "Zeigt dein aktuelles Sammeltempo hochgerechnet auf eine Stunde.",
            "Basiert nur auf Moneten und der bisherigen Laufzeit dieses Runs.",
            `Spieldauer: ${formatRunDuration(context.worldTimeMs)}`,
            `Balance-Faktor: x${runModel.balanceMultiplier.toFixed(2).replace(".", ",")}`,
          ],
        },
        {
          key: "lives",
          emoji: "🚀",
          label: "Leben",
          value: String(runModel.resources.lives),
          accent: "#ffd27d",
          sectionX: 600,
          valueX: 641,
          hitArea: { x: 576, y: 0, w: 192, h: 44 },
          target: { x: 628, y: 42 },
          tooltip: ["Treffer und Stürze kosten ein Leben.", "Raketen schenken dir ein Extraleben."],
        },
        {
          key: "score",
          emoji: "⭐",
          label: "Punkte",
          value: String(runModel.score.total),
          accent: "#fff1b8",
          sectionX: 792,
          valueX: 832,
          hitArea: { x: 768, y: 0, w: 192, h: 44 },
          target: { x: 820, y: 42 },
          tooltip: [
            `Euro-Symbol: ${scoreConfig.gemPickup}`,
            `Bug fixen: ${scoreConfig.bugDefeat}`,
            `Rakete einsammeln: ${scoreConfig.rocketPickup}`,
            `Aktionspunkte: ${runModel.score.action}`,
            `Fortschrittspunkte: ${runModel.score.progress}`,
            "Fortschrittspunkte sind monoton und gehen durch spaetere Balance-Schwankungen nicht verloren.",
            "Balance lebt von Einnahmen und wenigen offenen Bugs.",
            context.canPersistHighScore
              ? `Highscore: ${context.highScore}`
              : "Debug-Run speichert keinen Highscore.",
          ],
        },
      ];
    }

    function getHudStatByKey(stats, key) {
      return stats.find((stat) => stat.key === key) ?? null;
    }

    function getHudInfoHit(stats, point) {
      return stats.find((stat) => pointInRect(point, stat.hitArea)) ?? null;
    }

    function spawnHudEffect(worldX, worldY, emoji, statKey, options) {
      const stats = options.stats;
      const targetStat = getHudStatByKey(stats, statKey);
      if (!targetStat) {
        return false;
      }

      effects.push({
        emoji,
        color: targetStat.key === "gems" ? "#ffe37a" : null,
        t: 0,
        duration: 900,
        startX: worldX - options.cameraX,
        startY: worldY,
        targetX: targetStat.target.x,
        targetY: targetStat.target.y,
      });
      return true;
    }

    function updateEffects(delta) {
      for (let index = effects.length - 1; index >= 0; index -= 1) {
        effects[index].t += delta;
        if (effects[index].t >= effects[index].duration) {
          effects.splice(index, 1);
        }
      }
    }

    function drawEffects(ctx) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      effects.forEach((effect) => {
        const progress = clamp(effect.t / effect.duration, 0, 1);
        const eased = 1 - (1 - progress) * (1 - progress);
        const arcLift = Math.sin(progress * Math.PI) * 22;
        const x = effect.startX + (effect.targetX - effect.startX) * eased;
        const y = effect.startY + (effect.targetY - effect.startY) * eased - arcLift;
        const scale = 1 - progress * 0.18;
        const alpha = 1 - progress * 0.88;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = effect.color ?? "#fff6ea";
        ctx.strokeStyle = effect.color ? "#9a6a00" : "transparent";
        ctx.lineWidth = effect.color ? 2 : 0;
        ctx.font = effect.color
          ? `${Math.round(28 * scale)}px Trebuchet MS`
          : `${Math.round(28 * scale)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        if (effect.color) {
          ctx.strokeText(effect.emoji, x, y);
        }
        ctx.fillText(effect.emoji, x, y);
      });

      ctx.restore();
    }

    function drawHud(ctx, canvas, options) {
      const stats = options.stats;
      const keys = options.keys;
      const jumpActive = options.jumpButtonGlow > 0;
      const showUpdatePrompt = options.showUpdatePrompt;
      let updateButtonRect = null;

      ctx.save();
      ctx.font = "700 18px Trebuchet MS";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      const panel = layout.topBar;
      ctx.fillStyle = "rgba(14, 10, 18, 0.54)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(panel.x, panel.y, panel.w, panel.h);
      ctx.fill();
      ctx.stroke();

      stats.forEach((stat) => {
        ctx.fillStyle = stat.accent;
        ctx.font = `700 19px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.fillText(stat.emoji, stat.sectionX, 24);
        ctx.font = "700 24px Trebuchet MS";
        ctx.fillText(String(stat.value), stat.valueX, 23);
      });

      [192, 384, 576, 768].forEach((x) => {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 2);
        ctx.lineTo(x, 40);
        ctx.stroke();
      });

      if (activeInfoKey) {
        const stat = getHudStatByKey(stats, activeInfoKey);
        if (stat) {
          ctx.font = "14px Trebuchet MS";
          const wrappedLines = stat.tooltip.flatMap((line) =>
            wrapTextLines(ctx, line, stat.key === "score" ? 222 : 192)
          );
          const tooltipWidth = stat.key === "score" ? 250 : 220;
          const tooltipX = clamp(stat.sectionX - 6, 18, canvas.width - tooltipWidth - 18);
          const tooltipY = panel.y + panel.h + 8;
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

      if (showUpdatePrompt) {
        const cardX = canvas.width - 286;
        const cardY = panel.y + panel.h + 10;
        const cardW = 268;
        const cardH = 136;
        const buttonW = 128;
        const buttonH = 34;
        const buttonX = cardX + 16;
        const buttonY = cardY + cardH - buttonH - 14;

        ctx.fillStyle = "rgba(24, 17, 31, 0.95)";
        ctx.strokeStyle = "rgba(255, 241, 220, 0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fff4e5";
        ctx.font = "700 17px Trebuchet MS";
        ctx.fillText("Update verfügbar", cardX + 16, cardY + 22);

        ctx.fillStyle = "#ffd5b3";
        ctx.font = "15px Trebuchet MS";
        ctx.fillText("Neue Version ist bereit.", cardX + 16, cardY + 48);
        ctx.fillText("Tippe unten auf Update.", cardX + 16, cardY + 64);

        updateButtonRect = { x: buttonX, y: buttonY, w: buttonW, h: buttonH };
        ctx.fillStyle = "rgba(255, 214, 156, 0.94)";
        ctx.strokeStyle = "rgba(255, 246, 232, 0.78)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(buttonX, buttonY, buttonW, buttonH, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#4c2412";
        ctx.font = "700 18px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText("Update", buttonX + buttonW / 2, buttonY + 19);
        ctx.textAlign = "left";
      }

      const drawControl = (circle, active, accent, kind) => {
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
        if (kind === "jump") {
          ctx.font = "700 42px Trebuchet MS";
          ctx.textAlign = "center";
          ctx.fillText("▲", circle.cx, circle.cy + 2);
          ctx.textAlign = "left";
          return;
        }

        const direction = kind === "left" ? 1 : -1;
        ctx.save();
        ctx.translate(circle.cx, circle.cy);
        ctx.scale(direction, 1);
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(10, -16);
        ctx.lineTo(10, 16);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      if (options.isTouchDevice && options.gameState !== "lost") {
        drawControl(layout.leftPad, keys.left, "rgba(255, 255, 255, 0.36)", "left");
        drawControl(layout.rightPad, keys.right, "rgba(255, 255, 255, 0.36)", "right");
        drawControl(layout.jumpPad, jumpActive, "rgba(255, 255, 255, 0.42)", "jump");
      }

      ctx.restore();
      return { updateButtonRect };
    }

    function drawSpecialEventStatus(ctx, eventInfo, options = {}) {
      if (
        !eventInfo ||
        eventInfo.phase !== options.activePhase ||
        options.gameState !== "playing" ||
        options.playerHurtTimer > 0 ||
        options.resumeCountdownTimer > 0
      ) {
        return false;
      }

      const remaining = Math.max(0, Math.ceil(eventInfo.timer / 1000));
      const badgeX = 18;
      const badgeY = layout.topBar.y + layout.topBar.h + 10;
      const badgeW = 238;
      const badgeH = 52;

      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(28, 17, 22, 0.92)";
      ctx.strokeStyle = "rgba(255, 231, 201, 0.22)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fff3e3";
      ctx.font = "700 18px Trebuchet MS";
      ctx.fillText(eventInfo.title, badgeX + 14, badgeY + 21);
      ctx.fillStyle = "#ffd5b3";
      ctx.font = "15px Trebuchet MS";
      ctx.fillText(`${remaining}s verbleibend`, badgeX + 14, badgeY + 40);
      ctx.restore();
      return true;
    }

    return {
      layout,
      clearActiveInfo,
      toggleActiveInfo,
      getActiveInfoKey,
      getTouchAction,
      formatRunDuration,
      formatEuroAmount,
      createBugLedger,
      createRunModel,
      createHudStats,
      getHudStatByKey,
      getHudInfoHit,
      spawnHudEffect,
      updateEffects,
      drawEffects,
      drawHud,
      drawSpecialEventStatus,
    };
  }

  globalScope.RedDuneHudRuntime = Object.freeze({
    MOBILE_HUD_LAYOUT,
    createHudRuntime,
  });
})(typeof self !== "undefined" ? self : globalThis);
