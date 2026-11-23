'use client';
import { useEffect } from 'react';
import { recordSource, track } from '@/lib/site';
import { LITE } from '@/lib/boot';

// While the visitor scrolls, frames slower than this (median, in ms) mean the machine can't run the full homepage
// smoothly. 26 ms is about 38 frames a second; a decent laptop scrolls it at 60. (Frames while the page sits still say
// nothing: even a slow machine draws those at 60, so only frames during a scroll are counted.)
const SLOW_MS = 26;
const NEED = 24; // scroll frames to judge by

// Page-level side effects: visit source, view event, and a check of how smoothly the page scrolls. On a machine that
// struggles, the homepage switches to the simple version (html.lite, lib/boot.js) and remembers it (unizy:lite = auto):
// at once if the visitor is still near the top (the top section is the same in both versions, so nothing jumps),
// otherwise from their next visit.
export default function Boot() {
  useEffect(() => {
    recordSource();
    track('lp_view');
    // ?home=1 (the dashboard's Homepage button) has done its job once the homepage is showing: keep the address clean
    if (/[?&]home=/.test(location.search)) {
      try { const u = new URL(location.href); u.searchParams.delete('home'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
    }
    const d = document.documentElement;
    let raf = 0, stopped = false, lastScroll = 0, last = 0, running = false;
    const fr = [];

    const skip = () => {
      if (d.classList.contains('lite') || d.classList.contains('intro')) return true;
      try { return localStorage.getItem(LITE) === '0'; } catch (e) { return true; }
    };
    const decide = () => {
      stop();
      const s = [...fr].sort((a, b) => a - b);
      if (s[Math.floor(s.length / 2)] <= SLOW_MS) return;
      try { localStorage.setItem(LITE, 'auto'); } catch (e) {}
      track('lite_auto');
      if (window.scrollY < 700 && !d.classList.contains('lite')) {
        d.classList.add('lite');
        window.dispatchEvent(new Event('unizy:lite'));
      }
    };
    const step = (t) => {
      running = false;
      if (stopped) return;
      // only frames drawn while scrolling (within 150 ms of a scroll event); a long gap is the tab being hidden
      if (last && t - last < 400 && performance.now() - lastScroll < 150) fr.push(t - last);
      last = t;
      if (fr.length >= NEED) { decide(); return; }
      if (performance.now() - lastScroll < 300) { running = true; raf = requestAnimationFrame(step); }
      else last = 0;
    };
    const onScroll = () => {
      lastScroll = performance.now();
      if (!running && !stopped) { running = true; raf = requestAnimationFrame(step); }
    };
    function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    }
    // start watching once the page has settled (or once the intro has handed over to it)
    const start = () => { if (!skip()) window.addEventListener('scroll', onScroll, { passive: true }); };
    let timer = 0;
    const later = () => { clearTimeout(timer); timer = setTimeout(start, 800); };
    if (d.classList.contains('intro')) window.addEventListener('smg:intro-end', later, { once: true });
    else if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });

    return () => {
      stop();
      clearTimeout(timer);
      window.removeEventListener('load', later);
      window.removeEventListener('smg:intro-end', later);
    };
  }, []);
  return null;
}
