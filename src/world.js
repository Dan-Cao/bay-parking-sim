// The learner car, the static scene (bays, structures, parked cars, exit marker) and scenario loading.
import * as THREE from 'three';
import { EXIT_RADIUS, LEARNER_COLOR, LINE_W, PALETTE, PRESETS } from './config.js';
import { PG, buildBays, buildStructures, carShapes, clone, objectPoly, poseInBay, rectPts } from './geometry.js';
import { S } from './state.js';
import { MAT, canvasTex, disposeTree, prism, scene, stripGeom, sun } from './scene.js';
import { makeCarMesh, makeOverlay } from './carModels.js';
import { makeInterior } from './interior.js';
import { newAttempt } from './checker.js';
import { select } from './input.js';

// learner objects
export const learnerRoot = new THREE.Group(); scene.add(learnerRoot);
export function buildLearner() {
  if (S.learnerParts) learnerRoot.remove(S.learnerParts.ext.group, S.learnerParts.int.group, S.learnerParts.ov.group);
  const ext = makeCarMesh(S.LG, LEARNER_COLOR, true), int = makeInterior(S.LG, LEARNER_COLOR), ov = makeOverlay(S.LG);
  learnerRoot.add(ext.group, int.group, ov.group);
  S.learnerParts = { ext, int, ov };
}

// ===================================================================
// Static scene (bays, structures, parked cars, objects, exit marker)
// ===================================================================
export const staticGroup = new THREE.Group(); scene.add(staticGroup);
export const carMeshes = new Map(), objMeshes = new Map();
export const exitTex = canvasTex(256, 96, (ctx, w, h) => { ctx.fillStyle = '#4cc3ff'; ctx.font = 'bold 72px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('EXIT', w / 2, h / 2 + 4); });


export function rebuildStatic() {
  for (const c of [...staticGroup.children]) { staticGroup.remove(c); disposeTree(c); }
  carMeshes.clear(); objMeshes.clear();
  S.bays = buildBays(S.state.layout);
  S.structures = buildStructures(S.state.layout, S.bays);
  // bay lines (deduplicated)
  const seen = new Set(); S.bayLines = [];
  for (const b of S.bays) for (const e of b.edges) {
    const k = [e.a, e.b].map(p => p.map(v => v.toFixed(2)).join(',')).sort().join('|');
    if (seen.has(k)) continue; seen.add(k); S.bayLines.push([e.a, e.b]);
    const m = new THREE.Mesh(stripGeom(e.a, e.b, LINE_W, 0.004), MAT.line); m.receiveShadow = false; staticGroup.add(m);
  }
  for (const s of S.structures) staticGroup.add(prism(s.poly, 0, s.height, MAT[s.kind]));
  for (const c of S.state.cars) {
    const mesh = makeCarMesh(PG[c.type], c.color, false).group;
    mesh.position.set(c.x, 0, c.z); mesh.rotation.y = -c.h; staticGroup.add(mesh); carMeshes.set(c.id, mesh);
  }
  for (const o of S.state.objects) {
    const m = prism(rectPts(-o.len / 2, o.len / 2, -o.wid / 2, o.wid / 2), 0, o.kind === 'wall' ? 2.4 : 2.6, MAT[o.kind]);
    const holder = new THREE.Group(); holder.add(m); holder.position.set(o.x, 0, o.z); holder.rotation.y = -o.h; staticGroup.add(holder); objMeshes.set(o.id, holder);
  }
  S.exitMesh = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(EXIT_RADIUS - 0.12, EXIT_RADIUS, 48), new THREE.MeshBasicMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }));
  ring.geometry.rotateX(-Math.PI / 2); ring.position.y = 0.01;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: exitTex, transparent: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }));
  label.geometry.rotateX(-Math.PI / 2); label.position.y = 0.012;
  S.exitMesh.add(ring, label); S.exitMesh.position.set(S.state.exit.x, 0, S.state.exit.z);
  staticGroup.add(S.exitMesh);
  buildObstacles();
  updateSun();
}

export function buildObstacles() {
  S.obstacles = [];
  for (const c of S.state.cars) { const sh = carShapes(PG[c.type], c); S.obstacles.push({ kind: 'car', polys: [sh.body, ...sh.mirrors] }); }
  for (const s of S.structures) S.obstacles.push({ kind: s.kind, polys: [s.poly] });
  for (const o of S.state.objects) S.obstacles.push({ kind: o.kind, polys: [objectPoly(o)] });
  // sample points for the parking sensors
  for (const ob of S.obstacles) {
    ob.samples = [];
    if (ob.kind === 'kerb') continue;
    for (const poly of ob.polys) for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.08));
      for (let j = 0; j < n; j++) ob.samples.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
    }
  }
}

export function areaExtents() {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const b of S.bays) for (const p of b.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  // Framed from the layout only, so the view never shifts while cars are dragged or driven.
  const a = S.state.layout.aisleWidth / 2;
  z0 = Math.min(z0, -a - 2); z1 = Math.max(z1, a + 2);
  return { x0: x0 - 10, x1: x1 + 9, z0: z0 - 1, z1: z1 + 1 };
}
export function updateSun() {
  const e = areaExtents(), cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2;
  sun.position.set(cx + 14, 40, cz + 10); sun.target.position.set(cx, 0, cz);
  const r = Math.max(e.x1 - e.x0, e.z1 - e.z0) / 2 + 8;
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r }); sun.shadow.camera.updateProjectionMatrix();
}

// ===================================================================
// Scenario loading / undo
// ===================================================================
export function rowExtents(bs) { let x0 = Infinity, x1 = -Infinity; for (const b of bs) for (const p of b.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); } return { x0, x1 }; }
export function loadPreset(id) {
  const p = PRESETS[id]; S.currentPreset = id;
  S.state = { layout: { ...p.layout }, cars: [], objects: [], learner: null, exit: null };
  const bs = buildBays(S.state.layout);
  p.cars.forEach((c, i) => {
    const b = bs.find(b => b.row === c.row && b.idx === c.idx); if (!b) return;
    const forward = !!c.flip, free = c.lat || c.rot;
    S.state.cars.push({ id: S.nextId++, type: c.type, color: PALETTE[(i * 3 + c.idx) % PALETTE.length], ...poseInBay(b, forward, c.lat || 0, 0, c.rot || 0), bay: free ? null : { row: b.row, idx: b.idx, forward } });
  });
  const ex = rowExtents(bs), lane = -S.state.layout.aisleWidth / 4;
  S.state.learner = { x: ex.x0 - 6, z: lane, h: 0 };
  S.state.exit = { x: ex.x1 + 5, z: lane };
  S.undoStack = []; S.steer = 0; S.gear = 'F';
  rebuildStatic(); S.attemptStart = clone(S.state); newAttempt();
  S.zoomFixed = 1;
}
export function pushUndo() { S.undoStack.push(JSON.stringify(S.state)); if (S.undoStack.length > 150) S.undoStack.shift(); }
export function undo() { if (!S.undoStack.length) return; S.state = JSON.parse(S.undoStack.pop()); rebuildStatic(); select(null); }
export function resnapToBays() {
  const bs = buildBays(S.state.layout);
  for (const c of S.state.cars) if (c.bay) {
    const b = bs.find(b => b.row === c.bay.row && b.idx === c.bay.idx);
    if (b) Object.assign(c, poseInBay(b, c.bay.forward)); else c.bay = null;
  }
}
