export class Input {
  constructor(element, renderer, isPlaying, onPause, onBomb) {
    this.keys = new Set(); this.dragX = 0; this.dragY = 0; this.pointer = null;
    this.element = element; this.renderer = renderer;
    window.addEventListener('keydown', event => {
      if (event.code === 'Escape' && !event.repeat) { onPause(); return; }
      if (!isPlaying()) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat) onBomb();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    element.addEventListener('pointerdown', event => {
      if (!isPlaying() || this.pointer !== null || event.button !== 0) return;
      this.pointer = event.pointerId; this.lastX = event.clientX; this.lastY = event.clientY;
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener('pointermove', event => {
      if (event.pointerId !== this.pointer || !isPlaying()) return;
      const previous = renderer.pointerToWorld(this.lastX, this.lastY);
      const current = renderer.pointerToWorld(event.clientX, event.clientY);
      this.dragX += current.x - previous.x; this.dragY += current.y - previous.y;
      this.lastX = event.clientX; this.lastY = event.clientY;
    });
    const release = event => { if (event.pointerId === this.pointer) { this.pointer = null; this.dragX = 0; this.dragY = 0; } };
    element.addEventListener('pointerup', release); element.addEventListener('pointercancel', release); element.addEventListener('lostpointercapture', release);
  }
  read() {
    const has = (...codes) => codes.some(code => this.keys.has(code));
    const state = { x: Number(has('KeyD', 'ArrowRight')) - Number(has('KeyA', 'ArrowLeft')), y: Number(has('KeyW', 'ArrowUp')) - Number(has('KeyS', 'ArrowDown')), dragX: this.dragX, dragY: this.dragY };
    state.focus = has('Space'); this.dragX = 0; this.dragY = 0; return state;
  }
  clear() {
    this.keys.clear(); this.dragX = 0; this.dragY = 0;
    if (this.pointer !== null && this.element.hasPointerCapture(this.pointer)) this.element.releasePointerCapture(this.pointer);
    this.pointer = null;
  }
}
