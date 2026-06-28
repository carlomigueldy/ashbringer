import * as THREE from "three";
import { lowPolyMat, rand, TAU, WORLD_RADIUS, confineToArena } from "./utils.js";

// Scourge enemy archetypes. Each builds a low-poly undead model.

const boneMat = () => lowPolyMat(0xd8d2bf, { roughness: 0.9 });
const rotMat = () => lowPolyMat(0x4a6b3a, { roughness: 1, emissive: 0x12260a, emissiveIntensity: 0.5 });
const eyeMat = () => lowPolyMat(0x6bff8a, { emissive: 0x6bff8a, emissiveIntensity: 2 });

export const ENEMY_TYPES = {
  ghoul: {
    name: "Ghoul",
    hp: 30, speed: 4.2, damage: 8, radius: 0.7, xp: 5, score: 10,
    color: 0x6b8f4a, attackCd: 0.9, build: buildGhoul,
  },
  skeleton: {
    name: "Skeleton",
    hp: 22, speed: 5.6, damage: 7, radius: 0.6, xp: 5, score: 12,
    color: 0xd8d2bf, attackCd: 0.8, build: buildSkeleton,
  },
  abomination: {
    name: "Abomination",
    hp: 140, speed: 2.4, damage: 22, radius: 1.4, xp: 22, score: 50,
    color: 0x5a7a3a, attackCd: 1.4, build: buildAbomination,
  },
  necromancer: {
    name: "Necromancer",
    hp: 60, speed: 3.0, damage: 0, radius: 0.7, xp: 18, score: 40,
    color: 0x3a2a5a, attackCd: 3.0, build: buildNecromancer, ranged: true, summoner: true,
  },
  lich: {
    name: "Lich Lord",
    hp: 900, speed: 2.6, damage: 30, radius: 2.0, xp: 200, score: 1000,
    color: 0x2a1a4a, attackCd: 2.2, build: buildLich, boss: true, ranged: true,
  },
};

function buildGhoul() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), rotMat());
  body.position.y = 0.9; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), rotMat());
  head.position.y = 1.55; head.castShadow = true; g.add(head);
  addEyes(g, 1.58, 0.13);
  // arms hanging forward
  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, rotMat());
    arm.position.set(s * 0.45, 0.95, 0.15);
    arm.rotation.x = -0.6;
    g.add(arm);
    if (s < 0) g.userData.armL = arm; else g.userData.armR = arm;
  }
  legs(g, rotMat());
  return g;
}

function buildSkeleton() {
  const g = new THREE.Group();
  const ribs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.35), boneMat());
  ribs.position.y = 1.0; ribs.castShadow = true; g.add(ribs);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 4), boneMat());
  spine.position.y = 0.6; g.add(spine);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), boneMat());
  skull.position.y = 1.55; skull.castShadow = true; g.add(skull);
  addEyes(g, 1.56, 0.1);
  // sword arm
  const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  const armR = new THREE.Mesh(armGeo, boneMat());
  armR.position.set(0.38, 1.05, 0.1); armR.rotation.x = -0.8; g.add(armR);
  g.userData.armR = armR;
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.04), lowPolyMat(0x8a8a8a, { metalness: 0.6 }));
  sword.position.set(0.38, 1.3, 0.35); sword.rotation.x = 0.4; g.add(sword);
  const armL = new THREE.Mesh(armGeo, boneMat());
  armL.position.set(-0.38, 1.05, 0); g.add(armL);
  g.userData.armL = armL;
  legs(g, boneMat());
  return g;
}

function buildAbomination() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 1.2), rotMat());
  body.position.y = 1.6; body.castShadow = true; g.add(body);
  // stitches / growths
  for (let i = 0; i < 4; i++) {
    const lump = new THREE.Mesh(new THREE.SphereGeometry(rand(0.25, 0.45), 5, 4), rotMat());
    lump.position.set(rand(-0.6, 0.6), rand(1.0, 2.3), rand(0.3, 0.7));
    g.add(lump);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), lowPolyMat(0x6b8f4a));
  head.position.set(0.2, 2.6, 0.1); head.castShadow = true; g.add(head);
  addEyes(g, 2.62, 0.18, 0.2);
  const armGeo = new THREE.BoxGeometry(0.5, 1.3, 0.5);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, rotMat());
    arm.position.set(s * 1.1, 1.5, 0.2);
    arm.rotation.x = -0.4;
    arm.castShadow = true;
    g.add(arm);
    if (s < 0) g.userData.armL = arm; else g.userData.armR = arm;
  }
  legs(g, rotMat(), 0.4, 1.0);
  g.scale.setScalar(1.15);
  return g;
}

function buildNecromancer() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 6), lowPolyMat(0x3a2a5a, { roughness: 1 }));
  robe.position.y = 0.8; robe.castShadow = true; g.add(robe);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 6), lowPolyMat(0x2a1a4a));
  hood.position.y = 1.75; g.add(hood);
  addEyes(g, 1.6, 0.09, 0.15);
  // staff
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 4), lowPolyMat(0x2a2018));
  staff.position.set(0.5, 1.0, 0); g.add(staff);
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), eyeMat());
  orb.position.set(0.5, 2.0, 0); g.add(orb);
  const orbLight = new THREE.PointLight(0x6bff8a, 1, 5, 2);
  orb.add(orbLight);
  g.userData.orb = orb;
  return g;
}

function buildLich() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 8), lowPolyMat(0x2a1a4a, { roughness: 1, emissive: 0x1a0a2a, emissiveIntensity: 0.6 }));
  robe.position.y = 1.6; robe.castShadow = true; g.add(robe);
  // ribcage
  const ribs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.6), boneMat());
  ribs.position.y = 3.0; g.add(ribs);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.7), boneMat());
  skull.position.y = 3.9; skull.castShadow = true; g.add(skull);
  addEyes(g, 3.95, 0.16, 0.25);
  // crown
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 0.3, 6), lowPolyMat(0xf2c14e, { metalness: 0.7, emissive: 0x4a3a10, emissiveIntensity: 0.5 }));
  crown.position.y = 4.4; g.add(crown);
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 4), lowPolyMat(0xf2c14e, { metalness: 0.7 }));
    const a = (i / 6) * TAU;
    spike.position.set(Math.cos(a) * 0.45, 4.6, Math.sin(a) * 0.45);
    g.add(spike);
  }
  // floating arms with orbs
  const armGeo = new THREE.BoxGeometry(0.25, 1.4, 0.25);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, boneMat());
    arm.position.set(s * 1.1, 2.9, 0.3); arm.rotation.x = -0.6; g.add(arm);
    if (s < 0) g.userData.armL = arm; else g.userData.armR = arm;
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), eyeMat());
    orb.position.set(s * 1.3, 2.3, 0.6); g.add(orb);
    const ol = new THREE.PointLight(0x6bff8a, 1.5, 7, 2); orb.add(ol);
  }
  const auraLight = new THREE.PointLight(0x8a5aff, 2, 12, 2);
  auraLight.position.y = 3; g.add(auraLight);
  g.scale.setScalar(1.0);
  return g;
}

function addEyes(g, y, size, fwd = 0.12) {
  const geo = new THREE.SphereGeometry(size, 5, 4);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(geo, eyeMat());
    eye.position.set(s * size * 1.3, y, 0.22 + fwd);
    g.add(eye);
  }
}

function legs(g, mat, w = 0.2, h = 0.7) {
  const legGeo = new THREE.BoxGeometry(w, h, w);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(s * 0.2, h / 2, 0);
    leg.castShadow = true;
    g.add(leg);
    if (s < 0) g.userData.legL = leg; else g.userData.legR = leg;
  }
}

let _id = 0;

export class Enemy {
  constructor(typeKey, scene) {
    const t = ENEMY_TYPES[typeKey];
    this.typeKey = typeKey;
    this.def = t;
    this.id = _id++;
    this.mesh = t.build();
    scene.add(this.mesh);
    this.maxHp = t.hp;
    this.hp = t.hp;
    this.speed = t.speed;
    this.damage = t.damage;
    this.radius = t.radius;
    this.attackCd = 0;
    this.attackCdMax = t.attackCd;
    this.walkPhase = Math.random() * TAU;
    this.alive = true;
    this.dead = false;
    this.hitFlash = 0;
    this.spawnAnim = 1; // rises from ground
    this.frozen = 0;
    this.knockback = new THREE.Vector3();
    this.summonTimer = rand(2, 4);
    this.shootTimer = rand(1.5, 3);
    this.attackLunge = 0;
    this.materials = [];
    this.mesh.traverse((o) => { if (o.isMesh) this.materials.push(o.material); });
    this._origEmissive = this.materials.map((m) => m.emissive ? m.emissive.getHex() : 0);
  }

  setPosition(x, z) {
    this.mesh.position.set(x, -3, z); // start underground for rise effect
    this.pos = this.mesh.position;
  }

  scaleStats(mult) {
    this.maxHp *= mult; this.hp = this.maxHp;
    this.damage *= mult;
  }

  takeHit(amount) {
    this.hp -= amount;
    this.hitFlash = 0.12;
    if (this.hp <= 0 && !this.dead) {
      this.alive = false;
      this.dead = true;
      return true;
    }
    return false;
  }

  applyKnockback(fromX, fromZ, force) {
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.knockback.x += (dx / d) * force;
    this.knockback.z += (dz / d) * force;
  }

  // returns: {attack:bool, shoot:bool, summon:bool}
  update(dt, target, time) {
    const events = { attack: false, shoot: false, summon: false };
    if (!this.alive) return events;

    // rise from ground
    if (this.spawnAnim > 0) {
      this.spawnAnim -= dt * 1.5;
      this.pos.y = Math.min(0, -3 * Math.max(0, this.spawnAnim));
      if (this.spawnAnim <= 0) this.pos.y = 0;
    }

    this.attackCd = Math.max(0, this.attackCd - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.frozen = Math.max(0, this.frozen - dt);
    this.attackLunge = Math.max(0, this.attackLunge - dt * 4);

    // hit flash visual
    for (let i = 0; i < this.materials.length; i++) {
      const m = this.materials[i];
      if (!m.emissive) continue;
      if (this.hitFlash > 0) m.emissive.setHex(0xffffff);
      else m.emissive.setHex(this._origEmissive[i]);
    }

    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    this.mesh.rotation.y = ang;

    // apply knockback
    if (this.knockback.lengthSq() > 0.01) {
      this.pos.x += this.knockback.x * dt;
      this.pos.z += this.knockback.z * dt;
      this.knockback.multiplyScalar(0.86);
    }

    const moveMul = this.frozen > 0 ? 0.25 : 1;

    if (this.def.boss) {
      this._bossLogic(dt, dist, dx, dz, moveMul, events);
    } else if (this.def.summoner) {
      // necromancer: keep distance, summon & cast
      const ideal = 14;
      if (dist > ideal + 2) this._moveToward(dx, dz, dist, dt, moveMul);
      else if (dist < ideal - 2) this._moveToward(-dx, -dz, dist, dt, moveMul);
      this.summonTimer -= dt;
      if (this.summonTimer <= 0 && this.spawnAnim <= 0) {
        this.summonTimer = rand(5, 8);
        events.summon = true;
      }
      this.shootTimer -= dt;
      if (this.shootTimer <= 0 && this.spawnAnim <= 0) {
        this.shootTimer = rand(2.5, 4);
        events.shoot = true;
      }
    } else {
      // melee chaser
      if (dist > this.radius + 1.0) {
        this._moveToward(dx, dz, dist, dt, moveMul);
      } else if (this.attackCd <= 0 && this.spawnAnim <= 0) {
        this.attackCd = this.attackCdMax;
        this.attackLunge = 1;
        events.attack = true;
      }
    }

    confineToArena(this.pos, this.radius);
    this._animate(dt, time);
    return events;
  }

  _bossLogic(dt, dist, dx, dz, moveMul, events) {
    const ideal = 8;
    if (dist > ideal + 3) this._moveToward(dx, dz, dist, dt, moveMul);
    else if (dist < ideal - 2) this._moveToward(-dx, -dz, dist, dt, moveMul);
    // strafe
    this.pos.x += -dz / (dist || 1) * this.speed * 0.5 * dt * moveMul;
    this.pos.z += dx / (dist || 1) * this.speed * 0.5 * dt * moveMul;

    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && this.spawnAnim <= 0) {
      this.shootTimer = this.attackCdMax;
      events.shoot = true;
    }
    this.summonTimer -= dt;
    if (this.summonTimer <= 0 && this.spawnAnim <= 0) {
      this.summonTimer = rand(8, 12);
      events.summon = true;
    }
    // melee if close
    if (dist < this.radius + 1.5 && this.attackCd <= 0) {
      this.attackCd = 1.0;
      this.attackLunge = 1;
      events.attack = true;
    }
  }

  _moveToward(dx, dz, dist, dt, mul) {
    const d = dist || 1;
    this.pos.x += (dx / d) * this.speed * dt * mul;
    this.pos.z += (dz / d) * this.speed * dt * mul;
    this.walkPhase += dt * this.speed * 1.5;
  }

  _animate(dt, time) {
    const u = this.mesh.userData;
    const swing = Math.sin(this.walkPhase) * 0.6;
    if (u.legL) u.legL.rotation.x = swing;
    if (u.legR) u.legR.rotation.x = -swing;
    const lunge = Math.sin(this.attackLunge * Math.PI) * 1.2;
    if (u.armR) u.armR.rotation.x = -0.6 - lunge;
    if (u.armL) u.armL.rotation.x = -0.6 - lunge * 0.5;
    if (u.orb) {
      u.orb.rotation.y += dt * 2;
      u.orb.position.y = (this.def.boss ? 2.3 : 2.0) + Math.sin(time * 3) * 0.1;
    }
    // float bob for casters
    if (this.def.summoner || this.def.boss) {
      this.mesh.position.y = (this.spawnAnim > 0 ? this.pos.y : 0) + Math.sin(time * 2 + this.id) * 0.15;
    }
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); }
    });
  }
}
