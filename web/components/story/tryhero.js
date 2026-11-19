// Homepage "try it" hero (Nov 2026): the first thing a visitor sees is a real exam-style question with an answer box.
//   "Try it with a sample answer" shows a real marked result instantly (saved output of the marker on the answer below).
//   "Mark my answer free" sends the visitor's own answer to the marker's guest_mark action (one free mark, no account).
// Also: find-your-module search over the full packs, trust lines, pricing line and a real weekly count of marked answers.
// Plain JS (no React), mounted by mountStory() in story.js.

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

// The hero question: UCL ECON0002 Economics, topic 1, exam-style (from module_questions).
const Q = {
  code: 'ECON0002', title: 'Economics', uni: 'UCL', poss: 'UCL’s',
  id: '3072a41a-e40e-4f0b-9e63-46dbc46f9654',
  text: 'Real GDP per capita is widely used to compare living standards across countries and over time. Discuss its strengths and limitations as a measure of economic performance, and explain what additional measures are needed to capture inequality and stability.',
};

// A typical first-year answer and what the marker actually returned for it (16 Nov 2026, guest_mark, unedited apart from trimming).
const SAMPLE_ANSWER = `Real GDP per capita measures the value of goods and services produced per person, adjusted for inflation, so it is useful for comparing countries and seeing how living standards change over time. It is widely available and calculated in a similar way across countries, which makes comparisons easier. A country with higher GDP per capita can usually afford better healthcare, education and infrastructure.

However, GDP per capita has limitations. It is an average, so it does not show how income is distributed. A country could have high GDP per capita but most of the income goes to a small group of people. It also ignores things like unpaid work, leisure time and pollution, so a country could grow quickly while people are not actually better off. It also does not show how stable the economy is, for example whether growth is followed by a recession.

To capture inequality we could use the Gini coefficient, and to capture stability we could look at unemployment and inflation. Overall GDP per capita is a good starting point but should be used alongside other measures.`;

const SAMPLE_RESULT = {
  class: '2:2', mark_low: 50, mark_high: 54,
  headline: 'A correct but very brief answer that names the right limitations and measures without explaining or evidencing any of them, so it sits in the 2:2 band.',
  lost: [
    { quote: 'It is widely available and calculated in a similar way across countries, which makes comparisons easier.', issue: 'The strength is asserted without saying what makes comparison valid: no mention of PPP adjustment for price levels, or of what “real” removes.', fix: 'Explain that PPP exchange rates adjust for price levels and real values strip out inflation, then note what still limits comparisons.' },
    { quote: 'It is an average, so it does not show how income is distributed.', issue: 'Correct but undeveloped: it doesn’t explain how the mean can drift away from typical household income, and gives no evidence.', fix: 'Contrast mean and median income: a few very high incomes can raise GDP per capita without raising typical living standards.' },
    { quote: 'It also ignores things like unpaid work, leisure time and pollution, so a country could grow quickly while people are not actually better off.', issue: 'Three separate limitations packed into one sentence, with no explanation of how each one biases the measure.', fix: 'Take each in turn: unpaid work understates output, leisure is a welfare gain not counted, pollution is a cost not subtracted.' },
    { quote: 'To capture inequality we could use the Gini coefficient, and to capture stability we could look at unemployment and inflation.', issue: 'The Gini coefficient is named but not explained, and the stability measures aren’t tied to volatility or to welfare.', fix: 'Define the Gini via the Lorenz curve (0 = perfect equality, 1 = perfect inequality), add growth volatility, and say what each measure misses.' },
  ],
  changes: [
    { change: 'Explain each limitation with a mechanism and an example, not just a list. For inequality, contrast mean with median income and show how the Gini is read from the Lorenz curve.' },
    { change: 'Develop stability beyond “unemployment and inflation”: growth volatility, the depth and frequency of recessions, and why instability lowers welfare.' },
    { change: 'Add evidence: one real cross-country or historical comparison where GDP per capita and wellbeing diverge, plus PPP and the quality of goods.' },
  ],
};

// Modules with full practice packs (module_packs status = done), for "Find your module". [code, title, uni]
const PACKS = [
  ['CHEM40006', 'Reactivity at Carbon Centres', 'Imperial'], ['COMP40008', 'Graphs and Algorithms', 'Imperial'], ['ELEC40002', 'Analysis and Design of Circuits', 'Imperial'],
  ['LIFE40001', 'Biological Chemistry', 'Imperial'], ['LIFE40006', 'Cell Biology and Genetics', 'Imperial'], ['MATH40002', 'Analysis 1', 'Imperial'],
  ['MATH40004', 'Calculus and Applications', 'Imperial'], ['MECH40003', 'Thermodynamics 1', 'Imperial'], ['PHYS40002', 'Mechanics and Relativity', 'Imperial'],
  ['AC102', 'Elements of Financial Accounting', 'LSE'], ['EC1A3', 'Microeconomics I', 'LSE'], ['EC1B3', 'Macroeconomics I', 'LSE'],
  ['GV100', 'Introduction to Political Theory', 'LSE'], ['GV101', 'Introduction to Political Science', 'LSE'], ['HY116', 'International Politics since 1914: Peace and War', 'LSE'],
  ['IR100', 'International Relations: Theories, Concepts and Debates', 'LSE'], ['MA100', 'Mathematical Methods', 'LSE'], ['PH103', 'The Big Questions: An Introduction to Philosophy', 'LSE'],
  ['ST102', 'Elementary Statistical Theory', 'LSE'], ['BIO116', 'Cells', 'Queen Mary'], ['BIO161', 'Basic Biochemistry', 'Queen Mary'], ['BMD113', 'Human Anatomy', 'Queen Mary'],
  ['BMD121', 'Biomedical Physiology I', 'Queen Mary'], ['BMD164', 'Genetics', 'Queen Mary'], ['BUS280', 'Introduction to Marketing and Communications', 'Queen Mary'],
  ['BUS281', 'Management and Organisational Behaviour', 'Queen Mary'], ['BUS4002U', 'Fundamentals of Management', 'Queen Mary'], ['ECN106', 'Macroeconomics I', 'Queen Mary'],
  ['ECN111', 'Microeconomics I', 'Queen Mary'], ['ECN113', 'Principles of Economics', 'Queen Mary'], ['ECN115', 'Mathematical Methods in Economics and Finance', 'Queen Mary'],
  ['ECN214', 'Games and Strategies', 'Queen Mary'], ['ECS401U', 'Procedural Programming', 'Queen Mary'], ['ECS407U', 'Logic and Discrete Structures', 'Queen Mary'],
  ['EMS460U', 'Fluid Mechanics and Thermodynamics', 'Queen Mary'], ['LAW4001', 'Public Law', 'Queen Mary'], ['LAW4006', 'Land Law', 'Queen Mary'],
  ['LAW4009', 'European Union Law', 'Queen Mary'], ['LAW4104', 'Contract Law I: Formation and Vitiation', 'Queen Mary'], ['LAW4105', 'Contract Law II: Terms, Breach and Remedies', 'Queen Mary'],
  ['MED41B3', 'Medicine Part 1, Section B: Health', 'Queen Mary'], ['MED52B3', 'Medicine Part 2, Section B: Disease', 'Queen Mary'], ['MTH5123', 'Differential Equations', 'Queen Mary'],
  ['MTH5129', 'Probability and Statistics II', 'Queen Mary'], ['POL105', 'Political Analysis', 'Queen Mary'], ['POL108', 'Background to British Politics', 'Queen Mary'],
  ['POL110', 'Thinking Politically', 'Queen Mary'], ['POL263', 'Modern Political Thought 1', 'Queen Mary'], ['PSY121', 'Brain and Behaviour', 'Queen Mary'],
  ['PSY211', 'Cognitive Psychology', 'Queen Mary'], ['PSY215', 'Social Psychology', 'Queen Mary'], ['ANAT0001', 'Introduction to Anatomy and Development', 'UCL'],
  ['BIOC0001', 'Biochemistry and Molecular Biology', 'UCL'], ['BIOL0003', 'Introduction to Genetics', 'UCL'], ['CHEM0008', 'Basic Organic Chemistry', 'UCL'],
  ['CHEM0011', 'Chemistry for Biologists', 'UCL'], ['COMP0002', 'Principles of Programming', 'UCL'], ['COMP0003', 'Theory of Computation', 'UCL'],
  ['COMP0004', 'Object-Oriented Programming', 'UCL'], ['COMP0005', 'Algorithms', 'UCL'], ['ECON0002', 'Economics', 'UCL'], ['ECON0004', 'Applied Economics', 'UCL'],
  ['ECON0006', 'Introduction to Mathematics for Economics', 'UCL'], ['ECON0007', 'The World Economy', 'UCL'], ['ECON0010', 'Mathematics for Economics', 'UCL'],
  ['HIST0003', 'Approaching History', 'UCL'], ['LAWS0001', 'Contract Law', 'UCL'], ['LAWS0002', 'Property I', 'UCL'], ['LAWS0007', 'Criminal Law', 'UCL'],
  ['MATH0003', 'Analysis 1', 'UCL'], ['MATH0004', 'Analysis 2', 'UCL'], ['MATH0005', 'Algebra 1', 'UCL'], ['MATH0006', 'Algebra 2', 'UCL'],
  ['MSIN0002', 'Principles of Strategic Management', 'UCL'], ['MSIN0004', 'Accounting for Business', 'UCL'], ['MSIN0012', 'Business Economics I', 'UCL'],
  ['NEUR0004', 'Introduction to Neuroscience', 'UCL'], ['PALS0007', 'Perception, Attention and Learning', 'UCL'], ['PALS0008', 'Memory', 'UCL'],
  ['PHAS0002', 'Mathematical Methods 1', 'UCL'], ['PHAS0010', 'Classical Mechanics', 'UCL'], ['PHIL0003', 'Knowledge and Reality', 'UCL'],
  ['PHIL0006', 'Introduction to Moral Philosophy', 'UCL'], ['PHOL0001', 'Mammalian Physiology', 'UCL'], ['POLS0002', 'Democracy and Authoritarianism', 'UCL'],
  ['POLS0006', 'Introduction to Politics', 'UCL'], ['POLS0061', 'Foundations of Political Thought', 'UCL'], ['STAT0002', 'Introduction to Probability and Statistics', 'UCL'],
  ['STAT0003', 'Further Probability and Statistics', 'UCL'],
];
const N_PACKS = PACKS.length;

const QUESTION_CARD = `
  <div class="th-qhead"><span class="th-chip"><code>${Q.code}</code>${Q.title} · ${Q.uni}</span><span class="th-time">⏱ 5-minute question</span></div>
  <p class="th-q">${esc(Q.text)}</p>
  <label class="th-lab" for="th-ans">Your answer</label>
  <textarea id="th-ans" class="th-ans" data-ans rows="6" placeholder="Write 150–200 words. Bullet points are fine."></textarea>
  <div class="th-meta"><span data-wc>0 words · aim for 150–200</span><span>Saved on this device</span></div>
  <div class="th-err" data-err role="status" hidden></div>
  <div class="th-btns">
    <button type="button" class="uz-btn uz-btn-gold th-go" data-mark><span>Mark my answer free</span>${ARROW}</button>
    <button type="button" class="th-sample" data-sample>Or see it marked with a sample answer</button>
  </div>
  <p class="th-fine">No sign-up for your first marked answer. Exam practice only, never coursework.</p>`;

export const TRY_HTML = `
<section class="th" id="try" data-try aria-label="Try Unizy now">
  <div class="th-wrap">
    <div class="th-intro">
      <span class="uz-kick">UCL · Imperial · LSE · Queen Mary</span>
      <h1 class="th-h">The mark scheme your uni never&nbsp;gave&nbsp;you.</h1>
      <p class="th-sub">Answer a real exam-style question. In about 20 seconds you’ll see <b>your class</b>, <b>the exact sentences that lost marks</b>, and <b>3 changes to go up a class</b>, marked against your uni’s grade bands.</p>
    </div>
    <div class="th-card" data-card aria-live="polite">${QUESTION_CARD}</div>
    <div class="th-extra">
      <form class="th-find" data-find role="search" onsubmit="return false">
        <label for="th-find-in" class="th-lab">Find your module</label>
        <div class="th-findbox"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <input id="th-find-in" data-find-in type="search" autocomplete="off" placeholder="Code or name, e.g. EC1A3 or Contract Law"></div>
        <ul class="th-res" data-find-res hidden></ul>
        <p class="th-note">${N_PACKS} first-year modules with full practice packs, more added every week.</p>
      </form>
      <ul class="th-trust">
        <li><b>Built by a UCL student</b> who wanted the mark scheme too</li>
        <li><b>Your answers stay private.</b> Only you can see them</li>
        <li><b>Free to start:</b> 1 answer marked with no sign-up, then 3 days free. Pro is £5.99 a month, or £12 for the whole exam season. <a href="#pricing">Pricing</a></li>
      </ul>
      <p class="th-week" data-week hidden></p>
      <p class="th-week" data-acc hidden></p>
    </div>
  </div>
</section>`;

function words(s) { const t = String(s || '').trim(); return t ? t.split(/\s+/).length : 0; }
function firstSentence(s) { const t = String(s || ''); const i = t.search(/\.\s/); return i > 40 ? t.slice(0, i + 1) : t; }

// The answer with each lost-marks quote highlighted and numbered.
function annotate(answer, lost) {
  const marks = [];
  (lost || []).forEach((l, i) => {
    const q = String(l.quote || '').trim(); if (!q) return;
    const at = answer.indexOf(q);
    if (at >= 0 && !marks.some((m) => at < m.end && at + q.length > m.start)) marks.push({ start: at, end: at + q.length, i });
  });
  marks.sort((a, b) => a.start - b.start);
  let out = '', pos = 0;
  marks.forEach((m) => { out += esc(answer.slice(pos, m.start)) + `<mark data-n="${m.i + 1}">${esc(answer.slice(m.start, m.end))}<sup>${m.i + 1}</sup></mark>`; pos = m.end; });
  out += esc(answer.slice(pos));
  return out.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

// The sign-up ask: after a free mark it leads with the visitor's grade; when the free mark is used up it offers
// more practice. One email box: /signup?send=1 emails a code straight away (no password, no card).
const NEXTCLS = { Fail: 'a Third', Third: 'a 2:2', '2:2': 'a 2:1', '2:1': 'a First', First: 'a high First' };
function saveHtml(kind, r) {
  let head, perks;
  if (kind === 'limit') {
    head = 'Keep practising, free';
    perks = ['You’ve used your free marked answer. Sign up and get 3 marked answers a day for 3 days', 'Then 1 free marked answer every week, and a plan for your weakest topics every Monday', 'Your answer is kept, ready to mark'];
  } else {
    const c = r && r.class, nx = NEXTCLS[c];
    head = c ? `Save your ${c === 'Fail' ? 'mark' : c}${nx ? ` and see how to reach ${nx}` : ''}` : 'Save this mark';
    perks = ['Keep this mark and the feedback in your own account', 'Rewrite your weakest paragraph and watch your mark move', 'A plan for your weakest topics every Monday, and 1 free marked answer every week'];
  }
  const compact = kind === 'end';
  return `<form class="th-save${compact ? ' end' : ''}" data-save-form="${kind}" novalidate>
    <b class="th-savehead">${esc(head)}</b>
    ${compact ? '' : `<ul class="th-perks">${perks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`}
    <div class="th-saverow"><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="Personal or uni email" aria-label="Your email" required>
      <button type="submit" class="uz-btn uz-btn-gold"><span>${kind === 'limit' ? 'Keep practising, free' : 'Save my grade, free'}</span>${ARROW}</button></div>
    <p class="th-saveerr" hidden></p>
    <p class="th-savefine">Takes 20 seconds: we email you a code, no password and no card.</p>
  </form>`;
}

function resultHtml(r, answer, opts) {
  const lost = (r.lost || []).slice(0, 4), changes = (r.changes || []).slice(0, 3);
  const cls = esc(r.class || ''), range = r.mark_low != null ? `${r.mark_low}–${r.mark_high}` : '';
  const ccls = { First: 'c1', '1st': 'c1', '2:1': 'c21', '2:2': 'c22', Third: 'c3' }[r.class] || 'c22';
  return `
  <div class="th-rhead">
    ${opts.sample ? '<span class="th-tag">Sample answer · real marking</span>' : '<span class="th-tag">Your answer</span>'}
    <button type="button" class="th-back" data-back>← ${opts.sample ? 'Try your own' : 'Back to the question'}</button>
  </div>
  <div class="th-grade"><span class="th-cls ${ccls}">${cls}</span><div><b>${range}</b><small>predicted mark range · ${esc(Q.poss)} grade bands</small></div></div>
  <p class="th-headline">${esc(r.headline || '')}</p>
  ${opts.sample ? '' : saveHtml('top', r)}
  <div class="th-sec"><h3>Where you lost marks</h3>
    <div class="th-annot">${annotate(answer, lost)}</div>
    <ol class="th-lost">${lost.map((l, i) => `<li data-n="${i + 1}"><span class="n">${i + 1}</span><div><p>${esc(l.issue)}</p><p class="fix"><b>Fix:</b> ${esc(l.fix)}</p></div></li>`).join('')}</ol>
  </div>
  <div class="th-sec"><h3>3 changes to go up a class</h3>
    <ol class="th-chg">${changes.map((c) => `<li>${esc(firstSentence(c.change))}</li>`).join('')}</ol>
  </div>
  <div class="th-cta">
    ${opts.sample
      ? `<button type="button" class="uz-btn uz-btn-gold" data-back><span>Now mark my own answer free</span>${ARROW}</button>
         <a class="th-link" href="/modules/${Q.code}?q=start" data-track-local="hero_find_open">Or practise on your own module</a>`
      : saveHtml('end', r)}
  </div>
  <p class="th-fine">${opts.sample ? 'This is real output from the Unizy marker for the sample answer, trimmed to fit.' : 'A practice estimate, not an official mark. Saved to your account when you sign up (email only, no card).'}</p>`;
}

export function mountTry(root, opts = {}) {
  const sec = root && root.querySelector('[data-try]');
  if (!sec) return () => {};
  const track = opts.track || (() => {});
  const card = sec.querySelector('[data-card]');
  const offs = [];
  const on = (el, ev, fn, o) => { if (!el) return; el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
  const DKEY = 'unizy:herodraft', GKEY = 'unizy:guestmark', CKEY = 'unizy:guestclaim';
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  let busy = false, typedOnce = false;

  function showQuestion(focus) {
    card.innerHTML = QUESTION_CARD;
    const ta = card.querySelector('[data-ans]');
    ta.value = ls.get(DKEY) || '';
    updateWc();
    if (opts.authed) { const b = card.querySelector('[data-mark] span'); if (b) b.textContent = 'Mark it in my dashboard'; }
    if (focus) { card.scrollIntoView({ block: 'start', behavior: 'smooth' }); setTimeout(() => ta.focus({ preventScroll: true }), 350); }
  }
  function updateWc() {
    const ta = card.querySelector('[data-ans]'), wc = card.querySelector('[data-wc]'); if (!ta || !wc) return;
    const n = words(ta.value);
    wc.textContent = `${n} word${n === 1 ? '' : 's'} · ${n < 40 ? 'aim for 150–200' : n <= 260 ? 'good length' : 'longer is fine too'}`;
    wc.classList.toggle('ok', n >= 40);
  }
  function err(msg, html) { const e = card.querySelector('[data-err]'); if (!e) return; e.classList.remove('th-limitbox'); e.hidden = !msg; e.innerHTML = html ? msg : esc(msg); }
  function limit() {
    const e = card.querySelector('[data-err]'); if (!e) return;
    track('hero_limit_seen');
    e.hidden = false; e.classList.add('th-limitbox'); e.innerHTML = saveHtml('limit');
    e.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  // email box -> sign-up page, which sends the code straight away. A visitor who hit the limit gets their answer
  // carried over to the module page (mark.js drafts), so it's in the box when they come back signed in.
  card.addEventListener('submit', (ev) => {
    const f = ev.target.closest && ev.target.closest('form[data-save-form]'); if (!f) return;
    ev.preventDefault();
    const em = (f.querySelector('input[name=email]').value || '').trim(), er = f.querySelector('.th-saveerr');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { er.hidden = false; er.textContent = 'Enter a valid email address.'; f.querySelector('input').focus(); return; }
    const kind = f.getAttribute('data-save-form');
    let next = '/modules/' + Q.code;
    if (kind === 'limit') {
      next = `/modules/${Q.code}?q=${Q.id}&v=answer`;
      try {
        const t = ls.get(DKEY), d = JSON.parse(localStorage.getItem('mark:drafts') || '{}');
        if (t) { d[Q.code + ':' + Q.id] = { t, at: Date.now() }; localStorage.setItem('mark:drafts', JSON.stringify(d)); }
      } catch (x) { /* storage off */ }
    }
    track(kind === 'limit' ? 'guest_limit_email' : 'hero_save_email');
    location.href = `/signup?send=1&email=${encodeURIComponent(em)}&next=${encodeURIComponent(next)}`;
  });
  function showResult(r, answer, sample) {
    card.innerHTML = resultHtml(r, answer, { sample });
    card.classList.add('res');
    if (innerWidth <= 900) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  on(card, 'input', (e) => {
    if (!e.target.matches('[data-ans]')) return;
    ls.set(DKEY, e.target.value); updateWc();
    if (!typedOnce) { typedOnce = true; track('hero_type'); }
  });
  on(card, 'click', (e) => {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.hasAttribute('data-sample')) { track('hero_sample'); showResult(SAMPLE_RESULT, SAMPLE_ANSWER, true); return; }
    if (t.hasAttribute('data-back')) { card.classList.remove('res'); showQuestion(true); return; }
    if (t.hasAttribute('data-save')) { track('hero_save'); return; }
    if (t.dataset.trackLocal) { track(t.dataset.trackLocal); return; }
    if (t.hasAttribute('data-mark')) submit();
  });

  function submit() {
    if (busy) return;
    const ta = card.querySelector('[data-ans]'), answer = (ta.value || '').trim();
    if (opts.authed) { location.href = `/dashboard/practice/${Q.code}?q=${Q.id}&v=answer`; return; }
    if (words(answer) < 40) { err('Write a bit more first: at least a short paragraph (40+ words), ideally 150–200.'); ta.focus(); return; }
    if (ls.get(GKEY)) { limit(); return; }
    busy = true; err('');
    const btn = card.querySelector('[data-mark]'); btn.disabled = true;
    const steps = ['Reading your answer…', 'Checking it against UCL’s grade bands…', 'Comparing it with the 2:1 and First descriptors…', 'Finding the sentences that cost marks…', 'Working out your 3 changes…', 'Nearly there…'];
    const t0 = Date.now(), paint = () => { btn.innerHTML = '<span class="th-spin"></span><span>' + steps[Math.min(steps.length - 1, Math.floor((Date.now() - t0) / 5000))] + '</span>'; };
    paint(); const tick = setInterval(() => { if (!btn.isConnected || !btn.disabled) { clearInterval(tick); return; } paint(); }, 1000);
    track('hero_mark_submit');
    fetch(opts.sbUrl + '/functions/v1/marker', {
      method: 'POST', headers: { apikey: opts.sbKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'guest_mark', code: Q.code, question_id: Q.id, answer, practice: true }),
    }).then((r) => r.json().catch(() => ({})).then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        busy = false;
        if (!ok) {
          if (b.code === 'guest_used') ls.set(GKEY, 'used');
          track('hero_mark_fail'); btn.disabled = false; btn.innerHTML = `<span>Mark my answer free</span>${ARROW}`;
          if (b.code === 'guest_used' || b.code === 'guest_busy') { limit(); return; }
          err(b.message || 'Something went wrong. Try again.');
          return;
        }
        ls.set(GKEY, 'used');
        if (b.claim && b.claim_sig) ls.set(CKEY, JSON.stringify({ code: Q.code, claim: b.claim, claim_sig: b.claim_sig }));
        track('hero_mark_done');
        showResult(b, answer, false);
      })
      .catch(() => { busy = false; track('hero_mark_fail'); btn.disabled = false; btn.innerHTML = `<span>Mark my answer free</span>${ARROW}`; err('Couldn’t reach the marker. Check your connection and try again.'); });
  }

  // find your module
  const fin = sec.querySelector('[data-find-in]'), fres = sec.querySelector('[data-find-res]');
  let findTracked = false;
  on(fin, 'input', () => {
    const q = fin.value.trim().toLowerCase();
    if (!findTracked && q) { findTracked = true; track('hero_find'); }
    if (q.length < 2) { fres.hidden = true; fres.innerHTML = ''; return; }
    const hits = PACKS.filter(([c, t, u]) => c.toLowerCase().startsWith(q) || t.toLowerCase().includes(q) || (q.length > 2 && u.toLowerCase().startsWith(q))).slice(0, 6);
    fres.hidden = false;
    fres.innerHTML = hits.length
      ? hits.map(([c, t, u]) => `<li><a href="/modules/${c}?q=start" data-open><code>${c}</code><span>${esc(t)}</span><em>${u}</em></a></li>`).join('')
      : `<li class="none">No full pack for that yet. <a href="/mark">Search every module</a></li>`;
  });
  on(fres, 'click', (e) => { if (e.target.closest('[data-open]')) track('hero_find_open'); });

  // accuracy from students' real marks: shown once at least 20 have been reported
  if (opts.sbUrl) {
    fetch(opts.sbUrl + '/rest/v1/rpc/accuracy_stats', { method: 'POST', headers: { apikey: opts.sbKey, 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => (r.ok ? r.json() : null)).then((a) => {
        const el = sec.querySelector('[data-acc]');
        if (el && a && a.n >= 20 && a.pct != null) { el.hidden = false; el.textContent = `✦ Within 5 marks of students’ real marks ${a.pct}% of the time (${a.n} checked)`; }
      }).catch(() => {});
  }
  // real social proof only: shown once at least 25 answers were marked in the last 7 days
  if (opts.sbUrl) {
    fetch(opts.sbUrl + '/rest/v1/rpc/marks_this_week', { method: 'POST', headers: { apikey: opts.sbKey, 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => (r.ok ? r.json() : null)).then((n) => {
        const el = sec.querySelector('[data-week]');
        if (el && typeof n === 'number' && n >= 25) { el.hidden = false; el.textContent = `✦ ${n.toLocaleString('en-GB')} answers marked this week`; }
      }).catch(() => {});
  }

  showQuestion(false);
  return () => offs.forEach((f) => f());
}
