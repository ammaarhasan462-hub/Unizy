// The intro's render engine (plain three.js). A single continuous world; a progress value p (0..1)
// moves the camera along a keyframed path from above the clouds to a marked answer on a library desk.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeNoise3D } from './noise';
import { CLOUD_BOTTOM, CLOUD_FS, QUAD_VS } from './shaders';
import { buildCity, buildLandmark } from './world';

// [progress, camera position, look-at target]
const KEYS = [
  [0.0, [0, 1480, 2700], [0, 1400, 0]],
  [0.09, [0, 1400, 2250], [0, 1250, 0]],
  [0.18, [0, 1235, 1850], [0, 520, 700]],
  [0.25, [0, 950, 1550], [0, 150, 600]],
  [0.32, [0, 600, 1250], [0, 0, 250]],
  [0.42, [80, 280, 760], [0, 20, 0]],
  [0.51, [25, 70, 250], [0, 16, 0]],
  [0.59, [0, 13, 62], [0, 12, 0]],
  [0.655, [0, 6.5, 18], [0, 5.5, -10]],
  [0.71, [0, 4.4, -8], [0, 3.4, -40]],
  [0.8, [0, 3.6, -30], [0, 2.2, -46]],
  [0.9, [0, 2.7, -43.6], [0, 1.96, -46.05]],
  [1.0, [0.0, 2.24, -45.74], [0.01, 1.962, -46.07]],
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
    out.set(
      ...comps.map(({ y, m }) => h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1])
    );
    return out;
  };
}

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const FOG_EXT = new THREE.Color(0.02, 0.026, 0.04);
const FOG_INT = new THREE.Color(0.014, 0.011, 0.008);

export function createIntro(canvas, { mobile = false, onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  let pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const fogCol = new THREE.Color(0.035, 0.042, 0.06);
  scene.fog = new THREE.FogExp2(fogCol.clone(), 0.0002);
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 40000);
  scene.add(new THREE.HemisphereLight(0x33405c, 0x0b0805, 0.25));

  const shared = {
    uTime: { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
    uFog: { value: new THREE.Vector3(fogCol.r, fogCol.g, fogCol.b) },
    uFogDensity: { value: 0.0002 },
  };

  // sky + clouds, rendered at reduced resolution and used as the scene background
  const noise = makeNoise3D(mobile ? 48 : 64);
  let cloudScale = mobile ? 0.34 : 0.5;
  const cloudRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  cloudRT.texture.minFilter = cloudRT.texture.magFilter = THREE.LinearFilter;
  const cloudU = {
    uNoise: { value: noise },
    uCam: { value: new THREE.Vector3() },
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uTime: shared.uTime,
    uSun: { value: new THREE.Vector3(0.15, 0.03, -1).normalize() },
    uBelow: { value: 0 },
    uSteps: { value: mobile ? 34 : 56 },
    uFog: shared.uFog,
  };
  const cloudScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: CLOUD_FS, uniforms: cloudU, depthTest: false, depthWrite: false }));
  quad.frustumCulled = false;
  cloudScene.add(quad);
  scene.background = cloudRT.texture;
  const interiorBg = new THREE.Color(0.01, 0.008, 0.006);

  const city = buildCity(shared, { mobile });
  scene.add(city);
  const land = buildLandmark({ mobile });
  scene.add(land.group);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), mobile ? 0.38 : 0.48, 0.7, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const posAt = makeTrack(1);
  const lookAt = makeTrack(2);
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();

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
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 68 : 52;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  const onMove = (e) => {
    state.mx = (e.clientX / window.innerWidth) * 2 - 1;
    state.my = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  // warm up shaders so the first frames don't stutter
  try { renderer.compile(scene, camera); renderer.compile(cloudScene, quadCam); } catch (e) {}

  let raf = 0;
  let last = performance.now();
  const t0 = last;
  let frames = 0, slow = 0, downgraded = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = (now - t0) / 1000;
    if (state.running) state.p += (state.target - state.p) * (1 - Math.exp(-dt * 2.3));
    const p = state.p;

    // adaptive quality on slow devices
    frames++;
    if (frames > 20 && frames < 140 && dt > 0.045) slow++;
    if (!downgraded && slow > 40) {
      downgraded = true;
      cloudScale = Math.max(0.28, cloudScale * 0.7);
      pr = Math.max(1, pr * 0.75);
      cloudU.uSteps.value = Math.round(cloudU.uSteps.value * 0.75);
      resize();
    }

    // camera
    posAt(p, pos);
    lookAt(p, look);
    if (p > 1) pos.lerp(look, Math.min(1, (p - 1) / 0.06) * 0.7);
    const dist = pos.distanceTo(look);
    state.sx += (state.mx - state.sx) * (1 - Math.exp(-dt * 2));
    state.sy += (state.my - state.sy) * (1 - Math.exp(-dt * 2));
    const amp = dist * (0.035 - 0.02 * ss(0.85, 1, p));
    tmp.set(state.sx * amp, -state.sy * amp * 0.6, 0);
    const breathe = dist * 0.004;
    pos.y += Math.sin(time * 0.5) * breathe;
    pos.x += Math.sin(time * 0.31) * breathe;
    camera.position.copy(pos);
    camera.near = p < 0.56 ? 1 : p < 0.66 ? 0.2 : 0.02;
    camera.far = p < 0.66 ? 40000 : 3000;
    camera.updateProjectionMatrix();
    camera.lookAt(look.x + tmp.x, look.y + tmp.y, look.z + tmp.z);
    camera.updateMatrixWorld();

    // atmosphere per stage
    const inside = ss(0.665, 0.71, p);
    const nearL = ss(0.4, 0.58, p);
    const fc = FOG_EXT.clone().lerp(FOG_INT, inside);
    const fd = lerp(lerp(0.00018, 0.0005, nearL), 0.011, inside);
    scene.fog.color.copy(fc);
    scene.fog.density = fd;
    shared.uFog.value.set(fc.r, fc.g, fc.b);
    shared.uFogDensity.value = fd;
    shared.uTime.value = time;
    shared.uCamPos.value.copy(camera.position);
    renderer.toneMappingExposure = lerp(lerp(lerp(0.95, 1.05, ss(0.3, 0.4, p)), 1.2, inside), 1.0, ss(0.88, 1, p));

    const below = camera.position.y < CLOUD_BOTTOM - 5;
    city.visible = below && p < 0.74;
    land.group.visible = below;
    land.ext.forEach(([l, i]) => { l.intensity = i * (1 - inside); });
    land.int.forEach(([l, i]) => { l.intensity = i * ss(0.5, 0.66, p); });
    land.doorGlow.material.opacity = 0.28 * ss(0.48, 0.6, p) * (1 - ss(0.64, 0.67, p));
    land.dust.uTime.value = time;
    land.dust.uOpacity.value = ss(0.66, 0.74, p);

    if (p < 0.72) {
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
      composer.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) {}
    },
  };
}
