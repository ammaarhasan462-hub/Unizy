// Tileable 3D noise for the volumetric clouds, generated once at start-up.
// R: Perlin-Worley-style base shape (puffy, billowing). G: higher-frequency Worley detail for eroding edges.
import * as THREE from 'three';

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeWorley(C, seed) {
  const r = rng(seed);
  const pts = new Float32Array(C * C * C * 3);
  for (let i = 0; i < pts.length; i++) pts[i] = r();
  return (x, y, z) => {
    const fx = x * C, fy = y * C, fz = z * C;
    const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
    let md = 9;
    for (let dz = -1; dz <= 1; dz++) {
      const cz = iz + dz, wz = ((cz % C) + C) % C;
      for (let dy = -1; dy <= 1; dy++) {
        const cy = iy + dy, wy = ((cy % C) + C) % C;
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx, wx = ((cx % C) + C) % C;
          const k = ((wz * C + wy) * C + wx) * 3;
          const px = cx + pts[k] - fx, py = cy + pts[k + 1] - fy, pz = cz + pts[k + 2] - fz;
          const d = px * px + py * py + pz * pz;
          if (d < md) md = d;
        }
      }
    }
    return Math.min(1, Math.sqrt(md));
  };
}

function makeValue(P, seed) {
  const r = rng(seed);
  const lat = new Float32Array(P * P * P);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const at = (x, y, z) => lat[((((z % P) + P) % P) * P + (((y % P) + P) % P)) * P + (((x % P) + P) % P)];
  const sm = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y, z) => {
    const fx = x * P, fy = y * P, fz = z * P;
    const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
    const tx = sm(fx - ix), ty = sm(fy - iy), tz = sm(fz - iz);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(at(ix, iy, iz), at(ix + 1, iy, iz), tx), l(at(ix, iy + 1, iz), at(ix + 1, iy + 1, iz), tx), ty),
      l(l(at(ix, iy, iz + 1), at(ix + 1, iy, iz + 1), tx), l(at(ix, iy + 1, iz + 1), at(ix + 1, iy + 1, iz + 1), tx), ty),
      tz
    );
  };
}

export function makeNoise3D(N = 64) {
  const w4 = makeWorley(4, 11), w8 = makeWorley(8, 23), w16 = makeWorley(16, 37), w32 = makeWorley(32, 51);
  const v4 = makeValue(4, 71), v8 = makeValue(8, 83), v16 = makeValue(16, 97);
  const R = new Float32Array(N * N * N);
  const G = new Float32Array(N * N * N);
  let rmin = 9, rmax = -9, gmin = 9, gmax = -9;
  let i = 0;
  for (let z = 0; z < N; z++) {
    const zz = (z + 0.5) / N;
    for (let y = 0; y < N; y++) {
      const yy = (y + 0.5) / N;
      for (let x = 0; x < N; x++, i++) {
        const xx = (x + 0.5) / N;
        const per = v4(xx, yy, zz) * 0.55 + v8(xx, yy, zz) * 0.3 + v16(xx, yy, zz) * 0.15;
        const wor = 1 - (w4(xx, yy, zz) * 0.6 + w8(xx, yy, zz) * 0.28 + w16(xx, yy, zz) * 0.12);
        const r = per * 0.45 + wor * 0.75;
        const g = 1 - (w8(xx, yy, zz) * 0.5 + w16(xx, yy, zz) * 0.3 + w32(xx, yy, zz) * 0.2);
        R[i] = r;
        G[i] = g;
        if (r < rmin) rmin = r; if (r > rmax) rmax = r;
        if (g < gmin) gmin = g; if (g > gmax) gmax = g;
      }
    }
  }
  const data = new Uint8Array(N * N * N * 4);
  for (let j = 0; j < R.length; j++) {
    data[j * 4] = Math.round(((R[j] - rmin) / (rmax - rmin)) * 255);
    data[j * 4 + 1] = Math.round(((G[j] - gmin) / (gmax - gmin)) * 255);
    data[j * 4 + 2] = 0;
    data[j * 4 + 3] = 255;
  }
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}
