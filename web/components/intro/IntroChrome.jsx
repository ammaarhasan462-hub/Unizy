// The words and controls that sit on top of the 3D intro. Presentational only: Intro.jsx owns the scroll and
// drives opacity and position through the refs passed in here, so nothing re-renders per frame.
//
// Copy rules: deadpan, specific, written for someone revising at 1am. No product-launch words. Every chapter
// carries a "receipt" line: a small, real-looking detail (a Moodle breadcrumb, the class bands, a mark range)
// that grounds the claim above it.

// "Some *words*" -> the starred words set in the italic cut of the serif
export function Em({ s }) {
  return s.split(/(\*[^*]+\*)/).map((part, i) =>
    part.startsWith('*') ? <em key={i} className="intro-ed-i">{part.slice(1, -1)}</em> : <span key={i}>{part}</span>,
  );
}

// ------------------------------------------------------------------ copy
// Chapters by number. `r` is the receipt line. Per-university copy overrides fields by chapter number.
export const CHAPTERS = [
  { n: '01', k: 'The problem', t: 'Past papers. *No answers.*', s: 'Moodle has years of past papers for most modules and a model answer for almost none of them. You find out what a 2:1 looks like when results come out.', r: ['Moodle', 'Past exam papers', '2019–2025', 'model answers: 0'] },
  { n: '02', k: 'Coverage', t: 'Start with *the big ones*.', s: 'Full packs for 20 big first-year modules: every topic in depth, every exam question with an answer plan, checked twice. Any other module gets a starter set the first time someone opens it.', r: ['ECON0002', 'LAWS0001', 'STAT0002', '17 more'] },
  { n: '03', k: 'The standard', t: '70 is a First. *This is what 70 reads like.*', s: 'Marked against UCL’s class bands and, where your department publishes them, its own criteria. Not word count. Not effort.', r: ['70+ First', '60–69 2:1', '50–59 2:2', '40–49 Third'] },
  { n: '04', k: 'Practice', t: 'Write it like it’s *the exam*.', s: 'Questions written in your module’s style. No notes, no second tab, nobody checking.', r: ['Question 3', '45 minutes', 'answer any two'] },
  { n: '05', k: 'Feedback', t: 'A mark, then *the reasons*.', s: 'A mark range, the sentence that cost you, and three changes that would move it up a class.', r: ['62–66', '2:1', 'asked to evaluate, chose to describe'] },
];
export const COPY = {
  ucl: {
    kicker: 'University College London',
    title: 'The mark scheme your department *never sent.*',
    sub: 'Full packs for 20 big first-year modules. Search any UCL module and practise.',
    sample: { code: 'ECON0013', title: 'Microeconomics', crit: 'UCL Economics criteria', mark: '64', range: '62–66', cls: '2:1', note: 'You describe the model well. The question asked you to evaluate it. That’s the 2:1.' },
    ch: {},
  },
  imperial: {
    kicker: 'Imperial College London',
    title: 'The mark scheme your department *never sent.*',
    sub: 'Search 1,180 Imperial modules. Practice questions are written the first time you open one.',
    place: 'South *Kensington*',
    sample: { code: 'Practice question', title: 'A uniform rod swinging about one end', crit: 'Imperial class bands', mark: '64', range: '62–66', cls: '2:1', note: 'Correct method, but the small-angle step is asserted, not justified. Two marks.' },
    ch: {
      '01': { s: 'Your department posts the past papers. The worked solutions stay with the examiners. You find out where the marks went when results come out.', r: ['Past papers', '2019–2025', 'worked solutions: 0'] },
      '02': { t: 'Straight from *the programme specs*.', s: '1,180 modules across 18 departments, each checked against Imperial’s own programme specifications.', r: ['MATH40001', 'COMP40008', 'MECH40001', '1,177 more'] },
      '03': { s: 'Marked against Imperial’s class bands and, where your department publishes them, its own criteria.' },
      '04': { s: 'Questions written in your module’s style. Show your working; the method marks are where it’s won.', r: ['Question 2', '20 marks', 'show your working'] },
    },
  },
};
COPY.qmul = {
  kicker: 'Queen Mary University of London',
  title: 'The mark scheme your school *never sent.*',
  sub: 'Search 2,194 Queen Mary modules. Practice questions are written the first time you open one.',
  place: 'Mile *End*',
  sample: { code: 'Practice question', title: 'Long-run equilibrium in perfect competition', crit: 'Queen Mary marking scheme', mark: '66', range: '64–68', cls: '2:1', note: 'The entry argument is right. Show it on the diagram and define normal profit. That’s the First.' },
  ch: {
    '01': { s: 'QMplus has years of past papers for most modules and a model answer for almost none of them. You find out what a 2:1 looks like when results come out.', r: ['QMplus', 'Past exam papers', '2019–2025', 'model answers: 0'] },
    '02': { t: 'Straight from *the directory*.', s: '2,194 undergraduate modules from 20 schools and institutes, each checked against Queen Mary’s official module directory.', r: ['ECN115', 'HST4000U', 'MTH6110', '2,191 more'] },
    '03': { s: 'Marked against Queen Mary’s class bands and, where your school publishes them, its own criteria.' },
  },
};
COPY.lse = {
  kicker: 'London School of Economics',
  title: 'The mark scheme your department *never sent.*',
  sub: 'Search 579 LSE courses. Practice questions are written the first time you open one.',
  place: 'Houghton *Street*',
  sample: { code: 'EC1A3', title: 'Microeconomics I', crit: 'LSE marking scale', mark: '73', range: '72–75', cls: 'First', note: 'Clean Slutsky decomposition and the right condition. Label both effects on the diagram.' },
  ch: {
    '01': { s: 'Moodle has years of past exam papers for most courses and examiners’ comments for a few. A worked answer at First standard, almost never.' },
    '02': { t: 'Straight from *the Calendar*.', s: '579 undergraduate courses from 21 departments and units, each checked against the 2026/27 Calendar’s course guides.', r: ['EC1A3', 'GV100', 'MA100', '576 more'] },
    '03': { s: 'Marked against LSE’s marking scale and, where your department publishes them, its own criteria.' },
  },
};
export const chaptersFor = (uni) => CHAPTERS.map((c) => ({ ...c, ...((COPY[uni] || COPY.ucl).ch[c.n] || {}) }));

// ------------------------------------------------------------------ top bar
export function TopBar({ authed, uniShort, onSkip }) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-9 sm:py-6">
      <a href="/" onClick={(e) => { e.preventDefault(); onSkip(); }} className="group flex items-baseline gap-3 text-[#ece6da]" aria-label="Unizy">
        <span className="intro-ed text-[26px] leading-none tracking-[-.01em]">Unizy</span>
        {uniShort && <span className="hidden font-mono text-[10px] uppercase tracking-[.28em] text-[#ece6da]/45 sm:inline">/ {uniShort}</span>}
      </a>
      <nav className="flex items-center gap-1 text-[13px]">
        <a href={authed ? '/dashboard' : '/login?next=/dashboard'} className="hidden rounded-full px-4 py-2 text-[#ece6da]/60 transition-colors hover:text-[#ece6da] sm:inline-block">
          {authed ? 'Dashboard' : 'Log in'}
        </a>
        <button
          type="button"
          onClick={onSkip}
          className="flex items-center gap-2.5 rounded-full border border-[#ece6da]/15 bg-[#0d0f12]/40 py-2 pl-4 pr-2.5 text-[#ece6da]/80 backdrop-blur-md transition-colors hover:border-[#ece6da]/35 hover:text-[#ece6da]"
          data-testid="intro-skip"
        >
          Skip intro
          <kbd className="hidden rounded border border-[#ece6da]/15 px-1.5 py-px font-mono text-[9.5px] tracking-wider text-[#ece6da]/45 sm:inline">ESC</kbd>
        </button>
      </nav>
    </header>
  );
}

// ------------------------------------------------------------------ progress rail
// Hairline with chapter ticks; the current chapter's label sits beside it, and a counter reads "03 / 05".
export function ProgressRail({ railRef, fillRef, dotsRef, countRef, chapters, positions }) {
  return (
    <div ref={railRef} style={{ opacity: 0 }} className="pointer-events-none absolute right-6 top-1/2 z-10 hidden h-[38vh] -translate-y-1/2 sm:block" aria-hidden="true">
      <div className="relative h-full w-px bg-[#ece6da]/12">
        <div ref={fillRef} className="absolute inset-0 origin-top bg-[#d6a35c]" style={{ transform: 'scaleY(0)' }} />
        {chapters.map((c, i) => (
          <span
            key={c.n}
            ref={(el) => (dotsRef.current[i] = el)}
            data-on="0"
            className="group absolute -left-[4px] h-px w-[9px] bg-[#ece6da]/30 transition-colors duration-500 data-[on='1']:bg-[#d6a35c]"
            style={{ top: `${(positions[i] * 100).toFixed(1)}%` }}
          >
            <span className="absolute right-5 top-1/2 flex -translate-y-1/2 items-baseline gap-2 whitespace-nowrap opacity-0 transition-opacity duration-500 group-data-[cur='1']:opacity-100">
              <span className="font-mono text-[9.5px] tracking-[.2em] text-[#d6a35c]">{c.n}</span>
              <span className="text-[11.5px] text-[#ece6da]/60">{c.k}</span>
            </span>
          </span>
        ))}
      </div>
      <span ref={countRef} className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] tracking-[.2em] text-[#ece6da]/40">00 / 0{chapters.length}</span>
    </div>
  );
}

// ------------------------------------------------------------------ chapter
export function Chapter({ c, setRef, side }) {
  const right = side === 'right';
  return (
    <section
      ref={setRef}
      className={`pointer-events-none invisible absolute bottom-[11vh] w-full max-w-[680px] px-6 ${right ? 'right-0 sm:pl-14 sm:pr-44 sm:text-right' : 'left-0 sm:px-14'}`}
      style={{ opacity: 0 }}
    >
      <p className={`flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.26em] text-[#d6a35c]/90 ${right ? 'sm:justify-end' : ''}`}>
        <span>{c.n}</span><span className="h-px w-7 bg-[#d6a35c]/40" /><span className="text-[#ece6da]/55">{c.k}</span>
      </p>
      <h2 className="intro-ed mt-5 text-[clamp(40px,5.6vw,86px)] leading-[.98] text-[#f1ece2]"><Em s={c.t} /></h2>
      <p className={`mt-6 max-w-[430px] text-[15.5px] leading-[1.65] text-[#ece6da]/72 ${right ? 'sm:ml-auto' : ''}`}>{c.s}</p>
      {c.r && (
        <p className={`mt-7 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] tracking-[.06em] text-[#ece6da]/42 ${right ? 'sm:justify-end' : ''}`}>
          {c.r.map((x, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-[#ece6da]/25">{c.n === '03' ? '·' : '›'}</span>}
              <span className={i === c.r.length - 1 ? 'text-[#d6a35c]/75' : ''}>{x}</span>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ opening title
export function StartTitle({ setRef, copy }) {
  return (
    <div ref={setRef} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.3em] text-[#ece6da]/55">
        <span>Unizy</span><span className="h-px w-8 bg-[#ece6da]/30" /><span>{copy.kicker}</span>
      </p>
      <h1 className="intro-ed mt-8 max-w-[1100px] text-[clamp(44px,7vw,112px)] leading-[.95] text-[#f3eee4]"><Em s={copy.title} /></h1>
      <p className="mt-8 text-[14.5px] text-[#ece6da]/60">{copy.sub}</p>
    </div>
  );
}

// ------------------------------------------------------------------ end card
export function EndCard({ setRef, authed, uni, onEnter, onCta }) {
  const sample = (COPY[uni] && COPY[uni].sample) || COPY.ucl.sample;
  return (
    <div ref={setRef} className="pointer-events-none invisible absolute inset-x-0 bottom-0 px-6 pb-[8vh] sm:pl-14 sm:pr-24" style={{ opacity: 0 }}>
      <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
        <div>
          <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.26em] text-[#d6a35c]/90"><span>06</span><span className="h-px w-7 bg-[#d6a35c]/40" /><span className="text-[#ece6da]/55">Marked</span></p>
          <h2 className="intro-ed mt-5 text-[clamp(42px,6vw,92px)] leading-[.96] text-[#f3eee4]"><Em s="Find out what your answer would *get.*" /></h2>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={authed ? '/dashboard/practice' : '/try'} onClick={onCta} className="rounded-full bg-[#ece6da] px-6 py-3 text-[14px] font-medium text-[#121417] transition-colors hover:bg-white">
              {authed ? 'Back to my modules' : 'Mark my first answer free'}
            </a>
            <button type="button" onClick={onEnter} data-testid="intro-enter" className="rounded-full border border-[#ece6da]/20 bg-[#0d0f12]/55 px-6 py-3 backdrop-blur-md text-[14px] text-[#ece6da]/80 transition-colors hover:border-[#ece6da]/45 hover:text-[#ece6da]">
              Enter Unizy ↓
            </button>
          </div>
          <p className="mt-5 text-[12.5px] text-[#ece6da]/40">{authed ? '' : 'No sign-up needed for your first marked answer. '}Practice only. Your actual coursework stays your own.</p>
        </div>
        {/* a marked answer, as it comes back */}
        <article className="w-full max-w-[380px] rounded-2xl border border-[#ece6da]/10 bg-[#101215]/70 p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] backdrop-blur-xl">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[.14em] text-[#ece6da]/45">{sample.code} · {sample.crit}</p>
              <p className="mt-1.5 text-[14px] text-[#ece6da]/85">{sample.title}</p>
            </div>
            <div className="text-right">
              <p className="intro-ed text-[44px] leading-none text-[#f3eee4]">{sample.mark}</p>
              <p className="mt-1 font-mono text-[10px] tracking-[.12em] text-[#d6a35c]">{sample.range} · {sample.cls}</p>
            </div>
          </header>
          <div className="mt-4 h-px bg-[#ece6da]/10" />
          <p className="mt-4 text-[13.5px] leading-relaxed text-[#ece6da]/70">{sample.note}</p>
          <ol className="mt-4 space-y-1.5 text-[12.5px] text-[#ece6da]/55">
            <li><span className="font-mono text-[#d6a35c]/70">1</span>  Name the criterion before you use it</li>
            <li><span className="font-mono text-[#d6a35c]/70">2</span>  Cut the second paragraph by half</li>
            <li><span className="font-mono text-[#d6a35c]/70">3</span>  End on a judgement, not a summary</li>
          </ol>
        </article>
      </div>
    </div>
  );
}
