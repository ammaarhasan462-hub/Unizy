// Homepage "try it" hero (Nov 2026): the first thing a visitor sees is a real exam-style question with an answer box.
//   The box opens with a typical first-year answer filled in (heroSamples.js), so a visitor can press Mark straight away
//   and watch it get marked live (the marker's guest_mark action, about 20 seconds; the result says how long it took).
//   Marking the untouched sample doesn't use up the visitor's one free mark, and its result is kept on the device so
//   pressing Mark again on it costs nothing. "Clear it and write your own" empties the box; their own answer is the
//   free mark (no account), saved to their account after sign-up.
// Also: find-your-module search over the full packs, trust lines, pricing line and a real weekly count of marked answers.
// Plain JS (no React), mounted by mountStory() in story.js.

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { HERO_SAMPLES } from './heroSamples.js';
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

// The hero question: UCL ECON0002 Economics, topic 1, exam-style (from module_questions).
const Q = {
  key: 'econ', label: 'Economics', code: 'ECON0002', title: 'Economics', uni: 'UCL', poss: 'UCL’s', saved: true,
  id: '3072a41a-e40e-4f0b-9e63-46dbc46f9654',
  text: 'Real GDP per capita is widely used to compare living standards across countries and over time. Discuss its strengths and limitations as a measure of economic performance, and explain what additional measures are needed to capture inequality and stability.',
};
// Phones (Nov 2026): "Pick your subject" chips above the question, so a visitor from Instagram answers something from
// their own subject. Each is a real exam-style question from a full pack (ids and text copied from module_questions;
// the marker reads the question from the database, so keep them in step). Medicine is multiple choice only, so its chip
// opens the module's free quiz instead of a written answer. Hidden above 760px: laptops keep the Economics question.
const SUBJECTS = [
  Q,
  { key: 'law', label: 'Law', code: 'LAWS0001', title: 'Contract Law', uni: 'UCL', poss: 'UCL’s', id: '11eb95ff-9c5d-4e97-8302-b7ea230e7000',
    text: "On Monday Priya emails Omar: 'I will sell you my vintage bicycle for £400. Offer open until Friday.' On Wednesday Omar replies, 'Would you take £350?' Priya says no. On Thursday Omar emails 'I accept at £400', but Priya had sold the bicycle to Lena on Wednesday evening, and Omar learned this from a friend on Thursday morning. Advise Omar on whether a contract exists." },
  { key: 'med', label: 'Medicine', code: 'MBBS0015', title: 'Circulation and Breathing', uni: 'UCL', med: true, n: 270 },
  { key: 'pol', label: 'Politics', code: 'POLS0006', title: 'Introduction to Politics', uni: 'UCL', poss: 'UCL’s', id: 'f80a4a51-9364-4b79-b11c-96f77fa20a54',
    text: "'Political science can tell us how the political world is, but never how it ought to be.' Discuss." },
  { key: 'bus', label: 'Business', code: 'BUS281', title: 'Management and Organisational Behaviour', uni: 'Queen Mary', poss: 'Queen Mary’s', id: '862904da-6f16-4767-93fa-30c06a372d7a',
    text: "'Classical management theories are outdated and have little relevance to contemporary organisations.' Discuss." },
  { key: 'psych', label: 'Psychology', code: 'PSY215', title: 'Social Psychology', uni: 'Queen Mary', poss: 'Queen Mary’s', id: '77d3e6b8-b87c-46fa-adae-ec5be206c5ba',
    text: "Evaluate the use of deception in social psychology experiments. Is it ever justified, and what are the methodological and ethical costs of using it?" },
  { key: 'bio', label: 'Biomed', code: 'PHOL0001', title: 'Mammalian Physiology', uni: 'UCL', poss: 'UCL’s', id: 'e69f01dd-8c7d-45f0-abdb-97d328e1a0f0',
    text: "(a) Explain why a red blood cell placed in 0.9% NaCl neither swells nor shrinks, whereas in pure water it lyses. [4] (b) Describe how the Na+/K+-ATPase helps maintain cell volume. [4] (c) Explain how the Na+-glucose cotransporter allows glucose to be absorbed against its concentration gradient. [4]" },
  { key: 'eng', label: 'Engineering', code: 'ELEC40002', title: 'Analysis and Design of Circuits', uni: 'Imperial', poss: 'Imperial’s', id: 'c5515187-00d7-4994-9cb5-5f98947b4392',
    text: "A 12 V ideal source feeds R1 = 4 kΩ in series with a parallel pair R2 = 6 kΩ and R3 = 12 kΩ. (a) Find the total resistance and source current. (b) Find the voltage across R2 and the current in R3. (c) Calculate the power dissipated in each resistor and confirm power balance. [10 marks]" },
  { key: 'hist', label: 'History', code: 'HY116', title: 'International Politics since 1914', uni: 'LSE', poss: 'LSE’s', id: 'a277960e-8658-4d54-a76b-4781b739a918',
    text: "'The First World War was caused by the failure of diplomacy in July 1914, not by long-term structural forces.' Discuss." },
  { key: 'phil', label: 'Philosophy', code: 'PHIL0006', title: 'Introduction to Moral Philosophy', uni: 'UCL', poss: 'UCL’s', id: 'b6fc8673-8dfb-475b-820b-da1c867e1e54',
    text: "'Reason alone is never a motive to action.' Explain Hume's argument for this claim and assess whether it succeeds." },
];
const isPhone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;
// the typical first-year answer for a subject's question (only if it was written for that exact question)
const sampleOf = (s) => { const x = s && s.id && HERO_SAMPLES[s.code]; return x && s.id.indexOf(x.q) === 0 ? x.a : ''; };

// What the marker returned for the Economics sample answer (16 Nov 2026, guest_mark, unedited apart from trimming).
// Shown, labelled as a saved result, only if live marking can't run (free marking busy or the daily budget used up).
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

// Phone-only header and subject chips (hidden above 760px by story.css).
function subjRow(key) {
  return `<div class="th-cardh"><b>Mark one answer free</b><span>No sign-up</span></div>
  <div class="th-subj" role="group" aria-label="Pick your subject"><div class="th-subjrow" data-subjrow><span class="th-subjlab">Your subject</span>${SUBJECTS.map((s) => `<button type="button" class="th-s" data-subj="${s.key}" aria-pressed="${s.key === key}">${s.label}</button>`).join('')}</div></div>`;
}
function questionBody(s, authed) {
  const head = `<div class="th-qhead"><span class="th-chip"><code>${s.code}</code>${esc(s.title)} · ${s.uni}</span><span class="th-time">${s.med ? '✓ Multiple choice' : '⏱ 5-minute question'}</span></div>`;
  if (s.med) {
    return `${head}
  <p class="th-q">Medicine exams are single best answer, so medics practise with multiple choice: ${s.n} questions for this module, marked as you go. No sign-up needed.</p>
  <div class="th-btns">
    <a class="uz-btn uz-btn-gold th-go" href="${authed ? '/dashboard/practice/' : '/modules/'}${s.code}?q=start" data-med><span>Start the free quiz</span>${ARROW}</a>
    <a class="th-sample" href="/mark" data-med-find>Or find your medicine module</a>
  </div>
  <p class="th-fine">Imperial and Queen Mary medicine modules are on Unizy too.</p>`;
  }
  // the box opens with the sample answer filled in (server-rendered too, so it's there before any script runs)
  const smp = sampleOf(s);
  return `${head}
  <p class="th-q">${esc(s.text)}</p>
  <label class="th-lab" for="th-ans">${smp ? 'A typical first-year answer' : 'Your answer'}</label>
  <textarea id="th-ans" class="th-ans" data-ans rows="6" placeholder="Write 150–200 words. Bullet points are fine.">${esc(smp)}</textarea>
  <div class="th-meta"><span data-wc>${smp ? 'Sample answer · press Mark to see it marked' : '0 words · aim for 150–200'}</span><span class="th-saved">Saved on this device</span></div>
  <div class="th-err" data-err role="status" hidden></div>
  <div class="th-btns">
    <button type="button" class="uz-btn uz-btn-gold th-go" data-mark><span>${smp ? 'Mark this answer free' : 'Mark my answer free'}</span>${ARROW}</button>
    ${smp ? '<button type="button" class="th-sample" data-swap>Clear it and write your own</button>' : ''}
  </div>
  <p class="th-fine" data-fine>${smp ? 'Watch it get marked live in about 20 seconds, then try your own. No sign-up. Exam practice only, never coursework.' : 'No sign-up for your first marked answer. Exam practice only, never coursework.'}</p>`;
}
const questionCard = (s, authed) => `${subjRow(s.key)}<div data-qbody>${questionBody(s, authed)}</div>`;

export const TRY_HTML = `
<section class="th" id="try" data-try aria-label="Try Unizy now">
  <div class="th-wrap">
    <div class="th-intro">
      <div class="th-top">
        <span class="uz-kick">UCL · Imperial · LSE · Queen Mary</span>
        <button type="button" class="th-replay" data-replay-intro aria-label="Replay the intro"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z"/></svg>Replay intro</button>
      </div>
      <h1 class="th-h">The mark scheme your uni never&nbsp;gave&nbsp;you.</h1>
      <p class="th-subm">Watch an exam answer get marked in 20 seconds: <b>its class</b> and <b>where it lost marks</b>.</p>
      <p class="th-sub">Mark the sample answer, or write your own. In about 20 seconds you’ll see <b>the class</b>, <b>the exact sentences that lost marks</b>, and <b>3 changes to go up a class</b>, marked against your uni’s grade bands.</p>
    </div>
    <div class="th-card" id="mark" data-card aria-live="polite">${questionCard(Q)}</div>
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
// Enough to mark? Same rule as markable() in site/assets/mark.js and the marker: a paragraph for an essay, a few lines of
// working for a calculation (the flat 40 words turned away correct worked answers to the Engineering question).
const QUANT_RE = /\b(calculate|compute|derive|find|solve|prove|show that|determine|estimate|sketch|simplify)\b|=/i;
function markable(a, q) {
  a = String(a || '').trim(); const w = words(a);
  if (w >= 40) return true;
  const eq = (a.match(/[=≈→⇒]/g) || []).length, dig = (a.match(/\d/g) || []).length;
  if (a.length >= 50 && (eq >= 2 || dig >= 6)) return true;
  return !!q && QUANT_RE.test(q.text || '') && w >= 12;
}
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
  if (kind === 'busy') {
    head = 'Free marking is busy right now';
    perks = ['Sign up free and get 3 marked answers a day for 3 days', 'Then 1 free marked answer every week, and a plan for your weakest topics every Monday', 'No password and no card'];
  } else if (kind === 'limit') {
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
      <button type="submit" class="uz-btn uz-btn-gold"><span>${kind === 'limit' ? 'Keep practising, free' : kind === 'busy' ? 'Sign up free' : 'Save my grade, free'}</span>${ARROW}</button></div>
    <p class="th-saveerr" hidden></p>
    <p class="th-savefine">Takes 20 seconds: we email you a code, no password and no card.</p>
  </form>`;
}

function resultHtml(r, answer, opts) {
  const q = opts.q || Q;
  const lost = (r.lost || []).slice(0, 4), changes = (r.changes || []).slice(0, 3);
  const cls = esc(r.class || ''), range = r.mark_low != null ? `${r.mark_low}–${r.mark_high}` : '';
  const ccls = { First: 'c1', '1st': 'c1', '2:1': 'c21', '2:2': 'c22', Third: 'c3' }[r.class] || 'c22';
  return `
  <div class="th-rhead">
    <span class="th-tag">${opts.sample ? 'Sample' : 'Your answer'}${opts.secs ? ` · marked in ${opts.secs} s` : opts.saved ? ' · saved marking' : ''}</span>
    <button type="button" class="th-back" ${opts.sample ? 'data-own' : 'data-back'}>← ${opts.sample ? 'Try your own' : 'Back to the question'}</button>
  </div>
  <div class="th-grade"><span class="th-cls ${ccls}">${cls}</span><div><b>${range}</b><small>predicted mark range · ${esc(q.poss)} grade bands</small></div></div>
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
      ? `<button type="button" class="uz-btn uz-btn-gold" data-own><span>Now mark my own answer free</span>${ARROW}</button>
         <a class="th-link" href="/modules/${q.code}?q=start" data-track-local="hero_find_open">Or practise on your own module</a>`
      : saveHtml('end', r)}
  </div>
  <p class="th-fine">${opts.sample
    ? (opts.saved ? 'Free marking is busy right now, so this is the marker’s saved result for this answer, trimmed to fit.' : 'Marked live by the Unizy marker, trimmed to fit. Your own answer is marked the same way, and your first one is free.')
    : 'A practice estimate, not an official mark. Saved to your account when you sign up (email only, no card).'}</p>`;
}

export function mountTry(root, opts = {}) {
  const sec = root && root.querySelector('[data-try]');
  if (!sec) return () => {};
  const track = opts.track || (() => {});
  const card = sec.querySelector('[data-card]');
  const offs = [];
  const on = (el, ev, fn, o) => { if (!el) return; el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
  const GKEY = 'unizy:guestmark', CKEY = 'unizy:guestclaim', SKEY = 'unizy:herosubj';
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
  // the sample's live result is kept on the device, so pressing Mark on the same sample again shows it without a new call
  const RKEY = (s) => 'unizy:herosample:' + s.code + ':' + String(s.id).slice(0, 8);
  const isSample = () => { const ta = card.querySelector('[data-ans]'), smp = sampleOf(cur); return !!(ta && smp && ta.value.trim() === smp.trim()); };
  let busy = false, typedOnce = false, subjTracked = false;
  // the subject picked on a phone (remembered); laptops always show the Economics question
  let cur = (isPhone() && SUBJECTS.find((s) => s.key === ls.get(SKEY))) || Q;
  // drafts are kept per question (Economics keeps the original key so older drafts still load)
  const dkey = () => (cur.key === Q.key ? 'unizy:herodraft' : 'unizy:herodraft:' + cur.key);

  function fillBody() {
    const ta = card.querySelector('[data-ans]');
    if (ta) {
      // a saved draft wins over the sample, even an empty one (after "Clear it and write your own")
      const d = ls.get(dkey());
      ta.value = d !== null ? d : sampleOf(cur);
      if (isPhone()) ta.placeholder = 'A short paragraph is enough (40+ words). Longer answers can score higher.';
    }
    updateWc();
  }
  // keep the picked subject in view in the sideways-scrolling chip row (without moving the page)
  function centreChip() {
    const row = card.querySelector('[data-subjrow]'), on = row && row.querySelector('[aria-pressed="true"]');
    if (on && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
  }
  function showQuestion(focus) {
    card.innerHTML = questionCard(cur, opts.authed);
    fillBody(); centreChip();
    const ta = card.querySelector('[data-ans]');
    if (focus) { card.scrollIntoView({ block: 'start', behavior: 'smooth' }); if (ta) setTimeout(() => ta.focus({ preventScroll: true }), 350); }
  }
  function setSubject(key) {
    const s = SUBJECTS.find((x) => x.key === key); if (!s || s === cur || busy) return;
    cur = s; ls.set(SKEY, key);
    if (!subjTracked) { subjTracked = true; track('hero_subject'); }
    card.querySelectorAll('[data-subj]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-subj') === key)));
    const body = card.querySelector('[data-qbody]'); if (body) body.innerHTML = questionBody(cur, opts.authed);
    fillBody(); centreChip();
  }
  // the label, counter, button and swap link follow what's in the box: the untouched sample, or the visitor's own answer
  function updateWc() {
    const ta = card.querySelector('[data-ans]'), wc = card.querySelector('[data-wc]'); if (!ta || !wc) return;
    const n = words(ta.value), smp = sampleOf(cur), sample = isSample();
    const lab = card.querySelector('label[for="th-ans"]'), b = card.querySelector('[data-mark] span'), sw = card.querySelector('[data-swap]'), fine = card.querySelector('[data-fine]');
    if (lab) lab.textContent = sample ? 'A typical first-year answer' : 'Your answer';
    if (b) b.textContent = opts.authed ? 'Mark it in my dashboard' : sample ? 'Mark this answer free' : 'Mark my answer free';
    if (sw) sw.textContent = sample ? 'Clear it and write your own' : 'Put the sample answer back';
    if (fine && smp) fine.textContent = sample ? 'Watch it get marked live in about 20 seconds, then try your own. No sign-up. Exam practice only, never coursework.' : 'No sign-up for your first marked answer. Exam practice only, never coursework.';
    const sv = card.querySelector('.th-saved'); if (sv) sv.hidden = sample;
    if (sample) { wc.textContent = `Sample answer · ${n} words`; wc.classList.remove('ok'); return; }
    const ok = markable(ta.value, cur), quant = QUANT_RE.test(cur && cur.text || '');
    wc.textContent = quant
      ? `${n} word${n === 1 ? '' : 's'} · ${ok ? 'ready to mark' : 'show your working'}`
      : isPhone()
      ? `${n} word${n === 1 ? '' : 's'} · ${ok ? 'ready to mark' : `${40 - n} more to mark it`}`
      : `${n} word${n === 1 ? '' : 's'} · ${!ok ? 'aim for 150–200' : n <= 260 ? 'good length' : 'longer is fine too'}`;
    wc.classList.toggle('ok', ok);
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
    let next = '/modules/' + cur.code;
    if (kind === 'limit') {
      next = `/modules/${cur.code}?q=${cur.id}&v=answer`;
      try {
        const t = ls.get(dkey()), d = JSON.parse(localStorage.getItem('mark:drafts') || '{}');
        if (t) { d[cur.code + ':' + cur.id] = { t, at: Date.now() }; localStorage.setItem('mark:drafts', JSON.stringify(d)); }
      } catch (x) { /* storage off */ }
    }
    track(kind === 'limit' ? 'guest_limit_email' : 'hero_save_email');
    location.href = `/signup?send=1&email=${encodeURIComponent(em)}&next=${encodeURIComponent(next)}`;
  });
  function showResult(r, answer, sample, q, extra) {
    card.innerHTML = resultHtml(r, answer, Object.assign({ sample, q: q || Q }, extra || {}));
    card.classList.add('res');
    if (innerWidth <= 900) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  on(card, 'input', (e) => {
    if (!e.target.matches('[data-ans]')) return;
    ls.set(dkey(), e.target.value); updateWc();
    if (!typedOnce) { typedOnce = true; track('hero_type'); }
  });
  on(card, 'click', (e) => {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.hasAttribute('data-subj')) { setSubject(t.getAttribute('data-subj')); return; }
    if (t.hasAttribute('data-med')) { track('hero_med_open'); return; }
    if (t.hasAttribute('data-med-find')) { track('hero_find_open'); return; }
    if (t.hasAttribute('data-swap')) {
      const ta = card.querySelector('[data-ans]'); if (!ta) return;
      if (isSample()) { ta.value = ''; ls.set(dkey(), ''); track('hero_sample_clear'); ta.focus(); } else { ta.value = sampleOf(cur); ls.del(dkey()); }
      err(''); updateWc(); return;
    }
    // "Try your own" from a marked sample: back to the question with an empty box, ready to type
    if (t.hasAttribute('data-own')) { card.classList.remove('res'); ls.set(dkey(), ''); showQuestion(true); return; }
    if (t.hasAttribute('data-back')) { card.classList.remove('res'); showQuestion(true); return; }
    if (t.hasAttribute('data-save')) { track('hero_save'); return; }
    if (t.dataset.trackLocal) { track(t.dataset.trackLocal); return; }
    if (t.hasAttribute('data-mark')) submit();
  });

  function submit() {
    if (busy || cur.med) return;
    const q = cur, ta = card.querySelector('[data-ans]'), answer = (ta.value || '').trim(), sample = isSample();
    if (opts.authed) { location.href = `/dashboard/practice/${q.code}?q=${q.id}&v=answer`; return; }
    if (!markable(answer, q)) { err(QUANT_RE.test(q.text || '') ? 'Show a bit more working first: a few lines with your equations and numbers.' : 'Write a bit more first: at least a short paragraph (40+ words), ideally 150–200.'); ta.focus(); return; }
    if (sample) {
      // the sample doesn't use up the visitor's free mark; marked once on this device, its result comes straight back
      track('hero_sample_mark');
      try { const k = JSON.parse(ls.get(RKEY(q)) || 'null'); if (k && k.r) { showResult(k.r, answer, true, q, { secs: k.secs }); return; } } catch (x) { /* ignore */ }
    } else if (ls.get(GKEY)) { limit(); return; }
    busy = true; err('');
    const btn = card.querySelector('[data-mark]'); btn.disabled = true;
    const steps = [sample ? 'Reading the answer…' : 'Reading your answer…', `Checking it against ${q.poss} grade bands…`, 'Comparing it with the 2:1 and First descriptors…', 'Finding the sentences that cost marks…', 'Working out your 3 changes…', 'Nearly there…'];
    const t0 = Date.now(), paint = () => { btn.innerHTML = '<span class="th-spin"></span><span>' + steps[Math.min(steps.length - 1, Math.floor((Date.now() - t0) / 5000))] + '</span>'; };
    paint(); const tick = setInterval(() => { if (!btn.isConnected || !btn.disabled) { clearInterval(tick); return; } paint(); }, 1000);
    track('hero_mark_submit');
    fetch(opts.sbUrl + '/functions/v1/marker', {
      method: 'POST', headers: { apikey: opts.sbKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'guest_mark', code: q.code, question_id: q.id, answer, practice: true }),
    }).then((r) => r.json().catch(() => ({})).then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        busy = false;
        const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
        if (!ok) {
          if (b.code === 'guest_used' && !sample) ls.set(GKEY, 'used');
          track('hero_mark_fail'); btn.disabled = false; btn.innerHTML = `<span>${sample ? 'Mark this answer free' : 'Mark my answer free'}</span>${ARROW}`;
          if (sample) { failSample(q, answer, b.code === 'guest_used' || b.code === 'guest_busy', b.message); return; }
          if (b.code === 'guest_used' || b.code === 'guest_busy') { limit(); return; }
          err(b.message || 'Something went wrong. Try again.');
          return;
        }
        track('hero_mark_done');
        if (sample) {
          ls.set(RKEY(q), JSON.stringify({ secs, r: { class: b.class, mark_low: b.mark_low, mark_high: b.mark_high, headline: b.headline, lost: b.lost, changes: b.changes } }));
          showResult(b, answer, true, q, { secs });
          return;
        }
        ls.set(GKEY, 'used');
        if (b.claim && b.claim_sig) ls.set(CKEY, JSON.stringify({ code: q.code, claim: b.claim, claim_sig: b.claim_sig }));
        showResult(b, answer, false, q, { secs });
      })
      .catch(() => {
        busy = false; track('hero_mark_fail'); btn.disabled = false; btn.innerHTML = `<span>${sample ? 'Mark this answer free' : 'Mark my answer free'}</span>${ARROW}`;
        if (sample) { failSample(q, answer, false, null); return; }
        err('Couldn’t reach the marker. Check your connection and try again.');
      });
  }
  // the sample couldn't be marked live: Economics has a saved real result to show instead (labelled as saved); otherwise,
  // when free marking is full for today on their network, offer sign-up (their own free mark is never counted as used)
  function failSample(q, answer, full, msg) {
    if (q.saved) { showResult(SAMPLE_RESULT, answer, true, q, { saved: true }); return; }
    if (full) {
      const e = card.querySelector('[data-err]'); if (!e) return;
      track('hero_limit_seen');
      e.hidden = false; e.classList.add('th-limitbox'); e.innerHTML = saveHtml('busy');
      e.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    err(msg || 'Couldn’t reach the marker. Check your connection and try again.');
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
