// The ?test page: checker test scenes with expected vs actual results.
import { HALF_LINE, PALETTE, TYRE_W, UK_BAY, learnerSpec, settings } from './config.js';
import { buildBays, deg, poseInBay, stepCar, toWorld } from './geometry.js';
import { S } from './state.js';
import { rebuildStatic } from './world.js';
import { evaluatePark, learnerHits, newAttempt, showResult } from './checker.js';
import { stCar } from './modals.js';

// ===================================================================
// Test scenes (?test)
// ===================================================================
export let testCases = [], testSel = -1;
export function runTests() {
  const base = { rows: 1, baysPerRow: 8, angle: 90, ...UK_BAY, aisleWidth: 6, back: 'none', pillars: false };
  const g = S.LG, mh = g.mirrorWidth / 2, th = g.track / 2 + TYRE_W / 2, hb = UK_BAY.bayWidth / 2, endGap = UK_BAY.bayLength / 2 - g.length / 2;
  const P = { wheels: 'pass', body: 'pass', length: 'pass', angle: 'pass', contacts: 'pass', door: 'pass' };
  const C = [];
  const park = (name, opts, expect, extra = {}) => C.push({ name, kind: 'park', layout: { ...base, ...(extra.layout || {}) }, place: opts, expect: { ...P, ...expect }, cars: extra.cars || [], objects: extra.objects || [], note: extra.note });
  park('Centred, reversed in', {}, {});
  park('Centred, driven in forwards', { forward: true }, {});
  park('2° crooked', { rot: 2 }, {});
  park('4.5° crooked', { rot: 4.5 }, {});
  park('6° crooked', { rot: 6 }, { angle: 'fail' });
  park('Mirror on the paint (2 cm into line)', { lat: hb + 0.02 - mh }, {});
  park('Mirror 3 cm beyond the line', { lat: hb + HALF_LINE + 0.03 - mh }, { body: 'fail' });
  park('Tyre resting on the line', { lat: hb - th }, { wheels: 'warn', body: 'fail' }, { note: 'With mirrors counted, the mirror is always over before a tyre touches.' });
  park('Tyre across the line', { lat: hb - th + 0.15 }, { wheels: 'fail', body: 'fail' });
  park('Rear bumper on the back line', { ax: endGap + 0.03 }, {});
  park('Rear bumper 10 cm past back line', { ax: endGap + HALF_LINE + 0.10 }, { length: 'fail' });
  park('Nose 10 cm into the aisle', { ax: -(endGap + HALF_LINE + 0.10) }, { length: 'fail' });
  park('Wall 55 cm from driver’s door', {}, { door: 'warn' }, { objects: [{ dx: g.width / 2 + 0.55 + 0.1, len: 4, wid: 0.2 }] });
  park('Wall 65 cm from driver’s door', {}, {}, { objects: [{ dx: g.width / 2 + 0.65 + 0.1, len: 4, wid: 0.2 }] });
  park('Hatches centred either side', {}, { door: 'warn' }, { cars: [{ idx: 2, type: 'hatch' }, { idx: 4, type: 'hatch' }], note: 'Door room is measured to the neighbour’s mirror.' });
  park('60° bay, centred, forwards', { forward: true }, {}, { layout: { angle: 60 } });
  park('45° bay, 3° crooked, forwards', { forward: true, rot: 3 }, {}, { layout: { angle: 45 } });
  const PAR = { layout: { angle: 0, bayWidth: 2.1, bayLength: 6.0 } };
  park('Parallel bay, centred', {}, { kerb: 'pass' }, PAR);
  park('Parallel bay, 15 cm out from centre', { lat: -0.15 }, { kerb: 'warn', body: 'fail' }, { ...PAR, note: 'In a 2.1 m bay, sitting this far from the kerb puts the road-side mirror over the line.' });
  park('Parallel bay, 3° crooked', { rot: 3 }, { kerb: 'pass' }, PAR);
  park('Parallel bay, mirror over the kerb line', { lat: 1.05 + HALF_LINE + 0.03 - mh }, { kerb: 'pass' }, { ...PAR, note: 'Mirrors may overhang the pavement; only the body counts against the kerb line.' });
  C.push({ name: 'Rear bumper 5 cm from wall → no contact', kind: 'collide', gap: 0.05, expectHit: false });
  C.push({ name: 'Rear bumper 1 cm into wall → contact', kind: 'collide', gap: -0.01, expectHit: true });
  C.push({ name: 'Mirror 5 cm from pillar → no contact', kind: 'collideMirror', gap: 0.05, expectHit: false });
  C.push({ name: 'Mirror 1 cm into pillar → contact', kind: 'collideMirror', gap: -0.01, expectHit: true });
  C.push({ name: 'Turning circle at full lock', kind: 'turn' });
  testCases = C;
  for (const tc of C) runCase(tc, false);
  renderTests();
}
export function caseState(tc) {
  const st = { layout: { ...tc.layout }, cars: [], objects: [], learner: null, exit: { x: 30, z: -1.5 } };
  const bs = buildBays(st.layout), b = bs.find(b => b.row === 1 && b.idx === 3);
  st.learner = poseInBay(b, !!tc.place.forward, tc.place.lat || 0, tc.place.ax || 0, tc.place.rot || 0);
  for (const c of tc.cars) { const nb = bs.find(x => x.row === 1 && x.idx === c.idx); st.cars.push({ id: S.nextId++, type: c.type, color: PALETTE[c.idx], ...poseInBay(nb, false), bay: { row: 1, idx: c.idx, forward: false } }); }
  // objects placed relative to the learner's driver side (right)
  for (const o of tc.objects) { const p = toWorld(st.learner, 0, o.dx); st.objects.push({ id: S.nextId++, kind: 'wall', x: p[0], z: p[1], h: st.learner.h, len: o.len, wid: o.wid }); }
  return st;
}
export function runCase(tc, show) {
  if (tc.kind === 'park') {
    S.state = caseState(tc); rebuildStatic();
    const r = evaluatePark(S.state.learner, 0);
    tc.actual = r ? Object.fromEntries(r.checks.map(c => [c.id, c.status])) : null;
    tc.values = r ? Object.fromEntries(r.checks.map(c => [c.id, c.value])) : {};
    tc.ok = !!r && Object.keys(tc.expect).every(k => tc.expect[k] === tc.actual[k]);
    if (show) { newAttempt(); if (r) showResult(r); }
  } else if (tc.kind === 'collide' || tc.kind === 'collideMirror') {
    S.state = { layout: { rows: 1, baysPerRow: 8, angle: 90, ...UK_BAY, aisleWidth: 6, back: 'none', pillars: false }, cars: [], objects: [], learner: { x: 0, z: -1.5, h: 0 }, exit: { x: 30, z: -1.5 } };
    const L = S.state.learner;
    if (tc.kind === 'collide') { const p = toWorld(L, -S.LG.length / 2 - tc.gap - 0.1, 0); S.state.objects.push({ id: S.nextId++, kind: 'wall', x: p[0], z: p[1], h: L.h + Math.PI / 2, len: 3, wid: 0.2 }); }
    else { const p = toWorld(L, S.LG.mirrorF, S.LG.mirrorWidth / 2 + tc.gap + 0.225); S.state.objects.push({ id: S.nextId++, kind: 'pillar', x: p[0], z: p[1], h: L.h, len: 0.45, wid: 0.45 }); }
    rebuildStatic();
    const hit = learnerHits(L).length > 0;
    tc.actualText = hit ? 'contact' : 'no contact'; tc.expectText = tc.expectHit ? 'contact' : 'no contact'; tc.ok = hit === tc.expectHit;
    if (show) newAttempt();
  } else if (tc.kind === 'turn') {
    let pose = { x: 0, z: 0, h: 0 }; const pts = [];
    const steps = Math.ceil(2 * Math.PI / (Math.tan(S.LG.deltaMax) / S.LG.wheelbase) / 0.02);
    for (let i = 0; i <= steps; i++) { pts.push(toWorld(pose, S.LG.frontAxleF, -(S.LG.track / 2 + TYRE_W / 2))); pose = stepCar(S.LG, pose, 0.02, S.LG.deltaMax); }
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const dia = 2 * pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cz), 0) / pts.length, spec = learnerSpec().turningCircle;
    tc.ok = Math.abs(dia - spec) / spec <= 0.05;
    tc.expectText = `${spec.toFixed(2)} m ±5%`; tc.actualText = `${dia.toFixed(2)} m · front wheels ${deg(S.LG.deltaMax).toFixed(1)}° · ${learnerSpec().lockToLock} turns lock-to-lock`;
    if (show) { S.state = { layout: { rows: 1, baysPerRow: 8, angle: 90, ...UK_BAY, aisleWidth: 6, back: 'none', pillars: false }, cars: [], objects: [], learner: { x: -6, z: -1.5, h: 0 }, exit: { x: 30, z: -1.5 } }; rebuildStatic(); newAttempt(); S.steer = S.LG.halfTurns; }
  }
}
export function renderTests() {
  const ok = testCases.filter(t => t.ok).length;
  let html = `<h2 style="margin:0 0 .3rem">Checker test scenes</h2><div class="small">${ok}/${testCases.length} match. Expectations use the current car (${settings.car === 'custom' ? 'custom' : stCar.options[stCar.selectedIndex]?.text || settings.car}). Click a row to see it.</div><table><tr><th></th><th>Case</th><th>Expected → actual</th></tr>`;
  testCases.forEach((t, i) => {
    let detail;
    if (t.kind === 'park') detail = Object.keys(t.expect).map(k => { const a = t.actual ? t.actual[k] : '—', m = a === t.expect[k]; return `<span class="${m ? '' : 'bad'}">${k}: ${t.expect[k]}${m ? '' : ` → ${a}`}</span> <span class="small">${t.values[k] || ''}</span>`; }).join('<br>');
    else detail = `${t.expectText} → ${t.actualText}`;
    html += `<tr class="case ${i === testSel ? 'sel' : ''}" data-i="${i}"><td class="${t.ok ? 'ok' : 'bad'}">${t.ok ? '✓' : '✗'}</td><td>${t.name}${t.note ? `<div class="small">${t.note}</div>` : ''}</td><td>${detail}</td></tr>`;
  });
  html += '</table><p class="small">Open the normal simulator by removing <code>?test</code> from the address.</p>';
  const el = document.getElementById('testPanel'); el.innerHTML = html;
  el.querySelectorAll('tr.case').forEach(tr => tr.onclick = () => { testSel = +tr.dataset.i; runCase(testCases[testSel], true); renderTests(); S.zoomFixed = 0.6; });
}
export function startTests() {
  runTests();
  document.getElementById('testPanel').style.display = 'block';
  testSel = 0; runCase(testCases[0], true); renderTests(); S.zoomFixed = 0.6;
}
