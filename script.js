// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyD0x_TU433xg_PXTzfpeqXRF7ZZGgceoqw",
  authDomain: "gh-game-9a5a0.firebaseapp.com",
  databaseURL: "https://gh-game-9a5a0-default-rtdb.firebaseio.com",
  projectId: "gh-game-9a5a0",
  storageBucket: "gh-game-9a5a0.firebasestorage.app",
  messagingSenderId: "137631838692",
  appId: "1:137631838692:web:40157762f81ea19c8957f1",
};

// Firebase 初期化
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 要素取得
const startButton = document.getElementById("startButton");
const reactionButton = document.getElementById("reactionButton");
const waitingMessage = document.getElementById("waiting");

// ゲーム状態
let isGameStarted = false;

// 他プレイヤーを待つ
onValue(ref(db, "game/status"), (snapshot) => {
  const status = snapshot.val();
  if (status === "ready") {
    waitingMessage.style.display = "none";
    startButton.disabled = false;
  }
});

// スタートボタン
startButton.addEventListener("click", () => {
  set(ref(db, "game/status"), "started");
  waitingMessage.style.display = "none";
  startReactionGame();
});

// 反射神経ゲーム
function startReactionGame() {
  setTimeout(() => {
    reactionButton.style.backgroundColor = "green";
    reactionButton.style.display = "block";
    const startTime = Date.now();

    reactionButton.addEventListener("click", () => {
      const reactionTime = Date.now() - startTime;
      alert(`反応時間: ${reactionTime}ms`);
      set(ref(db, "game/status"), "ready"); // 次のゲームを準備
    });
  }, Math.random() * 3000 + 2000);
}
