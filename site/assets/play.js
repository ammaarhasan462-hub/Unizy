/* Unizy Play: "Unwind", the daily cooldown quiz.
   Ten general-knowledge questions a day, one from each category, the same for everyone (UK date). No countdown:
   each answer shows a "did you know" fact and you move on when you're ready. Only thinking time is counted, as the
   tie-break. The first run each day goes on the leaderboard; after that it's free play. */
(function () {
  'use strict';
  var DATA_URL = '/data/play/unwind.json?v=1';
  var EPOCH = Date.UTC(2026, 9, 29); // day 0 of the question cycle
  var CATS = {
    geo: { label: 'Geography', icon: '🌍' }, hist: { label: 'History', icon: '🏛️' }, sci: { label: 'Science', icon: '🔬' },
    nature: { label: 'Nature', icon: '🌿' }, food: { label: 'Food & drink', icon: '🍜' }, sport: { label: 'Sport & games', icon: '⚽' },
    arts: { label: 'Arts & film', icon: '🎨' }, words: { label: 'Words', icon: '🔤' }, space: { label: 'Space', icon: '🪐' }, uk: { label: 'London & the UK', icon: '🎡' }
  };
  var S = {
    kit: null, el: null, data: null, loading: false, loadErr: '',
    phase: 'intro', mode: 'daily', qs: [], i: 0, picked: null, results: [], shownAt: 0, thinkMs: 0,
    me: null, board: null, scope: 'today', boardLoading: false, result: null, submitting: false, nameMsg: ''
  };

  // ------------------------------------------------------------------ helpers
  function X() { return window.UnizyWeb && window.UnizyWeb._internal; }
  function signedIn() { return !!(X() && X().Auth.session); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function prettyDay() {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()); }
    catch (e) { return today(); }
  }
  function dayIndex() { var p = today().split('-'); return Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - EPOCH) / 86400000); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, rand) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmt(ms) { var s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function rpc(name, args) {
    return X().Sync.rest('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error((b && b.message) || 'Something went wrong.'); return b; });
    });
  }
  function startedToday() { try { return !!localStorage.getItem('unizy:unwind:' + today()); } catch (e) { return false; } }
  function score() { return S.results.filter(function (r) { return r.right; }).length; }

  // ------------------------------------------------------------------ questions
  function load() {
    if (S.data || S.loading) return;
    S.loading = true;
    fetch(DATA_URL).then(function (r) { return r.json(); }).then(function (d) { S.data = Array.isArray(d) ? d : []; S.loading = false; draw(); })
      .catch(function () { S.loading = false; S.loadErr = 'Couldn’t load today’s questions. Check your connection and try again.'; draw(); });
  }
  function byCat() { var out = {}; (S.data || []).forEach(function (q) { (out[q.cat] = out[q.cat] || []).push(q); }); return out; }
  function withShuffledOptions(q, rand) {
    var order = shuffle([0, 1, 2, 3], rand);
    return Object.assign({}, q, { options: order.map(function (i) { return q.options[i]; }), answer: order.indexOf(q.answer) });
  }
  // today's ten: one per category; each category cycles through its whole list before repeating
  function dailySet() {
    var groups = byCat(), n = dayIndex(), cats = Object.keys(groups).sort();
    var rand = rng(hash('unwind|' + today()));
    var picks = cats.map(function (c) {
      var list = groups[c].slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      var cycle = Math.floor(n / list.length), order = shuffle(list, rng(hash('cycle|' + c + '|' + cycle)));
      return order[((n % list.length) + list.length) % list.length];
    });
    return shuffle(picks, rand).slice(0, 10).map(function (q) { return withShuffledOptions(q, rand); });
  }
  function freeSet() {
    var groups = byCat(), cats = shuffle(Object.keys(groups), Math.random);
    return cats.slice(0, 10).map(function (c) { var l = groups[c]; return withShuffledOptions(l[Math.floor(Math.random() * l.length)], Math.random); });
  }

  // ------------------------------------------------------------------ leaderboard
  function loadMe() {
    if (!signedIn()) { S.me = { signed_in: false }; draw(); return; }
    rpc('unwind_me', {}).then(function (m) { S.me = m; draw(); }).catch(function () { S.me = { signed_in: true, failed: true }; draw(); });
  }
  function loadBoard(scope) {
    if (scope) S.scope = scope;
    if (!signedIn()) { S.board = null; draw(); return; }
    S.boardLoading = true; draw();
    rpc('unwind_board', { p_scope: S.scope, p_uni: S.kit && S.kit.uniId }).then(function (b) { S.board = b; S.boardLoading = false; draw(); })
      .catch(function () { S.boardLoading = false; S.board = { failed: true }; draw(); });
  }
  function submitArgs() {
    var k = S.kit || {};
    return { p_score: score(), p_ms: Math.max(8000, Math.round(S.thinkMs)), p_uni: k.uniId || '', p_name: (S.me && S.me.name) || ((k.uniShort || '') + ' student') };
  }
  function submit() {
    if (!signedIn() || S.mode !== 'daily') return;
    S.submitting = true; draw();
    rpc('unwind_submit', submitArgs()).then(function (r) { S.submitting = false; S.result = r; if (r && r.me) S.me = r.me; loadBoard('today'); })
      .catch(function () { S.submitting = false; S.result = { failed: true }; draw(); });
  }
  // closing the tab part-way through today's run still records what was answered
  window.addEventListener('pagehide', function () {
    if (S.phase !== 'play' || S.mode !== 'daily' || !signedIn() || !S.results.length) return;
    try { var CFG = window.UNIZY_CONFIG || {}; fetch(CFG.supabaseUrl + '/rest/v1/rpc/unwind_submit', { method: 'POST', keepalive: true, headers: X().Auth.headers(true), body: JSON.stringify(submitArgs()) }); } catch (e) { /* ignore */ }
  });

  // ------------------------------------------------------------------ the run
  function start(mode) {
    if (!S.data || !S.data.length) return;
    if (mode === 'daily' && signedIn() && startedToday()) mode = 'free';
    S.mode = mode;
    if (mode === 'daily' && signedIn()) { try { localStorage.setItem('unizy:unwind:' + today(), String(Date.now())); } catch (e) { /* ignore */ } }
    S.qs = mode === 'daily' ? dailySet() : freeSet();
    S.i = 0; S.picked = null; S.results = []; S.thinkMs = 0; S.result = null;
    S.phase = 'play'; draw(); S.shownAt = Date.now();
    try { if (S.el && S.el.getBoundingClientRect().top < 0) S.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
  }
  function pick(idx) {
    if (S.phase !== 'play' || S.picked !== null) return;
    var q = S.qs[S.i]; if (!q) return;
    S.thinkMs += Math.min(120000, Date.now() - S.shownAt); // long pauses don't count against you
    S.picked = idx;
    S.results.push({ cat: q.cat, right: idx === q.answer });
    draw();
    var nx = document.querySelector('[data-uw-next]'); if (nx) try { nx.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function next() {
    if (S.phase !== 'play' || S.picked === null) return;
    S.i++; S.picked = null;
    if (S.i >= S.qs.length) { S.phase = 'done'; draw(); if (S.mode === 'daily') { if (signedIn()) submit(); else loadBoard(); } return; }
    draw(); S.shownAt = Date.now();
  }

  // ------------------------------------------------------------------ drawing
  function theme() { var t = (S.kit && S.kit.theme) || {}; return { c: t.c1 || '#17302A' }; }
  function dots() {
    return '<div class="uw-dots" aria-hidden="true">' + S.qs.map(function (q, i) {
      var r = S.results[i];
      return '<i class="' + (r ? (r.right ? 'ok' : 'no') : i === S.i ? 'now' : '') + '"></i>';
    }).join('') + '</div>';
  }
  function boardHtml() {
    if (!signedIn()) return '<p class="pl-note">Log in to see the leaderboard and put your score on it. <a href="/login?next=%2Fapp%2Fplay">Log in</a> · <a href="/signup?next=%2Fapp%2Fplay">Sign up free</a></p>';
    var tabs = [['today', 'Today'], ['week', 'This week'], ['uni', (S.kit && S.kit.uniShort ? S.kit.uniShort : 'My uni') + ' today']].map(function (t) {
      return '<button type="button" class="pl-tab' + (S.scope === t[0] ? ' on' : '') + '" data-uw-scope="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('');
    var b = S.board, rows;
    if (S.boardLoading && !b) rows = '<p class="pl-note">Loading…</p>';
    else if (!b || b.failed) rows = '<p class="pl-note">Couldn’t load the leaderboard. <button type="button" class="pl-link" data-uw-scope="' + S.scope + '">Try again</button></p>';
    else if (!b.rows || !b.rows.length) rows = '<p class="pl-note">No scores yet ' + (S.scope === 'week' ? 'this week' : 'today') + '. Be the first.</p>';
    else {
      rows = '<ol class="pl-board">' + b.rows.map(function (r) {
        return '<li class="' + (r.me ? 'me' : '') + '"><span class="rk">' + r.rank + '</span><span class="nm"><b>' + esc(r.name || 'A student') + (r.me ? ' (you)' : '') + '</b><small>' + esc(String(r.uni || '').toUpperCase()) + ' · ' + fmt(r.ms) + (S.scope === 'week' ? ' · ' + r.days + (r.days === 1 ? ' day' : ' days') : '') + '</small></span><span class="sc">' + r.score + (S.scope === 'week' ? '' : '<small>/10</small>') + '</span></li>';
      }).join('') + '</ol>';
      rows += b.mine && b.mine.rank > 25 ? '<p class="pl-note">You’re #' + b.mine.rank + ' of ' + b.players + '.</p>' : '<p class="pl-note">' + b.players + (b.players === 1 ? ' player' : ' players') + (S.scope === 'week' ? ' this week · right answers added up, then time' : ' today · ranked by right answers, then time') + '.</p>';
    }
    return '<div class="pl-tabs">' + tabs + '</div>' + rows;
  }
  function nameHtml() {
    if (!signedIn() || !S.me || !S.me.signed_in) return '';
    var k = S.kit || {};
    return '<div class="pl-name"><label for="uw-name">Your name on the board</label><div><input id="uw-name" data-uw-name maxlength="24" value="' + esc(S.me.name || '') + '" placeholder="' + esc((k.uniShort || 'A') + ' student') + '"><button type="button" class="pl-btn small ghost" data-uw-rename>Save</button></div><small>' + esc(S.nameMsg || 'Letters, numbers, spaces and . _ - only. Everyone signed up can see it.') + '</small></div>';
  }
  function boardCard() { return '<section class="pl-card"><div class="pl-h"><span class="pl-kick">Leaderboard</span><h3>Today’s top scores</h3></div>' + boardHtml() + nameHtml() + '</section>'; }
  function introHtml() {
    var me = S.me || {}, t = theme(), cta;
    if (!S.data) cta = S.loadErr ? '<p class="pl-note">' + esc(S.loadErr) + '</p>' : '<p class="pl-note">Getting today’s questions…</p>';
    else if (me.played) cta = '<div class="uw-today">Today: <b>' + me.score + '/10</b> in ' + fmt(me.ms) + '. New questions tomorrow.</div><button type="button" class="pl-btn ghost" data-uw-start="free">Free play</button>';
    else if (signedIn() && startedToday()) cta = '<div class="uw-today">You’ve already started today’s questions on this device. New ones tomorrow.</div><button type="button" class="pl-btn ghost" data-uw-start="free">Free play</button>';
    else cta = '<button type="button" class="pl-btn" data-uw-start="daily">Start today’s Unwind</button>' + (signedIn() ? '' : '<p class="pl-note">Not logged in, so your score won’t go on the leaderboard. <a href="/login?next=%2Fapp%2Fplay">Log in</a></p>');
    var cats = Object.keys(CATS).map(function (c) { return '<span>' + CATS[c].icon + ' ' + esc(CATS[c].label) + '</span>'; }).join('');
    var stats = signedIn() && me.signed_in && !me.failed ? '<div class="pl-stats"><div><b>' + (me.streak || 0) + '</b><span>day streak</span></div><div><b>' + (me.best != null ? me.best + '/10' : '–') + '</b><span>best score</span></div><div><b>' + (me.perfect || 0) + '</b><span>perfect days</span></div></div>' : '';
    return '<div class="pl-grid"><section class="pl-card uw-hero" style="--uc:' + t.c + '"><div class="uw-sun" aria-hidden="true"></div><span class="pl-kick">' + esc(prettyDay()) + '</span><h2>Ten questions.<br><em>Nothing to revise.</em></h2>' +
      '<p class="uw-lede">Your daily breather: one general-knowledge question from each of ten categories, the same for everyone. No timer to beat. Take your time, learn something random, then compare scores.</p>' +
      '<div class="uw-cats">' + cats + '</div>' + stats + '<div class="pl-cta">' + cta + '</div></section>' + boardCard() + '</div>';
  }
  function playHtml() {
    var q = S.qs[S.i]; if (!q) return '';
    var c = CATS[q.cat] || { label: q.cat, icon: '✨' }, answered = S.picked !== null, right = answered && S.picked === q.answer;
    var opts = q.options.map(function (o, i) {
      var cls = 'uw-opt' + (answered ? (i === q.answer ? ' right' : i === S.picked ? ' wrong' : ' dim') : '');
      return '<button type="button" class="' + cls + '" data-uw-opt="' + i + '"' + (answered ? ' disabled' : '') + '><kbd>' + 'ABCD'[i] + '</kbd><span>' + esc(o) + '</span></button>';
    }).join('');
    var reveal = answered ? '<div class="uw-reveal ' + (right ? 'ok' : 'no') + '"><b>' + (right ? ['Nice one.', 'Spot on.', 'Lovely.', 'Correct.'][S.i % 4] : 'Not quite. It’s ' + esc(q.options[q.answer]) + '.') + '</b><p><span>Did you know?</span> ' + esc(q.fact) + '</p>' +
      '<button type="button" class="pl-btn" data-uw-next>' + (S.i + 1 < S.qs.length ? 'Next question →' : 'See my score →') + '</button></div>' : '';
    return '<div class="uw-run"><div class="uw-top">' + dots() + '<span class="uw-count">' + (S.i + 1) + ' / ' + S.qs.length + (S.mode === 'free' ? ' · free play' : '') + '</span><button type="button" class="pl-x" data-uw-quit aria-label="Stop">×</button></div>' +
      '<section class="pl-card uw-card"><span class="uw-cat">' + c.icon + ' ' + esc(c.label) + '</span><p class="uw-q">' + esc(q.q) + '</p><div class="uw-opts">' + opts + '</div>' + reveal + '</section>' +
      '<p class="pl-keys">Tip: press A–D (or 1–4) to answer and Enter for the next question.</p></div>';
  }
  function grid() { return S.results.map(function (r) { return r.right ? '🟩' : '🟥'; }).join(''); }
  function doneHtml() {
    var n = score(), t = theme(), res = '';
    var line = n === 10 ? 'A perfect ten. Lovely stuff.' : n >= 8 ? 'Brilliant. A very good day.' : n >= 6 ? 'Solid. Nicely done.' : n >= 4 ? 'Not bad at all. Tomorrow’s another ten.' : 'Some tough ones today. Come back tomorrow.';
    if (S.mode === 'daily') {
      if (!signedIn()) res = '<p class="pl-note">Log in to put scores on the leaderboard and keep a streak. <a href="/login?next=%2Fapp%2Fplay">Log in</a> · <a href="/signup?next=%2Fapp%2Fplay">Sign up free</a></p>';
      else if (S.submitting) res = '<p class="pl-note">Adding your score to the board…</p>';
      else if (S.result && S.result.failed) res = '<p class="pl-note">Couldn’t save your score. <button type="button" class="pl-link" data-uw-resubmit>Try again</button></p>';
      else if (S.result && S.result.counted === false) res = '<p class="pl-note">You’d already played today, so this one didn’t count.</p>';
      else if (S.result) { var mine = S.board && S.board.mine; res = '<div class="pl-rank">' + (mine ? '<b>#' + mine.rank + '</b> of ' + S.board.players + ' today' : 'On the board') + ' · ' + ((S.me && S.me.streak) || 1) + '-day streak</div>'; }
    } else res = '<p class="pl-note">Free play: not counted on the leaderboard.</p>';
    var recap = '<ol class="uw-recap">' + S.qs.map(function (q, i) { var r = S.results[i]; if (!r) return ''; return '<li class="' + (r.right ? 'ok' : 'no') + '"><span class="uw-cat">' + (CATS[q.cat] || {}).icon + ' ' + esc((CATS[q.cat] || {}).label || '') + '</span><b>' + esc(q.q) + '</b><span>' + esc(q.options[q.answer]) + '</span></li>'; }).join('') + '</ol>';
    return '<div class="pl-grid"><section class="pl-card uw-hero uw-end" style="--uc:' + t.c + '"><div class="uw-sun" aria-hidden="true"></div><span class="pl-kick">' + (S.mode === 'daily' ? 'Today’s Unwind' : 'Free play') + '</span><h2>' + n + '<small>/' + S.results.length + '</small></h2><p class="uw-lede">' + line + ' Thinking time ' + fmt(S.thinkMs) + '.</p><div class="uw-grid">' + grid() + '</div>' + res +
      '<div class="pl-cta"><button type="button" class="pl-btn" data-uw-share>Copy my result</button><button type="button" class="pl-btn ghost" data-uw-start="free">Free play</button><button type="button" class="pl-btn ghost" data-uw-home>Done</button></div></section>' +
      boardCard() + '<section class="pl-card"><div class="pl-h"><span class="pl-kick">The answers</span><h3>Today’s ten</h3></div>' + recap + '</section></div>';
  }
  function draw() {
    var el = S.el; if (!el || !document.body.contains(el)) return;
    el.innerHTML = S.phase === 'play' ? playHtml() : S.phase === 'done' ? doneHtml() : introHtml();
  }

  // ------------------------------------------------------------------ events
  function onClick(e) {
    var t = e.target.closest && e.target.closest('[data-uw-opt],[data-uw-next],[data-uw-start],[data-uw-scope],[data-uw-quit],[data-uw-home],[data-uw-share],[data-uw-rename],[data-uw-resubmit]');
    if (!t || !S.el || !S.el.contains(t)) return;
    if (t.hasAttribute('data-uw-opt')) pick(+t.getAttribute('data-uw-opt'));
    else if (t.hasAttribute('data-uw-next')) next();
    else if (t.hasAttribute('data-uw-start')) start(t.getAttribute('data-uw-start'));
    else if (t.hasAttribute('data-uw-scope')) loadBoard(t.getAttribute('data-uw-scope'));
    else if (t.hasAttribute('data-uw-resubmit')) submit();
    else if (t.hasAttribute('data-uw-home')) { S.phase = 'intro'; draw(); }
    else if (t.hasAttribute('data-uw-quit')) {
      if (S.mode === 'daily' && !confirm('Stop today’s Unwind? What you’ve answered so far is what counts.')) return;
      S.phase = 'done'; draw(); if (S.mode === 'daily' && signedIn() && S.results.length) submit();
    }
    else if (t.hasAttribute('data-uw-rename')) {
      var v = (document.querySelector('[data-uw-name]') || {}).value || '';
      if (!v.trim()) { S.nameMsg = 'Type a name first.'; draw(); return; }
      if (!(S.me && S.me.games)) { S.me = Object.assign({}, S.me, { name: v.trim().slice(0, 24) }); S.nameMsg = 'Saved. It’ll show when you play today.'; draw(); return; }
      rpc('unwind_rename', { p_name: v }).then(function (r) { S.me = Object.assign({}, S.me, { name: r.name }); S.nameMsg = 'Saved.'; loadBoard(); }).catch(function () { S.nameMsg = 'Couldn’t save that name. Use letters and numbers.'; draw(); });
    }
    else if (t.hasAttribute('data-uw-share')) {
      var txt = 'Unizy Unwind · ' + prettyDay() + '\n' + score() + '/' + S.results.length + ' · ' + fmt(S.thinkMs) + '\n' + grid() + '\nunizy.uk/play';
      var done = function () { t.textContent = 'Copied ✓'; setTimeout(function () { t.textContent = 'Copy my result'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { prompt('Copy your result:', txt); });
      else prompt('Copy your result:', txt);
    }
  }
  function onKey(e) {
    if (S.phase !== 'play' || !S.el || !document.body.contains(S.el)) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var k = String(e.key || '').toLowerCase(), map = { a: 0, b: 1, c: 2, d: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
    if (S.picked === null && k in map) { e.preventDefault(); pick(map[k]); }
    else if (S.picked !== null && (k === 'enter' || k === ' ' || k === 'arrowright')) { e.preventDefault(); next(); }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  window.UnizyPlay = {
    mount: function (inst, kit) {
      if (kit) S.kit = kit;
      var el = document.getElementById('uz-play');
      if (!el) { S.el = null; return; }
      load();
      if (el !== S.el || !el.firstChild) {
        S.el = el;
        if (!S.me) loadMe();
        if (!S.board && !S.boardLoading) loadBoard();
        draw();
      }
    }
  };
})();
