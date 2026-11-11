/* Unizy dashboard: the signed-in area. Separate tabs (Home, Practice & marking, Tutor, Marked answers,
   Account), your modules kept in the sidebar, and a first-run "pick your course" set-up.
   The Practice tab runs the marker (mark.js) under /dashboard/practice. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG, BRAND = (window.SITE_BRAND || {}).name || 'Unizy', SKEY = 'unizy.session';
  var TABS = [
    { id: 'home', label: 'Home', path: '/dashboard', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
    { id: 'practice', label: 'Practice & marking', path: '/dashboard/practice', icon: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4' },
    { id: 'tutor', label: 'Tutor', path: '/dashboard/tutor', icon: 'M4 5h16v11H8l-4 4z' },
    { id: 'play', label: 'Play', path: '/dashboard/play', icon: 'M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v3M10 2v3M14 2v3' },
    { id: 'history', label: 'Marked answers', path: '/dashboard/history', icon: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5' },
    { id: 'account', label: 'Account', path: '/dashboard/account', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0' },
    { id: 'cards', label: 'Flashcards', path: '/dashboard/cards' },
    { id: 'exam', label: 'Exam simulator', path: '/dashboard/exam' }
  ];
  var S = { session: null, profile: undefined, mods: [], attempts: null, plan: null, courses: null, depts: null, setup: null, tutorBusy: false, histOpen: {}, histMod: '', today: null, cards: null, card: { i: 0, show: false }, all: null, rev: null, exam: { tier: 'exam', min: 45, fresh: true },
    mode: lsGet('unizy:mode') || 'arena', ragf: lsGet('unizy:ragf') || '', treeOpen: lsJson('unizy:tree') || {} };
  var ST = window.UnizyStudy;
  var $ = function (id) { return document.getElementById(id); };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function lsJson(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function paras(s) { return esc(s).split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function md(s) {
    // small, safe markdown: paragraphs, - / 1. lists, **bold**, *italic*
    var lines = esc(s).split('\n'), out = '', list = null;
    function close() { if (list) { out += '</' + list + '>'; list = null; } }
    lines.forEach(function (l) {
      var b = /^\s*[-*•]\s+(.*)/.exec(l), n = /^\s*\d+[.)]\s+(.*)/.exec(l);
      if (b || n) { var t = b ? 'ul' : 'ol'; if (list !== t) { close(); out += '<' + t + '>'; list = t; } out += '<li>' + (b || n)[1] + '</li>'; return; }
      close();
      if (/^\s*#{1,4}\s+/.test(l)) { out += '<p><b>' + l.replace(/^\s*#{1,4}\s+/, '') + '</b></p>'; return; }
      if (l.trim()) out += '<p>' + l + '</p>';
    });
    close();
    return out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  }
  function getSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function toLogin() { location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search)); }
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
        if (b.user) s.user = { id: b.user.id, email: b.user.email, name: (b.user.user_metadata || {}).full_name || (s.user && s.user.name) || '' };
        try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {}
        return s.access_token;
      }).catch(function () { return null; });
  }
  function rawRest(path, opts) {
    opts = opts || {};
    return token().then(function (t) {
      var h = { apikey: CFG.anonKey, 'Content-Type': 'application/json' };
      if (t) h.Authorization = 'Bearer ' + t;
      if (opts.prefer) h.Prefer = opts.prefer;
      return fetch(CFG.supabaseUrl + '/rest/v1/' + path, { method: opts.method || 'GET', headers: h, body: opts.body == null ? undefined : (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) });
    });
  }
  function rest(path, opts) {
    return rawRest(path, opts).then(function (r) {
      if (r.status === 401) { toLogin(); throw new Error('signin'); }
      if (!r.ok) throw new Error('Couldn’t load that. Check your connection and try again.');
      return r.status === 204 || r.status === 201 && !(opts && opts.prefer && /representation/.test(opts.prefer)) ? null : r.json();
    });
  }
  function uid() { var s = getSession(); return s && s.user && s.user.id; }
  function firstName() { var s = getSession(), n = s && s.user && (s.user.name || ''); return n ? n.split(/\s+/)[0] : ''; }
  function levelName(l) { return l === 4 ? 'Year 1' : l === 5 ? 'Year 2' : l === 6 ? 'Final year' : l === 7 ? 'Master’s level' : ''; }
  function clsOf(mark) { return mark >= 70 ? 'First' : mark >= 60 ? '2:1' : mark >= 50 ? '2:2' : mark >= 40 ? 'Third' : 'Fail'; }
  function clsSlug(c) { return c === 'First' ? 'first' : c === '2:1' ? 'u2' : c === '2:2' ? 'l2' : c === 'Third' ? 'third' : 'fail'; }
  function mid(r) { return r && r.mark_low != null ? (r.mark_low + r.mark_high) / 2 : null; }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  // the student's university (UCL or Imperial): set in the first-run set-up, stored on study_profile
  var UNIS = { ucl: { short: 'UCL', long: 'UCL', name: 'University College London', exam: 'a UCL exam answer', src: 'Module description from UCL’s public catalogue' },
    imperial: { short: 'Imperial', long: 'Imperial College London', name: 'Imperial College London', exam: 'an Imperial exam answer', src: 'Module information from Imperial’s official programme specifications', eg: 'MATH40001', course: 'e.g. MEng Mechanical Engineering' },
    qmul: { short: 'Queen Mary', tutor: 'QMUL', long: 'Queen Mary University of London', name: 'Queen Mary University of London', exam: 'a Queen Mary exam answer', src: 'Module information from Queen Mary’s official module directory', eg: 'ECN115', course: 'e.g. BSc Economics' },
    lse: { short: 'LSE', long: 'LSE', name: 'London School of Economics', exam: 'an LSE exam answer', src: 'Course information from the LSE Calendar’s course guides', eg: 'EC1A1', course: 'e.g. BSc Economics' } };
  var UNI_ORDER = ['ucl', 'imperial', 'qmul', 'lse'];
  var CODE_RE = /^[A-Za-z]{2,4}\d[0-9A-Za-z]{1,4}$/; // UCL ECON0013, Imperial MATH40001, Queen Mary ECN115, LSE EC1A1
  function codeSearch(t) { return /^[A-Za-z]{4}\d{0,5}$/.test(t) || CODE_RE.test(t) || /^[A-Za-z]{2,3}\d{1,4}$/.test(t); }
  function uniId() { return (S.profile && S.profile.uni) || (S.setup && S.setup.uni) || 'ucl'; }
  function UN(u) { return UNIS[u || uniId()] || UNIS.ucl; }
  function tutorName(dept, u) { return (/medic|surgery|neurolog|infection|cardio|cancer|health|ear institute|pharmacy/i.test(dept || '') ? 'Dr ' : 'Professor ') + (UN(u).tutor || UN(u).short); }
  function icon(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }

  // ---------- routing ----------
  function tabOf(path) {
    path = path.replace(/\/$/, '') || '/dashboard';
    if (path.indexOf('/dashboard/practice') === 0) return 'practice';
    for (var i = 1; i < TABS.length; i++) if (path === TABS[i].path) return TABS[i].id;
    return 'home';
  }
  function nav(href) { history.pushState(null, '', href); show(); }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href]'); if (!a || a.target) return;
    var href = a.getAttribute('href');
    if (/^\/dashboard(\/|$|\?)/.test(href)) { e.preventDefault(); closeMenu(); nav(href); }
  });
  window.addEventListener('popstate', show);

  function show() {
    if (S.profile === undefined) return; // still loading
    if (!S.profile) { renderSetup(); return; }
    $('db').classList.remove('setup');
    var tab = tabOf(location.pathname);
    document.querySelectorAll('.db-nav a').forEach(function (a) { if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.querySelectorAll('.db-tab').forEach(function (sec) { sec.hidden = sec.getAttribute('data-tab') !== tab; });
    var t = TABS.filter(function (x) { return x.id === tab; })[0];
    document.title = (t ? t.label : 'Dashboard') + ' · ' + BRAND;
    if (tab === 'cards' || tab === 'exam') setMode(tab); else if (tab === 'practice') setMode(/[?&]exam=/.test(location.search) ? 'exam' : 'arena');
    renderSide(); renderTop();
    if (tab === 'home') renderHome();
    else if (tab === 'cards') renderCards();
    else if (tab === 'exam') renderExam();
    else if (tab === 'practice') { if (window.Marker) window.Marker.route(); }
    else if (tab === 'tutor') renderTutor();
    else if (tab === 'history') renderHistory();
    else if (tab === 'account') renderAccount();
    else if (tab === 'play') renderPlay();
    if (tab !== 'practice') window.scrollTo(0, 0); // the marker scrolls itself (e.g. to an opened topic)
  }

  // ---------- data ----------
  function loadMods() {
    return rest('my_modules?select=code,added_at,exam_date,ucl_modules(code,title,level,credits,department,summary,uni)&order=added_at.asc').then(function (rows) {
      S.mods = (rows || []).map(function (r) { var m = r.ucl_modules || { code: r.code, title: r.code }; m.exam_date = r.exam_date || null; return m; });
    });
  }
  function loadAttempts() {
    return rest('mark_attempts?select=id,code,question,question_id,topic_pos,tier,answer,minutes,result,real_mark,created_at&order=created_at.desc&limit=300').then(function (rows) { S.attempts = rows || []; return S.attempts; });
  }
  function loadPlan() {
    return rest('rpc/my_plan', { method: 'POST', body: '{}' }).then(function (d) { S.plan = d; }).catch(function () { S.plan = null; });
  }
  function hasMod(code) { return S.mods.some(function (m) { return m.code === code; }); }
  function addMods(list) {
    var rows = list.filter(function (m) { return !hasMod(m.code); });
    if (!rows.length) return Promise.resolve();
    return rest('my_modules', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: rows.map(function (m) { return { code: m.code }; }) })
      .then(function () { rows.forEach(function (m) { S.mods.push(m); }); renderSide(); });
  }
  function removeMod(code) {
    return rest('my_modules?code=eq.' + encodeURIComponent(code), { method: 'DELETE', prefer: 'return=minimal' })
      .then(function () { S.mods = S.mods.filter(function (m) { return m.code !== code; }); renderSide(); });
  }
  var chTimer = null;
  window.MarkHooks = {
    myModules: function () { return S.mods; },
    uni: function () { return uniId(); },
    has: hasMod,
    changed: function () { clearTimeout(chTimer); chTimer = setTimeout(function () { refreshStudy(true); }, 700); },
    toggle: function (mod) { return hasMod(mod.code) ? removeMod(mod.code) : addMods([mod]); },
    examDate: function (code) { var m = S.mods.filter(function (x) { return x.code === code; })[0]; return m ? m.exam_date : null; },
    setExamDate: function (code, date) {
      return rest('my_modules?code=eq.' + encodeURIComponent(code), { method: 'PATCH', prefer: 'return=minimal', body: { exam_date: date || null } })
        .then(function () { S.mods.forEach(function (m) { if (m.code === code) m.exam_date = date || null; }); });
    }
  };

  // ---------- sidebar: revision mode + University → Module → Topic tree with R/A/G dots ----------
  function setMode(m) { if (S.mode === m) return; S.mode = m; lsSet('unizy:mode', m); }
  function modeHref(code) { return S.mode === 'cards' ? '/dashboard/cards?m=' + code : S.mode === 'exam' ? '/dashboard/exam?m=' + code : '/dashboard/practice/' + code; }
  function topicsOf(code) { return S.today ? S.today.topics.filter(function (t) { return t.code === code; }) : null; }
  function ratingOf(code, pos) { var r = S.today && S.today.ratings.filter(function (x) { return x.code === code && x.topic_pos === pos; })[0]; return r ? r.rating : ''; }
  function topicStatus(code, pos, d) { d = d || modData(code); if (!d.qById) d.qById = ST.index(d.questions); return ST.ragStatus(ST.topicMastery(pos, d), ratingOf(code, pos)); }
  function curCode() {
    var m = /\/dashboard\/practice\/([A-Z]{2,4}[0-9][0-9A-Z]{1,4})/.exec(location.pathname);
    if (m) return m[1];
    var t = tabOf(location.pathname);
    return t === 'cards' || t === 'exam' || t === 'tutor' ? new URLSearchParams(location.search).get('m') : null;
  }
  function renderSide() {
    document.querySelectorAll('.db-seg a').forEach(function (a) { if (a.getAttribute('data-mode') === S.mode) a.setAttribute('aria-pressed', 'true'); else a.removeAttribute('aria-pressed'); });
    var el = $('db-mods'); if (!el) return;
    var cur = curCode(), curT = new URLSearchParams(location.search).get('t');
    if (!S.mods.length) { el.innerHTML = '<li class="db-empty">No modules yet.</li>'; return; }
    var unis = []; S.mods.forEach(function (m) { var u = m.uni || 'ucl'; if (unis.indexOf(u) < 0) unis.push(u); });
    el.innerHTML = unis.map(function (u) {
      return '<li class="db-uni">' + esc(UN(u).long) + '</li>' + S.mods.filter(function (m) { return (m.uni || 'ucl') === u; }).map(function (m) {
        var tps = topicsOf(m.code), d = modData(m.code), ms = tps && tps.length ? masteryOf(m.code) : null;
        var st = tps ? tps.map(function (t) { return topicStatus(m.code, t.position, d); }) : [];
        var hit = S.ragf && st.indexOf(S.ragf) >= 0;
        var open = S.treeOpen[m.code] != null ? S.treeOpen[m.code] : cur === m.code;
        if (hit) open = true;
        var row = '<div class="db-trow"><button type="button" class="db-tx" data-tx="' + m.code + '" aria-expanded="' + !!open + '" aria-label="Show topics in ' + esc(m.code) + '"><span></span></button><a href="' + modeHref(m.code) + '"' + (cur === m.code && curT == null ? ' aria-current="page"' : '') + '><span class="db-mcode">' + esc(m.code) + '</span><span class="db-mtitle">' + esc(m.title) + '</span></a>' + (ms ? '<span class="db-mpct" title="' + ms.pct + '% mastered">' + ms.pct + '%</span>' : '') + '</div>';
        var kids = '';
        if (open) {
          if (tps === null) kids = '<li class="db-tnone">Loading topics…</li>';
          else if (!tps.length) kids = '<li class="db-tnone"><a href="/dashboard/practice/' + m.code + '">Open to build its topic map →</a></li>';
          else kids = tps.map(function (t, i) {
            var rs = st[i];
            return '<li><a href="/dashboard/practice/' + m.code + '?t=' + t.position + '" data-rs="' + rs + '"' + (cur === m.code && curT === String(t.position) ? ' aria-current="page"' : '') + ' title="' + esc(rs ? ST.RAGF[rs] : 'Not started') + '"><i class="dot ' + (rs || 'n') + '"></i><span class="n">T' + (t.position + 1) + '</span><span class="tt">' + esc(t.title) + '</span></a></li>';
          }).join('');
          kids = '<ul class="db-tt">' + kids + '</ul>';
        }
        return '<li class="db-tm' + (open ? ' open' : '') + (cur === m.code ? ' cur' : '') + '">' + row + kids + '</li>';
      }).join('');
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tx]'); if (!b) return;
    var c = b.getAttribute('data-tx'); S.treeOpen[c] = b.getAttribute('aria-expanded') !== 'true';
    try { localStorage.setItem('unizy:tree', JSON.stringify(S.treeOpen)); } catch (er) {}
    renderSide();
  });
  document.addEventListener('click', function (e) { var a = e.target.closest('.db-seg a'); if (a) setMode(a.getAttribute('data-mode')); }, true);

  // ---------- top bar: command palette, cards due, R/A/G highlight, plan ----------
  function renderTop() {
    var due = $('db-due'), n = S.cards ? S.cards.length : null;
    if (due) {
      due.hidden = n == null;
      due.className = 'db-due' + (n ? ' on' : '');
      due.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h12v12H4zM8 3h12v12"/></svg><b>' + (n >= 60 ? '60+' : n) + '</b> flashcard' + (n === 1 ? '' : 's') + ' due';
    }
    var counts = { r: 0, a: 0, g: 0 };
    if (S.today) S.mods.forEach(function (m) { var d = modData(m.code); (topicsOf(m.code) || []).forEach(function (t) { var rs = topicStatus(m.code, t.position, d); if (rs) counts[rs]++; }); });
    var rf = $('db-ragf');
    if (rf) rf.innerHTML = '<button type="button" data-ragf=""' + (!S.ragf ? ' aria-pressed="true"' : '') + '>All</button>' + ['r', 'a', 'g'].map(function (k) {
      return '<button type="button" data-ragf="' + k + '"' + (S.ragf === k ? ' aria-pressed="true"' : '') + ' title="Highlight ' + ST.RAGF[k].toLowerCase() + ' topics in every module"><i class="dot ' + k + '"></i>' + ST.RAGF[k] + (S.today ? '<small>' + counts[k] + '</small>' : '') + '</button>';
    }).join('');
    document.documentElement.setAttribute('data-rag', S.ragf || '');
    var pl = $('db-plan'); if (pl) pl.innerHTML = planChip();
    var k = $('db-kbd'); if (k && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) k.textContent = '⌘K';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ragf]'); if (!b) return;
    S.ragf = b.getAttribute('data-ragf'); lsSet('unizy:ragf', S.ragf); track('ragf_' + (S.ragf || 'all'));
    renderTop(); renderSide();
  });
  // one refresh of everything the sidebar, top bar and Home need (topics, questions, ratings, recall, attempts, due cards)
  var studyP = null, studyAt = 0;
  function refreshStudy(force) {
    if (studyP) return studyP;
    if (!force && S.today && Date.now() - studyAt < 8000) return Promise.resolve();
    studyP = Promise.all([loadAttempts().catch(function () {}), loadToday().catch(function () { S.today = S.today || { topics: [], qs: [], recalls: [], ratings: [] }; S.cards = S.cards || []; })])
      .then(function () { studyAt = Date.now(); studyP = null; renderSide(); renderTop(); var t = tabOf(location.pathname); if (t === 'home' && homeDraw) homeDraw(); if (t === 'exam') renderExam(); if (t === 'home') maybeTour(); });
    return studyP;
  }

  // ---------- one-time dashboard tour (tour.js): first visit to Home after sign-up and set-up ----------
  function authUser(method, body) {
    return token().then(function (t) {
      if (!t) throw new Error('signin');
      return fetch(CFG.supabaseUrl + '/auth/v1/user', { method: method || 'GET', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
        .then(function (r) { if (!r.ok) throw new Error('auth'); return r.json(); });
    });
  }
  function tourCtx() {
    var n = S.today ? nextUp() : null, m = S.mods[0];
    return { uid: uid(), plan: S.plan, uni: UN().short, tutor: m ? tutorName(m.department, m.uni) : 'Professor ' + (UN().tutor || UN().short),
      nextHref: n && n.href ? n.href : n && n.mod ? '/dashboard/practice/' + n.mod.code : '',
      nav: nav, track: track, auth: authUser, ready: function () { return !!S.today && tabOf(location.pathname) === 'home' && !PAL.open; } };
  }
  var tourTried = false;
  function maybeTour() {
    if (tourTried || !window.UnizyTour || !S.profile) return;
    tourTried = true;
    window.UnizyTour.maybe(tourCtx());
  }

  // command palette (Ctrl/⌘ K): any of your modules or topics, any catalogue module, "ECON0002 W3" jumps to topic 3
  var PAL = { open: false, q: '', sel: 0, items: [], cat: [], seq: 0 };
  var ACTIONS = [['Home', '/dashboard', 'Today'], ['Flashcards', '/dashboard/cards', 'Revision mode'], ['Topic arena', '/dashboard/practice', 'Revision mode'], ['Exam simulator', '/dashboard/exam', 'Revision mode'], ['Tutor', '/dashboard/tutor', 'Ask'], ['Marked answers', '/dashboard/history', 'History'], ['Account', '/dashboard/account', 'Settings']];
  function palItems() {
    var q = PAL.q.trim(), out = [], low = q.toLowerCase();
    var jump = /^([A-Za-z]{2,4}\d[0-9A-Za-z]{1,4})\s*[-·:]?\s*(?:w|wk|week|t|topic|lecture|l)?\s*(\d{1,2})$/i.exec(q);
    if (jump) {
      var code = jump[1].toUpperCase(), n = +jump[2], t = (topicsOf(code) || []).filter(function (x) { return x.position === n - 1; })[0];
      out.push({ g: 'Jump to', label: code + ' · Topic ' + n, sub: t ? t.title : 'Opens the module at topic ' + n, href: '/dashboard/practice/' + code + '?t=' + (n - 1), rs: t ? topicStatus(code, t.position) : '' });
    }
    var tok = low.split(/\s+/).filter(Boolean);
    var ok = function (h) { h = h.toLowerCase(); return tok.every(function (w) { return h.indexOf(w) >= 0; }); };
    if (!tok.length) ACTIONS.forEach(function (a) { out.push({ g: 'Go to', label: a[0], sub: a[2], href: a[1] }); });
    S.mods.forEach(function (m) { if (!tok.length || ok(m.code + ' ' + m.title)) out.push({ g: 'My modules', label: m.code, sub: m.title, href: '/dashboard/practice/' + m.code }); });
    if (tok.length) {
      var tops = [];
      S.mods.forEach(function (m) { (topicsOf(m.code) || []).forEach(function (t) { if (ok(m.code + ' w' + (t.position + 1) + ' t' + (t.position + 1) + ' week ' + (t.position + 1) + ' ' + t.title)) tops.push({ g: 'Topics', label: m.code + ' · T' + (t.position + 1), sub: t.title, href: '/dashboard/practice/' + m.code + '?t=' + t.position, rs: topicStatus(m.code, t.position) }); }); });
      out = out.concat(tops.slice(0, 12));
      ACTIONS.forEach(function (a) { if (ok(a[0])) out.push({ g: 'Go to', label: a[0], sub: a[2], href: a[1] }); });
      PAL.cat.forEach(function (m) { if (!hasMod(m.code)) out.push({ g: 'All ' + UN().short + ' modules', label: m.code, sub: m.title + (m.department ? ' · ' + m.department : ''), href: '/dashboard/practice/' + m.code }); });
    }
    return out;
  }
  var palTimer = null;
  function palSearch() {
    clearTimeout(palTimer);
    var t = PAL.q.trim().replace(/[%*,()]/g, ' ').trim().replace(/\s*(?:w|wk|week|t|topic)?\s*\d{1,2}$/i, function (x) { return /^[A-Za-z]{2,4}\d[0-9A-Za-z]{1,4}\b/.test(PAL.q.trim()) ? '' : x; }).trim();
    if (t.length < 2) { PAL.cat = []; return; }
    palTimer = setTimeout(function () {
      var seq = ++PAL.seq;
      var filt = codeSearch(t) ? 'code=ilike.' + encodeURIComponent(t.toUpperCase() + '*') : 'or=(title.ilike.*' + encodeURIComponent(t) + '*,code.ilike.*' + encodeURIComponent(t) + '*)';
      rest('ucl_modules?select=code,title,department&uni=eq.' + uniId() + '&' + filt + '&level=lte.7&order=level.asc,code.asc&limit=8').then(function (rows) { if (seq === PAL.seq && PAL.open) { PAL.cat = rows || []; palPaint(); } }).catch(function () {});
    }, 160);
  }
  function palOpen() {
    if (PAL.open || !S.profile) return;
    PAL.open = true; PAL.q = ''; PAL.sel = 0; PAL.cat = [];
    var d = document.createElement('div'); d.id = 'db-pal'; d.className = 'db-pal';
    d.innerHTML = '<div class="db-palbox" role="dialog" aria-modal="true" aria-label="Jump to a module or topic"><div class="db-palin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4"/></svg><input id="db-palq" type="text" autocomplete="off" spellcheck="false" placeholder="Module code, topic or page… e.g. ECON0002 W3" aria-controls="db-pallist"><kbd>Esc</kbd></div><ul id="db-pallist" class="db-pallist" role="listbox"></ul><p class="db-palfoot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span>Type a code + week, e.g. <b>ECON0002 W3</b></span></p></div>';
    document.body.appendChild(d);
    d.addEventListener('mousedown', function (e) { if (e.target === d) palClose(); });
    d.addEventListener('click', function (e) { var li = e.target.closest('[data-pi]'); if (li) { PAL.sel = +li.getAttribute('data-pi'); palGo(); } });
    var inp = $('db-palq');
    inp.addEventListener('input', function () { PAL.q = inp.value; PAL.sel = 0; palSearch(); palPaint(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); PAL.sel = Math.min(PAL.items.length - 1, PAL.sel + 1); palPaint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); PAL.sel = Math.max(0, PAL.sel - 1); palPaint(); }
      else if (e.key === 'Enter') { e.preventDefault(); palGo(); }
      else if (e.key === 'Escape') { e.preventDefault(); palClose(); }
    });
    palPaint(); inp.focus(); track('palette_open');
  }
  function palPaint() {
    var ul = $('db-pallist'); if (!ul) return;
    PAL.items = palItems();
    if (PAL.sel >= PAL.items.length) PAL.sel = Math.max(0, PAL.items.length - 1);
    var g = '';
    ul.innerHTML = PAL.items.length ? PAL.items.map(function (it, i) {
      var head = it.g !== g ? '<li class="db-palg" role="presentation">' + esc(it.g) + '</li>' : ''; g = it.g;
      return head + '<li role="option" data-pi="' + i + '"' + (i === PAL.sel ? ' aria-selected="true"' : '') + '>' + (it.rs != null ? '<i class="dot ' + (it.rs || 'n') + '"></i>' : '') + '<b>' + esc(it.label) + '</b><span>' + esc(it.sub || '') + '</span>' + (i === PAL.sel ? '<kbd>↵</kbd>' : '') + '</li>';
    }).join('') : '<li class="db-palnone">Nothing matches. Try a module code like ECON0002.</li>';
    var s2 = ul.querySelector('[aria-selected]'); if (s2) s2.scrollIntoView({ block: 'nearest' });
  }
  function palGo() { var it = PAL.items[PAL.sel]; if (!it) return; palClose(); track('palette_go'); nav(it.href); }
  function palClose() { PAL.open = false; var d = $('db-pal'); if (d) d.remove(); }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (PAL.open) palClose(); else palOpen(); return; }
    if (e.key === '/' && !PAL.open && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && !(document.activeElement || {}).isContentEditable) { e.preventDefault(); palOpen(); }
  });
  document.addEventListener('click', function (e) { if (e.target.closest('#db-cmdk')) palOpen(); });

  function closeMenu() { var d = $('db'); if (d) d.classList.remove('menu'); }

  // ---------- first-run set-up: course, year, modules ----------
  function loadCourses() {
    if (S.courses) return Promise.resolve(S.courses);
    return fetch('/data/ucl-courses.json').then(function (r) { return r.json(); }).then(function (c) { S.courses = c; return c; }).catch(function () { S.courses = []; return []; });
  }
  function loadDepts() {
    if (S.depts && S.deptsUni === uniId()) return Promise.resolve(S.depts);
    var u = uniId();
    return rest('ucl_departments?select=department,ug_modules&uni=eq.' + u + '&ug_modules=gt.0&order=department.asc').then(function (d) { S.depts = d || []; S.deptsUni = u; return S.depts; });
  }
  function renderSetup() {
    $('db').classList.add('setup');
    var st = S.setup || (S.setup = { step: 1, uni: (S.profile && S.profile.uni) || 'ucl', course: null, dept: '', name: '', year: null, picks: {}, sugg: null, q: '', results: [] });
    var imp = st.uni !== 'ucl', U0 = UNIS[st.uni] || UNIS.ucl;
    var box = $('db-setup'), html = '<div class="db-setup-in"><p class="db-steps"><span' + (st.step === 1 ? ' class="on"' : '') + '>1. Course</span><span' + (st.step === 2 ? ' class="on"' : '') + '>2. Year</span><span' + (st.step === 3 ? ' class="on"' : '') + '>3. Modules</span></p>';
    if (st.step === 1) {
      html += '<h1>' + (firstName() ? 'Welcome, ' + esc(firstName()) + '. ' : '') + 'Where do you study?</h1>';
      html += '<div class="db-unis">' + UNI_ORDER.map(function (u) { return '<button type="button" class="db-course' + (st.uni === u ? ' on' : '') + '" data-uni="' + u + '">' + esc(UNIS[u].name) + '</button>'; }).join('') + '</div>';
      html += '<h2 class="db-sub">What do you study' + ' at ' + U0.short + '?</h2><p class="lead">We’ll suggest your modules. You can add or remove any of them later.</p>';
      if (!imp) html += '<div class="db-courses">' + (S.courses || []).map(function (c) { return '<button type="button" class="db-course' + (st.course && st.course.id === c.id ? ' on' : '') + '" data-course="' + c.id + '">' + esc(c.name) + '</button>'; }).join('') +
        '<button type="button" class="db-course' + (st.course === 'other' ? ' on' : '') + '" data-course="other">My course isn’t listed</button></div>';
      if (st.course === 'other') {
        html += '<div class="db-other"><label class="mk-lab" for="db-cname">Your course</label><input id="db-cname" type="text" placeholder="' + (imp ? U0.course : 'e.g. History, Politics and Economics BA') + '" value="' + esc(st.name) + '">' +
          '<label class="mk-lab" for="db-dept">Main department</label><select id="db-dept"><option value="">Choose a department…</option>' + (S.depts || []).map(function (d) { return '<option' + (st.dept === d.department ? ' selected' : '') + '>' + esc(d.department) + '</option>'; }).join('') + '</select></div>';
      }
      html += '<div class="db-setup-act"><button type="button" class="btn primary" data-setup="next1"' + (st.course ? '' : ' disabled') + '>Continue</button></div>';
    } else if (st.step === 2) {
      var years = st.course && st.course !== 'other' ? st.course.years : imp && /medic/i.test(st.dept) ? 6 : 4;
      html += '<h1>Which year are you in?</h1><div class="db-years">';
      for (var y = 1; y <= years; y++) html += '<button type="button" class="db-course' + (st.year === y ? ' on' : '') + '" data-year="' + y + '">Year ' + y + '</button>';
      html += '</div><div class="db-setup-act"><button type="button" class="btn line" data-setup="back">Back</button><button type="button" class="btn primary" data-setup="next2"' + (st.year ? '' : ' disabled') + '>Continue</button></div>';
    } else {
      html += '<h1>Pick your modules</h1><p class="lead">These stay in your sidebar so you can practise them in one click. ' + (st.uni !== 'ucl' ? 'Here are your department’s modules for that year: tick the ones you take.' : 'Compulsory modules are ticked for you.') + '</p>';
      if (st.sugg === null) html += '<p class="mk-hint">Finding your modules…</p>';
      else if (!st.sugg.length) html += '<p class="mk-hint">We couldn’t suggest modules for that year. Search for them below.</p>';
      else html += '<ul class="db-picks">' + st.sugg.map(function (m) { return '<li><label><input type="checkbox" data-pick="' + m.code + '"' + (st.picks[m.code] ? ' checked' : '') + '><span class="db-mcode">' + esc(m.code) + '</span><span>' + esc(m.title) + (m.compulsory ? ' <em>Compulsory</em>' : '') + '</span></label></li>'; }).join('') + '</ul>';
      var extra = Object.keys(st.picks).filter(function (c) { return st.picks[c] && !(st.sugg || []).some(function (m) { return m.code === c; }); });
      if (extra.length) html += '<p class="mk-lab">Also added</p><ul class="db-picks">' + extra.map(function (c) { var m = st.picks[c]; return '<li><label><input type="checkbox" data-pick="' + c + '" checked><span class="db-mcode">' + esc(c) + '</span><span>' + esc(m.title || '') + '</span></label></li>'; }).join('') + '</ul>';
      html += '<label class="mk-lab" for="db-sq">Add another module</label><input id="db-sq" type="search" autocomplete="off" placeholder="Search by code or title, e.g. ' + (imp ? U0.eg : 'HIST0003') + '" value="' + esc(st.q) + '"><ul class="db-sres" id="db-sres"></ul>';
      var n = Object.keys(st.picks).filter(function (c) { return st.picks[c]; }).length;
      html += '<div class="db-setup-act"><button type="button" class="btn line" data-setup="back">Back</button><button type="button" class="btn primary" data-setup="finish">' + (n ? 'Go to my dashboard (' + n + ' module' + (n === 1 ? '' : 's') + ')' : 'Skip for now') + '</button></div>';
    }
    html += '<p class="db-err" id="db-serr" hidden></p></div>';
    var f = document.activeElement && document.activeElement.id;
    box.innerHTML = html;
    if (f && $(f)) { var el = $(f); el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    if (st.step === 3) setupResults();
  }
  function setupResults() {
    var st = S.setup, ul = $('db-sres'); if (!ul) return;
    ul.innerHTML = (st.results || []).map(function (m) { return '<li><button type="button" data-addpick="' + m.code + '"><span class="db-mcode">' + esc(m.code) + '</span> ' + esc(m.title) + ' <small>' + esc(m.department || '') + '</small></button></li>'; }).join('');
  }
  var sTimer = null;
  function setupSearch(q) {
    var st = S.setup; st.q = q; clearTimeout(sTimer);
    var t = q.trim().replace(/[%*,()]/g, ' ').trim();
    if (t.length < 2) { st.results = []; setupResults(); return; }
    sTimer = setTimeout(function () {
      var filt = codeSearch(t) ? 'code=ilike.' + encodeURIComponent(t.toUpperCase() + '*') : 'or=(title.ilike.*' + encodeURIComponent(t) + '*,code.ilike.*' + encodeURIComponent(t) + '*)';
      rest('ucl_modules?select=code,title,level,department&uni=eq.' + st.uni + '&' + filt + '&level=lte.7&order=level.asc,code.asc&limit=12').then(function (rows) { st.results = rows || []; setupResults(); }).catch(function () {});
    }, 180);
  }
  function suggest() {
    var st = S.setup; st.sugg = null; renderSetup();
    var p;
    if (st.course && st.course !== 'other') {
      var list = (st.course.y[String(st.year)] || []);
      var codes = list.map(function (m) { return m.c; });
      p = codes.length ? rest('ucl_modules?select=code,title,level,department,credits&code=in.(' + codes.join(',') + ')').then(function (rows) {
        var byCode = {}; (rows || []).forEach(function (r) { byCode[r.code] = r; });
        return list.filter(function (m) { return byCode[m.c]; }).map(function (m) { var r = byCode[m.c]; r.compulsory = m.s === 'c'; return r; });
      }) : Promise.resolve([]);
    } else {
      var lvl = Math.min(7, 3 + (st.year || 1));
      p = rest('ucl_modules?select=code,title,level,department,credits&uni=eq.' + st.uni + '&department=eq.' + encodeURIComponent(st.dept) + '&level=eq.' + lvl + '&order=code.asc&limit=' + (st.uni !== 'ucl' ? 120 : 60));
    }
    p.then(function (rows) {
      st.sugg = rows || [];
      st.sugg.forEach(function (m) { if (m.compulsory) st.picks[m.code] = m; });
      renderSetup();
    }).catch(function () { st.sugg = []; renderSetup(); });
  }
  function finishSetup() {
    var st = S.setup;
    var picks = Object.keys(st.picks).filter(function (c) { return st.picks[c]; }).map(function (c) { return st.picks[c]; });
    var body = { user_id: uid(), uni: st.uni, course: st.course === 'other' ? (st.name.trim() || null) : st.course.name, course_id: st.course === 'other' ? null : st.course.id, department: st.course === 'other' ? (st.dept || null) : null, year: st.year, updated_at: new Date().toISOString() };
    var btn = document.querySelector('[data-setup="finish"]'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    rest('study_profile', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: body })
      .then(function () { return addMods(picks); })
      .then(function () { S.profile = body; S.setup = null; track('dash_setup_done'); nav('/dashboard'); })
      .catch(function (e) { var er = $('db-serr'); if (er) { er.hidden = false; er.textContent = e.message; } if (btn) { btn.disabled = false; btn.textContent = 'Try again'; } });
  }
  document.addEventListener('click', function (e) {
    if (!S.setup || !$('db').classList.contains('setup')) return;
    var b = e.target.closest('button'); if (!b) return;
    var st = S.setup;
    if (b.hasAttribute('data-uni')) {
      st.uni = b.getAttribute('data-uni'); st.dept = ''; st.picks = {}; S.depts = null;
      st.course = st.uni !== 'ucl' ? 'other' : null;
      if (st.uni !== 'ucl') loadDepts().then(renderSetup);
      renderSetup();
    } else if (b.hasAttribute('data-course')) {
      var id = b.getAttribute('data-course');
      st.course = id === 'other' ? 'other' : S.courses.filter(function (c) { return c.id === id; })[0];
      if (id === 'other' && !S.depts) loadDepts().then(renderSetup);
      renderSetup();
    } else if (b.hasAttribute('data-year')) { st.year = +b.getAttribute('data-year'); renderSetup(); }
    else if (b.hasAttribute('data-addpick')) {
      var c = b.getAttribute('data-addpick'), m = (st.results || []).filter(function (x) { return x.code === c; })[0];
      if (m) st.picks[c] = m; st.q = ''; st.results = []; renderSetup();
    } else {
      var a = b.getAttribute('data-setup');
      if (a === 'next1') {
        if (st.course === 'other' && !st.dept) { var er = $('db-serr'); er.hidden = false; er.textContent = 'Choose your main department.'; return; }
        st.step = 2; renderSetup();
      } else if (a === 'next2') { st.step = 3; suggest(); }
      else if (a === 'back') { st.step = Math.max(1, st.step - 1); renderSetup(); }
      else if (a === 'finish') finishSetup();
    }
  });
  document.addEventListener('change', function (e) {
    if (!S.setup) return;
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute('data-pick')) {
      var c = t.getAttribute('data-pick'), st = S.setup;
      var m = (st.sugg || []).filter(function (x) { return x.code === c; })[0] || st.picks[c];
      if (t.checked) st.picks[c] = m; else delete st.picks[c];
      renderSetup();
    }
    if (t.id === 'db-dept') { S.setup.dept = t.value; }
  });
  document.addEventListener('input', function (e) {
    if (!S.setup) return;
    if (e.target.id === 'db-sq') setupSearch(e.target.value);
    if (e.target.id === 'db-cname') S.setup.name = e.target.value;
  });

  // ---------- Home: Today ----------
  function stats(list) {
    var marks = list.map(function (a) { return mid(a.result); }).filter(function (x) { return x != null; });
    var avg = marks.length ? marks.reduce(function (s, x) { return s + x; }, 0) / marks.length : null;
    return { n: list.length, avg: avg, best: marks.length ? Math.max.apply(null, marks) : null };
  }
  // everything Today needs for the student's modules: topics, questions, recall results, ratings, due flashcards
  function loadToday() {
    var codes = S.mods.map(function (m) { return m.code; });
    var cards = rest('review_cards?due=lte.' + ST.today() + '&select=id,code,topic_pos,front,back,interval_days,ease,reps,due&order=due.asc,created_at.asc&limit=60').catch(function () { return []; });
    if (!codes.length) return Promise.all([cards]).then(function (r) { S.today = { topics: [], qs: [], recalls: [], ratings: [] }; S.cards = r[0] || []; });
    var inList = 'code=in.(' + codes.join(',') + ')';
    return Promise.all([
      rest('module_topics?' + inList + '&select=code,position,title&order=code.asc,position.asc'),
      rest('module_questions?' + inList + '&select=id,code,tier,topic_pos,question,kind&order=position.asc'),
      rest('recall_log?select=code,question_id,topic_pos,got,created_at&order=created_at.desc&limit=1000').catch(function () { return []; }),
      rest('topic_ratings?select=code,topic_pos,rating').catch(function () { return []; }),
      cards
    ]).then(function (r) { S.today = { topics: r[0] || [], qs: r[1] || [], recalls: r[2] || [], ratings: r[3] || [] }; S.cards = r[4] || []; });
  }
  function modData(code) {
    var t = S.today || { topics: [], qs: [], recalls: [], ratings: [] };
    var by = function (x) { return x.code === code; };
    return { topics: t.topics.filter(by), questions: t.qs.filter(by), recalls: t.recalls.filter(by), attempts: (S.attempts || []).filter(by), ratings: t.ratings.filter(by) };
  }
  function masteryOf(code) { var d = modData(code); return d.topics.length ? ST.moduleMastery(d.topics, d) : null; }
  // the one question to do next: the nearest exam (or weakest module), its weakest topic, and the right level for it
  function nextUp() {
    var mods = S.mods.filter(function (m) { return masteryOf(m.code); });
    if (!mods.length) return S.mods.length ? { none: true, mod: S.mods[0] } : null;
    mods.sort(function (a, b) {
      var da = ST.daysUntil(a.exam_date), db = ST.daysUntil(b.exam_date);
      da = da != null && da >= 0 ? da : 1e4; db = db != null && db >= 0 ? db : 1e4;
      return da - db || masteryOf(a.code).pct - masteryOf(b.code).pct;
    });
    var mod = mods[0], d = modData(mod.code); d.qById = ST.index(d.questions);
    var rg = {}; d.ratings.forEach(function (r) { rg[r.topic_pos] = r.rating; });
    var best = null;
    d.topics.forEach(function (t) {
      var ms = ST.topicMastery(t.position, d), score = ms.pct + (rg[t.position] === 'r' ? -15 : rg[t.position] === 'a' ? -5 : rg[t.position] === 'g' ? 10 : 0);
      if (!best || score < best.score) best = { t: t, ms: ms, score: score };
    });
    var t = best.t, tq = d.questions.filter(function (q) { return q.topic_pos === t.position; });
    var days = ST.daysUntil(mod.exam_date);
    var why = days != null && days >= 0 ? 'Nearest exam · ' + ST.countdown(mod.exam_date) : rg[t.position] === 'r' ? 'You rated this topic red' : best.ms.started ? 'Your weakest topic in ' + mod.code : 'Next topic to start in ' + mod.code;
    var done = {}; (S.attempts || []).forEach(function (a) { if (a.question_id) done[a.question_id] = true; });
    var latest = {}; d.recalls.forEach(function (r) { if (!(r.question_id in latest)) latest[r.question_id] = r.got; });
    var rec = tq.filter(function (q) { return q.tier === 'foundation' && latest[q.id] !== true; });
    if (best.ms.pct < 25 && rec.length) return { mod: mod, topic: t, why: why, recall: rec.length, href: '/dashboard/practice/' + mod.code + '?t=' + t.position };
    var pick = tq.filter(function (q) { return q.tier === 'exam' && !done[q.id]; })[0] || tq.filter(function (q) { return q.tier === 'first' && !done[q.id]; })[0] || tq.filter(function (q) { return q.tier === 'first'; })[0] || tq.filter(function (q) { return q.tier === 'exam'; })[0];
    if (!pick) return { mod: mod, topic: t, why: why, href: '/dashboard/practice/' + mod.code + '?t=' + t.position };
    return { mod: mod, topic: t, why: why, q: pick, href: '/dashboard/practice/' + mod.code + '?q=' + pick.id + '&v=answer' };
  }
  var IC = {
    book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    check: 'M20 6L9 17l-5-5', avg: 'M4 19h16M7 15l4-4 3 3 5-6', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', cards: 'M4 7h12v12H4zM8 3h12v12'
  };
  function go(href, label) { return '<a class="btn primary td-go" href="' + href + '">' + label + '<span class="arr" aria-hidden="true">→</span></a>'; }
  function nextHtml(n) {
    var head = function (ic, why) { return '<div class="td-nhead"><span class="td-ic" aria-hidden="true">' + icon(IC[ic]) + '</span><span class="td-why">' + esc(why) + '</span></div>'; };
    if (!n) return '<div class="td-card td-next">' + head('book', 'Start here') + '<h2>Add your modules</h2><p class="sub">Pick the modules you’re taking and Today will tell you what to practise next.</p>' + go('/dashboard/practice', 'Find a module') + '</div>';
    if (n.none) {
      var lv = levelName(n.mod.level);
      return '<div class="td-card td-next">' + head('book', 'Start here') + '<h2>Open ' + esc(n.mod.code) + '</h2><p class="td-meta">' + esc([n.mod.title, n.mod.department, lv].filter(Boolean).join(' · ')) + '</p><p class="sub">Opening it builds its Module Map: every topic in teaching order, with quick-recall, exam-style and First-class questions. Takes about a minute, once.</p>' + go('/dashboard/practice/' + n.mod.code, 'Open ' + esc(n.mod.code)) + '</div>';
    }
    var tps = topicsOf(n.mod.code) || [];
    var html = '<div class="td-card td-next">' + head(n.recall ? 'bolt' : 'target', n.why) + '<h2>Next up: ' + esc(n.topic.title) + '</h2><p class="td-meta">' + esc(n.mod.code) + ' · Topic ' + (n.topic.position + 1) + ' of ' + tps.length + (n.q ? ' · ' + (n.q.tier === 'first' ? 'First-class stretch' : 'Exam-style') : n.recall ? ' · Quick recall' : '') + '</p>';
    if (n.recall) html += '<p class="q">Warm up with ' + n.recall + ' quick-recall question' + (n.recall === 1 ? '' : 's') + ' on this topic, then try the exam-style question.</p>' + go(n.href, 'Start quick recall');
    else if (n.q) html += '<p class="q">' + esc(String(n.q.question).slice(0, 260)) + (String(n.q.question).length > 260 ? '…' : '') + '</p>' + go(n.href, n.q.tier === 'first' ? 'Try the First-class question' : 'Answer this');
    else html += go(n.href, 'Open the topic');
    return html + '</div>';
  }
  function cardsHtml() {
    var list = S.cards;
    var html = '<div class="td-card td-cards" id="td-cards"><h2>Flashcards due</h2>';
    if (list === null) return html + '<p class="sub">Loading…</p></div>';
    if (!list.length) return html + '<p class="sub">Nothing due today.</p><p class="mk-fine">Every mark you lose and every quick-recall question you miss becomes a flashcard here, then comes back just before you’d forget it.</p></div>';
    var c = list[S.card.i] || list[0], m = S.mods.filter(function (x) { return x.code === c.code; })[0];
    html += '<p class="sub">' + list.length + ' left today</p><div class="td-fc"><span class="meta">' + esc(c.code) + (m ? ' · ' + esc(m.title) : '') + '</span><div class="front">' + esc(c.front) + '</div>' +
      (S.card.show ? '<div class="back">' + esc(c.back) + '</div><div class="td-grades"><button type="button" class="btn line small" data-grade="again">Again</button><button type="button" class="btn dark small" data-grade="good">Good</button><button type="button" class="btn line small" data-grade="easy">Easy</button></div>'
        : '<div><button type="button" class="btn dark small" data-flip="1">Show answer</button></div>') + '</div></div>';
    return html;
  }
  function gradeCard(grade) {
    var c = S.cards[S.card.i]; if (!c) return;
    var n = ST.schedule(c, grade);
    S.cards.splice(S.card.i, 1);
    if (grade === 'again') S.cards.push(Object.assign({}, c, n)); // see it again before the end of today's session
    if (S.card.i >= S.cards.length) S.card.i = 0;
    S.card.show = false;
    track('card_' + grade);
    rest('review_cards?id=eq.' + c.id, { method: 'PATCH', prefer: 'return=minimal', body: n }).catch(function () {});
    var box = $('td-cards'); if (box) box.outerHTML = cardsHtml();
    renderTop();
  }
  function statusPill(ms, hasTopics) {
    if (!S.today) return '<span class="td-pill wait">…</span>';
    if (!hasTopics) return '<span class="td-pill new">Not opened</span>';
    if (!ms.started) return '<span class="td-pill new">Not started</span>';
    return ms.pct >= 70 ? '<span class="td-pill done">Mastered</span>' : '<span class="td-pill go">In progress</span>';
  }
  function progressHtml() {
    if (!S.mods.length) return '';
    return '<section class="db-sec"><div class="mk-row"><h2>Your modules</h2><a class="btn line small" href="/dashboard/practice">+ Add a module</a></div><ul class="td-prog">' + S.mods.map(function (m) {
      var tps = topicsOf(m.code) || [], ms = tps.length ? masteryOf(m.code) : null, cd = m.exam_date ? ST.countdown(m.exam_date) : '', d = modData(m.code);
      var dots = tps.length ? '<span class="td-dots" aria-hidden="true">' + tps.map(function (t) { var rs = topicStatus(m.code, t.position, d); return '<i class="dot ' + (rs || 'n') + '" title="T' + (t.position + 1) + ' ' + esc(t.title) + '"></i>'; }).join('') + '</span>' : '';
      var p = ms ? '<span class="td-pline">' + statusPill(ms, true) + '<b>' + ms.pct + '%</b><span>' + ms.started + '/' + ms.total + ' topics</span></span><span class="mk-bar' + (ms.pct >= 70 ? ' done' : '') + '"><i style="width:' + Math.max(ms.started ? 3 : 0, ms.pct) + '%"></i></span>' + dots
        : '<span class="td-pline">' + statusPill(null, false) + '<span>' + (S.today ? 'Opens with a topic map' : '') + '</span></span>';
      return '<li><div class="t"><b>' + esc(m.code) + '</b><span>' + esc(m.title) + '</span>' + (cd ? '<em class="td-cd">' + esc(cd) + '</em>' : '') + '</div><div class="p">' + p + '</div><div class="a"><a class="btn dark small" href="/dashboard/practice/' + m.code + '">' + (ms && ms.started ? 'Continue' : 'Practise') + '</a><a class="btn line small" href="/dashboard/tutor?m=' + m.code + '">Tutor</a></div></li>';
    }).join('') + '</ul></section>';
  }
  function perfHtml(st) {
    var pct = function (v) { return v != null ? Math.round(v) + '%' : '–'; };
    var cell = function (ic, val, lab, extra, href) { return '<' + (href ? 'a href="' + href + '"' : 'div') + ' class="pf"><span class="pf-ic" aria-hidden="true">' + icon(IC[ic]) + '</span><span class="pf-tx"><b>' + val + (extra || '') + '</b><span>' + lab + '</span></span></' + (href ? 'a' : 'div') + '>'; };
    var cls = function (v) { if (v == null) return ''; var c = clsOf(v); return ' <em class="mk-cls ' + clsSlug(c) + '">' + c + '</em>'; };
    var due = S.cards ? S.cards.length : null;
    return '<section class="td-perf" aria-label="Performance overview">' +
      cell('check', st.n, 'Answer' + (st.n === 1 ? '' : 's') + ' marked', '', '/dashboard/history') +
      cell('avg', pct(st.avg), 'Average mark', cls(st.avg)) +
      cell('star', st.best != null ? Math.round(st.best) + '%' : '–', 'Best mark', cls(st.best)) +
      cell('cards', due == null ? '–' : due >= 60 ? '60+' : due, 'Cards due today', '', '/dashboard/cards') + '</section>';
  }
  function renderHome() {
    var el = $('db-home');
    var draw = homeDraw = function () {
      if (tabOf(location.pathname) !== 'home') return;
      var a = S.attempts || [], st = stats(a), p = S.profile || {};
      var html = '<header class="db-hello"><h1>' + (firstName() ? 'Hi ' + esc(firstName()) : 'Today') + '</h1><p>' + esc([p.course, p.year ? 'Year ' + p.year : '', p.uni && p.uni !== 'ucl' ? UN(p.uni).short : ''].filter(Boolean).join(' · ') || UN().short) + '</p></header>';
      var exams = S.mods.filter(function (m) { var d = ST.daysUntil(m.exam_date); return d != null && d >= 0; }).sort(function (x, y) { return ST.daysUntil(x.exam_date) - ST.daysUntil(y.exam_date); });
      if (exams.length) html += '<div class="td-count">' + exams.map(function (m) { var d = ST.daysUntil(m.exam_date); return '<a href="/dashboard/practice/' + m.code + '"' + (d <= 14 ? ' class="soon"' : '') + '><b>' + esc(m.code) + '</b>' + esc(ST.countdown(m.exam_date)) + '</a>'; }).join('') + '</div>';
      else if (S.mods.length) html += '<p class="db-more" style="margin:0 0 14px">Add your exam dates on each module’s page for a countdown here.</p>';
      html += '<div class="td-grid">' + (S.today ? nextHtml(nextUp()) : '<div class="td-card td-next"><span class="td-why">Today</span><h2>Finding your next question…</h2></div>') + cardsHtml() + '</div>';
      html += perfHtml(st);
      html += progressHtml();
      if (a.length) {
        html += '<section class="db-sec"><div class="mk-row"><h2>Recent marked answers</h2><a class="btn line small" href="/dashboard/history">See all</a></div><ul class="mk-hist">' + a.slice(0, 5).map(histRow).join('') + '</ul></section>';
      }
      html += '<a class="db-play-banner" href="/dashboard/play"><span class="ic" aria-hidden="true">☕</span><span class="tx"><b>Done for today? Unwind.</b><span>Easy questions reveal the letters of today’s hidden word. Can you guess it?</span></span><span class="go">Play →</span></a>';
      el.innerHTML = html;
    };
    draw();
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-flip')) { S.card.show = true; var box = $('td-cards'); if (box) box.outerHTML = cardsHtml(); }
      if (b.hasAttribute('data-grade')) gradeCard(b.getAttribute('data-grade'));
    };
    refreshStudy();
  }
  var homeDraw = null;
  function planChip() {
    var p = S.plan; if (!p) return '';
    if (p.tier === 'pro') return ' <span class="db-chip pro">Pro</span>';
    if (p.tier === 'trial') return ' <a class="db-chip trial" href="/pricing" title="Free trial until ' + esc(day(p.until)) + '">Free trial · until ' + esc(day(p.until)) + '</a>';
    return ' <a class="db-chip ended" href="/pricing">Trial ended · Go Pro</a>';
  }
  function histRow(x) {
    var r = x.result || {};
    return '<li><span class="mk-cls ' + clsSlug(r.class) + '">' + esc(r.class || '?') + '</span><a class="mk-hq" href="/dashboard/history?a=' + x.id + '"><b>' + esc(x.code) + '</b> ' + esc(String(x.question).slice(0, 120)) + (String(x.question).length > 120 ? '…' : '') + '</a><span class="mk-hm">' + (r.mark_low != null ? r.mark_low + '–' + r.mark_high : '') + ' · ' + day(x.created_at) + '</span></li>';
  }

  // ---------- Flashcards (revision mode): a deck per module, review what's due, browse and delete ----------
  function loadAllCards() {
    return rest('review_cards?select=id,code,topic_pos,front,back,interval_days,ease,reps,due,created_at&order=due.asc,created_at.asc&limit=2000').then(function (r) { S.all = r || []; });
  }
  function deckStats(code) {
    var list = (S.all || []).filter(function (c) { return !code || c.code === code; }), t = ST.today();
    return { n: list.length, due: list.filter(function (c) { return !c.due || c.due <= t; }).length, solid: list.filter(function (c) { return (c.interval_days || 0) >= 21; }).length };
  }
  function renderCards() {
    var el = $('db-cards'), pm = new URLSearchParams(location.search).get('m');
    var draw = function () {
      if (tabOf(location.pathname) !== 'cards') return;
      var html = '<header class="db-hello"><span class="db-kick">Revision mode · Flashcards</span><h1>Flashcard decks</h1><p>Every mark you lose, every quick-recall miss and every set of notes you parse becomes a card. Each one comes back just before you’d forget it.</p></header>';
      if (S.all === null) { el.innerHTML = html + '<p class="mk-hint">Loading your decks…</p>'; return; }
      if (S.rev) { el.innerHTML = html + reviewHtml(); return; }
      var all = deckStats('');
      html += '<div class="cd-sum"><div><b>' + all.n + '</b><span>cards</span></div><div><b>' + all.due + '</b><span>due today</span></div><div><b>' + all.solid + '</b><span>well learned (3+ weeks)</span></div>' + (all.due ? '<button type="button" class="btn primary td-go" data-rev="">Review all ' + all.due + ' due<span class="arr" aria-hidden="true">→</span></button>' : '') + '</div>';
      var codes = S.mods.map(function (m) { return m.code; });
      (S.all || []).forEach(function (c) { if (codes.indexOf(c.code) < 0) codes.push(c.code); });
      html += '<ul class="cd-decks">' + codes.map(function (code) {
        var m = S.mods.filter(function (x) { return x.code === code; })[0] || { code: code, title: '' }, d = deckStats(code), pct = d.n ? Math.round(d.solid / d.n * 100) : 0;
        return '<li class="cd-deck' + (pm === code ? ' on' : '') + '" id="cd-' + code + '"><div class="cd-dh"><span class="db-mcode">' + esc(code) + '</span><b>' + esc(m.title) + '</b></div><p class="cd-dm"><span><b>' + d.n + '</b> cards</span><span' + (d.due ? ' class="due"' : '') + '><b>' + d.due + '</b> due</span></p><span class="mk-bar"><i style="width:' + pct + '%"></i></span>' +
          '<div class="cd-da">' + (d.due ? '<button type="button" class="btn dark small" data-rev="' + code + '">Review ' + d.due + '</button>' : '') + (d.n ? '<button type="button" class="btn line small" data-browse="' + code + '">' + (S.browse === code ? 'Hide cards' : 'Browse') + '</button>' : '') + '<a class="btn line small" href="/dashboard/practice/' + code + '?w=parse">+ From my notes</a></div>' +
          (S.browse === code ? '<ul class="cd-list">' + (S.all || []).filter(function (c) { return c.code === code; }).map(function (c) { return '<li><div><b>' + esc(c.front) + '</b><p>' + esc(c.back) + '</p></div><span class="cd-due">' + (c.due && c.due > ST.today() ? 'Next: ' + esc(day(c.due)) : 'Due') + '</span><button type="button" class="mk-x" data-cdel="' + c.id + '" aria-label="Delete this card">×</button></li>'; }).join('') + '</ul>' : '') + '</li>';
      }).join('') + '</ul>';
      if (!codes.length) html += '<section class="mk-card"><p>No cards yet. Answer a quick-recall question or get an answer marked and your first cards appear here.</p></section>';
      el.innerHTML = html;
      if (pm && !S.rev) { var dk = $('cd-' + pm); if (dk) dk.scrollIntoView({ block: 'center' }); }
    };
    function reviewHtml() {
      var r = S.rev, c = r.list[r.i];
      if (!c) return '<section class="mk-card cd-done"><h2>Deck done</h2><p>' + r.done + ' card' + (r.done === 1 ? '' : 's') + ' reviewed. They’ll come back when they’re due.</p><button type="button" class="btn primary" data-revend="1">Back to decks</button></section>';
      var m = S.mods.filter(function (x) { return x.code === c.code; })[0];
      return '<section class="cd-rev"><div class="mk-row"><span class="db-kick">' + esc(r.code || 'All decks') + ' · ' + (r.list.length - r.i) + ' left</span><button type="button" class="mk-clear" data-revend="1">× End review</button></div><span class="mk-bar"><i style="width:' + Math.round(r.done / (r.done + r.list.length - r.i) * 100) + '%"></i></span>' +
        '<div class="td-fc cd-fc"><span class="meta">' + esc(c.code) + (m ? ' · ' + esc(m.title) : '') + '</span><div class="front">' + esc(c.front) + '</div>' +
        (r.show ? '<div class="back">' + esc(c.back) + '</div><div class="td-grades"><button type="button" class="btn line small" data-cgrade="again">Again <kbd>1</kbd></button><button type="button" class="btn dark small" data-cgrade="good">Good <kbd>2</kbd></button><button type="button" class="btn line small" data-cgrade="easy">Easy <kbd>3</kbd></button></div>'
          : '<div><button type="button" class="btn dark small" data-cflip="1">Show answer <kbd>Space</kbd></button></div>') + '</div></section>';
    }
    function grade(g) {
      var r = S.rev, c = r.list[r.i]; if (!c) return;
      var n = ST.schedule(c, g); Object.assign(c, n);
      if (g === 'again') r.list.push(c); else r.done++;
      r.i++; r.show = false; track('card_' + g);
      rest('review_cards?id=eq.' + c.id, { method: 'PATCH', prefer: 'return=minimal', body: n }).catch(function () {});
      if (S.cards && g !== 'again') S.cards = S.cards.filter(function (x) { return x.id !== c.id; });
      renderTop(); draw();
    }
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-rev')) { var code = b.getAttribute('data-rev'), t = ST.today(); S.rev = { code: code, i: 0, done: 0, show: false, list: (S.all || []).filter(function (c) { return (!code || c.code === code) && (!c.due || c.due <= t); }) }; track('deck_review'); draw(); window.scrollTo(0, 0); }
      else if (b.hasAttribute('data-revend')) { S.rev = null; draw(); }
      else if (b.hasAttribute('data-cflip')) { S.rev.show = true; draw(); }
      else if (b.hasAttribute('data-cgrade')) grade(b.getAttribute('data-cgrade'));
      else if (b.hasAttribute('data-browse')) { var bc = b.getAttribute('data-browse'); S.browse = S.browse === bc ? null : bc; draw(); }
      else if (b.hasAttribute('data-cdel') && confirm('Delete this card?')) { var id = b.getAttribute('data-cdel'); S.all = S.all.filter(function (c) { return c.id !== id; }); if (S.cards) S.cards = S.cards.filter(function (c) { return c.id !== id; }); rest('review_cards?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' }).catch(function () {}); renderTop(); draw(); }
    };
    cardKeys = function (e) {
      if (tabOf(location.pathname) !== 'cards' || !S.rev || PAL.open || /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
      if (e.key === ' ' && !S.rev.show) { e.preventDefault(); S.rev.show = true; draw(); }
      else if (S.rev.show && /^[123]$/.test(e.key)) grade(['again', 'good', 'easy'][+e.key - 1]);
    };
    draw();
    loadAllCards().then(draw).catch(function () { S.all = []; draw(); });
  }
  var cardKeys = null;
  document.addEventListener('keydown', function (e) { if (cardKeys) cardKeys(e); });

  // ---------- Exam simulator (revision mode): one unseen question, a strict clock, no hints ----------
  function renderExam() {
    var el = $('db-exam'), x = S.exam, pm = new URLSearchParams(location.search).get('m');
    if (pm && hasMod(pm)) x.code = pm;
    if (!x.code || !hasMod(x.code)) x.code = S.mods[0] && S.mods[0].code;
    var html = '<header class="db-hello"><span class="db-kick">Revision mode · Exam simulator</span><h1>Exam simulator</h1><p>One question you haven’t seen, a clock that counts down, and no hints or mark scheme until it’s marked. The closest thing to the exam hall.</p></header>';
    if (!S.mods.length) { el.innerHTML = html + '<a class="btn primary" href="/dashboard/practice">Add a module first</a>'; return; }
    var qs = S.today ? S.today.qs.filter(function (q) { return q.code === x.code && q.tier !== 'foundation'; }) : null;
    var done = {}; (S.attempts || []).forEach(function (a) { if (a.question_id) done[a.question_id] = true; });
    var pool = qs ? qs.filter(function (q) { return (x.tier === 'any' || q.tier === x.tier) && (!x.fresh || !done[q.id]); }) : [];
    var seg = function (name, val, opts) { return '<div class="ex-seg" role="radiogroup" aria-label="' + name + '">' + opts.map(function (o) { return '<button type="button" role="radio" aria-checked="' + (String(val) === String(o[0])) + '" data-ex="' + name + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>'; };
    html += '<section class="mk-card ex-set"><label class="mk-lab" for="ex-mod">Module</label><select id="ex-mod">' + S.mods.map(function (m) { return '<option value="' + m.code + '"' + (m.code === x.code ? ' selected' : '') + '>' + esc(m.code + ' ' + m.title) + '</option>'; }).join('') + '</select>' +
      '<div class="ex-row"><div><span class="mk-lab">Paper</span>' + seg('tier', x.tier, [['exam', 'Exam-style'], ['first', 'First-class stretch'], ['any', 'Either']]) + '</div><div><span class="mk-lab">Time allowed</span>' + seg('min', x.min, [[30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '90 min']]) + '</div></div>' +
      '<label class="mk-check"><input type="checkbox" id="ex-fresh"' + (x.fresh ? ' checked' : '') + '> Only questions I haven’t answered yet</label>';
    if (qs === null) html += '<p class="mk-hint">Loading questions…</p>';
    else if (!qs.length) html += '<div class="mk-warn">' + esc(x.code) + ' doesn’t have practice questions yet. <a href="/dashboard/practice/' + x.code + '">Open it once</a> to write its Module Map (about a minute), then come back.</div>';
    else if (!pool.length) html += '<div class="mk-warn">You’ve answered every ' + (x.tier === 'first' ? 'First-class' : x.tier === 'exam' ? 'exam-style' : '') + ' question in ' + esc(x.code) + '. Untick “only questions I haven’t answered” to sit one again.</div>';
    html += '<div class="ex-go"><p><b>' + (pool.length || 0) + '</b> question' + (pool.length === 1 ? '' : 's') + ' in the pool · picked at random · timer starts as soon as you open it</p><button type="button" class="btn primary big td-go" id="ex-start"' + (pool.length ? '' : ' disabled') + '>Start the exam<span class="arr" aria-hidden="true">→</span></button></div></section>' +
      '<ul class="ex-rules"><li><b>No hints.</b> Worked steps, the mark scheme and examiner warnings stay hidden until it’s marked.</li><li><b>The clock is real.</b> It turns red when you go over, and the time you took is sent with your answer.</li><li><b>Same marking.</b> Your answer is marked against your department’s criteria, with a full mark allocation afterwards.</li></ul>';
    el.innerHTML = html;
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-ex')) { var k = b.getAttribute('data-ex'), v = b.getAttribute('data-v'); x[k] = k === 'min' ? +v : v; renderExam(); }
      if (b.id === 'ex-start' && pool.length) { var q = pool[Math.floor(Math.random() * pool.length)]; track('exam_start'); nav('/dashboard/practice/' + x.code + '?q=' + q.id + '&v=answer&exam=' + x.min); }
    };
    el.onchange = function (e) { if (e.target.id === 'ex-mod') { x.code = e.target.value; history.replaceState(null, '', '/dashboard/exam?m=' + x.code); renderSide(); renderExam(); } if (e.target.id === 'ex-fresh') { x.fresh = e.target.checked; renderExam(); } };
    if (!S.today) refreshStudy();
  }

  // ---------- Play (Unwind, the daily word game in play.js) ----------
  function renderPlay() {
    if (!window.UnizyWeb) {
      // play.js talks to the site through this small bridge (the old study app provided the same one)
      window.UnizyWeb = { _internal: {
        Auth: {
          get session() { var s = getSession(); return s && s.access_token ? s : null; },
          headers: function () { var s = getSession(), h = { apikey: CFG.anonKey, 'Content-Type': 'application/json' }; if (s && s.access_token) h.Authorization = 'Bearer ' + s.access_token; return h; }
        },
        Sync: { rest: function (path, opts) { return rawRest(path, opts); } }
      } };
    }
    if (window.UnizyPlay) window.UnizyPlay.mount(null, { uniId: uniId(), uniShort: UN().short });
  }

  // ---------- Marked answers (history) ----------
  function renderHistory() {
    var el = $('db-history');
    var open = new URLSearchParams(location.search).get('a');
    if (open) S.histOpen[open] = true;
    var draw = function () {
      var all = S.attempts || [];
      var codes = []; all.forEach(function (x) { if (codes.indexOf(x.code) < 0) codes.push(x.code); });
      var list = S.histMod ? all.filter(function (x) { return x.code === S.histMod; }) : all;
      var html = '<header class="db-hello"><h1>Marked answers</h1><p>Every answer you’ve had marked, newest first.</p></header>';
      if (S.attempts === null) { el.innerHTML = html + '<p class="mk-hint">Loading…</p>'; return; }
      if (!all.length) { el.innerHTML = html + '<section class="mk-card"><p>No marked answers yet.</p><a class="btn primary" href="/dashboard/practice">Practise a question</a></section>'; return; }
      html += '<div class="db-filter"><label for="db-hmod">Module</label><select id="db-hmod"><option value="">All modules (' + all.length + ')</option>' + codes.map(function (c) { var n = all.filter(function (x) { return x.code === c; }).length; return '<option value="' + c + '"' + (S.histMod === c ? ' selected' : '') + '>' + esc(c) + ' (' + n + ')</option>'; }).join('') + '</select></div>';
      html += chart(list);
      html += '<ul class="db-hlist">' + list.map(function (x) {
        var r = x.result || {}, on = !!S.histOpen[x.id];
        var body = on ? '<div class="db-hbody"><p class="mk-headline">' + esc(r.headline || '') + '</p>' +
          (r.criteria && r.criteria.length ? '<ul class="mk-crit">' + r.criteria.map(function (c) { return '<li><span class="mk-cls ' + clsSlug(c.band) + '">' + esc(c.band || '–') + '</span><div><b>' + esc(c.name) + '</b><p>' + esc(c.comment) + '</p></div></li>'; }).join('') + '</ul>' : '') +
          (r.allocation && r.allocation.length ? '<h3>Mark allocation</h3><ul class="mk-alloc">' + r.allocation.map(function (a) { return '<li><span class="it">' + esc(a.item) + '</span><span class="sc"><b>' + a.awarded + '</b>/' + a.available + '</span><span class="ab"><i style="width:' + Math.round(a.awarded / a.available * 100) + '%"></i></span></li>'; }).join('') + '</ul>' : '') +
          (r.warnings && r.warnings.length ? '<div class="mk-warns">' + r.warnings.map(function (w) { return '<p class="mk-wcall"><b>Examiner warning</b>' + esc(w) + '</p>'; }).join('') + '</div>' : '') +
          (r.changes && r.changes.length ? '<h3>3 changes to move up a class</h3><ol class="mk-changes">' + r.changes.map(function (c) { return '<li><b>' + esc(c.change) + '</b>' + (c.why ? '<span>' + esc(c.why) + '</span>' : '') + '</li>'; }).join('') + '</ol>' : '') +
          (r.lost && r.lost.length ? '<h3>Where you lost marks</h3><ol class="mk-lostlist">' + r.lost.map(function (l, i) { return '<li><span class="n">' + (i + 1) + '</span><div>' + (l.quote ? '<q>' + esc(l.quote) + '</q>' : '') + '<p><b>Why:</b> ' + esc(l.issue) + '</p>' + (l.fix ? '<p class="fix"><b>Fix:</b> ' + esc(l.fix) + '</p>' : '') + '</div></li>'; }).join('') + '</ol>' : '') +
          (r.model_plan && r.model_plan.length ? '<details class="db-det"><summary>A First-class plan</summary><ul class="mk-plan">' + r.model_plan.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + (r.model_paragraph ? '<div class="mk-prose mk-modelp">' + paras(r.model_paragraph) + '</div>' : '') + '</details>' : '') +
          '<details class="db-det"><summary>Your answer</summary><div class="mk-prose">' + paras(x.answer || '') + '</div></details>' +
          (r.example_answer ? '<details class="db-det"><summary>Example First-class answer</summary><div class="mk-prose">' + paras(r.example_answer) + '</div></details>' : '') +
          '<div class="mk-row start"><a class="btn dark small" href="/dashboard/practice/' + x.code + (x.question_id ? '?q=' + x.question_id + '&v=answer' : '') + '">Try it again</a><button type="button" class="btn line small" data-hdel="' + x.id + '">Delete</button></div></div>' : '';
        return '<li class="db-hitem' + (on ? ' open' : '') + '"><button type="button" class="db-htop" data-hopen="' + x.id + '" aria-expanded="' + on + '"><span class="mk-cls ' + clsSlug(r.class) + '">' + esc(r.class || '?') + '</span><span class="db-hq"><b>' + esc(x.code) + '</b> ' + esc(String(x.question).slice(0, 160)) + (String(x.question).length > 160 ? '…' : '') + '</span><span class="mk-hm">' + (r.mark_low != null ? r.mark_low + '–' + r.mark_high : '') + ' · ' + day(x.created_at) + '</span></button>' + body + '</li>';
      }).join('') + '</ul>';
      el.innerHTML = html;
      if (open) { var it = el.querySelector('[data-hopen="' + open + '"]'); if (it) it.scrollIntoView({ block: 'start' }); }
    };
    draw();
    loadAttempts().then(function () { if (tabOf(location.pathname) === 'history') draw(); }).catch(function () {});
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-hopen')) { var id = b.getAttribute('data-hopen'); S.histOpen[id] = !S.histOpen[id]; draw(); }
      if (b.hasAttribute('data-hdel') && confirm('Delete this marked answer?')) {
        var did = b.getAttribute('data-hdel');
        rest('mark_attempts?id=eq.' + did, { method: 'DELETE', prefer: 'return=minimal' }).then(function () { S.attempts = S.attempts.filter(function (x) { return x.id !== did; }); draw(); });
      }
    };
    el.onchange = function (e) { if (e.target.id === 'db-hmod') { S.histMod = e.target.value; draw(); } };
  }
  function chart(list) {
    var pts = list.slice().reverse().map(function (x) { return mid(x.result); }).filter(function (v) { return v != null; });
    if (pts.length < 2) return '';
    var w = 640, h = 150, padL = 34, padB = 8, min = 30, max = 85, step = (w - padL - 10) / (pts.length - 1);
    var y = function (v) { return 8 + (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min)) * (h - 16 - padB); };
    var lines = [40, 50, 60, 70].map(function (b) { return '<line x1="' + padL + '" x2="' + (w - 6) + '" y1="' + y(b) + '" y2="' + y(b) + '" class="' + (b === 70 ? 'l70' : 'lg') + '"/><text x="' + (padL - 6) + '" y="' + (y(b) + 4) + '" text-anchor="end">' + (b === 70 ? 'First' : b === 60 ? '2:1' : b === 50 ? '2:2' : '3rd') + '</text>'; }).join('');
    var poly = pts.map(function (v, i) { return (padL + i * step).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
    var dots = pts.map(function (v, i) { return '<circle cx="' + (padL + i * step).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5"/>'; }).join('');
    return '<figure class="db-chart"><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Your marks over time">' + lines + '<polyline points="' + poly + '"/>' + dots + '</svg><figcaption>Your marks over time (middle of each range)</figcaption></figure>';
  }

  // ---------- Tutor ----------
  var TKEY = 'smg:tutor:';
  function chatGet(code) { try { return JSON.parse(localStorage.getItem(TKEY + code) || '[]'); } catch (e) { return []; } }
  function chatSet(code, list) { try { if (list.length) localStorage.setItem(TKEY + code, JSON.stringify(list.slice(-40))); else localStorage.removeItem(TKEY + code); } catch (e) {} }
  function tutorModule() {
    var m = new URLSearchParams(location.search).get('m');
    var mod = S.mods.filter(function (x) { return x.code === m; })[0];
    return mod || S.mods[0] || null;
  }
  function renderTutor() {
    var el = $('db-tutor'), mod = tutorModule();
    if (!S.mods.length) { el.innerHTML = '<header class="db-hello"><h1>Tutor</h1><p>Add a module first so your tutor knows what you’re studying.</p></header><a class="btn primary" href="/dashboard/practice">Find a module</a>'; return; }
    var name = tutorName(mod.department, mod.uni), chat = chatGet(mod.code);
    var html = '<header class="db-hello"><h1>' + esc(name) + '</h1><p>Your tutor for ' + esc(mod.code) + ' ' + esc(mod.title) + '. Ask about anything in the module, or how to approach an exam question.</p></header>';
    html += '<div class="db-tmods">' + S.mods.map(function (m) { return '<a href="/dashboard/tutor?m=' + m.code + '" class="db-tmod' + (m.code === mod.code ? ' on' : '') + '">' + esc(m.code) + '</a>'; }).join('') + '</div>';
    html += '<div class="db-chat" id="db-chat">' + (chat.length ? chat.map(msgHtml).join('') : '<div class="db-msg tutor"><div class="db-bubble"><p>Hi! I’m ' + esc(name) + '. Ask me to explain a topic from ' + esc(mod.title) + ', check your understanding, or plan an answer to an exam question.</p></div></div>') + (S.tutorBusy ? '<div class="db-msg tutor"><div class="db-bubble"><p class="mk-busy"><span class="spin"></span>Thinking…</p></div></div>' : '') + '</div>';
    var tr = ttray(mod);
    html += '<form class="db-ask" id="db-ask"><textarea id="db-q" rows="2" placeholder="Ask ' + esc(name) + ' about ' + esc(mod.code) + '… (Enter to send, Shift+Enter for a new line)"' + (S.tutorBusy ? ' disabled' : '') + '></textarea><button class="btn primary" type="submit"' + (S.tutorBusy ? ' disabled' : '') + '>Send</button></form>' + (tr ? tr.html() : '');
    html += '<div class="mk-row"><p class="db-err" id="db-terr" hidden></p>' + (chat.length ? '<button type="button" class="mk-clear" id="db-tclear">× Clear this chat</button>' : '') + '</div>';
    var draft = $('db-q') ? $('db-q').value : '';
    el.innerHTML = html;
    if (draft) $('db-q').value = draft;
    var c = $('db-chat'); c.scrollTop = c.scrollHeight;
    $('db-ask').onsubmit = function (e) { e.preventDefault(); askTutor(mod); };
    $('db-q').onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); askTutor(mod); } };
    if (tr) tr.mount();
    if ($('db-tclear')) $('db-tclear').onclick = function () { if (confirm('Clear this chat?')) { chatSet(mod.code, []); renderTutor(); } };
  }
  function msgHtml(m) { return '<div class="db-msg ' + (m.role === 'user' ? 'me' : 'tutor') + '"><div class="db-bubble">' + (m.role === 'user' ? paras(m.content) : md(m.content)) + (m.att ? '<div class="ua-chips">' + m.att.split(', ').map(function (a) { return '<span class="ua-chip">📎 ' + esc(a) + '</span>'; }).join('') + '</div>' : '') + '</div></div>'; }
  // files, photos and videos sent with a tutor question (attach.js); one tray per module, kept while the dashboard is open
  function ttray(mod) { return window.UnizyAttach ? window.UnizyAttach.tray('tutor:' + mod.code) : null; }
  var detailCache = {};
  function moduleContext(mod) {
    if (detailCache[mod.code]) return Promise.resolve(detailCache[mod.code]);
    return rest('ucl_modules?select=details,summary,uni,programmes,year_of_study,mtype,ects,credits,status,url&code=eq.' + mod.code).then(function (r) {
      var d = (r && r[0]) || {};
      var size = d.uni === 'lse' ? (d.credits == 0.5 ? ', half unit' : d.credits == 1 ? ', full unit' : '') : d.uni === 'qmul' ? (d.credits ? ', ' + d.credits + ' credits' : '') : (d.ects ? ', ' + d.ects + ' ECTS' : '');
      var extra = d.uni && d.uni !== 'ucl' ? [UN(d.uni).name + (d.uni === 'lse' ? ' course ' : ' module ') + mod.code + ' ' + mod.title + size + (d.year_of_study ? ', usually taken in Year ' + d.year_of_study : '') + (d.mtype ? ' (' + d.mtype + ')' : '') + (d.status ? '. ' + d.status : '') + '.', d.programmes && d.programmes.length ? 'Part of: ' + d.programmes.join('; ') + '.' : '', d.url ? 'Source: ' + d.url : ''].filter(Boolean).join('\n') : '';
      detailCache[mod.code] = ([d.details || d.summary || '', extra].filter(Boolean).join('\n\n')).slice(0, 3500); return detailCache[mod.code]; }).catch(function () { return mod.summary || ''; });
  }
  function askTutor(mod) {
    var q = ($('db-q').value || '').trim(), tr = ttray(mod), hasAtt = !!(tr && tr.count());
    if ((!q && !hasAtt) || S.tutorBusy) return;
    if (hasAtt && tr.busy()) { var eb = $('db-terr'); if (eb) { eb.hidden = false; eb.textContent = 'Your attachments are still being prepared. Send again in a moment.'; } return; }
    var attachments = hasAtt ? tr.payload() : null, attSum = hasAtt ? tr.summary() : '';
    if (!q) q = 'Can you take a look at what I’ve attached?';
    var msg = { role: 'user', content: q }; if (hasAtt) msg.att = attSum;
    var chat = chatGet(mod.code); chat.push(msg); chatSet(mod.code, chat);
    $('db-q').value = ''; S.tutorBusy = true; renderTutor();
    track('tutor_ask');
    var name = tutorName(mod.department, mod.uni), p = S.profile || {}, Un = UN(mod.uni);
    moduleContext(mod).then(function (desc) {
      var intro = 'You are ' + name + ', a friendly, expert tutor on ' + BRAND + ' for ' + Un.long + ' students. The student is studying ' + mod.code + ' ' + mod.title + ' at ' + Un.name + ' (' + (mod.department || Un.short) + (levelName(mod.level) ? ', ' + levelName(mod.level) : '') + ')' + (p.course ? ' on the ' + p.course + ' course' : '') + '.\n\n' + Un.src + ':\n"""' + desc + '"""\n\nHow to tutor: explain clearly at the right level for this module, use short examples, check understanding with a quick question when useful, and show how ideas would earn marks in ' + Un.exam + '. Keep replies under about 250 words unless the student asks for more. Use short paragraphs and "- " bullet lists; no headings or tables. Never write coursework or assessed essays for the student to submit; for coursework, give guidance and feedback only. Refer to yourself as ' + name + ' and don’t mention the technology behind you unless the student sincerely asks what you are, in which case be honest. Never invent sources, cases, statistics or quotations.';
      var turns = [{ role: 'user', content: intro }, { role: 'assistant', content: 'Understood. I’m ' + name + ', ready to help with ' + mod.code + '.' }].concat(chat.slice(-16).map(function (m) { return { role: m.role, content: m.att ? m.content + '\n\n[Attached: ' + m.att + ']' : m.content }; }));
      return token().then(function (t) {
        if (!t) { toLogin(); throw new Error('signin'); }
        return fetch(CFG.supabaseUrl + '/functions/v1/ai', { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ input: turns, kind: 'tutor', cache: false, stream: false, attachments: attachments || undefined }) });
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) { var e = new Error(b.message || 'Your tutor had a problem. Try again.'); e.upgrade = !!b.upgrade; throw e; }
        return b;
      });
    }).then(function (b) {
      var c2 = chatGet(mod.code); c2.push({ role: 'assistant', content: b.text || '…' }); chatSet(mod.code, c2);
      if (hasAtt) tr.clear();
      S.tutorBusy = false; if (tabOf(location.pathname) === 'tutor') renderTutor();
    }).catch(function (e) {
      S.tutorBusy = false;
      if (tabOf(location.pathname) !== 'tutor') return;
      renderTutor();
      var er = $('db-terr'); if (er) { er.hidden = false; er.innerHTML = esc(e.message) + (e.upgrade ? ' <a href="/pricing">See Pro</a>' : ''); }
      var c3 = chatGet(mod.code); if (c3.length && c3[c3.length - 1].role === 'user') { $('db-q').value = c3.pop().content; chatSet(mod.code, c3); renderTutor(); var er2 = $('db-terr'); if (er2) { er2.hidden = false; er2.innerHTML = esc(e.message) + (e.upgrade ? ' <a href="/pricing">See Pro</a>' : ''); } }
    });
  }

  // ---------- Account ----------
  function renderAccount() {
    var el = $('db-account'), s = getSession() || {}, u = s.user || {}, p = S.profile || {}, pl = S.plan;
    var plan = !pl ? 'Loading…' : pl.tier === 'pro' ? 'Pro until ' + new Date(pl.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : pl.tier === 'trial' ? 'Free trial until ' + new Date(pl.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) + (pl.assessPerDay ? '. Today: ' + Math.max(0, pl.assessLeft) + ' of ' + pl.assessPerDay + ' markings and ' + Math.max(0, pl.actionsLeft) + ' of ' + pl.actionsPerDay + ' tutor questions left' : '') : 'Free trial ended. Go Pro to keep using marking and the tutor';
    el.innerHTML = '<header class="db-hello"><h1>Account</h1></header>' +
      '<section class="mk-card"><dl class="db-dl"><dt>Name</dt><dd>' + esc(u.name || '–') + '</dd><dt>Email</dt><dd>' + esc(u.email || '') + '</dd><dt>University</dt><dd>' + esc(UN().name) + '</dd><dt>Course</dt><dd>' + esc(p.course || '–') + (p.year ? ', Year ' + p.year : '') + ' <button type="button" class="mk-clear" id="db-recourse">Change</button></dd><dt>Plan</dt><dd>' + esc(plan) + '</dd></dl>' +
      '<div class="mk-row start">' + (pl && pl.tier === 'pro' ? (CFG.stripe && CFG.stripe.portal ? '<a class="btn line small" href="' + esc(CFG.stripe.portal) + '" target="_blank" rel="noopener">Manage billing</a>' : '') : '<a class="btn primary small" href="/pricing">Go Pro</a>') + '<a class="btn line small" href="/reset.html">Change password</a><button type="button" class="btn line small" id="db-logout">Log out</button><button type="button" class="btn line small" id="db-tour">Replay the dashboard tour</button></div></section>' +
      '<section class="mk-card"><h2>Your modules</h2><ul class="db-mlist">' + (S.mods.length ? S.mods.map(function (m) { return '<li><span class="db-mcode">' + esc(m.code) + '</span><span>' + esc(m.title) + '</span><button type="button" class="mk-x" data-rm="' + m.code + '" aria-label="Remove ' + esc(m.code) + '">×</button></li>'; }).join('') : '<li class="db-empty">No modules yet.</li>') + '</ul><a class="btn line small" href="/dashboard/practice">+ Add a module</a></section>' +
      '<p class="db-more">Need help? Email <a href="mailto:' + esc(CFG.contactEmail || 'hello@unizy.uk') + '">' + esc(CFG.contactEmail || 'hello@unizy.uk') + '</a>. Notes and flashcards are in the <a href="/app">study tools</a>.</p>';
    $('db-logout').onclick = logout;
    $('db-tour').onclick = function () { nav('/dashboard'); track('tour_replay'); setTimeout(function () { if (window.UnizyTour) window.UnizyTour.start(tourCtx()); }, 700); };
    $('db-recourse').onclick = function () { S.setup = null; S.profile = null; loadCourses().then(renderSetup); };
    el.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { removeMod(b.getAttribute('data-rm')).then(renderAccount); }; });
  }
  function logout() {
    token().then(function (t) { if (t) fetch(CFG.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + t } }).catch(function () {}); });
    try { localStorage.removeItem(SKEY); } catch (e) {}
    location.href = '/';
  }

  // ---------- start ----------
  function boot() {
    var s = getSession();
    if (!s || !s.access_token) { toLogin(); return; }
    if (window.UnizyWelcome) window.UnizyWelcome.prehide(s);
    $('db-menu').onclick = function () { $('db').classList.toggle('menu'); };
    token().then(function (t) {
      if (!t) { try { localStorage.removeItem(SKEY); } catch (e) {} toLogin(); return; }
      return Promise.all([
        rest('study_profile?select=uni,course,course_id,department,year').then(function (r) { S.profile = (r && r[0]) || null; }),
        loadMods(), loadPlan(), loadCourses()
      ]).then(function () {
        // older accounts that already have modules skip set-up
        if (!S.profile && S.mods.length) S.profile = { course: null, year: null };
        show();
        refreshStudy();
        if (window.Marker && tabOf(location.pathname) === 'practice') window.Marker.render();
        rest('rpc/touch_activity', { method: 'POST', body: '{}' }).then(function (d) { if (d && d.excluded) { try { localStorage.setItem('unizy:notrack', '1'); } catch (e) {} } }).catch(function () {});
        if (window.UnizyWelcome) window.UnizyWelcome.check(rawRest, null, uid());
      });
    }).catch(function (e) {
      if (e && e.message === 'signin') return;
      $('db-setup').innerHTML = '<div class="db-setup-in"><h1>Couldn’t load your dashboard</h1><p>' + esc(e && e.message || 'Check your connection and try again.') + '</p><button class="btn primary" onclick="location.reload()">Try again</button></div>';
      $('db').classList.add('setup');
      if (window.UnizyWelcome) window.UnizyWelcome.release();
    });
  }
  boot();
})();
