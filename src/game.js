import * as THREE from "three";
import { audio } from "./audio.js";
import { buildWorld, setupLighting } from "./world.js";
import { Particles } from "./particles.js";
import { Player } from "./player.js";
import { Enemy, ENEMY_TYPES } from "./enemies.js";
import { Projectile, Consecration, Pickup } from "./projectiles.js";
import { rollUpgrades, applyUpgrade } from "./upgrades.js";
import { clamp, rand, randInt, pick, TAU, WORLD_RADIUS, lowPolyMat } from "./utils.js";
import { UI } from "./ui.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = "menu"; // menu | playing | levelup | gameover
    this._initRenderer();
    this._initScene();
    this._initInput();

    this.ui = new UI(this);
    this.particles = new Particles(this.scene);

    this.enemies = [];
    this.projectiles = [];
    this.consecrations = [];
    this.pickups = [];

    this.clock = new THREE.Clock();
    this.time = 0;

    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._aimPoint = new THREE.Vector3();
    this._tmp = new THREE.Vector3();

    this.bestScore = Number(localStorage.getItem("ashbringer_best") || 0);

    window.addEventListener("resize", () => this._onResize());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1014);
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camOffset = new THREE.Vector3(0, 22, 16);
    this.camera.position.copy(this.camOffset);
    this.camera.lookAt(0, 0, 0);
    this.camShake = 0;

    this.lights = setupLighting(this.scene);
    this.worldGroup = buildWorld(this.scene);

    this.player = new Player(this.scene);
    this.player.mesh.visible = false;
  }

  _initInput() {
    this.keys = {};
    this.mouse = new THREE.Vector2();
    this.mouseDown = false;
    this.rmbDown = false;

    addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Space") e.preventDefault();
      if (e.code === "KeyM") audio.toggleMute();
      if (e.code === "KeyP" && this.state === "playing") this._togglePause();
    });
    addEventListener("keyup", (e) => { this.keys[e.code] = false; });

    this.canvas.addEventListener("mousemove", (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    this.canvas.addEventListener("mousedown", (e) => {
      audio.init(); audio.resume();
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) { this.rmbDown = true; this._castConsecrate(); }
    });
    addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rmbDown = false;
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // touch (basic): tap to move toward, double-tap nova
    this.touchTarget = null;
    this.canvas.addEventListener("touchstart", (e) => {
      audio.init(); audio.resume();
      this.mouseDown = true;
      this._updateTouch(e);
    }, { passive: true });
    this.canvas.addEventListener("touchmove", (e) => this._updateTouch(e), { passive: true });
    this.canvas.addEventListener("touchend", () => { this.mouseDown = false; });
  }

  _updateTouch(e) {
    if (!e.touches[0]) return;
    const t = e.touches[0];
    this.mouse.x = (t.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
  }

  _togglePause() {
    this.paused = !this.paused;
  }

  // ---------------- Game lifecycle ----------------
  start() {
    audio.init();
    audio.resume();
    audio.startMusic();
    this._resetRun();
    this.state = "playing";
    this.ui.showHUD();
    this.player.mesh.visible = true;
    this._startWave(1);
  }

  _resetRun() {
    // clear entities
    for (const e of this.enemies) e.dispose(this.scene);
    for (const p of this.projectiles) p.dispose(this.scene);
    for (const c of this.consecrations) c.dispose(this.scene);
    for (const pk of this.pickups) pk.dispose(this.scene);
    this.enemies = [];
    this.projectiles = [];
    this.consecrations = [];
    this.pickups = [];
    this.particles.reset();

    this.player.reset();
    this.player._upgradeStacks = {};
    this.player.novaDmgMult = 1; this.player.novaRadiusMult = 1;
    this.player.consecDmgMult = 1; this.player.consecDurMult = 1;
    this.player.dashTimeBonus = 0;

    this.score = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 12;
    this.wave = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.paused = false;
    this.waveActive = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.interWaveTimer = 0;
  }

  // ---------------- Waves ----------------
  _startWave(n) {
    this.wave = n;
    this.waveActive = true;
    this.spawnQueue = this._buildWaveQueue(n);
    this.spawnTimer = 0;
    audio.waveStart();
    const isBoss = n % 5 === 0;
    this.ui.showWaveBanner(isBoss ? `WAVE ${n} — LICH LORD` : `WAVE ${n}`);
    if (isBoss) this.camShake = 0.6;
  }

  _buildWaveQueue(n) {
    const q = [];
    if (n % 5 === 0) {
      // boss wave: lich + adds
      q.push("lich");
      for (let i = 0; i < 4 + n / 5; i++) q.push(pick(["ghoul", "skeleton"]));
      return q;
    }
    const budget = 6 + n * 2.5;
    let spent = 0;
    const costs = { ghoul: 1, skeleton: 1, abomination: 4, necromancer: 3 };
    while (spent < budget) {
      let roll;
      const r = Math.random();
      if (n >= 7 && r < 0.12) roll = "necromancer";
      else if (n >= 4 && r < 0.28) roll = "abomination";
      else if (r < 0.55) roll = "skeleton";
      else roll = "ghoul";
      q.push(roll);
      spent += costs[roll];
    }
    // shuffle
    for (let i = q.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [q[i], q[j]] = [q[j], q[i]];
    }
    return q;
  }

  _spawnFromQueue(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const key = this.spawnQueue.shift();
      this._spawnEnemy(key);
      this.spawnTimer = rand(0.35, 0.9);
    }
  }

  _spawnEnemy(key) {
    const e = new Enemy(key, this.scene);
    // spawn at arena edge away from player
    let x, z, tries = 0;
    do {
      const a = rand(0, TAU);
      const r = rand(WORLD_RADIUS - 12, WORLD_RADIUS - 3);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      tries++;
    } while (Math.hypot(x - this.player.pos.x, z - this.player.pos.z) < 10 && tries < 10);
    e.setPosition(x, z);
    // scale stats with wave for difficulty curve
    const mult = 1 + (this.wave - 1) * 0.10;
    if (!e.def.boss) e.scaleStats(mult);
    else e.scaleStats(1 + (this.wave / 5 - 1) * 0.6);
    // spawn dust
    this.particles.emit(new THREE.Vector3(x, 0.2, z), 12, { color: 0x4aff9a, speed: 4, up: 3, life: 0.6 });
    this.enemies.push(e);
  }

  // ---------------- Abilities ----------------
  _doMelee() {
    if (!this.player.tryMelee()) return;
    audio.smite();
    const px = this.player.pos.x, pz = this.player.pos.z;
    const facing = this.player.facing;
    const range = this.player.meleeRange;
    const arc = this.player.meleeArc;
    let hitAny = false;

    // swing arc particles
    const fx = px + Math.sin(facing) * range * 0.6;
    const fz = pz + Math.cos(facing) * range * 0.6;
    this.particles.emit(new THREE.Vector3(fx, 1.2, fz), 10, { color: 0x9fe8ff, speed: 6, up: 2, life: 0.4, size: 0.8 });

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - px, dz = e.pos.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > range + e.radius) continue;
      const ang = Math.atan2(dx, dz);
      let diff = Math.abs(((ang - facing + Math.PI) % TAU) - Math.PI);
      if (diff > arc / 2) continue;
      hitAny = true;
      this._damageEnemy(e, this.player.baseDamage, this.player.rollCrit(), true);
      e.applyKnockback(px, pz, 6);
    }
    if (hitAny) this.camShake = Math.max(this.camShake, 0.12);
  }

  _castNova() {
    if (!this.player.tryNova()) return;
    audio.nova();
    const px = this.player.pos.x, pz = this.player.pos.z;
    const radius = 8 * (this.player.novaRadiusMult || 1);
    const dmg = 40 * (this.player.novaDmgMult || 1);
    this.camShake = Math.max(this.camShake, 0.35);

    this.particles.burstRing(new THREE.Vector3(px, 1, pz), 48, radius * 1.4, { color: 0xffe08a, life: 0.7, size: 1.2, up: 3 });
    this.particles.emit(new THREE.Vector3(px, 1, pz), 30, { color: 0x9fe8ff, speed: radius, up: 4, life: 0.6 });
    this._spawnShockwave(px, pz, radius, 0xffe08a);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dist = Math.hypot(e.pos.x - px, e.pos.z - pz);
      if (dist <= radius + e.radius) {
        const falloff = 1 - (dist / (radius + 4)) * 0.4;
        this._damageEnemy(e, dmg * falloff, this.player.rollCrit(), false);
        e.applyKnockback(px, pz, 14);
        e.frozen = 0.6;
      }
    }
  }

  _castConsecrate() {
    if (this.state !== "playing" || this.paused) return;
    if (!this.player.tryConsecrate()) return;
    audio.consecrate();
    // place at aim point
    const x = this._aimPoint.x, z = this._aimPoint.z;
    const c = new Consecration(this.scene, x, z, {
      radius: 5,
      dps: 30 * (this.player.consecDmgMult || 1),
      duration: 5 * (this.player.consecDurMult || 1),
    });
    this.consecrations.push(c);
    this.particles.burstRing(new THREE.Vector3(x, 0.3, z), 30, 5, { color: 0xf2c14e, life: 0.8, size: 1, up: 2 });
  }

  _spawnShockwave(x, z, radius, color) {
    const geo = new THREE.RingGeometry(0.5, 0.9, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.3, z);
    this.scene.add(ring);
    const start = this.time;
    const dur = 0.5;
    ring.userData.tick = () => {
      const t = (this.time - start) / dur;
      if (t >= 1) { this.scene.remove(ring); geo.dispose(); mat.dispose(); return false; }
      const s = 0.5 + t * radius;
      ring.scale.set(s, s, s);
      mat.opacity = 0.8 * (1 - t);
      return true;
    };
    if (!this._shockwaves) this._shockwaves = [];
    this._shockwaves.push(ring);
  }

  _doDash() {
    if (!this.player.tryDash()) return;
    audio.dash();
    this.player.dashTime = 0.18 + (this.player.dashTimeBonus || 0);
    const px = this.player.pos.x, pz = this.player.pos.z;
    this.particles.emit(new THREE.Vector3(px, 0.8, pz), 14, { color: 0x9fe8ff, speed: 5, up: 2, life: 0.5 });
  }

  // ---------------- Combat resolution ----------------
  _damageEnemy(e, amount, crit, isMelee) {
    const dmg = crit ? amount * this.player.critMult : amount;
    const killed = e.takeHit(dmg);
    audio.hit(crit);
    this.ui.damageNumber(e.pos, Math.round(dmg), { crit, holy: !isMelee });
    this.particles.emit(new THREE.Vector3(e.pos.x, 1.2, e.pos.z), crit ? 8 : 4, {
      color: isMelee ? 0x9fe8ff : 0xffe08a, speed: 4, up: 3, life: 0.4, size: 0.7,
    });

    if (isMelee && this.player.lifesteal > 0) {
      this.player.heal(dmg * this.player.lifesteal);
    }
    if (killed) this._killEnemy(e);
  }

  _killEnemy(e) {
    this.kills++;
    this._addCombo();
    const gained = Math.round(e.def.score * this.combo);
    this.score += gained;

    audio.enemyDie();
    this.particles.emit(new THREE.Vector3(e.pos.x, 1, e.pos.z), e.def.boss ? 60 : 16, {
      color: 0x4aff9a, speed: e.def.boss ? 12 : 7, up: 5, life: 0.9, size: e.def.boss ? 1.6 : 1,
    });
    this.particles.emit(new THREE.Vector3(e.pos.x, 1, e.pos.z), e.def.boss ? 30 : 8, {
      color: 0xd8d2bf, speed: 5, up: 4, life: 1.1, size: 0.8,
    });

    // drop XP orbs
    const orbs = e.def.boss ? 12 : (e.def.xp > 15 ? 3 : 1);
    for (let i = 0; i < orbs; i++) {
      const ox = e.pos.x + rand(-1, 1), oz = e.pos.z + rand(-1, 1);
      this.pickups.push(new Pickup(this.scene, ox, oz, { value: Math.ceil(e.def.xp / orbs), kind: "xp" }));
    }
    // occasional health/faith drop
    if (Math.random() < (e.def.boss ? 1 : 0.06)) {
      this.pickups.push(new Pickup(this.scene, e.pos.x, e.pos.z, { value: 20, kind: Math.random() < 0.5 ? "health" : "faith" }));
    }

    if (e.def.boss) {
      this.camShake = Math.max(this.camShake, 0.7);
      this.score += 1000;
    }

    e.dispose(this.scene);
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
  }

  _addCombo() {
    this.combo = Math.min(99, this.combo + 1);
    this.comboTimer = 3.0;
    this.ui.pulseCombo();
  }

  _gainXP(amount) {
    this.xp += amount;
    audio.pickup();
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this._levelUp();
    }
  }

  _levelUp() {
    this.level++;
    this.xpToNext = Math.round(this.xpToNext * 1.35 + 6);
    this.player.maxFaith += 5;
    audio.levelUp();
    this.particles.burstRing(new THREE.Vector3(this.player.pos.x, 0.5, this.player.pos.z), 40, 6, { color: 0xf2c14e, life: 1, size: 1.2, up: 4 });
    // present choices
    this.pendingUpgrades = rollUpgrades(this.player, 3);
    this.state = "levelup";
    this.ui.showLevelUp(this.pendingUpgrades);
  }

  chooseUpgrade(index) {
    const u = this.pendingUpgrades[index];
    if (!u) return;
    applyUpgrade(this.player, u);
    this.pendingUpgrades = null;
    this.state = "playing";
    this.ui.hideLevelUp();
    audio.pickup();
  }

  _playerHit(amount, sourceX, sourceZ, sourceEnemy) {
    const dealt = this.player.takeDamage(amount);
    if (dealt > 0) {
      audio.playerHurt();
      this.ui.damageNumber(this.player.pos, Math.round(dealt), { player: true });
      this.camShake = Math.max(this.camShake, 0.3);
      this.combo = 1;
      // thorns
      if (this.player.thorns > 0 && sourceEnemy && sourceEnemy.alive) {
        const reflect = amount * this.player.thorns;
        if (sourceEnemy.takeHit(reflect)) this._killEnemy(sourceEnemy);
        else this.ui.damageNumber(sourceEnemy.pos, Math.round(reflect), { holy: true });
      }
      if (!this.player.alive) this._gameOver();
    }
  }

  _gameOver() {
    this.state = "gameover";
    audio.gameOver();
    audio.stopMusic();
    this.camShake = 0.5;
    // death burst
    this.particles.emit(new THREE.Vector3(this.player.pos.x, 1, this.player.pos.z), 40, { color: 0xffe08a, speed: 8, up: 6, life: 1.2 });
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem("ashbringer_best", String(this.bestScore));
    }
    setTimeout(() => this.ui.showGameOver({
      score: this.score, wave: this.wave, kills: this.kills, level: this.level, best: this.bestScore,
    }), 900);
  }

  // ---------------- Update loop ----------------
  _loop() {
    requestAnimationFrame(this._loop);
    let dt = this.clock.getDelta();
    dt = Math.min(dt, 0.05); // clamp big frame gaps
    this.time += dt;

    if (this.state === "playing" && !this.paused) {
      this._update(dt);
    }
    // particles/shockwaves always animate a little (death screen)
    this.particles.update(dt);
    this._updateShockwaves();
    this._updateCamera(dt);

    this.renderer.render(this.scene, this.camera);
  }

  _update(dt) {
    // aim point on ground
    this._raycaster.setFromCamera(this.mouse, this.camera);
    this._raycaster.ray.intersectPlane(this._groundPlane, this._aimPoint);
    if (!this._aimPoint || isNaN(this._aimPoint.x)) this._aimPoint.set(this.player.pos.x, 0, this.player.pos.z + 5);

    // movement input
    const input = { x: 0, z: 0 };
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) input.z -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) input.z += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) input.x -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) input.x += 1;

    // touch movement: move toward aim point if mouse held and no keys
    if (this.mouseDown && input.x === 0 && input.z === 0 && this._isTouchLike()) {
      const dx = this._aimPoint.x - this.player.pos.x;
      const dz = this._aimPoint.z - this.player.pos.z;
      if (Math.hypot(dx, dz) > 2) { input.x = dx; input.z = dz; }
    }

    const aimAngle = Math.atan2(this._aimPoint.x - this.player.pos.x, this._aimPoint.z - this.player.pos.z);
    this.player.update(dt, input, aimAngle);

    // abilities
    if (this.mouseDown && !this._isTouchLike()) this._doMelee();
    if (this.mouseDown && this._isTouchLike()) this._doMelee();
    if (this.keys["Space"]) this._castNova();
    if (this.keys["KeyQ"]) this._castConsecrate();
    if (this.keys["ShiftLeft"] || this.keys["ShiftRight"]) this._doDash();

    // combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    // spawn & wave logic
    if (this.waveActive) {
      this._spawnFromQueue(dt);
      if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
        this.waveActive = false;
        this.interWaveTimer = 2.5;
        this.player.heal(this.player.maxHp * 0.15); // breather heal
      }
    } else {
      this.interWaveTimer -= dt;
      if (this.interWaveTimer <= 0) this._startWave(this.wave + 1);
    }

    // update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const ev = e.update(dt, this.player.pos, this.time);
      if (ev.attack) {
        this._playerHitCheck(e);
      }
      if (ev.shoot) this._enemyShoot(e);
      if (ev.summon) this._enemySummon(e);
    }

    // consecrations
    for (let i = this.consecrations.length - 1; i >= 0; i--) {
      const c = this.consecrations[i];
      const tick = c.update(dt);
      if (tick) {
        for (const e of this.enemies) {
          if (e.alive && c.contains(e.pos.x, e.pos.z)) {
            const d = c.dps * 0.25;
            if (e.takeHit(d)) this._killEnemy(e);
            else this.ui.damageNumber(e.pos, Math.round(d), { holy: true, small: true });
          }
        }
      }
      if (c.dead) { c.dispose(this.scene); this.consecrations.splice(i, 1); }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      const dist = Math.hypot(p.pos.x - this.player.pos.x, p.pos.z - this.player.pos.z);
      if (dist < 1.0 + p.radius) {
        this._playerHit(p.damage, p.pos.x, p.pos.z, null);
        p.dead = true;
        this.particles.emit(new THREE.Vector3(p.pos.x, 1.2, p.pos.z), 8, { color: 0x8a5aff, speed: 4, up: 2, life: 0.4 });
      }
      if (p.dead) { p.dispose(this.scene); this.projectiles.splice(i, 1); }
    }

    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      const collected = pk.update(dt, this.player, this.time);
      if (collected) {
        if (pk.kind === "xp") this._gainXP(pk.value);
        else if (pk.kind === "health") { this.player.heal(pk.value); audio.pickup(); }
        else if (pk.kind === "faith") { this.player.faith = clamp(this.player.faith + pk.value, 0, this.player.maxFaith); audio.pickup(); }
        this.particles.emit(new THREE.Vector3(pk.pos.x, 0.8, pk.pos.z), 6, { color: 0x6bff8a, speed: 3, up: 2, life: 0.4, size: 0.6 });
      }
      if (pk.dead) { pk.dispose(this.scene); this.pickups.splice(i, 1); }
    }

    this.ui.updateHUD();
  }

  _playerHitCheck(e) {
    // confirm still in range at attack moment
    const dist = Math.hypot(e.pos.x - this.player.pos.x, e.pos.z - this.player.pos.z);
    if (dist <= e.radius + 1.6) {
      this._playerHit(e.damage, e.pos.x, e.pos.z, e);
    }
  }

  _enemyShoot(e) {
    const color = e.def.boss ? 0x8a5aff : 0x6bff8a;
    const p = new Projectile(this.scene, e.pos, this.player.pos, {
      speed: e.def.boss ? 12 : 10,
      damage: e.def.boss ? 18 : 12,
      color,
    });
    this.projectiles.push(p);
    // boss triple shot
    if (e.def.boss) {
      for (const spread of [-0.3, 0.3]) {
        const target = {
          x: this.player.pos.x + Math.cos(spread) * 3,
          z: this.player.pos.z + Math.sin(spread) * 3,
        };
        this.projectiles.push(new Projectile(this.scene, e.pos, target, { speed: 12, damage: 18, color }));
      }
    }
  }

  _enemySummon(e) {
    const count = e.def.boss ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const r = rand(2, 4);
      const sk = new Enemy(pick(["ghoul", "skeleton"]), this.scene);
      sk.setPosition(e.pos.x + Math.cos(a) * r, e.pos.z + Math.sin(a) * r);
      sk.scaleStats(1 + (this.wave - 1) * 0.08);
      this.enemies.push(sk);
    }
    this.particles.burstRing(new THREE.Vector3(e.pos.x, 0.5, e.pos.z), 20, 3, { color: 0x6bff8a, life: 0.7, size: 1, up: 2 });
  }

  _updateShockwaves() {
    if (!this._shockwaves) return;
    for (let i = this._shockwaves.length - 1; i >= 0; i--) {
      const keep = this._shockwaves[i].userData.tick();
      if (!keep) this._shockwaves.splice(i, 1);
    }
  }

  _isTouchLike() {
    return "ontouchstart" in window && !this._hadMouseMove;
  }

  _updateCamera(dt) {
    const target = this.state === "playing" || this.state === "levelup"
      ? this.player.pos
      : (this.player ? this.player.pos : new THREE.Vector3());
    const desired = this._tmp.copy(target).add(this.camOffset);
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));

    // shake
    if (this.camShake > 0) {
      this.camShake = Math.max(0, this.camShake - dt * 1.6);
      const s = this.camShake * this.camShake;
      this.camera.position.x += rand(-1, 1) * s * 2;
      this.camera.position.y += rand(-1, 1) * s * 2;
      this.camera.position.z += rand(-1, 1) * s * 2;
    }
    const look = this._tmp.copy(target);
    look.y = 0;
    this.camera.lookAt(look);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  restart() {
    this.start();
  }
}
