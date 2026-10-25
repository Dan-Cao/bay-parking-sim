// Mirror strip layout and the top-down, chase, driver's seat and mirror cameras.
import * as THREE from 'three';
import { settings } from './config.js';
import { clamp, rad, toWorld, wrapPi } from './geometry.js';
import { S } from './state.js';
import { chaseCam, fpCam, mirrorCams, renderer, stripCam, stripQuads, topCam } from './scene.js';
import { areaExtents, staticGroup } from './world.js';

// ===================================================================
// Layout of HUD strip & cameras
// ===================================================================
export const stripEl = document.getElementById('strip');
stripEl.innerHTML = `<div class="frame" id="frLeft"><span>Left mirror</span></div><div class="frame" id="frCam"><span>Rear camera</span></div><div class="frame" id="frRight"><span>Right mirror</span></div>`;
export let stripRect = null;
export function stripVisible() { return !S.editing && (S.camMode === 'fp' ? settings.insetsFp : settings.insetsTop); }
export function layoutStrip() {
  const W = innerWidth, H = innerHeight;
  // on a narrow (phone) screen let the strip take most of the width so the mirrors stay readable
  const h = Math.round(Math.min(H * 0.2, Math.max(W * 0.12, Math.min((W - 36) / 4.45, 80)))), wm = Math.round(h * 4 / 3), wc = Math.round(h * 16 / 9), gap = 10;
  const total = wm * 2 + wc + gap * 2, x0 = Math.round((W - total) / 2);
  // drop below the mode badge and top buttons when they'd overlap
  const badge = document.getElementById('modeBadge').getBoundingClientRect(), btns = document.getElementById('topButtons').getBoundingClientRect();
  const top = x0 < badge.right + gap || x0 + total > btns.left - gap ? Math.round(Math.max(badge.bottom, btns.bottom)) + 6 : 10;
  const rects = { left: [x0, top, wm, h], cam: [x0 + wm + gap, top, wc, h], right: [x0 + wm + gap + wc + gap, top, wm, h] };
  const ids = { left: 'frLeft', cam: 'frCam', right: 'frRight' };
  for (const k in rects) {
    const [x, y, w, hh] = rects[k], el = document.getElementById(ids[k]);
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
    stripQuads[k].scale.set(w, hh, 1); stripQuads[k].position.set(x + w / 2, H - (y + hh / 2), 0);
  }
  stripCam.right = W; stripCam.top = H; stripCam.updateProjectionMatrix();
  stripRect = { h: top + h + 10 };
  stripEl.style.display = stripVisible() ? 'block' : 'none';
}
export function placeCam(cam, pose, f, y, r, df, dy, dr) {
  const p = toWorld(pose, f, r), d = toWorld({ x: 0, z: 0, h: pose.h }, df, dr);
  cam.position.set(p[0], y, p[1]); cam.up.set(0, 1, 0); cam.lookAt(p[0] + d[0], y + dy, p[1] + d[1]);
}
export function updateTopCam() {
  const W = innerWidth, H = innerHeight, asp = W / H;
  // keep the scene clear of the mirror strip (top) and the gear/steering HUD (bottom)
  // (and of the touch controls, or the edit panel when a narrow screen shows it as a bottom sheet)
  const topPx = stripVisible() ? stripRect.h : 0;
  const ep = S.editing ? document.getElementById('editPanel').getBoundingClientRect() : null, sheet = ep && ep.width > W * 0.6;
  const botPx = sheet ? H - ep.top + 6 : S.editing ? 0 : H - hudTop() + 6;
  const avail = Math.max(0.3, (H - topPx - botPx) / H);
  let cx, cz, halfH;
  const e = areaExtents(); cx = (e.x0 + e.x1) / 2; cz = (e.z0 + e.z1) / 2;
  halfH = Math.max((e.z1 - e.z0) / 2, (e.x1 - e.x0) / 2 * avail / asp) * S.zoomFixed;
  if (S.editing && !sheet) { const panel = ep.right / W; halfH /= (1 - panel); cx -= (halfH * 2 * asp) * panel / 2; }
  const Ht = 2 * halfH / avail, Wt = Ht * asp, bottom = -halfH - Ht * botPx / H;
  Object.assign(topCam, { left: -Wt / 2, right: Wt / 2, bottom, top: bottom + Ht });
  topCam.position.set(cx, 80, cz); topCam.lookAt(cx, 0, cz); topCam.updateProjectionMatrix();
}
// In landscape the touch controls sit in the bottom corners, beside the read-out, and the lot may show behind them.
export function hudTop() {
  let t = innerHeight;
  for (const id of innerHeight > innerWidth ? ['hudBottom', 'touchSteer', 'touchPedals'] : ['hudBottom']) { const el = document.getElementById(id); if (el.getClientRects().length) t = Math.min(t, el.getBoundingClientRect().top); }
  return t;
}
// Perspective cameras keep a vertical field of view, which gets very narrow on a portrait phone;
// widen it there so at least the horizontal view of a 4:3 screen fits.
export function fitFov(cam, vfov) {
  const asp = innerWidth / innerHeight;
  cam.fov = asp >= 4 / 3 ? vfov : Math.min(110, 2 * Math.atan(Math.tan(rad(vfov) / 2) * (4 / 3) / asp) * 180 / Math.PI);
  cam.aspect = asp; cam.updateProjectionMatrix();
}
// Third-person chase view: behind and above the car, swinging round smoothly as it turns.
// Click to capture the mouse and orbit; the view stays where it is put until X resets it.
export const chaseRay = new THREE.Raycaster();
export let chaseLift = 0.2;
export function updateChaseCam(dt) {
  const p = S.state.learner;
  if (S.chaseYaw === null) S.chaseYaw = p.h;
  S.chaseYaw += wrapPi(p.h - S.chaseYaw) * (1 - Math.exp(-dt * 3));
  const c = Math.cos(S.chaseYaw), s = Math.sin(S.chaseYaw), tx = p.x + c, tz = p.z + s;
  const r = 7.6 * S.zoomChase, a = S.chaseYaw + S.orbitYaw, target = new THREE.Vector3(tx, 0.9, tz), dir = new THREE.Vector3();
  // when a parked car, pillar or wall is in the way, lift the camera over it; failing that, pull in
  const blockedAt = e => {
    dir.set(-Math.cos(a) * Math.cos(e), Math.sin(e), -Math.sin(a) * Math.cos(e));
    chaseRay.set(target, dir); chaseRay.far = r;
    return chaseRay.intersectObject(staticGroup, true).find(h => h.point.y > 0.05);
  };
  let el = clamp(Math.atan2(1.5, 7.5 * Math.sqrt(S.zoomChase)) + S.orbitPitch, rad(2), rad(80)), hit = blockedAt(el);
  for (let e = el + rad(5); hit && e <= rad(75); e += rad(5)) { const h = blockedAt(e); if (!h) { el = e; hit = null; } }
  if (hit) blockedAt(el);
  chaseLift += ((el - chaseLift) || 0) * (1 - Math.exp(-dt * 6)); if (!hit) blockedAt(chaseLift);
  const rr = hit ? Math.max(0.6, hit.distance - 0.3) : r;
  chaseCam.position.set(tx + dir.x * rr, 0.9 + dir.y * rr, tz + dir.z * rr);
  chaseCam.up.set(0, 1, 0); chaseCam.lookAt(tx, 0.9, tz);
  fitFov(chaseCam, 60);
}
export function updateFpCam() {
  const p = S.state.learner, e = toWorld(p, S.LG.eyeF, S.LG.eyeR);
  fpCam.position.set(e[0], S.LG.eyeY, e[1]);
  fpCam.rotation.set(S.pitch, -p.h - Math.PI / 2 + S.yaw, 0);
  fitFov(fpCam, 72);
}
export function updateMirrorCams() {
  const p = S.state.learner, W = S.LG.width, belt = S.LG.beltY;
  placeCam(mirrorCams.left, p, S.LG.mirrorF - 0.12, belt + 0.1, -(S.LG.mirrorWidth / 2), -1, -0.07, -0.2);
  placeCam(mirrorCams.right, p, S.LG.mirrorF - 0.12, belt + 0.1, S.LG.mirrorWidth / 2, -1, -0.07, 0.2);
  placeCam(mirrorCams.cam, p, -S.LG.length / 2 + 0.03, 0.8, 0, -1, -0.8, 0);
  placeCam(mirrorCams.rv, p, S.LG.eyeF + 0.3, Math.min(S.LG.height - 0.12, S.LG.eyeY + 0.12), 0, -1, -0.06, 0);
}
export function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  layoutStrip();
}
addEventListener('resize', resize);

// ===================================================================
// Camera / mode switching
// ===================================================================
export function cycleCamera() {
  if (S.editing) return;
  S.camMode = { 'top-fixed': 'chase', chase: 'fp', fp: 'top-fixed' }[S.camMode];
  S.chaseYaw = null; S.orbitYaw = S.orbitPitch = 0;
  if (S.camMode === 'top-fixed' && document.pointerLockElement) document.exitPointerLock();
  layoutStrip();
}
export function zoomBy(f) { if (S.camMode === 'chase' && !S.editing) S.zoomChase = clamp(S.zoomChase * f, 0.4, 3); else S.zoomFixed = clamp(S.zoomFixed * f, 0.25, 3); }
