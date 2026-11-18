// The Thames bridges, from the mapped bridge outlines (OpenStreetMap, baked by tools/city/bake_city.py as `bg`):
// each one is a deck along its outline's long axis, ramped down to the banks, carried over the water on piers.
// Styles: 0 masonry or concrete arches with solid spandrels (Waterloo), 1 painted iron arches with open spandrels on
// granite piers (Westminster green, Vauxhall and Lambeth red), 2 beams or girders on piers (London Bridge, the
// railway bridges, the footbridges), 3 suspension bridges with towers and chains (Chelsea, Albert), 4 Tower Bridge.
// Beyond 2.2 km from the campus a bridge drops its small parts (footways, inner parapets, lamp posts, hangers).
// All of them are one mesh with vertex colours, and their lamps a second one, so the bridges cost two draw calls.
import * as THREE from 'three';
import { plainMaterial } from './materials';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildBridges(list, { mobile = false } = {}) {
  const P = [], N = [], C = [], I = [];
  const LP = [], LI = [];
  const tmp = new THREE.Color();
  const push = (p, n, c) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); C.push(c.r, c.g, c.b); return P.length / 3 - 1; };
  // a quad a-b-c-d facing roughly along `want` (the winding is fixed to match the normal)
  const quad = (a, b, c, d, col, want) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    if (want && nx * want[0] + ny * want[1] + nz * want[2] < 0) { [b, d] = [d, b]; nx = -nx; ny = -ny; nz = -nz; }
    const n = [nx, ny, nz];
    const i0 = push(a, n, col), i1 = push(b, n, col), i2 = push(c, n, col), i3 = push(d, n, col);
    I.push(i0, i1, i2, i0, i2, i3);
  };
  const lampQuad = (x, y, z, s) => {
    const o = LP.length / 3;
    LP.push(x - s, y - s, z, x + s, y - s, z, x + s, y + s, z, x - s, y + s, z, x, y - s, z - s, x, y - s, z + s, x, y + s, z + s, x, y + s, z - s);
    LI.push(o, o + 1, o + 2, o, o + 2, o + 3, o + 4, o + 5, o + 6, o + 4, o + 6, o + 7);
  };
  const UP = [0, 1, 0], DOWN = [0, -1, 0];
  const asphalt = new THREE.Color('#3d3f42'), footway = new THREE.Color('#a6a194'), granite = new THREE.Color('#8f8a80'), dark = new THREE.Color('#2a2b2c');
  const ballast = new THREE.Color('#4b4640'), post = new THREE.Color('#202224');

  list.forEach(([style, spans, paintH, cxd, czd, angm, Ld, Wd, w0d, w1d, hdd]) => {
    const cx = cxd / 10, cz = czd / 10, a = angm / 1000, L = Ld / 10, W = Wd / 10, w0 = w0d / 10, w1 = w1d / 10, Hd = hdd / 10;
    const ca = Math.cos(a), sa = Math.sin(a);
    // the bridge's frame: s along the deck from its start, v across it, y up
    const at = (s, v, y) => [cx + (s - L / 2) * ca - v * sa, y, cz + (s - L / 2) * sa + v * ca];
    const across = [-sa, 0, ca], back = [sa, 0, -ca];
    const paint = new THREE.Color(paintH);
    // beyond 2.2 km of the campus a bridge is a few pixels tall: no footways, inner parapets, posts or hangers
    const far = Math.hypot(cx, cz) > 2200;
    const foot = W < 8; // a footbridge: one walkway, no carriageway
    const rail = style === 2 && Hd >= 7.9 && !foot;
    const fw = foot || far ? 0 : W > 14 ? 3.4 : 1.8;
    const fd = style === 0 ? 1.4 : style === 1 ? 1.1 : style === 3 ? 1.2 : foot ? 0.7 : rail ? 2.6 : 1.7;
    const par = foot ? 1.2 : style === 2 && rail ? 1.4 : 1.1;
    const wl = Math.max(10, w1 - w0);
    // the deck: ramps down to the banks, a camber over the water
    const r0 = Math.max(w0, 14), r1 = Math.max(L - w1, 14);
    const camber = style <= 1 ? 0.9 : 0.35;
    const yd = (s) => 0.5 + (Hd - 0.5) * sm(0, r0, s) * sm(L, L - r1, s) + camber * Math.sin(Math.PI * Math.min(1, Math.max(0, (s - w0) / wl)));
    // piers: evenly over the water (suspension: the two towers at a quarter and three quarters)
    const piers = [];
    if (style === 3) piers.push(w0 + wl * 0.25, w0 + wl * 0.75);
    else if (style === 4) piers.push(w0 + wl * 0.315, w0 + wl * 0.685);
    else for (let i = 1; i < spans; i++) piers.push(w0 + (wl * i) / spans);
    const span = wl / Math.max(1, spans);
    const tp = style === 2 ? (foot ? 1.6 : 3.2) : style === 3 ? 4.5 : style === 4 ? 21 : Math.min(7, Math.max(2.8, span * 0.085));
    const ys = style === 0 ? 1.0 : style === 1 ? 1.8 : 0;
    const edges = [w0, ...piers, w1];
    // the arch between two piers: from the springing to just under the deck
    const archY = (s) => {
      for (let i = 0; i < edges.length - 1; i++) {
        const a0 = edges[i] + (i ? tp / 2 : 0), a1 = edges[i + 1] - (i < edges.length - 2 ? tp / 2 : 0);
        if (s >= a0 && s <= a1) {
          const t = (s - a0) / (a1 - a0), crown = yd((a0 + a1) / 2) - fd - 0.25;
          return ys + (crown - ys) * Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1)));
        }
      }
      return s < w0 || s > w1 ? 0 : ys;
    };

    // stations along the deck: closer over the ramps and the arches
    const S = new Set([0, L, w0, w1]);
    const nDeck = far ? 6 : mobile ? 8 : 12, nRamp = far ? 3 : 5;
    for (let i = 1; i < nDeck; i++) S.add((L * i) / nDeck);
    for (let i = 1; i < nRamp; i++) { S.add((r0 * i) / nRamp); S.add(L - (r1 * i) / nRamp); }
    if (style <= 1) edges.forEach((e, i) => {
      if (i < edges.length - 1) {
        const a0 = e + (i ? tp / 2 : 0), a1 = edges[i + 1] - (i < edges.length - 2 ? tp / 2 : 0);
        const n = far ? 4 : mobile ? 4 : 7;
        for (let k = 0; k <= n; k++) S.add(a0 + ((a1 - a0) * k) / n);
      }
    });
    const st = [...S].filter((s) => s >= 0 && s <= L).sort((p, q) => p - q);
    const hv = W / 2;

    for (let k = 0; k < st.length - 1; k++) {
      const s0 = st[k], s1 = st[k + 1];
      if (s1 - s0 < 0.05) continue;
      const y0 = yd(s0), y1 = yd(s1);
      // deck surface: carriageway (or the track bed, or the walkway), footways, parapets
      const deckCol = foot ? footway : rail ? ballast : asphalt;
      quad(at(s0, -hv + 0.5 + fw, y0), at(s1, -hv + 0.5 + fw, y1), at(s1, hv - 0.5 - fw, y1), at(s0, hv - 0.5 - fw, y0), deckCol, UP);
      if (fw) for (const sd of [-1, 1]) quad(at(s0, sd * (hv - 0.5), y0 + 0.15), at(s1, sd * (hv - 0.5), y1 + 0.15), at(s1, sd * (hv - 0.5 - fw), y1 + 0.15), at(s0, sd * (hv - 0.5 - fw), y0 + 0.15), footway, UP);
      for (const sd of [-1, 1]) {
        const out = sd > 0 ? across : back, inn = sd > 0 ? back : across;
        const pc = style === 0 ? tmp.copy(paint).multiplyScalar(1.04) : style === 1 || style >= 3 ? paint : granite;
        if (!far) {
          quad(at(s0, sd * (hv - 0.5), y0 + 0.15), at(s1, sd * (hv - 0.5), y1 + 0.15), at(s1, sd * (hv - 0.5), y1 + par), at(s0, sd * (hv - 0.5), y0 + par), pc, inn);
        }
        // the outer face: fascia and parapet
        const fc = style === 2 ? paint : style === 3 ? tmp.copy(paint).multiplyScalar(0.8) : paint;
        quad(at(s0, sd * hv, y0 - fd), at(s1, sd * hv, y1 - fd), at(s1, sd * hv, y1 + par), at(s0, sd * hv, y0 + par), fc, out);
        // below the fascia: abutments solid to the ground on the banks; stone spandrels over the arches
        const b0 = archY(s0), b1 = archY(s1);
        const onBank = s1 <= w0 + 0.01 || s0 >= w1 - 0.01;
        if (onBank || style === 0) {
          const bc = onBank ? (style === 0 ? paint : granite) : paint;
          if (y0 - fd > b0 + 0.05 || y1 - fd > b1 + 0.05) quad(at(s0, sd * hv, b0), at(s1, sd * hv, b1), at(s1, sd * hv, y1 - fd), at(s0, sd * hv, y0 - fd), bc, out);
        } else if (style === 1 && b0 > ys - 0.01 && b1 > ys - 0.01) {
          // iron arches: the outer rib along the arch, and the spandrel posts up to the deck girder
          quad(at(s0, sd * hv, b0), at(s1, sd * hv, b1), at(s1, sd * hv, b1 + 1.0), at(s0, sd * hv, b0 + 1.0), paint, out);
          if (far) continue;
          quad(at(s0, sd * hv, b0), at(s1, sd * hv, b1), at(s1, sd * (hv - 0.7), b1), at(s0, sd * (hv - 0.7), b0), tmp.copy(paint).multiplyScalar(0.6), DOWN);
          const sm0 = (s0 + s1) / 2, ym = (y0 + y1) / 2 - fd, bm = (b0 + b1) / 2 + 1.0;
          if (ym - bm > 0.4) quad(at(sm0 - 0.18, sd * hv, bm), at(sm0 + 0.18, sd * hv, bm), at(sm0 + 0.18, sd * hv, ym), at(sm0 - 0.18, sd * hv, ym), paint, out);
        }
      }
      // under the deck (masonry arches: hidden by the spandrels and the soffits)
      if (style !== 0) quad(at(s0, -hv, y0 - fd), at(s1, -hv, y1 - fd), at(s1, hv, y1 - fd), at(s0, hv, y0 - fd), dark, DOWN);
      if (style <= 1) {
        const b0 = archY(s0), b1 = archY(s1);
        if (b0 > ys - 0.01 && b1 > ys - 0.01 && s0 >= w0 && s1 <= w1) {
          if (style === 0) quad(at(s0, -hv, b0), at(s1, -hv, b1), at(s1, hv, b1), at(s0, hv, b0), tmp.copy(paint).multiplyScalar(0.5), DOWN);
          else if (!far) for (const v of [-hv / 3, hv / 3]) {
            // the inner ribs, seen from the river
            quad(at(s0, v, b0), at(s1, v, b1), at(s1, v, b1 + 0.9), at(s0, v, b0 + 0.9), tmp.copy(paint).multiplyScalar(0.7), across);
            quad(at(s0, v - 0.35, b0), at(s1, v - 0.35, b1), at(s1, v + 0.35, b1), at(s0, v + 0.35, b0), tmp.copy(paint).multiplyScalar(0.55), DOWN);
          }
        }
      }
    }

    // piers with pointed cutwaters, up and downstream
    piers.forEach((sp) => {
      const top = style === 0 ? ys + 0.4 : yd(sp) - fd;
      const hw = hv + (style === 2 ? -0.3 : style === 4 ? 3 : 0.4), nose = style === 2 ? 0.8 : style === 4 ? 6 : tp * 0.7;
      const ring = [[sp - tp / 2, -hw], [sp, -hw - nose], [sp + tp / 2, -hw], [sp + tp / 2, hw], [sp, hw + nose], [sp - tp / 2, hw]];
      const col = style === 0 ? tmp.copy(paint).multiplyScalar(0.92) : style === 2 ? paint : granite;
      const c2 = col.clone();
      for (let i = 0; i < ring.length; i++) {
        const [s0, v0] = ring[i], [s1, v1] = ring[(i + 1) % ring.length];
        const mid = at((s0 + s1) / 2, (v0 + v1) / 2, 0), cen = at(sp, 0, 0);
        quad(at(s0, v0, -0.3), at(s1, v1, -0.3), at(s1, v1, top), at(s0, v0, top), c2, [mid[0] - cen[0], 0, mid[2] - cen[2]]);
      }
      quad(at(sp - tp / 2, -hw, top), at(sp + tp / 2, -hw, top), at(sp + tp / 2, hw, top), at(sp - tp / 2, hw, top), c2, UP);
      // suspension towers: two legs and a cross beam; Albert Bridge's are taller and lighter
      if (style === 3) {
        const ht = paintH === '#cfa9a2' ? 21 : 17, y0 = yd(sp), lw = 0.8;
        for (const sd of [-1, 1]) {
          const v = sd * (hv + 0.3);
          const box = [[sp - lw, v - lw], [sp + lw, v - lw], [sp + lw, v + lw], [sp - lw, v + lw]];
          for (let i = 0; i < 4; i++) {
            const [s0, v0] = box[i], [s1, v1] = box[(i + 1) % 4];
            const mid = at((s0 + s1) / 2, (v0 + v1) / 2, 0), cen = at(sp, v, 0);
            quad(at(s0, v0, y0 - fd), at(s1, v1, y0 - fd), at(s1, v1, y0 + ht), at(s0, v0, y0 + ht), paint, [mid[0] - cen[0], 0, mid[2] - cen[2]]);
          }
          quad(at(sp - lw, v - lw, y0 + ht), at(sp + lw, v - lw, y0 + ht), at(sp + lw, v + lw, y0 + ht), at(sp - lw, v + lw, y0 + ht), paint, UP);
        }
        for (const ds of [-lw, lw]) quad(at(sp + ds, -hv, y0 + ht - 2.2), at(sp + ds, hv, y0 + ht - 2.2), at(sp + ds, hv, y0 + ht - 0.6), at(sp + ds, -hv, y0 + ht - 0.6), paint, ds < 0 ? [-ca, 0, -sa] : [ca, 0, sa]);
      }
    });

    // Tower Bridge: two Gothic towers of granite and Portland stone on the piers, pyramid roofs and corner turrets,
    // the high-level walkways between them, and the side spans hung from curved chains (painted blue and white)
    if (style === 4) {
      const stone = new THREE.Color('#bfb6a3'), slate = new THREE.Color('#4b5157'), white = new THREE.Color('#e7e6e1');
      const prism = (ring, y0, y1, col) => {
        const c = ring.reduce((m, [s0, v0]) => [m[0] + s0 / ring.length, m[1] + v0 / ring.length], [0, 0]);
        for (let i = 0; i < ring.length; i++) {
          const [s0, v0] = ring[i], [s1, v1] = ring[(i + 1) % ring.length];
          const mid = at((s0 + s1) / 2, (v0 + v1) / 2, 0), cen = at(c[0], c[1], 0);
          quad(at(s0, v0, y0), at(s1, v1, y0), at(s1, v1, y1), at(s0, v0, y1), col, [mid[0] - cen[0], 0, mid[2] - cen[2]]);
        }
        quad(at(ring[0][0], ring[0][1], y1), at(ring[1][0], ring[1][1], y1), at(ring[2][0], ring[2][1], y1), at(ring[3][0], ring[3][1], y1), col, UP);
      };
      const pyramid = (sc, vc, hs, hvv, y0, h, col) => {
        const apex = at(sc, vc, y0 + h);
        const base = [[sc - hs, vc - hvv], [sc + hs, vc - hvv], [sc + hs, vc + hvv], [sc - hs, vc + hvv]];
        for (let i = 0; i < 4; i++) {
          const [s0, v0] = base[i], [s1, v1] = base[(i + 1) % 4];
          const a0 = at(s0, v0, y0), a1 = at(s1, v1, y0), mid = at((s0 + s1) / 2, (v0 + v1) / 2, 0), cen = at(sc, vc, 0);
          quad(a0, a1, apex, apex, col, [mid[0] - cen[0], 0.5, mid[2] - cen[2]]);
        }
      };
      const tw = 8.5, tv = hv + 2.5, top = 52, walk0 = 38, walk1 = 43.5;
      piers.forEach((sp) => {
        prism([[sp - tw, -tv], [sp + tw, -tv], [sp + tw, tv], [sp - tw, tv]], yd(sp) - fd, top, stone);
        pyramid(sp, 0, tw - 1, tv - 1, top, 9, slate);
        for (const [ds, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const ts = sp + ds * (tw - 1.2), tvv = dv * (tv - 1.2);
          prism([[ts - 1.6, tvv - 1.6], [ts + 1.6, tvv - 1.6], [ts + 1.6, tvv + 1.6], [ts - 1.6, tvv + 1.6]], top - 4, top + 6, stone);
          pyramid(ts, tvv, 1.6, 1.6, top + 6, 5, slate);
        }
      });
      // the walkways, one on each side of the towers' axis
      const [t0, t1] = piers;
      for (const sd of [-1, 1]) {
        const v0 = sd * (hv - 2.5), v1 = sd * (hv + 0.5);
        prism([[t0 + tw, Math.min(v0, v1)], [t1 - tw, Math.min(v0, v1)], [t1 - tw, Math.max(v0, v1)], [t0 + tw, Math.max(v0, v1)]], walk0, walk1, tmp.copy(paint));
        // the side spans' chains: from the tower at the walkway's height down to the deck at the bank
        const v = sd * (hv + 0.3), n = far ? 6 : 12;
        for (const [sa0, sa1, sgn] of [[0, t0 - tw, 1], [t1 + tw, L, -1]]) {
          const yc = (s) => { const u = (s - sa0) / (sa1 - sa0); const k = sgn > 0 ? u : 1 - u; return yd(s) + par + (walk0 - 4 - par) * k * k; };
          for (let i = 0; i < n; i++) {
            const s0 = sa0 + ((sa1 - sa0) * i) / n, s1 = sa0 + ((sa1 - sa0) * (i + 1)) / n;
            quad(at(s0, v, yc(s0) - 1.2), at(s1, v, yc(s1) - 1.2), at(s1, v, yc(s1)), at(s0, v, yc(s0)), white, sd > 0 ? across : back);
          }
        }
      }
    }

    // suspension chains: from the banks up over the towers, sagging to the deck mid-span; hangers every 5 m
    if (style === 3) {
      const ht = paintH === '#cfa9a2' ? 21 : 17;
      const [t0, t1] = piers;
      const chainY = (s) => {
        if (s <= t0) return yd(s) + par + (ht - par) * Math.pow(s / t0, 1.6);
        if (s >= t1) return yd(s) + par + (ht - par) * Math.pow((L - s) / (L - t1), 1.6);
        const u = (s - t0) / (t1 - t0);
        return yd(s) + 1.6 + (ht - 1.6) * Math.pow(2 * u - 1, 2);
      };
      const n = far ? 16 : mobile ? 24 : 40;
      for (const sd of [-1, 1]) {
        const v = sd * (hv + 0.3);
        for (let i = 0; i < n; i++) {
          const s0 = (L * i) / n, s1 = (L * (i + 1)) / n;
          quad(at(s0, v, chainY(s0) - 0.5), at(s1, v, chainY(s1) - 0.5), at(s1, v, chainY(s1)), at(s0, v, chainY(s0)), paint, sd > 0 ? across : back);
        }
        if (!far) for (let s = 5; s < L - 4; s += 5) {
          const yc = chainY(s) - 0.5, y0 = yd(s) + par;
          if (yc - y0 > 0.5) quad(at(s - 0.07, v, y0), at(s + 0.07, v, y0), at(s + 0.07, v, yc), at(s - 0.07, v, yc), tmp.copy(paint).multiplyScalar(0.85), sd > 0 ? across : back);
        }
      }
    }

    // lamp standards along both parapets (road bridges), their lanterns lit at dawn
    if (!rail) {
      const step = style === 1 ? 16 : 22, hgt = foot ? 3.2 : 5.2;
      for (let s = 6; s < L - 4; s += step) for (const sd of [-1, 1]) {
        const v = sd * (hv - 0.25), y0 = yd(s) + par;
        if (!far) quad(at(s - 0.08, v, y0), at(s + 0.08, v, y0), at(s + 0.08, v, y0 + hgt), at(s - 0.08, v, y0 + hgt), post, sd > 0 ? across : back);
        const p = at(s, v, y0 + hgt + 0.25);
        lampQuad(p[0], p[1], p[2], 0.32);
      }
    }
  });

  const group = new THREE.Group();
  if (!I.length) return { group, tris: 0 };
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, plainMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.02, side: THREE.DoubleSide }, 'city-bridge'));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (LI.length) {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3));
    lg.setIndex(LI);
    lg.computeBoundingSphere();
    const lamps = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.3, 1.35), side: THREE.DoubleSide }));
    lamps.userData.key = 'city-bridge-lamps';
    group.add(lamps);
  }
  return { group, tris: I.length / 3 + LI.length / 3 };
}
