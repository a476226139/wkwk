const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const app = document.querySelector(".app");
const hud = document.querySelector("#hud");
const hudEyebrow = document.querySelector(".eyebrow");
const hudTitle = document.querySelector(".hud__brand h1");
const hudShortcut = document.querySelector("#hudShortcut");
const skillPanel = document.querySelector("#skillPanel");
const skillIconWrap = document.querySelector("#skillIconWrap");
const skillCooldownMask = document.querySelector("#skillCooldownMask");
const skillCount = document.querySelector("#skillCount");
const skillHud = document.querySelector("#skillHud");
const moveSkillPanel = document.querySelector("#moveSkillPanel");
const moveSkillItems = Array.from(document.querySelectorAll(".move-skill"));
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");

const allyImage = new Image();
allyImage.src = "./14487.png";
const menuTitleImage = new Image();
menuTitleImage.src = "./13894.png";

const markerImages = {
  cloud: new Image(),
  sword: new Image(),
  axe: new Image(),
};
markerImages.cloud.src = "./0.png";
markerImages.sword.src = "./1.png";
markerImages.axe.src = "./2.png";

const Mode = {
  MENU: "menu",
  LANTERN: "lantern",
  CONTROL: "control",
};

const BOARD = {
  cols: 50,
  rows: 60,
  padding: 3,
  minDistance: 7,
};

const LANTERN_SKILL = {
  cooldown: 15,
  castCooldown: 1,
  range: 20,
  moveCooldown: 6,
  moveRange: 25,
  maxNodeDistance: 40,
  nodeLifetime: 90,
  nodeDiameter: 6,
  maxCharges: 3,
};

const LANTERN_MOVEMENT = {
  speed: 20,
};

const UI = {
  bg: "rgb(72, 52, 97)",
  panel: "rgba(248, 248, 184, 0.08)",
  panelStroke: "rgba(248, 248, 184, 0.16)",
  textMain: "rgb(248, 248, 184)",
  textSub: "rgba(248, 248, 184, 0.78)",
  textDim: "rgba(248, 248, 184, 0.52)",
  textDark: "rgb(72, 52, 97)",
  boardFill: "rgba(17, 10, 28, 0.2)",
  boardStroke: "rgba(248, 248, 184, 0.22)",
  enemyDot: "rgb(226, 74, 93)",
  enemyGlow: "rgba(226, 74, 93, 0.32)",
  white: "rgba(255, 255, 255, 0.92)",
  skillNodeOuter: "rgba(132, 86, 210, 0.92)",
  skillNodeInner: "rgba(205, 183, 255, 0.96)",
  skillLine: "rgba(184, 150, 255, 0.72)",
  skillFill: "rgba(154, 110, 235, 0.12)",
  skillRange: "rgba(184, 150, 255, 0.22)",
};

const LANTERN_RESULT = {
  noticeDuration: 1.2,
  resetDelay: 1.05,
};

const enemyMarkers = [
  { id: "cloud" },
  { id: "sword" },
  { id: "axe" },
];

let WIDTH = 900;
let HEIGHT = 560;
let dpr = window.devicePixelRatio || 1;
let layoutDirty = true;

const layoutCache = {
  arena: null,
  playfield: null,
  menuButtons: [],
  backButton: null,
};

const lanternAgent = new window.LanternAgent({
  board: BOARD,
  skill: LANTERN_SKILL,
  movement: LANTERN_MOVEMENT,
  enemyMarkers,
});

const game = {
  mode: Mode.MENU,
  now: 0,
  lastTimestamp: 0,
  pulseTime: 0,
  activeMoveSkillId: null,
  lanternNoticeText: "",
  lanternNoticeUntil: 0,
  lanternResetAt: null,
  lantern: lanternAgent,
};

// 添加：跟踪鼠标在 Canvas 内的位置（像素）
let mouseX = 0;
let mouseY = 0;

function layout() {
  const arena = {
    x: 32,
    y: 72,
    w: WIDTH - 64,
    h: HEIGHT - 112,
  };

  let availableX = arena.x + 28;
  let availableY = arena.y + 28;
  let availableW = arena.w - 56;
  let availableH = arena.h - 56;

  if (game.mode === Mode.LANTERN) {
    availableX = Math.max(32, WIDTH * 0.08);
    availableY = 92;
    availableW = WIDTH - availableX * 2;
    availableH = HEIGHT - 128;
  }

  const cellSize = Math.min(availableW / BOARD.cols, availableH / BOARD.rows);
  const boardW = cellSize * BOARD.cols;
  const boardH = cellSize * BOARD.rows;

  layoutCache.arena = arena;
  layoutCache.playfield = {
    x: availableX + (availableW - boardW) / 2,
    y: availableY + (availableH - boardH) / 2,
    w: boardW,
    h: boardH,
    cellW: cellSize,
    cellH: cellSize,
  };
  layoutCache.backButton = {
    x: 24,
    y: 20,
    w: 108,
    h: 44,
    label: "返回",
  };
  layoutCache.menuButtons = [
    {
      mode: Mode.LANTERN,
      label: "放灯模拟器",
      x: WIDTH / 2 - 150,
      y: HEIGHT * 0.34,
      w: 300,
      h: 72,
    },
    {
      mode: Mode.CONTROL,
      label: "免控模拟器",
      x: WIDTH / 2 - 150,
      y: HEIGHT * 0.62,
      w: 300,
      h: 72,
    },
  ];

  layoutDirty = false;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  WIDTH = rect.width;
  HEIGHT = rect.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layoutDirty = true;
}

function ensureLayout() {
  if (layoutDirty) {
    layout();
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function syncHud() {
  const isMenu = game.mode === Mode.MENU;
  app.classList.toggle("is-menu", isMenu);
  app.classList.toggle("is-lantern", game.mode === Mode.LANTERN);
  hud.hidden = isMenu;

  if (game.mode === Mode.LANTERN) {
    hudEyebrow.textContent = "Lantern Simulator";
    hudTitle.textContent = "放灯模拟器";
    hudShortcut.hidden = false;
    skillHud.hidden = false;
    skillPanel.hidden = false;
    moveSkillPanel.hidden = false;
    startButton.hidden = true;
    resetButton.hidden = false;
    resetButton.textContent = "重置";
  } else if (game.mode === Mode.CONTROL) {
    hudEyebrow.textContent = "Control Simulator";
    hudTitle.textContent = "免控模拟器";
    hudShortcut.hidden = true;
    skillHud.hidden = true;
    skillPanel.hidden = true;
    moveSkillPanel.hidden = true;
    startButton.hidden = true;
    resetButton.hidden = true;
  } else {
    hudEyebrow.textContent = "Canvas Framework";
    hudTitle.textContent = "太玄经模拟器";
    hudShortcut.hidden = true;
    skillHud.hidden = true;
    skillPanel.hidden = true;
    moveSkillPanel.hidden = true;
    startButton.hidden = false;
    resetButton.hidden = false;
  }

  resizeCanvas();
  updateSkillPanel(game.now);
  updateMoveSkillPanel(game.now);
}

function enterMenu() {
  game.mode = Mode.MENU;
  game.activeMoveSkillId = null;
  clearLanternNotice();
  syncHud();
}

function selectMode(mode) {
  game.mode = mode;
  game.activeMoveSkillId = null;
  clearLanternNotice();
  if (mode === Mode.LANTERN) {
    resetLanternScene();
  }
  syncHud();
}

function resetLanternSkill() {
  game.lantern.resetSkill(game.now);
}

function clearLanternNotice() {
  game.lanternNoticeText = "";
  game.lanternNoticeUntil = 0;
  game.lanternResetAt = null;
}

function resetLanternScene() {
  game.lantern.resetScene(game.now);
  game.activeMoveSkillId = null;
  clearLanternNotice();
  updateSkillPanel(game.now);
  updateMoveSkillPanel(game.now);
}

function triggerLanternPerfectReset(now) {
  if (game.lanternResetAt !== null) {
    return;
  }

  game.activeMoveSkillId = null;
  game.lanternNoticeText = "完美连局！";
  game.lanternNoticeUntil = now + LANTERN_RESULT.noticeDuration;
  game.lanternResetAt = now + LANTERN_RESULT.resetDelay;
  updateMoveSkillPanel(now);
}

function getReadyChargeCount(now) {
  return game.lantern.getReadyChargeCount(now);
}

function updateSkillPanel(now = 0) {
  if (game.mode !== Mode.LANTERN) {
    skillPanel.hidden = true;
    return;
  }

  skillPanel.hidden = false;
  const readyCount = getReadyChargeCount(now);
  skillCount.textContent = String(readyCount);

  const castCooldownRemaining = Math.max(0, game.lantern.skill.castCooldownUntil - now);
  const castCooldownProgress = castCooldownRemaining > 0
    ? clamp(castCooldownRemaining / LANTERN_SKILL.castCooldown, 0, 1)
    : 0;
  const rechargeRemaining = readyCount <= 0 && game.lantern.skill.nextChargeReadyAt !== null
    ? Math.max(0, game.lantern.skill.nextChargeReadyAt - now)
    : 0;
  const rechargeProgress = rechargeRemaining > 0
    ? clamp(rechargeRemaining / LANTERN_SKILL.cooldown, 0, 1)
    : 0;
  const overlayProgress = readyCount <= 0
    ? rechargeProgress
    : castCooldownProgress;

  skillCooldownMask.hidden = overlayProgress <= 0;
  skillIconWrap.style.setProperty("--cooldown-progress", `${overlayProgress}turn`);
}

function updateMoveSkillPanel(now = 0) {
  if (game.mode !== Mode.LANTERN) {
    moveSkillPanel.hidden = true;
    return;
  }

  moveSkillPanel.hidden = false;
  const cooldownRemaining = Math.max(0, game.lantern.skill.moveCooldownUntil - now);
  const cooldownProgress = cooldownRemaining > 0
    ? clamp(cooldownRemaining / LANTERN_SKILL.moveCooldown, 0, 1)
    : 0;

  for (const item of moveSkillItems) {
    const nodeId = Number(item.dataset.moveSkill);
    const mask = item.querySelector(".move-skill__mask");
    const wrap = item.querySelector(".move-skill__icon-wrap");
    const hasNode = game.lantern.skill.nodes.some((node) => node.id === nodeId);

    item.classList.toggle("is-active", game.activeMoveSkillId === nodeId);
    item.classList.toggle("is-unavailable", !hasNode);
    mask.hidden = cooldownProgress <= 0;
    wrap.style.setProperty("--cooldown-progress", `${cooldownProgress}turn`);
  }
}

function logicPointToPixel(point) {
  ensureLayout();
  const board = layoutCache.playfield;
  return {
    x: board.x + (point.x / BOARD.cols) * board.w,
    y: board.y + (point.y / BOARD.rows) * board.h,
  };
}

function logicCellToPixel(point) {
  return logicPointToPixel({
    x: point.x + 0.5,
    y: point.y + 0.5,
  });
}

function pixelToLogicPoint(point) {
  ensureLayout();
  const board = layoutCache.playfield;
  return {
    x: ((point.x - board.x) / board.w) * BOARD.cols,
    y: ((point.y - board.y) / board.h) * BOARD.rows,
  };
}

function getAllyLogicalCenter() {
  return game.lantern.getAllyCenter();
}

function getSkillNodeRadiusPx() {
  ensureLayout();
  return Math.max(6, layoutCache.playfield.cellW * 0.46);
}

function getClampedSkillTarget(pixelPoint) {
  return game.lantern.getClampedSkillTarget(pixelToLogicPoint(pixelPoint));
}

function getClampedMoveTarget(pixelPoint) {
  return game.lantern.getClampedMoveTarget(pixelToLogicPoint(pixelPoint));
}

function setLanternMoveTarget(pixelPoint) {
  if (game.mode !== Mode.LANTERN || !game.lantern.ally) {
    return;
  }

  game.lantern.setMoveTarget(getClampedMoveTarget(pixelPoint));
}

function castLanternSkill(pixelPoint) {
  if (game.mode !== Mode.LANTERN) {
    return;
  }

  const target = getClampedSkillTarget(pixelPoint);
  if (!target) {
    return;
  }

  game.lantern.castSkill(target, game.now);
  updateSkillPanel(game.now);
  updateMoveSkillPanel(game.now);
}

function castMoveLanternSkill(nodeId, pixelPoint) {
  if (game.mode !== Mode.LANTERN) {
    return false;
  }

  const target = game.lantern.getClampedMoveNodeTarget(pixelToLogicPoint(pixelPoint));
  if (!target) {
    return false;
  }

  const moved = game.lantern.moveSkillNode(nodeId, target, game.now);
  updateMoveSkillPanel(game.now);
  return moved;
}

function updateLanternMovement(delta) {
  if (game.mode !== Mode.LANTERN) {
    return;
  }

  game.lantern.updateMovement(delta);
}

function updateLanternSkillNodes(now) {
  if (game.mode !== Mode.LANTERN) {
    return;
  }

  game.lantern.updateSkillNodes(now);
}

function updateLanternResult(now) {
  if (game.mode !== Mode.LANTERN) {
    return;
  }

  if (game.lanternResetAt !== null) {
    if (now >= game.lanternResetAt) {
      resetLanternScene();
    }
    return;
  }

  if (game.lantern.areAllEnemiesCoveredByTriangle()) {
    triggerLanternPerfectReset(now);
  }
}

function drawRoundedRect(x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function drawDefaultBackground() {
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const baseGradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  baseGradient.addColorStop(0, "rgba(90, 61, 122, 0.95)");
  baseGradient.addColorStop(1, "rgba(72, 52, 97, 0.98)");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH * 0.24, HEIGHT * 0.16, 20, WIDTH * 0.24, HEIGHT * 0.16, WIDTH * 0.75);
  glow.addColorStop(0, "rgba(245, 241, 89, 0.18)");
  glow.addColorStop(1, "rgba(245, 241, 89, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const vignette = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.45, WIDTH * 0.2, WIDTH * 0.5, HEIGHT * 0.45, WIDTH * 0.8);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawBackgroundMotifs();
}

function drawLanternBackground() {
  const baseGradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  baseGradient.addColorStop(0, "rgb(52, 37, 76)");
  baseGradient.addColorStop(0.55, "rgb(44, 31, 68)");
  baseGradient.addColorStop(1, "rgb(26, 18, 42)");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const centerGlow = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.36, 30, WIDTH * 0.5, HEIGHT * 0.36, WIDTH * 0.55);
  centerGlow.addColorStop(0, "rgba(112, 82, 146, 0.34)");
  centerGlow.addColorStop(1, "rgba(112, 82, 146, 0)");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const topGlow = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.12, 10, WIDTH * 0.5, HEIGHT * 0.12, WIDTH * 0.34);
  topGlow.addColorStop(0, "rgba(248, 248, 184, 0.08)");
  topGlow.addColorStop(1, "rgba(248, 248, 184, 0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const vignette = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.42, WIDTH * 0.12, WIDTH * 0.5, HEIGHT * 0.42, WIDTH * 0.9);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawBackgroundMotifs() {
  ctx.save();

  ctx.strokeStyle = "rgba(248, 248, 184, 0.08)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i += 1) {
    const y = HEIGHT * (0.18 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(WIDTH * 0.22, y - 18, WIDTH * 0.72, y + 22, WIDTH, y - 10);
    ctx.stroke();
  }

  drawBigDipper();
  drawStarDust();
  ctx.restore();
}

function drawBigDipper() {
  const stars = [
    { x: WIDTH * 0.18, y: HEIGHT * 0.26, r: 5.2 },
    { x: WIDTH * 0.26, y: HEIGHT * 0.22, r: 4.6 },
    { x: WIDTH * 0.35, y: HEIGHT * 0.25, r: 5.4 },
    { x: WIDTH * 0.44, y: HEIGHT * 0.31, r: 4.8 },
    { x: WIDTH * 0.56, y: HEIGHT * 0.37, r: 4.8 },
    { x: WIDTH * 0.66, y: HEIGHT * 0.34, r: 4.6 },
    { x: WIDTH * 0.76, y: HEIGHT * 0.28, r: 5.6 },
  ];

  ctx.strokeStyle = "rgba(245, 241, 89, 0.24)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(stars[0].x, stars[0].y);
  for (let i = 1; i < stars.length; i += 1) {
    ctx.lineTo(stars[i].x, stars[i].y);
  }
  ctx.stroke();

  for (const star of stars) {
    const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r * 5);
    glow.addColorStop(0, "rgba(248, 248, 184, 0.95)");
    glow.addColorStop(0.3, "rgba(245, 241, 89, 0.72)");
    glow.addColorStop(1, "rgba(245, 241, 89, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r * 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgb(248, 248, 184)";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStarDust() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let i = 0; i < 16; i += 1) {
    const x = (i * 83 + 37) % WIDTH;
    const y = (i * 59 + 19) % HEIGHT;
    ctx.beginPath();
    ctx.arc(x, y, (i % 3) + 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawArenaPanel() {
  ensureLayout();
  const arena = layoutCache.arena;

  ctx.fillStyle = UI.panel;
  drawRoundedRect(arena.x, arena.y, arena.w, arena.h, 24);

  ctx.strokeStyle = UI.panelStroke;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(arena.x, arena.y, arena.w, arena.h);
}

function drawPlayfield() {
  ensureLayout();
  const board = layoutCache.playfield;

  const glow = ctx.createRadialGradient(
    board.x + board.w / 2,
    board.y + board.h * 0.28,
    30,
    board.x + board.w / 2,
    board.y + board.h / 2,
    board.h * 0.72
  );
  glow.addColorStop(0, "rgba(245, 241, 89, 0.12)");
  glow.addColorStop(1, "rgba(245, 241, 89, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(board.x - 80, board.y - 80, board.w + 160, board.h + 160);

  ctx.fillStyle = UI.boardFill;
  drawRoundedRect(board.x, board.y, board.w, board.h, 20);

  ctx.strokeStyle = UI.boardStroke;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(board.x, board.y, board.w, board.h);

  ctx.strokeStyle = "rgba(248, 248, 184, 0.08)";
  ctx.lineWidth = 1;
  for (let col = 10; col < BOARD.cols; col += 10) {
    const x = board.x + (col / BOARD.cols) * board.w;
    ctx.beginPath();
    ctx.moveTo(x, board.y);
    ctx.lineTo(x, board.y + board.h);
    ctx.stroke();
  }

  for (let row = 10; row < BOARD.rows; row += 10) {
    const y = board.y + (row / BOARD.rows) * board.h;
    ctx.beginPath();
    ctx.moveTo(board.x, y);
    ctx.lineTo(board.x + board.w, y);
    ctx.stroke();
  }

}

function drawMenuButtons() {
  if (game.mode !== Mode.MENU) {
    return;
  }

  for (const button of layoutCache.menuButtons) {
    const gradient = ctx.createLinearGradient(button.x, button.y, button.x, button.y + button.h);
    gradient.addColorStop(0, "rgb(245, 241, 89)");
    gradient.addColorStop(1, "rgb(213, 196, 76)");

    ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = gradient;
    drawRoundedRect(button.x, button.y, button.w, button.h, 22);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = "rgba(248, 248, 184, 0.18)";
    drawRoundedRect(button.x + 2, button.y + 2, button.w - 4, 18, 16);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(button.x + 1.5, button.y + 1.5, button.w - 3, button.h - 3);

    ctx.fillStyle = UI.textDark;
    ctx.textAlign = "center";
    ctx.font = 'bold 26px "Microsoft YaHei", Arial';
    ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 9);
  }
}

function drawMenuHeader() {
  if (game.mode !== Mode.MENU) {
    return;
  }

  const iconSize = Math.min(76, WIDTH * 0.09);
  const gap = 14;
  const text = "太玄经模拟器";
  const titleX = WIDTH / 2;
  const titleY = HEIGHT * 0.2;
  const textWidth = ctx.measureText ? (() => {
    ctx.save();
    ctx.font = 'bold 38px "Microsoft YaHei", Arial';
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  })() : 220;
  const totalWidth = iconSize + gap + textWidth;
  const startX = titleX - totalWidth / 2;

  if (menuTitleImage.complete && menuTitleImage.naturalWidth > 0) {
    ctx.drawImage(menuTitleImage, startX, titleY - iconSize * 0.72, iconSize, iconSize);
  }

  ctx.textAlign = "left";
  ctx.fillStyle = UI.textMain;
  ctx.font = 'bold 38px "Microsoft YaHei", Arial';
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 12;
  ctx.fillText(text, startX + iconSize + gap, titleY);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

function drawBackButton() {
  if (game.mode === Mode.MENU) {
    return;
  }

  const button = layoutCache.backButton;
  const gradient = ctx.createLinearGradient(button.x, button.y, button.x, button.y + button.h);
  gradient.addColorStop(0, "rgba(248, 248, 184, 0.18)");
  gradient.addColorStop(1, "rgba(245, 241, 89, 0.12)");

  ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = gradient;
  drawRoundedRect(button.x, button.y, button.w, button.h, 16);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = "rgba(248, 248, 184, 0.24)";
  ctx.lineWidth = 1;
  ctx.strokeRect(button.x + 0.5, button.y + 0.5, button.w - 1, button.h - 1);

  ctx.fillStyle = UI.textMain;
  ctx.textAlign = "center";
  ctx.font = 'bold 18px "Microsoft YaHei", Arial';
  ctx.fillText(button.label, button.x + button.w / 2, button.y + 28);
}

function drawCloudMarker(x, y, scale) {
  ctx.fillStyle = UI.white;
  ctx.beginPath();
  ctx.arc(x - scale * 0.5, y, scale * 0.36, Math.PI * 0.9, Math.PI * 2.05);
  ctx.arc(x, y - scale * 0.1, scale * 0.46, Math.PI, Math.PI * 2);
  ctx.arc(x + scale * 0.48, y + scale * 0.02, scale * 0.34, Math.PI, Math.PI * 2.05);
  ctx.closePath();
  ctx.fill();
}

function drawSwordMarker(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = UI.white;
  ctx.fillStyle = UI.white;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, scale * 0.52);
  ctx.lineTo(0, -scale * 0.22);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -scale * 0.42);
  ctx.lineTo(scale * 0.14, -scale * 0.12);
  ctx.lineTo(0, -scale * 0.18);
  ctx.lineTo(-scale * 0.14, -scale * 0.12);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-scale * 0.22, scale * 0.05);
  ctx.lineTo(scale * 0.22, scale * 0.05);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, scale * 0.52);
  ctx.lineTo(scale * 0.12, scale * 0.68);
  ctx.lineTo(0, scale * 0.62);
  ctx.lineTo(-scale * 0.12, scale * 0.68);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAxeMarker(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);

  ctx.strokeStyle = UI.white;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-scale * 0.05, scale * 0.56);
  ctx.lineTo(scale * 0.08, -scale * 0.42);
  ctx.stroke();

  ctx.fillStyle = UI.white;
  ctx.beginPath();
  ctx.moveTo(scale * 0.02, -scale * 0.18);
  ctx.quadraticCurveTo(scale * 0.42, -scale * 0.34, scale * 0.38, scale * 0.08);
  ctx.lineTo(scale * 0.1, scale * 0.14);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(scale * 0.02, -scale * 0.08);
  ctx.lineTo(-scale * 0.18, -scale * 0.24);
  ctx.lineTo(-scale * 0.06, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemyMarker(marker, x, y, scale) {
  const image = markerImages[marker];
  if (image && image.complete && image.naturalWidth > 0) {
    const aspect = image.naturalWidth / image.naturalHeight;
    const height = scale * 1.5;
    const width = height * aspect;
    ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
    return;
  }

  if (marker === "cloud") {
    drawCloudMarker(x, y, scale);
    return;
  }

  if (marker === "sword") {
    drawSwordMarker(x, y, scale);
    return;
  }

  drawAxeMarker(x, y, scale);
}

function drawEnemy(enemy) {
  const center = logicCellToPixel(enemy);
  const radius = Math.max(6, layoutCache.playfield.cellW * 0.42);
  const markerScale = Math.max(16, layoutCache.playfield.cellW * 1.8);
  const markerY = center.y - radius - markerScale * 1.1;

  const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 3.8);
  glow.addColorStop(0, UI.enemyGlow);
  glow.addColorStop(1, "rgba(226, 74, 93, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = UI.enemyDot;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.arc(center.x - radius * 0.28, center.y - radius * 0.28, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();

  drawEnemyMarker(enemy.marker, center.x, markerY, markerScale);
}

function drawAlly() {
  if (!game.lantern.ally) {
    return;
  }

  const center = logicPointToPixel(game.lantern.ally);
  const width = Math.max(26, layoutCache.playfield.cellW * 3.1);
  const height = width * 1.08;

  ctx.save();
  ctx.shadowColor = "rgba(248, 248, 184, 0.12)";
  ctx.shadowBlur = 18;

  if (allyImage.complete && allyImage.naturalWidth > 0) {
    ctx.drawImage(allyImage, center.x - width / 2, center.y - height / 2, width, height);
  } else {
    ctx.fillStyle = UI.textMain;
    ctx.beginPath();
    ctx.arc(center.x, center.y, width * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawLanternTriangle() {
  if (game.lantern.skill.nodes.length !== 3) {
    return;
  }

  const points = game.lantern.skill.nodes
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((node) => logicPointToPixel(node));

  // ====== 绚丽LED特效连线 ======
  ctx.save();
  ctx.lineWidth = 8;
  ctx.shadowColor = "rgba(180,132,255,0.85)";
  ctx.shadowBlur = 18;

  // 动态渐变色，随时间变换
  const t = Date.now() / 600;
  function getColor(offset) {
    return `hsl(${(t * 60 + offset) % 360},100%,65%)`;
  }

  // 三条边分别渐变
  for (let i = 0; i < 3; i++) {
    const a = points[i];
    const b = points[(i + 1) % 3];
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, getColor(i * 120));
    grad.addColorStop(1, getColor((i + 1) * 120));
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // 可选：三角形内发光
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = getColor(60);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.lineTo(points[2].x, points[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawLanternSkillNode(node) {
  const center = logicPointToPixel(node);
  const radius = getSkillNodeRadiusPx();
  const labelY = center.y - radius - Math.max(12, radius * 1.4);
  const allyCenter = getAllyLogicalCenter();
  const distance = allyCenter
    ? Math.hypot(node.x - allyCenter.x, node.y - allyCenter.y)
    : 0;
  const distanceLabel = `${distance.toFixed(1)}尺`;
  const distanceY = center.y + radius + Math.max(16, radius * 1.8);

  const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 2.8);
  glow.addColorStop(0, "rgba(180, 132, 255, 0.44)");
  glow.addColorStop(1, "rgba(180, 132, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = UI.skillNodeOuter;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = UI.skillNodeInner;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = UI.white;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `bold ${Math.max(14, radius * 1.35)}px "Microsoft YaHei", Arial`;
  ctx.fillText(String(node.id), center.x, labelY);

  ctx.fillStyle = UI.textSub;
  ctx.font = `12px "Microsoft YaHei", Arial`;
  ctx.fillText(distanceLabel, center.x, distanceY);
}

function drawLanternSkillNodes() {
  for (const node of game.lantern.skill.nodes) {
    drawLanternSkillNode(node);
  }
}

function drawLanternNotice() {
  if (game.mode !== Mode.LANTERN || game.now > game.lanternNoticeUntil || !game.lanternNoticeText) {
    return;
  }

  ensureLayout();
  const board = layoutCache.playfield;
  const boxWidth = Math.min(260, board.w * 0.6);
  const boxHeight = 56;
  const x = board.x + (board.w - boxWidth) / 2;
  const y = board.y + Math.max(76, board.h * 0.1);

  ctx.save();
  ctx.fillStyle = "rgba(34, 22, 50, 0.86)";
  drawRoundedRect(x, y, boxWidth, boxHeight, 18);
  ctx.strokeStyle = "rgba(245, 241, 89, 0.38)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 0.5, y + 0.5, boxWidth - 1, boxHeight - 1);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgb(245, 241, 89)";
  ctx.font = 'bold 26px "Microsoft YaHei", Arial';
  ctx.fillText(game.lanternNoticeText, x + boxWidth / 2, y + boxHeight / 2 + 1);
  ctx.restore();
}

function drawLanternScene() {
  if (game.mode !== Mode.LANTERN) {
    return;
  }

  drawPlayfield();
  drawLanternTriangle();

  for (const enemy of game.lantern.enemies) {
    drawEnemy(enemy);
  }

  drawAlly();
  drawLanternSkillNodes();
  drawLanternNotice();
}

function drawControlPlaceholder() {
  if (game.mode !== Mode.CONTROL) {
    return;
  }

  drawArenaPanel();
  ctx.textAlign = "center";
  ctx.fillStyle = UI.textMain;
  ctx.font = 'bold 34px "Microsoft YaHei", Arial';
  ctx.fillText("免控模拟器", WIDTH / 2, HEIGHT * 0.42);

  ctx.fillStyle = UI.textSub;
  ctx.font = '18px "Microsoft YaHei", Arial';
  ctx.fillText("这一页先保留，后面我们单独继续填。", WIDTH / 2, HEIGHT * 0.5);
}

function draw() {
  if (game.mode === Mode.LANTERN) {
    drawLanternBackground();
  } else {
    drawDefaultBackground();
  }

  ensureLayout();
  drawMenuHeader();
  drawMenuButtons();
  drawLanternScene();
  drawControlPlaceholder();
  drawBackButton();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
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

function handleCanvasClick(event) {
  ensureLayout();
  const point = getCanvasPoint(event);

  if (game.mode === Mode.MENU) {
    for (const button of layoutCache.menuButtons) {
      if (pointInRect(point, button)) {
        selectMode(button.mode);
        return;
      }
    }
    return;
  }

  if (pointInRect(point, layoutCache.backButton)) {
    enterMenu();
    return;
  }

  if (game.mode === Mode.LANTERN) {
    if (game.lanternResetAt !== null) {
      return;
    }

    if (game.activeMoveSkillId !== null) {
      castMoveLanternSkill(game.activeMoveSkillId, point);
      updateMoveSkillPanel(game.now);
      return;
    }

    castLanternSkill(point);
  }
}

function handleCanvasContextMenu(event) {
  event.preventDefault();
  ensureLayout();

  if (game.mode !== Mode.LANTERN) {
    return;
  }

  if (game.lanternResetAt !== null) {
    return;
  }

  const point = getCanvasPoint(event);
  if (!pointInRect(point, layoutCache.playfield)) {
    return;
  }

  setLanternMoveTarget(point);
}

function update(now) {
  if (!game.lastTimestamp) {
    game.lastTimestamp = now;
  }

  const delta = now - game.lastTimestamp;
  game.lastTimestamp = now;
  game.now = now;
  game.pulseTime += delta;

  updateLanternMovement(delta);
  updateLanternSkillNodes(now);
  updateLanternResult(now);
  updateSkillPanel(now);
  updateMoveSkillPanel(now);
}

function gameLoop(timestamp) {
  const now = timestamp / 1000;
  update(now);
  draw();
  window.requestAnimationFrame(gameLoop);
}

startButton.addEventListener("click", () => {
  // Reserved for future modes.
});

resetButton.addEventListener("click", () => {
  if (game.mode === Mode.LANTERN) {
    resetLanternScene();
  }
});

canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("contextmenu", handleCanvasContextMenu);
function handleCanvasMouseMove(event) {
  const p = getCanvasPoint(event);
  mouseX = p.x;
  mouseY = p.y;
}
canvas.addEventListener("mousemove", handleCanvasMouseMove);

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => window.setTimeout(resizeCanvas, 100));
window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  if (game.mode !== Mode.LANTERN) {
    return;
  }

  if (event.key === "Escape") {
    game.activeMoveSkillId = null;
    updateMoveSkillPanel(game.now);
    return;
  }

  if (event.key === "1" || event.key === "2" || event.key === "3") {
    event.preventDefault();
    const nodeId = Number(event.key);
    castMoveLanternSkill(nodeId, { x: mouseX, y: mouseY });
  }
});

window.addEventListener("keyup", (event) => {
  if (game.mode !== Mode.LANTERN) {
    return;
  }

  if (event.key === "1" || event.key === "2" || event.key === "3") {
    const keyId = Number(event.key);
    if (game.activeMoveSkillId === keyId) {
      game.activeMoveSkillId = null;
      updateMoveSkillPanel(game.now);
    }
  }
});

window.addEventListener("blur", () => {
  if (game.activeMoveSkillId !== null) {
    game.activeMoveSkillId = null;
    updateMoveSkillPanel(game.now);
  }
});

enterMenu();
resizeCanvas();
window.requestAnimationFrame(gameLoop);
