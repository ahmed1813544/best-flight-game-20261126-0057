// Kestrel Run — rings.js: the sky-ring course, the parcel drop and their 3D markers.
import * as THREE from 'three';
import { DROP_ZONE } from './world.js';

export const RING_RADIUS = 14;

// Eight rings looping the island: up over the west ridge, across the sea to Palm Cove,
// home over the lighthouse beach.
export const RING_COURSE = [
  { x: 0,    y: 55, z: 120 },
  { x: -150, y: 88, z: -40 },
  { x: -300, y: 60, z: -180 },
  { x: -180, y: 80, z: -380 },
  { x: 60,   y: 65, z: -420 },
  { x: 300,  y: 75, z: -320 },
  { x: 430,  y: 50, z: -180 },
  { x: 220,  y: 82, z: 60 },
];

export class RingCourse {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    this.next = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    RING_COURSE.forEach((p, i) => {
      const next = RING_COURSE[(i + 1) % RING_COURSE.length];
      const dir = new THREE.Vector3(next.x - p.x, next.y - p.y, next.z - p.z).normalize();
      const ring = new THREE.Group();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(RING_RADIUS, 1.1, 12, 40),
        new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0x8a6d00, emissiveIntensity: 0.7, roughness: 0.4 }),
      );
      torus.castShadow = true;
      ring.add(torus);
      const inner = new THREE.Mesh(
        new THREE.TorusGeometry(RING_RADIUS - 2.5, 0.35, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
      );
      ring.add(inner);
      ring.position.set(p.x, p.y, p.z);
      ring.lookAt(next.x, next.y, next.z);
      this.group.add(ring);
      this.rings.push({ pos: new THREE.Vector3(p.x, p.y, p.z), dir, mesh: ring, passed: false });
    });
    this.marker = this.makeMarker();
    this.scene.add(this.marker);
  }
  makeMarker() {
    // Floating arrow above the next ring so the pilot can always find it.
    const g = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(4, 9, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    cone.rotation.x = Math.PI;
    g.add(cone);
    return g;
  }
  reset() {
    this.next = 0;
    for (const r of this.rings) {
      r.passed = false;
      r.mesh.children[0].material = r.mesh.children[0].material.clone();
      r.mesh.children[0].material.color.setHex(0xffd23e);
      r.mesh.children[0].material.emissive.setHex(0x8a6d00);
    }
  }
  // Returns the ring index just passed, or -1.
  checkPass(px, py, pz, prevZ) {
    if (this.next >= this.rings.length) return -1;
    const r = this.rings[this.next];
    // Plane of the ring: distance along its facing direction.
    const rel = new THREE.Vector3(px - r.pos.x, py - r.pos.y, pz - r.pos.z);
    const along = rel.dot(r.dir);
    const radial = rel.clone().addScaledVector(r.dir, -along).length();
    if (Math.abs(along) < 8 && radial < RING_RADIUS - 0.5) {
      r.passed = true;
      r.mesh.children[0].material.color.setHex(0x37d67a);
      r.mesh.children[0].material.emissive.setHex(0x0f5c2e);
      this.next++;
      return this.next - 1;
    }
    return -1;
  }
  update(dt, time) {
    if (this.next < this.rings.length) {
      const r = this.rings[this.next];
      this.marker.position.set(r.pos.x, r.pos.y + RING_RADIUS + 12 + Math.sin(time * 2) * 2, r.pos.z);
      this.marker.visible = true;
    } else {
      this.marker.visible = false;
    }
    // Gentle bob on the next ring so it reads as alive.
    for (let i = 0; i < this.rings.length; i++) {
      if (i === this.next) this.rings[i].mesh.rotation.z = Math.sin(time * 1.5) * 0.06;
    }
  }
  get done() { return this.next >= this.rings.length; }
}

export class Parcel {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.dropped = false;
    this.x = 0; this.y = 0; this.z = 0;
    this.vy = 0;
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.MeshStandardMaterial({ color: 0xc98a2e, roughness: 0.9 }),
    );
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.6, 3.1),
      new THREE.MeshStandardMaterial({ color: 0x7a4a12, roughness: 0.9 }),
    );
    strap.position.y = 0.4;
    this.mesh.add(strap);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
    // parachute
    this.chute = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xff5340, roughness: 0.8, side: THREE.DoubleSide }),
    );
    this.chute.visible = false;
    this.scene.add(this.chute);
  }
  drop(x, y, z, vx = 0, vz = 0) {
    if (this.active || this.dropped) return false;
    this.active = true;
    this.x = x; this.y = y; this.z = z; this.vy = 0;
    // The crate keeps the plane's forward speed and the chute drags it down.
    this.vx = vx; this.vz = vz;
    this.mesh.visible = true;
    this.chute.visible = true;
    return true;
  }
  update(dt, terrainHeightFn) {
    if (!this.active) return 'idle';
    this.vy = Math.max(this.vy - 9 * dt, -7); // chute slows the fall
    this.y += this.vy * dt;
    // Forward drift under the chute, bled off by drag.
    const drag = Math.max(0, 1 - dt * 0.8);
    this.vx *= drag; this.vz *= drag;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y += dt * 0.8;
    this.chute.position.set(this.x, this.y + 4.5, this.z);
    const ground = terrainHeightFn(this.x, this.z);
    if (this.y <= ground + 1.6) {
      this.y = ground + 1.6;
      this.active = false;
      this.dropped = true;
      this.chute.visible = false;
      this.mesh.position.set(this.x, this.y, this.z);
      const dist = Math.hypot(this.x - DROP_ZONE.x, this.z - DROP_ZONE.z);
      return dist <= DROP_ZONE.r ? 'hit' : 'miss';
    }
    return 'falling';
  }
  reset() {
    this.active = false; this.dropped = false;
    this.mesh.visible = false; this.chute.visible = false;
  }
}
