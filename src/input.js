// Edit mode, mouse (look around, drag cars) and keyboard input.
import * as THREE from 'three';
import { EXIT_RADIUS, PALETTE, PARKED_TYPES, saveSettings, settings } from './config.js';
import { PG, carShapes, clamp, clone, objectPoly, pointInPoly, poseInBay, rad, wrapPi } from './geometry.js';
import { S, keys, testMode } from './state.js';
import { canvas, disposeTree, overlayMat, overlayMesh, scene, stripGeom, topCam } from './scene.js';
import { areaExtents, carMeshes, loadPreset, objMeshes, pushUndo, rebuildStatic, resnapToBays, undo } from './world.js';
import { hideResult, newAttempt } from './checker.js';
import { initAudio, setTone } from './audio.js';
import { cycleCamera, layoutStrip, zoomBy } from './cameras.js';
import { closeModal, toggleSettings } from './modals.js';

export const editPanel = document.getElementById('editPanel');
export function setEditing(on) {
  if (on === S.editing) return;
  S.editing = on;
  if (on) {
    S.camBeforeEdit = S.camMode; S.camMode = 'top-fixed'; if (document.pointerLockElement) document.exitPointerLock();
    hideResult(); setTone(false); syncLayoutInputs();
  } else {
    S.camMode = S.camBeforeEdit; select(null); S.attemptStart = clone(S.state); newAttempt();
  }
  editPanel.style.display = on ? 'block' : 'none';
  document.getElementById('hudBottom').style.display = on ? 'none' : 'flex';
  document.getElementById('testPanel').style.display = testMode && !on ? 'block' : 'none';
  layoutStrip();
}

// ===================================================================
// Edit mode interaction
// ===================================================================
export const raycaster = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export let mouseWorld = [0, 0], selected = null, drag = null, selOutline = null;
export function screenToWorld(ev) {
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), topCam);
  const v = new THREE.Vector3(); raycaster.ray.intersectPlane(groundPlane, v); return [v.x, v.z];
}
export function itemPose(it) { return it.kind === 'learner' ? S.state.learner : it.kind === 'exit' ? S.state.exit : it.ref; }
export function itemPolys(it) {
  const p = itemPose(it);
  if (it.kind === 'learner') { const s = carShapes(S.LG, p); return [s.body]; }
  if (it.kind === 'car') { const s = carShapes(PG[it.ref.type], p); return [s.body]; }
  if (it.kind === 'object') return [objectPoly(p)];
  const pts = []; for (let i = 0; i < 24; i++) pts.push([p.x + Math.cos(i / 24 * 2 * Math.PI) * EXIT_RADIUS, p.z + Math.sin(i / 24 * 2 * Math.PI) * EXIT_RADIUS]); return [pts];
}
export function pick(w) {
  if (Math.hypot(w[0] - S.state.exit.x, w[1] - S.state.exit.z) < EXIT_RADIUS && !pointInPoly(w, carShapes(S.LG, S.state.learner).body)) return { kind: 'exit' };
  const s = carShapes(S.LG, S.state.learner); if ([s.body, ...s.mirrors].some(p => pointInPoly(w, p))) return { kind: 'learner' };
  for (let i = S.state.cars.length - 1; i >= 0; i--) { const c = S.state.cars[i], sh = carShapes(PG[c.type], c); if ([sh.body, ...sh.mirrors].some(p => pointInPoly(w, p))) return { kind: 'car', ref: c }; }
  for (let i = S.state.objects.length - 1; i >= 0; i--) if (pointInPoly(w, objectPoly(S.state.objects[i]))) return { kind: 'object', ref: S.state.objects[i] };
  return null;
}
export function select(it) { selected = it; updateSelOutline(); }
export function updateSelOutline() {
  if (selOutline) { scene.remove(selOutline); disposeTree(selOutline); selOutline = null; }
  if (!selected || !S.editing) return;
  selOutline = new THREE.Group();
  for (const poly of itemPolys(selected)) for (let i = 0; i < poly.length; i++) selOutline.add(overlayMesh(stripGeom(poly[i], poly[(i + 1) % poly.length], 0.07, 3), overlayMat(0xffe14d, 1), 50));
  scene.add(selOutline);
}
export function syncItemMesh(it) {
  const p = itemPose(it);
  if (it.kind === 'car') { const m = carMeshes.get(it.ref.id); m.position.set(p.x, 0, p.z); m.rotation.y = -p.h; }
  else if (it.kind === 'object') { const m = objMeshes.get(it.ref.id); m.position.set(p.x, 0, p.z); m.rotation.y = -p.h; }
  else if (it.kind === 'exit') S.exitMesh.position.set(p.x, 0, p.z);
  updateSelOutline();
}
export function snapItem(it) {
  if (it.kind !== 'car' && it.kind !== 'learner') return;
  const p = itemPose(it), b = S.bays.find(b => pointInPoly([p.x, p.z], b.poly));
  if (!b) { if (it.kind === 'car') it.ref.bay = null; return; }
  const forward = Math.abs(wrapPi(p.h - b.axisAngle)) < Math.PI / 2;
  Object.assign(p, poseInBay(b, forward));
  if (it.kind === 'car') it.ref.bay = { row: b.row, idx: b.idx, forward };
}
export function rotateSelected(dDeg, snap) {
  if (!selected || selected.kind === 'exit') return;
  pushUndo();
  const p = itemPose(selected);
  if (snap) {
    // jump to the next bay-aligned heading (bay axis, its reverse, or square to it) in the rotation direction
    let nb = null, nd = Infinity; for (const b of S.bays) { const d = Math.hypot(b.centre[0] - p.x, b.centre[1] - p.z); if (d < nd) { nd = d; nb = b; } }
    const base = nb ? nb.axisAngle : 0, dir = Math.sign(dDeg);
    let bestStep = Infinity;
    for (let k = 0; k < 4; k++) { const step = wrapPi(base + k * Math.PI / 2 - p.h) * dir; const s = step <= rad(0.5) ? step + 2 * Math.PI : step; bestStep = Math.min(bestStep, s); }
    p.h = wrapPi(p.h + dir * bestStep);
  } else p.h = wrapPi(p.h + rad(dDeg));
  if (selected.kind === 'car') selected.ref.bay = null;
  commitEdit();
}
export function commitEdit() { rebuildStatic(); if (selected && selected.kind !== 'learner') { selected = refind(selected); } updateSelOutline(); }
export function refind(it) { if (it.kind === 'car') return { kind: 'car', ref: S.state.cars.find(c => c.id === it.ref.id) }; if (it.kind === 'object') return { kind: 'object', ref: S.state.objects.find(o => o.id === it.ref.id) }; return it; }
export function deleteSelected() {
  if (!selected || (selected.kind !== 'car' && selected.kind !== 'object')) return;
  pushUndo();
  if (selected.kind === 'car') S.state.cars = S.state.cars.filter(c => c !== selected.ref); else S.state.objects = S.state.objects.filter(o => o !== selected.ref);
  selected = null; commitEdit();
}
export function addItem(kind) {
  pushUndo();
  const at = { x: mouseWorld[0], z: mouseWorld[1] };
  const e = areaExtents(); if (!(at.x > e.x0 && at.x < e.x1 && at.z > e.z0 && at.z < e.z1)) { at.x = (e.x0 + e.x1) / 2; at.z = 0; }
  let it;
  if (PARKED_TYPES[kind]) { const c = { id: S.nextId++, type: kind, color: PALETTE[S.nextId % PALETTE.length], x: at.x, z: at.z, h: 0, bay: null }; S.state.cars.push(c); it = { kind: 'car', ref: c }; snapItem(it); }
  else { const o = { id: S.nextId++, kind, x: at.x, z: at.z, h: 0, len: kind === 'wall' ? 4 : 0.45, wid: kind === 'wall' ? 0.25 : 0.45 }; S.state.objects.push(o); it = { kind: 'object', ref: o }; }
  rebuildStatic(); select(refind(it));
}

canvas.addEventListener('pointerdown', ev => {
  initAudio(); canvas.focus();
  if ((S.camMode === 'fp' || S.camMode === 'chase') && !S.editing) { canvas.requestPointerLock()?.catch?.(() => {}); return; }
  if (!S.editing || ev.button !== 0) return;
  const w = screenToWorld(ev); mouseWorld = w;
  const it = pick(w); select(it);
  if (it) { const p = itemPose(it); pushUndo(); drag = { it, off: [p.x - w[0], p.z - w[1]], moved: false }; canvas.setPointerCapture(ev.pointerId); }
});
canvas.addEventListener('pointermove', ev => {
  if (document.pointerLockElement === canvas && S.camMode === 'chase') {
    S.orbitYaw = wrapPi(S.orbitYaw + ev.movementX * 0.003); S.orbitPitch = clamp(S.orbitPitch + ev.movementY * 0.0025, -rad(12), rad(70));
    return;
  }
  if (document.pointerLockElement === canvas) {
    S.yaw = clamp(S.yaw - ev.movementX * 0.0025, -rad(165), rad(165)); S.pitch = clamp(S.pitch - ev.movementY * 0.0025, -rad(60), rad(60)); return;
  }
  if (!S.editing) return;
  const w = screenToWorld(ev); mouseWorld = w;
  if (drag) {
    const p = itemPose(drag.it); p.x = w[0] + drag.off[0]; p.z = w[1] + drag.off[1]; drag.moved = true;
    syncItemMesh(drag.it);
  }
  canvas.style.cursor = drag ? 'grabbing' : pick(w) ? 'grab' : 'default';
});
canvas.addEventListener('pointerup', ev => {
  if (!drag) return;
  if (!drag.moved) S.undoStack.pop();
  else { if (!ev.altKey) snapItem(drag.it); else if (drag.it.kind === 'car') drag.it.ref.bay = null; commitEdit(); }
  drag = null;
});
canvas.addEventListener('wheel', ev => {
  ev.preventDefault();
  if (S.editing && drag && drag.it.kind !== 'exit') { const p = itemPose(drag.it); p.h = wrapPi(p.h + rad(ev.deltaY > 0 ? 3 : -3)); if (drag.it.kind === 'car') drag.it.ref.bay = null; syncItemMesh(drag.it); return; }
  if (S.camMode === 'fp' && !S.editing) return;
  zoomBy(ev.deltaY > 0 ? 1.1 : 1 / 1.1);
}, { passive: false });

editPanel.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addItem(b.dataset.add));
document.getElementById('btnDelete').onclick = deleteSelected;
document.getElementById('btnRotL').onclick = () => rotateSelected(-5, false);
document.getElementById('btnRotR').onclick = () => rotateSelected(5, false);
document.getElementById('btnUndo').onclick = undo;
document.getElementById('btnReset').onclick = () => { pushUndo(); S.state = clone(S.attemptStart); rebuildStatic(); select(null); syncLayoutInputs(); };
document.getElementById('btnReload').onclick = () => { loadPreset(S.currentPreset); syncLayoutInputs(); select(null); };

export const LY = { lyRows: 'rows', lyBays: 'baysPerRow', lyAngle: 'angle', lyWidth: 'bayWidth', lyLength: 'bayLength', lyAisle: 'aisleWidth', lyBack: 'back', lyPillars: 'pillars' };
export let lastUndoKey = null, lastUndoAt = 0;
export function syncLayoutInputs() {
  for (const [id, k] of Object.entries(LY)) {
    const el = document.getElementById(id); if (el.type === 'checkbox') el.checked = S.state.layout[k]; else el.value = S.state.layout[k];
    const v = document.getElementById(id + 'V'); if (v) v.textContent = k === 'baysPerRow' ? S.state.layout[k] : `${(+S.state.layout[k]).toFixed(2)} m`;
  }
}
for (const [id, k] of Object.entries(LY)) {
  const el = document.getElementById(id);
  el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
    const now = performance.now(); if (lastUndoKey !== k || now - lastUndoAt > 1000) pushUndo(); lastUndoKey = k; lastUndoAt = now;
    S.state.layout[k] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' && k === 'back' ? el.value : +el.value;
    resnapToBays(); rebuildStatic(); syncLayoutInputs(); updateSelOutline();
  });
}

// ===================================================================
// Keyboard
// ===================================================================
export function anyModalOpen() { return document.querySelector('.modal.open'); }
addEventListener('keydown', ev => {
  initAudio();
  const typing = ev.target.matches && ev.target.matches('input, select, textarea');
  if (ev.code === 'Escape') { if (document.getElementById('picker').classList.contains('open')) { if (S.state) closeModal('picker'); } else toggleSettings(); return; }
  if (typing || anyModalOpen()) return;
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'BracketLeft', 'BracketRight'].includes(ev.code)) ev.preventDefault();
  keys[ev.code] = true;
  if (ev.repeat && !['BracketLeft', 'BracketRight', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract'].includes(ev.code)) return;
  switch (ev.code) {
    case 'KeyE': setEditing(!S.editing); break;
    case 'KeyH': document.getElementById('help').classList.toggle('collapsed'); break;
    case 'KeyM': if (S.camMode === 'fp' && !S.editing) settings.insetsFp = !settings.insetsFp; else settings.insetsTop = !settings.insetsTop; saveSettings(); layoutStrip(); break;
    case 'Equal': case 'NumpadAdd': zoomBy(1 / 1.1); break;
    case 'Minus': case 'NumpadSubtract': zoomBy(1.1); break;
  }
  if (S.editing) {
    if (ev.code === 'KeyZ' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); undo(); }
    if (ev.code === 'Delete' || ev.code === 'Backspace') deleteSelected();
    if (ev.code === 'BracketLeft') rotateSelected(ev.shiftKey ? -1 : -5, ev.shiftKey);
    if (ev.code === 'BracketRight') rotateSelected(ev.shiftKey ? 1 : 5, ev.shiftKey);
    if (ev.code === 'KeyP') { pushUndo(); S.state.learner.x = mouseWorld[0]; S.state.learner.z = mouseWorld[1]; select({ kind: 'learner' }); }
  } else {
    if (ev.code === 'KeyR' && settings.trans !== 'arcade') S.gear = S.gear === 'R' ? 'F' : 'R';
    if (ev.code === 'KeyC') S.steer = 0;
    if (ev.code === 'KeyV') cycleCamera();
    if (ev.code === 'KeyX') { S.yaw = 0; S.pitch = -0.08; S.orbitYaw = S.orbitPitch = 0; }
  }
});
addEventListener('keyup', ev => { keys[ev.code] = false; });
export function releaseKeys() { for (const k in keys) keys[k] = false; }
addEventListener('blur', releaseKeys);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseKeys(); });
