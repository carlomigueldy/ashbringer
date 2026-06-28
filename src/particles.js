import * as THREE from "three";
import { rand, TAU } from "./utils.js";

// Pooled particle system using a single InstancedMesh per "kind" for performance.
export class Particles {
  constructor(scene, max = 800) {
    this.scene = scene;
    this.max = max;
    const geo = new THREE.TetrahedronGeometry(0.18, 0);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
      transparent: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.pool = [];
    for (let i = 0; i < max; i++) {
      this.pool.push({ active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 1, grav: -9, color: new THREE.Color() });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._e = new THREE.Euler();
  }

  emit(pos, count, opts = {}) {
    const {
      color = 0xffffff,
      speed = 6,
      spread = 1,
      up = 4,
      life = 0.7,
      size = 1,
      grav = -9,
    } = opts;
    let made = 0;
    for (const p of this.pool) {
      if (made >= count) break;
      if (p.active) continue;
      p.active = true;
      p.pos.copy(pos);
      const a = rand(0, TAU);
      const r = rand(0, speed) * spread;
      p.vel.set(Math.cos(a) * r, rand(up * 0.3, up), Math.sin(a) * r);
      p.life = p.maxLife = life * rand(0.7, 1.2);
      p.size = size * rand(0.6, 1.3);
      p.grav = grav;
      p.color.set(color);
      made++;
    }
  }

  burstRing(pos, count, radius, opts = {}) {
    const { color = 0x9fe8ff, life = 0.6, size = 1, up = 2 } = opts;
    let made = 0;
    for (const p of this.pool) {
      if (made >= count) break;
      if (p.active) continue;
      p.active = true;
      const a = (made / count) * TAU;
      p.pos.set(pos.x + Math.cos(a) * 0.5, pos.y, pos.z + Math.sin(a) * 0.5);
      p.vel.set(Math.cos(a) * radius, up, Math.sin(a) * radius);
      p.life = p.maxLife = life;
      p.size = size;
      p.grav = -3;
      p.color.set(color);
      made++;
    }
  }

  update(dt) {
    let i = 0;
    const colors = this.mesh.instanceColor.array;
    for (const p of this.pool) {
      if (p.active) {
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
        } else {
          p.vel.y += p.grav * dt;
          p.vel.multiplyScalar(0.98);
          p.pos.addScaledVector(p.vel, dt);
          if (p.pos.y < 0.05) { p.pos.y = 0.05; p.vel.y *= -0.4; p.vel.x *= 0.7; p.vel.z *= 0.7; }
          const t = p.life / p.maxLife;
          const sc = p.size * (0.3 + t * 0.9);
          this._e.set(p.life * 8, p.life * 6, 0);
          this._q.setFromEuler(this._e);
          this._s.set(sc, sc, sc);
          this._m.compose(p.pos, this._q, this._s);
          this.mesh.setMatrixAt(i, this._m);
          colors[i * 3] = p.color.r * t;
          colors[i * 3 + 1] = p.color.g * t;
          colors[i * 3 + 2] = p.color.b * t;
          i++;
        }
      }
    }
    // hide the rest
    this._s.set(0, 0, 0);
    this._m.compose(new THREE.Vector3(0, -999, 0), this._q, this._s);
    for (let j = i; j < this.max; j++) this.mesh.setMatrixAt(j, this._m);
    this.mesh.count = this.max;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  reset() {
    for (const p of this.pool) p.active = false;
  }
}
