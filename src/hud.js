// Gear, steering and mode HUD, and the controls help panel.
import { settings } from './config.js';
import { S } from './state.js';
import { canvas } from './scene.js';

// ===================================================================
// HUD
// ===================================================================
export const gearEl = document.getElementById('gear'), gearVal = document.getElementById('gearVal');
export const wheelSvg = document.getElementById('wheelSvg'), steerText = document.getElementById('steerText');
export function fmtTurns(q) { const w = Math.floor(q), f = ['', '¼', '½', '¾'][Math.round((q - w) * 4)]; return (w ? w : '') + f; }
export function updateHud() {
  let g;
  if (settings.trans === 'manual') g = S.gear === 'R' ? 'R' : '1';
  else if (settings.trans === 'auto') g = S.gear === 'R' ? 'R' : 'D';
  else g = S.lastMoveDir < 0 ? 'R' : 'F';
  gearVal.textContent = g; gearEl.classList.toggle('rev', g === 'R');
  S.learnerParts.int.setGear(g);
  gearEl.querySelector('.label').textContent = settings.trans === 'arcade' ? 'DIRECTION' : 'GEAR';
  wheelSvg.setAttribute('transform', `rotate(${S.steer * 360})`);
  const q = Math.round(Math.abs(S.steer) * 4) / 4, full = Math.abs(S.steer) >= S.LG.halfTurns - 0.01;
  const main = q === 0 ? 'Straight' : `${fmtTurns(q)} turn${q > 1 ? 's' : ''} ${S.steer < 0 ? 'left' : 'right'}`;
  const sub = full ? '<span class="sub lock">FULL LOCK</span>' : `<span class="sub">${q === 0 ? 'wheel centred' : `of ${fmtTurns(Math.round(S.LG.halfTurns * 4) / 4)} to full lock`}</span>`;
  const html = main + sub; if (steerText._h !== html) { steerText.innerHTML = html; steerText._h = html; }
  document.getElementById('modeText').textContent = S.editing ? 'EDIT' : 'DRIVE';
  document.getElementById('modeText').classList.toggle('edit', S.editing);
  document.getElementById('camText').textContent = S.editing ? 'Top-down' : { 'top-fixed': 'Top-down', chase: 'Chase cam', fp: 'Driver’s seat' }[S.camMode];
  const fpHint = document.getElementById('fpHint');
  const hint = S.editing ? '' : (S.camMode === 'fp' || S.camMode === 'chase') && document.pointerLockElement !== canvas ? S.camMode : '';
  fpHint.style.display = hint ? 'block' : 'none';
  if (hint && fpHint._h !== hint) { fpHint.innerHTML = hint === 'fp' ? 'Click to look around · <kbd>Esc</kbd> releases mouse · <kbd>X</kbd> face forward' : 'Click to look around · <kbd>Esc</kbd> releases mouse · <kbd>X</kbd> back behind the car'; fpHint._h = hint; }
}
export const HELP = [
  ['W', 'Accelerate (in the selected gear)'], ['S / Space', 'Brake'], ['A / D', 'Turn the wheel left / right'], ['R', 'Change gear (1 ↔ R)'],
  ['C', 'Centre the wheel'], ['V', 'Camera: top-down → chase → driver’s seat'], ['Mouse', 'Click to look around (chase, driver’s seat) · Esc releases'], ['X', 'Reset the view'], ['+ / − / wheel', 'Zoom'], ['M', 'Mirror / camera strip'],
  ['E', 'Edit mode'], ['Esc', 'Settings'], ['H', 'Hide this help'],
];
export function renderHelp() {
  const rows = HELP.map(([k, v]) => k === 'R' ? [k, settings.trans === 'auto' ? 'Change gear (D ↔ R)' : settings.trans === 'arcade' ? '(arcade: S reverses)' : v] : k === 'S / Space' && settings.trans === 'arcade' ? ['S', 'Reverse  ·  Space brake'] : [k, v]);
  document.getElementById('helpBody').innerHTML = rows.map(([k, v]) => `<span>${k.split(' / ').map(x => `<kbd>${x}</kbd>`).join(' ')}</span><span>${v}</span>`).join('');
}
document.getElementById('helpHead').onclick = () => document.getElementById('help').classList.toggle('collapsed');
