// Tiny synthesized effects keep the initial transfer small. Replace this service
// with an asset-backed mixer without changing combat or encounter data.
export class Audio {
  constructor(muted = true) { this.muted = muted; this.lastShot = 0; }
  unlock() {
    try {
      if (!this.context) {
        this.context = new window.AudioContext();
        this.master = this.context.createGain(); this.master.gain.value = this.muted ? 0 : 0.15; this.master.connect(this.context.destination);
      }
      this.context.resume().catch(() => {});
    } catch { /* Audio is optional; rendering and input stay available. */ }
  }
  setMuted(value) { this.muted = value; if (this.master) this.master.gain.setTargetAtTime(value ? 0 : 0.15, this.context.currentTime, 0.03); }
  play(type) {
    type=({'weapon-change':'pickup','shield-pickup':'pickup','hull-pickup':'pickup','shield-hit':'shield','hull-hit':'hit','power-depleted':'deplete','power-up':'pickup','pulse-pickup':'pickup','formation-clear':'won'})[type]||type;
    type = ({ 'life-lost': 'hit', 'respawn': 'pickup', 'extra-life': 'won', 'level-clear': 'won', 'game-over': 'hit', 'boss-phase': 'bomb', 'turnaround': 'pickup' })[type] || type;
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (type === 'fire' && now - this.lastShot < 0.15) return;
    if (type === 'fire') this.lastShot = now;
    const tones = { shield: [1100, 400, .2, 'sine'], deplete: [440, 220, .3, 'triangle'], fire: [500, 150, 0.055, 'triangle'], kill: [110, 35, 0.17, 'sawtooth'], 'target-destroyed': [85, 23, 0.5, 'sawtooth'], bomb: [130, 25, 0.7, 'sawtooth'], hit: [90, 30, 0.3, 'square'], pickup: [400, 1000, 0.28, 'sine'], won: [350, 1400, 0.6, 'sine'] };
    if (!tones[type]) return;
    const [from, to, duration, waveform] = tones[type];
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = waveform; oscillator.frequency.setValueAtTime(from, now); oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(type === 'fire' ? 0.18 : 0.4, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(now); oscillator.stop(now + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
