const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const enemyHpElem = document.getElementById('enemyHpVal');
const turnInfoElem = document.getElementById('turnInfo');
const WIDTH = canvas.width, HEIGHT = canvas.height;

// ---- キャラ＆敵定義 ----
const CHAR_RADIUS = 22;
const ENEMY_RADIUS = 40;
const CHAR_COLORS = ["#f44336", "#2196f3", "#43a047", "#ffd600"]; // 赤,青,緑,黄
const CHAR_NAMES = ["1P", "2P", "3P", "4P"];

// キャラ初期座標
const CHAR_START_POS = [
    { x: WIDTH / 2 - 60, y: HEIGHT - 90 },
    { x: WIDTH / 2 + 60, y: HEIGHT - 90 },
    { x: WIDTH / 2 - 60, y: HEIGHT - 170 },
    { x: WIDTH / 2 + 60, y: HEIGHT - 170 }
];

let chars, enemy, turn, dragging, dragStart, activeChar, effectTimers, comboFlags;

function initGame() {
    // キャラ配列
    chars = [];
    for (let i = 0; i < 4; i++) {
        chars.push({
            x: CHAR_START_POS[i].x,
            y: CHAR_START_POS[i].y,
            vx: 0, vy: 0,
            color: CHAR_COLORS[i],
            name: CHAR_NAMES[i],
            comboUsed: [false, false, false, false], // 1回のみ
        });
    }
    // 敵
    enemy = {
        x: WIDTH / 2,
        y: 90,
        r: ENEMY_RADIUS,
        hp: 15,
        maxHp: 15
    };
    turn = 0; // 1Pスタート
    activeChar = chars[turn];
    dragging = false;
    dragStart = { x: 0, y: 0 };
    effectTimers = []; // 友情エフェクト用
    comboFlags = Array(4).fill(null).map(() => [false, false, false, false]);
    updateDisplay();
}

function updateDisplay() {
    enemyHpElem.textContent = enemy.hp;
    turnInfoElem.textContent = `【${activeChar.name}のターン】`;
}

// ---- 描画 ----
function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // --- 敵 ---
    // HPバー
    ctx.fillStyle = "#bdbdbd";
    ctx.fillRect(enemy.x - 42, enemy.y - ENEMY_RADIUS - 22, 84, 10);
    ctx.fillStyle = "#ef5350";
    ctx.fillRect(enemy.x - 42, enemy.y - ENEMY_RADIUS - 22, 84 * (enemy.hp / enemy.maxHp), 10);

    // 敵本体
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

    // --- キャラ ---
    for (let i = 0; i < 4; i++) {
        let c = chars[i];
        ctx.beginPath();
        ctx.arc(c.x, c.y, CHAR_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.shadowColor = "#888";
        ctx.shadowBlur = (turn === i ? 12 : 0);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.font = "bold 15px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(c.name, c.x, c.y + 6);
    }

    // --- 引っ張り線 ---
    if (dragging) {
        ctx.beginPath();
        ctx.moveTo(activeChar.x, activeChar.y);
        ctx.lineTo(dragStart.x, dragStart.y);
        ctx.strokeStyle = "#d32f2f";
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // --- 友情エフェクト ---
    for (let e of effectTimers) {
        drawEffect(e);
    }
}

function drawEffect(e) {
    // type: "cross" | "xlaser" | "speed" | "homing"
    ctx.save();
    if (e.type === "cross") {
        // 十字レーザー
        ctx.strokeStyle = "#e3f2fd";
        ctx.lineWidth = 8;
        for (let d of [[1,0], [-1,0], [0,1], [0,-1]]) {
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + d[0] * 200, e.y + d[1] * 200);
            ctx.globalAlpha = e.timer / 18;
            ctx.stroke();
        }
    } else if (e.type === "xlaser") {
        // クロスレーザー
        ctx.strokeStyle = "#c8e6c9";
        ctx.lineWidth = 7;
        for (let d of [[1,1], [-1,1], [1,-1], [-1,-1]]) {
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + d[0] * 150, e.y + d[1] * 150);
            ctx.globalAlpha = e.timer / 18;
            ctx.stroke();
        }
    } else if (e.type === "homing") {
        // 敵へレーザー
        ctx.strokeStyle = "#fff59d";
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(enemy.x, enemy.y);
        ctx.globalAlpha = e.timer / 18;
        ctx.stroke();
    } else if (e.type === "speed") {
        // スピードアップエフェクト
        ctx.beginPath();
        ctx.arc(e.x, e.y, CHAR_RADIUS + 12 * Math.random(), 0, Math.PI * 2);
        ctx.strokeStyle = "#ffb300";
        ctx.lineWidth = 3;
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
        // 摩擦
        c.vx *= 0.987;
        c.vy *= 0.987;
        // 壁反射
        if (c.x - CHAR_RADIUS < 0) { c.x = CHAR_RADIUS; c.vx *= -1; }
        if (c.x + CHAR_RADIUS > WIDTH) { c.x = WIDTH - CHAR_RADIUS; c.vx *= -1; }
        if (c.y - CHAR_RADIUS < 0) { c.y = CHAR_RADIUS; c.vy *= -1; }
        if (c.y + CHAR_RADIUS > HEIGHT) { c.y = HEIGHT - CHAR_RADIUS; c.vy *= -1; }
        // 停止
        if (Math.abs(c.vx) < 0.15 && Math.abs(c.vy) < 0.15) {
            c.vx = c.vy = 0;
        }
    }

    // --- 敵ヒット ---
    for (let c of chars) {
        if (enemy.hp > 0 && dist(c, enemy) < CHAR_RADIUS + ENEMY_RADIUS) {
            enemy.hp--;
            if (enemy.hp < 0) enemy.hp = 0;
            updateDisplay();
            // 敵を弾く（小さい反動）
            let angle = Math.atan2(enemy.y - c.y, enemy.x - c.x);
            c.vx += -Math.cos(angle) * 3;
            c.vy += -Math.sin(angle) * 3;
        }
    }
    // --- キャラ同士の友情 ---
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        if (i === j) continue;
        let a = chars[i], b = chars[j];
        if (!a.moving && !b.moving) continue;
        if (!comboFlags[i][j] && dist(a, b) < CHAR_RADIUS * 2 + 2) {
            comboFlags[i][j] = true; // 1回のみ
            triggerFriendCombo(i, j, a, b);
            // bも反動
            let angle = Math.atan2(b.y - a.y, b.x - a.x);
            b.vx += Math.cos(angle) * 2;
            b.vy += Math.sin(angle) * 2;
        }
    }

    // 友情エフェクト時間減少
    effectTimers = effectTimers.filter(e => --e.timer > 0);

    // ターン終了判定
    // 操作キャラのみ監視、完全停止で次ターン
    if (!dragging && !chars[turn].moving && Math.abs(chars[turn].vx) < 0.18 && Math.abs(chars[turn].vy) < 0.18) {
        nextTurn();
    }
}

function nextTurn() {
    // comboフラグをリセット
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) comboFlags[i][j] = false;
    turn = (turn + 1) % 4;
    activeChar = chars[turn];
    updateDisplay();
}

// ---- 友情コンボ処理 ----
function triggerFriendCombo(attackerIdx, targetIdx, a, b) {
    // 友情効果はターゲットの色による
    switch (targetIdx) {
        case 0: // 1P 十字レーザー
            effectTimers.push({ type: "cross", x: b.x, y: b.y, timer: 18 });
            // エフェクト用のみ
            break;
        case 1: // 2P スピードアップ
            effectTimers.push({ type: "speed", x: b.x, y: b.y, timer: 18 });
            // 当たったキャラのスピードアップ
            a.vx *= 1.35;
            a.vy *= 1.35;
            break;
        case 2: // 3P クロスレーザー
            effectTimers.push({ type: "xlaser", x: b.x, y: b.y, timer: 18 });
            break;
        case 3: // 4P 敵に向かってレーザー
            effectTimers.push({ type: "homing", x: b.x, y: b.y, timer: 18 });
            // 当たった瞬間に敵にダメージ
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
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const d = Math.hypot(mx - activeChar.x, my - activeChar.y);
    if (d < CHAR_RADIUS) {
        dragging = true;
        dragStart = { x: mx, y: my };
    }
});
canvas.addEventListener("mousemove", (e) => {
    if (dragging) {
        const rect = canvas.getBoundingClientRect();
        dragStart.x = e.clientX - rect.left;
        dragStart.y = e.clientY - rect.top;
    }
});
canvas.addEventListener("mouseup", (e) => {
    if (dragging) {
        const dx = dragStart.x - activeChar.x, dy = dragStart.y - activeChar.y;
        activeChar.vx = -dx * 0.18;
        activeChar.vy = -dy * 0.18;
        activeChar.moving = true;
        dragging = false;
    }
});
// スマホ対応
canvas.addEventListener("touchstart", (e) => {
    if (dragging || activeChar.moving) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const mx = touch.clientX - rect.left, my = touch.clientY - rect.top;
    const d = Math.hypot(mx - activeChar.x, my - activeChar.y);
    if (d < CHAR_RADIUS) {
        dragging = true;
        dragStart = { x: mx, y: my };
    }
});
canvas.addEventListener("touchmove", (e) => {
    if (dragging) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        dragStart.x = touch.clientX - rect.left;
        dragStart.y = touch.clientY - rect.top;
    }
});
canvas.addEventListener("touchend", (e) => {
    if (dragging) {
        const dx = dragStart.x - activeChar.x, dy = dragStart.y - activeChar.y;
        activeChar.vx = -dx * 0.18;
        activeChar.vy = -dy * 0.18;
        activeChar.moving = true;
        dragging = false;
    }
});

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
