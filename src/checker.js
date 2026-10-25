// Collisions, the park checker, attempts and the result panel with its highlights.
import * as THREE from 'three';
import { ANGLE_TOL, DOOR_MIN, EXIT_RADIUS, HALF_LINE } from './config.js';
import { carShapes, deg, edgeDist, overlapFrac, pointInPoly, pointPolyDist, polysOverlap, raySegDist, toLocal, toWorld, wrapPi } from './geometry.js';
import { S } from './state.js';
import { disposeTree, overlayMat, overlayMesh, polyGeom, scene, stripGeom } from './scene.js';

// ===================================================================
// Collision, sensors, checker
// ===================================================================
export function learnerHits(pose) {
  const sh = carShapes(S.LG, pose), tall = [sh.body, ...sh.mirrors], hits = [];
  for (const ob of S.obstacles) {
    const mine = ob.kind === 'kerb' ? sh.tyres : tall;
    for (const a of mine) for (const b of ob.polys) if (polysOverlap(a, b)) hits.push({ ob, a, b });
  }
  return hits;
}
export function contactPoint(hit) {
  const pts = [...hit.a.filter(p => pointInPoly(p, hit.b)), ...hit.b.filter(p => pointInPoly(p, hit.a))];
  const src = pts.length ? pts : [...hit.a, ...hit.b];
  return [src.reduce((s, p) => s + p[0], 0) / src.length, src.reduce((s, p) => s + p[1], 0) / src.length];
}
export function rearSensorDistance(pose) {
  const half = S.LG.width / 2, rearF = -S.LG.length / 2; let best = Infinity;
  for (const ob of S.obstacles) for (const p of ob.samples) {
    const [f, r] = toLocal(pose, p[0], p[1]);
    if (f > rearF + 0.05 || Math.abs(r) > half + 0.5) continue;
    const d = Math.hypot(rearF - f, Math.max(0, Math.abs(r) - (half - 0.15)));
    if (d < best) best = d;
  }
  return best;
}
export function doorGap(pose) {
  const dir = [-Math.sin(pose.h), Math.cos(pose.h)];
  let best = Infinity, from = null;
  for (let i = 0; i < 6; i++) {
    const f = S.LG.doorRear + (S.LG.doorFront - S.LG.doorRear) * i / 5, o = toWorld(pose, f, S.LG.width / 2 - 0.02);
    for (const ob of S.obstacles) { if (ob.kind === 'kerb') continue;
      for (const poly of ob.polys) for (let j = 0; j < poly.length; j++) {
        const t = raySegDist(o, dir, poly[j], poly[(j + 1) % poly.length]);
        if (t < best) { best = t; from = o; }
      } }
  }
  if (!from) return { gap: Infinity };
  return { gap: best - 0.02, from, to: [from[0] + dir[0] * best, from[1] + dir[1] * best] };
}
export function bestBay(pose) {
  let best = null, frac = 0;
  for (const b of S.bays) { const f = overlapFrac(S.LG, pose, b); if (f > frac) { frac = f; best = b; } }
  return frac >= 0.5 ? best : null;
}
export function fmtLine(d) {
  if (d - HALF_LINE >= 0) return `${Math.round((d - HALF_LINE) * 100)} cm clear`;
  if (d >= -HALF_LINE) return 'touching the line';
  return `${Math.round(-(d + HALF_LINE) * 100)} cm over`;
}
export function evaluatePark(pose, contacts) {
  const bay = bestBay(pose); if (!bay) return null;
  const sh = carShapes(S.LG, pose), sides = bay.edges.filter(e => e.type === 'side'), ends = bay.edges.filter(e => e.type !== 'side');
  const checks = [], hl = { tyres: [], points: [], edges: [], angle: null, door: null, bay };
  // wheels
  let tw = Infinity;
  sh.tyres.forEach(t => {
    const d = Math.min(...sides.flatMap(e => t.map(p => edgeDist(e, p))));
    tw = Math.min(tw, d);
    if (d < HALF_LINE) hl.tyres.push({ poly: t, status: d < -HALF_LINE ? 'fail' : 'warn' });
  });
  checks.push({ id: 'wheels', label: 'Wheels inside side lines', status: tw >= HALF_LINE ? 'pass' : tw >= -HALF_LINE ? 'warn' : 'fail', value: fmtLine(tw) });
  // body & mirrors vs side lines; whole car vs end lines
  const lineCheck = (edges, pts) => {
    let worst = Infinity;
    for (const e of edges) for (const p of pts) { const d = edgeDist(e, p); worst = Math.min(worst, d); if (d < -HALF_LINE) { hl.points.push(p); if (!hl.edges.includes(e)) hl.edges.push(e); } }
    return worst;
  };
  const bw = lineCheck(sides, [...sh.body, ...sh.mirrors.flat()]);
  checks.push({ id: 'body', label: 'Body & mirrors inside side lines', status: bw < -HALF_LINE ? 'fail' : 'pass', value: fmtLine(bw) });
  const lw = lineCheck(ends, sh.body);
  checks.push({ id: 'length', label: 'Within bay length', status: lw < -HALF_LINE ? 'fail' : 'pass', value: fmtLine(lw) });
  let ad = Math.abs(wrapPi(pose.h - bay.axisAngle)); if (ad > Math.PI / 2) ad = Math.PI - ad;
  const angOk = deg(ad) <= ANGLE_TOL + 1e-9;
  if (!angOk) hl.angle = true;
  checks.push({ id: 'angle', label: `Straight (≤ ${ANGLE_TOL}°)`, status: angOk ? 'pass' : 'fail', value: `${deg(ad).toFixed(1)}°` });
  checks.push({ id: 'contacts', label: 'No contact', status: contacts ? 'fail' : 'pass', value: contacts ? `${contacts} contact${contacts > 1 ? 's' : ''}` : 'none' });
  const dg = doorGap(pose);
  const dOk = dg.gap >= DOOR_MIN;
  if (dg.from && dg.gap < 3) hl.door = { ...dg, status: dOk ? 'pass' : 'warn' };
  checks.push({ id: 'door', label: "Driver's door room (≥ 60 cm)", status: dOk ? 'pass' : 'warn', value: dg.gap > 3 ? '> 3 m' : `${Math.round(dg.gap * 100)} cm` });
  return { kind: 'park', pass: !checks.some(c => c.status === 'fail'), checks, hl, pose: { ...pose } };
}
export function touchesExit(pose) {
  const sh = carShapes(S.LG, pose), c = [S.state.exit.x, S.state.exit.z];
  return pointPolyDist(c, sh.body) < EXIT_RADIUS;
}

// ===================================================================
// Attempts & results
// ===================================================================
export function newAttempt() {
  const b = bestBay(S.state.learner);
  S.attempt = { contacts: 0, contactPts: [], moved: false, exit: b ? { bay: b, left: false } : null };
  S.resultShown = false; S.stopTimer = 0; hideResult();
}
export const resultEl = document.getElementById('result');
export const ICON = { pass: '✓', warn: '!', fail: '✗' };
export function showResult(r) {
  S.lastResult = r; S.resultShown = true;
  let html = '';
  if (r.kind === 'park') html += `<h2 class="${r.pass ? 'pass' : 'fail'}">${r.pass ? 'Parked — pass' : 'Parked — not quite'}</h2>`;
  else html += `<h2 class="${r.pass ? 'pass' : 'fail'}">${r.pass ? 'Exit — pass' : 'Exit — contact made'}</h2>`;
  for (const c of r.checks) html += `<div class="row ${c.status}"><span class="icon">${ICON[c.status]}</span><span>${c.label}</span><span class="val">${c.value}</span></div>`;
  html += `<div class="foot">${r.kind === 'park' ? 'Adjust and stop again to re-check, or pull out to practise exiting' : 'Drive on to try again'}.</div>`;
  resultEl.innerHTML = html; resultEl.style.display = 'block';
  drawHighlights(r);
}
export function hideResult() { resultEl.style.display = 'none'; clearHighlights(); S.lastResult = null; }

export const hlGroup = new THREE.Group(); scene.add(hlGroup);
export function clearHighlights() { for (const c of [...hlGroup.children]) { hlGroup.remove(c); disposeTree(c); } }
export const COL = { pass: 0x3ddc84, warn: 0xffb020, fail: 0xff4d4f };
export function drawHighlights(r) {
  clearHighlights();
  const y = 2.4;
  if (r.kind === 'park') {
    const h = r.hl;
    h.bay.edges.forEach(e => hlGroup.add(overlayMesh(stripGeom(e.a, e.b, 0.07, 0.03), overlayMat(r.pass ? COL.pass : 0xffffff, r.pass ? 0.8 : 0.35), 15)));
    for (const e of h.edges) hlGroup.add(overlayMesh(stripGeom(e.a, e.b, 0.14, 0.04), overlayMat(COL.fail, 0.9), 16));
    for (const t of h.tyres) hlGroup.add(overlayMesh(polyGeom(t.poly, y), overlayMat(COL[t.status], 0.95), 30));
    const dot = new THREE.CircleGeometry(0.1, 16); dot.rotateX(-Math.PI / 2);
    for (const p of h.points) { const m = overlayMesh(dot.clone(), overlayMat(COL.fail, 1), 31); m.position.set(p[0], y, p[1]); hlGroup.add(m); }
    if (h.angle) {
      const c = [r.pose.x, r.pose.z], a = h.bay.axisAngle, L = 3.2;
      hlGroup.add(overlayMesh(stripGeom([c[0] - Math.cos(a) * L, c[1] - Math.sin(a) * L], [c[0] + Math.cos(a) * L, c[1] + Math.sin(a) * L], 0.06, y), overlayMat(0xffffff, 0.9), 32));
      hlGroup.add(overlayMesh(stripGeom([c[0] - Math.cos(r.pose.h) * L, c[1] - Math.sin(r.pose.h) * L], [c[0] + Math.cos(r.pose.h) * L, c[1] + Math.sin(r.pose.h) * L], 0.06, y), overlayMat(COL.fail, 0.95), 33));
    }
    if (h.door && h.door.status !== 'pass') hlGroup.add(overlayMesh(stripGeom(h.door.from, h.door.to, 0.08, y), overlayMat(COL.warn, 0.95), 34));
  }
  if (S.attempt) for (const p of S.attempt.contactPts) hlGroup.add(contactRing(p, 0.9));
}
export function contactRing(p, opacity) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 24), new THREE.MeshBasicMaterial({ color: COL.fail, transparent: true, opacity, depthTest: false, side: THREE.DoubleSide }));
  m.geometry.rotateX(-Math.PI / 2); m.position.set(p[0], 2.5, p[1]); m.renderOrder = 40; m.layers.set(4); m.layers.enable(0); return m;
}
export const flashes = [];
export function flashContact(p) {
  const m = contactRing(p, 1); scene.add(m); flashes.push({ m, t: 0 });
  const t = document.getElementById('toast'); t.style.opacity = 1; clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = 0, 900);
}
