import { Game } from "./game.js";

const canvas = document.getElementById("game");

// detect real mouse movement to disable touch-mode heuristics on desktop
window.addEventListener("mousemove", function onMove() {
  if (window._game) window._game._hadMouseMove = true;
}, { passive: true });

try {
  const game = new Game(canvas);
  window._game = game;
} catch (err) {
  console.error("Failed to start Ashbringer:", err);
  const loading = document.getElementById("loading");
  if (loading) {
    loading.classList.remove("hidden");
    loading.innerHTML = `<div class="overlay-inner"><h2 class="loading-text" style="color:#ff6b5a">Failed to load.</h2><p style="opacity:.7;margin-top:12px">${err.message}</p><p style="opacity:.5;margin-top:8px;font-size:13px">Make sure you're running via a local web server (not file://).</p></div>`;
  }
}
