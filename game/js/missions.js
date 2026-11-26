// Kestrel Run — missions.js: the three contracts, scoring, win/fail and the toast feed.
import { RUNWAYS } from './world.js';

export const CONTRACTS = [
  { id: 'rings', title: 'CONTRACT 1 / 3', text: 'Ring Run — thread all 8 sky rings', points: 100 },
  { id: 'drop', title: 'CONTRACT 2 / 3', text: 'Parcel Drop — drop the crate on the beach circle', points: 300 },
  { id: 'land', title: 'CONTRACT 3 / 3', text: 'Homecoming — land gently on Kestrel Field', points: 250 },
];

export class MissionLog {
  constructor(hud) {
    this.hud = hud;
    this.reset();
  }
  reset() {
    this.contract = 0;
    this.score = 0;
    this.ringsPassed = 0;
    this.parcelResult = null;
    this.startedAt = performance.now();
    this.finished = false;
    this.failed = false;
    this.failReason = '';
    this.updateHud();
  }
  get current() { return CONTRACTS[this.contract]; }
  addScore(points, label) {
    this.score += points;
    this.hud.toast(`${label}  +${points}`);
    this.updateHud();
  }
  advance() {
    this.contract++;
    if (this.contract >= CONTRACTS.length) {
      this.finished = true;
      const secs = Math.round((performance.now() - this.startedAt) / 1000);
      const timeBonus = Math.max(0, 600 - secs * 2);
      this.score += timeBonus;
      this.hud.toast(`ALL CONTRACTS DONE  +${timeBonus} TIME BONUS`);
    }
    this.updateHud();
  }
  fail(reason) {
    this.failed = true;
    this.failReason = reason;
  }
  updateHud() {
    const c = this.current;
    this.hud.setMission(c ? c.title : 'ALL CONTRACTS DONE', c ? c.text : 'Kestrel is home. Well flown, pilot.');
    this.hud.setScore(this.score);
  }
  // Called every frame with the live flight state; returns 'landed' | 'crashed' | 'fuel' | null.
  watch(flight, rings, parcel) {
    if (this.finished || this.failed) return null;
    if (flight.crashed) {
      this.fail('The Kestrel went down. The islanders are already rebuilding her.');
      return 'crashed';
    }
    if (flight.fuel <= 0 && flight.onGround === false && flight.y < 12) {
      this.fail('Out of fuel over open ground. Next time, mind the gauge.');
      return 'fuel';
    }
    if (this.current.id === 'rings') {
      const passed = rings.checkPass(flight.x, flight.y, flight.z);
      if (passed >= 0) {
        this.ringsPassed++;
        this.addScore(100, `RING ${passed + 1} / 8`);
        if (rings.done) {
          this.addScore(150, 'RING RUN COMPLETE');
          this.advance();
        }
      }
    } else if (this.current.id === 'drop') {
      if (parcel.dropped && this.parcelResult === null) {
        this.parcelResult = 'done';
        if (parcel.lastResult === 'hit') {
          this.addScore(300, 'PARCEL ON TARGET');
        } else {
          this.addScore(80, 'PARCEL DOWN — OFF TARGET');
        }
        this.advance();
      }
    } else if (this.current.id === 'land') {
      const home = RUNWAYS[0];
      // Home strip runs along z: lateral |x - cx| within the width, along-strip |z - cz| within the length.
      const onHome = flight.onGround && flight.landed
        && Math.abs(flight.x - home.cx) < home.width / 2 + 10
        && Math.abs(flight.z - home.cz) < home.length / 2 + 10;
      if (onHome && flight.speed < 3) {
        const smooth = flight.y <= home.elev + 2.5;
        this.addScore(smooth ? 250 : 150, smooth ? 'SMOOTH LANDING' : 'LANDED');
        this.advance();
      }
    }
    return null;
  }
}
