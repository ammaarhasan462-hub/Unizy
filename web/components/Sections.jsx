'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Kicker, Logo, Magnetic, Reveal, SpotCard } from './ui';
import { fetchReviews, track } from '@/lib/site';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);
const EASE = [0.16, 1, 0.3, 1];

const ICONS = {
  doc: <><path d="M4 19V5h16v14z" /><path d="M8 9h8M8 13h5" /></>,
  shield: <><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="M9 12l2 2 4-4" /></>,
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
};

export function Trust() {
  const cards = [
    ['doc', 'Your department’s criteria', 'Every answer is marked against UCL’s grade bands for your year and, where your department publishes them, its own grade descriptors.'],
    ['shield', 'Practice, not coursework', 'Unizy is for exam practice. It refuses to mark work you’re going to submit, and it never writes work for you to hand in.'],
    ['pulse', 'Honest ranges', 'You always get a mark range, not a fake-precise number, and you can tell us your real mark so we keep checking the marker’s accuracy.'],
  ];
  return (
    <section className="relative py-24 lg:py-32">
      <div className="wrap">
        <Reveal><Kicker>Built to be trusted</Kicker></Reveal>
        <Reveal delay={0.05}><h2 className="h2 mt-6">Not a chatbot. <span className="text-grad">A marker.</span></h2></Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {cards.map(([ic, t, d], i) => (
            <Reveal key={t} delay={0.08 * i}>
              <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} className="h-full">
                <SpotCard className="glass h-full rounded-[28px] p-7">
                  <span className="grid size-12 place-items-center rounded-2xl border border-vio/40 bg-vio/15 text-lilac shadow-[0_0_30px_-8px_rgba(62,107,92,0.41)]">
                    <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-[1.7]">{ICONS[ic]}</svg>
                  </span>
                  <h3 className="mt-6 font-display text-[23px] font-semibold tracking-tight">{t}</h3>
                  <p className="mt-3 text-[15.5px] leading-relaxed text-mute">{d}</p>
                </SpotCard>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Reviews() {
  const [list, setList] = useState([]);
  useEffect(() => {
    fetchReviews().then(setList);
  }, []);
  return (
    <section className="relative py-24 lg:py-32">
      <div className="wrap">
        <Reveal><Kicker>Students</Kicker></Reveal>
        <Reveal delay={0.05}><h2 className="h2 mt-6">Real reviews <span className="text-grad">only.</span></h2></Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {list.length === 0 ? (
            <Reveal className="md:col-span-2">
              <SpotCard className="glass-strong rounded-[28px] p-8">
                <span className="text-[22px] tracking-[3px] text-lilac/40">★★★★★</span>
                <h3 className="mt-4 font-display text-[28px] font-semibold tracking-tight">Be one of the first to review Unizy.</h3>
                <p className="mt-3 max-w-[560px] text-[15.5px] leading-relaxed text-mute">We only show reviews from real, signed-in students. No made-up testimonials, ever.</p>
                <a href="/reviews" className="btn btn-ghost mt-6 px-5 py-2.5 text-[14.5px]">See reviews</a>
              </SpotCard>
            </Reveal>
          ) : (
            list.map((r, i) => {
              const n = Math.max(0, Math.min(5, +r.rating || 0));
              return (
                <Reveal key={i} delay={0.08 * i}>
                  <SpotCard className="glass h-full rounded-[28px] p-7">
                    <span className="text-[18px] tracking-[3px] text-lilac" aria-label={`${n} out of 5 stars`}>
                      {'★★★★★'.slice(0, n)}
                      <span className="opacity-25">{'★★★★★'.slice(0, 5 - n)}</span>
                    </span>
                    {r.title && <h3 className="mt-4 font-display text-[20px] font-semibold">{r.title}</h3>}
                    <p className="mt-3 text-[15.5px] leading-relaxed text-ink/85">{r.body}</p>
                    <p className="mt-5 text-[13px] text-dim">{[r.name, r.course].filter(Boolean).join(' · ')} · Verified account</p>
                  </SpotCard>
                </Reveal>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  const free = ['3 days free when you sign up, no card needed', '3 answers marked a day', '3 tutor questions a day', 'Then go Pro to keep marking'];
  const pro = ['Up to 30 answers marked a day', 'Your tutor for every module', 'Rewrite and resubmit as often as you like', 'Or £39 a year, or £12 for an exam-season pass'];
  const Tick = () => <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 fill-none stroke-cyan stroke-[2.4]"><path d="M5 12l5 5 9-10" /></svg>;
  return (
    <section id="pricing" className="relative scroll-mt-24 py-24 lg:py-32">
      <div className="wrap">
        <Reveal><Kicker>Pricing</Kicker></Reveal>
        <Reveal delay={0.05}><h2 className="h2 mt-6">Start <span className="text-grad">free.</span></h2></Reveal>
        <div className="mt-14 grid max-w-[900px] gap-5 md:grid-cols-2">
          <Reveal>
            <SpotCard className="glass h-full rounded-[30px] p-8">
              <h3 className="font-display text-[22px] font-semibold">Free trial</h3>
              <p className="mt-3 font-display text-6xl font-bold tracking-tight">£0</p>
              <ul className="mt-7 space-y-3 text-[15px] text-ink/85">{free.map((t) => <li key={t} className="flex gap-3"><Tick />{t}</li>)}</ul>
              <a href="/signup" onClick={() => track('lp_price_free')} className="btn btn-ghost mt-8 w-full py-3.5">Start free</a>
            </SpotCard>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="relative h-full overflow-hidden rounded-[30px] p-px">
              <div className="absolute inset-[-60%] animate-[spin_6s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,#3E6B5C_70deg,#B8862F_140deg,transparent_200deg)]" />
              <SpotCard className="relative h-full rounded-[29px] bg-white p-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[22px] font-semibold">Pro</h3>
                  <span className="rounded-full bg-linear-to-r from-vio to-blue px-3 py-1 text-white font-mono text-[11px] uppercase tracking-wider">Try 3 days free</span>
                </div>
                <p className="mt-3 font-display text-6xl font-bold tracking-tight">£5.99<span className="ml-1 text-[17px] font-medium text-mute">/ month</span></p>
                <ul className="mt-7 space-y-3 text-[15px] text-ink/85">{pro.map((t) => <li key={t} className="flex gap-3"><Tick />{t}</li>)}</ul>
                <a href="/pricing" onClick={() => track('lp_price_pro')} className="btn btn-glow mt-8 w-full py-3.5">See Pro</a>
              </SpotCard>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const QA = [
  ['Is this cheating?', 'No. Unizy is for exam practice and revision. It refuses to mark coursework you’re going to submit, and it never writes work for you to hand in.'],
  ['Does it have my exact past papers?', 'We don’t host university exam papers. Paste a question from your own past paper and we’ll mark your answer to it, or use one of our exam-style questions written from the module’s official description.'],
  ['How accurate is the marking?', 'It’s a practice estimate, so you always see a mark range rather than a single number. We test the marker against real marked answers, module by module, and you can tell us your real mark to help keep it accurate.'],
  ['Which modules?', 'All 6,682 modules in UCL’s public module catalogue. Practice questions are written the first time someone opens a module, then saved for everyone.'],
  ['Is Unizy part of UCL?', 'No. Unizy is an independent revision tool built by a UCL student. It isn’t affiliated with or endorsed by UCL.'],
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="relative scroll-mt-24 py-24 lg:py-32">
      <div className="wrap grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Reveal><Kicker>Questions</Kicker></Reveal>
          <Reveal delay={0.05}><h2 className="h2 mt-6">Good to <span className="text-grad">know.</span></h2></Reveal>
        </div>
        <div className="space-y-3">
          {QA.map(([q, a], i) => (
            <Reveal key={q} delay={0.05 * i}>
              <div className={`rounded-3xl border transition-colors duration-300 ${open === i ? 'glass-strong border-ink/15' : 'border-ink/[.08] bg-white/70 hover:bg-ink/5'}`}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left font-display text-[19px] font-semibold">
                  {q}
                  <motion.span animate={{ rotate: open === i ? 45 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="grid size-8 shrink-0 place-items-center rounded-full border border-ink/15 text-lg text-lilac">+</motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden">
                      <p className="px-6 pb-6 text-[15.5px] leading-relaxed text-mute">{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Final() {
  const box = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(box.current, { scale: 0.88, borderRadius: 80 }, { scale: 1, borderRadius: 40, ease: 'none', scrollTrigger: { trigger: box.current, start: 'top bottom', end: 'center center', scrub: 0.8 } });
    }, box);
    return () => ctx.revert();
  }, []);
  return (
    <section className="relative py-20 lg:py-28">
      <div className="wrap">
        <div ref={box} className="relative overflow-hidden rounded-[40px] border border-ink/10 px-6 py-20 text-center sm:px-12 lg:py-28">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(62,107,92,0.2),transparent_60%),radial-gradient(ellipse_at_50%_100%,rgba(23,48,42,0.14),transparent_60%)]" />
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" />
          <h2 className="mx-auto max-w-[900px] font-display text-[clamp(40px,6.4vw,92px)] font-bold leading-[0.95] tracking-[-0.045em]">
            Find out what your <span className="text-grad-anim">answer would get.</span>
          </h2>
          <p className="mt-6 text-[18px] text-mute">Free to start. No card needed.</p>
          <div className="mt-10">
            <Magnetic>
              <a href="/signup" onClick={() => track('lp_final_signup')} className="btn btn-glow px-8 py-4.5 text-[17px]">Get my first answer marked, free</a>
            </Magnetic>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const links = [['Find your module', '/mark'], ['Pricing', '/pricing'], ['Reviews', '/reviews'], ['FAQ', '/faq'], ['Trust & safety', '/trust'], ['Privacy', '/privacy.html'], ['Terms', '/terms.html'], ['Contact', 'mailto:hello@unizy.uk']];
  return (
    <footer className="border-t border-ink/[.07] py-12">
      <div className="wrap">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-mute" aria-label="Footer">
            {links.map(([t, h]) => <a key={h} href={h} className="hover:text-ink">{t}</a>)}
          </nav>
        </div>
        <p className="mt-8 max-w-[900px] text-[12.5px] leading-relaxed text-dim">
          Unizy is an independent revision tool for UCL students. It is not affiliated with or endorsed by UCL. Marks are practice estimates, not official marks. Practice questions are written for revision and are not taken from UCL exam papers. The dashboard shown above is an illustration. © 2026 Unizy
        </p>
      </div>
    </footer>
  );
}
