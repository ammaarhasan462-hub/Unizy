// A London world around any campus, built only from the real map (OpenStreetMap via city.js): the baked city out to
// 1.5 km, the real Thames from the map (with the matching river function for the cloud shader), a far ground and an
// outer ring of low blocks to the horizon, the tall buildings of the skyline, and the far landmarks (the Shard, the
// Gherkin, St Paul's, the BT Tower) at their mapped positions. Used for Queen Mary (Mile End) and LSE (Aldwych).
import * as THREE from 'three';
import { MAP_HALF } from './shaders';
import { baseBox, canvasTex, facadeMaterial, plainMaterial, rng } from './materials';
import { buildCity } from './city';

const H = MAP_HALF;
const inRect = (x, z, r, m = 0) => x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m;

// the Thames as x(z) samples: follow the mapped centreline from the bank nearest the campus outwards
function riverSamples(lines) {
  const Z0 = -12000, DZ = 300, N = 81;
  const xs = new Array(N).fill(null);
  const pts = [];
  lines.forEach((l) => { for (let i = 0; i < l.length - 1; i++) pts.push([l[i], l[i + 1]]); });
  if (!pts.length) return null;
  const cross = (z) => {
    const out = [];
    pts.forEach(([a, b]) => { if ((a[1] - z) * (b[1] - z) <= 0 && a[1] !== b[1]) out.push(a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1])); });
    return out;
  };
  // start where the river is nearest the campus, then walk both ways keeping continuity
  let best = null;
  for (let i = 0; i < N; i++) { const c = cross(Z0 + i * DZ); c.forEach((x) => { if (!best || Math.abs(x) < Math.abs(best[1])) best = [i, x]; }); }
  if (!best) return null;
  xs[best[0]] = best[1];
  for (const dir of [1, -1]) {
    let prev = best[1];
    for (let i = best[0] + dir; i >= 0 && i < N; i += dir) {
      const c = cross(Z0 + i * DZ);
      if (!c.length) { xs[i] = prev; continue; }
      const x = c.reduce((m, v) => (Math.abs(v - prev) < Math.abs(m - prev) ? v : m), c[0]);
      xs[i] = x; prev = x;
    }
  }
  return { Z0, DZ, N, xs };
}

export function buildCityWorld(renderer, { mobile, city, site, keepRects = [], paint = null, skip = null, landmarks = {} }) {
  const r = rng(site === 'qmul' ? 314 : 271);
  const group = new THREE.Group();
  const keep = (x, z) => !keepRects.some((q) => inRect(x, z, q, 4));
  const skipB = skip || ((x, z) => keepRects.some((q) => inRect(x, z, q, 0)));
  let real = null;
  if (city) {
    try { real = buildCity(city, { mobile, H, site, keep, skip: skipB, paint }); group.add(real.group); } catch (e) { console.error(e); real = null; }
  }
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion();
  const bx = baseBox();
  const inst = (geo, mat, list, cast = false) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([mm, c], i) => { im.setMatrixAt(i, mm); if (c) im.setColorAt(i, c); });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = cast; im.receiveShadow = true;
    group.add(im);
    return im;
  };

  // ---------------------------------------------------------------- the Thames, from the map
  const rs = real && real.river && real.river.length ? riverSamples(real.river) : null;
  const riverAt = rs
    ? (z) => { const f = Math.min(rs.N - 1.001, Math.max(0, (z - rs.Z0) / rs.DZ)); const i = Math.floor(f); return rs.xs[i] + (rs.xs[i + 1] - rs.xs[i]) * (f - i); }
    : (z) => -2400 + Math.sin(z * 0.0006) * 200;
  const riverGLSL = rs
    ? `const float RV_Z0 = ${rs.Z0.toFixed(1)}; const float RV_DZ = ${rs.DZ.toFixed(1)};
const float RV_X[${rs.N}] = float[${rs.N}](${rs.xs.map((x) => x.toFixed(1)).join(',')});
float riverX(float z){ float f = clamp((z - RV_Z0) / RV_DZ, 0.0, ${(rs.N - 1.001).toFixed(3)}); int i = int(f); return mix(RV_X[i], RV_X[i + 1], fract(f)); }`
    : 'float riverX(float z){ return -2400.0 + sin(z * 0.0006) * 200.0; }';
  const waterMat = plainMaterial({ color: '#25343b', roughness: 0.07, metalness: 0.05 }, 'river-' + site);
  {
    // the river as one ribbon along the samples (the map's own water polygons lie on top near the campus)
    const v = [], idx = [];
    for (let z = -12000, i = 0; z <= 12000; z += 150, i++) {
      const x = riverAt(z);
      const w = 125 + 15 * Math.sin(z * 0.001);
      v.push(x - w, 0.2, z, x + w, 0.2, z);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, waterMat);
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------------------------------------------------------------- ground beyond the map, and the outer city
  const farTex = canvasTex(1024, 1024, (ctx, W) => {
    const rr = rng(77);
    ctx.fillStyle = '#6f695e'; ctx.fillRect(0, 0, W, W);
    for (let i = 0; i < 900; i++) { const v = 70 + rr() * 50; ctx.fillStyle = `rgb(${v},${v * 0.95},${v * 0.86})`; ctx.fillRect(rr() * W, rr() * W, 20 + rr() * 50, 20 + rr() * 50); }
    ctx.fillStyle = '#4a4b4d';
    for (let x = 0; x < W; x += 64 + rr() * 40) ctx.fillRect(x, 0, 4, W);
    for (let y = 0; y < W; y += 80 + rr() * 50) ctx.fillRect(0, y, W, 4);
  }, { repeat: [90, 90] });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), plainMaterial({ map: farTex, roughness: 0.95 }, 'far-' + site));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.4;
  group.add(far);
  // a plain map texture for the cloud shader if the real map didn't load
  const mapTex = real ? real.mapTex : canvasTex(512, 512, (ctx, W) => { ctx.fillStyle = '#7d7868'; ctx.fillRect(0, 0, W, W); });
  const emTex = real ? real.emTex : canvasTex(64, 64, (ctx, W) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, W); });
  if (!real) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), plainMaterial({ map: mapTex, roughness: 0.95 }, 'ground-' + site));
    ground.rotation.x = -Math.PI / 2;
    group.add(ground);
  }
  const BRICK = ['#8b5a44', '#9b6a52', '#7d4c3a', '#a77b62', '#6e4636', '#b08870', '#94735f'];
  const MOD = ['#8c949b', '#a0a6aa', '#6f7a83', '#b7b9b4'];
  const terraceMat = facadeMaterial({ floor: 3.3, bay: 2.6, winW: 0.42, winH: 0.58, lit: 0.12, color: '#8b5a44', frame: '#e8e2d6', roof: '#5a5c5f' });
  const outer = [];
  const ro = rng(99);
  const R = mobile ? 1050 : H;
  for (let x = -5200; x < 5200; x += 85) for (let z = -5200; z < 5200; z += 85) {
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < R + 40 || ro() < 0.5) continue;
    if (Math.abs(x - riverAt(z)) < 190) continue;
    const h = 12 + Math.pow(ro(), 4) * 40;
    m4.compose(new THREE.Vector3(x + (ro() - 0.5) * 30, 0, z + (ro() - 0.5) * 30), q0, new THREE.Vector3(35 + ro() * 35, h, 35 + ro() * 35));
    outer.push([m4.clone(), new THREE.Color(ro() < 0.7 ? BRICK[Math.floor(ro() * 7)] : MOD[Math.floor(ro() * 4)])]);
  }
  inst(bx, terraceMat, outer);

  // ---------------------------------------------------------------- the skyline's landmarks at their mapped positions
  const L = real ? real.landmarks : {};
  const glassy = plainMaterial({ color: '#7f909b', roughness: 0.1, metalness: 0.5 }, 'glassy-' + site);
  const sh = L['The Shard'];
  if (sh) {
    const shard = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 32, 310, 4, 1), glassy);
    shard.position.set(sh[0], 155, sh[1]); shard.rotation.y = Math.PI / 4;
    group.add(shard);
  }
  const gk = L['30 St Mary Axe'];
  if (gk) {
    const gh = new THREE.LatheGeometry(Array.from({ length: 16 }, (_, i) => { const t = i / 15; return new THREE.Vector2(Math.max(0.5, 27 * Math.sin(Math.PI * (0.18 + t * 0.82)) * (1 - t * 0.25)), t * 180); }), 32);
    const gherkin = new THREE.Mesh(gh, plainMaterial({ color: '#4e6470', roughness: 0.18, metalness: 0.4 }, 'gherkin-' + site));
    gherkin.position.set(gk[0], 0, gk[1]);
    group.add(gherkin);
  }
  const bt = L['BT Tower'];
  if (bt) {
    const mat = plainMaterial({ color: '#c9cdd1', roughness: 0.35, metalness: 0.3 }, 'bt-' + site);
    const dark = plainMaterial({ color: '#2b3036', roughness: 0.4, metalness: 0.4, emissive: '#7fc2ff', emissiveIntensity: 0.9 }, 'btd-' + site);
    const cyl = (rad, y0, h, mm) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 32), mm); c.position.set(bt[0], y0 + h / 2, bt[1]); group.add(c); };
    cyl(9, 0, 110, mat);
    for (let i = 0; i < 6; i++) { cyl(10.5, 110 + i * 7, 3.5, dark); cyl(9.5, 113.5 + i * 7, 3.5, mat); }
    cyl(7, 152, 16, mat); cyl(2, 168, 14, dark);
  }
  // St Paul's Cathedral: Portland stone drum, the peristyle, the dome, the lantern and the gilded cross
  const sp = landmarks.stPauls;
  if (sp) {
    const stone = plainMaterial({ color: '#d8d0bf', roughness: 0.75 }, 'stpauls-' + site);
    const lead = plainMaterial({ color: '#6c7377', roughness: 0.45, metalness: 0.4 }, 'stpauls-lead-' + site);
    const gold = plainMaterial({ color: '#c9a35a', roughness: 0.3, metalness: 0.9 }, 'stpauls-gold-' + site);
    const g = new THREE.Group(); g.position.set(sp[0], 0, sp[1]); g.rotation.y = sp[2] || 0; group.add(g);
    const add = (geo, mat, x, y, z) => { const mm = new THREE.Mesh(geo, mat); mm.position.set(x, y, z); mm.castShadow = true; g.add(mm); return mm; };
    add(new THREE.BoxGeometry(46, 30, 140), stone, 0, 15, 0); // nave and choir
    add(new THREE.BoxGeometry(76, 30, 34), stone, 0, 15, 8); // transepts
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(14, 64, 14), stone, s * 16, 32, -74); // west towers
    add(new THREE.CylinderGeometry(19, 19, 18, 40), stone, 0, 39, 8); // drum
    for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; add(new THREE.CylinderGeometry(0.9, 0.9, 14, 8), stone, Math.cos(a) * 20.5, 37, 8 + Math.sin(a) * 20.5); }
    add(new THREE.CylinderGeometry(21.5, 21.5, 2, 40), stone, 0, 45, 8);
    add(new THREE.CylinderGeometry(16.5, 17, 8, 40), stone, 0, 50, 8); // attic
    const dome = add(new THREE.SphereGeometry(17, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), lead, 0, 54, 8); dome.scale.y = 1.35;
    add(new THREE.CylinderGeometry(3, 3.6, 12, 16), stone, 0, 82, 8); // lantern
    add(new THREE.SphereGeometry(1.6, 16, 10), gold, 0, 90, 8);
    add(new THREE.BoxGeometry(0.5, 6, 0.5), gold, 0, 94, 8);
    add(new THREE.BoxGeometry(3, 0.5, 0.5), gold, 0, 95, 8);
  }
  // aviation lights on the tallest towers
  const av = [];
  (real ? real.tallTops : []).forEach(([x, h, z]) => av.push([new THREE.Matrix4().compose(new THREE.Vector3(x, h + 2, z), q0, new THREE.Vector3(2.2, 2.2, 2.2))]));
  if (bt) av.push([new THREE.Matrix4().compose(new THREE.Vector3(bt[0], 183, bt[1]), q0, new THREE.Vector3(1.6, 1.6, 1.6))]);
  const avMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.15) });
  inst(new THREE.SphereGeometry(1, 8, 6), avMat, av.map(([m]) => [m, new THREE.Color(1, 1, 1)]));

  const trafficU = real ? real.trafficU : { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } };
  return { group, mapTex, emTex, trafficU, avMat, riverGLSL, riverAt, real };
}
