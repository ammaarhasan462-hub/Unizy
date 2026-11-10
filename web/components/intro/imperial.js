// Imperial College London's South Kensington campus for the intro (metres; +x = north, +z = east, the Queen's
// Tower at the origin). The Queen's Tower (Collcutt, 1887-93: 87 m, Portland stone with red brick bands, four
// stages with balustraded balconies, an arched passage at the base, a belfry, corner turrets, an octagonal stage and
// a copper dome with a cupola and gilded finial, the two Imperial Institute lions at its foot), Queen's Lawn, the
// Abdus Salam Library, the Sherfield Building, Skempton, the Royal School of Mines, the Exhibition Road entrance and
// the buildings around them. The visitor drops into the courtyard north of the Sherfield Building and walks into
// the Queen's Tower Rooms, laid out for an exam, whose glass south wall looks across at the floodlit tower.
import * as THREE from 'three';
import { DUST_FS, DUST_VS } from './shaders';
import { SUN_DIR } from './atmo';
import { baseBox, canvasTex, facadeMaterial, leafMaterial, plainMaterial, rng, treeGeometry } from './materials';
import { addInst, addWatch, between, clockTex, limbGeo, M, paintingTex } from './library';
import { shaftTex, stoneTex, woodTex } from './ucl';

// the exam hall's frame: local coords as in the UCL library (floor at y = 1.21, entrance at z = -3.5, far end at
// z = -61, desk at z = -46), rotated so local -z points south and placed in the Sherfield Building
const HALL = { x: 95, y: -0.9, z: -6 };
export const hallToWorld = ([x, y, z]) => [HALL.x + z, y + HALL.y, HALL.z - x];
const F = 1.21;
const HW = 14; // half width
const HC = F + 11; // ceiling

// [progress, camera position, look-at target]: clouds -> north over Hyde Park -> the Albert Memorial -> over the
// Royal Albert Hall -> round the Queen's Tower's dome -> back over the Sherfield Building into the courtyard ->
// through the doors -> down the exam hall to the desk by the glass, with the tower outside
const LOCAL = (p, a, b) => [p, hallToWorld(a), hallToWorld(b)];
export const IMPERIAL_KEYS = [
  [0.0, [2600, 1480, -1000], [2350, 1420, 3800]],
  [0.08, [2550, 1420, -700], [2250, 1320, 3000]],
  [0.17, [2350, 1290, -350], [900, 300, 600]],
  [0.24, [1900, 980, -120], [420, 100, 0]],
  [0.31, [1450, 640, 40], [430, 40, -20]],
  [0.39, [1080, 380, 110], [430, 30, -40]],
  [0.46, [730, 200, 80], [380, 40, -45]],
  [0.52, [450, 104, 40], [230, 50, -20]],
  [0.57, [235, 92, 58], [0, 72, 0]],
  [0.615, [46, 86, 40], [0, 78, 0]],
  [0.66, [146, 9, -6], [90, 20, -6]],
  LOCAL(0.705, [0, 4.3, 8], [0, 4.7, -20]),
  LOCAL(0.745, [0, 4.3, -8], [0, 3.4, -40]),
  LOCAL(0.82, [0, 3.6, -30], [0, 2.2, -46]),
  LOCAL(0.875, [-0.05, 2.48, -44.85], [-0.2, 1.97, -45.92]),
  LOCAL(0.93, [-0.165, 2.075, -45.835], [-0.2, 1.972, -45.925]),
  LOCAL(0.965, [-0.07, 2.2, -45.72], [-0.04, 1.965, -45.97]),
  LOCAL(1.0, [0.0, 2.24, -45.74], [0.01, 1.962, -45.99]),
];

const NAVY = '#0b2f5c'; // Imperial blue, a touch deeper for dawn light

// ------------------------------------------------------------------ textures
function bannerTex(sub) {
  return canvasTex(512, 1536, (ctx, W, Hh) => {
    ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, Hh);
    const g = ctx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 96px Inter, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('Imperial', 54, 250);
    ctx.font = '400 66px Inter, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('College', 56, 340); ctx.fillText('London', 56, 420);
    ctx.fillStyle = '#d9b46c'; ctx.fillRect(56, 480, 120, 6);
    ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.font = '500 34px Inter, Arial, sans-serif';
    sub.forEach((t, i) => ctx.fillText(t, 56, 1300 + i * 48));
  });
}

function boardTex() {
  return canvasTex(1600, 1000, (ctx, W, Hh) => {
    ctx.fillStyle = '#f6f6f2'; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 70px Inter, Arial, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText('Imperial College London', 70, 88);
    ctx.fillStyle = NAVY; ctx.font = '700 86px Inter, Arial, sans-serif';
    ctx.fillText('Examination in progress', 70, 320);
    ctx.fillStyle = '#2a3440'; ctx.font = '500 58px Inter, Arial, sans-serif';
    ctx.fillText('Queen’s Tower Rooms · Sherfield Building', 70, 440);
    ctx.font = '400 54px Inter, Arial, sans-serif';
    ctx.fillText('Start  09:30', 70, 600); ctx.fillText('Finish  12:30', 640, 600);
    ctx.fillStyle = '#7a8591'; ctx.font = '400 44px Inter, Arial, sans-serif';
    ctx.fillText('Silence, please. Phones and smart watches off and in your bag.', 70, 760);
    ctx.fillText('Write your CID on every answer booklet.', 70, 840);
  });
}

function signTex(lines, w = 1024, h = 256, bg = NAVY, fg = '#ffffff') {
  return canvasTex(w, h, (ctx, W, Hh) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = fg; ctx.textBaseline = 'middle';
    lines.forEach(([t, size, weight, y, x = 36]) => { ctx.font = `${weight} ${size}px Inter, "Helvetica Neue", Arial, sans-serif`; ctx.fillText(t, x, y); });
  });
}

function etchTex() {
  // frosted manifestation band on the glass wall
  return canvasTex(2048, 128, (ctx, W, Hh) => {
    ctx.clearRect(0, 0, W, Hh);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(0, 0, W, 10); ctx.fillRect(0, Hh - 10, W, 10);
    ctx.font = '600 54px Inter, Arial, sans-serif'; ctx.textBaseline = 'middle';
    for (let x = 30; x < W; x += 760) ctx.fillText('IMPERIAL COLLEGE LONDON', x, Hh / 2);
  });
}

function ceilingTex() {
  return canvasTex(512, 512, (ctx, W) => {
    ctx.fillStyle = '#cfc9bd'; ctx.fillRect(0, 0, W, W);
    const n = 4, s = W / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * s, y = j * s;
      ctx.fillStyle = '#e4dfd4'; ctx.fillRect(x + 8, y + 8, s - 16, s - 16);
      ctx.fillStyle = '#d6d0c4'; ctx.fillRect(x + 20, y + 20, s - 40, s - 40);
      ctx.fillStyle = '#fff6e2'; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, 7, 0, Math.PI * 2); ctx.fill();
    }
  }, { repeat: [7, 14] });
}

function cardTex() {
  return canvasTex(512, 320, (ctx, W, Hh) => {
    ctx.fillStyle = '#f4f6f8'; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, 92);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 40px Inter, Arial, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText('Imperial College London', 26, 48);
    ctx.fillStyle = '#b8c1cb'; ctx.fillRect(26, 120, 120, 150);
    ctx.fillStyle = '#26303a'; ctx.font = '600 30px Inter, Arial, sans-serif';
    ctx.fillText('STUDENT', 176, 140);
    ctx.font = '400 26px Inter, Arial, sans-serif'; ctx.fillStyle = '#5a6570';
    ctx.fillText('Faculty of Natural Sciences', 176, 190);
    ctx.fillText('Valid to 07/2028', 176, 232);
    for (let x = 176; x < 480; x += 7) { ctx.fillStyle = '#26303a'; ctx.fillRect(x, 262, (x * 13) % 5 > 2 ? 4 : 2, 34); }
  });
}

const ANSWER = [
  'Moment of inertia about the pivot: I = mL²/3.',
  'Gravity acts at L/2, so the restoring torque is',
  '  τ = −mg(L/2) sin θ ≈ −mg(L/2) θ  (small θ).',
  'I θ̈ = τ  ⇒  θ̈ = −(3g / 2L) θ,',
  'which is simple harmonic motion with',
  '  ω² = 3g / 2L.',
  'Period  T = 2π √(2L / 3g).',
  'Check: for L = 1 m, T ≈ 1.64 s, shorter than a',
  'simple pendulum of the same length, as the',
  'mass is spread out towards the pivot.',
];
function paperTex() {
  return canvasTex(1240, 1754, (ctx, W, Hh) => {
    ctx.fillStyle = '#f5f2ea'; ctx.fillRect(0, 0, W, Hh);
    const g = ctx.createRadialGradient(W * 0.55, Hh * 0.4, 100, W * 0.5, Hh * 0.5, Hh * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(110,100,80,.14)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.strokeStyle = 'rgba(70,110,150,.22)'; ctx.lineWidth = 2;
    for (let y = 330; y < Hh - 80; y += 62) { ctx.beginPath(); ctx.moveTo(90, y); ctx.lineTo(W - 90, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(190,60,60,.35)'; ctx.beginPath(); ctx.moveTo(170, 0); ctx.lineTo(170, Hh); ctx.stroke();
    ctx.fillStyle = NAVY; ctx.font = '700 40px Inter, system-ui, sans-serif';
    ctx.fillText('Imperial College London · Answer booklet', 200, 120);
    ctx.font = '400 30px Inter, system-ui, sans-serif'; ctx.fillStyle = '#4a5560';
    ctx.fillText('Question 2: A uniform rod of mass m and length L swings about', 200, 190);
    ctx.fillText('one end. Find the period of small oscillations.', 200, 232);
    ctx.fillStyle = '#1d2a4a'; ctx.font = 'italic 400 36px Georgia, "Times New Roman", serif';
    ANSWER.forEach((l, i) => ctx.fillText(l, 200, 318 + i * 62));
    ctx.strokeStyle = '#a97a26'; ctx.fillStyle = '#a97a26'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(1040, 150, 104, 74, -0.08, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '700 72px Georgia, serif'; ctx.fillText('2:1', 982, 175);
    ctx.font = 'italic 400 32px Georgia, serif'; ctx.fillText('64', 1018, 258);
    const tick = (x, y) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y + 18); ctx.lineTo(x + 46, y - 22); ctx.stroke(); };
    tick(110, 300); tick(110, 424); tick(110, 610);
    ctx.font = 'italic 400 30px Georgia, serif';
    ctx.fillText('justify the small-angle step', 640, 1000);
    ctx.beginPath(); ctx.moveTo(630, 990); ctx.quadraticCurveTo(560, 900, 560, 444); ctx.stroke();
    ctx.fillText('draw the free-body diagram →', 640, 1070);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(200, 1086); ctx.lineTo(620, 1086); ctx.stroke();
  });
}

// ------------------------------------------------------------------ build
export function buildImperial({ mobile }) {
  const g = new THREE.Group();
  const bx = baseBox();
  const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (mat, x0, x1, y0, y1, z0, z1, parent = g) => {
    const m = shadowed(new THREE.Mesh(bx, mat));
    m.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2);
    m.scale.set(x1 - x0, y1 - y0, z1 - z0);
    parent.add(m);
    return m;
  };
  const inst = (geo, mat, mats, cast = true, parent = g) => {
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = cast;
    im.receiveShadow = true;
    parent.add(im);
    return im;
  };
  const Mx = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

  // ====================================================== the Queen's Tower
  const stone = plainMaterial({ map: stoneTex([3, 12]), color: '#ece5d5', roughness: 0.8 }, 'qt-stone');
  const stoneS = plainMaterial({ color: '#e4dccb', roughness: 0.7 }, 'qt-stone2');
  const brick = plainMaterial({ color: '#a24a35', roughness: 0.85 }, 'qt-brick');
  const dark = plainMaterial({ color: '#25211f', roughness: 0.9 }, 'qt-dark');
  const louvre = plainMaterial({ color: '#3b3330', roughness: 0.7 }, 'qt-louvre');
  // the copper roof was replaced in 2024-25, so it shows bright new copper rather than verdigris
  const copper = plainMaterial({ color: '#b8724a', roughness: 0.32, metalness: 1 }, 'qt-copper');
  const gilt = plainMaterial({ color: '#d4a64e', roughness: 0.22, metalness: 1, emissive: '#3a2408', emissiveIntensity: 0.5 }, 'qt-gilt');
  const sq = (mat, w, y0, y1, parent = g) => box(mat, -w / 2, w / 2, y0, y1, -w / 2, w / 2, parent);

  // plinth and steps
  sq(stoneS, 16.5, 0, 0.5); sq(stoneS, 15.5, 0.5, 1.0); sq(stone, 14.6, 1.0, 1.6);
  // stage 1 with the arched passage running north-south
  const S1 = 13, A = 2.4, AH = 10.5;
  box(stone, -S1 / 2, S1 / 2, 1.6, 24, -S1 / 2, -A);
  box(stone, -S1 / 2, S1 / 2, 1.6, 24, A, S1 / 2);
  box(stone, -S1 / 2, S1 / 2, AH, 24, -A, A);
  for (const s of [-1, 1]) {
    const arch = shadowed(new THREE.Mesh(new THREE.TorusGeometry(A + 0.35, 0.45, 10, 32, Math.PI), stoneS));
    arch.position.set(s * (S1 / 2 + 0.1), AH - A, 0); arch.rotation.y = Math.PI / 2; g.add(arch);
  }
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(A, A, S1, 24, 1, true, 0, Math.PI), plainMaterial({ color: '#cfc6b3', roughness: 0.9, side: THREE.BackSide }, 'qt-vault'));
  vault.rotation.z = Math.PI / 2; vault.position.set(0, AH - A, 0); g.add(vault);
  // stages 2-4, belfry
  const stages = [[S1, 1.6, 24], [12.2, 25.4, 41.4], [11.6, 42.8, 57.6], [11.0, 59.0, 70.2]];
  sq(stone, 12.2, 25.4, 41.4); sq(stone, 11.6, 42.8, 57.6);
  // belfry: corner piers, two tall louvred arches per face
  const BW = 11.0, B0 = 59.0, B1 = 70.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(stone, sx > 0 ? BW / 2 - 1.6 : -BW / 2, sx > 0 ? BW / 2 : -BW / 2 + 1.6, B0, B1, sz > 0 ? BW / 2 - 1.6 : -BW / 2, sz > 0 ? BW / 2 : -BW / 2 + 1.6);
  sq(louvre, BW - 0.8, B0, B1);
  for (let f = 0; f < 4; f++) {
    const ry = (f * Math.PI) / 2;
    const grp = new THREE.Group(); grp.rotation.y = ry; g.add(grp);
    box(stone, -BW / 2 + 1.6, BW / 2 - 1.6, B0, B0 + 1.2, BW / 2 - 0.6, BW / 2, grp);
    box(stone, -0.5, 0.5, B0, B1, BW / 2 - 0.6, BW / 2, grp);
    box(stone, -BW / 2 + 1.6, BW / 2 - 1.6, B1 - 2.6, B1, BW / 2 - 0.6, BW / 2, grp);
    for (const cx of [-2.25, 2.25]) {
      const ar = shadowed(new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.22, 8, 24, Math.PI), stoneS));
      ar.position.set(cx, B1 - 2.6 - 0.05, BW / 2 - 0.25); grp.add(ar);
      for (let k = 0; k < 9; k++) box(stoneS, cx - 1.3, cx + 1.3, B0 + 1.6 + k * 0.85, B0 + 1.75 + k * 0.85, BW / 2 - 0.55, BW / 2 - 0.42, grp);
    }
  }
  // red brick bands, pilaster strips, small arched windows, the balustraded balconies
  const bands = [], pils = [], wins = [];
  stages.forEach(([w, y0, y1], si) => {
    for (let y = y0 + 2.4; y < y1 - 1.2; y += si === 0 ? 2.6 : 3.0) bands.push(Mx(0, y, 0, w + 0.08, 0.55, w + 0.08));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      pils.push(Mx(sx * (w / 2 - 0.45), y0, sz * (w / 2 + 0.12), 0.9, y1 - y0, 0.3));
      pils.push(Mx(sx * (w / 2 + 0.12), y0, sz * (w / 2 - 0.45), 0.3, y1 - y0, 0.9));
    }
    if (si === 1 || si === 2) {
      for (let f = 0; f < 4; f++) {
        const a = (f * Math.PI) / 2;
        for (const yy of [y0 + 4.2, y0 + 10.6]) for (const off of [-1.8, 1.8]) {
          const lx = off, lz = w / 2 + 0.02;
          wins.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * lx + Math.sin(a) * lz, yy, -Math.sin(a) * lx + Math.cos(a) * lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(0.75, 2.2, 0.1)));
        }
      }
    }
  });
  inst(bx, brick, bands);
  inst(bx, stoneS, pils);
  inst(bx, plainMaterial({ color: '#1d1a19', roughness: 0.3, emissive: '#ffb066', emissiveIntensity: 0.06 }, 'qt-win'), wins, false);
  const balusters = [];
  const balcony = (w, y) => {
    sq(stoneS, w + 2.2, y - 0.5, y);
    sq(stoneS, w + 1.6, y - 1.1, y - 0.5);
    const n = Math.floor((w + 1.6) / 0.5);
    for (let f = 0; f < 4; f++) for (let i = 0; i <= n; i++) {
      const t = -((w + 1.6) / 2) + (i * (w + 1.6)) / n;
      const e = (w + 2.0) / 2;
      const [x, z] = f === 0 ? [t, e] : f === 1 ? [t, -e] : f === 2 ? [e, t] : [-e, t];
      balusters.push(Mx(x, y, z, 0.18, 0.9, 0.18));
    }
    for (const [x0, x1, z0, z1] of [[-(w + 2.2) / 2, (w + 2.2) / 2, (w + 1.9) / 2, (w + 2.2) / 2], [-(w + 2.2) / 2, (w + 2.2) / 2, -(w + 2.2) / 2, -(w + 1.9) / 2], [(w + 1.9) / 2, (w + 2.2) / 2, -(w + 2.2) / 2, (w + 2.2) / 2], [-(w + 2.2) / 2, -(w + 1.9) / 2, -(w + 2.2) / 2, (w + 2.2) / 2]]) box(stoneS, x0, x1, y + 0.9, y + 1.15, z0, z1);
  };
  balcony(12.6, 25.4); balcony(12.0, 42.8); balcony(11.4, 59.0); balcony(11.0, 70.8);
  inst(new THREE.CylinderGeometry(0.5, 0.42, 1, 8).translate(0, 0.5, 0), stoneS, balusters, false);
  sq(stoneS, 11.8, B1, B1 + 0.6);
  // corner turrets with little copper domes, flying buttresses to the octagonal stage
  const OCT_R = 4.6, O0 = 71.4, O1 = 75.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const tx = sx * (BW / 2 + 0.2), tz = sz * (BW / 2 + 0.2);
    const t = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 7.4, 16), stone)); t.position.set(tx, B1 + 3.2, tz); g.add(t);
    const td = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), copper)); td.position.set(tx, B1 + 6.9, tz); td.scale.y = 1.5; g.add(td);
    const tf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.3, 8), gilt); tf.position.set(tx, B1 + 9.2, tz); g.add(tf);
    const fb = shadowed(new THREE.Mesh(bx, stoneS));
    const a = new THREE.Vector3(tx * 0.92, B1 + 5.2, tz * 0.92), b = new THREE.Vector3(sx * OCT_R * 0.72, O1 - 0.6, sz * OCT_R * 0.72);
    fb.position.copy(a); fb.lookAt(b); fb.rotateX(Math.PI / 2); fb.scale.set(0.45, a.distanceTo(b), 0.7); fb.geometry = bx;
    g.add(fb);
  }
  const oct = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(OCT_R, OCT_R + 0.2, O1 - O0, 8), stone)); oct.position.set(0, (O0 + O1) / 2, 0); oct.rotation.y = Math.PI / 8; g.add(oct);
  const octC = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(OCT_R + 0.45, OCT_R + 0.45, 0.6, 8), stoneS)); octC.position.set(0, O1 + 0.3, 0); octC.rotation.y = Math.PI / 8; g.add(octC);
  const octW = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; octW.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * (OCT_R * 0.93), O0 + 2.1, Math.sin(a) * (OCT_R * 0.93)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0)), new THREE.Vector3(0.9, 2.6, 0.2))); }
  inst(bx, dark, octW, false);
  // the copper dome (ogee profile), cupola with columns, gilded ball and finial
  const prof = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; const rr = (OCT_R + 0.3) * (Math.cos(t * Math.PI * 0.5) ** 0.85) * (1 - 0.1 * Math.sin(t * Math.PI)); prof.push(new THREE.Vector2(Math.max(0.8, rr), t * 8.4)); }
  const dome = shadowed(new THREE.Mesh(new THREE.LatheGeometry(prof, 48), copper)); dome.position.y = O1 + 0.6; g.add(dome);
  const ribs = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; for (let k = 0; k < 12; k++) { const t = k / 12; const rr = (OCT_R + 0.3) * (Math.cos(t * Math.PI * 0.5) ** 0.85) * (1 - 0.1 * Math.sin(t * Math.PI)); ribs.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rr, O1 + 0.6 + t * 8.4, Math.sin(a) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), new THREE.Vector3(0.18, 0.75, 0.18))); } }
  inst(bx, copper, ribs, false);
  const CU = O1 + 0.6 + 8.0;
  const cup = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.4, 16), stoneS)); cup.position.y = CU; g.add(cup);
  const ccol = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ccol.push(Mx(Math.cos(a) * 0.82, CU + 1.2, Math.sin(a) * 0.82)); }
  inst(new THREE.CylinderGeometry(0.09, 0.1, 2.0, 8), stoneS, ccol, false);
  const lampGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.1, 1.1) })); lampGlow.position.y = CU + 1.2; g.add(lampGlow);
  const cap = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), copper)); cap.position.y = CU + 2.2; cap.scale.y = 1.3; g.add(cap);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), gilt); ball.position.y = CU + 3.7; g.add(ball);
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.6, 8), gilt); spike.position.y = CU + 4.7; g.add(spike);
  // red aviation light at the top
  const av = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.15) })); av.position.y = CU + 5.6; g.add(av);
  // the two Imperial Institute lions at the foot of the tower, either side of the south steps
  for (const s of [-1, 1]) {
    const lz = s * 4.4;
    box(stoneS, -10.6, -8.4, 0, 1.2, lz - 1.8, lz + 1.8);
    const body = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.6, 6, 12), stoneS)); body.rotation.x = Math.PI / 2; body.position.set(-9.5, 1.9, lz); body.rotation.z = Math.PI / 2; g.add(body);
    const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), stoneS)); head.position.set(-10.6, 2.5, lz); g.add(head);
    const mane = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), stoneS)); mane.position.set(-10.3, 2.4, lz); mane.scale.set(0.7, 1, 1); g.add(mane);
  }

  // ====================================================== the campus around it
  const conc = facadeMaterial({ floor: 3.8, bay: 1.45, winW: 0.82, winH: 0.55, sash: 0, lit: 0.36, litI: 2.4, color: '#bdb7aa', frame: '#5d6064', roof: '#76777a', glassRough: 0.05 });
  const glassF = facadeMaterial({ floor: 3.9, bay: 1.5, winW: 0.93, winH: 0.8, sash: 0, lit: 0.42, litI: 2.6, color: '#9eaab2', frame: '#3b444c', roof: '#5b5f63', glassRough: 0.04, metalness: 0.2, roughness: 0.4 });
  const rsm = facadeMaterial({ floor: 4.4, bay: 3.2, winW: 0.42, winH: 0.62, lit: 0.3, color: '#ddd5c3', frame: '#cfc7b4', roof: '#7d7a73' });
  const brickF = facadeMaterial({ floor: 3.9, bay: 2.2, winW: 0.6, winH: 0.66, sash: 0, lit: 0.34, color: '#9a5641', frame: '#3b3f44', roof: '#5b5f63' });
  // Sherfield Building: wings either side of the Queen's Tower Rooms, upper floors above it
  const SX0 = 33, SX1 = 92, SH = 26;
  const hallZ0 = HALL.z - HW - 0.6, hallZ1 = HALL.z + HW + 0.6;
  box(conc, SX0, SX1, 0, SH, -110, hallZ0);
  box(conc, SX0, SX1, 0, SH, hallZ1, 40);
  box(conc, SX0 - 1, SX1, HC + HALL.y + 0.6, SH, hallZ0, hallZ1);
  box(plainMaterial({ color: '#8f8b84', roughness: 0.85 }, 'ic-roof'), SX0 - 1, SX1 + 0.3, SH, SH + 1.2, -110.3, 40.3);
  box(conc, 55, 80, SH, SH + 7, -60, -20); // plant rooms on the roof
  // Abdus Salam Library (concrete, with the glazed two-storey extension on top), west of the lawn
  box(conc, -22, SX0 - 2, 0, 19, -110, -73);
  box(glassF, -21, SX0 - 3, 19, 27, -109, -74);
  // Skempton, Huxley/Blackett, Royal School of Mines, City & Guilds, Bessemer, the EEE tower, Dyson, the Exhibition Road entrance
  box(conc, -22, 96, 0, 24, -181, -113);
  box(glassF, 100, 205, 0, 29, -181, -72);
  box(rsm, 180, 206, 0, 22, -62, 92);
  box(rsm, 196, 207, 0, 26, 2, 28); // RSM entrance block on Prince Consort Road
  box(conc, 100, 176, 0, 26, 62, 142);
  box(conc, 176, 206, 0, 24, 96, 162);
  box(conc, 120, 152, 0, 56, 150, 195);
  box(brickF, 152, 205, 0, 20, 166, 196);
  box(glassF, 98, 120, 0, 22, 150, 196);
  box(conc, 46, 96, 0, 28, 100, 196);
  box(glassF, -22, 44, 0, 24, 162, 196);
  // the south side of Imperial College Road: Chemistry, the Sir Alexander Fleming Building
  box(glassF, -100, -40, 0, 27, -181, -84);
  box(glassF, -100, -40, 0, 23, -72, 52);
  // signage: Imperial College London on the Exhibition Road entrance and over the Sherfield courtyard doors
  const signMat = (lines, w, h) => { const t = signTex(lines, w, h); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.5 }); };
  const ex = new THREE.Mesh(new THREE.PlaneGeometry(40, 5), signMat([['Imperial College London', 150, 700, 128, 60]], 2048, 256));
  ex.position.set(28, 18.5, 196.15); g.add(ex);
  // trees on Queen's Lawn and Dangoor Plaza, lamp posts, benches
  const r = rng(77);
  const cano = [], trk = [], lamps = [], heads = [];
  const tree = (x, z, s = 1) => {
    const h = (12 + r() * 5) * s, cr = (5 + r() * 2) * s;
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * cr * 0.7, sc = cr * (0.34 + r() * 0.18);
      cano.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * rad, h - cr * 0.6 + (r() - 0.35) * cr * 0.9, z + Math.sin(a) * rad), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(sc, sc, sc)));
    }
    trk.push(Mx(x, 0, z, 0.5, h - cr * 0.7, 0.5));
  };
  [[-16, -62], [-16, -40], [-16, -20], [24, -64], [-14, 40], [24, 40], [-14, 90], [24, 92], [-14, 140], [110, -40], [160, 30], [150, -50], [120, 30]].forEach(([x, z]) => tree(x, z));
  for (let z = -60; z < 160; z += 12) { lamps.push(Mx(-19, 0, z, 0.1, 4.2, 0.1)); heads.push(Mx(-19, 4.3, z, 0.3, 0.3, 0.3)); lamps.push(Mx(29, 0, z, 0.1, 4.2, 0.1)); heads.push(Mx(29, 4.3, z, 0.3, 0.3, 0.3)); }
  for (let x = 100; x < 175; x += 12) { lamps.push(Mx(x, 0, -14, 0.1, 4.2, 0.1)); heads.push(Mx(x, 4.3, -14, 0.3, 0.3, 0.3)); lamps.push(Mx(x, 0, 2, 0.1, 4.2, 0.1)); heads.push(Mx(x, 4.3, 2, 0.3, 0.3, 0.3)); }
  inst(treeGeometry(13, 2), leafMaterial('ic-leaf', '#5d7a3c'), cano);
  inst(bx, plainMaterial({ color: '#5a5047', roughness: 0.9 }, 'ic-trunk'), trk);
  const iron = plainMaterial({ color: '#18191b', roughness: 0.4, metalness: 0.6 }, 'ic-iron');
  inst(bx, iron, lamps, false);
  inst(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.5, 1.5) }), heads, false);
  const bench = [];
  for (let z = -56; z < -12; z += 10) { bench.push(Mx(-12, 0.45, z, 0.6, 0.08, 1.8)); bench.push(Mx(20, 0.45, z, 0.6, 0.08, 1.8)); }
  for (let x = 104; x < 170; x += 14) bench.push(Mx(x, 0.45, -24, 0.6, 0.08, 1.8));
  inst(bx, plainMaterial({ color: '#5a4630', roughness: 0.6 }, 'ic-bench'), bench, false);

  // ====================================================== the Queen's Tower Rooms, set for an exam
  const lib = new THREE.Group();
  lib.position.set(HALL.x, HALL.y, HALL.z);
  lib.rotation.y = Math.PI / 2;
  g.add(lib);
  const add = (geo, mat, x, y, z, parent = lib) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); parent.add(me); return me; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const LZ0 = -3.5, LZ1 = -61, LEN = LZ0 - LZ1, MZ = (LZ0 + LZ1) / 2;
  const concIn = plainMaterial({ color: '#b9b3a6', roughness: 0.9 }, 'h-conc');
  const plaster = plainMaterial({ color: '#d9d2c4', roughness: 0.92 }, 'h-plaster');
  const oak = plainMaterial({ color: '#6e4b2c', roughness: 0.48 }, 'h-oak');
  const oakDark = plainMaterial({ color: '#3d2919', roughness: 0.5 }, 'h-oakd');
  const brass = plainMaterial({ color: '#b58a3c', roughness: 0.28, metalness: 1 }, 'h-brass');
  const navyM = plainMaterial({ color: NAVY, roughness: 0.6 }, 'h-navy');
  // floor, ceiling, walls
  const floor = add(new THREE.PlaneGeometry(2 * HW, LEN), plainMaterial({ map: woodTex(), roughness: 0.3 }, 'h-floor'), 0, F, MZ);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const ceil = add(new THREE.PlaneGeometry(2 * HW, LEN), plainMaterial({ map: ceilingTex(), roughness: 0.85 }, 'h-ceil'), 0, HC, MZ);
  ceil.rotation.x = Math.PI / 2;
  add(B(2 * HW + 1.2, 0.6, LEN + 0.6), concIn, 0, HC + 0.3, MZ); // roof slab (outside face)
  for (const s of [-1, 1]) {
    add(B(0.5, HC - F + 0.6, LEN), concIn, s * (HW + 0.25), (HC + F) / 2, MZ); // structure
    const pw = add(new THREE.PlaneGeometry(LEN, HC - F), plaster, s * (HW - 0.01), (HC + F) / 2, MZ); pw.rotation.y = -s * Math.PI / 2;
    add(B(0.12, 2.6, LEN), oak, s * (HW - 0.07), F + 1.3, MZ); // panelling
    add(B(0.18, 0.12, LEN), oakDark, s * (HW - 0.1), F + 2.62, MZ);
    add(B(0.3, 0.35, LEN), plaster, s * (HW - 0.14), HC - 0.2, MZ); // cornice
    for (let z = -7; z > LZ1 + 2; z -= 6.5) add(B(0.36, HC - F - 2.6, 0.7), plaster, s * (HW - 0.18), (HC + F + 2.6) / 2, z); // pilasters
  }
  // entrance wall with glazed doors (north), and the canopy and signs outside
  const doorW = 6, doorH = 4.6;
  add(B(HW - doorW / 2, HC - F, 0.5), concIn, -(HW + doorW / 2) / 2, (HC + F) / 2, LZ0 + 0.25);
  add(B(HW - doorW / 2, HC - F, 0.5), concIn, (HW + doorW / 2) / 2, (HC + F) / 2, LZ0 + 0.25);
  add(B(doorW, HC - F - doorH, 0.5), concIn, 0, F + doorH + (HC - F - doorH) / 2, LZ0 + 0.25);
  const inner = add(new THREE.PlaneGeometry(2 * HW, HC - F), plaster, 0, (HC + F) / 2, LZ0 - 0.01); inner.rotation.y = Math.PI; inner.visible = false;
  const glassM = plainMaterial({ color: '#a9c0cc', roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false }, 'h-glass');
  for (const s of [-1, 1]) { const d = add(new THREE.PlaneGeometry(doorW / 2 - 0.1, doorH - 0.1), glassM, s * (doorW / 4 + 1.2), F + doorH / 2, LZ0 + 0.4); d.rotation.y = Math.PI + s * 0.9; }
  for (const x of [-doorW / 2, 0, doorW / 2]) add(B(0.12, doorH, 0.14), iron, x, F + doorH / 2, LZ0 + 0.5);
  add(B(doorW + 4, 0.35, 3.2), concIn, 0, F + doorH + 0.6, LZ0 + 1.9); // canopy
  const fasc = add(new THREE.PlaneGeometry(doorW + 4, 1.25), signMat([['Imperial College London', 116, 700, 104, 60], ['Sherfield Building  ·  Queen’s Tower Rooms', 62, 500, 214, 64]], 2048, 256), 0, F + doorH + 0.6, LZ0 + 3.52);
  fasc.scale.set(1, 1, 1);
  const plaque = add(new THREE.PlaneGeometry(2.8, 0.75), signMat([['Imperial College', 84, 700, 80, 40], ['London', 84, 400, 180, 40]], 1024, 256), -6.2, F + 3.2, LZ0 + 0.52);
  plaque.rotation.y = 0;
  // the glass south wall looking across to the Queen's Tower: mullions, transoms and a frosted band
  const glassWall = add(new THREE.PlaneGeometry(2 * HW, HC - F), plainMaterial({ color: '#9fb6c2', roughness: 0.03, metalness: 0.3, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }, 'h-gwall'), 0, (HC + F) / 2, LZ1);
  glassWall.rotation.y = 0;
  const mull = [];
  for (let x = -HW; x <= HW + 0.01; x += 2.33) mull.push(M(x, (HC + F) / 2, LZ1, 0.14, HC - F, 0.22));
  for (const y of [F + 0.15, F + 3.6, F + 7.3, HC - 0.1]) mull.push(M(0, y, LZ1, 2 * HW, 0.14, 0.22));
  addInst(lib, B(1, 1, 1), plainMaterial({ color: '#2a2e33', roughness: 0.35, metalness: 0.7 }, 'h-mull'), mull);
  const etch = add(new THREE.PlaneGeometry(2 * HW, 0.42), new THREE.MeshBasicMaterial({ map: etchTex(), transparent: true, opacity: 0.85, depthWrite: false }), 0, F + 1.55, LZ1 + 0.03);
  etch.rotation.y = 0;

  // banners in Imperial blue between the pilasters
  let bi = 0;
  for (let z = -10.25; z > LZ1 + 6; z -= 13) for (const s of [-1, 1]) {
    const b = add(new THREE.PlaneGeometry(1.7, 5.1), plainMaterial({ map: bannerTex(bi % 2 ? ['Faculty of', 'Natural Sciences'] : ['Queen’s Tower Rooms', 'South Kensington']), roughness: 0.75 }, 'h-ban' + bi++), s * (HW - 0.06), F + 5.6, z);
    b.rotation.y = -s * Math.PI / 2;
    add(B(0.06, 0.06, 1.9), brass, s * (HW - 0.12), F + 8.2, z);
  }
  // portraits in gilt frames between the banners
  const frameMat = plainMaterial({ color: '#a8823b', roughness: 0.32, metalness: 1 }, 'h-frame');
  let seed = 60;
  for (let z = -16.75; z > LZ1 + 6; z -= 13) for (const s of [-1, 1]) {
    const w = 1.6, h = 2.1;
    const p = add(new THREE.PlaneGeometry(w, h), plainMaterial({ map: paintingTex(seed % 3 ? 'portrait' : 'landscape', seed), roughness: 0.7 }, 'h-paint' + seed), s * (HW - 0.06), F + 5.2, z);
    p.rotation.y = -s * Math.PI / 2;
    const grp = new THREE.Group(); grp.position.set(s * (HW - 0.06), F + 5.2, z); grp.rotation.y = -s * Math.PI / 2; lib.add(grp);
    const t = 0.13;
    [[0, h / 2 + t / 2, w + 2 * t, t], [0, -h / 2 - t / 2, w + 2 * t, t], [w / 2 + t / 2, 0, t, h], [-w / 2 - t / 2, 0, t, h]].forEach(([fx, fy, fw, fh]) => { const bb = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.1), frameMat); bb.position.set(fx, fy, 0.02); grp.add(bb); });
    seed++;
  }

  // modern ring chandeliers: brass rings with warm LED bands, on three cables
  const out = { lights: [] };
  const ringsB = [], cables = [];
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.5, 1.5) });
  [-12, -24, -36, -48].forEach((cz) => {
    const cy = F + 7.6;
    for (const [rad, dy] of [[2.1, 0], [1.4, -0.5]]) {
      ringsB.push(M(0, cy + dy, cz, rad, rad, rad, Math.PI / 2));
      const led = add(new THREE.TorusGeometry(rad, 0.03, 6, 64), ledMat, 0, cy + dy - 0.06, cz); led.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; cables.push(between(new THREE.Vector3(Math.cos(a) * 2.1, cy, cz + Math.sin(a) * 2.1), new THREE.Vector3(0, HC, cz), 0.008)); }
    const pl = new THREE.PointLight(0xffcf98, 70, 0, 2); pl.position.set(0, cy - 0.6, cz); lib.add(pl); out.lights.push([pl, 70]);
  });
  addInst(lib, new THREE.TorusGeometry(1, 0.06, 10, 64), brass, ringsB);
  addInst(lib, limbGeo, iron, cables);

  // the exam: rows of desks, students writing, papers, pens, water bottles, ID cards; invigilators walking the aisles
  const r2 = rng(2027);
  const deskTop = [], deskLeg = [], chairSeat = [], chairBack = [], chairLeg = [];
  const torso = [], headsS = [], hair = [], limbs = [], legs = [], shoes = [];
  const papers = [], pens = [], bottles = [], cards = [], booklets = [];
  const CLOTH = ['#1c2433', '#2a2a2c', '#141416', '#8b6f4e', '#5a1f24', '#233a2e', '#d9d2c4', '#3c4b5f', '#6b6b70', '#2b3d5a'];
  const SKIN = ['#f1c7a5', '#e0ac85', '#c68863', '#a86b47', '#7d4a2f', '#5a3424'];
  const HAIR = ['#1b1410', '#3a2416', '#6b4a2b', '#a7824f', '#2b2b2b', '#0f0c0a'];
  const pick = (a) => new THREE.Color(a[Math.floor(r2() * a.length)]);
  const TOP = F + 0.74;
  const student = (sx, sz) => {
    const cloth = pick(CLOTH), skin = pick(SKIN), hc = pick(HAIR);
    const lean = 0.22 + r2() * 0.14;
    const hip = new THREE.Vector3(sx, F + 0.5, sz);
    const sh = new THREE.Vector3(sx, F + 1.0, sz - (0.1 + lean * 0.5));
    torso.push({ m: new THREE.Matrix4().compose(hip.clone().lerp(sh, 0.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -lean), new THREE.Vector3(0.2, 0.25, 0.13)), c: cloth });
    const head = new THREE.Vector3(sx + (r2() - 0.5) * 0.05, F + 1.2, sz - (0.24 + lean * 0.6));
    headsS.push({ m: M(head.x, head.y, head.z, 0.095, 0.12, 0.1), c: skin });
    hair.push({ m: M(head.x, head.y + 0.035, head.z + 0.012, 0.104, 0.1, 0.108), c: hc });
    const writing = r2() < 0.75;
    for (const side of [-1, 1]) {
      const s0 = new THREE.Vector3(sx + side * 0.19, sh.y - 0.04, sh.z);
      const el = new THREE.Vector3(sx + side * 0.25, TOP + 0.04, sz - 0.42);
      const onHead = !writing && side < 0;
      const hd = onHead ? new THREE.Vector3(head.x - 0.08, head.y - 0.06, head.z + 0.02) : new THREE.Vector3(sx + side * (0.08 + r2() * 0.06), TOP + 0.05, sz - 0.68);
      limbs.push({ m: between(s0, el, 0.048), c: cloth });
      limbs.push({ m: between(el, hd, 0.038), c: cloth });
      headsS.push({ m: M(hd.x, hd.y, hd.z, 0.045, 0.025, 0.04), c: skin });
      const k = new THREE.Vector3(sx + side * 0.1, F + 0.52, sz - 0.45);
      legs.push({ m: between(new THREE.Vector3(sx + side * 0.1, F + 0.5, sz), k, 0.07), c: new THREE.Color('#1f2228') });
      legs.push({ m: between(new THREE.Vector3(k.x, F + 0.06, k.z), k, 0.055), c: new THREE.Color('#1f2228') });
      shoes.push(M(k.x, F + 0.04, k.z - 0.06, 0.07, 0.06, 0.13));
    }
    if (writing) pens.push(M(sx + 0.12, TOP + 0.012, sz - 0.7, 0.008, 0.14, 0.008, 1.45, 0, 0.5));
  };
  const COLS = [-12.4, -10.2, -8.0, -5.8, -3.6, -1.6, 1.6, 3.6, 5.8, 8.0, 10.2, 12.4];
  for (let sz = -8.4; sz > -41; sz -= 1.95) {
    COLS.forEach((sx) => {
      const dz = sz - 0.76;
      deskTop.push(M(sx, TOP - 0.02, dz, 0.82, 0.04, 0.58));
      for (const lx of [-0.37, 0.37]) for (const lz of [-0.25, 0.25]) deskLeg.push(M(sx + lx, F + (TOP - F) / 2, dz + lz, 0.03, TOP - F, 0.03));
      chairSeat.push(M(sx, F + 0.45, sz, 0.42, 0.04, 0.42));
      chairBack.push(M(sx, F + 0.74, sz + 0.2, 0.42, 0.5, 0.04, -0.08));
      for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) chairLeg.push(M(sx + lx, F + 0.22, sz + lz, 0.03, 0.45, 0.03));
      booklets.push(M(sx + 0.04, TOP + 0.006, dz + 0.02, 0.21, 0.008, 0.297, 0, (r2() - 0.5) * 0.2));
      papers.push(M(sx - 0.24, TOP + 0.004, dz - 0.02, 0.21, 0.004, 0.297, 0, (r2() - 0.5) * 0.3));
      bottles.push(M(sx + 0.33, TOP + 0.11, dz - 0.2, 0.035, 0.22, 0.035));
      cards.push(M(sx - 0.3, TOP + 0.004, dz + 0.2, 0.085, 0.003, 0.054, 0, (r2() - 0.5) * 0.4));
      if (r2() < (mobile ? 0.55 : 0.88)) student(sx, sz);
    });
  }
  // invigilators standing and walking the aisles
  const standing = (x, z, face) => {
    const cloth = pick(['#22252b', '#2f3a4a', '#4a3f35']), skin = pick(SKIN);
    torso.push({ m: M(x, F + 1.27, z, 0.2, 0.3, 0.13), c: cloth });
    headsS.push({ m: M(x, F + 1.7, z, 0.095, 0.12, 0.1), c: skin });
    hair.push({ m: M(x, F + 1.74, z + 0.01 * face, 0.104, 0.1, 0.108), c: pick(HAIR) });
    for (const side of [-1, 1]) {
      legs.push({ m: between(new THREE.Vector3(x + side * 0.1, F, z + side * 0.06), new THREE.Vector3(x + side * 0.1, F + 0.95, z), 0.07), c: new THREE.Color('#1d2026') });
      limbs.push({ m: between(new THREE.Vector3(x + side * 0.22, F + 1.5, z), new THREE.Vector3(x + side * 0.26, F + 0.95, z - face * 0.05), 0.045), c: cloth });
      shoes.push(M(x + side * 0.1, F + 0.04, z - face * 0.05, 0.07, 0.06, 0.13));
    }
  };
  standing(-0.2, -22, 1); standing(6.9, -33, -1); standing(-7.2, -14, 1); standing(-9, -50.5, 1);
  const wood2 = plainMaterial({ color: '#5a3c25', roughness: 0.42 }, 'h-desk');
  addInst(lib, B(1, 1, 1), wood2, deskTop, { cast: true });
  addInst(lib, B(1, 1, 1), iron, deskLeg);
  addInst(lib, B(1, 1, 1), plainMaterial({ color: '#2b2f36', roughness: 0.6 }, 'h-chair'), chairSeat);
  addInst(lib, B(1, 1, 1), plainMaterial({ color: '#2b2f36', roughness: 0.6 }, 'h-chair2'), chairBack);
  addInst(lib, B(1, 1, 1), iron, chairLeg);
  const cloth = plainMaterial({ roughness: 0.85 }, 'h-cloth');
  addInst(lib, new THREE.CapsuleGeometry(1, 1.2, 6, 16), cloth, torso, { color: true });
  addInst(lib, new THREE.SphereGeometry(1, 20, 14), plainMaterial({ roughness: 0.6 }, 'h-skin'), headsS, { color: true });
  addInst(lib, new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), plainMaterial({ roughness: 0.75 }, 'h-hair'), hair, { color: true });
  addInst(lib, limbGeo, cloth, limbs, { color: true });
  addInst(lib, limbGeo, cloth, legs, { color: true });
  addInst(lib, B(1, 1, 1), plainMaterial({ color: '#141210', roughness: 0.4 }, 'h-shoe'), shoes);
  addInst(lib, B(1, 1, 1), plainMaterial({ color: '#f3f1ea', roughness: 0.9 }, 'h-paper'), papers);
  addInst(lib, B(1, 1, 1), plainMaterial({ color: '#dfe6ee', roughness: 0.9 }, 'h-booklet'), booklets);
  addInst(lib, new THREE.CylinderGeometry(1, 1, 1, 8), plainMaterial({ color: '#111318', roughness: 0.3, metalness: 0.5 }, 'h-pen'), pens);
  addInst(lib, new THREE.CylinderGeometry(1, 1, 1, 12), plainMaterial({ color: '#cfe3ee', roughness: 0.05, transparent: true, opacity: 0.45 }, 'h-bottle'), bottles);
  addInst(lib, B(1, 1, 1), plainMaterial({ color: NAVY, roughness: 0.5 }, 'h-card'), cards);

  // front of the hall: invigilators' table, the exam board, the clock, pull-up banners, plants
  add(B(3.2, 0.06, 1.0), oak, -9, TOP, -52.5);
  for (const lx of [-1.5, 1.5]) add(B(0.06, TOP - F, 0.9), oak, -9 + lx, F + (TOP - F) / 2, -52.5);
  for (let i = 0; i < 5; i++) add(B(0.3, 0.12, 0.42), plainMaterial({ color: '#f1efe8', roughness: 0.9 }, 'h-pile'), -10 + i * 0.45, TOP + 0.06, -52.5);
  const board = add(new THREE.PlaneGeometry(3.4, 2.1), plainMaterial({ map: boardTex(), roughness: 0.6, emissiveMap: null }, 'h-board'), -5.4, F + 2.4, -57.2);
  board.rotation.y = 0.25;
  add(B(3.6, 0.12, 0.12), iron, -5.4, F + 1.3, -57.24).rotation.y = 0.25;
  for (const lx of [-1.6, 1.6]) { const leg = add(B(0.06, 2.6, 0.06), iron, -5.4 + lx * Math.cos(0.25), F + 1.3, -57.25 - lx * Math.sin(0.25)); leg.rotation.y = 0.25; }
  // the exam clock on a stand, facing the room
  const clk = new THREE.Group(); clk.position.set(5.6, F + 3.0, -55.6); lib.add(clk);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.9, 64), plainMaterial({ map: clockTex(), roughness: 0.5 }, 'h-clock')); clk.add(face);
  const bez = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.06, 16, 64), brass); clk.add(bez);
  const handMat = plainMaterial({ color: '#141210', roughness: 0.4, metalness: 0.4 }, 'h-hand');
  const hH = new THREE.Group(), mH = new THREE.Group(); hH.position.z = 0.03; mH.position.z = 0.035;
  const hB = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.02), handMat); hB.position.y = 0.21; hH.add(hB);
  const mB = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.74, 0.02), handMat); mB.position.y = 0.33; mH.add(mB);
  clk.add(hH, mH);
  out.clock = { hH, mH };
  add(B(0.08, 2.1, 0.08), iron, 5.6, F + 1.05, -55.7);
  add(new THREE.CylinderGeometry(0.4, 0.45, 0.05, 24), iron, 5.6, F + 0.03, -55.7);
  for (const x of [-12, 12]) {
    const pb = add(new THREE.PlaneGeometry(0.95, 2.2), plainMaterial({ map: bannerTex(['Examinations', '2026–27']), roughness: 0.6 }, 'h-pull' + x), x, F + 1.12, -58.6);
    pb.rotation.y = x < 0 ? 0.35 : -0.35;
    add(B(1.0, 0.08, 0.25), iron, x, F + 0.04, -58.6);
  }
  const leafM = leafMaterial('h-leaf', '#4d6a33');
  for (const x of [-13, 13]) {
    add(new THREE.CylinderGeometry(0.42, 0.34, 0.75, 20), plainMaterial({ color: '#2c2f33', roughness: 0.4 }, 'h-pot'), x, F + 0.37, -53.2);
    for (let i = 0; i < 9; i++) { const lf = add(new THREE.SphereGeometry(0.45, 10, 8), leafM, x + (r2() - 0.5) * 0.6, F + 1.2 + i * 0.22, -53.2 + (r2() - 0.5) * 0.6); lf.scale.set(1, 0.7, 1); }
  }

  // the desk at the front: the marked answer booklet, a pen, an Imperial ID card, a water bottle and the watch
  add(B(1.7, 0.06, 0.9), wood2, 0, F + 0.72, -46.1);
  for (const lx of [-0.78, 0.78]) for (const lz of [-0.38, 0.38]) add(B(0.05, 0.72, 0.05), iron, lx, F + 0.35, -46.1 + lz);
  add(B(0.48, 0.04, 0.46), plainMaterial({ color: '#2b2f36', roughness: 0.6 }, 'h-chair3'), 0, F + 0.45, -45.3);
  const paper = add(new THREE.PlaneGeometry(0.21, 0.297), plainMaterial({ map: paperTex(), roughness: 0.92 }, 'h-paperhero'), 0.02, F + 0.752, -46.06);
  paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.06;
  const pen = add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 10), plainMaterial({ color: '#0c0c10', metalness: 0.6, roughness: 0.3 }, 'h-penh'), 0.17, F + 0.756, -46.02);
  pen.rotation.x = Math.PI / 2; pen.rotation.z = 0.5;
  const card = add(new THREE.PlaneGeometry(0.0856, 0.054), plainMaterial({ map: cardTex(), roughness: 0.4 }, 'h-cardhero'), -0.34, F + 0.7515, -46.18);
  card.rotation.x = -Math.PI / 2; card.rotation.z = -0.18;
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 20), plainMaterial({ color: '#cfe3ee', roughness: 0.05, transparent: true, opacity: 0.45 }, 'h-bottleh'), 0.55, F + 0.86, -46.32);
  add(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 20), navyM, 0.55, F + 0.985, -46.32);
  out.watch = addWatch(lib, -0.2, F + 0.756, -45.92, 0.12);

  // morning light through the glass, and dust in the air
  const sh = shaftTex();
  const shaftMat = new THREE.MeshBasicMaterial({ map: sh, color: new THREE.Color(1.0, 0.48, 0.34), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const dir = new THREE.Vector3(0.35, -0.22, 1).normalize();
  for (let i = 0; i < 5; i++) {
    const s = add(new THREE.PlaneGeometry(2.0 + i * 0.5, 22), shaftMat, -9 + i * 4.2, 0, 0);
    s.position.set(-9 + i * 4.2, F + 6.5, LZ1 + 9).addScaledVector(dir, 2);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    s.rotateY(i * 0.6);
  }
  const N = mobile ? 600 : 1400;
  const pos = new Float32Array(N * 3), sd = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (r2() - 0.5) * 26; pos[i * 3 + 1] = F + 0.5 + r2() * 9; pos[i * 3 + 2] = -6 - r2() * 52; sd[i] = r2(); }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const dustU = { uTime: { value: 0 }, uSize: { value: mobile ? 10 : 13 }, uOpacity: { value: 0 } };
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  lib.add(dust);

  // interior lights: chandeliers, red dawn light from the glass, the desk
  const int = [...out.lights];
  const day = new THREE.PointLight(0xff9c84, 46, 0, 2); day.position.set(0, F + 6, LZ1 + 3); lib.add(day); int.push([day, 46]);
  const fill = new THREE.PointLight(0xffd2a8, 18, 0, 2); fill.position.set(0, F + 5, -8); lib.add(fill); int.push([fill, 18]);
  const deskLight = new THREE.PointLight(0xffd2a0, 0.5, 0, 2); deskLight.position.set(0.5, F + 1.6, -45.8); lib.add(deskLight); int.push([deskLight, 0.5]);

  // floodlights: the tower is lit from the lawn and the plaza, the dome from the Sherfield roof; lamps in the courtyard
  const ext = [];
  const flood = (x, y, z, tx, ty, tz, i, ang, col = 0xffe2c2) => { const sp = new THREE.SpotLight(col, i, 0, ang, 0.8, 2); sp.position.set(x, y, z); sp.target.position.set(tx, ty, tz); g.add(sp, sp.target); ext.push([sp, i]); };
  // the north face (seen from the exam hall) from the lawn by the Sherfield Building; the east faces from the plaza
  flood(26, 0.8, 4, 0, 15, 0, 6500, 0.6);
  flood(-20, 0.8, 22, 0, 42, 0, 9000, 0.34);
  flood(22, 0.8, 22, 0, 46, 0, 9000, 0.34);
  flood(30, SH + 1.5, 6, 0, 78, 0, 3500, 0.2, 0xfff0dc);
  flood(140, 6, -6, 92, 4, -6, 900, 0.7, 0xffd6a6);
  return { group: g, lib, int, ext, furn: out, dust: dustU, shaftMat };
}
