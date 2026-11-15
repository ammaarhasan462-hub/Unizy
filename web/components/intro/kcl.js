// King's College London on the Strand for the intro (metres; +x = north, +z = east; the origin on the King's Building,
// as mapped). The King's Building: Robert Smirke's Portland stone range of 1831 facing the river, its giant columns
// over a rusticated ground floor, cornice and balustrade, KING'S COLLEGE LONDON cut in the attic. Inside, the Great
// Hall, where King's sits its exams: a tall coffered hall with Corinthian pilasters, round-headed windows, chandeliers
// and rows of exam desks. The city around (the Strand, Somerset House, Bush House, Waterloo Bridge, the Thames, St
// Paul's on the skyline) is the real map (cityworld.js).
import * as THREE from 'three';
import { baseBox, facadeMaterial, leafMaterial, plainMaterial, rng, treeGeometry, canvasTex } from './materials';
import { addInst, clockTex, M } from './library';
import { woodTex } from './ucl';
import { F, frame, deskTail, signMat, bannerTex, cardTex, paperTex, deskSet, lightAndDust } from './campuskit';

export const KCL_RED = '#e2231a';
// the King's Building's river front: its centre, and the axis the range runs along (the mapped footprint's long side)
const KB = { x: -52, z: 12, ry: -1.159 };
const toW = frame(KB.x, KB.z, KB.ry);
// interior (hall) coordinates: the front door at hall z = -3.5, the Great Hall from z = -9 to -41
const HALL_OFF = 0;
const hallToW = ([x, y, z]) => toW([x, y, z + HALL_OFF]);
const H0 = -9, H1 = -41, HW = 8.5; // the hall's ends and half-width
const HT = F + 10.5; // its ceiling
const DESK_Z = -33.2;

const LOCAL = (p, a, b) => [p, hallToW(a), hallToW(b)];
const OUT = (p, a, b) => [p, toW(a), toW(b)];
// clouds over the river at Westminster -> down the Thames to Waterloo Bridge -> along the Embankment past Somerset
// House -> the King's Building's river front -> up the steps, between the columns -> the Great Hall -> the desk
export const KCL_KEYS = [
  [0.0, [-2300, 1480, -1550], [-200, 1420, 1450]],
  [0.08, [-2100, 1420, -1350], [-100, 1320, 950]],
  [0.17, [-1850, 1290, -1050], [-300, 300, -50]],
  [0.24, [-1500, 980, -750], [-400, 120, 0]],
  [0.31, [-1150, 620, -470], [-350, 30, -10]],
  [0.39, [-760, 330, -200], [-90, 40, -110]],
  [0.46, [-420, 180, -150], [-60, 30, 10]],
  [0.52, [-250, 105, -30], [-50, 22, 14]],
  OUT(0.57, [-34, 46, 92], [0, 16, -4]),
  OUT(0.615, [0, 30, 58], [0, 13, 0]),
  OUT(0.66, [0, 4.6, 22], [0, 4.0, 0]),
  LOCAL(0.705, [0, 2.6, 4], [0, 2.6, -20]),
  LOCAL(0.745, [0, 2.7, -8], [0, 3.2, -30]),
  LOCAL(0.82, [0, 3.0, -23.5], [0, 2.2, -34.5]),
  ...deskTail(LOCAL, DESK_Z),
];
export const KCL_STRIKE = [-700, 0, -2300];
export const KCL_SHADOW = [[1100, [-500, 0, 0]], [130, [KB.x + 20, 0, KB.z]], [40, hallToW([0, 0, (H0 + H1) / 2])]];
// the mapped King's College block (the hand-built King's Building stands in its place), kept clear of the city
export const KCL_KEEP = [[-66, 47, -43, 44], [-92, -60, -12, 56]];

export const KCL_PAPER = {
  head: "King's College London · Answer booklet",
  q: ['Question 3: A monopolist faces P = 100 − 2Q and MC = 20.', 'Find its output, price and the deadweight loss.'],
  answer: [
    'TR = 100Q − 2Q², so MR = 100 − 4Q.',
    'Set MR = MC: 100 − 4Q = 20, so Q = 20.',
    'Price from demand: P = 100 − 2(20) = 60.',
    'Competitive output where P = MC:',
    '  100 − 2Q = 20, so Q = 40.',
    'DWL = ½ × (60 − 20) × (40 − 20)',
    '    = ½ × 40 × 20 = 400.',
    'The monopolist restricts output to raise price.',
  ],
  grade: 'First', range: '70–74', notes: ['shade the DWL triangle on the diagram', 'good: MR = MC first →'],
};

// the river front's lettering in the attic
function atticTex() {
  return canvasTex(2048, 192, (ctx, W, Hh) => {
    ctx.fillStyle = '#d9d0bd'; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = 'rgba(70,60,48,.85)';
    ctx.font = '600 104px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('KING’S  COLLEGE  LONDON', W / 2, Hh / 2 + 6);
    const r = rng(8);
    for (let i = 0; i < 3000; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,50,40'},${r() * 0.06})`; ctx.fillRect(r() * W, r() * Hh, 3, 3); }
  });
}

// the Great Hall's windows: dawn through old crown glass in small panes
function paneTex() {
  return canvasTex(256, 512, (ctx, W, Hh) => {
    const g = ctx.createLinearGradient(0, 0, 0, Hh);
    g.addColorStop(0, '#d8c8bd'); g.addColorStop(0.55, '#f2c7a0'); g.addColorStop(1, '#f5b07f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    const r = rng(5);
    for (let y = 0; y < Hh; y += 64) for (let x = 0; x < W; x += 64) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '90,70,55'},${r() * 0.09})`; ctx.fillRect(x, y, 64, 64); }
    ctx.strokeStyle = '#efe8da'; ctx.lineWidth = 7;
    for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Hh); ctx.stroke(); }
    for (let y = 0; y <= Hh; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  });
}

export function buildKCL({ mobile }) {
  const g = new THREE.Group();
  const r = rng(1829);
  const bx = baseBox();
  const cb = new THREE.BoxGeometry(1, 1, 1); // centred, for the instanced pieces placed by their middles
  const stone = plainMaterial({ color: '#e2d9c6', roughness: 0.82 }, 'stone');
  const stone2 = plainMaterial({ color: '#d6ccb8', roughness: 0.75 }, 'stone2');
  const dark = plainMaterial({ color: '#25231f', roughness: 0.35 }, 'kcl-dark');
  const iron = plainMaterial({ color: '#18191b', roughness: 0.4, metalness: 0.6 }, 'kcl-iron');
  const lead = plainMaterial({ color: '#5f676c', roughness: 0.45, metalness: 0.45 }, 'kcl-lead');
  const front = facadeMaterial({ floor: 4.4, bay: 3.3, winW: 0.42, winH: 0.6, ground: 1.0, topPad: 2.6, lit: 0.16, litI: 2.0, color: '#e4dbc8', frame: '#efe9dc', roof: '#6d6b66' });
  const back = facadeMaterial({ floor: 4.0, bay: 3.1, winW: 0.42, winH: 0.58, ground: 0.8, topPad: 1.6, lit: 0.14, color: '#dcd2bf', frame: '#ece6da', roof: '#6d6b66' });

  // everything exterior is built in the King's Building's frame: +x along the river front, +z out towards the river
  const B = new THREE.Group();
  B.position.set(KB.x, 0, KB.z);
  B.rotation.y = KB.ry;
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

  // ---- the river front: rusticated ground floor, three storeys above, cornice, attic and balustrade
  const XR = 34, D = 22, TOP = 21;
  box(front, -XR, -12, 0, TOP, -D, 0);
  box(front, 12, XR, 0, TOP, -D, 0);
  box(front, -12, 12, 0, TOP, -D, -3.2); // the centre, behind the columns
  // the hall's block behind the centre, and the back ranges round the quad
  box(back, -11, 11, 0, TOP - 1, -46, -D);
  box(back, -XR, -15, 0, TOP - 1, -58, -D);
  box(back, 15, XR, 0, TOP - 1, -58, -D);
  box(stone, -XR - 0.3, XR + 0.3, 0, 1.0, -D, 0.3); // plinth
  // rustication: horizontal channels across the ground floor
  for (let y = 1.6; y < 5.4; y += 0.75) { box(stone2, -XR - 0.05, -12, y, y + 0.08, -0.06, 0.06); box(stone2, 12, XR + 0.05, y, y + 0.08, -0.06, 0.06); }
  box(stone2, -XR - 0.2, XR + 0.2, 5.6, 6.0, -D, 0.35); // string course over the ground floor
  box(stone2, -XR - 0.6, XR + 0.6, TOP - 2.6, TOP - 1.8, -D - 0.4, 0.7); // cornice
  box(stone, -XR - 0.2, XR + 0.2, TOP - 1.8, TOP, -D, 0.2); // attic
  // pilasters between the upper bays of the wings
  for (let x = -XR + 1.6; x <= XR - 1.6; x += 3.3) if (Math.abs(x) > 12.5) box(stone, x - 0.32, x + 0.32, 6.0, TOP - 2.6, 0, 0.32);
  // balustrade along the top
  const bal = [];
  for (let x = -XR + 0.3; x <= XR - 0.3; x += 0.55) bal.push(M(x, TOP + 0.45, 0.0, 0.18, 0.9, 0.18));
  addInst(B, cb, stone, bal);
  box(stone2, -XR, XR, TOP + 0.9, TOP + 1.15, -0.2, 0.2);
  // ---- the centre: a portico of eight giant columns on the ground floor's podium, entablature, lettered attic
  box(stone, -12.6, 12.6, 0, 1.0, -3.2, 3.6); // podium
  for (let i = 0; i < 5; i++) box(stone, -6 - i * 0.2, 6 + i * 0.2, 0, 1.0 - i * 0.2, 3.6 + i * 0.4, 4.0 + i * 0.4); // steps
  const colG = new THREE.CylinderGeometry(0.62, 0.72, TOP - 4.6, 24);
  const capG = new THREE.BoxGeometry(1.7, 0.9, 1.7);
  for (let i = 0; i < 8; i++) {
    const x = -10.5 + i * 3.0;
    add(colG, stone, x, 1.0 + (TOP - 4.6) / 2, 2.4);
    add(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 24), stone2, x, 1.25, 2.4);
    add(capG, stone2, x, TOP - 3.2, 2.4);
  }
  box(stone2, -12.6, 12.6, TOP - 2.8, TOP - 1.6, -3.2, 3.4); // entablature over the columns
  const at = add(new THREE.PlaneGeometry(18, 1.6), plainMaterial({ map: atticTex(), roughness: 0.8 }, 'kcl-attic'), 0, TOP - 0.9, 3.42);
  at.castShadow = false;
  box(stone, -12.6, 12.6, TOP - 1.6, TOP, 3.0, 3.4);
  // the door: double doors in a stone surround, a lamp each side
  box(dark, -1.8, 1.8, 1.0, 5.6, -3.4, -3.15);
  box(stone2, -2.5, 2.5, 5.6, 6.3, -3.3, -2.9);
  for (const s of [-1, 1]) box(stone2, s * 2.15 - 0.35, s * 2.15 + 0.35, 1.0, 5.6, -3.3, -2.95);
  const sign = add(new THREE.PlaneGeometry(5.6, 0.7), signMat([['KING’S COLLEGE LONDON', 110, 600, 128, 60]], 2048, 256, KCL_RED, '#ffffff', 0.35), 0, 7.1, -2.88);
  sign.castShadow = false;
  // the river front's windows on the centre bays behind the columns
  for (let i = 0; i < 7; i++) { const x = -9 + i * 3.0; if (Math.abs(x) < 2) continue; for (const y of [7.5, 11.9]) box(dark, x - 0.5, x + 0.5, y, y + 2.4, -3.25, -3.15); }
  // lead roofs and chimneys behind the balustrade
  box(lead, -XR + 1, XR - 1, TOP, TOP + 2.4, -D + 2, -2);
  for (let x = -30; x <= 30; x += 10) box(stone2, x - 0.8, x + 0.8, TOP, TOP + 4, -12, -10.6);

  // ---- the terrace in front: paving, lamps, two plane trees, the railing to the Embankment
  const paving = plainMaterial({ color: '#b6ae9e', roughness: 0.95 }, 'kcl-paving');
  const pv = add(new THREE.PlaneGeometry(72, 26), paving, 0, 0.05, 13); pv.rotation.x = -Math.PI / 2; pv.castShadow = false;
  const rails = [];
  for (let x = -35; x <= 35; x += 0.16) rails.push(M(x, 0.6, 25.5, 0.025, 1.2, 0.025));
  addInst(B, new THREE.BoxGeometry(1, 1, 1), iron, rails);
  box(iron, -35, 35, 1.12, 1.2, 25.45, 25.55);
  const cano = [], trk = [];
  const tree = (x, z) => {
    const h = 13 + r() * 4, cr = 5 + r() * 2;
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * cr * 0.7, sc = cr * (0.36 + r() * 0.18);
      cano.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * rad, h - cr * 0.6 + (r() - 0.35) * cr * 0.9, z + Math.sin(a) * rad), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(sc, sc, sc)));
    }
    trk.push(M(x, 0, z, 0.45, h - cr * 0.7, 0.45));
  };
  [-27, 27].forEach((x) => tree(x, 15));
  addInst(B, treeGeometry(11, 1), leafMaterial('kcl-leaf', '#4f6b35'), cano, { cast: true });
  addInst(B, bx, plainMaterial({ color: '#5a5047', roughness: 0.9 }, 'kcl-trunk'), trk);
  const lamps = [], lheads = [];
  for (const x of [-14, -6, 6, 14]) { lamps.push(M(x, 0, 9, 0.1, 4, 0.1)); lheads.push(M(x, 4.15, 9, 0.28, 0.28, 0.28)); }
  addInst(B, bx, iron, lamps);
  addInst(B, new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.5, 1.5) }), lheads);
  // red King's banners either side of the steps
  for (const s of [-1, 1]) {
    const bn = add(new THREE.PlaneGeometry(1.0, 3.0), plainMaterial({ map: bannerTex([['King’s', 110, 700, 250], ['College', 64, 400, 350], ['London', 64, 400, 430]], KCL_RED), roughness: 0.7 }, 'kcl-ban' + s), s * 13.4, 4.6, 0.36);
    bn.castShadow = false;
  }

  // ====================================================== interior: the vestibule and the Great Hall
  const lib = new THREE.Group();
  lib.position.set(...toW([0, 0, HALL_OFF]));
  lib.rotation.y = KB.ry;
  g.add(lib);
  const ladd = (geo, mat, x, y, z) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); lib.add(me); return me; };
  const LB = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const plaster = plainMaterial({ color: '#e9e1d0', roughness: 0.9 }, 'h-plaster');
  const cream = plainMaterial({ color: '#f1ead9', roughness: 0.8 }, 'h-cream');
  const oak = plainMaterial({ color: '#4a3020', roughness: 0.5 }, 'h-wood');
  const floorM = plainMaterial({ map: woodTex(), roughness: 0.3 }, 'h-floor');
  const gilt = plainMaterial({ color: '#b8904a', roughness: 0.3, metalness: 0.9 }, 'h-gilt');
  // vestibule from the door to the hall
  const V0 = -3.4, VW = 3.2, VH = F + 4.6;
  const vf = ladd(new THREE.PlaneGeometry(2 * VW, V0 - H0), floorM, 0, F, (V0 + H0) / 2); vf.rotation.x = -Math.PI / 2; vf.receiveShadow = true;
  const vc = ladd(new THREE.PlaneGeometry(2 * VW, V0 - H0), cream, 0, VH, (V0 + H0) / 2); vc.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { const w = ladd(new THREE.PlaneGeometry(V0 - H0, VH - F), plaster, s * VW, (VH + F) / 2, (V0 + H0) / 2); w.rotation.y = -s * Math.PI / 2; }
  // the hall: floor, walls, a coffered ceiling, pilasters, windows down the east side, a clock over the far end
  const HL = H0 - H1, HM = (H0 + H1) / 2;
  const hf = ladd(new THREE.PlaneGeometry(2 * HW, HL), floorM, 0, F, HM); hf.rotation.x = -Math.PI / 2; hf.receiveShadow = true;
  const hc = ladd(new THREE.PlaneGeometry(2 * HW, HL), cream, 0, HT, HM); hc.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { const w = ladd(new THREE.PlaneGeometry(HL, HT - F), plaster, s * HW, (HT + F) / 2, HM); w.rotation.y = -s * Math.PI / 2; }
  const fe = ladd(new THREE.PlaneGeometry(2 * HW, HT - F), plaster, 0, (HT + F) / 2, H1); fe.castShadow = false;
  // the entrance wall, with the doorway from the vestibule
  for (const s of [-1, 1]) { const w = ladd(new THREE.PlaneGeometry(HW - VW, HT - F), plaster, s * (HW + VW) / 2, (HT + F) / 2, H0); w.rotation.y = Math.PI; }
  const ow = ladd(new THREE.PlaneGeometry(2 * VW, HT - VH), plaster, 0, (HT + VH) / 2, H0); ow.rotation.y = Math.PI;
  // coffers: a grid of ribs under the ceiling, gilt bosses at the crossings
  const ribs = [], boss = [];
  for (let z = H0 - 2; z > H1 + 1; z -= 2.6) ribs.push(M(0, HT - 0.35, z, 2 * HW, 0.35, 0.3));
  for (let x = -HW + 2.1; x < HW - 1; x += 2.1) ribs.push(M(x, HT - 0.35, HM, 0.3, 0.35, HL));
  for (let z = H0 - 2; z > H1 + 1; z -= 2.6) for (let x = -HW + 2.1; x < HW - 1; x += 2.1) boss.push(M(x, HT - 0.5, z, 0.32, 0.12, 0.32));
  addInst(lib, cb, cream, ribs);
  addInst(lib, cb, gilt, boss);
  // cornice and dado round the walls
  for (const s of [-1, 1]) {
    ladd(LB(0.5, 0.6, HL), cream, s * (HW - 0.25), HT - 0.3, HM);
    ladd(LB(0.08, 1.1, HL), oak, s * (HW - 0.04), F + 0.55, HM);
  }
  ladd(LB(2 * HW, 0.6, 0.5), cream, 0, HT - 0.3, H1 + 0.25);
  // Corinthian pilasters along both walls, gilt capitals
  for (let z = H0 - 1.6; z > H1 + 1; z -= 5.2) for (const s of [-1, 1]) {
    ladd(LB(0.3, HT - F - 1.4, 0.8), cream, s * (HW - 0.15), F + (HT - F - 1.4) / 2, z);
    ladd(LB(0.4, 0.7, 1.0), gilt, s * (HW - 0.2), HT - 1.05, z);
  }
  // round-headed windows down the east wall (+x), glowing with the dawn; pictures on the west wall
  const pane = paneTex();
  const winM = plainMaterial({ map: pane, emissiveMap: pane, emissive: '#ffffff', emissiveIntensity: 0.85, roughness: 0.1 }, 'h-win');
  for (let z = H0 - 4.2; z > H1 + 2; z -= 5.2) {
    const w = ladd(new THREE.PlaneGeometry(2.0, 4.4), winM, HW - 0.02, F + 4.6, z); w.rotation.y = -Math.PI / 2; w.castShadow = false;
    const hd = ladd(new THREE.CircleGeometry(1.0, 20, 0, Math.PI), winM, HW - 0.02, F + 6.8, z); hd.rotation.y = -Math.PI / 2; hd.castShadow = false;
    ladd(LB(0.2, 0.15, 2.4), cream, HW - 0.1, F + 2.35, z); // sill
    const pic = ladd(new THREE.PlaneGeometry(1.6, 2.0), plainMaterial({ color: ['#3b2a1e', '#2e2a22', '#45301f'][Math.floor(r() * 3)], roughness: 0.6 }, 'h-pic'), -HW + 0.03, F + 4.4, z);
    pic.rotation.y = Math.PI / 2;
    ladd(LB(0.06, 2.3, 1.9), gilt, -HW + 0.02, F + 4.4, z);
  }
  // chandeliers down the middle
  const chand = [], bulbs = [];
  for (let z = H0 - 6; z > H1 + 4; z -= 9) {
    chand.push(M(0, HT - 1.6, z, 0.04, 3.2, 0.04), M(0, F + 7.6, z, 1.4, 0.12, 1.4));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; bulbs.push(M(Math.cos(a) * 0.75, F + 7.85, z + Math.sin(a) * 0.75, 0.1, 0.16, 0.1)); }
  }
  addInst(lib, cb, gilt, chand);
  addInst(lib, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.5, 1.5) }), bulbs);
  // the exam clock and a King's banner on the far wall
  const clk = ladd(new THREE.CircleGeometry(0.7, 40), plainMaterial({ map: clockTex(), roughness: 0.5 }, 'h-clock'), 0, F + 6.6, H1 + 0.06); clk.castShadow = false;
  ladd(new THREE.TorusGeometry(0.72, 0.05, 10, 40), gilt, 0, F + 6.6, H1 + 0.08);
  const hb = ladd(new THREE.PlaneGeometry(6.2, 0.7), signMat([['KING’S COLLEGE LONDON  ·  THE GREAT HALL', 64, 600, 128, 50]], 2048, 256, KCL_RED, '#ffffff', 0.4), 0, F + 4.6, H1 + 0.07);
  hb.castShadow = false;
  // the invigilators' table at the front
  ladd(LB(3.6, 0.8, 1.0), oak, 0, F + 0.4, H1 + 2.4);

  // rows of exam desks with an aisle down the middle, chairs facing the far end
  const out = { lights: [], proc: { chairs: [], people: [] }, place: { chairs: [], F, hw: HW, len: HL, mz: HM } };
  const deskW = plainMaterial({ color: '#7a5a3c', roughness: 0.45 }, 'h-desk');
  const tops = [], legs = [], seats = [], backs = [];
  for (let z = H0 - 4; z > H1 + 5; z -= 1.9) for (const x of [-6.0, -4.0, -2.0, 2.0, 4.0, 6.0]) {
    if (Math.abs(z - DESK_Z) < 0.95 && Math.abs(x) < 2.5) continue; // our desk stands at x = 0 in the aisle row
    tops.push(M(x, F + 0.72, z, 1.2, 0.05, 0.62));
    for (const lx of [-0.55, 0.55]) legs.push(M(x + lx, F + 0.35, z, 0.04, 0.7, 0.55));
    const cz = z + 0.65;
    out.place.chairs.push([x, cz, 1, 0]);
    seats.push(M(x, F + 0.45, cz, 0.44, 0.05, 0.44));
    backs.push(M(x, F + 0.72, cz + 0.21, 0.44, 0.5, 0.05));
  }
  addInst(lib, cb, deskW, tops, { cast: true });
  addInst(lib, cb, iron, legs);
  out.proc.chairs.push(addInst(lib, cb, oak, seats), addInst(lib, cb, oak, backs));
  out.watch = deskSet(lib, DESK_Z, { paper: paperTex({ ...KCL_PAPER, colour: KCL_RED }), card: cardTex('King’s College London', KCL_RED, 'Department of Economics'), accent: KCL_RED, deskMat: deskW, iron });
  out.clock = null;

  // light: dawn through the windows, the chandeliers, the desk
  const { shaftMat, dustU } = lightAndDust(lib, {
    mobile,
    shafts: [[HW - 2.5, F + 5, HM + 6, 2.0, 16, [-1, -0.55, 0.1], 0.2], [HW - 2.5, F + 5, HM - 4, 2.0, 16, [-1, -0.55, 0.1], 0.2], [HW - 2.5, F + 5, DESK_Z, 1.8, 14, [-1, -0.6, 0.05], 0.2]],
    dust: [-HW + 1, HW - 1, F + 0.5, HT - 1, H1 + 2, H0 - 2],
  });
  const int = [];
  const pl = (c, i, x, y, z) => { const l = new THREE.PointLight(c, i, 0, 2); l.position.set(x, y, z); lib.add(l); int.push([l, i]); };
  pl(0xffd8b0, 40, 0, F + 7, HM);
  pl(0xffc9a0, 30, 4, F + 5, HM + 8);
  pl(0xffe2c8, 18, 0, F + 3.6, (V0 + H0) / 2);
  pl(0xffd2a0, 0.6, 0.5, F + 1.6, DESK_Z + 0.3);
  pl(0xffd9b4, 12, 1.4, F + 3.4, DESK_Z + 1.2);

  // floodlights on the columns from the terrace
  const ext = [];
  const flood = (x, y, z, tx, ty, tz, i, ang, col = 0xffe2c2) => {
    const sp = new THREE.SpotLight(col, i, 0, ang, 0.8, 2);
    sp.position.set(...toW([x, y, z])); sp.target.position.set(...toW([tx, ty, tz]));
    g.add(sp, sp.target); ext.push([sp, i]);
  };
  flood(-8, 0.6, 18, -4, 12, 2, 2600, 0.4);
  flood(8, 0.6, 18, 4, 12, 2, 2600, 0.4);
  flood(0, 0.6, 9, 0, 5, -3, 700, 0.6, 0xffd6a6);
  return { group: g, lib, int, ext, furn: out, dust: dustU, shaftMat };
}
