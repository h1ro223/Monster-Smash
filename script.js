const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width, HEIGHT = canvas.height;

const CHAR_RADIUS = 22;
const ENEMY_RADIUS = 38;
const CHAR_COLORS = ["#2196f3", "#f44336"];
const CHAR_NAMES = ["2P", "1P"];
const CHAR_LABEL_COLORS = ["#1b9cf1", "#ffb300"];
const CHAR_START_Y = HEIGHT - 68;
const CHAR_SPACING = 68;
const CHAR_CENTER_X = WIDTH / 2 - (CHAR_SPACING * 0.5);
const SPEED = 20;

// 顔画像
const enemyFaceImg = new Image();
enemyFaceImg.src = "face.png";

let chars, enemy, turn, dragging, dragStart, dragCurrent, activeChar, effectTimers, comboFlags, enemyHitFlash, enemyShake, score, hpBarFlash, gameWin = false;

// 全キャラ停止判定
function allCharsStopped() {
  return chars.every(c => !c.moving && Math.abs(c.vx) < 0.16 && Math.abs(c.vy) < 0.16);
}

function initGame() {
  chars = [];
  for (let i = 0; i < 2; i++) {
    chars.push({
      x: CHAR_CENTER_X + CHAR_SPACING * i,
      y: CHAR_START_Y,
      vx: 0, vy: 0,
      color: CHAR_COLORS[i],
      name: CHAR_NAMES[i],
      moving: false
    });
  }
  enemy = { x: WIDTH / 2, y: 88, r: ENEMY_RADIUS, hp: 32, maxHp: 32 };
  turn = 0;
  activeChar = chars[turn];
  dragging = false;
  dragStart = { x: 0, y: 0 };
  dragCurrent = { x: 0, y: 0 };
  effectTimers = [];
  comboFlags = Array(2).fill(null).map(() => [false, false]);
  enemyHitFlash = 0;
  enemyShake = 0;
  hpBarFlash = 0;
  score = 0;
  gameWin = false;
  if (document.getElementById('result')) document.getElementById('result').style.display = "none";
  if (document.getElementById('scoreValue')) document.getElementById('scoreValue').textContent = score;
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // 外枠
  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#2196f3";
  ctx.shadowColor = "#7ecbfa";
  ctx.shadowBlur = 12;
  ctx.strokeRect(2, 2, WIDTH - 4, HEIGHT - 4);
  ctx.restore();

  // 敵
  let shakeX = (enemyShake > 0) ? (Math.random() - 0.5) * 8 : 0;
  let shakeY = (enemyShake > 0) ? (Math.random() - 0.5) * 8 : 0;
  const barWidth = 84, barHeight = 10;
  ctx.save();
  ctx.globalAlpha = hpBarFlash > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(hpBarFlash / 2)) : 1;
  ctx.fillStyle = "#d1d1d1";
  ctx.fillRect(enemy.x - barWidth / 2 + shakeX, enemy.y + ENEMY_RADIUS + 11 + shakeY, barWidth, barHeight);
  ctx.fillStyle = "#ef5350";
  ctx.fillRect(enemy.x - barWidth / 2 + shakeX, enemy.y + ENEMY_RADIUS + 11 + shakeY, barWidth * (enemy.hp / enemy.maxHp), barHeight);
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 2.2;
  ctx.strokeRect(enemy.x - barWidth / 2 + shakeX, enemy.y + ENEMY_RADIUS + 11 + shakeY, barWidth, barHeight);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(enemy.x + shakeX, enemy.y + shakeY, enemy.r, 0, Math.PI * 2);
  ctx.fillStyle = "#9e4acb";
  ctx.shadowColor = "#d4a3e7";
  ctx.shadowBlur = 10 + enemyHitFlash * 3;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#fff59d";
  ctx.stroke();

  // 顔画像
  if (enemyFaceImg.complete && enemyFaceImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(enemy.x + shakeX, enemy.y + shakeY, enemy.r - 2.5, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      enemyFaceImg,
      enemy.x - (enemy.r - 2.5) + shakeX,
      enemy.y - (enemy.r - 2.5) + shakeY,
      (enemy.r - 2.5) * 2,
      (enemy.r - 2.5) * 2
    );
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(enemy.x + shakeX, enemy.y + shakeY, enemy.r + 2.5, 0, Math.PI * 2);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = "#ffe82b";
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1.0;
  ctx.restore();

  // キャラ
  for (let i = 0; i < 2; i++) {
    let c = chars[i];

    // 白縁
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, CHAR_RADIUS + 2.6, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#fff";
    ctx.globalAlpha = 0.97;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(c.x, c.y, CHAR_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.shadowColor = "#444";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;

    // ラベル
    ctx.font = "bold 21px 'Segoe UI', 'Meiryo', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(c.name, c.x, c.y + 1);
    ctx.fillStyle = CHAR_LABEL_COLORS[i];
    ctx.shadowColor = "#b0b0b0";
    ctx.shadowBlur = 7;
    ctx.fillText(c.name, c.x, c.y + 1);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // 矢印のみ（パーティクルなし）
  if (dragging && !gameWin) {
    let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
    let angle = Math.atan2(dy, dx);
    let len = Math.min(Math.sqrt(dx * dx + dy * dy), 108);

    ctx.save();
    // 白棒
    ctx.beginPath();
    ctx.moveTo(activeChar.x, activeChar.y);
    ctx.lineTo(activeChar.x + Math.cos(angle) * len, activeChar.y + Math.sin(angle) * len);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.92;
    ctx.stroke();

    // 扇形グラデ
    let grad = ctx.createLinearGradient(
      activeChar.x, activeChar.y,
      activeChar.x + Math.cos(angle) * len,
      activeChar.y + Math.sin(angle) * len
    );
    grad.addColorStop(0, "rgba(255,220,0,0.22)");
    grad.addColorStop(0.6, "rgba(255,100,0,0.43)");
    grad.addColorStop(1, "rgba(255,0,0,0.84)");
    ctx.beginPath();
    ctx.moveTo(activeChar.x, activeChar.y);
    ctx.arc(activeChar.x, activeChar.y, len, angle - Math.PI / 8, angle + Math.PI / 8, false);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.globalAlpha = 1.0;
    ctx.fill();

    // 赤い太線
    ctx.beginPath();
    ctx.moveTo(activeChar.x, activeChar.y);
    ctx.lineTo(activeChar.x + Math.cos(angle) * len, activeChar.y + Math.sin(angle) * len);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 21;
    ctx.globalAlpha = 0.5;
    ctx.stroke();

    // 先端三角
    let arrowSize = 26;
    let tipX = activeChar.x + Math.cos(angle) * len;
    let tipY = activeChar.y + Math.sin(angle) * len;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - Math.cos(angle) * arrowSize + Math.sin(angle) * arrowSize * 0.6,
      tipY - Math.sin(angle) * arrowSize - Math.cos(angle) * arrowSize * 0.6
    );
    ctx.lineTo(
      tipX - Math.cos(angle) * arrowSize - Math.sin(angle) * arrowSize * 0.6,
      tipY - Math.sin(angle) * arrowSize + Math.cos(angle) * arrowSize * 0.6
    );
    ctx.closePath();
    ctx.fillStyle = "rgba(255,50,0,0.92)";
    ctx.globalAlpha = 0.98;
    ctx.fill();
    ctx.restore();
  }

  // 友情エフェクト
  for (let e of effectTimers) drawEffect(e);

  // 勝利演出
  if (gameWin) drawWinEffect();
}

function drawEffect(e) {
  ctx.save();
  if (e.type === "xlaser") {
    ctx.strokeStyle = "#ffed7b";
    ctx.lineWidth = 14 + 7 * Math.abs(Math.sin(Date.now() / 120));
    ctx.globalAlpha = e.timer / 16;
    const diagonals = [
      Math.atan2(-HEIGHT, WIDTH),
      Math.atan2(HEIGHT, WIDTH),
      Math.atan2(-HEIGHT, -WIDTH),
      Math.atan2(HEIGHT, -WIDTH)
    ];
    diagonals.forEach(angle => {
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      let maxLen = Math.max(WIDTH, HEIGHT) * 1.7;
      let endX = e.x + Math.cos(angle) * maxLen;
      let endY = e.y + Math.sin(angle) * maxLen;
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });
  } else if (e.type === "speed") {
    ctx.beginPath();
    ctx.arc(e.x, e.y, CHAR_RADIUS + 18 + 13 * Math.random(), 0, Math.PI * 2);
    ctx.strokeStyle = "#ffd54f";
    ctx.lineWidth = 4.5 + Math.random() * 2;
    ctx.globalAlpha = e.timer / 16 * 0.7;
    ctx.stroke();
  }
  ctx.restore();
}

function update() {
  if (gameWin) return;

  for (let c of chars) {
    c.x += c.vx;
    c.y += c.vy;
    c.vx *= 0.984;
    c.vy *= 0.984;
    if (c.x - CHAR_RADIUS < 0) { c.x = CHAR_RADIUS; c.vx *= -1; }
    if (c.x + CHAR_RADIUS > WIDTH) { c.x = WIDTH - CHAR_RADIUS; c.vx *= -1; }
    if (c.y - CHAR_RADIUS < 0) { c.y = CHAR_RADIUS; c.vy *= -1; }
    if (c.y + CHAR_RADIUS > HEIGHT) { c.y = HEIGHT - CHAR_RADIUS; c.vy *= -1; }
    if (Math.abs(c.vx) < 0.13 && Math.abs(c.vy) < 0.13) {
      c.vx = c.vy = 0;
    }
    c.moving = Math.abs(c.vx) > 0.14 || Math.abs(c.vy) > 0.14;
  }

  // 敵ヒット
  for (let c of chars) {
    if (enemy.hp > 0 && dist(c, enemy) < CHAR_RADIUS + ENEMY_RADIUS) {
      enemy.hp -= 1;
      score += 1;
      if (document.getElementById('scoreValue')) document.getElementById('scoreValue').textContent = score;
      if (enemy.hp < 0) enemy.hp = 0;
      enemyHitFlash = 8;
      enemyShake = 8;
      hpBarFlash = 10;
      let angle = Math.atan2(enemy.y - c.y, enemy.x - c.x);
      c.vx += -Math.cos(angle) * 2.7;
      c.vy += -Math.sin(angle) * 2.7;
    }
  }
  // キャラ同士友情
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    if (i === j) continue;
    let a = chars[i], b = chars[j];
    if (!a.moving && !b.moving) continue;
    if (!comboFlags[i][j] && dist(a, b) < CHAR_RADIUS * 2 + 2) {
      comboFlags[i][j] = true;
      triggerFriendCombo(i, j, a, b);
      let angle = Math.atan2(b.y - a.y, b.x - a.x);
      b.vx += Math.cos(angle) * 1.8;
      b.vy += Math.sin(angle) * 1.8;
    }
  }
  effectTimers = effectTimers.filter(e => --e.timer > 0);

  if (enemyHitFlash > 0) enemyHitFlash--;
  if (enemyShake > 0) enemyShake--;
  if (hpBarFlash > 0) hpBarFlash--;

  if (!dragging && allCharsStopped()) {
    if (enemy.hp <= 0 && !gameWin) {
      setTimeout(() => {
        gameWin = true;
        if (document.getElementById('result')) document.getElementById('result').style.display = "block";
      }, 380);
    } else {
      doNextTurn();
    }
  }
}

function doNextTurn() {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) comboFlags[i][j] = false;
  turn = (turn + 1) % 2;
  activeChar = chars[turn];
}

function triggerFriendCombo(attackerIdx, targetIdx, a, b) {
  if (targetIdx === 0) {
    effectTimers.push({ type: "xlaser", x: b.x, y: b.y, timer: 16 });
  } else if (targetIdx === 1) {
    effectTimers.push({ type: "speed", x: b.x, y: b.y, timer: 16 });
    b.vx *= 1.5;
    b.vy *= 1.5;
  }
}

function dist(a, b) {
  let dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// 入力
canvas.addEventListener("mousedown", (e) => {
  if (dragging || activeChar.moving || gameWin) return;
  if (!allCharsStopped()) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const d = Math.hypot(mx - activeChar.x, my - activeChar.y);
  if (d <= CHAR_RADIUS) {
    dragging = true;
    dragStart = { x: mx, y: my };
    dragCurrent = { ...dragStart };
  }
});
canvas.addEventListener("mousemove", (e) => {
  if (dragging) {
    const rect = canvas.getBoundingClientRect();
    dragCurrent.x = e.clientX - rect.left;
    dragCurrent.y = e.clientY - rect.top;
  }
});
canvas.addEventListener("mouseup", (e) => {
  if (dragging) {
    let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
    let angle = Math.atan2(dy, dx);
    activeChar.vx = -Math.cos(angle) * SPEED;
    activeChar.vy = -Math.sin(angle) * SPEED;
    activeChar.moving = true;
    dragging = false;
  }
});
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (dragging || activeChar.moving || gameWin) return;
  if (!allCharsStopped()) return;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const mx = touch.clientX - rect.left, my = touch.clientY - rect.top;
  const d = Math.hypot(mx - activeChar.x, my - activeChar.y);
  if (d <= CHAR_RADIUS) {
    dragging = true;
    dragStart = { x: mx, y: my };
    dragCurrent = { ...dragStart };
  }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (dragging) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    dragCurrent.x = touch.clientX - rect.left;
    dragCurrent.y = touch.clientY - rect.top;
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (dragging) {
    let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
    let angle = Math.atan2(dy, dx);
    activeChar.vx = -Math.cos(angle) * SPEED;
    activeChar.vy = -Math.sin(angle) * SPEED;
    activeChar.moving = true;
    dragging = false;
  }
}, { passive: false });

function drawWinEffect() {
  for (let i = 0; i < 2; i++) {
    let cx = WIDTH / 2 + Math.sin(Date.now() / 300 + i * 2) * 42;
    let cy = HEIGHT / 2 - 130 + Math.cos(Date.now() / 400 + i) * 22;
    for (let t = 0; t < 9; t++) {
      let ang = Math.PI * 2 / 9 * t + (Date.now() / 400) * i;
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 280 + i * 3 + t);
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(ang) * 24, cy + Math.sin(ang) * 24,
        7 + Math.sin(Date.now() / 270 + t) * 2.3, 0, Math.PI * 2
      );
      ctx.fillStyle = `hsl(${(i * 50 + t * 30) % 360},98%,62%)`;
      ctx.fill();
      ctx.restore();
    }
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function resetGame() {
  initGame();
}
resetGame();
loop();
