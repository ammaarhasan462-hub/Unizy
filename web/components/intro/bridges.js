// The Thames bridges, from the mapped bridge outlines (OpenStreetMap, baked by tools/city/bake_city.py as `bg`):
// each one is a deck along its outline's long axis, ramped down to the banks, carried over the water on piers.
// Styles: 0 masonry or concrete arches with solid spandrels (Waterloo), 1 painted iron arches with open spandrels on
// granite piers (Westminster green, Vauxhall and Lambeth red), 2 beams or girders on piers (London Bridge, the
// railway bridges, the footbridges), 3 suspension bridges with towers and chains (Chelsea, Albert), 4 Tower Bridge.
// Beyond 2.2 km from the campus a bridge drops its small parts (footways, inner parapets, lamp posts, hangers).
// With the river lowered (opts.water < 0, city.js) the decks run nearly level onto the banks, the piers and arches go
// down to the water, and the same mesh carries the river walls (granite, a parapet with a coping, darker below the
// tide line), the Embankment's lamp standards with their festoons of bulbs, the mapped piers and pontoons with the
// boats moored at them, and boats out on the river. All of it is one mesh with vertex colours, and the lamps and lit
// windows a second one, so the river costs two draw calls.
import * as THREE from 'three';
import { plainMaterial, rng } from './materials';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildBridges(list, { mobile = false, water = 0, banks = null, river = [], docks = null, crossings = [], piers = [], seed = 1 } = {}) {
  const P = [], N = [], C = [], I = [];
  const LP = [], LI = [], LC = [];
  const BULB = new THREE.Color(3.2, 2.3, 1.35), CHAIN = new THREE.Color(3.4, 2.9, 2.1), FEST = new THREE.Color(3.0, 2.4, 1.5);
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
  // the same with its bottom edge (a-b) in one colour and its top (c-d) in another: a stain that fades upward
  const quad2 = (a, b, c, d, cb, ct, want) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    // facing away from `want`: flip the normal and the winding (the corners keep their colours)
    const flip = want && nx * want[0] + ny * want[1] + nz * want[2] < 0;
    const n = flip ? [-nx, -ny, -nz] : [nx, ny, nz];
    const i0 = push(a, n, cb), i1 = push(b, n, cb), i2 = push(c, n, ct), i3 = push(d, n, ct);
    if (flip) I.push(i0, i2, i1, i0, i3, i2);
    else I.push(i0, i1, i2, i0, i2, i3);
  };
  // one triangle a-b-c facing roughly along `want`
  const tri = (a, b, c, col, want) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    if (want && nx * want[0] + ny * want[1] + nz * want[2] < 0) { [b, c] = [c, b]; nx = -nx; ny = -ny; nz = -nz; }
    const n = [nx, ny, nz];
    I.push(push(a, n, col), push(b, n, col), push(c, n, col));
  };
  const lampQuad = (x, y, z, s, col = BULB) => {
    const o = LP.length / 3;
    LP.push(x - s, y - s, z, x + s, y - s, z, x + s, y + s, z, x - s, y + s, z, x, y - s, z - s, x, y - s, z + s, x, y + s, z + s, x, y + s, z - s);
    LI.push(o, o + 1, o + 2, o, o + 2, o + 3, o + 4, o + 5, o + 6, o + 4, o + 6, o + 7);
    for (let i = 0; i < 8; i++) LC.push(col.r, col.g, col.b);
  };
  // a festoon bulb: one small upright triangle in the plane of its string (d: the string's direction), seen from either side
  const bulb = (x, y, z, s, col, d) => {
    const o = LP.length / 3;
    LP.push(x - d[0] * s, y - s * 0.6, z - d[1] * s, x + d[0] * s, y - s * 0.6, z + d[1] * s, x, y + s, z);
    LI.push(o, o + 1, o + 2);
    for (let i = 0; i < 3; i++) LC.push(col.r, col.g, col.b);
  };
  // a lit strip (boat windows): a quad from a to b, h tall, facing out
  const lampStrip = (a, b, h, col) => {
    const o = LP.length / 3;
    LP.push(a[0], a[1], a[2], b[0], b[1], b[2], b[0], b[1] + h, b[2], a[0], a[1] + h, a[2]);
    LI.push(o, o + 1, o + 2, o, o + 2, o + 3);
    for (let i = 0; i < 4; i++) LC.push(col.r, col.g, col.b);
  };
  const UP = [0, 1, 0], DOWN = [0, -1, 0];
  const asphalt = new THREE.Color('#3d3f42'), footway = new THREE.Color('#a6a194'), granite = new THREE.Color('#8f8a80'), dark = new THREE.Color('#2a2b2c');
  const ballast = new THREE.Color('#4b4640'), post = new THREE.Color('#202224');

  const rects = [];
  list.forEach(([style, spans, paintH, cxd, czd, angm, Ld, Wd, w0d, w1d, hdd]) => {
    const cx = cxd / 10, cz = czd / 10, a = angm / 1000, L = Ld / 10, W = Wd / 10, w0 = w0d / 10, w1 = w1d / 10, Hd = hdd / 10;
    const ca = Math.cos(a), sa = Math.sin(a);
    rects.push([cx, cz, ca, sa, L, W]);
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
    // Hd is the deck's height over the water: over a lowered river the crown is only a little above the street
    const Hk = water < 0 ? Math.max(1.0, Hd + water - 0.5) : Hd;
    const yd = (s) => 0.5 + (Hk - 0.5) * sm(0, r0, s) * sm(L, L - r1, s) + camber * Math.sin(Math.PI * Math.min(1, Math.max(0, (s - w0) / wl)));
    // piers: evenly over the water (suspension: the two towers at a quarter and three quarters)
    const piers = [];
    if (style === 3) piers.push(w0 + wl * 0.25, w0 + wl * 0.75);
    else if (style === 4) piers.push(w0 + wl * 0.315, w0 + wl * 0.685);
    else for (let i = 1; i < spans; i++) piers.push(w0 + (wl * i) / spans);
    const span = wl / Math.max(1, spans);
    const tp = style === 2 ? (foot ? 1.6 : 3.2) : style === 3 ? 4.5 : style === 4 ? 21 : Math.min(7, Math.max(2.8, span * 0.085));
    const ys = Math.min(0, water) + (style === 0 ? 1.0 : style === 1 ? 1.8 : 0);
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
        quad(at(s0, v0, Math.min(0, water) - 0.3), at(s1, v1, Math.min(0, water) - 0.3), at(s1, v1, top), at(s0, v0, top), c2, [mid[0] - cen[0], 0, mid[2] - cen[2]]);
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
          tri(a0, a1, apex, col, [mid[0] - cen[0], 0.5, mid[2] - cen[2]]);
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
        if (s <= t0) return yd(s) + par + (ht - par) * Math.pow(Math.max(0, s / t0), 1.6);
        if (s >= t1) return yd(s) + par + (ht - par) * Math.pow(Math.max(0, (L - s) / (L - t1)), 1.6);
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
        // the strings of bulbs along the chains (Albert Bridge's thousands, Chelsea's along its cables), lit at dawn
        const bs = mobile || far ? 3.2 : 1.6;
        for (let s = bs / 2; s < L; s += bs) { const p = at(s, v + sd * 0.12, chainY(s) + 0.12); bulb(p[0], p[1], p[2], far ? 0.24 : 0.16, CHAIN, [ca, sa]); }
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

  const rnd = rng(seed * 977 + 5);
  const g = new THREE.Color();
  // boats: a hull (pointed bow) as a prism from just under the water, and a cabin on deck
  const prism = (c, u, ring, y0, y1, col, top = true) => {
    const P2 = ring.map(([s, v]) => [c[0] + u[0] * s - u[1] * v, c[1] + u[1] * s + u[0] * v]);
    let ox = 0, oz = 0; P2.forEach(([x, z]) => { ox += x / P2.length; oz += z / P2.length; });
    for (let i = 0; i < P2.length; i++) {
      const [x0, z0] = P2[i], [x1, z1] = P2[(i + 1) % P2.length];
      quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], col, [(x0 + x1) / 2 - ox, 0, (z0 + z1) / 2 - oz]);
    }
    // the deck or roof: a fan of triangles (not quads with a degenerate half)
    if (top) for (let i = 1; i < P2.length - 1; i++) tri([P2[0][0], y1, P2[0][1]], [P2[i][0], y1, P2[i][1]], [P2[i + 1][0], y1, P2[i + 1][1]], col, UP);
    return P2;
  };
  const WARM = new THREE.Color(1.15, 0.82, 0.5), DIM = new THREE.Color(0.55, 0.45, 0.32);
  const boat = (c, u, kind, wl = water) => {
    const k = KINDS[kind];
    const Lb = k.L[0] + rnd() * (k.L[1] - k.L[0]), Bb = k.B, hl = Lb / 2, hb = Bb / 2;
    const hull = [[-hl, -hb], [hl - Bb * 0.9, -hb], [hl, 0], [hl - Bb * 0.9, hb], [-hl, hb]];
    const hc = k.hull[Math.floor(rnd() * k.hull.length)];
    const yd = wl + k.free;
    prism(c, u, hull, wl - 0.5, yd, g.set(hc));
    if (k.band) prism(c, u, hull.map(([s, v]) => [s * 1.003, v * 1.02]), yd - 0.55, yd - 0.3, g.set(k.band), false);
    if (k.cab) {
      const c0 = -hl + k.cab[0] * Lb, c1 = -hl + k.cab[1] * Lb, cb = hb - k.cab[2];
      const ch = k.cab[3];
      const cc = k.cabCol[Math.floor(rnd() * k.cabCol.length)];
      const P2 = prism(c, u, [[c0, -cb], [c1, -cb], [c1, cb], [c0, cb]], yd, yd + ch, g.set(cc));
      // windows along both sides, lit warm (or dimmer, some dark)
      const lit = rnd() < k.lit ? WARM : rnd() < 0.5 ? DIM : null;
      if (lit) for (const [a, b] of [[0, 1], [2, 3]]) {
        const [xa, za] = P2[a], [xb, zb] = P2[b];
        const mx = (xa + xb) / 2 - c[0], mz = (za + zb) / 2 - c[1], ml = Math.hypot(mx, mz) || 1, ox = (mx / ml) * 0.04, oz = (mz / ml) * 0.04;
        const p0 = [xa + (xb - xa) * 0.08 + ox, yd + ch * 0.35, za + (zb - za) * 0.08 + oz], p1 = [xa + (xb - xa) * 0.92 + ox, yd + ch * 0.35, za + (zb - za) * 0.92 + oz];
        lampStrip(p0, p1, ch * 0.38, lit);
      }
      if (k.cab[4]) prism(c, u, [[c0 + 1, -cb + 0.4], [c0 + 1 + (c1 - c0) * 0.25, -cb + 0.4], [c0 + 1 + (c1 - c0) * 0.25, cb - 0.4], [c0 + 1, cb - 0.4]], yd + ch, yd + ch + 1.6, g.set(cc));
    }
    return Bb;
  };
  // L range, beam, freeboard, hull colours, band, cabin [start, end (as fractions of length), inset, height, wheelhouse]
  const KINDS = {
    barge: { L: [24, 32], B: 6.4, free: 1.1, hull: ['#262321', '#3b2a22', '#2c2f31'] },
    cruiser: { L: [28, 38], B: 7.0, free: 1.3, hull: ['#e8e6e0', '#dedcd5'], band: '#21375d', cab: [0.08, 0.78, 0.5, 2.3, 1], cabCol: ['#efede7', '#e3e1da'], lit: 0.7 },
    house: { L: [17, 24], B: 4.6, free: 0.9, hull: ['#1f3328', '#22304a', '#2a2826', '#5b2524'], cab: [0.12, 0.85, 0.35, 2.0, 0], cabCol: ['#6b4f3a', '#3d5a49', '#c9c1ad', '#2f3e57'], lit: 0.45 },
    clipper: { L: [34, 40], B: 9.0, free: 1.4, hull: ['#e4e6e8'], band: '#1d2226', cab: [0.12, 0.8, 0.6, 2.4, 0], cabCol: ['#2b3138'], lit: 0.6 },
    // canal narrowboats: 7 ft beam, a black hull low in the water, a long painted cabin nearly the hull's width
    narrow: { L: [15, 21], B: 2.1, free: 0.4, hull: ['#151515', '#1c1a18', '#20262a'], cab: [0.1, 0.88, 0.13, 1.05, 0], cabCol: ['#1f4a33', '#6a1f24', '#1f2f55', '#2a2a2a', '#8a2a1e', '#2d5a4a', '#3b2a4a'], lit: 0.3 },
  };
  if (banks) riverside();
  if (docks && docks.length) docksides();

  // ---------------------------------------------------------------- the river walls, the Embankment, the boats
  function riverside() {
    const TOP = 0.95, TIDE = water + 2.3, LIP = 0.6;
    const NEAR = mobile ? 1500 : 2600, BOATS = mobile ? 2700 : 4000;
    const granite = new THREE.Color('#8f8b82'), wet = new THREE.Color('#47463d'), coping = new THREE.Color('#aaa69c'), farWall = new THREE.Color('#77736a');
    const lampPost = new THREE.Color('#1e2724');
    // is (x, z) under or beside a bridge (the walls drop their parapet there, lamps and boats keep clear)?
    const bridgeAt = (x, z, m) => rects.some(([cx, cz, ca, sa, L, W]) => {
      const dx = x - cx, dz = z - cz;
      return Math.abs(dx * ca + dz * sa) <= L / 2 + m && Math.abs(-dx * sa + dz * ca) <= W / 2 + m;
    });
    const area = (r) => { let s2 = 0; for (let i = 0; i < r.length; i++) { const [x0, z0] = r[i], [x1, z1] = r[(i + 1) % r.length]; s2 += x0 * z1 - x1 * z0; } return s2 / 2; };
    // the Thames is the largest mapped river polygon: its banks get the Embankment's lamps, festoons and boats
    let thames = -1, best = 0;
    banks.forEach((rings, i) => { const a = Math.abs(area(rings[0])); if (a > best) { best = a; thames = i; } });
    const lamps = [];
    banks.forEach((rings, pi) => rings.forEach((ring, ri) => {
      const n = ring.length;
      if (n < 3) return;
      // which side the water is on: inside the outer ring, outside an island
      const sg = (area(ring) > 0 ? 1 : -1) * (ri === 0 ? 1 : -1);
      const wn = [];
      for (let i = 0; i < n; i++) {
        const [xa, za] = ring[i], [xb, zb] = ring[(i + 1) % n], L = Math.hypot(xb - xa, zb - za) || 1;
        wn.push([(-(zb - za) / L) * sg, ((xb - xa) / L) * sg]);
      }
      // the coping's back edge: each corner set back along the mean of its two edges' normals
      const back = ring.map(([x, z], i) => {
        const [ax, az] = wn[(i + n - 1) % n], [bx, bz] = wn[i];
        let mx = ax + bx, mz = az + bz; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
        const k = Math.min(2.5, 1 / Math.max(0.4, mx * bx + mz * bz));
        return [x - mx * LIP * k, z - mz * LIP * k];
      });
      let run = 0, nextLamp = 13;
      for (let i = 0; i < n; i++) {
        const [xa, za] = ring[i], [xb, zb] = ring[(i + 1) % n];
        const L = Math.hypot(xb - xa, zb - za);
        if (L < 0.05) continue;
        const [wx, wz] = wn[i], want = [wx, 0, wz];
        const mx = (xa + xb) / 2, mz = (za + zb) / 2, d = Math.hypot(mx, mz);
        const A = (y) => [xa, y, za], B = (y) => [xb, y, zb];
        const [oax, oaz] = back[i], [obx, obz] = back[(i + 1) % n];
        if (bridgeAt(mx, mz, 1.5)) {
          // under a bridge: the wall face only, up to the street, under the deck
          quad(A(water - 0.3), B(water - 0.3), B(0), A(0), wet, want);
          run += L; nextLamp = run + 13;
          continue;
        }
        // weathered stone: the tone drifts every 20 m or so
        const tone = 0.9 + 0.16 * (Math.sin(Math.floor(run / 20) * 12.9898 + pi * 7.1 + ri) * 0.5 + 0.5);
        if (d < NEAR) {
          quad(A(TIDE), B(TIDE), B(TOP), A(TOP), g.copy(granite).multiplyScalar(tone), want);
          quad(A(water - 0.3), B(water - 0.3), B(TIDE), A(TIDE), g.copy(wet).multiplyScalar(0.9 + (tone - 0.9) * 0.6), want);
          quad([oax, 0, oaz], [obx, 0, obz], [obx, TOP, obz], [oax, TOP, oaz], g.copy(granite).multiplyScalar(tone * 0.92), [-wx, 0, -wz]);
        } else if (d < 5500) quad(A(water - 0.3), B(water - 0.3), B(TOP), A(TOP), g.copy(farWall).multiplyScalar(tone), want);
        // beyond 5.5 km the wall is about a pixel tall in the haze, and the coping beyond 3.5 km under a pixel wide
        if (d < 3500) quad(A(TOP), B(TOP), [obx, TOP, obz], [oax, TOP, oaz], g.copy(coping).multiplyScalar(tone), UP);
        // lamp standards on the parapet every 26 m along the Thames, near the campus
        if (pi === thames && d < NEAR) {
          while (nextLamp <= run + L) {
            const t = (nextLamp - run) / L, x = xa + (xb - xa) * t - wx * LIP * 0.5, z = za + (zb - za) * t - wz * LIP * 0.5;
            if (!bridgeAt(x, z, 4)) lamps.push([x, z, pi * 1000 + ri, nextLamp]);
            else lamps.push(null);
            nextLamp += 26;
          }
        }
        run += L;
      }
    }));
    // the standards (dark iron, a lantern on each), and the festoons of bulbs strung between neighbours
    const hp = 3.6, fb = mobile ? 3.6 : 2.0;
    lamps.forEach((l, i) => {
      if (!l) return;
      const [x, z] = l;
      quad([x - 0.09, TOP, z], [x + 0.09, TOP, z], [x + 0.09, TOP + hp, z], [x - 0.09, TOP + hp, z], lampPost, [0, 0, 1]);
      quad([x, TOP, z - 0.09], [x, TOP, z + 0.09], [x, TOP + hp, z + 0.09], [x, TOP + hp, z - 0.09], lampPost, [1, 0, 0]);
      lampQuad(x, TOP + hp + 0.3, z, 0.3);
      const m = lamps[i + 1];
      if (!m || m[2] !== l[2] || m[3] - l[3] > 27) return;
      const D = Math.hypot(m[0] - x, m[1] - z);
      if (D > 34) return;
      const dir = [(m[0] - x) / D, (m[1] - z) / D];
      for (let s = fb / 2; s < D; s += fb) {
        const t = s / D;
        bulb(x + (m[0] - x) * t, TOP + hp - 0.25 - 1.0 * 4 * t * (1 - t), z + (m[1] - z) * t, mobile ? 0.2 : 0.15, FEST, dir);
      }
    });

    // the boats are moored where they really are: at the mapped piers, pontoons, jetties and moorings
    if (piers && piers.length) piersides(bridgeAt, TOP, BOATS, NEAR);
    // river buses and pleasure boats under way, out on the stream along the Thames' centreline
    const cl = river.filter((l) => l.length > 1);
    const tot = cl.reduce((m, l) => m + l.reduce((q, p, i) => q + (i ? Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0), 0);
    if (tot > 0) {
      for (let b = 0; b < (mobile ? 6 : 12); b++) {
        let want = rnd() * tot;
        for (const l of cl) {
          for (let i = 1; i < l.length; i++) {
            const L = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
            if (want > L) { want -= L; continue; }
            if (L > 0.5) {
              const t = want / L, x = l[i - 1][0] + (l[i][0] - l[i - 1][0]) * t, z = l[i - 1][1] + (l[i][1] - l[i - 1][1]) * t;
              const u = [(l[i][0] - l[i - 1][0]) / L, (l[i][1] - l[i - 1][1]) / L], sd = rnd() < 0.5 ? -1 : 1;
              const side = sd * (12 + rnd() * 25);
              const px = x - u[1] * side, pz = z + u[0] * side;
              if (Math.hypot(px, pz) < BOATS && !bridgeAt(px, pz, 25)) boat([px, pz], sd > 0 ? u : [-u[0], -u[1]], rnd() < 0.6 ? 'clipper' : 'cruiser');
            }
            want = -1; break;
          }
          if (want < 0) break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- the piers and moorings
  // From OpenStreetMap (baked as `pr`, see river_piers in bake_city.py): the passenger piers' pontoons with their
  // waiting rooms and brows up to the Embankment, and a river bus alongside; the floating pontoons and moorings of the
  // houseboats (Chelsea Reach, Cadogan Pier, Downings Roads) with the boats nose to tail; jetties on piles with lighters.
  function piersides(bridgeAt, TOP, BOATS, NEAR) {
    const pontSide = new THREE.Color('#2e3032'), pontDeck = new THREE.Color('#77746c'), browC = new THREE.Color('#5e5c57'), railC = new THREE.Color('#1d1f21');
    const hutC = new THREE.Color('#d8d5cb'), hutRoof = new THREE.Color('#3b4146'), pile = new THREE.Color('#2b2621'), jettyDeck = new THREE.Color('#6a6155');
    const PONT = water + 1.0, HUT = new THREE.Color(1.05, 0.86, 0.6);
    const bbs = banks.map((rings) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; rings[0].forEach(([x, z]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }); return [x0, x1, z0, z1]; });
    const pipR = (x, z, r) => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
    const wet = (x, z) => banks.some((rings, k) => { const b = bbs[k]; return x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && pipR(x, z, rings[0]) && !rings.slice(1).some((h) => pipR(x, z, h)); });
    // is a boat's water clear: its middle, both ends and its outer side (o: signed, along u's left normal) all wet
    const clear = (x, z, u, hl, o) => wet(x, z) && wet(x + u[0] * hl, z + u[1] * hl) && wet(x - u[0] * hl, z - u[1] * hl) && wet(x - u[1] * o, z + u[0] * o);
    // boats nose to tail along a line from p (direction u), `side` metres out (signed, along u's left normal)
    const row = (p, u, len, side, kinds, chance) => {
      let s = 2 + rnd() * 3;
      for (let first = true; first || s < len - 8; first = false) {
        const kind = kinds[Math.floor(rnd() * kinds.length)], k = KINDS[kind], step = k.L[1] + 1.2 + rnd() * 3;
        // a pontoon shorter than the boat still holds one, centred on it
        if (s + step > len + 4 && !first) break;
        const c = s + step > len + 4 ? len / 2 : s + step / 2, off = side + Math.sign(side) * (k.B / 2);
        const x = p[0] + u[0] * c - u[1] * off, z = p[1] + u[1] * c + u[0] * off;
        if (rnd() < chance && clear(x, z, u, k.L[1] / 2, Math.sign(side) * (k.B / 2 + 0.5)) && !bridgeAt(x, z, 8)) {
          boat([x, z], rnd() < 0.5 ? u : [-u[0], -u[1]], kind);
          // some moored two abreast
          if (kind !== 'cruiser' && rnd() < 0.3) {
            const o2 = off + Math.sign(side) * (k.B + 0.4), x2 = p[0] + u[0] * c - u[1] * o2, z2 = p[1] + u[1] * c + u[0] * o2;
            if (clear(x2, z2, u, k.L[1] / 2, Math.sign(side) * (k.B / 2 + 0.5))) boat([x2, z2], rnd() < 0.5 ? u : [-u[0], -u[1]], kind);
          }
        }
        s += step;
      }
    };
    piers.forEach((pr) => {
      const fl = pr[0];
      if (fl & 1) {
        // a line: a pier walkway over the water, or moorings along a bank
        const pts = [];
        for (let i = 1; i + 1 < pr.length; i += 2) pts.push([pr[i] / 10, pr[i + 1] / 10]);
        const [mx, mz] = pts[Math.floor(pts.length / 2)];
        if (Math.hypot(mx, mz) > BOATS) return;
        for (let i = 1; i < pts.length; i++) {
          const [xa, za] = pts[i - 1], [xb, zb] = pts[i], L = Math.hypot(xb - xa, zb - za);
          if (L < 6) continue;
          const u = [(xb - xa) / L, (zb - za) / L], nx = -u[1], nz = u[0], cx = (xa + xb) / 2, cz = (za + zb) / 2;
          const wl = wet(cx + nx * 5, cz + nz * 5), wr = wet(cx - nx * 5, cz - nz * 5);
          if (!wl && !wr) continue;
          const moor = fl & 4 && !(wl && wr);
          // a pier out in the water: a pontoon walkway along the line, boats along either side
          if (!moor) prism([cx, cz], u, [[-L / 2, -1.3], [L / 2, -1.3], [L / 2, 1.3], [-L / 2, 1.3]], water - 0.3, PONT, pontDeck);
          if (fl & 16) continue;
          const kinds = fl & 4 ? ['house', 'house', 'house', 'cruiser'] : ['cruiser', 'house', 'barge'];
          const chance = moor ? (mobile ? 0.7 : 0.9) : mobile ? 0.45 : 0.6;
          if (wl) row([xa, za], u, L, moor ? 1.0 : 1.6, kinds, chance);
          if (wr && !moor && rnd() < 0.6) row([xa, za], u, L, -1.6, kinds, chance);
          if (moor && !wl) row([xa, za], u, L, -1.0, kinds, chance);
        }
        return;
      }
      // a pontoon or pier: its outline, the rectangle round it over the water, and the bank point its brow lands on
      const [, cxd, czd, am, Ld, Wd, bxd, bzd] = pr;
      const cx = cxd / 10, cz = czd / 10, a = am / 1000, L = Ld / 10, W = Wd / 10, bx = bxd / 10, bz = bzd / 10;
      const d = Math.hypot(cx, cz);
      if (d > BOATS) return;
      const ring = [];
      for (let i = 8; i + 1 < pr.length; i += 2) ring.push([pr[i] / 10, pr[i + 1] / 10]);
      if (ring.length < 3) return;
      const u = [Math.cos(a), Math.sin(a)], vv = [-u[1], u[0]];
      const at = (s, v) => [cx + u[0] * s + vv[0] * v, cz + u[1] * s + vv[1] * v];
      const toB = [bx - cx, bz - cz], land = Math.sign(toB[0] * vv[0] + toB[1] * vv[1]) || 1;
      const floating = !!(fl & 2), passenger = !!(fl & 8), close = d < NEAR;
      // the outline is anticlockwise in (x, z) (bake_city.py): an edge's outward side is its right
      let ar = 0;
      ring.forEach(([x0, z0], i) => { const [x1, z1] = ring[(i + 1) % ring.length]; ar += x0 * z1 - x1 * z0; });
      const fill = Math.abs(ar / 2) / Math.max(1, L * W);
      const y1 = floating ? PONT : TOP - 0.35, y0 = floating ? water - 0.3 : y1 - 0.5;
      const side = floating ? pontSide : jettyDeck, top = floating ? pontDeck : jettyDeck;
      let tris = [];
      try { tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []); } catch { tris = []; }
      // the deck (a jetty's only over the water: on land it would stand on the street), and its sides
      tris.forEach(([i0, i1, i2]) => {
        const A = ring[i0], Bv = ring[i1], Cv = ring[i2];
        if (!floating && !wet((A[0] + Bv[0] + Cv[0]) / 3, (A[1] + Bv[1] + Cv[1]) / 3)) return;
        tri([A[0], y1, A[1]], [Bv[0], y1, Bv[1]], [Cv[0], y1, Cv[1]], top, UP);
      });
      const edges = [];
      ring.forEach(([xa, za], i) => {
        const [xb, zb] = ring[(i + 1) % ring.length], el = Math.hypot(xb - xa, zb - za);
        if (el < 0.05) return;
        const ue = [(xb - xa) / el, (zb - za) / el], out = [ue[1] * (ar > 0 ? 1 : -1), -ue[0] * (ar > 0 ? 1 : -1)];
        const mx = (xa + xb) / 2, mz = (za + zb) / 2, w4 = wet(mx + out[0] * 4, mz + out[1] * 4);
        if (!floating && !wet(mx, mz)) return;
        quad([xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], side, [out[0], 0, out[1]]);
        // a jetty's piles under its outer edges
        if (!floating && close) for (let s = 1; s < el - 0.5; s += 7) {
          const x = xa + ue[0] * s - out[0] * 0.4, z = za + ue[1] * s - out[1] * 0.4;
          quad([x - 0.25, water - 0.3, z], [x + 0.25, water - 0.3, z], [x + 0.25, y0, z], [x - 0.25, y0, z], pile, [0, 0, 1]);
          quad([x, water - 0.3, z - 0.25], [x, water - 0.3, z + 0.25], [x, y0, z + 0.25], [x, y0, z - 0.25], pile, [1, 0, 0]);
        }
        if (el >= 10 && w4) edges.push({ a: [xa, za], u: ue, out, el, far: Math.hypot(mx - bx, mz - bz) });
      });
      if (floating) {
        // the brow: a ramp from the pontoon's nearest corner up to the top of the river wall
        let bi = 0, bd = Infinity;
        ring.forEach(([x, z], i) => { const dd = Math.hypot(x - bx, z - bz); if (dd < bd && wet(x, z)) { bd = dd; bi = i; } });
        if (bd > 3 && bd < 45 && !bridgeAt(bx, bz, 2)) {
          const n = [(bx - ring[bi][0]) / bd, (bz - ring[bi][1]) / bd];
          const p0 = [ring[bi][0] - n[0] * 0.8, ring[bi][1] - n[1] * 0.8], p1 = [bx + n[0] * 0.5, bz + n[1] * 0.5], hw = 1.1;
          const e = [-n[1] * hw, n[0] * hw], ya = PONT + 0.05, yb = TOP - 0.05;
          quad([p0[0] - e[0], ya, p0[1] - e[1]], [p0[0] + e[0], ya, p0[1] + e[1]], [p1[0] + e[0], yb, p1[1] + e[1]], [p1[0] - e[0], yb, p1[1] - e[1]], browC, UP);
          if (close) [-1, 1].forEach((sd) => {
            const a0 = [p0[0] + e[0] * sd, p0[1] + e[1] * sd], a1 = [p1[0] + e[0] * sd, p1[1] + e[1] * sd];
            quad([a0[0], ya, a0[1]], [a1[0], yb, a1[1]], [a1[0], yb + 1.1, a1[1]], [a0[0], ya + 1.1, a0[1]], railC, [e[0] * sd, 0, e[1] * sd]);
          });
        }
        // the waiting room on a passenger pier (a rectangular pontoon): pale panels under a dark roof, lit windows
        if (passenger && close && fill > 0.6 && L >= 18 && W >= 4) {
          const hl = Math.min(L * 0.3, 22), hw2 = Math.min(W * 0.32, 2.4), sv = land * Math.max(0, W / 2 - hw2 - 1.2) * 0.5;
          const c2 = at(0, sv), ya = PONT + 0.05;
          const P2 = prism(c2, u, [[-hl, -hw2], [hl, -hw2], [hl, hw2], [-hl, hw2]], ya, ya + 2.7, hutC);
          prism(c2, u, [[-hl - 0.6, -hw2 - 0.5], [hl + 0.6, -hw2 - 0.5], [hl + 0.6, hw2 + 0.5], [-hl - 0.6, hw2 + 0.5]], ya + 2.7, ya + 2.95, hutRoof);
          for (const [i0, i1] of [[0, 1], [2, 3]]) {
            const [xa, za] = P2[i0], [xb, zb] = P2[i1];
            const ox = (xa + xb) / 2 - c2[0], oz = (za + zb) / 2 - c2[1], ol = Math.hypot(ox, oz) || 1, kx = (ox / ol) * 0.04, kz = (oz / ol) * 0.04;
            lampStrip([xa + (xb - xa) * 0.06 + kx, ya + 0.9, za + (zb - za) * 0.06 + kz], [xa + (xb - xa) * 0.94 + kx, ya + 0.9, za + (zb - za) * 0.94 + kz], 1.3, HUT);
          }
          [-1, 1].forEach((sd) => { const [x, z] = at(sd * (L / 2 - 1.5), -land * (W / 2 - 0.6)); lampQuad(x, PONT + 3.2, z, 0.22); });
        }
      }
      if (fl & 16 || !edges.length) return;
      // the boats, along the outline's edges that face open water: a river bus alongside a passenger pier's outer
      // edge, houseboats nose to tail along the moorings, lighters or a cruiser elsewhere
      edges.sort((p, q) => q.far - p.far);
      const along = (e, kinds, chance) => row([e.a[0] + e.out[0] * 0.6, e.a[1] + e.out[1] * 0.6], e.u, e.el, ar > 0 ? -0.01 : 0.01, kinds, chance);
      if (passenger) {
        const e = edges.find((q) => q.el >= 25) || edges[0];
        if (rnd() < (mobile ? 0.55 : 0.75)) {
          const kind = rnd() < 0.65 ? 'clipper' : 'cruiser', B = KINDS[kind].B, s = e.el / 2 + (rnd() - 0.5) * Math.max(0, e.el - 40);
          const x = e.a[0] + e.u[0] * s + e.out[0] * (0.6 + B / 2), z = e.a[1] + e.u[1] * s + e.out[1] * (0.6 + B / 2);
          const o = ar > 0 ? -(B / 2 + 0.5) : B / 2 + 0.5;
          if (clear(x, z, e.u, KINDS[kind].L[1] / 2, o) && !bridgeAt(x, z, 6)) boat([x, z], rnd() < 0.5 ? e.u : [-e.u[0], -e.u[1]], kind);
        }
      } else if (fl & 4) edges.forEach((e) => along(e, ['house', 'house', 'house', 'cruiser'], mobile ? 0.75 : 0.95));
      else if (rnd() < (mobile ? 0.4 : 0.55)) along(edges[0], floating ? ['cruiser', 'house', 'barge'] : ['barge', 'barge', 'house'], 0.8);
    });
  }

  // ---------------------------------------------------------------- canals, locks, docks and basins
  // city.js sets each one below its towpath or quay (docks: [{ rings, y, lv }], lv 1 a canal or lock, 2 a dock or
  // basin). Their walls: stock brick on the canals, granite on the docks, dark and wet near the water, under a pale
  // stone coping laid along the edge. Narrowboats are moored along the canals near the campus. All in the same mesh.
  function docksides() {
    const NEAR = mobile ? 600 : 1000, BOATS = mobile ? 800 : 1300;
    const brick = new THREE.Color('#735a48'), stone = new THREE.Color('#8b867c'), wetC = new THREE.Color('#3a3930'), cope = new THREE.Color('#b3ada0');
    const area = (r) => { let s2 = 0; for (let i = 0; i < r.length; i++) { const [x0, z0] = r[i], [x1, z1] = r[(i + 1) % r.length]; s2 += x0 * z1 - x1 * z0; } return s2 / 2; };
    const CW = 0.6, g2 = new THREE.Color();
    const box = docks.map(({ rings }) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; rings[0].forEach(([x, z]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }); return [x0, x1, z0, z1]; });
    // how far (x, z) is from the nearest wall of the docks other than `not` (all of them if not < 0) at level lv (any if 0)
    const edgeD = (x, z, not = -1, lv = 0) => {
      let d = Infinity;
      docks.forEach(({ rings, lv: l2, outer }, i) => {
        // the docks beyond the map never meet the map's own, nor (drawn in by city.js) each other, nor a road
        if (outer || i === not || (lv && l2 !== lv)) return;
        const [x0, x1, z0, z1] = box[i];
        if (x < x0 - 5 || x > x1 + 5 || z < z0 - 5 || z > z1 + 5) return;
        rings.forEach((ring) => {
          for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
            const [xa, za] = ring[a], [xb, zb] = ring[b], dx = xb - xa, dz = zb - za;
            const t = Math.max(0, Math.min(1, ((x - xa) * dx + (z - za) * dz) / (dx * dx + dz * dz || 1)));
            d = Math.min(d, Math.hypot(x - xa - dx * t, z - za - dz * t));
          }
        });
      });
      return d;
    };
    // the docks beyond the map (outer): their walls only out to OUT_WALL (a 1.7 m wall is under a pixel tall beyond),
    // and pleasure cruisers, houseboats and lighters moored along their quays out to OUT_BOATS
    const OUT_WALL = mobile ? 1600 : 2200, OUT_BOATS = mobile ? 2000 : 3000, DOCK_KIND = ['cruiser', 'house', 'house', 'barge', 'cruiser'];
    docks.forEach(({ rings, y, lv, outer }, di) => {
      const big = Math.abs(area(rings[0])) > 1500;
      let dacc = outer ? 10 + rnd() * 40 : 0;
      rings.forEach((ring, ri) => {
        const n = ring.length;
        if (n < 3) return;
        // which side the water is on: inside the outer ring, outside an island
        const sg = (area(ring) > 0 ? 1 : -1) * (ri === 0 ? 1 : -1);
        const face = lv === 1 ? brick : stone;
        let run = 0, acc = 4 + rnd() * 25;
        for (let i = 0; i < n; i++) {
          const [xa, za] = ring[i], [xb, zb] = ring[(i + 1) % n];
          const L = Math.hypot(xb - xa, zb - za);
          if (L < 0.05) continue;
          const ux = (xb - xa) / L, uz = (zb - za) / L, wx = -uz * sg, wz = ux * sg, want = [wx, 0, wz];
          const d = Math.hypot((xa + xb) / 2, (za + zb) / 2);
          const A = (yy) => [xa, yy, za], B = (yy) => [xb, yy, zb];
          const tone = 0.86 + 0.22 * (Math.sin(Math.floor(run / 14) * 12.9898 + di * 3.1 + ri) * 0.5 + 0.5);
          // where two pieces at the same level meet (a canal and its next stretch), the water runs on: no wall
          if (!outer && edgeD((xa + xb) / 2, (za + zb) / 2, di, lv) < 0.4) { run += L; acc = Math.max(acc - L, 12); continue; }
          if (outer) {
            if (d < OUT_WALL) quad2(A(y - 0.3), B(y - 0.3), B(0.07), A(0.07), g.copy(wetC).multiplyScalar(tone), g2.copy(face).multiplyScalar(tone), want);
            // boats moored along the quays of the larger docks and basins, one to three abreast, with gaps
            if (ri === 0 && big && d < OUT_BOATS) {
              while (dacc < L) {
                const t = dacc / L, x = xa + (xb - xa) * t, z = za + (zb - za) * t;
                dacc += 45 + rnd() * 60;
                if (L < 14 || rnd() > (mobile ? 0.25 : 0.36)) continue;
                const kind = DOCK_KIND[Math.floor(rnd() * DOCK_KIND.length)], u = rnd() < 0.5 ? [ux, uz] : [-ux, -uz];
                let off = 1.0;
                const nb = kind === 'cruiser' ? 1 : 1 + Math.floor(rnd() * 2);
                for (let j = 0; j < nb; j++) { const Bm = KINDS[kind].B; boat([x + wx * (off + Bm / 2), z + wz * (off + Bm / 2)], u, kind, y); off += Bm + 0.4; }
              }
              dacc -= L;
            }
            run += L;
            continue;
          }
          // the face, dark and wet at the water, its brick or granite clearing upward; near the campus a coping on top
          quad2(A(y - 0.3), B(y - 0.3), B(0.07), A(0.07), g.copy(wetC).multiplyScalar(tone), g2.copy(face).multiplyScalar(tone), want);
          if (d < NEAR) quad(A(0.07), B(0.07), [xb - wx * CW, 0.07, zb - wz * CW], [xa - wx * CW, 0.07, za - wz * CW], g.copy(cope).multiplyScalar(0.9 + (tone - 0.86) * 0.5), UP);
          // narrowboats moored along the canal's sides, nose to tail in places
          if (lv === 1 && big) {
            while (acc < L) {
              const t = acc / L, x = xa + (xb - xa) * t, z = za + (zb - za) * t;
              acc += 20 + rnd() * 10;
              if (L < 10 || Math.hypot(x, z) > BOATS || rnd() > (mobile ? 0.4 : 0.55)) continue;
              const u = rnd() < 0.5 ? [ux, uz] : [-ux, -uz];
              boat([x + wx * 1.25, z + wz * 1.25], u, 'narrow', y);
            }
            acc -= L;
          }
          run += L;
        }
      });
    });
    // the roads and railways that cross them: a deck at street level over the water, its fascia, and a brick
    // parapet on each side (the ground is cut away under them). Runs over the water from 3 to 70 m; longer ones are a
    // towpath drawn along the edge, not a crossing.
    const wet = (x, z) => docks.some(({ rings, outer }, i) => {
      if (outer) return false;
      const [x0, x1, z0, z1] = box[i];
      if (x < x0 || x > x1 || z < z0 || z > z1) return false;
      let ins = false;
      rings.forEach((ring) => {
        for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
          const [xa, za] = ring[a], [xb, zb] = ring[b];
          if ((za > z) !== (zb > z) && x < ((xb - xa) * (z - za)) / (zb - za + 1e-12) + xa) ins = !ins;
        }
      });
      return ins;
    });
    const deckC = new THREE.Color('#3f4043'), railC = new THREE.Color('#4b4640'), fasc = new THREE.Color('#2e2f31'), para = new THREE.Color('#6d5646'), parTop = new THREE.Color('#a29c90');
    const deck = (pa, pb, w, rail) => {
      const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (L < 0.5) return;
      const ux = (pb[0] - pa[0]) / L, uz = (pb[1] - pa[1]) / L, nx = -uz, nz = ux, hw = w / 2;
      const a0 = [pa[0] - ux * 2.5, pa[1] - uz * 2.5], b0 = [pb[0] + ux * 2.5, pb[1] + uz * 2.5];
      const P2 = (p, o, y) => [p[0] + nx * o, y, p[1] + nz * o];
      quad(P2(a0, -hw, 0.05), P2(b0, -hw, 0.05), P2(b0, hw, 0.05), P2(a0, hw, 0.05), rail ? railC : deckC, UP);
      for (const sd of [-1, 1]) {
        const o = sd * hw, out = [nx * sd, 0, nz * sd];
        quad(P2(a0, o, -0.55), P2(b0, o, -0.55), P2(b0, o, 0.05), P2(a0, o, 0.05), fasc, out);
        quad(P2(a0, o, 0.05), P2(b0, o, 0.05), P2(b0, o, 1.05), P2(a0, o, 1.05), para, out);
        quad(P2(a0, o - sd * 0.35, 0.05), P2(b0, o - sd * 0.35, 0.05), P2(b0, o - sd * 0.35, 1.05), P2(a0, o - sd * 0.35, 1.05), para, [-out[0], 0, -out[2]]);
        quad(P2(a0, o, 1.05), P2(b0, o, 1.05), P2(b0, o - sd * 0.35, 1.05), P2(a0, o - sd * 0.35, 1.05), parTop, UP);
      }
    };
    crossings.forEach(({ pts, w, rail }) => {
      let st = null, last = null;
      const end = () => {
        // a crossing, not a path along the edge: its middle well out over the water
        if (st) { const L = Math.hypot(last[0] - st[0], last[1] - st[1]); if (L >= 3 && L <= 70 && edgeD((st[0] + last[0]) / 2, (st[1] + last[1]) / 2) > Math.min(2.5, L * 0.3)) deck(st, last, Math.max(3, w), rail); }
        st = null;
      };
      for (let i = 1; i < pts.length; i++) {
        const [xa, za] = pts[i - 1], [xb, zb] = pts[i], L = Math.hypot(xb - xa, zb - za);
        const n = Math.max(1, Math.ceil(L / 1.5));
        for (let j = i === 1 ? 0 : 1; j <= n; j++) {
          const x = xa + ((xb - xa) * j) / n, z = za + ((zb - za) * j) / n;
          if (wet(x, z)) { if (!st) st = [x, z]; last = [x, z]; } else end();
        }
      }
      end();
    });
  }

  const group = new THREE.Group();
  if (!I.length) return { group, tris: 0 };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, plainMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.02, side: THREE.DoubleSide }, 'city-bridge'));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (LI.length) {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(LC, 3));
    lg.setIndex(LI);
    lg.computeBoundingSphere();
    const lamps = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    lamps.userData.key = 'city-bridge-lamps';
    group.add(lamps);
  }
  return { group, tris: I.length / 3 + LI.length / 3 };
}
