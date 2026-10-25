// First-person interior: dashboard, instrument cluster, seats, steering wheel, mirrors.
import * as THREE from 'three';
import { MAT, paintMat, rts } from './scene.js';
import { CAR_STYLES, mirrorYaw } from './carModels.js';

// Instrument cluster: two dials with the current gear / direction between them.
export function drawCluster(ctx, w, h, gearText) {
  ctx.fillStyle = '#0b0c0e'; ctx.fillRect(0, 0, w, h);
  for (const cx of [w * 0.22, w * 0.78]) {
    ctx.strokeStyle = '#d8dde3'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, h / 2, h * 0.4, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + i / 10 * Math.PI * 1.5, r0 = h * 0.3, r1 = h * 0.38;
      ctx.lineWidth = 4; ctx.strokeStyle = i > 7 && cx > w / 2 ? '#ff4d4f' : '#d8dde3';
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, h / 2); ctx.lineTo(cx + Math.cos(Math.PI * 0.85) * h * 0.33, h / 2 + Math.sin(Math.PI * 0.85) * h * 0.33); ctx.stroke();
  }
  ctx.fillStyle = gearText === 'R' ? '#ff4d4f' : '#f2f4f7'; ctx.font = `bold ${Math.round(h * 0.55)}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(gearText, w / 2, h / 2 + 4);
}

export function makeInterior(g, color) {
  const grp = new THREE.Group(), paint = paintMat(color);
  const st = CAR_STYLES[g.style] || CAR_STYLES.hatch;
  const e = g.eyeF, W = g.width, H = g.height, belt = g.beltY, L = g.length, dr = g.eyeR;
  const box = (f0, f1, y0, y1, r0, r1, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(f1 - f0), Math.abs(y1 - y0), Math.abs(r1 - r0)), mat); m.position.set((f0 + f1) / 2, (y0 + y1) / 2, (r0 + r1) / 2); grp.add(m); return m; };
  const beam = (p, q, tx, ty, mat) => {
    const a = new THREE.Vector3(...p), b = new THREE.Vector3(...q), d = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.BoxGeometry(tx, ty, d.length()), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); grp.add(m); return m;
  };
  // a plane facing the driver (normal towards -f), tilted back by `tilt`
  const facePlane = (w, h, f, y, r, mat, tilt = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(f, y, r);
    m.rotation.order = 'YXZ'; m.rotation.y = -Math.PI / 2; m.rotation.x = -tilt; grp.add(m); return m;
  };
  const ws = g.frontAxleF - 0.3 + (st.cabForward || 0), roofF = ws - Math.min(0.75, (ws + L / 2 - 0.28) * 0.3), roofR = -L / 2 + 0.7;
  const dashF = e + 0.62;

  // Bonnet, sloping down to the nose like the outside of the car.
  const nose = g.body.filter(([f]) => f > ws);
  const outline = [[ws, -W / 2 + 0.06], ...nose.filter(p => p[1] < 0), ...nose.filter(p => p[1] >= 0), [ws, W / 2 - 0.06]].map(([f, r]) => new THREE.Vector2(f, r * 0.96));
  const bg = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: 0.04, bevelEnabled: false });
  bg.rotateX(Math.PI / 2); bg.translate(0, belt, 0);
  const bpos = bg.attributes.position;
  for (let i = 0; i < bpos.count; i++) { const x = bpos.getX(i); bpos.setY(i, bpos.getY(i) - st.dropF * Math.pow(Math.max(0, x - ws) / (L / 2 - ws), 1.5)); }
  bg.computeVertexNormals(); grp.add(new THREE.Mesh(bg, paint));

  // Dashboard: side profile extruded across the car, a cowl over the instruments, vents and glovebox.
  const prof = new THREE.Shape([[dashF, belt - 0.32], [dashF, belt - 0.07], [dashF + 0.1, belt - 0.005], [ws + 0.05, belt - 0.005], [ws + 0.05, belt - 0.32]].map(([x, y]) => new THREE.Vector2(x, y)));
  const dg = new THREE.ExtrudeGeometry(prof, { depth: W - 0.16, bevelEnabled: false }); dg.translate(0, 0, -(W - 0.16) / 2);
  grp.add(new THREE.Mesh(dg, MAT.dash));
  box(dashF + 0.1, ws + 0.05, belt - 0.005, belt + 0.005, -W / 2 + 0.08, W / 2 - 0.08, MAT.dashTop);
  box(dashF + 0.02, dashF + 0.2, belt - 0.01, belt + 0.07, dr - 0.21, dr + 0.21, MAT.dashTop);                 // instrument cowl
  const clusterCanvas = document.createElement('canvas'); clusterCanvas.width = 512; clusterCanvas.height = 160;
  const clusterTex = new THREE.CanvasTexture(clusterCanvas); clusterTex.colorSpace = THREE.SRGBColorSpace;
  facePlane(0.36, 0.11, dashF - 0.005, belt - 0.03, dr, new THREE.MeshBasicMaterial({ map: clusterTex }), 0.25);
  for (const r of [-W / 2 + 0.2, -0.12, 0.12, W / 2 - 0.2]) facePlane(0.14, 0.06, dashF - 0.002, belt - 0.12, r, MAT.black);   // air vents
  facePlane(0.4, 0.004, dashF - 0.003, belt - 0.2, -dr, MAT.black); facePlane(0.4, 0.004, dashF - 0.003, belt - 0.29, -dr, MAT.black); // glovebox lid
  // centre stack with a screen showing the rear camera
  box(dashF - 0.06, dashF + 0.02, belt - 0.32, belt - 0.03, -0.14, 0.14, MAT.dashTop);
  facePlane(0.22, 0.13, dashF - 0.062, belt - 0.11, 0, new THREE.MeshBasicMaterial({ map: rts.cam.texture }), 0.1);
  facePlane(0.2, 0.03, dashF - 0.062, belt - 0.24, 0, MAT.metal);

  // Centre console, gear lever and handbrake.
  box(e - 0.25, dashF - 0.05, 0.28, 0.48, -0.11, 0.11, MAT.dash);
  beam([e + 0.32, 0.48, 0], [e + 0.28, 0.66, 0], 0.025, 0.025, MAT.metal);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), MAT.black); knob.position.set(e + 0.28, 0.68, 0); grp.add(knob);
  beam([e - 0.05, 0.5, 0], [e + 0.15, 0.56, 0], 0.035, 0.03, MAT.black);

  // Carpeted floor, front bulkhead behind the footwells, raised sills and pedals.
  box(-L / 2 + 0.12, ws + 0.05, 0.22, 0.26, -W / 2 + 0.04, W / 2 - 0.04, MAT.carpet);
  // boot: back panel up to the parcel shelf and side panels, so you can't see the road through the back
  box(-L / 2 + 0.12, -L / 2 + 0.2, 0.22, belt, -W / 2 + 0.04, W / 2 - 0.04, MAT.door);
  for (const s of [-1, 1]) box(-L / 2 + 0.12, -L / 2 + 0.32, 0.22, belt + 0.02, s * (W / 2 - 0.1), s * (W / 2 - 0.02), MAT.door);
  box(ws, ws + 0.05, 0.26, belt - 0.32, -W / 2 + 0.08, W / 2 - 0.08, MAT.carpet);
  for (const s of [-1, 1]) box(-L / 2 + 0.3, ws, 0.26, 0.34, s * (W / 2 - 0.1), s * (W / 2 - 0.02), MAT.door);
  for (const [r, w] of [[dr - 0.16, 0.08], [dr - 0.02, 0.09], [dr + 0.12, 0.07]]) beam([ws - 0.12, 0.3, r], [ws - 0.08, 0.42, r], w, 0.02, MAT.metal);

  // Seats: driver, passenger and rear bench.
  const seat = (fBack, r, wide) => {
    box(fBack, fBack + 0.5, 0.3, 0.44, r - wide / 2, r + wide / 2, MAT.seat);
    beam([fBack + 0.06, 0.44, r], [fBack - 0.08, 1.0, r], wide * 0.95, 0.13, MAT.seat);
    box(fBack - 0.13, fBack - 0.02, 1.02, 1.2, r - 0.12, r + 0.12, MAT.seat);
  };
  seat(e - 0.2, dr, 0.5); seat(e - 0.2, -dr, 0.5);
  if (L > 3.5) seat(-L / 2 + 0.75, 0, W - 0.35);

  // Roof, pillars and parcel shelf.
  box(roofR, roofF, H - 0.06, H - 0.01, -(W / 2 - 0.18), W / 2 - 0.18, MAT.headliner);
  box(-L / 2 + 0.2, -L / 2 + 0.75, belt - 0.25, belt, -W / 2 + 0.1, W / 2 - 0.1, MAT.dashTop);
  for (const s of [-1, 1]) {
    beam([ws, belt + 0.04, s * (W / 2 - 0.07)], [roofF, H - 0.04, s * (W / 2 - 0.2)], 0.065, 0.065, MAT.trim);       // A pillar
    beam([e - 0.45, belt, s * (W / 2 - 0.06)], [e - 0.45, H - 0.04, s * (W / 2 - 0.2)], 0.14, 0.06, MAT.trim);      // B pillar
    beam([roofR + 0.1, H - 0.04, s * (W / 2 - 0.22)], [-L / 2 + 0.28, belt + 0.02, s * (W / 2 - 0.1)], 0.1, 0.1, MAT.trim); // C pillar
    beam([roofR + 0.55, H - 0.04, s * (W / 2 - 0.22)], [-L / 2 + 0.7, belt + 0.02, s * (W / 2 - 0.1)], 0.1, 0.1, MAT.trim);
    box(roofR + 0.15, -L / 2 + 0.75, belt + 0.02, H - 0.08, s * (W / 2 - 0.15), s * (W / 2 - 0.1), MAT.trim);       // rear quarter panel
    // door card with sill trim, armrest and handle
    const inner = s * (W / 2 - 0.1);
    box(-L / 2 + 0.3, ws, 0.3, belt - 0.03, inner, s * (W / 2 - 0.02), MAT.door);
    box(-L / 2 + 0.3, ws, belt - 0.03, belt + 0.03, s * (W / 2 - 0.13), s * (W / 2 - 0.02), MAT.trim);
    box(e - 0.25, e + 0.3, belt - 0.26, belt - 0.2, inner, inner - s * 0.08, MAT.trim);
    box(e + 0.32, e + 0.44, belt - 0.12, belt - 0.09, inner, inner - s * 0.02, MAT.metal);
  }

  // Steering wheel: rim, three spokes, hub and a red top-centre marker.
  const sw = new THREE.Group(); sw.position.set(e + 0.58, g.eyeY - 0.4, dr);
  // face the driver, tilted back, with the wheel's "up" kept upright so the top marker sits at 12 o'clock when centred
  const swZ = new THREE.Vector3(-1, 0.5, 0).normalize(), swY = new THREE.Vector3(0, 1, 0).addScaledVector(swZ, -swZ.y).normalize();
  sw.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(swY, swZ), swY, swZ));
  const spin = new THREE.Group(); sw.add(spin);
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 10, 40), MAT.black));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.04, 20).rotateX(Math.PI / 2), MAT.dash); spin.add(hub);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), MAT.tail); badge.position.z = 0.021; spin.add(badge);
  for (const [x, y, w, h] of [[-0.11, 0, 0.12, 0.035], [0.11, 0, 0.12, 0.035], [0, -0.11, 0.035, 0.12]]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.018), MAT.dash); sp.position.set(x, y, 0); spin.add(sp);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.05), MAT.tail); top.position.y = 0.17; spin.add(top);
  beam([e + 0.6, g.eyeY - 0.41, dr], [dashF + 0.1, belt - 0.1, dr], 0.07, 0.07, MAT.dash);                       // column
  grp.add(sw);

  // Rear-view mirror on a stalk from the roof.
  const rvm = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.07), new THREE.MeshBasicMaterial({ map: rts.rv.texture }));
  const rvF = e + 0.68, rvY = Math.min(H - 0.12, g.eyeY + 0.1), rvYaw = Math.atan2(dr, rvF - e) / 2;
  rvm.geometry.rotateY(-Math.PI / 2); rvm.geometry.translate(-0.011, 0, 0); rvm.position.set(rvF, rvY, 0); rvm.rotation.y = rvYaw; grp.add(rvm);
  const rvf = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.085, 0.26), MAT.dash); rvf.position.set(rvF, rvY, 0); rvf.rotation.y = rvYaw; grp.add(rvf);
  beam([rvF + 0.02, rvY + 0.04, 0], [rvF + 0.06, H - 0.03, 0], 0.025, 0.025, MAT.dash);
  grp.traverse(o => o.layers.set(2));

  // wing-mirror glass (layer 3 so it shows from the driver's seat)
  for (const [s, k] of [[-1, 'left'], [1, 'right']]) {
    const mw = g.mirrorWidth / 2 - (W / 2 - 0.04);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(mw - 0.02, 0.11), new THREE.MeshBasicMaterial({ map: rts[k].texture }));
    m.geometry.rotateY(-Math.PI / 2); m.geometry.translate(-0.102, 0, 0); m.rotation.y = mirrorYaw(g, s);
    m.position.set(g.mirrorF, belt + 0.09, s * (W / 2 - 0.04 + mw / 2)); m.layers.set(3); grp.add(m);
  }
  let shownGear = null;
  const setGear = t => { if (t === shownGear) return; shownGear = t; drawCluster(clusterCanvas.getContext('2d'), 512, 160, t); clusterTex.needsUpdate = true; };
  return { group: grp, spin, setGear };
}
