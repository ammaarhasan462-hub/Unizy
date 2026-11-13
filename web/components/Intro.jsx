'use client';
// Opening screen: a full-screen 3D journey. Scrolling, swiping or the arrow keys move the camera
// instead of the page; at the end it opens onto the landing page. It plays every time someone opens
// unizy.uk (typed, bookmarked, from a search or a shared link, reloaded), signed in or not, on laptops and desktops. It is skipped on phones,
// when clicking Home from another Unizy page, with reduced motion, or without WebGL 2.
// ?intro=1 forces it, ?intro=0 skips it.
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { hasSession, track } from '@/lib/site';
import { setUni as saveUni } from './story/unis';
import { COPY, EndCard, ProgressRail, StartTitle, Chapter, TopBar, chaptersFor, Em } from './intro/IntroChrome';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);


// timings (fractions of the journey) and layout; the words are in intro/IntroChrome.jsx
const CH = [
  { a: 0, b: 0.08, mode: 'start' },
  { a: 0.09, b: 0.2, n: '01', side: 'left' },
  { a: 0.3, b: 0.42, n: '02', side: 'right' },
  { a: 0.5, b: 0.63, n: '03', side: 'left' },
  { a: 0.705, b: 0.78, mode: 'mark' },
  { a: 0.78, b: 0.86, n: '04', side: 'right' },
  { a: 0.87, b: 0.95, n: '05', side: 'left' },
  { a: 0.96, b: 1.2, n: '06', mode: 'end' },
];
const RAIL = CH.filter((c) => c.n);
// the university picker that opens the intro
const UNIS = [
  { id: 'ucl', short: 'UCL', name: 'University College London', live: true },
  { id: 'qmul', short: 'Queen Mary', name: 'Queen Mary University of London', live: true },
  { id: 'lse', short: 'LSE', name: 'London School of Economics', live: true },
  { id: 'imperial', short: 'Imperial', name: 'Imperial College London', live: true },
  { id: 'kcl', short: 'King’s', name: 'King’s College London' },
];

const T = Em;

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function vis(c, p) {
  if (c.mode === 'start') return 1 - ss(c.a + (c.b - c.a) * 0.35, c.b, p);
  if (c.mode === 'end') return ss(c.a, c.a + 0.035, p) * (1 - ss(1.005, 1.04, p));
  const L = c.b - c.a;
  return ss(c.a, c.a + L * 0.28, p) * (1 - ss(c.b - L * 0.28, c.b, p));
}

export default function Intro() {
  const [on, setOn] = useState(true);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [picked, setPicked] = useState(false);
  const [pickerGone, setPickerGone] = useState(false);
  const [uni, setUni] = useState('ucl');
  const [switching, setSwitching] = useState(false);
  const [osm, setOsm] = useState(false);
  const switchingRef = useRef(false);
  const firstFrameRef = useRef(null);
  const stage = useRef(null);
  const pickedRef = useRef(false);
  const beginRef = useRef(0);
  const pickRef = useRef(null);
  const rail = useRef(null);
  const count = useRef(null);
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
  const detachRef = useRef(null);
  const detach = () => { if (detachRef.current) { detachRef.current(); detachRef.current = null; } };

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
          detach();
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

    // a fresh canvas for each world (a disposed renderer loses its WebGL context)
    const newCanvas = () => {
      const c = document.createElement('canvas');
      c.className = 'absolute inset-0 block h-full w-full';
      if (stage.current) { stage.current.innerHTML = ''; stage.current.appendChild(c); }
      canvas.current = c;
      return c;
    };
    const startEngine = async (u) => {
      const [{ createIntro }, { loadCity }] = await Promise.all([import('./intro/engine'), import('./intro/city')]);
      // the real city (OpenStreetMap buildings and streets); the hand-built one if it is slow or unavailable
      const city = await Promise.race([loadCity(u), new Promise((res) => setTimeout(() => res(null), 6000))]);
      if (cancelled) return;
      engine = createIntro(newCanvas(), { mobile, onFrame, hold: true, uni: u, city });
      setOsm(!!city);
      // fetch Imperial's map in the background while the picker is up
      if (u === 'ucl') setTimeout(() => loadCity('imperial'), 1500);
      engineRef.current = engine;
      window.__smgIntro = engine;
    };

    // choosing a university starts the intro: lightning first, then scrolling flies you in.
    // UCL's world is already running behind the picker; Imperial's is built behind a short dark title card.
    const pick = (id = 'ucl') => {
      if (pickedRef.current || doneRef.current || !engine) return;
      const preview = typeof window !== 'undefined' && /[?&]preview=1/.test(window.location.search);
      const u = UNIS.find((x) => x.id === id && (x.live || preview)) ? id : 'ucl';
      pickedRef.current = true;
      track('intro_pick_' + u);
      saveUni(u); // the homepage, and the dashboard after sign-up, open on this university
      setPicked(true);
      setTimeout(() => setPickerGone(true), 900);
      setUni(u);
      if (u === 'ucl') {
        beginRef.current = engine.state.time;
        engine.begin();
        return;
      }
      switchingRef.current = true;
      setSwitching(true);
      setTimeout(async () => {
        if (cancelled || doneRef.current) return;
        const old = engine;
        engine = null;
        engineRef.current = null;
        if (old) old.dispose();
        firstFrameRef.current = () => {
          beginRef.current = engine.state.time;
          engine.begin();
          switchingRef.current = false;
          setSwitching(false);
        };
        try { await startEngine(u); } catch (err) { console.error(err); finish('skip'); }
      }, 700);
    };
    pickRef.current = pick;
    window.__smgIntroPick = pick;

    const add = (v) => {
      if (!engine || doneRef.current || !pickedRef.current || switchingRef.current) return;
      const st = engine.state;
      st.target = Math.min(1.06, Math.max(0, st.target + v));
          };
    const onWheel = (e) => {
      if (doneRef.current) return;
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      add((e.deltaY * k) / 7000);
    };
    let ty = null;
    const onTS = (e) => { ty = e.touches[0].clientY; };
    const onTM = (e) => {
      if (ty == null || doneRef.current) return;
      const y = e.touches[0].clientY;
      add((ty - y) / (window.innerHeight * 4.4));
      ty = y;
      if (e.cancelable) e.preventDefault();
    };
    const onKey = (e) => {
      if (doneRef.current) return;
      const k = e.key;
      if (!pickedRef.current) {
        if (k === 'Escape') finish('skip');
        else if (k === 'Enter' && !(e.target && e.target.closest && e.target.closest('button,a'))) { e.preventDefault(); pick('ucl'); }
        else if (k === 'ArrowDown' || k === 'PageDown' || k === ' ') e.preventDefault();
        return;
      }
      if (k === 'ArrowDown' || k === 'PageDown' || k === ' ') { e.preventDefault(); add(0.05); }
      else if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); add(-0.05); }
      else if (k === 'Home') add(-2);
      else if (k === 'End') add(1 - engine.state.target);
      else if (k === 'Escape') finish('skip');
    };

    const onFrame = (p, target, time = 0) => {
      if (!readyRef.current) { readyRef.current = true; setReady(true); }
      if (firstFrameRef.current && engine) { const f = firstFrameRef.current; firstFrameRef.current = null; f(); }
      const tb = pickedRef.current ? time - beginRef.current : -1;
      CH.forEach((c, i) => {
        const el = chap.current[i];
        if (!el) return;
        const o = vis(c, p) * (i === 0 ? ss(0.35, 1.5, tb) : 1);
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
        const L = c.b - c.a;
        const local = (p - c.a) / L;
        if (c.mode === 'mark') {
          el.style.transform = `scale(${(0.92 + local * 0.22).toFixed(4)})`;
        } else {
          const y = c.mode ? (1 - o) * 14 : (0.5 - local) * 36;
          el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        }
        el.style.filter = o < 0.98 ? `blur(${((1 - o) * 8).toFixed(1)}px)` : 'none';
        el.style.pointerEvents = c.mode === 'end' && o > 0.6 ? 'auto' : 'none';
      });
      if (fill.current) fill.current.style.transform = `scaleY(${Math.min(1, p).toFixed(4)})`;
      let cur = -1;
      RAIL.forEach((c, i) => { if (p >= c.a - 0.02) cur = i; });
      dots.current.forEach((el, i) => { if (el) { el.dataset.on = i <= cur ? '1' : '0'; el.dataset.cur = i === cur ? '1' : '0'; } });
      if (count.current) { const t = `${String(Math.max(0, cur + 1)).padStart(2, '0')} / ${String(RAIL.length).padStart(2, '0')}`; if (count.current.textContent !== t) count.current.textContent = t; }
      if (hint.current) hint.current.style.opacity = (ss(3.5, 4.4, tb) * (1 - ss(0.002, 0.03, p))).toFixed(3);
      if (rail.current) rail.current.style.opacity = (ss(0.6, 1.6, tb) * (1 - ss(0.95, 0.975, p))).toFixed(3);
      if (flash.current && !doneRef.current) flash.current.style.opacity = ss(1.0, 1.05, p).toFixed(3);
      if (target >= 1.04 && p > 0.995) finish('end');
    };

    // let the loader paint, then build the world
    const t = setTimeout(async () => {
      try {
        await startEngine('ucl');
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
    detachRef.current = () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTS);
      window.removeEventListener('touchmove', onTM);
      window.removeEventListener('keydown', onKey);
    };
    return () => {
      cancelled = true;
      clearTimeout(t);
      detach();
      if (engineRef.current) engineRef.current.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!on) return null;
  const finish = (m) => window.__smgIntroFinish && window.__smgIntroFinish(m);
  const copy = COPY[uni] || COPY.ucl;
  const words = chaptersFor(uni);
  const chText = (c) => ({ ...c, ...(words.find((w) => w.n === c.n) || {}) });
  const railItems = [...words, { n: '06', k: 'Marked' }];

  return (
    <div id="intro-root" ref={root} className="fixed inset-0 z-[100] select-none overflow-hidden bg-[#05070b] text-[#efe9dd]" role="region" aria-label="Unizy intro">
      <div ref={stage} className="absolute inset-0" />
      {/* the short title card while another university's world is built */}
      <div className={`pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[#05070b] transition-opacity duration-700 ${switching ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!switching}>
        <div className="px-6 text-center">
          <p className="intro-kicker text-[10.5px] text-white/60">Unizy <span className="mx-3 inline-block h-px w-8 translate-y-[-3px] bg-white/35" /> {copy.kicker}</p>
          <p className="intro-ed mt-5 text-[clamp(38px,5vw,72px)] leading-none text-[#f3eee4]"><T s={copy.place || 'South *Kensington*'} /></p>
          <span className="mx-auto mt-7 block h-px w-24 overflow-hidden bg-white/15"><span className="block h-full w-1/2 animate-[introload_1.1s_ease-in-out_infinite] bg-[#d9b46c]/80" /></span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,.4)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48vh] bg-[linear-gradient(to_top,rgba(6,8,12,.62),rgba(6,8,12,0))]" />
      <div className="noise pointer-events-none absolute inset-0 !opacity-[.06] !mix-blend-overlay" />

      {/* top bar */}
      {osm && <div className="pointer-events-none absolute bottom-2 left-3 z-30 text-[10px] tracking-wide text-white/35">Map data © OpenStreetMap contributors · Heights © Environment Agency LiDAR (OGL)</div>}
      <TopBar authed={authed} uniShort={picked ? (UNIS.find((u) => u.id === uni) || {}).short : ''} onSkip={() => finish('skip')} />

      {/* chapters */}
      <StartTitle setRef={(el) => (chap.current[0] = el)} copy={copy} />
      {CH.map(chText).map((c, i) => (c.mode === 'mark' ? (
        <div key="mark" ref={(el) => (chap.current[i] = el)} className="pointer-events-none invisible absolute inset-0 grid place-items-center" style={{ opacity: 0 }}>
          <span className="intro-title intro-mark select-none text-[clamp(84px,19vw,300px)] tracking-[.02em]">UNIZY</span>
        </div>
      ) : c.n && !c.mode ? (
        <Chapter key={c.n} c={c} side={c.side} setRef={(el) => (chap.current[i] = el)} />
      ) : null))}
      <EndCard setRef={(el) => (chap.current[CH.length - 1] = el)} authed={authed} uni={uni} onCta={() => track(authed ? 'intro_dashboard' : 'intro_signup')} onEnter={() => finish('enter')} />

      {/* university picker: the first thing you see */}
      {!pickerGone && (
        <div
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center px-5 pt-16 text-center transition-[opacity,filter,transform] duration-[900ms] ease-out sm:px-8 ${ready && !picked ? 'opacity-100' : 'pointer-events-none opacity-0'} ${picked ? 'scale-[1.03] blur-[6px]' : ''}`}
          data-testid="intro-picker"
        >
          <p className="intro-kicker text-[10.5px] text-white/70">Unizy <span className="mx-3 inline-block h-px w-8 translate-y-[-3px] bg-white/40" /> Choose your university</p>
          <h1 className="intro-ed mt-6 text-[clamp(42px,6vw,96px)] leading-[.95] text-[#f3eee4]"><T s="Where do you *study?*" /></h1>
          <p className="intro-body mt-5 max-w-[540px] text-[14px] font-light tracking-[.03em] text-white/60">Pick your university to begin. More London universities are on the way.</p>
          <ul className="mt-9 grid w-full max-w-[1120px] grid-cols-2 gap-2.5 sm:mt-11 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {UNIS.map((u) => (
              <li key={u.id}>
                {u.live ? (
                  <button
                    type="button"
                    onClick={() => pickRef.current && pickRef.current(u.id)}
                    className="group relative flex h-[118px] w-full flex-col justify-end overflow-hidden rounded-2xl border border-[#d9b46c]/55 bg-[#0b0f14]/55 p-4 text-left shadow-[0_0_0_1px_rgba(217,180,108,.08),0_18px_60px_-20px_rgba(217,180,108,.45)] backdrop-blur-xl transition-[transform,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:border-[#d9b46c] hover:bg-[#0b0f14]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b46c] sm:h-[164px] sm:p-5"
                    data-testid={`pick-${u.id}`}
                  >
                    <span className="absolute left-4 top-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.24em] text-[#d9b46c] sm:left-5 sm:top-5">
                      <span className="size-1.5 rounded-full bg-[#7fd1a8] shadow-[0_0_10px_#7fd1a8]" /> Open now
                    </span>
                    <span className="absolute right-4 top-3.5 text-[18px] text-[#efe9dd]/70 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-[#efe9dd] sm:right-5 sm:top-4">→</span>
                    <span className="block text-[26px] font-bold leading-none tracking-tight text-white [font-family:'Archivo',sans-serif] [font-stretch:118%] sm:text-[30px]">{u.short}</span>
                    <span className="mt-1.5 block text-[12.5px] text-white/65">{u.name}</span>
                  </button>
                ) : (
                  <div className="relative flex h-[118px] w-full cursor-not-allowed flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14]/45 p-4 text-left backdrop-blur-xl sm:h-[164px] sm:p-5" aria-disabled="true" title={`${u.name}: in progress`}>
                    <span className="opacity-40 grayscale">
                      <span className="block text-[22px] font-bold leading-none tracking-tight text-white [font-family:'Archivo',sans-serif] [font-stretch:118%] sm:text-[30px]">{u.short}</span>
                      <span className="mt-1.5 hidden text-[12.5px] leading-snug text-white/65 sm:block">{u.name}</span>
                    </span>
                    <span className="pointer-events-none absolute left-[-25%] right-[-25%] top-[19%] -translate-y-1/2 rotate-[-7deg] sm:top-[24%] sm:rotate-[-9deg] border-y border-[#d9b46c]/45 bg-[#07090d]/85 py-1.5 text-center font-mono text-[10.5px] uppercase tracking-[.34em] text-[#d9b46c] shadow-[0_8px_30px_rgba(0,0,0,.45)] sm:py-2 sm:text-[11px]">
                      In Progress
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* progress rail */}
      <ProgressRail railRef={rail} fillRef={fill} dotsRef={dots} countRef={count} chapters={railItems} positions={RAIL.map((c) => c.a)} />

      {/* start hint */}
      <div ref={hint} className="intro-kicker pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 text-[10.5px] text-white/80 transition-opacity duration-700 [text-shadow:0_1px_10px_rgba(0,0,0,.5)]">
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
