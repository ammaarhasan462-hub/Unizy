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
let cache = null;

const MODELS = ['dining_chair_02', 'Chandelier_03', 'marble_bust_01', 'book_encyclopedia_set_01', 'fancy_picture_frame_01', 'fancy_picture_frame_02', 'round_spectacles'];
const SURF = ['wood_floor', 'dark_wood', 'wood_table_001', 'painted_plaster_wall', 'brown_leather'];

export function loadInterior() {
  if (cache) return cache;
  cache = (async () => {
    const gl = new GLTFLoader();
    const tl = new THREE.TextureLoader();
    const model = (id) => gl.loadAsync(`${BASE}${id}.glb?v=${V}`).then((g) => g.scene).catch(() => null);
    const tex = (id, key) => tl.loadAsync(`${BASE}tex/${id}_${key}.webp?v=${V}`).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = key === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      return t;
    }).catch(() => null);
    const [models, surfs, hdr] = await Promise.all([
      Promise.all(MODELS.map(model)),
      Promise.all(SURF.map(async (id) => ({ diff: await tex(id, 'diff'), nor: await tex(id, 'nor'), rough: await tex(id, 'rough') }))),
      new RGBELoader().loadAsync(`${BASE}ballroom_1k.hdr?v=${V}`).catch(() => null),
    ]);
    const m = {}; MODELS.forEach((id, i) => { m[id] = models[i]; });
    const T = {}; SURF.forEach((id, i) => { T[id] = surfs[i]; });
    return { m, T, hdr };
  })();
  return cache;
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
  [floorM.map, floorM.roughnessMap, floorM.normalMap].forEach((t) => t && t.repeat.set(35 / 2.2, 57.5 / 2.2));
  const shelfM = surface(S.dark_wood, { color: '#a08070', rough: 0.55, tri: 0.45, key: 'rl-wood' });
  const tableM = surface(S.wood_table_001, { color: '#d0b8a8', rough: 0.3, tri: 0.5, key: 'rl-table' });
  const plasterM = surface(S.painted_plaster_wall, { color: '#3e6b55', rough: 0.85, key: 'rl-plaster' });
  [plasterM.map, plasterM.roughnessMap, plasterM.normalMap].forEach((t) => t && t.repeat.set(57.5 / 2, 17.6 / 2));
  const leatherM = surface(S.brown_leather, { color: '#4f8a63', rough: 0.55, key: 'rl-leather' });
  lib.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.userData) return;
    const k = o.material.userData.key;
    if (k === 'floor') o.material = floorM;
    else if (k === 'wood' || k === 'wood2') o.material = o.geometry.parameters && o.geometry.parameters.width > 1.9 && o.geometry.parameters.depth > 6 ? tableM : shelfM;
    else if (k === 'panel') o.material = plasterM;
    else if (k === 'leather') o.material = leatherM;
    else if (k === 'books') o.material = bookMaterial();
  });

  const added = [];
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
      return mtx(pos.x, F + 0.79, pos.z, (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.3, 0.42 + r() * 0.12);
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
  return { env, added };
}
