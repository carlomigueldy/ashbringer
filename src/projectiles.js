import * as THREE from "three";
import { lowPolyMat, confineToArena } from "./utils.js";

// Enemy projectiles (necromancer/lich bolts) and ground effects (consecrate).

export class Projectile {
  constructor(scene, from, to, opts = {}) {
    this.speed = opts.speed ?? 14;
    this.damage = opts.damage ?? 12;
    this.radius = opts.radius ?? 0.4;
    this.life = opts.life ?? 5;
    this.dead = false;
    const color = opts.color ?? 0x8a5aff;

    const geo = new THREE.IcosahedronGeometry(this.radius, 0);
    this.mesh = new THREE.Mesh(geo, lowPolyMat(color, { emissive: color, emissiveIntensity: 2 }));
    this.mesh.position.copy(from);
    this.mesh.position.y = 1.4;
    scene.add(this.mesh);
    const light = new THREE.PointLight(color, 1, 4, 2);
    this.mesh.add(light);

    this.vel = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
    this.vel.y = 0;
    this.vel.normalize().multiplyScalar(this.speed);
    this.pos = this.mesh.position;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.pos.addScaledVector(this.vel, dt);
    this.mesh.rotation.x += dt * 6;
    this.mesh.rotation.y += dt * 5;
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > 48) this.dead = true;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// Consecrated ground: damages enemies standing in it over time.
export class Consecration {
  constructor(scene, x, z, opts = {}) {
    this.x = x; this.z = z;
    this.radius = opts.radius ?? 5;
    this.dps = opts.dps ?? 30;
    this.duration = opts.duration ?? 5;
    this.life = this.duration;
    this.dead = false;
    this.tickAccum = 0;

    this.group = new THREE.Group();
    this.group.position.set(x, 0.05, z);
    scene.add(this.group);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf2c14e, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(this.radius, 24), ringMat);
    this.disc.rotation.x = -Math.PI / 2;
    this.group.add(this.disc);

    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    this.edge = new THREE.Mesh(new THREE.RingGeometry(this.radius - 0.25, this.radius, 32), edgeMat);
    this.edge.rotation.x = -Math.PI / 2;
    this.group.add(this.edge);

    const light = new THREE.PointLight(0xf2c14e, 1.5, this.radius * 2.5, 2);
    light.position.y = 1.5;
    this.group.add(light);
    this.light = light;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return false; }
    const t = this.life / this.duration;
    this.disc.material.opacity = 0.15 + t * 0.25 + Math.sin(performance.now() * 0.006) * 0.05;
    this.edge.rotation.z += dt * 0.5;
    this.light.intensity = 1.2 + Math.sin(performance.now() * 0.005) * 0.4;
    this.group.scale.setScalar(0.9 + t * 0.1);

    this.tickAccum += dt;
    if (this.tickAccum >= 0.25) {
      this.tickAccum = 0;
      return true; // signal a damage tick
    }
    return false;
  }

  contains(px, pz) {
    return Math.hypot(px - this.x, pz - this.z) <= this.radius;
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
}

// XP / soul pickup that drifts toward the player when near.
export class Pickup {
  constructor(scene, x, z, opts = {}) {
    this.value = opts.value ?? 5;
    this.kind = opts.kind ?? "xp"; // xp | health | faith
    this.dead = false;
    this.life = 18;
    this.collected = false;

    let color = 0x6bff8a;
    if (this.kind === "health") color = 0xff5a5a;
    if (this.kind === "faith") color = 0x9fe8ff;

    const geo = this.kind === "xp"
      ? new THREE.OctahedronGeometry(0.28, 0)
      : new THREE.BoxGeometry(0.4, 0.4, 0.4);
    this.mesh = new THREE.Mesh(geo, lowPolyMat(color, { emissive: color, emissiveIntensity: 1.5 }));
    this.mesh.position.set(x, 0.6, z);
    scene.add(this.mesh);
    const light = new THREE.PointLight(color, 0.6, 3, 2);
    this.mesh.add(light);
    this.pos = this.mesh.position;
    this.bobOff = Math.random() * 10;
  }

  update(dt, player, time) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return false; }
    this.mesh.rotation.y += dt * 3;
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    this.mesh.position.y = 0.6 + Math.sin(time * 4 + this.bobOff) * 0.15;

    // magnet
    if (dist < 6) {
      const pull = (1 - dist / 6) * 22;
      this.pos.x += (dx / (dist || 1)) * pull * dt;
      this.pos.z += (dz / (dist || 1)) * pull * dt;
    }
    if (dist < 1.0) {
      this.dead = true;
      this.collected = true;
      return true; // collected
    }
    return false;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
