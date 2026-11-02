/* Unizy Play: "Unwind", the daily word quiz.
   Each day has a hidden word of 6-10 letters and one easy general-knowledge question per letter. A right answer
   reveals that letter; a wrong one leaves a gap. Then guess the word: one guess if you missed 0-2 letters,
   otherwise one guess per missed letter. Points = right answers + 5 for the word. Same word and questions for
   everyone each day (UK date); the first go counts on the leaderboard, then it's free play. */
(function () {
  'use strict';
  var Q_URL = '/data/play/easy.json?v=2', W_URL = '/data/play/words.json?v=1';
  var EPOCH = Date.UTC(2026, 10, 2); // day 0 of the cycle
  var WORD_BONUS = 5;
  var CATS = {
    geo: { label: 'Geography', icon: '🌍' }, hist: { label: 'History', icon: '🏛️' }, sci: { label: 'Science', icon: '🔬' },
    nature: { label: 'Nature', icon: '🌿' }, food: { label: 'Food & drink', icon: '🍜' }, sport: { label: 'Sport & games', icon: '⚽' },
    arts: { label: 'Arts & film', icon: '🎨' }, words: { label: 'Words', icon: '🔤' }, space: { label: 'Space', icon: '🪐' }, uk: { label: 'London & the UK', icon: '🎡' }
  };
  var S = {
    kit: null, el: null, qs0: null, words: null, loading: false, loadErr: '',
    phase: 'intro', mode: 'daily', word: '', hint: '', qs: [], i: 0, picked: null, results: [], shownAt: 0, thinkMs: 0,
    guesses: [], guessLeft: 0, solved: false, guessMsg: '',
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
  function dayIndex() { var p = today().split('-'); return Math.max(0, Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - EPOCH) / 86400000)); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, rand) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmt(ms) { var s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function rpc(name, args) {
    return X().Sync.rest('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error((b && b.message) || 'Something went wrong.'); return b; });
    });
  }
  function startedToday() { try { return !!localStorage.getItem('unizy:unwind2:' + today()); } catch (e) { return false; } }
  function rights() { return S.results.filter(function (r) { return r.right; }).length; }
  function wrongs() { return S.results.filter(function (r) { return !r.right; }).length; }
  function guessAllowance(w) { return w <= 2 ? 1 : w; }
  function points() { return rights() + (S.solved ? WORD_BONUS : 0); }

  // ------------------------------------------------------------------ data
  function load() {
    if ((S.qs0 && S.words) || S.loading) return;
    S.loading = true;
    Promise.all([fetch(Q_URL).then(function (r) { return r.json(); }), fetch(W_URL).then(function (r) { return r.json(); })])
      .then(function (d) { S.qs0 = Array.isArray(d[0]) ? d[0] : []; S.words = Array.isArray(d[1]) ? d[1] : []; S.loading = false; draw(); })
      .catch(function () { S.loading = false; S.loadErr = 'Couldn’t load today’s game. Check your connection and try again.'; draw(); });
  }
  // a fixed running order of all questions, alternating categories, so consecutive questions differ
  var order = null;
  function questionOrder() {
    if (order) return order;
    var g = {};
    S.qs0.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (q) { (g[q.cat] = g[q.cat] || []).push(q); });
    var cats = shuffle(Object.keys(g).sort(), rng(hash('cats')));
    var lists = cats.map(function (c) { return shuffle(g[c], rng(hash('order|' + c))); });
    order = []; var more = true;
    for (var k = 0; more; k++) { more = false; lists.forEach(function (l) { if (k < l.length) { order.push(l[k]); more = true; } }); }
    return order;
  }
  function wordFor(n) {
    var W = S.words, cycle = Math.floor(n / W.length), list = shuffle(W, rng(hash('words|' + cycle)));
    return list[n % W.length];
  }
  function withShuffledOptions(q, rand) {
    var o = shuffle([0, 1, 2, 3], rand);
    return Object.assign({}, q, { options: o.map(function (i) { return q.options[i]; }), answer: o.indexOf(q.answer) });
  }
  function dailyGame() {
    var n = dayIndex(), ord = questionOrder(), offset = 0;
    for (var d = 0; d < n; d++) offset += wordFor(d).w.length;
    var w = wordFor(n), rand = rng(hash('unwind2|' + today())), qs = [];
    for (var i = 0; i < w.w.length; i++) qs.push(withShuffledOptions(ord[(offset + i) % ord.length], rand));
    return { word: w.w, hint: w.hint, qs: qs };
  }
  function freeGame() {
    var w = S.words[Math.floor(Math.random() * S.words.length)];
    var qs = shuffle(S.qs0, Math.random).slice(0, w.w.length).map(function (q) { return withShuffledOptions(q, Math.random); });
    return { word: w.w, hint: w.hint, qs: qs };
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
    return { p_rights: rights(), p_qn: S.qs.length, p_solved: !!S.solved, p_ms: Math.max(5000, Math.round(S.thinkMs)), p_uni: k.uniId || '', p_name: (S.me && S.me.name) || ((k.uniShort || '') + ' student') };
  }
  function submit() {
    if (!signedIn() || S.mode !== 'daily') return;
    S.submitting = true; draw();
    rpc('unwind_submit', submitArgs()).then(function (r) { S.submitting = false; S.result = r; if (r && r.me) S.me = r.me; loadBoard('today'); })
      .catch(function () { S.submitting = false; S.result = { failed: true }; draw(); });
  }
  window.addEventListener('pagehide', function () {
    if ((S.phase !== 'play' && S.phase !== 'guess') || S.mode !== 'daily' || !signedIn() || !S.results.length) return;
    try { var CFG = window.UNIZY_CONFIG || {}; fetch(CFG.supabaseUrl + '/rest/v1/rpc/unwind_submit', { method: 'POST', keepalive: true, headers: X().Auth.headers(true), body: JSON.stringify(submitArgs()) }); } catch (e) { /* ignore */ }
  });

  // ------------------------------------------------------------------ the game
  function start(mode) {
    if (!S.qs0 || !S.words || !S.words.length) return;
    if (mode === 'daily' && signedIn() && startedToday()) mode = 'free';
    S.mode = mode;
    if (mode === 'daily' && signedIn()) { try { localStorage.setItem('unizy:unwind2:' + today(), String(Date.now())); } catch (e) { /* ignore */ } }
    var g = mode === 'daily' ? dailyGame() : freeGame();
    S.word = g.word; S.hint = g.hint; S.qs = g.qs;
    S.i = 0; S.picked = null; S.results = []; S.thinkMs = 0; S.result = null; S.guesses = []; S.solved = false; S.guessMsg = '';
    S.phase = 'play'; draw(); S.shownAt = Date.now();
    try { if (S.el && S.el.getBoundingClientRect().top < 0) S.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
  }
  function pick(idx) {
    if (S.phase !== 'play' || S.picked !== null) return;
    var q = S.qs[S.i]; if (!q) return;
    S.thinkMs += Math.min(120000, Date.now() - S.shownAt);
    S.picked = idx;
    S.results.push({ cat: q.cat, right: idx === q.answer });
    draw();
    var nx = document.querySelector('[data-uw-next]'); if (nx) try { nx.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function next() {
    if (S.phase !== 'play' || S.picked === null) return;
    S.i++; S.picked = null;
    if (S.i < S.qs.length) { draw(); S.shownAt = Date.now(); return; }
    // every letter found: the word is already solved
    if (wrongs() === 0) { S.solved = true; finish(); return; }
    S.guessLeft = guessAllowance(wrongs()); S.phase = 'guess'; S.shownAt = Date.now(); draw();
    focusGuess();
  }
  function focusGuess() { setTimeout(function () { var g = document.querySelector('[data-uw-guess]'); if (g) try { g.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30); }
  function guess() {
    if (S.phase !== 'guess') return;
    var inp = document.querySelector('[data-uw-guess]'), v = String((inp && inp.value) || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (v.length !== S.word.length) { S.guessMsg = 'The word has ' + S.word.length + ' letters.'; draw(); focusGuess(); return; }
    S.thinkMs += Math.min(120000, Date.now() - S.shownAt); S.shownAt = Date.now();
    S.guesses.push(v);
    if (v === S.word) { S.solved = true; finish(); return; }
    S.guessLeft--;
    if (S.guessLeft <= 0) { finish(); return; }
    S.guessMsg = 'Not quite. ' + S.guessLeft + (S.guessLeft === 1 ? ' guess' : ' guesses') + ' left.';
    draw(); focusGuess();
  }
  function finish() {
    S.phase = 'done'; draw();
    if (S.mode === 'daily') { if (signedIn()) submit(); else loadBoard(); }
  }

  // ------------------------------------------------------------------ drawing
  function theme() { var t = (S.kit && S.kit.theme) || {}; return { c: t.c1 || '#17302A' }; }
  function tiles(opts) {
    opts = opts || {};
    var html = '';
    for (var i = 0; i < S.word.length; i++) {
      var r = S.results[i], ch = S.word[i], cls = 'uw-tile', txt = '';
      if (opts.reveal) { cls += r && r.right ? ' got' : ' miss'; txt = ch; }
      else if (r && r.right) { cls += ' got' + (i === S.results.length - 1 && opts.fresh ? ' flip' : ''); txt = ch; }
      else if (r && !r.right) { cls += ' miss'; txt = ''; }
      else if (i === S.i && S.phase === 'play') cls += ' now';
      html += '<span class="' + cls + '">' + txt + '</span>';
    }
    return '<div class="uw-tiles" style="--n:' + S.word.length + '" aria-label="Hidden word">' + html + '</div>';
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
        var detail = S.scope === 'week' ? r.days + (r.days === 1 ? ' day' : ' days') + ' · ' + r.words + (r.words === 1 ? ' word' : ' words') : r.rights + '/' + r.qn + ' letters' + (r.words ? ' · word ✓' : '');
        return '<li class="' + (r.me ? 'me' : '') + '"><span class="rk">' + r.rank + '</span><span class="nm"><b>' + esc(r.name || 'A student') + (r.me ? ' (you)' : '') + '</b><small>' + esc(String(r.uni || '').toUpperCase()) + ' · ' + detail + ' · ' + fmt(r.ms) + '</small></span><span class="sc">' + r.score + '<small> pts</small></span></li>';
      }).join('') + '</ol>';
      rows += b.mine && b.mine.rank > 25 ? '<p class="pl-note">You’re #' + b.mine.rank + ' of ' + b.players + '.</p>' : '<p class="pl-note">' + b.players + (b.players === 1 ? ' player' : ' players') + (S.scope === 'week' ? ' this week' : ' today') + ' · 1 point per letter, +' + WORD_BONUS + ' for the word, then fastest.</p>';
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
    var me = S.me || {}, t = theme(), cta, demo = '';
    var ready = S.qs0 && S.words && S.words.length;
    if (ready) {
      var g = dailyGame();
      demo = '<div class="uw-tiles uw-intro-tiles" style="--n:' + g.word.length + '">' + g.word.split('').map(function () { return '<span class="uw-tile"></span>'; }).join('') + '</div><p class="uw-hint">Today’s word has <b>' + g.word.length + ' letters</b>. Hint: ' + esc(g.hint) + '</p>';
    }
    if (!ready) cta = S.loadErr ? '<p class="pl-note">' + esc(S.loadErr) + '</p>' : '<p class="pl-note">Getting today’s word…</p>';
    else if (me.played) cta = '<div class="uw-today">Today: <b>' + me.score + ' points</b>' + (me.qn ? ' (' + me.rights + '/' + me.qn + ' letters' + (me.solved ? ', word solved' : '') + ')' : '') + '. A new word tomorrow.</div><button type="button" class="pl-btn ghost" data-uw-start="free">Free play</button>';
    else if (signedIn() && startedToday()) cta = '<div class="uw-today">You’ve already started today’s word on this device. A new one tomorrow.</div><button type="button" class="pl-btn ghost" data-uw-start="free">Free play</button>';
    else cta = '<button type="button" class="pl-btn" data-uw-start="daily">Start today’s Unwind</button>' + (signedIn() ? '' : '<p class="pl-note">Not logged in, so your score won’t go on the leaderboard. <a href="/login?next=%2Fapp%2Fplay">Log in</a></p>');
    var stats = signedIn() && me.signed_in && !me.failed ? '<div class="pl-stats"><div><b>' + (me.streak || 0) + '</b><span>day streak</span></div><div><b>' + (me.words || 0) + '</b><span>words solved</span></div><div><b>' + (me.best != null ? me.best : '–') + '</b><span>best score</span></div></div>' : '';
    return '<div class="pl-grid"><section class="pl-card uw-hero" style="--uc:' + t.c + '"><div class="uw-sun" aria-hidden="true"></div><span class="pl-kick">' + esc(prettyDay()) + '</span><h2>Find today’s word.<br><em>One easy question per letter.</em></h2>' +
      '<p class="uw-lede">Each right answer reveals a letter of the hidden word; a wrong one leaves a gap. Then guess the word. Miss two letters or fewer and you get one guess; miss more and you get a guess for each one you missed.</p>' +
      demo + stats + '<div class="pl-cta">' + cta + '</div></section>' + boardCard() + '</div>';
  }
  function playHtml() {
    var q = S.qs[S.i]; if (!q) return '';
    var c = CATS[q.cat] || { label: q.cat, icon: '✨' }, answered = S.picked !== null, right = answered && S.picked === q.answer;
    var opts = q.options.map(function (o, i) {
      var cls = 'uw-opt' + (answered ? (i === q.answer ? ' right' : i === S.picked ? ' wrong' : ' dim') : '');
      return '<button type="button" class="' + cls + '" data-uw-opt="' + i + '"' + (answered ? ' disabled' : '') + '><kbd>' + 'ABCD'[i] + '</kbd><span>' + esc(o) + '</span></button>';
    }).join('');
    var last = S.i + 1 >= S.qs.length;
    var reveal = answered ? '<div class="uw-reveal ' + (right ? 'ok' : 'no') + '"><b>' + (right ? 'Correct! You found the letter ' + S.word[S.i] + '.' : 'Not quite. It’s ' + esc(q.options[q.answer]) + '. That letter stays hidden.') + '</b><p><span>Did you know?</span> ' + esc(q.fact) + '</p>' +
      '<button type="button" class="pl-btn" data-uw-next>' + (last ? (wrongs() === 0 ? 'See the word →' : 'Guess the word →') : 'Next question →') + '</button></div>' : '';
    return '<div class="uw-run"><div class="uw-top">' + tiles({ fresh: answered && right }) + '<button type="button" class="pl-x" data-uw-quit aria-label="Stop">×</button></div>' +
      '<p class="uw-sub">Letter ' + (S.i + 1) + ' of ' + S.qs.length + ' · Hint: ' + esc(S.hint) + (S.mode === 'free' ? ' · free play' : '') + '</p>' +
      '<section class="pl-card uw-card"><span class="uw-cat">' + c.icon + ' ' + esc(c.label) + '</span><p class="uw-q">' + esc(q.q) + '</p><div class="uw-opts">' + opts + '</div>' + reveal + '</section>' +
      '<p class="pl-keys">Tip: press A–D (or 1–4) to answer and Enter for the next question.</p></div>';
  }
  function guessHtml() {
    var w = wrongs();
    var past = S.guesses.map(function (g) {
      return '<div class="uw-past">' + g.split('').map(function (ch, i) { return '<span class="' + (ch === S.word[i] ? 'hit' : '') + '">' + esc(ch) + '</span>'; }).join('') + '</div>';
    }).join('');
    return '<div class="uw-run"><section class="pl-card uw-card uw-guesscard"><span class="pl-kick">Guess the word</span>' + tiles() +
      '<p class="uw-hint">Hint: ' + esc(S.hint) + '. You found ' + rights() + ' of ' + S.word.length + ' letters, so you have <b>' + S.guessLeft + (S.guessLeft === 1 ? ' guess' : ' guesses') + '</b>' + (S.guesses.length ? ' left' : '') + '.</p>' +
      (past ? '<div class="uw-pasts">' + past + '</div>' : '') +
      '<form class="uw-guess" data-uw-form><input data-uw-guess maxlength="' + S.word.length + '" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="' + S.word.length + ' letters" aria-label="Your guess"><button type="submit" class="pl-btn">Guess</button></form>' +
      (S.guessMsg ? '<p class="uw-gmsg">' + esc(S.guessMsg) + '</p>' : '') +
      '<p class="pl-note">' + 'Miss one or two letters and you get one guess. Miss more and you get one guess per missed letter. Solving it adds ' + WORD_BONUS + ' points.</p></section></div>';
  }
  function grid() { return S.results.map(function (r) { return r.right ? '🟩' : '⬜'; }).join('') + (S.solved ? ' ✅' : ' ❌'); }
  function doneHtml() {
    var t = theme(), res = '', n = rights();
    var line = S.solved ? (wrongs() === 0 ? 'Every letter found. Perfect.' : 'You got the word. Lovely stuff.') : 'So close. The word was ' + S.word + '.';
    if (S.mode === 'daily') {
      if (!signedIn()) res = '<p class="pl-note">Log in to put scores on the leaderboard and keep a streak. <a href="/login?next=%2Fapp%2Fplay">Log in</a> · <a href="/signup?next=%2Fapp%2Fplay">Sign up free</a></p>';
      else if (S.submitting) res = '<p class="pl-note">Adding your score to the board…</p>';
      else if (S.result && S.result.failed) res = '<p class="pl-note">Couldn’t save your score. <button type="button" class="pl-link" data-uw-resubmit>Try again</button></p>';
      else if (S.result && S.result.counted === false) res = '<p class="pl-note">You’d already played today, so this one didn’t count.</p>';
      else if (S.result) { var mine = S.board && S.board.mine; res = '<div class="pl-rank">' + (mine ? '<b>#' + mine.rank + '</b> of ' + S.board.players + ' today' : 'On the board') + ' · ' + ((S.me && S.me.streak) || 1) + '-day streak</div>'; }
    } else res = '<p class="pl-note">Free play: not counted on the leaderboard.</p>';
    var recap = '<ol class="uw-recap">' + S.qs.map(function (q, i) { var r = S.results[i]; if (!r) return ''; return '<li class="' + (r.right ? 'ok' : 'no') + '"><span class="uw-cat">' + S.word[i] + ' · ' + (CATS[q.cat] || {}).icon + ' ' + esc((CATS[q.cat] || {}).label || '') + '</span><b>' + esc(q.q) + '</b><span>' + esc(q.options[q.answer]) + '</span></li>'; }).join('') + '</ol>';
    return '<div class="pl-grid"><section class="pl-card uw-hero uw-end" style="--uc:' + t.c + '"><div class="uw-sun" aria-hidden="true"></div><span class="pl-kick">' + (S.mode === 'daily' ? 'Today’s Unwind' : 'Free play') + '</span>' +
      tiles({ reveal: true }) + '<h2>' + points() + '<small> points</small></h2><p class="uw-lede">' + esc(line) + ' ' + n + '/' + S.word.length + ' letters' + (S.solved ? ' + ' + WORD_BONUS + ' for the word' : '') + '. Thinking time ' + fmt(S.thinkMs) + '.</p><div class="uw-grid">' + grid() + '</div>' + res +
      '<div class="pl-cta"><button type="button" class="pl-btn" data-uw-share>Copy my result</button><button type="button" class="pl-btn ghost" data-uw-start="free">Free play</button><button type="button" class="pl-btn ghost" data-uw-home>Done</button></div></section>' +
      boardCard() + '<section class="pl-card"><div class="pl-h"><span class="pl-kick">The answers</span><h3>Letter by letter</h3></div>' + recap + '</section></div>';
  }
  function draw() {
    var el = S.el; if (!el || !document.body.contains(el)) return;
    el.innerHTML = S.phase === 'play' ? playHtml() : S.phase === 'guess' ? guessHtml() : S.phase === 'done' ? doneHtml() : introHtml();
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
      finish();
    }
    else if (t.hasAttribute('data-uw-rename')) {
      var v = (document.querySelector('[data-uw-name]') || {}).value || '';
      if (!v.trim()) { S.nameMsg = 'Type a name first.'; draw(); return; }
      if (!(S.me && S.me.games)) { S.me = Object.assign({}, S.me, { name: v.trim().slice(0, 24) }); S.nameMsg = 'Saved. It’ll show when you play today.'; draw(); return; }
      rpc('unwind_rename', { p_name: v }).then(function (r) { S.me = Object.assign({}, S.me, { name: r.name }); S.nameMsg = 'Saved.'; loadBoard(); }).catch(function () { S.nameMsg = 'Couldn’t save that name. Use letters and numbers.'; draw(); });
    }
    else if (t.hasAttribute('data-uw-share')) {
      var txt = 'Unizy Unwind · ' + prettyDay() + '\n' + points() + ' points · ' + rights() + '/' + S.word.length + ' letters\n' + grid() + '\nunizy.uk/play';
      var done = function () { t.textContent = 'Copied ✓'; setTimeout(function () { t.textContent = 'Copy my result'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { prompt('Copy your result:', txt); });
      else prompt('Copy your result:', txt);
    }
  }
  function onSubmit(e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-uw-form')) { e.preventDefault(); guess(); } }
  function onKey(e) {
    if (S.phase !== 'play' || !S.el || !document.body.contains(S.el)) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var k = String(e.key || '').toLowerCase(), map = { a: 0, b: 1, c: 2, d: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
    if (S.picked === null && k in map) { e.preventDefault(); pick(map[k]); }
    else if (S.picked !== null && (k === 'enter' || k === ' ' || k === 'arrowright')) { e.preventDefault(); next(); }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
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
