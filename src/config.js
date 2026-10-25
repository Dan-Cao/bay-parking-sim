// Constants, car and scenario presets, and per-browser settings.

export const SPEED = 7.5 / 3.6;           // m/s, constant parking speed
export const STEER_RATE = 1.5;            // steering-wheel turns per second
export const LINE_W = 0.10, HALF_LINE = LINE_W / 2;
export const TYRE_R = 0.31, TYRE_W = 0.20;
export const STOP_CHECK_TIME = 3;
export const EXIT_RADIUS = 1.2;
export const DOOR_MIN = 0.60;
export const ANGLE_TOL = 5;               // degrees
export const SENSOR_RANGE = 1.5;

// Learner car presets. MiTo figures are manufacturer-ish; turning circle is treated as kerb-to-kerb.
export const LEARNER_PRESETS = {
  mito:  { length: 4.063, width: 1.72, mirrorWidth: 1.94, height: 1.446, wheelbase: 2.511, frontOverhang: 0.84, track: 1.47, turningCircle: 11.3, lockToLock: 3.6, doorLength: 1.25, style: 'hatch' },
  hatch: { length: 3.90,  width: 1.73, mirrorWidth: 1.95, height: 1.48,  wheelbase: 2.45,  frontOverhang: 0.80, track: 1.48, turningCircle: 10.2, lockToLock: 2.8, doorLength: 1.00, style: 'hatch' },
  sedan: { length: 4.65,  width: 1.80, mirrorWidth: 2.05, height: 1.45,  wheelbase: 2.70,  frontOverhang: 0.95, track: 1.55, turningCircle: 11.0, lockToLock: 2.8, doorLength: 1.05, style: 'sedan' },
  suv:   { length: 4.50,  width: 1.85, mirrorWidth: 2.10, height: 1.65,  wheelbase: 2.67,  frontOverhang: 0.92, track: 1.58, turningCircle: 11.2, lockToLock: 3.0, doorLength: 1.05, style: 'suv' },
};
export const PARKED_TYPES = {
  hatch: { length: 3.90, width: 1.73, mirrorWidth: 1.95, height: 1.48, wheelbase: 2.45, frontOverhang: 0.80, track: 1.48, style: 'hatch' },
  sedan: { length: 4.65, width: 1.80, mirrorWidth: 2.05, height: 1.45, wheelbase: 2.70, frontOverhang: 0.95, track: 1.55, style: 'sedan' },
  suv:   { length: 4.60, width: 1.88, mirrorWidth: 2.12, height: 1.70, wheelbase: 2.70, frontOverhang: 0.92, track: 1.60, style: 'suv' },
  van:   { length: 5.10, width: 2.00, mirrorWidth: 2.30, height: 2.00, wheelbase: 3.10, frontOverhang: 0.95, track: 1.70, style: 'van' },
};
export const PALETTE = [0x2b4c7e, 0xd9d9d9, 0x1d1d1d, 0x8a8f96, 0x6a2a2a, 0xf0f0f0, 0x274d3a, 0x3c5a99, 0x9c7a3c, 0x55606e];
export const LEARNER_COLOR = 0xa3121b;

export const UK_BAY = { bayWidth: 2.4, bayLength: 4.8 };
export const PRESETS = {
  empty: {
    name: 'Empty lot', desc: 'One row of bays and nothing else. Learn where the reference points are.',
    layout: { rows: 1, baysPerRow: 8, angle: 90, ...UK_BAY, aisleWidth: 6.0, back: 'kerb', pillars: false },
    cars: [],
  },
  between: {
    name: 'Between two cars', desc: 'Standard UK bays with neighbours parked straight on both sides of the gap.',
    layout: { rows: 2, baysPerRow: 8, angle: 90, ...UK_BAY, aisleWidth: 6.0, back: 'kerb', pillars: false },
    cars: [
      { row: 1, idx: 1, type: 'sedan' }, { row: 1, idx: 2, type: 'hatch' }, { row: 1, idx: 4, type: 'suv' }, { row: 1, idx: 5, type: 'hatch', flip: true }, { row: 1, idx: 7, type: 'sedan' },
      { row: -1, idx: 0, type: 'hatch' }, { row: -1, idx: 2, type: 'suv', flip: true }, { row: -1, idx: 3, type: 'sedan' }, { row: -1, idx: 5, type: 'van' }, { row: -1, idx: 6, type: 'hatch' },
    ],
  },
  wonky: {
    name: 'Tight / wonky neighbour', desc: 'One neighbour has parked over the line and at an angle, so the gap is smaller than it looks.',
    layout: { rows: 2, baysPerRow: 8, angle: 90, ...UK_BAY, aisleWidth: 6.0, back: 'kerb', pillars: false },
    cars: [
      { row: 1, idx: 1, type: 'sedan' }, { row: 1, idx: 2, type: 'hatch', lat: 0.12 }, { row: 1, idx: 4, type: 'suv', lat: -0.32, rot: 4 }, { row: 1, idx: 5, type: 'hatch' }, { row: 1, idx: 7, type: 'sedan' },
      { row: -1, idx: 1, type: 'hatch' }, { row: -1, idx: 2, type: 'sedan' }, { row: -1, idx: 4, type: 'van' }, { row: -1, idx: 6, type: 'suv' },
    ],
  },
  angled: {
    name: 'Angled bays', desc: '45° bays on both sides of a one-way aisle, with a few cars parked. Drive in forwards, or reverse out to practise exiting.',
    layout: { rows: 2, baysPerRow: 8, angle: 45, ...UK_BAY, aisleWidth: 5.0, back: 'kerb', pillars: false },
    cars: [
      { row: 1, idx: 0, type: 'hatch' }, { row: 1, idx: 2, type: 'sedan' }, { row: 1, idx: 4, type: 'suv' }, { row: 1, idx: 6, type: 'hatch' },
      { row: -1, idx: 1, type: 'sedan' }, { row: -1, idx: 2, type: 'hatch' }, { row: -1, idx: 4, type: 'van' }, { row: -1, idx: 7, type: 'sedan' },
    ],
  },
  narrow: {
    name: 'Narrow aisle', desc: 'A 4.6 m aisle with a full row opposite, walls and pillars, like a multi-storey. Little room to swing out.',
    layout: { rows: 2, baysPerRow: 8, angle: 90, ...UK_BAY, aisleWidth: 4.6, back: 'wall', pillars: true },
    cars: [
      { row: 1, idx: 0, type: 'hatch' }, { row: 1, idx: 1, type: 'sedan' }, { row: 1, idx: 2, type: 'suv' }, { row: 1, idx: 4, type: 'sedan' }, { row: 1, idx: 5, type: 'hatch' }, { row: 1, idx: 6, type: 'van' }, { row: 1, idx: 7, type: 'hatch' },
      { row: -1, idx: 0, type: 'sedan' }, { row: -1, idx: 1, type: 'hatch' }, { row: -1, idx: 2, type: 'suv' }, { row: -1, idx: 3, type: 'sedan' }, { row: -1, idx: 4, type: 'hatch' }, { row: -1, idx: 5, type: 'sedan' }, { row: -1, idx: 6, type: 'suv' },
    ],
  },
};

export const MARKER_COLORS = { mirrors: 0x4cc3ff, shoulder: 0xff5bd1, axle: 0xffa630, bumpers: 0x9cff57 };

// ===================================================================
// Settings (per-browser convenience only)
// ===================================================================
export const DEFAULT_SETTINGS = {
  car: 'mito', custom: { ...LEARNER_PRESETS.mito }, trans: 'arcade', steering: 'hold',
  markers: { mirrors: false, shoulder: false, axle: false, bumpers: false },
  sound: true, insetsTop: false, insetsFp: true, uiScale: 1,
};
export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('bayparkSettings2') || 'null');
    if (s) return { ...DEFAULT_SETTINGS, ...s, markers: { ...DEFAULT_SETTINGS.markers, ...s.markers }, custom: { ...DEFAULT_SETTINGS.custom, ...s.custom } };
  } catch (e) { /* storage unavailable */ }
  return structuredClone(DEFAULT_SETTINGS);
}
export function saveSettings() { try { localStorage.setItem('bayparkSettings2', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
export let settings = loadSettings();
export const learnerSpec = () => settings.car === 'custom' ? settings.custom : LEARNER_PRESETS[settings.car];
