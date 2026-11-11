// The London School of Economics around Houghton Street for the intro (metres; +x = north, +z = east; the origin
// on Houghton Street). The LSE Library (the Lionel Robbins Building): its brick block on the mapped footprint and
// the glass dome over the central atrium, where the helical ramp climbs round the light well between the floors of
// books and desks. Outside: "The World Turned Upside Down", Mark Wallinger's upside-down globe, on its plinth;
// St Clement Danes' spire in the Strand; the rest (the Centre and Marshall Buildings, the Old Building, Lincoln's Inn
// Fields, the Royal Courts of Justice, Somerset House, the Thames and Waterloo Bridge, St Paul's on the skyline)
// comes from the real map (cityworld.js).
import * as THREE from 'three';
import { baseBox, canvasTex, plainMaterial, rng, leafMaterial, treeGeometry } from './materials';
import { addInst, M } from './library';
import { woodTex } from './ucl';
import { F, frame, deskTail, signMat, bannerTex, cardTex, paperTex, deskSet, lightAndDust, bookcases } from './campuskit';

export const LSE_RED = '#a3001b';
// the library's mapped footprint, and its entrance face towards LSE Square
const LIB_POLY = [[47.6, 14.8], [3.8, 66.8], [33.8, 91.1], [32.6, 92.8], [46.0, 103.7], [46.9, 103.6], [69.5, 74.4], [71.6, 70.4], [72.3, 65.2], [72.2, 62.8], [50.9, 15.2]];
const LB = { x: 25.7, z: 40.8, ry: -2.403 };
const toW = frame(LB.x, LB.z, LB.ry);
const HALL_OFF = 3.5; // hall z = local z - 3.5: the door at hall z = -3.5
const hallToW = ([x, y, z]) => toW([x, y, z + HALL_OFF]);
const AZ = -32.2, AR = 10.5; // atrium centre (hall z) and radius
const DESK_Z = -34.2;
const GLOBE = [2, 30];
const LOCAL = (p, a, b) => [p, hallToW(a), hallToW(b)];
const OUT = (p, a, b) => [p, toW(a), toW(b)];

// clouds over the river -> down the Thames to Waterloo Bridge -> over Somerset House -> up past St Clement Danes ->
// LSE Square and the upside-down globe -> over the library's dome -> in at the door -> the spiral -> the desk
export const LSE_KEYS = [
  [0.0, [-2600, 1480, -1500], [-500, 1420, 1500]],
  [0.08, [-2400, 1420, -1300], [-400, 1320, 1000]],
  [0.17, [-2150, 1290, -1000], [-600, 300, 0]],
  [0.24, [-1800, 980, -700], [-700, 120, 50]],
  [0.31, [-1450, 620, -420], [-650, 30, 40]],
  [0.39, [-1050, 330, -150], [-380, 40, -60]],
  [0.46, [-700, 180, -80], [-130, 40, 150]],
  [0.52, [-380, 110, 40], [0, 25, 40]],
  [0.57, [-120, 52, -10], [2, 8, 30]],
  OUT(0.615, [0, 46, 34], [0, 22, -28.7]),
  OUT(0.66, [0, 7, 22], [0, 4, 0]),
  LOCAL(0.705, [0, 2.6, 4], [0, 2.6, -20]),
  LOCAL(0.745, [0, 2.6, -19], [0, 10, -32.2]),
  LOCAL(0.82, [0, 2.8, -26], [0, 2.2, -33.8]),
  ...deskTail(LOCAL, DESK_Z),
];
export const LSE_STRIKE = [-150, 0, -2650];
export const LSE_SHADOW = [[1100, [-600, 0, 0]], [120, [20, 0, 40]], [40, hallToW([0, 0, AZ])]];
const minmax = (i) => [Math.min(...LIB_POLY.map((p) => p[i])), Math.max(...LIB_POLY.map((p) => p[i]))];
export const LSE_KEEP = [[...minmax(0), ...minmax(1)]];

export const LSE_PAPER = {
  head: 'LSE · EC1A3 Microeconomics I · Answer booklet',
  q: ['Question 2: Why does a Giffen good need a strong income effect?', 'Use the Slutsky decomposition.'],
  answer: [
    'Slutsky: dx/dp = ∂h/∂p − x · ∂x/∂m.',
    'The substitution term ∂h/∂p is always ≤ 0.',
    'For demand to rise with price (dx/dp > 0) the',
    'income term must outweigh it: the good must be',
    'inferior (∂x/∂m < 0), and take a large share',
    'of the budget, so x · ∂x/∂m is big enough.',
    'So Giffen ⇒ inferior, but most inferior goods',
    'are not Giffen: the income effect is too small.',
  ],
  grade: 'First', range: '72–75', notes: ['label the two effects on the diagram', 'good: share of budget →'],
};

// the globe: oceans and simplified continents, mounted upside down as Wallinger made it
const CONTINENTS = [
  [[-168, 66], [-140, 70], [-95, 72], [-80, 63], [-60, 55], [-66, 45], [-81, 30], [-97, 25], [-105, 20], [-87, 15], [-80, 8], [-92, 15], [-105, 22], [-117, 32], [-125, 42], [-124, 49], [-135, 58], [-150, 60], [-165, 62]],
  [[-80, 10], [-60, 10], [-50, 0], [-35, -7], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-72, -50], [-75, -40], [-71, -18], [-81, -5]],
  [[-10, 36], [-9, 43], [-2, 48], [-5, 58], [5, 62], [10, 70], [30, 70], [40, 65], [40, 45], [28, 41], [20, 38], [12, 44], [3, 43]],
  [[-17, 15], [-17, 21], [-10, 30], [-5, 36], [10, 37], [20, 32], [32, 31], [35, 25], [43, 12], [51, 11], [40, -3], [40, -15], [32, -28], [20, -35], [18, -30], [12, -17], [13, -5], [9, 4], [-5, 5], [-13, 8]],
  [[26, 41], [36, 36], [48, 30], [57, 25], [62, 25], [68, 23], [73, 18], [77, 8], [80, 15], [88, 22], [95, 16], [98, 8], [104, 1], [108, 12], [107, 21], [121, 30], [122, 40], [130, 43], [140, 50], [143, 60], [160, 62], [178, 66], [180, 70], [140, 73], [110, 77], [80, 73], [60, 70], [45, 68], [40, 65], [40, 45], [30, 45]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -28], [150, -37], [141, -38], [133, -32], [115, -35]],
  [[-50, 60], [-40, 65], [-20, 70], [-20, 80], [-60, 82], [-70, 76], [-55, 70]],
  [[-5, 50], [1, 51], [-3, 54], [-5, 58], [-7, 56], [-3, 53]],
];
function globeTex() {
  return canvasTex(2048, 1024, (ctx, W, Hh) => {
    const r = rng(11);
    const g = ctx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#1d5f86'); g.addColorStop(0.5, '#2a78a3'); g.addColorStop(1, '#1d5f86');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    const P = ([lon, lat]) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * Hh];
    CONTINENTS.forEach((c, i) => {
      ctx.fillStyle = ['#c9b27a', '#a9b56f', '#d9c48f', '#c8a35f', '#b9b27a', '#d7a75e', '#eef0ee', '#a9b56f'][i];
      ctx.beginPath(); c.forEach((p, k) => { const [x, y] = P(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(40,40,30,.6)'; ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.fillStyle = '#eef0ee'; ctx.fillRect(0, Hh * (160 / 180), W, Hh); // Antarctica
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5;
    for (let lat = -60; lat <= 60; lat += 30) { const y = ((90 - lat) / 180) * Hh; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let lon = -180; lon < 180; lon += 30) { const x = ((lon + 180) / 360) * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Hh); ctx.stroke(); }
    for (let i = 0; i < 20000; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.05})`; ctx.fillRect(r() * W, r() * Hh, 3, 3); }
  });
}

function domeTex() {
  return canvasTex(512, 512, (ctx, W) => {
    const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    g.addColorStop(0, '#d7cdc8'); g.addColorStop(0.6, '#f0c9a8'); g.addColorStop(1, '#f2ad84');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
  });
}

export function buildLSE({ mobile }) {
  const g = new THREE.Group();
  const r = rng(1895);
  const bx = baseBox();
  const brick = plainMaterial({ color: '#9b6450', roughness: 0.85 }, 'lse-brick');
  const conc = plainMaterial({ color: '#cbc6bc', roughness: 0.8 }, 'lse-conc');
  const glassDark = plainMaterial({ color: '#1f272d', roughness: 0.08, metalness: 0.5 }, 'lse-win');
  const steel = plainMaterial({ color: '#c8ccd0', roughness: 0.3, metalness: 0.8 }, 'lse-steel');
  const iron = plainMaterial({ color: '#1b1c1e', roughness: 0.4, metalness: 0.6 }, 'lse-iron');
  const add = (geo, mat, x, y, z, parent = g) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };

  // ---- the library: the mapped footprint extruded, bands of windows, a parapet, and the glass dome
  const LH = 24;
  const shape = new THREE.Shape(LIB_POLY.map(([x, z]) => new THREE.Vector2(x, -z)));
  const hole = new THREE.Path(); hole.absarc(...[toW([0, 0, AZ + HALL_OFF])[0], -toW([0, 0, AZ + HALL_OFF])[2]], AR + 0.3, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const lg = new THREE.ExtrudeGeometry(shape, { depth: LH, bevelEnabled: false });
  lg.rotateX(-Math.PI / 2);
  add(lg, brick, 0, 0, 0);
  // the roof: pale membrane (the extruded cap would carry stretched brick), with plant rooms on it
  const roofM = plainMaterial({ color: '#8e8a84', roughness: 0.92 }, 'lse-roof');
  const rg = new THREE.ShapeGeometry(shape); rg.rotateX(-Math.PI / 2);
  const roof = add(rg, roofM, 0, LH + 0.04, 0); roof.castShadow = false;
  const inPoly = (x, z) => { let c = false; for (let i = 0, j = LIB_POLY.length - 1; i < LIB_POLY.length; j = i++) { const [xi, zi] = LIB_POLY[i], [xj, zj] = LIB_POLY[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const hc = toW([0, 0, AZ + HALL_OFF]);
  const plant = plainMaterial({ color: '#b9b4ab', roughness: 0.75 }, 'lse-plant');
  const pr = rng(91);
  for (let k = 0, n = 0; k < 60 && n < 7; k++) {
    const x = 44 + (pr() - 0.5) * 70, z = 62 + (pr() - 0.5) * 70, w = 3 + pr() * 5, d = 2.5 + pr() * 4, h = 1.6 + pr() * 2.2;
    if (![[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2]].every(([a, b]) => inPoly(a, b))) continue;
    if (Math.hypot(x - hc[0], z - hc[2]) < AR + 3 + Math.max(w, d)) continue;
    add(new THREE.BoxGeometry(w, h, d), plant, x, LH + h / 2, z); n++;
  }
  // window bands on each face
  for (let i = 0; i < LIB_POLY.length; i++) {
    const [x0, z0] = LIB_POLY[i], [x1, z1] = LIB_POLY[(i + 1) % LIB_POLY.length];
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (L < 6) continue;
    const ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    const ry = Math.atan2(-uz, ux);
    // outward normal of a counter-clockwise ring (polygon is clockwise in (x, z)? test against the centroid)
    let nx = uz, nz = -ux;
    if ((x0 + x1) / 2 + nx - 45 < (x0 + x1) / 2 - 45 && false) { nx = -nx; nz = -nz; }
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if ((mx - 44) * nx + (mz - 62) * nz < 0) { nx = -nx; nz = -nz; }
    for (let fl = 0; fl < 6; fl++) {
      const b = add(new THREE.BoxGeometry(L - 2, 1.6, 0.12), glassDark, mx + nx * 0.06, 2.6 + fl * 3.6, mz + nz * 0.06);
      b.rotation.y = ry; b.castShadow = false;
    }
    const par = add(new THREE.BoxGeometry(L, 0.9, 0.5), conc, mx, LH + 0.45, mz); par.rotation.y = ry;
  }
  // the dome: a shallow glass dome on radial steel ribs over the atrium
  const AC = toW([0, 0, AZ + HALL_OFF]);
  const dT = domeTex();
  const glassD = plainMaterial({ map: dT, color: '#ffffff', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85, emissive: '#2a160c', emissiveIntensity: 0.3 }, 'lse-domeout');
  const dome = add(new THREE.SphereGeometry(AR + 0.6, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), glassD, AC[0], LH, AC[2]); dome.scale.y = 0.45;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const pts = [];
    for (let t = 0; t <= 1.001; t += 0.1) { const th = t * Math.PI / 2; pts.push(new THREE.Vector3(AC[0] + Math.cos(a) * Math.cos(th) * (AR + 0.65), LH + Math.sin(th) * (AR + 0.65) * 0.45, AC[2] + Math.sin(a) * Math.cos(th) * (AR + 0.65))); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.09, 6), steel, 0, 0, 0);
  }
  const ring = add(new THREE.TorusGeometry(AR + 0.6, 0.25, 8, 48), steel, AC[0], LH + 0.1, AC[2]); ring.rotation.x = Math.PI / 2;

  // the entrance: glazed doors, a canopy and the library's name
  const B = new THREE.Group(); B.position.set(LB.x, 0, LB.z); B.rotation.y = LB.ry; g.add(B);
  add(new THREE.BoxGeometry(7, 4.4, 0.3), glassDark, 0, 2.2, 0.15, B);
  add(new THREE.BoxGeometry(9, 0.3, 2.6), steel, 0, 4.7, 1.3, B);
  const sg = add(new THREE.PlaneGeometry(6.4, 0.9), signMat([['LSE LIBRARY', 120, 700, 128, 60]], 1024, 256, LSE_RED, '#ffffff', 0.5), 0, 5.6, 0.31, B);
  sg.castShadow = false;
  for (const x of [-3.5, 0, 3.5]) add(new THREE.BoxGeometry(0.12, 4.4, 0.16), steel, x, 2.2, 0.32, B);

  // ---- "The World Turned Upside Down": the globe upside down on its plinth in LSE Square
  const globe = add(new THREE.SphereGeometry(2.0, 64, 32), plainMaterial({ map: globeTex(), roughness: 0.45, metalness: 0.05 }, 'lse-globe'), GLOBE[0], 3.6, GLOBE[1]);
  globe.rotation.z = Math.PI; // south pole uppermost
  globe.rotation.y = 0.6;
  add(new THREE.CylinderGeometry(0.9, 1.2, 1.5, 24), conc, GLOBE[0], 0.75, GLOBE[1]);
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), steel, GLOBE[0], 1.6, GLOBE[1]);
  const plate = add(new THREE.PlaneGeometry(0.9, 0.3), signMat([['The World Turned Upside Down', 44, 600, 64, 30], ['Mark Wallinger, 2019', 36, 400, 120, 30]], 1024, 192, '#2b2b2b', '#e8e2d2', 0.2), GLOBE[0] - 1.21, 0.9, GLOBE[1]);
  plate.rotation.y = -Math.PI / 2; plate.castShadow = false;
  // red LSE banners on lamp posts round the square
  const posts = [], heads = [];
  [[-12, 20], [-10, 42], [14, 18], [16, 44]].forEach(([x, z], i) => {
    posts.push(M(x, 0, z, 0.12, 5.2, 0.12)); heads.push(M(x, 5.3, z, 0.3, 0.3, 0.3));
    const bn = add(new THREE.PlaneGeometry(0.8, 2.2), plainMaterial({ map: bannerTex([['LSE', 210, 800, 330], ['Est. 1895', 60, 400, 460]], LSE_RED), roughness: 0.7 }, 'lse-ban' + i), x + 0.45, 3.6, z);
    bn.rotation.y = Math.PI / 2;
  });
  addInst(g, bx, iron, posts);
  addInst(g, new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.5, 1.5) }), heads);
  // St Clement Danes: the stone tower and Wren's spire at the west end
  {
    const SC = [-136, 172];
    const st = plainMaterial({ color: '#d6cdb9', roughness: 0.8 }, 'stone-scd');
    add(new THREE.BoxGeometry(7, 22, 7), st, SC[0], 11, SC[1]);
    add(new THREE.BoxGeometry(5.6, 7, 5.6), st, SC[0], 25.5, SC[1]);
    add(new THREE.CylinderGeometry(2.2, 2.8, 6, 8), st, SC[0], 32, SC[1]);
    add(new THREE.CylinderGeometry(1.4, 2.0, 5, 8), st, SC[0], 37.5, SC[1]);
    add(new THREE.ConeGeometry(1.4, 8, 8), st, SC[0], 44, SC[1]);
    add(new THREE.SphereGeometry(0.35, 10, 8), plainMaterial({ color: '#c9a35a', roughness: 0.3, metalness: 0.9 }, 'scd-gold'), SC[0], 48.4, SC[1]);
  }
  // plane trees in the square
  const cano = [], trk = [];
  [[-16, 30], [20, 30]].forEach(([x, z]) => {
    const h = 12 + r() * 4, cr = 4.6 + r() * 2;
    for (let i = 0; i < 12; i++) { const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * cr * 0.7, sc = cr * (0.36 + r() * 0.18); cano.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * rad, h - cr * 0.6 + (r() - 0.35) * cr * 0.9, z + Math.sin(a) * rad), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(sc, sc, sc))); }
    trk.push(M(x, 0, z, 0.45, h - cr * 0.7, 0.45));
  });
  addInst(g, treeGeometry(13, 1), leafMaterial('lse-leaf', '#4f6b35'), cano, { cast: true });
  addInst(g, bx, plainMaterial({ color: '#5a5047', roughness: 0.9 }, 'lse-trunk'), trk);

  // ====================================================== interior: the atrium and the helical ramp
  const lib = new THREE.Group();
  lib.position.set(...toW([0, 0, HALL_OFF]));
  lib.rotation.y = LB.ry;
  g.add(lib);
  const ladd = (geo, mat, x, y, z) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); lib.add(me); return me; };
  const white = plainMaterial({ color: '#efefec', roughness: 0.6 }, 'h-plaster');
  const floorM = plainMaterial({ map: woodTex(), roughness: 0.35 }, 'h-floor');
  const books = plainMaterial({ roughness: 0.78 }, 'books');
  const shelfM = plainMaterial({ color: '#d9d6cf', roughness: 0.5, metalness: 0.2 }, 'h-shelf');
  const glassB = plainMaterial({ color: '#cfe0e6', roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }, 'h-glassb');
  const FL = 4.2, NF = 5, TOP = F + NF * FL;
  // entrance lobby from the door to the atrium
  const lf = ladd(new THREE.PlaneGeometry(12, AZ + AR - (-3.5) < 0 ? 20 : 20), floorM, 0, F, -11); lf.rotation.x = -Math.PI / 2; lf.receiveShadow = true;
  const lobbyLen = -3.5 - (AZ + AR);
  const lfl = ladd(new THREE.PlaneGeometry(12, lobbyLen), floorM, 0, F, -3.5 - lobbyLen / 2); lfl.rotation.x = -Math.PI / 2;
  lf.visible = false;
  const lc = ladd(new THREE.PlaneGeometry(12, lobbyLen), white, 0, F + 4, -3.5 - lobbyLen / 2); lc.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { const w = ladd(new THREE.PlaneGeometry(lobbyLen, 4), white, s * 6, F + 2, -3.5 - lobbyLen / 2); w.rotation.y = -s * Math.PI / 2; }
  // reception desk and the gate line
  ladd(new THREE.BoxGeometry(4, 1.1, 0.8), plainMaterial({ color: LSE_RED, roughness: 0.5 }, 'h-red'), -3.5, F + 0.55, -9);
  for (let x = -2; x <= 2; x += 1) ladd(new THREE.BoxGeometry(0.18, 1, 0.9), steel, x, F + 0.5, -13);
  // the atrium: a white drum, each floor's slab edge with a glass balustrade, the ramp spiralling round it
  const af = ladd(new THREE.CircleGeometry(AR + 4, 64), floorM, 0, F, AZ); af.rotation.x = -Math.PI / 2; af.receiveShadow = true;
  const drum = ladd(new THREE.CylinderGeometry(AR + 4, AR + 4, TOP - F + 1, 64, 1, true), white, 0, (TOP + F) / 2, AZ);
  drum.material = white.clone(); drum.material.side = THREE.BackSide; drum.material.userData = { key: 'h-plaster2' };
  for (let k = 1; k <= NF; k++) {
    const y = F + k * FL;
    const slab = ladd(new THREE.RingGeometry(AR, AR + 4, 64, 1), white, 0, y, AZ); slab.rotation.x = -Math.PI / 2;
    slab.material = white.clone(); slab.material.side = THREE.DoubleSide; slab.material.userData = { key: 'h-plaster3' };
    const ed = ladd(new THREE.CylinderGeometry(AR, AR, 0.5, 64, 1, true), white, 0, y - 0.25, AZ); ed.material = slab.material;
    ladd(new THREE.CylinderGeometry(AR + 0.05, AR + 0.05, 1.1, 64, 1, true), glassB, 0, y + 0.55, AZ);
    const hr = ladd(new THREE.TorusGeometry(AR + 0.05, 0.03, 6, 64), steel, 0, y + 1.1, AZ); hr.rotation.x = Math.PI / 2;
    // bookcases radiating behind each floor's edge, desks at the edge looking into the well
    const runs = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + k * 0.17;
      if (k === 1 && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5) continue; // keep the view from the door clear
      runs.push({ x0: Math.sin(a) * (AR + 1.6), z0: AZ + Math.cos(a) * (AR + 1.6), x1: Math.sin(a) * (AR + 3.8), z1: AZ + Math.cos(a) * (AR + 3.8), y0: y + 0.1, rows: 6, rowH: 0.36, depth: 0.32, face: 1 });
    }
    bookcases(lib, runs, { wood: shelfM, books, mobile: mobile || k > 3 });
  }
  // the helical ramp: a white band climbing once round the well per floor, with its glass balustrade
  {
    const turns = NF, segs = 64 * turns, w = 2.0, R0 = AR - 0.2;
    const v = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, a = t * turns * Math.PI * 2 + Math.PI;
      const y = F + 0.4 + t * (NF * FL - 0.8);
      const c = Math.cos(a), s = Math.sin(a);
      v.push(s * R0, y, AZ + c * R0, s * (R0 - w), y, AZ + c * (R0 - w), s * R0, y - 0.35, AZ + c * R0, s * (R0 - w), y - 0.35, AZ + c * (R0 - w));
      if (i) { const p = (i - 1) * 4, q = i * 4; idx.push(p, q, p + 1, p + 1, q, q + 1, p + 2, p + 3, q + 2, p + 3, q + 3, q + 2, p + 1, q + 1, p + 3, p + 3, q + 1, q + 3); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    rg.setIndex(idx); rg.computeVertexNormals();
    const ramp = new THREE.Mesh(rg, plainMaterial({ color: '#f4f4f1', roughness: 0.55, side: THREE.DoubleSide }, 'h-ramp'));
    ramp.castShadow = ramp.receiveShadow = true; lib.add(ramp);
    // the inner glass balustrade and its handrail
    const bv = [], bi = [], hp = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, a = t * turns * Math.PI * 2 + Math.PI;
      const y = F + 0.4 + t * (NF * FL - 0.8), rr = R0 - w;
      bv.push(Math.sin(a) * rr, y, AZ + Math.cos(a) * rr, Math.sin(a) * rr, y + 1.05, AZ + Math.cos(a) * rr);
      if (i) { const p = (i - 1) * 2; bi.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); }
      hp.push(new THREE.Vector3(Math.sin(a) * rr, y + 1.08, AZ + Math.cos(a) * rr));
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bv, 3)); bg.setIndex(bi); bg.computeVertexNormals();
    lib.add(new THREE.Mesh(bg, glassB));
    lib.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), segs, 0.035, 6), steel));
  }
  // the dome from inside: glazing and ribs
  const dIn = ladd(new THREE.SphereGeometry(AR + 0.5, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial({ map: dT, emissiveMap: dT, emissive: '#ffffff', emissiveIntensity: 0.95, roughness: 0.1, side: THREE.BackSide }, 'h-domein'), 0, TOP + 0.5, AZ);
  dIn.scale.y = 0.45;
  // the ground floor of the well: study desks in a ring, chairs, a sign hung under the first floor
  const out = { lights: [], proc: { chairs: [], people: [] }, place: { chairs: [], F, hw: AR, len: 2 * AR, mz: AZ } };
  const deskW = plainMaterial({ color: '#c9b293', roughness: 0.45 }, 'h-desk');
  const tops = [], legs = [], seats = [], backs = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6) continue;
    const c = Math.cos(a), s = Math.sin(a), rr = AR - 4.2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    tops.push(new THREE.Matrix4().compose(new THREE.Vector3(s * rr, F + 0.74, AZ + c * rr), q, new THREE.Vector3(1.6, 0.05, 0.8)));
    for (const lx of [-0.72, 0.72]) legs.push(new THREE.Matrix4().compose(new THREE.Vector3(s * rr + lx * c, F + 0.37, AZ + c * rr - lx * s), q, new THREE.Vector3(0.05, 0.74, 0.7)));
    for (const lx of [-0.4, 0.4]) {
      const cx = s * (rr + 0.75) + lx * c, cz = AZ + c * (rr + 0.75) - lx * s;
      out.place.chairs.push([cx, cz, 1, a + Math.PI]);
      seats.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, F + 0.45, cz), q, new THREE.Vector3(0.44, 0.05, 0.44)));
      backs.push(new THREE.Matrix4().compose(new THREE.Vector3(s * (rr + 0.97) + lx * c, F + 0.72, AZ + c * (rr + 0.97) - lx * s), q, new THREE.Vector3(0.44, 0.5, 0.05)));
    }
  }
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), deskW, tops, { cast: true });
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), steel, legs);
  out.proc.chairs.push(addInst(lib, new THREE.BoxGeometry(1, 1, 1), plainMaterial({ color: '#2b2f36', roughness: 0.6 }, 'h-chair'), seats), addInst(lib, new THREE.BoxGeometry(1, 1, 1), plainMaterial({ color: '#2b2f36', roughness: 0.6 }, 'h-chair2'), backs));
  const hang = ladd(new THREE.PlaneGeometry(4.8, 0.7), signMat([['LSE LIBRARY  ·  LIONEL ROBBINS BUILDING', 64, 600, 128, 50]], 2048, 256, LSE_RED, '#ffffff', 0.45), 0, F + FL - 0.7, AZ - AR + 0.3);
  hang.castShadow = false;
  out.watch = deskSet(lib, DESK_Z, { paper: paperTex({ ...LSE_PAPER, colour: LSE_RED }), card: cardTex('LSE', LSE_RED, 'Department of Economics'), accent: LSE_RED, deskMat: deskW, iron });
  out.clock = null;

  const { shaftMat, dustU } = lightAndDust(lib, {
    mobile,
    shafts: [[-2, TOP - 4, AZ - 2, 2.4, 22, [0.3, -1, 0.15], 0.3], [2.5, TOP - 4, AZ + 1, 2, 22, [0.25, -1, 0.2], 1.4]],
    dust: [-8, 8, F + 0.5, TOP - 2, AZ - 8, AZ + 8],
  });
  const int = [];
  const pl = (c, i, x, y, z) => { const l = new THREE.PointLight(c, i, 0, 2); l.position.set(x, y, z); lib.add(l); int.push([l, i]); };
  pl(0xffb89a, 70, 0, TOP + 2, AZ);
  pl(0xffe2c8, 26, 0, F + 3.6, -9);
  pl(0xffd8b0, 22, 0, F + 8, AZ);
  pl(0xffd2a0, 0.6, 0.5, F + 1.6, DESK_Z + 0.3);
  pl(0xffd9b4, 7, 1.2, F + 2.8, DESK_Z + 1.2); // a reading lamp's pool over the desk
  // floodlights: the globe, the library entrance
  const ext = [];
  const flood = (p, t, i, ang, col = 0xffe2c2) => { const sp = new THREE.SpotLight(col, i, 0, ang, 0.8, 2); sp.position.set(...p); sp.target.position.set(...t); g.add(sp, sp.target); ext.push([sp, i]); };
  flood([GLOBE[0] - 6, 0.5, GLOBE[1] - 4], [GLOBE[0], 3.6, GLOBE[1]], 1600, 0.5);
  flood([GLOBE[0] + 5, 0.5, GLOBE[1] + 5], [GLOBE[0], 3.6, GLOBE[1]], 1200, 0.5);
  flood(toW([0, 0.5, 10]), toW([0, 6, 0]), 2500, 0.6, 0xffd6a6);
  return { group: g, lib, int, ext, furn: out, dust: dustU, shaftMat };
}
