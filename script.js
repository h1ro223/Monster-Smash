const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const enemyHpElem = document.getElementById('enemyHpVal');
const turnInfoElem = document.getElementById('turnInfo');
const gaugeBar = document.getElementById('gaugeBar');
const gaugeText = document.getElementById('gaugeText');

const WIDTH = canvas.width, HEIGHT = canvas.height;

// ---- パラメータ ----
const CHAR_RADIUS = 32; // サイズUP!
const ENEMY_RADIUS = 40;
const CHAR_COLORS = ["#f44336", "#2196f3", "#43a047", "#ffd600"]; // 赤,青,緑,黄　
const CHAR_NAMES = ["1P", "2P", "3P", "4P"];
const CHAR_START_Y = HEIGHT - 75;
const CHAR_SPACING = 66;
const CHAR_CENTER_X = WIDTH / 2 - (CHAR_SPACING * 1.5);
const SPEED = 9.5; // スピード固定値

let chars, enemy, turn, dragging, dragStart, dragCurrent, activeChar, effectTimers, comboFlags;
let gauge = 0, gaugeRatio = 0, gaugeMax = 120; // ゲージパラメータ
let gaugeSuccess = false;


function initGame() {
    // 横並び配置
    chars = [];
    for (let i = 0; i < 4; i++) {
        chars.push({
            x: CHAR_CENTER_X + CHAR_SPACING * i,
            y: CHAR_START_Y,
            vx: 0, vy: 0,
            color: CHAR_COLORS[i],
            name: CHAR_NAMES[i],
            comboUsed: [false, false, false, false],
            moving: false
        });
    }
    enemy = {
        x: WIDTH / 2,
        y: 90,
        r: ENEMY_RADIUS,
        hp: 50,
        maxHp: 50
    };
    turn = 0;
    activeChar = chars[turn];
    dragging = false;
    dragStart = { x: 0, y: 0 };
    dragCurrent = { x: 0, y: 0 };
    effectTimers = [];
    comboFlags = Array(4).fill(null).map(() => [false, false, false, false]);
    gauge = 0;
    gaugeRatio = 0;
    gaugeSuccess = false;
    updateDisplay();
    updateGaugeBar(0, false);
}

function updateDisplay() {
    enemyHpElem.textContent = enemy.hp;
    turnInfoElem.innerHTML =
        `<span style="color:${activeChar.color};font-size:1.3em;">${activeChar.name}</span>のターン`;
}

// ---- ゲージバーの更新 ----
function updateGaugeBar(ratio, isSuccess) {
    ratio = Math.max(0, Math.min(1, ratio));
    gaugeBar.style.width = (ratio * 100).toFixed(1) + '%';
    gaugeText.textContent = `${Math.round(ratio * 100)}%`;
    gaugeText.style.color = isSuccess ? "#43a047" : (ratio > 0.8 ? "#ff9800" : "#ff5722");
    gaugeBar.style.background = isSuccess
        ? "linear-gradient(90deg,#81c784,#ffd600 100%)"
        : "linear-gradient(90deg, #ff8a65 0%, #ffd600 100%)";
}

// ---- 描画 ----
function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // 枠
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#1565c0";
    ctx.strokeRect(2.5, 2.5, WIDTH - 5, HEIGHT - 5);
    ctx.restore();

    // 敵
    ctx.fillStyle = "#bdbdbd";
    ctx.fillRect(enemy.x - 42, enemy.y - ENEMY_RADIUS - 22, 84, 10);
    ctx.fillStyle = "#ef5350";
    ctx.fillRect(enemy.x - 42, enemy.y - ENEMY_RADIUS - 22, 84 * (enemy.hp / enemy.maxHp), 10);

    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
    ctx.fillStyle = "#8e24aa";
    ctx.shadowColor = "#a881af";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#fff59d";
    ctx.stroke();
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText("ENEMY", enemy.x, enemy.y + 7);

    // キャラ
    for (let i = 0; i < 4; i++) {
        let c = chars[i];
        ctx.beginPath();
        ctx.arc(c.x, c.y, CHAR_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.shadowColor = "#888";
        ctx.shadowBlur = (turn === i ? 14 : 0);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.font = "bold 17px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(c.name, c.x, c.y + 7);
        // 操作中なら白縁
        if (turn === i) {
            ctx.save();
            ctx.lineWidth = 6;
            ctx.strokeStyle = "#fffde7";
            ctx.beginPath();
            ctx.arc(c.x, c.y, CHAR_RADIUS + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    // 矢印ガイド（モンスト風）
    if (dragging) {
        // 線
        ctx.save();
        ctx.setLineDash([8, 10]);
        ctx.beginPath();
        ctx.moveTo(activeChar.x, activeChar.y);
        ctx.lineTo(dragCurrent.x, dragCurrent.y);
        ctx.strokeStyle = gaugeSuccess ? "#43a047" : "#ff7043";
        ctx.lineWidth = 6;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.setLineDash([]);
        // 矢印先端
        let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
        let len = Math.sqrt(dx*dx + dy*dy);
        let unitX = dx / (len || 1), unitY = dy / (len || 1);
        let tipX = activeChar.x + unitX * Math.min(len, gaugeMax);
        let tipY = activeChar.y + unitY * Math.min(len, gaugeMax);
        let arrowSize = 18;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
            tipX - unitX * arrowSize + unitY * arrowSize * 0.5,
            tipY - unitY * arrowSize - unitX * arrowSize * 0.5
        );
        ctx.lineTo(
            tipX - unitX * arrowSize - unitY * arrowSize * 0.5,
            tipY - unitY * arrowSize + unitX * arrowSize * 0.5
        );
        ctx.closePath();
        ctx.fillStyle = gaugeSuccess ? "#43a047" : "#ff7043";
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    // 友情エフェクト
    for (let e of effectTimers) {
        drawEffect(e);
    }
}

function drawEffect(e) {
    ctx.save();
    if (e.type === "cross") {
        ctx.strokeStyle = "#e3f2fd";
        ctx.lineWidth = 12;
        for (let d of [[1,0], [-1,0], [0,1], [0,-1]]) {
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + d[0] * 210, e.y + d[1] * 210);
            ctx.globalAlpha = e.timer / 18;
            ctx.stroke();
        }
    } else if (e.type === "xlaser") {
        ctx.strokeStyle = "#c8e6c9";
        ctx.lineWidth = 11;
        for (let d of [[1,1], [-1,1], [1,-1], [-1,-1]]) {
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + d[0] * 160, e.y + d[1] * 160);
            ctx.globalAlpha = e.timer / 18;
            ctx.stroke();
        }
    } else if (e.type === "homing") {
        ctx.strokeStyle = "#fff59d";
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(enemy.x, enemy.y);
        ctx.globalAlpha = e.timer / 18;
        ctx.stroke();
    } else if (e.type === "speed") {
        ctx.beginPath();
        ctx.arc(e.x, e.y, CHAR_RADIUS + 20 * Math.random(), 0, Math.PI * 2);
        ctx.strokeStyle = "#ffb300";
        ctx.lineWidth = 4;
        ctx.globalAlpha = e.timer / 18 * 0.7;
        ctx.stroke();
    }
    ctx.restore();
}

// ---- ゲームロジック ----
function update() {
    // キャラ移動
    for (let c of chars) {
        c.x += c.vx;
        c.y += c.vy;
        c.vx *= 0.987;
        c.vy *= 0.987;
        if (c.x - CHAR_RADIUS < 0) { c.x = CHAR_RADIUS; c.vx *= -1; }
        if (c.x + CHAR_RADIUS > WIDTH) { c.x = WIDTH - CHAR_RADIUS; c.vx *= -1; }
        if (c.y - CHAR_RADIUS < 0) { c.y = CHAR_RADIUS; c.vy *= -1; }
        if (c.y + CHAR_RADIUS > HEIGHT) { c.y = HEIGHT - CHAR_RADIUS; c.vy *= -1; }
        if (Math.abs(c.vx) < 0.15 && Math.abs(c.vy) < 0.15) {
            c.vx = c.vy = 0;
        }
        c.moving = Math.abs(c.vx) > 0.18 || Math.abs(c.vy) > 0.18;
    }

    // --- 敵ヒット ---
    for (let c of chars) {
        if (enemy.hp > 0 && dist(c, enemy) < CHAR_RADIUS + ENEMY_RADIUS) {
            let dmg = c.gaugeSuccess ? 2 : 1;
            enemy.hp -= dmg;
            if (enemy.hp < 0) enemy.hp = 0;
            updateDisplay();
            // 敵を弾く（小さい反動）
            let angle = Math.atan2(enemy.y - c.y, enemy.x - c.x);
            c.vx += -Math.cos(angle) * 3;
            c.vy += -Math.sin(angle) * 3;
            c.gaugeSuccess = false; // ダメージ増加は1回のみ
        }
    }
    // --- キャラ同士の友情 ---
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        if (i === j) continue;
        let a = chars[i], b = chars[j];
        if (!a.moving && !b.moving) continue;
        if (!comboFlags[i][j] && dist(a, b) < CHAR_RADIUS * 2 + 4) {
            comboFlags[i][j] = true;
            triggerFriendCombo(i, j, a, b);
            let angle = Math.atan2(b.y - a.y, b.x - a.x);
            b.vx += Math.cos(angle) * 2;
            b.vy += Math.sin(angle) * 2;
        }
    }
    effectTimers = effectTimers.filter(e => --e.timer > 0);

    // ターン終了判定
    if (!dragging && !chars[turn].moving && Math.abs(chars[turn].vx) < 0.18 && Math.abs(chars[turn].vy) < 0.18) {
        nextTurn();
    }
}

function nextTurn() {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) comboFlags[i][j] = false;
    turn = (turn + 1) % 4;
    activeChar = chars[turn];
    gauge = 0;
    gaugeRatio = 0;
    gaugeSuccess = false;
    updateDisplay();
    updateGaugeBar(0, false);
}

function triggerFriendCombo(attackerIdx, targetIdx, a, b) {
    switch (targetIdx) {
        case 0:
            effectTimers.push({ type: "cross", x: b.x, y: b.y, timer: 18 });
            break;
        case 1:
            effectTimers.push({ type: "speed", x: b.x, y: b.y, timer: 18 });
            a.vx *= 1.35;
            a.vy *= 1.35;
            break;
        case 2:
            effectTimers.push({ type: "xlaser", x: b.x, y: b.y, timer: 18 });
            break;
        case 3:
            effectTimers.push({ type: "homing", x: b.x, y: b.y, timer: 18 });
            if (enemy.hp > 0) {
                enemy.hp--;
                updateDisplay();
            }
            break;
    }
}

// ---- 物理演算ヘルパー ----
function dist(a, b) {
    let dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
}

// ---- 入力処理 ----
canvas.addEventListener("mousedown", (e) => {
    if (dragging || activeChar.moving) return;
    const rect = canvas.getBoundingClientRect();
    dragging = true;
    dragStart = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    dragCurrent = { ...dragStart };
});
canvas.addEventListener("mousemove", (e) => {
    if (dragging) {
        const rect = canvas.getBoundingClientRect();
        dragCurrent.x = e.clientX - rect.left;
        dragCurrent.y = e.clientY - rect.top;
        // ゲージ計算
        let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
        let len = Math.sqrt(dx * dx + dy * dy);
        gauge = Math.min(len, gaugeMax);
        gaugeRatio = gauge / gaugeMax;
        gaugeSuccess = gaugeRatio > 0.8;
        updateGaugeBar(gaugeRatio, gaugeSuccess);
    }
});
canvas.addEventListener("mouseup", (e) => {
    if (dragging) {
        // 発射処理
        let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
        let len = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx);
        // 引っ張る方向（反対向き）
        activeChar.vx = -Math.cos(angle) * SPEED;
        activeChar.vy = -Math.sin(angle) * SPEED;
        activeChar.moving = true;
        activeChar.gaugeSuccess = gaugeSuccess;
        dragging = false;
        updateGaugeBar(0, false);
    }
});

// スマホ: スクロール防止＋どこでもドラッグ可
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (dragging || activeChar.moving) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    dragging = true;
    dragStart = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
    dragCurrent = { ...dragStart };
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (dragging) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        dragCurrent.x = touch.clientX - rect.left;
        dragCurrent.y = touch.clientY - rect.top;
        let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
        let len = Math.sqrt(dx * dx + dy * dy);
        gauge = Math.min(len, gaugeMax);
        gaugeRatio = gauge / gaugeMax;
        gaugeSuccess = gaugeRatio > 0.8;
        updateGaugeBar(gaugeRatio, gaugeSuccess);
    }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (dragging) {
        let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
        let len = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx);
        activeChar.vx = -Math.cos(angle) * SPEED;
        activeChar.vy = -Math.sin(angle) * SPEED;
        activeChar.moving = true;
        activeChar.gaugeSuccess = gaugeSuccess;
        dragging = false;
        updateGaugeBar(0, false);
    }
}, { passive: false });

// ---- ゲームループ ----
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// ---- リセット ----
function resetGame() {
    initGame();
}
resetGame();
loop();
