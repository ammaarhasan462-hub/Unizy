'use client';
import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { recordSource, track } from '@/lib/site';

// Page-level side effects: visit source, view event, and re-measuring scroll triggers once fonts and layout settle.
export default function Boot() {
  useEffect(() => {
    recordSource();
    track('lp_view');
    const refresh = () => ScrollTrigger.refresh();
    const t = setTimeout(refresh, 400);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    window.addEventListener('load', refresh);
    return () => {
      clearTimeout(t);
      window.removeEventListener('load', refresh);
    };
  }, []);
  return null;
}
