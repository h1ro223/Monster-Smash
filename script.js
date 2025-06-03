const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width, HEIGHT = canvas.height;

// ---- 設定 ----
const PLAYER_NUM = 4;
const PLAYER_HP = 10;
const ENEMY_HP = 60;
const SPEED_DEFAULT = 40;
const FRICTION_DEFAULT = 0.96;
const ENEMY_ATTACK_INTERVAL = 2;

const CHAR_RADIUS = 22;
const ENEMY_RADIUS = 46;
const CHAR_SPACING = 78;
const CHAR_START_Y = HEIGHT - 78;
const CHAR_CENTER_X = WIDTH / 2 - (CHAR_SPACING * 1.5);
const CHAR_COLORS = ["#2196f3", "#f44336", "#8bc34a", "#ffb300"];
const CHAR_LABEL_COLORS = ["#1b9cf1", "#ffb1b1", "#8bd53a", "#ffd600"];
const CHAR_NAMES = ["1P", "2P", "3P", "4P"];
const DRAG_RADIUS = CHAR_RADIUS + 18;

// ---- 状態管理 ----
let state = "PLAYER_TURN"; // "PLAYER_TURN", "ENEMY_ATTACK", "WIN", "LOSE"
let currentPlayer = 0;
let players = [];
let enemy = {};
let dragging = false, dragStart = {x:0,y:0}, dragCurrent = {x:0,y:0};
let effectTimers = [];
let playerActionCount = 0;
let enemyAttackCountdown = ENEMY_ATTACK_INTERVAL;
let friendFlags = []; // 友情誘発フラグ

function resetGame() {
    players = [];
    for(let i=0;i<PLAYER_NUM;i++){
        players.push({
            x: CHAR_CENTER_X + CHAR_SPACING * i,
            y: CHAR_START_Y,
            vx:0, vy:0,
            color: CHAR_COLORS[i],
            label: CHAR_NAMES[i],
            hp: PLAYER_HP,
            moving: false,
        });
    }
    enemy = {x: WIDTH/2, y: 110, r: ENEMY_RADIUS, hp: ENEMY_HP, maxHp: ENEMY_HP};
    dragging = false;
    effectTimers = [];
    playerActionCount = 0;
    currentPlayer = 0;
    enemyAttackCountdown = ENEMY_ATTACK_INTERVAL;
    friendFlags = Array(PLAYER_NUM).fill(null).map(() => Array(PLAYER_NUM).fill(false));
    setHpBar();
    setTurnCounter();
    state = "PLAYER_TURN";
}

resetGame();
requestAnimationFrame(loop);

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function draw(){
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    // --- 敵 ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI*2);
    ctx.fillStyle = "#8e24aa";
    ctx.shadowColor = "#b47de7";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff59d";
    ctx.stroke();
    ctx.restore();
    // HPバー
    let bw=114, bh=13;
    ctx.save();
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(enemy.x-bw/2, enemy.y+enemy.r+10, bw, bh);
    ctx.fillStyle = "#ef5350";
    ctx.fillRect(enemy.x-bw/2, enemy.y+enemy.r+10, bw*(enemy.hp/enemy.maxHp), bh);
    ctx.strokeStyle = "#aaa";
    ctx.strokeRect(enemy.x-bw/2, enemy.y+enemy.r+10, bw, bh);
    ctx.restore();

    // --- キャラ ---
    for(let i=0;i<PLAYER_NUM;i++){
        let c = players[i];
        // 白縁
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x,c.y,CHAR_RADIUS+2.6,0,Math.PI*2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#fff";
        ctx.globalAlpha = 0.97;
        ctx.stroke();
        // 本体
        ctx.beginPath();
        ctx.arc(c.x,c.y,CHAR_RADIUS,0,Math.PI*2);
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
        ctx.strokeText(c.label,c.x,c.y+1);
        ctx.fillStyle = CHAR_LABEL_COLORS[i];
        ctx.fillText(c.label,c.x,c.y+1);
        ctx.restore();
        // HPミニ表示
        ctx.save();
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "right";
        ctx.fillText(`HP${c.hp>0?c.hp:0}`, c.x+CHAR_RADIUS-3, c.y-CHAR_RADIUS+13);
        ctx.restore();
    }
    // --- 矢印
    if (state==="PLAYER_TURN" && dragging) {
        let c = players[currentPlayer];
        let dx = dragCurrent.x-c.x, dy = dragCurrent.y-c.y;
        let angle = Math.atan2(dy, dx);
        let len = Math.min(Math.sqrt(dx*dx+dy*dy),120);
        ctx.save();
        // 白棒
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(angle)*len, c.y + Math.sin(angle)*len);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.92;
        ctx.stroke();
        // 扇形グラデ
        let grad = ctx.createLinearGradient(
            c.x, c.y,
            c.x + Math.cos(angle) * len,
            c.y + Math.sin(angle) * len
        );
        grad.addColorStop(0, "rgba(255,220,0,0.22)");
        grad.addColorStop(0.6, "rgba(255,100,0,0.43)");
        grad.addColorStop(1, "rgba(255,0,0,0.84)");
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.arc(c.x, c.y, len, angle - Math.PI/8, angle + Math.PI/8, false);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.globalAlpha = 1.0;
        ctx.fill();
        // 赤い太線
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(angle)*len, c.y + Math.sin(angle)*len);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 21;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        // 先端三角
        let arrowSize = 26;
        let tipX = c.x + Math.cos(angle)*len;
        let tipY = c.y + Math.sin(angle)*len;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
            tipX-Math.cos(angle)*arrowSize+Math.sin(angle)*arrowSize*0.6,
            tipY-Math.sin(angle)*arrowSize-Math.cos(angle)*arrowSize*0.6
        );
        ctx.lineTo(
            tipX-Math.cos(angle)*arrowSize-Math.sin(angle)*arrowSize*0.6,
            tipY-Math.sin(angle)*arrowSize+Math.cos(angle)*arrowSize*0.6
        );
        ctx.closePath();
        ctx.fillStyle = "rgba(255,50,0,0.92)";
        ctx.globalAlpha = 0.98;
        ctx.fill();
        ctx.restore();
    }
    // --- エフェクト
    for(const e of effectTimers) drawEffect(e);
}

function drawEffect(e){
    ctx.save();
    if (e.type === "xlaser") {
        ctx.strokeStyle = "#ffe082";
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
        ctx.globalAlpha = e.timer / 14 * 0.8;
        ctx.beginPath();
        ctx.arc(e.x, e.y + 8*(14-e.timer), 22, 0, Math.PI*2);
        ctx.fillStyle = "#f4d341";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x, e.y + 8*(14-e.timer), 15, 0, Math.PI*2);
        ctx.fillStyle = "#ff5722";
        ctx.fill();
    } else if (e.type === "circle") {
        ctx.beginPath();
        ctx.arc(e.x, e.y, 50 + 30*e.timer/18, 0, Math.PI*2);
        ctx.strokeStyle = "#39f";
        ctx.lineWidth = 6 + 5*e.timer/18;
        ctx.globalAlpha = e.timer / 18 * 0.8;
        ctx.stroke();
    } else if (e.type === "enemyLaser") {
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y + ENEMY_RADIUS);
        ctx.lineTo(e.tx, e.ty);
        ctx.strokeStyle = "#f00";
        ctx.lineWidth = 20;
        ctx.globalAlpha = e.timer / 16 * 0.7;
        ctx.shadowColor = "#f77";
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    ctx.restore();
}

function update() {
    // キャラ物理
    for(const c of players){
        c.x += c.vx;
        c.y += c.vy;
        c.vx *= FRICTION_DEFAULT;
        c.vy *= FRICTION_DEFAULT;
        if (c.x-CHAR_RADIUS<0) {c.x=CHAR_RADIUS;c.vx*=-1;}
        if (c.x+CHAR_RADIUS>WIDTH) {c.x=WIDTH-CHAR_RADIUS;c.vx*=-1;}
        if (c.y-CHAR_RADIUS<0) {c.y=CHAR_RADIUS;c.vy*=-1;}
        if (c.y+CHAR_RADIUS>HEIGHT) {c.y=HEIGHT-CHAR_RADIUS;c.vy*=-1;}
        if (Math.abs(c.vx)<0.13 && Math.abs(c.vy)<0.13) {c.vx=0;c.vy=0;}
        c.moving = Math.abs(c.vx)>0.14 || Math.abs(c.vy)>0.14;
    }
    // エフェクト進行
    effectTimers = effectTimers.filter(e => --e.timer > 0);

    // --- 敵ヒット判定・反射 ---
    for (let c of players) {
        if (c.hp > 0 && enemy.hp > 0) {
            const dx = c.x - enemy.x;
            const dy = c.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < CHAR_RADIUS + ENEMY_RADIUS) {
                enemy.hp = Math.max(0, enemy.hp - 1);
                const angle = Math.atan2(dy, dx);
                const overlap = CHAR_RADIUS + ENEMY_RADIUS - dist + 1;
                c.x += Math.cos(angle) * overlap;
                c.y += Math.sin(angle) * overlap;
                c.vx += Math.cos(angle) * 2.2;
                c.vy += Math.sin(angle) * 2.2;
            }
        }
    }

    // --- 友情判定 ---
    for (let i = 0; i < PLAYER_NUM; i++) {
        for (let j = 0; j < PLAYER_NUM; j++) {
            if (i === j) continue;
            let a = players[i], b = players[j];
            if (a.hp > 0 && b.hp > 0) {
                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (!friendFlags[i][j] && dist < CHAR_RADIUS*2+2) {
                    friendFlags[i][j] = true;
                    triggerFriendCombo(j, b);
                }
            }
        }
    }

    // 勝利・敗北判定
    if(enemy.hp<=0 && state!=="WIN"){
        state = "WIN";
        setTurnCounter();
        setTimeout(()=>alert("勝利！"), 100);
    }
    if(players.every(p=>p.hp<=0) && state!=="LOSE"){
        state = "LOSE";
        setTurnCounter();
        setTimeout(()=>alert("全滅しました"), 100);
    }
    setHpBar();
}

// --- 友情発動 ---
function triggerFriendCombo(idx, charObj) {
    if (charObj.hp <= 0) return;
    if (idx === 0) { // 1P クロスレーザー
        effectTimers.push({ type: "xlaser", x: charObj.x, y: charObj.y, timer: 16 });
        if (enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - 2);
    }
    if (idx === 1) { // 2P 爆発
        effectTimers.push({ type: "explosion", x: charObj.x, y: charObj.y, timer: 16 });
        if (enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - 1);
    }
    if (idx === 2) { // 3P メテオ
        effectTimers.push({ type: "meteor", x: enemy.x, y: enemy.y, timer: 14 });
        if (enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - 2);
    }
    if (idx === 3) { // 4P サークル
        effectTimers.push({ type: "circle", x: charObj.x, y: charObj.y, timer: 16 });
        if (enemy.hp > 0) enemy.hp = Math.max(0, enemy.hp - 1);
    }
}

// --- 入力 ---
canvas.addEventListener("mousedown",(e)=>{
    if(state!=="PLAYER_TURN") return;
    let c = players[currentPlayer];
    if(c.moving) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const d = Math.hypot(mx-c.x, my-c.y);
    if(d<=DRAG_RADIUS){
        dragging = true;
        dragStart = {x:mx, y:my};
        dragCurrent = {...dragStart};
    }
});
canvas.addEventListener("mousemove",(e)=>{
    if(dragging){
        const rect = canvas.getBoundingClientRect();
        dragCurrent.x = e.clientX - rect.left;
        dragCurrent.y = e.clientY - rect.top;
    }
});
canvas.addEventListener("mouseup",(e)=>{
    if(dragging){
        let c = players[currentPlayer];
        let dx = dragCurrent.x-c.x, dy = dragCurrent.y-c.y;
        let angle = Math.atan2(dy, dx);
        c.vx = -Math.cos(angle)*SPEED_DEFAULT;
        c.vy = -Math.sin(angle)*SPEED_DEFAULT;
        c.moving = true;
        dragging = false;
        handleEndOfTurn();
    }
});
// スマホタッチも同じ
canvas.addEventListener("touchstart",(e)=>{
    e.preventDefault();
    if(state!=="PLAYER_TURN") return;
    let c = players[currentPlayer];
    if(c.moving) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const mx = touch.clientX - rect.left, my = touch.clientY - rect.top;
    const d = Math.hypot(mx-c.x, my-c.y);
    if(d<=DRAG_RADIUS){
        dragging = true;
        dragStart = {x:mx, y:my};
        dragCurrent = {...dragStart};
    }
},{passive:false});
canvas.addEventListener("touchmove",(e)=>{
    e.preventDefault();
    if(dragging){
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        dragCurrent.x = touch.clientX - rect.left;
        dragCurrent.y = touch.clientY - rect.top;
    }
},{passive:false});
canvas.addEventListener("touchend",(e)=>{
    e.preventDefault();
    if(dragging){
        let c = players[currentPlayer];
        let dx = dragCurrent.x-c.x, dy = dragCurrent.y-c.y;
        let angle = Math.atan2(dy, dx);
        c.vx = -Math.cos(angle)*SPEED_DEFAULT;
        c.vy = -Math.sin(angle)*SPEED_DEFAULT;
        c.moving = true;
        dragging = false;
        handleEndOfTurn();
    }
},{passive:false});

// --- ターン終了処理：ショット発射時だけ呼ばれる！ ---
function handleEndOfTurn() {
    playerActionCount++;
    // 次のキャラが生きているかを探す
    let next = -1;
    for (let i = 1; i <= PLAYER_NUM; i++) {
        let idx = (currentPlayer + i) % PLAYER_NUM;
        if (players[idx].hp > 0) {
            next = idx;
            break;
        }
    }
    // 友情誘発フラグリセット
    friendFlags = Array(PLAYER_NUM).fill(null).map(() => Array(PLAYER_NUM).fill(false));

    if(next === -1) {
        state = "LOSE";
        setTurnCounter();
        setTimeout(()=>alert("全滅しました"), 100);
        return;
    }
    // 敵攻撃判定
    if (playerActionCount % ENEMY_ATTACK_INTERVAL === 0) {
        enemyAttackCountdown = ENEMY_ATTACK_INTERVAL;
        state = "ENEMY_ATTACK";
        setTurnCounter();
        setTimeout(()=>{
            enemyAttack();
            currentPlayer = next;
            state = "PLAYER_TURN";
            setTurnCounter();
        }, 600);
    } else {
        enemyAttackCountdown = ENEMY_ATTACK_INTERVAL-(playerActionCount%ENEMY_ATTACK_INTERVAL);
        currentPlayer = next;
        state = "PLAYER_TURN";
        setTurnCounter();
    }
}

// --- 敵の攻撃処理 ---
function enemyAttack(){
    let alive = players.filter(c=>c.hp>0);
    if(!alive.length) return;
    let target = alive[Math.floor(Math.random()*alive.length)];
    effectTimers.push({ type: "enemyLaser", tx: target.x, ty: target.y, timer: 16 });
    setTimeout(()=>{ target.hp = Math.max(0, target.hp-3); setHpBar(); }, 250);
}

// ---- HPバー・ターン数UI ----
function setHpBar(){
    let val = players.reduce((a,b)=>a+(b.hp>0?b.hp:0),0);
    let inner = document.getElementById('totalHpInner');
    let text = document.getElementById('totalHpText');
    if(inner) inner.style.width = (val/PLAYER_NUM/PLAYER_HP*100)+"%";
    if(text) text.textContent = `${val} / ${PLAYER_NUM*PLAYER_HP}`;
}
function setTurnCounter(){
    let counter = document.getElementById('enemyTurnCounter');
    if(counter){
        if(state==="WIN"){
            counter.textContent = "クリア！";
        }else if(state==="LOSE"){
            counter.textContent = "全滅…";
        }else if(state==="ENEMY_ATTACK"){
            counter.textContent = `敵攻撃中…`;
        }else{
            counter.textContent = `敵攻撃まで: ${enemyAttackCountdown}`;
        }
    }
}
