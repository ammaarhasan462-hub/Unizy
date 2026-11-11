// Queen Mary University of London's Mile End campus for the intro (metres; +x = north, +z = east; the Queens'
// Building at the origin, as mapped). The Queens' Building (the old People's Palace frontage on Mile End Road):
// a long Portland stone range with its central clock tower and cupola, set back behind a lawn; behind it, on the
// building's axis, the Octagon, the People's Palace library of 1888: an octagonal reading room with a gallery on
// cast-iron columns, bookcases on both tiers and a ribbed glass dome. The city around (Mile End Road, Library Square,
// the Regent's Canal, Mile End Park, Canary Wharf and the City on the skyline) is the real map (cityworld.js).
import * as THREE from 'three';
import { baseBox, facadeMaterial, leafMaterial, plainMaterial, rng, treeGeometry, canvasTex } from './materials';
import { addInst, clockTex, M } from './library';
import { woodTex } from './ucl';
import { F, frame, deskTail, signMat, bannerTex, cardTex, paperTex, deskSet, lightAndDust, bookcases } from './campuskit';

// the Queens' Building: front centre and axis from its mapped footprint (front faces Mile End Road)
const QB = { x: -31.65, z: 16.44, ry: -1.0856 };
const toW = frame(QB.x, QB.z, QB.ry);
// interior (hall) coordinates: the building's axis, the front door at z = -3.5, the Octagon's centre at z = -85.5
const HALL_OFF = 13.5;
const hallToW = ([x, y, z]) => toW([x, y, z + HALL_OFF]);
const OCT_Z = -85.5, OCT_A = 14; // centre and apothem (half-width across flats)
const DESK_Z = -81.6;
export const QMUL_BLUE = '#1f3a7a';

const LOCAL = (p, a, b) => [p, hallToW(a), hallToW(b)];
const OUT = (p, a, b) => [p, toW(a), toW(b)];
// clouds over the Isle of Dogs -> down past Canary Wharf -> north-west over Mile End Park -> round the clock tower
// -> down to the front door -> along the corridor -> into the Octagon -> the desk
export const QMUL_KEYS = [
  [0.0, [-3000, 1480, 2600], [-1600, 1420, -600]],
  [0.08, [-2800, 1420, 2300], [-1500, 1320, -300]],
  [0.17, [-2600, 1290, 2050], [-2085, 300, 1470]],
  [0.24, [-2450, 980, 1950], [-2085, 120, 1470]],
  [0.31, [-2280, 640, 1800], [-1900, 60, 1200]],
  [0.39, [-1800, 380, 1250], [-600, 40, 400]],
  [0.46, [-1100, 220, 700], [-200, 40, 150]],
  [0.52, [-520, 125, 330], [-38, 30, 20]],
  OUT(0.57, [70, 62, 150], [0, 34, 8]),
  OUT(0.615, [-26, 44, 66], [0, 38, 8]),
  OUT(0.66, [0, 5.5, 24], [0, 4.5, 0]),
  LOCAL(0.705, [0, 2.6, 4], [0, 2.5, -20]),
  LOCAL(0.745, [0, 2.6, -34], [0, 2.4, -66]),
  LOCAL(0.82, [0, 3.3, -73.5], [0, 5.5, -86]),
  ...deskTail(LOCAL, DESK_Z),
];
export const QMUL_STRIKE = [-1050, 0, -1850];
export const QMUL_SHADOW = [[1200, toW([0, 0, 0]).map((v, i) => (i === 1 ? 0 : v)).map((v, i) => (i === 0 ? v - 500 : i === 2 ? v + 500 : v))], [140, [QB.x, 0, QB.z]], [40, hallToW([0, 0, OCT_Z])]];
// ground the hand-built buildings stand on, kept clear of the mapped city
export const QMUL_KEEP = [[-58, 46, -40, 44], [-30, 42, -30, 6]];

export const QMUL_PAPER = {
  head: 'Queen Mary University of London · Answer booklet',
  q: ['Question 1: Explain why a firm in perfect competition earns', 'zero economic profit in the long run.'],
  answer: [
    'In the short run a firm can earn profit where P > ATC.',
    'Profit attracts entry; with free entry the market',
    'supply curve shifts right and the price falls.',
    'Entry continues until P = min ATC, where each firm',
    'produces at the efficient scale and economic',
    'profit is zero (it still covers its opportunity',
    'cost). If P < ATC, firms exit until the price',
    'recovers. So in long-run equilibrium',
    '  P = MC = min ATC.',
  ],
  grade: '2:1', range: '64–68', notes: ['show the entry with a diagram', 'define normal profit →'],
};

function domeGlassTex() {
  // dawn sky through old glass panes, cooler at the top
  return canvasTex(256, 512, (ctx, W, Hh) => {
    const g = ctx.createLinearGradient(0, 0, 0, Hh);
    g.addColorStop(0, '#d9c9c0'); g.addColorStop(0.5, '#f1c9a5'); g.addColorStop(1, '#f6b688');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    const r = rng(3);
    for (let y = 0; y < Hh; y += 64) for (let x = 0; x < W; x += 64) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '80,60,50'},${r() * 0.08})`; ctx.fillRect(x, y, 64, 64); }
    ctx.strokeStyle = '#2a2724'; ctx.lineWidth = 6;
    for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Hh); ctx.stroke(); }
    for (let y = 0; y <= Hh; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  });
}

export function buildQMUL({ mobile }) {
  const g = new THREE.Group();
  const r = rng(1887);
  const bx = baseBox();
  const stone = plainMaterial({ color: '#e4dccb', roughness: 0.82 }, 'stone');
  const stone2 = plainMaterial({ color: '#d8cfbc', roughness: 0.75 }, 'stone2');
  const lead = plainMaterial({ color: '#5f676c', roughness: 0.45, metalness: 0.45 }, 'qm-lead');
  const copper = plainMaterial({ color: '#6f9a86', roughness: 0.5, metalness: 0.4 }, 'qm-copper');
  const gold = plainMaterial({ color: '#c9a35a', roughness: 0.3, metalness: 0.9 }, 'qm-gold');
  const dark = plainMaterial({ color: '#2b2a28', roughness: 0.35 }, 'qm-dark');
  const iron = plainMaterial({ color: '#18191b', roughness: 0.4, metalness: 0.6 }, 'qm-iron');
  const front = facadeMaterial({ floor: 4.6, bay: 3.4, winW: 0.4, winH: 0.62, ground: 1.0, topPad: 2.4, lit: 0.18, litI: 2.0, color: '#e6dece', frame: '#efe9dc', roof: '#6d6b66' });
  const back = facadeMaterial({ floor: 4.2, bay: 3.2, winW: 0.42, winH: 0.6, ground: 0.8, topPad: 1.6, lit: 0.14, color: '#ddd3c0', frame: '#ece6da', roof: '#6d6b66' });

  // everything exterior is built in the Queens' Building's own frame
  const B = new THREE.Group();
  B.position.set(QB.x, 0, QB.z);
  B.rotation.y = QB.ry;
  g.add(B);
  const box = (mat, x0, x1, y0, y1, z0, z1, parent = B) => {
    const m = new THREE.Mesh(bx, mat);
    m.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2);
    m.scale.set(x1 - x0, y1 - y0, z1 - z0);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const add = (geo, mat, x, y, z, parent = B) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };

  // ---- the front range: three storeys and an attic in Portland stone, rusticated ground floor, cornice, balustrade
  box(front, -24, -5, 0, 17, -10, 10);
  box(front, 5, 24, 0, 17, -10, 10);
  box(stone, -24.3, 24.3, 0, 1.2, -10.3, 10.3); // plinth
  box(stone2, -24.4, 24.4, 4.4, 4.75, -10.4, 10.4); // string course
  box(stone2, -24.6, 24.6, 16.6, 17.4, -10.6, 10.6); // cornice
  for (let x = -23.5; x <= 23.5; x += 0.55) if (Math.abs(x) > 5.2) box(stone, x - 0.09, x + 0.09, 17.4, 18.3, 9.95, 10.15); // balusters
  box(stone2, -24.4, -5, 18.3, 18.55, 9.85, 10.25); box(stone2, 5, 24.4, 18.3, 18.55, 9.85, 10.25);
  // end pavilions
  for (const s of [-1, 1]) { box(stone, s * 24 - 3.2, s * 24 + 3.2, 0, 19, 9.6, 11.2); box(stone2, s * 24 - 3.4, s * 24 + 3.4, 19, 19.6, 9.5, 11.4); }
  // pilasters between the bays on the upper floors
  for (let x = -22.4; x <= 22.4; x += 3.4) if (Math.abs(x) > 5.5) box(stone, x - 0.3, x + 0.3, 4.75, 16.6, 10, 10.35);
  // ---- the clock tower: square stages, the clock faces, an open belfry and a lead cupola with a lantern and vane
  box(front, -5, 5, 0, 17, -10, 12);
  box(stone, -5.4, 5.4, 0, 1.4, 11.6, 12.6);
  // entrance arch and doors
  box(dark, -1.6, 1.6, 0.4, 5.2, 12.0, 12.25);
  const arch = add(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 24, 1, false, Math.PI / 2, Math.PI), dark, 0, 5.2, 12.1); arch.rotation.x = Math.PI / 2; // the round head of the doorway
  box(stone2, -2.4, 2.4, 6.6, 7.2, 12.0, 12.6);
  // steps up to the door
  for (let i = 0; i < 4; i++) box(stone, -4 - i * 0.4, 4 + i * 0.4, 0, 0.6 - i * 0.15, 12 + i * 0.55, 12.55 + i * 0.55);
  box(stone, -5, 5, 17, 27, -4.5, 5.5); // tower shaft above the range
  box(stone2, -5.3, 5.3, 26.6, 27.4, -4.8, 5.8);
  box(stone, -4.6, 4.6, 27.4, 32, -4.1, 5.1); // clock stage
  const clockM = plainMaterial({ map: clockTex(), roughness: 0.5 }, 'qm-clock');
  const hands = [];
  [[0, 5.12, 0], [Math.PI / 2, 4.62, 0], [Math.PI, -4.12, 0], [-Math.PI / 2, -4.62, 0]].forEach(([ry], i) => {
    const grp = new THREE.Group(); grp.position.set(0, 29.7, 0.5); grp.rotation.y = ry; B.add(grp);
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.75, 48), clockM); face.position.z = 4.63; grp.add(face);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.09, 12, 48), gold); bez.position.z = 4.64; grp.add(bez);
    const hH = new THREE.Group(), mH = new THREE.Group(); hH.position.z = 4.68; mH.position.z = 4.7;
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.03), iron); hb.position.y = 0.42; hH.add(hb);
    const mb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.45, 0.03), iron); mb.position.y = 0.65; mH.add(mb);
    grp.add(hH, mH); hands.push({ hH, mH });
  });
  box(stone2, -5, 5, 32, 32.6, -4.5, 5.5);
  // belfry: open arcade on four sides with corner piers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(stone, sx * 3.7 - 0.6, sx * 3.7 + 0.6, 32.6, 37.4, 0.5 + sz * 3.7 - 0.6, 0.5 + sz * 3.7 + 0.6);
  box(dark, -3.1, 3.1, 32.6, 37, -2.6, 3.6);
  box(stone2, -4.8, 4.8, 37.4, 38.1, -4.3, 5.3);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; add(new THREE.SphereGeometry(0.45, 12, 8), stone, Math.cos(a) * 4.2, 38.6, 0.5 + Math.sin(a) * 4.2); }
  // ogee cupola in lead, a small lantern and the vane
  const prof = [[3.9, 0], [3.95, 0.4], [3.6, 1.4], [2.6, 2.6], [1.3, 3.6], [0.7, 4.4], [0.55, 5.2], [0.01, 5.3]].map(([a, b]) => new THREE.Vector2(a, b));
  add(new THREE.LatheGeometry(prof, 32), lead, 0, 38.1, 0.5);
  add(new THREE.CylinderGeometry(0.75, 0.85, 1.6, 8), stone, 0, 44.2, 0.5);
  add(new THREE.ConeGeometry(0.9, 1.2, 8), copper, 0, 45.6, 0.5);
  add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), gold, 0, 47, 0.5);
  add(new THREE.SphereGeometry(0.22, 12, 8), gold, 0, 46.4, 0.5);
  const vane = add(new THREE.BoxGeometry(1.4, 0.35, 0.03), gold, 0.3, 47.6, 0.5); vane.rotation.y = 0.6;
  // signage: Queen Mary University of London over the door, and the name stone
  const sign = add(new THREE.PlaneGeometry(8.6, 1.0), signMat([['QUEEN MARY UNIVERSITY OF LONDON', 92, 600, 128, 60]], 2048, 256, '#d9cfbb', '#2b2a28', 0.25), 0, 8.3, 12.62);
  sign.castShadow = false;
  // the back ranges and the link to the Octagon
  box(back, -24, 24, 0, 15, -46, -10);
  box(back, -7, 7, 0, 12, -58.5, -46);
  box(stone2, -24.3, 24.3, 14.6, 15.4, -46.3, -9.7);
  // ---- the Octagon: octagonal drum, lead roof rising to a ribbed glass dome and lantern
  const OZ = OCT_Z + HALL_OFF; // in the building frame
  const RC = OCT_A / Math.cos(Math.PI / 8);
  // seven outer walls; the eighth, facing the corridor, is where the link building joins
  const drumM = plainMaterial({ color: '#d9cfbc', roughness: 0.8 }, 'stone2-oct');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (i === 0) continue;
    const side = 2 * OCT_A * Math.tan(Math.PI / 8);
    const w = add(new THREE.PlaneGeometry(side, 16), drumM, Math.sin(a) * OCT_A, 8, OZ + Math.cos(a) * OCT_A);
    w.rotation.y = a;
  }
  const roofG = add(new THREE.CylinderGeometry(6.2, RC + 0.6, 4.5, 8), lead, 0, 18.25, OZ); roofG.rotation.y = Math.PI / 8;
  const domeT = domeGlassTex();
  const glassOut = plainMaterial({ map: domeT, color: '#ffffff', roughness: 0.05, metalness: 0.3, emissive: '#3a2014', emissiveIntensity: 0.25 }, 'qm-domeout');
  const domeO = add(new THREE.SphereGeometry(6.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassOut, 0, 20.5, OZ); domeO.scale.y = 0.7;
  add(new THREE.CylinderGeometry(0.9, 1.1, 1.6, 8), lead, 0, 25.2, OZ);
  add(new THREE.SphereGeometry(0.25, 10, 8), gold, 0, 26.3, OZ);

  // ---- forecourt: lawn, paths, railings on Mile End Road, trees and lamps
  const lawn = plainMaterial({ color: '#5f7d3d', roughness: 1 }, 'qm-lawn');
  const paving = plainMaterial({ color: '#b3ab9a', roughness: 0.95 }, 'qm-paving');
  const pv = add(new THREE.PlaneGeometry(60, 34), paving, 0, 0.04, 28); pv.rotation.x = -Math.PI / 2; pv.castShadow = false;
  for (const s of [-1, 1]) { const lw = add(new THREE.PlaneGeometry(20, 22), lawn, s * 15, 0.06, 26); lw.rotation.x = -Math.PI / 2; lw.castShadow = false; }
  const rails = [];
  for (let x = -30; x <= 30; x += 0.16) rails.push(M(x, 0.7, 44.5, 0.025, 1.4, 0.025));
  addInst(B, new THREE.BoxGeometry(1, 1, 1), iron, rails);
  box(iron, -30, 30, 1.32, 1.4, 44.45, 44.55);
  for (const s of [-1, 1]) { box(stone, s * 3.2 - 0.5, s * 3.2 + 0.5, 0, 2.6, 44, 45); add(new THREE.SphereGeometry(0.42, 12, 8), stone, s * 3.2, 2.9, 44.5); }
  const cano = [], trk = [];
  const tree = (x, z) => {
    const h = 11 + r() * 5, cr = 4.5 + r() * 2;
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * cr * 0.7, sc = cr * (0.36 + r() * 0.18);
      cano.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * rad, h - cr * 0.6 + (r() - 0.35) * cr * 0.9, z + Math.sin(a) * rad), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(sc, sc, sc)));
    }
    trk.push(M(x, 0, z, 0.45, h - cr * 0.7, 0.45));
  };
  [-26, -18, 18, 26].forEach((x) => tree(x, 38));
  const tm = addInst(B, treeGeometry(11, 1), leafMaterial('qm-leaf', '#4f6b35'), cano, { cast: true });
  addInst(B, bx, plainMaterial({ color: '#5a5047', roughness: 0.9 }, 'qm-trunk'), trk);
  const lamps = [], lheads = [];
  for (const x of [-9, 9]) for (const z of [20, 32]) { lamps.push(M(x, 0, z, 0.1, 4, 0.1)); lheads.push(M(x, 4.15, z, 0.28, 0.28, 0.28)); }
  addInst(B, bx, iron, lamps);
  addInst(B, new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.5, 1.5) }), lheads);
  void tm;

  // ====================================================== interior: the corridor and the Octagon
  const lib = new THREE.Group();
  lib.position.set(...toW([0, 0, HALL_OFF]));
  lib.rotation.y = QB.ry;
  g.add(lib);
  const ladd = (geo, mat, x, y, z) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); lib.add(me); return me; };
  const LB = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const plaster = plainMaterial({ color: '#e8e1d2', roughness: 0.9 }, 'h-plaster');
  const oak = plainMaterial({ color: '#4a3020', roughness: 0.5 }, 'h-wood');
  const floorM = plainMaterial({ map: woodTex(), roughness: 0.3 }, 'h-floor');
  const books = plainMaterial({ roughness: 0.78 }, 'books');
  const cream = plainMaterial({ color: '#efe8d8', roughness: 0.8 }, 'h-cream');
  const ironI = plainMaterial({ color: '#1d2a24', roughness: 0.4, metalness: 0.6 }, 'h-iron');
  const brass = plainMaterial({ color: '#b58a3c', roughness: 0.28, metalness: 1 }, 'h-brass');
  // corridor from the door to the Octagon
  const C0 = -3.5, C1 = OCT_Z + OCT_A;
  const CL = C0 - C1, CM = (C0 + C1) / 2, CW = 2.8, CH = F + 4.4;
  const cf = ladd(new THREE.PlaneGeometry(2 * CW, CL), floorM, 0, F, CM); cf.rotation.x = -Math.PI / 2; cf.receiveShadow = true;
  const cc = ladd(new THREE.PlaneGeometry(2 * CW, CL), cream, 0, CH, CM); cc.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const w = ladd(new THREE.PlaneGeometry(CL, CH - F), plaster, s * CW, (CH + F) / 2, CM); w.rotation.y = -s * Math.PI / 2;
    ladd(LB(0.1, 1.2, CL), oak, s * (CW - 0.05), F + 0.6, CM);
    ladd(LB(0.14, 0.1, CL), oak, s * (CW - 0.07), F + 1.22, CM);
  }
  for (let z = C0 - 6; z > C1 + 3; z -= 8) {
    ladd(LB(2 * CW, 0.3, 0.4), cream, 0, CH - 0.15, z); // ceiling ribs
    const l = ladd(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.4) }), 0, CH - 0.5, z);
    l.castShadow = false;
  }
  // a door frame into the Octagon
  ladd(LB(2 * CW + 0.6, 0.5, 0.6), oak, 0, F + 4.0, C1 + 0.3);
  for (const s of [-1, 1]) ladd(LB(0.4, 4, 0.6), oak, s * (CW + 0.1), F + 2, C1 + 0.3);
  // banners at the end of the corridor
  for (const s of [-1, 1]) {
    const b = ladd(new THREE.PlaneGeometry(1.1, 3.3), plainMaterial({ map: bannerTex([['Queen Mary', 92, 700, 260], ['University', 64, 400, 360], ['of London', 64, 400, 440]], QMUL_BLUE), roughness: 0.75 }, 'h-qmban' + s), s * (CW - 0.04), F + 2.6, C1 + 5);
    b.rotation.y = -s * Math.PI / 2;
  }

  // the Octagon
  const OC = OCT_Z;
  const H1 = F + 5.4, H2 = F + 10.8, HT = F + 15.5; // gallery floor, top of upper cases, top of the walls
  const oct = ladd(new THREE.CylinderGeometry(RC - 0.01, RC - 0.01, HT - F, 7, 1, true, 0, Math.PI * 7 / 4) /* no face over the doorway: seen from the corridor it would close it */, plaster, 0, (HT + F) / 2, OC);
  oct.rotation.y = Math.PI / 8; oct.material = plaster.clone(); oct.material.side = THREE.BackSide; oct.material.userData = { key: 'h-plaster' };
  const of = ladd(new THREE.CircleGeometry(RC, 8), floorM, 0, F, OC); of.rotation.x = -Math.PI / 2; of.rotation.z = Math.PI / 8; of.receiveShadow = true;
  // the eight walls: two tiers of bookcases, the gallery on cast-iron columns, its balustrade, cornice
  const runs = [];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8, a1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
    const p0 = [Math.sin(a0) * (RC - 0.25), OC + Math.cos(a0) * (RC - 0.25)], p1 = [Math.sin(a1) * (RC - 0.25), OC + Math.cos(a1) * (RC - 0.25)];
    const mid = (a0 + a1) / 2;
    const isDoor = Math.abs(Math.cos(mid) - 1) < 0.05; // the wall facing the corridor (+z)
    if (!isDoor) runs.push({ x0: p0[0], z0: p0[1], x1: p1[0], z1: p1[1], y0: F + 0.15, rows: 11, rowH: 0.44, depth: 0.34, face: -1 });
    runs.push({ x0: p0[0], z0: p0[1], x1: p1[0], z1: p1[1], y0: H1 + 0.15, rows: 11, rowH: 0.44, depth: 0.34, face: -1 });
  }
  bookcases(lib, runs, { wood: oak, books, mobile });
  // gallery deck, edge and balustrade
  const gal = ladd(new THREE.RingGeometry(RC - 2.0, RC - 0.05, 8, 1), plainMaterial({ color: '#3a2618', roughness: 0.6, side: THREE.DoubleSide }, 'h-wood2'), 0, H1, OC);
  gal.rotation.x = -Math.PI / 2; gal.rotation.z = Math.PI / 8;
  const edge = ladd(new THREE.CylinderGeometry(RC - 2.0, RC - 2.0, 0.35, 8, 1, true), ironI, 0, H1 - 0.17, OC); edge.rotation.y = Math.PI / 8;
  const rail = ladd(new THREE.TorusGeometry(RC - 2.05, 0.05, 6, 8), brass, 0, H1 + 1.0, OC); rail.rotation.x = Math.PI / 2; rail.rotation.z = Math.PI / 8;
  const bal = [];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8, a1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
    const rr = (RC - 2.05);
    for (let t = 0; t < 1; t += 0.035) { const x = Math.sin(a0) * rr * (1 - t) + Math.sin(a1) * rr * t, z = Math.cos(a0) * rr * (1 - t) + Math.cos(a1) * rr * t; bal.push(M(x, H1 + 0.5, OC + z, 0.025, 1.0, 0.025)); }
    // cast-iron column under each corner of the gallery
    const cx = Math.sin(a0) * (RC - 2.05), cz = Math.cos(a0) * (RC - 2.05);
    ladd(new THREE.CylinderGeometry(0.11, 0.14, H1 - F, 12), ironI, cx, (H1 + F) / 2, OC + cz);
    ladd(new THREE.CylinderGeometry(0.28, 0.12, 0.4, 12), ironI, cx, H1 - 0.2, OC + cz);
  }
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), ironI, bal);
  const corn = ladd(new THREE.CylinderGeometry(RC - 0.2, RC - 0.05, 0.6, 8, 1, true), cream, 0, HT - 0.3, OC); corn.rotation.y = Math.PI / 8;
  corn.material = cream.clone(); corn.material.side = THREE.BackSide; corn.material.userData = { key: 'h-cream2' };
  // the dome: eight ribs up to the lantern, glazed between
  const domeIn = plainMaterial({ map: domeT, emissiveMap: domeT, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.1, side: THREE.BackSide }, 'h-dome');
  const dIn = ladd(new THREE.SphereGeometry(RC - 0.3, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeIn, 0, HT, OC); dIn.scale.y = 0.55;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const pts = [];
    for (let t = 0; t <= 1.001; t += 0.1) { const th = t * Math.PI / 2; pts.push(new THREE.Vector3(Math.sin(a) * Math.cos(th) * (RC - 0.4), HT + Math.sin(th) * (RC - 0.4) * 0.55, OC + Math.cos(a) * Math.cos(th) * (RC - 0.4))); }
    ladd(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.16, 6), cream, 0, 0, 0);
  }
  // reading tables radiating from the centre, chairs, green lamps
  const out = { lights: [], proc: { chairs: [], people: [] }, place: { chairs: [], F, hw: RC, len: 2 * RC, mz: OC } };
  const deskW = plainMaterial({ color: '#5a3c25', roughness: 0.42 }, 'h-desk');
  const tops = [], legs = [], seats = [], backs = [], cl = [], shades = [], bulbs = [];
  for (let i = 0; i < 8; i++) {
    if (i === 0) continue; // the aisle from the door
    const a = (i / 8) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const tx = sa * 7.2, tz = OC + ca * 7.2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    tops.push(new THREE.Matrix4().compose(new THREE.Vector3(tx, F + 0.76, tz), q, new THREE.Vector3(1.5, 0.07, 4.2)));
    for (const lx of [-0.65, 0.65]) for (const lz of [-1.9, 1.9]) legs.push(new THREE.Matrix4().compose(new THREE.Vector3(tx + lx * ca + lz * sa, F + 0.38, tz - lx * sa + lz * ca), q, new THREE.Vector3(0.08, 0.76, 0.08)));
    for (const side of [-1, 1]) for (const lz of [-1.2, 0, 1.2]) {
      const cx = tx + side * 1.15 * ca + lz * sa, cz = tz - side * 1.15 * sa + lz * ca;
      out.place.chairs.push([cx, cz, side, Math.atan2(-side * ca, side * sa)]);
      seats.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, F + 0.46, cz), q, new THREE.Vector3(0.44, 0.05, 0.44)));
      backs.push(new THREE.Matrix4().compose(new THREE.Vector3(cx + side * 0.21 * ca, F + 0.75, cz - side * 0.21 * sa), q, new THREE.Vector3(0.05, 0.55, 0.44)));
    }
    for (const lz of [-1.2, 1.2]) {
      const lx = tx + lz * sa, lzz = tz + lz * ca;
      cl.push(M(lx, F + 0.8, lzz, 0.02, 0.4, 0.02));
      shades.push(new THREE.Matrix4().compose(new THREE.Vector3(lx, F + 1.2, lzz), q, new THREE.Vector3(0.36, 0.1, 0.18)));
      bulbs.push(M(lx, F + 1.16, lzz, 0.05, 0.05, 0.05));
    }
  }
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), deskW, tops, { cast: true });
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), deskW, legs);
  out.proc.chairs.push(addInst(lib, new THREE.BoxGeometry(1, 1, 1), oak, seats), addInst(lib, new THREE.BoxGeometry(1, 1, 1), oak, backs));
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), brass, cl);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), plainMaterial({ color: '#0e3a24', emissive: '#03130b', roughness: 0.25, metalness: 0.2 }, 'h-shade'), shades);
  addInst(lib, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.4) }), bulbs);
  // a Queen Mary sign on the gallery front opposite the door
  const gs = ladd(new THREE.PlaneGeometry(5.4, 0.6), signMat([['QUEEN MARY UNIVERSITY OF LONDON  ·  THE OCTAGON', 60, 600, 128, 50]], 2048, 256, '#1b2f5e', '#e8dcc0', 0.4), 0, H1 - 0.45, OC - (RC - 2.2));
  gs.castShadow = false;
  // the desk at the centre
  out.watch = deskSet(lib, DESK_Z, { paper: paperTex({ ...QMUL_PAPER, colour: QMUL_BLUE }), card: cardTex('Queen Mary', QMUL_BLUE, 'Humanities & Social Sciences'), accent: QMUL_BLUE, deskMat: deskW, iron: ironI });
  out.clock = null;

  // light: dawn through the dome, lamps, the desk
  const { shaftMat, dustU } = lightAndDust(lib, {
    mobile,
    shafts: [[-3, F + 9, OC - 2, 2.2, 18, [0.35, -1, 0.2], 0.4], [2.5, F + 9, OC + 1, 1.8, 18, [0.3, -1, 0.15], 1.2], [0, F + 9, OC - 4, 2.6, 18, [0.4, -1, -0.1], 2.1]],
    dust: [-9, 9, F + 0.5, F + 12, OC - 9, OC + 9],
  });
  const int = [];
  const pl = (c, i, x, y, z) => { const l = new THREE.PointLight(c, i, 0, 2); l.position.set(x, y, z); lib.add(l); int.push([l, i]); };
  pl(0xffb89a, 60, 0, HT + 2, OC);
  pl(0xffd2a0, 18, 0, F + 3.2, OC + 7);
  pl(0xffe0bc, 34, 0, H1 + 2.5, OC); // the gallery level, so the cases read from the door
  pl(0xffd2a0, 22, 0, F + 3, -20);
  pl(0xffd2a0, 0.6, 0.5, F + 1.6, DESK_Z + 0.3);

  // floodlights on the clock tower and the front from the forecourt
  const ext = [];
  const flood = (x, y, z, tx, ty, tz, i, ang, col = 0xffe2c2) => {
    const sp = new THREE.SpotLight(col, i, 0, ang, 0.8, 2);
    sp.position.set(...toW([x, y, z])); sp.target.position.set(...toW([tx, ty, tz]));
    g.add(sp, sp.target); ext.push([sp, i]);
  };
  flood(-7, 0.6, 30, 0, 30, 4, 3000, 0.35);
  flood(7, 0.6, 30, 0, 30, 4, 3000, 0.35);
  flood(-6, 0.6, 12, 0, 6, 0, 700, 0.6, 0xffd6a6);
  flood(6, 0.6, 12, 0, 6, 0, 700, 0.6, 0xffd6a6);
  return { group: g, lib, int, ext, furn: out, dust: dustU, shaftMat, clockHands: hands };
}
