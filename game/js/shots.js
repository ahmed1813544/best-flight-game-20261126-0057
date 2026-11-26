// Kestrel Run — shots.js: deterministic staging for screenshots. A ?shot= name in the
// URL places the plane, the light and the mission at a photogenic moment and starts
// the game at once, so every screenshot is a real render of the game's own code.
export const SHOT_SETUPS = {
  // Cover: golden-hour chase view, Kestrel climbing past the first ring with the
  // home runway and the lighthouse beach in the frame below.
  cover: { sky: 'golden', x: 60, y: 78, z: 260, heading: 3.54, pitch: 0.08, roll: -0.18, speed: 42, throttle: 0.8, contract: 0, ringsPassed: 0 },
  // Ring run: banking hard through the second ring, sea and Palm Cove ahead.
  rings: { sky: 'day', x: -100, y: 70, z: 90, heading: 3.51, pitch: 0.05, roll: 0.55, speed: 46, throttle: 0.9, contract: 0, ringsPassed: 1 },
  // Final approach: low over the threshold of Kestrel Field, gear down, runway ahead.
  landing: { sky: 'golden', x: 6, y: 26, z: 520, heading: Math.PI, pitch: -0.06, roll: 0.02, speed: 30, throttle: 0.45, contract: 2, ringsPassed: 8 },
  // Dusk courier run: parcel away, the lighthouse beach glowing below.
  dusk: { sky: 'dusk', x: -280, y: 66, z: -140, heading: 4.25, pitch: 0.04, roll: -0.3, speed: 40, throttle: 0.75, contract: 1, ringsPassed: 8 },
};

export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const name = q.get('shot');
  if (name && SHOT_SETUPS[name]) return { name, setup: SHOT_SETUPS[name] };
  return null;
}

export function applyShot(setup, flight, rings, missions) {
  flight.x = setup.x; flight.y = setup.y; flight.z = setup.z;
  flight.heading = setup.heading;
  flight.pitch = setup.pitch; flight.roll = setup.roll;
  flight.speed = setup.speed; flight.throttle = setup.throttle;
  flight.fuel = 78; flight.onGround = false; flight.crashed = false;
  flight.vspeed = 0;
  rings.reset();
  for (let i = 0; i < setup.ringsPassed; i++) {
    rings.rings[i].passed = true;
    rings.rings[i].mesh.children[0].material.color.setHex(0x37d67a);
    rings.rings[i].mesh.children[0].material.emissive.setHex(0x0f5c2e);
  }
  rings.next = setup.ringsPassed;
  missions.contract = setup.contract;
  missions.ringsPassed = setup.ringsPassed;
  missions.score = setup.ringsPassed * 100 + (setup.contract > 0 ? 150 : 0);
  missions.updateHud();
}
