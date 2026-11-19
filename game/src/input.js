// Keyboard, mouse buttons, pointer lock and one-shot action edges.
export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    this.mouseButtons = [false, false, false];
    this.locked = false;
    this.enabled = true;
    window.addEventListener('keydown', (event) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (!this.keys.has(event.code)) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      this.released.add(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseButtons.fill(false);
    });
    canvas.addEventListener('mousemove', (event) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === canvas) {
        this.mouseDX += event.movementX;
        this.mouseDY += event.movementY;
      }
    });
    canvas.addEventListener('mousedown', (event) => {
      this.mouseButtons[event.button] = true;
      if (event.button === 1) event.preventDefault();
    });
    window.addEventListener('mouseup', (event) => { this.mouseButtons[event.button] = false; });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('wheel', (event) => {
      this.wheelDelta += Math.sign(event.deltaY);
      event.preventDefault();
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.mouseDX = 0;
      this.mouseDY = 0;
    });
  }

  down(code) { return this.enabled && this.keys.has(code); }
  consume(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }
  axis(positive, negative) { return (this.down(positive) ? 1 : 0) - (this.down(negative) ? 1 : 0); }
  get aiming() { return this.enabled && this.mouseButtons[2]; }
  get firing() { return this.enabled && this.mouseButtons[0]; }
  requestPointerLock() {
    if (this.enabled && document.pointerLockElement !== this.canvas) {
      const result = this.canvas.requestPointerLock?.();
      if (result?.catch) result.catch(() => {});
    }
  }
  releasePointerLock() { if (document.pointerLockElement) document.exitPointerLock?.(); }
  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    this.pressed.clear();
    this.released.clear();
  }
}
