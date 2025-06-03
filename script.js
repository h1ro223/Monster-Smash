// --- 設定値 ---
let SPEED = 40;             // 初期スピード
let FRICTION = 0.96;        // 初期減速率

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width, HEIGHT = canvas.height;

// キャラデータ
const CHAR_RADIUS = 22;
const ENEMY_RADIUS = 46;
const CHAR_COLORS = ["#2196f3", "#f44336", "#8bc34a", "#ffb300"];
const CHAR_NAMES = ["1P", "2P", "3P", "4P"];
const CHAR_LABEL_COLORS = ["#1b9cf1", "#ffb1b1", "#8bd53a", "#ffd600"];
const CHAR_START_Y = HEIGHT - 78;
const CHAR_SPACING = 78;
const CHAR_CENTER_X = WIDTH / 2 - (CHAR_SPACING * 1.5);
const CHAR_HP = 10; // 各キャラHP
const CHAR_DRAG_RADIUS = CHAR_RADIUS + 16; // ドラッグ判定を広く

// 敵
const ENEMY_START_HP = 60;
const ENEMY_ATTACK_INTERVAL = 2; // 2ターンごと

// 顔画像（用意する場合は同フォルダに face.png）
const enemyFaceImg = new Image();
enemyFaceImg.src = "face.png";

// --- ゲーム状態 ---
let chars, enemy, turn, dragging, dragStart, dragCurrent, activeChar, effectTimers, comboFlags, gameWin, playerActionCount;
let totalHp, enemyAttackCountdown, lastAttackedPlayer;

function allCharsStopped() {
    return chars.every(c => !c.moving && Math.abs(c.vx) < 0.13 && Math.abs(c.vy) < 0.13);
}

function calcTotalHp() {
    return chars.reduce((acc, c) => Math.max(0, acc + c.hp), 0);
}

function initGame() {
    chars = [];
    for (let i = 0; i < 4; i++) {
        chars.push({
            x: CHAR_CENTER_X + CHAR_SPACING * i,
            y: CHAR_START_Y,
            vx: 0, vy: 0,
            color: CHAR_COLORS[i],
            name: CHAR_NAMES[i],
            moving: false,
            hp: CHAR_HP
        });
    }
    enemy = { x: WIDTH / 2, y: 110, r: ENEMY_RADIUS, hp: ENEMY_START_HP, maxHp: ENEMY_START_HP };
    turn = 0;
    activeChar = chars[turn];
    dragging = false;
    dragStart = { x: 0, y: 0 };
    dragCurrent = { x: 0, y: 0 };
    effectTimers = [];
    comboFlags = Array(4).fill(null).map(() => Array(4).fill(false));
    gameWin = false;
    playerActionCount = 0;
    totalHp = calcTotalHp();
    enemyAttackCountdown = ENEMY_ATTACK_INTERVAL;
    lastAttackedPlayer = -1;
    updateHpBar();
    updateTurnCounter();
    if (document.getElementById('result')) document.getElementById('result').style.display = "none";
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // --- 外枠
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#2196f3";
    ctx.shadowColor = "#7ecbfa";
    ctx.shadowBlur = 12;
    ctx.strokeRect(2, 2, WIDTH - 4, HEIGHT - 4);
    ctx.restore();

    // --- 敵（顔画像＋HPバー＋攻撃ターン数）---
    ctx.save();
    // 本体
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
    ctx.fillStyle = "#8e24aa";
    ctx.shadowColor = "#b47de7";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff59d";
    ctx.stroke();

    // 顔画像（円形クリップ）
    if (enemyFaceImg.complete && enemyFaceImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.r - 2.5, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
            enemyFaceImg,
            enemy.x - (enemy.r - 2.5),
            enemy.y - (enemy.r - 2.5),
            (enemy.r - 2.5) * 2,
            (enemy.r - 2.5) * 2
        );
        ctx.restore();
    }

    // HPバー
    const barWidth = 114, barHeight = 13;
    ctx.save();
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(enemy.x - barWidth/2, enemy.y + enemy.r + 10, barWidth, barHeight);
    ctx.fillStyle = "#ef5350";
    ctx.fillRect(
        enemy.x - barWidth/2, enemy.y + enemy.r + 10,
        barWidth * (enemy.hp / enemy.maxHp), barHeight
    );
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 2;
    ctx.strokeRect(enemy.x - barWidth/2, enemy.y + enemy.r + 10, barWidth, barHeight);
    ctx.restore();

    ctx.restore();

    // --- キャラ ---
    for (let i = 0; i < 4; i++) {
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

        // HPミニ表示
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "right";
        ctx.fillText(`HP${c.hp > 0 ? c.hp : 0}`, c.x + CHAR_RADIUS - 3, c.y - CHAR_RADIUS + 13);
        ctx.restore();
    }

    // --- 矢印
    if (dragging && !gameWin) {
        let dx = dragCurrent.x - activeChar.x, dy = dragCurrent.y - activeChar.y;
        let angle = Math.atan2(dy, dx);
        let len = Math.min(Math.sqrt(dx*dx + dy*dy), 120);

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
        ctx.arc(activeChar.x, activeChar.y, len, angle - Math.PI/8, angle + Math.PI/8, false);
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

    // --- 友情・敵攻撃エフェクト ---
    for (let e of effectTimers) drawEffect(e);

    // --- 勝利演出（必要なら追加可） ---
}

// 友情・敵攻撃エフェクト描画
function drawEffect(e) {
    ctx.save();
    if (e.type === "xlaser") {
        ctx.strokeStyle = "#ffed7b";
        ctx.lineWidth = 19;
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
    } else if (e.type === "explosion") {
        // 爆発
        ctx.beginPath();
        ctx.arc(e.x, e.y, 50 + e.timer*3, 0, Math.PI*2);
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = 8 + e.timer/2;
        ctx.globalAlpha = e.timer / 16 * 0.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(e.x, e.y, 30 + e.timer*2, 0, Math.PI*2);
        ctx.strokeStyle = "#ffa500";
        ctx.lineWidth = 3;
        ctx.globalAlpha = e.timer / 16 * 0.4;
        ctx.stroke();
    } else if (e.type === "meteor") {
        // メテオ
        ctx.save();
        ctx.globalAlpha = e.timer / 14 * 0.85;
        ctx.beginPath();
        ctx.arc(e.tx, e.ty + 8*(14-e.timer), 22, 0, Math.PI*2);
        ctx.fillStyle = "#f4d341";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.tx, e.ty + 8*(14-e.timer), 15, 0, Math.PI*2);
        ctx.fillStyle = "#ff5722";
        ctx.fill();
        ctx.restore();
    } else if (e.type === "circle") {
        // サークル
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 30*e.timer/18, 0, Math.PI*2);
        ctx.strokeStyle = "#39f";
        ctx.lineWidth = 6 + 5*e.timer/18;
        ctx.globalAlpha = e.timer / 18 * 0.8;
        ctx.stroke();
    } else if (e.type === "enemyLaser") {
        // 敵レーザー
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y + ENEMY_RADIUS);
        ctx.lineTo(e.tx, e.ty);
        ctx.strokeStyle = "#f00";
        ctx.lineWidth = 20;
        ctx.globalAlpha = e.timer / 13 * 0.7;
        ctx.shadowColor = "#f77";
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    ctx.restore();
}

// --- メイン進行 ---
function update() {
    if (gameWin) return;

    for (let c of chars) {
        c.x += c.vx;
        c.y += c.vy;
        c.vx *= FRICTION;
        c.vy *= FRICTION;
        if (c.x - CHAR_RADIUS < 0) { c.x = CHAR_RADIUS; c.vx *= -1; }
        if (c.x + CHAR_RADIUS > WIDTH) { c.x = WIDTH - CHAR_RADIUS; c.vx *= -1; }
        if (c.y - CHAR_RADIUS < 0) { c.y = CHAR_RADIUS; c.vy *= -1; }
        if (c.y + CHAR_RADIUS > HEIGHT) { c.y = HEIGHT - CHAR_RADIUS; c.vy *= -1; }
        if (Math.abs(c.vx) < 0.13 && Math.abs(c.vy) < 0.13) {
            c.vx = c.vy = 0;
        }
        c.moving = Math.abs(c.vx) > 0.14 || Math.abs(c.vy) > 0.14;
    }

    // --- 敵ヒット
    for (let c of chars) {
        if (c.hp > 0 && enemy.hp > 0 && dist(c, enemy) < CHAR_RADIUS + ENEMY_RADIUS) {
            enemy.hp -= 1;
            if (enemy.hp < 0) enemy.hp = 0;
            let angle = Math.atan2(enemy.y - c.y, enemy.x - c.x);
            c.vx += -Math.cos(angle) * 2.7;
            c.vy += -Math.sin(angle) * 2.7;
        }
    }
    // --- キャラ同士友情誘発廃止
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        if (i === j) continue;
        let a = chars[i], b = chars[j];
        if (!a.moving && !b.moving) continue;
        if (!comboFlags[i][j] && dist(a, b) < CHAR_RADIUS * 2 + 3) {
            comboFlags[i][j] = true;
            // 当たられた側のみ友情発動（b）
            triggerFriendCombo(j, b);
        }
    }
    effectTimers = effectTimers.filter(e => --e.timer > 0);

    // --- 敵の攻撃タイミング ---
    if (!dragging && allCharsStopped()) {
        if (enemy.hp <= 0 && !gameWin) {
            gameWin = true;
            if (document.getElementById('result')) document.getElementById('result').style.display = "block";
        } else if (chars.filter(c=>c.hp>0).length == 0) {
            gameWin = true;
            if (document.getElementById('result')) {
                document.getElementById('result').style.display = "block";
                document.getElementById('result').querySelector('h2').textContent = "敗北！";
                document.getElementById('result').querySelector('p').textContent = "全滅しました…";
            }
        } else {
            // プレイヤーの攻撃→カウント
            playerActionCount++;
            if (playerActionCount % ENEMY_ATTACK_INTERVAL == 0) {
                setTimeout(enemyAttack, 450);
                enemyAttackCountdown = ENEMY_ATTACK_INTERVAL;
            } else {
                enemyAttackCountdown = ENEMY_ATTACK_INTERVAL - (playerActionCount % ENEMY_ATTACK_INTERVAL);
            }
            doNextTurn();
        }
    }
    // --- 合計HPバー更新 ---
    updateHpBar();
    updateTurnCounter();
}

// --- ターン進行 ---
function doNextTurn() {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) comboFlags[i][j] = false;
    turn = (turn + 1) % 4;
    activeChar = chars[turn];
}

// --- 友情発動 ---
function triggerFriendCombo(idx, b) {
    if (b.hp <= 0) return;
    if (idx === 0) {
        // クロスレーザー
        effectTimers.push({ type: "xlaser", x: b.x, y: b.y, timer: 16 });
        // エネミー付近なら追加ダメ
        if (dist(b, enemy) < ENEMY_RADIUS+36) enemy.hp = Math.max(0, enemy.hp-1);
    } else if (idx === 1) {
        // 爆発
        effectTimers.push({ type: "explosion", x: b.x, y: b.y, timer: 16 });
        // 範囲内キャラ・敵にダメージ
        for (let c of chars) {
            if (c !== b && c.hp > 0 && dist(c, b) < 54) c.hp = Math.max(0, c.hp-1);
        }
        if (dist(b, enemy) < ENEMY_RADIUS+48) enemy.hp = Math.max(0, enemy.hp-2);
    } else if (idx === 2) {
        // メテオ（敵に3発）
        for (let k = 0; k < 3; k++) {
            effectTimers.push({ type: "meteor", tx: enemy.x + (Math.random()-0.5)*18, ty: enemy.y-ENEMY_RADIUS+7, timer: 14+k*4 });
        }
        enemy.hp = Math.max(0, enemy.hp-3);
    } else if (idx === 3) {
        // サークル
        effectTimers.push({ type: "circle", x: b.x, y: b.y, r: 50, timer: 18 });
        // 範囲全体攻撃(敵が範囲内ならダメ)
        if (dist(b, enemy) < 160) enemy.hp = Math.max(0, enemy.hp-2);
    }
}

// --- 敵の攻撃 ---
function enemyAttack() {
    // ランダムな生存キャラ1体を狙う
    let candidates = chars.filter(c=>c.hp>0);
    if (candidates.length == 0) return;
    let target = candidates[Math.floor(Math.random()*candidates.length)];
    lastAttackedPlayer = chars.indexOf(target);
    // レーザーエフェクト
    effectTimers.push({ type:"enemyLaser", tx:target.x, ty:target.y, timer:13 });
    // ダメージ
    setTimeout(() => {
        target.hp = Math.max(0, target.hp-3);
        updateHpBar();
    }, 250);
}

// --- 合計HPバーの描画・更新 ---
function updateHpBar() {
    totalHp = calcTotalHp();
    let ratio = totalHp / (CHAR_HP*4);
    let inner = document.getElementById('totalHpInner');
    let text = document.getElementById('totalHpText');
    if (inner) inner.style.width = (100*ratio)+"%";
    if (text) text.textContent = `${totalHp} / ${CHAR_HP*4}`;
}

// --- 残りターン数表示 ---
function updateTurnCounter() {
    let counter = document.getElementById('enemyTurnCounter');
    if (!counter) return;
    if (gameWin) {
        counter.textContent = "";
    } else {
        counter.textContent = `敵攻撃まで: ${enemyAttackCountdown}`;
    }
}

// --- ユーティリティ ---
function dist(a, b) {
    let dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
}

// --- 入力 ---
canvas.addEventListener("mousedown", (e) => {
    if (dragging || activeChar.moving || gameWin) return;
    if (!allCharsStopped()) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const d = Math.hypot(mx - activeChar.x, my - activeChar.y);
    if (d <= CHAR_DRAG_RADIUS) {
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
    if (d <= CHAR_DRAG_RADIUS) {
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

// --- 設定画面UI ---
const btnSetting = document.getElementById('btnSetting');
const settingModal = document.getElementById('settingModal');
const settingClose = document.getElementById('settingClose');
const speedInput = document.getElementById('speedInput');
const frictionInput = document.getElementById('frictionInput');
if (btnSetting && settingModal && settingClose && speedInput && frictionInput) {
    btnSetting.onclick = () => {
        speedInput.value = SPEED;
        frictionInput.value = FRICTION;
        settingModal.style.display = "block";
    };
    settingClose.onclick = () => settingModal.style.display = "none";
    settingModal.onclick = (e) => { if (e.target === settingModal) settingModal.style.display = "none"; }
    speedInput.onchange = () => {
        let v = Number(speedInput.value);
        if (v < 1) v = 1;
        if (v > 1000) v = 1000;
        SPEED = v;
    };
    frictionInput.onchange = () => {
        let v = Number(frictionInput.value);
        if (v < 0.90) v = 0.90;
        if (v > 0.999) v = 0.999;
        FRICTION = v;
    };
}
