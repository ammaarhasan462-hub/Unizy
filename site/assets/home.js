/* Unizy home page: interactive demo, coverage figures, live reviews and anonymous visit counts. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG || {}, H = window.UNIZY_HOME || {};
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, html) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }); if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------------- anonymous counts (no cookies, no IDs) ----------------
  var Track = (function () {
    var off = false;
    try {
      var p = new URLSearchParams(location.search);
      if (p.get('notrack') === '1') localStorage.setItem('unizy:notrack', '1');
      if (p.get('notrack') === '0') localStorage.removeItem('unizy:notrack');
      off = localStorage.getItem('unizy:notrack') === '1';
    } catch (e) {}
    if (navigator.webdriver || navigator.globalPrivacyControl || navigator.doNotTrack === '1') off = true;
    var sent = {};
    return function (ev, once) {
      if (off || !CFG.supabaseUrl || (once && sent[ev])) return;
      sent[ev] = 1;
      try {
        fetch(CFG.supabaseUrl + '/rest/v1/rpc/track_event', { method: 'POST', keepalive: true, headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_event: ev }) }).catch(function () {});
      } catch (e) {}
    };
  })();
  Track('home_view', true);
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-ev]'); if (a) Track(a.getAttribute('data-ev'), true); });

  // ---------------- coverage ----------------
  (function () {
    var s = H.stats; if (!s) return;
    var items = [[s.unis, 'universities'], [s.degrees, 'degrees'], [s.modules.toLocaleString('en-GB'), 'modules from official 2026/27 catalogues'], [s.packs, 'module packs written for one specific module and fact-checked'], [s.libraries, 'subject libraries'], [s.cards.toLocaleString('en-GB'), 'library flashcards']];
    $('stats').innerHTML = items.map(function (x) { return '<div class="stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('');
    var t = '<table class="covtable"><thead><tr><th>University</th><th>Degrees</th><th>Modules</th><th>Module pack</th><th>Subject library</th><th>Closest library</th><th>Outline only</th></tr></thead><tbody>' +
      H.perUni.map(function (u) { return '<tr><td><b>' + esc(u.name) + '</b></td><td>' + u.degrees + '</td><td>' + u.modules + '</td><td>' + u.pack + '</td><td>' + u.full + '</td><td>' + u.close + '</td><td>' + u.outline + '</td></tr>'; }).join('') + '</tbody></table>';
    $('degList').innerHTML = '<div style="overflow-x:auto">' + t + '</div>' + H.perUni.map(function (u) { return '<div class="deg-uni"><h4>' + esc(u.name) + '</h4><ul>' + u.list.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '<p class="muted" style="margin-bottom:14px">More universities and degrees are on the way. Missing yours? Email <a href="mailto:' + esc(CFG.contactEmail) + '">' + esc(CFG.contactEmail) + '</a>.</p>';
  })();

  // ---------------- reviews (real ones only) ----------------
  (function () {
    var box = $('rvBox'); if (!box || !CFG.supabaseUrl) return;
    function empty() {
      box.innerHTML = '<div class="rv-empty"><p><b>No reviews yet.</b> Unizy is new, so there aren’t any reviews to show. We won’t fill this space with made-up quotes: it will show real reviews from students with confirmed accounts as they come in.</p><a class="btn line small" href="/reviews">Leave the first review</a></div>';
    }
    fetch(CFG.supabaseUrl + '/rest/v1/rpc/public_reviews', { method: 'POST', headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_limit: 3, p_offset: 0, p_sort: 'newest' }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var list = d && (d.reviews || d.items || []);
        if (!d || !+d.count || !list || !list.length) return empty();
        box.innerHTML = list.map(function (r) {
          var n = Math.max(0, Math.min(5, +r.rating || 0));
          var who = [r.name, r.course && String(r.course).trim()].filter(Boolean).map(esc).join(' · ') + ' · Verified Unizy account';
          return '<article class="rv-card"><span class="rv-stars" aria-label="' + n + ' out of 5 stars">' + '★★★★★'.slice(0, n) + '<span style="color:#CFCFC8">' + '★★★★★'.slice(0, 5 - n) + '</span></span>' + (r.title ? '<h3>' + esc(r.title) + '</h3>' : '') + '<p>' + esc(r.body) + '</p><span class="rv-who">' + who + '</span></article>';
        }).join('') + '<div style="grid-column:1/-1"><a class="btn line small" href="/reviews">Read all ' + (+d.count) + ' review' + (+d.count === 1 ? '' : 's') + ' (average ' + esc(d.average) + ' / 5)</a></div>';
      }).catch(empty);
  })();

  // ---------------- measured outcomes (published only above a minimum sample) ----------------
  (function () {
    var box = $('outcomes'); if (!box || !CFG.supabaseUrl) return;
    function tile(v, label, sub, ready, have, min) {
      return '<div class="ev-tile"><b class="' + (ready ? '' : 'wait') + '">' + (ready ? v : 'Collecting data') + '</b><span>' + label + '</span><small>' + sub + '</small>' +
        (ready ? '' : '<div class="ev-bar" title="' + have + ' of ' + min + ' students"><i style="width:' + Math.min(100, Math.round(have / min * 100)) + '%"></i></div><small>' + have + ' of ' + min + ' students so far</small>') + '</div>';
    }
    fetch(CFG.supabaseUrl + '/rest/v1/rpc/public_outcomes', { method: 'POST', headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (o) {
        if (!o) throw new Error('none');
        var m = o.min || 20, rt = o.retest || {}, rc = o.recall || {}, mn = o.minutes || {}, sv = o.survey || {};
        var wk = o.week || {}, am = o.afterMistake || {}, wkReady = wk.rate != null && wk.students >= m, amReady = am.rate != null && am.students >= m;
        var rtReady = rt.first != null && rt.students >= m, rcReady = rc.rate != null && rc.students >= m, mnReady = mn.median != null && mn.students >= m, svReady = sv.students >= m;
        var yes = svReady ? Math.round((sv.aLot + sv.aBit) / sv.students * 100) : 0;
        box.innerHTML =
          tile((Math.round(rt.latest) - Math.round(rt.first) >= 0 ? '+' : '') + (Math.round(rt.latest) - Math.round(rt.first)) + ' pts', 'Score change on retested topics', rtReady ? 'Average first try ' + Math.round(rt.first) + '% → latest ' + Math.round(rt.latest) + '% across ' + rt.topics + ' retested topics (' + rt.students + ' students).' : 'How much scores change when students revise a weak topic and test it again.', rtReady, rt.students || 0, m) +
          tile(Math.round(rc.rate) + '%', 'Still known at spaced review', rcReady ? 'Of ' + rc.reviews + ' scheduled flashcard reviews by ' + rc.students + ' students.' : 'How many learned flashcards students still know when they come back days later.', rcReady, rc.students || 0, m) +
          tile(yes + '%', 'Say Unizy saves them time', svReady ? sv.students + ' students answered. ' + (sv.longer ? sv.longer + ' said it takes longer.' : '') : 'From a two-question survey shown in the app after a student’s first week.', svReady, sv.students || 0, m) +
          tile(Math.round(mn.median) + ' min', 'Typical active study per week', mnReady ? 'Median for ' + mn.students + ' students active in the last 7 days. Only minutes of real use count.' : 'Minutes students actually work in Unizy each week, not just time with the tab open.', mnReady, mn.students || 0, m) +
          tile(Math.round(wk.rate) + '%', 'Right on new questions a week later', wkReady ? 'Questions on ideas students had got right 7+ days earlier, which they hadn’t seen before (first attempts, ' + wk.items + ' questions by ' + wk.students + ' students).' : 'Unseen questions on ideas a student got right a week earlier, to check learning sticks and transfers.', wkReady, wk.students || 0, m) +
          tile(Math.round(am.rate) + '%', 'Right on a new case after a mistake', amReady ? 'After a wrong answer and its explanation, the share right on a new scenario testing the same idea (' + am.items + ' questions by ' + am.students + ' students).' : 'Whether explanations fix a misunderstanding: after a wrong answer, a new scenario on the same idea.', amReady, am.students || 0, m);
      })
      .catch(function () { box.innerHTML = '<p class="ev-note">Results will appear here once enough students have used Unizy.</p>'; });
  })();

  // ---------------- interactive demo ----------------
  var D = H.demo || {}, UNIS = H.unis || [];
  var box = $('demoBox'), stage = $('stage');
  if (!box || !stage || !UNIS.length) return;
  var tabs = [].slice.call(box.querySelectorAll('[data-step]'));
  var st = { step: 0, uni: UNIS[0].id, mod: 0, made: false, making: false, qi: 0, picks: {}, planned: false, maxStep: 0 };
  function uni() { return UNIS.filter(function (u) { return u.id === st.uni; })[0]; }
  function mod() { return (D[st.uni] || [])[st.mod]; }
  function setTheme() { var u = uni(); box.style.setProperty('--accent', u.c); box.style.setProperty('--onaccent', u.light ? '#141414' : '#fff'); }
  function go(n) {
    st.step = n; st.maxStep = Math.max(st.maxStep, n);
    if (n === 1) Track('demo_notes', true);
    if (n === 2) Track('demo_quiz', true);
    render();
    if (window.innerWidth < 860) { var t = box.getBoundingClientRect().top + window.scrollY - 70; if (window.scrollY > t) window.scrollTo(0, t); }
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { var n = +b.getAttribute('data-step'); if (n <= st.maxStep) go(n); }); });
  function nextBtn(label, n, disabled) { return '<button class="btn acc" data-go="' + n + '"' + (disabled ? ' disabled' : '') + '>' + label + ' →</button>'; }
  stage.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-go')) return go(+t.getAttribute('data-go'));
    if (t.hasAttribute('data-uni')) { st.uni = t.getAttribute('data-uni'); st.mod = 0; reset(); setTheme(); return render(); }
    if (t.hasAttribute('data-mod')) { st.mod = +t.getAttribute('data-mod'); reset(); return render(); }
    if (t.id === 'mk') { st.making = true; render(); setTimeout(function () { st.making = false; st.made = true; render(); }, 1100); return; }
    if (t.classList.contains('fcard')) { t.classList.toggle('flip'); t.setAttribute('aria-pressed', t.classList.contains('flip')); return; }
    if (t.hasAttribute('data-opt')) { st.picks[st.qi] = +t.getAttribute('data-opt'); if (Object.keys(st.picks).length === mod().qs.length) Track('demo_quiz_done', true); return render(); }
    if (t.id === 'qnext') { st.qi++; return render(); }
    if (t.id === 'plan') { st.planned = true; Track('demo_complete', true); return render(); }
  });
  function reset() { st.made = false; st.qi = 0; st.picks = {}; st.planned = false; st.maxStep = Math.min(st.maxStep, 1); }
  function results() {
    var m = mod(), per = {};
    m.qs.forEach(function (q, i) { var k = q.t; per[k] = per[k] || { t: k, name: m.topics[k] || ('Topic ' + (k + 1)), right: 0, total: 0 }; per[k].total++; if (st.picks[i] === q.answer) per[k].right++; });
    return Object.keys(per).map(function (k) { return per[k]; });
  }
  function weak() { var r = results().filter(function (x) { return x.right < x.total; }); if (!r.length) r = results().slice(0, 1); return r; }

  function render() {
    var u = uni(), m = mod(), h = '';
    tabs.forEach(function (b) { var n = +b.getAttribute('data-step'); b.setAttribute('aria-selected', n === st.step ? 'true' : 'false'); b.disabled = n > st.maxStep; b.classList.toggle('done', n < st.maxStep && n !== st.step); });
    if (st.step === 0) {
      h = '<h3 class="st-h">Pick your uni and a module</h3><p class="st-p">Unizy recolours to your uni and sets up your modules from the official course pages.</p>' +
        '<div class="chips" role="group" aria-label="University">' + UNIS.map(function (x) { return '<button class="chip" data-uni="' + x.id + '" aria-pressed="' + (x.id === st.uni) + '" style="--c:' + x.c + ';--cf:' + (x.light ? '#141414' : '#fff') + '">' + esc(x.name) + '</button>'; }).join('') + '</div>' +
        '<div class="modlist" role="group" aria-label="Module">' + (D[st.uni] || []).map(function (x, i) { return '<button class="modbtn" data-mod="' + i + '" aria-pressed="' + (i === st.mod) + '"><b>' + esc(x.name) + '</b><span>' + esc([x.code, x.deg, 'Year ' + x.year].filter(Boolean).join(' · ')) + '</span>' + (x.pack ? '<span class="badge b-pack" style="margin-top:4px">Module pack · fact-checked</span>' : '<span class="badge b-full" style="margin-top:4px">Subject library · ' + esc(x.bankTitle) + '</span>') + '</button>'; }).join('') + '</div>' +
        '<div class="row-end"><span class="muted">' + esc(u.name) + ' · ' + (D[st.uni] || []).length + ' sample modules</span>' + nextBtn('Open my notes', 1) + '</div>';
    } else if (st.step === 1) {
      h = '<h3 class="st-h">Turn notes into flashcards</h3><p class="st-p">Here are notes on <b>' + esc(m.topics[m.note.t]) + '</b> from the Unizy ' + (m.pack ? 'module pack' : 'library') + ' for ' + esc(m.name) + '.</p>' +
        '<div class="paper"><h4>' + esc(m.note.h) + '</h4>' + esc(m.note.body) + '</div>';
      if (!st.made && !st.making) h += '<div><button class="btn acc" id="mk">✨ Make flashcards from these notes</button></div>';
      else if (st.making) h += '<div class="cards"><div class="shimmer"></div><div class="shimmer"></div><div class="shimmer"></div></div>';
      else h += '<p class="st-p"><b>Tap a card to flip it.</b></p><div class="cards">' + m.cards.map(function (c, i) { return '<button class="fcard" aria-pressed="false" style="animation-delay:' + (i * 0.08) + 's"><span class="inner"><span class="side front"><small>Question</small><b>' + esc(c.f) + '</b></span><span class="side back"><small>Answer</small>' + esc(c.b) + '</span></span></button>'; }).join('') + '</div>' +
        '<p class="note">In this demo the cards come from ' + (m.pack ? 'the Unizy module pack for ' + esc(m.name) : 'the Unizy library for this subject') + '. In the app you can also upload your own lecture notes and have AI turn them into cards.</p>';
      h += '<div class="row-end"><span></span>' + nextBtn('Test myself', 2, !st.made) + '</div>';
    } else if (st.step === 2) {
      var q = m.qs[st.qi], pick = st.picks[st.qi], answered = pick !== undefined, last = st.qi === m.qs.length - 1;
      h = '<h3 class="st-h">Take a practice quiz</h3><div class="qmeta"><span>Question ' + (st.qi + 1) + ' of ' + m.qs.length + '</span><span>' + esc(m.topics[q.t]) + '</span></div>' +
        '<p class="q">' + esc(q.q) + '</p><div class="opts">' + q.options.map(function (o, i) {
          var cls = answered ? (i === q.answer ? ' right' : (i === pick ? ' wrong' : '')) : '';
          return '<button class="opt' + cls + '" data-opt="' + i + '"' + (answered ? ' disabled' : '') + '>' + String.fromCharCode(65 + i) + '. ' + esc(o) + '</button>';
        }).join('') + '</div>';
      if (answered) h += '<p class="why"><b>' + (pick === q.answer ? 'Correct. ' : 'Not quite. ') + '</b>' + esc(q.why) + '</p>';
      h += '<div class="row-end"><span class="muted">Real questions from the library, with explanations.</span>' + (answered ? (last ? nextBtn('See what to revise', 3) : '<button class="btn acc" id="qnext">Next question →</button>') : '') + '</div>';
    } else if (st.step === 3) {
      var r = results(), score = r.reduce(function (a, x) { return a + x.right; }, 0), tot = r.reduce(function (a, x) { return a + x.total; }, 0);
      h = '<h3 class="st-h">You scored ' + score + ' out of ' + tot + '. Here’s what to revise.</h3><p class="st-p">Unizy tracks your results by topic, so weak spots show up on their own.</p><div class="bars">' +
        r.map(function (x) { var pc = Math.round(x.right / x.total * 100), wk = x.right < x.total; return '<div class="tbar"><span class="nm">' + esc(x.name) + '</span><span class="tag ' + (wk ? 'weak' : 'ok') + '">' + (wk ? 'Revise this' : 'Looking good') + '</span><span class="track"><i style="width:' + Math.max(pc, 4) + '%;background:' + (wk ? '#C8102E' : '#2E7D32') + '"></i></span></div>'; }).join('') + '</div>' +
        (score === tot ? '<p class="note">Full marks! In the app, harder levels and mixed-topic tests keep finding what’s weakest. For this demo we’ll plan a review of the first topic so it sticks.</p>' : '') +
        '<div class="row-end"><span></span>' + nextBtn('Plan my revision', 4) + '</div>';
    } else {
      var w = weak(), days = [], now = new Date();
      for (var i = 0; i < 7; i++) { var d = new Date(now); d.setDate(now.getDate() + i); days.push(d); }
      var plan = {}; // day index -> sessions
      if (st.planned) w.forEach(function (x, j) { [1, 3, 6].forEach(function (off, k) { var di = Math.min(6, off + (j % 2)); (plan[di] = plan[di] || []).push({ txt: (k === 0 ? 'Flashcards · ' : k === 1 ? 'Quiz · ' : 'Recap · ') + x.name, delay: (j * 3 + k) * 0.12 }); }); });
      var classes = { 0: ['10:00 Lecture'], 2: ['14:00 Seminar'], 4: ['Essay due'] };
      h = '<h3 class="st-h">Plan revision sessions</h3><p class="st-p">' + (st.planned ? 'Done. Each weak topic is reviewed after 1, 3 and about 6 days: spacing it out helps it stick.' : 'Add short sessions for your weak topics around this week’s classes and deadlines.') + '</p><div class="week">' +
        days.map(function (d, i) {
          var cl = (classes[i] || []).map(function (c) { return '<span class="sess ' + (/due/.test(c) ? 'dl' : 'cls') + '">' + esc(c) + '</span>'; }).join('');
          return '<div class="day' + (i === 0 ? ' today' : '') + '"><span class="dn">' + (i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' })) + '</span>' + cl + (plan[i] || []).map(function (s) { return '<span class="sess" style="animation-delay:' + s.delay + 's">' + esc(s.txt) + '</span>'; }).join('') + '</div>';
        }).join('') + '</div>' +
        '<p class="note">Sample classes and deadline for the demo. In the app, the Plan tab holds your own classes, deadlines and sessions.</p>';
      if (!st.planned) h += '<div class="row-end"><span></span><button class="btn acc" id="plan">Add ' + (w.length * 3) + ' revision sessions</button></div>';
      else h += '<div class="done-box"><b>That’s Unizy.</b><p>Notes → flashcards → practice → what to revise → your plan, all built around your modules. Set it up for your own degree in about two minutes.</p><div class="ctas"><a class="btn lime" href="/app.html?uni=' + st.uni + '" data-ev="cta_explore_demo">Explore Unizy for ' + esc(u.name) + '</a><a class="btn ghost" style="color:#fff;border-color:#fff" href="/signup" data-ev="cta_signup_demo">Sign up free</a></div></div>';
    }
    stage.innerHTML = h;
  }
  setTheme(); render();
})();
