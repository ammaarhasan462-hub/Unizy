/* SaveMyGrade dashboard: the signed-in area. Separate tabs (Home, Practice & marking, Tutor, Marked answers,
   Account), your modules kept in the sidebar, and a first-run "pick your course" set-up.
   The Practice tab runs the marker (mark.js) under /dashboard/practice. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG, BRAND = (window.SITE_BRAND || {}).name || 'SaveMyGrade', SKEY = 'unizy.session';
  var TABS = [
    { id: 'home', label: 'Home', path: '/dashboard', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
    { id: 'practice', label: 'Practice & marking', path: '/dashboard/practice', icon: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4' },
    { id: 'tutor', label: 'Tutor', path: '/dashboard/tutor', icon: 'M4 5h16v11H8l-4 4z' },
    { id: 'history', label: 'Marked answers', path: '/dashboard/history', icon: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5' },
    { id: 'account', label: 'Account', path: '/dashboard/account', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0' }
  ];
  var S = { session: null, profile: undefined, mods: [], attempts: null, plan: null, courses: null, depts: null, setup: null, tutorBusy: false, histOpen: {}, histMod: '' };
  var $ = function (id) { return document.getElementById(id); };

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
  function tutorName(dept) { return /medic|surgery|neurolog|infection|cardio|cancer|health|ear institute|pharmacy/i.test(dept || '') ? 'Dr UCL' : 'Professor UCL'; }
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
    renderSide();
    if (tab === 'home') renderHome();
    else if (tab === 'practice') { if (window.Marker) window.Marker.route(); }
    else if (tab === 'tutor') renderTutor();
    else if (tab === 'history') renderHistory();
    else if (tab === 'account') renderAccount();
    window.scrollTo(0, 0);
  }

  // ---------- data ----------
  function loadMods() {
    return rest('my_modules?select=code,added_at,ucl_modules(code,title,level,credits,department,summary)&order=added_at.asc').then(function (rows) {
      S.mods = (rows || []).map(function (r) { return r.ucl_modules || { code: r.code, title: r.code }; });
    });
  }
  function loadAttempts() {
    return rest('mark_attempts?select=id,code,question,question_id,answer,minutes,result,real_mark,created_at&order=created_at.desc&limit=300').then(function (rows) { S.attempts = rows || []; return S.attempts; });
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
  window.MarkHooks = {
    myModules: function () { return S.mods; },
    has: hasMod,
    toggle: function (mod) { return hasMod(mod.code) ? removeMod(mod.code) : addMods([mod]); }
  };

  // ---------- sidebar ----------
  function renderSide() {
    var el = $('db-mods'); if (!el) return;
    var cur = (/\/dashboard\/practice\/([A-Z]{4}[0-9]{4})/.exec(location.pathname) || [])[1];
    el.innerHTML = S.mods.length ? S.mods.map(function (m) {
      return '<li><a href="/dashboard/practice/' + m.code + '"' + (cur === m.code ? ' aria-current="page"' : '') + '><span class="db-mcode">' + esc(m.code) + '</span><span class="db-mtitle">' + esc(m.title) + '</span></a></li>';
    }).join('') : '<li class="db-empty">No modules yet.</li>';
  }
  function closeMenu() { var d = $('db'); if (d) d.classList.remove('menu'); }

  // ---------- first-run set-up: course, year, modules ----------
  function loadCourses() {
    if (S.courses) return Promise.resolve(S.courses);
    return fetch('/data/ucl-courses.json').then(function (r) { return r.json(); }).then(function (c) { S.courses = c; return c; }).catch(function () { S.courses = []; return []; });
  }
  function loadDepts() {
    if (S.depts) return Promise.resolve(S.depts);
    return rest('ucl_departments?select=department,ug_modules&ug_modules=gt.0&order=department.asc').then(function (d) { S.depts = d || []; return S.depts; });
  }
  function renderSetup() {
    $('db').classList.add('setup');
    var st = S.setup || (S.setup = { step: 1, course: null, dept: '', name: '', year: null, picks: {}, sugg: null, q: '', results: [] });
    var box = $('db-setup'), html = '<div class="db-setup-in"><p class="db-steps"><span' + (st.step === 1 ? ' class="on"' : '') + '>1. Course</span><span' + (st.step === 2 ? ' class="on"' : '') + '>2. Year</span><span' + (st.step === 3 ? ' class="on"' : '') + '>3. Modules</span></p>';
    if (st.step === 1) {
      html += '<h1>' + (firstName() ? 'Welcome, ' + esc(firstName()) + '. ' : '') + 'What do you study at UCL?</h1><p class="lead">We’ll suggest your modules. You can add or remove any of them later.</p>';
      html += '<div class="db-courses">' + (S.courses || []).map(function (c) { return '<button type="button" class="db-course' + (st.course && st.course.id === c.id ? ' on' : '') + '" data-course="' + c.id + '">' + esc(c.name) + '</button>'; }).join('') +
        '<button type="button" class="db-course' + (st.course === 'other' ? ' on' : '') + '" data-course="other">My course isn’t listed</button></div>';
      if (st.course === 'other') {
        html += '<div class="db-other"><label class="mk-lab" for="db-cname">Your course</label><input id="db-cname" type="text" placeholder="e.g. History, Politics and Economics BA" value="' + esc(st.name) + '">' +
          '<label class="mk-lab" for="db-dept">Main department</label><select id="db-dept"><option value="">Choose a department…</option>' + (S.depts || []).map(function (d) { return '<option' + (st.dept === d.department ? ' selected' : '') + '>' + esc(d.department) + '</option>'; }).join('') + '</select></div>';
      }
      html += '<div class="db-setup-act"><button type="button" class="btn primary" data-setup="next1"' + (st.course ? '' : ' disabled') + '>Continue</button></div>';
    } else if (st.step === 2) {
      var years = st.course && st.course !== 'other' ? st.course.years : 4;
      html += '<h1>Which year are you in?</h1><div class="db-years">';
      for (var y = 1; y <= years; y++) html += '<button type="button" class="db-course' + (st.year === y ? ' on' : '') + '" data-year="' + y + '">Year ' + y + '</button>';
      html += '</div><div class="db-setup-act"><button type="button" class="btn line" data-setup="back">Back</button><button type="button" class="btn primary" data-setup="next2"' + (st.year ? '' : ' disabled') + '>Continue</button></div>';
    } else {
      html += '<h1>Pick your modules</h1><p class="lead">These stay in your sidebar so you can practise them in one click. Compulsory modules are ticked for you.</p>';
      if (st.sugg === null) html += '<p class="mk-hint">Finding your modules…</p>';
      else if (!st.sugg.length) html += '<p class="mk-hint">We couldn’t suggest modules for that year. Search for them below.</p>';
      else html += '<ul class="db-picks">' + st.sugg.map(function (m) { return '<li><label><input type="checkbox" data-pick="' + m.code + '"' + (st.picks[m.code] ? ' checked' : '') + '><span class="db-mcode">' + esc(m.code) + '</span><span>' + esc(m.title) + (m.compulsory ? ' <em>Compulsory</em>' : '') + '</span></label></li>'; }).join('') + '</ul>';
      var extra = Object.keys(st.picks).filter(function (c) { return st.picks[c] && !(st.sugg || []).some(function (m) { return m.code === c; }); });
      if (extra.length) html += '<p class="mk-lab">Also added</p><ul class="db-picks">' + extra.map(function (c) { var m = st.picks[c]; return '<li><label><input type="checkbox" data-pick="' + c + '" checked><span class="db-mcode">' + esc(c) + '</span><span>' + esc(m.title || '') + '</span></label></li>'; }).join('') + '</ul>';
      html += '<label class="mk-lab" for="db-sq">Add another module</label><input id="db-sq" type="search" autocomplete="off" placeholder="Search by code or title, e.g. HIST0003" value="' + esc(st.q) + '"><ul class="db-sres" id="db-sres"></ul>';
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
      var filt = /^[A-Za-z]{4}\d{0,4}$/.test(t) ? 'code=ilike.' + encodeURIComponent(t.toUpperCase() + '*') : 'or=(title.ilike.*' + encodeURIComponent(t) + '*,code.ilike.*' + encodeURIComponent(t) + '*)';
      rest('ucl_modules?select=code,title,level,department&' + filt + '&level=lte.7&order=level.asc,code.asc&limit=12').then(function (rows) { st.results = rows || []; setupResults(); }).catch(function () {});
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
      p = rest('ucl_modules?select=code,title,level,department,credits&department=eq.' + encodeURIComponent(st.dept) + '&level=eq.' + lvl + '&order=code.asc&limit=60');
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
    var body = { user_id: uid(), course: st.course === 'other' ? (st.name.trim() || null) : st.course.name, course_id: st.course === 'other' ? null : st.course.id, department: st.course === 'other' ? (st.dept || null) : null, year: st.year, updated_at: new Date().toISOString() };
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
    if (b.hasAttribute('data-course')) {
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

  // ---------- Home ----------
  function stats(list) {
    var marks = list.map(function (a) { return mid(a.result); }).filter(function (x) { return x != null; });
    var avg = marks.length ? marks.reduce(function (s, x) { return s + x; }, 0) / marks.length : null;
    return { n: list.length, avg: avg, best: marks.length ? Math.max.apply(null, marks) : null };
  }
  function renderHome() {
    var el = $('db-home');
    var draw = function () {
      var a = S.attempts || [], st = stats(a), p = S.profile || {};
      var html = '<header class="db-hello"><h1>' + (firstName() ? 'Hi ' + esc(firstName()) : 'Your dashboard') + '</h1><p>' + esc([p.course, p.year ? 'Year ' + p.year : ''].filter(Boolean).join(' · ') || 'UCL') + planChip() + '</p></header>';
      html += '<div class="db-stats"><div><b>' + st.n + '</b><span>answers marked</span></div><div><b>' + (st.avg != null ? clsOf(st.avg) : '–') + '</b><span>average class' + (st.avg != null ? ' (' + Math.round(st.avg) + ')' : '') + '</span></div><div><b>' + (st.best != null ? Math.round(st.best) : '–') + '</b><span>best mark</span></div><div><b>' + S.mods.length + '</b><span>modules</span></div></div>';
      if (!S.mods.length) html += '<section class="mk-card"><h2>Add your modules</h2><p>Pick the modules you’re taking and they’ll stay in your sidebar.</p><a class="btn primary" href="/dashboard/practice">Find a module</a></section>';
      else {
        html += '<section class="db-sec"><div class="mk-row"><h2>Your modules</h2><a class="btn line small" href="/dashboard/practice">+ Add a module</a></div><ul class="db-cards">' + S.mods.map(function (m) {
          var mine = a.filter(function (x) { return x.code === m.code; }), last = mine[0] && mine[0].result;
          return '<li class="db-card"><span class="db-mcode">' + esc(m.code) + '</span><h3>' + esc(m.title) + '</h3><p class="db-cmeta">' + (mine.length ? mine.length + ' marked · latest <span class="mk-cls ' + clsSlug(last.class) + '">' + esc(last.class) + '</span>' : 'Not practised yet') + '</p><div class="db-cact"><a class="btn dark small" href="/dashboard/practice/' + m.code + '">Practise</a><a class="btn line small" href="/dashboard/tutor?m=' + m.code + '">Ask tutor</a></div></li>';
        }).join('') + '</ul></section>';
      }
      if (a.length) {
        html += '<section class="db-sec"><div class="mk-row"><h2>Recent marked answers</h2><a class="btn line small" href="/dashboard/history">See all</a></div><ul class="mk-hist">' + a.slice(0, 5).map(histRow).join('') + '</ul></section>';
      }
      html += '<p class="db-more">Looking for notes and flashcards? <a href="/app">Open the study tools</a>.</p>';
      el.innerHTML = html;
    };
    draw();
    loadAttempts().then(function () { if (tabOf(location.pathname) === 'home') draw(); }).catch(function () {});
  }
  function planChip() {
    var p = S.plan; if (!p) return '';
    return ' <span class="db-chip' + (p.tier === 'free' ? '' : ' pro') + '">' + (p.tier === 'pro' ? 'Pro' : p.tier === 'trial' ? 'Pro trial' : 'Free plan') + '</span>';
  }
  function histRow(x) {
    var r = x.result || {};
    return '<li><span class="mk-cls ' + clsSlug(r.class) + '">' + esc(r.class || '?') + '</span><a class="mk-hq" href="/dashboard/history?a=' + x.id + '"><b>' + esc(x.code) + '</b> ' + esc(String(x.question).slice(0, 120)) + (String(x.question).length > 120 ? '…' : '') + '</a><span class="mk-hm">' + (r.mark_low != null ? r.mark_low + '–' + r.mark_high : '') + ' · ' + day(x.created_at) + '</span></li>';
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
          (r.changes && r.changes.length ? '<h3>3 changes to move up a class</h3><ol class="mk-changes">' + r.changes.map(function (c) { return '<li><b>' + esc(c.change) + '</b>' + (c.why ? '<span>' + esc(c.why) + '</span>' : '') + '</li>'; }).join('') + '</ol>' : '') +
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
    var name = tutorName(mod.department), chat = chatGet(mod.code);
    var html = '<header class="db-hello"><h1>' + esc(name) + '</h1><p>Your tutor for ' + esc(mod.code) + ' ' + esc(mod.title) + '. Ask about anything in the module, or how to approach an exam question.</p></header>';
    html += '<div class="db-tmods">' + S.mods.map(function (m) { return '<a href="/dashboard/tutor?m=' + m.code + '" class="db-tmod' + (m.code === mod.code ? ' on' : '') + '">' + esc(m.code) + '</a>'; }).join('') + '</div>';
    html += '<div class="db-chat" id="db-chat">' + (chat.length ? chat.map(msgHtml).join('') : '<div class="db-msg tutor"><div class="db-bubble"><p>Hi! I’m ' + esc(name) + '. Ask me to explain a topic from ' + esc(mod.title) + ', check your understanding, or plan an answer to an exam question.</p></div></div>') + (S.tutorBusy ? '<div class="db-msg tutor"><div class="db-bubble"><p class="mk-busy"><span class="spin"></span>Thinking…</p></div></div>' : '') + '</div>';
    html += '<form class="db-ask" id="db-ask"><textarea id="db-q" rows="2" placeholder="Ask ' + esc(name) + ' about ' + esc(mod.code) + '… (Enter to send, Shift+Enter for a new line)"' + (S.tutorBusy ? ' disabled' : '') + '></textarea><button class="btn primary" type="submit"' + (S.tutorBusy ? ' disabled' : '') + '>Send</button></form>';
    html += '<div class="mk-row"><p class="db-err" id="db-terr" hidden></p>' + (chat.length ? '<button type="button" class="mk-clear" id="db-tclear">× Clear this chat</button>' : '') + '</div>';
    var draft = $('db-q') ? $('db-q').value : '';
    el.innerHTML = html;
    if (draft) $('db-q').value = draft;
    var c = $('db-chat'); c.scrollTop = c.scrollHeight;
    $('db-ask').onsubmit = function (e) { e.preventDefault(); askTutor(mod); };
    $('db-q').onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); askTutor(mod); } };
    if ($('db-tclear')) $('db-tclear').onclick = function () { if (confirm('Clear this chat?')) { chatSet(mod.code, []); renderTutor(); } };
  }
  function msgHtml(m) { return '<div class="db-msg ' + (m.role === 'user' ? 'me' : 'tutor') + '"><div class="db-bubble">' + (m.role === 'user' ? paras(m.content) : md(m.content)) + '</div></div>'; }
  var detailCache = {};
  function moduleContext(mod) {
    if (detailCache[mod.code]) return Promise.resolve(detailCache[mod.code]);
    return rest('ucl_modules?select=details,summary&code=eq.' + mod.code).then(function (r) { var d = (r && r[0]) || {}; detailCache[mod.code] = (d.details || d.summary || '').slice(0, 3500); return detailCache[mod.code]; }).catch(function () { return mod.summary || ''; });
  }
  function askTutor(mod) {
    var q = ($('db-q').value || '').trim(); if (!q || S.tutorBusy) return;
    var chat = chatGet(mod.code); chat.push({ role: 'user', content: q }); chatSet(mod.code, chat);
    $('db-q').value = ''; S.tutorBusy = true; renderTutor();
    track('tutor_ask');
    var name = tutorName(mod.department), p = S.profile || {};
    moduleContext(mod).then(function (desc) {
      var intro = 'You are ' + name + ', a friendly, expert tutor on ' + BRAND + ' for UCL students. The student is studying ' + mod.code + ' ' + mod.title + ' (' + (mod.department || 'UCL') + (levelName(mod.level) ? ', ' + levelName(mod.level) : '') + ')' + (p.course ? ' on the ' + p.course + ' course' : '') + '.\n\nModule description from UCL’s public catalogue:\n"""' + desc + '"""\n\nHow to tutor: explain clearly at the right level for this module, use short examples, check understanding with a quick question when useful, and show how ideas would earn marks in a UCL exam answer. Keep replies under about 250 words unless the student asks for more. Use short paragraphs and "- " bullet lists; no headings or tables. Never write coursework or assessed essays for the student to submit; for coursework, give guidance and feedback only. Refer to yourself as ' + name + ' and don’t mention the technology behind you unless the student sincerely asks what you are, in which case be honest. Never invent sources, cases, statistics or quotations.';
      var turns = [{ role: 'user', content: intro }, { role: 'assistant', content: 'Understood. I’m ' + name + ', ready to help with ' + mod.code + '.' }].concat(chat.slice(-16));
      return token().then(function (t) {
        if (!t) { toLogin(); throw new Error('signin'); }
        return fetch(CFG.supabaseUrl + '/functions/v1/ai', { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ input: turns, kind: 'tutor', cache: false, stream: false }) });
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) { var e = new Error(b.message || 'Your tutor had a problem. Try again.'); e.upgrade = !!b.upgrade; throw e; }
        return b;
      });
    }).then(function (b) {
      var c2 = chatGet(mod.code); c2.push({ role: 'assistant', content: b.text || '…' }); chatSet(mod.code, c2);
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
    var plan = !pl ? 'Loading…' : pl.tier === 'pro' ? 'Pro until ' + new Date(pl.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : pl.tier === 'trial' ? 'Free Pro trial until ' + new Date(pl.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : 'Free plan';
    el.innerHTML = '<header class="db-hello"><h1>Account</h1></header>' +
      '<section class="mk-card"><dl class="db-dl"><dt>Name</dt><dd>' + esc(u.name || '–') + '</dd><dt>Email</dt><dd>' + esc(u.email || '') + '</dd><dt>Course</dt><dd>' + esc(p.course || '–') + (p.year ? ', Year ' + p.year : '') + ' <button type="button" class="mk-clear" id="db-recourse">Change</button></dd><dt>Plan</dt><dd>' + esc(plan) + '</dd></dl>' +
      '<div class="mk-row start">' + (pl && pl.tier === 'pro' ? (CFG.stripe && CFG.stripe.portal ? '<a class="btn line small" href="' + esc(CFG.stripe.portal) + '" target="_blank" rel="noopener">Manage billing</a>' : '') : '<a class="btn primary small" href="/pricing">Go Pro</a>') + '<a class="btn line small" href="/reset.html">Change password</a><button type="button" class="btn line small" id="db-logout">Log out</button></div></section>' +
      '<section class="mk-card"><h2>Your modules</h2><ul class="db-mlist">' + (S.mods.length ? S.mods.map(function (m) { return '<li><span class="db-mcode">' + esc(m.code) + '</span><span>' + esc(m.title) + '</span><button type="button" class="mk-x" data-rm="' + m.code + '" aria-label="Remove ' + esc(m.code) + '">×</button></li>'; }).join('') : '<li class="db-empty">No modules yet.</li>') + '</ul><a class="btn line small" href="/dashboard/practice">+ Add a module</a></section>' +
      '<p class="db-more">Need help? Email <a href="mailto:' + esc(CFG.contactEmail || 'hello@unizy.uk') + '">' + esc(CFG.contactEmail || 'hello@unizy.uk') + '</a>. Notes and flashcards are in the <a href="/app">study tools</a>.</p>';
    $('db-logout').onclick = logout;
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
        rest('study_profile?select=course,course_id,department,year').then(function (r) { S.profile = (r && r[0]) || null; }),
        loadMods(), loadPlan(), loadCourses()
      ]).then(function () {
        // older accounts that already have modules skip set-up
        if (!S.profile && S.mods.length) S.profile = { course: null, year: null };
        show();
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
