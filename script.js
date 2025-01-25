// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyD0x_TU433xg_PXTzfpeqXRF7ZZGgceoqw",
    authDomain: "gh-game-9a5a0.firebaseapp.com",
    databaseURL: "https://gh-game-9a5a0-default-rtdb.firebaseio.com",
    projectId: "gh-game-9a5a0",
    storageBucket: "gh-game-9a5a0.firebasestorage.app",
    messagingSenderId: "137631838692",
    appId: "1:137631838692:web:cf35e90c228d9ddc8957f1"
};

// Firebase 初期化
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// HTML要素の取得
const startButton = document.getElementById("startButton");
const reactionButton = document.getElementById("reactionButton");
const waitingMessage = document.getElementById("waiting");

// Firebase Realtime Database の参照
const gameStatusRef = db.ref("game/status");

// 他のプレイヤーを待つ状態
gameStatusRef.on("value", (snapshot) => {
  const status = snapshot.val();
  console.log("ゲームステータス:", status);
  if (status === "ready") {
    waitingMessage.style.display = "none";
    startButton.disabled = false;
  }
});

// スタートボタンの動作
startButton.addEventListener("click", () => {
  gameStatusRef.set("started"); // データベースに"started"をセット
  waitingMessage.style.display = "none";
  startReactionGame();
});

// 反射神経ゲームの開始
function startReactionGame() {
  setTimeout(() => {
    reactionButton.style.backgroundColor = "green";
    reactionButton.style.display = "block";
    const startTime = Date.now();

    reactionButton.addEventListener("click", () => {
      const reactionTime = Date.now() - startTime;
      alert(`反応時間: ${reactionTime}ms`);
      gameStatusRef.set("ready"); // 次のゲーム準備
    });
  }, Math.random() * 3000 + 2000); // ランダムタイミングで開始
}
