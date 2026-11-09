'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Magnetic, ClassPill } from './ui';
import { track } from '@/lib/site';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

const HeroScene = dynamic(() => import('./three/HeroScene'), { ssr: false, loading: () => <SceneLoading /> });

const EASE = [0.16, 1, 0.3, 1];
const LINES = [
  { words: ['The', 'mark', 'scheme'] },
  { words: ['your', 'uni'] },
  { words: ['never', 'gave', 'you.'], grad: true },
];

function SceneLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="size-64 animate-pulse rounded-full bg-vio/20 blur-3xl" />
    </div>
  );
}

// Shown only when the browser has no WebGL.
function StaticMock() {
  return (
    <div className="absolute inset-0 grid place-items-center [perspective:1400px]">
      <div className="glass-strong w-[86%] max-w-[560px] rounded-3xl p-6 [transform:rotateY(-14deg)_rotateX(6deg)]">
        <p className="font-display text-2xl font-bold">Hi Sam</p>
        <div className="mt-4 flex items-center gap-4">
          <ClassPill cls="2:1" size={72} />
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-mute">ECON0013 · predicted</p>
            <p className="font-display text-4xl font-bold">62–66</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const sec = useRef(null);
  const copy = useRef(null);
  const spinRef = useRef(null);
  const scrollRef = useRef(0);
  const [gl, setGl] = useState(null);

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setGl(!!(c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      setGl(false);
    }
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sec.current,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (s) => { scrollRef.current = s.progress; },
      });
      gsap.to(copy.current, {
        yPercent: -14,
        opacity: 0.25,
        ease: 'none',
        scrollTrigger: { trigger: sec.current, start: 'top top', end: 'bottom top', scrub: true },
      });
    }, sec);
    return () => ctx.revert();
  }, []);

  let n = 0;
  return (
    <section ref={sec} className="relative overflow-hidden pb-16 pt-32 sm:pt-36 lg:min-h-[100svh] lg:pb-10 lg:pt-40">
      <div className="wrap grid items-center gap-6 lg:grid-cols-[1.04fr_1fr]">
        <div ref={copy} className="relative z-10">
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}
            className="glass inline-flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-[13.5px] text-ink/85"
          >
            <span className="rounded-full bg-linear-to-r from-vio to-blue px-2.5 py-0.5 text-white font-mono text-[11px] font-medium uppercase tracking-wider">New</span>
            Every UCL module, marked like your department marks
          </motion.span>

          <h1 className="mt-7 font-display text-[clamp(46px,5.4vw,80px)] font-bold leading-[0.95] tracking-[-0.045em]">
            {LINES.map((l, li) => (
              <span key={li} className="block">
                {l.words.map((w) => {
                  const i = n++;
                  return (
                    <span key={w + i} className="inline-block overflow-hidden pb-[0.1em] align-bottom mr-[0.22em] last:mr-0">
                      <motion.span
                        className={`inline-block ${l.grad ? 'text-grad-anim' : ''}`}
                        initial={{ y: '115%', rotate: 7 }}
                        animate={{ y: '0%', rotate: 0 }}
                        transition={{ duration: 1.1, ease: EASE, delay: 0.15 + i * 0.07 }}
                      >
                        {w}
                      </motion.span>
                    </span>
                  );
                })}
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.75 }}
            className="mt-7 max-w-[540px] text-[18.5px] leading-relaxed text-mute"
          >
            Write an answer to any exam question in your module. SaveMyGrade marks it against{' '}
            <strong className="font-semibold text-ink">your department’s own grading criteria</strong>, tells you your class, and shows you exactly what would
            move you up one.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.9 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Magnetic>
              <a href="/signup" onClick={() => track('lp_hero_signup')} className="btn btn-glow px-7 py-4 text-[16.5px]">
                Get my first answer marked, free
                <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
            </Magnetic>
            <a href="#how" className="btn btn-ghost px-6 py-4 text-[16.5px]">
              See how it works
            </a>
          </motion.div>

          <motion.ul
            initial="h"
            animate="s"
            variants={{ s: { transition: { staggerChildren: 0.08, delayChildren: 1.05 } } }}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-dim"
          >
            {['All 6,682 UCL modules', 'Free 7-day Pro trial', 'No card needed'].map((t) => (
              <motion.li key={t} variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0 } }} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-cyan shadow-[0_0_10px_#B8862F]" />
                {t}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.3 }}
          className="relative -mx-6 h-[420px] sm:h-[540px] lg:-ml-16 lg:-mr-32 lg:h-[680px]"
          role="img"
          aria-label="Interactive 3D preview of the SaveMyGrade dashboard. Drag to rotate."
        >
          {gl === true && <HeroScene spinRef={spinRef} scrollRef={scrollRef} />}
          {gl === false && <StaticMock />}
          {gl === true && (
            <div className="pointer-events-auto absolute bottom-1 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap text-[12.5px] text-dim">
              <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]"><path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3" /></svg>
              Drag to rotate ·
              <button type="button" onClick={() => spinRef.current && spinRef.current()} className="font-medium text-lilac hover:text-ink" data-testid="spin">
                spin 360°
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
