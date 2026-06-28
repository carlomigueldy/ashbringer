import * as THREE from "three";
import { lowPolyMat, clamp, confineToArena, approachAngle } from "./utils.js";

// Builds a low-poly Paladin: armored body, helm, cape, glowing sword & shield.
export function buildPaladin() {
  const g = new THREE.Group();

  const steel = lowPolyMat(0xb8c0cc, { roughness: 0.4, metalness: 0.6 });
  const steelDark = lowPolyMat(0x6b7280, { roughness: 0.5, metalness: 0.5 });
  const gold = lowPolyMat(0xf2c14e, { roughness: 0.3, metalness: 0.7, emissive: 0x4a3a10, emissiveIntensity: 0.4 });
  const cloth = lowPolyMat(0x8a1f2a, { roughness: 0.9 });
  const skin = lowPolyMat(0xd9a87a);

  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.55), steel);
  torso.position.y = 1.5;
  torso.castShadow = true;
  g.add(torso);

  // chest emblem
  const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.08), gold);
  emblem.position.set(0, 1.55, 0.3);
  g.add(emblem);

  // pelvis
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.5), steelDark);
  pelvis.position.y = 0.85;
  pelvis.castShadow = true;
  g.add(pelvis);

  // legs
  const legGeo = new THREE.BoxGeometry(0.32, 0.85, 0.34);
  const legL = new THREE.Mesh(legGeo, steelDark);
  legL.position.set(-0.22, 0.42, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.x = 0.22;
  g.add(legL, legR);
  g.userData.legL = legL;
  g.userData.legR = legR;

  // shoulders
  const shoulderGeo = new THREE.SphereGeometry(0.26, 6, 5);
  const shL = new THREE.Mesh(shoulderGeo, gold);
  shL.position.set(-0.6, 1.85, 0);
  shL.scale.set(1, 0.8, 1);
  const shR = shL.clone();
  shR.position.x = 0.6;
  g.add(shL, shR);

  // arms
  const armGeo = new THREE.BoxGeometry(0.24, 0.8, 0.24);
  const armL = new THREE.Mesh(armGeo, steel);
  armL.position.set(-0.6, 1.35, 0);
  armL.castShadow = true;
  const armR = armL.clone();
  armR.position.x = 0.6;
  g.add(armL, armR);
  g.userData.armL = armL;
  g.userData.armR = armR;

  // head + helm
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
  head.position.y = 2.28;
  head.castShadow = true;
  g.add(head);
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), steel);
  helm.position.y = 2.45;
  g.add(helm);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.3), gold);
  crest.position.set(0, 2.7, 0);
  g.add(crest);

  // cape
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.3, 1, 2), cloth);
  cape.position.set(0, 1.45, -0.32);
  cape.material.side = THREE.DoubleSide;
  g.add(cape);
  g.userData.cape = cape;

  // ---- Right arm weapon group (sword) ----
  const weaponArm = new THREE.Group();
  weaponArm.position.set(0.6, 1.75, 0);
  g.add(weaponArm);
  g.userData.weaponArm = weaponArm;

  const handR = new THREE.Mesh(armGeo, steel);
  handR.position.set(0, -0.4, 0);
  handR.scale.set(1, 1, 1);
  weaponArm.add(handR);

  const sword = new THREE.Group();
  sword.position.set(0, -0.7, 0.1);
  weaponArm.add(sword);
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), gold);
  sword.add(hilt);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.12), gold);
  guard.position.y = 0.15;
  sword.add(guard);
  const bladeMat = lowPolyMat(0xeaf6ff, { roughness: 0.2, metalness: 0.3, emissive: 0x9fe8ff, emissiveIntensity: 0.8 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.06), bladeMat);
  blade.position.y = 0.95;
  blade.castShadow = true;
  sword.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.35, 4), bladeMat);
  tip.position.y = 1.85;
  sword.add(tip);
  g.userData.blade = blade;
  g.userData.bladeMat = bladeMat;

  // sword glow light
  const swordLight = new THREE.PointLight(0x9fe8ff, 1.2, 6, 2);
  swordLight.position.y = 1;
  sword.add(swordLight);
  g.userData.swordLight = swordLight;

  // ---- Left arm shield ----
  const shieldArm = new THREE.Group();
  shieldArm.position.set(-0.6, 1.5, 0.1);
  g.add(shieldArm);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.12, 6), gold);
  shield.rotation.x = Math.PI / 2;
  shield.position.set(0, 0, 0.25);
  shield.castShadow = true;
  shieldArm.add(shield);
  const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), steel);
  shieldBoss.position.set(0, 0, 0.32);
  shieldArm.add(shieldBoss);
  g.userData.shieldArm = shieldArm;

  g.scale.setScalar(0.95);
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = buildPaladin();
    scene.add(this.mesh);

    this.pos = this.mesh.position;
    this.pos.set(0, 0, 0);
    this.facing = 0;
    this.velY = 0;

    // base stats
    this.maxHp = 100;
    this.hp = 100;
    this.maxFaith = 100;
    this.faith = 100;
    this.faithRegen = 8; // per sec
    this.speed = 9;
    this.baseDamage = 24;
    this.critChance = 0.15;
    this.critMult = 2.2;
    this.meleeRange = 3.2;
    this.meleeArc = Math.PI * 0.7;
    this.meleeCd = 0.42;
    this.lifesteal = 0;
    this.armor = 0; // damage reduction fraction
    this.thorns = 0;

    // ability costs / cooldowns
    this.novaCost = 35; this.novaCd = 0; this.novaCdMax = 3.5;
    this.consecrateCost = 30; this.consecrateCd = 0; this.consecrateCdMax = 6;
    this.dashCd = 0; this.dashCdMax = 1.6; this.dashSpeed = 30; this.dashTime = 0;

    this.meleeTimer = 0;
    this.swingAnim = 0;
    this.walkPhase = 0;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.alive = true;
  }

  reset() {
    this.maxHp = 100; this.hp = 100;
    this.maxFaith = 100; this.faith = 100;
    this.faithRegen = 8; this.speed = 9;
    this.baseDamage = 24; this.critChance = 0.15; this.critMult = 2.2;
    this.meleeRange = 3.2; this.meleeArc = Math.PI * 0.7; this.meleeCd = 0.42;
    this.lifesteal = 0; this.armor = 0; this.thorns = 0;
    this.novaCost = 35; this.novaCdMax = 3.5;
    this.consecrateCost = 30; this.consecrateCdMax = 6;
    this.dashCdMax = 1.6; this.dashSpeed = 30;
    this.novaCd = this.consecrateCd = this.dashCd = this.dashTime = 0;
    this.meleeTimer = 0; this.swingAnim = 0; this.invuln = 0; this.hurtFlash = 0;
    this.alive = true;
    this.pos.set(0, 0, 0);
    this.velY = 0;
    this.mesh.position.set(0, 0, 0);
    this.mesh.visible = true;
  }

  heal(amount) {
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }

  takeDamage(amount) {
    if (this.invuln > 0 || !this.alive) return 0;
    const dealt = amount * (1 - this.armor);
    this.hp -= dealt;
    this.invuln = 0.4;
    this.hurtFlash = 0.3;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return dealt;
  }

  // movement update; input = {x,z} normalized-ish, aimAngle in radians
  update(dt, input, aimAngle) {
    if (!this.alive) return;

    this.meleeTimer = Math.max(0, this.meleeTimer - dt);
    this.novaCd = Math.max(0, this.novaCd - dt);
    this.consecrateCd = Math.max(0, this.consecrateCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.swingAnim = Math.max(0, this.swingAnim - dt * 3.5);

    this.faith = clamp(this.faith + this.faithRegen * dt, 0, this.maxFaith);

    let spd = this.speed;
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      spd = this.dashSpeed;
    }

    const moving = input.x !== 0 || input.z !== 0;
    if (moving) {
      const len = Math.hypot(input.x, input.z) || 1;
      this.pos.x += (input.x / len) * spd * dt;
      this.pos.z += (input.z / len) * spd * dt;
      this.walkPhase += dt * 12;
    } else {
      this.walkPhase *= 0.8;
    }
    confineToArena(this.pos);

    // face aim direction
    this.facing = approachAngle(this.facing, aimAngle, dt * 14);
    this.mesh.rotation.y = this.facing;

    this._animate(dt, moving);
  }

  _animate(dt, moving) {
    const u = this.mesh.userData;
    // leg walk cycle
    const swing = moving ? Math.sin(this.walkPhase) * 0.5 : 0;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.5;

    // sword swing animation
    const sa = this.swingAnim;
    if (u.weaponArm) {
      u.weaponArm.rotation.x = -0.3 - Math.sin(sa * Math.PI) * 2.4;
      u.weaponArm.rotation.z = Math.sin(sa * Math.PI) * 0.6;
    }
    // blade glow pulse
    const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.25;
    u.bladeMat.emissiveIntensity = pulse + sa * 1.5;
    u.swordLight.intensity = 1.0 + sa * 2.5;

    // idle bob
    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.08 : Math.sin(performance.now() * 0.002) * 0.04;
    this.mesh.position.y = bob;

    // cape sway
    if (u.cape) u.cape.rotation.x = -0.2 + Math.sin(performance.now() * 0.003) * 0.1 + (moving ? 0.3 : 0);
  }

  tryMelee() {
    if (this.meleeTimer > 0) return false;
    this.meleeTimer = this.meleeCd;
    this.swingAnim = 1;
    return true;
  }

  tryNova() {
    if (this.novaCd > 0 || this.faith < this.novaCost) return false;
    this.faith -= this.novaCost;
    this.novaCd = this.novaCdMax;
    return true;
  }

  tryConsecrate() {
    if (this.consecrateCd > 0 || this.faith < this.consecrateCost) return false;
    this.faith -= this.consecrateCost;
    this.consecrateCd = this.consecrateCdMax;
    return true;
  }

  tryDash() {
    if (this.dashCd > 0) return false;
    this.dashCd = this.dashCdMax;
    this.dashTime = 0.18;
    this.invuln = Math.max(this.invuln, 0.25);
    return true;
  }

  rollCrit() {
    return Math.random() < this.critChance;
  }
}
