/* The marker: find any UCL module, practise an exam-style question, get it marked against UCL's grade bands
   and the department's criteria, compare with a First-class answer, rewrite and track your class over time. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG, BRAND = (window.SITE_BRAND || {}).name || 'SaveMyGrade';
  var SKEY = 'unizy.session', DKEY = 'mark:drafts', root = document.getElementById('mk');
  var state = { q: '', ug: true, results: [], mod: null, questions: null, qsBusy: false, cur: null, result: null, attempts: null, busy: false, err: '' };

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function paras(s) { return esc(s).split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function words(s) { var m = String(s || '').trim().match(/\S+/g); return m ? m.length : 0; }
  function getSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function track(ev) {
    try {
      if (navigator.webdriver || localStorage.getItem('unizy:notrack') === '1') return;
      fetch(CFG.supabaseUrl + '/rest/v1/rpc/track_event', { method: 'POST', keepalive: true, headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_event: ev }) }).catch(function () {});
    } catch (e) {}
  }
  function token() {
    var s = getSession();
    if (!s || !s.access_token) return Promise.resolve(null);
    if (s.expires_at && s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s.access_token);
    return fetch(CFG.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        if (!b || !b.access_token) return null;
        s.access_token = b.access_token; s.refresh_token = b.refresh_token || s.refresh_token; s.expires_at = b.expires_at || Math.floor(Date.now() / 1000) + (b.expires_in || 3600);
        try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {}
        return s.access_token;
      }).catch(function () { return null; });
  }
  function rest(path, opts) {
    opts = opts || {};
    return token().then(function (t) {
      var h = { apikey: CFG.anonKey, 'Content-Type': 'application/json' };
      if (t && opts.auth) h.Authorization = 'Bearer ' + t;
      if (opts.prefer) h.Prefer = opts.prefer;
      return fetch(CFG.supabaseUrl + '/rest/v1/' + path, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
        .then(function (r) { return r.ok ? (r.status === 204 ? null : r.json()) : Promise.reject(new Error('Couldn’t load that. Check your connection and try again.')); });
    });
  }
  function marker(body) {
    return token().then(function (t) {
      if (!t) { var e = new Error('signin'); e.signin = true; throw e; }
      return fetch(CFG.supabaseUrl + '/functions/v1/marker', { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (b) {
            if (r.ok) return b;
            var e = new Error(b.message || 'Something went wrong. Try again.'); e.status = r.status; e.upgrade = !!b.upgrade; e.signin = r.status === 401; throw e;
          });
        }, function () { throw new Error('Couldn’t reach the marker. Check your connection.'); });
    });
  }
  function drafts() { try { return JSON.parse(localStorage.getItem(DKEY) || '{}'); } catch (e) { return {}; } }
  function saveDraft(key, val) { var d = drafts(); if (val) d[key] = { t: val, at: Date.now() }; else delete d[key]; try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch (e) {} }
  function draftKey() { return state.mod ? state.mod.code + ':' + (state.cur && state.cur.id ? state.cur.id : 'own') : ''; }
  function signinUrl() { return '/signup?next=' + encodeURIComponent(location.pathname + location.search); }
  function levelName(l) { return l === 4 ? 'Year 1 (Level 4)' : l === 5 ? 'Year 2 (Level 5)' : l === 6 ? 'Final year (Level 6)' : l === 7 ? 'Level 7 (Master’s)' : 'Level ' + (l || '?'); }
  function clsSlug(c) { return c === 'First' ? 'first' : c === '2:1' ? 'u2' : c === '2:2' ? 'l2' : c === 'Third' ? 'third' : 'fail'; }

  // ---------- routing ----------
  function go(params, replace) {
    var u = new URL(location.href);
    ['m', 'q', 'v'].forEach(function (k) { u.searchParams.delete(k); });
    Object.keys(params || {}).forEach(function (k) { if (params[k]) u.searchParams.set(k, params[k]); });
    var path = params && params.m ? '/modules/' + params.m : '/mark';
    u.searchParams.delete('m');
    var href = path + (u.search || '');
    if (replace) history.replaceState(null, '', href); else history.pushState(null, '', href);
    route();
  }
  function routeParams() {
    var p = new URLSearchParams(location.search), m = /^\/modules\/([A-Za-z]{4}[0-9]{4})\/?$/.exec(location.pathname);
    return { m: m ? m[1].toUpperCase() : (p.get('m') || '').toUpperCase(), q: p.get('q') || '', v: p.get('v') || '' };
  }
  function route() {
    var r = routeParams();
    state.err = '';
    if (!r.m) { state.mod = null; render(); setTitle(); return; }
    var after = function () {
      if (r.v === 'answer') {
        if (r.q === 'own') state.cur = { id: null, own: true, question: (state.cur && state.cur.own && state.cur.question) || '' };
        else if (state.questions) state.cur = state.questions.filter(function (x) { return x.id === r.q; })[0] || null;
        else { render(); return; } // questions still loading; loadQuestions() routes again
        if (!state.cur) { go({ m: r.m }, true); return; }
      } else if (r.v !== 'result') { state.cur = null; state.result = null; }
      if (r.v === 'result' && !state.result) { go({ m: r.m }, true); return; }
      render(); setTitle(); window.scrollTo(0, 0);
    };
    if (state.mod && state.mod.code === r.m) { after(); return; }
    state.mod = { code: r.m, loading: true }; state.questions = null; state.attempts = null; render();
    rest('ucl_modules?code=eq.' + encodeURIComponent(r.m) + '&select=code,title,level,credits,faculty,department,term,summary,url').then(function (rows) {
      if (!rows || !rows.length) { state.mod = { code: r.m, missing: true }; render(); return; }
      state.mod = rows[0]; loadQuestions(); loadAttempts(); after();
    }).catch(function (e) { state.err = e.message; render(); });
  }
  function setTitle() {
    var m = state.mod;
    document.title = m && m.title ? m.code + ' ' + m.title + ' · practice questions and marking · ' + BRAND : 'Find your UCL module · ' + BRAND;
  }

  // ---------- data ----------
  var searchTimer = null, searchSeq = 0;
  function search(q) {
    state.q = q; clearTimeout(searchTimer);
    var term = q.trim();
    if (term.length < 2) { state.results = []; renderList(); return; }
    searchTimer = setTimeout(function () {
      var seq = ++searchSeq, t = term.replace(/[%*,()]/g, ' ').trim();
      var filt = /^[A-Za-z]{4}\d{0,4}$/.test(t) ? 'code=ilike.' + encodeURIComponent(t.toUpperCase() + '*') : 'or=(title.ilike.*' + encodeURIComponent(t) + '*,code.ilike.*' + encodeURIComponent(t) + '*,department.ilike.*' + encodeURIComponent(t) + '*)';
      rest('ucl_modules?select=code,title,level,credits,department&' + filt + (state.ug ? '&level=lte.6' : '') + '&order=level.asc,code.asc&limit=40').then(function (rows) {
        if (seq !== searchSeq) return;
        state.results = rows || []; renderList();
      }).catch(function () { if (seq === searchSeq) { state.results = null; renderList(); } });
    }, 180);
  }
  function loadQuestions() {
    var code = state.mod.code;
    rest('module_questions?code=eq.' + code + '&select=id,topic,kind,question,guide,position&order=position.asc').then(function (rows) {
      if (!state.mod || state.mod.code !== code) return;
      state.questions = rows || [];
      var r = routeParams();
      if (r.v === 'answer' && r.q && r.q !== 'own' && !state.cur) route(); else render();
      if (state.questions.length) loadModelAnswers();
    }).catch(function () { state.questions = []; render(); });
  }
  var modelAnswers = {};
  function loadModelAnswers() {
    var ids = state.questions.map(function (q) { return q.id; });
    if (!ids.length) return;
    rest('model_answers?question_id=in.(' + ids.join(',') + ')&select=question_id,author_name,author_mark,author_role,answer,checked_by').then(function (rows) {
      (rows || []).forEach(function (a) { modelAnswers[a.question_id] = a; }); render();
    }).catch(function () {});
  }
  function loadAttempts() {
    if (!getSession()) { state.attempts = []; return; }
    var code = state.mod.code;
    rest('mark_attempts?code=eq.' + code + '&select=id,question,question_id,result,real_mark,created_at,minutes&order=created_at.desc&limit=50', { auth: true }).then(function (rows) {
      if (state.mod && state.mod.code === code) { state.attempts = rows || []; render(); }
    }).catch(function () { state.attempts = []; });
  }
  function getQuestions() {
    if (!getSession()) { location.href = signinUrl(); return; }
    state.qsBusy = true; state.err = ''; render();
    track('mark_questions');
    marker({ action: 'questions', code: state.mod.code }).then(function (b) {
      state.qsBusy = false; state.questions = b.questions || []; render(); loadModelAnswers();
    }).catch(function (e) {
      state.qsBusy = false;
      if (e.signin) { location.href = signinUrl(); return; }
      state.err = e.message; render();
    });
  }

  // ---------- timer ----------
  var timer = { on: false, start: 0, id: null, limit: 45 };
  function startTimer() { timer.on = true; timer.start = Date.now(); clearInterval(timer.id); timer.id = setInterval(tick, 1000); tick(); }
  function stopTimer() { clearInterval(timer.id); timer.id = null; }
  function elapsedMin() { return timer.on ? Math.max(1, Math.round((Date.now() - timer.start) / 60000)) : null; }
  function tick() {
    var el = document.getElementById('mk-clock'); if (!el) return;
    var s = Math.floor((Date.now() - timer.start) / 1000), left = timer.limit * 60 - s;
    var fmt = function (n) { n = Math.abs(n); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };
    el.textContent = left >= 0 ? fmt(left) + ' left' : fmt(left) + ' over';
    el.classList.toggle('over', left < 0);
  }

  // ---------- marking ----------
  function submit() {
    var qEl = document.getElementById('mk-qtext'), aEl = document.getElementById('mk-answer'), ok = document.getElementById('mk-practice');
    var question = state.cur.own ? (qEl ? qEl.value.trim() : '') : state.cur.question;
    var answer = aEl ? aEl.value : '';
    state.err = '';
    if (state.cur.own && question.length < 10) { state.err = 'Paste the question you’re answering first.'; render(); return; }
    if (words(answer) < 40) { state.err = 'Write at least a paragraph or two so there’s something to mark.'; render(); return; }
    if (!ok || !ok.checked) { state.err = 'Tick the box to confirm this is exam practice.'; render(); return; }
    if (!getSession()) { location.href = signinUrl(); return; }
    if (state.cur.own) state.cur.question = question;
    state.busy = true; render();
    track('mark_submit');
    marker({ action: 'mark', code: state.mod.code, question: question, question_id: state.cur.id, answer: answer, minutes: elapsedMin(), practice: true }).then(function (b) {
      state.busy = false; stopTimer(); timer.on = false;
      if (b.refused) { state.err = b.message; render(); return; }
      state.result = b; state.result.question = question; state.result.answer = answer;
      track('mark_done');
      loadAttempts();
      go({ m: state.mod.code, q: state.cur.id || 'own', v: 'result' });
    }).catch(function (e) {
      state.busy = false;
      if (e.signin) { location.href = signinUrl(); return; }
      state.err = e.message; state.upgrade = e.upgrade; render();
    });
  }
  function saveReal(id) {
    var el = document.getElementById('mk-real'), v = el ? parseInt(el.value, 10) : NaN;
    if (!(v >= 0 && v <= 100)) return;
    rest('mark_attempts?id=eq.' + id, { method: 'PATCH', auth: true, body: { real_mark: v }, prefer: 'return=minimal' }).then(function () {
      var n = document.getElementById('mk-real-done'); if (n) n.textContent = 'Thanks. This helps us check the marker is accurate.';
      track('mark_realmark');
    }).catch(function () {});
  }
  function deleteAttempt(id) {
    if (!confirm('Delete this marked answer?')) return;
    rest('mark_attempts?id=eq.' + id, { method: 'DELETE', auth: true, prefer: 'return=minimal' }).then(loadAttempts).catch(function () {});
  }

  // ---------- views ----------
  function head() {
    return '<div class="mk-crumbs"><a href="/mark" data-go="home">UCL modules</a>' + (state.mod && state.mod.title ? ' <span>›</span> <a href="/modules/' + state.mod.code + '" data-go="mod">' + esc(state.mod.code) + '</a>' : '') + '</div>';
  }
  function viewSearch() {
    return '<section class="mk-hero"><span class="kicker">All ' + '6,682' + ' UCL modules</span><h1>Find your module.</h1>' +
      '<p class="lead">Search by module code, title or department. Pick a practice question, write your answer, and get it marked the way your department marks.</p>' +
      '<div class="mk-search"><input id="mk-q" type="search" autocomplete="off" placeholder="e.g. ECON0013, Contract Law, History" value="' + esc(state.q) + '" aria-label="Search UCL modules">' +
      '<label class="mk-ug"><input type="checkbox" id="mk-ugonly"' + (state.ug ? ' checked' : '') + '> Undergraduate only</label></div>' +
      '<div id="mk-list" aria-live="polite"></div></section>';
  }
  function listHtml() {
    if (state.q.trim().length < 2) return '<p class="mk-hint">Start typing a module code (like <b>HIST0003</b>), a title or a department.</p>';
    if (state.results === null) return '<p class="mk-err">Couldn’t search just now. Try again.</p>';
    if (!state.results.length) return '<p class="mk-hint">No UCL modules match that. Try the module code from your timetable or Moodle.</p>';
    return '<ul class="mk-results">' + state.results.map(function (m) {
      return '<li><a href="/modules/' + m.code + '" data-code="' + m.code + '"><span class="mk-code">' + esc(m.code) + '</span><span class="mk-title">' + esc(m.title) + '</span><span class="mk-meta">' + esc(m.department || '') + ' · ' + esc(levelName(m.level)) + (m.credits ? ' · ' + m.credits + ' credits' : '') + '</span></a></li>';
    }).join('') + '</ul>';
  }
  function viewModule() {
    var m = state.mod;
    if (m.missing) return head() + '<section class="mk-card"><h1>Module not found</h1><p>We couldn’t find <b>' + esc(m.code) + '</b> in UCL’s module catalogue. Check the code and <a href="/mark">search again</a>.</p></section>';
    if (m.loading) return head() + '<section class="mk-card"><p class="mk-hint">Loading module…</p></section>';
    var qs = state.questions, html = head();
    html += '<section class="mk-modhead"><span class="mk-code big">' + esc(m.code) + '</span><h1>' + esc(m.title) + '</h1>' +
      '<p class="mk-meta">' + esc(m.department || '') + ' · ' + esc(levelName(m.level)) + (m.credits ? ' · ' + m.credits + ' credits' : '') + (m.term ? ' · ' + esc(m.term) : '') + '</p>' +
      (m.summary ? '<p class="mk-sum">' + esc(m.summary.replace(/\.\.\.$/, '…')) + ' <a href="' + esc(m.url) + '" target="_blank" rel="noopener">Full description on UCL’s catalogue</a></p>' : '') + '</section>';
    html += '<section class="mk-card"><div class="mk-row"><h2>Practice questions</h2><button type="button" class="btn line small" data-act="own">Use my own past-paper question</button></div>';
    if (qs === null) html += '<p class="mk-hint">Loading…</p>';
    else if (!qs.length) {
      html += '<p>No practice questions for this module yet. We’ll write 6 exam-style questions from the module’s official description, in the style your department examines. They’re saved for everyone taking ' + esc(m.code) + '.</p>' +
        (state.qsBusy ? '<p class="mk-busy"><span class="spin"></span>Writing questions for ' + esc(m.code) + '. This takes about a minute…</p>' : '<button type="button" class="btn primary" data-act="genq">' + (getSession() ? 'Write practice questions' : 'Sign up free to get questions') + '</button>');
    } else {
      html += '<ol class="mk-qs">' + qs.map(function (q) {
        var ma = modelAnswers[q.id];
        return '<li><div><span class="mk-topic">' + esc(q.topic || '') + (q.kind ? ' · ' + (q.kind === 'problem' ? 'Problem' : q.kind === 'short' ? 'Short answers' : 'Essay') : '') + (ma ? ' · <b class="mk-badge">First-class model answer</b>' : '') + '</span><p>' + esc(q.question) + '</p></div><button type="button" class="btn dark small" data-q="' + q.id + '">Answer this</button></li>';
      }).join('') + '</ol><p class="mk-fine">Exam-style questions written for revision from the module’s public description. They are not taken from UCL exam papers.</p>';
    }
    html += '</section>';
    html += attemptsHtml();
    return html;
  }
  function attemptsHtml() {
    var a = state.attempts;
    if (!a || !a.length) return '';
    var pts = a.slice().reverse().map(function (x) { var r = x.result || {}; return (r.mark_low + r.mark_high) / 2; });
    var spark = '';
    if (pts.length > 1) {
      var w = 240, h = 54, min = 30, max = 85, step = w / (pts.length - 1);
      var y = function (v) { return h - 4 - (Math.max(min, Math.min(max, v)) - min) / (max - min) * (h - 8); };
      spark = '<svg class="mk-spark" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Your marks over time"><line x1="0" x2="' + w + '" y1="' + y(70) + '" y2="' + y(70) + '" class="l70"/><line x1="0" x2="' + w + '" y1="' + y(60) + '" y2="' + y(60) + '" class="l60"/><polyline points="' + pts.map(function (v, i) { return (i * step).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ') + '"/></svg>';
    }
    return '<section class="mk-card"><div class="mk-row"><h2>Your marked answers</h2>' + spark + '</div><ul class="mk-hist">' + a.map(function (x) {
      var r = x.result || {};
      return '<li><span class="mk-cls ' + clsSlug(r.class) + '">' + esc(r.class || '?') + '</span><span class="mk-hq">' + esc(String(x.question).slice(0, 140)) + (String(x.question).length > 140 ? '…' : '') + '</span><span class="mk-hm">' + (r.mark_low != null ? r.mark_low + '–' + r.mark_high : '') + ' · ' + new Date(x.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</span><button type="button" class="mk-x" data-del="' + x.id + '" aria-label="Delete this marked answer">×</button></li>';
    }).join('') + '</ul></section>';
  }
  function viewAnswer() {
    var m = state.mod, c = state.cur, d = drafts()[draftKey()];
    var html = head() + '<section class="mk-card mk-answer"><span class="mk-topic">' + esc(m.code) + ' · ' + esc(m.title) + '</span>';
    if (c.own) html += '<label class="mk-lab" for="mk-qtext">The question (paste it from your past paper or reading list)</label><textarea id="mk-qtext" rows="3" placeholder="Paste the exam question here">' + esc(c.question || '') + '</textarea>';
    else html += '<h2 class="mk-question">' + esc(c.question) + '</h2>';
    html += '<div class="mk-tools">' + (timer.on ? '<span id="mk-clock" class="mk-clock"></span>' : '<button type="button" class="btn line small" data-act="timer">Start a 45-minute exam timer</button>') + '<span class="mk-wc" id="mk-wc">' + words(d && d.t) + ' words</span></div>' +
      '<label class="mk-lab" for="mk-answer">Your answer</label><textarea id="mk-answer" rows="18" placeholder="Write your answer as you would in the exam. Plan first if you like.">' + esc(d ? d.t : '') + '</textarea>' +
      '<label class="mk-check"><input type="checkbox" id="mk-practice"> This is exam practice, not coursework I’m going to submit.</label>' +
      (state.err ? '<p class="mk-err">' + esc(state.err) + (state.upgrade ? ' <a href="/pricing">See Pro</a>' : '') + '</p>' : '') +
      '<div class="mk-row end">' + (d ? '<button type="button" class="mk-clear" data-act="clear">× Clear my answer</button>' : '<span></span>') +
      (state.busy ? '<p class="mk-busy"><span class="spin"></span>Marking against UCL’s criteria… about 30 seconds</p>' : '<button type="button" class="btn primary big" data-act="submit">' + (getSession() ? 'Mark my answer' : 'Sign up free to get it marked') + '</button>') + '</div>' +
      '<p class="mk-fine">Your draft is saved on this device as you type. Marked answers are saved to your account, and only you can see them.</p></section>';
    return html;
  }
  function viewResult() {
    var r = state.result, m = state.mod, ma = state.cur && state.cur.id ? modelAnswers[state.cur.id] : null, q = state.cur && state.cur.id ? (state.questions || []).filter(function (x) { return x.id === state.cur.id; })[0] : null;
    var html = head() + '<section class="mk-card mk-result"><div class="mk-verdict ' + clsSlug(r.class) + '"><span class="mk-cls big ' + clsSlug(r.class) + '">' + esc(r.class) + '</span><div><b>' + r.mark_low + '–' + r.mark_high + '</b><span>predicted mark range</span></div></div>' +
      '<p class="mk-headline">' + esc(r.headline) + '</p>' +
      '<p class="mk-fine">Marked against ' + (r.rubric && r.rubric !== 'UCL-wide' ? 'the published grade descriptors of UCL ' + esc(r.rubric) + ' and ' : '') + 'UCL’s grade bands for ' + esc(levelName(m.level)) + '. A practice estimate, not an official mark.</p>';
    if (r.criteria && r.criteria.length) html += '<h3>Criterion by criterion</h3><ul class="mk-crit">' + r.criteria.map(function (c) { return '<li><span class="mk-cls ' + clsSlug(c.band) + '">' + esc(c.band || '–') + '</span><div><b>' + esc(c.name) + '</b><p>' + esc(c.comment) + '</p></div></li>'; }).join('') + '</ul>';
    if (r.strengths && r.strengths.length) html += '<h3>What’s working</h3><ul class="mk-plain">' + r.strengths.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    if (r.changes && r.changes.length) html += '<h3>3 changes to move up a class</h3><ol class="mk-changes">' + r.changes.map(function (c) { return '<li><b>' + esc(c.change) + '</b>' + (c.why ? '<span>' + esc(c.why) + '</span>' : '') + '</li>'; }).join('') + '</ol>';
    html += '<div class="mk-row"><button type="button" class="btn primary" data-act="rewrite">Rewrite and resubmit</button><a class="btn line small" href="/modules/' + m.code + '" data-go="mod">Try another question</a></div></section>';
    if (ma) html += '<section class="mk-card"><h2>First-class model answer</h2><p class="mk-author">Written by ' + esc(ma.author_name) + (ma.author_role ? ', ' + esc(ma.author_role) : '') + (ma.author_mark ? ', who scored ' + ma.author_mark + ' in this module' : '') + (ma.checked_by ? '. Checked by ' + esc(ma.checked_by) : '') + '.</p><div class="mk-prose">' + paras(ma.answer) + '</div></section>';
    if (r.example_answer) html += '<details class="mk-card mk-example"' + (ma ? '' : ' open') + '><summary><h2>Example First-class answer</h2><span>Written by your tutor for this question, for comparison. Not from a UCL paper.</span></summary><div class="mk-prose">' + paras(r.example_answer) + '</div></details>';
    if (q && q.guide) html += '<details class="mk-card"><summary><h2>Marking guide for this question</h2></summary><dl class="mk-guide"><dt>First</dt><dd>' + esc(q.guide.first) + '</dd><dt>2:1</dt><dd>' + esc(q.guide.two_one) + '</dd><dt>2:2</dt><dd>' + esc(q.guide.two_two) + '</dd></dl></details>';
    if (r.id) html += '<section class="mk-card mk-realbox"><h3>Got a real mark for a similar answer?</h3><p>Tell us and we’ll use it to check the marker stays accurate for ' + esc(m.code) + '.</p><div class="mk-row start"><input id="mk-real" type="number" min="0" max="100" inputmode="numeric" placeholder="e.g. 64" aria-label="Your real mark"><button type="button" class="btn line small" data-real="' + r.id + '">Save</button></div><p id="mk-real-done" class="mk-fine"></p></section>';
    html += '<details class="mk-card"><summary><h2>Your answer</h2></summary><div class="mk-prose">' + paras(r.answer || '') + '</div></details>';
    return html;
  }

  function render() {
    var r = routeParams(), html;
    if (!state.mod) html = viewSearch();
    else if (r.v === 'answer' && state.cur && !state.mod.loading) html = viewAnswer();
    else if (r.v === 'result' && state.result) html = viewResult();
    else html = viewModule();
    if (state.err && !(r.v === 'answer')) html += '<p class="mk-err">' + esc(state.err) + '</p>';
    var focusId = document.activeElement && document.activeElement.id, selS, selE;
    if (focusId && document.activeElement.selectionStart != null) { selS = document.activeElement.selectionStart; selE = document.activeElement.selectionEnd; }
    root.innerHTML = html;
    if (!state.mod) renderList();
    if (focusId) { var el = document.getElementById(focusId); if (el) { el.focus(); try { if (selS != null) el.setSelectionRange(selS, selE); } catch (e) {} } }
    if (timer.on) tick();
  }
  function renderList() { var el = document.getElementById('mk-list'); if (el) el.innerHTML = listHtml(); }

  // ---------- events ----------
  root.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'mk-q') search(t.value);
    if (t.id === 'mk-answer') { saveDraft(draftKey(), t.value); var wc = document.getElementById('mk-wc'); if (wc) wc.textContent = words(t.value) + ' words'; }
    if (t.id === 'mk-qtext' && state.cur) state.cur.question = t.value;
  });
  root.addEventListener('change', function (e) { if (e.target.id === 'mk-ugonly') { state.ug = e.target.checked; search(state.q); } });
  root.addEventListener('keydown', function (e) { if (e.target.id === 'mk-real' && e.key === 'Enter') { var b = root.querySelector('[data-real]'); if (b) saveReal(b.getAttribute('data-real')); } });
  root.addEventListener('click', function (e) {
    var a = e.target.closest('a,button'); if (!a) return;
    if (a.hasAttribute('data-code')) { e.preventDefault(); go({ m: a.getAttribute('data-code') }); return; }
    if (a.getAttribute('data-go') === 'home') { e.preventDefault(); go({}); return; }
    if (a.getAttribute('data-go') === 'mod') { e.preventDefault(); state.result = null; go({ m: state.mod.code }); return; }
    if (a.hasAttribute('data-q')) { var id = a.getAttribute('data-q'); state.cur = (state.questions || []).filter(function (x) { return x.id === id; })[0]; state.err = ''; go({ m: state.mod.code, q: id, v: 'answer' }); return; }
    if (a.hasAttribute('data-del')) { deleteAttempt(a.getAttribute('data-del')); return; }
    if (a.hasAttribute('data-real')) { saveReal(a.getAttribute('data-real')); return; }
    var act = a.getAttribute('data-act');
    if (act === 'own') { state.cur = { id: null, own: true, question: '' }; state.err = ''; go({ m: state.mod.code, q: 'own', v: 'answer' }); }
    else if (act === 'genq') getQuestions();
    else if (act === 'timer') { startTimer(); render(); }
    else if (act === 'submit') submit();
    else if (act === 'clear') { if (confirm('Clear your answer? This can’t be undone.')) { saveDraft(draftKey(), ''); render(); } }
    else if (act === 'rewrite') { state.err = ''; go({ m: state.mod.code, q: state.cur.id || 'own', v: 'answer' }); }
  });
  window.addEventListener('popstate', route);
  route();
})();
