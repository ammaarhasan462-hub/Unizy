// Geometry for the intro: night city, the portico landmark, the library reading room, and the desk with a marked answer.
// Units are metres. The landmark's front steps face +z; the camera arrives from +z.
import * as THREE from 'three';
import { BUILDING_FS, BUILDING_VS, DUST_FS, DUST_VS, GRID_ANGLE, GROUND_FS, GROUND_VS } from './shaders';

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const riverZ = (x) => Math.sin(x * 0.0011) * 420 + Math.sin(x * 0.0027 + 1.3) * 160 - 250;

// ---------------------------------------------------------------- city
export function buildCity(shared, { mobile }) {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 40000, 1, 1),
    new THREE.ShaderMaterial({ vertexShader: GROUND_VS, fragmentShader: GROUND_FS, uniforms: shared, depthWrite: true })
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const S = 55;
  const R = mobile ? 1500 : 2100;
  const r = rng(7);
  const mats = [];
  const m = new THREE.Matrix4();
  const tall = new THREE.Vector2(900, -700);
  const ca = Math.cos(GRID_ANGLE), sa = Math.sin(GRID_ANGLE);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), GRID_ANGLE);
  const lim = Math.ceil(R / S) + 2;
  for (let gx = -lim; gx <= lim; gx++) {
    for (let gz = -lim; gz <= lim; gz++) {
      // cell centre in grid space -> world space (inverse of the shader's rotation)
      const lx = (gx + 0.5) * S, lz = (gz + 0.5) * S;
      const cx = ca * lx + sa * lz, cz = -sa * lx + ca * lz;
      const dist = Math.hypot(cx, cz);
      if (dist > R) continue;
      if (Math.abs(cz - riverZ(cx)) < 95) continue;
      if (Math.abs(cx) < 120 && cz > -170 && cz < 210) continue;
      if (r() < 0.22) continue;
      const w = S * (0.42 + r() * 0.36);
      const d = S * (0.42 + r() * 0.36);
      const dt = Math.hypot(cx - tall.x, cz - tall.y);
      const district = 1 + 2.6 * Math.exp(-(dt * dt) / (2 * 420 * 420));
      const near = Math.min(1, Math.hypot(cx, cz - 20) / 420);
      let h = (10 + Math.pow(r(), 3.2) * 95 * district) * (0.45 + 0.55 * near);
      if (r() < 0.02 * district) h *= 2.2;
      const ox = (r() - 0.5) * (S - w) * 0.6, oz = (r() - 0.5) * (S - d) * 0.6;
      m.compose(new THREE.Vector3(cx + ca * ox + sa * oz, 0, cz - sa * ox + ca * oz), q, new THREE.Vector3(w, h, d));
      mats.push(m.clone());
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const inst = new THREE.InstancedMesh(
    box,
    new THREE.ShaderMaterial({ vertexShader: BUILDING_VS, fragmentShader: BUILDING_FS, uniforms: shared }),
    mats.length
  );
  mats.forEach((mm, i) => inst.setMatrixAt(i, mm));
  inst.instanceMatrix.needsUpdate = true;
  inst.frustumCulled = false;
  group.add(inst);
  return group;
}

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return t;
}

function woodTex() {
  return canvasTex(1024, 1024, (ctx, W, H) => {
    const r = rng(3);
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, 0, W, H);
    const pw = W / 8;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 4; j++) {
        const off = (i % 2) * (H / 8);
        const y = j * (H / 4) + off;
        const tone = 30 + r() * 26;
        ctx.fillStyle = `rgb(${tone + 18},${tone * 0.62 + 6},${tone * 0.36})`;
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

function windowTex() {
  return canvasTex(256, 512, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, W / 2);
    ctx.arc(W / 2, W / 2, W / 2, Math.PI, 0);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5a74a8');
    g.addColorStop(1, '#22304e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0b0d12';
    ctx.lineWidth = 7;
    for (let x = W / 3; x < W; x += W / 3) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = W / 2; y < H; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
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

function paperTex() {
  return canvasTex(1240, 1754, (ctx, W, H) => {
    ctx.fillStyle = '#f3efe6';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.55, H * 0.4, 100, W * 0.5, H * 0.5, H * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(120,100,70,.16)');
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
    // examiner marks in gold ink
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

function stoneTex() {
  return canvasTex(512, 512, (ctx, W, H) => {
    const r = rng(9);
    ctx.fillStyle = '#7d776c';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      const v = 100 + r() * 40;
      ctx.fillStyle = `rgba(${v},${v * 0.96},${v * 0.88},${0.05 + r() * 0.08})`;
      ctx.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
    }
    ctx.strokeStyle = 'rgba(40,36,30,.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let y = 0; y < H; y += 64) for (let x = ((y / 64) % 2) * 64; x < W; x += 128) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke(); }
  }, { repeat: [6, 3] });
}

function flutedColumn(r0, r1, h) {
  const geo = new THREE.CylinderGeometry(r0, r1, h, 72, 8);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const rr = Math.hypot(v.x, v.z);
    if (rr < 1e-4) continue;
    const th = Math.atan2(v.z, v.x);
    const k = 1 - 0.045 * Math.pow(Math.abs(Math.cos(th * 10)), 0.6);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- landmark + library
export function buildLandmark({ mobile }) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex(), color: new THREE.Color(0.62, 0.6, 0.56), roughness: 0.88, metalness: 0 });
  const colStone = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.5, 0.48, 0.44), roughness: 0.7, metalness: 0 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.38, 0.36, 0.33), roughness: 0.9 });
  const add = (geo, mat, x, y, z, parent = g) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); parent.add(me); return me; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // plinth and steps
  add(B(46, 1.2, 83), stoneDark, 0, 0.6, -24);
  for (let i = 0; i < 4; i++) add(B(40, 0.3, 1.5), stone, 0, 0.15 + i * 0.3 - 0.0, 22 - i * 1.5 + 0.75).scale.set(1, 1, 1);
  // columns
  const colGeo = flutedColumn(0.76, 0.86, 14);
  for (let i = 0; i < 8; i++) {
    const x = -17.5 + i * 5;
    add(colGeo, colStone, x, 1.2 + 7, 9);
    add(B(2.1, 0.5, 2.1), stone, x, 1.45, 9);
    add(B(2.2, 0.6, 2.2), stone, x, 15.5, 9);
  }
  // entablature and pediment
  add(B(42, 2.2, 12), stone, 0, 16.9, 4.5);
  const tri = new THREE.Shape();
  tri.moveTo(-21.5, 0); tri.lineTo(21.5, 0); tri.lineTo(0, 6.5); tri.closePath();
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 12, bevelEnabled: false }), stone);
  ped.position.set(0, 18, -1.5);
  g.add(ped);
  // front wall with the doorway
  add(B(15.5, 17.8, 1), stone, -10.25, 10.1, -3);
  add(B(15.5, 17.8, 1), stone, 10.25, 10.1, -3);
  add(B(5, 9.8, 1), stone, 0, 14.1, -3);
  // body: side walls, back wall, roof
  add(B(1, 17.8, 59), stone, -18, 10.1, -32);
  add(B(1, 17.8, 59), stone, 18, 10.1, -32);
  add(B(37, 17.8, 1), stone, 0, 10.1, -61.5);
  add(B(37, 1, 60), stoneDark, 0, 19.4, -32);
  // dome
  add(new THREE.CylinderGeometry(9, 9, 5, 48, 1, true), stone, 0, 22.4, -26);
  const dome = add(new THREE.SphereGeometry(9.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.42, 0.45, 0.42), roughness: 0.55, metalness: 0.35 }), 0, 24.9, -26);
  dome.castShadow = false;
  add(new THREE.CylinderGeometry(1.4, 1.4, 3, 16), stone, 0, 35.3, -26);
  add(new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 36.8, -26);
  // glowing tall windows along both sides (outside)
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.32), side: THREE.DoubleSide });
  const winGeo = new THREE.PlaneGeometry(2.2, 6);
  for (let z = -10; z > -58; z -= 7) {
    for (const s of [-1, 1]) {
      const w = add(winGeo, winMat, s * 18.55, 9, z);
      w.rotation.y = s * Math.PI / 2;
    }
  }
  // warm light spilling out of the doorway
  const doorGlow = add(new THREE.PlaneGeometry(5, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.0, 0.55), transparent: true, opacity: 0.0, depthWrite: false }), 0, 5.2, -3.45);
  doorGlow.userData.door = true;

  // ---- library interior
  const lib = new THREE.Group();
  g.add(lib);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(35, 57.5), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.34, metalness: 0.0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 1.21, -32.3);
  lib.add(floor);
  const panel = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.07, 0.055), roughness: 0.8 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(35, 57.5), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.06, 0.055, 0.05), roughness: 0.95 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 18.85, -32.3);
  lib.add(ceil);
  const gold = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.4, 0.16), roughness: 0.35, metalness: 0.9 });
  for (let z = -6; z > -61; z -= 6) add(B(35, 0.5, 0.4), gold, 0, 18.55, z, lib);
  for (const s of [-1, 1]) {
    const p = add(new THREE.PlaneGeometry(57.5, 17.6), panel, s * 17.45, 10, -32.3, lib);
    p.rotation.y = -s * Math.PI / 2;
    if (s < 0) add(new THREE.PlaneGeometry(35, 17.6), panel, 0, 10, -60.95, lib);
  }
  // arched windows high on the side walls
  const wt = windowTex();
  const wm = new THREE.MeshBasicMaterial({ map: wt, transparent: true, color: new THREE.Color(0.3, 0.36, 0.5) });
  for (let z = -9; z > -58; z -= 7) {
    for (const s of [-1, 1]) {
      const w = add(new THREE.PlaneGeometry(2.4, 4.8), wm, s * 17.4, 14.6, z, lib);
      w.rotation.y = -s * Math.PI / 2;
    }
  }

  // bookshelves: two tiers along both walls (one tier on phones)
  const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.055, 0.032, 0.018), roughness: 0.55 });
  const tiers = mobile ? [[1.4, 9]] : [[1.4, 9], [8.2, 7]];
  const r = rng(42);
  const bookM = [];
  const bookC = [];
  const palette = [[0.32, 0.06, 0.05], [0.07, 0.17, 0.11], [0.06, 0.08, 0.2], [0.42, 0.3, 0.16], [0.05, 0.05, 0.05], [0.5, 0.36, 0.12], [0.22, 0.12, 0.07], [0.35, 0.33, 0.28]];
  const mtx = new THREE.Matrix4();
  for (const s of [-1, 1]) {
    for (const [y0, levels] of tiers) {
      for (let l = 0; l < levels; l++) {
        const y = y0 + l * 0.62;
        add(B(0.36, 0.04, 54.5), wood, s * 17.1, y, -33.3, lib);
        let z = -6.2;
        while (z > -60.4) {
          const t = 0.035 + r() * 0.05;
          const h = 0.28 + r() * 0.24;
          const lean = r() < 0.04 ? (r() - 0.5) * 0.5 : 0;
          if (r() < 0.035) { z -= 0.12 + r() * 0.3; continue; }
          const c = palette[Math.floor(r() * palette.length)];
          const k = 0.7 + r() * 0.5;
          mtx.compose(new THREE.Vector3(s * (17.12 - r() * 0.04), y + 0.02 + h / 2, z - t / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, 0, 0)), new THREE.Vector3(0.24 + r() * 0.06, h, t));
          bookM.push(mtx.clone());
          bookC.push(new THREE.Color(c[0] * k, c[1] * k, c[2] * k));
          z -= t + 0.004;
        }
      }
      for (let z = -6.1; z >= -60.5; z -= 2.7) add(B(0.4, levels * 0.62 + 0.1, 0.07), wood, s * 17.08, y0 + (levels * 0.62) / 2 - 0.05, z, lib);
    }
    if (!mobile) {
      add(B(1.3, 0.12, 54.5), wood, s * 16.4, 7.95, -33.3, lib);
      add(B(0.06, 0.06, 54.5), gold, s * 15.75, 9.0, -33.3, lib);
      for (let z = -6.5; z > -60.5; z -= 1.2) add(B(0.05, 1.0, 0.05), gold, s * 15.75, 8.5, z, lib);
    }
  }
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.78 }), bookM.length);
  bookM.forEach((mm, i) => { books.setMatrixAt(i, mm); books.setColorAt(i, bookC[i]); });
  books.instanceMatrix.needsUpdate = true;
  if (books.instanceColor) books.instanceColor.needsUpdate = true;
  lib.add(books);

  // reading tables with green lamps
  const lampShade = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.02, 0.12, 0.06), emissive: new THREE.Color(0.004, 0.04, 0.018), roughness: 0.25, metalness: 0.2 });
  const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.2) });
  const brass = gold;
  for (const x of [-11.5, -5, 5, 11.5]) {
    for (let z = -11; z > -41; z -= 9.5) {
      add(B(2.0, 0.08, 7.2), wood, x, 1.98, z, lib);
      for (const lx of [-0.55, 0.55]) for (const lz of [-3.2, 3.2]) add(B(0.1, 0.76, 0.1), wood, x + lx * 1.6, 1.6, z + lz, lib);
      for (const lz of [-2.2, 0, 2.2]) {
        add(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8), brass, x, 2.25, z + lz, lib);
        const sh = add(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 16, 1, false, 0, Math.PI), lampShade, x, 2.5, z + lz, lib);
        sh.rotation.z = Math.PI / 2;
        sh.rotation.y = Math.PI / 2;
        add(new THREE.SphereGeometry(0.05, 8, 6), bulb, x, 2.43, z + lz, lib);
      }
    }
  }
  // pendant lights down the centre
  const pend = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.75, 0.95) });
  const cord = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  for (let z = -9; z > -44; z -= 7) {
    add(new THREE.SphereGeometry(0.32, 20, 12), pend, 0, 12.5, z, lib);
    add(new THREE.CylinderGeometry(0.012, 0.012, 6, 4), cord, 0, 15.8, z, lib);
  }

  // the desk at the end of the hall
  add(B(1.7, 0.06, 0.9), wood, 0, 1.93, -46.1, lib);
  for (const lx of [-0.78, 0.78]) for (const lz of [-0.38, 0.38]) add(B(0.06, 0.72, 0.06), wood, lx, 1.56, -46.1 + lz, lib);
  const paper = add(new THREE.PlaneGeometry(0.21, 0.297), new THREE.MeshStandardMaterial({ map: paperTex(), roughness: 0.92 }), 0.02, 1.962, -46.06, lib);
  paper.rotation.x = -Math.PI / 2;
  paper.rotation.z = 0.06;
  const pen = add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x0c0c10, metalness: 0.6, roughness: 0.3 }), 0.17, 1.966, -46.02, lib);
  pen.rotation.x = Math.PI / 2;
  pen.rotation.z = 0.5;
  const bookCols = [[0.3, 0.06, 0.05], [0.07, 0.16, 0.1], [0.4, 0.29, 0.15]];
  bookCols.forEach((c, i) => {
    const b = add(B(0.24, 0.035, 0.17), new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.7 }), -0.52, 1.98 + i * 0.036, -46.2, lib);
    b.rotation.y = 0.2 - i * 0.15;
  });
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.03, 20), brass, 0.48, 1.975, -46.3, lib);
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 8), brass, 0.48, 2.13, -46.3, lib);
  const dsh = add(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 20, 1, false, 0, Math.PI), lampShade, 0.48, 2.3, -46.24, lib);
  dsh.rotation.z = Math.PI / 2;
  dsh.rotation.y = Math.PI / 2 + 0.3;
  add(new THREE.SphereGeometry(0.035, 10, 8), bulb, 0.46, 2.25, -46.22, lib);

  // dust in the air
  const N = mobile ? 600 : 1400;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (r() - 0.5) * 32;
    pos[i * 3 + 1] = 1.5 + r() * 14;
    pos[i * 3 + 2] = -4 - r() * 52;
    seed[i] = r();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const dustU = { uTime: { value: 0 }, uSize: { value: mobile ? 10 : 13 }, uOpacity: { value: 0 } };
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  lib.add(dust);

  // lights
  const ext = [];
  for (const x of [-11, 11]) {
    const sp = new THREE.SpotLight(0xffc489, 1700, 0, 0.55, 0.8, 2);
    sp.position.set(x, 0.5, 34);
    sp.target.position.set(x * 0.4, 12, 6);
    g.add(sp, sp.target);
    ext.push([sp, 1700]);
  }
  const porch = new THREE.PointLight(0xffb873, 22, 0, 2);
  porch.position.set(0, 13, 4);
  g.add(porch);
  ext.push([porch, 22]);
  const int = [];
  for (let z = -9; z > -44; z -= 14) {
    const pl = new THREE.PointLight(0xffb366, 95, 0, 2);
    pl.position.set(0, 11.5, z);
    lib.add(pl);
    int.push([pl, 95]);
  }
  for (const x of [-8, 8]) {
    for (const z of [-15, -33]) {
      const pl = new THREE.PointLight(0xffc27a, 15, 0, 2);
      pl.position.set(x, 3.2, z);
      lib.add(pl);
      int.push([pl, 15]);
    }
  }
  const deskLight = new THREE.PointLight(0xffc483, 0.75, 0, 2);
  deskLight.position.set(0.38, 2.36, -46.2);
  lib.add(deskLight);
  int.push([deskLight, 0.75]);

  return { group: g, lib, ext, int, dust: dustU, doorGlow };
}
