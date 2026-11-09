'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Kicker } from './ui';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

const TEXT = 'At A-level you had past papers and *mark* *schemes.* At UCL you get the papers, and *nothing* to check your answers against. So you revise blind, and find out what a First looks like *after* *the* *exam.*';

// The problem statement, lit word by word as you scroll (GSAP ScrollTrigger scrub).
export default function Gap() {
  const root = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gw',
        { opacity: 0.13 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.05,
          scrollTrigger: { trigger: '.gq', start: 'top 80%', end: 'bottom 45%', scrub: 0.6 },
        }
      );
    }, root);
    return () => ctx.revert();
  }, []);
  const words = TEXT.split(' ');
  return (
    <section ref={root} className="relative py-24 lg:py-36">
      <div className="wrap">
        <Kicker>The gap</Kicker>
        <p className="gq mt-8 max-w-[1100px] font-display text-[clamp(30px,4.4vw,62px)] font-semibold leading-[1.08] tracking-[-0.03em]">
          {words.map((w, i) => {
            const hl = w.startsWith('*');
            const t = w.replace(/\*/g, '');
            return (
              <span key={i} className={`gw inline ${hl ? 'text-grad' : 'text-ink'}`}>
                {t}{' '}
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
