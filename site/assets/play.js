/* Unizy Play: "Stack", the daily 90-second game.
   Questions come from the student's own modules. Every right answer adds a block to their tower, three right in a
   row adds a gold bonus block, a wrong answer knocks the top block off. The first run each day (UK time) goes on
   the leaderboard; later runs are practice. Missed questions can be saved to flashcards afterwards. */
(function () {
  'use strict';
  var RUN_SECONDS = 90;
  var S = {
    kit: null, inst: null, el: null,
    phase: 'intro', mode: 'daily',
    pool: null, poolKey: '', loading: false, loadErr: '',
    qs: [], i: 0, blocks: [], combo: 0, bestCombo: 0, correct: 0, wrong: 0, endAt: 0, lock: false,
    missed: [], saved: {},
    me: null, board: null, scope: 'today', boardLoading: false,
    result: null, submitting: false, nameMsg: ''
  };
  var banks = {};

  // ------------------------------------------------------------------ helpers
  function X() { return window.UnizyWeb && window.UnizyWeb._internal; }
  function signedIn() { return !!(X() && X().Auth.session); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function prettyDay() {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date()); }
    catch (e) { return today(); }
  }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, rand) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function rpc(name, args) {
    return X().Sync.rest('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error((b && b.message) || 'Something went wrong.'); return b; });
    });
  }
  function firstSentence(s, max) { s = String(s || '').replace(/\s+/g, ' ').trim(); var m = /^(.{30,}?[.!?])\s/.exec(s + ' '); s = m ? m[1] : s; return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s; }

  // ------------------------------------------------------------------ question pool from the student's modules
  function startedToday() { try { return !!localStorage.getItem('unizy:play:' + today()); } catch (e) { return false; } }
  // leaving mid-run (closing the tab) still records the tower built so far
  window.addEventListener('pagehide', function () {
    if (S.phase !== 'play' || S.mode !== 'daily' || !signedIn()) return;
    try {
      var k = S.kit || {}, CFG = window.UNIZY_CONFIG || {};
      fetch(CFG.supabaseUrl + '/rest/v1/rpc/play_submit', { method: 'POST', keepalive: true, headers: X().Auth.headers(true),
        body: JSON.stringify({ p_score: S.blocks.length, p_correct: S.correct, p_wrong: S.wrong, p_uni: k.uniId || '', p_course: k.degreeName || '', p_name: (S.me && S.me.name) || ((k.uniShort || '') + ' student') }) });
    } catch (e) { /* ignore */ }
  });
  function poolKeyOf(k) { return (k.banks || []).map(function (b) { return b.id; }).sort().join(',') + '|' + (k.degreeId || ''); }
  function loadPool() {
    var k = S.kit; if (!k) return;
    var key = poolKeyOf(k);
    if (S.poolKey === key && (S.pool || S.loading)) return;
    S.poolKey = key; S.pool = null; S.loadErr = '';
    if (!k.banks || !k.banks.length) { S.pool = []; draw(); return; }
    S.loading = true; draw();
    var uniq = {}; k.banks.forEach(function (b) { if (!uniq[b.id]) uniq[b.id] = b; });
    var list = Object.keys(uniq).map(function (id) { return uniq[id]; });
    Promise.all(list.map(function (b) {
      if (banks[b.id]) return Promise.resolve([b, banks[b.id]]);
      return fetch(b.url).then(function (r) { return r.json(); }).then(function (j) { banks[b.id] = j; return [b, j]; }).catch(function () { return [b, null]; });
    })).then(function (rows) {
      if (S.poolKey !== key) return;
      var items = [];
      rows.forEach(function (row) {
        var meta = row[0], bank = row[1]; if (!bank) return;
        var topics = bank.topics || [];
        (bank.questions || []).forEach(function (q, qi) {
          if (q.type !== 'mcq' || !Array.isArray(q.options) || q.options.length < 3 || q.options.length > 5) return;
          var ans = +q.answer; if (!(ans >= 0 && ans < q.options.length)) return;
          if (String(q.q || '').length > 260) return;
          items.push({ id: meta.id + ':q' + qi, q: q.q, options: q.options.slice(), answer: ans, why: q.why || '', topic: topics[q.t] || '', mod: meta });
        });
        // short definition-to-term items from flashcards, for modules with few multiple-choice questions
        var cards = (bank.cards || []).filter(function (c) { var f = String(c.f || '').trim(); return f.length >= 3 && f.length <= 48 && !/[?:.]$/.test(f) && !/\bvs\.?\b/i.test(f) && !/^(give|name|list|state|define|explain|describe|outline|why|how|what|when|which|who|where|compare|contrast|identify|summarise|summarize|calculate|write|derive|sketch|draw|discuss)\b/i.test(f) && !/credit|\bterms?\b|assessment|syllabus|partner organisation|\(20\d\d|[A-Z]{3,5}\d{4,5}/i.test(f) && String(c.b || '').length >= 40 && String(c.b).toLowerCase().indexOf(f.toLowerCase()) === -1; });
        var nQ = (bank.questions || []).filter(function (q) { return q.type === 'mcq'; }).length;
        if (nQ < 15 && cards.length >= 4) {
          cards.slice(0, 20).forEach(function (c, ci) {
            var others = cards.filter(function (o) { return o !== c && o.t === c.t; });
            if (others.length < 3) others = cards.filter(function (o) { return o !== c; });
            var pick = shuffle(others, rng(hash(meta.id + ci))).slice(0, 3).map(function (o) { return o.f; });
            var opts = shuffle([c.f].concat(pick), rng(hash(meta.id + 'o' + ci)));
            items.push({ id: meta.id + ':c' + ci, q: 'Which term matches? “' + firstSentence(c.b, 170) + '”', options: opts, answer: opts.indexOf(c.f), why: c.b, topic: topics[c.t] || '', mod: meta });
          });
        }
      });
      S.pool = items; S.loading = false; draw();
    }).catch(function () { S.loading = false; S.loadErr = 'Couldn’t load your questions. Check your connection and try again.'; draw(); });
  }

  // ------------------------------------------------------------------ leaderboard
  function loadMe() {
    if (!signedIn()) { S.me = { signed_in: false }; draw(); return Promise.resolve(); }
    return rpc('play_me', {}).then(function (m) { S.me = m; if (m && m.played && S.mode === 'daily' && S.phase === 'intro') S.mode = 'practice'; draw(); }).catch(function () { S.me = { signed_in: true, failed: true }; draw(); });
  }
  function loadBoard(scope) {
    if (scope) S.scope = scope;
    if (!signedIn()) { S.board = null; draw(); return; }
    S.boardLoading = true; draw();
    rpc('play_board', { p_scope: S.scope, p_uni: S.kit && S.kit.uniId }).then(function (b) { S.board = b; S.boardLoading = false; draw(); })
      .catch(function () { S.boardLoading = false; S.board = { failed: true }; draw(); });
  }
  function submit() {
    if (!signedIn() || S.mode !== 'daily') return;
    S.submitting = true; draw();
    var k = S.kit || {};
    var name = (document.querySelector('[data-play-name]') || {}).value || (S.me && S.me.name) || '';
    rpc('play_submit', { p_score: S.blocks.length, p_correct: S.correct, p_wrong: S.wrong, p_uni: k.uniId || '', p_course: k.degreeName || '', p_name: name || ((k.uniShort || '') + ' student') })
      .then(function (r) { S.submitting = false; S.result = r; S.me = r && r.me ? r.me : S.me; loadBoard('today'); })
      .catch(function () { S.submitting = false; S.result = { failed: true }; draw(); });
  }

  // ------------------------------------------------------------------ the run
  function start(mode) {
    if (!S.pool || !S.pool.length) return;
    if (mode === 'daily' && signedIn() && startedToday()) mode = 'practice';
    S.mode = mode;
    if (mode === 'daily' && signedIn()) { try { localStorage.setItem('unizy:play:' + today(), String(Date.now())); } catch (e) { /* ignore */ } }
    var k = S.kit || {};
    var rand = mode === 'daily' ? rng(hash(today() + '|' + poolKeyOf(k))) : Math.random;
    S.qs = shuffle(S.pool, rand).slice(0, 60).map(function (q) {
      var order = shuffle(q.options.map(function (o, i) { return i; }), rand);
      return Object.assign({}, q, { options: order.map(function (i) { return q.options[i]; }), answer: order.indexOf(q.answer) });
    });
    S.i = 0; S.blocks = []; S.combo = 0; S.bestCombo = 0; S.correct = 0; S.wrong = 0; S.missed = []; S.saved = {}; S.result = null; S.lock = false;
    S.endAt = Date.now() + RUN_SECONDS * 1000;
    S.phase = 'play'; draw(); tick();
    try { if (S.el && S.el.getBoundingClientRect().top < 0) S.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
  }
  function finish() {
    if (S.phase !== 'play') return;
    S.phase = 'done'; S.lock = false; draw();
    if (S.mode === 'daily') { if (signedIn()) submit(); else loadBoard(); }
    if (window.UnizyWeb && window.UnizyWeb._internal && window.UnizyWeb._internal.track) try { window.UnizyWeb._internal.track('play_done'); } catch (e) { /* ignore */ }
  }
  var timerT = null;
  function tick() {
    clearTimeout(timerT);
    if (S.phase !== 'play') return;
    var left = Math.max(0, S.endAt - Date.now());
    var bar = document.querySelector('[data-play-time]'), num = document.querySelector('[data-play-secs]');
    if (bar) bar.style.transform = 'scaleX(' + (left / (RUN_SECONDS * 1000)) + ')';
    if (num) num.textContent = Math.ceil(left / 1000) + 's';
    if (bar) bar.classList.toggle('low', left < 15000);
    if (left <= 0) { finish(); return; }
    timerT = setTimeout(tick, 200);
  }
  function answer(idx) {
    if (S.phase !== 'play' || S.lock) return;
    var q = S.qs[S.i]; if (!q) return;
    S.lock = true;
    var right = idx === q.answer;
    var btns = document.querySelectorAll('[data-play-opt]');
    Array.prototype.forEach.call(btns, function (b) {
      var n = +b.getAttribute('data-play-opt');
      if (n === q.answer) b.classList.add('right');
      else if (n === idx) b.classList.add('wrong');
      b.disabled = true;
    });
    if (right) {
      S.correct++; S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
      S.blocks.push('n');
      if (S.combo % 3 === 0) S.blocks.push('g');
      drawTower(right ? (S.combo % 3 === 0 ? 2 : 1) : 0);
    } else {
      S.wrong++; S.combo = 0; S.missed.push(q);
      knockTop();
    }
    var hud = document.querySelector('[data-play-combo]'); if (hud) hud.textContent = comboText();
    setTimeout(function () {
      S.lock = false;
      S.i++;
      if (S.i >= S.qs.length) { finish(); return; }
      if (S.phase === 'play') drawQuestion();
    }, right ? 420 : 900);
  }
  function comboText() { var n = S.combo % 3; return S.combo >= 1 ? 'Combo ' + S.combo + (n === 2 ? ' · next one adds a gold block' : '') : 'Three in a row adds a gold block'; }
  function knockTop() {
    var tw = document.querySelector('[data-play-tower]');
    var top = tw && tw.lastElementChild;
    if (S.blocks.length) S.blocks.pop();
    if (top && top.classList.contains('blk')) { top.classList.add('fall'); setTimeout(function () { drawTower(0); }, 450); }
    else drawTower(0);
    var stage = document.querySelector('[data-play-stage]'); if (stage) { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
  }

  // ------------------------------------------------------------------ drawing
  function theme() { var t = (S.kit && S.kit.theme) || {}; return { c: t.c1 || '#17302A', on: t.on1 || '#FFFFFF' }; }
  function towerHtml(newCount) {
    var n = S.blocks.length, h = n > 18 ? Math.max(8, Math.floor(340 / n)) : 18;
    var out = '';
    S.blocks.forEach(function (b, i) {
      var fresh = i >= n - (newCount || 0);
      var w = 100 - ((i * 37) % 9);
      out += '<div class="blk' + (b === 'g' ? ' gold' : '') + (fresh ? ' drop' : '') + '" style="height:' + h + 'px;width:' + w + '%"></div>';
    });
    return out;
  }
  function drawTower(newCount) {
    var tw = document.querySelector('[data-play-tower]'); if (tw) tw.innerHTML = towerHtml(newCount);
    var c = document.querySelector('[data-play-height]'); if (c) c.textContent = S.blocks.length;
  }
  function drawQuestion() {
    var box = document.querySelector('[data-play-q]'); if (!box) { draw(); return; }
    var q = S.qs[S.i];
    box.innerHTML = qHtml(q);
    var n = document.querySelector('[data-play-n]'); if (n) n.textContent = 'Question ' + (S.i + 1);
  }
  function qHtml(q) {
    if (!q) return '';
    return '<div class="pq-meta"><span>' + esc(q.mod.code || q.mod.title || '') + '</span>' + (q.topic ? '<span>' + esc(q.topic) + '</span>' : '') + '</div>' +
      '<p class="pq-q">' + esc(q.q) + '</p><div class="pq-opts">' + q.options.map(function (o, i) {
        return '<button type="button" class="pq-opt" data-play-opt="' + i + '"><kbd>' + (i + 1) + '</kbd><span>' + esc(o) + '</span></button>';
      }).join('') + '</div>';
  }
  function boardHtml() {
    if (!signedIn()) return '<div class="pl-note">Log in to see the leaderboard and put your tower on it. <a href="/login?next=%2Fapp%2Fplay">Log in</a> · <a href="/signup?next=%2Fapp%2Fplay">Sign up free</a></div>';
    var tabs = [['today', 'Today'], ['week', 'This week'], ['uni', (S.kit && S.kit.uniShort ? S.kit.uniShort : 'My uni') + ' today']].map(function (t) {
      return '<button type="button" class="pl-tab' + (S.scope === t[0] ? ' on' : '') + '" data-play-scope="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('');
    var b = S.board, rows = '';
    if (S.boardLoading && !b) rows = '<p class="pl-note">Loading…</p>';
    else if (!b || b.failed) rows = '<p class="pl-note">Couldn’t load the leaderboard. <button type="button" class="pl-link" data-play-scope="' + S.scope + '">Try again</button></p>';
    else if (!b.rows || !b.rows.length) rows = '<p class="pl-note">No towers yet ' + (S.scope === 'week' ? 'this week' : 'today') + '. Be the first.</p>';
    else {
      rows = '<ol class="pl-board">' + b.rows.map(function (r) {
        return '<li class="' + (r.me ? 'me' : '') + '"><span class="rk">' + r.rank + '</span><span class="nm"><b>' + esc(r.name || 'A student') + (r.me ? ' (you)' : '') + '</b><small>' + esc(String(r.uni || '').toUpperCase()) + (r.course ? ' · ' + esc(r.course) : '') + (S.scope === 'week' ? ' · ' + r.days + (r.days === 1 ? ' day' : ' days') : '') + '</small></span><span class="sc">' + r.score + '</span></li>';
      }).join('') + '</ol>';
      if (b.mine && b.mine.rank > 25) rows += '<p class="pl-note">You’re #' + b.mine.rank + ' of ' + b.players + ' with ' + b.mine.score + '.</p>';
      else rows += '<p class="pl-note">' + b.players + (b.players === 1 ? ' player' : ' players') + (S.scope === 'week' ? ' this week (daily scores added up)' : ' today') + '.</p>';
    }
    return '<div class="pl-tabs" role="tablist">' + tabs + '</div>' + rows;
  }
  function introHtml() {
    var me = S.me || {}, k = S.kit || {}, t = theme();
    var poolN = S.pool ? S.pool.length : 0;
    var stats = signedIn() && me.signed_in ? '<div class="pl-stats"><div><b>' + (me.streak || 0) + '</b><span>day streak</span></div><div><b>' + (me.best != null ? me.best : '–') + '</b><span>best tower</span></div><div><b>' + (me.games || 0) + '</b><span>days played</span></div></div>' : '';
    var cta;
    if (S.loading || !S.pool) cta = '<p class="pl-note">Getting today’s questions from your modules…</p>';
    else if (S.loadErr) cta = '<p class="pl-note">' + esc(S.loadErr) + '</p>';
    else if (poolN < 8) cta = '<p class="pl-note">Your modules don’t have enough ready-made questions for Stack yet. Add a module with a Unizy library (look for “Module pack” or “Subject library” when you choose modules), then come back.</p>';
    else if (signedIn() && !me.played && startedToday() && S.mode === 'daily') cta = '<div class="pl-done-today">Today’s run was already started on this device, so it can’t be replayed. Come back tomorrow for a new tower.</div><button type="button" class="pl-btn ghost" data-play-start="practice">Practice run (doesn’t count)</button>';
    else if (me.played) cta = '<div class="pl-done-today">You’ve played today: <b>' + me.score + ' blocks</b>. Come back tomorrow for a new tower.</div><button type="button" class="pl-btn ghost" data-play-start="practice">Practice run (doesn’t count)</button>';
    else cta = '<button type="button" class="pl-btn" data-play-start="daily">Play today’s Stack</button>' + (signedIn() ? '' : '<p class="pl-note">You’re not logged in, so this run won’t go on the leaderboard. <a href="/login?next=%2Fapp%2Fplay">Log in</a></p>');
    return '<div class="pl-grid">' +
      '<section class="pl-card pl-hero" style="--uc:' + t.c + '">' +
        '<div class="pl-hero-txt"><span class="pl-kick">' + esc(prettyDay()) + ' · daily game</span><h2>Build today’s tower.</h2>' +
        '<ul class="pl-rules"><li><b>90 seconds</b> of questions from your own modules.</li><li>Every right answer adds a <b>block</b>. Three in a row adds a <b class="g">gold</b> one.</li><li>A wrong answer <b>knocks the top block off</b>.</li><li>Your first run each day goes on the leaderboard. After that it’s practice.</li></ul>' +
        stats + '<div class="pl-cta">' + cta + '</div></div>' +
        '<div class="pl-demo" aria-hidden="true"><div class="blk"></div><div class="blk"></div><div class="blk gold"></div><div class="blk"></div><div class="blk"></div><div class="blk gold"></div><div class="blk"></div></div>' +
      '</section>' +
      '<section class="pl-card"><div class="pl-h"><span class="pl-kick">Leaderboard</span><h3>Tallest towers</h3></div>' + boardHtml() + nameHtml() + '</section>' +
    '</div>';
  }
  function nameHtml() {
    if (!signedIn() || !S.me || !S.me.signed_in) return '';
    var k = S.kit || {};
    return '<div class="pl-name"><label for="pl-name">Your name on the board</label><div><input id="pl-name" data-play-name maxlength="24" value="' + esc(S.me.name || '') + '" placeholder="' + esc((k.uniShort || 'A') + ' student') + '"><button type="button" class="pl-btn small ghost" data-play-rename>Save</button></div>' + (S.nameMsg ? '<small>' + esc(S.nameMsg) + '</small>' : '<small>Letters, numbers, spaces and . _ - only. Everyone signed up can see it.</small>') + '</div>';
  }
  function playHtml() {
    var t = theme(), q = S.qs[S.i];
    return '<div class="pl-run" style="--uc:' + t.c + '">' +
      '<div class="pl-hud"><span data-play-n>Question ' + (S.i + 1) + '</span><span class="pl-time"><i data-play-time></i></span><b data-play-secs>' + Math.ceil((S.endAt - Date.now()) / 1000) + 's</b><button type="button" class="pl-x" data-play-quit aria-label="End this run">×</button></div>' +
      '<div class="pl-run-grid"><div class="pl-qbox" data-play-q>' + qHtml(q) + '</div>' +
      '<div class="pl-stage" data-play-stage><div class="pl-count"><b data-play-height>' + S.blocks.length + '</b><span>blocks</span></div><div class="pl-tower" data-play-tower>' + towerHtml(0) + '</div><div class="pl-ground"></div><p class="pl-combo" data-play-combo>' + comboText() + '</p></div></div>' +
      (S.mode === 'practice' ? '<p class="pl-note">Practice run: this one doesn’t go on the leaderboard.</p>' : '') +
      '<p class="pl-keys">Tip: press 1–4 on your keyboard to answer.</p></div>';
  }
  function doneHtml() {
    var t = theme(), n = S.blocks.length, acc = S.correct + S.wrong ? Math.round(100 * S.correct / (S.correct + S.wrong)) : 0;
    var res = '';
    if (S.mode === 'daily') {
      if (!signedIn()) res = '<div class="pl-note">Log in to put this tower on the leaderboard and keep your streak. <a href="/login?next=%2Fapp%2Fplay">Log in</a> · <a href="/signup?next=%2Fapp%2Fplay">Sign up free</a></div>';
      else if (S.submitting) res = '<p class="pl-note">Putting your tower on the board…</p>';
      else if (S.result && S.result.failed) res = '<p class="pl-note">Couldn’t save your score. <button type="button" class="pl-link" data-play-resubmit>Try again</button></p>';
      else if (S.result && S.result.counted === false) res = '<p class="pl-note">You’d already played today, so this one didn’t count.</p>';
      else if (S.result) { var mine = S.board && S.board.mine; res = '<div class="pl-rank">' + (mine ? '<b>#' + mine.rank + '</b> of ' + S.board.players + ' today' : 'On the board') + ' · ' + ((S.me && S.me.streak) || 1) + '-day streak</div>'; }
    } else res = '<p class="pl-note">Practice run: not counted.</p>';
    var missed = S.missed.length ? '<section class="pl-card"><div class="pl-h"><span class="pl-kick">Revise what you missed</span><h3>' + S.missed.length + (S.missed.length === 1 ? ' question' : ' questions') + ' to look at</h3></div><ol class="pl-missed">' +
      S.missed.map(function (q, i) {
        var sv = S.saved[q.id];
        return '<li><p class="pq-q">' + esc(q.q) + '</p><p class="ans">Answer: <b>' + esc(q.options[q.answer]) + '</b></p>' + (q.why ? '<p class="why">' + esc(q.why) + '</p>' : '') +
          '<div class="row"><small>' + esc(q.mod.code || q.mod.title || '') + (q.topic ? ' · ' + esc(q.topic) : '') + '</small><button type="button" class="pl-btn small ghost" data-play-save="' + i + '"' + (sv ? ' disabled' : '') + '>' + (sv ? 'Saved to flashcards ✓' : 'Save to flashcards') + '</button></div></li>';
      }).join('') + '</ol>' + (S.missed.length > 1 ? '<button type="button" class="pl-btn small" data-play-saveall>Save all to flashcards</button>' : '') + '</section>' : '<section class="pl-card"><p class="pl-note">No mistakes. Nothing to revise from this run.</p></section>';
    return '<div class="pl-grid">' +
      '<section class="pl-card pl-hero pl-end" style="--uc:' + t.c + '"><div class="pl-hero-txt"><span class="pl-kick">' + (S.mode === 'daily' ? 'Today’s tower' : 'Practice tower') + '</span><h2>' + n + (n === 1 ? ' block' : ' blocks') + '</h2>' +
        '<div class="pl-stats"><div><b>' + S.correct + '</b><span>right</span></div><div><b>' + S.wrong + '</b><span>wrong</span></div><div><b>' + acc + '%</b><span>accuracy</span></div><div><b>' + S.bestCombo + '</b><span>best combo</span></div></div>' + res +
        '<div class="pl-cta"><button type="button" class="pl-btn" data-play-share>Copy my result</button><button type="button" class="pl-btn ghost" data-play-start="practice">Practice run</button><button type="button" class="pl-btn ghost" data-play-home>Back</button></div></div>' +
        '<div class="pl-stage final"><div class="pl-tower">' + towerHtml(0) + '</div><div class="pl-ground"></div></div></section>' +
      missed +
      '<section class="pl-card"><div class="pl-h"><span class="pl-kick">Leaderboard</span><h3>Tallest towers</h3></div>' + boardHtml() + nameHtml() + '</section>' +
    '</div>';
  }
  function draw() {
    var el = S.el; if (!el || !document.body.contains(el)) return;
    el.innerHTML = S.phase === 'play' ? playHtml() : S.phase === 'done' ? doneHtml() : introHtml();
    if (S.phase === 'play') tick();
  }

  // ------------------------------------------------------------------ events
  function saveMissed(list) {
    var k = S.kit; if (!k || !k.saveCards) return;
    k.saveCards(list.map(function (q) { return { modKey: q.mod.modKey, f: q.q, b: q.options[q.answer] + (q.why ? '. ' + q.why : '') }; }));
    list.forEach(function (q) { S.saved[q.id] = true; });
    draw();
  }
  function onClick(e) {
    var t = e.target.closest && e.target.closest('[data-play-opt],[data-play-start],[data-play-scope],[data-play-quit],[data-play-home],[data-play-share],[data-play-save],[data-play-saveall],[data-play-rename],[data-play-resubmit]');
    if (!t || !S.el || !S.el.contains(t)) return;
    if (t.hasAttribute('data-play-opt')) answer(+t.getAttribute('data-play-opt'));
    else if (t.hasAttribute('data-play-start')) start(t.getAttribute('data-play-start'));
    else if (t.hasAttribute('data-play-scope')) loadBoard(t.getAttribute('data-play-scope'));
    else if (t.hasAttribute('data-play-quit')) { if (S.mode === 'daily' && !confirm('End today’s run now? Your tower so far is what counts.')) return; finish(); }
    else if (t.hasAttribute('data-play-home')) { S.phase = 'intro'; S.mode = S.me && S.me.played ? 'practice' : 'daily'; draw(); }
    else if (t.hasAttribute('data-play-resubmit')) submit();
    else if (t.hasAttribute('data-play-save')) { var q = S.missed[+t.getAttribute('data-play-save')]; if (q) saveMissed([q]); }
    else if (t.hasAttribute('data-play-saveall')) saveMissed(S.missed.filter(function (q) { return !S.saved[q.id]; }));
    else if (t.hasAttribute('data-play-rename')) {
      var v = (document.querySelector('[data-play-name]') || {}).value || '';
      if (!v.trim()) { S.nameMsg = 'Type a name first.'; draw(); return; }
      if (!(S.me && S.me.games)) { S.me = Object.assign({}, S.me, { name: v.trim().slice(0, 24) }); S.nameMsg = 'Saved. It’ll show when you play today’s run.'; draw(); return; }
      rpc('play_rename', { p_name: v }).then(function (r) { S.me = Object.assign({}, S.me, { name: r.name }); S.nameMsg = 'Saved.'; loadBoard(); }).catch(function () { S.nameMsg = 'Couldn’t save that name. Use letters and numbers.'; draw(); });
    }
    else if (t.hasAttribute('data-play-share')) {
      var n = S.blocks.length, row = S.blocks.slice(-12).map(function (b) { return b === 'g' ? '🟨' : '🟩'; }).join('');
      var txt = 'Unizy Stack · ' + prettyDay() + '\n' + n + (n === 1 ? ' block' : ' blocks') + ' · ' + S.correct + ' right · best combo ' + S.bestCombo + '\n' + row + '\nunizy.uk/play';
      var done = function () { t.textContent = 'Copied ✓'; setTimeout(function () { t.textContent = 'Copy my result'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { prompt('Copy your result:', txt); });
      else prompt('Copy your result:', txt);
    }
  }
  function onKey(e) {
    if (S.phase !== 'play' || !S.el || !document.body.contains(S.el)) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var n = +e.key; if (n >= 1 && n <= 4) { e.preventDefault(); answer(n - 1); }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  // ------------------------------------------------------------------ hooks from the app
  window.UnizyPlay = {
    // called after every render of the app
    mount: function (inst, kit) {
      S.inst = inst; if (kit) S.kit = kit;
      var el = document.getElementById('uz-play');
      if (!el) { S.el = null; return; }
      if (S.kit) loadPool();
      if (el !== S.el || !el.firstChild) {
        S.el = el;
        if (!S.me) loadMe();
        if (!S.board && !S.boardLoading) loadBoard();
        draw();
      }
    },
    status: function () { return { played: !!(S.me && S.me.played), score: S.me && S.me.score, streak: S.me && S.me.streak }; }
  };
})();
