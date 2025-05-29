const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const turnInfoElem = document.getElementById('turnInfo');
const WIDTH = canvas.width, HEIGHT = canvas.height;

const CHAR_RADIUS = 22;
const ENEMY_RADIUS = 36;
const CHAR_COLORS = ["#f44336", "#2196f3"];
const CHAR_NAMES = ["1P", "2P"];
const CHAR_START_Y = HEIGHT - 68;
const CHAR_SPACING = 64;
const CHAR_CENTER_X = WIDTH / 2 - (CHAR_SPACING * 0.5);
const SPEED = 120;  // スピード20

const enemyFaceImg = new Image();
enemyFaceImg.src = "face.png";

let chars, enemy, turn, dragging, dragStart, dragCurrent, activeChar, effectTimers, comboFlags;

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
    enemy = {
        x: WIDTH / 2,
        y: 80,
        r: ENEMY_RADIUS,
        hp: 30,
        maxHp: 30
    };
    turn = 0;
    activeChar = chars[turn];
    dragging = false;
    dragStart = { x: 0, y: 0 };
    dragCurrent = { x: 0, y: 0 };
    effectTimers = [];
    comboFlags = Array(2).fill(null).map(() => [false, false]);
    updateDisplay();
}

function updateDisplay() {
    turnInfoElem.innerHTML =
        `<span style="color:${activeChar.color};font-size:1.1em;">${activeChar.name}</span>のターン`;
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // --- 枠 ---
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#1565c0";
    ctx.strokeRect(2, 2, WIDTH - 4, HEIGHT - 4);
    ctx.restore();

    // --- 敵 ---
    // HPバー（敵の下）
    const barWidth = 84, barHeight = 9;
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(enemy.x - barWidth/2, enemy.y + ENEMY_RADIUS + 8, barWidth, barHeight);
    ctx.fillStyle = "#ef5350";
    ctx.fillRect(
        enemy.x - barWidth/2, enemy.y + ENEMY_RADIUS + 8,
        barWidth * (enemy.hp / enemy.maxHp), barHeight
    );
    ctx.strokeStyle = "#aaa";
    ctx.strokeRect(enemy.x - barWidth/2, enemy.y + ENEMY_RADIUS + 8, barWidth, barHeight);

    // 敵本体
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
    ctx.fillStyle = "#8e24aa";
    ctx.shadowColor = "#a881af";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff59d";
    ctx.stroke();
    ctx.font = "bold 17px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText("ENEMY", enemy.x, enemy.y + 6);
    
    // 敵の顔画像を描画（画像が読み込まれていれば）
    if (enemyFaceImg.complete && enemyFaceImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r - 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip(); // 丸く切り抜き
    ctx.drawImage(
        enemyFaceImg,
        enemy.x - (enemy.r - 2),
        enemy.y - (enemy.r - 2),
        (enemy.r - 2) * 2,
        (enemy.r - 2) * 2
    );
    ctx.restore();
}

    // --- キャラ ---
    for (let i = 0; i < 2; i++) {
        let c = chars[i];
        ctx.beginPath();
        ctx.arc(c.x, c.y, CHAR_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.shadowColor = "#888";
        ctx.shadowBlur = (turn === i ? 10 : 0);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.font = "bold 15px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(c.name, c.x, c.y + 5);
        if (turn === i) {
            ctx.save();
            ctx.lineWidth = 5;
            ctx.strokeStyle = "#fffde7";
            ctx.beginPath();
            ctx.arc(c.x, c.y, CHAR_RADIUS + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    // --- 引っ張り線（大きめ矢印） ---
    if (dragging) {
        ctx.save();
        ctx.setLineDash([10, 11]);
        ctx.beginPath();
        ctx.moveTo(activeChar.x, activeChar.y);
        ctx.lineTo(dragCurrent.x, dragCurrent.y);
        ctx.strokeStyle = "#ff7043";
        ctx.lineWidth = 7;
        ctx.globalAlpha = 0.90;
        ctx.stroke();
        ctx.setLineDash([]);

        // 矢印先端（大きめ三角形）
        let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
        let len = Math.sqrt(dx*dx + dy*dy);
        let unitX = dx / (len || 1), unitY = dy / (len || 1);
        let arrowLen = Math.min(len, 90);
        let tipX = activeChar.x + unitX * arrowLen;
        let tipY = activeChar.y + unitY * arrowLen;
        let arrowSize = 21;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
            tipX - unitX * arrowSize + unitY * arrowSize * 0.6,
            tipY - unitY * arrowSize - unitX * arrowSize * 0.6
        );
        ctx.lineTo(
            tipX - unitX * arrowSize - unitY * arrowSize * 0.6,
            tipY - unitY * arrowSize + unitX * arrowSize * 0.6
        );
        ctx.closePath();
        ctx.fillStyle = "#ff7043";
        ctx.globalAlpha = 0.90;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    // --- 友情エフェクト ---
    for (let e of effectTimers) drawEffect(e);
}

// クロスレーザー（画面いっぱい）
function drawEffect(e) {
    ctx.save();
    if (e.type === "xlaser") {
        ctx.strokeStyle = "#c8e6c9";
        ctx.lineWidth = 13;
        ctx.globalAlpha = e.timer / 16;
        const diagonals = [
            Math.atan2(-HEIGHT, WIDTH),  // ↗
            Math.atan2(HEIGHT, WIDTH),   // ↘
            Math.atan2(-HEIGHT, -WIDTH), // ↖
            Math.atan2(HEIGHT, -WIDTH)   // ↙
        ];
        diagonals.forEach(angle => {
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            // 画面端まで伸ばす
            let maxLen = Math.max(WIDTH, HEIGHT) * 1.5;
            let endX = e.x + Math.cos(angle) * maxLen;
            let endY = e.y + Math.sin(angle) * maxLen;
            ctx.lineTo(endX, endY);
            ctx.stroke();
        });
    } else if (e.type === "speed") {
        ctx.beginPath();
        ctx.arc(e.x, e.y, CHAR_RADIUS + 22 * Math.random(), 0, Math.PI * 2);
        ctx.strokeStyle = "#ffb300";
        ctx.lineWidth = 5;
        ctx.globalAlpha = e.timer / 16 * 0.8;
        ctx.stroke();
    }
    ctx.restore();
}

// --- ロジック ---
function update() {
    for (let c of chars) {
        c.x += c.vx;
        c.y += c.vy;
        c.vx *= 0.985;
        c.vy *= 0.985;
        if (c.x - CHAR_RADIUS < 0) { c.x = CHAR_RADIUS; c.vx *= -1; }
        if (c.x + CHAR_RADIUS > WIDTH) { c.x = WIDTH - CHAR_RADIUS; c.vx *= -1; }
        if (c.y - CHAR_RADIUS < 0) { c.y = CHAR_RADIUS; c.vy *= -1; }
        if (c.y + CHAR_RADIUS > HEIGHT) { c.y = HEIGHT - CHAR_RADIUS; c.vy *= -1; }
        if (Math.abs(c.vx) < 0.13 && Math.abs(c.vy) < 0.13) {
            c.vx = c.vy = 0;
        }
        c.moving = Math.abs(c.vx) > 0.15 || Math.abs(c.vy) > 0.15;
    }

    // 敵ヒット
    for (let c of chars) {
        if (enemy.hp > 0 && dist(c, enemy) < CHAR_RADIUS + ENEMY_RADIUS) {
            enemy.hp -= 1;
            if (enemy.hp < 0) enemy.hp = 0;
            updateDisplay();
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

    // ターン終了判定
    if (!dragging && !chars[turn].moving && Math.abs(chars[turn].vx) < 0.16 && Math.abs(chars[turn].vy) < 0.16) {
        doNextTurn();
    }
}

function doNextTurn() {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) comboFlags[i][j] = false;
    turn = (turn + 1) % 2;
    activeChar = chars[turn];
    updateDisplay();
}

// 友情仕様変更（1Pクロスレーザー, 2Pスピードアップ）
function triggerFriendCombo(attackerIdx, targetIdx, a, b) {
    if (targetIdx === 0) {
        effectTimers.push({ type: "xlaser", x: b.x, y: b.y, timer: 16 }); // クロスレーザー
    } else if (targetIdx === 1) {
        effectTimers.push({ type: "speed", x: b.x, y: b.y, timer: 16 }); // スピードアップ
        // 当たった時1.5倍で再加速
        b.vx *= 1.5;
        b.vy *= 1.5;
    }
}

function dist(a, b) {
    let dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
}

// 操作キャラ上からのみドラッグ開始OK
canvas.addEventListener("mousedown", (e) => {
    if (dragging || activeChar.moving) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const d = Math.hypot(mx - activeChar.x, my - activeChar.y);
    if (d < CHAR_RADIUS) {
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
// タッチ
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (dragging || activeChar.moving) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const mx = touch.clientX - rect.left, my = touch.clientY - rect.top;
    const d = Math.hypot(mx - activeChar.x, my - activeChar.y);
    if (d < CHAR_RADIUS) {
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