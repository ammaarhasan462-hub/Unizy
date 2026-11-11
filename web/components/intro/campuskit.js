// Shared pieces for the campus worlds (Queen Mary, LSE): textures (signs, ID card, answer booklet, banners), a frame
// helper for interiors placed inside a hero building, the desk with the marked booklet and the watch, morning
// light shafts and dust, bookcases, and the camera's closing moves onto the desk.
import * as THREE from 'three';
import { DUST_FS, DUST_VS } from './shaders';
import { canvasTex, plainMaterial, rng } from './materials';
import { addInst, addWatch, M } from './library';
import { shaftTex } from './ucl';

export const F = 1.21; // interior floor height, as in the UCL library and the Imperial hall

// a building frame: position + rotation about y; returns a mapper from local [x, y, z] to world
export function frame(px, pz, ry, py = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return ([x, y, z]) => [px + x * c + z * s, y + py, pz - x * s + z * c];
}

// the camera's closing moves onto the desk at (0, F + 0.72, DZ) in hall coordinates
export function deskTail(LOCAL, DZ) {
  const d = DZ + 46.1; // the Imperial / UCL desk sits at z = -46.1
  return [
    LOCAL(0.875, [-0.05, 2.48, -44.85 + d], [-0.2, 1.97, -45.92 + d]),
    LOCAL(0.93, [-0.165, 2.075, -45.835 + d], [-0.2, 1.972, -45.925 + d]),
    LOCAL(0.965, [-0.07, 2.2, -45.72 + d], [-0.04, 1.965, -45.97 + d]),
    LOCAL(1.0, [0.0, 2.24, -45.74 + d], [0.01, 1.962, -45.99 + d]),
  ];
}

export function signTex(lines, w = 1024, h = 256, bg = '#1b2a4a', fg = '#ffffff') {
  return canvasTex(w, h, (ctx, W, Hh) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = fg; ctx.textBaseline = 'middle';
    lines.forEach(([t, size, weight, y, x = 36]) => { ctx.font = `${weight} ${size}px Inter, "Helvetica Neue", Arial, sans-serif`; ctx.fillText(t, x, y); });
  });
}
export function signMat(lines, w, h, bg, fg, glow = 0.55) {
  const t = signTex(lines, w, h, bg, fg);
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: glow, roughness: 0.5 });
}

export function bannerTex(lines, bg, fg = '#ffffff') {
  return canvasTex(512, 1536, (ctx, W, Hh) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, Hh);
    const g = ctx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.2)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = fg; ctx.textBaseline = 'alphabetic';
    lines.forEach(([t, size, weight, y], i) => { ctx.font = `${weight} ${size}px Inter, "Helvetica Neue", Arial, sans-serif`; ctx.fillText(t, 54, y); });
  });
}

export function cardTex(name, colour, sub) {
  return canvasTex(512, 320, (ctx, W, Hh) => {
    ctx.fillStyle = '#f4f6f8'; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = colour; ctx.fillRect(0, 0, W, 92);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 38px Inter, Arial, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText(name, 26, 48);
    ctx.fillStyle = '#b8c1cb'; ctx.fillRect(26, 120, 120, 150);
    ctx.fillStyle = '#26303a'; ctx.font = '600 30px Inter, Arial, sans-serif';
    ctx.fillText('STUDENT', 176, 140);
    ctx.font = '400 26px Inter, Arial, sans-serif'; ctx.fillStyle = '#5a6570';
    ctx.fillText(sub, 176, 190);
    ctx.fillText('Valid to 07/2028', 176, 232);
    for (let x = 176; x < 480; x += 7) { ctx.fillStyle = '#26303a'; ctx.fillRect(x, 262, (x * 13) % 5 > 2 ? 4 : 2, 34); }
  });
}

// the answer booklet: heading, the question, a handwritten answer, the mark in the corner and two margin notes
export function paperTex({ head, colour, q, answer, grade, range, notes }) {
  return canvasTex(1240, 1754, (ctx, W, Hh) => {
    ctx.fillStyle = '#f5f2ea'; ctx.fillRect(0, 0, W, Hh);
    const g = ctx.createRadialGradient(W * 0.55, Hh * 0.4, 100, W * 0.5, Hh * 0.5, Hh * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(110,100,80,.14)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.strokeStyle = 'rgba(70,110,150,.22)'; ctx.lineWidth = 2;
    for (let y = 330; y < Hh - 80; y += 62) { ctx.beginPath(); ctx.moveTo(90, y); ctx.lineTo(W - 90, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(190,60,60,.35)'; ctx.beginPath(); ctx.moveTo(170, 0); ctx.lineTo(170, Hh); ctx.stroke();
    ctx.fillStyle = colour; ctx.font = '700 40px Inter, system-ui, sans-serif';
    ctx.fillText(head, 200, 120);
    ctx.font = '400 30px Inter, system-ui, sans-serif'; ctx.fillStyle = '#4a5560';
    q.forEach((l, i) => ctx.fillText(l, 200, 190 + i * 42));
    ctx.fillStyle = '#1d2a4a'; ctx.font = 'italic 400 36px Georgia, "Times New Roman", serif';
    answer.forEach((l, i) => ctx.fillText(l, 200, 318 + i * 62));
    ctx.strokeStyle = '#a97a26'; ctx.fillStyle = '#a97a26'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(1010, 150, 110, 78, -0.08, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '700 72px Georgia, serif'; ctx.fillText(grade, 950, 175);
    ctx.font = 'italic 400 32px Georgia, serif'; ctx.fillText(range, 960, 262);
    const tick = (x, y) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y + 18); ctx.lineTo(x + 46, y - 22); ctx.stroke(); };
    tick(110, 300); tick(110, 362); tick(110, 486);
    ctx.font = 'italic 400 30px Georgia, serif';
    ctx.fillText(notes[0], 610, 930);
    ctx.beginPath(); ctx.moveTo(600, 920); ctx.quadraticCurveTo(520, 900, 470, 380); ctx.stroke();
    ctx.fillText(notes[1], 760, 1000);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(200, 896); ctx.lineTo(560, 896); ctx.stroke();
  });
}

// the desk: booklet, pen, ID card, water bottle and the watch; returns the watch for the engine's clock hands
export function deskSet(lib, DZ, { paper, card, accent, deskMat, iron }) {
  const add = (geo, mat, x, y, z) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); lib.add(me); return me; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  add(B(1.7, 0.06, 0.9), deskMat, 0, F + 0.72, DZ);
  for (const lx of [-0.78, 0.78]) for (const lz of [-0.38, 0.38]) add(B(0.05, 0.72, 0.05), iron, lx, F + 0.35, DZ + lz);
  const pp = add(new THREE.PlaneGeometry(0.21, 0.297), plainMaterial({ map: paper, roughness: 0.92 }, 'k-paper-' + DZ), 0.02, F + 0.752, DZ + 0.04);
  pp.rotation.x = -Math.PI / 2; pp.rotation.z = 0.06;
  const pen = add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 10), plainMaterial({ color: '#0c0c10', metalness: 0.6, roughness: 0.3 }, 'k-pen'), 0.17, F + 0.756, DZ + 0.08);
  pen.rotation.x = Math.PI / 2; pen.rotation.z = 0.5;
  const cd = add(new THREE.PlaneGeometry(0.0856, 0.054), plainMaterial({ map: card, roughness: 0.4 }, 'k-card-' + DZ), -0.34, F + 0.7515, DZ - 0.08);
  cd.rotation.x = -Math.PI / 2; cd.rotation.z = -0.18;
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 20), plainMaterial({ color: '#cfe3ee', roughness: 0.05, transparent: true, opacity: 0.45 }, 'k-bottle'), 0.55, F + 0.86, DZ - 0.22);
  add(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 20), plainMaterial({ color: accent, roughness: 0.5 }, 'k-cap-' + accent), 0.55, F + 0.985, DZ - 0.22);
  return addWatch(lib, -0.2, F + 0.756, DZ + 0.18, 0.12);
}

// morning light shafts and dust in a box of the interior
export function lightAndDust(lib, { mobile, shafts, dust }) {
  const sh = shaftTex();
  const shaftMat = new THREE.MeshBasicMaterial({ map: sh, color: new THREE.Color(1.0, 0.5, 0.36), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  shafts.forEach(([x, y, z, w, len, dir, ry]) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, len), shaftMat);
    s.position.set(x, y, z);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...dir).normalize());
    s.rotateY(ry || 0);
    lib.add(s);
  });
  const r = rng(404);
  const N = mobile ? 600 : 1400;
  const pos = new Float32Array(N * 3), sd = new Float32Array(N);
  const [x0, x1, y0, y1, z0, z1] = dust;
  for (let i = 0; i < N; i++) { pos[i * 3] = x0 + r() * (x1 - x0); pos[i * 3 + 1] = y0 + r() * (y1 - y0); pos[i * 3 + 2] = z0 + r() * (z1 - z0); sd[i] = r(); }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const dustU = { uTime: { value: 0 }, uSize: { value: mobile ? 10 : 13 }, uOpacity: { value: 0 } };
  const pts = new THREE.Points(dg, new THREE.ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false;
  lib.add(pts);
  return { shaftMat, dustU };
}

// a bookcase run along a wall: uprights, shelves and instanced books (the realism pass prints their spines)
export function bookcases(lib, runs, { wood, books, mobile }) {
  const r = rng(808);
  const shelves = [], ups = [], bk = [];
  const COLS = ['#5a1a14', '#2c1a12', '#1e3326', '#1c2538', '#6e5232', '#3a2a1e', '#7c2c1e', '#55462e', '#4a3a5a', '#233b45'];
  runs.forEach(({ x0, z0, x1, z1, y0, rows, rowH = 0.42, depth = 0.34, face }) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    const ry = Math.atan2(-uz, ux);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // face: which side the spines look at (+1 = left of the run direction)
    const nx = -uz * face, nz = ux * face;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    for (let k = 0; k <= rows; k++) shelves.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, y0 + k * rowH, cz), q, new THREE.Vector3(L, 0.035, depth)));
    for (let s = 0; s <= L + 0.01; s += 0.95) ups.push(new THREE.Matrix4().compose(new THREE.Vector3(x0 + ux * s, y0 + (rows * rowH) / 2, z0 + uz * s), q, new THREE.Vector3(0.04, rows * rowH, depth + 0.02)));
    const step = mobile ? 0.06 : 0.04;
    for (let k = 0; k < rows; k++) {
      let s = 0.05;
      while (s < L - 0.05) {
        const t = 0.025 + r() * 0.035, h = rowH * (0.62 + r() * 0.3), d = depth * (0.7 + r() * 0.25);
        if (r() < 0.04) { s += 0.12; continue; }
        const lean = r() < 0.03 ? 0.25 : 0;
        const bq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, lean));
        const px = x0 + ux * (s + t / 2) + nx * (depth / 2 - d / 2) * 0.2, pz = z0 + uz * (s + t / 2) + nz * (depth / 2 - d / 2) * 0.2;
        // books are boxes whose spine is their +-x face: turn so the spine faces out of the shelf
        const m = new THREE.Matrix4().compose(new THREE.Vector3(px, y0 + k * rowH + 0.02 + h / 2, pz), bq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)), new THREE.Vector3(d, h, t));
        bk.push({ m, c: new THREE.Color(COLS[Math.floor(r() * COLS.length)]) });
        s += t + (r() < 0.1 ? 0.01 : 0.002);
        if (bk.length > (mobile ? 9000 : 24000)) break;
      }
    }
  });
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), wood, shelves);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), wood, ups);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), books, bk, { color: true });
}

export { M };
