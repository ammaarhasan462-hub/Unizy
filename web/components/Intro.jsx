'use client';
// Opening screen: a full-screen 3D journey. Scrolling, swiping or the arrow keys move the camera
// instead of the page; at the end it opens onto the landing page. It plays every time someone opens
// unizy.uk (typed, bookmarked, from a search or a shared link, reloaded), signed in or not. It is skipped
// only when clicking Home from another Unizy page, with reduced motion, or without WebGL 2.
// ?intro=1 forces it, ?intro=0 skips it.
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { hasSession, track } from '@/lib/site';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

export const INTRO_BOOT = `(function(){try{var d=document.documentElement,q=location.search;
var force=/[?&]intro=1/.test(q),off=/[?&]intro=0/.test(q);
var inside=false;try{var r=document.referrer;inside=!!r&&new URL(r).host===location.host&&performance.getEntriesByType('navigation')[0].type==='navigate'}catch(e){}
var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
if(force||(!off&&!inside&&!rm&&window.WebGL2RenderingContext&&!navigator.webdriver)){d.classList.add('intro');
setTimeout(function(){if(!d.classList.contains('intro-live'))d.classList.remove('intro')},9000)}}catch(e){}})();`;

const CH = [
  { a: 0, b: 0.085, mode: 'start' },
  { a: 0.1, b: 0.22, n: '01', t: 'Revising blind.', s: 'At A-level you had mark schemes. At UCL you get past papers, and nothing to check your answers against.', side: 'left' },
  { a: 0.31, b: 0.43, n: '02', t: 'Every UCL module.', s: 'All 6,682 modules from the official catalogue, across 81 departments.', side: 'right' },
  { a: 0.5, b: 0.62, n: '03', t: 'Your department’s criteria.', s: 'Answers are marked against UCL’s grade bands and the criteria your department publishes.', side: 'left' },
  { a: 0.71, b: 0.84, n: '04', t: 'Write your answer.', s: 'Exam-style questions written in your module’s style, timed like the real thing.', side: 'right' },
  { a: 0.9, b: 1.2, n: '05', mode: 'end' },
];
const LABELS = ['Above', 'Every module', 'Criteria', 'Your answer', 'Marked'];

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function vis(c, p) {
  if (c.mode === 'start') return 1 - ss(c.a + (c.b - c.a) * 0.35, c.b, p);
  if (c.mode === 'end') return ss(c.a, c.a + 0.06, p) * (1 - ss(1.005, 1.04, p));
  const L = c.b - c.a;
  return ss(c.a, c.a + L * 0.28, p) * (1 - ss(c.b - L * 0.28, c.b, p));
}

export default function Intro() {
  const [on, setOn] = useState(true);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const root = useRef(null);
  const canvas = useRef(null);
  const flash = useRef(null);
  const chap = useRef([]);
  const fill = useRef(null);
  const dots = useRef([]);
  const hint = useRef(null);
  const engineRef = useRef(null);
  const doneRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    const d = document.documentElement;
    if (!d.classList.contains('intro')) { setOn(false); return; }
    d.classList.add('intro-live');
    setAuthed(hasSession());
    const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    let engine = null;
    let cancelled = false;

    const finish = (mode) => {
      if (doneRef.current) return;
      doneRef.current = true;
      try { sessionStorage.setItem('smg:intro', 'done'); } catch (e) {}
      track('intro_' + mode);
      const tl = gsap.timeline({
        onComplete: () => {
          if (engineRef.current) engineRef.current.dispose();
          engineRef.current = null;
          d.classList.remove('intro', 'intro-live');
          window.scrollTo(0, 0);
          window.dispatchEvent(new Event('smg:intro-end'));
          setOn(false);
          setTimeout(() => ScrollTrigger.refresh(), 50);
        },
      });
      if (mode === 'skip') tl.to(root.current, { opacity: 0, duration: 0.6, ease: 'power2.inOut' });
      else tl.to(flash.current, { opacity: 1, duration: 0.7, ease: 'power2.in' }).to(root.current, { opacity: 0, duration: 0.9, ease: 'power2.out' }, '+=0.05');
    };
    window.__smgIntroFinish = finish;

    const add = (v) => {
      if (!engine || doneRef.current) return;
      const st = engine.state;
      st.target = Math.min(1.06, Math.max(0, st.target + v));
          };
    const onWheel = (e) => {
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      add((e.deltaY * k) / 7000);
    };
    let ty = null;
    const onTS = (e) => { ty = e.touches[0].clientY; };
    const onTM = (e) => {
      if (ty == null) return;
      const y = e.touches[0].clientY;
      add((ty - y) / (window.innerHeight * 4.4));
      ty = y;
      if (e.cancelable) e.preventDefault();
    };
    const onKey = (e) => {
      const k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === ' ') { e.preventDefault(); add(0.05); }
      else if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); add(-0.05); }
      else if (k === 'Home') add(-2);
      else if (k === 'End') add(1 - engine.state.target);
      else if (k === 'Escape') finish('skip');
    };

    const onFrame = (p, target) => {
      if (!readyRef.current) { readyRef.current = true; setReady(true); }
      CH.forEach((c, i) => {
        const el = chap.current[i];
        if (!el) return;
        const o = vis(c, p);
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
        const L = c.b - c.a;
        const local = (p - c.a) / L;
        const y = c.mode ? (1 - o) * 18 : (0.5 - local) * 46;
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        el.style.filter = o < 0.98 ? `blur(${((1 - o) * 8).toFixed(1)}px)` : 'none';
        el.style.pointerEvents = c.mode === 'end' && o > 0.6 ? 'auto' : 'none';
      });
      if (fill.current) fill.current.style.transform = `scaleY(${Math.min(1, p).toFixed(4)})`;
      let cur = -1;
      CH.slice(1).forEach((c, i) => { if (p >= c.a - 0.02) cur = i; });
      dots.current.forEach((el, i) => { if (el) { el.dataset.on = i <= cur ? '1' : '0'; el.dataset.cur = i === cur ? '1' : '0'; } });
      if (hint.current) hint.current.style.opacity = (1 - ss(0.002, 0.03, p)).toFixed(3);
      if (flash.current && !doneRef.current) flash.current.style.opacity = ss(1.0, 1.05, p).toFixed(3);
      if (target >= 1.04 && p > 0.995) finish('end');
    };

    // let the loader paint, then build the world
    const t = setTimeout(async () => {
      try {
        const { createIntro } = await import('./intro/engine');
        if (cancelled) return;
        engine = createIntro(canvas.current, { mobile, onFrame });
        engineRef.current = engine;
        window.__smgIntro = engine;
        track('intro_view');
      } catch (err) {
        console.error(err);
        finish('skip');
      }
    }, 60);

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTS, { passive: true });
    window.addEventListener('touchmove', onTM, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTS);
      window.removeEventListener('touchmove', onTM);
      window.removeEventListener('keydown', onKey);
      if (engineRef.current) engineRef.current.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!on) return null;
  const finish = (m) => window.__smgIntroFinish && window.__smgIntroFinish(m);

  return (
    <div id="intro-root" ref={root} className="fixed inset-0 z-[100] select-none overflow-hidden bg-[#05070b] text-[#efe9dd]" role="region" aria-label="Unizy intro">
      <canvas ref={canvas} className="absolute inset-0 block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,.55)_100%)]" />
      <div className="noise pointer-events-none absolute inset-0 !opacity-[.06] !mix-blend-overlay" />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-9 sm:py-7">
        <span className="flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-tight text-[#efe9dd]">
          <span className="grid size-7 place-items-center rounded-[9px] border border-[#efe9dd]/25 bg-white/5 text-[13px] backdrop-blur">U</span>
          Unizy
        </span>
        <div className="flex items-center gap-2 text-[13.5px]">
          <a href={authed ? '/dashboard' : '/login?next=/dashboard'} className="hidden rounded-full px-4 py-2 text-[#efe9dd]/70 transition-colors hover:text-[#efe9dd] sm:inline-block">{authed ? 'Dashboard' : 'Log in'}</a>
          <button type="button" onClick={() => finish('skip')} className="rounded-full border border-[#efe9dd]/20 bg-white/[.04] px-4 py-2 text-[#efe9dd]/85 backdrop-blur transition-colors hover:border-[#efe9dd]/40 hover:text-[#efe9dd]" data-testid="intro-skip">
            Skip intro
          </button>
        </div>
      </div>

      {/* chapters */}
      <div ref={(el) => (chap.current[0] = el)} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-[11.5px] uppercase tracking-[.42em] text-[#efe9dd]/55">Unizy</p>
        <h1 className="mt-6 max-w-[980px] font-display text-[clamp(40px,6.6vw,96px)] font-semibold leading-[0.98] tracking-[-0.035em] text-[#f3eee4] [text-shadow:0_2px_40px_rgba(0,0,0,.35)]">
          The mark scheme your uni never gave you.
        </h1>
      </div>
      {CH.slice(1, 5).map((c, i) => (
        <div
          key={c.n}
          ref={(el) => (chap.current[i + 1] = el)}
          className={`pointer-events-none invisible absolute bottom-[12vh] px-6 sm:px-12 ${c.side === 'left' ? 'left-0 text-left' : 'right-0 text-left sm:text-right'}`}
          style={{ opacity: 0 }}
        >
          <p className="font-mono text-[11.5px] tracking-[.3em] text-[#d9b46c]/80">{c.n} / 05</p>
          <h2 className="mt-3 font-display text-[clamp(38px,6.2vw,92px)] font-semibold leading-[0.95] tracking-[-0.035em] text-[#f3eee4] [text-shadow:0_2px_30px_rgba(0,0,0,.45)]">{c.t}</h2>
          <p className={`mt-4 max-w-[440px] text-[15.5px] leading-relaxed text-[#efe9dd]/70 ${c.side === 'right' ? 'sm:ml-auto' : ''}`}>{c.s}</p>
        </div>
      ))}
      <div ref={(el) => (chap.current[5] = el)} className="pointer-events-none invisible absolute inset-x-0 bottom-0 px-6 pb-[9vh] sm:px-12" style={{ opacity: 0 }}>
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[11.5px] tracking-[.3em] text-[#d9b46c]/80">05 / 05</p>
            <h2 className="mt-3 max-w-[640px] font-display text-[clamp(36px,5.2vw,78px)] font-semibold leading-[0.95] tracking-[-0.035em] text-[#f3eee4] [text-shadow:0_2px_30px_rgba(0,0,0,.5)]">
              Find out what your answer would get.
            </h2>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href={authed ? '/dashboard/practice' : '/signup'} onClick={() => track(authed ? 'intro_dashboard' : 'intro_signup')} className="rounded-full bg-[#f3eee4] px-6 py-3.5 text-[15px] font-semibold text-[#17302A] shadow-[0_10px_40px_-10px_rgba(217,180,108,.7)] transition-transform hover:scale-[1.03]">
                {authed ? 'Practise in my dashboard' : 'Get my first answer marked, free'}
              </a>
              <button type="button" onClick={() => finish('enter')} className="rounded-full border border-[#efe9dd]/25 bg-white/[.05] px-6 py-3.5 text-[15px] font-medium text-[#efe9dd] backdrop-blur hover:border-[#efe9dd]/45" data-testid="intro-enter">
                Enter Unizy ↓
              </button>
            </div>
          </div>
          <div className="w-full max-w-[360px] rounded-3xl border border-white/12 bg-[#0b0f14]/55 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl bg-[#3E6B5C] font-display text-[20px] font-bold text-white">2:1</span>
              <div>
                <p className="font-display text-[30px] font-semibold leading-none">62–66</p>
                <p className="mt-1 text-[12.5px] text-[#efe9dd]/60">ECON0013 · UCL Economics criteria</p>
              </div>
            </div>
            <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[.2em] text-[#d9b46c]/85">3 changes to move up a class</p>
            <ol className="mt-2 space-y-1.5 text-[13.5px] text-[#efe9dd]/85">
              <li>1. Derive MR = P(1 + 1/ε) before using it</li>
              <li>2. Add the labelled diagram</li>
              <li>3. Finish with the intuition</li>
            </ol>
          </div>
        </div>
      </div>

      {/* progress rail */}
      <div className="pointer-events-none absolute right-5 top-1/2 hidden h-[34vh] -translate-y-1/2 sm:block">
        <div className="relative h-full w-px bg-white/15">
          <div ref={fill} className="absolute inset-0 origin-top bg-[#d9b46c]/80" style={{ transform: 'scaleY(0)' }} />
          {LABELS.map((l, i) => (
            <span key={l} ref={(el) => (dots.current[i] = el)} data-on="0" className="group absolute -left-[3px] size-[7px] rounded-full border border-white/40 bg-[#05070b] transition-colors data-[on='1']:border-[#d9b46c] data-[on='1']:bg-[#d9b46c]" style={{ top: `${(CH[i + 1].a * 100).toFixed(1)}%` }}>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[.2em] text-[#efe9dd]/55 opacity-0 transition-opacity duration-500 group-data-[cur='1']:opacity-100">{l}</span>
            </span>
          ))}
        </div>
      </div>

      {/* start hint */}
      <div ref={hint} className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 text-[12px] uppercase tracking-[.3em] text-[#efe9dd]/60 transition-opacity duration-700">
        <span className="hidden sm:inline">Scroll to begin</span>
        <span className="sm:hidden">Swipe up to begin</span>
        <span className="relative h-10 w-px overflow-hidden bg-white/15">
          <span className="absolute inset-x-0 top-0 h-4 animate-[introline_1.8s_ease-in-out_infinite] bg-[#efe9dd]/80" />
        </span>
      </div>

      {/* loader */}
      <div className={`pointer-events-none absolute inset-0 grid place-items-center bg-[#05070b] transition-opacity duration-1000 ${ready ? 'opacity-0' : 'opacity-100'}`}>
        <span className="font-mono text-[11px] uppercase tracking-[.42em] text-[#efe9dd]/50 [animation:pulse_2s_ease-in-out_infinite]">Unizy</span>
      </div>

      {/* paper-white hand-over to the landing page */}
      <div ref={flash} className="pointer-events-none absolute inset-0 bg-[#F4F4EF]" style={{ opacity: 0 }} />
    </div>
  );
}
