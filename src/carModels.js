// Exterior car meshes and the top-down overlay (wheels, reference markers).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MARKER_COLORS, TYRE_R, TYRE_W } from './config.js';
import { clamp, roundedRect } from './geometry.js';
import { ARCH_GEOM, HUB_GEOM, MAT, RIM_GEOM, WHEEL_GEOM, overlayMat, overlayMesh, paintMat } from './scene.js';

// ===================================================================
// Car meshes
// ===================================================================
// Body styles: where the cabin ends at the back, how raked the rear glass is, how much the
// greenhouse tapers, and how far the bonnet / tail slope down.
export const CAR_STYLES = {
  hatch: { rear: 0.25, rakeR: 0.32, topK: 0.82, dropF: 0.13, dropR: 0.04, doors: 2 },
  sedan: { rear: 0.95, rakeR: 0.5, topK: 0.82, dropF: 0.11, dropR: 0.05, doors: 4 },
  suv:   { rear: 0.2, rakeR: 0.16, topK: 0.88, dropF: 0.09, dropR: 0.02, doors: 4 },
  van:   { rear: 0.06, rakeR: 0.03, topK: 0.94, dropF: 0.16, dropR: 0, doors: 2, cabForward: 0.35, panelVan: true },
};
export function quadGeom(pts) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); return g;
}
export function boxAt(sx, sy, sz, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); return m; }

export function makeCarMesh(g, color, learner) {
  const st = CAR_STYLES[g.style] || CAR_STYLES.hatch;
  const grp = new THREE.Group(), paint = paintMat(color);
  const add = (m, layer = 1) => { m.castShadow = true; if (learner) m.traverse(o => o.layers.set(layer)); grp.add(m); return m; };
  const H = g.height, belt = g.beltY, L = g.length, W = g.width;

  // Lower body: bevelled extrusion of the plan outline, with the bonnet and tail sloping down.
  const bev = 0.06, sill = 0.24;
  const shape = new THREE.Shape(roundedRect(L - 2 * bev, W - 2 * bev, 0.28 - bev).map(([f, r]) => new THREE.Vector2(f, r)));
  let lg = new THREE.ExtrudeGeometry(shape, { depth: belt - sill - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 4 });
  lg.rotateX(Math.PI / 2); lg.translate(0, belt - bev, 0);
  const ws = g.frontAxleF - 0.3 + (st.cabForward || 0), tailX = -L / 2 + st.rear;
  const lp = lg.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i), y = lp.getY(i), t = clamp((y - (belt - 0.4)) / 0.4, 0, 1);
    const d = x > ws ? st.dropF * Math.pow((x - ws) / (L / 2 - ws), 1.5) : x < tailX ? st.dropR * (tailX - x) / st.rear : 0;
    lp.setY(i, y - d * t);
  }
  lg.deleteAttribute('uv'); lg.deleteAttribute('normal'); lg = mergeVertices(lg); lg.computeVertexNormals();
  add(new THREE.Mesh(lg, paint));

  // Greenhouse in body colour, with separate glass panels leaving pillars between them.
  const cf0 = tailX, cf1 = ws, cabH = H - belt, bw = (W - 0.12) / 2, tw = bw * st.topK;
  const rakeF = Math.min(0.75, (cf1 - cf0) * 0.3) * (st.panelVan ? 0.7 : 1), rakeR = st.rakeR;
  const cg = new THREE.BoxGeometry(cf1 - cf0, cabH, 2 * bw); cg.translate((cf0 + cf1) / 2, belt + cabH / 2, 0);
  const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) if (cp.getY(i) > belt + cabH / 2) { const x = cp.getX(i); cp.setX(i, x > (cf0 + cf1) / 2 ? x - rakeF : x + rakeR); cp.setZ(i, cp.getZ(i) * st.topK); }
  cg.computeVertexNormals();
  add(new THREE.Mesh(cg, paint));
  const yA = belt + 0.05, yB = H - 0.05, o = 0.006;
  const hw = y => bw + (tw - bw) * (y - belt) / cabH;
  const xF = y => cf1 - rakeF * (y - belt) / cabH, xR = y => cf0 + rakeR * (y - belt) / cabH;
  const glass = pts => add(new THREE.Mesh(quadGeom(pts), MAT.glass));
  const nF = [cabH, rakeF].map(v => v / Math.hypot(cabH, rakeF) * o), nR = [-cabH, rakeR].map(v => v / Math.hypot(cabH, rakeR) * o);
  glass([[xF(yA) + nF[0], yA + nF[1], -hw(yA) * 0.88], [xF(yA) + nF[0], yA + nF[1], hw(yA) * 0.88], [xF(yB) + nF[0], yB + nF[1], hw(yB) * 0.88], [xF(yB) + nF[0], yB + nF[1], -hw(yB) * 0.88]]);
  glass([[xR(yA) + nR[0], yA + nR[1], -hw(yA) * 0.8], [xR(yA) + nR[0], yA + nR[1], hw(yA) * 0.8], [xR(yB) + nR[0], yB + nR[1], hw(yB) * 0.8], [xR(yB) + nR[0], yB + nR[1], -hw(yB) * 0.8]]);  const bp = Math.max(g.eyeF - 0.45, cf0 + 0.6);   // B-pillar
  for (const s of [-1, 1]) {
    const side = (x0, x1) => { // x0/x1: functions of y giving the window's rear / front edge
      if (x1(yA) - x0(yA) < 0.12 || x1(yB) - x0(yB) < 0.12) return;
      glass([[x0(yA), yA, s * (hw(yA) + o)], [x1(yA), yA, s * (hw(yA) + o)], [x1(yB), yB, s * (hw(yB) + o)], [x0(yB), yB, s * (hw(yB) + o)]]);
    };
    side(() => bp + 0.06, y => xF(y) - 0.07);
    if (!st.panelVan) side(y => xR(y) + 0.07, () => bp - 0.06);
  }

  // Lights, grille, bumpers and UK plates (white front, yellow rear).
  const yNose = belt - st.dropF, yTail = belt - st.dropR;
  for (const s of [-1, 1]) {
    add(boxAt(0.18, 0.1, 0.38, L / 2 - 0.085, yNose - 0.03, s * (W / 2 - 0.3), MAT.head));
    add(boxAt(0.12, 0.12, 0.32, -L / 2 + 0.055, yTail - 0.05, s * (W / 2 - 0.24), MAT.tail));
  }
  add(boxAt(0.03, 0.09, W * 0.35, L / 2 + 0.002, yNose - 0.13, 0, MAT.black));
  add(boxAt(0.03, 0.08, W - 0.6, L / 2 + 0.002, 0.36, 0, MAT.black));
  add(boxAt(0.03, 0.06, W - 0.5, -L / 2 - 0.002, 0.34, 0, MAT.black));
  add(boxAt(0.01, 0.11, 0.52, L / 2 + 0.008, 0.48, 0, MAT.plateF));
  add(boxAt(0.01, 0.11, 0.52, -L / 2 - 0.008, Math.min(0.62, yTail - 0.2), 0, MAT.plateR));

  // Door shut lines and handles.
  const doorLines = [g.doorFront, g.doorRear]; if (st.doors === 4) doorLines.push(g.doorRear - 0.9);
  for (const s of [-1, 1]) {
    for (const f of doorLines) if (f > -L / 2 + 0.4) add(boxAt(0.012, belt - 0.36, 0.006, f, (belt + 0.32) / 2, s * (W / 2 + 0.001), MAT.black));
    add(boxAt(0.13, 0.03, 0.012, g.doorRear + 0.15, belt - 0.12, s * (W / 2 + 0.004), MAT.black));
  }

  // Wheels: tyre, rim and hub, pushed out flush with the body side, under a dark arch.
  const front = [];
  for (const w of g.wheels) {
    const s = Math.sign(w.r), wr = s * (W / 2 - TYRE_W / 2 + 0.01);
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(WHEEL_GEOM, MAT.tyre); tyre.castShadow = true;
    const rim = new THREE.Mesh(RIM_GEOM, MAT.rim); rim.position.z = s * (TYRE_W / 2 - 0.01);
    const hub = new THREE.Mesh(HUB_GEOM, MAT.black); hub.position.z = s * (TYRE_W / 2 + 0.002);
    wheel.add(tyre, rim, hub);
    if (learner) wheel.traverse(c => c.layers.set(1));
    if (w.front) { const piv = new THREE.Group(); piv.position.set(w.f, TYRE_R, wr); piv.add(wheel); grp.add(piv); front.push({ piv, r: w.r }); }
    else { wheel.position.set(w.f, TYRE_R, wr); grp.add(wheel); }
    const arch = new THREE.Mesh(ARCH_GEOM, MAT.arch); arch.position.set(w.f, TYRE_R, s * (W / 2 + 0.003)); if (s < 0) arch.rotation.y = Math.PI;
    add(arch);
  }
  const mw = g.mirrorWidth / 2 - (W / 2 - 0.04);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, mw), paint);
    m.position.set(g.mirrorF, belt + 0.09, s * (W / 2 - 0.04 + mw / 2)); if (learner) m.rotation.y = mirrorYaw(g, s); add(m, 3);
  }
  return { group: grp, front };
}
// Wing mirrors are angled halfway between facing straight back and facing the driver's eye.
export function mirrorYaw(g, s) {
  const mr = s * (g.mirrorWidth / 2 + g.width / 2 - 0.04) / 2;
  return Math.atan2(g.eyeR - mr, g.mirrorF - g.eyeF) / 2;
}

export function markerDefs(g) {
  const L = g.length, W = g.width, out = [];
  for (const s of [-1, 1]) {
    out.push({ type: 'mirrors', f: g.mirrorF, r: s * g.mirrorWidth / 2, s });
    out.push({ type: 'shoulder', f: g.eyeF - 0.25, r: s * W / 2, s });
    out.push({ type: 'axle', f: g.rearAxleF, r: s * W / 2, s });
    out.push({ type: 'bumpers', f: L / 2 - 0.09, r: s * (W / 2 - 0.09), s });
    out.push({ type: 'bumpers', f: -L / 2 + 0.09, r: s * (W / 2 - 0.09), s });
  }
  return out;
}
export const GUIDE_LEN = 4.5;
export function makeOverlay(g) {
  const grp = new THREE.Group(), y = g.height + 0.2;
  const wg = new THREE.PlaneGeometry(2 * TYRE_R, TYRE_W); wg.rotateX(-Math.PI / 2);
  const wo = new THREE.PlaneGeometry(2 * TYRE_R + 0.06, TYRE_W + 0.06); wo.rotateX(-Math.PI / 2);
  const front = [];
  for (const w of g.wheels) {
    const holder = new THREE.Group(); holder.position.set(w.f, y, w.r);
    holder.add(overlayMesh(wo, overlayMat(w.front ? 0xffffff : 0xb8c0c8, 0.9), 11));
    holder.add(overlayMesh(wg, overlayMat(0x111111, 0.95), 12));
    grp.add(holder); if (w.front) front.push({ piv: holder, r: w.r });
  }
  const markers = [];
  const dg = new THREE.CircleGeometry(0.09, 20); dg.rotateX(-Math.PI / 2);
  const lgeo = new THREE.PlaneGeometry(0.035, GUIDE_LEN); lgeo.rotateX(-Math.PI / 2);
  for (const d of markerDefs(g)) {
    const col = MARKER_COLORS[d.type];
    const disc = overlayMesh(dg, overlayMat(col, 1), 14); disc.position.set(d.f, y + 0.01, d.r);
    const gm = overlayMat(col, 0.28); const guide = overlayMesh(lgeo, gm, 13); guide.position.set(d.f, y, d.r + d.s * GUIDE_LEN / 2);
    grp.add(disc, guide); markers.push({ ...d, disc, guide, mat: gm, discMat: disc.material, col });
  }
  return { group: grp, front, markers };
}
