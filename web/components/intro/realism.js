// Photographic detail for the reading room: CC0 photo-scanned models and surfaces from Poly Haven (public domain)
// in place of the hand-built stand-ins. Tufted leather chairs, crystal chandeliers, a marble bust, oil paintings in
// gilt frames, encyclopaedias, spectacles, oak floorboards, mahogany, painted plaster and leather, lit by a
// photographed interior (HDRI) for reflections. Book spines get a printed atlas with cloth, leather, gilt bands and
// labels. Loads after the intro starts; until then (or if anything fails) the hand-built pieces stay.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { atmo } from './atmo';
import { canvasTex, rng } from './materials';

const BASE = '/assets/models/';
const V = 1;

const NEED = {
  ucl: { models: ['dining_chair_02', 'Chandelier_03', 'marble_bust_01', 'book_encyclopedia_set_01', 'fancy_picture_frame_01', 'fancy_picture_frame_02', 'round_spectacles'], surf: ['wood_floor', 'dark_wood', 'wood_table_001', 'painted_plaster_wall', 'brown_leather'], hdr: true },
  imperial: { models: ['SchoolChair_01'], surf: ['wood_floor', 'wood_table_001', 'painted_plaster_wall'], hdr: false },
  qmul: { models: ['dining_chair_02'], surf: ['wood_floor', 'wood_table_001', 'painted_plaster_wall', 'dark_wood'], hdr: true },
  lse: { models: ['SchoolChair_01'], surf: ['wood_floor', 'wood_table_001', 'painted_plaster_wall'], hdr: false },
};

const caches = {};
export function loadInterior(uni = 'ucl') {
  if (caches[uni]) return caches[uni];
  const { models: MODELS, surf: SURF, hdr: wantHdr } = NEED[uni] || NEED.ucl;
  caches[uni] = (async () => {
    const gl = new GLTFLoader();
    const tl = new THREE.TextureLoader();
    const model = (id) => gl.loadAsync(`${BASE}${id}.glb?v=${V}`).then((g) => g.scene).catch(() => null);
    const tex = (id, key) => tl.loadAsync(`${BASE}tex/${id}_${key}.webp?v=${V}`).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = key === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      return t;
    }).catch(() => null);
    const city = (f) => tl.loadAsync(`/assets/city/tex/${f}`).then((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }).catch(() => null);
    const [models, surfs, hdr, stone, brick] = await Promise.all([
      Promise.all(MODELS.map(model)),
      Promise.all(SURF.map(async (id) => ({ diff: await tex(id, 'diff'), nor: await tex(id, 'nor'), rough: await tex(id, 'rough') }))),
      wantHdr ? new RGBELoader().loadAsync(`${BASE}ballroom_1k.hdr?v=${V}`).catch(() => null) : null,
      city('sandstone_blocks_05_diff_512.jpg'),
      city('red_brick_diff_512.jpg'),
    ]);
    const m = {}; MODELS.forEach((id, i) => { m[id] = models[i]; });
    const T = {}; SURF.forEach((id, i) => { T[id] = surfs[i]; });
    return { m, T, hdr, stone, brick };
  })();
  return caches[uni];
}

// every mesh in a model, baked into one InstancedMesh per mesh, placed at each matrix
function instance(root, mats, parent, { cast = true, fix } = {}) {
  if (!root || !mats.length) return [];
  root.updateMatrixWorld(true);
  // put the model's base at its origin, centred
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  const base = new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const local = new THREE.Matrix4().multiplyMatrices(base, o.matrixWorld);
    const mat = fix ? fix(o.material) : o.material;
    const im = new THREE.InstancedMesh(o.geometry, mat, mats.length);
    mats.forEach((mm, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(mm, local)));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false;
    parent.add(im);
    out.push(im);
  });
  return out;
}

const sizeOf = (root) => new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());

// models' own materials, kept physically based, with the interior haze; transmission glass becomes plain
// transparent glass (the transmission pass is too costly here)
function fixMat(glow) {
  const seen = new Map();
  return (m) => {
    if (seen.has(m)) return seen.get(m);
    let n = m;
    if (m.transmission > 0 || /glass/i.test(m.name || '')) {
      n = new THREE.MeshStandardMaterial({ color: m.color, roughness: Math.min(m.roughness, 0.1), metalness: 0, transparent: true, opacity: 0.35, map: m.map || null });
      if (glow) { n.emissive = new THREE.Color(glow); n.emissiveIntensity = 1.6; n.opacity = 0.8; }
    }
    n.userData.key = 'rl-' + (m.name || 'm');
    atmo(n);
    seen.set(m, n);
    return n;
  };
}

// world-space (triplanar) mapping for the long boxes of the shelves and tables, which have no useful UVs
function triplanar(mat, scale) {
  mat.userData.patch = (shader) => {
    shader.uniforms.uTri = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriN;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        #ifdef USE_INSTANCING
          vTriN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vTriN = normalize(mat3(modelMatrix) * objectNormal);
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriN; uniform float uTri;\nvec4 triS(sampler2D t, vec3 p, vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); w /= dot(w, vec3(1.0)); return texture2D(t, p.zy * uTri) * w.x + texture2D(t, p.xz * uTri) * w.y + texture2D(t, p.xy * uTri) * w.z; }')
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n diffuseColor *= triS(map, vAtmoW, vTriN);\n#endif')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness;\n#ifdef USE_ROUGHNESSMAP\n roughnessFactor *= triS(roughnessMap, vAtmoW, vTriN).g;\n#endif');
  };
  return mat;
}

function surface(t, { color = '#ffffff', tri = 0, rough = 0.6, key, nScale = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
  if (t && t.diff) m.map = t.diff;
  if (t && t.rough) m.roughnessMap = t.rough;
  if (t && t.nor && !tri) { m.normalMap = t.nor; m.normalScale = new THREE.Vector2(nScale, nScale); }
  m.userData.key = key;
  if (tri) triplanar(m, tri);
  return atmo(m);
}

// a printed atlas of 32 book spines: cloth and leather, gilt bands, title labels, wear at the edges
function spineAtlas() {
  const N = 32, W = 64, H = 512;
  const tex = canvasTex(N * W, H, (ctx) => {
    const r = rng(77);
    const cols = ['#5a1a14', '#2c1a12', '#1e3326', '#1c2538', '#6e5232', '#3a2a1e', '#7c2c1e', '#2a2a2a', '#55462e', '#4a3a5a', '#7a6a4a', '#233b45', '#8a5a2a', '#3d1f1a'];
    for (let i = 0; i < N; i++) {
      const x0 = i * W;
      const c = cols[Math.floor(r() * cols.length)];
      ctx.fillStyle = c; ctx.fillRect(x0, 0, W, H);
      // cloth or leather grain
      for (let k = 0; k < 900; k++) { const v = r(); ctx.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,240,220'},${0.03 + r() * 0.05})`; ctx.fillRect(x0 + r() * W, r() * H, 1 + r() * 2, 1 + r() * 3); }
      // rounded spine shading
      const g = ctx.createLinearGradient(x0, 0, x0 + W, 0);
      g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(0.35, 'rgba(255,255,255,.06)'); g.addColorStop(0.6, 'rgba(255,255,255,.02)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
      ctx.fillStyle = g; ctx.fillRect(x0, 0, W, H);
      const gold = `rgba(${200 + r() * 30},${160 + r() * 30},${80 + r() * 30},${0.7 + r() * 0.25})`;
      const style = r();
      // raised bands with gilt rules
      const bands = style < 0.5 ? 4 + Math.floor(r() * 2) : 0;
      for (let b = 0; b < bands; b++) {
        const y = H * (0.12 + (b / (bands - 1)) * 0.76);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x0, y - 7, W, 14);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x0, y - 7, W, 3);
        ctx.fillStyle = gold; ctx.fillRect(x0 + 4, y - 9, W - 8, 2); ctx.fillRect(x0 + 4, y + 7, W - 8, 2);
      }
      // a title label (dark leather or paper) with lines of gilt "lettering"
      const ly = H * (0.2 + r() * 0.12), lh = 50 + r() * 40;
      ctx.fillStyle = r() < 0.3 ? '#d8ccb0' : r() < 0.6 ? '#141110' : '#4d1712';
      ctx.fillRect(x0 + 6, ly, W - 12, lh);
      ctx.fillStyle = gold;
      for (let k = 0; k < 2 + Math.floor(r() * 3); k++) { const w = (W - 22) * (0.5 + r() * 0.5); ctx.fillRect(x0 + (W - w) / 2, ly + 10 + k * 11, w, 3 + r() * 2); }
      if (style >= 0.5) { ctx.fillStyle = gold; ctx.fillRect(x0 + 3, 14, W - 6, 2); ctx.fillRect(x0 + 3, H - 16, W - 6, 2); }
      // a library shelfmark sticker near the foot on some
      if (r() < 0.4) { ctx.fillStyle = '#efe9da'; ctx.fillRect(x0 + 12, H - 70, W - 24, 26); ctx.fillStyle = 'rgba(30,30,30,.8)'; ctx.fillRect(x0 + 17, H - 62, W - 34, 3); ctx.fillRect(x0 + 17, H - 55, (W - 34) * 0.6, 3); }
      // worn edges
      ctx.fillStyle = 'rgba(255,235,200,.12)'; ctx.fillRect(x0, 0, W, 4); ctx.fillRect(x0, H - 4, W, 4);
    }
  });
  tex.anisotropy = 8;
  return { tex, N };
}

function bookMaterial() {
  const { tex, N } = spineAtlas();
  const m = new THREE.MeshStandardMaterial({ roughness: 0.72, color: '#ffffff' });
  m.userData.key = 'rl-books';
  m.userData.patch = (shader) => {
    shader.uniforms.uSpine = { value: tex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBUv; varying vec3 vBN; varying float vBId;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBUv = uv; vBN = normal; vBId = float(gl_InstanceID);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uSpine; varying vec2 vBUv; varying vec3 vBN; varying float vBId;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float idx = mod(floor(vBId * 7.31 + 0.5), ${N}.0);
          if (abs(vBN.x) > 0.5) {
            vec3 sp = texture2D(uSpine, vec2((idx + vBUv.x) / ${N}.0, vBUv.y)).rgb;
            diffuseColor.rgb = sp * mix(vec3(1.0), diffuseColor.rgb * 2.2, 0.35);
          } else if (abs(vBN.y) > 0.5) {
            // page edges seen from above, aged cream
            diffuseColor.rgb = vec3(0.78, 0.72, 0.6) * (0.85 + 0.15 * fract(sin(vBUv.x * 431.0) * 91.7));
          } else {
            diffuseColor.rgb *= 0.8;
          }
        }`);
  };
  return atmo(m);
}


// ------------------------------------------------------------------ procedural surfaces with photographic detail
// a worn runner: Persian-style border and field, knotted pile, the walking line faded down the middle
function rugTex2() {
  return canvasTex(512, 4096, (ctx, W, H) => {
    const r = rng(23);
    ctx.fillStyle = '#5b1d1a'; ctx.fillRect(0, 0, W, H);
    const band = (x0, w, c1, c2) => {
      ctx.fillStyle = c1; ctx.fillRect(x0, 0, w, H); ctx.fillRect(W - x0 - w, 0, w, H);
      for (let y = 0; y < H; y += 28) for (const x of [x0 + w / 2, W - x0 - w / 2]) {
        ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.32, y + 14); ctx.lineTo(x, y + 28); ctx.lineTo(x - w * 0.32, y + 14); ctx.closePath(); ctx.fill();
      }
    };
    band(10, 26, '#1f2a3d', '#b8955a');
    band(40, 14, '#d6c6a0', '#7a2a22');
    band(58, 34, '#20283a', '#9c6b3c');
    // the field: a lattice of small guls
    for (let y = 60; y < H - 40; y += 64) for (let x = 120; x < W - 110; x += 68) {
      const off = ((y / 64) | 0) % 2 ? 34 : 0;
      ctx.save(); ctx.translate(x + off, y);
      ctx.fillStyle = '#2a3346'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(18, 0); ctx.lineTo(0, 22); ctx.lineTo(-18, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b08d58'; ctx.fillRect(-4, -4, 8, 8);
      ctx.strokeStyle = 'rgba(214,198,160,.55)'; ctx.lineWidth = 2; ctx.strokeRect(-9, -9, 18, 18);
      ctx.restore();
    }
    // knots and pile
    for (let i = 0; i < 160000; i++) { const v = r(); ctx.fillStyle = v < 0.5 ? `rgba(0,0,0,${r() * 0.16})` : `rgba(255,230,200,${r() * 0.06})`; ctx.fillRect(r() * W, r() * H, 2, 2); }
    // wear down the middle, and a few darker stains
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0.3, 'rgba(190,160,130,0)'); g.addColorStop(0.5, 'rgba(190,160,130,.16)'); g.addColorStop(0.7, 'rgba(190,160,130,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) { const gg = ctx.createRadialGradient(r() * W, r() * H, 0, r() * W, r() * H, 30 + r() * 70); gg.addColorStop(0, 'rgba(20,8,4,.12)'); gg.addColorStop(1, 'rgba(20,8,4,0)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H); }
  });
}

// marble with soft grey veining, for the columns and pedestals
function marbleTex() {
  return canvasTex(1024, 1024, (ctx, W, H) => {
    const r = rng(31);
    ctx.fillStyle = '#e9e5dc'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { const gg = ctx.createRadialGradient(r() * W, r() * H, 0, r() * W, r() * H, 80 + r() * 220); gg.addColorStop(0, `rgba(${200 + r() * 30},${195 + r() * 30},${185 + r() * 30},.35)`); gg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H); }
    for (let v = 0; v < 26; v++) {
      let x = r() * W, y = 0;
      const a = 0.6 + r() * 1.2, wob = 20 + r() * 60;
      ctx.strokeStyle = `rgba(${90 + r() * 50},${90 + r() * 50},${95 + r() * 50},${0.08 + r() * 0.22})`;
      ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 60; k++) { y += H / 60; x += Math.sin(k * 0.5 + v) * wob * 0.1 + (r() - 0.5) * 9 + a; ctx.lineTo(((x % W) + W) % W, y); }
      ctx.stroke();
    }
  }, { repeat: [1, 1] });
}

// old crown glass at dawn: a warm sky low down, cooler higher up, every pane a little different, heavy glazing bars
function windowTex2() {
  return canvasTex(512, 1024, (ctx, W, H) => {
    const r = rng(41);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(0, W / 2); ctx.arc(W / 2, W / 2, W / 2, Math.PI, 0); ctx.lineTo(W, H); ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#c9d0d6'); g.addColorStop(0.45, '#f1d9bd'); g.addColorStop(0.8, '#f6c79a'); g.addColorStop(1, '#e8a77a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cols = 3, pw = W / cols, ph = 120;
    for (let y = W / 2 - ph; y < H; y += ph) for (let c = 0; c < cols; c++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '90,70,60'},${r() * 0.09})`; ctx.fillRect(c * pw, y, pw, ph);
      const gg = ctx.createLinearGradient(c * pw, y, c * pw + pw, y + ph); gg.addColorStop(0, 'rgba(255,255,255,.08)'); gg.addColorStop(1, 'rgba(0,0,0,.06)'); ctx.fillStyle = gg; ctx.fillRect(c * pw, y, pw, ph);
    }
    // the silhouette of the building opposite low in the lower panes
    ctx.fillStyle = 'rgba(70,52,46,.5)'; ctx.fillRect(0, H - 150, W, 150);
    for (let x = 0; x < W; x += 34) ctx.fillRect(x, H - 150 - r() * 30, 20, 40);
    ctx.strokeStyle = '#1c1a17'; ctx.lineWidth = 14;
    for (let x = pw; x < W - 1; x += pw) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = W / 2; y < H; y += ph) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = '#2c2925'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, W / 2); ctx.arc(W / 2, W / 2, W / 2, Math.PI, 0); ctx.lineTo(W, H); ctx.stroke();
    ctx.restore();
  });
}

// soft radial blob for contact shadows and lamp pools
function blobTex() {
  return canvasTex(128, 128, (ctx, W) => {
    const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
  });
}

// dressed stone on the hand-built exteriors: photo-scanned ashlar mapped in world space at true scale, its colour
// taken from the building (Portland stone, brick) and its texture kept
export function stoneExterior(root, tex, { skip = null, scale = 1 / 3, keys = /^(stone|stone2|colstone|facade)/, tint = 0.75 } = {}) {
  if (!tex) return;
  const done = new Set();
  root.traverse((o) => {
    if (skip && (o === skip || (o.parent && isUnder(o, skip)))) return;
    if (!o.isMesh || !o.material || done.has(o.material)) return;
    const m = o.material, k = (m.userData && m.userData.key) || '';
    if (!keys.test(k) || /-ash$/.test(k)) return;
    done.add(m);
    const prev = m.userData.patch;
    m.map = tex;
    m.userData.key = k + '-ash';
    m.customProgramCacheKey = () => 'atmo' + k + '-ash';
    m.userData.patch = (shader) => {
      if (prev) prev(shader);
      shader.uniforms.uAsh = { value: scale }; shader.uniforms.uAshK = { value: tint };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAshN;')
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          #ifdef USE_INSTANCING
            vAshN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
          #else
            vAshN = normalize(mat3(modelMatrix) * objectNormal);
          #endif`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAshN; uniform float uAsh, uAshK;')
        .replace('#include <map_fragment>', `#ifdef USE_MAP
          {
            vec3 w = pow(abs(vAshN), vec3(4.0)); w /= dot(w, vec3(1.0));
            vec3 tx = texture2D(map, vAtmoW.zy * uAsh).rgb * w.x + texture2D(map, vAtmoW.xz * uAsh).rgb * w.y + texture2D(map, vAtmoW.xy * uAsh).rgb * w.z;
            float tl = dot(tx, vec3(0.299, 0.587, 0.114));
            diffuseColor.rgb *= mix(tx * 1.5, vec3(tl) * 1.9, uAshK);
          }
          #endif`);
    };
    m.needsUpdate = true;
  });
}
function isUnder(o, root) { for (let p = o.parent; p; p = p.parent) if (p === root) return true; return false; }

export function upgradeLibrary(renderer, ucl, A, { mobile }) {
  const lib = ucl.lib, furn = ucl.furn;
  if (!lib || !furn || !furn.place) return null;
  const P = furn.place, F = P.F;
  const hide = (arr) => arr.forEach((o) => { if (o) o.visible = false; });
  const Q = (ry) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  const mtx = (x, y, z, ry, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), Q(ry), new THREE.Vector3(s, s, s));
  const fix = fixMat();

  // surfaces
  const S = A.T;
  const floorM = surface(S.wood_floor, { rough: 0.35, key: 'rl-floor', nScale: 0.6 });
  [floorM.map, floorM.roughnessMap, floorM.normalMap].forEach((t) => t && t.repeat.set(35 / 1.1, 57.5 / 1.1));
  const shelfM = surface(S.dark_wood, { color: '#a08070', rough: 0.55, tri: 0.9, key: 'rl-wood' });
  const tableM = surface(S.wood_table_001, { color: '#b49c8c', rough: 0.32, tri: 1.1, key: 'rl-table' });
  const plasterM = surface(S.painted_plaster_wall, { color: '#ffffff', rough: 0.8, key: 'rl-plaster' });
  [plasterM.roughnessMap, plasterM.normalMap].forEach((t) => t && t.repeat.set(57.5 / 2, 17.6 / 2));
  // painted panelling: fielded panels between pilasters, a picture rail and a frieze under the cornice
  plasterM.map = canvasTex(2048, 640, (ctx, W, H) => {
    const r = rng(12);
    ctx.fillStyle = '#284a3b'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26000; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '200,230,210'},${r() * 0.05})`; ctx.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }
    const bays = 19, bw = W / bays;
    for (let b = 0; b < bays; b++) {
      const x = b * bw;
      // pilaster
      ctx.fillStyle = '#2f5544'; ctx.fillRect(x, 0, bw * 0.12, H);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + bw * 0.12, 0, 3, H);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, 0, 2, H);
      // two fielded panels
      for (const [y0, y1] of [[H * 0.12, H * 0.46], [H * 0.54, H * 0.92]]) {
        const px = x + bw * 0.22, pw = bw * 0.68;
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4; ctx.strokeRect(px, y0, pw, y1 - y0);
        ctx.strokeStyle = 'rgba(210,235,220,.1)'; ctx.lineWidth = 2; ctx.strokeRect(px + 4, y0 + 4, pw - 8, y1 - y0 - 8);
        ctx.strokeStyle = 'rgba(180,140,70,.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(px + 9, y0 + 9, pw - 18, y1 - y0 - 18);
      }
    }
    // frieze and picture rail
    ctx.fillStyle = '#1f3b2f'; ctx.fillRect(0, 0, W, H * 0.07);
    ctx.fillStyle = 'rgba(190,150,80,.45)'; ctx.fillRect(0, H * 0.07, W, 3); ctx.fillRect(0, H * 0.5, W, 3);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, H * 0.5 + 3, W, 4);
  });
  const leatherM = surface(S.brown_leather, { color: '#4f8a63', rough: 0.55, key: 'rl-leather' });
  const rugM = surface(S.painted_plaster_wall, { rough: 1, key: 'rl-rug', nScale: 0.9 });
  rugM.map = rugTex2();
  const marbleM = atmo(Object.assign(new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: 0.18, color: '#d6d0c4' }), { userData: { key: 'rl-marble' } }));
  const winTex = windowTex2();
  const winM = atmo(Object.assign(new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: '#ffffff', emissiveIntensity: 0.95, transparent: true, roughness: 0.08, metalness: 0 }), { userData: { key: 'rl-win' } }));
  const legs = [];
  lib.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.userData) return;
    const k = o.material.userData.key;
    const gp = o.geometry && o.geometry.parameters;
    if (k === 'rug') { o.material = rugM; return; }
    if (k === 'marble') { o.material = marbleM; return; }
    if (k === 'iwin') { o.material = winM; return; }
    if (k === 'wood' && gp && Math.abs(gp.width - 0.1) < 1e-3 && Math.abs(gp.height - 0.76) < 1e-3) { legs.push(o); return; }
    if (k === 'floor') o.material = floorM;
    else if (k === 'wood' || k === 'wood2') o.material = o.geometry.parameters && o.geometry.parameters.width > 1.9 && o.geometry.parameters.depth > 6 ? tableM : shelfM;
    else if (k === 'panel') o.material = plasterM;
    else if (k === 'leather') o.material = leatherM;
    else if (k === 'books') o.material = bookMaterial();
  });

  const added = [];
  // reading tables: turned legs in place of the square posts, an apron under each top
  if (legs.length) {
    const prof = [];
    [[0.05, 0], [0.055, 0.04], [0.042, 0.08], [0.03, 0.2], [0.038, 0.34], [0.026, 0.42], [0.034, 0.56], [0.045, 0.62], [0.045, 0.76]].forEach(([rr, y]) => prof.push(new THREE.Vector2(rr, y)));
    const legG = new THREE.LatheGeometry(prof, 20);
    const legMs = legs.map((o) => { o.visible = false; return mtx(o.position.x, o.position.y - 0.38, o.position.z, 0); });
    const im = new THREE.InstancedMesh(legG, tableM, legMs.length);
    legMs.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = im.receiveShadow = true; im.frustumCulled = false;
    lib.add(im); added.push(im);
    const ap = [];
    for (const x of [-11.5, -5, 5, 11.5]) for (let z = -11; z > -41; z -= 9.5) ap.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 1.86, z), new THREE.Quaternion(), new THREE.Vector3(1.86, 0.14, 6.9)));
    const apM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tableM, ap.length);
    ap.forEach((m, i) => apM.setMatrixAt(i, m));
    apM.castShadow = apM.receiveShadow = true; apM.frustumCulled = false;
    lib.add(apM); added.push(apM);
  }
  // contact shadows under chairs and tables, and warm pools of light under the green lamps
  const blob = blobTex();
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowM = new THREE.MeshBasicMaterial({ map: blob, color: '#000000', transparent: true, opacity: 0.55, depthWrite: false });
  shadowM.alphaMap = blob;
  const sh = [];
  P.chairs.forEach(([x, z]) => sh.push(new THREE.Matrix4().compose(new THREE.Vector3(x, F + 0.004, z), new THREE.Quaternion(), new THREE.Vector3(0.95, 1, 0.95))));
  for (const x of [-11.5, -5, 5, 11.5]) for (let z = -11; z > -41; z -= 9.5) sh.push(new THREE.Matrix4().compose(new THREE.Vector3(x, F + 0.003, z), new THREE.Quaternion(), new THREE.Vector3(3.0, 1, 8.4)));
  const shM = new THREE.InstancedMesh(flat, shadowM, sh.length);
  sh.forEach((m, i) => shM.setMatrixAt(i, m));
  shM.frustumCulled = false; shM.renderOrder = 1;
  lib.add(shM); added.push(shM);
  const poolM = new THREE.MeshBasicMaterial({ map: blob, color: new THREE.Color(1.0, 0.58, 0.26), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const pools = [];
  for (const x of [-11.5, -5, 5, 11.5]) for (let z = -11; z > -41; z -= 9.5) for (const lz of [-2.2, 0, 2.2]) pools.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 2.032, z + lz), new THREE.Quaternion(), new THREE.Vector3(1.7, 1, 1.5)));
  pools.push(new THREE.Matrix4().compose(new THREE.Vector3(0.3, 1.966, -46.15), new THREE.Quaternion(), new THREE.Vector3(1.2, 1, 0.9)));
  const plM = new THREE.InstancedMesh(flat, poolM, pools.length);
  pools.forEach((m, i) => plM.setMatrixAt(i, m));
  plM.frustumCulled = false; plM.renderOrder = 2;
  lib.add(plM); added.push(plM);
  // the end wall: dark oak wainscot with fielded panels below the clock
  {
    const wt = canvasTex(1024, 128, (ctx, W, H) => {
      ctx.fillStyle = '#26170e'; ctx.fillRect(0, 0, W, H);
      for (let x = 8; x < W; x += 64) { ctx.fillStyle = '#2f1d12'; ctx.fillRect(x, 14, 52, H - 30); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3; ctx.strokeRect(x, 14, 52, H - 30); ctx.strokeStyle = 'rgba(255,220,180,.08)'; ctx.lineWidth = 1; ctx.strokeRect(x + 5, 19, 42, H - 40); }
      ctx.fillStyle = '#1b100a'; ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8);
    });
    const wm = atmo(Object.assign(new THREE.MeshStandardMaterial({ map: wt, roughness: 0.45, color: '#ffffff' }), { userData: { key: 'rl-wains' } }));
    const w = new THREE.Mesh(new THREE.PlaneGeometry(35, 2.2), wm);
    w.position.set(0, F + 1.1, -60.9); lib.add(w); added.push(w);
  }
  // chairs: tufted leather dining chairs, turned to face their table
  if (A.m.dining_chair_02 && P.chairs.length) {
    hide(furn.proc.chairs);
    const r = rng(5);
    added.push(...instance(A.m.dining_chair_02, P.chairs.map(([x, z, s]) => mtx(x + s * 0.05, F, z + (r() - 0.5) * 0.08, -s * Math.PI / 2 + (r() - 0.5) * 0.22)), lib, { fix }));
  }
  // nobody yet: it is first light. Coats and bags are left on a few chairs instead of stand-in figures
  hide(furn.proc.people);
  // chandeliers
  if (A.m.Chandelier_03 && P.chand.length) {
    hide(furn.proc.chand);
    const h = sizeOf(A.m.Chandelier_03).y, s = 2.6 / h;
    added.push(...instance(A.m.Chandelier_03, P.chand.map(([x, y, z]) => mtx(x, y - 1.4, z, 0.3, s)), lib, { cast: false, fix: fixMat('#ffd9a8') }));
  }
  // marble busts on their pedestals
  if (A.m.marble_bust_01 && P.busts.length) {
    hide(furn.proc.busts);
    const h = sizeOf(A.m.marble_bust_01).y, s = 0.62 / h;
    added.push(...instance(A.m.marble_bust_01, P.busts.map(([x, y, z, ry]) => mtx(x, y, z, ry, s)), lib, { fix }));
  }
  // oil paintings in gilt frames: portraits and landscapes
  const f1 = A.m.fancy_picture_frame_01, f2 = A.m.fancy_picture_frame_02;
  if (f1 && f2 && P.paintings.length) {
    hide(furn.proc.paintings);
    const s1 = sizeOf(f1), s2 = sizeOf(f2);
    const land = [], port = [];
    P.paintings.forEach(([x, y, z, w, h, ry]) => {
      if (h > w) port.push(mtx(x, y - (h * 1.12) / 2, z, ry, (h * 1.12) / s2.y));
      else land.push(mtx(x, y - (h * 1.15) / 2, z, ry, (h * 1.15) / s1.y));
    });
    added.push(...instance(f1, land, lib, { cast: false, fix }), ...instance(f2, port, lib, { cast: false, fix }));
  }
  // encyclopaedias on the tables, in place of the stacked boxes
  if (A.m.book_encyclopedia_set_01 && P.stacks && P.stacks.length) {
    hide(furn.proc.stacks);
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const r = rng(9);
    const picks = P.stacks.filter((_, i) => i % 3 === 0).slice(0, mobile ? 8 : 24).map((m) => {
      m.decompose(pos, q, sc);
      return mtx(pos.x, F + 0.79, pos.z, (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.3, 0.92 + r() * 0.1);
    });
    added.push(...instance(A.m.book_encyclopedia_set_01, picks, lib, { fix }));
  }
  // spectacles on the desk beside the paper
  if (A.m.round_spectacles && P.desk) {
    const [dx, dy, dz] = P.desk;
    added.push(...instance(A.m.round_spectacles, [mtx(dx + 0.36, dy + 0.003, dz + 0.12, 2.6, 1)], lib, { fix }));
  }

  // photographed interior light for reflections in wood, brass, glass and marble
  let env = null;
  if (A.hdr) {
    const pm = new THREE.PMREMGenerator(renderer);
    env = pm.fromEquirectangular(A.hdr).texture;
    pm.dispose();
    A.hdr.dispose();
  }
  ucl.dustK = 0.1;
  return { env, added };
}

// Imperial's exam hall: stacking school chairs at the desks, oak floor, oak desks, plaster with texture; the hall is
// laid out ready for the paper, nobody in it yet
export function upgradeHall(renderer, ucl, A, { mobile, chair = 'SchoolChair_01' }) {
  const lib = ucl.lib, furn = ucl.furn;
  if (!lib || !furn || !furn.place) return null;
  const P = furn.place, F = P.F;
  const S = A.T;
  const floorM = surface(S.wood_floor, { rough: 0.32, key: 'rlh-floor', nScale: 0.6 });
  [floorM.map, floorM.roughnessMap, floorM.normalMap].forEach((t) => t && t.repeat.set((2 * P.hw) / 1.1, P.len / 1.1));
  const deskM = surface(S.wood_table_001, { color: '#b89a80', rough: 0.4, tri: 2.2, key: 'rlh-desk' });
  const plasterM = surface(S.painted_plaster_wall, { color: '#e2dccf', rough: 0.9, key: 'rlh-plaster' });
  [plasterM.map, plasterM.roughnessMap, plasterM.normalMap].forEach((t) => t && t.repeat.set(20, 6));
  const shelfM = S.dark_wood ? surface(S.dark_wood, { color: '#a08070', rough: 0.55, tri: 0.9, key: 'rlh-wood' }) : null;
  let bookM = null;
  lib.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.userData) return;
    const k = o.material.userData.key;
    if (k === 'h-floor') o.material = floorM;
    else if (k === 'h-desk') o.material = deskM;
    else if (k === 'h-plaster') o.material = plasterM;
    else if (k === 'h-wood' && shelfM) o.material = shelfM;
    else if (k === 'books') { bookM = bookM || bookMaterial(); o.material = bookM; }
  });
  const hide = (arr) => arr.forEach((o) => { if (o) o.visible = false; });
  hide(furn.proc.people);
  const added = [];
  if (A.m[chair] && P.chairs.length) {
    hide(furn.proc.chairs);
    const r = rng(8);
    const Q = (ry) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    // a chair's 4th value, if given, is the way it faces (radians about y); otherwise it faces -z
    added.push(...instance(A.m[chair], P.chairs.map(([x, z, , face]) => new THREE.Matrix4().compose(new THREE.Vector3(x + (r() - 0.5) * 0.06, F, z + (r() - 0.5) * 0.08), Q((face ?? Math.PI) + (r() - 0.5) * 0.18), new THREE.Vector3(1, 1, 1))), lib, { fix: fixMat() }));
  }
  let env = null;
  if (A.hdr) {
    const pm = new THREE.PMREMGenerator(renderer);
    env = pm.fromEquirectangular(A.hdr).texture;
    pm.dispose();
  }
  ucl.dustK = 0.15;
  return { env, added };
}
