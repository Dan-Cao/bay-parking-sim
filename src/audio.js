// Parking-sensor beeps and the contact bump.
import { SENSOR_RANGE, settings } from './config.js';
import { S } from './state.js';
import { rearSensorDistance } from './checker.js';

// ===================================================================
// Sound
// ===================================================================
export let actx = null, tone = null, lastBeep = 0;
export function initAudio() { try { if (!actx) actx = new AudioContext(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* no audio */ } }
export function beep() {
  if (!actx) return; const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.frequency.value = 2000; o.type = 'sine'; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14, t + 0.005); g.gain.linearRampToValueAtTime(0, t + 0.07);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.08);
}
export function setTone(on) {
  if (!actx) return;
  if (on && !tone) { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 2000; g.gain.value = 0.11; o.connect(g).connect(actx.destination); o.start(); tone = o; }
  if (!on && tone) { tone.stop(); tone = null; }
}
export function bump() {
  if (!actx || !settings.sound) return; const t = actx.currentTime;
  const buf = actx.createBuffer(1, actx.sampleRate * 0.3, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
  const g = actx.createGain(); g.gain.value = 0.9; src.connect(f).connect(g).connect(actx.destination); src.start(t);
  const o = actx.createOscillator(), og = actx.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
  og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(og).connect(actx.destination); o.start(t); o.stop(t + 0.3);
}
export function updateSensor(reversing, now) {
  if (!settings.sound || S.editing || !reversing || !actx) { setTone(false); return; }
  const d = rearSensorDistance(S.state.learner);
  if (d < 0.3) { setTone(true); return; }
  setTone(false);
  if (d < SENSOR_RANGE) { const interval = 0.08 + (d - 0.3) / (SENSOR_RANGE - 0.3) * 0.6; if (now - lastBeep > interval) { beep(); lastBeep = now; } }
}
