// On-screen controls for touch screens: steering, pedals and view buttons in place of the keyboard.
// They show up when the device's main pointer is a finger, or as soon as the screen is touched,
// and give way to the keyboard help again when a mouse or a key is used.
import { settings } from './config.js';
import { S, keys } from './state.js';
import { initAudio } from './audio.js';
import { cycleCamera, layoutStrip } from './cameras.js';
import { resetView, toggleGear, toggleMirrors } from './input.js';

const holds = [...document.querySelectorAll('[data-hold]')];
const ACTIONS = { view: cycleCamera, look: resetView, mirrors: toggleMirrors, centre: () => { S.steer = 0; }, gear: toggleGear };

export function setTouchUI(on) {
  if (on === S.touch) return;
  S.touch = on; document.body.classList.toggle('touch', on);
  if (on) document.getElementById('help').classList.add('collapsed');
  shown = ''; updateTouch(); layoutStrip();
}
export function initTouch() {
  setTouchUI(matchMedia('(pointer: coarse)').matches);
  addEventListener('pointerdown', ev => { if (ev.pointerType === 'touch') setTouchUI(true); else if (ev.pointerType === 'mouse') setTouchUI(false); }, true);
  addEventListener('keydown', ev => { if (!(ev.target.matches && ev.target.matches('input, select, textarea'))) setTouchUI(false); }, true);
}

// press-and-hold buttons stand in for the driving keys
for (const el of holds) {
  const code = el.dataset.hold, up = () => { keys[code] = false; };
  el.addEventListener('pointerdown', ev => { ev.preventDefault(); initAudio(); keys[code] = true; try { el.setPointerCapture(ev.pointerId); } catch (e) { /* pointer already gone */ } });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, up);
}
document.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => { initAudio(); ACTIONS[el.dataset.act](); }));
document.querySelectorAll('.touch-cluster').forEach(el => el.addEventListener('contextmenu', ev => ev.preventDefault()));

let shown = '';
export function updateTouch() {
  if (!S.touch) return;
  const key = `${S.editing}|${settings.trans}`;
  if (key !== shown) {
    shown = key; document.body.classList.toggle('editing', S.editing);
    const arcade = settings.trans === 'arcade';
    document.querySelector('[data-act="gear"]').style.display = arcade ? 'none' : '';
    document.getElementById('tReverse').style.display = arcade ? '' : 'none';
    document.getElementById('tFwdLabel').textContent = arcade ? 'Forward' : 'Go';
    document.getElementById('tGearSub').textContent = settings.trans === 'auto' ? 'D ↔ R' : '1 ↔ R';
  }
  for (const el of holds) el.classList.toggle('down', !!keys[el.dataset.hold]);
}
