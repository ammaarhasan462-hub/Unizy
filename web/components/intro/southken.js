// South Kensington for the Imperial intro (metres; +x = north, +z = east, the Queen's Tower at the origin).
// Positions follow the real map around Imperial's South Kensington campus: Kensington Gardens and Hyde Park with
// the Serpentine and the Long Water to the north, the Albert Memorial and the Royal Albert Hall on Kensington Gore,
// Prince Consort Road, Exhibition Road and Queen's Gate, the Natural History Museum, the Science Museum and the
// V&A on Cromwell Road, white stucco terraces and red-brick mansion blocks, and on the horizon the Thames, Battersea
// Power Station, the London Eye, the BT Tower, the Shard and the City. The campus block itself is left clear for
// imperial.js.
import * as THREE from 'three';
import { MAP_HALF } from './shaders';
import { baseBox, canvasTex, facadeMaterial, leafMaterial, plainMaterial, rng, roofGeometry, treeGeometry } from './materials';

const H = MAP_HALF;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the Thames: runs east-west through Chelsea ~1.6 km south, turns north past Vauxhall to Westminster, then east
export const riverX = (z) => -1650 + 2100 * sstep(2500, 5000, z) + Math.max(0, z - 5000) * 0.15 + Math.sin(z * 0.0011) * 60;
export const RIVER_GLSL = 'float riverX(float z){ return -1650.0 + 2100.0*smoothstep(2500.0, 5000.0, z) + max(0.0, z - 5000.0)*0.15 + sin(z*0.0011)*60.0; }';

// roads: lines of constant x run east-west, lines of constant z run north-south
const KENS_GORE = 395; // Kensington Gore / Kensington Road, the park's southern edge
const PARK_X = 409;
const MAJ_X = [[KENS_GORE, 26], [215, 14], [-30, 12], [-300, 30], [-640, 18], [-990, 20], [-1340, 18]];
const MAJ_Z = [[208, 22], [-194, 26], [-560, 14], [-900, 18], [470, 16], [900, 18], [1300, 20]];
export const ROADS = { kensGore: KENS_GORE, princeConsort: 215, imperialRd: -30, cromwell: -300, exhibition: 208, queensGate: -194 };

// the campus (Imperial College Road to Prince Consort Road, Queen's Gate to Exhibition Road)
export const CAMPUS = [-24, 208, -181, 197];
const inRect = (x, z, r, m = 0) => x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m;
const inPark = (x, z) => x > PARK_X - 2;

// the Serpentine (with the Long Water) and the Round Pond, as polylines with widths
const SERPENTINE = [[1368, 83, 24], [1250, 110, 30], [1100, 150, 38], [960, 190, 44], [801, 236, 40], [760, 330, 70], [700, 520, 90], [650, 740, 100], [610, 960, 90], [585, 1150, 70], [578, 1240, 40]];
const ROUND_POND = [790, -450, 75, 62];

function streets(r) {
  const fill = (maj, lo, hi, smin, smax, keepOut) => {
    const lines = maj.map(([c, w]) => ({ c, w, major: true })).sort((a, b) => a.c - b.c);
    const all = [...lines];
    const edges = [{ c: lo }, ...lines, { c: hi }];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i].c, b = edges[i + 1].c;
      if (keepOut && a >= keepOut[0] - 1 && b <= keepOut[1] + 1) continue;
      if (a >= KENS_GORE - 1 && maj === MAJ_X) continue; // no streets in the park
      let c = a + smin + r() * (smax - smin);
      while (c < b - smin * 0.7) {
        all.push({ c, w: 10 + r() * 4, major: false });
        c += smin + r() * (smax - smin);
      }
    }
    return all.sort((x, y) => x.c - y.c);
  };
  const xl = fill(MAJ_X, -H, H, 80, 130, [-300, KENS_GORE]);
  const zl = fill(MAJ_Z, -H, H, 95, 150, [-194, 470]);
  return { xl, zl };
}

export function buildSouthKen(renderer, { mobile }) {
  const r = rng(4321);
  const group = new THREE.Group();
  const { xl, zl } = streets(r);
  const blocks = [];
  for (let i = 0; i < xl.length - 1; i++) {
    for (let j = 0; j < zl.length - 1; j++) {
      const b = { x0: xl[i].c + xl[i].w / 2, x1: xl[i + 1].c - xl[i + 1].w / 2, z0: zl[j].c + zl[j].w / 2, z1: zl[j + 1].c - zl[j + 1].w / 2 };
      b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2;
      if (b.x1 - b.x0 < 20 || b.z1 - b.z0 < 20) continue;
      if (b.x0 > KENS_GORE) b.park = 'Hyde Park';
      blocks.push(b);
    }
  }
  // the top row of blocks (beyond the last x line) is all park
  blocks.push({ x0: KENS_GORE + 13, x1: H, z0: -H, z1: H, cx: (KENS_GORE + H) / 2, cz: 0, park: 'Hyde Park', big: true });
  const find = (x, z) => blocks.find((b) => !b.big && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  const tag = (x, z, k) => { const b = find(x, z); if (b) b.landmark = k; return b; };
  tag(0, 0, 'campus');
  tag(300, -35, 'rah');
  tag(300, 300, 'rgs');
  tag(-160, -60, 'museums');
  tag(-160, 330, 'va');

  // ---------------------------------------------------------------- ground map
  const S = mobile ? 2048 : 4096;
  const k = S / (2 * H);
  const toPx = (x, z) => [(x + H) * k, (z + H) * k];
  const mapTex = canvasTex(S, S, (ctx) => {
    ctx.fillStyle = '#857e72';
    ctx.fillRect(0, 0, S, S);
    blocks.forEach((b) => {
      if (b.park) return;
      const [px, pz] = toPx(b.x0, b.z0);
      const w = (b.x1 - b.x0) * k, d = (b.z1 - b.z0) * k;
      ctx.fillStyle = '#b0aa9e';
      ctx.fillRect(px - 3 * k, pz - 3 * k, w + 6 * k, d + 6 * k);
      ctx.fillStyle = '#787a5c';
      ctx.fillRect(px, pz, w, d);
    });
    const road = (x0, z0, x1, z1) => { const [a, b] = toPx(x0, z0); const [c, d] = toPx(x1, z1); ctx.fillRect(a, b, c - a, d - b); };
    ctx.fillStyle = '#4c4e51';
    xl.forEach((l) => road(l.c - l.w / 2, -H, l.c + l.w / 2, H));
    zl.forEach((l) => road(-H, l.c - l.w / 2, Math.min(H, KENS_GORE), l.c + l.w / 2));
    ctx.fillStyle = 'rgba(235,232,220,.85)';
    xl.filter((l) => l.major).forEach((l) => { for (let z = -H; z < H; z += 9) road(l.c - 0.15, z, l.c + 0.15, z + 4.5); });
    zl.filter((l) => l.major).forEach((l) => { for (let x = -H; x < KENS_GORE; x += 9) road(x, l.c - 0.15, x + 4.5, l.c + 0.15); });
    // Exhibition Road's shared surface: a pale granite chequer between the museums and Imperial
    for (let x = -300; x < KENS_GORE; x += 3) for (let z = 197; z < 219; z += 3) { ctx.fillStyle = ((x + z) / 3) % 2 ? '#9d978b' : '#b5ae9f'; road(x, z, x + 3, z + 3); }
    // the park: grass, the Serpentine, the Round Pond, the paths
    const [p0x, p0z] = toPx(PARK_X, -H);
    ctx.fillStyle = '#6c8c46';
    ctx.fillRect(p0x, p0z, S - p0x, S);
    for (let i = 0; i < 16000; i++) { ctx.fillStyle = `rgba(${55 + r() * 50},${85 + r() * 50},${30 + r() * 25},.35)`; const [a, b] = toPx(PARK_X + r() * (H - PARK_X), -H + r() * 2 * H); ctx.fillRect(a, b, 6 * k, 6 * k); }
    ctx.strokeStyle = '#c4b89c';
    ctx.lineCap = 'round';
    const path = (pts, w) => { ctx.lineWidth = w * k; ctx.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = toPx(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); };
    path([[420, -55], [1500, -60]], 9); // Lancaster Walk, north from the Albert Memorial
    path([[420, -600], [1500, -610]], 14); // the Broad Walk
    path([[470, 280], [470, 1500]], 12); // Rotten Row
    path([[480, -55], [790, -450]], 7); path([[480, -55], [801, 236]], 7); path([[1100, -380], [801, 236]], 6);
    path([[440, -900], [440, 200]], 8); // the Flower Walk
    ctx.fillStyle = '#2e4a52';
    ctx.strokeStyle = '#2e4a52';
    for (let i = 0; i < SERPENTINE.length - 1; i++) path([SERPENTINE[i], SERPENTINE[i + 1]], (SERPENTINE[i][2] + SERPENTINE[i + 1][2]) / 2);
    { const [a, b] = toPx(ROUND_POND[0], ROUND_POND[1]); ctx.beginPath(); ctx.ellipse(a, b, ROUND_POND[2] * k, ROUND_POND[3] * k, 0, 0, Math.PI * 2); ctx.fill(); }
    // Albert Memorial steps, Royal Albert Hall forecourt
    ctx.fillStyle = '#b9b2a2'; road(430, -82, 482, -28);
    ctx.fillStyle = '#a7a08f'; road(222, -100, 382, 30);
    // Imperial: Queen's Lawn, Dangoor Plaza, the courtyard north of the Sherfield Building
    ctx.fillStyle = '#a49d8d'; road(-24, -181, 208, 197);
    ctx.fillStyle = '#5f7d3d'; road(-22, -72, 30, -10);
    ctx.fillStyle = '#c3bba8'; road(-22, -10, 30, 160); road(95, -60, 175, 50);
    ctx.fillStyle = '#5f7d3d'; road(108, -48, 132, -20); road(140, 10, 165, 40);
    for (let i = 0; i < (mobile ? 20000 : 60000); i++) {
      const v = 90 + r() * 70;
      ctx.fillStyle = `rgba(${v},${v * 0.97},${v * 0.9},.06)`;
      ctx.fillRect(r() * S, r() * S, 2, 2);
    }
  });
  mapTex.anisotropy = 16;
  const ES = mobile ? 1024 : 2048;
  const ek = ES / (2 * H);
  const emTex = canvasTex(ES, ES, (ctx) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ES, ES);
    const lamp = (x, z, rad, a, col) => {
      const px = (x + H) * ek, pz = (z + H) * ek, rr = Math.max(1.5, rad * ek);
      const g = ctx.createRadialGradient(px, pz, 0, px, pz, rr);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.25, `rgba(${col},${a * 0.35})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(px - rr, pz - rr, rr * 2, rr * 2);
    };
    const warm = '255,214,168', led = '235,240,255';
    xl.forEach((l) => { const step = l.major ? 22 : 30; for (let z = -H; z < H; z += step) { lamp(l.c - l.w / 2 - 1.5, z, l.major ? 9 : 8, l.major ? 0.62 : 0.6, l.major ? led : warm); if (!inPark(l.c + l.w / 2 + 1.5, z)) lamp(l.c + l.w / 2 + 1.5, z + step / 2, l.major ? 9 : 8, l.major ? 0.62 : 0.6, l.major ? led : warm); } });
    zl.forEach((l) => { const step = l.major ? 22 : 30; for (let x = -H; x < KENS_GORE; x += step) { lamp(x, l.c - l.w / 2 - 1.5, l.major ? 11 : 8, l.major ? 0.85 : 0.6, l.major ? led : warm); lamp(x + step / 2, l.c + l.w / 2 + 1.5, l.major ? 11 : 8, l.major ? 0.85 : 0.6, l.major ? led : warm); } });
    // park paths, the Albert Memorial, Imperial's walkways
    for (let x = 430; x < H; x += 26) lamp(x, -55, 6, 0.5, warm);
    for (let x = 430; x < H; x += 26) lamp(x, -605, 6, 0.45, warm);
    for (let t = 0; t <= 1; t += 0.05) { lamp(480 + (790 - 480) * t, -55 + (-450 + 55) * t, 5, 0.4, warm); lamp(480 + (801 - 480) * t, -55 + (236 + 55) * t, 5, 0.4, warm); }
    for (let z = -900; z < 200; z += 28) lamp(440, z, 5, 0.4, warm);
    for (let z = 280; z < H; z += 30) lamp(470, z, 6, 0.45, warm);
    lamp(456, -55, 46, 0.32, warm);
    for (let z = -60; z < 160; z += 12) { lamp(-18, z, 6, 0.75, warm); lamp(26, z, 6, 0.75, warm); }
    for (let x = 100; x < 175; x += 12) lamp(x, -6, 6, 0.75, warm);
    lamp(0, 0, 36, 0.35, warm);
  });
  emTex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), plainMaterial({ map: mapTex, roughness: 0.95, emissiveMap: emTex, emissive: '#ffffff', emissiveIntensity: 1.1 }, 'sk-ground'));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const farTex = canvasTex(1024, 1024, (ctx, W) => {
    const rr = rng(78);
    ctx.fillStyle = '#5d5953'; ctx.fillRect(0, 0, W, W);
    for (let i = 0; i < 900; i++) {
      const v = 70 + rr() * 50;
      ctx.fillStyle = rr() < 0.15 ? `rgb(${50 + rr() * 20},${70 + rr() * 25},${35 + rr() * 15})` : `rgb(${v},${v * 0.95},${v * 0.88})`;
      ctx.fillRect(rr() * W, rr() * W, 20 + rr() * 60, 20 + rr() * 60);
    }
    ctx.fillStyle = '#3d3e40';
    for (let x = 0; x < W; x += 64 + rr() * 40) ctx.fillRect(x, 0, 4, W);
    for (let y = 0; y < W; y += 80 + rr() * 50) ctx.fillRect(0, y, W, 4);
  }, { repeat: [90, 90] });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), plainMaterial({ map: farTex, roughness: 0.95 }, 'sk-far'));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.4;
  group.add(far);
  // the rest of Hyde Park beyond the detailed map (the park runs on north and east)
  const parkFar = new THREE.Mesh(new THREE.PlaneGeometry(1200, 4200), plainMaterial({ color: '#486630', roughness: 1 }, 'sk-parkfar'));
  parkFar.rotation.x = -Math.PI / 2;
  parkFar.position.set(H + 500, -0.2, 600);
  group.add(parkFar);

  // water: the Thames, the Serpentine and the Round Pond as real reflective surfaces
  const waterMat = plainMaterial({ color: '#25343b', roughness: 0.06, metalness: 0.05 }, 'sk-water');
  {
    const pts = [];
    for (let z = -9000; z <= 14000; z += 120) pts.push([riverX(z), z]);
    const rv = [], ri = [];
    pts.forEach(([x, z], i) => { rv.push(x - 125, 0.25, z, x + 125, 0.25, z); if (i) { const a = (i - 1) * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
    rg.setIndex(ri);
    rg.computeVertexNormals();
    const river = new THREE.Mesh(rg, waterMat);
    river.receiveShadow = true;
    group.add(river);
  }
  {
    const v = [], idx = [];
    SERPENTINE.forEach(([x, z, w], i) => {
      const n = SERPENTINE[Math.min(i + 1, SERPENTINE.length - 1)], pv = SERPENTINE[Math.max(i - 1, 0)];
      const dx = n[0] - pv[0], dz = n[1] - pv[1], L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L;
      v.push(x + nx * w / 2, 0.3, z + nz * w / 2, x - nx * w / 2, 0.3, z - nz * w / 2);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { idx.reverse(); g.setIndex(idx); g.computeVertexNormals(); }
    group.add(new THREE.Mesh(g, waterMat));
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMat);
    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(ROUND_POND[2], ROUND_POND[3], 1);
    pond.position.set(ROUND_POND[0], 0.3, ROUND_POND[1]);
    group.add(pond);
  }

  // traffic on the main roads (the north-south roads stop at the park)
  const trafficU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } };
  const TV = 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const TF = `uniform float uTime; uniform float uLen; uniform float uSeed; uniform vec3 uCam; varying vec2 vUv; varying vec3 vW;
    float th(float n){ return fract(sin(n) * 43758.5453); }
    void main(){
      float L = vUv.x * uLen, a = vUv.y;
      float l1 = exp(-pow((a - 0.3) / 0.07, 2.0)), l2 = exp(-pow((a - 0.7) / 0.07, 2.0));
      float s1 = L * 0.032 - uTime * 0.5 + uSeed, s2 = L * 0.032 + uTime * 0.46 + uSeed * 1.7;
      float d1 = exp(-pow((fract(s1) - 0.5) * 26.0, 2.0)) * step(0.5, th(floor(s1) + uSeed));
      float d2 = exp(-pow((fract(s2) - 0.5) * 26.0, 2.0)) * step(0.5, th(floor(s2) * 1.3 + uSeed));
      vec3 c = vec3(1.7, 1.55, 1.35) * d1 * l1 * 3.0 + vec3(1.9, 0.12, 0.06) * d2 * l2 * 2.4;
      c *= smoothstep(7000.0, 1200.0, length(vW - uCam));
      gl_FragColor = vec4(c, 1.0);
    }`;
  const road3 = (len, w, x, z, alongZ, seed) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), new THREE.ShaderMaterial({ vertexShader: TV, fragmentShader: TF, uniforms: { ...trafficU, uLen: { value: len }, uSeed: { value: seed } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    if (alongZ) m.rotation.z = Math.PI / 2;
    m.position.set(x, 0.35, z);
    m.frustumCulled = false;
    group.add(m);
  };
  // Exhibition Road is a quiet shared space: no traffic streaks there
  xl.filter((l) => l.major).forEach((l, i) => road3(2 * H, l.w * 0.8, l.c, 0, true, i * 3.1));
  zl.filter((l) => l.major && l.c !== 208).forEach((l, i) => road3(KENS_GORE + H, l.w * 0.8, (KENS_GORE - H) / 2, l.c, false, i * 5.7 + 1));

  // ---------------------------------------------------------------- terraces: white stucco, red-brick mansion blocks
  const terraceMat = facadeMaterial({ floor: 3.3, bay: 2.7, winW: 0.4, winH: 0.58, lit: 0.24, frame: '#efebe2' });
  const stuccoMat = facadeMaterial({ floor: 3.6, bay: 2.9, winW: 0.4, winH: 0.6, lit: 0.26, frame: '#f6f4ee' });
  const mansionMat = facadeMaterial({ floor: 3.4, bay: 2.4, winW: 0.42, winH: 0.6, lit: 0.26, frame: '#efe6da', roof: '#4d4f55' });
  const modernMat = facadeMaterial({ floor: 3.8, bay: 1.7, winW: 0.86, winH: 0.66, sash: 0, lit: 0.34, frame: '#4b5056', roof: '#6b6d70', glassRough: 0.05 });
  const lists = { terrace: [], stucco: [], mansion: [], modern: [] };
  const roofs = [], chim = [];
  const BRICK = ['#a88f6c', '#b39b78', '#9c8463', '#bfa684', '#8f5a46', '#7d4b3b', '#a7745a'];
  const REDBRICK = ['#9b4a36', '#8c4231', '#a6533c', '#94503d'];
  const STUCCO = ['#eeeae2', '#e8e3d8', '#f2efe8', '#e2dccf'];
  const MOD = ['#8d9196', '#7a858e', '#a3a7a8', '#6e7882'];
  const SLATE = ['#4a4f57', '#555a61', '#3f444b', '#5b5d60'];
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const q90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const R = mobile ? 1000 : H;
  const clear = (x, z, m = 4) => !inRect(x, z, CAMPUS, m) && !inPark(x, z);

  const row = (b, edge, style) => {
    const alongX = edge < 2;
    const len = alongX ? b.x1 - b.x0 : b.z1 - b.z0;
    const start = alongX ? b.x0 : b.z0;
    const depth = style === 'modern' ? 18 + r() * 8 : style === 'mansion' ? 15 + r() * 4 : 12 + r() * 4;
    let s = 0;
    while (s < len - 4) {
      const fw = style === 'modern' ? 22 + r() * 18 : style === 'mansion' ? 14 + r() * 10 : 6 + r() * 3;
      const w = Math.min(fw, len - s);
      const c = start + s + w / 2;
      let x, z;
      if (edge === 0) { x = c; z = b.z0 + depth / 2; }
      else if (edge === 1) { x = c; z = b.z1 - depth / 2; }
      else if (edge === 2) { z = c; x = b.x0 + depth / 2; }
      else { z = c; x = b.x1 - depth / 2; }
      s += w;
      if (Math.hypot(x, z) > R * 1.02 || !clear(x, z, depth / 2 + 3)) continue;
      const floors = style === 'modern' ? 5 + Math.floor(r() * 5) : style === 'mansion' ? 6 + Math.floor(r() * 2) : 5 + Math.floor(r() * 2);
      const h = floors * (style === 'modern' ? 3.8 : style === 'stucco' ? 3.6 : 3.4) + 1.2 + r() * 0.6;
      const sx = alongX ? w : depth, sz = alongX ? depth : w;
      m4.compose(new THREE.Vector3(x, 0, z), q0, new THREE.Vector3(sx - 0.15, h, sz - 0.15));
      const pal = style === 'modern' ? MOD : style === 'stucco' ? STUCCO : style === 'mansion' ? REDBRICK : BRICK;
      lists[style].push([m4.clone(), new THREE.Color(pal[Math.floor(r() * pal.length)])]);
      if (style !== 'modern') {
        const rh = 2.2 + r() * 1.4;
        m4.compose(new THREE.Vector3(x, h, z), alongX ? q0 : q90, new THREE.Vector3(w - 0.1, rh, depth * 0.98));
        roofs.push([m4.clone(), new THREE.Color(SLATE[Math.floor(r() * SLATE.length)])]);
        if (r() < 0.7) {
          const ox = alongX ? w / 2 - 0.4 : (r() - 0.5) * depth * 0.3;
          const oz = alongX ? (r() - 0.5) * depth * 0.3 : w / 2 - 0.4;
          m4.compose(new THREE.Vector3(x + ox, h, z + oz), q0, new THREE.Vector3(alongX ? 0.9 : 1.8, rh + 1.3, alongX ? 1.8 : 0.9));
          chim.push([m4.clone(), new THREE.Color(style === 'stucco' ? STUCCO[Math.floor(r() * 4)] : BRICK[Math.floor(r() * 4)])]);
        }
      }
    }
  };
  blocks.forEach((b) => {
    if (b.park || b.landmark === 'campus' || b.landmark === 'museums' || b.landmark === 'va') return;
    if (Math.hypot(b.cx, b.cz) > R + 150) return;
    // South Kensington is white stucco and red-brick mansion blocks; the odd modern block
    let style = r() < 0.12 ? 'modern' : r() < 0.55 ? 'stucco' : r() < 0.6 ? 'mansion' : 'terrace';
    // Prince's Gate and Hyde Park Gate face the park in stucco; around the Albert Hall it's red brick
    if (b.landmark === 'rah' || b.landmark === 'rgs') style = 'mansion';
    if (b.x1 > KENS_GORE - 20 && !b.landmark && Math.abs(b.cz) > 300) style = 'stucco';
    for (let e = 0; e < 4; e++) {
      if (b.landmark === 'rah' && e !== 3 && e !== 1) continue; // keep the Hall's surroundings open
      if (b.landmark === 'rah') { rowRah(b, e); continue; }
      row(b, e, style);
    }
  });
  function rowRah(b, e) {
    // Albert Hall Mansions east of the Hall, the Royal College of Music south-west, Albert Court west
    if (e === 1) {
      lists.mansion.push([new THREE.Matrix4().compose(new THREE.Vector3(330, 0, 150), q0, new THREE.Vector3(70, 30, 40)), new THREE.Color(REDBRICK[0])]);
      roofs.push([new THREE.Matrix4().compose(new THREE.Vector3(330, 30, 150), q0, new THREE.Vector3(70, 4, 40)), new THREE.Color(SLATE[0])]);
    }
  }

  const inst = (geo, mat, list, cast = true) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([mm, c], i) => { im.setMatrixAt(i, mm); im.setColorAt(i, c); });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = cast;
    im.receiveShadow = true;
    im.frustumCulled = false;
    group.add(im);
    return im;
  };
  const bx = baseBox();

  // ---------------------------------------------------------------- landmarks
  const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (mat, x0, x1, y0, y1, z0, z1) => { const m = shadowed(new THREE.Mesh(bx, mat)); m.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2); m.scale.set(x1 - x0, y1 - y0, z1 - z0); group.add(m); return m; };
  const gold = plainMaterial({ color: '#c9a04e', roughness: 0.25, metalness: 1, emissive: '#3a2608', emissiveIntensity: 0.4 }, 'sk-gold');
  const portland = facadeMaterial({ floor: 4.2, bay: 3.0, winW: 0.4, winH: 0.6, lit: 0.18, color: '#ddd5c3', frame: '#cfc7b4', roof: '#8d877b' });

  // Royal Albert Hall: elliptical red-brick drum, terracotta frieze, glass and iron dome; porches; the south steps
  {
    const RX = 300, RZ = -35, AX = 41.5, AZ = 36;
    const hallTex = canvasTex(2048, 256, (ctx, W, Hh) => {
      ctx.fillStyle = '#93452f'; ctx.fillRect(0, 0, W, Hh);
      const rr = rng(9);
      for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(${120 + rr() * 50},${50 + rr() * 30},${35 + rr() * 20},.35)`; ctx.fillRect(rr() * W, rr() * Hh, 3, 1); }
      // terracotta bands and the mosaic frieze near the top
      ctx.fillStyle = '#c9a77a'; ctx.fillRect(0, 22, W, 6); ctx.fillRect(0, 118, W, 5); ctx.fillRect(0, 196, W, 4);
      ctx.fillStyle = '#b98f62'; ctx.fillRect(0, 34, W, 26);
      for (let x = 0; x < W; x += 16) { ctx.fillStyle = (x / 16) % 2 ? '#6e4b33' : '#d2b48a'; ctx.fillRect(x + 2, 38, 12, 18); }
      // two tiers of arched windows
      for (const [y, h, wd] of [[70, 40, 10], [140, 46, 12]]) {
        for (let x = 6; x < W; x += 21.3) {
          ctx.fillStyle = '#c4a57c'; ctx.fillRect(x - 2, y - 2, wd + 4, h + 4);
          ctx.fillStyle = rr() < 0.42 ? '#f2b874' : '#2c2a2b';
          ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + wd / 2); ctx.arc(x + wd / 2, y + wd / 2, wd / 2, Math.PI, 0); ctx.lineTo(x + wd, y + h); ctx.fill();
        }
      }
      ctx.fillStyle = '#7a3826'; ctx.fillRect(0, 214, W, 42);
      for (let x = 10; x < W; x += 32) { ctx.fillStyle = '#2b2223'; ctx.fillRect(x, 222, 14, 30); }
    });
    hallTex.wrapS = THREE.RepeatWrapping;
    const hallMat = plainMaterial({ map: hallTex, roughness: 0.85, emissiveMap: hallTex, emissive: '#ffffff', emissiveIntensity: 0.0 }, 'sk-rah');
    const drum = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true), hallMat));
    drum.scale.set(AX, 26, AZ); drum.position.set(RX, 13, RZ); group.add(drum);
    const capTop = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128), plainMaterial({ color: '#7d3a28', roughness: 0.8 }, 'sk-rah2')));
    capTop.scale.set(AX + 0.8, 1.2, AZ + 0.8); capTop.position.set(RX, 26.2, RZ); group.add(capTop);
    // stepped base of the dome (a ring of slate and lead) and the glazed dome with ribs
    const ring = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.08, 1, 128), plainMaterial({ color: '#5a5f66', roughness: 0.6, metalness: 0.3 }, 'sk-rahring')));
    ring.scale.set(AX - 1, 3.2, AZ - 1); ring.position.set(RX, 28.4, RZ); group.add(ring);
    const domeTex = canvasTex(1024, 512, (ctx, W, Hh) => {
      ctx.fillStyle = '#3e4952'; ctx.fillRect(0, 0, W, Hh);
      for (let x = 0; x < W; x += W / 48) { ctx.fillStyle = '#20262c'; ctx.fillRect(x, 0, 3, Hh); }
      for (let y = 0; y < Hh; y += 28) { ctx.fillStyle = '#262c33'; ctx.fillRect(0, y, W, 2); }
      ctx.fillStyle = 'rgba(255,200,140,.35)'; ctx.fillRect(0, Hh * 0.55, W, Hh * 0.2);
    });
    const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 24, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial({ map: domeTex, roughness: 0.25, metalness: 0.6, emissiveMap: domeTex, emissive: '#ffffff', emissiveIntensity: 0.25 }, 'sk-rahdome')));
    dome.scale.set(AX - 3, 11, AZ - 3); dome.position.set(RX, 30, RZ); group.add(dome);
    const lantern = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 2.4, 32), plainMaterial({ color: '#59616a', roughness: 0.4, metalness: 0.5 }, 'sk-rahl')));
    lantern.position.set(RX, 41.5, RZ); group.add(lantern);
    // porches on the four axes (the south porch to the steps, the north porch facing the Memorial)
    const redM = facadeMaterial({ floor: 4.5, bay: 3.2, winW: 0.4, winH: 0.6, lit: 0.3, color: '#9a4a35', frame: '#d6bc92' });
    for (const [px, pz, sx, sz] of [[RX + AX - 2, RZ, 12, 18], [RX - AX + 2, RZ, 12, 18], [RX, RZ + AZ - 2, 18, 12], [RX, RZ - AZ + 2, 18, 12]]) box(redM, px - sx / 2, px + sx / 2, 0, 17, pz - sz / 2, pz + sz / 2);
    for (let i = 0; i < 10; i++) box(plainMaterial({ color: '#b5ab99', roughness: 0.8 }, 'sk-steps'), RX - AX - 4 - i * 1.4, RX - AX + 4, 0, 4.4 - i * 0.44, RZ - 30, RZ + 30);
    // Royal College of Music (red brick with steep slate roofs and turrets), south-west of the Hall
    box(redM, 226, 258, 0, 21, -150, -70);
    for (const z of [-150, -110, -70]) { const t = shadowed(new THREE.Mesh(new THREE.ConeGeometry(3.4, 9, 8), plainMaterial({ color: '#4a4f57', roughness: 0.6 }, 'sk-slate2'))); t.position.set(242, 25.5, z); group.add(t); }
  }

  // The Albert Memorial: stepped podium, sculpture groups, the canopy on clustered granite columns, gabled arches
  // with mosaics, a tiered gilded spire with a cross, and Prince Albert seated in gilt bronze, facing south to the Hall
  {
    const AX = 456, AZ = -55;
    const pal = plainMaterial({ color: '#d9d2c2', roughness: 0.6 }, 'sk-am-stone');
    const gran = plainMaterial({ color: '#8c5a52', roughness: 0.3, metalness: 0.1 }, 'sk-am-gran');
    const mosaic = canvasTex(256, 256, (ctx, W) => {
      ctx.fillStyle = '#2a3f7a'; ctx.fillRect(0, 0, W, W);
      ctx.fillStyle = '#d4a64a'; for (let i = 0; i < 26; i++) ctx.fillRect(i * 10, 0, 4, W);
      ctx.fillStyle = '#9a2c2a'; ctx.beginPath(); ctx.arc(W / 2, W / 2, W * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8d9a8'; ctx.beginPath(); ctx.arc(W / 2, W / 2, W * 0.16, 0, Math.PI * 2); ctx.fill();
    });
    const mos = plainMaterial({ map: mosaic, roughness: 0.3, metalness: 0.4, emissiveMap: mosaic, emissive: '#ffffff', emissiveIntensity: 0.12 }, 'sk-am-mos');
    for (let i = 0; i < 8; i++) { const w = 54 - i * 3.2; box(pal, AX - w / 2, AX + w / 2, 0, (i + 1) * 0.45, AZ - w / 2, AZ + w / 2); }
    box(pal, AX - 17, AX + 17, 3.6, 7.6, AZ - 17, AZ + 17); // podium with the frieze of Parnassus
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      // the four continents at the corners of the steps
      const g = shadowed(new THREE.Mesh(new THREE.ConeGeometry(3.2, 6.5, 6), pal));
      g.position.set(AX + sx * 23, 3.6 + 3.25, AZ + sz * 23); group.add(g);
      // clustered columns
      for (const [cx, cz] of [[0, 0], [1.1, 0], [0, 1.1], [1.1, 1.1]]) {
        const c = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 12.5, 16), gran));
        c.position.set(AX + sx * (6.6 + cx * sx * 0.5), 7.6 + 6.25, AZ + sz * (6.6 + cz * sz * 0.5)); group.add(c);
      }
    }
    box(pal, AX - 8.6, AX + 8.6, 20.1, 23.5, AZ - 8.6, AZ + 8.6); // canopy entablature
    // gables with mosaics on all four sides
    const gab = new THREE.Shape(); gab.moveTo(-8.6, 0); gab.lineTo(8.6, 0); gab.lineTo(0, 9); gab.closePath();
    const gabG = new THREE.ExtrudeGeometry(gab, { depth: 0.8, bevelEnabled: false });
    for (let i = 0; i < 4; i++) {
      const g = shadowed(new THREE.Mesh(gabG, pal));
      g.position.set(AX, 23.5, AZ); g.rotation.y = (i * Math.PI) / 2; g.translateZ(8.0); group.add(g);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(gab), mos);
      m.scale.set(0.62, 0.62, 1); m.position.set(AX, 24.6, AZ); m.rotation.y = (i * Math.PI) / 2; m.translateZ(8.85); group.add(m);
      const crock = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 8), gold); crock.position.set(AX, 33.6, AZ); crock.rotation.y = (i * Math.PI) / 2; crock.translateZ(8.4); group.add(crock);
    }
    // the gilded spire in tiers, with the cross at the top (about 54 m)
    const tiers = [[23.5, 6.2, 5.2, 9, pal], [32.5, 4.6, 3.6, 6, gold], [38.5, 3.2, 2.0, 6, pal], [44.5, 1.8, 0.6, 7, gold]];
    tiers.forEach(([y, r0, r1, h, mat]) => { const t = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 8), mat)); t.position.set(AX, y + h / 2, AZ); group.add(t); });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const p = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.2, 6), gold); p.position.set(AX + Math.cos(a) * 4.3, 34, AZ + Math.sin(a) * 4.3); group.add(p); }
    box(gold, AX - 0.12, AX + 0.12, 51.5, 54.2, AZ - 0.12, AZ + 0.12);
    box(gold, AX - 0.12, AX + 0.12, 52.9, 53.2, AZ - 0.9, AZ + 0.9);
    // Prince Albert seated, gilded, facing the Hall (south)
    box(pal, AX - 2.2, AX + 2.2, 7.6, 9.4, AZ - 2.2, AZ + 2.2);
    box(gold, AX - 1.4, AX + 1.0, 9.4, 11.0, AZ - 1.3, AZ + 1.3);
    box(gold, AX - 1.2, AX - 0.2, 11.0, 13.6, AZ - 1.0, AZ + 1.0);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), gold); hd.position.set(AX - 0.7, 14.1, AZ); group.add(hd);
    box(gold, AX - 0.1, AX + 1.4, 9.4, 10.2, AZ - 1.1, AZ + 1.1);
  }

  // Natural History Museum: the long Romanesque front on Cromwell Road in buff and blue-grey terracotta bands,
  // twin central towers with spires, end pavilions with towers, the great hall behind
  const nhmTex = canvasTex(512, 256, (ctx, W, Hh) => {
    ctx.fillStyle = '#cdb994'; ctx.fillRect(0, 0, W, Hh);
    for (let y = 0; y < Hh; y += 18) { ctx.fillStyle = '#8f9aa3'; ctx.fillRect(0, y, W, 5); }
    for (let x = 8; x < W; x += 32) for (let y = 30; y < Hh - 30; y += 70) {
      ctx.fillStyle = '#d9c8a4'; ctx.fillRect(x - 3, y - 3, 22, 46);
      ctx.fillStyle = (x * 7 + y) % 5 < 2 ? '#f0b46a' : '#2a2a2c';
      ctx.beginPath(); ctx.moveTo(x, y + 40); ctx.lineTo(x, y + 8); ctx.arc(x + 8, y + 8, 8, Math.PI, 0); ctx.lineTo(x + 16, y + 40); ctx.fill();
    }
  }, { repeat: [6, 1] });
  const nhm = plainMaterial({ map: nhmTex, roughness: 0.75, emissiveMap: nhmTex, emissive: '#ffffff', emissiveIntensity: 0.0 }, 'sk-nhm');
  const nhmSolid = plainMaterial({ color: '#c9b591', roughness: 0.8 }, 'sk-nhm2');
  const slateR = plainMaterial({ color: '#4a5058', roughness: 0.55 }, 'sk-nhmr');
  {
    const F0 = -284; // front on Cromwell Road
    box(nhm, F0, F0 + 22, 0, 22, -182, 40);
    box(nhmSolid, F0 + 22, F0 + 140, 0, 20, -150, 10);
    box(slateR, F0 + 30, F0 + 120, 20, 34, -95, -45); // Hintze Hall roof
    const tower = (x, z, w, h, sp) => { box(nhm, x - w / 2, x + w / 2, 0, h, z - w / 2, z + w / 2); const s = shadowed(new THREE.Mesh(new THREE.ConeGeometry(w * 0.62, sp, 4), slateR)); s.rotation.y = Math.PI / 4; s.position.set(x, h + sp / 2, z); group.add(s); };
    tower(F0 + 8, -83, 10, 50, 14); tower(F0 + 8, -59, 10, 50, 14);
    box(nhm, F0 - 3, F0 + 22, 0, 30, -76, -66); // central entrance arch block
    tower(F0 + 8, -178, 13, 32, 10); tower(F0 + 8, 36, 13, 32, 10);
    for (let z = -170; z < 30; z += 22) { const s = shadowed(new THREE.Mesh(new THREE.ConeGeometry(3, 7, 4), slateR)); s.rotation.y = Math.PI / 4; s.position.set(F0 + 11, 25.5, z); group.add(s); }
  }
  // the Science Museum (Portland stone, Exhibition Road front) and Imperial's buildings on Imperial College Road's south side come from imperial.js
  box(portland, -232, -100, 0, 24, 60, 196);
  box(portland, -100, -60, 0, 20, 120, 196);

  // V&A: Aston Webb's Cromwell Road front in red brick and Portland stone, the central tower with its open crown
  {
    const va = facadeMaterial({ floor: 5.0, bay: 3.6, winW: 0.4, winH: 0.6, lit: 0.22, color: '#a35a42', frame: '#e3d9c4', roof: '#596068' });
    box(va, -284, -262, 0, 24, 222, 460);
    box(va, -262, -150, 0, 20, 222, 300);
    box(va, -262, -120, 0, 22, 380, 460);
    box(portland, -286, -262, 0, 30, 316, 344);
    const t = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.5, 16, 8), plainMaterial({ color: '#d8d0bc', roughness: 0.7 }, 'sk-va'))); t.position.set(-274, 38, 330); group.add(t);
    const crown = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 5.6, 6, 8, 1, true), plainMaterial({ color: '#d8d0bc', roughness: 0.6, side: THREE.DoubleSide }, 'sk-va2'))); crown.position.set(-274, 49, 330); group.add(crown);
    const fame = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4, 8), gold); fame.position.set(-274, 54, 330); group.add(fame);
  }

  // Kensington Palace (red brick) at the west of the gardens, and the Orangery
  {
    const kp = facadeMaterial({ floor: 4.4, bay: 3.2, winW: 0.42, winH: 0.62, lit: 0.18, color: '#a1543d', frame: '#e8e0d0', roof: '#4f545b' });
    box(kp, 800, 880, 0, 16, -800, -730);
    box(kp, 830, 850, 0, 18, -730, -700);
    box(facadeMaterial({ floor: 6, bay: 4, winW: 0.6, winH: 0.75, lit: 0.1, color: '#b0624a', frame: '#efe7d8' }), 900, 912, 0, 9, -790, -700);
  }

  inst(bx, terraceMat, lists.terrace);
  inst(bx, stuccoMat, lists.stucco);
  inst(bx, mansionMat, lists.mansion);
  inst(bx, modernMat, lists.modern);
  inst(roofGeometry(), plainMaterial({ roughness: 0.7, metalness: 0.05 }, 'sk-slate'), roofs);
  inst(bx, plainMaterial({ roughness: 0.9 }, 'sk-chim'), chim);

  // ---------------------------------------------------------------- trees: the park's avenues and groves, street plane trees
  const trees = [];
  const maxTrees = mobile ? 1300 : 3800;
  const addTree = (x, z, s = 1) => {
    if (trees.length >= maxTrees || inRect(x, z, CAMPUS, 2)) return;
    if (Math.hypot(x, z) > R) return;
    if (x > PARK_X && SERPENTINE.some(([sx, sz, w]) => Math.hypot(x - sx, z - sz) < w * 0.75 + 8)) return;
    if (Math.hypot((x - ROUND_POND[0]) / (ROUND_POND[2] + 8), (z - ROUND_POND[1]) / (ROUND_POND[3] + 8)) < 1) return;
    if (Math.abs(x - 456) < 34 && Math.abs(z + 55) < 34) return;
    const h = (14 + r() * 10) * s, cr = (5 + r() * 3.5) * s;
    trees.push([x, z, h, cr]);
  };
  // avenues: Lancaster Walk, the Broad Walk, Rotten Row, Flower Walk
  for (let x = 490; x < R; x += 11) { addTree(x, -64); addTree(x, -46); }
  for (let x = 430; x < R; x += 12) { addTree(x, -618); addTree(x, -592); }
  for (let z = 300; z < R; z += 12) { addTree(462, z); addTree(480, z); }
  for (let z = -900; z < 200; z += 14) addTree(452, z, 0.9);
  // groves
  for (let i = 0; i < 6000 && trees.length < maxTrees - 500; i++) {
    const x = PARK_X + 12 + r() * (R - PARK_X - 12), z = -R + r() * 2 * R;
    const n = Math.sin(x * 0.006 + 1.3) * Math.cos(z * 0.005) + Math.sin(z * 0.011 + x * 0.004);
    if (n > 0.35 || r() < 0.08) addTree(x, z);
  }
  // plane trees on the main streets and in the garden squares
  xl.filter((l) => l.major && l.c < KENS_GORE + 1).forEach((l) => { for (let z = -R; z < R; z += 13) { if (r() < 0.7) addTree(l.c - l.w / 2 - 2, z, 0.8); if (r() < 0.7 && l.c < KENS_GORE - 1) addTree(l.c + l.w / 2 + 2, z, 0.8); } });
  zl.filter((l) => l.major).forEach((l) => { for (let x = -R; x < KENS_GORE - 14; x += 13) { if (r() < 0.6) addTree(x, l.c - l.w / 2 - 2, 0.8); if (r() < 0.6) addTree(x, l.c + l.w / 2 + 2, 0.8); } });
  for (let z = -170; z < 190; z += 12) addTree(-30 + (z % 24 ? 8 : -8), z, 0.85); // Imperial College Road
  const leafCols = ['#4f6b35', '#5d7a3c', '#46602f', '#6b7f43', '#55703a', '#7a8a48'];
  const canopy = [], trunk = [];
  trees.forEach(([x, z, h, cr]) => {
    const lobes = x > PARK_X ? 4 + Math.floor(r() * 2) : 5 + Math.floor(r() * 3);
    for (let i = 0; i < lobes; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * cr * 0.62;
      const ox = Math.cos(a) * rad, oz = Math.sin(a) * rad, oy = (r() - 0.35) * cr * 0.75;
      const s = cr * (0.42 + r() * 0.2);
      m4.compose(new THREE.Vector3(x + ox, h - cr * 0.6 + oy, z + oz), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(s, s, s));
      canopy.push([m4.clone(), new THREE.Color(leafCols[Math.floor(r() * leafCols.length)]).multiplyScalar(0.85 + r() * 0.3)]);
    }
    m4.compose(new THREE.Vector3(x, 0, z), q0, new THREE.Vector3(0.45, h - cr * 0.8, 0.45));
    trunk.push([m4.clone(), new THREE.Color('#5a5047')]);
  });
  inst(treeGeometry(5, 1), leafMaterial('sk-leaf'), canopy);
  inst(bx, plainMaterial({ roughness: 0.9 }, 'sk-trunk'), trunk, false);

  // ---------------------------------------------------------------- outer city + skyline
  const outer = [];
  const ro = rng(98);
  for (let x = -5200; x < 5200; x += 85) for (let z = -5200; z < 7600; z += 85) {
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < R + 40 || ro() < 0.5) continue;
    if (Math.abs(x - riverX(z)) < 170) continue;
    if (x > PARK_X - 40 && x < 1700 && z > -1500 && z < 2500) continue; // Hyde Park and Kensington Gardens
    const h = 12 + Math.pow(ro(), 4) * 40;
    m4.compose(new THREE.Vector3(x + (ro() - 0.5) * 30, 0, z + (ro() - 0.5) * 30), q0, new THREE.Vector3(35 + ro() * 35, h, 35 + ro() * 35));
    outer.push([m4.clone(), new THREE.Color(ro() < 0.55 ? STUCCO[Math.floor(ro() * 4)] : ro() < 0.7 ? REDBRICK[Math.floor(ro() * 4)] : MOD[Math.floor(ro() * 4)])]);
  }
  inst(bx, terraceMat, outer, false);

  const towerMat = facadeMaterial({ floor: 4.0, bay: 1.5, winW: 0.9, winH: 0.75, sash: 0, color: '#7e8d98', frame: '#3c444b', roof: '#55595e', glassRough: 0.04, lit: 0.45, litI: 3.0, metalness: 0.2, roughness: 0.4 });
  const city = [];
  const rc = rng(6);
  // the City cluster to the east, Canary Wharf beyond, a few towers at Vauxhall and Nine Elms
  for (let i = 0; i < 28; i++) {
    const x = 1350 + (rc() - 0.5) * 700, z = 6500 + (rc() - 0.5) * 700;
    const h = 90 + Math.pow(rc(), 1.5) * 190;
    m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rc() * 0.6, 0)), new THREE.Vector3(30 + rc() * 25, h, 30 + rc() * 25));
    city.push([m4.clone(), new THREE.Color(MOD[Math.floor(rc() * 4)])]);
  }
  for (let i = 0; i < 14; i++) {
    const x = 400 + (rc() - 0.5) * 500, z = 11200 + (rc() - 0.5) * 600;
    m4.compose(new THREE.Vector3(x, 0, z), q0, new THREE.Vector3(40, 140 + rc() * 100, 40));
    city.push([m4.clone(), new THREE.Color('#8a949c')]);
  }
  for (let i = 0; i < 8; i++) {
    const x = -1500 + (rc() - 0.5) * 300, z = 3300 + (rc() - 0.5) * 500;
    m4.compose(new THREE.Vector3(x, 0, z), q0, new THREE.Vector3(28, 80 + rc() * 90, 28));
    city.push([m4.clone(), new THREE.Color(MOD[Math.floor(rc() * 4)])]);
  }
  inst(bx, towerMat, city, false);
  const av = [];
  city.forEach(([mm]) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); mm.decompose(p, q, s); av.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, s.y + 2, p.z), q0, new THREE.Vector3(2.2, 2.2, 2.2))); });
  const glassy = plainMaterial({ color: '#7f909b', roughness: 0.1, metalness: 0.5 }, 'sk-glassy');
  // the Shard (south bank by London Bridge)
  const shard = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 32, 310, 4, 1), glassy);
  const shz = 6260;
  shard.position.set(riverX(shz) - 200, 155, shz);
  shard.rotation.y = Math.PI / 4;
  group.add(shard);
  av.push(new THREE.Matrix4().compose(new THREE.Vector3(shard.position.x, 312, shz), q0, new THREE.Vector3(2.4, 2.4, 2.4)));
  const gh = new THREE.LatheGeometry(Array.from({ length: 16 }, (_, i) => { const t = i / 15; return new THREE.Vector2(Math.max(0.5, 27 * Math.sin(Math.PI * (0.18 + t * 0.82)) * (1 - t * 0.25)), t * 180); }), 32);
  const gherkin = new THREE.Mesh(gh, plainMaterial({ color: '#4e6470', roughness: 0.18, metalness: 0.4 }, 'sk-gherkin'));
  gherkin.position.set(1550, 0, 6750);
  group.add(gherkin);
  // the BT Tower to the north-east
  {
    const mat = plainMaterial({ color: '#c9cdd1', roughness: 0.35, metalness: 0.3 }, 'sk-bt');
    const dark = plainMaterial({ color: '#2b3036', roughness: 0.4, metalness: 0.4, emissive: '#7fc2ff', emissiveIntensity: 0.9 }, 'sk-btd');
    const BX = 2580, BZ = 2630;
    const cyl = (rad, y0, h, m) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 32), m); c.position.set(BX, y0 + h / 2, BZ); group.add(c); };
    cyl(9, 0, 110, mat);
    for (let i = 0; i < 6; i++) cyl(10.5, 110 + i * 7, 3.5, dark), cyl(9.5, 113.5 + i * 7, 3.5, mat);
    cyl(7, 152, 16, mat);
    cyl(2, 168, 14, dark);
    av.push(new THREE.Matrix4().compose(new THREE.Vector3(BX, 183, BZ), q0, new THREE.Vector3(1.6, 1.6, 1.6)));
  }
  // the London Eye on the south bank by Westminster
  {
    const ez = 3960, ex = riverX(ez) - 60;
    const steel = plainMaterial({ color: '#d6dbe0', roughness: 0.3, metalness: 0.8 }, 'sk-eye');
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(60, 1.2, 8, 96), steel);
    wheel.position.set(ex, 75, ez); wheel.rotation.y = 0.35; group.add(wheel);
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(56, 0.6, 6, 96), steel); rim2.position.copy(wheel.position); rim2.rotation.y = 0.35; group.add(rim2);
    const caps = [];
    for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; const p = new THREE.Vector3(Math.cos(a) * 61, Math.sin(a) * 61, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35).add(wheel.position); caps.push([new THREE.Matrix4().compose(p, q0, new THREE.Vector3(1.6, 1.6, 1.6)), new THREE.Color(1, 1, 1)]); }
    inst(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 2.6) }), caps, false);
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 80, 8), steel); legs.position.set(ex - 18, 40, ez); legs.rotation.z = 0.5; group.add(legs);
  }
  // Battersea Power Station: the brick block and four white chimneys, south of the river
  {
    const bz = 2240, bxp = riverX(bz) - 260;
    box(facadeMaterial({ floor: 6, bay: 4, winW: 0.3, winH: 0.7, lit: 0.3, color: '#7a4434', frame: '#c9a07a' }), bxp - 80, bxp + 80, 0, 50, bz - 50, bz + 50);
    const white = plainMaterial({ color: '#ece9e2', roughness: 0.6 }, 'sk-bps');
    for (const [dx, dz] of [[-72, -44], [72, -44], [-72, 44], [72, 44]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.8, 52, 24), white); c.position.set(bxp + dx, 76, bz + dz); group.add(c); }
  }
  const avMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.15) });
  inst(new THREE.SphereGeometry(1, 8, 6), avMat, av.map((m) => [m, new THREE.Color(1, 1, 1)]), false);

  return { group, mapTex, emTex, blocks, trafficU, avMat };
}
