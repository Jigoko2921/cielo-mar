// Input: a flat set of held keys, one-frame edge flags, the mouse delta and buttons, and pointer
// lock. The rest of the game reads isDown / pressed / mouse through the object returned here and
// never touches the DOM itself, so the loop owns all the event plumbing.

export const ACTIONS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  crouch: ['KeyC'],
  enter: ['KeyF'],
  interact: ['KeyE'],
  reload: ['KeyR'],
  wheel: ['Tab'],
  pause: ['Escape'],
  map: ['KeyM'],
};

const CODE_TO_ACTION = {};
for (const [action, codes] of Object.entries(ACTIONS)) {
  for (const code of codes) CODE_TO_ACTION[code] = action;
}

export function createInput(canvas) {
  const down = new Set();
  const edge = new Set();
  const released = new Set();
  const typed = [];
  const input = {
    isDown(action) {
      const codes = ACTIONS[action];
      if (!codes) return false;
      for (const code of codes) if (down.has(code)) return true;
      return false;
    },
    pressed(action) {
      const codes = ACTIONS[action];
      if (!codes) return false;
      for (const code of codes) if (edge.has(code)) return true;
      return false;
    },
    released(action) {
      const codes = ACTIONS[action];
      if (!codes) return false;
      for (const code of codes) if (released.has(code)) return true;
      return false;
    },
    isCode(code) { return down.has(code); },
    pressedCode(code) { return edge.has(code); },
    takeTyped() { const t = typed.slice(); typed.length = 0; return t; },
    mouse: { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false },
    pointerLocked: false,
    locked: false,
    requestLock() {
      if (this.locked) return;
      this.locked = true;
      try { canvas.requestPointerLock(); } catch { /* pointer lock can be refused outside a click */ }
    },
    exitLock() { try { document.exitPointerLock(); } catch { /* already out */ } },
    endFrame() {
      edge.clear();
      released.clear();
      this.mouse.dx = 0;
      this.mouse.dy = 0;
      this.mouse.leftPressed = false;
      this.mouse.rightPressed = false;
    },
    reset() {
      down.clear();
      edge.clear();
      released.clear();
      typed.length = 0;
      this.mouse.left = false;
      this.mouse.right = false;
    },
  };

  window.addEventListener('keydown', (event) => {
    if (!down.has(event.code)) edge.add(event.code);
    down.add(event.code);
    typed.push({ code: event.code, key: event.key });
    if (event.code === 'Tab' || event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (event.code === 'Escape') input.exitLock();
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
    released.add(event.code);
  });
  window.addEventListener('blur', () => input.reset());

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { input.mouse.left = true; input.mouse.leftPressed = true; }
    if (event.button === 2) { input.mouse.right = true; input.mouse.rightPressed = true; }
    if (!input.pointerLocked && input.wantLock) input.requestLock();
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouse.left = false;
    if (event.button === 2) input.mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('mousemove', (event) => {
    if (!input.pointerLocked) return;
    input.mouse.dx += event.movementX || 0;
    input.mouse.dy += event.movementY || 0;
  });
  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === canvas;
    if (!input.pointerLocked) input.locked = false;
  });
  canvas.addEventListener('wheel', (event) => { input.wheelDelta = (input.wheelDelta || 0) + Math.sign(event.deltaY); }, { passive: true });

  input.wantLock = true;
  return input;
}
