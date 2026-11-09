'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// Fixed backdrop: fine grid, three drifting colour fields (GSAP scroll parallax) and film grain.
export default function Background() {
  const root = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      const st = { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 1.2 };
      gsap.to('.orb-a', { yPercent: 160, xPercent: -30, ease: 'none', scrollTrigger: st });
      gsap.to('.orb-b', { yPercent: 120, xPercent: 40, ease: 'none', scrollTrigger: st });
      gsap.to('.orb-c', { yPercent: -80, ease: 'none', scrollTrigger: st });
      gsap.to('.grid-layer', { yPercent: -10, ease: 'none', scrollTrigger: st });
    }, root);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={root} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="grid-layer bg-grid absolute inset-x-0 top-0 h-[130vh]" />
      <div className="orb-a glow-orb left-[-10%] top-[-12%] size-[620px] bg-vio/60" />
      <div className="orb-b glow-orb right-[-12%] top-[8%] size-[560px] bg-blue/50" />
      <div className="orb-c glow-orb bottom-[-20%] left-[30%] size-[520px] bg-cyan/25" />
      <div className="noise absolute inset-0" />
    </div>
  );
}
