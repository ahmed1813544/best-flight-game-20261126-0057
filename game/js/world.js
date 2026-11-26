// Kestrel Run — world.js: the Marrow Isles. Deterministic island terrain, sea, sky,
// two airstrips, palm trees, houses, lighthouse, hangar and drifting clouds.
// Everything the plane flies over or can land on lives here.
import * as THREE from 'three';

// ---------- deterministic value noise ----------
function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const u = smooth(fx), v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise(x * freq, z * freq);
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}

// ---------- runways and key places ----------
export const RUNWAYS = [
  { name: 'Kestrel Field', cx: 0, cz: 300, length: 260, width: 30, heading: 0, elev: 9 },
  { name: 'Palm Cove', cx: 430, cz: -180, length: 200, width: 26, heading: Math.PI / 2, elev: 7 },
];
export const DROP_ZONE = { x: -490, z: -280, r: 26 };
export const LIGHTHOUSE = { x: -360, z: -300 };

// Distance from a point to a runway rectangle (in the runway's local frame).
function runwayLocal(runway, x, z) {
  const dx = x - runway.cx, dz = z - runway.cz;
  const c = Math.cos(-runway.heading), s = Math.sin(-runway.heading);
  return { u: dx * c - dz * s, v: dx * s + dz * c };
}
export function runwayAt(x, z) {
  for (const r of RUNWAYS) {
    // runwayLocal gives u = lateral offset, v = along-track offset.
    const { u, v } = runwayLocal(r, x, z);
    if (Math.abs(u) <= r.width / 2 + 6 && Math.abs(v) <= r.length / 2 + 6) return r;
  }
  return null;
}

// ---------- terrain height (shared by the mesh and the flight model) ----------
export function terrainHeight(x, z) {
  const dMain = Math.hypot(x, z);
  const dEast = Math.hypot(x - 430, z + 180);
  const dWest = Math.hypot(x + 360, z + 300);
  let mask = Math.max(0, 1 - dMain / 640);
  mask = Math.max(mask, Math.max(0, 1 - dEast / 300) * 0.85);
  mask = Math.max(mask, Math.max(0, 1 - dWest / 200) * 0.8);
  const m = mask * mask * (3 - 2 * mask);
  // A raised island core well above the sea, with noisy hills on top of it.
  let h = (fbm(x * 0.004 + 11, z * 0.004 + 7) - 0.38) * 170 * m + 26 * m;
  h += (fbm(x * 0.02 + 3, z * 0.02 + 9) - 0.5) * 14 * m;
  h = Math.max(h, -6);
  // Flatten the ground under each runway so landings are possible.
  for (const r of RUNWAYS) {
    const { u, v } = runwayLocal(r, x, z);
    const au = Math.abs(u), av = Math.abs(v);
    if (au < r.width / 2 + 40 && av < r.length / 2 + 40) {
      const edge = Math.max((au - r.width / 2) / 40, (av - r.length / 2) / 40);
      const t = Math.max(0, Math.min(1, 1 - Math.max(0, edge)));
      const flat = r.elev + Math.max(0, h - r.elev) * (1 - t) * 0.2;
      h = h * (1 - t) + flat * t;
    }
  }
  return h;
}

function groundColor(h, x, z) {
  const c = new THREE.Color();
  if (h < 1.5) c.setHex(0xe8d27a);            // sand
  else if (h < 34) c.setHex(0x58a447);        // grass
  else if (h < 62) c.setHex(0x3f8f3a);        // deep grass
  else c.setHex(0x8a7a63);                    // rock
  const n = fbm(x * 0.05, z * 0.05);
  c.multiplyScalar(0.88 + n * 0.24);
  return c;
}

// ---------- sky / light presets ----------
export const SKIES = {
  day:   { sky: 0x7ec0ee, fog: 0xa8d4ef, sun: 0xfff2cf, sunPos: [300, 420, 180], hemi: 0xbfd9ff },
  golden:{ sky: 0xf7b267, fog: 0xf2c184, sun: 0xffd9a0, sunPos: [-420, 150, 320], hemi: 0xffd9b0 },
  dusk:  { sky: 0x5a6fa8, fog: 0x8a7ba8, sun: 0xff9e7a, sunPos: [-480, 90, -260], hemi: 0xc9a8c9 },
};

export function buildWorld(scene, skyName = 'golden') {
  const sky = SKIES[skyName] || SKIES.golden;
  scene.background = new THREE.Color(sky.sky);
  scene.fog = new THREE.Fog(sky.fog, 500, 2400);

  const hemi = new THREE.HemisphereLight(sky.hemi, 0x3a5f3a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(sky.sun, 1.9);
  sun.position.set(...sky.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 1600;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // --- island terrain ---
  const SIZE = 1500, SEG = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    col.copy(groundColor(h, x, z));
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // --- sea ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(5200, 5200),
    new THREE.MeshStandardMaterial({ color: 0x1e6f9e, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  scene.add(sea);

  // --- runways: asphalt, centre dashes, threshold bars, edge lights ---
  for (const r of RUNWAYS) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(r.width, 0.6, r.length),
      new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.95 }),
    );
    strip.position.set(r.cx, r.elev + 0.1, r.cz);
    strip.rotation.y = r.heading;
    strip.receiveShadow = true;
    scene.add(strip);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const nDash = Math.floor(r.length / 24);
    for (let i = -nDash; i <= nDash; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 9), dashMat);
      const along = i * 24;
      const c = Math.cos(r.heading), s = Math.sin(r.heading);
      dash.position.set(r.cx + s * along, r.elev + 0.55, r.cz + c * along);
      dash.rotation.y = r.heading;
      scene.add(dash);
    }
    // runway name boards at each end
    const board = makeLabelBoard(r.name);
    board.position.set(r.cx + Math.sin(r.heading) * (r.length / 2 + 14), r.elev + 3, r.cz + Math.cos(r.heading) * (r.length / 2 + 14));
    scene.add(board);
  }

  // --- drop zone ring on the beach near the lighthouse ---
  const dz = new THREE.Mesh(
    new THREE.RingGeometry(DROP_ZONE.r - 2.5, DROP_ZONE.r, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide }),
  );
  dz.rotation.x = -Math.PI / 2;
  dz.position.set(DROP_ZONE.x, 2.2, DROP_ZONE.z);
  scene.add(dz);
  const dzPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 26, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd23e }),
  );
  dzPole.position.set(DROP_ZONE.x, 14, DROP_ZONE.z);
  scene.add(dzPole);

  // --- lighthouse ---
  const lhBase = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5.5, 22, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.8 }),
  );
  lhBase.position.set(LIGHTHOUSE.x, terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z) + 11, LIGHTHOUSE.z);
  lhBase.castShadow = true;
  scene.add(lhBase);
  const lhTop = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 5, 12),
    new THREE.MeshStandardMaterial({ color: 0xd43d2a, roughness: 0.7 }),
  );
  lhTop.position.set(LIGHTHOUSE.x, terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z) + 24, LIGHTHOUSE.z);
  scene.add(lhTop);
  const lhLight = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
  );
  lhLight.position.set(LIGHTHOUSE.x, terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z) + 27.5, LIGHTHOUSE.z);
  scene.add(lhLight);

  // --- hangar + windsock at Kestrel Field ---
  const hangar = new THREE.Group();
  const hangarBody = new THREE.Mesh(
    new THREE.BoxGeometry(26, 10, 18),
    new THREE.MeshStandardMaterial({ color: 0xc94f3d, roughness: 0.85 }),
  );
  hangarBody.position.y = 5;
  hangarBody.castShadow = true;
  hangar.add(hangarBody);
  const hangarRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 26, 12, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x8f2f24, roughness: 0.85 }),
  );
  hangarRoof.rotation.z = Math.PI / 2;
  hangarRoof.rotation.y = Math.PI / 2;
  hangarRoof.position.y = 10;
  hangar.add(hangarRoof);
  hangar.position.set(34, RUNWAYS[0].elev, 330);
  scene.add(hangar);
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xdddddd }),
  );
  sockPole.position.set(-26, RUNWAYS[0].elev + 6, 380);
  scene.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 10),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(-22, RUNWAYS[0].elev + 11, 380);
  scene.add(sock);

  // --- palm trees (instanced) ---
  const treeSpots = [];
  for (let i = 0; i < 900; i++) {
    const x = (hash2(i, 7) - 0.5) * 1300;
    const z = (hash2(i, 13) - 0.5) * 1300;
    const h = terrainHeight(x, z);
    if (h < 3 || h > 58) continue;
    if (runwayAt(x, z)) continue;
    if (Math.hypot(x - DROP_ZONE.x, z - DROP_ZONE.z) < DROP_ZONE.r + 8) continue;
    treeSpots.push({ x, z, h, s: 0.8 + hash2(i, 21) * 0.7 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.6, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
  const palmGeo = new THREE.ConeGeometry(3.4, 8, 7);
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x2e8b3a, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, treeSpots.length);
  const m4 = new THREE.Matrix4();
  treeSpots.forEach((t, i) => {
    m4.makeScale(t.s, t.s, t.s);
    m4.setPosition(t.x, t.h + 3.5 * t.s, t.z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(t.s, t.s, t.s);
    m4.setPosition(t.x, t.h + 9 * t.s, t.z);
    palms.setMatrixAt(i, m4);
  });
  trunks.castShadow = true; palms.castShadow = true;
  scene.add(trunks); scene.add(palms);

  // --- little houses near the strips ---
  const houseMat = new THREE.MeshStandardMaterial({ color: 0xf2e3c2, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb3402f, roughness: 0.9 });
  const houses = [[-40, 250], [-52, 268], [48, 250], [400, -140], [458, -150], [-300, -220]];
  for (const [hx, hz] of houses) {
    const hy = terrainHeight(hx, hz);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 8), houseMat);
    body.position.y = 3; body.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 4, 4), roofMat);
    roof.position.y = 8; roof.rotation.y = Math.PI / 4;
    g.add(body); g.add(roof);
    g.position.set(hx, hy, hz);
    g.rotation.y = hash2(hx | 0, hz | 0) * Math.PI;
    scene.add(g);
  }

  // --- drifting clouds ---
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(hash2(i, 31) * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + hash2(i, j + 50) * 10, 10, 8), cloudMat);
      s.position.set(j * 12 - n * 6, hash2(i, j + 90) * 4, hash2(i, j + 130) * 8 - 4);
      s.scale.y = 0.55;
      g.add(s);
    }
    g.position.set((hash2(i, 3) - 0.5) * 1600, 150 + hash2(i, 5) * 90, (hash2(i, 11) - 0.5) * 1600);
    scene.add(g);
    clouds.push(g);
  }
  return { sun, clouds, terrainHeight };
}

function makeLabelBoard(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b1c2c';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 30px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 5.5),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
  );
  return board;
}
