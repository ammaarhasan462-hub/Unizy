// The real city for the intros, built from OpenStreetMap (c) OpenStreetMap contributors (ODbL): every building
// footprint at its mapped height, the actual streets, squares, parks, water, railways and mapped street trees,
// baked by tools/city/bake_city.py into /assets/city/<site>.json. Walls carry CC0 photo-scanned brick, render,
// stone and concrete (Poly Haven) at true scale, with sash or curtain-wall windows laid out bay by bay per wall.
// If the data or the textures fail to load, the intro falls back to its hand-built city.
import * as THREE from 'three';
import { atmo } from './atmo';
import { canvasTex, leafMaterial, plainMaterial, rng, treeGeometry, baseBox } from './materials';

const V = 2;
const BASE = '/assets/city/';
const cache = {};

// facade styles, in the order bake_city.py numbers them
export const STYLES = [
  { k: 'stock', fam: 'brick', floor: 3.3, bay: 2.7, winW: 0.4, winH: 0.58, frame: '#efebe2', sash: 1, lit: 0.1, tint: ['#c2a57b', '#b39770', '#a98d68', '#c9ae86', '#9f8462'] },
  { k: 'stucco', fam: 'plaster', floor: 3.6, bay: 2.9, winW: 0.4, winH: 0.6, frame: '#f6f4ee', sash: 1, lit: 0.1, tint: ['#eeeae0', '#e8e2d4', '#f1eee6', '#e3dccb'] },
  { k: 'stone', fam: 'stone', floor: 3.9, bay: 3.0, winW: 0.44, winH: 0.58, frame: '#e4ddcf', sash: 1, lit: 0.12, tint: ['#ddd4c1', '#d3cab6', '#cbc2ae', '#e2dacb'] },
  { k: 'glass', fam: 'concrete', floor: 3.9, bay: 1.6, winW: 0.88, winH: 0.72, frame: '#40464c', sash: 0, lit: 0.22, glass: 0.03, tint: ['#9aa3a8', '#8b949a', '#b3b6b5', '#7f8b93'] },
  { k: 'redbrick', fam: 'brick', floor: 3.3, bay: 2.6, winW: 0.42, winH: 0.6, frame: '#f0ece4', sash: 1, lit: 0.1, tint: ['#9a5440', '#8c4a39', '#a35d47', '#7f4535', '#a8664d'] },
  { k: 'concrete', fam: 'concrete', floor: 3.6, bay: 2.2, winW: 0.7, winH: 0.6, frame: '#55595d', sash: 0, lit: 0.18, tint: ['#b0aea8', '#a19f99', '#bcb8ae', '#959790'] },
  { k: 'church', fam: 'stone', floor: 8.0, bay: 4.2, winW: 0.32, winH: 0.72, frame: '#b9b2a4', sash: 0, lit: 0.08, tint: ['#cfc6b2', '#c4bba8', '#b7ae9b'] },
  { k: 'shed', fam: 'concrete', floor: 9.0, bay: 9.0, winW: 0.0, winH: 0.0, frame: '#777', sash: 0, lit: 0, tint: ['#8c8a85', '#7b7a76', '#9a958c'] },
];
const FAMS = ['brick', 'plaster', 'stone', 'concrete'];
const FAR_TEX = 650; // metres: walls further off use their texture layer's average (see facade())

async function texIndex() {
  try {
    const r = await fetch(`${BASE}tex/index.json?v=${V}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function loadTex(url, srgb) {
  return new Promise((res) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      res(t);
    }, undefined, () => res(null));
  });
}

// fetch the map data and the wall/roof textures together; resolves to null if the map data is unavailable
export function loadCity(site) {
  if (!cache[site]) {
    cache[site] = (async () => {
      try {
        const [data, idx] = await Promise.all([fetch(`${BASE}${site}.json?v=${V}`).then((r) => (r.ok ? r.json() : null)), texIndex()]);
        if (!data || !data.b) return null;
        const tex = {};
        if (idx) {
          await Promise.all(Object.entries(idx).map(async ([fam, e]) => {
            const [map, nrm] = await Promise.all([loadTex(BASE + 'tex/' + e.diff, true), e.nor ? loadTex(BASE + 'tex/' + e.nor, false) : null]);
            if (map) tex[fam] = { map, nrm, size: e.size || 2 };
          }));
        }
        return { data, tex };
      } catch {
        return null;
      }
    })();
  }
  return cache[site];
}

// ------------------------------------------------------------------ facade material
// the four wall families' photo textures stacked as layers of one array texture (row 0 at the bottom, as the image
// textures are drawn with flipY), so every wall in a tile shares one material and is one draw call
function layerStack(imgs, srgb) {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const data = new Uint8Array(S * S * 4 * imgs.length);
  imgs.forEach((im, i) => {
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.fillStyle = srgb ? '#ffffff' : '#8080ff';
    cx.fillRect(0, 0, S, S);
    if (im) { cx.setTransform(1, 0, 0, -1, 0, S); cx.drawImage(im, 0, 0, S, S); }
    data.set(cx.getImageData(0, 0, S, S).data, i * S * S * 4);
  });
  // each layer's average shading factor (what the shader multiplies the wall colour by), for the far walls' cheap path
  const avg = imgs.map((im, i) => {
    const o = i * S * S * 4, lin = (v) => (srgb ? Math.pow(v / 255, 2.2) : v / 255);
    let r = 0, g = 0, b = 0, n = 0;
    for (let k = o; k < o + S * S * 4; k += 4 * 13) {
      const R = lin(data[k]), G = lin(data[k + 1]), B = lin(data[k + 2]), l = 0.299 * R + 0.587 * G + 0.114 * B;
      r += 0.3 * R * 1.6 + 0.7 * l * 2.1; g += 0.3 * G * 1.6 + 0.7 * l * 2.1; b += 0.3 * B * 1.6 + 0.7 * l * 2.1; n++;
    }
    return new THREE.Vector3(r / n, g / n, b / n);
  });
  const t = new THREE.DataArrayTexture(data, S, S, imgs.length);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  t.userData.avg = avg;
  return t;
}

const px1 = (rgba) => { const t = new THREE.DataTexture(new Uint8Array(rgba), 1, 1); t.needsUpdate = true; return t; };

function facade(T) {
  const has = FAMS.map((f) => (T[f] ? 1 : 0)), hasN = FAMS.map((f) => (T[f] && T[f].nrm ? 1 : 0));
  const anyT = has.some((v) => v), anyN = hasN.some((v) => v);
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true, color: '#ffffff' });
  let wallMap = null, wallNrm = null;
  if (anyT) {
    try {
      wallMap = layerStack(FAMS.map((f) => (T[f] ? T[f].map.image : null)), true);
      if (anyN) wallNrm = layerStack(FAMS.map((f) => (T[f] && T[f].nrm ? T[f].nrm.image : null)), false);
    } catch { wallMap = wallNrm = null; }
  }
  // 1-pixel stand-ins keep the engine's map and normal-map code paths (uvs, tangent frame); the shader samples the stacks
  if (wallMap) m.map = px1([255, 255, 255, 255]);
  if (wallNrm) { m.normalMap = px1([128, 128, 255, 255]); m.normalScale = new THREE.Vector2(0.8, 0.8); }
  const lay = STYLES.map((s) => FAMS.indexOf(s.fam));
  const U = {
    uFloor: { value: STYLES.map((s) => s.floor) }, uBay: { value: STYLES.map((s) => s.bay) },
    uWinW: { value: STYLES.map((s) => s.winW) }, uWinH: { value: STYLES.map((s) => s.winH) },
    uSash: { value: STYLES.map((s) => s.sash) }, uLit: { value: STYLES.map((s) => s.lit) }, uGlassR: { value: STYLES.map((s) => (s.glass != null ? s.glass : 0.06)) },
    uFrame: { value: STYLES.map((s) => new THREE.Color(s.frame)) },
    // per style: its family's layer, texture scale (1 / metres the texture spans), whether that layer has a photo and a normal map
    uLay: { value: lay }, uTexScS: { value: STYLES.map((s) => (T[s.fam] ? 1 / T[s.fam].size : 1)) },
    uLayT: { value: STYLES.map((s, i) => has[lay[i]]) }, uLayN: { value: STYLES.map((s, i) => hasN[lay[i]]) },
    uRoughS: { value: STYLES.map((s) => (s.fam === 'concrete' ? 0.8 : 0.9)) },
    uWallMap: { value: wallMap }, uWallNrm: { value: wallNrm },
    // beyond FAR_TEX metres a wall's photo texture is under a pixel or two a course: use the layer's average instead of
    // sampling the photo and its normal map (anisotropic samples are the costliest part of a far wall's pixel)
    uAvgS: { value: STYLES.map((s, i) => (wallMap ? wallMap.userData.avg[lay[i]] : new THREE.Vector3(1, 1, 1))) }, uFarTex: { value: FAR_TEX },
  };
  // one material and one shader program for all four wall families: the style slot picks the family's texture layer
  m.userData.key = 'cityf' + (wallMap ? 'a' : '') + (wallNrm ? 'n' : '');
  m.userData.patch = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aB; varying vec4 vB; varying vec2 vW; varying vec3 vWN;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvB = aB; vW = uv; vWN = normal;');
    const N = STYLES.length;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vB; varying vec2 vW; varying vec3 vWN;
        uniform float uFloor[${N}], uBay[${N}], uWinW[${N}], uWinH[${N}], uSash[${N}], uLit[${N}], uGlassR[${N}];
        uniform vec3 uFrame[${N}];
        uniform float uLay[${N}], uTexScS[${N}], uLayT[${N}], uLayN[${N}], uRoughS[${N}];
        uniform highp sampler2DArray uWallMap, uWallNrm;
        uniform vec3 uAvgS[${N}]; uniform float uFarTex;
        float fh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
        // shopfront fascia paints (linear): kind 0 shop, 1 cafe or restaurant, 2 pub or bar, 3 bank, chemist and services, 4 empty
        vec3 fasC(float kd, float h) {
          float i = floor(h * 6.0);
          if (kd < 0.5) return i < 1.0 ? vec3(0.012, 0.012, 0.014) : i < 2.0 ? vec3(0.012, 0.022, 0.06) : i < 3.0 ? vec3(0.01, 0.045, 0.026)
                             : i < 4.0 ? vec3(0.07, 0.01, 0.014) : i < 5.0 ? vec3(0.72, 0.7, 0.64) : vec3(0.13, 0.16, 0.19);
          if (kd < 1.5) return i < 2.0 ? vec3(0.6, 0.52, 0.37) : i < 3.0 ? vec3(0.02, 0.08, 0.04) : i < 4.0 ? vec3(0.42, 0.035, 0.02)
                             : i < 5.0 ? vec3(0.3, 0.085, 0.03) : vec3(0.015, 0.015, 0.016);
          if (kd < 2.5) return i < 2.0 ? vec3(0.08, 0.01, 0.01) : i < 4.0 ? vec3(0.008, 0.032, 0.016) : vec3(0.01, 0.01, 0.012);
          if (kd < 3.5) return i < 2.0 ? vec3(0.5, 0.012, 0.012) : i < 3.0 ? vec3(0.01, 0.05, 0.26) : i < 4.0 ? vec3(0.02, 0.24, 0.06)
                             : i < 5.0 ? vec3(0.09, 0.02, 0.19) : vec3(0.75, 0.74, 0.7);
          return vec3(0.42, 0.4, 0.36);
        }`)
      // walls sample the photo textures in metres along the wall (aW.x) and up it (aW.y)
      .replace('#include <map_fragment>', `
        // the wall's style (the low four bits of the style slot) picks its family's layer and texture scale
        int stL = int(mod(floor(vB.x + 0.5), 16.0) + 0.5);
        vec3 texL = vec3(vW * uTexScS[stL], uLay[stL]);
        vec2 texDx = dFdx(texL.xy), texDy = dFdy(texL.xy);
        // 0 near, 1 beyond uFarTex: far walls take the layer's average and skip the photo and normal samples
        float texFar = smoothstep(uFarTex * 0.75, uFarTex, length(vViewPosition));
        #ifdef USE_MAP
          if (uLayT[stL] > 0.5) {
            vec3 tf = uAvgS[stL];
            if (texFar < 0.999) {
              vec4 tx = textureGrad(uWallMap, texL, texDx, texDy);
              float tl = dot(tx.rgb, vec3(0.299, 0.587, 0.114));
              // keep the texture's mortar, weathering and grain; take the hue from the building's colour
              tf = mix(mix(tx.rgb * 1.6, vec3(tl) * 2.1, 0.7), tf, texFar);
            }
            diffuseColor.rgb *= tf;
          }
        #endif`)
      .replace('#include <normal_fragment_maps>', `
        #ifdef USE_NORMALMAP_TANGENTSPACE
          if (uLayN[stL] > 0.5 && texFar < 0.999) {
            vec3 mapN = textureGrad(uWallNrm, texL, texDx, texDy).xyz * 2.0 - 1.0;
            mapN.xy *= normalScale * (1.0 - fWin) * (1.0 - texFar);
            normal = normalize(tbn * mapN);
          }
        #endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float fWin = 0.0, fLit = 0.0, fGR = 0.06;
        vec3 roomE = vec3(1.0);
        vec3 litC = vec3(1.0, 0.7, 0.4);
        {
          // the style slot also carries the shopfront kind: style + 16 * (kind + 1) on ground-floor shop walls
          // and the period dress: + 128 * era, + 1024 * front (1 doors and railings, 2 doors and bays, 3 doors, 4 a bay window's face)
          float sxk = floor(vB.x + 0.5);
          float frontF = floor(sxk / 1024.0 + 0.001); sxk -= frontF * 1024.0;
          float era = floor(sxk / 128.0 + 0.001); sxk -= era * 128.0;
          float shopK = floor(sxk / 16.0 + 0.001);
          int st = int(sxk - shopK * 16.0 + 0.5);
          float isBay = step(3.5, frontF);
          // the building seed is interpolated, so quantise it before hashing (hashes amplify float noise into speckle)
          float seed = floor(vB.y * 997.0 + 0.5) * 0.1373, wl = vB.z, bh = vB.w;
          float flo = uFloor[st], bay = uBay[st], ww = uWinW[st], wh = uWinH[st];
          // post-war blocks: ribbon windows; a bay window's faces: glazed nearly edge to edge
          if (era > 3.5) { bay = 3.0; ww = 0.97; wh = 0.5; }
          if (isBay > 0.5) { bay = wl; ww = clamp(1.0 - 0.36 / wl, 0.3, 0.9); wh = 0.6; }
          float topM = isBay > 0.5 ? 0.45 : 1.1;
          float u = vW.x, yy = vW.y;
          float shopTop = shopK > 0.5 ? clamp(flo + 1.0, 4.3, 5.0) : 0.0;
          float yg = yy - (shopK > 0.5 ? shopTop - flo : 0.0);
          diffuseColor.rgb *= 0.92 + 0.16 * fh(vec2(floor(u * 0.25), floor(yy * 0.3)) + seed);
          float nb = max(1.0, floor(wl / bay + 0.25));
          float bu = u / (wl / nb);
          float fx = fract(bu), fy = fract(yg / flo), fl = floor(yg / flo);
          float gnd = shopK > 0.5 ? shopTop + 0.25 : st == 3 ? 0.2 : 0.65;
          float topF = floor((bh - 0.6) / flo) - 1.0;
          // Georgian fronts: tall first-floor windows (the piano nobile), squat ones in the top storey
          if (era > 0.5 && era < 1.5 && isBay < 0.5) wh *= fl > 0.5 && fl < 1.5 ? 1.22 : (fl >= topF && fl > 1.5 ? 0.78 : 1.0);
          // the front door: one bay in each house (three bays to a Georgian house, two to a Victorian one), houses mirrored in pairs
          float bI = floor(bu), per = era < 1.5 ? 3.0 : 2.0;
          float hJ = floor(bI / per), hK = bI - hJ * per;
          float doorBay = step(0.5, frontF) * step(frontF, 3.5) * step(shopK, 0.5) * step(fl, 0.5) * step(3.25, flo) * step(5.0, wl)
                        * step(abs(hK - (mod(hJ, 2.0) < 0.5 ? 0.0 : per - 1.0)), 0.1);
          float inWin = step(0.5 - ww*0.5, fx) * step(fx, 0.5 + ww*0.5) * step(0.5 - wh*0.5, fy) * step(fy, 0.5 + wh*0.5)
                      * step(gnd, yy) * step(yy, bh - topM) * max(step(3.2, wl), isBay) * (1.0 - doorBay);
          float gl = inWin * step(0.5 - ww*0.5 + 0.04, fx) * step(fx, 0.5 + ww*0.5 - 0.04) * step(0.5 - wh*0.5 + 0.035, fy) * step(fy, 0.5 + wh*0.5 - 0.035);
          float frameM = inWin - gl;
          gl *= 1.0 - uSash[st] * step(abs(fy - 0.5), 0.014);
          // glazing bars by period: six over six, two over two, steel casements, a mullion in each ribbon light
          if (era > 0.5 && gl > 0.5) {
            float wx = (fx - (0.5 - ww * 0.5)) / ww, wy = (fy - (0.5 - wh * 0.5)) / wh;
            float mW = ww * wl / nb, mH = wh * flo, bw = 0.02;
            float gb = 0.0;
            if (era < 1.5) gb = max(step(abs(fract(wx * 3.0 + 0.5) - 0.5) * mW / 3.0, bw), step(abs(fract(wy * 6.0 + 0.5) - 0.5) * mH / 6.0, bw));
            else if (era < 2.5) gb = step(abs(wx - 0.5) * mW, bw);
            else if (era < 3.5) gb = max(step(abs(fract(wx * 3.0 + 0.5) - 0.5) * mW / 3.0, bw * 0.8), step(abs(fract(wy * 4.0 + 0.5) - 0.5) * mH / 4.0, bw * 0.8));
            else gb = step(abs(wx - 0.5) * mW, 0.03);
            gl *= 1.0 - gb * clamp(1.0 - max(fwidth(wx * mW), fwidth(wy * mH)) * 18.0, 0.0, 1.0);
          }
          float aa = clamp(1.0 - max(fwidth(bu), fwidth(yg / flo)) * 2.0, 0.0, 1.0);
          float hs = fh(vec2(floor(bu), fl) + seed);
          float bLit = step(0.45, fract(seed * 4.5313));
          float roomLit = step(1.0 - uLit[st], hs) * bLit;
          // ---- the room behind each window (interior mapping): follow the view ray into a box room the width of
          // the bay and one storey high, and shade whichever wall, floor or ceiling it reaches
          vec3 glass = vec3(0.03);
          roomE = vec3(0.0);
          if (gl * aa > 0.001) {
            vec3 Vd = normalize(vAtmoW - cameraPosition);
            vec3 Nw = normalize(vWN);
            vec3 Tw = vec3(-Nw.z, 0.0, Nw.x);
            float du = dot(Vd, Tw), dv = Vd.y, dn = max(-dot(Vd, Nw), 0.06);
            float rw = wl / nb, rh = flo, rd = 4.5 + 4.0 * fh(vec2(hs, 7.1));
            float px = fx * rw, py = fy * rh;
            float tx = du > 0.0 ? (rw - px) / max(du, 1e-4) : px / max(-du, 1e-4);
            float ty = dv > 0.0 ? (rh - 0.15 - py) / max(dv, 1e-4) : py / max(-dv, 1e-4);
            float tz = rd / dn;
            float tt = min(min(tx, ty), tz);
            vec3 hp = vec3(px + du * tt, py + dv * tt, dn * tt);
            float rk = fh(vec2(hs, 3.3));
            vec3 wallC = mix(vec3(0.58, 0.53, 0.46), vec3(0.66, 0.65, 0.62), rk);
            if (st == 3 || st == 5) wallC = mix(vec3(0.62, 0.63, 0.64), vec3(0.5, 0.52, 0.55), rk);
            vec3 rc = wallC;
            float isCeil = 0.0;
            if (tt == ty && dv > 0.0) { rc = vec3(0.8, 0.78, 0.74); isCeil = 1.0; }
            else if (tt == ty) { rc = mix(vec3(0.3, 0.21, 0.14), vec3(0.42, 0.4, 0.38), step(0.5, rk)); }
            else if (tt == tz) {
              rc = wallC * 0.9;
              // furniture against the back wall: a bookcase or a desk, a picture or a door
              float k2 = fh(vec2(hs, 9.7));
              float x0 = 0.15 + 0.3 * k2;
              rc *= 1.0 - 0.55 * step(x0 * rw, hp.x) * step(hp.x, (x0 + 0.35) * rw) * step(hp.y, (k2 > 0.5 ? 2.0 : 0.85));
              rc = mix(rc, vec3(0.2, 0.17, 0.14), step(0.7, k2) * step(0.62 * rw, hp.x) * step(hp.x, 0.86 * rw) * step(1.3, hp.y) * step(hp.y, 2.0));
            }
            // light falls off away from the window; lit rooms glow from a ceiling light near the middle
            float dep = clamp(hp.z / rd, 0.0, 1.0);
            rc *= mix(1.0, 0.4, dep);
            float lamp = exp(-dot(hp.xz - vec2(rw * 0.5, rd * 0.45), hp.xz - vec2(rw * 0.5, rd * 0.45)) * 0.08);
            // curtains or blinds in some windows (lit from behind when the room is on)
            float cur = 0.0;
            float ck = fh(vec2(hs, fl + 5.0));
            if (ck > 0.62) { float cw = 0.12 + 0.18 * fh(vec2(ck, 1.0)); float wx = (fx - (0.5 - ww * 0.5)) / ww; cur = step(wx, cw) + step(1.0 - cw, wx); }
            if (ck < 0.18) { float wy = (fy - (0.5 - wh * 0.5)) / wh; cur = step(1.0 - 0.25 - 0.5 * ck, wy); }
            cur = clamp(cur, 0.0, 1.0);
            vec3 curC = mix(vec3(0.62, 0.55, 0.44), vec3(0.36, 0.14, 0.12), step(0.5, fh(vec2(ck, 2.0))));
            // the window reveal throws the top of the glass into shadow
            float rev = 1.0 - 0.45 * smoothstep(0.5 + wh * 0.5 - 0.09, 0.5 + wh * 0.5 - 0.035, fy);
            glass = mix(rc * 0.11, curC * 0.16, cur) * rev;
            roomE = roomLit * mix(rc * (0.35 + 1.4 * lamp + 0.8 * isCeil), curC * 0.9, cur) * rev;
          }
          // sills and lintels in stone or render on the older brick fronts
          float sillT = 0.5 - wh * 0.5, linT = 0.5 + wh * 0.5;
          float band = uSash[st] * step(0.5 - ww * 0.5 - 0.03, fx) * step(fx, 0.5 + ww * 0.5 + 0.03) * step(gnd, yy) * step(yy, bh - topM) * max(step(3.2, wl), isBay) * (1.0 - doorBay)
                     * (step(sillT - 0.045, fy) * step(fy, sillT) + (st == 0 || st == 4 ? step(linT, fy) * step(fy, linT + 0.05) : 0.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.83, 0.76), band * aa);
          // ---- period dressings (OpenStreetMap start_date, building:architecture and heritage, else the street; see bake_city.py)
          float fineA = clamp(1.0 - max(fwidth(yy), fwidth(u)) * 12.0, 0.0, 1.0);
          float off = 1.0 - inWin;
          float bwM = wl / nb;
          if (era > 0.5 && era < 1.5 && shopK < 0.5 && isBay < 0.5) {
            // Georgian and Regency: a rusticated stucco ground floor under a moulded band; a stucco cornice under the top storey
            vec3 stuc = vec3(0.72, 0.7, 0.64) * (0.94 + 0.12 * fh(vec2(seed, 2.0)));
            float gfl = step(yy, flo) * off;
            diffuseColor.rgb = mix(diffuseColor.rgb, stuc * (1.0 - 0.42 * step(fract(yy / 0.4), 0.07) * fineA), gfl);
            float b1 = step(flo, yy) * step(yy, flo + 0.24);
            float yc = topF * flo;
            float b2 = step(yc - 0.06, yy) * step(yy, yc + 0.22) * step(3.0, topF);
            diffuseColor.rgb = mix(diffuseColor.rgb, stuc * 1.08, max(b1, b2));
            diffuseColor.rgb *= 1.0 - 0.3 * (step(flo + 0.24, yy) * step(yy, flo + 0.34) + step(yc - 0.16, yy) * step(yy, yc - 0.06) * step(3.0, topF)) * off;
          } else if (era > 1.5 && era < 2.5) {
            // Victorian: stone string courses, quoins, and stone surrounds with keystones round the windows
            vec3 dst = vec3(0.7, 0.66, 0.58) * (0.94 + 0.12 * fh(vec2(seed, 3.0)));
            float notSt = st == 1 ? 0.0 : 1.0;
            float sc = step(fract(yg / flo) * flo, 0.16) * step(flo * 0.9, yg) * step(yg, bh - 0.6);
            float qw = mod(floor(yy / 0.32), 2.0) > 0.5 ? 0.78 : 0.46;
            float qn = (step(u, qw) + step(wl - qw, u)) * step(9.0, wl) * step(frontF, 0.5) * notSt;  // corners of whole buildings, not every house
            float dx = abs(fx - 0.5), dy = fy - 0.5;
            float inE = step(dx, ww * 0.5 + 0.11 / bwM) * step(-wh * 0.5 - 0.06 / flo, dy) * step(dy, wh * 0.5 + 0.3 / flo)
                      * step(gnd, yy) * step(yy, bh - topM) * max(step(3.2, wl), isBay) * (1.0 - doorBay);
            float keyS = step(dx, 0.12 / bwM) * step(wh * 0.5, dy) * step(dy, wh * 0.5 + 0.42 / flo) * step(gnd, yy) * step(yy, bh - topM) * max(step(3.2, wl), isBay) * (1.0 - doorBay);
            float dres = clamp(max(max(sc, qn), max(inE, keyS)), 0.0, 1.0) * off;
            vec3 dcol = dst * (1.0 - 0.3 * qn * step(fract(yy / 0.32), 0.07) * fineA);
            diffuseColor.rgb = mix(diffuseColor.rgb, dcol, dres * mix(0.45, 1.0, notSt));
          } else if (era > 2.5 && era < 3.5) {
            // inter-war Portland stone: banded rustication on the ground floor, ashlar courses, a deep cornice under the attic storey
            float course = floor(yy / 0.55);
            float joint = max(step(fract(yy / 0.55), 0.07), step(fract(u / 1.2 + 0.5 * mod(course, 2.0)), 0.025));
            diffuseColor.rgb *= 1.0 - step(yy, flo + 0.3) * off * 0.4 * joint * fineA;
            diffuseColor.rgb *= 1.0 - 0.12 * step(fract(yy / 0.6), 0.04) * fineA * off;
            float yc = topF * flo;
            float cor = step(yc - 0.55, yy) * step(yy, yc) * step(3.0, topF);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.45 + 0.75 * smoothstep(yc - 0.5, yc - 0.15, yy)), cor);
          } else if (era > 3.5) {
            // post-war concrete: board-marked spandrels, rain streaks under the windows, a dark recessed ground floor on columns
            float bm = fh(vec2(floor(u / 0.15), floor(yy / 1.2) + seed * 7.0));
            diffuseColor.rgb *= 0.92 + 0.12 * bm * fineA * off;
            float stain = off * step(fy, 0.5 - wh * 0.5) * step(gnd, yy) * fh(vec2(floor(u / 0.45), fl + seed)) * smoothstep(0.0, 0.5 - wh * 0.5, fy);
            diffuseColor.rgb *= 1.0 - 0.22 * stain;
            float pil = step(fract(u / 6.0), 0.08);
            diffuseColor.rgb *= 1.0 - 0.6 * step(yy, flo - 0.3) * (1.0 - pil) * step(shopK, 0.5) * step(fl, 0.5) * step(12.0, wl);
          }
          vec3 frC = era > 2.5 && era < 3.5 ? vec3(0.045, 0.045, 0.042) : uFrame[st];
          vec3 pc = mix(diffuseColor.rgb, frC, frameM);
          pc = mix(pc, glass, gl);
          float avgW = ww * wh * 0.75;
          vec3 avgc = mix(diffuseColor.rgb, vec3(0.06, 0.065, 0.07), avgW);
          diffuseColor.rgb = mix(avgc, pc, aa);
          fWin = gl * aa + avgW * 0.5 * (1.0 - aa);
          fGR = uGlassR[st];
          litC = mix(vec3(1.0, 0.7, 0.42), vec3(0.85, 0.9, 1.0), step(0.8, fh(vec2(hs, seed))));
          litC *= 0.6 + 0.8 * fh(vec2(fl, seed + 1.0));
          fLit = gl * aa + (1.0 - aa) * uLit[st] * ww * wh * 0.6 * bLit;
          roomE = mix(vec3(1.0), roomE, aa);
          // front doors: panelled and gloss-painted in a doorcase, under a fanlight (Georgian) or a transom light (Victorian)
          if (doorBay > 0.5) {
            float cu = (fx - 0.5) * bwM;
            float dW = 0.55, dH = 2.6;
            float surround = step(abs(cu), dW + 0.24) * step(yy, dH + (era < 1.5 ? 0.82 : 0.78));
            float leaf = step(abs(cu), dW) * step(yy, dH);
            vec2 fc = vec2(cu, yy - dH - 0.05);
            float fan = (era < 1.5 ? step(length(fc), dW) : step(abs(cu), dW) * step(fc.y, 0.55)) * step(0.0, fc.y);
            float dk = fh(vec2(seed, 11.0 + hJ));
            vec3 dc = dk < 0.4 ? vec3(0.008) : dk < 0.55 ? vec3(0.005, 0.03, 0.015) : dk < 0.7 ? vec3(0.006, 0.012, 0.04) : dk < 0.82 ? vec3(0.12, 0.012, 0.01) : vec3(0.55, 0.52, 0.46);
            vec3 sc2 = era < 1.5 ? vec3(0.82, 0.8, 0.73) : vec3(0.8, 0.76, 0.67);
            float ang = atan(fc.y, fc.x);
            if (surround > 0.5 && leaf < 0.5 && fan < 0.5) { diffuseColor.rgb = sc2 * (0.85 + 0.15 * step(0.12, abs(abs(cu) - dW - 0.12))); fWin = 0.0; fLit = 0.0; }
            if (leaf > 0.5) {
              float pu = abs(cu) / dW, pv = yy / dH;
              float edge = max(step(0.86, pu), max(step(abs(pu - 0.0), 0.04), step(abs(fract(pv * 3.0) - 0.5), 0.07)));
              diffuseColor.rgb = dc * (1.0 + 0.6 * edge * fineA) + vec3(0.004);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.48, 0.2), step(abs(pv - 0.5), 0.015) * step(abs(pu - 0.5), 0.06));
              fWin = 0.45; fGR = 0.22; fLit = 0.0;
            }
            if (fan > 0.5 && leaf < 0.5) {
              float fb = era < 1.5 ? max(step(abs(fract(ang / 3.14159 * 5.0 + 0.5) - 0.5), 0.07), step(dW - 0.06, length(fc))) : step(abs(cu), 0.02);
              float hall = step(0.62, fh(vec2(seed, 12.0 + hJ)));
              diffuseColor.rgb = mix(vec3(0.03), vec3(0.85, 0.83, 0.78), fb * fineA);
              fWin = 1.0 - fb; fLit = 1.0 - fb; fGR = 0.05; litC = vec3(1.0, 0.72, 0.42); roomE = vec3(0.35 * hall);
            }
          }
          // iron balconettes across the tall first-floor windows of Georgian and Regency fronts
          if (era > 0.5 && era < 1.5 && fl > 0.5 && fl < 1.5 && isBay < 0.5 && shopK < 0.5 && (st == 1 || fract(seed * 7.13) < 0.5)) {
            float cu = abs(fx - 0.5) * bwM, ym = (fy - (0.5 - wh * 0.5)) * flo;
            float inB = step(cu, ww * 0.5 * bwM + 0.12) * step(-0.04, ym) * step(ym, 0.92) * step(3.2, wl);
            if (inB > 0.5) {
              float bb = clamp(step(abs(fract(cu / 0.11) - 0.5) * 0.11, 0.011) + step(abs(ym - 0.88), 0.035) + step(abs(ym), 0.04) + step(abs(ym - 0.14), 0.018), 0.0, 1.0);
              float bm = mix(0.35, bb, aa);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012), bm);
              fWin *= 1.0 - bm; fLit *= 1.0 - bm;
            }
          }
          // coping band and parapet shadow at the top, plinth and grime near the pavement
          diffuseColor.rgb *= 1.0 - 0.2 * step(bh - 0.8, yy) * step(yy, bh - 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, uFrame[st] * 0.9, step(bh - 0.45, yy) * (1.0 - step(3.0, float(st)) * 0.0) * 0.6);
          diffuseColor.rgb *= 0.78 + 0.22 * smoothstep(0.0, 3.0, yy);
          // streaks of soot under the sills on older fronts
          diffuseColor.rgb *= 1.0 - 0.08 * uSash[st] * step(0.5 - ww*0.5, fx) * step(fx, 0.5 + ww*0.5) * smoothstep(0.5 - wh*0.5, 0.0, fy) * step(gnd, yy);
          // ---- ground-floor shopfronts where OpenStreetMap has a shop, cafe, pub or bank: units between pilasters, a painted
          // fascia with its lettering under a cornice, a stallriser, a door and the display window, and behind the glass a lit
          // shop floor, a dark one, or a roller shutter still down at dawn
          if (shopK > 0.5 && yy < shopTop) {
            float kd = shopK - 1.0;
            float mpp = max(max(fwidth(u), fwidth(yy)), 1e-4);
            float sa = clamp(1.6 - mpp * 4.0, 0.0, 1.0);
            float nU = max(1.0, floor(wl / 5.6 + 0.4)), uw = wl / nU;
            float ui = floor(u / uw), fu = fract(u / uw) * uw;
            float uh = fh(vec2(ui + wl * 0.731, seed * 3.7 + 11.0)), uh2 = fh(vec2(uh * 7.3, ui + 3.1));
            vec3 wallC = diffuseColor.rgb;
            vec3 fas = fasC(kd, uh);
            float fasL = dot(fas, vec3(0.3, 0.59, 0.11));
            // open, lit units by kind (cafes are open at dawn, pubs mostly are not); the rest dark or shuttered
            float pOpen = kd < 0.5 ? 0.55 : kd < 1.5 ? 0.8 : kd < 2.5 ? 0.3 : kd < 3.5 ? 0.6 : 0.0;
            float pShut = kd < 0.5 ? 0.3 : kd < 1.5 ? 0.12 : kd < 2.5 ? 0.05 : kd < 3.5 ? 0.3 : 0.0;
            float open = step(uh2, pOpen), shut = (1.0 - open) * step(1.0 - pShut, uh2);
            vec3 sLit = kd > 0.5 && kd < 2.5 ? vec3(1.0, 0.66, 0.36) : mix(vec3(0.95, 0.9, 0.82), vec3(1.0, 0.78, 0.55), step(0.5, fh(vec2(uh, 4.0))));
            float fasB = shopTop - 0.95, corB = shopTop - 0.18;
            float pil = 1.0 - step(0.3, fu) * step(fu, uw - 0.3);
            float doorL = uh > 0.5 ? 0.5 : uw - 1.55;
            float door = step(doorL, fu) * step(fu, doorL + 1.05) * step(yy, 2.35);
            float glz = (1.0 - pil) * step(0.48, yy) * step(yy, fasB - 0.07);
            // glazing bars: a frame round each light, mullions every ~1.6 m, a transom under the fascia
            float nm = max(1.0, floor((uw - 0.6) / 1.6 + 0.5));
            float mq = fract((fu - 0.3) / ((uw - 0.6) / nm));
            float bar = max(max(step(abs(yy - (fasB - 0.62)), 0.035), 1.0 - step(0.012, mq) * step(mq, 0.988)), step(yy, 0.53) + step(fasB - 0.13, yy));
            vec3 pc = wallC;
            float pE = 0.0, pW = 0.0;
            vec3 pEc = vec3(0.0);
            // display window or door glass: interior, shutter, whitewash
            if (glz + door > 0.5) {
              vec3 Vd = normalize(vAtmoW - cameraPosition);
              vec3 Nw = normalize(vWN);
              vec3 Tw = vec3(-Nw.z, 0.0, Nw.x);
              float du = dot(Vd, Tw), dv = Vd.y, dn = max(-dot(Vd, Nw), 0.06);
              float rw = uw - 0.6, rh = fasB, rd = 6.0 + 3.0 * uh;
              float px = clamp(fu - 0.3, 0.0, rw), py = yy;
              float tx = du > 0.0 ? (rw - px) / max(du, 1e-4) : px / max(-du, 1e-4);
              float ty = dv > 0.0 ? (rh - py) / max(dv, 1e-4) : py / max(-dv, 1e-4);
              float tt = min(min(tx, ty), rd / dn);
              vec3 hp = vec3(px + du * tt, py + dv * tt, dn * tt);
              // shelves of stock on the walls, a counter, a pale floor, panel lights in the ceiling
              vec3 rc = vec3(0.4, 0.38, 0.35);
              if (tt == ty && dv > 0.0) rc = vec3(0.9) * (0.6 + 0.8 * step(0.7, fract(hp.x * 0.5)) * step(0.6, fract(hp.z * 0.4)));
              else if (tt == ty) rc = kd > 0.5 && kd < 2.5 ? vec3(0.22, 0.13, 0.07) : vec3(0.62, 0.6, 0.56);
              else {
                float sh = fract(hp.y / 0.42);
                float cell = fh(vec2(floor((hp.x + hp.z) / 0.22), floor(hp.y / 0.42) + uh * 13.0));
                vec3 stock = mix(vec3(0.42, 0.15, 0.08), vec3(0.08, 0.16, 0.34), cell) * step(0.12, fract((hp.x + hp.z) / 0.22));
                stock = mix(stock, vec3(0.62, 0.58, 0.46), step(0.72, cell));
                rc = mix(vec3(0.42, 0.4, 0.37), stock, step(0.15, sh) * step(hp.y, 2.2) * step(0.4, hp.y));
                if (kd > 0.5 && kd < 2.5) rc = mix(vec3(0.32, 0.2, 0.12), rc, 0.35);
              }
              rc *= mix(1.0, 0.35, clamp(hp.z / rd, 0.0, 1.0));
              pc = rc * 0.06;
              pEc = rc * open * sLit * 0.6;
              pW = 1.0;
              if (shut > 0.5) {
                float tag = step(0.82, fh(vec2(floor(fu * 0.8), floor(yy * 0.9) + uh * 5.0))) * step(yy, 2.0);
                pc = vec3(0.2, 0.21, 0.22) * (0.8 + 0.2 * sin(yy * 55.0)) ;
                pc = mix(pc, fasC(0.0, fh(vec2(fu, uh))) + 0.1, tag * 0.6);
                pEc = vec3(0.0); pW = 0.25;
              }
              if (kd > 3.5) { pc = vec3(0.45, 0.43, 0.38) * (0.85 + 0.3 * fh(vec2(floor(fu * 2.0), floor(yy * 2.0)))); pEc = vec3(0.0); pW = 0.2; }
              float bars = door > 0.5 ? max(1.0 - step(0.07, fu - doorL) * step(fu - doorL, 0.98), step(2.27, yy)) : bar;
              pc = mix(pc, fas * 0.9 + 0.01, bars);
              pEc *= 1.0 - bars;
              pW *= 1.0 - bars;
            } else if (yy > corB) {
              // moulded cornice over the fascia, catching the light, with its shadow line beneath
              pc = vec3(0.56, 0.53, 0.47) * (0.65 + 0.35 * step(corB + 0.07, yy));
            } else if (yy > fasB && pil < 0.5) {
              // the fascia and its sign-written name; some are lit
              float fm = (fasB + corB) * 0.5;
              float cl = fu / 0.24;
              float on = step(uw * 0.18, fu) * step(fu, uw * 0.82) * step(abs(yy - fm), 0.17) * step(0.28, fh(vec2(floor(cl), uh * 9.0)))
                       * step(0.14, fract(cl)) * step(fract(cl), 0.84);
              vec3 letC = kd > 1.5 && kd < 2.5 ? vec3(0.62, 0.42, 0.12) : fasL > 0.25 ? vec3(0.02) : vec3(0.78, 0.76, 0.7);
              pc = mix(fas, letC, on);
              pE = on * step(0.55, fh(vec2(uh, 8.0))) * (open > 0.5 || kd > 1.5 ? 1.0 : 0.0);
              pEc = letC * pE * 1.4;
              pW = 0.6;
            } else if (pil < 0.5) {
              // panelled stallriser under the window
              pc = fas * 0.75 + 0.01;
              pW = 0.6;
            } else if (yy > fasB) {
              // console bracket capping the pilaster
              pc = wallC * 0.8;
            }
            pc *= 0.8 + 0.2 * smoothstep(0.0, 1.0, yy);
            // far away the shopfront averages to its fascia, its glass and its light
            vec3 avgC = mix(wallC, mix(fas, vec3(0.04), 0.6), 0.8);
            vec3 avgE = (open * 0.7 * sLit * 0.2 + 0.06 * step(0.55, fh(vec2(uh, 8.0)))) * (1.0 - shut);
            diffuseColor.rgb = mix(avgC, pc, sa);
            fWin = mix(0.7, pW, sa);
            fGR = 0.05;
            fLit = 1.0; litC = vec3(1.0);
            roomE = mix(avgE, pEc, sa);
          }
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(uRoughS[stL], fGR, fWin);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fLit * litC * roomE * 2.6;');
  };
  return atmo(m);
}

function roofMaterial(T) {
  const t = T.roof;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.75, vertexColors: true, color: '#ffffff' });
  if (t) { m.map = t.map; if (t.nrm) m.normalMap = t.nrm; }
  const sc = t ? 1 / t.size : 1;
  m.userData.key = 'cityroof' + (t ? 't' : '');
  m.userData.patch = (shader) => {
    shader.uniforms.uTexSc = { value: sc };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aP; varying vec2 vTexUv; varying float vP; uniform float uTexSc;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTexUv = uv * uTexSc; vP = aP;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTexUv; varying float vP;\nfloat rh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 tx = texture2D(map, vTexUv);
          float tl = dot(tx.rgb, vec3(0.299, 0.587, 0.114));
          // pitched roofs show the slate texture; flat roofs are felt and gravel: just its grain
          diffuseColor.rgb *= mix(vec3(0.75 + tl * 0.5), tx.rgb * 1.5, vP);
        #endif
        diffuseColor.rgb *= 0.88 + 0.24 * rh(floor(vTexUv * 3.0));`)
      .replace('#include <normal_fragment_maps>', `
        #ifdef USE_NORMALMAP_TANGENTSPACE
          vec3 mapN = texture2D(normalMap, vTexUv).xyz * 2.0 - 1.0;
          mapN.xy *= 0.9 * vP + 0.25;
          normal = normalize(tbn * mapN);
        #endif`);
  };
  return atmo(m);
}

// ------------------------------------------------------------------ geometry
const NOB = [7, 0, 9, 0];
class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.b = []; this.w = []; this.ex = []; this.i = []; }
  v(x, y, z, nx, ny, nz, col, b, wu, wv, ex = 0) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b);
    const bb = b || NOB;
    this.b.push(bb[0], bb[1], bb[2], bb[3]);
    this.w.push(wu, wv); this.ex.push(ex);
    return this.p.length / 3 - 1;
  }
  geo(wall) {
    // compact attributes: ~42 bytes a vertex (byte normals and colours)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(Int8Array.from(this.n, (v) => Math.round(v * 127)), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(Uint8Array.from(this.c, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255)), 3, true));
    // uv carries metres along and up each wall (or across a roof): the facade layout and the texture scale both use it
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.w, 2));
    if (wall) g.setAttribute('aB', new THREE.Float32BufferAttribute(this.b, 4));
    else g.setAttribute('aP', new THREE.BufferAttribute(Uint8Array.from(this.ex, (v) => Math.round(v * 255)), 1, true));
    const n = this.p.length / 3;
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    this.p = this.n = this.c = this.b = this.w = this.ex = this.i = null;
    return g;
  }
}

const dec = (f) => { const o = []; for (let i = 0; i < f.length; i += 2) o.push([f[i] / 10, f[i + 1] / 10]); return o; };
const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const [x0, z0] = r[i], [x1, z1] = r[(i + 1) % r.length]; a += x0 * z1 - x1 * z0; } return a / 2; };

function walls(buf, ring, y0, y1, col, st, seed, shops = null, era = 0, fronts = null) {
  // one continuous u along the ring, but each wall gets its own bay layout (its length) so windows centre on it
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length];
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    if (L < 0.05) continue;
    const nx = dz / L, nz = -dx / L;
    const sk = shops && y0 < 0.7 ? shops.get(i) : undefined;
    const fk = fronts && y0 < 0.7 ? fronts.get(i) : undefined;
    const b = [(sk === undefined ? st : st + 16 * (sk + 1)) + 128 * era + (fk === undefined ? 0 : 1024 * (fk + 1)), seed, L, y1];
    const a = buf.v(x0, y0, z0, nx, 0, nz, col, b, 0, y0);
    const bb = buf.v(x1, y0, z1, nx, 0, nz, col, b, L, y0);
    const c = buf.v(x1, y1, z1, nx, 0, nz, col, b, L, y1);
    const d = buf.v(x0, y1, z0, nx, 0, nz, col, b, 0, y1);
    buf.i.push(a, d, bb, bb, d, c);
  }
}

function flatRoof(buf, outer, holes, y, col, pitched = 0) {
  const tri = THREE.ShapeUtils.triangulateShape(outer.map(([x, z]) => new THREE.Vector2(x, z)), holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z))));
  const all = outer.concat(...holes);
  const base = buf.p.length / 3;
  all.forEach(([x, z]) => buf.v(x, y, z, 0, 1, 0, col, null, x, z, pitched));
  tri.forEach(([a, b, c]) => {
    const [ax, az] = all[a], [bx, bz] = all[b], [cx, cz] = all[c];
    // keep the face pointing up
    const cr = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (cr < 0) buf.i.push(base + a, base + b, base + c);
    else buf.i.push(base + a, base + c, base + b);
  });
}

// oriented bounding rectangle of a ring: centre, long axis, half-lengths, and how well it fills the ring
function obb(r) {
  let best = null;
  for (let i = 0; i < r.length; i++) {
    const [x0, z0] = r[i], [x1, z1] = r[(i + 1) % r.length];
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (L < 0.5) continue;
    const ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    r.forEach(([x, z]) => { const a = x * ux + z * uz, b = -x * uz + z * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); });
    const ar = (a1 - a0) * (b1 - b0);
    if (!best || ar < best.ar) best = { ar, ux, uz, a0, a1, b0, b1 };
  }
  if (!best) return null;
  let { ux, uz, a0, a1, b0, b1 } = best;
  if (b1 - b0 > a1 - a0) { [ux, uz] = [-uz, ux]; [a0, a1, b0, b1] = [b0, b1, -a1, -a0]; }
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  return { cx: ca * ux - cb * uz, cz: ca * uz + cb * ux, ux, uz, hl: (a1 - a0) / 2, hw: (b1 - b0) / 2, fill: Math.abs(ringArea(r)) / best.ar };
}

// gabled (hip = 0) or hipped roof on a rectangle, eaves at y, ridge at y + rh, ridge along the long axis
function pitchedRoof(buf, wallBuf, o, y, rh, hip, col, wallCol, st, seed) {
  const { cx, cz, ux, uz, hl, hw } = o;
  const P = (a, b, yy) => [cx + a * ux - b * uz, yy, cz + a * uz + b * ux];
  const hr = hip ? Math.min(hl * 0.8, hw) : 0;
  const E = [P(-hl, -hw, y), P(hl, -hw, y), P(hl, hw, y), P(-hl, hw, y)];
  const R0 = P(-hl + hr, 0, y + rh), R1 = P(hl - hr, 0, y + rh);
  const tri = (a, b, c) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (n[1] < 0) { [b, c] = [c, b]; n = n.map((v) => -v); }
    const l = Math.hypot(...n) || 1;
    const i0 = buf.v(a[0], a[1], a[2], n[0] / l, n[1] / l, n[2] / l, col, null, a[0] * ux + a[2] * uz, (a[1] - y) * 1.6 + (-a[0] * uz + a[2] * ux), 1);
    const i1 = buf.v(b[0], b[1], b[2], n[0] / l, n[1] / l, n[2] / l, col, null, b[0] * ux + b[2] * uz, (b[1] - y) * 1.6 + (-b[0] * uz + b[2] * ux), 1);
    const i2 = buf.v(c[0], c[1], c[2], n[0] / l, n[1] / l, n[2] / l, col, null, c[0] * ux + c[2] * uz, (c[1] - y) * 1.6 + (-c[0] * uz + c[2] * ux), 1);
    buf.i.push(i0, i1, i2);
  };
  // the two long slopes
  tri(E[0], E[1], R1); tri(E[0], R1, R0);
  tri(E[2], E[3], R0); tri(E[2], R0, R1);
  if (hip) { tri(E[1], E[2], R1); tri(E[3], E[0], R0); }
  else {
    // gable ends are wall
    [[E[1], E[2], R1], [E[3], E[0], R0]].forEach(([a, b, c]) => {
      const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz);
      const nx = dz / L, nz = -dx / L;
      const bb = [st, seed, L, y + rh];
      const i0 = wallBuf.v(a[0], a[1], a[2], nx, 0, nz, wallCol, bb, 0, a[1]);
      const i1 = wallBuf.v(b[0], b[1], b[2], nx, 0, nz, wallCol, bb, L, b[1]);
      const i2 = wallBuf.v(c[0], c[1], c[2], nx, 0, nz, wallCol, bb, L / 2, c[1]);
      wallBuf.i.push(i0, i2, i1);
    });
  }
}

function domeRoof(buf, o, y, rh, col) {
  const rad = Math.max(o.hl, o.hw), seg = 28, rings = 8;
  const base = buf.p.length / 3;
  for (let j = 0; j <= rings; j++) {
    const t = (j / rings) * Math.PI / 2;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const sx = Math.cos(a) * Math.cos(t), sz = Math.sin(a) * Math.cos(t), sy = Math.sin(t);
      const x = o.cx + (sx * o.hl * o.ux - sz * o.hw * o.uz), z = o.cz + (sx * o.hl * o.uz + sz * o.hw * o.ux);
      buf.v(x, y + sy * rh, z, sx, sy, sz, col, null, a * rad, t * rad, 0.4);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = base + j * (seg + 1) + i, b = a + seg + 1;
    buf.i.push(a, b, a + 1, a + 1, b, b + 1);
  }
}

const hexCol = (h, fb) => new THREE.Color(h || fb);

// facade periods (bake_city.py): 0 as classified, 1 Georgian and Regency, 2 Victorian, 3 inter-war Portland stone, 4 post-war concrete
// the doors of a front: one bay in each house, three bays to a Georgian house and two to a Victorian one, houses mirrored in
// pairs (the facade shader lays them out the same way)
function frontBays(L, st, era) {
  const bay = STYLES[st].bay, nb = Math.max(1, Math.floor(L / bay + 0.25)), per = era === 1 ? 3 : 2;
  const out = [];
  for (let b = 0; b < nb; b++) {
    const j = Math.floor(b / per), k = b - j * per;
    out.push(k === (j % 2 === 0 ? 0 : per - 1) ? 'door' : (k === (j % 2 === 0 ? 1 : 0) ? 'bay' : ''));
  }
  return { bw: L / nb, kinds: out };
}

// black area railings: one quad per run, the bars, rails and spear heads cut out in the shader
function railMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#0b0c0d', roughness: 0.42, metalness: 0.55, side: THREE.DoubleSide, transparent: true });
  m.userData.key = 'city-rail';
  m.userData.patch = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRw;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRw = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRw;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float u = vRw.x, y = vRw.y, sp = 0.125;
          float d = abs(fract(u / sp) - 0.5) * sp;
          float px = max(fwidth(u), fwidth(y));
          // square bars with spear heads above the top rail, a bottom rail near the kerb; never thinner than a pixel
          float head = smoothstep(0.93, 0.985, y) * (1.0 - smoothstep(0.985, 1.06, y));
          float hw = 0.0095 + 0.02 * head;
          float bar = 1.0 - smoothstep(hw - px * 0.5, hw + px * 0.5, d);
          float rails = max(1.0 - smoothstep(0.02 - px * 0.5, 0.02 + px * 0.5, abs(y - 0.9)), 1.0 - smoothstep(0.018 - px * 0.5, 0.018 + px * 0.5, abs(y - 0.1)));
          float cov = max(bar, rails);
          // further off the bars blur into the railing's average cover, then fade out
          float far = smoothstep(0.015, 0.05, px);
          cov = mix(cov, 0.3, far) * (1.0 - smoothstep(0.12, 0.3, px));
          if (cov < 0.02) discard;
          diffuseColor.a *= cov;
        }`);
  };
  return atmo(m);
}

// ------------------------------------------------------------------ the city
// opts: { mobile, H, site, keep(x, z): false where trees and lamps must not go, skip(x, z): true for buildings a hand-built
// landmark replaces, paint(ctx, toPx, k): draws hand-built ground (a campus) over the map }
export function buildCity(city, { mobile, H, site, keep = () => true, skip = () => false, paint = null }) {
  const { data, tex } = city;
  const group = new THREE.Group();
  const r = rng(site === 'ucl' ? 2024 : 2025);
  // geometry is split into 400 m tiles so the camera and the sun's shadow pass only draw the tiles they can see,
  // and only tiles near the campus cast shadows at all
  const TILE = 400, CAST_R = 850;
  const tileOf = (x, z) => Math.floor((x + H) / TILE) * 1000 + Math.floor((z + H) / TILE);
  const tileC = (k) => [Math.floor(k / 1000) * TILE - H + TILE / 2, (k % 1000) * TILE - H + TILE / 2];
  const tiles = new Map();
  const tile = (x, z) => {
    const k = tileOf(x, z);
    if (!tiles.has(k)) tiles.set(k, { walls: new Buf(), roofs: new Buf() });
    return tiles.get(k);
  };
  const chim = [];
  const R = mobile ? 1050 : H;
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion();
  const SLATE = ['#4c525a', '#575b61', '#41464d', '#5d6064', '#50555c'];
  const FLAT = ['#6f6e6b', '#7c7a75', '#615f5c', '#86837c', '#5a5a58'];
  const footprints = [];
  // ground-floor shopfronts: building index -> (wall index -> kind), from mapped shops, cafes, pubs and banks
  const shopAt = new Map();
  const SF = data.sf || [];
  for (let i = 0; i + 2 < SF.length; i += 3) {
    if (!shopAt.has(SF[i])) shopAt.set(SF[i], new Map());
    shopAt.get(SF[i]).set(SF[i + 1], SF[i + 2]);
  }
  const shopGlow = [];
  // facade periods and the street fronts of the period terraces (doors, railings, bay windows)
  const ERA = data.e || '';
  const frontAt = new Map();
  const EF = data.ef || [];
  for (let i = 0; i + 2 < EF.length; i += 3) {
    if (!frontAt.has(EF[i])) frontAt.set(EF[i], new Map());
    frontAt.get(EF[i]).set(EF[i + 1], EF[i + 2]);
  }
  const rail = { p: [], n: [], w: [], i: [] };
  const areaPaint = [];
  const LEAD = new THREE.Color('#5a5f64');
  const DRESS_R = mobile ? 500 : 1100;
  let nBays = 0;
  data.b.forEach((rec, bi) => {
    const [st, h, minh, rs, rhIn, colH, rcolH, of, ...hf] = rec;
    const outer = dec(of);
    const holes = hf.map(dec);
    let cx = 0, cz = 0; outer.forEach(([x, z]) => { cx += x; cz += z; }); cx /= outer.length; cz /= outer.length;
    if (Math.hypot(cx, cz) > R * 1.02 || skip(cx, cz)) return;
    footprints.push(outer);
    const S = STYLES[st] || STYLES[0];
    const seed = ((Math.abs(of[0] * 31 + of[1] * 17) % 9973) / 9973);
    const col = hexCol(colH, S.tint[Math.floor(seed * S.tint.length) % S.tint.length]);
    const T0 = tile(cx, cz);
    const b = T0.walls, roofs = T0.roofs;
    const a = Math.abs(ringArea(outer));
    let rs2 = rs, rh = rhIn;
    const o = (rs2 || ['stock', 'stucco', 'redbrick'].includes(S.k)) ? obb(outer) : null;
    // London terraces: low pitched roofs on individually mapped houses, ridge front to back
    if (!rs2 && o && o.fill > 0.86 && a < 420 && h < 26 && ['stock', 'stucco', 'redbrick'].includes(S.k)) { rs2 = seed < 0.7 ? 1 : 2; rh = 1.8 + seed * 1.4; }
    if (rs2 === 3) rs2 = 2;
    const pitched = rs2 && o && o.fill > 0.8 && rh > 0.5;
    const eave = pitched ? h - (rs2 === 4 ? rh : rh) : h;
    const shops = shopAt.get(bi) || null;
    const era = +ERA[bi] || 0;
    const fronts = frontAt.get(bi) || null;
    walls(b, outer, minh, eave, col, st, seed, shops, era, fronts);
    if (fronts && minh < 0.7 && Math.hypot(cx, cz) < DRESS_R) {
      fronts.forEach((kd, ei) => {
        const [x0, z0] = outer[ei], [x1, z1] = outer[(ei + 1) % outer.length];
        const L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 4.5) return;
        const ux = (x1 - x0) / L, uz = (z1 - z0) / L, nx = uz, nz = -ux;
        const at = (u, o) => [x0 + ux * u + nx * o, z0 + uz * u + nz * o];
        const { bw, kinds } = frontBays(L, st, era);
        if (kd === 0) {
          // the area in front of the basement, behind black railings, with a gap at each front door
          const runs = [];
          let u0 = 0;
          kinds.forEach((k, j) => { if (k === 'door' && L >= 5) { runs.push([u0, (j + 0.5) * bw - 0.85]); u0 = (j + 0.5) * bw + 0.85; } });
          runs.push([u0, L]);
          const off = 1.3;
          runs.forEach(([a, c]) => {
            if (c - a < 0.6) return;
            const [ax, az] = at(a, off), [cx2, cz2] = at(c, off);
            const base = rail.p.length / 3;
            [[ax, 0, az, a, 0], [cx2, 0, cz2, c, 0], [cx2, 1.06, cz2, c, 1.06], [ax, 1.06, az, a, 1.06]].forEach(([x, y, z, wu, wv]) => {
              rail.p.push(x, y, z); rail.n.push(nx, 0, nz); rail.w.push(wu, wv);
            });
            rail.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
          });
          areaPaint.push([at(0, 0), at(L, 0), at(L, off - 0.05), at(0, off - 0.05)]);
        } else if (kd === 1) {
          // canted bay windows, ground and first floor where the house is tall enough, under a flat lead roof
          const S0 = STYLES[st];
          const yb = Math.min(eave - 0.4, eave >= S0.floor * 3 ? S0.floor * 2 + 0.6 : S0.floor + 0.5);
          if (yb < 2.5) return;
          kinds.forEach((k, j) => {
            if (k !== 'bay') return;
            const uc = (j + 0.5) * bw, W = Math.min(bw * 0.92, 2.7), pr = 0.62, F = Math.max(0.8, W - 2 * pr * 0.75);
            const P = [at(uc - W / 2, 0), at(uc - F / 2, pr), at(uc + F / 2, pr), at(uc + W / 2, 0)];
            for (let q = 0; q < 3; q++) {
              const [ax, az] = P[q], [bx2, bz2] = P[q + 1];
              const fl = Math.hypot(bx2 - ax, bz2 - az);
              const fnx = (bz2 - az) / fl, fnz = -(bx2 - ax) / fl;
              const bb = [st + 128 * era + 1024 * 4, seed, fl, yb];
              const i0 = b.v(ax, minh, az, fnx, 0, fnz, col, bb, 0, minh), i1 = b.v(bx2, minh, bz2, fnx, 0, fnz, col, bb, fl, minh);
              const i2 = b.v(bx2, yb, bz2, fnx, 0, fnz, col, bb, fl, yb), i3 = b.v(ax, yb, az, fnx, 0, fnz, col, bb, 0, yb);
              b.i.push(i0, i3, i1, i1, i3, i2);
            }
            const r0 = roofs.p.length / 3;
            P.forEach(([x, z]) => roofs.v(x, yb, z, 0, 1, 0, LEAD, null, x, z, 0));
            roofs.i.push(r0, r0 + 2, r0 + 1, r0, r0 + 3, r0 + 2);
            nBays++;
          });
        }
      });
    }
    if (shops && minh < 0.7) {
      // light from the open shops spills onto the pavement in front
      shops.forEach((kd, ei) => {
        if (kd === 4) return;
        const [x0, z0] = outer[ei], [x1, z1] = outer[(ei + 1) % outer.length];
        const L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 2) return;
        const nx = (z1 - z0) / L, nz = -(x1 - x0) / L, n = Math.max(1, Math.floor(L / 5.6 + 0.4));
        for (let j = 0; j < n; j++) {
          const t = (j + 0.5) / n;
          shopGlow.push([x0 + (x1 - x0) * t + nx * 2.2, z0 + (z1 - z0) * t + nz * 2.2, kd === 1 || kd === 2]);
        }
      });
    }
    holes.forEach((hr) => walls(b, hr, minh, eave, col, st, seed));
    const rc = hexCol(rcolH, (pitched ? SLATE : FLAT)[Math.floor(seed * 97) % 5]);
    if (pitched && rs2 === 4) domeRoof(roofs, o, eave, rh, rc);
    else if (pitched) pitchedRoof(roofs, b, o, eave, rh, rs2 === 2, rc, col, st, seed);
    else {
      try { flatRoof(roofs, outer, holes, eave, rc, 0); } catch { /* degenerate ring */ }
      // rooftop plant and lift overruns on larger flat roofs
      if (a > 500 && !mobile && seed < 0.7) {
        const oo = obb(outer);
        if (oo && oo.fill > 0.7) {
          const n = 1 + Math.floor(seed * 3);
          for (let i = 0; i < n; i++) {
            const t = (r() - 0.5) * oo.hl, s = (r() - 0.5) * oo.hw;
            m4.compose(new THREE.Vector3(oo.cx + t * oo.ux - s * oo.uz, eave, oo.cz + t * oo.uz + s * oo.ux), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-oo.uz, oo.ux)), new THREE.Vector3(3 + r() * 5, 1.6 + r() * 2.2, 3 + r() * 4));
            chim.push([m4.clone(), new THREE.Color(FLAT[Math.floor(r() * 5)]).multiplyScalar(1.15)]);
          }
        }
      }
    }
    // chimney stacks on the party walls of terrace houses
    if (pitched && rs2 !== 4 && ['stock', 'stucco', 'redbrick'].includes(S.k) && seed < 0.85) {
      [-1, 1].forEach((sg) => {
        if (r() < 0.35) return;
        const t = (r() - 0.5) * o.hl * 0.6, s = sg * (o.hw - 0.3);
        m4.compose(new THREE.Vector3(o.cx + t * o.ux - s * o.uz, eave, o.cz + t * o.uz + s * o.ux), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-o.uz, o.ux)), new THREE.Vector3(1.6 + r() * 1.8, rh + 1.1 + r() * 0.6, 0.7));
        chim.push([m4.clone(), (S.k === 'stucco' ? col.clone() : new THREE.Color(STYLES[st === 1 ? 0 : st].tint[Math.floor(r() * 4)])).multiplyScalar(0.92)]);
      });
    }
  });
  // one wall material (all four families) and so one wall draw per tile
  const wallMat = facade(tex);
  const roofMat = roofMaterial(tex);
  const near = (k) => { const [x, z] = tileC(k); return Math.hypot(x, z) < CAST_R; };
  tiles.forEach((T1, k) => {
    const cast = near(k);
    if (T1.walls.i.length) {
      const m = new THREE.Mesh(T1.walls.geo(true), wallMat);
      m.castShadow = cast; m.receiveShadow = true;
      group.add(m);
    }
    if (T1.roofs.i.length) {
      const m = new THREE.Mesh(T1.roofs.geo(false), roofMat);
      m.castShadow = cast; m.receiveShadow = true;
      group.add(m);
    }
  });
  // instanced pieces (trees, chimneys) are tiled the same way
  // farGeo: a lighter shape drawn instead once the camera is more than farAt metres from the tile (a THREE.LOD per tile)
  const inst = (geo, mat, list, cast = true, farGeo = null, farAt = 650) => {
    if (!list.length) return null;
    const by = new Map();
    const pos = new THREE.Vector3();
    list.forEach((it) => { pos.setFromMatrixPosition(it[0]); const k = tileOf(pos.x, pos.z); if (!by.has(k)) by.set(k, []); by.get(k).push(it); });
    by.forEach((items, k) => {
      const [tx, tz] = tileC(k);
      const mk = (g, off) => {
        const im = new THREE.InstancedMesh(g, mat, items.length);
        items.forEach(([mm, c], i) => { im.setMatrixAt(i, mm); if (c) im.setColorAt(i, c); });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        if (off) im.position.set(-tx, 0, -tz);
        im.computeBoundingSphere();
        im.castShadow = cast && near(k); im.receiveShadow = true;
        return im;
      };
      if (!farGeo) { group.add(mk(geo, false)); return; }
      const lod = new THREE.LOD();
      lod.position.set(tx, 0, tz);
      lod.addLevel(mk(geo, true), 0);
      lod.addLevel(mk(farGeo, true), farAt);
      group.add(lod);
    });
    return true;
  };
  if (rail.i.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(rail.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(rail.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(rail.w, 2));
    g.setIndex(rail.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(rail.i, 1) : new THREE.Uint16BufferAttribute(rail.i, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, railMaterial());
    m.receiveShadow = true;
    group.add(m);
  }
  group.userData.dress = { bays: nBays, railVerts: rail.p.length / 3 };
  const bx = baseBox();
  // chimneys and rooftop plant are centred boxes rotated to the building
  inst(bx, plainMaterial({ roughness: 0.92 }, 'city-chim'), chim);

  // ---------------------------------------------------------------- ground: the real street plan
  const S = mobile ? 2048 : 4096;
  const k = S / (2 * H);
  const toPx = (x, z) => [(x + H) * k, (z + H) * k];
  const poly = (ctx, rings) => { ctx.beginPath(); rings.forEach((rr) => rr.forEach(([x, z], i) => { const [a, b] = toPx(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); })); ctx.closePath(); };
  const line = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = toPx(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); };
  const roads = data.r.map(([cls, w, br, f]) => ({ cls, w, br, pts: dec(f) }));
  const areas = data.a.map(([kind, of, ...hf]) => ({ kind, rings: [dec(of), ...hf.map(dec)] }));
  const AC = ['#2c3f46', '#6f8c47', '#5f8a45', '#3f5a2c', '#3e4043', '#6d665c', '#b3ac9e'];
  const mapTex = canvasTex(S, S, (ctx) => {
    // blocks between the streets: London's mix of yards, back gardens and paving
    ctx.fillStyle = '#7d7868';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < (mobile ? 6000 : 22000); i++) {
      ctx.fillStyle = r() < 0.55 ? `rgba(${70 + r() * 30},${88 + r() * 30},${50 + r() * 20},.35)` : `rgba(${120 + r() * 40},${115 + r() * 35},${100 + r() * 30},.3)`;
      ctx.fillRect(r() * S, r() * S, (2 + r() * 8) * k, (2 + r() * 8) * k);
    }
    // areas: green spaces with mown stripes and grain, water, car parks, plazas
    [1, 2, 3, 5, 4, 6, 0].forEach((kind) => areas.filter((a) => a.kind === kind).forEach((a) => {
      ctx.fillStyle = AC[kind];
      poly(ctx, a.rings);
      ctx.fill('evenodd');
      if (kind === 1 || kind === 2) {
        ctx.save(); poly(ctx, a.rings); ctx.clip('evenodd');
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        a.rings[0].forEach(([x, z]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); });
        const n = Math.min(4000, ((x1 - x0) * (z1 - z0)) / 30);
        for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${45 + r() * 50},${75 + r() * 55},${25 + r() * 25},.3)`; const [px, pz] = toPx(x0 + r() * (x1 - x0), z0 + r() * (z1 - z0)); ctx.fillRect(px, pz, (3 + r() * 6) * k, (3 + r() * 6) * k); }
        if (kind === 2) { ctx.strokeStyle = 'rgba(240,240,235,.55)'; ctx.lineWidth = Math.max(1, 0.12 * k); poly(ctx, a.rings); ctx.stroke(); }
        ctx.restore();
      }
    }));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // pavements under the carriageways, then footpaths, then the roads by class (minor first)
    roads.filter((rd) => rd.cls <= 3).forEach((rd) => { ctx.strokeStyle = '#aaa395'; ctx.lineWidth = (rd.w + (rd.cls <= 2 ? 6 : 2)) * k; line(ctx, rd.pts); ctx.stroke(); });
    roads.filter((rd) => rd.cls === 5).forEach((rd) => { ctx.strokeStyle = '#b9b2a2'; ctx.lineWidth = Math.max(1, rd.w * k); line(ctx, rd.pts); ctx.stroke(); });
    roads.filter((rd) => rd.cls === 4).forEach((rd) => { ctx.strokeStyle = '#b5ae9e'; ctx.lineWidth = rd.w * k; line(ctx, rd.pts); ctx.stroke(); });
    [3, 2, 1, 0].forEach((cls) => roads.filter((rd) => rd.cls === cls).forEach((rd) => { ctx.strokeStyle = cls === 3 ? '#57585a' : '#47494c'; ctx.lineWidth = rd.w * k; line(ctx, rd.pts); ctx.stroke(); }));
    // lane markings: dashed centre lines, solid edge lines on the main roads
    ctx.strokeStyle = 'rgba(232,229,218,.8)';
    roads.filter((rd) => rd.cls <= 1).forEach((rd) => {
      ctx.lineWidth = Math.max(1, 0.15 * k); ctx.setLineDash([4.5 * k, 4.5 * k]); line(ctx, rd.pts); ctx.stroke();
    });
    ctx.setLineDash([]);
    // railways
    (data.rl || []).forEach((f) => { const pts = dec(f); ctx.strokeStyle = '#5b5248'; ctx.lineWidth = 5 * k; line(ctx, pts); ctx.stroke(); ctx.strokeStyle = 'rgba(160,160,165,.6)'; ctx.lineWidth = Math.max(1, 0.4 * k); line(ctx, pts); ctx.stroke(); });
    // contact shadow under every building
    ctx.fillStyle = 'rgba(30,28,25,.5)';
    footprints.forEach((f) => { poly(ctx, [f]); ctx.fill(); });
    // the basement areas behind the railings
    ctx.fillStyle = 'rgba(22,21,19,.8)';
    areaPaint.forEach((q) => { poly(ctx, [q]); ctx.fill(); });
    if (paint) paint(ctx, toPx, k);
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
    const lamp = (x, z, rad, a, colr) => {
      const px = (x + H) * ek, pz = (z + H) * ek, rr = Math.max(1.5, rad * ek);
      const g = ctx.createRadialGradient(px, pz, 0, px, pz, rr);
      g.addColorStop(0, `rgba(${colr},${a})`); g.addColorStop(0.25, `rgba(${colr},${a * 0.35})`); g.addColorStop(1, `rgba(${colr},0)`);
      ctx.fillStyle = g; ctx.fillRect(px - rr, pz - rr, rr * 2, rr * 2);
    };
    const warm = '255,214,168', led = '235,240,255';
    // shop windows (about half are open at dawn)
    shopGlow.forEach(([x, z, food]) => { if (keep(x, z) && r() < (food ? 0.75 : 0.5)) lamp(x, z, 4.5, food ? 0.4 : 0.32, food ? '255,190,130' : '255,226,190'); });
    roads.forEach((rd) => {
      if (rd.cls > 4) return;
      const major = rd.cls <= 1, step = major ? 24 : rd.cls === 4 ? 20 : 30;
      let acc = r() * step, side = 1;
      for (let i = 0; i < rd.pts.length - 1; i++) {
        const [x0, z0] = rd.pts[i], [x1, z1] = rd.pts[i + 1];
        const L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 0.01) continue;
        const nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
        while (acc < L) {
          const t = acc / L, off = (rd.w / 2 + 1.5) * side;
          const x = x0 + (x1 - x0) * t + nx * off, z = z0 + (z1 - z0) * t + nz * off;
          if (keep(x, z)) lamp(x, z, major ? 10 : 7, major ? 0.55 : 0.42, major ? led : warm);
          side = -side; acc += step / 2;
        }
        acc -= L;
      }
    });
  });
  emTex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), plainMaterial({ map: mapTex, roughness: 0.95, emissiveMap: emTex, emissive: '#ffffff', emissiveIntensity: 1.1 }, 'city-ground-' + site));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  // water surfaces as real reflective geometry just above the map
  const waterMat = plainMaterial({ color: '#25343b', roughness: 0.06, metalness: 0.05 }, 'city-water');
  areas.filter((a) => a.kind === 0).forEach((a) => {
    if (Math.abs(ringArea(a.rings[0])) < 60) return;
    try {
      const shp = new THREE.Shape(a.rings[0].map(([x, z]) => new THREE.Vector2(x, -z)));
      a.rings.slice(1).forEach((h) => shp.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shp), waterMat);
      m.rotation.x = -Math.PI / 2; m.position.y = 0.3; m.receiveShadow = true;
      group.add(m);
    } catch { /* skip */ }
  });

  // ---------------------------------------------------------------- traffic on the main roads
  const trafficU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } };
  {
    const P = [], UV = [], I = [];
    let off = 0;
    roads.filter((rd) => rd.cls <= 1 && !rd.br).forEach((rd) => {
      off += 977.3;
      let s = off;
      for (let i = 0; i < rd.pts.length; i++) {
        const [x, z] = rd.pts[i];
        const [xa, za] = rd.pts[Math.max(0, i - 1)], [xb, zb] = rd.pts[Math.min(rd.pts.length - 1, i + 1)];
        const L = Math.hypot(xb - xa, zb - za) || 1;
        const nx = -(zb - za) / L, nz = (xb - xa) / L, hw = rd.w * 0.4;
        if (i) s += Math.hypot(x - rd.pts[i - 1][0], z - rd.pts[i - 1][1]);
        const v = P.length / 3;
        P.push(x - nx * hw, 0.35, z - nz * hw, x + nx * hw, 0.35, z + nz * hw);
        UV.push(s, 0, s, 1);
        if (i) I.push(v - 2, v, v - 1, v - 1, v, v + 1);
      }
    });
    if (I.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      g.setIndex(I);
      const TV = 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
      const TF = `uniform float uTime; uniform vec3 uCam; varying vec2 vUv; varying vec3 vW;
        float th(float n){ return fract(sin(n) * 43758.5453); }
        void main(){
          float L = vUv.x, a = vUv.y;
          float l1 = exp(-pow((a - 0.3) / 0.07, 2.0)), l2 = exp(-pow((a - 0.7) / 0.07, 2.0));
          float s1 = L * 0.032 - uTime * 0.5, s2 = L * 0.032 + uTime * 0.46;
          float d1 = exp(-pow((fract(s1) - 0.5) * 26.0, 2.0)) * step(0.5, th(floor(s1)));
          float d2 = exp(-pow((fract(s2) - 0.5) * 26.0, 2.0)) * step(0.5, th(floor(s2) * 1.3));
          vec3 c = vec3(1.7, 1.55, 1.35) * d1 * l1 * 3.0 + vec3(1.9, 0.12, 0.06) * d2 * l2 * 2.4;
          c *= smoothstep(7000.0, 1200.0, length(vW - uCam));
          gl_FragColor = vec4(c, 1.0);
        }`;
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: TV, fragmentShader: TF, uniforms: trafficU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.frustumCulled = false;
      group.add(m);
    }
  }

  // ---------------------------------------------------------------- trees: mapped street trees, then the parks and squares
  const trees = [];
  const maxTrees = mobile ? 1400 : 5200;
  const T = data.t || [];
  for (let i = 0; i < T.length && trees.length < maxTrees * 0.6; i += 3) {
    const x = T[i] / 10, z = T[i + 1] / 10;
    if (Math.hypot(x, z) > R || !keep(x, z)) continue;
    const h = T[i + 2] ? T[i + 2] / 10 : 11 + r() * 9;
    trees.push([x, z, Math.max(6, h), (h * 0.32) * (0.8 + r() * 0.4)]);
  }
  const pip = (x, z, ring) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) ins = !ins; } return ins; };
  const edgeD = (x, z, ring) => { let d = Infinity; for (let i = 0; i < ring.length; i++) { const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length]; const dx = x1 - x0, dz = z1 - z0; const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(x - x0 - dx * t, z - z0 - dz * t)); } return d; };
  areas.filter((a) => a.kind === 1 || a.kind === 3).sort((a, b) => Math.abs(ringArea(a.rings[0])) - Math.abs(ringArea(b.rings[0]))).forEach((a) => {
    const ring = a.rings[0];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    ring.forEach(([x, z]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); });
    const big = (x1 - x0) * (z1 - z0) > 120000;
    const step = big ? 14 : 9;
    for (let x = x0 + 3; x < x1; x += step) for (let z = z0 + 3; z < z1; z += step) {
      if (trees.length >= maxTrees) return;
      const px = x + (r() - 0.5) * step * 0.8, pz = z + (r() - 0.5) * step * 0.8;
      if (Math.hypot(px, pz) > R || !keep(px, pz) || !pip(px, pz, ring)) continue;
      const e = edgeD(px, pz, ring);
      const pr = a.kind === 3 ? 0.8 : e < 10 ? 0.8 : big ? 0.07 : 0.3;
      if (r() < pr) trees.push([px, pz, 13 + r() * 10, 4.6 + r() * 3.2]);
    }
  });
  const leafCols = ['#4f6b35', '#5d7a3c', '#46602f', '#6b7f43', '#55703a', '#7a8a48', '#8a7f3c'];
  const canopy = [], trunk = [];
  trees.forEach(([x, z, h, cr]) => {
    const lobes = 5 + Math.floor(r() * 3);
    for (let i = 0; i < lobes; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * cr * 0.62;
      const s = cr * (0.42 + r() * 0.2);
      m4.compose(new THREE.Vector3(x + Math.cos(a) * rad, h - cr * 0.6 + (r() - 0.35) * cr * 0.75, z + Math.sin(a) * rad), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(s, s, s));
      canopy.push([m4.clone(), new THREE.Color(leafCols[Math.floor(r() * leafCols.length)]).multiplyScalar(0.85 + r() * 0.3)]);
    }
    m4.compose(new THREE.Vector3(x, 0, z), q0, new THREE.Vector3(0.45, h - cr * 0.8, 0.45));
    trunk.push([m4.clone(), new THREE.Color('#5a5047')]);
  });
  const bx2 = baseBox();
  // canopies: 80-triangle lobes near the camera, 20-triangle lobes beyond 650 m (a few pixels across from there)
  inst(treeGeometry(5, 1), leafMaterial('city-leaf'), canopy, true, treeGeometry(5, 0));
  inst(bx2, plainMaterial({ roughness: 0.9 }, 'city-trunk'), trunk, false);

  // ---------------------------------------------------------------- the real skyline beyond the map
  const sky = data.sky || [];
  if (sky.length) {
    const sb = new Buf();
    sky.forEach(([h, minh, colH, f]) => {
      const ring = dec(f);
      const seed = ((Math.abs(f[0] * 13 + f[1] * 7) % 997) / 997);
      const st = h > 60 || seed < 0.5 ? 3 : 5;
      const col = hexCol(colH, STYLES[st].tint[Math.floor(seed * 4)]);
      walls(sb, ring, minh, h, col, st, seed);
      try { flatRoof(sb, ring, [], h, col.clone().multiplyScalar(0.6), 0); } catch { /* skip */ }
    });
    const m = new THREE.Mesh(sb.geo(true), wallMat);
    group.add(m);
  }
  const top = sky.filter((s) => s[0] > 100).map(([h, , , f]) => { const ring = dec(f); let x = 0, z = 0; ring.forEach((p) => { x += p[0]; z += p[1]; }); return [x / ring.length, h, z / ring.length]; });

  return { group, mapTex, emTex, trafficU, landmarks: data.landmarks || {}, tallTops: top, river: (data.river || []).map(dec) };
}
