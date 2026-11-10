// UCL's Wilkins Building for the intro: the raised ten-column Portico and grand steps, the dome on its colonnaded
// drum, the north and south wings framing the Main Quad, the Gower Street lodges and railings, and inside, the
// library reading room with the desk and the marked answer. Portico faces east (+z). Units: metres.
import * as THREE from 'three';
import { DUST_FS, DUST_VS } from './shaders';
import { baseBox, canvasTex, facadeMaterial, leafMaterial, plainMaterial, rng, treeGeometry } from './materials';
import { SUN_DIR } from './atmo';
import { cofferTex, furnishLibrary, tickLibrary } from './library';
export { tickLibrary };

export const PODIUM = 4.5; // Portico and library floor height
const IN = PODIUM - 1.2; // the library interior was modelled with its floor at 1.2

export function stoneTex(rep = [14, 7]) {
  return canvasTex(512, 512, (ctx, W, H) => {
    const r = rng(9);
    ctx.fillStyle = '#c9bfab';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12000; i++) {
      const v = 170 + r() * 60;
      ctx.fillStyle = `rgba(${v},${v * 0.96},${v * 0.88},${0.05 + r() * 0.09})`;
      ctx.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
    }
    for (let i = 0; i < 40; i++) {
      const g = ctx.createRadialGradient(r() * W, r() * H, 0, r() * W, r() * H, 40 + r() * 80);
      g.addColorStop(0, 'rgba(90,82,70,.045)');
      g.addColorStop(1, 'rgba(90,82,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.strokeStyle = 'rgba(80,72,60,.2)';
    ctx.lineWidth = 2;
    for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let y = 0; y < H; y += 64) for (let x = ((y / 64) % 2) * 64; x < W; x += 128) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke(); }
  }, { repeat: rep });
}

export function ribTex() {
  return canvasTex(512, 256, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7d8381');
    g.addColorStop(1, '#5f6563');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(30,34,34,.55)';
    for (let i = 0; i < 24; i++) ctx.fillRect((i / 24) * W, 0, 3, H);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 24; i++) ctx.fillRect((i / 24) * W + 4, 0, 2, H);
  });
}

export function woodTex() {
  return canvasTex(1024, 1024, (ctx, W, H) => {
    const r = rng(3);
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, 0, W, H);
    const pw = W / 8;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 4; j++) {
        const y = j * (H / 4) + (i % 2) * (H / 8);
        const tone = 34 + r() * 26;
        ctx.fillStyle = `rgb(${tone + 22},${tone * 0.64 + 8},${tone * 0.38})`;
        ctx.fillRect(i * pw + 1, y + 1, pw - 2, H / 4 - 2);
        for (let k = 0; k < 26; k++) {
          ctx.strokeStyle = `rgba(20,10,4,${0.06 + r() * 0.1})`;
          ctx.lineWidth = 1 + r() * 2;
          const x = i * pw + r() * pw;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.bezierCurveTo(x + r() * 8 - 4, y + H / 12, x + r() * 8 - 4, y + H / 6, x + r() * 6 - 3, y + H / 4);
          ctx.stroke();
        }
      }
    }
  }, { repeat: [5, 8] });
}

export function windowTex() {
  return canvasTex(256, 512, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(0, W / 2); ctx.arc(W / 2, W / 2, W / 2, Math.PI, 0); ctx.lineTo(W, H); ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#fff3dc');
    g.addColorStop(1, '#e9d2a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#2a2420';
    ctx.lineWidth = 7;
    for (let x = W / 3; x < W; x += W / 3) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = W / 2; y < H; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
  });
}

export function shaftTex() {
  return canvasTex(64, 256, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const v = ctx.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.15, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  });
}

const ANSWER = [
  'A monopolist maximises profit where MR = MC.',
  'Since MR = P(1 + 1/ε) and MC > 0, MR must be',
  'positive, so 1 + 1/ε > 0, which means |ε| > 1.',
  'Demand is therefore elastic at the chosen',
  'output. Intuitively, on the inelastic part,',
  'cutting output would raise revenue and lower',
  'costs, so the firm would not stop there.',
  'This is why a profit-maximising monopolist',
  'never produces on the inelastic section of',
  'the demand curve.',
];

export function paperTex() {
  return canvasTex(1240, 1754, (ctx, W, H) => {
    ctx.fillStyle = '#f5f1e8';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.55, H * 0.4, 100, W * 0.5, H * 0.5, H * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(120,100,70,.14)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(70,110,150,.22)';
    ctx.lineWidth = 2;
    for (let y = 330; y < H - 80; y += 62) { ctx.beginPath(); ctx.moveTo(90, y); ctx.lineTo(W - 90, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(190,60,60,.35)';
    ctx.beginPath(); ctx.moveTo(170, 0); ctx.lineTo(170, H); ctx.stroke();
    ctx.fillStyle = '#26303a';
    ctx.font = '600 44px Inter, system-ui, sans-serif';
    ctx.fillText('ECON0013 · Microeconomics', 200, 140);
    ctx.font = '400 32px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#4a5560';
    ctx.fillText('Question 3: Explain why a profit-maximising monopolist', 200, 200);
    ctx.fillText('always produces on the elastic part of the demand curve.', 200, 244);
    ctx.fillStyle = '#1d2a4a';
    ctx.font = 'italic 400 38px Georgia, "Times New Roman", serif';
    ANSWER.forEach((l, i) => ctx.fillText(l, 200, 318 + i * 62));
    ctx.strokeStyle = '#a97a26';
    ctx.fillStyle = '#a97a26';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(1010, 150, 110, 78, -0.08, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '700 72px Georgia, serif';
    ctx.fillText('2:1', 950, 175);
    ctx.font = 'italic 400 32px Georgia, serif';
    ctx.fillText('62–66', 960, 262);
    const tick = (x, y) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y + 18); ctx.lineTo(x + 46, y - 22); ctx.stroke(); };
    tick(110, 300); tick(110, 362); tick(110, 486);
    ctx.font = 'italic 400 30px Georgia, serif';
    ctx.fillText('derive MR = P(1+1/ε) first', 610, 930);
    ctx.beginPath(); ctx.moveTo(600, 920); ctx.quadraticCurveTo(520, 900, 470, 380); ctx.stroke();
    ctx.fillText('add the diagram →', 760, 1000);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(200, 896); ctx.lineTo(560, 896); ctx.stroke();
  });
}

function flutedColumn(r0, r1, h) {
  const geo = new THREE.CylinderGeometry(r0, r1, h, 72, 6);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const rr = Math.hypot(v.x, v.z);
    if (rr < 1e-4) continue;
    const th = Math.atan2(v.z, v.x);
    const k = 1 - 0.05 * Math.pow(Math.abs(Math.cos(th * 12)), 0.6);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildUCL({ mobile }) {
  const g = new THREE.Group();
  const P = PODIUM;
  const stone = plainMaterial({ map: stoneTex(), color: '#efe8da', roughness: 0.82 }, 'stone');
  const stoneSmooth = plainMaterial({ color: '#e2d9c6', roughness: 0.7 }, 'stone2');
  const colStone = plainMaterial({ color: '#ddd4c1', roughness: 0.68 }, 'colstone');
  const wingMat = facadeMaterial({ floor: 4.4, bay: 3.6, winW: 0.36, winH: 0.6, ground: 1.0, topPad: 2.4, lit: 0.32, litI: 2.0, color: '#ece4d2', frame: '#f3efe6', roof: '#7d7a73' });
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
  const M = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

  // ---- ranges and wings (with windows), cornices, balustrades
  box(wingMat, 18, 62, 0, 20, -24, -3);
  box(wingMat, -62, -18, 0, 20, -24, -3);
  box(wingMat, 46, 62, 0, 19, -3, 96);
  box(wingMat, -62, -46, 0, 19, -3, 96);
  box(wingMat, 43, 65, 0, 22, 96, 111);
  box(wingMat, -65, -43, 0, 22, 96, 111);
  const cornice = (x0, x1, y, z0, z1) => box(stoneSmooth, x0, x1, y, y + 0.9, z0, z1);
  cornice(17.4, 62.6, 20, -24.6, -2.4); cornice(-62.6, -17.4, 20, -24.6, -2.4);
  cornice(45.4, 62.6, 19, -2.4, 96); cornice(-62.6, -45.4, 19, -2.4, 96);
  cornice(42.4, 65.6, 22, 95.4, 111.6); cornice(-65.6, -42.4, 22, 95.4, 111.6);
  const bal = [];
  const balRow = (x0, z0, x1, z1, y) => {
    const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 0.62);
    for (let i = 0; i <= n; i++) bal.push(M(x0 + ((x1 - x0) * i) / n, y, z0 + ((z1 - z0) * i) / n, 0.26, 1.0, 0.26));
  };
  balRow(45.6, -2, 45.6, 95, 19.9); balRow(-45.6, -2, -45.6, 95, 19.9);
  balRow(18.5, -2.6, 45, -2.6, 20.9); balRow(-45, -2.6, -18.5, -2.6, 20.9);
  inst(new THREE.CylinderGeometry(0.5, 0.42, 1, 8).translate(0, 0.5, 0), stoneSmooth, bal, false);
  const rail = (x0, x1, z0, z1, y) => box(stoneSmooth, x0, x1, y, y + 0.22, z0, z1);
  rail(45.3, 45.9, -2, 95, 20.9); rail(-45.9, -45.3, -2, 95, 20.9); rail(18.5, 45, -2.9, -2.3, 21.9); rail(-45, -18.5, -2.9, -2.3, 21.9);
  // pilasters on the quad faces of the wings
  const pil = [];
  for (let z = 4; z < 94; z += 7.2) { pil.push(M(45.8, 0, z, 0.5, 18.6, 1.3)); pil.push(M(-45.8, 0, z, 0.5, 18.6, 1.3)); }
  for (let x = 22; x < 44; x += 7.2) { pil.push(M(x, 0, -2.8, 1.3, 19.6, 0.5)); pil.push(M(-x, 0, -2.8, 1.3, 19.6, 0.5)); }
  inst(bx, stoneSmooth, pil);

  // ---- central block (library hall): walls around the interior, with the doorway in the front wall
  box(wingMat, 17.5, 18.5, 0, 23.5, -62, -3);
  box(wingMat, -18.5, -17.5, 0, 23.5, -62, -3);
  box(wingMat, -18.5, 18.5, 0, 23.5, -62.5, -61.5);
  box(stone, -18.5, -2.6, 0, 23.5, -3.5, -2.5);
  box(stone, 2.6, 18.5, 0, 23.5, -3.5, -2.5);
  box(stone, -2.6, 2.6, P + 8.4, 23.5, -3.5, -2.5);
  box(stone, -2.6, 2.6, 0, P, -3.5, -2.5);
  box(plainMaterial({ color: '#8d877d', roughness: 0.9 }, 'roof'), -18.6, 18.6, 23.5, 24.3, -62.6, -2.4);
  // door surround and opened doors
  const doorWood = plainMaterial({ color: '#3a2a1c', roughness: 0.55 }, 'door');
  box(stoneSmooth, -3.3, -2.6, P, P + 9.1, -2.6, -2.2); box(stoneSmooth, 2.6, 3.3, P, P + 9.1, -2.6, -2.2); box(stoneSmooth, -3.3, 3.3, P + 8.4, P + 9.1, -2.6, -2.2);
  for (const s of [-1, 1]) {
    const d = shadowed(new THREE.Mesh(bx, doorWood));
    d.scale.set(2.55, 8.3, 0.18);
    d.geometry = bx;
    const pivot = new THREE.Group();
    pivot.position.set(s * 2.6, P, -3.0);
    pivot.rotation.y = s * -1.25;
    d.position.set(-s * 1.28, 0, 0);
    pivot.add(d);
    g.add(pivot);
  }
  // niches on the portico wall
  const niche = plainMaterial({ color: '#4a4339', roughness: 0.9 }, 'niche');
  for (const x of [-10, 10]) { box(niche, x - 1.6, x + 1.6, P + 2.5, P + 8.5, -2.55, -2.45); box(stoneSmooth, x - 2, x + 2, P + 8.5, P + 9.2, -2.6, -2.3); }

  // ---- podium, grand steps and cheek walls
  box(stone, -23, 23, 0, P, -3, 15);
  for (let i = 0; i < 15; i++) box(stoneSmooth, -17.5, 17.5, 0, (i + 1) * 0.3, 15, 27 - i * 0.8);
  box(stone, 17.5, 21, 0, P + 0.4, 15, 27); box(stone, -21, -17.5, 0, P + 0.4, 15, 27);
  box(stone, 21, 23, 0, P, 15, 22); box(stone, -23, -21, 0, P, 15, 22);

  // ---- the ten columns (+ returns), bases, capitals
  const colGeo = flutedColumn(0.76, 0.88, 13);
  const colPos = [];
  for (let i = 0; i < 10; i++) colPos.push([-20.25 + i * 4.5, 11.6]);
  for (const s of [-1, 1]) { colPos.push([s * 20.25, 7.2]); colPos.push([s * 20.25, 2.8]); }
  const shafts = [], bases = [], plinths = [], caps = [], abac = [];
  colPos.forEach(([x, z]) => {
    shafts.push(M(x, P + 0.9 + 6.5, z));
    plinths.push(M(x, P, z, 2.2, 0.42, 2.2));
    bases.push(M(x, P + 0.42, z));
    caps.push(M(x, P + 13.9, z));
    abac.push(M(x, P + 15.3, z, 2.5, 0.36, 2.5));
  });
  inst(colGeo, colStone, shafts);
  inst(bx, stoneSmooth, plinths);
  inst(new THREE.CylinderGeometry(0.95, 1.08, 0.48, 32).translate(0, 0.24, 0), stoneSmooth, bases);
  const capGeo = new THREE.CylinderGeometry(1.2, 0.86, 1.4, 32, 3).translate(0, 0.7, 0);
  { const p = capGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const th = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.08 * Math.sin(th * 8) * (y / 1.4); p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k); } capGeo.computeVertexNormals(); }
  inst(capGeo, colStone, caps);
  inst(bx, stoneSmooth, abac);

  // ---- entablature, dentils, pediment with raking cornices
  const T = P + 15.66;
  box(stone, -23.2, 23.2, T, T + 1.3, -3, 13.4);
  box(stone, -23.0, 23.0, T + 1.3, T + 2.7, -3, 13.1);
  box(stoneSmooth, -24.2, 24.2, T + 2.7, T + 3.6, -3.2, 14.2);
  const dent = [];
  for (let x = -22.8; x <= 22.8; x += 0.56) dent.push(M(x, T + 2.3, 13.2, 0.28, 0.4, 0.4));
  for (let z = -2.6; z <= 13; z += 0.56) { dent.push(M(23.15, T + 2.3, z, 0.4, 0.4, 0.28)); dent.push(M(-23.15, T + 2.3, z, 0.4, 0.4, 0.28)); }
  inst(bx, stoneSmooth, dent, false);
  const tri = new THREE.Shape();
  tri.moveTo(-23.6, 0); tri.lineTo(23.6, 0); tri.lineTo(0, 7.6); tri.closePath();
  const ped = shadowed(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 16.4, bevelEnabled: false }), stone));
  ped.position.set(0, T + 3.6, -3.2);
  g.add(ped);
  const rakeLen = Math.hypot(24.6, 7.9);
  const rakeAng = Math.atan2(7.9, 24.6);
  for (const s of [-1, 1]) {
    const rk = shadowed(new THREE.Mesh(bx, stoneSmooth));
    rk.scale.set(rakeLen, 0.85, 1.4);
    rk.position.set(s * 12.1, T + 3.45 + 3.9, 13.6);
    rk.rotation.z = -s * rakeAng;
    rk.position.y -= 0.42;
    g.add(rk);
  }
  const tymp = shadowed(new THREE.Mesh(new THREE.ShapeGeometry(tri), plainMaterial({ color: '#cfc5b1', roughness: 0.85 }, 'tymp')));
  tymp.scale.set(0.9, 0.82, 1);
  tymp.position.set(0, T + 3.9, 13.25);
  g.add(tymp);

  // ---- the dome: drum with a ring of columns, ribbed lead dome, lantern and finial
  const DZ = -27, DY = 24.3;
  const drum = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(10.4, 10.4, 7, 64), stone));
  drum.position.set(0, DY + 3.5, DZ);
  g.add(drum);
  const dwin = plainMaterial({ color: '#2b2a28', roughness: 0.3 }, 'dwin');
  const ring = [], rwin = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ring.push(M(Math.cos(a) * 11.4, DY + 0.4 + 2.9, DZ + Math.sin(a) * 11.4));
    const b = a + Math.PI / 16;
    rwin.push(M(Math.cos(b) * 10.42, DY + 1.6, DZ + Math.sin(b) * 10.42, 1.4, 3.6, 0.2, -b + Math.PI / 2));
  }
  inst(new THREE.CylinderGeometry(0.42, 0.48, 5.8, 16), colStone, ring);
  inst(bx, dwin, rwin, false);
  const dring = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(12.2, 12.2, 1.3, 64), stoneSmooth));
  dring.position.set(0, DY + 6.9, DZ);
  g.add(dring);
  const dbase = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(12.2, 12.4, 0.5, 64), stoneSmooth));
  dbase.position.set(0, DY + 0.25, DZ);
  g.add(dbase);
  const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(10.4, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial({ map: ribTex(), roughness: 0.48, metalness: 0.35 }, 'dome')));
  dome.scale.set(1, 1.12, 1);
  dome.position.set(0, DY + 7.5, DZ);
  g.add(dome);
  const LY = DY + 7.5 + 11.6;
  const lant = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 3.4, 24), stone));
  lant.position.set(0, LY + 1.7, DZ);
  g.add(lant);
  const lcol = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; lcol.push(M(Math.cos(a) * 2.3, LY + 1.7, DZ + Math.sin(a) * 2.3, 1, 1, 1)); }
  inst(new THREE.CylinderGeometry(0.16, 0.18, 3.2, 8), colStone, lcol, false);
  const ld = shadowed(new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial({ map: ribTex(), roughness: 0.5, metalness: 0.35 }, 'dome2')));
  ld.position.set(0, LY + 3.4, DZ);
  g.add(ld);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 12), plainMaterial({ color: '#c9a35a', roughness: 0.3, metalness: 0.9 }, 'gold'));
  fin.position.set(0, LY + 6.9, DZ);
  g.add(fin);

  // ---- Gower Street lodges, gate piers and railings
  const lodge = (x) => {
    box(wingMat, x - 5, x + 5, 0, 8.5, 100, 109);
    box(stoneSmooth, x - 5.5, x + 5.5, 8.5, 9.3, 99.5, 109.5);
    const ld2 = shadowed(new THREE.Mesh(new THREE.SphereGeometry(3, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial({ map: ribTex(), roughness: 0.5, metalness: 0.3 }, 'dome3')));
    ld2.position.set(x, 9.3, 104.5);
    g.add(ld2);
  };
  lodge(-33); lodge(33);
  const iron = plainMaterial({ color: '#18191b', roughness: 0.4, metalness: 0.6 }, 'iron');
  const rails = [];
  for (let x = -42; x <= 42; x += 0.22) if (Math.abs(x) > 9 && Math.abs(Math.abs(x) - 33) > 5.4) rails.push(M(x, 0, 112, 0.035, 2.3, 0.035));
  inst(bx, iron, rails, false);
  box(iron, -42, -9, 2.15, 2.25, 111.95, 112.05); box(iron, 9, 42, 2.15, 2.25, 111.95, 112.05);
  for (const x of [-9, 9, -42, 42]) box(stoneSmooth, x - 0.7, x + 0.7, 0, 3.6, 111.3, 112.7);
  // lamp posts on the quad path and big trees on the lawns
  const lamps = [];
  for (let z = 34; z < 104; z += 14) { lamps.push(M(-7, 0, z, 0.12, 4.2, 0.12)); lamps.push(M(7, 0, z, 0.12, 4.2, 0.12)); }
  inst(bx, iron, lamps, false);
  const r = rng(31);
  const cano = [], trk = [];
  [[-30, 45], [-24, 78], [-36, 92], [28, 52], [33, 85], [22, 96]].forEach(([x, z]) => {
    const h = 15 + r() * 4, cr = 6 + r() * 2;
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * cr * 0.7;
      const s = cr * (0.34 + r() * 0.18);
      cano.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * rad, h - cr * 0.6 + (r() - 0.35) * cr * 0.9, z + Math.sin(a) * rad), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(s, s, s)));
    }
    trk.push(M(x, 0, z, 0.55, h - cr * 0.7, 0.55));
  });
  inst(treeGeometry(11, 2), leafMaterial('leaf2', '#5d7a3c'), cano);
  inst(bx, plainMaterial({ color: '#5a5047', roughness: 0.9 }, 'trunk2'), trk);

  // ====================================================== library interior (floor at PODIUM)
  const lib = new THREE.Group();
  lib.position.y = IN;
  g.add(lib);
  const add = (geo, mat, x, y, z, parent = lib) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); parent.add(me); return me; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(35, 57.5), plainMaterial({ map: woodTex(), roughness: 0.32 }, 'floor'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 1.21, -32.3);
  floor.receiveShadow = true;
  lib.add(floor);
  const panel = plainMaterial({ color: '#1d3a2e', roughness: 0.75 }, 'panel');
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(35, 57.5), plainMaterial({ map: cofferTex(), color: '#ffffff', roughness: 0.8 }, 'ceil'));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 18.85, -32.3);
  lib.add(ceil);
  const gold = plainMaterial({ color: '#8c6a2c', roughness: 0.35, metalness: 0.9 }, 'goldi');
  for (let z = -6; z > -61; z -= 6) add(B(35, 0.5, 0.4), gold, 0, 18.55, z);
  for (const s of [-1, 1]) {
    const p = add(new THREE.PlaneGeometry(57.5, 17.6), panel, s * 17.45, 10, -32.3);
    p.rotation.y = -s * Math.PI / 2;
  }
  add(new THREE.PlaneGeometry(35, 17.6), panel, 0, 10, -60.95);
  const fp = add(new THREE.PlaneGeometry(35, 17.6), panel, 0, 10, -3.45);
  fp.rotation.y = Math.PI;
  fp.visible = false;
  const wm = plainMaterial({ map: windowTex(), transparent: true, color: '#ffffff', emissive: '#b98272', emissiveIntensity: 0.55, emissiveMap: null, roughness: 1 }, 'iwin');
  wm.emissiveMap = wm.map;
  add(new THREE.PlaneGeometry(5.2, 10.4), wm, 0, 12.4, -60.9);
  for (let z = -9; z > -58; z -= 7) for (const s of [-1, 1]) { const w = add(new THREE.PlaneGeometry(2.4, 4.8), wm, s * 17.4, 14.6, z); w.rotation.y = -s * Math.PI / 2; }
  // great lunette window above the door, with morning light streaming down the hall
  const lun = add(new THREE.CircleGeometry(4.2, 48, 0, Math.PI), wm, 0, 12.6, -3.55);
  lun.rotation.y = Math.PI;
  const sh = shaftTex();
  const shaftMat = new THREE.MeshBasicMaterial({ map: sh, color: new THREE.Color(1.0, 0.5, 0.34), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const dir = new THREE.Vector3(-SUN_DIR.x, -Math.max(SUN_DIR.y, 0.18), -SUN_DIR.z).normalize();
  for (let i = 0; i < 4; i++) {
    const s = add(new THREE.PlaneGeometry(2.4 + i * 0.6, 34), shaftMat, (i - 1.5) * 1.6, 0, 0);
    const start = new THREE.Vector3((i - 1.5) * 1.6, 13.5, -4);
    s.position.copy(start).addScaledVector(dir, 17);
    s.lookAt(s.position.clone().add(new THREE.Vector3(0, 1, 0)));
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    s.rotateY(i * 0.7);
  }

  // shelves and books
  const wood = plainMaterial({ color: '#2a1a10', roughness: 0.55 }, 'wood');
  const tiers = mobile ? [[1.4, 9]] : [[1.4, 9], [8.2, 7]];
  const rr = rng(42);
  const bookM = [], bookC = [];
  const palette = [[0.32, 0.06, 0.05], [0.07, 0.17, 0.11], [0.06, 0.08, 0.2], [0.42, 0.3, 0.16], [0.05, 0.05, 0.05], [0.5, 0.36, 0.12], [0.22, 0.12, 0.07], [0.35, 0.33, 0.28]];
  const mtx = new THREE.Matrix4();
  for (const s of [-1, 1]) {
    for (const [y0, levels] of tiers) {
      for (let l = 0; l < levels; l++) {
        const y = y0 + l * 0.62;
        add(B(0.36, 0.04, 54.5), wood, s * 17.1, y, -33.3);
        let z = -6.2;
        while (z > -60.4) {
          const t = 0.035 + rr() * 0.05, h = 0.28 + rr() * 0.24;
          const lean = rr() < 0.04 ? (rr() - 0.5) * 0.5 : 0;
          if (rr() < 0.035) { z -= 0.12 + rr() * 0.3; continue; }
          const c = palette[Math.floor(rr() * palette.length)], k = 0.7 + rr() * 0.5;
          mtx.compose(new THREE.Vector3(s * (17.12 - rr() * 0.04), y + 0.02 + h / 2, z - t / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, 0, 0)), new THREE.Vector3(0.24 + rr() * 0.06, h, t));
          bookM.push(mtx.clone());
          bookC.push(new THREE.Color(c[0] * k, c[1] * k, c[2] * k));
          z -= t + 0.004;
        }
      }
      for (let z = -6.1; z >= -60.5; z -= 2.7) add(B(0.4, levels * 0.62 + 0.1, 0.07), wood, s * 17.08, y0 + (levels * 0.62) / 2 - 0.05, z);
    }
    if (!mobile) {
      add(B(1.3, 0.12, 54.5), wood, s * 16.4, 7.95, -33.3);
      add(B(0.06, 0.06, 54.5), gold, s * 15.75, 9.0, -33.3);
      for (let z = -6.5; z > -60.5; z -= 1.2) add(B(0.05, 1.0, 0.05), gold, s * 15.75, 8.5, z);
    }
  }
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), plainMaterial({ roughness: 0.78 }, 'books'), bookM.length);
  bookM.forEach((mm, i) => { books.setMatrixAt(i, mm); books.setColorAt(i, bookC[i]); });
  books.instanceMatrix.needsUpdate = true;
  if (books.instanceColor) books.instanceColor.needsUpdate = true;
  lib.add(books);

  // reading tables with green lamps, pendants
  const lampShade = plainMaterial({ color: '#06281a', emissive: '#03130b', roughness: 0.25, metalness: 0.2 }, 'shade');
  const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.2) });
  for (const x of [-11.5, -5, 5, 11.5]) {
    for (let z = -11; z > -41; z -= 9.5) {
      add(B(2.0, 0.08, 7.2), wood, x, 1.98, z);
      for (const lx of [-0.55, 0.55]) for (const lz of [-3.2, 3.2]) add(B(0.1, 0.76, 0.1), wood, x + lx * 1.6, 1.6, z + lz);
      for (const lz of [-2.2, 0, 2.2]) {
        add(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8), gold, x, 2.25, z + lz);
        const s2 = add(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 16, 1, false, 0, Math.PI), lampShade, x, 2.5, z + lz);
        s2.rotation.z = Math.PI / 2;
        s2.rotation.y = Math.PI / 2;
        add(new THREE.SphereGeometry(0.05, 8, 6), bulb, x, 2.43, z + lz);
      }
    }
  }

  // the desk, the marked answer, pen, books and lamp
  add(B(1.7, 0.06, 0.9), wood, 0, 1.93, -46.1);
  for (const lx of [-0.78, 0.78]) for (const lz of [-0.38, 0.38]) add(B(0.06, 0.72, 0.06), wood, lx, 1.56, -46.1 + lz);
  const paper = add(new THREE.PlaneGeometry(0.21, 0.297), plainMaterial({ map: paperTex(), roughness: 0.92 }, 'paper'), 0.02, 1.962, -46.06);
  paper.rotation.x = -Math.PI / 2;
  paper.rotation.z = 0.06;
  const pen = add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 10), plainMaterial({ color: '#0c0c10', metalness: 0.6, roughness: 0.3 }, 'pen'), 0.17, 1.966, -46.02);
  pen.rotation.x = Math.PI / 2;
  pen.rotation.z = 0.5;
  [['#4d0f0c'], ['#123321'], ['#6b4b26']].forEach(([c], i) => { const b2 = add(B(0.24, 0.035, 0.17), plainMaterial({ color: c, roughness: 0.7 }, 'db' + i), -0.52, 1.98 + i * 0.036, -46.2); b2.rotation.y = 0.2 - i * 0.15; });
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.03, 20), gold, 0.48, 1.975, -46.3);
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 8), gold, 0.48, 2.13, -46.3);
  const dsh = add(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 20, 1, false, 0, Math.PI), lampShade, 0.48, 2.3, -46.24);
  dsh.rotation.z = Math.PI / 2;
  dsh.rotation.y = Math.PI / 2 + 0.3;
  add(new THREE.SphereGeometry(0.035, 10, 8), bulb, 0.46, 2.25, -46.22);

  // dust in the air
  const N = mobile ? 600 : 1400;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (rr() - 0.5) * 32; pos[i * 3 + 1] = 1.5 + rr() * 14; pos[i * 3 + 2] = -4 - rr() * 52; seed[i] = rr(); }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const dustU = { uTime: { value: 0 }, uSize: { value: mobile ? 10 : 13 }, uOpacity: { value: 0 } };
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  lib.add(dust);

  // interior lights
  const int = [];
  const furn = furnishLibrary(lib, { mobile });
  furn.lights.forEach((l) => int.push(l));
  const day = new THREE.PointLight(0xffb59a, 40, 0, 2);
  day.position.set(0, 12, -6);
  lib.add(day);
  int.push([day, 40]);
  const deskLight = new THREE.PointLight(0xffc483, 0.9, 0, 2);
  deskLight.position.set(0.38, 2.36, -46.2);
  lib.add(deskLight);
  int.push([deskLight, 0.9]);

  // floodlights: warm-white uplighting on the Portico and the dome
  const ext = [];
  for (const x of [-13, 13]) {
    const sp = new THREE.SpotLight(0xffe0bd, 1500, 0, 0.5, 0.85, 2);
    sp.position.set(x, 0.6, 36);
    sp.target.position.set(x * 0.45, 15, 8);
    g.add(sp, sp.target);
    ext.push([sp, 1500]);
  }
  const domeL = new THREE.SpotLight(0xffe6c8, 600, 0, 0.55, 0.9, 2);
  domeL.position.set(0, 26, -6);
  domeL.target.position.set(0, 32, -27);
  g.add(domeL, domeL.target);
  ext.push([domeL, 600]);

  return { group: g, lib, int, ext, furn, dust: dustU, shaftMat };
}
