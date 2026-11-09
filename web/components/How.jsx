'use client';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ClassPill, Chip, Kicker, Reveal } from './ui';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

const ANSWER =
  'A monopolist maximises profit where MR = MC. Since MR = P(1 + 1/ε) and MC is positive, MR must be positive, so 1 + 1/ε > 0, which means |ε| > 1. Demand is therefore elastic at the chosen output. Intuitively, on the inelastic part, cutting output would raise revenue and lower costs, so…';

const STEPS = [
  { n: '01', t: 'Pick your course and modules', d: 'Sign up, verify your email, choose your course and year. Your modules sit in your dashboard sidebar, and any of UCL’s 6,682 modules can be added.' },
  { n: '02', t: 'Answer an exam-style question', d: 'Choose one of our questions written in your module’s style, or paste one from your own past paper. Turn on the 45-minute timer for exam conditions.' },
  { n: '03', t: 'See your class and how to go up one', d: 'Marked against UCL’s grade bands and your department’s published criteria: feedback on each criterion, the 3 changes that would move you up a class, and a First-class answer to compare.' },
];

function Panel({ children, className = '' }) {
  return <div className={`glass-strong rounded-[28px] p-6 shadow-[0_40px_120px_-40px_rgba(139,92,246,.55)] sm:p-8 ${className}`}>{children}</div>;
}

function VisCourse() {
  const rows = [['ECON0013', 'Microeconomics', true], ['ECON0019', 'Quantitative Economics and Econometrics', true], ['HIST0003', 'Approaching History', true], ['POLS0006', 'Introduction to Politics', false]];
  return (
    <Panel>
      <p className="font-mono text-[12px] uppercase tracking-[.14em] text-lilac">Your course</p>
      <p className="mt-2 font-display text-2xl font-semibold">Economics BSc · Year 2</p>
      <ul className="mt-6 space-y-2.5">
        {rows.map(([c, t, on]) => (
          <li key={c} className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 ${on ? 'border-vio/40 bg-vio/10' : 'border-white/10 bg-white/[.03]'}`}>
            <span className="min-w-0 truncate text-[15px]">
              <code className="mr-3 font-mono text-[13px] text-[#93c5fd]">{c}</code>
              {t}
            </span>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[12px] ${on ? 'bg-linear-to-br from-vio to-blue text-white' : 'border border-white/20 text-white/60'}`}>{on ? '✓' : '+'}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function VisAnswer({ typedRef, full }) {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[12px] uppercase tracking-[.14em] text-lilac">ECON0013 · Question 3</span>
        <span className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 font-mono text-[12px] text-cyan">⏱ 38:12 left</span>
      </div>
      <p className="mt-4 font-display text-[22px] font-semibold leading-snug">“Explain why a profit-maximising monopolist always produces on the elastic part of the demand curve.”</p>
      <div className="mt-5 min-h-[168px] rounded-2xl border border-white/10 bg-black/30 p-4 text-[15px] leading-relaxed text-white/85">
        <span ref={typedRef}>{full ? ANSWER : ''}</span>
        <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse bg-cyan" />
      </div>
      <div className="mt-4 flex items-center justify-between text-[13px] text-dim">
        <span>Draft saved</span>
        <span className="rounded-full bg-linear-to-r from-vio to-blue px-4 py-2 font-semibold text-white">Mark my answer</span>
      </div>
    </Panel>
  );
}

function VisResult() {
  const crit = [['2:1', 'Knowledge and understanding'], ['2:2', 'Analysis: result stated, not derived'], ['First', 'Structure and communication']];
  return (
    <Panel>
      <div className="flex items-center gap-5">
        <ClassPill cls="2:1" size={84} className="rounded-3xl" />
        <div>
          <p className="font-display text-5xl font-bold tracking-tight">62–66</p>
          <p className="mt-1 text-[14px] text-mute">predicted mark range · UCL Economics criteria</p>
        </div>
      </div>
      <ul className="mt-6 space-y-2">
        {crit.map(([c, t]) => (
          <li key={t} className="flex items-center gap-3 text-[15px]">
            <Chip cls={c} />
            <span className="text-white/85">{t}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 space-y-2">
        {['Derive MR = P(1 + 1/ε) before using it', 'Add the labelled diagram', 'Finish with the intuition'].map((t, i) => (
          <div key={t} className={`rounded-2xl border px-4 py-3 text-[15px] ${i === 0 ? 'border-cyan/35 bg-cyan/10 text-white' : 'border-white/10 bg-white/[.03] text-white/80'}`}>
            {i + 1}. {t}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function How() {
  const pin = useRef(null);
  const typedRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      const vis = gsap.utils.toArray('.how-vis', pin.current);
      gsap.set(vis.slice(1), { autoAlpha: 0, yPercent: 14, rotateX: -16, scale: 0.94 });
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: pin.current,
          start: 'top top',
          end: '+=2400',
          pin: true,
          scrub: 0.7,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress;
            setActive(p < 0.3 ? 0 : p < 0.7 ? 1 : 2);
            const tp = gsap.utils.clamp(0, 1, (p - 0.28) / 0.32);
            if (typedRef.current) typedRef.current.textContent = ANSWER.slice(0, Math.round(ANSWER.length * tp));
          },
        },
      });
      tl.fromTo('.how-bar', { scaleY: 0 }, { scaleY: 1, ease: 'none', duration: 5 }, 0)
        .to(vis[0], { autoAlpha: 0, yPercent: -14, rotateX: 16, scale: 0.94, duration: 1 }, 1)
        .to(vis[1], { autoAlpha: 1, yPercent: 0, rotateX: 0, scale: 1, duration: 1 }, 1)
        .to(vis[1], { autoAlpha: 0, yPercent: -14, rotateX: 16, scale: 0.94, duration: 1 }, 3.2)
        .to(vis[2], { autoAlpha: 1, yPercent: 0, rotateX: 0, scale: 1, duration: 1 }, 3.2)
        .to({}, { duration: 0.8 }, 4.2);
      return () => {};
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="how" className="relative scroll-mt-20">
      {/* desktop: pinned scroll story */}
      <div ref={pin} className="hidden h-screen items-center lg:flex">
        <div className="wrap grid grid-cols-[0.9fr_1.1fr] items-center gap-16">
          <div>
            <Kicker>How it works</Kicker>
            <h2 className="h2 mt-6">
              Three steps.
              <br />
              <span className="text-grad">About ten minutes.</span>
            </h2>
            <div className="relative mt-12 pl-8">
              <span className="absolute bottom-2 left-0 top-2 w-px bg-white/10" />
              <span className="how-bar absolute bottom-2 left-0 top-2 w-px origin-top bg-linear-to-b from-vio via-blue to-cyan shadow-[0_0_12px_#8b5cf6]" />
              {STEPS.map((s, i) => (
                <div key={s.n} className={`relative py-4 transition-all duration-500 ${active === i ? 'opacity-100' : 'opacity-35'}`}>
                  <span className={`absolute -left-[36.5px] top-6 size-[10px] rounded-full border transition-all duration-500 ${active >= i ? 'border-vio bg-vio shadow-[0_0_14px_#8b5cf6]' : 'border-white/25 bg-ink'}`} />
                  <span className="font-mono text-[12.5px] text-lilac">{s.n}</span>
                  <h3 className="mt-1 font-display text-[26px] font-semibold tracking-tight">{s.t}</h3>
                  <p className={`max-w-[440px] overflow-hidden text-[15.5px] leading-relaxed text-mute transition-all duration-500 ${active === i ? 'mt-2 max-h-40' : 'max-h-0'}`}>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative h-[560px] [perspective:1400px]">
            <div className="how-vis absolute inset-0 flex items-center">
              <div className="w-full"><VisCourse /></div>
            </div>
            <div className="how-vis absolute inset-0 flex items-center">
              <div className="w-full"><VisAnswer typedRef={typedRef} /></div>
            </div>
            <div className="how-vis absolute inset-0 flex items-center">
              <div className="w-full"><VisResult /></div>
            </div>
          </div>
        </div>
      </div>

      {/* mobile and tablet: stacked */}
      <div className="wrap py-20 lg:hidden">
        <Kicker>How it works</Kicker>
        <h2 className="h2 mt-6">
          Three steps. <span className="text-grad">About ten minutes.</span>
        </h2>
        <div className="mt-12 space-y-14">
          {STEPS.map((s, i) => (
            <Reveal key={s.n}>
              <span className="font-mono text-[12.5px] text-lilac">{s.n}</span>
              <h3 className="mt-1 font-display text-[26px] font-semibold tracking-tight">{s.t}</h3>
              <p className="mt-2 text-[15.5px] leading-relaxed text-mute">{s.d}</p>
              <div className="mt-6">{i === 0 ? <VisCourse /> : i === 1 ? <VisAnswer full /> : <VisResult />}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
