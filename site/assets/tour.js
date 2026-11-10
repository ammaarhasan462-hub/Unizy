/* Unizy dashboard tour: a one-time, step-by-step introduction shown the first time a student opens the dashboard
   after signing up and picking their modules. Each step spotlights the real part of the dashboard where it can
   (on wide screens) and explains what it does, why it helps and how to use it, with a small interactive preview.
   Seen once per account: remembered on the account (user_metadata.tour_v1) and on the device.
   Replay from Account: UnizyTour.start(ctx, true). */
(function () {
  'use strict';
  var KEY = 'unizy:tour1:', FLAG = 'tour_v1';
  var T = null; // { ctx, i, el, steps }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function local(uid, v) { try { if (v) localStorage.setItem(KEY + uid, '1'); return localStorage.getItem(KEY + uid) === '1'; } catch (e) { return false; } }

  // ---------- small previews shown inside the cards (some are clickable) ----------
  var ILL = {
    welcome: '<div class="tz-flow"><span><b>1</b>Practise</span><i>→</i><span><b>2</b>Get marked</span><i>→</i><span><b>3</b>Improve</span></div>',
    next: '<div class="tz-mini dark"><span class="tz-k">Nearest exam · 12 days to go</span><b>Next up: Game theory</b><span class="tz-btn">Answer this →</span></div>',
    tree: '<ul class="tz-tree"><li class="m">ECON0002 Microeconomics <em>38%</em></li><li><i class="dot g"></i>T1 Consumer choice</li><li><i class="dot a"></i>T2 Production and costs</li><li><i class="dot r"></i>T3 Game theory</li><li><i class="dot n"></i>T4 Market structure</li></ul>',
    rag: '<div class="tz-rag" data-tz="rag"><div class="tz-seg"><button type="button" data-v="" class="on">All</button><button type="button" data-v="r"><i class="dot r"></i>Weak</button><button type="button" data-v="a"><i class="dot a"></i>Medium</button><button type="button" data-v="g"><i class="dot g"></i>Mastered</button></div>' +
      '<ul class="tz-tree"><li data-rs="g"><i class="dot g"></i>Consumer choice</li><li data-rs="r"><i class="dot r"></i>Game theory</li><li data-rs="a"><i class="dot a"></i>Labour markets</li><li data-rs="r"><i class="dot r"></i>Inequality</li></ul><p class="tz-try">Try it: tap Weak.</p></div>',
    palette: '<div class="tz-pal"><div class="tz-palin"><span class="tz-q">ECON0002 W3</span><span class="tz-caret"></span><kbd>Ctrl K</kbd></div><div class="tz-palrow"><i class="dot a"></i><b>ECON0002 · Topic 3</b> Game theory <kbd>↵</kbd></div></div>',
    tiers: '<div class="tz-tiers" data-tz="tiers"><div class="tz-pills"><button type="button" data-v="0" class="on">Pass (50%)</button><button type="button" data-v="1">Merit (60%)</button><button type="button" data-v="2">1st Class (70%+)</button></div><p class="tz-tq" data-tq="0"><b>Quick recall</b>“Define a Nash equilibrium.” Check yourself against the answer, then say how you did.</p><p class="tz-tq" data-tq="1" hidden><b>Exam-style</b>“Evaluate the claim that the Prisoner’s Dilemma explains price wars.” Answered and marked like the real exam.</p><p class="tz-tq" data-tq="2" hidden><b>Stretch</b>Links two topics or pushes the hard case. This is where 70+ comes from.</p></div>',
    mark: '<div class="tz-insp"><div class="tz-ev"><span class="tz-band">2:1</span><div><b>62–66</b><span>predicted mark range</span></div></div><ul class="tz-al"><li><span>Accurate model and diagram</span><b>17/20</b><i style="--w:85%"></i></li><li><span>Counter-case evaluated</span><b>12/25</b><i class="low" style="--w:48%"></i></li><li><span>Reasoned judgement</span><b>10/20</b><i style="--w:50%"></i></li></ul><p class="tz-warn"><b>Examiner warning</b>Don’t end on “it depends” without saying what it depends on.</p></div>',
    parse: '<div class="tz-parse"><div class="tz-drop">Lecture 4 slides.pdf</div><i>→</i><div class="tz-units"><span><b>1</b>Externalities</span><span><b>2</b>Public goods</span><span><b>3</b>Pigouvian taxes</span><em>+ 7 flashcards</em></div></div>',
    cards: '<button type="button" class="tz-card" data-tz="flip"><span class="tz-cf"><small>ECON0004 · Applied Economics</small>What is deadweight loss?<em>Tap to flip</em></span><span class="tz-cb"><small>Answer</small>The welfare lost when output is below the efficient level.<em>Comes back just before you’d forget it</em></span></button>',
    exam: '<div class="tz-exam"><span class="tz-badge">Exam simulator</span><b class="tz-clock" data-tz="clock">45:00</b><span>left · no hints · marked when you hand in</span></div>',
    tutor: function (c) { return '<div class="tz-chat"><p class="me">Can you explain price elasticity like I’m revising for tomorrow?</p><p class="them"><b>' + esc(c.tutor) + '</b>Sure. Elasticity measures how much quantity demanded responds to a price change…</p></div>'; },
    done: '<ul class="tz-check"><li>Your next question is waiting on Today</li><li>Every answer is saved in Marked answers</li><li>Replay this tour any time from Account</li></ul>'
  };

  function steps(c) {
    var plan = c.plan || {};
    var planLine = plan.tier === 'pro' ? 'You’re on Pro, so marking and your tutor are ready whenever you are.'
      : plan.tier === 'trial' ? 'Your free trial includes ' + (plan.assessPerDay || 3) + ' markings and ' + (plan.actionsPerDay || 3) + ' tutor questions a day' + (plan.until ? ', until ' + new Date(plan.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '') + '. Notes, flashcards and quick recall are always free.'
      : 'Notes, flashcards and quick recall are always free. Marking and your tutor come with Pro.';
    return [
      { id: 'welcome', kick: 'Welcome to Unizy', title: 'Here’s how your dashboard gets you a better mark', body: 'A quick look at what each part does, why it helps and how to use it. It takes about a minute and you’ll only see it once.', ill: 'welcome', next: 'Show me' },
      { id: 'next', target: '.td-next', title: 'Start with the question that matters most', body: 'Every day, <b>Today</b> picks one question for you: your nearest exam first, then your weakest topic, at the right level for where you are.', why: 'No more opening your notes and wondering where to begin. Press the button and you’re revising the thing most likely to move your mark.', ill: 'next' },
      { id: 'tree', target: '#db-mods', title: 'Every module, topic by topic', body: 'Your modules live in the sidebar, split into the topics they’re taught in. Each topic has a dot: <b class="r">red</b> is weak, <b class="a">amber</b> is getting there, <b class="g">green</b> is mastered.', why: 'The dots come from how you actually do in practice, so you see the gaps before the exam finds them for you.', ill: 'tree' },
      { id: 'rag', target: '#db-ragf', title: 'Revise your weak spots first', body: 'Tap <b>Weak</b> to light up every red topic across all your modules at once. Medium and Mastered work the same way.', why: 'Revising topics you already know feels productive but doesn’t raise your mark. This points your time at the topics that will.', ill: 'rag' },
      { id: 'palette', target: '#db-cmdk', title: 'Jump anywhere in a second', body: 'Press <kbd>Ctrl K</kbd> (<kbd>⌘K</kbd> on a Mac) or tap the search bar, then type a module, a topic or a week. <b>ECON0002 W3</b> takes you straight to topic 3.', why: 'Got 20 minutes between lectures? Get to the exact topic you need without clicking around.', ill: 'palette' },
      { id: 'tiers', target: '.db-seg', title: 'Three levels of practice for every topic', body: 'In <b>Topic arena</b>, each topic has questions at three levels: <b>Pass</b> for quick recall of the essentials, <b>Merit</b> for a full exam-style question, and <b>1st Class</b> for a stretch question.', why: 'Build up from knowing the facts to writing a First-class answer, instead of jumping into essays you’re not ready for.', ill: 'tiers' },
      { id: 'mark', title: 'Get marked the way your department marks', body: 'Write your answer under a timer (there’s a maths and code toolbar, and you can add photos of handwritten work). It’s marked against your department’s criteria and ' + esc(c.uni) + '’s grade bands in about 30 seconds. On the right you’ll see your grade band, a <b>mark allocation</b> showing exactly where marks were won and lost, a <b>First-class model answer</b>, and <b>examiner warnings</b> about the traps students fall into on that question.', why: 'At A-level you had mark schemes. At uni you usually don’t. This shows you what a First looks like for your exact question, then lets you rewrite it and watch your mark move.', ill: 'mark' },
      { id: 'parse', title: 'Turn a lecture into revision in one go', body: 'On any module, switch to <b>Parse mode</b> and drop in lecture slides, a transcript or your own notes. You get short study units with the key points, plus flashcards you can add to your deck in one tap.', why: 'Instead of rereading 60 slides, you get the ideas that actually get examined, ready to test yourself on.', ill: 'parse' },
      { id: 'cards', target: '#db-due', title: 'Flashcards that come back at the right time', body: 'Every mark you lose and every quick-recall question you miss becomes a flashcard automatically. This badge shows how many are due today; <b>Flashcards</b> in the sidebar has a deck for each module.', why: 'Cards come back just before you’d forget them, so a few minutes a day keeps everything fresh for the exam.', ill: 'cards' },
      { id: 'exam', target: '.db-seg a[data-mode="exam"]', title: 'Practise under real exam conditions', body: '<b>Exam simulator</b> gives you a question you haven’t seen, a countdown clock, and no hints or mark scheme until it’s marked.', why: 'Knowing the content isn’t the same as writing it against the clock. Do a few of these and the real exam feels familiar.', ill: 'exam' },
      { id: 'tutor', target: '.db-nav a[data-tab="tutor"]', title: 'Ask ' + esc(c.tutor) + ' anything', body: 'Your tutor knows your modules. Ask for a topic explained, a quick check of your understanding, or help planning an answer. You can attach photos and files too.', why: 'Stuck late at night? You don’t have to wait for office hours. It won’t write coursework for you, but it will help you understand it.', ill: 'tutor' },
      { id: 'done', kick: 'You’re all set', title: 'Ready when you are', body: planLine, ill: 'done', next: c.nextHref ? 'Start my first question' : 'Find my modules', finish: true }
    ];
  }

  // ---------- render ----------
  function css() {
    if (document.getElementById('tz-css')) return;
    var l = document.createElement('link'); l.id = 'tz-css'; l.rel = 'stylesheet'; l.href = '/assets/tour.css?v=1';
    document.head.appendChild(l);
  }
  function visible(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return null;
    var cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return null;
    return r;
  }
  function paint() {
    var s = T.steps[T.i], n = T.steps.length, c = T.ctx;
    var target = s.target && window.innerWidth >= 900 ? document.querySelector(s.target) : null;
    if (target && s.target === '#db-due' && target.hidden) target = null;
    if (target) {
      var r0 = target.getBoundingClientRect();
      if (r0.top < 70 || r0.bottom > window.innerHeight - 20) target.scrollIntoView({ block: 'center' });
    }
    var r = visible(target);
    var ill = typeof ILL[s.ill] === 'function' ? ILL[s.ill](c) : ILL[s.ill] || '';
    var card = T.el.querySelector('.tz-card-wrap');
    card.innerHTML = '<div class="tz-top"><span class="tz-step">' + (s.kick ? esc(s.kick) : 'Step ' + T.i + ' of ' + (n - 2)) + '</span><button type="button" class="tz-skip" data-tzact="skip">' + (s.finish ? 'Close' : 'Skip tour') + '</button></div>' +
      '<div class="tz-bar"><i style="width:' + Math.round(T.i / (n - 1) * 100) + '%"></i></div>' +
      (ill ? '<div class="tz-ill">' + ill + '</div>' : '') +
      '<h2 id="tz-h">' + s.title + '</h2><p class="tz-body">' + s.body + '</p>' +
      (s.why ? '<p class="tz-why"><b>Why it helps</b>' + s.why + '</p>' : '') +
      '<div class="tz-act">' + (T.i > 0 && !s.finish ? '<button type="button" class="tz-back" data-tzact="back">Back</button>' : '<span></span>') +
      '<div class="tz-dots" aria-hidden="true">' + T.steps.map(function (x, k) { return '<i' + (k === T.i ? ' class="on"' : k < T.i ? ' class="done"' : '') + '></i>'; }).join('') + '</div>' +
      '<button type="button" class="tz-next" data-tzact="next">' + esc(s.next || (T.i === n - 2 ? 'Finish' : 'Next')) + '<span aria-hidden="true">→</span></button></div>';
    var hole = T.el.querySelector('.tz-hole');
    T.el.classList.toggle('spot', !!r);
    if (r) {
      var pad = 8;
      hole.style.cssText = 'top:' + (r.top - pad) + 'px;left:' + (r.left - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px';
      place(card, r);
    } else {
      hole.style.cssText = 'top:50%;left:50%;width:0;height:0';
      card.style.cssText = '';
    }
    var nb = card.querySelector('.tz-next'); if (nb) try { nb.focus({ preventScroll: true }); } catch (e) {}
    if (s.ill === 'exam') clock();
  }
  function place(card, r) {
    var W = window.innerWidth, H = window.innerHeight, cw = Math.min(420, W - 32), gap = 18;
    card.style.width = cw + 'px';
    var ch = card.offsetHeight, left, top;
    if (r.right + gap + cw < W - 16) { left = r.right + gap; top = r.top + r.height / 2 - ch / 2; }
    else if (r.left - gap - cw > 16) { left = r.left - gap - cw; top = r.top + r.height / 2 - ch / 2; }
    else if (r.bottom + gap + ch < H - 16) { top = r.bottom + gap; left = r.left + r.width / 2 - cw / 2; }
    else { top = r.top - gap - ch; left = r.left + r.width / 2 - cw / 2; }
    left = Math.max(16, Math.min(W - cw - 16, left)); top = Math.max(16, Math.min(H - ch - 16, top));
    card.style.position = 'fixed'; card.style.left = left + 'px'; card.style.top = top + 'px'; card.style.transform = 'none';
  }
  var clockId = null;
  function clock() {
    clearInterval(clockId); var t = 45 * 60;
    clockId = setInterval(function () { var el = T && T.el.querySelector('[data-tz="clock"]'); if (!el) { clearInterval(clockId); return; } t--; el.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }, 1000);
  }
  function go(d) {
    var n = T.steps.length, s = T.steps[T.i];
    if (d > 0 && s.finish) { finish(true); return; }
    T.i = Math.max(0, Math.min(n - 1, T.i + d));
    track('tour_step_' + T.steps[T.i].id);
    paint();
  }
  function track(ev) { if (T && T.ctx.track) T.ctx.track(ev); }
  function finish(go1) {
    var c = T.ctx, last = T.steps[T.i];
    track(last.finish ? 'tour_done' : 'tour_skip_' + last.id);
    markSeen(c);
    clearInterval(clockId);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    T.el.classList.add('tz-off');
    var el = T.el; setTimeout(function () { el.remove(); }, 220);
    T = null;
    if (go1 && c.nav) c.nav(c.nextHref || '/dashboard/practice');
  }
  function markSeen(c) {
    local(c.uid, true);
    var data = {}; data[FLAG] = new Date().toISOString();
    c.auth('PUT', { data: data }).catch(function () {});
  }
  function onKey(e) {
    if (!T) return;
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !/BUTTON/.test((document.activeElement || {}).tagName || ''))) { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'Tab') { // keep focus inside the card
      var f = T.el.querySelectorAll('button'); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  }
  var rT = null;
  function onResize() { clearTimeout(rT); rT = setTimeout(function () { if (T) paint(); }, 120); }

  function open(ctx) {
    if (T || document.querySelector('.uzw')) return;
    css();
    var el = document.createElement('div');
    el.className = 'tz';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tz-h');
    el.innerHTML = '<div class="tz-hole"></div><div class="tz-card-wrap"></div>';
    document.body.appendChild(el);
    T = { ctx: ctx, i: 0, el: el, steps: steps(ctx) };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tzact]');
      if (b) { var a = b.getAttribute('data-tzact'); if (a === 'next') go(1); else if (a === 'back') go(-1); else finish(false); return; }
      var rag = e.target.closest('[data-tz="rag"] [data-v]');
      if (rag) { var box = rag.closest('[data-tz="rag"]'); box.setAttribute('data-f', rag.getAttribute('data-v')); box.querySelectorAll('[data-v]').forEach(function (x) { x.classList.toggle('on', x === rag); }); return; }
      var tier = e.target.closest('[data-tz="tiers"] [data-v]');
      if (tier) { var tb = tier.closest('[data-tz="tiers"]'), v = tier.getAttribute('data-v'); tb.querySelectorAll('[data-v]').forEach(function (x) { x.classList.toggle('on', x === tier); }); tb.querySelectorAll('[data-tq]').forEach(function (p) { p.hidden = p.getAttribute('data-tq') !== v; }); return; }
      var flip = e.target.closest('[data-tz="flip"]');
      if (flip) { flip.classList.toggle('flipped'); return; }
    });
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    track('tour_open');
    requestAnimationFrame(function () { el.classList.add('tz-on'); paint(); });
  }

  // ctx: { uid, plan, tutor, uni, nextHref, nav(href), track(ev), auth(method, body) -> Promise<user> }
  function maybe(ctx) {
    if (T || !ctx.uid || local(ctx.uid)) return;
    ctx.auth('GET').then(function (u) {
      var meta = (u && u.user_metadata) || {};
      if (meta[FLAG]) { local(ctx.uid, true); return; }
      // wait for the personal welcome screen (if there is one) to close first
      var tries = 0;
      (function wait() {
        if (document.querySelector('.uzw') || document.documentElement.classList.contains('uzw-wait')) { if (++tries < 600) setTimeout(wait, 500); return; }
        if (ctx.ready && !ctx.ready()) { if (++tries < 600) setTimeout(wait, 400); return; }
        setTimeout(function () { open(ctx); }, 450);
      })();
    }).catch(function () {});
  }
  window.UnizyTour = { maybe: maybe, start: function (ctx) { open(ctx); }, active: function () { return !!T; } };
})();
