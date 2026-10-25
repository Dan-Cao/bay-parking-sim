// Pure 2D geometry: helpers, car dimensions, the bicycle model, and bay layout.
import { PARKED_TYPES, TYRE_R, TYRE_W } from './config.js';

// ===================================================================
// 2D geometry helpers (world plane is x/z; car-local is f = forward, r = right)
// ===================================================================
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
export const wrapPi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
export const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
export const clone = o => JSON.parse(JSON.stringify(o));

export function toWorld(p, f, r) { const c = Math.cos(p.h), s = Math.sin(p.h); return [p.x + f * c - r * s, p.z + f * s + r * c]; }
export function toLocal(p, x, z) { const c = Math.cos(p.h), s = Math.sin(p.h), dx = x - p.x, dz = z - p.z; return [dx * c + dz * s, -dx * s + dz * c]; }
export function roundedRect(len, wid, rr, seg = 4) {
  const pts = [], hx = len / 2 - rr, hy = wid / 2 - rr;
  const corners = [[hx, hy, 0], [-hx, hy, Math.PI / 2], [-hx, -hy, Math.PI], [hx, -hy, 1.5 * Math.PI]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= seg; i++) { const a = a0 + i * (Math.PI / 2) / seg; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  return pts;
}
export const rectPts = (f0, f1, r0, r1) => [[f0, r0], [f1, r0], [f1, r1], [f0, r1]];
export const polyWorld = (pose, pts) => pts.map(([f, r]) => toWorld(pose, f, r));
export function rectWorld(x0, x1, z0, z1) { return [[Math.min(x0, x1), Math.min(z0, z1)], [Math.max(x0, x1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(z0, z1)], [Math.min(x0, x1), Math.max(z0, z1)]]; }

export function project(poly, ax, ay) { let mn = Infinity, mx = -Infinity; for (const p of poly) { const d = p[0] * ax + p[1] * ay; if (d < mn) mn = d; if (d > mx) mx = d; } return [mn, mx]; }
export function polysOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      let ax = -(q[1] - p[1]), ay = q[0] - p[0]; const l = Math.hypot(ax, ay); if (l < 1e-9) continue; ax /= l; ay /= l;
      const A = project(a, ax, ay), B = project(b, ax, ay);
      if (A[1] <= B[0] + 1e-6 || B[1] <= A[0] + 1e-6) return false;
    }
  }
  return true;
}
export function pointInPoly(pt, poly) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const c = (q[0] - p[0]) * (pt[1] - p[1]) - (q[1] - p[1]) * (pt[0] - p[0]);
    if (Math.abs(c) < 1e-12) continue;
    const s = c > 0 ? 1 : -1; if (!sign) sign = s; else if (s !== sign) return false;
  }
  return true;
}
export function segPointDist(p, a, b) {
  const ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez;
  const t = l2 < 1e-12 ? 0 : clamp(((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / l2, 0, 1);
  return Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ez);
}
export function segsIntersect(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
export function segSegDist(a, b, c, d) { if (segsIntersect(a, b, c, d)) return 0; return Math.min(segPointDist(a, c, d), segPointDist(b, c, d), segPointDist(c, a, b), segPointDist(d, a, b)); }
export function pointPolyDist(p, poly) { if (pointInPoly(p, poly)) return 0; let m = Infinity; for (let i = 0; i < poly.length; i++) m = Math.min(m, segPointDist(p, poly[i], poly[(i + 1) % poly.length])); return m; }
export function raySegDist(o, dir, a, b) {
  const ex = b[0] - a[0], ez = b[1] - a[1], den = dir[0] * ez - dir[1] * ex;
  if (Math.abs(den) < 1e-12) return Infinity;
  const wx = a[0] - o[0], wz = a[1] - o[1];
  const t = (wx * ez - wz * ex) / den, u = (wx * dir[1] - wz * dir[0]) / den;
  return (t >= 0 && u >= 0 && u <= 1) ? t : Infinity;
}

// ===================================================================
// Car geometry (all local coords relative to body centre)
// ===================================================================
export function deriveCar(s) {
  const g = { ...s };
  g.rearOverhang = s.length - s.wheelbase - s.frontOverhang;
  g.rearAxleF = -s.length / 2 + g.rearOverhang;
  g.frontAxleF = g.rearAxleF + s.wheelbase;
  g.beltY = s.height * 0.6;
  g.mirrorF = g.frontAxleF - 0.7;
  g.eyeF = g.frontAxleF - 1.3;
  g.eyeR = s.width * 0.215;                       // right-hand drive
  g.eyeY = Math.min(s.height - 0.3, 1.1 + (s.height - 1.446) * 0.8);
  g.doorFront = g.frontAxleF - 0.45;
  g.doorRear = g.doorFront - (s.doorLength || 1.1);
  g.body = roundedRect(s.length, s.width, 0.28);
  const mo = s.mirrorWidth / 2, wi = s.width / 2 - 0.04;
  g.mirrors = [rectPts(g.mirrorF - 0.1, g.mirrorF + 0.1, wi, mo), rectPts(g.mirrorF - 0.1, g.mirrorF + 0.1, -mo, -wi)];
  const t = s.track / 2;
  g.wheels = [{ f: g.rearAxleF, r: -t }, { f: g.rearAxleF, r: t }, { f: g.frontAxleF, r: -t, front: true }, { f: g.frontAxleF, r: t, front: true }];
  g.tyres = g.wheels.map(w => rectPts(w.f - TYRE_R, w.f + TYRE_R, w.r - TYRE_W / 2, w.r + TYRE_W / 2));
  if (s.turningCircle) {
    const R = s.turningCircle / 2, ro = t + TYRE_W / 2;
    const rr = Math.sqrt(Math.max(0.01, R * R - s.wheelbase ** 2)) - ro;
    g.deltaMax = Math.atan(s.wheelbase / Math.max(0.5, rr));
    g.halfTurns = (s.lockToLock || 3) / 2;
  }
  return g;
}
export const PG = Object.fromEntries(Object.entries(PARKED_TYPES).map(([k, v]) => [k, deriveCar(v)]));

export function carShapes(g, pose) {
  return { body: polyWorld(pose, g.body), mirrors: g.mirrors.map(m => polyWorld(pose, m)), tyres: g.tyres.map(t => polyWorld(pose, t)) };
}
// Kinematic bicycle model about the rear axle. Positive delta = steer right.
export function stepCar(g, pose, dist, delta) {
  const rf = g.rearAxleF;
  let [rx, rz] = toWorld(pose, rf, 0), h = pose.h;
  const k = Math.tan(delta) / g.wheelbase, dh = dist * k;
  if (Math.abs(k) > 1e-7) { rx += (Math.sin(h + dh) - Math.sin(h)) / k; rz += (Math.cos(h) - Math.cos(h + dh)) / k; }
  else { rx += dist * Math.cos(h); rz += dist * Math.sin(h); }
  h += dh;
  return { x: rx - rf * Math.cos(h), z: rz - rf * Math.sin(h), h };
}
export function ackermann(g, delta) {
  if (Math.abs(delta) < 1e-5) return { left: 0, right: 0 };
  const R = g.wheelbase / Math.tan(delta), t = g.track / 2;
  return { right: Math.atan(g.wheelbase / (R - t)), left: Math.atan(g.wheelbase / (R + t)) };
}

// ===================================================================
// Layout: bays, structures
// ===================================================================
export function buildBays(L) {
  // Angled bays are parallelograms whose side lines are long enough to hold a full bayWidth x bayLength rectangle.
  const a = rad(L.angle), spacing = L.bayWidth / Math.sin(a), sideLen = L.bayLength + L.bayWidth / Math.tan(a), out = [];
  for (const side of (L.rows === 2 ? [1, -1] : [1])) {
    const z0 = side * L.aisleWidth / 2, ax = [Math.cos(a), side * Math.sin(a)];
    const x0 = -L.baysPerRow * spacing / 2 - sideLen * ax[0] / 2;
    for (let i = 0; i < L.baysPerRow; i++) {
      const p0 = [x0 + i * spacing, z0], p1 = [x0 + (i + 1) * spacing, z0];
      const p2 = [p1[0] + sideLen * ax[0], p1[1] + sideLen * ax[1]], p3 = [p0[0] + sideLen * ax[0], p0[1] + sideLen * ax[1]];
      const poly = [p0, p1, p2, p3], c = [(p0[0] + p1[0] + p2[0] + p3[0]) / 4, (p0[1] + p1[1] + p2[1] + p3[1]) / 4];
      const edges = [{ a: p0, b: p1, type: 'front' }, { a: p1, b: p2, type: 'side' }, { a: p2, b: p3, type: 'back' }, { a: p3, b: p0, type: 'side' }];
      for (const e of edges) {
        let nx = -(e.b[1] - e.a[1]), nz = e.b[0] - e.a[0]; const l = Math.hypot(nx, nz); nx /= l; nz /= l;
        if ((c[0] - e.a[0]) * nx + (c[1] - e.a[1]) * nz < 0) { nx = -nx; nz = -nz; }
        e.n = [nx, nz];
      }
      out.push({ row: side, idx: i, poly, centre: c, axis: ax, axisAngle: Math.atan2(ax[1], ax[0]), edges });
    }
  }
  return out;
}
export const edgeDist = (e, p) => (p[0] - e.a[0]) * e.n[0] + (p[1] - e.a[1]) * e.n[1];

export function buildStructures(L, bays) {
  const out = [];
  for (const side of (L.rows === 2 ? [1, -1] : [1])) {
    const row = bays.filter(b => b.row === side);
    const first = row[0], last = row[row.length - 1], zb = first.poly[3][1];
    const xa = Math.min(first.poly[3][0], first.poly[0][0]), xb = Math.max(last.poly[2][0], last.poly[1][0]);
    if (L.back === 'kerb') out.push({ kind: 'kerb', poly: rectWorld(xa, xb, zb + side * 0.08, zb + side * 0.38), height: 0.13 });
    if (L.back === 'wall') out.push({ kind: 'wall', poly: rectWorld(xa - 0.5, xb + 0.5, zb + side * 0.3, zb + side * 0.55), height: 2.4 });
    if (L.pillars) for (let i = 2; i < row.length - 1; i += 3) {
      const b = row[i + 1];
      const p = [b.poly[3][0] - b.axis[0] * 0.35, b.poly[3][1] - b.axis[1] * 0.35];
      out.push({ kind: 'pillar', poly: polyWorld({ x: p[0], z: p[1], h: b.axisAngle }, rectPts(-0.225, 0.225, -0.225, 0.225)), height: 2.6 });
    }
  }
  return out;
}
export function objectPoly(o) { return polyWorld(o, rectPts(-o.len / 2, o.len / 2, -o.wid / 2, o.wid / 2)); }

export function poseInBay(b, forward, lat = 0, ax = 0, rotDeg = 0) {
  const l = [-b.axis[1], b.axis[0]];
  return { x: b.centre[0] + l[0] * lat + b.axis[0] * ax, z: b.centre[1] + l[1] * lat + b.axis[1] * ax, h: wrapPi(b.axisAngle + (forward ? 0 : Math.PI) + rad(rotDeg)) };
}
export function overlapFrac(g, pose, bay) {
  let n = 0, inside = 0;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) {
    const f = -g.length / 2 + 0.1 + (g.length - 0.2) * i / 8, r = -g.width / 2 + 0.1 + (g.width - 0.2) * j / 3;
    n++; if (pointInPoly(toWorld(pose, f, r), bay.poly)) inside++;
  }
  return inside / n;
}
