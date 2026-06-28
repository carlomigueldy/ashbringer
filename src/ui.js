import * as THREE from "three";
import { clamp } from "./utils.js";

// Handles all DOM/HUD updates and screens.
export class UI {
  constructor(game) {
    this.game = game;
    this.$ = (id) => document.getElementById(id);

    this.hud = this.$("hud");
    this.startScreen = this.$("start-screen");
    this.levelupScreen = this.$("levelup-screen");
    this.gameoverScreen = this.$("gameover-screen");
    this.loading = this.$("loading");

    this.hpFill = this.$("hp-fill");
    this.hpText = this.$("hp-text");
    this.faithFill = this.$("faith-fill");
    this.faithText = this.$("faith-text");
    this.xpFill = this.$("xp-fill");
    this.levelEl = this.$("level");
    this.scoreEl = this.$("score");
    this.waveEl = this.$("wave");
    this.comboEl = this.$("combo");
    this.comboStat = document.querySelector(".combo-stat");
    this.waveBanner = this.$("wave-banner");

    this.ab = {
      nova: this.$("ab-nova"),
      consecrate: this.$("ab-consecrate"),
      dash: this.$("ab-dash"),
    };

    // create FX layer + vignette
    this.fxLayer = document.createElement("div");
    this.fxLayer.id = "fx-layer";
    document.getElementById("app").appendChild(this.fxLayer);
    this.vignette = document.createElement("div");
    this.vignette.id = "vignette";
    document.getElementById("app").appendChild(this.vignette);

    this._bindButtons();
    this.loading.classList.add("hidden");
  }

  _bindButtons() {
    this.$("start-btn").addEventListener("click", () => this.game.start());
    this.$("restart-btn").addEventListener("click", () => {
      this.gameoverScreen.classList.add("hidden");
      this.game.restart();
    });
  }

  showHUD() {
    this.startScreen.classList.add("hidden");
    this.gameoverScreen.classList.add("hidden");
    this.levelupScreen.classList.add("hidden");
    this.hud.classList.remove("hidden");
  }

  updateHUD() {
    const g = this.game, p = g.player;
    const hpPct = clamp((p.hp / p.maxHp) * 100, 0, 100);
    this.hpFill.style.width = hpPct + "%";
    this.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    const faithPct = clamp((p.faith / p.maxFaith) * 100, 0, 100);
    this.faithFill.style.width = faithPct + "%";
    this.faithText.textContent = `${Math.ceil(p.faith)} / ${p.maxFaith}`;
    this.xpFill.style.width = clamp((g.xp / g.xpToNext) * 100, 0, 100) + "%";
    this.levelEl.textContent = g.level;
    this.scoreEl.textContent = g.score.toLocaleString();
    this.waveEl.textContent = g.wave;
    this.comboEl.textContent = "x" + g.combo;

    // ability cooldown overlays
    this._cd(this.ab.nova, p.novaCd, p.novaCdMax, p.faith >= p.novaCost);
    this._cd(this.ab.consecrate, p.consecrateCd, p.consecrateCdMax, p.faith >= p.consecrateCost);
    this._cd(this.ab.dash, p.dashCd, p.dashCdMax, true);

    // low-hp vignette
    const danger = hpPct < 35 ? (1 - hpPct / 35) : 0;
    this.vignette.style.boxShadow = `inset 0 0 ${120 + danger * 120}px rgba(150, 10, 10, ${danger * 0.6})`;
  }

  _cd(el, cd, cdMax, hasResource) {
    if (!el) return;
    let overlay = el.querySelector(".cooldown");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "cooldown";
      el.appendChild(overlay);
    }
    const ratio = cdMax > 0 ? clamp(cd / cdMax, 0, 1) : 0;
    overlay.style.transform = `scaleY(${ratio})`;
    el.style.opacity = hasResource && cd <= 0 ? "1" : "0.5";
    el.classList.toggle("ready", hasResource && cd <= 0);
  }

  pulseCombo() {
    this.comboStat.classList.remove("pulse");
    void this.comboStat.offsetWidth;
    this.comboStat.classList.add("pulse");
  }

  showWaveBanner(text) {
    this.waveBanner.textContent = text;
    this.waveBanner.classList.remove("show");
    void this.waveBanner.offsetWidth;
    this.waveBanner.classList.add("show");
  }

  // world position -> screen, spawn floating damage number
  damageNumber(worldPos, value, opts = {}) {
    const g = this.game;
    const v = new THREE.Vector3(worldPos.x, 1.8, worldPos.z);
    v.project(g.camera);
    if (v.z > 1) return; // behind camera
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement("div");
    el.className = "dmg";
    if (opts.crit) el.classList.add("crit");
    if (opts.holy) el.classList.add("holy");
    if (opts.player) el.classList.add("player");
    el.textContent = (opts.player ? "-" : "") + value;
    if (opts.small) el.style.fontSize = "13px";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.setProperty("--rx", (Math.random() * 30 - 15) + "px");
    this.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  showLevelUp(upgrades) {
    const container = this.$("upgrade-cards");
    container.innerHTML = "";
    upgrades.forEach((u, i) => {
      const card = document.createElement("div");
      card.className = "upgrade-card";
      card.innerHTML = `
        <div class="upgrade-icon">${u.icon}</div>
        <div class="upgrade-name">${u.name}</div>
        <div class="upgrade-desc">${u.desc}</div>
      `;
      card.addEventListener("click", () => this.game.chooseUpgrade(i));
      container.appendChild(card);
    });
    this.levelupScreen.classList.remove("hidden");

    // keyboard 1/2/3 selection
    this._lvlKeyHandler = (e) => {
      if (e.code === "Digit1") this.game.chooseUpgrade(0);
      if (e.code === "Digit2") this.game.chooseUpgrade(1);
      if (e.code === "Digit3") this.game.chooseUpgrade(2);
    };
    addEventListener("keydown", this._lvlKeyHandler);
  }

  hideLevelUp() {
    this.levelupScreen.classList.add("hidden");
    if (this._lvlKeyHandler) { removeEventListener("keydown", this._lvlKeyHandler); this._lvlKeyHandler = null; }
  }

  showGameOver(stats) {
    this.hud.classList.add("hidden");
    this.$("final-score").textContent = stats.score.toLocaleString();
    this.$("final-wave").textContent = stats.wave;
    this.$("final-kills").textContent = stats.kills;
    this.$("final-level").textContent = stats.level;
    const best = this.$("best-score");
    if (stats.score >= stats.best && stats.score > 0) {
      best.textContent = "\u2605 NEW BEST SCORE \u2605";
    } else {
      best.textContent = "Best: " + stats.best.toLocaleString();
    }
    this.gameoverScreen.classList.remove("hidden");
  }
}
