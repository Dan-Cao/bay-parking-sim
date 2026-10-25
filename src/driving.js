// Driving the learner car each frame, and keeping its meshes in step.
import { SPEED, STEER_RATE, STOP_CHECK_TIME, settings } from './config.js';
import { ackermann, approach, clamp, overlapFrac, rad, segSegDist, stepCar, toWorld } from './geometry.js';
import { S, keys } from './state.js';
import { GUIDE_LEN } from './carModels.js';
import { learnerRoot } from './world.js';
import { contactPoint, evaluatePark, flashContact, learnerHits, newAttempt, showResult, touchesExit } from './checker.js';
import { bump } from './audio.js';

// ===================================================================
// Driving
// ===================================================================
export function reverseEngaged() { return settings.trans === 'arcade' ? S.lastMoveDir < 0 : S.gear === 'R'; }
export function updateDrive(dt) {
  const ht = S.LG.halfTurns, sIn = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (sIn) S.steer += sIn * STEER_RATE * dt;
  else if (settings.steering === 'centre') S.steer = approach(S.steer, 0, STEER_RATE * dt);
  S.steer = clamp(S.steer, -ht, ht);
  const delta = (S.steer / ht) * S.LG.deltaMax;
  let dir = 0;
  if (!keys.Space) {
    if (settings.trans === 'arcade') dir = keys.KeyW ? 1 : keys.KeyS ? -1 : 0;
    else if (keys.KeyW && !keys.KeyS) dir = S.gear === 'R' ? -1 : 1;
  }
  let moved = false;
  if (dir) {
    S.lastMoveDir = dir;
    let remaining = SPEED * dt * dir;
    const before = new Set(learnerHits(S.state.learner).map(h => h.ob));
    while (Math.abs(remaining) > 1e-6) {
      const step = Math.sign(remaining) * Math.min(Math.abs(remaining), 0.01);
      const next = stepCar(S.LG, S.state.learner, step, delta);
      const hits = learnerHits(next).filter(h => !before.has(h.ob));
      if (hits.length) {
        if (!S.attempt.blocked) {
          S.attempt.contacts++; const p = contactPoint(hits[0]); S.attempt.contactPts.push(p); flashContact(p); bump();
        }
        S.attempt.blocked = true; break;
      }
      S.attempt.blocked = false;
      if (!moved && S.resultShown) {   // driving on after a result starts a fresh attempt
        const wasPark = S.lastResult && S.lastResult.kind === 'park', prev = S.attempt;
        newAttempt();
        // adjusting after a park result: keep its contacts and judge again on the next stop
        if (wasPark) Object.assign(S.attempt, { retry: true, contacts: prev.contacts, contactPts: prev.contactPts });
      }
      Object.assign(S.state.learner, next); remaining -= step; moved = true;
    }
  }
  if (moved) { S.attempt.moved = true; S.stopTimer = 0; } else S.stopTimer += dt;

  if (S.attempt.exit && !S.attempt.exit.left && overlapFrac(S.LG, S.state.learner, S.attempt.exit.bay) < 0.1) S.attempt.exit.left = true;
  if (!S.resultShown && S.attempt.exit && moved && touchesExit(S.state.learner)) {
    showResult({ kind: 'exit', pass: S.attempt.contacts === 0, checks: [
      { label: 'Reached the exit marker', status: 'pass', value: '' },
      { label: 'No contact', status: S.attempt.contacts ? 'fail' : 'pass', value: S.attempt.contacts ? `${S.attempt.contacts} contact${S.attempt.contacts > 1 ? 's' : ''}` : 'none' }] });
  }
  if (!S.resultShown && S.attempt.moved && S.stopTimer >= STOP_CHECK_TIME && (!S.attempt.exit || S.attempt.exit.left || S.attempt.retry)) {
    const r = evaluatePark(S.state.learner, S.attempt.contacts);
    if (r) showResult(r);
  }
  return { delta };
}

// ===================================================================
// Per-frame visuals
// ===================================================================
export function updateLearnerVisuals(delta) {
  const p = S.state.learner;
  learnerRoot.position.set(p.x, 0, p.z); learnerRoot.rotation.y = -p.h;
  const ack = ackermann(S.LG, delta);
  for (const fw of [...S.learnerParts.ext.front, ...S.learnerParts.ov.front]) fw.piv.rotation.y = -(fw.r > 0 ? ack.right : ack.left);
  S.learnerParts.int.spin.rotation.z = -S.steer * 2 * Math.PI;
  // reference markers
  const showMarkers = !S.editing && S.camMode !== 'fp';
  for (const m of S.learnerParts.ov.markers) {
    const on = settings.markers[m.type] && showMarkers;
    m.disc.visible = on; m.guide.visible = false; if (!on) continue;
    const a = toWorld(p, m.f, m.r), b = toWorld(p, m.f, m.r + m.s * GUIDE_LEN), ux = (b[0] - a[0]) / GUIDE_LEN, uz = (b[1] - a[1]) / GUIDE_LEN;
    let aligned = false;
    for (const [c, d] of S.bayLines) {
      const lx = d[0] - c[0], lz = d[1] - c[1], ll = Math.hypot(lx, lz);
      if (Math.abs(ux * lz - uz * lx) / ll > Math.sin(rad(10))) continue;
      if (segSegDist(a, b, c, d) < 0.1) { aligned = true; break; }
    }
    m.mat.color.setHex(aligned ? 0xffff40 : m.col); m.mat.opacity = aligned ? 0.95 : 0.28;
    m.discMat.color.setHex(aligned ? 0xffff40 : m.col); m.disc.scale.setScalar(aligned ? 1.7 : 1);
  }
  S.learnerParts.ov.group.visible = S.camMode !== 'fp';
}
