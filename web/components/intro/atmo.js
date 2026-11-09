// Sunrise sky for the intro: a physically based (Rayleigh + Mie single scattering) sky rendered once into an
// equirectangular look-up texture. The LUT colours the background, the clouds' ambient light, the distance
// haze on every surface (atmo()), and through PMREM it is the environment light and reflections for all materials.
import * as THREE from 'three';

// sun just above the eastern horizon (+z is east, +x is north), a little to the south
export const SUN_DIR = new THREE.Vector3(-0.3, 0.15, 1.0).normalize();

const RE = 6360e3, RA = 6420e3, HR = 7994, HM = 1200;
const BR = [5.8e-6, 13.5e-6, 33.1e-6], BM = 7e-6;

// colour of sunlight after passing through the atmosphere (from 1000 m up), relative to the sun at zenith
export function sunTransmittance(dir) {
  const o = [0, RE + 1000, 0];
  const b = o[0] * dir.x + o[1] * dir.y + o[2] * dir.z;
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - RA * RA;
  const t = -b + Math.sqrt(b * b - c);
  const N = 64, ds = t / N;
  let odR = 0, odM = 0;
  for (let i = 0; i < N; i++) {
    const s = ds * (i + 0.5);
    const x = o[0] + dir.x * s, y = o[1] + dir.y * s, z = o[2] + dir.z * s;
    const h = Math.hypot(x, y, z) - RE;
    odR += Math.exp(-h / HR) * ds;
    odM += Math.exp(-h / HM) * ds;
  }
  return new THREE.Color(...BR.map((br) => Math.exp(-(br * odR + BM * 1.1 * odM))));
}

const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FS = /* glsl */ `
precision highp float;
uniform vec3 uSun;
varying vec2 vUv;
const float PI = 3.14159265;
const float Re = ${RE.toFixed(1)}, Ra = ${RA.toFixed(1)};
const vec3 bR = vec3(${BR.map((v) => v.toExponential(3)).join(', ')});
const float bM = ${BM.toExponential(3)};
const float Hr = ${HR.toFixed(1)}, Hm = ${HM.toFixed(1)}, g = 0.78;
vec2 rsi(vec3 o, vec3 d, float r){ float b = dot(o,d), c = dot(o,o) - r*r, h = b*b - c; if (h < 0.0) return vec2(1e9, -1e9); h = sqrt(h); return vec2(-b-h, -b+h); }
vec3 atmo(vec3 dir){
  vec3 o = vec3(0.0, Re + 1000.0, 0.0);
  vec2 p = rsi(o, dir, Ra);
  float tMax = p.y;
  vec2 pg = rsi(o, dir, Re);
  if (pg.x > 0.0) tMax = min(tMax, pg.x);
  float ds = tMax / 20.0, t = 0.0, odR = 0.0, odM = 0.0;
  vec3 sR = vec3(0.0), sM = vec3(0.0);
  float mu = dot(dir, uSun);
  float pR = 3.0/(16.0*PI)*(1.0 + mu*mu);
  float gg = g*g;
  float pM = 3.0/(8.0*PI)*((1.0-gg)*(1.0+mu*mu))/((2.0+gg)*pow(1.0+gg-2.0*g*mu, 1.5));
  for (int i = 0; i < 20; i++) {
    vec3 x = o + dir*(t + ds*0.5);
    float h = length(x) - Re;
    float hr = exp(-h/Hr)*ds, hm = exp(-h/Hm)*ds;
    odR += hr; odM += hm;
    vec2 ls = rsi(x, uSun, Ra);
    float dl = ls.y / 10.0, oR = 0.0, oM = 0.0;
    bool ok = true;
    for (int j = 0; j < 10; j++) {
      vec3 y = x + uSun*(dl*(float(j)+0.5));
      float hl = length(y) - Re;
      if (hl < 0.0) { ok = false; break; }
      oR += exp(-hl/Hr)*dl; oM += exp(-hl/Hm)*dl;
    }
    if (ok) { vec3 att = exp(-(bR*(odR+oR) + bM*1.1*(odM+oM))); sR += att*hr; sM += att*hm; }
    t += ds;
  }
  return 13.0 * (sR*bR*pR + sM*bM*pM);
}
void main(){
  float phi = (vUv.x - 0.5) * 2.0 * PI;
  float th = (vUv.y - 0.5) * PI;
  vec3 d = vec3(cos(th)*cos(phi), sin(th), cos(th)*sin(phi));
  vec3 c;
  if (d.y < 0.004) {
    vec3 dh = normalize(vec3(d.x, 0.0, d.z) + vec3(0.0, 0.004, 0.0));
    c = atmo(dh) * mix(1.0, 0.35, clamp(-d.y*4.0, 0.0, 1.0));
  } else c = atmo(d);
  gl_FragColor = vec4(c, 1.0);
}
`;

export function makeSky(renderer) {
  const rt = new THREE.WebGLRenderTarget(512, 256, { type: THREE.HalfFloatType, depthBuffer: false });
  rt.texture.wrapS = THREE.RepeatWrapping;
  rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
  rt.texture.generateMipmaps = false;
  rt.texture.mapping = THREE.EquirectangularReflectionMapping;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uSun: { value: SUN_DIR.clone() } }, depthTest: false, depthWrite: false }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  mesh.geometry.dispose();
  mesh.material.dispose();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(rt.texture).texture;
  pmrem.dispose();
  return { lut: rt.texture, env, rt };
}

// GLSL to sample the sky LUT in a direction
export const SKY_GLSL = /* glsl */ `
vec3 skyL(sampler2D lut, vec3 d){
  vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
  return texture(lut, uv).rgb;
}
`;

// shared uniforms for distance haze on every surface
export const ATMO = {
  uSkyLut: { value: null },
  uSunDir: { value: SUN_DIR.clone() },
  uSunCol: { value: new THREE.Color(1, 0.7, 0.45) },
  uHaze: { value: 0.00028 },
  uHazeK: { value: 1.0 },
  uIndoor: { value: 0 },
  uIndoorCol: { value: new THREE.Color(0.03, 0.022, 0.014) },
  uIndoorDensity: { value: 0.02 },
};

// Adds sky-coloured, sun-tinted aerial perspective (instead of flat fog) to a three.js material.
export function atmo(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, ATMO);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAtmoW;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vAtmoW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vAtmoW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAtmoW;
        uniform sampler2D uSkyLut; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uHaze; uniform float uHazeK;
        uniform float uIndoor; uniform vec3 uIndoorCol; uniform float uIndoorDensity;
        ${SKY_GLSL}`
      )
      .replace(
        '#include <fog_fragment>',
        `{
          vec3 av = vAtmoW - cameraPosition;
          float ad = length(av);
          vec3 adir = av / max(ad, 1e-3);
          float hk = exp(-max(vAtmoW.y, 0.0) * 0.0009);
          float af = 1.0 - exp(-ad * uHaze * uHazeK * hk);
          vec3 ac = skyL(uSkyLut, normalize(vec3(adir.x, max(adir.y, 0.02), adir.z)));
          ac += uSunCol * 0.05 * pow(max(dot(adir, uSunDir), 0.0), 8.0);
          vec3 outc = mix(gl_FragColor.rgb, ac, af);
          float fi = 1.0 - exp(-ad * uIndoorDensity);
          gl_FragColor.rgb = mix(outc, mix(gl_FragColor.rgb, uIndoorCol, fi), uIndoor);
        }`
      );
    if (material.userData.patch) material.userData.patch(shader);
  };
  const key = material.userData.key || '';
  material.customProgramCacheKey = () => 'atmo' + key;
  return material;
}
