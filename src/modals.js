// Scenario picker and settings dialogs.
import { PRESETS, learnerSpec, saveSettings, settings } from './config.js';
import { clamp, deriveCar } from './geometry.js';
import { S, testMode } from './state.js';
import { canvas } from './scene.js';
import { buildLearner, loadPreset } from './world.js';
import { layoutStrip } from './cameras.js';
import { renderHelp } from './hud.js';
import { releaseKeys, setEditing } from './input.js';
import { runTests } from './tests.js';

// ===================================================================
// Modals: picker & settings
// ===================================================================
export function openModal(id) { document.getElementById(id).classList.add('open'); releaseKeys(); if (document.pointerLockElement) document.exitPointerLock(); }
export function closeModal(id) { document.getElementById(id).classList.remove('open'); canvas.focus(); }
export const cards = document.getElementById('presetCards');
for (const [id, p] of Object.entries(PRESETS)) {
  const b = document.createElement('button'); b.innerHTML = `<b>${p.name}</b><span>${p.desc}</span>`;
  b.onclick = () => { setEditing(false); loadPreset(id); closeModal('picker'); }; cards.appendChild(b);
}
document.getElementById('btnScenarios').onclick = () => openModal('picker');
document.getElementById('btnEdit').onclick = () => { setEditing(!S.editing); canvas.focus(); };
document.getElementById('btnSettings').onclick = () => toggleSettings();
document.getElementById('btnCloseSettings').onclick = () => toggleSettings();
export function toggleSettings() { const el = document.getElementById('settings'); if (el.classList.contains('open')) closeModal('settings'); else { syncSettingsForm(); openModal('settings'); } }
export const stCar = document.getElementById('stCar');
export function syncSettingsForm() {
  stCar.value = settings.car; const spec = learnerSpec();
  document.querySelectorAll('[data-spec]').forEach(el => el.value = spec[el.dataset.spec]);
  document.getElementById('stTrans').value = settings.trans; document.getElementById('stSteer').value = settings.steering;
  document.querySelectorAll('[data-marker]').forEach(el => el.checked = settings.markers[el.dataset.marker]);
  document.getElementById('stInsetsTop').checked = settings.insetsTop; document.getElementById('stInsetsFp').checked = settings.insetsFp; document.getElementById('stSound').checked = settings.sound;
  document.getElementById('stScale').value = settings.uiScale;
}
export function applyCar() { S.LG = deriveCar(learnerSpec()); buildLearner(); S.steer = clamp(S.steer, -S.LG.halfTurns, S.LG.halfTurns); renderHelp(); if (testMode) runTests(); }
stCar.onchange = () => { settings.car = stCar.value; if (settings.car === 'custom') settings.custom = { ...settings.custom }; saveSettings(); syncSettingsForm(); applyCar(); };
document.querySelectorAll('[data-spec]').forEach(el => el.onchange = () => {
  const v = parseFloat(el.value); if (!(v > 0)) { syncSettingsForm(); return; }
  if (settings.car !== 'custom') settings.custom = { ...learnerSpec() };
  settings.car = 'custom'; settings.custom[el.dataset.spec] = v; saveSettings(); syncSettingsForm(); applyCar();
});
document.getElementById('stTrans').onchange = e => { settings.trans = e.target.value; S.gear = 'F'; saveSettings(); renderHelp(); };
document.getElementById('stSteer').onchange = e => { settings.steering = e.target.value; saveSettings(); };
document.querySelectorAll('[data-marker]').forEach(el => el.onchange = () => { settings.markers[el.dataset.marker] = el.checked; saveSettings(); });
document.getElementById('stInsetsTop').onchange = e => { settings.insetsTop = e.target.checked; saveSettings(); layoutStrip(); };
document.getElementById('stInsetsFp').onchange = e => { settings.insetsFp = e.target.checked; saveSettings(); layoutStrip(); };
document.getElementById('stSound').onchange = e => { settings.sound = e.target.checked; saveSettings(); };
document.getElementById('stScale').oninput = e => { settings.uiScale = +e.target.value; document.documentElement.style.setProperty('--ui-scale', settings.uiScale); saveSettings(); layoutStrip(); };
document.documentElement.style.setProperty('--ui-scale', settings.uiScale);
