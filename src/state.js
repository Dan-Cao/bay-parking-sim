// Shared mutable state. Everything the modules reassign lives on S, because an ES module
// can't assign to another module's exported variables.
import { deriveCar } from './geometry.js';
import { learnerSpec } from './config.js';

export const S = {
  state: null,           // { layout, cars, objects, learner, exit }
  bays: [], structures: [], obstacles: [], bayLines: [],
  nextId: 1,
  currentPreset: 'empty',
  attemptStart: null,
  undoStack: [],
  LG: deriveCar(learnerSpec()),   // the learner car's derived geometry
  learnerParts: null,    // exterior, interior and overlay meshes of the learner car
  exitMesh: null,
  steer: 0,              // steering-wheel turns, + = right
  gear: 'F',             // 'F' (1st / D) or 'R'
  lastMoveDir: 1,
  editing: false,
  camMode: 'top-fixed',  // top-fixed | chase | fp
  camBeforeEdit: 'top-fixed',
  zoomFixed: 1, zoomChase: 1,
  chaseYaw: null,        // smoothed heading the chase camera trails behind
  orbitYaw: 0, orbitPitch: 0,   // chase-cam mouse look
  yaw: 0, pitch: -0.08,  // driver's-seat mouse look
  touch: false,          // on-screen touch controls in place of the keyboard help
  touchLooked: false,    // hides the drag-to-look hint once it has been used
  attempt: null,
  resultShown: false,
  stopTimer: 0,
  lastResult: null,
};
export const keys = {};
export const testMode = new URLSearchParams(location.search).has('test');
