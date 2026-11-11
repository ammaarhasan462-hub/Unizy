/* The marker: find any UCL or Imperial module, see its Module Map (topics, red/amber/green, mastery), practise at three levels
   (Foundation quick recall, Exam-style, First-class stretch), get answers marked against UCL's grade bands and the
   department's criteria, see exactly where marks were lost, rewrite and re-mark. Progress maths lives in study.js. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG, BRAND = (window.SITE_BRAND || {}).name || 'Unizy';
  var SKEY = 'unizy.session', DKEY = 'mark:drafts', root = document.getElementById('mk');
  if (!root) return;
  var ST = window.UnizyStudy;
  // Base paths: the public marker lives at /mark and /modules/CODE; inside the dashboard it lives under /dashboard/practice.
  var BASE = root.getAttribute('data-base') || '/mark', MBASE = root.getAttribute('data-modbase') || '/modules/';
  var HOOKS = window.MarkHooks || null; // set by the dashboard: my modules, add/remove, exam dates
  // inside the dashboard, answers can include files, photos (e.g. a handwritten answer) and videos: see attach.js
  function tray() { return HOOKS && window.UnizyAttach ? window.UnizyAttach.tray('mk:' + draftKey()) : null; }
  var MODRE = new RegExp('^' + MBASE.replace(/[\/]/g, '\\/') + '([A-Za-z]{2,4}[0-9][0-9A-Za-z]{1,5})\\/?$');
  // universities: UCL modules (4-digit codes) and Imperial modules (5-digit codes) share one catalogue table
  var UNIS = { ucl: { short: 'UCL', poss: 'UCL’s', exam: 'a UCL', src: 'Full description on UCL’s catalogue', cat: 'UCL’s module catalogue' },
    imperial: { short: 'Imperial', poss: 'Imperial’s', exam: 'an Imperial', src: 'Imperial’s programme specification', cat: 'Imperial’s programme specifications' },
    qmul: { short: 'Queen Mary', poss: 'Queen Mary’s', exam: 'a Queen Mary', src: 'Queen Mary’s module directory', cat: 'Queen Mary’s module directory' },
    lse: { short: 'LSE', poss: 'LSE’s', exam: 'an LSE', src: 'the LSE course guide', cat: 'the LSE Calendar’s course guides' } };
  function uniId() { return state.mod && state.mod.uni ? state.mod.uni : HOOKS && HOOKS.uni ? HOOKS.uni() : 'ucl'; }
  function U() { return UNIS[uniId()] || UNIS.ucl; }
  function listUni() { return HOOKS && HOOKS.uni ? HOOKS.uni() : 'ucl'; }
  var state = {
    q: '', ug: true, results: [], mod: null, topics: null, questions: null, mapBusy: false, mapMsg: '', cur: null, result: null,
    attempts: null, recalls: [], ratings: {}, open: {}, shown: {}, steps: {}, itab: 'alloc', rewrite: null, busy: false, err: '',
    tierF: '', wmode: 'study', exam: 0, mono: false, pbusy: false, perr: '', ptext: {}
  };

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function paras(s) { return esc(s).split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function words(s) { var m = String(s || '').trim().match(/\S+/g); return m ? m.length : 0; }
  function getSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function uid() { var s = getSession(); return s && s.user && s.user.id; }
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
        .then(function (r) { return r.ok ? (r.status === 204 || r.status === 201 ? null : r.json()) : Promise.reject(new Error('Couldn’t load that. Check your connection and try again.')); });
    });
  }
  function marker(body) {
    return token().then(function (t) {
      if (!t) { var e = new Error('signin'); e.signin = true; throw e; }
      return fetch(CFG.supabaseUrl + '/functions/v1/marker', { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (b) {
            if (r.ok) { b.status = r.status; return b; }
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
  function tierName(t) { return t === 'first' ? 'First-class stretch' : t === 'foundation' ? 'Quick recall' : 'Exam-style'; }
  function kindName(k) { return k === 'problem' ? 'Problem' : k === 'short' ? 'Short answers' : 'Essay'; }
  function changed() { if (HOOKS && HOOKS.changed) HOOKS.changed(); }
  function studyData() { return { questions: state.questions || [], attempts: state.attempts || [], recalls: state.recalls || [] }; }

  // ---------- routing ----------
  function go(params, replace) {
    var u = new URL(location.href);
    ['m', 'q', 'v', 't', 'exam', 'w'].forEach(function (k) { u.searchParams.delete(k); });
    Object.keys(params || {}).forEach(function (k) { if (params[k] != null && params[k] !== '') u.searchParams.set(k, params[k]); });
    var path = params && params.m ? MBASE + params.m : BASE;
    u.searchParams.delete('m');
    var href = path + (u.search || '');
    if (replace) history.replaceState(null, '', href); else history.pushState(null, '', href);
    route();
  }
  function routeParams() {
    var p = new URLSearchParams(location.search), m = MODRE.exec(location.pathname);
    return { m: m ? m[1].toUpperCase() : (p.get('m') || '').toUpperCase(), q: p.get('q') || '', v: p.get('v') || '', t: p.get('t'), exam: +p.get('exam') || 0, w: p.get('w') || '' };
  }
  function route() {
    var r = routeParams();
    state.err = '';
    if (!r.m) { state.mod = null; render(); setTitle(); return; }
    var after = function () {
      if (r.v === 'answer') {
        if (r.q === 'own') state.cur = { id: null, own: true, question: (state.cur && state.cur.own && state.cur.question) || '' };
        else if (state.questions) state.cur = state.questions.filter(function (x) { return x.id === r.q && x.tier !== 'foundation'; })[0] || null;
        else { render(); return; } // questions still loading; loadMap() routes again
        if (!state.cur) { go({ m: r.m }, true); return; }
        // exam simulator: strict clock from the moment the question opens, no hints until it's marked
        if (r.exam && state.exam !== r.exam) { state.exam = r.exam; timer.limit = Math.min(180, r.exam); startTimer(); track('exam_open'); }
        else if (!r.exam && state.exam) { state.exam = 0; timer.limit = 45; }
        state.itab = 'scheme';
      } else if (r.v !== 'result') { state.cur = null; state.result = null; if (state.exam) { state.exam = 0; stopTimer(); timer.on = false; timer.limit = 45; } }
      if (r.v === 'result' && !state.result) { go({ m: r.m }, true); return; }
      if (!r.v && r.t != null && r.t !== '') { state.open[+r.t] = true; state.wmode = 'study'; }
      if (!r.v && r.w === 'parse') state.wmode = 'parse';
      render(); setTitle();
      var tEl = !r.v && r.t != null && r.t !== '' && document.getElementById('mk-t' + r.t);
      if (tEl) tEl.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
    };
    if (state.mod && state.mod.code === r.m) { after(); return; }
    state.mod = { code: r.m, loading: true }; state.topics = null; state.questions = null; state.attempts = null; state.recalls = []; state.ratings = {}; state.open = {}; state.mapBusy = false; state.mapMsg = ''; stopPoll(); render();
    rest('ucl_modules?code=eq.' + encodeURIComponent(r.m) + '&select=code,title,level,credits,ects,faculty,department,term,summary,url,uni,programmes,year_of_study,mtype,status').then(function (rows) {
      if (!rows || !rows.length) { state.mod = { code: r.m, missing: true }; render(); return; }
      state.mod = rows[0]; loadMap(); loadMine(); after();
    }).catch(function (e) { state.err = e.message; render(); });
  }
  function setTitle() {
    if (HOOKS) return;
    var m = state.mod;
    document.title = m && m.title ? m.code + ' ' + m.title + ' · practice questions and marking · ' + BRAND : 'Find your ' + U().short + ' module · ' + BRAND;
  }

  // ---------- data ----------
  var searchTimer = null, searchSeq = 0;
  function search(q) {
    state.q = q; clearTimeout(searchTimer);
    var term = q.trim();
    if (term.length < 2) { state.results = []; renderList(); return; }
    searchTimer = setTimeout(function () {
      var seq = ++searchSeq, t = term.replace(/[%*,()]/g, ' ').trim();
      var filt = (/^[A-Za-z]{4}\d{0,5}$/.test(t) || /^[A-Za-z]{2,4}\d[0-9A-Za-z]{0,4}$/.test(t)) ? 'code=ilike.' + encodeURIComponent(t.toUpperCase() + '*') : 'or=(title.ilike.*' + encodeURIComponent(t) + '*,code.ilike.*' + encodeURIComponent(t) + '*,department.ilike.*' + encodeURIComponent(t) + '*)';
      rest('ucl_modules?select=code,title,level,credits,ects,department,uni&uni=eq.' + listUni() + '&' + filt + (state.ug ? '&level=lte.6' : '') + '&order=level.asc,code.asc&limit=40').then(function (rows) {
        if (seq !== searchSeq) return;
        state.results = rows || []; renderList();
      }).catch(function () { if (seq === searchSeq) { state.results = null; renderList(); } });
    }, 180);
  }
  // The Module Map: topics + questions (saved for everyone). If a module has none yet, ask the marker to write them and wait.
  function fetchMap(code) {
    return Promise.all([
      rest('module_topics?code=eq.' + code + '&select=position,title,summary&order=position.asc'),
      rest('module_questions?code=eq.' + code + '&select=id,topic,kind,tier,topic_pos,question,answer,guide,steps,position&order=position.asc')
    ]);
  }
  function loadMap() {
    var code = state.mod.code;
    fetchMap(code).then(function (res) {
      if (!state.mod || state.mod.code !== code) return;
      state.topics = res[0] || []; state.questions = res[1] || [];
      var r = routeParams();
      if (r.v === 'answer' && r.q && r.q !== 'own' && !state.cur) route(); else render();
      if (state.questions.length) loadModelAnswers();
      if (!state.topics.length && getSession()) startMap();
    }).catch(function () { state.topics = []; state.questions = []; render(); });
  }
  function startMap() {
    var code = state.mod.code;
    state.mapBusy = true; state.mapMsg = ''; render();
    track('map_start');
    marker({ action: 'questions', code: code }).then(function (b) {
      if (!state.mod || state.mod.code !== code) return;
      if (b.topics && b.topics.length) { state.mapBusy = false; state.topics = b.topics; state.questions = b.questions || []; render(); loadModelAnswers(); return; }
      poll(code, Date.now());
    }).catch(function (e) {
      if (!state.mod || state.mod.code !== code) return;
      state.mapBusy = false; state.mapMsg = e.signin ? '' : e.message; render();
    });
  }
  var pollId = null;
  function stopPoll() { clearTimeout(pollId); pollId = null; }
  function poll(code, t0) {
    stopPoll();
    pollId = setTimeout(function () {
      if (!state.mod || state.mod.code !== code) return;
      fetchMap(code).then(function (res) {
        if (!state.mod || state.mod.code !== code) return;
        if (res[0] && res[0].length) { state.mapBusy = false; state.topics = res[0]; state.questions = res[1] || []; track('map_ready'); render(); loadModelAnswers(); return; }
        if (Date.now() - t0 > 210e3) { state.mapBusy = false; state.mapMsg = 'This is taking longer than usual.'; state.mapRetry = true; render(); return; }
        poll(code, t0);
      }).catch(function () { poll(code, t0); });
    }, 6000);
  }
  var modelAnswers = {};
  function loadModelAnswers() {
    var ids = (state.questions || []).filter(function (q) { return q.tier !== 'foundation'; }).map(function (q) { return q.id; });
    if (!ids.length) return;
    rest('model_answers?question_id=in.(' + ids.join(',') + ')&select=question_id,author_name,author_mark,author_role,answer,checked_by').then(function (rows) {
      (rows || []).forEach(function (a) { modelAnswers[a.question_id] = a; }); render();
    }).catch(function () {});
  }
  // the student's own progress on this module: marked answers, recall results, red/amber/green
  function loadMine() {
    if (!getSession()) { state.attempts = []; return; }
    var code = state.mod.code;
    rest('mark_attempts?code=eq.' + code + '&select=id,question,question_id,topic_pos,tier,prev_id,result,real_mark,created_at,minutes&order=created_at.desc&limit=80', { auth: true }).then(function (rows) {
      if (state.mod && state.mod.code === code) { state.attempts = rows || []; render(); }
    }).catch(function () { state.attempts = []; });
    rest('recall_log?code=eq.' + code + '&select=question_id,topic_pos,got,created_at&order=created_at.desc&limit=400', { auth: true }).then(function (rows) {
      if (state.mod && state.mod.code === code) { state.recalls = rows || []; render(); }
    }).catch(function () {});
    rest('topic_ratings?code=eq.' + code + '&select=topic_pos,rating', { auth: true }).then(function (rows) {
      if (!state.mod || state.mod.code !== code) return;
      state.ratings = {}; (rows || []).forEach(function (r) { state.ratings[r.topic_pos] = r.rating; }); render();
    }).catch(function () {});
  }
  function rate(pos, rating) {
    if (!getSession()) { location.href = signinUrl(); return; }
    var code = state.mod.code, was = state.ratings[pos];
    state.ratings[pos] = rating; render();
    rest('topic_ratings', { method: 'POST', auth: true, prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: uid(), code: code, topic_pos: pos, rating: rating, updated_at: new Date().toISOString() } })
      .then(function () { track('rag_' + rating); changed(); })
      .catch(function () { state.ratings[pos] = was; render(); });
  }
  function recall(qid, got) {
    if (!getSession()) { location.href = signinUrl(); return; }
    var q = (state.questions || []).filter(function (x) { return x.id === qid; })[0]; if (!q) return;
    var code = state.mod.code, row = { question_id: qid, topic_pos: q.topic_pos, got: got, created_at: new Date().toISOString() };
    state.recalls.unshift(row); render();
    rest('recall_log', { method: 'POST', auth: true, prefer: 'return=minimal', body: { user_id: uid(), code: code, topic_pos: q.topic_pos, question_id: qid, got: got } }).catch(function () {});
    track(got ? 'recall_got' : 'recall_miss'); changed();
    // a missed recall question becomes a flashcard in "Due today"
    if (!got && q.answer) rest('review_cards?on_conflict=user_id,code,front', { method: 'POST', auth: true, prefer: 'resolution=ignore-duplicates,return=minimal', body: { user_id: uid(), code: code, topic_pos: q.topic_pos, front: q.question.slice(0, 600), back: q.answer.slice(0, 1200) } }).catch(function () {});
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
    var answer = aEl ? aEl.value : '', t = tray(), hasAtt = !!(t && t.count());
    state.err = '';
    if (state.cur.own && question.length < 10) { state.err = 'Paste the question you’re answering first.'; render(); return; }
    if (hasAtt && t.busy()) { state.err = 'Your attachments are still being prepared. Try again in a moment.'; render(); return; }
    if (!hasAtt && words(answer) < 40) { state.err = 'Write at least a paragraph or two, or add photos of your answer, so there’s something to mark.'; render(); return; }
    if (!ok || !ok.checked) { state.err = 'Tick the box to confirm this is exam practice.'; render(); return; }
    if (!getSession()) { location.href = signinUrl(); return; }
    if (state.cur.own) state.cur.question = question;
    state.busy = true; state.busyAtt = hasAtt; render();
    var rw = state.rewrite && state.rewrite.qkey === draftKey() ? state.rewrite : null;
    track(rw ? 'mark_rewrite' : hasAtt ? 'mark_submit_att' : 'mark_submit');
    var body = { action: 'mark', code: state.mod.code, question: question, question_id: state.cur.id, answer: answer.trim(), minutes: elapsedMin(), practice: true };
    if (rw) body.prev_id = rw.id;
    if (hasAtt) body.attachments = t.payload();
    marker(body).then(function (b) {
      state.busy = false; stopTimer(); timer.on = false;
      if (b.refused) { state.err = b.message; render(); return; }
      state.result = b; state.result.question = question; state.result.answer = b.answer || answer;
      state.rewrite = null; state.itab = 'alloc'; state.exam = 0; timer.limit = 45;
      track('mark_done'); changed();
      loadMine();
      go({ m: state.mod.code, q: state.cur.id || 'own', v: 'result' });
    }).catch(function (e) {
      state.busy = false;
      if (e.signin) { location.href = signinUrl(); return; }
      state.err = e.message; state.upgrade = e.upgrade; render();
    });
  }
  function startRewrite() {
    var r = state.result;
    state.rewrite = { id: r.id, qkey: draftKey(), mark_low: r.mark_low, mark_high: r.mark_high, cls: r.class, quote: r.rewrite && r.rewrite.quote, task: r.rewrite && r.rewrite.task };
    // start from the answer that was just marked, so only the weak paragraph needs rewriting
    var cur = drafts()[draftKey()];
    if ((!cur || !cur.t) && r.answer && !/^\[Attached:/m.test(r.answer)) saveDraft(draftKey(), r.answer);
    state.err = ''; track('rewrite_start');
    go({ m: state.mod.code, q: state.cur.id || 'own', v: 'answer' });
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
    rest('mark_attempts?id=eq.' + id, { method: 'DELETE', auth: true, prefer: 'return=minimal' }).then(loadMine).catch(function () {});
  }

  // ---------- "where you lost marks": find each quoted sentence in the answer and highlight it ----------
  function findQuote(text, quote) {
    var w = String(quote || '').replace(/[“”"‘’'…]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (w.length < 3) return null;
    var tries = [w, w.slice(0, 8), w.slice(-8)];
    for (var i = 0; i < tries.length; i++) {
      if (tries[i].length < 3) continue;
      var re = new RegExp(tries[i].map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('[\\s“”"‘’\'…]+'), 'i');
      var m = re.exec(text);
      if (m && !/\n\s*\n/.test(m[0])) {
        if (i === 0) return [m.index, m.index + m[0].length];
        // only part of the quote matched: extend to the end (or start) of that sentence
        var s = m.index, e = m.index + m[0].length;
        if (i === 1) { var stop = text.slice(e).search(/[.!?](\s|$)|\n/); e = stop < 0 ? text.length : e + stop + 1; }
        else { var back = text.slice(0, s).search(/[^.!?\n]*$/); s = back < 0 ? s : back; }
        return [s, e];
      }
    }
    return null;
  }
  function annotated(text, lost) {
    var ranges = [];
    lost.forEach(function (l, i) { var r = findQuote(text, l.quote); if (r) ranges.push({ s: r[0], e: r[1], n: i + 1 }); l.found = !!r; });
    ranges.sort(function (a, b) { return a.s - b.s; });
    var out = '', at = 0;
    ranges.forEach(function (r) {
      if (r.s < at) return; // overlapping quote: keep the first
      out += esc(text.slice(at, r.s)) + '<mark class="mk-lost" id="mk-lm' + r.n + '" data-lost="' + r.n + '" title="' + esc(lost[r.n - 1].issue) + '"><sup>' + r.n + '</sup>' + esc(text.slice(r.s, r.e)) + '</mark>';
      at = r.e;
    });
    out += esc(text.slice(at));
    return out.split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
  }

  // ---------- views ----------
  function head() {
    return '<div class="mk-crumbs"><a href="' + BASE + '" data-go="home">' + (HOOKS ? 'Practice' : U().short + ' modules') + '</a>' + (state.mod && state.mod.title ? ' <span>›</span> <a href="' + MBASE + state.mod.code + '" data-go="mod">' + esc(state.mod.code) + '</a>' : '') + '</div>';
  }
  function viewSearch() {
    var mine = HOOKS ? HOOKS.myModules() : [];
    var picks = mine.length ? '<div class="mk-mine"><p class="mk-lab">Your modules</p><ul class="mk-results">' + mine.map(function (m) { return '<li><a href="' + MBASE + m.code + '" data-code="' + m.code + '"><span class="mk-code">' + esc(m.code) + '</span><span class="mk-title">' + esc(m.title) + '</span><span class="mk-meta">' + esc(m.department || '') + ' · ' + esc(levelName(m.level)) + '</span></a></li>'; }).join('') + '</ul></div>' : '';
    if (HOOKS) return '<section class="mk-hero dash"><h1>Practice &amp; marking</h1><p class="lead">Pick a module, work through it topic by topic, and get your answers marked against your department’s criteria.</p>' + picks + '<p class="mk-lab">' + (mine.length ? 'Or find another module' : 'Find a module') + '</p><div class="mk-search"><input id="mk-q" type="search" autocomplete="off" placeholder="e.g. ECON0013, Contract Law, History" value="' + esc(state.q) + '" aria-label="Search UCL modules"><label class="mk-ug"><input type="checkbox" id="mk-ugonly"' + (state.ug ? ' checked' : '') + '> Undergraduate only</label></div><div id="mk-list" aria-live="polite"></div></section>';
    return '<section class="mk-hero"><span class="kicker">All ' + '6,682' + ' UCL modules</span><h1>Find your module.</h1>' +
      '<p class="lead">Search by module code, title or department. Work through each topic at three levels, write an answer, and get it marked the way your department marks.</p>' +
      '<div class="mk-search"><input id="mk-q" type="search" autocomplete="off" placeholder="e.g. ECON0013, Contract Law, History" value="' + esc(state.q) + '" aria-label="Search ' + U().short + ' modules">' +
      '<label class="mk-ug"><input type="checkbox" id="mk-ugonly"' + (state.ug ? ' checked' : '') + '> Undergraduate only</label></div>' +
      '<div id="mk-list" aria-live="polite"></div></section>';
  }
  function listHtml() {
    if (state.q.trim().length < 2) return '<p class="mk-hint">Start typing a module code (like <b>HIST0003</b>), a title or a department.</p>';
    if (state.results === null) return '<p class="mk-err">Couldn’t search just now. Try again.</p>';
    if (!state.results.length) return '<p class="mk-hint">No ' + UNIS[listUni()].short + ' modules match that. Try the module code from your timetable' + (listUni() === 'ucl' ? ' or Moodle' : '') + '.</p>';
    return '<ul class="mk-results">' + state.results.map(function (m) {
      return '<li><a href="/modules/' + m.code + '" data-code="' + m.code + '"><span class="mk-code">' + esc(m.code) + '</span><span class="mk-title">' + esc(m.title) + '</span><span class="mk-meta">' + esc(m.department || '') + ' · ' + esc(levelName(m.level)) + (m.credits ? ' · ' + m.credits + ' credits' : m.ects ? ' · ' + m.ects + ' ECTS' : '') + (m.status ? ' · ' + esc(m.status) : '') + '</span></a></li>';
    }).join('') + '</ul>';
  }
  function bar(pct, cls) { return '<span class="mk-bar' + (cls ? ' ' + cls : '') + '" role="img" aria-label="' + pct + '% mastered"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></span>'; }
  function examRow(m) {
    if (!HOOKS || !HOOKS.has(m.code) || !HOOKS.examDate) return '';
    var d = HOOKS.examDate(m.code);
    return '<p class="mk-exam"><label for="mk-exd">Exam date</label><input type="date" id="mk-exd" value="' + esc(d || '') + '">' + (d ? '<b>' + esc(ST.countdown(d)) + '</b>' : '<span>Add it for a countdown on your dashboard</span>') + '</p>';
  }
  function viewModule() {
    var m = state.mod;
    if (m.missing) return head() + '<section class="mk-card"><h1>Module not found</h1><p>We couldn’t find <b>' + esc(m.code) + '</b> in ' + U().cat + '. Check the code and <a href="' + BASE + '" data-go="home">search again</a>.</p></section>';
    if (m.loading) return head() + '<section class="mk-card"><p class="mk-hint">Loading module…</p></section>';
    var html = head();
    var mm = state.topics && state.topics.length ? ST.moduleMastery(state.topics, studyData()) : null, signed = !!getSession();
    html += '<section class="mk-modhead"><span class="mk-code big">' + esc(m.code) + '</span><h1>' + esc(m.title) + '</h1>' +
      '<p class="mk-meta">' + esc(m.department || '') + ' · ' + esc(levelName(m.level)) + (m.uni === 'lse' ? (m.credits == 0.5 ? ' · Half unit' : m.credits == 1 ? ' · Full unit' : '') : m.credits ? ' · ' + m.credits + ' credits' : m.ects ? ' · ' + m.ects + ' ECTS' : '') + (m.term ? ' · ' + esc(m.term) : '') + '</p>' +
      (HOOKS ? '<p class="mk-star"><button type="button" class="btn ' + (HOOKS.has(m.code) ? 'line' : 'dark') + ' small" data-act="star">' + (HOOKS.has(m.code) ? '✓ In my modules' : '+ Add to my modules') + '</button>' + (HOOKS.has(m.code) ? ' <a class="mk-tutorlink" href="/dashboard/tutor?m=' + m.code + '">Ask the tutor about ' + esc(m.code) + ' →</a>' : '') + '</p>' : '') +
      examRow(m) +
      (m.summary || (m.uni && m.uni !== 'ucl') ? '<p class="mk-sum">' + esc((m.summary || (m.programmes && m.programmes.length ? 'Taught on ' + m.programmes.slice(0, 3).join(', ') + (m.programmes.length > 3 ? ' and ' + (m.programmes.length - 3) + ' more' : '') + '.' : '')).replace(/\.\.\.$/, '…')) + (m.url ? ' <a href="' + esc(m.url) + '" target="_blank" rel="noopener">' + U().src + '</a>' : '') + '</p>' : '') + '</section>';
    if (HOOKS && signed) html += '<div class="mk-wmode" role="tablist" aria-label="Workspace mode">' + [['study', 'Study mode', 'Structured topics and practice'], ['parse', 'Parse mode', 'Drop slides, transcripts or notes']].map(function (w) { return '<button type="button" role="tab" data-wmode="' + w[0] + '" aria-selected="' + (state.wmode === w[0]) + '"><b>' + w[1] + '</b><span>' + w[2] + '</span></button>'; }).join('') + '</div>';
    if (HOOKS && signed && state.wmode === 'parse') return html + parseHtml();
    if (mm && signed) html += '<section class="mk-mastery"><div><b>' + mm.pct + '%</b><span>mastered</span></div>' + bar(mm.pct, 'big') + '<p>' + mm.started + ' of ' + mm.total + ' topics started. Mastery grows with quick recall and marked answers; a First on the First-class questions takes a topic to 100%.</p></section>';
    if (HOOKS && signed) html += unitsHtml(true);
    html += mapHtml();
    html += attemptsHtml();
    return html;
  }
  function mapHtml() {
    var m = state.mod, topics = state.topics, qs = state.questions || [], signed = !!getSession();
    var own = '<div class="mk-own"><div><b>Got a past-paper question?</b><span>Paste any question from ' + U().exam + ' past paper or problem sheet and get your answer marked.</span></div><button type="button" class="btn line small" data-act="own">Use my own question</button></div>';
    var html = '<section class="mk-card mk-map"><div class="mk-row"><h2>Module Map</h2>' + (topics && topics.length && signed ? '<span class="mk-legend"><i class="r"></i>Not confident <i class="a"></i>Getting there <i class="g"></i>Confident</span>' : '') + '</div>';
    if (topics === null) return html + '<p class="mk-hint">Loading…</p></section>';
    if (!topics.length) {
      if (state.mapBusy) html += '<div class="mk-writing"><span class="spin"></span><div><b>Writing the Module Map for ' + esc(m.code) + '</b><p>Topics in teaching order, each with quick-recall, exam-style and First-class questions. This takes about a minute and is saved for everyone taking ' + esc(m.code) + '. You can paste your own question below in the meantime.</p></div></div>';
      else if (!signed) html += '<p>Sign up free and we’ll set out ' + esc(m.code) + ' topic by topic, with practice questions at three levels: quick recall, exam-style and First-class.</p><a class="btn primary" href="' + esc(signinUrl()) + '">Sign up free to see the questions</a>';
      else html += '<p>' + esc(state.mapMsg || 'The questions for this module aren’t ready yet.') + '</p><button type="button" class="btn primary" data-act="genq">' + (state.mapRetry ? 'Try again' : 'Write the practice questions') + '</button>';
      // older modules may still have a few questions without topics
      var loose0 = qs.filter(function (q) { return q.topic_pos == null && q.tier !== 'foundation'; });
      if (loose0.length) html += '<h3>Practice questions</h3>' + qList(loose0);
      return html + own + '</section>';
    }
    var d = studyData(), tf = state.tierF; d.qById = ST.index(qs);
    html += '<div class="mk-tiers" role="tablist" aria-label="Filter questions by level">' + TIERS.map(function (x) {
      var n = qs.filter(function (q) { return q.topic_pos != null && (!x[0] || q.tier === x[0]); }).length;
      return '<button type="button" role="tab" data-tierf="' + x[0] + '" aria-selected="' + (tf === x[0]) + '" class="t-' + (x[0] || 'all') + '"><b>' + x[1] + '</b><span>' + x[2] + ' · ' + n + '</span></button>';
    }).join('') + '</div>';
    html += '<ol class="mk-topics' + (tf ? ' tf' : '') + '">' + topics.map(function (t) {
      var pos = t.position, open = !!state.open[pos], ms = ST.topicMastery(pos, d), rg = state.ratings[pos];
      var tq = qs.filter(function (q) { return q.topic_pos === pos; }), rs = signed ? ST.ragStatus(ms, rg) : '';
      var warn = signed && rg === 'g' && ms.started && ms.pct < 50 ? '<p class="mk-warn">You rated this green, but you’re at ' + ms.pct + '%. Try the exam-style question to check.</p>' : signed && rg === 'r' && ms.pct >= 70 ? '<p class="mk-good">You rated this red, but you’re at ' + ms.pct + '%. You know more than you think.</p>' : '';
      var top = '<div class="mk-thead"><button type="button" class="mk-ttog" data-topic="' + pos + '" aria-expanded="' + open + '"><span class="mk-tnum">' + (pos + 1) + '</span><span class="mk-ttl"><b>' + esc(t.title) + '</b>' + (t.summary ? '<span>' + esc(t.summary) + '</span>' : '') + '</span><span class="mk-tpct">' + (signed ? (ms.started ? ms.pct + '%' : 'Not started') : tq.length + ' questions') + (signed ? bar(ms.pct) : '') + '</span><span class="mk-chev" aria-hidden="true"></span></button>' +
        (signed ? '<div class="mk-rag" role="group" aria-label="How confident are you on ' + esc(t.title) + '?">' + ['r', 'a', 'g'].map(function (k) { return '<button type="button" class="' + k + (rg === k ? ' on' : '') + '" data-rag="' + k + '" data-pos="' + pos + '" aria-pressed="' + (rg === k) + '" title="' + ST.RAG[k] + '"><span class="sr">' + ST.RAG[k] + '</span></button>'; }).join('') + '</div>' : '') + '</div>';
      var body = '';
      if (open) {
        var rec = tq.filter(function (q) { return q.tier === 'foundation' && (!tf || tf === 'foundation'); }), ex = tq.filter(function (q) { return q.tier === 'exam' && (!tf || tf === 'exam'); }), fc = tq.filter(function (q) { return q.tier === 'first' && (!tf || tf === 'first'); });
        body = '<div class="mk-tbody">' + warn +
          (rec.length ? '<div class="mk-tier"><h4><span class="mk-tag f">Foundation</span> Quick recall <small>Check yourself, then say how you did. Misses become flashcards.</small></h4><ul class="mk-recall">' + rec.map(recallItem).join('') + '</ul></div>' : '') +
          (ex.length ? '<div class="mk-tier"><h4><span class="mk-tag e">Exam-style</span> Answer under exam conditions <small>Marked against your department’s criteria.</small></h4>' + qList(ex) + '</div>' : '') +
          (fc.length ? '<div class="mk-tier"><h4><span class="mk-tag x">First-Class</span> Stretch question <small>Links topics, weighs arguments or pushes the hard case. This is where 70+ comes from.</small></h4>' + qList(fc) + '</div>' : '') +
          (!rec.length && !ex.length && !fc.length ? '<p class="mk-hint">No ' + esc(tierName(tf)) + ' questions in this topic.</p>' : '') +
          '</div>';
      } else if (warn) body = '<div class="mk-tbody slim">' + warn + '</div>';
      return '<li class="mk-tp' + (open ? ' open' : '') + (rg ? ' rg-' + rg : '') + '" id="mk-t' + pos + '"' + (signed ? ' data-rs="' + rs + '"' : '') + '>' + top + body + '</li>';
    }).join('') + '</ol>';
    var loose = qs.filter(function (q) { return q.topic_pos == null && q.tier !== 'foundation'; });
    if (loose.length) html += '<details class="mk-more"><summary>More practice questions (' + loose.length + ')</summary>' + qList(loose) + '</details>';
    html += own + '<p class="mk-fine">Questions are written for revision from the module’s public description, in the style your department examines. They are not taken from ' + U().short + ' exam papers.</p></section>';
    return html;
  }
  // Tiered practice: the three levels as grade targets
  var TIERS = [['', 'All levels', 'Every question'], ['foundation', 'Pass (50%)', 'Quick recall'], ['exam', 'Merit (60%)', 'Exam-style'], ['first', '1st Class (70%+)', 'Stretch']];

  // ---------- Parse mode: lecture slides, transcripts or notes → micro-units with flashcards ----------
  var UKEY = 'unizy:units:';
  function unitsGet(code) { try { return JSON.parse(localStorage.getItem(UKEY + code) || 'null'); } catch (e) { return null; } }
  function unitsSet(code, v) { try { if (v) localStorage.setItem(UKEY + code, JSON.stringify(v)); else localStorage.removeItem(UKEY + code); } catch (e) {} }
  function ptray() { return window.UnizyAttach ? window.UnizyAttach.tray('parse:' + state.mod.code) : null; }
  function parseHtml() {
    var m = state.mod, t = ptray();
    var html = '<section class="mk-card mk-parse"><div class="mk-row"><h2>Turn your material into study units</h2></div><p class="mk-sub">Drop lecture slides, a Moodle transcript or your raw notes for ' + esc(m.code) + '. You get short study units with the key points, and flashcards you can add to your ' + esc(m.code) + ' deck in one click.</p>' +
      '<div class="mk-drop"><div class="mk-dropin"><span class="mk-dropic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg></span><b>Drag &amp; drop slides, transcripts or notes</b><span>PDF, Word, text or photos of slides</span></div>' + (t ? t.html() : '') +
      '<label class="mk-lab" for="mk-ptext">…or paste text</label><textarea id="mk-ptext" rows="6" placeholder="Paste a lecture transcript, your notes or the text of the slides">' + esc(state.ptext[m.code] || '') + '</textarea></div>' +
      (state.perr ? '<p class="mk-err">' + state.perr + '</p>' : '') +
      '<div class="mk-row end"><span class="mk-fine">Counts as one tutor question (more for long PDFs). Your units stay on this device until you remove them.</span>' + (state.pbusy ? '<p class="mk-busy"><span class="spin"></span>Reading your material… about 30 seconds</p>' : '<button type="button" class="btn primary td-go" data-act="parse">Make study units<span class="arr" aria-hidden="true">→</span></button>') + '</div></section>';
    return html + unitsHtml(false);
  }
  function unitsHtml(compact) {
    var u = unitsGet(state.mod.code);
    if (!u || !u.units || !u.units.length) return '';
    var cards = 0, added = 0; u.units.forEach(function (x) { cards += (x.cards || []).length; if (x.added) added += (x.cards || []).length; });
    var body = '<ol class="mk-units">' + u.units.map(function (x, i) {
      return '<li><span class="mk-tnum">' + (i + 1) + '</span><div><b>' + esc(x.title) + '</b>' + (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') + (x.points && x.points.length ? '<ul>' + x.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
        (x.cards && x.cards.length ? '<details class="mk-ucards"><summary>' + x.cards.length + ' flashcard' + (x.cards.length === 1 ? '' : 's') + (x.added ? ' · in your deck' : '') + '</summary><ul>' + x.cards.map(function (c) { return '<li><b>' + esc(c.front) + '</b><span>' + esc(c.back) + '</span></li>'; }).join('') + '</ul></details>' : '') + '</div></li>';
    }).join('') + '</ol>';
    var act = '<div class="mk-row start">' + (added < cards ? '<button type="button" class="btn dark small" data-act="ucards">Add ' + (cards - added) + ' flashcards to my ' + esc(state.mod.code) + ' deck</button>' : '<a class="btn line small" href="/dashboard/cards?m=' + state.mod.code + '">✓ In your deck · review them</a>') + '<button type="button" class="mk-clear" data-act="uclear">× Remove these units</button></div>';
    if (compact) return '<details class="mk-card mk-unitsbox"><summary><h2>Your parsed notes</h2><span>' + u.units.length + ' study units' + (u.source ? ' from ' + esc(u.source) : '') + '</span></summary>' + body + act + '</details>';
    return '<section class="mk-card"><div class="mk-row"><h2>' + u.units.length + ' study units</h2><span class="mk-fine">' + (u.source ? 'From ' + esc(u.source) : '') + '</span></div>' + body + act + '</section>';
  }
  function parseJsonText(t) {
    t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (e) {}
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    return null;
  }
  function runParse() {
    var m = state.mod, t = ptray(), text = (state.ptext[m.code] || '').trim(), hasAtt = !!(t && t.count());
    state.perr = '';
    if (!hasAtt && text.split(/\s+/).length < 40) { state.perr = 'Add some slides or notes first (a few paragraphs at least).'; render(); return; }
    if (hasAtt && t.busy()) { state.perr = 'Your files are still being prepared. Try again in a moment.'; render(); return; }
    if (text.length > 60000) text = text.slice(0, 60000);
    var source = hasAtt ? t.summary() : 'pasted notes';
    var prompt = 'Turn this lecture material for ' + m.code + ' ' + (m.title || '') + ' (' + U().short + ', ' + (m.department || '') + ') into structured revision micro-units for a student.\n\n' +
      (text ? '<material>\n' + text + '\n</material>\n\n' : '') + (hasAtt ? 'The material is ' + (text ? 'also ' : '') + 'in the attached files.\n\n' : '') +
      'Rules:\n- 4 to 10 units, in the order the material teaches them. Each unit covers one idea, model, case, method or argument.\n- "title" under 8 words. "summary" one sentence under 30 words. "points" = 3 to 6 key points the student must know, each under 25 words, exam-useful (definitions, mechanisms, conditions, key evidence, common confusions).\n- "cards" = 2 or 3 flashcards per unit: "front" a short question (under 20 words), "back" the answer (under 40 words).\n- Use what is in the material, plus only well-established facts needed to make it clear. Never invent cases, studies, statistics or quotations.\n- If the material is not study material, return {"units": []}.\n\nReturn one JSON object: {"units": [{"title": "...", "summary": "...", "points": ["..."], "cards": [{"front": "...", "back": "..."}]}]}';
    state.pbusy = true; render(); track('parse_start');
    token().then(function (tk) {
      if (!tk) { var e = new Error('signin'); e.signin = true; throw e; }
      return fetch(CFG.supabaseUrl + '/functions/v1/ai', { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ input: prompt, kind: 'notes', json: true, cache: false, stream: false, attachments: hasAtt ? t.payload() : undefined }) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) { var e = new Error(b.message || 'That didn’t work. Try again.'); e.upgrade = !!b.upgrade; throw e; } return b; });
    }).then(function (b) {
      state.pbusy = false;
      var out = parseJsonText(b.text), units = out && Array.isArray(out.units) ? out.units : null;
      if (!units) { state.perr = 'We couldn’t read the result. Try again.'; render(); return; }
      units = units.filter(function (x) { return x && x.title; }).slice(0, 12).map(function (x) {
        return { title: String(x.title).slice(0, 120), summary: String(x.summary || '').slice(0, 300), points: (Array.isArray(x.points) ? x.points : []).slice(0, 8).map(function (p) { return String(p).slice(0, 300); }),
          cards: (Array.isArray(x.cards) ? x.cards : []).filter(function (c) { return c && c.front && c.back; }).slice(0, 4).map(function (c) { return { front: String(c.front).slice(0, 300), back: String(c.back).slice(0, 600) }; }) };
      });
      if (!units.length) { state.perr = 'That doesn’t look like lecture material. Try your slides or notes.'; render(); return; }
      unitsSet(m.code, { at: Date.now(), source: source, units: units });
      if (t) t.clear(); state.ptext[m.code] = '';
      track('parse_done'); render();
    }).catch(function (e) {
      state.pbusy = false;
      if (e.signin) { location.href = signinUrl(); return; }
      state.perr = esc(e.message) + (e.upgrade ? ' <a href="/pricing">See Pro</a>' : ''); render();
    });
  }
  function addUnitCards() {
    var m = state.mod, u = unitsGet(m.code); if (!u) return;
    var rows = []; u.units.forEach(function (x) { if (!x.added) (x.cards || []).forEach(function (c) { rows.push({ user_id: uid(), code: m.code, topic_pos: null, front: c.front, back: c.back }); }); });
    if (!rows.length) return;
    rest('review_cards?on_conflict=user_id,code,front', { method: 'POST', auth: true, prefer: 'resolution=ignore-duplicates,return=minimal', body: rows }).then(function () {
      u.units.forEach(function (x) { x.added = true; }); unitsSet(m.code, u); track('parse_cards'); changed(); render();
    }).catch(function (e) { state.perr = esc(e.message); render(); });
  }

  function recallItem(q) {
    var shown = !!state.shown[q.id], last = (state.recalls || []).filter(function (r) { return r.question_id === q.id; })[0];
    return '<li><p class="mk-rq">' + esc(q.question) + (last ? ' <span class="mk-rlast ' + (last.got ? 'ok' : 'no') + '">' + (last.got ? '✓ Got it' : '✗ Not yet') + '</span>' : '') + '</p>' +
      (shown ? '<div class="mk-ra"><p>' + esc(q.answer || '') + '</p><div class="mk-row start"><span class="mk-rhow">How did you do?</span><button type="button" class="btn dark small" data-recall="' + q.id + '" data-got="1">Got it</button><button type="button" class="btn line small" data-recall="' + q.id + '" data-got="0">Not yet</button></div></div>'
        : '<button type="button" class="mk-reveal" data-show="' + q.id + '">Show answer</button>') + '</li>';
  }
  function qList(list) {
    return '<ol class="mk-qs">' + list.map(function (q) {
      var ma = modelAnswers[q.id], mine = (state.attempts || []).filter(function (a) { return a.question_id === q.id; })[0];
      return '<li><div><span class="mk-topic">' + esc(kindName(q.kind)) + (q.steps && q.steps.length ? ' · step-by-step help' : '') + (ma ? ' · <b class="mk-badge">First-class model answer</b>' : '') + (mine && mine.result ? ' · your best so far <span class="mk-cls ' + clsSlug(mine.result.class) + '">' + esc(mine.result.class) + '</span>' : '') + '</span><p>' + esc(q.question) + '</p></div><button type="button" class="btn dark small" data-q="' + q.id + '">' + (mine ? 'Try again' : 'Answer this') + '</button></li>';
    }).join('') + '</ol>';
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
  // ---------- maths / code formatting toolbar for the answer box ----------
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ', t: 'ᵗ', k: 'ᵏ', a: 'ᵃ', b: 'ᵇ', T: 'ᵀ' };
  var SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', t: 'ₜ', i: 'ᵢ', n: 'ₙ', x: 'ₓ', k: 'ₖ', a: 'ₐ', e: 'ₑ', j: 'ⱼ' };
  var FMT = [
    ['Maths', [['sup', 'xⁿ', 'Superscript (select text first)'], ['sub', 'xₙ', 'Subscript (select text first)'], ['frac', 'a⁄b', 'Fraction'], ['√', '√', 'Square root'], ['±', '±'], ['×', '×'], ['÷', '÷'], ['≤', '≤'], ['≥', '≥'], ['≠', '≠'], ['≈', '≈'], ['∞', '∞'], ['Σ', 'Σ', 'Sum'], ['∫', '∫', 'Integral'], ['∂', '∂', 'Partial'], ['→', '→'], ['⇒', '⇒'], ['∴', '∴', 'Therefore']]],
    ['Greek', [['α', 'α'], ['β', 'β'], ['γ', 'γ'], ['δ', 'δ'], ['Δ', 'Δ'], ['ε', 'ε'], ['θ', 'θ'], ['λ', 'λ'], ['μ', 'μ'], ['π', 'π'], ['ρ', 'ρ'], ['σ', 'σ'], ['ω', 'ω']]],
    ['Code', [['code', '`x`', 'Inline code'], ['block', '{ }', 'Code block'], ['mono', 'Mono', 'Monospace answer box']]],
    ['Structure', [['bullet', '•', 'Bullet point'], ['num', '1.', 'Numbered point']]]
  ];
  function toolbarHtml() {
    return '<div class="mk-fmt" role="toolbar" aria-label="Maths and code formatting">' + FMT.map(function (g) {
      return '<div class="mk-fg"><span class="mk-fgl">' + g[0] + '</span>' + g[1].map(function (b) { return '<button type="button" data-fmt="' + esc(b[0]) + '" title="' + esc(b[2] || b[1]) + '"' + (b[0] === 'mono' ? ' aria-pressed="' + state.mono + '"' : '') + '>' + esc(b[1]) + '</button>'; }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function applyFmt(kind) {
    var ta = document.getElementById('mk-answer'); if (!ta) return;
    if (kind === 'mono') { state.mono = !state.mono; ta.classList.toggle('mono', state.mono); var mb = root.querySelector('[data-fmt="mono"]'); if (mb) mb.setAttribute('aria-pressed', state.mono); return; }
    var s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e), ins = kind, caret = null;
    var map = function (m, txt) { var ok = txt.split('').every(function (ch) { return m[ch]; }); return ok ? txt.split('').map(function (ch) { return m[ch]; }).join('') : null; };
    var lineStart = ta.value.lastIndexOf('\n', s - 1) + 1, atLine = s === lineStart;
    if (kind === 'sup') { ins = sel ? (map(SUP, sel) || '^(' + sel + ')') : '^()'; if (!sel) caret = 2; }
    else if (kind === 'sub') { ins = sel ? (map(SUB, sel) || '_(' + sel + ')') : '_()'; if (!sel) caret = 2; }
    else if (kind === 'frac') { ins = sel ? '(' + sel + ')/()' : '()/()'; caret = sel ? ins.length - 1 : 1; }
    else if (kind === '√') { ins = '√(' + sel + ')'; if (!sel) caret = 2; }
    else if (kind === 'Σ') ins = sel ? 'Σ(' + sel + ')' : 'Σ';
    else if (kind === 'code') { ins = '`' + sel + '`'; if (!sel) caret = 1; }
    else if (kind === 'block') { ins = (atLine ? '' : '\n') + '```\n' + (sel || '') + '\n```\n'; if (!sel) caret = (atLine ? 0 : 1) + 4; }
    else if (kind === 'bullet') ins = (atLine ? '' : '\n') + '• ' + sel;
    else if (kind === 'num') ins = (atLine ? '' : '\n') + '1. ' + sel;
    else if (sel) ins = kind + sel;
    ta.focus(); ta.setRangeText(ins, s, e, 'end');
    if (caret != null) { ta.selectionStart = ta.selectionEnd = s + caret; }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    track('fmt_' + (kind.length > 2 ? kind : 'sym'));
  }

  // ---------- the inspector: evaluation, mark scheme / allocation, model answer, examiner warnings ----------
  var BANDS = [['Fail', 0, 40, 'fail'], ['Third', 40, 50, 'third'], ['2:2', 50, 60, 'l2'], ['2:1', 60, 70, 'u2'], ['First', 70, 100, 'first']];
  function scaleHtml(lo, hi) {
    var pos = function (v) { return Math.max(0, Math.min(100, (v - 25) / 60 * 100)); };
    return '<div class="mk-scale" aria-hidden="true"><div class="mk-sbar">' + BANDS.map(function (b) { return '<span class="' + b[3] + '" style="left:' + pos(b[1]) + '%;width:' + (pos(b[2]) - pos(b[1])) + '%"></span>'; }).join('') +
      (lo != null ? '<i class="mk-srange" style="left:' + pos(lo) + '%;width:' + Math.max(1.5, pos(hi) - pos(lo)) + '%"></i>' : '') + '</div><div class="mk-slab">' + BANDS.map(function (b) { return '<span style="left:' + pos(b[1] === 0 ? 25 : b[1]) + '%">' + (b[1] ? b[1] : '') + '</span>'; }).join('') + '</div></div>';
  }
  function itabs(list) {
    return '<div class="mk-itabs" role="tablist">' + list.map(function (t) { return '<button type="button" role="tab" data-itab="' + t[0] + '" aria-selected="' + (state.itab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function warnHtml(list, label) {
    return list.map(function (w) { return '<p class="mk-wcall"><b>' + (label || 'Examiner warning') + '</b>' + esc(w) + '</p>'; }).join('');
  }
  function prevForCur() { var c = state.cur; return c && c.id ? (state.attempts || []).filter(function (a) { return a.question_id === c.id && a.result; }) : []; }
  function inspectorBefore() {
    var c = state.cur, q = c && c.id ? (state.questions || []).filter(function (x) { return x.id === c.id; })[0] : null, ex = !!state.exam;
    var prev = prevForCur(), best = null;
    prev.forEach(function (a) { var m = (a.result.mark_low + a.result.mark_high) / 2; if (!best || m > (best.result.mark_low + best.result.mark_high) / 2) best = a; });
    var html = '<aside class="mk-insp" aria-label="Mark scheme and feedback"><div class="mk-eval wait"><span class="mk-ilab">Evaluation</span>' +
      (best ? '<p class="mk-ebest">Your best so far <span class="mk-cls ' + clsSlug(best.result.class) + '">' + esc(best.result.class) + '</span> ' + best.result.mark_low + '–' + best.result.mark_high + '</p>' : '<p class="mk-epl">Your grade band and mark range appear here when it’s marked.</p>') +
      scaleHtml(best ? best.result.mark_low : null, best ? best.result.mark_high : null) + '</div>';
    if (ex) return html + '<div class="mk-ibody"><div class="mk-exlock"><b>Exam conditions</b><p>The mark scheme, model answer and examiner warnings unlock when your answer is marked.</p></div></div></aside>';
    if (['scheme', 'model', 'warn'].indexOf(state.itab) < 0) state.itab = 'scheme';
    var warns = []; prev.forEach(function (a) { (a.result.warnings || []).forEach(function (w) { if (warns.indexOf(w) < 0) warns.push(w); }); });
    html += itabs([['scheme', 'Mark scheme'], ['model', 'Model answer'], ['warn', 'Warnings' + (warns.length ? ' (' + warns.length + ')' : '')]]) + '<div class="mk-ibody">';
    if (state.itab === 'scheme') {
      if (q && q.guide) html += '<p class="mk-fine">What each band needs on this question:</p><dl class="mk-guide2"><dt><span class="mk-cls first">First</span></dt><dd>' + esc(q.guide.first) + '</dd><dt><span class="mk-cls u2">2:1</span></dt><dd>' + esc(q.guide.two_one) + '</dd><dt><span class="mk-cls l2">2:2</span></dt><dd>' + esc(q.guide.two_two) + '</dd></dl>';
      else html += '<p class="mk-fine">Marked against ' + (state.mod.department ? esc(state.mod.department) + '’s published criteria (where it has them) and ' : '') + U().poss + ' grade bands for ' + esc(levelName(state.mod.level)) + '.</p>';
      html += '<p class="mk-fine">You get a line-by-line mark allocation with your result.</p>';
    } else if (state.itab === 'model') {
      var ma = c && c.id ? modelAnswers[c.id] : null;
      html += ma ? '<details class="mk-acc"><summary>Reveal the First-class model answer <small>(spoiler)</small></summary><p class="mk-author">By ' + esc(ma.author_name) + (ma.author_mark ? ', who scored ' + ma.author_mark : '') + '.</p><div class="mk-prose">' + paras(ma.answer) + '</div></details>'
        : '<p class="mk-fine">A First-class plan and a model paragraph for your weakest part come back with your marking. Try it yourself first.</p>';
    } else html += warns.length ? warnHtml(warns) : '<p class="mk-fine">Examiner warnings for this question (the traps students most often fall into) appear after your first marking.</p>';
    return html + '</div></aside>';
  }
  function inspectorAfter(r, q, ma) {
    var lost = r.lost || [], al = r.allocation || [], warns = r.warnings || [];
    if (['alloc', 'model', 'warn'].indexOf(state.itab) < 0) state.itab = 'alloc';
    var html = '<aside class="mk-insp" aria-label="Your evaluation"><div class="mk-eval ' + clsSlug(r.class) + '"><span class="mk-ilab">Evaluation</span><div class="mk-everd"><span class="mk-cls big ' + clsSlug(r.class) + '">' + esc(r.class) + '</span><div><b>' + r.mark_low + '–' + r.mark_high + '</b><span>predicted mark range</span></div></div>' + scaleHtml(r.mark_low, r.mark_high);
    if (r.prev && r.prev.mark_low != null) {
      var dm = (r.mark_low + r.mark_high) / 2 - (r.prev.mark_low + r.prev.mark_high) / 2;
      html += '<p class="mk-delta ' + (dm > 0 ? 'up' : dm < 0 ? 'down' : '') + '">' + (dm > 0 ? '▲ Up ' + plural(Math.round(dm), 'mark') : dm < 0 ? '▼ Down ' + plural(Math.round(-dm), 'mark') : 'Same mark') + ' from ' + r.prev.mark_low + '–' + r.prev.mark_high + '</p>';
    }
    html += '<p class="mk-efine">Practice estimate against ' + (r.rubric && !/-wide$/.test(r.rubric) ? esc(r.rubric) + ' criteria and ' : '') + U().poss + ' grade bands. Not an official mark.</p></div>';
    html += itabs([['alloc', 'Mark allocation'], ['model', '1st Class model'], ['warn', 'Warnings' + ((warns.length || lost.length) ? ' (' + (warns.length || lost.length) + ')' : '')]]) + '<div class="mk-ibody">';
    if (state.itab === 'alloc') {
      if (al.length) {
        var got = al.reduce(function (t, a) { return t + a.awarded; }, 0), avail = al.reduce(function (t, a) { return t + a.available; }, 0);
        html += '<ul class="mk-alloc">' + al.map(function (a) { var p = Math.round(a.awarded / a.available * 100); return '<li><span class="it">' + esc(a.item) + '</span><span class="sc"><b>' + a.awarded + '</b>/' + a.available + '</span><span class="ab' + (p < 50 ? ' low' : '') + '"><i style="width:' + p + '%"></i></span>' + (a.awarded < a.available ? '<span class="ms">−' + (a.available - a.awarded) + ' missed</span>' : '<span class="ms ok">Full marks</span>') + '</li>'; }).join('') + '</ul><p class="mk-atot"><span>Total</span><b>' + got + ' / ' + avail + '</b></p>';
      } else html += '<p class="mk-fine">Answers marked from now on also get a line-by-line allocation of the marks. Here’s how each criterion went:</p>';
      if (r.criteria && r.criteria.length) html += '<h4 class="mk-ih">By criterion</h4><ul class="mk-crit2">' + r.criteria.map(function (c) { return '<li><details><summary><span class="mk-cls ' + clsSlug(c.band) + '">' + esc(c.band || '–') + '</span><b>' + esc(c.name) + '</b></summary><p>' + esc(c.comment) + '</p></details></li>'; }).join('') + '</ul>';
    } else if (state.itab === 'model') {
      var acc = function (title, body, open) { return '<details class="mk-acc"' + (open ? ' open' : '') + '><summary>' + title + '</summary>' + body + '</details>'; };
      var any = false;
      if (r.model_plan && r.model_plan.length) { any = true; html += acc('First-class plan', '<ul class="mk-plan">' + r.model_plan.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>', true); }
      if (r.model_paragraph) { any = true; html += acc('Model paragraph <small>your weakest part, at First standard</small>', '<div class="mk-prose mk-modelp">' + paras(r.model_paragraph) + '</div>'); }
      if (r.example_answer) { any = true; html += acc('Example First-class answer', '<div class="mk-prose">' + paras(r.example_answer) + '</div>'); }
      if (ma) { any = true; html += acc('Model answer by a student who got a First', '<p class="mk-author">Written by ' + esc(ma.author_name) + (ma.author_role ? ', ' + esc(ma.author_role) : '') + (ma.author_mark ? ', who scored ' + ma.author_mark + ' in this module' : '') + (ma.checked_by ? '. Checked by ' + esc(ma.checked_by) : '') + '.</p><div class="mk-prose">' + paras(ma.answer) + '</div>'); }
      if (q && q.guide) { any = true; html += acc('Marking guide for this question', '<dl class="mk-guide2"><dt><span class="mk-cls first">First</span></dt><dd>' + esc(q.guide.first) + '</dd><dt><span class="mk-cls u2">2:1</span></dt><dd>' + esc(q.guide.two_one) + '</dd><dt><span class="mk-cls l2">2:2</span></dt><dd>' + esc(q.guide.two_two) + '</dd></dl>'); }
      if (!any) html += '<p class="mk-fine">No model answer came back with this marking.</p>';
      html += '<p class="mk-fine">Use these to see the level, not to copy.</p>';
    } else {
      if (warns.length) html += warnHtml(warns);
      else if (lost.length) html += warnHtml(lost.map(function (l) { return l.issue; }), 'Where this answer slipped');
      else html += '<p class="mk-fine">No warnings for this one.</p>';
    }
    return html + '</div></aside>';
  }

  function viewAnswer() {
    var m = state.mod, c = state.cur, d = drafts()[draftKey()], ex = !!state.exam;
    var topic = !c.own && c.topic_pos != null && state.topics ? state.topics.filter(function (t) { return t.position === c.topic_pos; })[0] : null;
    var rw = state.rewrite && state.rewrite.qkey === draftKey() ? state.rewrite : null;
    var html = head() + '<div class="mk-ws"><section class="mk-card mk-answer' + (ex ? ' exam' : '') + '"><span class="mk-topic">' + (ex ? '<b class="mk-exbadge">Exam simulator</b> ' : '') + esc(m.code) + (topic ? ' · ' + esc(topic.title) : '') + (c.own ? '' : ' · ' + esc(tierName(c.tier))) + '</span>';
    if (rw) html += '<div class="mk-rwbox"><b>Rewrite challenge</b><p>Last time: <span class="mk-cls ' + clsSlug(rw.cls) + '">' + esc(rw.cls) + '</span> ' + rw.mark_low + '–' + rw.mark_high + '.' + (rw.quote ? ' Rewrite the paragraph starting “' + esc(rw.quote) + '…”' : '') + (rw.task ? ' ' + esc(rw.task) : '') + ' Then mark it again to see your new mark.</p><button type="button" class="mk-clear" data-act="norewrite">Cancel the challenge</button></div>';
    if (c.own) html += '<label class="mk-lab" for="mk-qtext">The question (paste it from your past paper or reading list)</label><textarea id="mk-qtext" rows="3" placeholder="Paste the exam question here">' + esc(c.question || '') + '</textarea>';
    else html += '<h2 class="mk-question">' + esc(c.question) + '</h2>';
    if (c.steps && c.steps.length && !ex) {
      var n = state.steps[c.id] || 0;
      html += '<div class="mk-steps"><p class="mk-lab">Stuck? Work through it one step at a time</p>' + (n ? '<ol>' + c.steps.slice(0, n).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '') +
        (n < c.steps.length ? '<button type="button" class="btn line small" data-act="step">' + (n ? 'Show step ' + (n + 1) + ' of ' + c.steps.length : 'Show step 1 of ' + c.steps.length) + '</button>' : '<p class="mk-fine">That’s the full worked solution. Now write it up in your own words below.</p>') + '</div>';
    }
    html += '<div class="mk-tools">' + (timer.on ? '<span id="mk-clock" class="mk-clock"></span>' : '<button type="button" class="btn line small" data-act="timer">Start a 45-minute exam timer</button>') + '<span class="mk-wc" id="mk-wc">' + words(d && d.t) + ' words</span></div>' +
      '<label class="mk-lab" for="mk-answer">Your answer</label><div class="mk-abox">' + toolbarHtml() + '<textarea id="mk-answer" class="' + (state.mono ? 'mono' : '') + '" rows="18" placeholder="Write your answer as you would in the exam. Plan first if you like.' + (tray() ? ' Or add photos of a handwritten answer below.' : '') + '">' + esc(d ? d.t : '') + '</textarea></div>' +
      (tray() ? tray().html() : '') +
      '<label class="mk-check"><input type="checkbox" id="mk-practice"> This is exam practice, not coursework I’m going to submit.</label>' +
      (state.err ? '<p class="mk-err">' + esc(state.err) + (state.upgrade ? ' <a href="/pricing">See Pro</a>' : '') + '</p>' : '') +
      '<div class="mk-row end">' + (d ? '<button type="button" class="mk-clear" data-act="clear">× Clear my answer</button>' : '<span></span>') +
      (state.busy ? '<p class="mk-busy"><span class="spin"></span>Marking against ' + U().poss + ' criteria… about ' + (state.busyAtt ? 'a minute' : '30 seconds') + '</p>' : '<button type="button" class="btn primary big td-go" data-act="submit">' + (getSession() ? (rw ? 'Mark my rewrite' : ex ? 'Hand it in' : 'Mark my answer') : 'Sign up free to get it marked') + '<span class="arr" aria-hidden="true">→</span></button>') + '</div>' +
      '<p class="mk-fine">Your draft is saved on this device as you type. Marked answers are saved to your account, and only you can see them.</p></section>' + inspectorBefore() + '</div>';
    return html;
  }
  function viewResult() {
    var r = state.result, m = state.mod, ma = state.cur && state.cur.id ? modelAnswers[state.cur.id] : null, q = state.cur && state.cur.id ? (state.questions || []).filter(function (x) { return x.id === state.cur.id; })[0] : null;
    var lost = r.lost || [];
    var html = head() + '<div class="mk-ws res"><div class="mk-wsmain"><section class="mk-card mk-result"><span class="mk-topic">' + esc(m.code) + ' · Your marked answer</span><h2 class="mk-question sm">' + esc(r.question || (state.cur && state.cur.question) || '') + '</h2>' +
      '<p class="mk-headline">' + esc(r.headline) + '</p>' +
      (HOOKS && r.cards ? '<p class="mk-cardsnote">We made ' + r.cards + ' flashcard' + (r.cards === 1 ? '' : 's') + ' from what you missed. They’re in your <a href="/dashboard/cards?m=' + m.code + '">' + esc(m.code) + ' deck</a>.</p>' : '');
    var text = String(r.answer || '').replace(/^\[Attached:[^\]]*\]\s*/m, '');
    if (lost.length) {
      html += '<h3>Where you lost marks</h3><p class="mk-fine">Your answer, with the places you lost marks highlighted. Tap a highlight to see why.</p><div class="mk-prose mk-annot">' + annotated(text, lost) + '</div>' +
        '<ol class="mk-lostlist">' + lost.map(function (l, i) { return '<li id="mk-li' + (i + 1) + '" data-lostli="' + (i + 1) + '"><span class="n">' + (i + 1) + '</span><div>' + (l.quote ? '<q>' + esc(l.quote) + '</q>' : '') + '<p><b>Why:</b> ' + esc(l.issue) + '</p>' + (l.fix ? '<p class="fix"><b>Fix:</b> ' + esc(l.fix) + '</p>' : '') + '</div></li>'; }).join('') + '</ol>';
    } else html += '<details class="mk-det" open><summary>Your answer</summary><div class="mk-prose">' + paras(r.answer || '') + '</div></details>';
    if (r.strengths && r.strengths.length) html += '<h3>What’s working</h3><ul class="mk-plain">' + r.strengths.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    if (r.changes && r.changes.length) html += '<h3>3 changes to move up a class</h3><ol class="mk-changes">' + r.changes.map(function (c) { return '<li><b>' + esc(c.change) + '</b>' + (c.why ? '<span>' + esc(c.why) + '</span>' : '') + '</li>'; }).join('') + '</ol>';
    if (r.id) html += '<div class="mk-challenge"><b>Rewrite challenge</b><p>' + (r.rewrite && r.rewrite.quote ? 'Rewrite your paragraph starting “' + esc(r.rewrite.quote) + '…”' + (r.rewrite.task ? ': ' + esc(r.rewrite.task) : '.') : 'Rewrite your weakest paragraph using the changes above.') + ' Then mark it again and see how far your mark moves.</p><button type="button" class="btn primary" data-act="rewrite">Start the rewrite</button></div>';
    html += '<div class="mk-row"><a class="btn line small" href="' + MBASE + m.code + (r.topic_pos != null ? '?t=' + r.topic_pos : '') + '" data-go="mod">Back to the Module Map</a></div></section>';
    if (r.id) html += '<section class="mk-card mk-realbox"><h3>Got a real mark for a similar answer?</h3><p>Tell us and we’ll use it to check the marker stays accurate for ' + esc(m.code) + '.</p><div class="mk-row start"><input id="mk-real" type="number" min="0" max="100" inputmode="numeric" placeholder="e.g. 64" aria-label="Your real mark"><button type="button" class="btn line small" data-real="' + r.id + '">Save</button></div><p id="mk-real-done" class="mk-fine"></p></section>';
    return html + '</div>' + inspectorAfter(r, q, ma) + '</div>';
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
    if (r.v === 'answer' && tray()) tray().mount();
    if (state.mod && !state.mod.loading && !state.mod.missing && !r.v && state.wmode === 'parse' && HOOKS && ptray()) ptray().mount();
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
    if (t.id === 'mk-ptext' && state.mod) state.ptext[state.mod.code] = t.value;
  });
  root.addEventListener('change', function (e) {
    if (e.target.id === 'mk-ugonly') { state.ug = e.target.checked; search(state.q); }
    if (e.target.id === 'mk-exd' && HOOKS && HOOKS.setExamDate) { HOOKS.setExamDate(state.mod.code, e.target.value || null).then(render).catch(function () {}); track('exam_date'); }
  });
  root.addEventListener('mousedown', function (e) { if (e.target.closest('[data-fmt]')) e.preventDefault(); });
  root.addEventListener('keydown', function (e) { if (e.target.id === 'mk-real' && e.key === 'Enter') { var b = root.querySelector('[data-real]'); if (b) saveReal(b.getAttribute('data-real')); } });
  root.addEventListener('click', function (e) {
    var hl = e.target.closest('mark[data-lost]');
    if (hl) { var li = document.getElementById('mk-li' + hl.getAttribute('data-lost')); if (li) { li.scrollIntoView({ block: 'center', behavior: 'smooth' }); li.classList.add('flash'); setTimeout(function () { li.classList.remove('flash'); }, 1200); } return; }
    var lli = e.target.closest('[data-lostli]');
    if (lli && !e.target.closest('a,button')) { var mk = document.getElementById('mk-lm' + lli.getAttribute('data-lostli')); if (mk) { mk.scrollIntoView({ block: 'center', behavior: 'smooth' }); mk.classList.add('flash'); setTimeout(function () { mk.classList.remove('flash'); }, 1200); } return; }
    var a = e.target.closest('a,button'); if (!a) return;
    if (a.hasAttribute('data-code')) { e.preventDefault(); go({ m: a.getAttribute('data-code') }); return; }
    if (a.getAttribute('data-go') === 'home') { e.preventDefault(); go({}); return; }
    if (a.getAttribute('data-go') === 'mod') { e.preventDefault(); var tp = state.result && state.result.topic_pos; state.result = null; go({ m: state.mod.code, t: tp != null ? tp : null }); return; }
    if (a.hasAttribute('data-topic')) { var p = +a.getAttribute('data-topic'); state.open[p] = !state.open[p]; if (state.open[p]) track('topic_open'); render(); return; }
    if (a.hasAttribute('data-rag')) { var pos = +a.getAttribute('data-pos'), k = a.getAttribute('data-rag'); rate(pos, k); return; }
    if (a.hasAttribute('data-show')) { state.shown[a.getAttribute('data-show')] = true; render(); return; }
    if (a.hasAttribute('data-recall')) { var qid = a.getAttribute('data-recall'); recall(qid, a.getAttribute('data-got') === '1'); state.shown[qid] = false; render(); return; }
    if (a.hasAttribute('data-itab')) { state.itab = a.getAttribute('data-itab'); render(); track('itab_' + state.itab); return; }
    if (a.hasAttribute('data-fmt')) { applyFmt(a.getAttribute('data-fmt')); return; }
    if (a.hasAttribute('data-wmode')) { state.wmode = a.getAttribute('data-wmode'); state.perr = ''; track('wmode_' + state.wmode); render(); return; }
    if (a.hasAttribute('data-tierf')) { state.tierF = a.getAttribute('data-tierf'); if (state.tierF && state.topics) state.topics.forEach(function (t) { state.open[t.position] = true; }); track('tierf_' + (state.tierF || 'all')); render(); var tl = root.querySelector('.mk-tiers'); if (tl && tl.getBoundingClientRect().top < 0) tl.scrollIntoView({ block: 'start' }); return; }
    if (a.hasAttribute('data-q')) { var id = a.getAttribute('data-q'); state.cur = (state.questions || []).filter(function (x) { return x.id === id; })[0]; state.err = ''; go({ m: state.mod.code, q: id, v: 'answer' }); return; }
    if (a.hasAttribute('data-del')) { deleteAttempt(a.getAttribute('data-del')); return; }
    if (a.hasAttribute('data-real')) { saveReal(a.getAttribute('data-real')); return; }
    var act = a.getAttribute('data-act');
    if (act === 'own') { state.cur = { id: null, own: true, question: '' }; state.err = ''; go({ m: state.mod.code, q: 'own', v: 'answer' }); }
    else if (act === 'genq') { if (!getSession()) { location.href = signinUrl(); return; } state.mapRetry = false; startMap(); }
    else if (act === 'timer') { startTimer(); render(); }
    else if (act === 'step') { state.steps[state.cur.id] = (state.steps[state.cur.id] || 0) + 1; track('step_reveal'); render(); }
    else if (act === 'submit') submit();
    else if (act === 'clear') { if (confirm('Clear your answer? This can’t be undone.')) { saveDraft(draftKey(), ''); render(); } }
    else if (act === 'star' && HOOKS) { HOOKS.toggle(state.mod).then(render); }
    else if (act === 'rewrite') startRewrite();
    else if (act === 'norewrite') { state.rewrite = null; render(); }
    else if (act === 'parse') runParse();
    else if (act === 'ucards') addUnitCards();
    else if (act === 'uclear') { if (confirm('Remove these study units? Flashcards already in your deck stay there.')) { unitsSet(state.mod.code, null); render(); } }
  });
  function inScope() { var p = location.pathname.replace(/\/$/, ''); return p === BASE.replace(/\/$/, '') || MODRE.test(location.pathname); }
  window.addEventListener('popstate', function () { if (inScope()) route(); });
  window.Marker = { route: function () { if (inScope()) route(); }, render: render, inScope: inScope };
  if (inScope()) route();
})();
