'use client';
import { useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import { Chip, ClassPill, Kicker, Reveal } from './ui';
import { track } from '@/lib/site';

const EASE = [0.16, 1, 0.3, 1];
const TABS = [
  { k: 'marking', t: 'Marking', s: 'Your class, criterion by criterion' },
  { k: 'tutor', t: 'Your tutor', s: 'Professor UCL, for every module' },
  { k: 'history', t: 'Marked answers', s: 'Every answer, and your marks over time' },
  { k: 'modules', t: 'Your modules', s: 'Picked once, kept in your sidebar' },
];
const DUR = 6.5;

const stagger = { show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } };
const item = { hide: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } };

function Marking() {
  const crit = [['2:1', 'Argument: answers the question directly', 0.66], ['First', 'Evidence: well-chosen, integrated', 0.78], ['2:2', 'Historiography: debate mentioned, not engaged', 0.52]];
  return (
    <motion.div variants={stagger} initial="hide" animate="show">
      <motion.h4 variants={item} className="font-display text-[26px] font-semibold tracking-tight">Marked against your department’s criteria</motion.h4>
      <motion.div variants={item} className="mt-6 flex items-center gap-5">
        <ClassPill cls="2:1" size={78} className="rounded-3xl" />
        <div>
          <p className="font-display text-5xl font-bold tracking-tight">64–68</p>
          <p className="mt-1 text-[14px] text-mute">HIST0003 · UCL grade bands, Year 1</p>
        </div>
      </motion.div>
      <div className="mt-7 space-y-4">
        {crit.map(([c, t, w]) => (
          <motion.div key={t} variants={item}>
            <div className="flex items-center gap-3 text-[15px]">
              <Chip cls={c} />
              <span className="text-ink/85">{t}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[.07]">
              <motion.div className="h-full rounded-full bg-linear-to-r from-vio via-blue to-cyan" initial={{ width: 0 }} animate={{ width: `${w * 100}%` }} transition={{ duration: 1.2, ease: EASE, delay: 0.5 }} />
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div variants={item} className="mt-6 rounded-2xl border border-cyan/35 bg-cyan/10 px-4 py-3 text-[15px]">
        Engage two historians’ positions and say which is more convincing, and why.
      </motion.div>
    </motion.div>
  );
}

function Tutor() {
  const msgs = [
    ['me', 'I keep confusing the substitution and income effects. Can you explain?'],
    ['tu', 'Sure. When a price rises, two things happen: the good is now relatively dearer (substitution effect) and you are effectively poorer (income effect). The Slutsky equation splits the total change into those two parts.'],
    ['me', 'How would that earn marks in the exam?'],
    ['tu', 'Show the decomposition on a diagram, label the compensated budget line, then sign each effect for a normal good. That is what moves an answer from 2:2 to 2:1.'],
  ];
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-full bg-[conic-gradient(from_90deg,#3E6B5C,#B8862F,#3E6B5C)] shadow-[0_0_20px_-2px_rgba(62,107,92,0.41)]" />
        <div>
          <h4 className="font-display text-[22px] font-semibold leading-tight">Professor UCL</h4>
          <p className="text-[13px] text-cyan">ECON0013 · Microeconomics</p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {msgs.map(([r, t], i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.85 }}
            className={`max-w-[88%] rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed ${r === 'me' ? 'ml-auto bg-linear-to-r from-vio to-blue text-white' : 'border border-ink/10 bg-white/70 text-ink/90'}`}
          >
            {t}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function History() {
  const rows = [['First', 'ECON0013 · Monopoly and elasticity', '70–74'], ['2:1', 'HIST0003 · Sources and interpretation', '62–66'], ['2:2', 'POLS0006 · What is the state?', '55–59']];
  return (
    <div>
      <h4 className="font-display text-[26px] font-semibold tracking-tight">Watch your marks climb</h4>
      <svg viewBox="0 0 600 170" className="mt-6 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="fl" x1="0" x2="1"><stop offset="0" stopColor="#3E6B5C" /><stop offset=".6" stopColor="#2B4F44" /><stop offset="1" stopColor="#B8862F" /></linearGradient>
          <linearGradient id="fa" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgba(62,107,92,0.16)" /><stop offset="1" stopColor="rgba(62,107,92,0.0)" /></linearGradient>
        </defs>
        <line x1="0" x2="600" y1="42" y2="42" stroke="rgba(184,134,47,.55)" strokeDasharray="4 6" />
        <text x="4" y="34" fill="#8A5E1E" fontSize="12" fontFamily="monospace">First</text>
        <motion.polygon points="10,140 110,130 210,114 310,104 410,82 510,60 590,40 590,170 10,170" fill="url(#fa)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.9 }} />
        <motion.path d="M10 140 L110 130 L210 114 L310 104 L410 82 L510 60 L590 40" fill="none" stroke="url(#fl)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: EASE }} />
        <motion.circle cx="590" cy="40" r="6" fill="#B8862F" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5, type: 'spring' }} />
      </svg>
      <motion.ul variants={stagger} initial="hide" animate="show" className="mt-5 space-y-2">
        {rows.map(([c, t, m]) => (
          <motion.li key={t} variants={item} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-[14.5px]">
            <Chip cls={c} />
            <span className="flex-1 truncate text-ink/85">{t}</span>
            <code className="font-mono text-[13px] text-ink/70">{m}</code>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

function Modules() {
  const mods = [['ECON0013', 'Microeconomics', 72], ['HIST0003', 'Approaching History', 48], ['POLS0006', 'Introduction to Politics', 60], ['LAWS0001', 'Contract Law', 35]];
  return (
    <div>
      <h4 className="font-display text-[26px] font-semibold tracking-tight">Your modules, one click away</h4>
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-[15px] text-mute">
        <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        Search 6,682 UCL modules
      </div>
      <motion.div variants={stagger} initial="hide" animate="show" className="mt-4 grid grid-cols-2 gap-3">
        {mods.map(([c, t, p]) => (
          <motion.div key={c} variants={item} whileHover={{ y: -4 }} className="rounded-2xl border border-ink/10 bg-white/70 p-4">
            <code className="font-mono text-[12.5px] text-vio">{c}</code>
            <p className="mt-1 font-display text-[17px] font-semibold leading-snug">{t}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[.08]">
              <motion.div className="h-full rounded-full bg-linear-to-r from-vio to-cyan" initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 1.1, ease: EASE, delay: 0.4 }} />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

const PANELS = { marking: Marking, tutor: Tutor, history: History, modules: Modules };

export default function Features() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.35 });
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 140, damping: 18 });
  const sry = useSpring(ry, { stiffness: 140, damping: 18 });
  const running = inView && !paused && !hover;

  const pick = (n, user) => {
    setI(n);
    if (user) {
      setPaused(true);
      track('lp_feature_' + TABS[n].k);
    }
  };
  const P = PANELS[TABS[i].k];

  return (
    <section id="features" ref={ref} className="relative scroll-mt-24 py-24 lg:py-36">
      <div className="wrap">
        <Reveal><Kicker>Inside your dashboard</Kicker></Reveal>
        <Reveal delay={0.05}><h2 className="h2 mt-6 max-w-[900px]">Everything you need to <span className="text-grad">go up a class.</span></h2></Reveal>
        <Reveal delay={0.1}><p className="mt-5 max-w-[560px] text-[18px] text-mute">One place for practice, feedback, your tutor and every answer you’ve had marked.</p></Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-[360px_1fr] lg:gap-10">
          <div
            role="tablist"
            aria-label="Features"
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); pick((i + 1) % TABS.length, true); }
              if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); pick((i + TABS.length - 1) % TABS.length, true); }
            }}
          >
            {TABS.map((t, n) => (
              <button
                key={t.k}
                role="tab"
                aria-selected={i === n}
                tabIndex={i === n ? 0 : -1}
                onClick={() => pick(n, true)}
                className="relative min-w-[220px] shrink-0 overflow-hidden rounded-2xl px-5 py-4 text-left lg:min-w-0"
                data-testid={`ftab-${n}`}
              >
                {i === n && <motion.span layoutId="ftab-bg" className="glass-strong absolute inset-0 rounded-2xl" transition={{ type: 'spring', stiffness: 320, damping: 30 }} />}
                <span className="relative block">
                  <b className={`block font-display text-[19px] font-semibold transition-colors ${i === n ? 'text-ink' : 'text-ink/55'}`}>{t.t}</b>
                  <span className={`mt-0.5 block text-[14px] transition-colors ${i === n ? 'text-mute' : 'text-dim'}`}>{t.s}</span>
                </span>
                {i === n && (
                  <motion.i
                    key={`${n}-${running}`}
                    className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-linear-to-r from-vio to-cyan"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: running ? 1 : 0 }}
                    transition={{ duration: running ? DUR : 0.3, ease: 'linear' }}
                    onAnimationComplete={(def) => {
                      if (running && def && def.scaleX === 1) setI((v) => (v + 1) % TABS.length);
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          <motion.div
            className="relative"
            style={{ rotateX: srx, rotateY: sry, transformPerspective: 1400 }}
            onPointerMove={(e) => {
              if (e.pointerType !== 'mouse') return;
              const r = e.currentTarget.getBoundingClientRect();
              ry.set(((e.clientX - r.left) / r.width - 0.5) * 7);
              rx.set(-((e.clientY - r.top) / r.height - 0.5) * 7);
            }}
            onPointerLeave={() => { rx.set(0); ry.set(0); setHover(false); }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
          >
            <div className="absolute inset-x-0 -inset-y-10 -z-10 rounded-[60px] bg-[radial-gradient(closest-side,rgba(62,107,92,0.16),transparent)] blur-2xl" />
            <div className="glass-strong min-h-[520px] rounded-[32px] p-6 shadow-[0_50px_140px_-50px_rgba(23,48,42,0.24)] sm:p-9" role="tabpanel">
              <AnimatePresence mode="wait">
                <motion.div
                  key={TABS[i].k}
                  initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -14, filter: 'blur(8px)' }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <P />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
