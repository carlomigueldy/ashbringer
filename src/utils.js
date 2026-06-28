import * as THREE from "three";

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;

// Smoothly rotate angle a toward b by max delta
export function approachAngle(a, b, maxDelta) {
  let diff = ((b - a + Math.PI) % TAU) - Math.PI;
  if (diff < -Math.PI) diff += TAU;
  if (Math.abs(diff) <= maxDelta) return b;
  return a + Math.sign(diff) * maxDelta;
}

export const WORLD_RADIUS = 46;

// Keep a position inside the circular arena
export function confineToArena(pos, margin = 1.5) {
  const r = WORLD_RADIUS - margin;
  const d = Math.hypot(pos.x, pos.z);
  if (d > r) {
    pos.x = (pos.x / d) * r;
    pos.z = (pos.z / d) * r;
  }
}

// Shared flat-shaded material factory for low-poly look
export function lowPolyMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}
