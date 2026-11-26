// Kestrel Run — hud.js: the instrument panel. DOM gauges, a compass strip, an
// artificial-horizon canvas, mission text and toast messages.
export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      speed: document.getElementById('hud-speed'),
      alt: document.getElementById('hud-alt'),
      vsi: document.getElementById('hud-vsi'),
      score: document.getElementById('hud-score'),
      fuel: document.getElementById('hud-fuel'),
      fuelFill: document.getElementById('fuel-fill'),
      throttle: document.getElementById('hud-throttle'),
      heading: document.getElementById('hud-heading'),
      strip: document.getElementById('compass-strip'),
      missionTitle: document.getElementById('mission-title'),
      missionText: document.getElementById('mission-text'),
      toast: document.getElementById('hud-toast'),
      warn: document.getElementById('hud-warn'),
      horizon: document.getElementById('horizon'),
    };
    this.horizonCtx = this.el.horizon.getContext('2d');
    this.toastTimer = 0;
    this.buildCompass();
  }
  buildCompass() {
    const marks = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
    this.el.strip.textContent = marks.map((m) => ` ${m} `).join('·');
  }
  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }
  setMission(title, text) {
    this.el.missionTitle.textContent = title;
    this.el.missionText.textContent = text;
  }
  setScore(score) { this.el.score.textContent = String(score); }
  toast(text) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, 2200);
  }
  warn(text) { this.el.warn.textContent = text; }
  update(flight, dt) {
    this.el.speed.textContent = String(Math.round(flight.knots));
    this.el.alt.textContent = String(Math.round(flight.feet));
    this.el.vsi.textContent = String(Math.round(flight.verticalSpeed * 196.85));
    this.el.fuel.textContent = String(Math.round(flight.fuel));
    this.el.fuelFill.style.width = `${flight.fuel}%`;
    this.el.fuelFill.classList.toggle('low', flight.fuel < 25);
    this.el.throttle.textContent = String(Math.round(flight.throttle * 100));
    const hd = Math.round(flight.headingDeg);
    this.el.heading.textContent = `${String(hd).padStart(3, '0')}°`;
    // Scroll the compass strip so the current heading stays centred.
    const degPerChar = 360 / (this.el.strip.textContent.length || 360);
    const offset = ((hd / degPerChar) % this.el.strip.textContent.length);
    this.el.strip.style.transform = `translateX(${-(offset * 7.2) % 216}px)`;
    // Warnings
    let w = '';
    if (flight.stalled) w = '⚠ STALL — NOSE DOWN, FULL THROTTLE';
    else if (flight.fuel < 20 && flight.fuel > 0) w = '⚠ LOW FUEL';
    else if (flight.fuel <= 0) w = '⚠ FUEL EMPTY — GLIDING';
    else if (flight.onGround && flight.speed > 40) w = '⚠ TOO FAST ON THE GROUND';
    this.warn(w);
    this.drawHorizon(flight);
  }
  drawHorizon(flight) {
    const ctx = this.horizonCtx;
    const W = 180, H = 110;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(flight.roll);
    const pitchPx = flight.pitch * 90;
    // sky
    ctx.fillStyle = '#5aa9e6';
    ctx.fillRect(-W, -H + pitchPx, W * 2, H);
    // ground
    ctx.fillStyle = '#8a6b3f';
    ctx.fillRect(-W, pitchPx, W * 2, H);
    // horizon line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-W, pitchPx);
    ctx.lineTo(W, pitchPx);
    ctx.stroke();
    ctx.restore();
    // fixed wings marker
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 34, H / 2);
    ctx.lineTo(W / 2 - 10, H / 2);
    ctx.moveTo(W / 2 + 10, H / 2);
    ctx.lineTo(W / 2 + 34, H / 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
