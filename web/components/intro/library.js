// Furnishing for the intro's library reading room (local units: metres, floor at y = 1.21, hall x -17.5..17.5,
// z -3.5..-61): brass chandeliers, students at the reading tables, chairs, laptops and open books, oil paintings
// in gilt frames, marble busts, a long carpet runner, rolling ladders, entrance columns, a library clock, a globe,
// a leather-topped desk and a detailed wristwatch beside the marked answer.
import * as THREE from 'three';
import { canvasTex, plainMaterial, rng } from './materials';

const up = new THREE.Vector3(0, 1, 0);

export function addInst(parent, geo, mat, items, { cast = false, color = false } = {}) {
  if (!items.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    im.setMatrixAt(i, it.m || it);
    if (color && it.c) im.setColorAt(i, it.c);
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = cast;
  im.receiveShadow = true;
  im.frustumCulled = false;
  parent.add(im);
  return im;
}

// a unit cylinder from y=0 to y=1 placed between two points
export const limbGeo = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
export function between(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a);
  const q = new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize());
  return new THREE.Matrix4().compose(a, q, new THREE.Vector3(r, d.length(), r));
}
export const M = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// ------------------------------------------------------------------ textures
export function cofferTex() {
  return canvasTex(512, 512, (ctx, W) => {
    ctx.fillStyle = '#3a332b';
    ctx.fillRect(0, 0, W, W);
    const n = 4, s = W / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * s, y = j * s;
      ctx.fillStyle = '#5a5045'; ctx.fillRect(x + 6, y + 6, s - 12, s - 12);
      const g = ctx.createLinearGradient(x, y, x + s, y + s);
      g.addColorStop(0, '#2b251f'); g.addColorStop(1, '#4b4238');
      ctx.fillStyle = g; ctx.fillRect(x + 16, y + 16, s - 32, s - 32);
      ctx.strokeStyle = '#b08d4a'; ctx.lineWidth = 3; ctx.strokeRect(x + 16, y + 16, s - 32, s - 32);
      ctx.fillStyle = '#c29b52'; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, 9, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + s / 2 + Math.cos(a) * 15, y + s / 2 + Math.sin(a) * 15, 6, 3, a, 0, Math.PI * 2); ctx.fill(); }
    }
  }, { repeat: [8, 13] });
}

export function rugTex() {
  return canvasTex(256, 2048, (ctx, W, H) => {
    const r = rng(17);
    ctx.fillStyle = '#5a1418'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1d2a3a'; ctx.fillRect(14, 14, W - 28, H - 28);
    ctx.fillStyle = '#6b1a1d'; ctx.fillRect(26, 26, W - 52, H - 52);
    ctx.strokeStyle = '#c9a25c'; ctx.lineWidth = 3; ctx.strokeRect(20, 20, W - 40, H - 40); ctx.strokeRect(32, 32, W - 64, H - 64);
    for (let y = 140; y < H - 100; y += 220) {
      ctx.save(); ctx.translate(W / 2, y);
      ctx.fillStyle = '#1d2a3a'; ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(70, 0); ctx.lineTo(0, 70); ctx.lineTo(-70, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c9a25c'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#c9a25c'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.12})`; ctx.fillRect(r() * W, r() * H, 2, 2); }
  });
}

export function paintingTex(kind, seed) {
  return canvasTex(384, 512, (ctx, W, H) => {
    const r = rng(seed);
    const stroke = (x, y, w, h, c, a = 0.5) => { ctx.fillStyle = c; ctx.globalAlpha = a; ctx.beginPath(); ctx.ellipse(x, y, w, h, r() * 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; };
    if (kind === 'portrait') {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.4, 20, W * 0.5, H * 0.5, H * 0.7);
      g.addColorStop(0, '#4a3a28'); g.addColorStop(1, '#120d09');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#16110d'; ctx.beginPath(); ctx.moveTo(W * 0.12, H); ctx.quadraticCurveTo(W * 0.5, H * 0.52, W * 0.88, H); ctx.fill();
      ctx.fillStyle = '#e9e2d4'; ctx.beginPath(); ctx.moveTo(W * 0.42, H * 0.66); ctx.lineTo(W * 0.5, H * 0.78); ctx.lineTo(W * 0.58, H * 0.66); ctx.fill();
      const fg = ctx.createRadialGradient(W * 0.48, H * 0.4, 5, W * 0.5, H * 0.42, 70);
      fg.addColorStop(0, '#e7bf9a'); fg.addColorStop(1, '#8a5e40');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.42, 52, 66, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1d14'; ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.33, 58, 40, 0, Math.PI, 0); ctx.fill();
      for (let i = 0; i < 300; i++) stroke(r() * W, r() * H, 4 + r() * 10, 2 + r() * 5, `rgba(${30 + r() * 40},${22 + r() * 30},${14 + r() * 20},1)`, 0.08);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      g.addColorStop(0, '#5d6f80'); g.addColorStop(0.6, '#c9a87a'); g.addColorStop(1, '#a3825a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) stroke(r() * W, r() * H * 0.45, 30 + r() * 50, 10 + r() * 14, '#e9dcc4', 0.25);
      ctx.fillStyle = '#3c4a34'; ctx.beginPath(); ctx.moveTo(0, H * 0.62);
      for (let x = 0; x <= W; x += 24) ctx.lineTo(x, H * 0.6 - Math.sin(x * 0.02 + seed) * 30 - r() * 12);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      ctx.fillStyle = '#2a3322'; ctx.fillRect(0, H * 0.75, W, H * 0.25);
      for (let i = 0; i < 14; i++) { const x = r() * W, y = H * 0.55 + r() * H * 0.25; for (let k = 0; k < 8; k++) stroke(x + (r() - 0.5) * 30, y - r() * 40, 14, 10, '#1e2a1a', 0.7); }
      ctx.fillStyle = 'rgba(60,90,110,.6)'; ctx.fillRect(0, H * 0.82, W, H * 0.06);
      for (let i = 0; i < 400; i++) stroke(r() * W, r() * H, 3 + r() * 8, 2 + r() * 4, `rgba(${100 + r() * 100},${90 + r() * 90},${70 + r() * 70},1)`, 0.06);
    }
    ctx.fillStyle = 'rgba(80,60,20,.18)'; ctx.fillRect(0, 0, W, H);
  });
}

export function clockTex() {
  return canvasTex(1024, 1024, (ctx, W) => {
    const c = W / 2;
    const g = ctx.createRadialGradient(c, c, 50, c, c, c);
    g.addColorStop(0, '#f4ecd8'); g.addColorStop(1, '#ddd0b0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1612'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c, c, c * 0.92, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, c * 0.84, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; ctx.lineWidth = i % 5 ? 3 : 8; ctx.beginPath(); ctx.moveTo(c + Math.sin(a) * c * 0.84, c - Math.cos(a) * c * 0.84); ctx.lineTo(c + Math.sin(a) * c * 0.92, c - Math.cos(a) * c * 0.92); ctx.stroke(); }
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    ctx.fillStyle = '#1a1612'; ctx.font = '600 92px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    R.forEach((t, i) => { const a = (i / 12) * Math.PI * 2; ctx.save(); ctx.translate(c + Math.sin(a) * c * 0.69, c - Math.cos(a) * c * 0.69); ctx.rotate(a); ctx.fillText(t, 0, 0); ctx.restore(); });
    ctx.font = '500 34px Georgia, serif'; ctx.fillText('UNIZY · LONDON', c, c + c * 0.35);
  });
}

export function dialTex() {
  return canvasTex(1024, 1024, (ctx, W) => {
    const c = W / 2;
    const g = ctx.createRadialGradient(c, c, 10, c, c, c);
    g.addColorStop(0, '#1b2b4a'); g.addColorStop(0.7, '#0e1a30'); g.addColorStop(1, '#070d18');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    // sunburst
    for (let i = 0; i < 360; i++) { const a = (i / 360) * Math.PI * 2; ctx.strokeStyle = `rgba(255,255,255,${i % 2 ? 0.025 : 0.05})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); ctx.stroke(); }
    // minute track
    ctx.strokeStyle = 'rgba(235,235,240,.85)';
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c + Math.sin(a) * c * 0.9, c - Math.cos(a) * c * 0.9); ctx.lineTo(c + Math.sin(a) * c * 0.96, c - Math.cos(a) * c * 0.96); ctx.stroke(); }
    // applied indices
    for (let i = 0; i < 12; i++) {
      if (i === 3) continue;
      const a = (i / 12) * Math.PI * 2;
      ctx.save(); ctx.translate(c + Math.sin(a) * c * 0.72, c - Math.cos(a) * c * 0.72); ctx.rotate(a);
      const w = i === 0 ? 46 : 26, h = i === 0 ? 120 : 110;
      const ig = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      ig.addColorStop(0, '#9aa3ad'); ig.addColorStop(0.5, '#ffffff'); ig.addColorStop(1, '#8a929b');
      ctx.fillStyle = ig; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#e8f0e4'; ctx.fillRect(-w / 2 + 6, -h / 2 + 8, w - 12, h - 16);
      ctx.restore();
    }
    // date window at 3
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(c + c * 0.6, c - 34, 92, 68);
    ctx.fillStyle = '#111'; ctx.font = '700 52px Inter, Helvetica, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(new Date().getDate()), c + c * 0.6 + 46, c + 2);
    ctx.fillStyle = '#f1f1ee';
    ctx.font = '700 64px Georgia, serif'; ctx.fillText('UNIZY', c, c - c * 0.36);
    ctx.font = '500 30px Inter, Helvetica, sans-serif'; ctx.fillText('AUTOMATIC', c, c - c * 0.24);
    ctx.font = '500 26px Inter, Helvetica, sans-serif'; ctx.fillText('CHRONOMETER · LONDON', c, c + c * 0.42);
  });
}

export function globeTex() {
  return canvasTex(1024, 512, (ctx, W, H) => {
    const r = rng(8);
    ctx.fillStyle = '#c7b48a'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = H * 0.15 + r() * H * 0.7;
      ctx.fillStyle = '#7d6a44';
      ctx.beginPath();
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; const rr = 30 + r() * 60; ctx.lineTo(x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr); }
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(70,50,20,.35)'; ctx.lineWidth = 1.5;
    for (let x = 0; x < W; x += W / 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += H / 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  });
}

// ------------------------------------------------------------------ build
export function furnishLibrary(lib, { mobile }) {
  const r = rng(2026);
  const out = { lights: [] };
  const F = 1.21; // floor
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); lib.add(m); return m; };
  const brass = plainMaterial({ color: '#b58a3c', roughness: 0.28, metalness: 1 }, 'brass');
  const wood = plainMaterial({ color: '#2b1a10', roughness: 0.5 }, 'wood2');
  const marble = plainMaterial({ color: '#ece8e1', roughness: 0.22 }, 'marble');
  const flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 2.9, 1.6) });
  const crystalMat = plainMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0.1, emissive: '#ffe9c8', emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }, 'crystal');

  // carpet runner down the centre aisle
  const rug = add(new THREE.PlaneGeometry(3.2, 40), plainMaterial({ map: rugTex(), roughness: 0.95 }, 'rug'), 0, F + 0.006, -24);
  rug.rotation.x = -Math.PI / 2;
  rug.receiveShadow = true;

  // marble columns inside the entrance and at the far end
  const colG = new THREE.CylinderGeometry(0.42, 0.48, 16.4, 40);
  [[-6, -6.5], [6, -6.5], [-6, -55], [6, -55]].forEach(([x, z]) => {
    add(colG, marble, x, F + 0.6 + 8.2, z);
    add(new THREE.BoxGeometry(1.2, 0.6, 1.2), marble, x, F + 0.3, z);
    add(new THREE.BoxGeometry(1.25, 0.5, 1.25), brass, x, F + 17.05, z);
  });

  // chandeliers: two tiers of brass arms with candle bulbs and hanging crystals
  const rings = [], arms = [], cups = [], flames = [], crystals = [], stems = [];
  const chZ = [-11, -21, -31, -41];
  chZ.forEach((cz) => {
    const cy = 12.4;
    stems.push(M(0, cy + 0.2, cz, 0.06, 6.2, 0.06));
    [[1.5, 0], [0.95, 0.75]].forEach(([rad, dy], tier) => {
      rings.push(M(0, cy + dy, cz, rad, rad, rad, Math.PI / 2));
      const n = tier ? 8 : 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + tier * 0.2;
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        arms.push(between(new THREE.Vector3(0, cy + dy - 0.35, cz), new THREE.Vector3(x, cy + dy, cz + z), 0.022));
        cups.push(M(x, cy + dy + 0.02, cz + z, 0.07, 0.06, 0.07));
        flames.push(M(x, cy + dy + 0.13, cz + z, 0.035, 0.09, 0.035));
        crystals.push(M(x * 1.02, cy + dy - 0.22, cz + z * 1.02, 0.045, 0.09, 0.045));
        crystals.push(M(x * 0.7, cy + dy - 0.38, cz + z * 0.7, 0.035, 0.07, 0.035));
      }
    });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; crystals.push(M(Math.cos(a) * 0.5, cy - 0.9 - (i % 2) * 0.15, cz + Math.sin(a) * 0.5, 0.05, 0.11, 0.05)); }
    const pl = new THREE.PointLight(0xffc98a, 85, 0, 2);
    pl.position.set(0, cy - 0.4, cz);
    lib.add(pl);
    out.lights.push([pl, 85]);
  });
  addInst(lib, new THREE.TorusGeometry(1, 0.025, 8, 48), brass, rings);
  addInst(lib, limbGeo, brass, arms);
  addInst(lib, new THREE.CylinderGeometry(1, 0.8, 1, 12), brass, cups);
  addInst(lib, new THREE.SphereGeometry(1, 10, 8), flame, flames);
  addInst(lib, new THREE.OctahedronGeometry(1, 0), crystalMat, crystals);
  addInst(lib, new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0), brass, stems);

  // reading tables: chairs, students, laptops, books
  const chairSeat = [], chairBack = [], chairLeg = [];
  const torso = [], heads = [], hair = [], limbs = [], legs = [], shoes = [];
  const laptopB = [], laptopS = [], pagesL = [], bookStack = [];
  const CLOTH = ['#1c2433', '#2a2a2c', '#141416', '#8b6f4e', '#5a1f24', '#233a2e', '#d9d2c4', '#3c4b5f', '#6b6b70'];
  const SKIN = ['#f1c7a5', '#e0ac85', '#c68863', '#a86b47', '#7d4a2f', '#5a3424'];
  const HAIR = ['#1b1410', '#3a2416', '#6b4a2b', '#a7824f', '#2b2b2b', '#0f0c0a'];
  const pick = (a) => new THREE.Color(a[Math.floor(r() * a.length)]);
  const tableX = [-11.5, -5, 5, 11.5], tableZ = [-11, -20.5, -30];
  const TOP = F + 0.79; // table top
  const student = (sx, sz, f) => {
    // f: direction the student faces along x (+1 or -1)
    const cloth = pick(CLOTH), skin = pick(SKIN), hc = pick(HAIR);
    const lean = 0.18 + r() * 0.12;
    const hip = new THREE.Vector3(sx, F + 0.5, sz);
    const sh = new THREE.Vector3(sx + f * (0.1 + lean * 0.5), F + 1.02, sz);
    torso.push({ m: new THREE.Matrix4().compose(hip.clone().lerp(sh, 0.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -f * lean), new THREE.Vector3(0.13, 0.25, 0.2)), c: cloth });
    const head = new THREE.Vector3(sx + f * (0.22 + lean * 0.6), F + 1.24, sz + (r() - 0.5) * 0.05);
    heads.push({ m: M(head.x, head.y, head.z, 0.1, 0.12, 0.095), c: skin });
    hair.push({ m: M(head.x - f * 0.012, head.y + 0.035, head.z, 0.108, 0.1, 0.104), c: hc });
    for (const side of [-1, 1]) {
      const s0 = new THREE.Vector3(sh.x, sh.y - 0.04, sz + side * 0.19);
      const el = new THREE.Vector3(sx + f * 0.42, TOP + 0.04, sz + side * 0.24);
      const hd = new THREE.Vector3(sx + f * 0.66, TOP + 0.05, sz + side * (0.06 + r() * 0.08));
      limbs.push({ m: between(s0, el, 0.048), c: cloth });
      limbs.push({ m: between(el, hd, 0.038), c: cloth });
      heads.push({ m: M(hd.x, hd.y, hd.z, 0.04, 0.025, 0.045), c: skin });
      const k = new THREE.Vector3(sx + f * 0.45, F + 0.52, sz + side * 0.1);
      legs.push({ m: between(new THREE.Vector3(sx, F + 0.5, sz + side * 0.1), k, 0.07), c: new THREE.Color('#1f2228') });
      legs.push({ m: between(new THREE.Vector3(k.x, F + 0.06, k.z), k, 0.055), c: new THREE.Color('#1f2228') });
      shoes.push(M(k.x + f * 0.06, F + 0.04, k.z, 0.13, 0.06, 0.07));
    }
    if (r() < 0.45) {
      laptopB.push(M(sx + f * 0.75, TOP + 0.008, sz, 0.23, 0.014, 0.32));
      laptopS.push(M(sx + f * 0.88, TOP + 0.12, sz, 0.012, 0.22, 0.31, 0, 0, f * 0.28));
    } else {
      pagesL.push(M(sx + f * 0.74, TOP + 0.012, sz - 0.09, 0.2, 0.012, 0.15, 0, 0.05, 0.05));
      pagesL.push(M(sx + f * 0.74, TOP + 0.012, sz + 0.09, 0.2, 0.012, 0.15, 0, -0.05, -0.05));
    }
  };
  tableX.forEach((tx) => tableZ.forEach((tz) => {
    for (const s of [-1, 1]) {
      for (const dz of [-2.7, -0.9, 0.9, 2.7]) {
        const cx = tx + s * 1.25, cz = tz + dz;
        const f = -s;
        chairSeat.push(M(cx, F + 0.46, cz, 0.44, 0.05, 0.44));
        chairBack.push(M(cx + s * 0.21, F + 0.75, cz, 0.04, 0.55, 0.42, 0, 0, s * 0.08));
        for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) chairLeg.push(M(cx + lx, F + 0.22, cz + lz, 0.035, 0.46, 0.035));
        const occ = mobile ? 0.35 : 0.58;
        if (r() < occ && Math.abs(tx) + s * Math.sign(tx) * 1.25 > 4.2) student(cx + s * 0.05, cz, f);
        else if (r() < 0.6) {
          const n = 1 + Math.floor(r() * 4);
          for (let k = 0; k < n; k++) bookStack.push({ m: M(tx + s * 0.55, TOP + 0.02 + k * 0.035, cz + (r() - 0.5) * 0.1, 0.18 + r() * 0.06, 0.032, 0.24 + r() * 0.04, 0, r() * 0.4), c: pick(['#4d0f0c', '#123321', '#6b4b26', '#1b2740', '#2a2a2a']) });
        }
      }
    }
  }));
  // a few people browsing the shelves
  for (let i = 0; i < (mobile ? 2 : 6); i++) {
    const s = i % 2 ? 1 : -1;
    const x = s * 15.9, z = -12 - i * 7.5;
    const cloth = pick(CLOTH), skin = pick(SKIN);
    torso.push({ m: M(x, F + 1.25, z, 0.13, 0.28, 0.2), c: cloth });
    heads.push({ m: M(x, F + 1.66, z, 0.1, 0.12, 0.095), c: skin });
    hair.push({ m: M(x - s * 0.01, F + 1.7, z, 0.108, 0.1, 0.104), c: pick(HAIR) });
    for (const side of [-1, 1]) {
      legs.push({ m: between(new THREE.Vector3(x, F, z + side * 0.1), new THREE.Vector3(x, F + 0.92, z + side * 0.1), 0.07), c: new THREE.Color('#22252b') });
      limbs.push({ m: between(new THREE.Vector3(x, F + 1.46, z + side * 0.22), side > 0 && i % 3 === 0 ? new THREE.Vector3(x + s * 0.35, F + 1.9, z + 0.3) : new THREE.Vector3(x + s * 0.05, F + 0.9, z + side * 0.26), 0.045), c: cloth });
    }
  }
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), wood, chairSeat);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), wood, chairBack);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), wood, chairLeg);
  const cloth = plainMaterial({ roughness: 0.85 }, 'cloth');
  addInst(lib, new THREE.CapsuleGeometry(1, 1.2, 6, 16), cloth, torso, { color: true });
  addInst(lib, new THREE.SphereGeometry(1, 20, 14), plainMaterial({ roughness: 0.6 }, 'skin'), heads, { color: true });
  addInst(lib, new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), plainMaterial({ roughness: 0.75 }, 'hair'), hair, { color: true });
  addInst(lib, limbGeo, cloth, limbs, { color: true });
  addInst(lib, limbGeo, cloth, legs, { color: true });
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), plainMaterial({ color: '#141210', roughness: 0.4 }, 'shoe'), shoes);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), plainMaterial({ color: '#2f3237', roughness: 0.35, metalness: 0.7 }, 'laptop'), laptopB);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), plainMaterial({ color: '#222', emissive: '#c9d8ff', emissiveIntensity: 0.9, roughness: 0.2 }, 'screen'), laptopS);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), plainMaterial({ color: '#f0ebe0', roughness: 0.9 }, 'pages'), pagesL);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), plainMaterial({ roughness: 0.75 }, 'stack'), bookStack, { color: true });

  // oil paintings in gilt frames, between the high windows and on the end wall
  const frameMat = plainMaterial({ color: '#a8823b', roughness: 0.32, metalness: 1 }, 'frame');
  const paint = (x, y, z, w, h, ry, kind, seed) => {
    const p = add(new THREE.PlaneGeometry(w, h), plainMaterial({ map: paintingTex(kind, seed), roughness: 0.7 }, 'paint' + seed), x, y, z);
    p.rotation.y = ry;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; lib.add(g);
    const t = 0.14;
    [[0, h / 2 + t / 2, w + 2 * t, t], [0, -h / 2 - t / 2, w + 2 * t, t], [w / 2 + t / 2, 0, t, h], [-w / 2 - t / 2, 0, t, h]].forEach(([fx, fy, fw, fh]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.1), frameMat); b.position.set(fx, fy, 0.02); g.add(b);
    });
  };
  let seed = 1;
  for (let z = -12.5; z > -58; z -= 7) for (const s of [-1, 1]) paint(s * 17.38, 15.2, z, 2.0, 2.7, -s * Math.PI / 2, seed % 3 ? 'portrait' : 'landscape', seed++);
  paint(-9, 11.2, -60.86, 4.4, 3.2, 0, 'landscape', 40);
  paint(9, 11.2, -60.86, 4.4, 3.2, 0, 'landscape', 41);

  // marble busts on pedestals along the aisle
  [[-2.6, -8], [2.6, -8], [-2.6, -36], [2.6, -36]].forEach(([x, z], i) => {
    add(new THREE.BoxGeometry(0.62, 1.25, 0.62), marble, x, F + 0.62, z);
    add(new THREE.BoxGeometry(0.75, 0.08, 0.75), marble, x, F + 1.29, z);
    const sh = add(new THREE.SphereGeometry(1, 20, 12), marble, x, F + 1.48, z); sh.scale.set(0.27, 0.16, 0.16);
    add(new THREE.CylinderGeometry(0.065, 0.075, 0.16, 12), marble, x, F + 1.6, z);
    const hd = add(new THREE.SphereGeometry(1, 24, 18), marble, x, F + 1.77, z); hd.scale.set(0.11, 0.135, 0.12);
    hd.rotation.y = (i % 2 ? 1 : -1) * 0.5;
  });

  // rolling ladders against the lower shelves
  const rails = [], rungs = [];
  [[-1, -14], [1, -18], [-1, -27], [1, -33], [-1, -45], [1, -50]].forEach(([s, z]) => {
    const tilt = -s * 0.2;
    for (const dz of [-0.24, 0.24]) rails.push(M(s * 16.2, F + 2.7, z + dz, 0.05, 5.6, 0.06, 0, 0, tilt));
    for (let k = 0; k < 14; k++) { const y = F + 0.35 + k * 0.38; rungs.push(M(s * 16.2 + Math.sin(-tilt) * (y - F - 2.7), y, z, 0.04, 0.03, 0.5)); }
  });
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), brass, rails);
  addInst(lib, new THREE.BoxGeometry(1, 1, 1), brass, rungs);

  // library clock on the end wall
  const clockFace = add(new THREE.CircleGeometry(1.05, 64), plainMaterial({ map: clockTex(), roughness: 0.5 }, 'clock'), 0, 5.3, -60.84);
  add(new THREE.TorusGeometry(1.1, 0.07, 16, 64), brass, 0, 5.3, -60.82);
  const clk = new THREE.Group(); clk.position.set(0, 5.3, -60.78); lib.add(clk);
  const handMat = plainMaterial({ color: '#141210', roughness: 0.4, metalness: 0.4 }, 'hand');
  const hH = new THREE.Group(), mH = new THREE.Group();
  const hB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.02), handMat); hB.position.y = 0.24; hH.add(hB);
  const mB = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.02), handMat); mB.position.y = 0.38; mH.add(mB);
  clk.add(hH, mH);
  out.clock = { hH, mH };
  clockFace.receiveShadow = true;

  // globe on a stand beside the desk
  const gl = add(new THREE.SphereGeometry(0.34, 48, 32), plainMaterial({ map: globeTex(), roughness: 0.45 }, 'globe'), 1.65, F + 1.05, -45.6);
  gl.rotation.z = 0.41;
  const mer = add(new THREE.TorusGeometry(0.38, 0.012, 8, 64), brass, 1.65, F + 1.05, -45.6); mer.rotation.y = Math.PI / 2; mer.rotation.x = 0.41;
  add(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 12), wood, 1.65, F + 0.35, -45.6);
  add(new THREE.CylinderGeometry(0.28, 0.32, 0.05, 32), wood, 1.65, F + 0.03, -45.6);

  // leather inlay on the desk
  const leather = add(new THREE.PlaneGeometry(1.45, 0.7), plainMaterial({ color: '#173326', roughness: 0.6 }, 'leather'), 0, F + 0.7508, -46.1);
  leather.rotation.x = -Math.PI / 2;
  const tool = add(new THREE.PlaneGeometry(1.5, 0.75), plainMaterial({ color: '#8f7136', roughness: 0.4, metalness: 0.8 }, 'tool'), 0, F + 0.7503, -46.1);
  tool.rotation.x = -Math.PI / 2;

  out.watch = addWatch(lib, -0.2, F + 0.756, -45.92, 0.12);
  return out;
}

// the wristwatch (dial-up, 12 o'clock towards -z), shared by every university's desk
export function addWatch(parent, x, y, z, ry) {
  // the wristwatch, lying dial-up beside the marked answer (12 o'clock away from the viewer)
  const W = new THREE.Group();
  W.position.set(x, y, z);
  W.rotation.y = ry;
  parent.add(W);
  const steel = plainMaterial({ color: '#dfe3e8', roughness: 0.16, metalness: 1 }, 'steel');
  const brushed = plainMaterial({ color: '#c8cdd3', roughness: 0.38, metalness: 1 }, 'brushed');
  const caseM = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.021, 0.011, 96), steel); caseM.position.y = 0.0075; W.add(caseM);
  const bez = new THREE.Mesh(new THREE.TorusGeometry(0.0188, 0.0019, 24, 128), steel); bez.rotation.x = Math.PI / 2; bez.position.y = 0.0132; W.add(bez);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.0175, 96), plainMaterial({ map: dialTex(), roughness: 0.35, metalness: 0.3 }, 'dial'));
  dial.rotation.x = -Math.PI / 2; dial.position.y = 0.0131; W.add(dial);
  const handM = plainMaterial({ color: '#f2f4f6', roughness: 0.15, metalness: 1, emissive: '#d9e8d8', emissiveIntensity: 0.15 }, 'whand');
  const mkHand = (len, wid, col) => {
    const g = new THREE.Group(); g.position.y = 0.0136;
    const b = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.0004, len), col || handM); b.position.z = -len * 0.42; g.add(b);
    W.add(g); return g;
  };
  const hourH = mkHand(0.0095, 0.0016), minH = mkHand(0.0142, 0.0011);
  const secM = plainMaterial({ color: '#c92b26', roughness: 0.3, emissive: '#3a0705' }, 'sec');
  const secH = mkHand(0.0165, 0.00045, secM);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.001, 24), steel); cap.position.y = 0.0141; W.add(cap);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.0182, 96), plainMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12 }, 'crystal2'));
  glass.rotation.x = -Math.PI / 2; glass.position.y = 0.0145; W.add(glass);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.004, 24), steel); crown.rotation.z = Math.PI / 2; crown.position.set(0.0228, 0.0075, 0); W.add(crown);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const lug = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.007, 0.008), steel); lug.position.set(sx * 0.0085, 0.006, sz * 0.022); W.add(lug); }
  const linksC = [], linksO = [];
  for (const sz of [-1, 1]) {
    for (let k = 0; k < 12; k++) {
      const z = sz * (0.0265 + k * 0.0072);
      const drop = Math.max(0, k - 3) * 0.0011;
      const y = Math.max(0.0018, 0.006 - drop);
      linksC.push(M(0, y, z, 0.0062, 0.0032, 0.0066));
      linksO.push(M(-0.0062, y, z, 0.0058, 0.0032, 0.0066));
      linksO.push(M(0.0062, y, z, 0.0058, 0.0032, 0.0066));
    }
  }
  addInst(W, new THREE.BoxGeometry(1, 1, 1), steel, linksC);
  addInst(W, new THREE.BoxGeometry(1, 1, 1), brushed, linksO);
  return { hourH, minH, secH };
}

// set clock and watch hands to the visitor's local time
export function tickLibrary(out) {
  const d = new Date();
  const s = d.getSeconds() + d.getMilliseconds() / 1000;
  const m = d.getMinutes() + s / 60;
  const h = (d.getHours() % 12) + m / 60;
  if (out.watch) {
    out.watch.secH.rotation.y = -(Math.floor(s * 8) / 8 / 60) * Math.PI * 2;
    out.watch.minH.rotation.y = -(m / 60) * Math.PI * 2;
    out.watch.hourH.rotation.y = -(h / 12) * Math.PI * 2;
  }
  if (out.clock) {
    out.clock.mH.rotation.z = -(m / 60) * Math.PI * 2;
    out.clock.hH.rotation.z = -(h / 12) * Math.PI * 2;
  }
}
