// Three.js renderer, lights, cameras, mirror render targets, materials and mesh helpers.
import * as THREE from 'three';
import { TYRE_R, TYRE_W } from './config.js';

// ===================================================================
// Three.js setup
// ===================================================================
export const canvas = document.getElementById('view');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c8);
scene.add(new THREE.HemisphereLight(0xdfe9f3, 0x3a3a3a, 1.3));
export const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
sun.shadow.camera.layers.enable(1);
scene.add(sun, sun.target);

// Layers: 0 world, 1 learner exterior, 2 learner interior, 3 learner mirrors, 4 top-down overlays
export const topCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
topCam.up.set(0, 0, -1);
[0, 1, 3, 4].forEach(l => topCam.layers.enable(l));
export const fpCam = new THREE.PerspectiveCamera(72, 1, 0.05, 300);
export const chaseCam = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
[1, 3].forEach(l => chaseCam.layers.enable(l));
fpCam.rotation.order = 'YXZ';
fpCam.layers.disableAll(); [0, 2, 3].forEach(l => fpCam.layers.enable(l));

export function makeRT(w, h) { const rt = new THREE.WebGLRenderTarget(w, h); rt.texture.repeat.x = -1; rt.texture.offset.x = 1; return rt; } // flipped = mirror image
export const rts = { left: makeRT(512, 384), cam: makeRT(640, 360), right: makeRT(512, 384), rv: makeRT(512, 160) };
export const mirrorCams = {
  left: new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 200), right: new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 200),
  cam: new THREE.PerspectiveCamera(100, 16 / 9, 0.05, 100), rv: new THREE.PerspectiveCamera(32, 512 / 160, 0.05, 200),
};
mirrorCams.left.layers.enable(1); mirrorCams.right.layers.enable(1);

export const stripScene = new THREE.Scene();
export const stripCam = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
export const stripQuads = {};
for (const k of ['left', 'cam', 'right']) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rts[k].texture, side: THREE.DoubleSide }));
  stripScene.add(m); stripQuads[k] = m;
}

// --- materials ---
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const tarmacTex = canvasTex(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#3b3e42'; ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 34; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(20,20,22,${Math.random() * 0.25})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 30, 0, 7); ctx.fill(); }
});
tarmacTex.wrapS = tarmacTex.wrapT = THREE.RepeatWrapping; tarmacTex.repeat.set(40, 40);
tarmacTex.anisotropy = 8;
export const MAT = {
  ground: new THREE.MeshStandardMaterial({ map: tarmacTex, roughness: 0.95 }),
  line: new THREE.MeshBasicMaterial({ color: 0xf4f4ee, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  kerb: new THREE.MeshStandardMaterial({ color: 0xb9b6ad, roughness: 0.9 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x9a9893, roughness: 0.9 }),
  pillar: new THREE.MeshStandardMaterial({ color: 0xc8c4b8, roughness: 0.85 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x18222d, roughness: 0.08, metalness: 0.7, side: THREE.DoubleSide }),
  rim: new THREE.MeshStandardMaterial({ color: 0xa4a9af, roughness: 0.35, metalness: 0.8 }),
  arch: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1 }),
  black: new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.6 }),
  plateF: new THREE.MeshStandardMaterial({ color: 0xf1f1ec, roughness: 0.5 }),
  plateR: new THREE.MeshStandardMaterial({ color: 0xf3c400, roughness: 0.5 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  head: new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c0, emissiveIntensity: 0.9 }),
  tail: new THREE.MeshStandardMaterial({ color: 0xc81010, emissive: 0xa00000, emissiveIntensity: 0.8 }),
  dash: new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.85 }),
  dashTop: new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.9 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x4a4d53, roughness: 0.8 }),
  headliner: new THREE.MeshStandardMaterial({ color: 0x9a9a9c, roughness: 0.95 }),
  door: new THREE.MeshStandardMaterial({ color: 0x41444a, roughness: 0.9 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 1 }),
  carpet: new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 1 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb4b9be, roughness: 0.3, metalness: 0.8 }),
};
export const paintCache = new Map();
export function paintMat(c) { if (!paintCache.has(c)) paintCache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.35 })); return paintCache.get(c); }
export function overlayMat(color, opacity = 1) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide }); }
export const keepGeom = g => { g.userData.keep = true; return g; };
export const WHEEL_GEOM = keepGeom(new THREE.CylinderGeometry(TYRE_R, TYRE_R, TYRE_W, 24).rotateX(Math.PI / 2));
export const RIM_GEOM = keepGeom(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20).rotateX(Math.PI / 2));
export const HUB_GEOM = keepGeom(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12).rotateX(Math.PI / 2));
export const ARCH_GEOM = keepGeom(new THREE.RingGeometry(TYRE_R + 0.02, TYRE_R + 0.075, 20, 1, 0, Math.PI));

export const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), MAT.ground);
ground.geometry.rotateX(-Math.PI / 2); ground.receiveShadow = true; scene.add(ground);

// --- simple flat geometry helpers ---
export function stripGeom(a, b, w, y) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, nx = -uz * w / 2, nz = ux * w / 2;
  const a2 = [a[0] - ux * w / 2, a[1] - uz * w / 2], b2 = [b[0] + ux * w / 2, b[1] + uz * w / 2];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a2[0] - nx, y, a2[1] - nz, b2[0] - nx, y, b2[1] - nz, b2[0] + nx, y, b2[1] + nz, a2[0] + nx, y, a2[1] + nz], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]); return g;
}
export function polyGeom(poly, y) {
  const g = new THREE.BufferGeometry(), pos = [], idx = [];
  for (const p of poly) pos.push(p[0], y, p[1]);
  for (let i = 1; i < poly.length - 1; i++) idx.push(0, i, i + 1);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
export function prism(poly, y0, y1, mat) {
  const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(Math.PI / 2); g.translate(0, y1, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
export function overlayMesh(geom, mat, order = 20) { const m = new THREE.Mesh(geom, mat); m.renderOrder = order; m.layers.set(4); return m; }
export function disposeTree(o) { o.traverse(c => { if (c.geometry && !c.geometry.userData.keep) c.geometry.dispose(); }); }
