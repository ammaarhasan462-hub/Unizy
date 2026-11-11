// The intro's render engine (plain three.js). One continuous world at sunrise: above the clouds facing the
// rising sun, down through the clouds over Bloomsbury, round UCL's dome, into the Main Quad, up the Portico
// steps, through the doors and down the library to a marked answer. Scroll progress p (0..1) drives the camera.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { makeNoise3D } from './noise';
import { CLOUD_BOTTOM, CLOUD_FS, QUAD_VS } from './shaders';
import { ATMO, makeSky, SUN_DIR, sunTransmittance } from './atmo';
import { buildLondon } from './london';
import { buildUCL, tickLibrary } from './ucl';
import { buildSouthKen, RIVER_GLSL } from './southken';
import { buildImperial, IMPERIAL_KEYS } from './imperial';
import { buildCityWorld } from './cityworld';
import { buildQMUL, QMUL_KEYS, QMUL_STRIKE, QMUL_SHADOW, QMUL_KEEP } from './qmul';
import { buildLSE, LSE_KEYS, LSE_STRIKE, LSE_SHADOW, LSE_KEEP } from './lse';

// [progress, camera position, look-at target]
const KEYS = [
  [0.0, [300, 1480, -2600], [0, 1420, 2200]],
  [0.08, [260, 1420, -2200], [0, 1320, 1500]],
  [0.17, [200, 1290, -1800], [0, 300, 300]],
  [0.24, [140, 980, -1480], [0, 100, 0]],
  [0.31, [90, 640, -1170], [0, 40, 0]],
  [0.39, [50, 360, -700], [0, 30, -10]],
  [0.46, [70, 190, -300], [0, 26, -20]],
  [0.52, [170, 115, 20], [0, 24, -10]],
  [0.57, [110, 55, 200], [0, 20, 0]],
  [0.615, [10, 20, 150], [0, 15, 0]],
  [0.66, [0, 9.5, 48], [0, 12, -5]],
  [0.705, [0, 7.6, 8], [0, 8, -20]],
  [0.745, [0, 7.6, -8], [0, 6.7, -40]],
  [0.82, [0, 6.9, -30], [0, 5.5, -46]],
  [0.875, [-0.05, 5.78, -44.85], [-0.2, 5.27, -45.92]],
  [0.93, [-0.165, 5.375, -45.835], [-0.2, 5.272, -45.925]],
  [0.965, [-0.07, 5.5, -45.72], [-0.04, 5.265, -45.97]],
  [1.0, [0.0, 5.54, -45.74], [0.01, 5.262, -45.99]],
];

// monotone cubic (Fritsch–Carlson) per component, keyed on progress: smooth, no overshoot
function makeTrack(keys, idx) {
  const t = keys.map((k) => k[0]);
  const comps = [0, 1, 2].map((c) => {
    const y = keys.map((k) => k[idx][c]);
    const n = y.length;
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (t[i + 1] - t[i]));
    const m = new Array(n);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else {
        const w1 = 2 * (t[i + 1] - t[i]) + (t[i] - t[i - 1]);
        const w2 = (t[i + 1] - t[i]) + 2 * (t[i] - t[i - 1]);
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    return { y, m };
  });
  return (p, out) => {
    const q = Math.min(1, Math.max(0, p));
    let i = 0;
    while (i < t.length - 2 && q > t[i + 1]) i++;
    const h = t[i + 1] - t[i];
    const s = (q - t[i]) / h;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    out.set(...comps.map(({ y, m }) => h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1]));
    return out;
  };
}

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uVig: { value: 0.5 }, uFlash: { value: 0 }, uSplit: { value: 0 }, uGrain: { value: 0.014 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uVig; uniform float uFlash; uniform float uSplit; uniform float uGrain; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - c * 0.0007).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + c * 0.0007).b;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 0.96);
      col = (col - 0.5) * 1.06 + 0.5;
      // split toning like a dawn photograph: shadows lean cool, highlights keep the warm light
      float lt = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col *= mix(mix(vec3(0.9, 0.97, 1.08), vec3(1.0), smoothstep(0.02, 0.45, lt)), vec3(1.0), uSplit);
      col += vec3(0.75, 0.82, 1.0) * uFlash * 0.07;
      col *= 1.0 - r2 * uVig;
      float n = fract(sin(dot(vUv * uRes + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
      // film grain, stronger in the shadows and mid-tones than in the highlights
      col += (n - 0.5) * uGrain * (1.2 - 0.8 * smoothstep(0.2, 0.9, lt));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

// one world per university. glass: the interior looks out through glass (the city stays drawn to the end)
const WORLDS = {
  ucl: { keys: KEYS, strike: [0, 0, 0], glass: false, shadow: [[1100, [0, 0, -150]], [260, [0, 0, 0]], [85, [0, 8, 25]]] },
  imperial: { keys: IMPERIAL_KEYS, strike: [2300, 0, 1600], glass: true, shadow: [[1100, [400, 0, 0]], [320, [250, 0, -10]], [115, [50, 10, -6]]] },
  qmul: { keys: QMUL_KEYS, strike: QMUL_STRIKE, glass: false, shadow: QMUL_SHADOW, keep: QMUL_KEEP, chair: 'dining_chair_02' },
  lse: { keys: LSE_KEYS, strike: LSE_STRIKE, glass: false, shadow: LSE_SHADOW, keep: LSE_KEEP, chair: 'SchoolChair_01', landmarks: { stPauls: [-57, 1264, 0] } },
};

export function createIntro(canvas, { mobile = false, onFrame, hold = false, uni = 'ucl', city = null } = {}) {
  // one world per university: UCL (Bloomsbury), Imperial (South Kensington), Queen Mary (Mile End), LSE (Aldwych)
  const imp = uni === 'imperial';
  const W = WORLDS[uni] || WORLDS.ucl;
  const generic = uni === 'qmul' || uni === 'lse';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  let pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.4);
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // the sun and the city don't move: render shadows only when the stage changes

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 60000);

  // sky, environment light, sun
  const sky = makeSky(renderer);
  ATMO.uSkyLut.value = sky.lut;
  scene.environment = sky.env;
  scene.environmentIntensity = 1.0;
  const T = sunTransmittance(SUN_DIR);
  const tmax = Math.max(T.r, T.g, T.b);
  const sunTint = T.clone().multiplyScalar(1 / tmax);
  ATMO.uSunCol.value.copy(T).multiplyScalar(1.6);
  const sun = new THREE.DirectionalLight(sunTint, 4.2 * tmax + 1.2);
  sun.castShadow = true;
  const smap = mobile ? 2048 : 4096;
  sun.shadow.mapSize.set(smap, smap);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 7000;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);

  // clouds + sky background at reduced resolution
  const noise = makeNoise3D(mobile ? 48 : 64);
  let cloudScale = mobile ? 0.34 : 0.5;
  const cloudRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  cloudRT.texture.minFilter = cloudRT.texture.magFilter = THREE.LinearFilter;

  const london = imp ? buildSouthKen(renderer, { mobile, city }) : generic ? buildCityWorld(renderer, { mobile, city, site: uni, keepRects: W.keep, landmarks: W.landmarks || {} }) : buildLondon(renderer, { mobile, city });
  scene.add(london.group);
  const ucl = imp ? buildImperial({ mobile }) : uni === 'qmul' ? buildQMUL({ mobile }) : uni === 'lse' ? buildLSE({ mobile }) : buildUCL({ mobile });
  scene.add(ucl.group);
  // photo-scanned furniture and surfaces for the reading room, swapped in once they have loaded
  let intEnv = null, disposed = false;
  {
    import('./realism').then(({ loadInterior, upgradeLibrary, upgradeHall, stoneExterior }) => loadInterior(W === WORLDS.ucl ? 'ucl' : uni).then((A) => {
      if (disposed || !A) return;
      try {
        if (imp) {
          stoneExterior(ucl.group, A.stone, { skip: ucl.lib, keys: /^qt-stone/ });
          stoneExterior(ucl.group, A.brick, { skip: ucl.lib, keys: /^qt-brick/, scale: 1 / 1.4, tint: 0.35 });
        } else if (uni === 'lse') {
          stoneExterior(ucl.group, A.brick, { skip: ucl.lib, keys: /^lse-brick/, scale: 1 / 1.4, tint: 0.4 });
          stoneExterior(ucl.group, A.stone, { skip: ucl.lib, keys: /^stone/ });
        } else stoneExterior(ucl.group, A.stone, { skip: ucl.lib });
        const res = imp || generic ? upgradeHall(renderer, ucl, A, { mobile, chair: W.chair }) : upgradeLibrary(renderer, ucl, A, { mobile });
        if (res) {
          intEnv = res.env;
          // the reading room reflects the photographed interior; set per material, so the scene's environment
          // never swaps (a swap would recompile every shader)
          if (intEnv) {
            const seen = new Set();
            ucl.lib.traverse((o) => {
              const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
              ms.forEach((m) => { if (!seen.has(m) && 'envMap' in m && !m.isShaderMaterial) { seen.add(m); m.envMap = intEnv; m.envMapIntensity = 0.42; m.needsUpdate = true; } });
            });
          }
          renderer.shadowMap.needsUpdate = true;
        }
        precompile(false);
      } catch (e) { console.error(e); }
    })).catch(() => {});
  }

  const cloudU = {
    uNoise: { value: noise },
    uSkyLut: { value: sky.lut },
    uMap: { value: london.mapTex },
    uCam: { value: new THREE.Vector3() },
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uTime: { value: 0 },
    uSun: { value: SUN_DIR.clone() },
    uSunCol: { value: T.clone().multiply(new THREE.Color(1.0, 0.6, 0.52)).multiplyScalar(2.3) },
    uBelow: { value: 0 },
    uSteps: { value: mobile ? 36 : 60 },
    uHaze: ATMO.uHaze,
    uFlash: { value: 0 },
    uFlashPos: { value: new THREE.Vector3() },
    uEmis: { value: london.emTex },
  };
  const cloudScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: imp || generic ? CLOUD_FS.replace(/float riverX\(float z\)\{[^\n]*\}/, imp ? RIVER_GLSL : london.riverGLSL) : CLOUD_FS, uniforms: cloudU, depthTest: false, depthWrite: false }));
  quad.frustumCulled = false;
  cloudScene.add(quad);
  scene.background = cloudRT.texture;
  const interiorBg = new THREE.Color(0.02, 0.016, 0.012);

  // post: MSAA scene render, ambient occlusion, bloom, tone mapping, film grade
  const msaa = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  const composer = new EffectComposer(renderer, msaa);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (!mobile && (navigator.hardwareConcurrency || 8) >= 8) {
    try {
      gtao = new GTAOPass(scene, camera, 4, 4);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.blendIntensity = 0.85;
      composer.addPass(gtao);
    } catch (e) { gtao = null; }
  }
  const setAO = (radius, thick) => { if (gtao && gtao.updateGtaoMaterial) { try { gtao.updateGtaoMaterial({ radius, distanceExponent: 1.5, thickness: thick, scale: 1.0, samples: 12, distanceFallOff: 1, screenSpaceRadius: false }); } catch (e) {} } };
  setAO(3, 2);
  const bokeh = new BokehPass(scene, camera, { focus: 1.0, aperture: 0.004, maxblur: 0.012 });
  bokeh.enabled = false;
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), mobile ? 0.3 : 0.38, 0.6, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE);
  composer.addPass(grade);

  // lightning: a couple of strikes over the storm clouds right at the start, before the visitor scrolls
  const boltMat = new THREE.LineBasicMaterial({ color: new THREE.Color(7, 7.5, 9), transparent: true, opacity: 1, toneMapped: false });
  const makeBolt = (a, b, seed) => {
    const rr = (() => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const pts = [];
    const seg = (p0, p1, depth, n) => {
      let prev = p0.clone();
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const p = p0.clone().lerp(p1, t);
        if (i < n) p.add(new THREE.Vector3((rr() - 0.5) * 140 / (depth + 1), (rr() - 0.5) * 40, (rr() - 0.5) * 140 / (depth + 1)));
        pts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        if (depth < 2 && rr() < 0.28) { const e = p.clone().add(new THREE.Vector3((rr() - 0.5) * 500, -150 - rr() * 300, (rr() - 0.5) * 500)); seg(p, e, depth + 1, 6); }
        prev = p;
      }
    };
    seg(a, b, 0, 18);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(g, boltMat);
    l.frustumCulled = false;
    l.visible = false;
    scene.add(l);
    return l;
  };
  const so = new THREE.Vector3(...W.strike); // strikes sit ahead of the opening camera
  const strikes = [
    { t: 1.25, bolt: makeBolt(new THREE.Vector3(-1500, 2900, 2300).add(so), new THREE.Vector3(-1150, 1120, 2650).add(so), 7), pos: new THREE.Vector3(-1150, 1000, 2650).add(so) },
    { t: 3.0, bolt: makeBolt(new THREE.Vector3(1300, 2700, 1500).add(so), new THREE.Vector3(1050, 1120, 1900).add(so), 31), pos: new THREE.Vector3(1050, 980, 1900).add(so) },
  ];
  const pulse = (x, w) => Math.exp(-(x * x) / (w * w));
  let flashesDone = false;

  const keys = W.keys;
  const posAt = makeTrack(keys, 1);
  const lookAt = makeTrack(keys, 2);
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const sc = new THREE.Vector3();

  const state = { p: 0, target: 0, mx: 0, my: 0, sx: 0, sy: 0, running: true, time: 0, beginAt: hold ? null : 0 };
  let w = 1, h = 1;
  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloom.setSize(Math.round(w * pr * 0.5), Math.round(h * pr * 0.5));
    cloudRT.setSize(Math.max(2, Math.round(w * pr * cloudScale)), Math.max(2, Math.round(h * pr * cloudScale)));
    grade.uniforms.uRes.value.set(w * pr, h * pr);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 66 : 50;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  const onMove = (e) => {
    state.mx = (e.clientX / window.innerWidth) * 2 - 1;
    state.my = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  // three.js builds a shader per light count: a light inside a group that is switched off changes the count and makes
  // every material recompile mid-scroll. Lights therefore live directly on the scene and are dimmed, never hidden.
  [ucl.group, london.group].forEach((grp) => {
    const ls = [];
    grp.traverse((o) => { if (o.isLight) ls.push(o); });
    ls.forEach((l) => { scene.attach(l); if (l.target && l.target.parent !== scene) scene.attach(l.target); });
  });
  // draw everything once into a tiny offscreen target (culling off, hidden parts shown, shadows on), so every
  // buffer and texture is on the GPU before the scroll reaches it instead of uploading mid-flight
  const warmRT = new THREE.WebGLRenderTarget(16, 16);
  function warmup() {
    if (disposed) return;
    const changed = [];
    scene.traverse((o) => { changed.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; });
    const prevRT = renderer.getRenderTarget();
    try {
      renderer.shadowMap.needsUpdate = true;
      renderer.setRenderTarget(warmRT);
      renderer.render(scene, camera);
    } catch (e) { /* ignore */ }
    renderer.setRenderTarget(prevRT);
    changed.forEach(([o, v, f]) => { o.visible = v; o.frustumCulled = f; });
    renderer.shadowMap.needsUpdate = true;
  }
  // compile every shader up front (hidden parts included), so nothing compiles mid-scroll and stutters
  function precompile(warm = true) {
    const hidden = [];
    scene.traverse((o) => { if (!o.visible && !(o.userData && o.userData.retired)) { hidden.push(o); o.visible = true; } });
    // compile against the composer's buffer: shaders differ (tone mapping, colour space) between screen and target
    const prevRT = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(composer.readBuffer);
      const done = renderer.compileAsync ? renderer.compileAsync(scene, camera) : (renderer.compile(scene, camera), null);
      if (warm) { if (done && done.then) done.then(warmup, () => {}); else warmup(); }
    } catch (e) { /* ignore */ }
    renderer.setRenderTarget(prevRT);
    hidden.forEach((o) => { o.visible = false; });
  }
  try { precompile(); renderer.compile(cloudScene, quadCam); } catch (e) {}

  let raf = 0;
  let last = performance.now();
  const t0 = last;
  let frames = 0, slow = 0, level = 0;
  let shadowZone = -1;
  let wasBelow = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = (now - t0) / 1000;
    state.time = time;
    if (state.running) state.p += (state.target - state.p) * (1 - Math.exp(-dt * 2.3));
    const p = state.p;

    // adaptive quality: drop AO, then resolution, then cloud steps
    frames++;
    // anything under ~40 fps counts as slow, so a laptop that is merely sluggish steps down too
    if (frames > 20 && dt > 0.025) slow++;
    if (frames % 60 === 0) {
      if (slow > 24 && level < 3) {
        level++;
        if (level === 1 && gtao) gtao.enabled = false;
        if (level === 2) { cloudScale = Math.max(0.28, cloudScale * 0.72); pr = Math.max(0.9, pr * 0.8); resize(); }
        if (level === 3) { cloudU.uSteps.value = Math.round(cloudU.uSteps.value * 0.7); pr = Math.max(0.85, pr * 0.85); resize(); }
      }
      slow = 0;
    }

    // camera
    posAt(p, pos);
    lookAt(p, look);
    if (p > 1) pos.lerp(look, Math.min(1, (p - 1) / 0.06) * 0.7);
    const dist = pos.distanceTo(look);
    state.sx += (state.mx - state.sx) * (1 - Math.exp(-dt * 2));
    state.sy += (state.my - state.sy) * (1 - Math.exp(-dt * 2));
    const amp = dist * (0.03 - 0.018 * ss(0.85, 1, p));
    tmp.set(state.sx * amp, -state.sy * amp * 0.6, 0);
    const breathe = Math.min(dist * 0.004, 3);
    pos.y += Math.sin(time * 0.5) * breathe;
    pos.x += Math.sin(time * 0.31) * breathe;
    camera.position.copy(pos);
    camera.near = p < 0.5 ? 2 : p < 0.64 ? 0.5 : p < 0.86 ? 0.03 : 0.004;
    camera.far = p < 0.7 ? 60000 : 4000;
    camera.updateProjectionMatrix();
    camera.lookAt(look.x + tmp.x, look.y + tmp.y, look.z + tmp.z);
    // filmed, not computed: bank into turns like a drone outside, a faint steadicam float indoors
    {
      const dx = look.x - pos.x, dz = look.z - pos.z;
      const yaw = Math.atan2(dx, dz);
      if (state.yaw == null) state.yaw = yaw;
      let dy = yaw - state.yaw;
      if (dy > Math.PI) dy -= Math.PI * 2; else if (dy < -Math.PI) dy += Math.PI * 2;
      state.yaw = yaw;
      const indoor = ss(0.68, 0.74, p);
      const rate = dt > 0 ? dy / dt : 0;
      const rollT = Math.max(-0.075, Math.min(0.075, -rate * 0.32)) * (1 - indoor);
      state.roll = (state.roll || 0) + (rollT - (state.roll || 0)) * (1 - Math.exp(-dt * 2.2));
      const n = (f, ph) => Math.sin(time * f + ph) * 0.6 + Math.sin(time * f * 2.13 + ph * 1.7) * 0.3 + Math.sin(time * f * 4.71 + ph * 2.3) * 0.1;
      const jit = (0.0022 - 0.0014 * indoor) * (1 - 0.7 * ss(0.9, 1, p));
      camera.rotateZ(state.roll + n(0.37, 1.1) * jit * 0.6);
      camera.rotateX(n(0.53, 0.3) * jit);
      camera.rotateY(n(0.41, 2.6) * jit);
    }
    camera.updateMatrixWorld();

    // lightning (only while the visitor is still at the start)
    let flash = 0;
    if (!flashesDone) {
      strikes.forEach((s) => {
        const dt0 = state.beginAt == null ? -9 : time - state.beginAt - s.t;
        const f = pulse(dt0, 0.045) + 0.55 * pulse(dt0 - 0.09, 0.04) + 0.8 * pulse(dt0 - 0.27, 0.05);
        if (f > flash) { flash = f; cloudU.uFlashPos.value.copy(s.pos); }
        s.bolt.visible = p < 0.06 && f > 0.28;
      });
      if ((state.beginAt != null && time - state.beginAt > 3.6) || p > 0.06) { flashesDone = true; strikes.forEach((s) => { s.bolt.visible = false; }); }
    }
    if (state.forceFlash != null) { const s = strikes[state.forceFlash]; flash = 1; cloudU.uFlashPos.value.copy(s.pos); strikes.forEach((x) => { x.bolt.visible = x === s; }); }
    if (p > 0.06) flash = 0;
    cloudU.uFlash.value = flash;
    state.flash = flash;
    grade.uniforms.uFlash.value = flash;

    // stage lighting
    const inside = ss(0.705, 0.75, p);
    ATMO.uIndoor.value = inside;
    ATMO.uHaze.value = lerp(lerp(0.00004, 0.00011, ss(0.2, 0.32, p)), 0.00018, ss(0.5, 0.64, p));
    scene.environmentIntensity = lerp(2.2, 0.3, inside);
    sun.intensity = 2.2 * (1 - inside);
    renderer.toneMappingExposure = lerp(lerp(0.5, 1.08, ss(0.24, 0.4, p)), 1.6, inside) * lerp(1, 0.85, ss(0.86, 1, p));
    london.trafficU.uTime.value = time;
    london.trafficU.uCam.value.copy(camera.position);
    if (london.avMat) london.avMat.color.setRGB(6 * (0.15 + 0.85 * (Math.sin(time * 3) > 0.6 ? 1 : 0)), 0.3, 0.15);
    // Imperial's exam hall looks out through glass at the floodlit tower, so the floodlights stay on
    ucl.ext.forEach(([l, i]) => { l.intensity = i * (W.glass ? 1 : 1 - inside); });
    tickLibrary(ucl.furn);
    if (ucl.clockHands) {
      const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      ucl.clockHands.forEach(({ hH, mH }) => { mH.rotation.z = -(m / 60) * Math.PI * 2; hH.rotation.z = -(h / 12) * Math.PI * 2; });
    }
    // shallow focus for the close-ups on the desk
    bokeh.enabled = p > 0.85;
    if (bokeh.enabled) {
      bokeh.uniforms.focus.value = dist;
      bokeh.uniforms.aperture.value = lerp(0.0015, 0.012, ss(0.86, 0.93, p)) * (1 - 0.6 * ss(0.95, 1.0, p));
    }
    grade.uniforms.uTime.value = time;
    grade.uniforms.uVig.value = lerp(0.42, 0.6, inside);
    ucl.int.forEach(([l, i]) => { l.intensity = i * ss(0.62, 0.72, p); });
    ucl.dust.uTime.value = time;
    ucl.dust.uOpacity.value = ss(0.72, 0.78, p) * (ucl.dustK ?? 1);
    ucl.shaftMat.opacity = 0.11 * ss(0.7, 0.78, p);

    // sun shadow frustum follows the stage
    const zone = p < 0.42 ? 0 : p < 0.6 ? 1 : 2;
    if (zone !== shadowZone) {
      shadowZone = zone;
      const half = W.shadow[zone][0];
      const cen = new THREE.Vector3(...W.shadow[zone][1]);
      const cam = sun.shadow.camera;
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.updateProjectionMatrix();
      sun.target.position.copy(cen);
      sun.position.copy(cen).addScaledVector(SUN_DIR, 3000);
      sun.shadow.normalBias = half * 0.0011;
      renderer.shadowMap.needsUpdate = true;
      setAO(zone === 2 ? 1.2 : 3, zone === 2 ? 1 : 2);
    }
    if (zone === 2 && inside > 0.5) setAO(0.5, 0.5);

    const below = camera.position.y < CLOUD_BOTTOM - 5;
    london.group.visible = below && (W.glass ? p < 0.97 : inside < 1);
    ucl.group.visible = below;
    if (below !== wasBelow) { wasBelow = below; renderer.shadowMap.needsUpdate = true; }

    if (p < (W.glass ? 0.97 : 0.76)) {
      cloudU.uTime.value = time;
      cloudU.uCam.value.copy(camera.position);
      cloudU.uInvProj.value.copy(camera.projectionMatrixInverse);
      cloudU.uCamWorld.value.copy(camera.matrixWorld);
      cloudU.uBelow.value = below ? 1 : 0;
      renderer.setRenderTarget(cloudRT);
      renderer.render(cloudScene, quadCam);
      renderer.setRenderTarget(null);
      if (scene.background !== cloudRT.texture) scene.background = cloudRT.texture;
    } else if (scene.background !== interiorBg) scene.background = interiorBg;

    composer.render(dt);
    if (onFrame) onFrame(p, state.target, time);
  }
  raf = requestAnimationFrame(frame);

  return {
    state,
    debug: { scene, composer, renderer, grade, get gtao() { return gtao; } },
    jump(p) { state.p = state.target = p; },
    begin() { if (state.beginAt == null) state.beginAt = state.time; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      noise.dispose();
      cloudRT.dispose();
      sky.rt.dispose();
      sky.env.dispose();
      composer.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) {}
    },
  };
}
