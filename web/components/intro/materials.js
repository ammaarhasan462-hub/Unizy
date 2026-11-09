// Materials for the intro's London: a facade material that draws windows (frames, sash bars, sky-reflecting
// glass, the odd lit room) onto plain boxes, plus small canvas textures. Every material gets atmo() haze.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { atmo } from './atmo';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let facadeId = 0;
export function facadeMaterial(o = {}) {
  const cfg = {
    floor: 3.3, bay: 2.6, winW: 0.42, winH: 0.56, ground: 0.6, topPad: 1.4, sash: 1, lit: 0.025,
    frame: '#ece8df', roof: '#5a5c5f', roughness: 0.86, metalness: 0, glassRough: 0.06, ...o,
  };
  const m = new THREE.MeshStandardMaterial({ roughness: cfg.roughness, metalness: cfg.metalness, color: cfg.color || '#ffffff' });
  const U = {
    uFloor: { value: cfg.floor }, uBay: { value: cfg.bay }, uWinW: { value: cfg.winW }, uWinH: { value: cfg.winH },
    uGround: { value: cfg.ground }, uTopPad: { value: cfg.topPad }, uSash: { value: cfg.sash }, uLit: { value: cfg.lit },
    uFrame: { value: new THREE.Color(cfg.frame) }, uRoof: { value: new THREE.Color(cfg.roof) }, uGlassRough: { value: cfg.glassRough },
  };
  m.userData.key = 'facade' + facadeId++;
  m.userData.patch = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vObjN; varying vec3 vSc; varying float vIid;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vSc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vIid = float(gl_InstanceID);
        #else
          vSc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
          vIid = 0.0;
        #endif
          vObj = position * vSc;
          vObjN = normal;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObj; varying vec3 vObjN; varying vec3 vSc; varying float vIid;
        uniform float uFloor, uBay, uWinW, uWinH, uGround, uTopPad, uSash, uLit, uGlassRough;
        uniform vec3 uFrame, uRoof;
        float fh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float fWin = 0.0, fLit = 0.0;
        {
          vec3 nO = normalize(vObjN);
          float mott = fh(floor(vec2(vObj.x + vObj.z, vObj.y) * 1.25) + vIid);
          diffuseColor.rgb *= 0.9 + 0.2 * mott;
          if (abs(nO.y) < 0.5) {
            bool sx = abs(nO.x) > 0.5;
            float u = sx ? vObj.z : vObj.x;
            float hw = sx ? vSc.z : vSc.x;
            float yy = vObj.y;
            float nb = max(1.0, floor(hw / uBay + 0.25));
            float bu = (u + hw * 0.5) / (hw / nb);
            float fx = fract(bu), fy = fract(yy / uFloor), fl = floor(yy / uFloor);
            float inWin = step(0.5 - uWinW*0.5, fx) * step(fx, 0.5 + uWinW*0.5) * step(0.5 - uWinH*0.5, fy) * step(fy, 0.5 + uWinH*0.5)
                        * step(uGround, yy) * step(yy, vSc.y - uTopPad);
            float gl = inWin * step(0.5 - uWinW*0.5 + 0.04, fx) * step(fx, 0.5 + uWinW*0.5 - 0.04) * step(0.5 - uWinH*0.5 + 0.035, fy) * step(fy, 0.5 + uWinH*0.5 - 0.035);
            float frameM = inWin - gl;
            gl *= 1.0 - uSash * step(abs(fy - 0.5), 0.014);
            float aa = clamp(1.0 - max(fwidth(bu), fwidth(yy / uFloor)) * 2.0, 0.0, 1.0);
            float hs = fh(vec2(floor(bu), fl) + vIid * 0.731 + (sx ? 3.0 : 7.0));
            vec3 glass = mix(vec3(0.028, 0.032, 0.038), vec3(0.11, 0.1, 0.09), step(0.78, hs));
            vec3 pc = mix(diffuseColor.rgb, uFrame, frameM);
            pc = mix(pc, glass, gl);
            float avgW = uWinW * uWinH * 0.75;
            vec3 avgc = mix(diffuseColor.rgb, vec3(0.06, 0.065, 0.07), avgW);
            diffuseColor.rgb = mix(avgc, pc, aa);
            fWin = gl * aa + avgW * 0.5 * (1.0 - aa);
            fLit = step(1.0 - uLit, hs) * gl * aa;
            diffuseColor.rgb *= 1.0 - 0.22 * step(vSc.y - 0.75, yy) * step(yy, vSc.y - 0.45);
            diffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 2.5, yy);
          } else {
            diffuseColor.rgb = mix(diffuseColor.rgb * 0.5, uRoof, 0.65) * (0.85 + 0.3 * fh(floor(vObj.xz * 0.5) + vIid));
          }
        }`
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uGlassRough, fWin);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fLit * vec3(1.0, 0.72, 0.45) * 0.9;');
  };
  return atmo(m);
}

export function plainMaterial(params, key) {
  const m = new THREE.MeshStandardMaterial(params);
  m.userData.key = key || 'plain';
  return atmo(m);
}

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso || 8;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return t;
}

// a unit box with its base at y = 0 (so per-instance scale gives width, height, depth)
export function baseBox() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return g;
}

// pitched roof: ridge along local x, base 1 x 1 at y = 0, height 1
export function roofGeometry() {
  const v = [];
  const P = (x, y, z) => v.push(x, y, z);
  // slopes
  P(-0.5, 0, 0.5); P(0.5, 0, 0.5); P(0.5, 1, 0);
  P(-0.5, 0, 0.5); P(0.5, 1, 0); P(-0.5, 1, 0);
  P(0.5, 0, -0.5); P(-0.5, 0, -0.5); P(-0.5, 1, 0);
  P(0.5, 0, -0.5); P(-0.5, 1, 0); P(0.5, 1, 0);
  // gables
  P(-0.5, 0, -0.5); P(-0.5, 0, 0.5); P(-0.5, 1, 0);
  P(0.5, 0, 0.5); P(0.5, 0, -0.5); P(0.5, 1, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

// foliage: mottled light/dark clumps from 3D noise, so canopies read as leaves rather than smooth shapes
export function leafMaterial(key, color) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, color: color || '#ffffff' });
  m.userData.key = key;
  m.userData.patch = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        float lh3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float ln3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(lh3(i), lh3(i+vec3(1,0,0)), f.x), mix(lh3(i+vec3(0,1,0)), lh3(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(lh3(i+vec3(0,0,1)), lh3(i+vec3(1,0,1)), f.x), mix(lh3(i+vec3(0,1,1)), lh3(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float lf = ln3(vAtmoW * 1.1) * 0.55 + ln3(vAtmoW * 3.3) * 0.45;
        diffuseColor.rgb *= 0.45 + 0.95 * lf;`);
  };
  return atmo(m);
}

export function treeGeometry(seed, detail = 2) {
  // welded so the lumpy canopy shades smoothly (no low-poly facets)
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  const r = rng(seed);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = 0.86 + r() * 0.2 + 0.08 * Math.sin(x * 5.1 + z * 3.7) * Math.cos(y * 4.3);
    p.setXYZ(i, x * s, y * s * 0.86, z * s);
  }
  g.computeVertexNormals();
  return g;
}
