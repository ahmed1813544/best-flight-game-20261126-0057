// Kestrel Run — Island Courier: boot, game loop, input, chase camera and screens.
// A bush-plane courier game: three contracts, one little plane, the Marrow Isles.
import * as THREE from 'three';
import { buildWorld, terrainHeight, RUNWAYS, DROP_ZONE } from './world.js';
import { buildPlaneMesh, FlightState } from './plane.js';
import { RingCourse, Parcel } from './rings.js';
import { MissionLog } from './missions.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { shotFromUrl, applyShot } from './shots.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 2, 0.1, 5000);

const shot = shotFromUrl();
const world = buildWorld(scene, shot ? shot.setup.sky : 'golden');
const { group: planeMesh, prop } = buildPlaneMesh();
scene.add(planeMesh);
const flight = new FlightState();
const rings = new RingCourse(scene);
const parcel = new Parcel(scene);
const hud = new Hud();
const sounds = new SoundBank();
const missions = new MissionLog(hud);

let mode = 'title'; // title | flying | paused | over
let time = 0;
let lastFrame = performance.now();
let camPos = new THREE.Vector3(0, 20, 460);
let camLook = new THREE.Vector3(0, 10, 300);

// ---------- input ----------
const keys = new Set();
const mouse = { down: false, x: 0, y: 0 };
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'p' && mode === 'flying') pauseGame();
  else if (e.key.toLowerCase() === 'p' && mode === 'paused') resumeGame();
  if (e.key.toLowerCase() === 'm') sounds.setMuted(!sounds.muted);
  if (e.key === ' ' && mode === 'flying') dropParcel();
  if (e.key.toLowerCase() === 'r' && mode === 'over') restart();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('pointerdown', (e) => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('pointerup', () => { mouse.down = false; });
window.addEventListener('pointermove', (e) => { if (mouse.down) { mouse.x = e.clientX; mouse.y = e.clientY; } });

function readInput() {
  const inp = { pitch: 0, roll: 0, throttle: 0 };
  if (keys.has('w')) inp.throttle += 1;
  if (keys.has('s')) inp.throttle -= 1;
  if (keys.has('arrowup') || keys.has('i')) inp.pitch += 1;
  if (keys.has('arrowdown') || keys.has('k')) inp.pitch -= 1;
  if (keys.has('arrowleft') || keys.has('a')) inp.roll -= 1;
  if (keys.has('arrowright') || keys.has('d')) inp.roll += 1;
  // Mouse drag steers: drag up to climb, left/right to bank.
  if (mouse.down && mode === 'flying') {
    const dx = (mouse.x / window.innerWidth - 0.5) * 2;
    const dy = (mouse.y / window.innerHeight - 0.5) * 2;
    inp.roll += dx * 0.9;
    inp.pitch -= dy * 0.7;
  }
  return inp;
}

function dropParcel() {
  if (missions.current && missions.current.id !== 'drop') {
    hud.toast('PARCEL CONTRACT IS NOT ACTIVE YET');
    return;
  }
  const vx = Math.sin(flight.heading) * flight.speed;
  const vz = Math.cos(flight.heading) * flight.speed;
  if (parcel.drop(flight.x, flight.y - 2, flight.z, vx, vz)) {
    hud.toast('PARCEL AWAY');
    sounds.thump();
  }
}

// ---------- screens ----------
const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const endScreen = document.getElementById('end-screen');
document.getElementById('start-button').addEventListener('click', startGame);
document.getElementById('resume-button').addEventListener('click', resumeGame);
document.getElementById('again-button').addEventListener('click', restart);

function startGame() {
  sounds.ensure();
  titleScreen.classList.add('hidden');
  hud.show();
  mode = 'flying';
  missions.startedAt = performance.now();
}
function pauseGame() {
  mode = 'paused';
  pauseScreen.classList.remove('hidden');
}
function resumeGame() {
  pauseScreen.classList.add('hidden');
  mode = 'flying';
}
function endGame(won, reason) {
  mode = 'over';
  document.getElementById('end-title').textContent = won ? 'MISSION COMPLETE' : 'FLIGHT OVER';
  document.getElementById('end-text').textContent = reason;
  document.getElementById('end-score').textContent = `SCORE ${missions.score} · RINGS ${missions.ringsPassed}/8`;
  endScreen.classList.remove('hidden');
  if (won) sounds.fanfare(); else sounds.fail();
}
function restart() {
  endScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  titleScreen.classList.add('hidden');
  flight.reset();
  rings.reset();
  parcel.reset();
  missions.reset();
  hud.show();
  mode = 'flying';
  missions.startedAt = performance.now();
}

// ---------- camera ----------
// Chase camera placed directly behind the plane every frame (no lag): at the
// low frame rates a software renderer can hit, a lerped camera trails hundreds
// of metres behind a fast plane and the aircraft shrinks to a dot.
function updateCamera(dt) {
  const fx = Math.sin(flight.heading), fz = Math.cos(flight.heading);
  const back = 14 + flight.speed * 0.1;
  camPos.set(
    flight.x - fx * back,
    flight.y + 4.2 + Math.max(0, flight.speed * 0.02),
    flight.z - fz * back,
  );
  const lookTarget = new THREE.Vector3(
    flight.x + fx * 26,
    flight.y + flight.vspeed * 0.4 - 1,
    flight.z + fz * 26,
  );
  camLook.lerp(lookTarget, Math.min(1, dt * 8));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ---------- main loop ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  time += dt;
  if (mode === 'flying') {
    const inp = readInput();
    flight.update(inp, dt);
    const pr = parcel.update(dt, terrainHeight);
    if (pr === 'hit' || pr === 'miss') parcel.lastResult = pr;
    if (pr === 'hit') sounds.chime();
    rings.update(dt, time);
    const event = missions.watch(flight, rings, parcel);
    if (event === 'crashed' || event === 'fuel') endGame(false, missions.failReason);
    else if (missions.finished) endGame(true, 'All three contracts flown. The islanders are cheering on the beach.');
    // landing bump + refuel feedback
    if (flight.landed && flight.speed < 3 && missions.current && missions.current.id === 'land') {
      // standing on the strip: engine idles, fuel tops up (see plane.js)
    }
    sounds.engine(flight.throttle, flight.speed, !flight.onGround);
    hud.update(flight, dt);
  }
  // clouds drift
  for (const c of world.clouds) {
    c.position.x += dt * 2;
    if (c.position.x > 900) c.position.x = -900;
  }
  flight.applyToMesh(planeMesh, prop);
  updateCamera(dt);
  renderer.render(scene, camera);
}

// ---------- screenshot staging ----------
if (shot) {
  sounds.ensure = () => {};
  applyShot(shot.setup, flight, rings, missions);
  titleScreen.classList.add('hidden');
  hud.show();
  mode = 'flying';
  // Let the engine note the staged state, then freeze the sim for a clean frame.
  window.__kestrelShot = shot.name;
}
window.__kestrel = { flight, rings, missions, mode: () => mode };
window.__ready = true;
requestAnimationFrame(frame);
