import * as THREE from "three";
import { lowPolyMat, rand, randInt, TAU, WORLD_RADIUS } from "./utils.js";

// Builds the low-poly arena: ground, ruined cathedral ring, trees, gravestones, fog.
export function buildWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- Ground: faceted disc with subtle height variation ----
  const groundGeo = new THREE.CircleGeometry(WORLD_RADIUS, 48);
  const gpos = groundGeo.attributes.position;
  for (let i = 0; i < gpos.count; i++) {
    const x = gpos.getX(i), y = gpos.getY(i);
    const d = Math.hypot(x, y);
    const h = Math.sin(x * 0.15) * Math.cos(y * 0.15) * 0.6 - d * 0.02;
    gpos.setZ(i, h);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, lowPolyMat(0x2e3b2a, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // corrupted scourge ground patches (dark blight)
  for (let i = 0; i < 14; i++) {
    const r = rand(4, WORLD_RADIUS - 6);
    const a = rand(0, TAU);
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(rand(2.5, 5.5), 7),
      lowPolyMat(0x1c2418, { roughness: 1 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    group.add(patch);
  }

  // ---- Outer wall ring (broken stone) ----
  const wallMat = lowPolyMat(0x6b6256, { roughness: 0.95 });
  const segs = 40;
  for (let i = 0; i < segs; i++) {
    if (Math.random() < 0.18) continue; // gaps = broken wall
    const a = (i / segs) * TAU;
    const h = rand(2.4, 4.2);
    const block = new THREE.Mesh(new THREE.BoxGeometry(rand(2.2, 3.2), h, 1.4), wallMat);
    block.position.set(
      Math.cos(a) * (WORLD_RADIUS - 0.5),
      h / 2,
      Math.sin(a) * (WORLD_RADIUS - 0.5)
    );
    block.rotation.y = -a + Math.PI / 2;
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
  }

  // ---- Ruined pillars in a ring ----
  const pillarMat = lowPolyMat(0x7d7466, { roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const r = WORLD_RADIUS * 0.6;
    const h = rand(5, 9);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, h, 6), pillarMat);
    pillar.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    pillar.castShadow = true;
    group.add(pillar);
    // broken cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.8), pillarMat);
    cap.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
    cap.rotation.y = rand(0, TAU);
    cap.castShadow = true;
    group.add(cap);
  }

  // ---- Dead trees ----
  const trunkMat = lowPolyMat(0x3a2c20);
  const branchMat = lowPolyMat(0x2c2118);
  for (let i = 0; i < 22; i++) {
    const a = rand(0, TAU);
    const r = rand(8, WORLD_RADIUS - 4);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const tree = new THREE.Group();
    const th = rand(2.5, 4.5);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, th, 5), trunkMat);
    trunk.position.y = th / 2;
    trunk.castShadow = true;
    tree.add(trunk);
    for (let b = 0; b < randInt(2, 4); b++) {
      const bl = rand(0.8, 1.6);
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, bl, 4), branchMat);
      branch.position.y = th * rand(0.55, 0.95);
      branch.rotation.z = rand(-1, 1);
      branch.rotation.y = rand(0, TAU);
      branch.translateY(bl / 2);
      tree.add(branch);
    }
    tree.position.set(x, 0, z);
    tree.rotation.y = rand(0, TAU);
    group.add(tree);
  }

  // ---- Gravestones ----
  const graveMat = lowPolyMat(0x5a5650, { roughness: 1 });
  for (let i = 0; i < 30; i++) {
    const a = rand(0, TAU);
    const r = rand(6, WORLD_RADIUS - 5);
    const g = new THREE.Mesh(new THREE.BoxGeometry(rand(0.6, 1), rand(0.8, 1.5), 0.2), graveMat);
    g.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
    g.rotation.y = rand(0, TAU);
    g.rotation.z = rand(-0.15, 0.15);
    g.castShadow = true;
    group.add(g);
  }

  // ---- Central holy altar (player spawn) ----
  const altarBase = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.6, 0.5, 8),
    lowPolyMat(0x9a8c6a, { roughness: 0.7 })
  );
  altarBase.position.y = 0.25;
  altarBase.receiveShadow = true;
  group.add(altarBase);

  return group;
}

export function setupLighting(scene) {
  const hemi = new THREE.HemisphereLight(0x6a7a9a, 0x1a1410, 0.65);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
  sun.position.set(20, 38, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 60;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // eerie green rim light for scourge atmosphere
  const rim = new THREE.DirectionalLight(0x4aff9a, 0.25);
  rim.position.set(-18, 10, -20);
  scene.add(rim);

  scene.fog = new THREE.FogExp2(0x0d1014, 0.018);

  return { hemi, sun, rim };
}
