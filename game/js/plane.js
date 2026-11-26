// Kestrel Run — plane.js: the bush plane "Kestrel" (built from primitives) and its
// arcade flight model: throttle, pitch, bank, lift, stall, wind and ground handling.
import * as THREE from 'three';
import { terrainHeight, runwayAt } from './world.js';

export const MAX_SPEED = 62;      // m/s at full throttle
export const STALL_SPEED = 17;    // m/s: below this the wing stops flying
export const CRUISE_SPEED = 38;

export function buildPlaneMesh() {
  const plane = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xf4ead2, roughness: 0.55, metalness: 0.15 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x1f7a6d, roughness: 0.55, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.4, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.15, metalness: 0.6 });

  // fuselage: tapered tube pointing -Z (forward)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 5.4, 12), cream);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 12), teal);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  plane.add(nose);
  // canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), glass);
  canopy.scale.set(1, 0.75, 1.5);
  canopy.position.set(0, 0.62, -0.9);
  plane.add(canopy);
  // main wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.16, 1.7), teal);
  wing.position.set(0, 0.15, -0.4);
  wing.castShadow = true;
  plane.add(wing);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.24, 0.05, 0.35), cream);
  stripe.position.set(0, 0.24, -0.4);
  plane.add(stripe);
  // tail: horizontal stabiliser + fin
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.0), teal);
  stab.position.set(0, 0.2, 2.5);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.3), teal);
  fin.position.set(0, 0.75, 2.45);
  plane.add(fin);
  // propeller (spins)
  const prop = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5 });
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.08), bladeMat);
  const blade2 = blade1.clone();
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade1); prop.add(blade2);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dark);
  prop.add(hub);
  prop.position.z = -4.15;
  plane.add(prop);
  // fixed landing gear
  const gearMat = dark;
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), gearMat);
    leg.position.set(side * 0.8, -0.95, -1.2);
    leg.rotation.z = side * 0.35;
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.05, -1.45, -1.2);
    plane.add(wheel);
  }
  // wingtip lights
  const tipL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  tipL.position.set(-4.6, 0.15, -0.4);
  const tipR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x37d67a }));
  tipR.position.set(4.6, 0.15, -0.4);
  plane.add(tipL); plane.add(tipR);
  return { group: plane, prop };
}

export class FlightState {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = 0; this.z = 430; this.y = 12;
    this.heading = Math.PI; // facing north, down the runway (towards -z... see update)
    this.pitch = 0; this.roll = 0;
    this.speed = 0; this.throttle = 0;
    this.vspeed = 0;
    this.fuel = 100;
    this.onGround = true;
    this.crashed = false;
    this.landed = false;
    this.propSpin = 0;
  }
  // inputs: { pitch: -1..1 (pull up positive), roll: -1..1 (bank right positive),
  //           throttle: -1..1, dt }
  update(inp, dt) {
    if (this.crashed) return;
    const prevY = this.y;
    // throttle
    this.throttle = Math.max(0, Math.min(1, this.throttle + inp.throttle * dt * 0.55));
    // target speed follows throttle; engine spools up/down
    const targetSpeed = this.throttle * MAX_SPEED;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * (this.throttle > 0.05 ? 0.55 : 0.35));
    if (this.fuel <= 0) this.speed = Math.max(0, this.speed - 9 * dt);
    // pitch: elevator authority grows with speed
    const authority = Math.min(1, this.speed / 30);
    this.pitch += inp.pitch * dt * 0.9 * authority;
    this.pitch = Math.max(-0.55, Math.min(0.6, this.pitch));
    // roll / bank: heading turns with bank
    this.roll += inp.roll * dt * 1.6 * authority;
    this.roll = Math.max(-1.1, Math.min(1.1, this.roll));
    // roll eases back toward level when no input
    if (Math.abs(inp.roll) < 0.05) this.roll *= Math.max(0, 1 - dt * 0.7);
    if (Math.abs(inp.pitch) < 0.05) this.pitch *= Math.max(0, 1 - dt * 0.5);
    this.heading -= Math.sin(this.roll) * (this.speed / 55) * dt * 1.5;

    // vertical motion: lift from speed and pitch, gravity sink when slow
    const lift = this.speed > STALL_SPEED
      ? Math.sin(this.pitch) * this.speed * 0.55
      : -6 * (1 - this.speed / STALL_SPEED);
    this.vspeed += (lift - this.vspeed) * Math.min(1, dt * 2.2);
    this.y += this.vspeed * dt;
    // horizontal motion
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    // soft world edge: steer back in
    const r = Math.hypot(this.x, this.z);
    if (r > 950) {
      const back = Math.atan2(-this.x, -this.z);
      let diff = back - this.heading;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      this.heading += diff * dt * 1.2;
    }
    // ground contact
    const ground = terrainHeight(this.x, this.z);
    const runway = runwayAt(this.x, this.z);
    const groundY = runway ? runway.elev + 0.4 : ground;
    if (this.y <= groundY + 1.5) {
      this.y = groundY + 1.5;
      this.onGround = true;
      if (runway && Math.abs(this.vspeed) < 4.5 && this.speed < 45 && Math.abs(this.roll) < 0.35) {
        // gentle touchdown on asphalt
        this.landed = true;
        this.vspeed = 0;
        this.pitch = 0;
        this.speed = Math.max(0, this.speed - 14 * dt);
      } else if (!runway && Math.abs(this.vspeed) < 6 && this.speed <= 20) {
        // rough-field landing: the bush plane can put down on grass if slow
        this.landed = false;
        this.vspeed = 0;
        this.pitch = 0;
        this.speed = Math.max(0, this.speed - 25 * dt);
      } else if (this.speed > 8 || Math.abs(this.vspeed) > 4.5) {
        this.crashed = true;
      } else {
        this.vspeed = 0;
      }
    } else {
      this.onGround = false;
      this.landed = false;
    }
    // fuel burn: a full tank lasts about five minutes at full throttle,
    // enough for all three contracts with a margin for one missed approach.
    if (this.throttle > 0.02 && !this.onGround) this.fuel = Math.max(0, this.fuel - dt * (0.12 + this.throttle * 0.22));
    else if (this.throttle > 0.02) this.fuel = Math.max(0, this.fuel - dt * 0.06);
    if (this.onGround && runway && runway.name === 'Kestrel Field' && this.speed < 2) this.fuel = 100;
    this.propSpin += dt * (2 + this.throttle * 40);
    this._vspeedSmooth = (this._vspeedSmooth ?? 0) * 0.9 + ((this.y - prevY) / Math.max(dt, 1e-4)) * 0.1;
  }
  get verticalSpeed() { return this._vspeedSmooth ?? 0; }
  get stalled() { return !this.onGround && this.speed < STALL_SPEED; }
  get knots() { return this.speed * 1.944; }
  get feet() { return this.y * 3.281; }
  get headingDeg() {
    // Compass heading: 0° is north (-z), 90° is east (+x), clockwise.
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let d = (Math.atan2(fx, -fz) * 180) / Math.PI;
    if (d < 0) d += 360;
    return d;
  }
  applyToMesh(mesh, prop) {
    mesh.position.set(this.x, this.y, this.z);
    mesh.rotation.set(0, 0, 0);
    mesh.rotateY(this.heading + Math.PI);
    mesh.rotateX(this.pitch);
    mesh.rotateZ(-this.roll);
    if (prop) prop.rotation.z = this.propSpin;
  }
}
