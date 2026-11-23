'use client';
import { useEffect } from 'react';
import { recordSource, track } from '@/lib/site';
import { LITE } from '@/lib/boot';

// If frames are this slow while the homepage sits at the top (median, in ms), the machine can't run the full version
// smoothly. 28 ms is about 36 frames a second; a decent laptop draws the top of the page at 60.
const SLOW_MS = 28;

// Page-level side effects: visit source, view event, and a check of how smoothly the page runs. On a machine that
// struggles, the homepage switches to the simple version (html.lite, lib/boot.js) and remembers it (unizy:lite = auto),
// as long as the visitor hasn't scrolled into the page yet; otherwise from their next visit.
export default function Boot() {
  useEffect(() => {
    recordSource();
    track('lp_view');
    const d = document.documentElement;
    let raf = 0, timer = 0, stopped = false;

    const decide = (fr) => {
      if (fr.length < 20) return;
      const s = [...fr].sort((a, b) => a - b);
      const median = s[Math.floor(s.length / 2)];
      if (median <= SLOW_MS) return;
      try { localStorage.setItem(LITE, 'auto'); } catch (e) {}
      track('lite_auto');
      if (window.scrollY < 600 && !d.classList.contains('lite')) {
        d.classList.add('lite');
        window.dispatchEvent(new Event('unizy:lite'));
      }
    };
    const sample = () => {
      if (stopped || d.classList.contains('lite') || d.classList.contains('intro')) return;
      try { if (localStorage.getItem(LITE) === '0') return; } catch (e) {}
      const fr = [];
      let last = 0;
      const t0 = performance.now();
      const step = (t) => {
        if (stopped) return;
        if (last && t - last < 1000) fr.push(t - last); // (a long gap is the tab being hidden, not a slow frame)
        last = t;
        if (fr.length < 150 && t - t0 < 3500) raf = requestAnimationFrame(step);
        else decide(fr);
      };
      raf = requestAnimationFrame(step);
    };
    // measure once the page has settled (or once the intro has handed over to it)
    const later = () => { clearTimeout(timer); timer = setTimeout(sample, 1200); };
    if (d.classList.contains('intro')) window.addEventListener('smg:intro-end', later, { once: true });
    else if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('load', later);
      window.removeEventListener('smg:intro-end', later);
    };
  }, []);
  return null;
}
