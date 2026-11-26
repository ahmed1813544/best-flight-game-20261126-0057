# Kestrel Run — Island Courier

[![Make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/ahmed1813544/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/ahmed1813544/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete, original 3D flight game that plays offline in a desktop browser from
static files. Fly the little bush plane **Kestrel** across the Marrow Isles and
fly all three contracts before the fuel gauge hits empty.

## The game

- **Ring Run** — thread all 8 glowing sky rings around the islands.
- **Parcel Drop** — drop the crate on the yellow beach circle by the lighthouse.
  The crate keeps your forward speed under its chute, so lead the target.
- **Homecoming** — bring her home with a gentle landing on Kestrel Field.
  Mind the fuel: land at Kestrel Field to refuel, mind the hills, and don't
  stall — below 17 m/s the wing stops flying.

## Controls

| Input | Action |
| --- | --- |
| W / S | Throttle up / down |
| ↑ / ↓ or I / K | Pitch down / up (pull up to climb) |
| ← / → or A / D | Bank left / right (bank to turn) |
| Mouse drag | Steer |
| Space | Drop the parcel |
| P | Pause · M mute · R restart |

The HUD shows airspeed, altitude, vertical speed, a compass with heading, an
artificial horizon, fuel, throttle, score and the current contract. A crash,
a hard landing off the strip, or running out of fuel over rough ground ends
the flight; a gentle touchdown on the asphalt refuels and counts.

## Play it

Serve `game/` with any static server and open `index.html` — no build step,
no network. For example, from the repository root:

```
node serve.ts   # serves game/ on http://localhost:8080 (development only)
```

## How it is built

- `game/` — the game, plain static files. Three.js r160 is vendored at
  `game/vendor/three.module.min.js`; everything else is original code.
  - `js/world.js` — the Marrow Isles: deterministic island terrain, sea, sky,
    two airstrips, palms, houses, lighthouse, hangar, clouds.
  - `js/plane.js` — the Kestrel (built from primitives) and its flight model.
  - `js/rings.js` — the sky-ring course and the parcel with its parachute.
  - `js/missions.js` — the three contracts, scoring and win/fail.
  - `js/hud.js` — instruments: gauges, compass, artificial horizon, toasts.
  - `js/audio.js` — synthesised engine, wind, chimes and fanfare (WebAudio).
  - `js/shots.js` — deterministic `?shot=` staging for screenshots.
  - `js/main.js` — boot, game loop, input and chase camera.
- `screenshots/` — four real renders of the game's own code.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.

## License

MIT — see [LICENSE](LICENSE).
