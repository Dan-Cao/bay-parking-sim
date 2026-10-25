// Entry point: the main loop and boot.
import { S, keys, testMode } from './state.js';
import { chaseCam, disposeTree, fpCam, mirrorCams, renderer, rts, scene, stripCam, stripScene, topCam } from './scene.js';
import { buildLearner, loadPreset } from './world.js';
import { evaluatePark, flashes, learnerHits } from './checker.js';
import { updateSensor } from './audio.js';
import { reverseEngaged, updateDrive, updateLearnerVisuals } from './driving.js';
import { resize, stripVisible, updateChaseCam, updateFpCam, updateMirrorCams, updateTopCam } from './cameras.js';
import { renderHelp, updateHud } from './hud.js';
import { anyModalOpen } from './input.js';
import { openModal } from './modals.js';
import { startTests } from './tests.js';
import { initTouch, updateTouch } from './touch.js';

// ===================================================================
// Main loop
// ===================================================================
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!S.state) return;
  let delta = (S.steer / S.LG.halfTurns) * S.LG.deltaMax;
  if (!S.editing && !anyModalOpen()) delta = updateDrive(dt).delta;
  updateSensor(reverseEngaged() && !anyModalOpen(), now / 1000);
  updateLearnerVisuals(delta);
  for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; f.m.material.opacity = Math.max(0, 1 - f.t); f.m.scale.setScalar(1 + f.t * 1.5); if (f.t > 1) { scene.remove(f.m); disposeTree(f.m); flashes.splice(i, 1); } }
  updateHud(); updateTouch();

  renderer.shadowMap.needsUpdate = true;
  const fp = S.camMode === 'fp' && !S.editing, strip = stripVisible();
  if (strip || fp) {
    updateMirrorCams();
    const list = fp ? ['left', 'cam', 'right', 'rv'] : ['left', 'cam', 'right'];   // in the car the rear camera also feeds the dash screen
    for (const k of list) { renderer.setRenderTarget(rts[k]); renderer.render(scene, mirrorCams[k]); }
    renderer.setRenderTarget(null);
  }
  renderer.autoClear = true;
  if (fp) { updateFpCam(); renderer.render(scene, fpCam); }
  else if (S.camMode === 'chase' && !S.editing) { updateChaseCam(dt); renderer.render(scene, chaseCam); }
  else { updateTopCam(); renderer.render(scene, topCam); }
  if (strip) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(stripScene, stripCam); renderer.autoClear = true; }
}

// ===================================================================
// Boot
// ===================================================================
buildLearner();
renderHelp();
initTouch();
resize();
if (testMode) startTests();
else {
  loadPreset('between');
  openModal('picker');
}
requestAnimationFrame(frame);
// debugging hook for scripted checks from the console
window.__sim = {
  get state() { return S.state; }, get LG() { return S.LG; }, evaluatePark, learnerHits, keys, tick: dt => updateDrive(dt),
  setSteer: s => { S.steer = s; }, setGear: g => { S.gear = g; }, setLook: (y, p) => { S.yaw = y; S.pitch = p; },
  setOrbit: (y, p) => { S.orbitYaw = y; S.orbitPitch = p; }, get orbit() { return [S.orbitYaw, S.orbitPitch]; },
  get attempt() { return S.attempt; }, get lastResult() { return S.lastResult; },
};
