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
import { makeNoise3D } from './noise';
import { CLOUD_BOTTOM, CLOUD_FS, QUAD_VS } from './shaders';
import { ATMO, makeSky, SUN_DIR, sunTransmittance } from './atmo';
import { buildLondon } from './london';
import { buildUCL } from './ucl';

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
  [0.9, [0, 6.0, -43.6], [0, 5.26, -46.05]],
  [1.0, [0.0, 5.54, -45.74], [0.01, 5.262, -45.99]],
];

// monotone cubic (Fritsch–Carlson) per component, keyed on progress: smooth, no overshoot
function makeTrack(idx) {
  const t = KEYS.map((k) => k[0]);
  const comps = [0, 1, 2].map((c) => {
    const y = KEYS.map((k) => k[idx][c]);
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
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uVig: { value: 0.5 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uVig; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - c * 0.0022).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + c * 0.0022).b;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.12);
      col.g *= 0.985;
      col = (col - 0.5) * 1.05 + 0.5;
      col *= 1.0 - r2 * uVig;
      float n = fract(sin(dot(vUv * uRes + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.022;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export function createIntro(canvas, { mobile = false, onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  let pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.6);
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

  const london = buildLondon(renderer, { mobile });
  scene.add(london.group);
  const ucl = buildUCL({ mobile });
  scene.add(ucl.group);

  const cloudU = {
    uNoise: { value: noise },
    uSkyLut: { value: sky.lut },
    uMap: { value: london.mapTex },
    uCam: { value: new THREE.Vector3() },
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uTime: { value: 0 },
    uSun: { value: SUN_DIR.clone() },
    uSunCol: { value: T.clone().multiplyScalar(4.0) },
    uBelow: { value: 0 },
    uSteps: { value: mobile ? 36 : 60 },
    uHaze: ATMO.uHaze,
  };
  const cloudScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: CLOUD_FS, uniforms: cloudU, depthTest: false, depthWrite: false }));
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
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), mobile ? 0.3 : 0.38, 0.6, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE);
  composer.addPass(grade);

  const posAt = makeTrack(1);
  const lookAt = makeTrack(2);
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const sc = new THREE.Vector3();

  const state = { p: 0, target: 0, mx: 0, my: 0, sx: 0, sy: 0, running: true };
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

  try { renderer.compile(scene, camera); renderer.compile(cloudScene, quadCam); } catch (e) {}

  let raf = 0;
  let last = performance.now();
  const t0 = last;
  let frames = 0, slow = 0, level = 0;
  let shadowZone = -1;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = (now - t0) / 1000;
    if (state.running) state.p += (state.target - state.p) * (1 - Math.exp(-dt * 2.3));
    const p = state.p;

    // adaptive quality: drop AO, then resolution, then cloud steps
    frames++;
    if (frames > 20 && dt > 0.045) slow++;
    if (frames % 90 === 0) {
      if (slow > 45 && level < 3) {
        level++;
        if (level === 1 && gtao) gtao.enabled = false;
        if (level === 2) { cloudScale = Math.max(0.28, cloudScale * 0.72); pr = Math.max(1, pr * 0.8); resize(); }
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
    camera.near = p < 0.5 ? 2 : p < 0.64 ? 0.5 : 0.03;
    camera.far = p < 0.7 ? 60000 : 4000;
    camera.updateProjectionMatrix();
    camera.lookAt(look.x + tmp.x, look.y + tmp.y, look.z + tmp.z);
    camera.updateMatrixWorld();

    // stage lighting
    const inside = ss(0.705, 0.75, p);
    ATMO.uIndoor.value = inside;
    ATMO.uHaze.value = lerp(lerp(0.00005, 0.00013, ss(0.2, 0.32, p)), 0.0002, ss(0.5, 0.64, p));
    scene.environmentIntensity = lerp(1.5, 0.25, inside);
    sun.intensity = (4.2 * tmax + 1.2) * (1 - inside);
    renderer.toneMappingExposure = lerp(lerp(0.82, 1.0, ss(0.28, 0.4, p)), 1.75, inside) * lerp(1, 0.8, ss(0.9, 1, p));
    grade.uniforms.uTime.value = time;
    grade.uniforms.uVig.value = lerp(0.45, 0.75, inside);
    ucl.int.forEach(([l, i]) => { l.intensity = i * ss(0.62, 0.72, p); });
    ucl.dust.uTime.value = time;
    ucl.dust.uOpacity.value = ss(0.72, 0.78, p);
    ucl.shaftMat.opacity = 0.11 * ss(0.7, 0.78, p);

    // sun shadow frustum follows the stage
    const zone = p < 0.42 ? 0 : p < 0.6 ? 1 : 2;
    if (zone !== shadowZone) {
      shadowZone = zone;
      const half = zone === 0 ? 1100 : zone === 1 ? 260 : 85;
      const cen = zone === 0 ? new THREE.Vector3(0, 0, -150) : zone === 1 ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 8, 25);
      const cam = sun.shadow.camera;
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.updateProjectionMatrix();
      sun.target.position.copy(cen);
      sun.position.copy(cen).addScaledVector(SUN_DIR, 3000);
      sun.shadow.normalBias = half * 0.0011;
      sun.shadow.needsUpdate = true;
      setAO(zone === 2 ? 1.2 : 3, zone === 2 ? 1 : 2);
    }
    if (zone === 2 && inside > 0.5) setAO(0.5, 0.5);

    const below = camera.position.y < CLOUD_BOTTOM - 5;
    london.group.visible = below && inside < 1;
    ucl.group.visible = below;
    sun.castShadow = below;

    if (p < 0.76) {
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
    if (onFrame) onFrame(p, state.target);
  }
  raf = requestAnimationFrame(frame);

  return {
    state,
    jump(p) { state.p = state.target = p; },
    dispose() {
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
