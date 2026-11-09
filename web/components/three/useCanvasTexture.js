'use client';
import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import { fonts } from './textures';

// A CanvasTexture drawn by `draw(ctx, w, h, fonts)`, redrawn once the web fonts have loaded.
// With `blur`, also returns a padded, blurred copy used for the depth-of-field crossfade.
export function useCanvasTexture(w, h, draw, opts = {}) {
  const { blur = 0, pad = 0 } = opts;
  const res = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    let bc = null;
    let bt = null;
    if (blur) {
      bc = document.createElement('canvas');
      bc.width = w + pad * 2;
      bc.height = h + pad * 2;
      bt = new THREE.CanvasTexture(bc);
      bt.colorSpace = THREE.SRGBColorSpace;
    }
    const paint = () => {
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h, fonts());
      t.needsUpdate = true;
      if (bc) {
        const b = bc.getContext('2d');
        b.clearRect(0, 0, bc.width, bc.height);
        if ('filter' in b) b.filter = `blur(${blur}px)`;
        b.drawImage(c, pad, pad);
        if ('filter' in b) b.filter = 'none';
        bt.needsUpdate = true;
      }
    };
    paint();
    return { texture: t, blurred: bt, paint };
  }, [w, h, draw, blur, pad]);

  useEffect(() => {
    let live = true;
    const again = () => live && res.paint();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
    const t1 = setTimeout(again, 900);
    const t2 = setTimeout(again, 2500);
    return () => {
      live = false;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [res]);

  useEffect(() => () => {
    res.texture.dispose();
    if (res.blurred) res.blurred.dispose();
  }, [res]);

  return res;
}
