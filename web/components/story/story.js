// Unizy scroll story (the homepage after the intro). Plain JS, no dependencies, so the same file runs
// inside the Next app and in a standalone test page.
//   STORY_TOP / STORY_END: the markup (server-rendered by the React wrappers in components/Story.jsx)
//   mountStory(root, { track, authed }): wires up every scroll and pointer effect, returns a cleanup function.
// The centrepiece is a 3D exam answer booklet built from CSS 3D faces. It rises, twists, turns over,
// opens to show an answer being marked against the mark scheme, gets stamped 2:1 and then First.

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- doodle pattern: formulas, ticks and grades instead of the jar site's leaves ----------
function pattern(color) {
  const items = [
    ['MR = MC', 20, 40, -8, 22], ['✓', 190, 30, 10, 30], ['2:1', 270, 80, -12, 26], ['§', 90, 120, 0, 34], ['ε', 330, 150, 6, 32],
    ['First', 150, 190, -6, 24], ['∂y/∂x', 20, 230, 8, 20], ['A*', 260, 250, -10, 26], ['?', 360, 40, 14, 30], ['✦', 110, 290, 0, 18],
    ['P(1+1/ε)', 200, 330, -5, 18], ['✓', 40, 340, -14, 26], ['70+', 330, 330, 8, 22],
  ];
  const t = items.map(([s, x, y, r, f]) => `<text x='${x}' y='${y}' transform='rotate(${r} ${x} ${y})' font-size='${f}'>${s}</text>`).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='380'><g fill='${color}' font-family='Georgia,serif' font-style='italic'>${t}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const PAT_L = pattern('#F1DDA9');
const PAT_D = pattern('#17302A');
const pat = (light, speed = 0.15) => `<div class="uz-pat" data-pat="${speed}" style="background-image:${light ? PAT_L : PAT_D}" aria-hidden="true"></div>`;

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const mega = (lines, cls = '', tag = 'h2') =>
  `<${tag} class="uz-mega ${cls}" data-echo><span class="main">${lines.map((l) => `<span class="ln"><span>${l}</span></span>`).join('')}</span></${tag}>`;

// ---------- the booklet ----------
const SEAL = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><path id="uzsealp" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0"/></defs><text><textPath href="#uzsealp">MARKED · AGAINST · YOUR · DEPARTMENT ·</textPath></text></svg>`;
const COVER = `<div class="cv-top"><span class="lg">U</span>UNIZY<em>2026</em></div>
  <div class="cv-title">Examination<br>answer<br>booklet</div>
  <div class="cv-mod">ECON0013 · Microeconomics</div>
  <div class="cv-seal">${SEAL}<span>U</span></div>
  <div class="cv-foot"><div class="cv-box">Candidate<b>UZY-0013</b></div><div class="cv-bar"></div></div>`;
const BACK = `<div class="bk-h">Every UCL<br>module.</div><div class="bk-s">Marked like your department marks.</div>
  <ul><li>Modules<b>6,682</b></li><li>Departments<b>81</b></li><li>Criteria sets<b>10</b></li><li>unizy.uk<b>✦</b></li></ul><div class="cv-bar"></div>`;

const BOOK = `
<div class="uz-obj" aria-hidden="true">
  <div class="uz-shadow"></div>
  <div class="uz-objin">
    <div class="uz-book">
      <div class="uz-face f-back">${BACK}<i class="f-shade"></i></div>
      <div class="uz-face f-spine"><span>UNIZY · ECON0013 · ANSWER BOOKLET</span></div>
      <div class="uz-face f-er"></div><div class="uz-face f-et"></div><div class="uz-face f-eb"></div>
      <div class="uz-face f-page">
        <div class="pg-q">Q3 · Explain why a profit-maximising monopolist produces on the elastic part of demand</div>
        <div class="pg-a">A monopolist maximises profit where <span class="hl" data-at=".55">MR = MC</span>. Since MC &gt; 0, MR must be positive, so <span class="hl" data-at=".6">|ε| &gt; 1</span> and demand is elastic at the chosen output. On the inelastic part, cutting output would raise revenue and lower costs, so <span class="hl" data-at=".63">no monopolist stays there</span>.</div>
        <span class="pg-tick" data-at=".555" style="top:3.4em">✓</span>
        <span class="pg-tick" data-at=".605" style="top:6.1em">✓</span>
        <span class="pg-note" data-at=".58" style="left:1.9em;bottom:4.1em;rotate:-4deg">↑ derive MR first!</span>
        <span class="pg-note" data-at=".635" style="left:1.9em;bottom:2.5em;rotate:-2deg">+ add the diagram</span>
        <div class="stamp st-21" data-at=".655" data-x=".8"><div>2:1<small>62–66</small></div></div>
        <div class="stamp st-1" data-at=".84"><div>First<small>70+</small></div></div>
      </div>
      <div class="f-cover">
        <div class="uz-face f-out">${COVER}<i class="f-sheen"></i><i class="f-shade"></i></div>
        <div class="uz-face f-in">
          <div class="ms-h">Mark<br>scheme</div><div class="ms-s">UCL Economics · Year 1 criteria</div>
          <div class="ms-row"><span class="ms-chip ch-21">2:1</span>Knowledge and understanding</div>
          <div class="ms-row"><span class="ms-chip ch-22">2:2</span>Analysis: result stated, not derived</div>
          <div class="ms-row"><span class="ms-chip ch-1">First</span>Structure and communication</div>
          <div class="ms-fix"><p>To go up a class</p><p><b>1.</b> Derive MR = P(1 + 1/ε) first</p><p><b>2.</b> Add the labelled diagram</p><p><b>3.</b> End with the intuition</p></div>
        </div>
      </div>
    </div>
  </div>
</div>`;

const SPARKS = ['✦', '✓', '2:1', '✦', 'A*', '✓'].map((s, i) => `<span class="uz-spark" data-spark="${i}" aria-hidden="true">${s}</span>`).join('');

// ---------- section markup ----------
const HERO = `
<section class="uz-hero" data-hero aria-label="Unizy">
  <div class="uz-stage">
    ${pat(true, 0.12)}
    <div class="uz-big-num" data-bignum aria-hidden="true">01</div>
    <div class="uz-vignette"></div>

    <div class="uz-frame" data-f="0">${mega(['The mark scheme', 'your uni never', 'gave you.'], '', 'h1')}</div>
    <div class="uz-frame" data-f="1">${mega(['A new angle', 'on revision.'])}</div>
    <div class="uz-frame" data-f="2">${mega(['Open the', 'mark scheme.'])}</div>
    <div class="uz-frame" data-f="3">${mega(['See your', 'class. Then', 'go up one.'], 'sm')}</div>

    ${BOOK}
    ${SPARKS}

    <div class="uz-call" data-call="0" style="--r:-4deg"><b class="c21">2:1</b>Knowledge and understanding</div>
    <div class="uz-call" data-call="1" style="--r:3deg"><b class="c22">2:2</b>Analysis: derive it, don’t state it</div>
    <div class="uz-call" data-call="2" style="--r:-2deg"><b class="c1">First</b>Structure and communication</div>
    <div class="uz-call" data-call="3" style="--r:4deg">✦ 3 changes to go up a class</div>

    <div class="uz-info" data-f="0">
      <span class="uz-kick">Every UCL module</span>
      <p>Write an answer to any exam question in your module. Unizy marks it against <b>your department’s own grading criteria</b>, tells you your class, and shows you exactly what would move you up one.</p>
      <div class="row">
        <a href="/signup" class="uz-btn uz-btn-gold" data-track="lp_hero_signup" data-auth-href="/dashboard" data-auth-text="Practise in my dashboard"><span>Get my first answer marked, free</span>${ARROW}</a>
        <a href="#how" class="uz-btn uz-btn-line">See how it works</a>
      </div>
      <ul><li>6,682 UCL modules</li><li>Free 3-day trial</li><li>No card needed</li></ul>
    </div>
    <div class="uz-info" data-f="1">
      <span class="uz-kick">01 · Practise</span>
      <p>Exam-style questions written in <b>your module’s style</b>, or paste one from your own past paper. Turn on the 45-minute timer for exam conditions.</p>
      <div class="uz-tags"><span class="uz-tag">ECON0013</span><span class="uz-tag">HIST0003</span><span class="uz-tag">LAWS0001</span><span class="uz-tag"><b>+6,679</b> more</span></div>
    </div>
    <div class="uz-info" data-f="2">
      <p>Marked against <b>UCL’s grade bands</b> and the criteria <b>your department publishes</b>.</p>
    </div>
    <div class="uz-info" data-f="3">
      <span class="uz-kick">02 · Go up a class</span>
      <p>Feedback on every criterion, <b>the 3 changes that would move you up a class</b>, and a First-class answer to compare against.</p>
      <div class="uz-tags"><span class="uz-tag">Predicted <b>62–66</b></span><span class="uz-tag">Next: <b>First</b></span></div>
    </div>

    <div class="uz-dots" aria-hidden="true"><i class="on"></i><i></i><i></i><i></i></div>
    <div class="uz-corner uz-c-bl"><i></i>Scroll</div>
    <div class="uz-corner uz-c-br">UCL · <b>Exam practice</b><br>Marked like your department marks</div>
  </div>
</section>`;

const SPLIT = `
<section class="uz-split" id="how" data-split aria-label="How it works">
  <div class="sp-stage">
    <div class="sp-left">
      <i class="sp-bar"></i>
      <span class="uz-kick">How it works · about ten minutes</span>
      <h2><span class="f">No guesswork.</span><span class="o">No waiting for</span><span class="f">results day.</span></h2>
      <div class="sp-steps">
        <div class="sp-step on"><span class="n">01</span><div><h3>Pick your course and modules</h3><p>Sign up and choose your course and year. Your modules sit in your dashboard, and any of UCL’s 6,682 can be added.</p></div></div>
        <div class="sp-step"><span class="n">02</span><div><h3>Answer an exam-style question</h3><p>Pick one written in your module’s style, or paste one from your own past paper. Timer on for exam conditions.</p></div></div>
        <div class="sp-step"><span class="n">03</span><div><h3>See your class, and how to go up one</h3><p>Marked against UCL’s grade bands and your department’s criteria, with the 3 changes that would move you up a class.</p></div></div>
      </div>
    </div>
    <div class="sp-right">
      ${pat(false, 0.1)}
      <div class="sp-word" aria-hidden="true">Marked ✦ Marked ✦ Marked</div>
      <div class="sp-cards" aria-hidden="true">
        <div class="sp-card">
          <div class="t"><span>Your course</span><span>Step 1</span></div>
          <h4>Economics BSc · Year 1</h4>
          <ul class="sp-mods">
            <li class="on"><code>ECON0013</code>Microeconomics<span>✓</span></li>
            <li class="on"><code>ECON0019</code>Quantitative Economics<span>✓</span></li>
            <li class="on"><code>HIST0003</code>Approaching History<span>✓</span></li>
            <li><code>POLS0006</code>Introduction to Politics<span>+</span></li>
          </ul>
        </div>
        <div class="sp-card">
          <div class="t"><span>ECON0013 · Q3</span><span class="sp-timer">⏱ 38:12 left</span></div>
          <h4>“Explain why a profit-maximising monopolist always produces on the elastic part of the demand curve.”</h4>
          <div class="sp-type"><span data-type></span><i></i></div>
        </div>
        <div class="sp-card">
          <div class="t"><span>Marked · UCL Economics criteria</span><span>Step 3</span></div>
          <div class="sp-res"><span class="cls">2:1</span><div><b>62–66</b><small>predicted mark range</small></div></div>
          <div class="sp-fix"><div>1. Derive MR = P(1 + 1/ε) before using it</div><div>2. Add the labelled diagram</div><div>3. Finish with the intuition</div></div>
        </div>
      </div>
      <div class="uz-stk spin" style="right:7%;top:9%"><div>Mark<br>scheme<small>INCLUDED</small></div></div>
    </div>
  </div>
</section>`;

const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/></svg>';
const ICON_CHAT = '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>';
const ICON_UP = '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>';

const GAP_TEXT = 'At A-level you had past papers and *mark* *schemes.* At UCL you get the papers, and *nothing* to check your answers against.';
const GAP = `
<section class="uz-gap" data-gap aria-label="The gap">
  ${pat(false, 0.08)}
  <div class="uz-wrap">
    <div class="gap-top">
    <p class="gap-banner" data-words>${GAP_TEXT.split(' ').map((w) => `<span class="w${w.startsWith('*') ? ' hi' : ''}">${w.replace(/\*/g, '')}</span>`).join(' ')}</p>

    <div class="gap-float" data-speed="-0.12" data-rot="-7" style="right:2%;top:-4%"><div class="gf"><span class="t">Past paper · 2024</span>ECON0013, Section B, Q3<br><span class="no">No mark scheme</span></div></div>
    <div class="gap-float hide-m" data-speed="0.14" data-rot="5" style="left:1%;top:66%"><div class="gf dark"><span class="t">Course group chat · 1:12am</span>does anyone actually know what a First looks like??</div></div>
    <div class="gap-float" data-speed="-0.1" data-rot="4" style="right:6%;top:50%"><div class="gf hand">is this a 2:1 or a 2:2??</div></div>
    <div class="gap-float hide-m" data-speed="0.16" data-rot="-4" style="left:36%;top:74%"><div class="gf"><span class="t">Results day</span><span class="big">Too late.</span>That’s when you find out.</div></div>
    <div class="gap-float hide-m" data-speed="-0.14" data-rot="6" style="right:20%;top:86%"><div class="gf dark"><span class="t">Professor UCL</span>Show the decomposition on a diagram, then sign each effect.</div></div>
    </div>

    <div class="gap-why">
      <h2><span>Why the</span><br><span class="s">mark scheme<svg viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M4 18 C 60 6, 120 26, 180 14 S 270 8, 296 16"/></svg></span><br><span>matters</span></h2>
      <span class="uz-serif">You should know what a First looks like before the exam, not after it.</span>
    </div>

    <div class="gap-cols" id="features">
      <div class="gcol" data-col>
        <span class="ic">${ICON_CHECK}</span><h3>Marked by<br>criterion</h3>
        <p>Your class on each of your department’s published criteria, not one vague score.</p>
        <div class="mini"><div class="r"><span class="ms-chip ch-21">2:1</span>Argument answers the question</div><div class="r"><span class="ms-chip ch-1">First</span>Evidence well-chosen</div><div class="r"><span class="ms-chip ch-22">2:2</span>Historiography not engaged</div></div>
      </div>
      <div class="gcol" data-col>
        <span class="ic">${ICON_CHAT}</span><h3>Professor UCL,<br>every module</h3>
        <p>Ask why you lost marks and how to fix it, in your module’s own terms.</p>
        <div class="mini"><div class="bub me">How would that earn marks?</div><div class="bub tu">Label the compensated budget line, then sign each effect. That’s 2:2 to 2:1.</div></div>
      </div>
      <div class="gcol" data-col>
        <span class="ic">${ICON_UP}</span><h3>Watch your<br>marks climb</h3>
        <p>Every answer you’ve had marked is saved, with your marks over time.</p>
        <div class="mini"><svg class="ln" viewBox="0 0 300 70" aria-hidden="true"><path d="M0 16 H300" stroke="#B8862F" stroke-dasharray="4 5" fill="none"/><text x="2" y="11" font-size="10" fill="#8A5E1E" font-family="monospace">FIRST</text><path data-draw d="M4 62 L54 56 L104 47 L154 42 L204 31 L254 22 L296 12" pathLength="1" fill="none" stroke="#3E6B5C" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1"/></svg></div>
      </div>
    </div>
  </div>
</section>`;

const UNLOCK = `
<section class="uz-unlock" data-unlock aria-label="Go up a class">
  <div class="ul-stage">
    ${pat(true, 0.1)}
    <div class="ul-cov" data-cov="0" style="left:52%;top:8%"><div class="uz-face f-out" style="backface-visibility:visible">${COVER}</div></div>
    <div class="ul-cov back" data-cov="1" style="left:6%;top:42%"><div class="uz-face f-back" style="backface-visibility:visible">${BACK}</div></div>
    <div class="ul-cov" data-cov="2" style="left:72%;top:58%"><div class="uz-face f-out" style="backface-visibility:visible">${COVER}</div></div>
    <div class="ul-dim"></div>
    <div class="ul-lines">
      <div class="a" data-ul="0">Unlock the</div>
      <div class="b" data-ul="1">First</div>
      <div class="c" data-ul="2">in your <span class="br"></span>answer<span class="uz-serif"> already.</span></div>
    </div>
    <span class="ul-chip" data-chip="0" style="left:8%;top:16%">✦ Derive it, don’t just state it</span>
    <span class="ul-chip" data-chip="1" style="right:8%;top:30%">✦ Add the labelled diagram</span>
    <span class="ul-chip" data-chip="2" style="left:22%;bottom:12%">✦ End on the intuition</span>
  </div>
</section>`;

const MODS = [
  ['ECON0013', 'Microeconomics'], ['HIST0003', 'Approaching History'], ['POLS0006', 'Introduction to Politics'], ['LAWS0001', 'Contract Law'],
  ['COMP0002', 'Principles of Programming'], ['STAT0002', 'Probability and Statistics'], ['ANAT0001', 'Anatomy and Development'],
  ['PHIL0001', 'Ancient Greek Philosophy'], ['ELEC0002', 'Electronic Engineering'], ['BIOL0001', 'Quantitative Biology'],
];
const mq = (items, cls, d) => `<div class="uz-mq ${cls}" style="--d:${d}s" aria-hidden="true"><div>${[...items, ...items].map((x) => `<span>${x}</span>`).join('')}</div></div>`;

const NUMS = `
<section class="uz-nums" aria-label="Unizy in numbers">
  <div class="uz-wrap">
    <h2 class="nm-h">Built for UCL. <span class="uz-serif">All of it.</span></h2>
    <div class="nm-grid">
      <div class="nm"><b data-count="6682">6,682</b><span>UCL modules, from the official catalogue</span></div>
      <div class="nm"><b data-count="81">81</b><span>UCL departments covered</span></div>
      <div class="nm"><b data-count="10">10</b><span>sets of marking criteria (UCL-wide + 9 departments)</span></div>
      <div class="nm"><b data-count="3">3</b><span>concrete changes on every marked answer</span></div>
    </div>
  </div>
  ${mq(MODS.map(([c, t]) => `<code>${c}</code>${t}`), 'mq-a', 60)}
  ${mq(['Marked like your department marks', 'Free 3-day trial', 'No card needed', 'Every UCL module', 'Professor UCL'], 'mq-b rev', 34)}
</section>`;

export const STORY_TOP = `<div class="uz" data-uz>${HERO}${SPLIT}${GAP}${UNLOCK}${NUMS}</div>`;

export const STORY_END = `<div class="uz" data-uz>
<section class="uz-final" data-final aria-label="Get started">
  ${pat(true, 0.1)}
  <div class="fn-float" data-speed="-0.25" data-rot="-10" style="left:6%;top:16%"><div class="uz-stk"><div>Free<br>to start<small>NO CARD</small></div></div></div>
  <div class="fn-float" data-speed="0.2" data-rot="8" style="right:7%;top:58%"><div class="uz-stk" style="background:var(--gold-b)"><div>First<small>70+</small></div></div></div>
  <div class="fn-float" data-speed="0.32" data-rot="-5" style="right:14%;top:12%"><div class="gf hand" style="font-size:20px">“so THAT’S what a First looks like”</div></div>
  <div class="uz-wrap">
    ${mega(['Let’s get', 'marking.'])}
    <p class="sub">Free to start. No card needed. Your first answer marked in about ten minutes.</p>
    <div class="row">
      <a href="/signup" class="uz-btn uz-btn-gold" data-track="lp_final_signup" data-auth-href="/dashboard" data-auth-text="Practise in my dashboard"><span>Get my first answer marked, free</span>${ARROW}</a>
      <a href="/mark" class="uz-btn uz-btn-line">Find your module</a>
    </div>
  </div>
</section></div>`;

// ---------- booklet poses through the hero (p = 0..1). x in vw, y in vh, angles in degrees ----------
//            p     x    y    ym    rx    ry    rz    s     open
const POSES = [
  [0.0, 0, 34, 6, 16, -30, 9, 1, 0],
  [0.1, 0, 8, 4, 6, 14, -6, 1.04, 0],
  [0.2, 4, 4, 6, -10, 120, -14, 1, 0],
  [0.3, 22, 2, 8, -14, 205, -16, 1, 0],
  [0.4, 20, -2, 8, 58, 265, 12, 0.96, 0],
  [0.48, 0, 11, 8, 8, 352, -2, 1.0, 0],
  [0.56, 0, 11, 9, 6, 360, 0, 1.0, 1],
  [0.7, 0, 10, 9, 10, 364, -3, 1.02, 1],
  [0.79, 20, -6, 6, 14, 346, 4, 0.9, 1],
  [0.92, 20, -6, 6, 10, 352, 2, 0.94, 1],
  [1.0, 22, 6, 10, 26, 372, 10, 0.86, 0.35],
];
function pose(p, mobile) {
  let i = 0;
  while (i < POSES.length - 2 && p > POSES[i + 1][0]) i++;
  const a = POSES[i], b = POSES[i + 1];
  const t = ss(0, 1, (p - a[0]) / (b[0] - a[0]));
  const v = (k) => lerp(a[k], b[k], t);
  return { x: v(1) * (mobile ? 0.12 : 1), y: mobile ? v(3) : v(2), rx: v(4), ry: v(5), rz: v(6), s: v(7), open: v(8) };
}
// frame windows: [inStart, inEnd, outStart, outEnd]
const FRAMES = [[-1, -1, 0.13, 0.2], [0.21, 0.27, 0.41, 0.46], [0.47, 0.53, 0.69, 0.73], [0.74, 0.8, 2, 2]];
const TYPED = 'A monopolist maximises profit where MR = MC. Since MR = P(1 + 1/ε) and MC is positive, MR must be positive, so |ε| > 1. Demand is therefore elastic at the chosen output…';

export function mountStory(root, opts = {}) {
  if (!root) return () => {};
  const track = opts.track || (() => {});
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => Array.from(el.querySelectorAll(s));
  const offs = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };

  // signed-in visitors: CTAs go to the dashboard
  if (opts.authed) $$('[data-auth-href]').forEach((a) => { a.href = a.dataset.authHref; const s = a.querySelector('span'); if (s) s.textContent = a.dataset.authText; });
  $$('[data-track]').forEach((a) => on(a, 'click', () => track(a.dataset.track)));

  // echo layers behind each big headline (the stacked outline copies)
  $$('[data-echo]').forEach((h) => {
    if (h.querySelector('.uz-echo')) return;
    const main = h.querySelector('.main');
    ['e2', 'e1'].forEach((c) => {
      const e = main.cloneNode(true);
      e.className = 'uz-echo ' + c;
      e.setAttribute('aria-hidden', 'true');
      h.insertBefore(e, main);
    });
  });

  const fit = () => {
    $$('.uz-mega').forEach((h) => {
      h.style.fontSize = '';
      const main = h.querySelector('.main');
      const wrap = h.closest('.uz-wrap');
      const avail = (wrap ? wrap.clientWidth - 10 : innerWidth * 0.92);
      let max = 0;
      main.querySelectorAll('.ln > span').forEach((s) => { max = Math.max(max, s.offsetWidth); });
      if (max > avail) h.style.fontSize = (parseFloat(getComputedStyle(h).fontSize) * avail / max).toFixed(1) + 'px';
    });
  };
  fit();
  on(window, 'resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  const hero = $('[data-hero]');
  const H = hero && {
    sec: hero,
    frames: $$('.uz-frame', hero).map((f) => ({ el: f, lines: [0, 1, 2].map((i) => $$(`.ln:nth-child(${i + 1}) > span`, f)).filter((x) => x.length), e1: $('.uz-echo.e1', f), e2: $('.uz-echo.e2', f) })),
    infos: $$('.uz-info', hero),
    objin: $('.uz-objin', hero), book: $('.uz-book', hero), cover: $('.f-cover', hero), shadow: $('.uz-shadow', hero),
    sheen: $('.f-sheen', hero), shades: $$('.f-shade', hero),
    marks: $$('[data-at]', hero), calls: $$('[data-call]', hero), sparks: $$('[data-spark]', hero),
    dots: $$('.uz-dots i', hero), big: $('[data-bignum]', hero),
  };
  const split = $('[data-split]');
  const S = split && { sec: split, right: $('.sp-right', split), steps: $$('.sp-step', split), cards: $$('.sp-card', split), word: $('.sp-word', split), bar: $('.sp-bar', split), type: $('[data-type]', split) };
  const gap = $('[data-gap]');
  const G = gap && { sec: gap, words: $$('[data-words] .w', gap), banner: $('[data-words]', gap), why: $('.gap-why h2', gap), cols: $$('[data-col]', gap), draw: $('[data-draw]', gap) };
  const unlock = $('[data-unlock]');
  const U = unlock && { sec: unlock, covs: $$('[data-cov]', unlock), lines: $$('[data-ul]', unlock), chips: $$('[data-chip]', unlock) };
  const fin = $('[data-final]');
  const F = fin && { sec: fin, lines: $$('.ln > span', fin), e1: $('.uz-echo.e1', fin), e2: $('.uz-echo.e2', fin) };
  const floats = $$('[data-speed]').map((el) => ({ el, sp: +el.dataset.speed, rot: +(el.dataset.rot || 0), sec: el.closest('section'), ph: Math.random() * 6 }));
  const pats = $$('[data-pat]').map((el) => ({ el, sp: +el.dataset.pat, sec: el.closest('section') }));

  // counters
  const counted = new WeakSet();
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting || counted.has(en.target)) return;
      counted.add(en.target);
      const el = en.target, end = +el.dataset.count, t0 = performance.now(), dur = end > 100 ? 1800 : 1100;
      if (reduce) return;
      const step = (now) => {
        const k = clamp((now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(end * e).toLocaleString('en-GB');
        if (k < 1) requestAnimationFrame(step);
      };
      el.textContent = '0';
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 }) : null;
  if (io) $$('[data-count]').forEach((el) => io.observe(el));

  // the first headline rises in once the intro has finished
  let introT = 0;
  const startIntro = () => { if (!introT) introT = performance.now(); };
  if (document.documentElement.classList.contains('intro')) on(window, 'smg:intro-end', startIntro);
  else startIntro();
  const failsafe = setTimeout(startIntro, 12000);

  // pointer parallax
  let mx = 0, my = 0, smx = 0, smy = 0;
  on(window, 'pointermove', (e) => { if (e.pointerType !== 'mouse') return; mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  let raf = 0, lastY = scrollY, vel = 0;
  const cur = { x: 0, y: 34, rx: 16, ry: -30, rz: 9, s: 1, open: 0 };
  let first = true, lastF = -1;

  const progress = (r) => clamp(-r.top / Math.max(1, r.height - innerHeight));
  const near = (r) => r.bottom > -innerHeight * 0.2 && r.top < innerHeight * 1.2;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = now / 1000;
    const vw = innerWidth / 100, vh = innerHeight / 100, mobile = innerWidth <= 900;
    const y = scrollY;
    vel = lerp(vel, y - lastY, 0.18);
    lastY = y;
    const skew = reduce ? 0 : clamp(-vel * 0.06, -5, 5);
    root.style.setProperty('--skew', skew.toFixed(2) + 'deg');
    smx = lerp(smx, mx, 0.06); smy = lerp(smy, my, 0.06);

    // ---- hero ----
    if (H) {
      const r = H.sec.getBoundingClientRect();
      if (near(r)) {
        const p = progress(r);
        const ib = introT ? clamp((now - introT) / 1000) : 0;
        let active = 0;
        H.frames.forEach((F, fi) => {
          const [a, b, c, d] = FRAMES[fi];
          let vis = 0;
          F.lines.forEach((spans, li) => {
            const e = fi === 0 ? ss(0, 1, ib * 1.5 - li * 0.18) : ss(a + li * 0.012, b + li * 0.012, p);
            const x = ss(c + li * 0.008, d + li * 0.008, p);
            vis = Math.max(vis, e * (1 - x));
            const ty = (1 - e) * 112 - x * 112;
            spans.forEach((s) => { s.style.transform = `translate3d(0,${ty.toFixed(2)}%,0) rotate(${((1 - e) * 5 - x * 4).toFixed(2)}deg)`; });
          });
          const fe = fi === 0 ? ss(0, 1, ib * 1.3) : ss(a, b, p);
          const fx = ss(c, d, p);
          const spread = (1 - fe) * 0.5 + fx * 0.5 + Math.abs(vel) * 0.004;
          if (F.e1) F.e1.style.transform = `translate3d(0,${(0.07 + spread * 0.35).toFixed(3)}em,0)`;
          if (F.e2) F.e2.style.transform = `translate3d(0,${(0.14 + spread * 0.7).toFixed(3)}em,0)`;
          F.el.style.visibility = vis > 0.001 ? 'visible' : 'hidden';
          if (vis > 0.5) active = fi;
          const inf = H.infos[fi];
          if (inf) {
            const io2 = (fi === 0 ? ss(0.35, 1, ib) : ss(a + 0.02, b + 0.02, p)) * (c > 1.5 ? 1 : 1 - ss(c - 0.02, d - 0.03, p));
            inf.style.opacity = io2.toFixed(3);
            inf.style.transform = `translate3d(0,${((1 - io2) * 26).toFixed(1)}px,0)`;
            inf.style.visibility = io2 > 0.01 ? 'visible' : 'hidden';
          }
        });
        if (active !== lastF) {
          lastF = active;
          H.dots.forEach((d, i) => d.classList.toggle('on', i === active));
          if (H.big) H.big.textContent = '0' + (active + 1);
        }

        // booklet
        const P = pose(p, mobile);
        const k = reduce || first ? 1 : 0.09;
        for (const key in P) cur[key] = lerp(cur[key], P[key], key === 'open' ? Math.min(1, k * 1.3) : k);
        first = false;
        const idle = reduce ? 0 : 1;
        const rx = cur.rx + Math.sin(t * 0.9) * 3 * idle - smy * 10;
        const ry = cur.ry + Math.sin(t * 0.6) * 6 * idle + smx * 16;
        const rz = cur.rz + Math.sin(t * 0.7 + 1) * 2 * idle;
        const bw = H.book.offsetWidth;
        const bx = cur.x * vw + cur.open * bw * 0.5 * cur.s;
        const by = cur.y * vh + Math.sin(t * 1.15) * 7 * idle;
        H.objin.style.transform = `translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${cur.s.toFixed(3)})`;
        H.book.style.setProperty('--open', cur.open.toFixed(4));
        const ryr = (ry * Math.PI) / 180;
        H.book.style.setProperty('--sh', (((ry % 360) + 360) % 360 / 360 * 160 - 30).toFixed(1) + '%');
        H.shades.forEach((s) => { s.style.setProperty('--dk', (0.42 * Math.abs(Math.sin(ryr)) + 0.18 * Math.abs(Math.sin((rx * Math.PI) / 180))).toFixed(3)); });
        const bh = H.book.offsetHeight * cur.s;
        H.shadow.style.transform = `translate3d(${(bx - (cur.open ? bw * 0.5 * cur.s * cur.open : 0)).toFixed(1)}px,${(cur.y * vh + bh * 0.62).toFixed(1)}px,0) scale(${(cur.s * (1 + cur.open * 0.8) * (bw / 260)).toFixed(3)},${(cur.s * (bw / 260)).toFixed(3)})`;
        H.shadow.style.opacity = (0.75 - Math.sin(t * 1.15) * 0.12 * idle).toFixed(3);

        // marks on the page, stamps and callouts
        H.marks.forEach((m) => {
          const at = +m.dataset.at;
          m.classList.toggle('on', p >= at && p < 0.995);
          if (m.dataset.x) m.classList.toggle('x', p >= +m.dataset.x);
        });
        const cx = innerWidth / 2 + (cur.x * vw + cur.open * bw * 0.5 * cur.s) - cur.open * bw * 0.5 * cur.s;
        const cy = innerHeight / 2 + by;
        const half = bw * cur.s * (cur.open > 0.5 ? 1 : 0.5);
        const bhh = H.book.offsetHeight * cur.s * 0.5;
        const CALL = mobile
          ? [[0, -bhh - 52, 0], [0, -bhh - 18, 1], [0, bhh + 20, 0], [0, bhh + 54, 1]]
          : [[-half - 40, -bhh * 0.55, 0], [half + 40, -bhh * 0.25, 1], [-half - 30, bhh * 0.35, 0], [half + 30, bhh * 0.7, 1]];
        H.calls.forEach((c, i) => {
          const showC = p > 0.6 + i * 0.025 && p < 0.715;
          c.classList.toggle('on', showC);
          const [ox, oy, right] = CALL[i];
          c.style.top = (cy + oy).toFixed(0) + 'px';
          if (mobile) {
            c.style.left = right ? 'auto' : '14px';
            c.style.right = right ? '14px' : 'auto';
            c.style.translate = '0 -50%';
          } else {
            c.style.left = (cx + ox).toFixed(0) + 'px';
            c.style.right = 'auto';
            c.style.translate = right ? '0 -50%' : '-100% -50%';
          }
        });
        H.sparks.forEach((s, i) => {
          if (reduce) { s.style.display = 'none'; return; }
          const ang = t * (0.35 + i * 0.07) + i * 1.05;
          const R = (bw * 0.95 + i * 18) * cur.s * (1 + cur.open * 0.5);
          const sx = Math.cos(ang) * R, sy = Math.sin(ang) * R * 0.42;
          const front = Math.sin(ang) > 0;
          s.style.zIndex = front ? 6 : 3;
          s.style.fontSize = (mobile ? 13 : 18) + (i % 3) * 5 + 'px';
          s.style.opacity = ((front ? 0.9 : 0.35) * (1 - ss(0.95, 1, p))).toFixed(2);
          s.style.transform = `translate3d(${(cx - innerWidth / 2 + sx).toFixed(1)}px,${(cy - innerHeight / 2 + sy).toFixed(1)}px,0) translate(-50%,-50%) rotate(${(ang * 40).toFixed(1)}deg) scale(${front ? 1 : 0.7})`;
        });
      }
    }

    // ---- split: how it works ----
    if (S) {
      const r = S.sec.getBoundingClientRect();
      if (near(r)) {
        const p = progress(r);
        const enter = clamp((innerHeight - r.top) / innerHeight);
        S.right.style.setProperty('--wipe', (1 - ss(0.15, 0.95, enter)).toFixed(4));
        const act = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
        S.steps.forEach((s, i) => s.classList.toggle('on', i === act));
        S.bar.style.transform = `scaleX(${p.toFixed(4)})`;
        S.word.style.transform = `translate3d(${(-p * 60 + 10).toFixed(2)}vw,0,0)`;
        S.cards.forEach((c, i) => {
          const local = p * 3 - i;
          const a = i === 0 ? ss(-0.6, 0, enter - 1) : ss(-0.22, 0.04, local);
          const b = i === 2 ? 0 : ss(0.86, 1.1, local);
          const yy = (1 - a) * innerHeight * 0.7 - b * innerHeight * 0.7;
          const tw = reduce ? 0 : Math.sin(t * 0.8 + i) * 3;
          c.style.opacity = (a * (1 - b)).toFixed(3);
          c.style.transform = `translate3d(0,calc(-50% + ${yy.toFixed(1)}px),0) rotateX(${(8 + tw * 0.5).toFixed(2)}deg) rotateY(${(-16 + clamp(local) * 26 + tw + smx * 10).toFixed(2)}deg) rotateZ(${((1 - a) * 16 - b * 12 + (i - 1) * 2).toFixed(2)}deg)`;
          c.style.visibility = a * (1 - b) > 0.01 ? 'visible' : 'hidden';
        });
        if (S.type) {
          const tp = clamp((p * 3 - 1 - 0.08) / 0.7);
          const n = Math.round(TYPED.length * tp);
          if (S.type.textContent.length !== n) S.type.textContent = TYPED.slice(0, n);
        }
      }
    }

    // ---- gap (gold) ----
    if (G) {
      const r = G.sec.getBoundingClientRect();
      if (near(r)) {
        const br = G.banner.getBoundingClientRect();
        const wp = clamp((innerHeight * 0.88 - br.top) / (innerHeight * 0.55 + br.height * 0.6));
        const lit = Math.round(wp * G.words.length);
        G.words.forEach((w, i) => w.classList.toggle('on', i < lit));
        const hr = G.why.getBoundingClientRect();
        G.why.style.setProperty('--draw', (1 - ss(0.05, 0.6, (innerHeight * 0.85 - hr.top) / innerHeight)).toFixed(3));
        G.cols.forEach((c, i) => {
          const cr = c.getBoundingClientRect();
          const e = reduce ? 1 : ss(0, 1, (innerHeight - cr.top) / (innerHeight * 0.45) - (mobile ? 0 : i * 0.12));
          c.style.transform = `translate3d(0,${((1 - e) * 90).toFixed(1)}px,0) rotate(${((1 - e) * (i - 1) * 6).toFixed(2)}deg)`;
          c.style.opacity = (0.15 + e * 0.85).toFixed(3);
        });
        if (G.draw) { const dr = G.draw.getBoundingClientRect(); G.draw.style.strokeDashoffset = (1 - ss(0, 1, (innerHeight * 0.95 - dr.top) / (innerHeight * 0.4))).toFixed(3); }
      }
    }

    // ---- unlock (zoom) ----
    if (U) {
      const r = U.sec.getBoundingClientRect();
      if (near(r)) {
        const p = clamp((innerHeight - r.top) / (r.height));
        const spin = reduce ? 0 : t;
        U.covs.forEach((c, i) => {
          const z = [0.7 + p * 0.7, 0.8 + p * 0.4, 0.6 + p * 0.6][i];
          const ro = [-18 + p * 40, 14 - p * 30, 24 - p * 50][i] + Math.sin(spin * 0.5 + i) * 3;
          const dy = [(0.5 - p) * 40, (0.5 - p) * -30, (0.5 - p) * 60][i];
          c.style.transform = `translate3d(-50%,${dy.toFixed(1)}vh,0) perspective(900px) rotateY(${(Math.sin(spin * 0.4 + i * 2) * 14 + (i - 1) * 18).toFixed(2)}deg) rotateZ(${ro.toFixed(2)}deg) scale(${z.toFixed(3)})`;
        });
        const xs = [lerp(-34, 6, p), lerp(36, -6, p), lerp(-26, 4, p)];
        U.lines.forEach((l, i) => { l.style.transform = `translate3d(${xs[i].toFixed(2)}vw,0,0) skewX(${clamp(-vel * 0.15, -10, 10).toFixed(2)}deg)`; });
        U.chips.forEach((c, i) => {
          const e = ss(0.35 + i * 0.08, 0.5 + i * 0.08, p);
          c.style.opacity = e.toFixed(3);
          c.style.transform = `translate3d(0,${(Math.sin(spin * 1.3 + i * 2) * 8 + (1 - e) * 40).toFixed(1)}px,0) rotate(${(i - 1) * 4}deg) scale(${(0.7 + e * 0.3).toFixed(3)})`;
        });
      }
    }

    // ---- final ----
    if (F) {
      const r = F.sec.getBoundingClientRect();
      if (near(r)) {
        const e0 = clamp((innerHeight - r.top) / (innerHeight * 0.8));
        const n = F.lines.length / 3;
        F.lines.forEach((s, i) => {
          const li = i % n;
          const e = ss(0.15 + li * 0.12, 0.65 + li * 0.12, e0);
          s.style.transform = `translate3d(0,${((1 - e) * 112).toFixed(2)}%,0) rotate(${((1 - e) * 5).toFixed(2)}deg)`;
        });
        const spread = (1 - ss(0.3, 1, e0)) + Math.abs(vel) * 0.006 + (reduce ? 0 : Math.sin(t * 1.2) * 0.04 + 0.04);
        if (F.e1) F.e1.style.transform = `translate3d(0,${(0.08 + spread * 0.4).toFixed(3)}em,0)`;
        if (F.e2) F.e2.style.transform = `translate3d(0,${(0.16 + spread * 0.8).toFixed(3)}em,0)`;
      }
    }

    // ---- drifting cards and patterns ----
    if (!reduce) {
      floats.forEach((f) => {
        if (!f.sec) return;
        const r = f.sec.getBoundingClientRect();
        if (!near(r)) return;
        const off = r.top + r.height / 2 - innerHeight / 2;
        f.el.style.transform = `translate3d(${(Math.sin(t * 0.5 + f.ph) * 10).toFixed(1)}px,${(off * f.sp + Math.sin(t * 0.8 + f.ph) * 8).toFixed(1)}px,0) rotate(${(f.rot + Math.sin(t * 0.6 + f.ph) * 3).toFixed(2)}deg)`;
      });
      pats.forEach((pt) => {
        if (!pt.sec) return;
        const r = pt.sec.getBoundingClientRect();
        if (!near(r)) return;
        pt.el.style.backgroundPosition = `${(Math.sin(t * 0.12) * 30).toFixed(1)}px ${(r.top * pt.sp - t * 8).toFixed(1)}px`;
      });
    }
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(failsafe);
    if (io) io.disconnect();
    offs.forEach((f) => f());
  };
}
