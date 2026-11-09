/* SaveMyGrade home page "try it" box.
   1. Paste your notes: signed-out visitors get flashcards and practice questions from their own notes (edge function try-cards;
      3 goes a day per browser, a higher cap per network). The result can be carried into the app: it is kept in localStorage "unizy-pending" and the app
      offers to add it to a module's Flashcards.
   2. Find your module: real cards and questions from the fact-checked module packs (site/data/try-index.json, built by
      tools/build_try_index.py). */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG || {}, H = window.UNIZY_HOME || {};
  var box = document.getElementById('tryBox'); if (!box) return;
  var T = function (ev) { try { if (window.unizyTrack) window.unizyTrack(ev, true); } catch (e) { /* ignore */ } };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nl(s) { return esc(s).replace(/\n/g, '<br>'); }
  var MIN = 120, MAX = 8000;

  var SAMPLES = {
    econ: 'Price elasticity of demand (PED) measures how responsive quantity demanded is to a change in price: PED = % change in quantity demanded ÷ % change in price. Because demand curves slope downwards, PED is negative, but economists often quote its absolute value.\n\nIf |PED| > 1, demand is price elastic: a price rise reduces total revenue because quantity falls proportionally more than price rises. If |PED| < 1, demand is inelastic and a price rise increases total revenue. Unit elastic demand (|PED| = 1) leaves revenue unchanged.\n\nDeterminants: the number and closeness of substitutes (more substitutes, more elastic); the share of income spent on the good; whether it is a necessity or a luxury; how broadly the market is defined (demand for food is less elastic than for one brand of cereal); and time, since demand is usually more elastic in the long run as consumers find alternatives.\n\nAlong a straight-line demand curve PED is not constant: demand is elastic at high prices and inelastic at low prices. Governments tax goods with inelastic demand, such as tobacco and fuel, because quantity, and so tax revenue, falls little.',
    law: 'Consideration is the price paid for the other party’s promise, and it is what makes a simple contract binding. Currie v Misa (1875) described it as some right, interest, profit or benefit to one party, or some forbearance, detriment, loss or responsibility given, suffered or undertaken by the other.\n\nConsideration must be sufficient but need not be adequate: the courts do not ask whether the bargain was a good one (Chappell v Nestlé (1960), where chocolate wrappers counted). Past consideration is no consideration (Re McArdle (1951)), unless the act was done at the promisor’s request, both parties understood it would be paid for, and payment would have been legally enforceable (Pao On v Lau Yiu Long (1980)).\n\nPerforming an existing public duty is not good consideration (Collins v Godefroy (1831)), but going beyond it is (Glasbrook Bros v Glamorgan CC (1925)). Performing an existing contractual duty owed to the promisor is not consideration (Stilk v Myrick (1809)), unless the promisor obtains a practical benefit and there is no economic duress (Williams v Roffey Bros (1990)). Part-payment of a debt does not discharge the whole debt (Pinnel’s Case (1602); Foakes v Beer (1884)), although promissory estoppel may stop a creditor going back on a promise to accept less (Central London Property Trust v High Trees House (1947)).',
    med: 'The cardiac cycle is the sequence of events in one heartbeat. At a resting heart rate of about 75 beats per minute it lasts roughly 0.8 seconds, and diastole takes up about two-thirds of it.\n\nMost ventricular filling happens passively in diastole; atrial contraction at the end of diastole then tops the ventricles up. Ventricular systole begins with isovolumetric contraction: ventricular pressure rises above atrial pressure, closing the atrioventricular (mitral and tricuspid) valves, which produces the first heart sound (S1). With all four valves closed, ventricular volume does not change.\n\nWhen ventricular pressure exceeds pressure in the aorta and pulmonary artery, the semilunar valves open and ejection begins. A typical resting stroke volume is about 70 mL, and the ejection fraction (stroke volume ÷ end-diastolic volume) is normally about 55–70%.\n\nAs the ventricles relax and their pressure falls below arterial pressure, the aortic and pulmonary valves close, producing the second heart sound (S2). Isovolumetric relaxation follows until ventricular pressure falls below atrial pressure, the AV valves open and rapid passive filling begins again.\n\nOn the ECG, the P wave reflects atrial depolarisation, the QRS complex ventricular depolarisation, and the T wave ventricular repolarisation.'
  };

  // ---------- tabs ----------
  var tabs = [].slice.call(box.querySelectorAll('[data-tab]'));
  function pick(name) {
    tabs.forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === name ? 'true' : 'false'); });
    $('tryNotes').hidden = name !== 'notes'; $('tryModule').hidden = name !== 'module';
    if (name === 'module') loadIndex();
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { pick(b.getAttribute('data-tab')); }); });

  // ---------- shared: flashcard viewer and questions ----------
  function viewer(host, cards, label) {
    var i = 0, flipped = false;
    function draw() {
      var c = cards[i];
      host.innerHTML =
        '<button type="button" class="fcard try-card' + (flipped ? ' flip' : '') + '" aria-label="Flashcard ' + (i + 1) + ' of ' + cards.length + ', ' + (flipped ? 'answer' : 'question') + '. Press to flip.">' +
          '<span class="inner"><span class="side front"><small>' + esc(label) + ' · card ' + (i + 1) + ' of ' + cards.length + '</small><b>' + esc(c.f) + '</b><span class="try-tap">Tap to see the answer</span></span>' +
          '<span class="side back"><small>Answer</small><span>' + nl(c.b) + '</span></span></span></button>' +
        '<div class="try-nav"><button type="button" class="btn line small" data-mv="-1"' + (i ? '' : ' disabled') + '>← Back</button>' +
        '<span class="try-dots" aria-hidden="true">' + cards.map(function (_, k) { return '<i' + (k === i ? ' class="on"' : '') + '></i>'; }).join('') + '</span>' +
        '<button type="button" class="btn line small" data-mv="1"' + (i < cards.length - 1 ? '' : ' disabled') + '>Next →</button></div>';
    }
    host.addEventListener('click', function (e) {
      var mv = e.target.closest('[data-mv]');
      if (mv) { i = Math.max(0, Math.min(cards.length - 1, i + +mv.getAttribute('data-mv'))); flipped = false; draw(); return; }
      if (e.target.closest('.try-card')) { flipped = !flipped; T('try_flip'); host.querySelector('.try-card').classList.toggle('flip', flipped); host.querySelector('.try-card').setAttribute('aria-label', 'Flashcard ' + (i + 1) + ' of ' + cards.length + ', ' + (flipped ? 'answer' : 'question') + '. Press to flip.'); }
    });
    draw();
  }
  function quiz(host, qs) {
    host.innerHTML = qs.map(function (q, n) {
      return '<div class="try-q" data-q="' + n + '"><p class="q"><span class="try-qn">' + (n + 1) + '</span>' + esc(q.q) + '</p><div class="opts">' +
        q.options.map(function (o, k) { return '<button type="button" class="opt" data-o="' + k + '">' + esc(o) + '</button>'; }).join('') + '</div></div>';
    }).join('');
    host.addEventListener('click', function (e) {
      var b = e.target.closest('.opt'); if (!b || b.disabled) return;
      var wrap = b.closest('.try-q'), q = qs[+wrap.getAttribute('data-q')], k = +b.getAttribute('data-o');
      T('try_quiz');
      [].forEach.call(wrap.querySelectorAll('.opt'), function (o, j) { o.disabled = true; if (j === q.answer) o.classList.add('right'); });
      if (k !== q.answer) b.classList.add('wrong');
      var p = document.createElement('p'); p.className = 'why';
      p.innerHTML = '<b>' + (k === q.answer ? 'Right.' : 'Not quite.') + '</b> ' + esc(q.why || '');
      wrap.appendChild(p);
    });
  }

  // ---------- 1. paste your notes ----------
  var ta = $('tryText'), go = $('tryGo'), out = $('tryOut'), count = $('tryCount');
  function counter() { var n = ta.value.length; count.textContent = n.toLocaleString('en-GB') + ' / 8,000'; count.classList.toggle('bad', n > MAX); }
  ta.addEventListener('input', counter);
  [].forEach.call(box.querySelectorAll('[data-sample]'), function (b) {
    b.addEventListener('click', function () { ta.value = SAMPLES[b.getAttribute('data-sample')] || ''; counter(); T('try_sample'); ta.scrollTop = 0; go.focus(); });
  });
  function say(html, bad) { out.innerHTML = '<p class="try-msg' + (bad ? ' bad' : '') + '">' + html + '</p>'; }
  var busy = false;
  go.addEventListener('click', function () {
    if (busy) return;
    var notes = ta.value.trim();
    if (notes.length < MIN) { say('Paste a little more: at least a paragraph (about ' + MIN + ' characters). Or press one of the samples.', true); ta.focus(); return; }
    if (notes.length > MAX) { say('That’s more than 8,000 characters. Paste one lecture section at a time.', true); return; }
    var day = new Date().toISOString().slice(0, 10), used = { d: day, n: 0 };
    try { var u = JSON.parse(localStorage.getItem('unizy-tries') || 'null'); if (u && u.d === day) used = u; } catch (e) { /* ignore */ }
    if (used.n >= 3) { say('You’ve used today’s 3 free goes. <a href="/signup?next=%2Fapp.html" data-ev="try_save">Sign up free</a> to keep turning your notes into cards: it takes 30 seconds and no card.', true); return; }
    busy = true; go.disabled = true; go.textContent = 'Reading your notes…'; T('try_start');
    out.innerHTML = '<div class="try-wait"><div class="shimmer"></div><p class="note">Writing flashcards and practice questions from your notes. This usually takes 10 to 20 seconds.</p></div>';
    var steps = ['Writing flashcards…', 'Writing practice questions…', 'Checking them against your notes…'], si = 0;
    var tick = setInterval(function () { go.textContent = steps[Math.min(si++, steps.length - 1)]; }, 5000);
    fetch(CFG.supabaseUrl + '/functions/v1/try-cards', { method: 'POST', headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: notes }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { b.status = r.status; return b; }); }, function () { return { error: 'offline' }; })
      .then(function (d) {
        clearInterval(tick); busy = false; go.disabled = false; go.textContent = 'Make my flashcards';
        if (d && (d.cards || d.error === 'not_notes')) { used.n++; try { localStorage.setItem('unizy-tries', JSON.stringify(used)); } catch (e) { /* ignore */ } }
        if (d && d.cards && d.cards.length) { T('try_done'); return result(d); }
        T('try_fail');
        var e = d && d.error;
        if (e === 'limit') say('Lots of people on your network have tried SaveMyGrade today. <a href="/signup?next=%2Fapp.html" data-ev="try_save">Sign up free</a> to keep turning your notes into cards: it takes 30 seconds and no card.', true);
        else if (e === 'not_notes') say('That doesn’t look like study notes. Paste a piece of lecture notes, a handout or your own summary, or press one of the samples.', true);
        else if (e === 'too_short') say('Paste a little more: at least a paragraph.', true);
        else if (e === 'offline') say('You seem to be offline. Check your connection and try again.', true);
        else say('SaveMyGrade is busy right now. Try again in a minute.', true);
      });
  });

  function result(d) {
    var nc = d.cards.length, nq = (d.questions || []).length;
    out.innerHTML =
      '<div class="try-res"><div class="try-res-h"><span class="try-badge">Made from your notes</span><h3>' + esc(d.title) + '</h3><p>' + nc + ' flashcards' + (nq ? ' and ' + nq + ' practice questions' : '') + '. Flip a card, then test yourself.</p></div>' +
      '<div id="tryCards"></div>' + (nq ? '<h4 class="try-sub">Test yourself</h4><div id="tryQs"></div>' : '') +
      '<div class="try-save"><h4>Keep these ' + nc + ' cards</h4><p>Sign up free and they’ll be waiting in Flashcards for the module you pick, with spaced repetition bringing each one back just before you’d forget it.</p>' +
      '<div class="ctas"><a class="btn primary" href="/signup?next=%2Fapp.html" data-keep="try_save">Save them free</a><a class="btn ghost" href="/app.html" data-keep="try_keep">Carry on without an account</a></div>' +
      '<p class="try-fine">No card. Free for good: notes, flashcards and tests never cost anything.</p></div></div>';
    viewer($('tryCards'), d.cards, 'Your notes');
    if (nq) quiz($('tryQs'), d.questions);
    [].forEach.call(out.querySelectorAll('[data-keep]'), function (a) {
      a.addEventListener('click', function () {
        T(a.getAttribute('data-keep'));
        try { localStorage.setItem('unizy-pending', JSON.stringify({ title: d.title, cards: d.cards, at: Date.now() })); } catch (e) { /* ignore */ }
      });
    });
    out.querySelector('.try-res').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- 2. find your module ----------
  var UNIS = H.unis || [], idx = null, uni = 'ucl';
  var chips = $('tryUnis'), q = $('tryQ'), list = $('tryList'), mout = $('tryModOut');
  chips.innerHTML = UNIS.map(function (u) { return '<button type="button" class="chip" data-u="' + u.id + '" style="--c:' + u.c + ';--cf:' + (u.light ? '#17302A' : '#fff') + '" aria-pressed="' + (u.id === uni) + '">' + esc(u.name) + '</button>'; }).join('');
  chips.addEventListener('click', function (e) { var b = e.target.closest('[data-u]'); if (!b) return; uni = b.getAttribute('data-u'); [].forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); }); mout.innerHTML = ''; draw(); });
  q.addEventListener('input', draw);
  function loadIndex() {
    if (idx) return;
    idx = [];
    list.innerHTML = '<div class="shimmer" style="height:120px"></div>';
    fetch('/data/try-index.json').then(function (r) { return r.json(); }).then(function (d) { idx = d || []; draw(); }).catch(function () { list.innerHTML = '<p class="try-msg bad">Couldn’t load the module list. Refresh and try again.</p>'; });
  }
  function uniName(id) { var u = UNIS.filter(function (x) { return x.id === id; })[0]; return u ? u.name : id; }
  function draw() {
    if (!idx || !idx.length) return;
    var all = idx.filter(function (m) { return m.u === uni; });
    var s = q.value.trim().toLowerCase();
    var hits = s ? all.filter(function (m) { return (m.n + ' ' + m.c).toLowerCase().indexOf(s) >= 0; }) : all;
    var head = '<p class="try-meta">' + all.length + ' ready-made module pack' + (all.length === 1 ? '' : 's') + ' at ' + esc(uniName(uni)) + ' so far' +
      (all.length < 5 ? '. Every other ' + esc(uniName(uni)) + ' module still gets its official outline, your notebook and cards from your own notes.' : '.') + '</p>';
    list.innerHTML = head + (hits.length ? '<div class="try-mods">' + hits.slice(0, 6).map(function (m) {
      return '<button type="button" class="modbtn" data-id="' + esc(m.id) + '"><b>' + esc(m.n) + '</b><span>' + (m.c ? esc(m.c) + ' · ' : '') + m.k + ' flashcards · ' + m.q + ' questions</span></button>';
    }).join('') + '</div>' + (hits.length > 6 ? '<p class="try-meta">' + (hits.length - 6) + ' more: type to narrow it down.</p>' : '')
      : '<p class="try-msg">No ready-made pack matches that yet. Paste your own notes in the other tab and SaveMyGrade makes the cards for you.</p>');
  }
  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]'); if (!b) return;
    var id = b.getAttribute('data-id'), m = idx.filter(function (x) { return x.id === id; })[0];
    [].forEach.call(list.querySelectorAll('.modbtn'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    mout.innerHTML = '<div class="shimmer"></div>';
    var u = UNIS.filter(function (x) { return x.id === m.u; })[0] || {};
    box.style.setProperty('--accent', u.c || '#17302A'); box.style.setProperty('--onaccent', u.light ? '#17302A' : '#fff');
    fetch('/data/library/' + encodeURIComponent(id) + '.json').then(function (r) { return r.json(); }).then(function (p) {
      T('try_module');
      var cards = (p.cards || []).slice(0, 8).map(function (c) { return { f: c.f, b: c.b }; });
      var qs = (p.questions || []).filter(function (x) { return x.type === 'mcq' && x.options && x.options.length >= 2 && typeof x.answer === 'number'; }).slice(0, 2)
        .map(function (x) { return { q: x.q, options: x.options, answer: x.answer, why: x.why }; });
      mout.innerHTML =
        '<div class="try-res"><div class="try-res-h"><span class="try-badge">Module pack · fact-checked</span><h3>' + esc(m.n) + '</h3><p>' + esc(uniName(m.u)) + (m.c ? ' · ' + esc(m.c) : '') + '. A sample of the ' + m.k + ' flashcards and ' + m.q + ' practice questions written for this module.</p></div>' +
        '<div id="tryMCards"></div><h4 class="try-sub">Test yourself</h4><div id="tryMQs"></div>' +
        '<div class="try-save"><h4>Get the whole pack</h4><p>Notes for every topic, all ' + m.k + ' flashcards, topic tests and a revision plan, set up for your course in two minutes. Free.</p>' +
        '<div class="ctas"><a class="btn primary" href="/app.html?uni=' + encodeURIComponent(m.u) + '" data-ev="try_module_open">Open the full pack</a><a class="btn ghost" href="/signup?next=%2Fapp.html" data-ev="try_save">Sign up free</a></div></div></div>';
      viewer($('tryMCards'), cards, 'Module pack');
      if (qs.length) quiz($('tryMQs'), qs);
      mout.querySelector('.try-res').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () { mout.innerHTML = '<p class="try-msg bad">Couldn’t load that module. Try again.</p>'; });
  });

  // "Try it with your notes" buttons elsewhere on the page
  [].forEach.call(document.querySelectorAll('a[href="#try"]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); pick('notes'); box.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(function () { ta.focus({ preventScroll: true }); }, 450); });
  });
  if (location.hash === '#module') pick('module');
})();
