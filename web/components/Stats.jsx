'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MODULES } from '@/lib/site';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

const STATS = [
  [6682, 'UCL modules, from the official catalogue'],
  [81, 'UCL departments covered'],
  [10, 'sets of marking criteria (UCL-wide + 9 departments)'],
  [3, 'concrete changes on every marked answer'],
];

export default function Stats() {
  const root = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray('[data-count]').forEach((el) => {
        const end = +el.getAttribute('data-count');
        const o = { v: 0 };
        el.textContent = '0';
        gsap.to(o, {
          v: end,
          duration: end > 100 ? 2.2 : 1.4,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-GB'); },
        });
      });
      gsap.from('.stat', {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: { trigger: root.current, start: 'top 88%', once: true },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  const row = [...MODULES, ...MODULES];
  return (
    <section ref={root} className="relative py-10 lg:py-16">
      <div className="wrap">
        <div className="glass grid grid-cols-2 overflow-hidden rounded-[28px] lg:grid-cols-4">
          {STATS.map(([v, l], i) => (
            <div key={l} className={`stat p-6 sm:p-8 ${i % 2 ? 'border-l border-white/[.07]' : ''} ${i > 1 ? 'border-t border-white/[.07] lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}>
              <b className="block font-display text-[clamp(38px,4.6vw,60px)] font-bold leading-none tracking-[-0.04em] text-grad" data-count={v}>
                {v.toLocaleString('en-GB')}
              </b>
              <span className="mt-3 block text-[14px] leading-snug text-mute">{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="marquee-mask mt-10 overflow-hidden" aria-hidden="true">
        <div className="flex w-max animate-[marquee_55s_linear_infinite] gap-3 hover:[animation-play-state:paused]">
          {row.map(([c, t], i) => (
            <span key={c + i} className="glass flex items-center gap-3 whitespace-nowrap rounded-full px-4 py-2 text-[14px]">
              <code className="font-mono text-[12.5px] text-[#93c5fd]">{c}</code>
              <span className="text-white/80">{t}</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes marquee{to{transform:translateX(-50%)}}`}</style>
    </section>
  );
}
