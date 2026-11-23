'use client';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Kicker, Logo, Magnetic, Reveal, SpotCard } from './ui';
import { SB_KEY, SB_URL, fetchReviews, hasSession, track } from '@/lib/site';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

const ICONS = {
  doc: <><path d="M4 19V5h16v14z" /><path d="M8 9h8M8 13h5" /></>,
  shield: <><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="M9 12l2 2 4-4" /></>,
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
};

export function Trust() {
  const cards = [
    ['doc', 'Your department’s criteria', 'Every answer is marked against your university’s grade bands for your year (UCL, Imperial, Queen Mary or LSE) and, where your department publishes them, its own grade descriptors.'],
    ['shield', 'Private, and practice only', 'Only you can see your answers and marks. Unizy is for exam practice: it refuses to mark work you’re going to submit, and never writes work for you to hand in.'],
    ['pulse', 'Honest ranges', 'You always get a mark range, not a fake-precise number, and you can tell us your real mark so we keep checking the marker’s accuracy.'],
  ];
  return (
    <section className="relative py-24 lg:py-32">
      <div className="wrap">
        <Reveal><Kicker>Built by a UCL student, to be trusted</Kicker></Reveal>
        <Reveal delay={0.05}><h2 className="h2 mt-6">Not a chatbot. <span className="text-grad">A marker.</span></h2></Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {cards.map(([ic, t, d], i) => (
            <Reveal key={t} delay={0.08 * i}>
              <div className="lift h-full">
                <SpotCard className="glass h-full rounded-[28px] p-7">
                  <span className="grid size-12 place-items-center rounded-2xl border border-vio/40 bg-vio/15 text-lilac shadow-[0_0_30px_-8px_rgba(62,107,92,0.41)]">
                    <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-[1.7]">{ICONS[ic]}</svg>
                  </span>
                  <h3 className="mt-6 font-display text-[23px] font-semibold tracking-tight">{t}</h3>
                  <p className="mt-3 text-[15.5px] leading-relaxed text-mute">{d}</p>
                </SpotCard>
              </div>
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
  const free = ['Your first answer marked free, no account needed', 'Then 3 days free when you sign up, no card needed', '3 answers marked and 3 tutor questions a day', 'Then 1 answer marked free every week, for good'];
  const pro = ['Up to 30 answers marked a day', 'Your tutor on your modules', 'Rewrite and resubmit as often as you like', 'Or £39 a year, or £12 for an exam-season pass'];
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
              <div className="absolute inset-[-60%] animate-[spin_6s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,var(--color-vio)_70deg,var(--color-cyan)_140deg,transparent_200deg)]" />
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

// Society codes: a society gives its members a code (e.g. UCLLAWSOC) for free Pro. Visitors can check it here before they
// have an account; it's remembered on this device and the dashboard applies it (rpc redeem_code) once they're signed in.
export function CodeBox() {
  const [val, setVal] = useState('');
  const [st, setSt] = useState('idle'); // idle | checking | ok | bad
  const [info, setInfo] = useState(null);
  const [authed, setAuthed] = useState(false);
  const ran = useRef(false);
  const check = (raw) => {
    const v = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    if (v.length < 3) { setSt('bad'); setInfo({ message: 'Enter the code your society shared.' }); return; }
    setSt('checking'); track('code_check');
    fetch(SB_URL + '/rest/v1/rpc/check_code', { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_code: v }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.ok) {
          try { localStorage.setItem('unizy:promo', d.code); } catch (e) {}
          track('code_ok'); setSt('ok'); setInfo(d);
        } else { setSt('bad'); setInfo({ message: (d && d.message) || 'Couldn’t check that code. Try again.' }); }
      })
      .catch(() => { setSt('bad'); setInfo({ message: 'Couldn’t check that code. Try again.' }); });
  };
  useEffect(() => {
    setAuthed(hasSession());
    if (ran.current) return; ran.current = true;
    try {
      const q = new URLSearchParams(location.search).get('code');
      if (q) { const v = q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20); setVal(v); check(v); }
      // ?code= links, /code and the menu's Code link (/#code) land here. The page above is still settling when the browser
      // jumps to #code, so scroll again once it has, and focus the box when it's empty.
      if (q || location.hash === '#code') {
        const to = () => {
          const el = document.getElementById('code'); if (!el) return;
          el.scrollIntoView({ behavior: 'auto', block: 'center' });
          if (!q) el.querySelector('input')?.focus({ preventScroll: true });
        };
        [400, 1200, 2400].forEach((ms) => setTimeout(to, ms));
      }
    } catch (e) {}
  }, []);
  const go = authed ? '/dashboard?code=' + (info && info.code) : '/signup?code=' + (info && info.code) + '&ref=society';
  return (
    <section id="code" className="relative scroll-mt-24 pb-10 lg:pb-16">
      <div className="wrap">
        <Reveal>
          <div className="glass mx-auto max-w-[900px] rounded-[30px] p-6 sm:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-[380px]">
                <h3 className="font-display text-[22px] font-semibold">Got a society code?</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-mute">Societies we partner with give their members free Pro. Enter the code they shared with you.</p>
              </div>
              <form className="flex w-full gap-2 md:max-w-[400px]" onSubmit={(e) => { e.preventDefault(); check(val); }}>
                <input
                  value={val}
                  onChange={(e) => { setVal(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)); if (st !== 'checking') setSt('idle'); }}
                  aria-label="Society code" placeholder="e.g. UCLLAWSOC" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20}
                  className="min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-5 py-3 font-mono text-[15px] uppercase tracking-wider outline-none focus:border-ink/40"
                />
                <button type="submit" disabled={st === 'checking'} className="btn btn-ghost shrink-0 px-5 py-3">{st === 'checking' ? 'Checking…' : 'Apply'}</button>
              </form>
            </div>
            <div aria-live="polite">
              {st === 'ok' && info && (
                <div className="mt-5 rounded-2xl bg-cyan/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[15px]"><span className="font-semibold">{info.label}</span> code works: free Pro until {info.until_text}.{authed ? '' : ' Create your free account to switch it on.'}</p>
                      {(info.uni_name || info.course) && (
                        <p className="mt-2 inline-block rounded-lg bg-white/80 px-3 py-1.5 text-[14.5px] font-semibold">{[info.uni_name, info.course].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                      <a href={go} onClick={() => track('code_apply')} className="btn btn-glow px-5 py-2.5">{authed ? 'Add Pro to my account' : 'Create my account'}</a>
                      {!authed && <a href="/login?next=/dashboard" onClick={() => track('code_apply')} className="text-[14px] text-mute underline hover:text-ink">I have an account</a>}
                    </div>
                  </div>
                  {info.modules && info.modules.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[14px] text-mute">Your first-year modules, each with a full practice pack:</p>
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {info.modules.map((m) => (
                          <li key={m.code}>
                            <a href={'/modules/' + m.code} className="flex items-baseline gap-2 rounded-xl bg-white/80 px-3 py-2 text-[14px] hover:bg-white">
                              <span className="font-mono font-semibold">{m.code}</span>
                              <span className="min-w-0 flex-1 truncate">{m.title}</span>
                              {m.questions > 0 && <span className="shrink-0 text-[12.5px] text-mute">{m.questions} Qs</span>}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {st === 'bad' && info && <p className="mt-4 text-[14.5px] text-[#b4412f]">{info.message}</p>}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const QA = [
  ['Is this cheating?', 'No. Unizy is for exam practice and revision. It refuses to mark coursework you’re going to submit, and it never writes work for you to hand in.'],
  ['Does it have my exact past papers?', 'We don’t host university exam papers. Paste a question from your own past paper and we’ll mark your answer to it, or use one of our exam-style questions written from the module’s official description.'],
  ['How accurate is the marking?', 'It’s a practice estimate, so you always see a mark range rather than a single number. It marks against your university’s published grade bands and, where your department publishes them, its own criteria. On every result you can tell us the real mark you got for a similar answer, and we use those to check the marker stays accurate.'],
  ['Which universities and modules?', 'UCL, Imperial, Queen Mary, LSE and King’s. You can search over 11,000 modules from each university’s own published catalogue, programme specifications or module directory. 20 big UCL first-year modules have full packs, checked twice. Any other module gets a starter set of practice questions the first time someone opens it, saved for everyone.'],
  ['Is Unizy part of my university?', 'No. Unizy is an independent revision tool built by a London student. It isn’t affiliated with or endorsed by UCL, Imperial, Queen Mary, LSE, King’s or any other university.'],
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
                  <span className={`faq-plus grid size-8 shrink-0 place-items-center rounded-full border border-ink/15 text-lg text-lilac ${open === i ? 'is-open' : ''}`}>+</span>
                </button>
                <div className={`faq-body ${open === i ? 'is-open' : ''}`} aria-hidden={open !== i} inert={open !== i}>
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 text-[15.5px] leading-relaxed text-mute">{a}</p>
                  </div>
                </div>
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
              <a href="/try" onClick={() => track('lp_final_signup')} className="btn btn-glow px-8 py-4.5 text-[17px]">Mark one answer free</a>
            </Magnetic>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const links = [['Find your module', '/mark'], ['Pricing', '/pricing'], ['Society code', '/#code'], ['Reviews', '/reviews'], ['FAQ', '/faq'], ['Trust & safety', '/trust'], ['Privacy', '/privacy.html'], ['Terms', '/terms.html'], ['Contact', 'mailto:hello@unizy.uk']];
  return (
    <footer className="border-t border-ink/[.07] py-12">
      <div className="wrap">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-x-6 gap-y-0 text-[14px] text-mute md:gap-y-2" aria-label="Footer">
            {links.map(([t, h]) => <a key={h} href={h} className="py-2.5 hover:text-ink md:py-0">{t}</a>)}
            <button type="button" data-replay-intro className="cursor-pointer py-2.5 text-left hover:text-ink md:py-0">Replay intro</button>
          </nav>
        </div>
        <p className="mt-8 max-w-[900px] text-[12.5px] leading-relaxed text-dim">
          Unizy is an independent revision tool for university students. It is not affiliated with or endorsed by UCL, Imperial College London, Queen Mary University of London, LSE or any other university. Marks are practice estimates, not official marks. Practice questions are written for revision and are not taken from any university’s exam papers. The dashboard shown above is an illustration. © 2026 Unizy
        </p>
      </div>
    </footer>
  );
}
