// Daytime London around UCL for the intro (metres; +x = north, +z = east, UCL's Portico at the origin facing east).
// Bloomsbury's streets and garden squares, Georgian brick terraces with slate roofs and chimneys, plane trees,
// nearby landmarks (Senate House, UCH, BT Tower, British Museum), the Thames, and the City and the Shard on the horizon.
import * as THREE from 'three';
import { MAP_HALF } from './shaders';
import { baseBox, canvasTex, facadeMaterial, leafMaterial, plainMaterial, rng, roofGeometry, treeGeometry } from './materials';

const H = MAP_HALF;
export const riverX = (z) => -2150 + Math.sin(z * 0.00062) * 260 + Math.sin(z * 0.0017 + 1.1) * 120;

// UCL Wilkins building + Main Quad footprint (kept clear for ucl.js)
const UCL_RECT = [-80, 80, -80, 112];
const inRect = (x, z, r, m = 0) => x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m;

function streets(r) {
  // lines of constant x run along z (north/south positions); lines of constant z run along x
  const majX = [[380, 34], [-150, 16], [150, 14], [-700, 22], [-950, 26], [700, 18], [1080, 20], [-1250, 18]];
  const majZ = [[115, 20], [-260, 22], [520, 22], [-650, 16], [900, 18], [-1050, 18], [1300, 20]];
  const fill = (maj, lo, hi, smin, smax, keepOut) => {
    const lines = maj.map(([c, w]) => ({ c, w, major: true })).sort((a, b) => a.c - b.c);
    const all = [...lines];
    const edges = [{ c: lo }, ...lines, { c: hi }];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i].c, b = edges[i + 1].c;
      if (keepOut && a >= keepOut[0] - 1 && b <= keepOut[1] + 1) continue;
      let c = a + smin + r() * (smax - smin);
      while (c < b - smin * 0.7) {
        all.push({ c, w: 10 + r() * 4, major: false });
        c += smin + r() * (smax - smin);
      }
    }
    return all.sort((x, y) => x.c - y.c);
  };
  const xl = fill(majX, -H, H, 80, 135, [-150, 150]);
  const zl = fill(majZ, -H, H, 105, 165, [-260, 115]);
  return { xl, zl };
}

const SQUARES = [
  ['Gordon Square', 130, 250], ['Woburn Square', -40, 230], ['Russell Square', -470, 610], ['Bedford Square', -560, -170],
  ['Tavistock Square', 280, 470], ['Fitzroy Square', 230, -470], ['Euston Square', 430, 250], ['Bloomsbury Square', -640, 650],
];
const LANDMARK_SITES = { senate: [-320, 190], museum: [-560, 330], uch: [190, 160], bt: [-320, -620], euston: [470, 520] };

export function buildLondon(renderer, { mobile }) {
  const r = rng(1234);
  const group = new THREE.Group();
  const { xl, zl } = streets(r);
  const blocks = [];
  for (let i = 0; i < xl.length - 1; i++) {
    for (let j = 0; j < zl.length - 1; j++) {
      const b = { x0: xl[i].c + xl[i].w / 2, x1: xl[i + 1].c - xl[i + 1].w / 2, z0: zl[j].c + zl[j].w / 2, z1: zl[j + 1].c - zl[j + 1].w / 2 };
      b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2;
      if (b.x1 - b.x0 < 20 || b.z1 - b.z0 < 20) continue;
      blocks.push(b);
    }
  }
  const find = (x, z) => blocks.find((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  SQUARES.forEach(([n, x, z]) => { const b = find(x, z); if (b) b.park = n; });
  Object.entries(LANDMARK_SITES).forEach(([k, [x, z]]) => { const b = find(x, z); if (b && !b.park) b.landmark = k; });
  const uclBlock = find(0, 0);
  if (uclBlock) uclBlock.campus = true;

  // ---------------------------------------------------------------- ground map
  const S = mobile ? 2048 : 4096;
  const k = S / (2 * H);
  const toPx = (x, z) => [(x + H) * k, (z + H) * k];
  const mapTex = canvasTex(S, S, (ctx) => {
    ctx.fillStyle = '#857e72';
    ctx.fillRect(0, 0, S, S);
    // pavements around blocks, courtyards inside
    blocks.forEach((b) => {
      const [px, pz] = toPx(b.x0, b.z0);
      const w = (b.x1 - b.x0) * k, d = (b.z1 - b.z0) * k;
      ctx.fillStyle = '#b0aa9e';
      ctx.fillRect(px - 3 * k, pz - 3 * k, w + 6 * k, d + 6 * k);
      ctx.fillStyle = b.park ? '#5f7d3d' : '#787a5c';
      ctx.fillRect(px, pz, w, d);
      if (b.park) {
        ctx.strokeStyle = '#b8ad94';
        ctx.lineWidth = 3 * k;
        ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(px + w, pz + d); ctx.moveTo(px + w, pz); ctx.lineTo(px, pz + d); ctx.stroke();
        ctx.strokeRect(px + 6 * k, pz + 6 * k, w - 12 * k, d - 12 * k);
        ctx.beginPath(); ctx.arc(px + w / 2, pz + d / 2, Math.min(w, d) * 0.12, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(${40 + r() * 40},${70 + r() * 40},${25 + r() * 20},.35)`; ctx.fillRect(px + r() * w, pz + r() * d, 4 * k, 4 * k); }
      }
    });
    // roads
    const road = (x0, z0, x1, z1) => { const [a, b] = toPx(x0, z0); const [c, d] = toPx(x1, z1); ctx.fillRect(a, b, c - a, d - b); };
    ctx.fillStyle = '#4c4e51';
    xl.forEach((l) => road(l.c - l.w / 2, -H, l.c + l.w / 2, H));
    zl.forEach((l) => road(-H, l.c - l.w / 2, H, l.c + l.w / 2));
    // lane markings on major roads, zebra crossings
    ctx.fillStyle = 'rgba(235,232,220,.85)';
    xl.filter((l) => l.major).forEach((l) => { for (let z = -H; z < H; z += 9) road(l.c - 0.15, z, l.c + 0.15, z + 4.5); });
    zl.filter((l) => l.major).forEach((l) => { for (let x = -H; x < H; x += 9) road(x, l.c - 0.15, x + 4.5, l.c + 0.15); });
    xl.forEach((a) => zl.forEach((b) => {
      if (!(a.major || b.major) || r() < 0.4) return;
      for (let s = -b.w / 2 + 1; s < b.w / 2 - 1; s += 1.2) road(a.c + a.w / 2 + 1, b.c + s, a.c + a.w / 2 + 4, b.c + s + 0.6);
    }));
    // UCL: Main Quad lawns and paths, Portico steps area
    ctx.fillStyle = '#a7a08f'; road(-48, -5, 48, 108);
    ctx.fillStyle = '#64843f'; road(-40, 30, -6, 100); road(6, 30, 40, 100);
    ctx.fillStyle = '#c9c1ad'; road(-6, 14, 6, 108);
    // grain
    for (let i = 0; i < (mobile ? 20000 : 60000); i++) {
      const v = 90 + r() * 70;
      ctx.fillStyle = `rgba(${v},${v * 0.97},${v * 0.9},.06)`;
      ctx.fillRect(r() * S, r() * S, 2, 2);
    }
  });
  mapTex.anisotropy = 16;
  // street lighting at first light: lamp pools along every street, brighter on the main roads, lamps on the Quad path
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
    xl.forEach((l) => { const step = l.major ? 22 : 30; for (let z = -H; z < H; z += step) { lamp(l.c - l.w / 2 - 1.5, z, l.major ? 11 : 8, l.major ? 0.85 : 0.6, l.major ? led : warm); lamp(l.c + l.w / 2 + 1.5, z + step / 2, l.major ? 11 : 8, l.major ? 0.85 : 0.6, l.major ? led : warm); } });
    zl.forEach((l) => { const step = l.major ? 22 : 30; for (let x = -H; x < H; x += step) { lamp(x, l.c - l.w / 2 - 1.5, l.major ? 11 : 8, l.major ? 0.85 : 0.6, l.major ? led : warm); lamp(x + step / 2, l.c + l.w / 2 + 1.5, l.major ? 11 : 8, l.major ? 0.85 : 0.6, l.major ? led : warm); } });
    blocks.forEach((b) => { if (!b.park) return; for (let t = 0.1; t < 1; t += 0.12) { lamp(b.x0 + (b.x1 - b.x0) * t, b.z0 + (b.z1 - b.z0) * t, 7, 0.55, warm); lamp(b.x1 - (b.x1 - b.x0) * t, b.z0 + (b.z1 - b.z0) * t, 7, 0.55, warm); } });
    for (let z = 34; z < 104; z += 14) { lamp(-7, z, 7, 0.8, warm); lamp(7, z, 7, 0.8, warm); }
    lamp(0, 30, 40, 0.25, warm);
  });
  emTex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), plainMaterial({ map: mapTex, roughness: 0.95, emissiveMap: emTex, emissive: '#ffffff', emissiveIntensity: 1.1 }, 'ground'));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const farTex = canvasTex(1024, 1024, (ctx, W) => {
    const rr = rng(77);
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
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), plainMaterial({ map: farTex, roughness: 0.95 }, 'far'));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.4;
  group.add(far);

  // the Thames
  const pts = [];
  for (let z = -9000; z <= 12000; z += 150) pts.push([riverX(z), z]);
  const rv = [], ri = [];
  pts.forEach(([x, z], i) => { rv.push(x - 125, 0.25, z, x + 125, 0.25, z); if (i) { const a = (i - 1) * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
  rg.setIndex(ri);
  rg.computeVertexNormals();
  const river = new THREE.Mesh(rg, plainMaterial({ color: '#25343b', roughness: 0.07, metalness: 0.05 }, 'river'));
  river.receiveShadow = true;
  group.add(river);

  // traffic: headlights and tail lights moving along the main roads
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
  xl.filter((l) => l.major).forEach((l, i) => road3(2 * H, l.w * 0.8, l.c, 0, true, i * 3.1));
  zl.filter((l) => l.major).forEach((l, i) => road3(2 * H, l.w * 0.8, 0, l.c, false, i * 5.7 + 1));

  // ---------------------------------------------------------------- terraces
  const terraceMat = facadeMaterial({ floor: 3.3, bay: 2.7, winW: 0.4, winH: 0.58, lit: 0.24, frame: '#efebe2' });
  const stuccoMat = facadeMaterial({ floor: 3.4, bay: 2.8, winW: 0.38, winH: 0.56, lit: 0.24, frame: '#f4f2ec' });
  const modernMat = facadeMaterial({ floor: 3.8, bay: 1.7, winW: 0.86, winH: 0.66, sash: 0, lit: 0.34, frame: '#4b5056', roof: '#6b6d70', glassRough: 0.05 });
  const stoneMat = facadeMaterial({ floor: 3.9, bay: 3.0, winW: 0.46, winH: 0.58, lit: 0.2, frame: '#e8e2d4', roof: '#77746e' });
  const lists = { terrace: [], stucco: [], modern: [], stone: [] };
  const roofs = [], chim = [];
  const BRICK = ['#a88f6c', '#b39b78', '#9c8463', '#bfa684', '#8f5a46', '#7d4b3b', '#a7745a'];
  const STUCCO = ['#e6e0d3', '#ddd6c6', '#eeeae0', '#d9d0bd'];
  const STONE = ['#d6cdb9', '#cbc1ad', '#c2b9a6'];
  const MOD = ['#8d9196', '#7a858e', '#a3a7a8', '#6e7882'];
  const SLATE = ['#4a4f57', '#555a61', '#3f444b', '#5b5d60'];
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const q90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  // also keep the frontage across Gower Street low and open, so the low morning sun reaches the Quad and Portico
  const SUNGAP = [-95, 95, 112, 250];
  const clear = (x, z, m = 4) => !inRect(x, z, UCL_RECT, m) && !inRect(x, z, SUNGAP, 0);
  const R = mobile ? 1000 : H;

  const row = (b, edge, style) => {
    // edge: 0 = along x at z0 (faces -z), 1 = along x at z1, 2 = along z at x0, 3 = along z at x1
    const alongX = edge < 2;
    const len = alongX ? b.x1 - b.x0 : b.z1 - b.z0;
    const start = alongX ? b.x0 : b.z0;
    const depth = style === 'modern' ? 18 + r() * 8 : 11 + r() * 4;
    let s = 0;
    while (s < len - 4) {
      const fw = style === 'modern' ? 22 + r() * 18 : 5.5 + r() * 3.5;
      const w = Math.min(fw, len - s);
      const c = start + s + w / 2;
      let x, z;
      if (edge === 0) { x = c; z = b.z0 + depth / 2; }
      else if (edge === 1) { x = c; z = b.z1 - depth / 2; }
      else if (edge === 2) { z = c; x = b.x0 + depth / 2; }
      else { z = c; x = b.x1 - depth / 2; }
      s += w;
      if (Math.hypot(x, z) > R * 1.02 || !clear(x, z, depth / 2 + 3)) continue;
      const floors = style === 'modern' ? 5 + Math.floor(r() * 6) : style === 'stone' ? 5 + Math.floor(r() * 2) : 4 + Math.floor(r() * 2);
      const h = floors * (style === 'modern' ? 3.8 : 3.3) + 1.2 + r() * 0.6;
      const sx = alongX ? w : depth, sz = alongX ? depth : w;
      m4.compose(new THREE.Vector3(x, 0, z), q0, new THREE.Vector3(sx - 0.15, h, sz - 0.15));
      const pal = style === 'modern' ? MOD : style === 'stone' ? STONE : style === 'stucco' ? STUCCO : BRICK;
      lists[style].push([m4.clone(), new THREE.Color(pal[Math.floor(r() * pal.length)])]);
      if (style === 'terrace' || style === 'stucco') {
        const rh = 2.2 + r() * 1.2;
        m4.compose(new THREE.Vector3(x, h, z), alongX ? q0 : q90, new THREE.Vector3(w - 0.1, rh, depth * 0.98));
        roofs.push([m4.clone(), new THREE.Color(SLATE[Math.floor(r() * SLATE.length)])]);
        if (r() < 0.75) {
          const ox = alongX ? w / 2 - 0.4 : (r() - 0.5) * depth * 0.3;
          const oz = alongX ? (r() - 0.5) * depth * 0.3 : w / 2 - 0.4;
          m4.compose(new THREE.Vector3(x + ox, h, z + oz), q0, new THREE.Vector3(alongX ? 0.9 : 1.8, rh + 1.3, alongX ? 1.8 : 0.9));
          chim.push([m4.clone(), new THREE.Color(BRICK[Math.floor(r() * 4)])]);
        }
      }
    }
  };

  blocks.forEach((b) => {
    if (b.park || b.landmark) return;
    if (Math.hypot(b.cx, b.cz) > R + 150) return;
    let style = r() < 0.18 ? 'modern' : r() < 0.18 ? 'stucco' : 'terrace';
    if (b.campus || (Math.abs(b.cx) < 400 && Math.abs(b.cz) < 300 && r() < 0.5)) style = r() < 0.6 ? 'stone' : 'modern';
    for (let e = 0; e < 4; e++) row(b, e, style);
  });

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
  inst(bx, terraceMat, lists.terrace);
  inst(bx, stuccoMat, lists.stucco);
  inst(bx, modernMat, lists.modern);
  inst(bx, stoneMat, lists.stone);
  inst(roofGeometry(), plainMaterial({ roughness: 0.7, metalness: 0.05 }, 'slate'), roofs);
  inst(bx, plainMaterial({ roughness: 0.9 }, 'chim'), chim);

  // ---------------------------------------------------------------- landmarks
  const lm = [];
  const addBox = (mat, x, y, z, w, h, d, col) => { const m = new THREE.Mesh(bx, mat); m.position.set(x, y, z); m.scale.set(w, h, d); if (col) { m.material = mat; } m.castShadow = m.receiveShadow = true; group.add(m); lm.push(m); return m; };
  const portland = facadeMaterial({ floor: 3.6, bay: 2.4, winW: 0.34, winH: 0.6, lit: 0.16, color: '#d9d1bf', frame: '#cfc7b4', roof: '#8d877b' });
  blocks.forEach((b) => {
    if (b.landmark === 'senate') {
      // Senate House: stepped Art Deco tower in Portland stone
      const cx = b.cx, cz = b.cz;
      addBox(portland, cx, 0, cz, Math.min(150, b.x1 - b.x0 - 6), 22, Math.min(70, b.z1 - b.z0 - 6));
      addBox(portland, cx, 22, cz, 46, 14, 38);
      addBox(portland, cx, 36, cz, 34, 14, 28);
      addBox(portland, cx, 50, cz, 24, 14, 20);
    } else if (b.landmark === 'uch') {
      const glassG = facadeMaterial({ floor: 3.7, bay: 1.6, winW: 0.9, winH: 0.7, sash: 0, color: '#d8dcd6', frame: '#5e8a72', lit: 0.42 });
      addBox(glassG, b.cx, 0, b.cz, 26, 72, 18);
      addBox(glassG, b.cx, 0, b.cz, 18, 64, 34);
      addBox(stoneMat, b.cx, 0, b.cz, b.x1 - b.x0 - 8, 16, b.z1 - b.z0 - 8);
    } else if (b.landmark === 'museum') {
      // British Museum: colonnaded block round the Great Court and its glass roof
      const w = Math.min(190, b.x1 - b.x0 - 8), d = Math.min(150, b.z1 - b.z0 - 8);
      addBox(portland, b.cx, 0, b.cz + d / 2 - 12, w, 24, 24);
      addBox(portland, b.cx, 0, b.cz - d / 2 + 12, w, 24, 24);
      addBox(portland, b.cx + w / 2 - 12, 0, b.cz, 24, 24, d);
      addBox(portland, b.cx - w / 2 + 12, 0, b.cz, 24, 24, d);
      const roof = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), plainMaterial({ color: '#9fb1bb', roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.85 }, 'gcourt'));
      roof.scale.set(w / 2 - 24, 10, d / 2 - 24);
      roof.position.set(b.cx, 24, b.cz);
      group.add(roof);
      addBox(portland, b.cx, 0, b.cz, 28, 30, 28);
    } else if (b.landmark === 'bt') {
      const mat = plainMaterial({ color: '#c9cdd1', roughness: 0.35, metalness: 0.3 }, 'bt');
      const dark = plainMaterial({ color: '#2b3036', roughness: 0.4, metalness: 0.4, emissive: '#7fc2ff', emissiveIntensity: 0.9 }, 'btd');
      const cyl = (rad, y0, h, m) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 32), m); c.position.set(b.cx, y0 + h / 2, b.cz); c.castShadow = true; group.add(c); };
      cyl(9, 0, 110, mat);
      for (let i = 0; i < 6; i++) cyl(10.5, 110 + i * 7, 3.5, dark), cyl(9.5, 113.5 + i * 7, 3.5, mat);
      cyl(7, 152, 16, mat);
      cyl(2, 168, 14, dark);
      addBox(stoneMat, b.cx, 0, b.cz, b.x1 - b.x0 - 10, 14, b.z1 - b.z0 - 10);
    } else if (b.landmark === 'euston') {
      addBox(modernMat, b.cx, 0, b.cz, b.x1 - b.x0 - 10, 18, b.z1 - b.z0 - 10);
    }
  });

  // ---------------------------------------------------------------- trees
  const trees = [];
  const maxTrees = mobile ? 700 : 1800;
  const addTree = (x, z, s = 1) => {
    if (trees.length >= maxTrees || !clear(x, z, 2)) return;
    if (Math.hypot(x, z) > R) return;
    const h = (12 + r() * 9) * s, cr = (4.5 + r() * 3) * s;
    trees.push([x, z, h, cr]);
  };
  blocks.forEach((b) => {
    if (!b.park || Math.hypot(b.cx, b.cz) > R) return;
    for (let x = b.x0 + 4; x < b.x1 - 3; x += 9) for (let z = b.z0 + 4; z < b.z1 - 3; z += 9) {
      const edge = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z) < 12;
      if (r() < (edge ? 0.85 : 0.35)) addTree(x + (r() - 0.5) * 5, z + (r() - 0.5) * 5);
    }
  });
  xl.filter((l) => l.major).forEach((l) => { for (let z = -R; z < R; z += 13) { if (r() < 0.7) addTree(l.c - l.w / 2 - 2, z, 0.8); if (r() < 0.7) addTree(l.c + l.w / 2 + 2, z, 0.8); } });
  zl.filter((l) => l.major).forEach((l) => { for (let x = -R; x < R; x += 13) { if (r() < 0.7) addTree(x, l.c - l.w / 2 - 2, 0.8); if (r() < 0.7) addTree(x, l.c + l.w / 2 + 2, 0.8); } });
  const leafCols = ['#4f6b35', '#5d7a3c', '#46602f', '#6b7f43', '#55703a', '#7a8a48'];
  const canopy = [], trunk = [];
  trees.forEach(([x, z, h, cr]) => {
    const lobes = 5 + Math.floor(r() * 3);
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
  inst(treeGeometry(5, 1), leafMaterial('leaf'), canopy);
  inst(bx, plainMaterial({ roughness: 0.9 }, 'trunk'), trunk, false);

  // ---------------------------------------------------------------- outer city + skyline
  const outer = [];
  const ro = rng(99);
  for (let x = -5200; x < 5200; x += 85) for (let z = -5200; z < 5200; z += 85) {
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < R + 40 || ro() < 0.5) continue;
    if (Math.abs(x - riverX(z)) < 170) continue;
    const h = 12 + Math.pow(ro(), 4) * 40;
    m4.compose(new THREE.Vector3(x + (ro() - 0.5) * 30, 0, z + (ro() - 0.5) * 30), q0, new THREE.Vector3(35 + ro() * 35, h, 35 + ro() * 35));
    outer.push([m4.clone(), new THREE.Color(ro() < 0.7 ? BRICK[Math.floor(ro() * 7)] : MOD[Math.floor(ro() * 4)])]);
  }
  inst(bx, terraceMat, outer, false);

  const towerMat = facadeMaterial({ floor: 4.0, bay: 1.5, winW: 0.9, winH: 0.75, sash: 0, color: '#7e8d98', frame: '#3c444b', roof: '#55595e', glassRough: 0.04, lit: 0.45, litI: 3.0, metalness: 0.2, roughness: 0.4 });
  const city = [];
  const rc = rng(5);
  // the City of London cluster to the east-south-east, Canary Wharf further east
  for (let i = 0; i < 26; i++) {
    const x = -650 + (rc() - 0.5) * 700, z = 2700 + (rc() - 0.5) * 800;
    const h = 90 + Math.pow(rc(), 1.5) * 190;
    m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rc() * 0.6, 0)), new THREE.Vector3(30 + rc() * 25, h, 30 + rc() * 25));
    city.push([m4.clone(), new THREE.Color(MOD[Math.floor(rc() * 4)])]);
  }
  for (let i = 0; i < 14; i++) {
    const x = -2900 + (rc() - 0.5) * 500, z = 7600 + (rc() - 0.5) * 600;
    m4.compose(new THREE.Vector3(x, 0, z), q0, new THREE.Vector3(40, 140 + rc() * 100, 40));
    city.push([m4.clone(), new THREE.Color('#8a949c')]);
  }
  inst(bx, towerMat, city, false);
  // red aviation lights on the tall towers (blink in the engine)
  const av = [];
  city.forEach(([mm]) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); mm.decompose(p, q, s); av.push([new THREE.Matrix4().compose(new THREE.Vector3(p.x, s.y + 2, p.z), q0, new THREE.Vector3(2.2, 2.2, 2.2))]); });
  const btb = blocks.find((b) => b.landmark === 'bt');
  if (btb) av.push([new THREE.Matrix4().compose(new THREE.Vector3(btb.cx, 183, btb.cz), q0, new THREE.Vector3(1.6, 1.6, 1.6))]);
  const avMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.15) });
  inst(new THREE.SphereGeometry(1, 8, 6), avMat, av.map(([m]) => [m, new THREE.Color(1, 1, 1)]), false);
  const glassy = plainMaterial({ color: '#7f909b', roughness: 0.1, metalness: 0.5 }, 'glassy');
  const shard = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 32, 310, 4, 1), glassy);
  shard.position.set(riverX(3100) - 220, 155, 3100);
  shard.rotation.y = Math.PI / 4;
  group.add(shard);
  const gh = new THREE.LatheGeometry(Array.from({ length: 16 }, (_, i) => { const t = i / 15; return new THREE.Vector2(Math.max(0.5, 27 * Math.sin(Math.PI * (0.18 + t * 0.82)) * (1 - t * 0.25)), t * 180); }), 32);
  const gherkin = new THREE.Mesh(gh, plainMaterial({ color: '#4e6470', roughness: 0.18, metalness: 0.4 }, 'gherkin'));
  gherkin.position.set(-520, 0, 2950);
  group.add(gherkin);

  return { group, mapTex, emTex, blocks, trafficU, avMat };
}
