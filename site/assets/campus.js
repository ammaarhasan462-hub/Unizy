/* Unizy campus features (website):
   - 1-click setup: read a timetable or module handbook (PDF/screenshots) into modules, classes, deadlines and notes
   - Uni calendar sync: Moodle / Canvas / Blackboard / timetable iCal feeds pulled into Plan
   - Uni email verification (name@ucl.ac.uk etc.) for the campus-only features below
   - Module hubs: verified coursemates share notes, flashcards, advice and questions per module
   - Campus marketplace: buy and sell textbooks, kit, materials and sub-lets within your uni
   - Study Mode: focus timer, silent shared focus rooms per module, weekly study hours */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG;
  var LS_TIMER = 'unizyx:focus-timer';
  var S = {
    inst: null, kit: null,
    ver: { data: null, loading: false, at: 0, email: '', code: '', busy: false, msg: '', kind: '' },
    imp: { open: false, files: [], step: 'pick', started: 0, res: null, err: '', drop: {}, keepMod: {}, busy: false, upgrade: false },
    feeds: { open: false, url: '', label: '', busy: {}, adding: false, msg: '', kind: '', autoAt: 0, howOpen: false },
    hub: { key: null, data: null, loading: false, at: 0, kind: null, sort: 'active', open: {}, threads: {}, reply: {}, compose: false, cKind: 'question', cTitle: '', cBody: '', cPick: null, busy: false, msg: '', kind2: '', delArm: null, copied: false },
    mkt: { view: 'browse', data: null, loading: false, at: 0, cat: null, q: '', mine: false, cur: null, form: null, photos: [], uploading: 0, inbox: null, thread: null, msgs: [], msgText: '', contactText: '', busy: false, msg: '', kind: '', delArm: null, timer: null },
    fo: { room: null, roomAt: 0, loading: false, pingAt: 0, mode: null, msg: '', tick: null, beep: true }
  };
  var DOMAINS = { ucl: 'ucl.ac.uk', imperial: 'imperial.ac.uk', lse: 'lse.ac.uk', oxford: 'ox.ac.uk', cambridge: 'cam.ac.uk', qmul: 'qmul.ac.uk' };
  var LMS = { ucl: 'Moodle', imperial: 'Blackboard', lse: 'Moodle', oxford: 'Canvas', cambridge: 'Moodle', qmul: 'QMplus (Moodle)' };
  var UNI_NAMES = { ucl: 'UCL', imperial: 'Imperial', lse: 'LSE', oxford: 'Oxford', cambridge: 'Cambridge', qmul: 'Queen Mary' };

  function X() { return window.UnizyWeb && window.UnizyWeb._internal; }
  function signedIn() { return !!(X() && X().Auth.session); }
  function redraw() { if (S.inst && S.inst.__app) S.inst.__app.schedule(); }
  function rpc(name, args) {
    return X().Sync.rest('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) throw new Error((b && b.message && !/permission|function|schema|relation|column/i.test(b.message)) ? b.message : 'Something went wrong. Try again.');
        return b;
      });
    });
  }
  function callFn(name, body) {
    return X().Auth.fresh().then(function (s) {
      if (!s) throw new Error('Log in first.');
      return fetch(CFG.supabaseUrl + '/functions/v1/' + name, { method: 'POST', headers: X().Auth.headers(true), body: JSON.stringify(body || {}) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok || b.ok === false) { var e = new Error(b.message || 'Something went wrong. Try again.'); e.upgrade = !!b.upgrade; e.status = r.status; throw e; }
        return b;
      });
    }, function (e) { throw new Error(e && e.message && e.message !== 'Failed to fetch' ? e.message : 'Couldn’t connect. Check your internet and try again.'); });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ago(iso) {
    var t = new Date(iso).getTime(); if (!t) return '';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.round(h / 24); if (d < 7) return d + 'd ago';
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  function initial(n) { return (String(n || '?').trim().charAt(0) || '?').toUpperCase(); }
  function money(p, unit) { p = +p || 0; var s = p === 0 ? 'Free' : '£' + (p % 100 ? (p / 100).toFixed(2) : String(p / 100)); return s + (unit === 'week' ? ' / week' : unit === 'month' ? ' / month' : ''); }
  function photoUrl(path) { return path ? CFG.supabaseUrl + '/storage/v1/object/public/market/' + String(path).split('/').map(encodeURIComponent).join('/') : ''; }
  function inputVal(sel, fallback) { var el = document.querySelector(sel); return el ? el.value : fallback; }
  function setInput(sel, v) { var el = document.querySelector(sel); if (el) el.value = v; }
  function hubKey(m) { if (!m || !m.name) return ''; return (m.code ? String(m.code).toUpperCase().replace(/\s+/g, '') : 'N:' + String(m.name).toLowerCase().replace(/\s+/g, ' ').trim()).slice(0, 80); }
  function uniName(id) { return UNI_NAMES[id] || 'your uni'; }

  // ------------------------------------------------------------------ verification
  function loadVer(force) {
    if (!signedIn()) return Promise.resolve(null);
    if (S.ver.loading || (!force && S.ver.data && Date.now() - S.ver.at < 120000)) return Promise.resolve(S.ver.data);
    S.ver.loading = true;
    return rpc('verify_status').then(function (d) { S.ver.loading = false; S.ver.data = d; S.ver.at = Date.now(); redraw(); return d; })
      .catch(function () { S.ver.loading = false; S.ver.at = Date.now(); redraw(); return null; });
  }
  function verVals(k) {
    var V = S.ver, d = V.data || {}, uni = k.uni ? k.uni.id : null, dom = DOMAINS[uni] || 'ac.uk', un = uniName(uni);
    if (signedIn() && !V.data && !V.loading && Date.now() - V.at > 15000) setTimeout(function () { loadVer(); }, 0);
    var pending = !!d.pending && !d.verified;
    var send = function () {
      var email = String(inputVal('[data-cx-vemail]', V.email) || '').trim();
      if (!email) { V.msg = 'Enter your ' + un + ' email first.'; V.kind = 'err'; redraw(); return; }
      V.busy = true; V.msg = ''; redraw();
      callFn('verify-uni', { action: 'send', uni: uni, email: email }).then(function (r) {
        V.busy = false; V.email = email; V.msg = r.message; V.kind = 'ok';
        V.data = Object.assign({}, V.data, { pending: true, pendingEmail: email.toLowerCase(), pendingUni: uni }); redraw();
        setTimeout(function () { var el = document.querySelector('[data-cx-vcode]'); if (el) el.focus(); }, 60);
      }).catch(function (e) { V.busy = false; V.msg = e.message; V.kind = 'err'; redraw(); });
    };
    var check = function () {
      var code = String(inputVal('[data-cx-vcode]', V.code) || '').replace(/\D/g, '');
      if (code.length !== 6) { V.msg = 'Enter the 6-digit code from the email.'; V.kind = 'err'; redraw(); return; }
      V.busy = true; V.msg = ''; redraw();
      callFn('verify-uni', { action: 'check', code: code }).then(function (r) {
        V.busy = false; V.code = ''; V.msg = r.message; V.kind = 'ok';
        V.data = { verified: true, uni: r.uni, email: r.email, pending: false };
        S.hub.data = null; S.hub.at = 0; S.mkt.data = null; S.mkt.at = 0; S.fo.roomAt = 0; redraw();
      }).catch(function (e) { V.busy = false; V.msg = e.message; V.kind = 'err'; redraw(); });
    };
    var acct = X() && X().Auth.session && X().Auth.session.user ? String(X().Auth.session.user.email || '') : '';
    return {
      signedOut: !signedIn(), signedIn: signedIn(), loading: signedIn() && !V.data,
      verified: !!d.verified, notVerified: signedIn() && !!V.data && !d.verified,
      otherUni: !!d.verified && !!uni && d.uni !== uni, vUni: uniName(d.uni), vEmail: d.email || '',
      otherUniText: 'You’re verified as a ' + uniName(d.uni) + ' student, so you’re seeing ' + uniName(d.uni) + '’s hubs, market and rooms. Switch your setup to ' + uniName(d.uni) + ' to match your modules.',
      title: 'Verify you’re a ' + un + ' student',
      text: 'Module hubs, the marketplace and shared focus rooms are only for verified ' + un + ' students, so everyone you meet here is really on your campus. Enter your ' + un + ' email (ending ' + dom + ') and we’ll send a 6-digit code.',
      emailPh: 'you@' + dom, email: V.email || (new RegExp(dom.replace(/\./g, '\\.') + '$', 'i').test(acct) ? acct : ''),
      onEmail: function (e) { V.email = e && e.target ? e.target.value : ''; },
      onEmailKey: function (e) { if (e && e.key === 'Enter') { e.preventDefault(); send(); } },
      send: send, sendLabel: V.busy && !pending ? 'Sending…' : pending ? 'Send a new code' : 'Send my code',
      pending: pending, notPending: !pending, pendingText: 'Code sent to ' + (d.pendingEmail || 'your uni email') + '.',
      code: V.code, onCode: function (e) { V.code = e && e.target ? e.target.value : ''; },
      onCodeKey: function (e) { if (e && e.key === 'Enter') { e.preventDefault(); check(); } },
      check: check, checkLabel: V.busy && pending ? 'Checking…' : 'Verify',
      restart: function () { V.data = Object.assign({}, V.data, { pending: false }); V.msg = ''; redraw(); },
      hasMsg: !!V.msg, msg: V.msg, msgBg: V.kind === 'err' ? '#FBEDEF' : '#EEF6E4',
      privacy: 'We only use your uni email to confirm you study at ' + un + '. It’s never shown to anyone, and one uni email can verify one Unizy account.',
      login: function () { location.href = '/login?next=' + encodeURIComponent('/app.html'); },
      signup: function () { location.href = '/signup?next=' + encodeURIComponent('/app.html'); }
    };
  }

  // ------------------------------------------------------------------ 1-click setup (timetable / handbook import)
  function fileToB64(file) {
    return new Promise(function (resolve, reject) {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        var fr = new FileReader();
        fr.onload = function () { resolve({ media_type: 'application/pdf', data: String(fr.result).split(',')[1] || '' }); };
        fr.onerror = function () { reject(new Error('Couldn’t open ' + file.name + '.')); };
        fr.readAsDataURL(file);
        return;
      }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 2000, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ media_type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.9).split(',')[1] });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name + ' isn’t an image or PDF Unizy can read. Use a PDF, JPEG or PNG.')); };
      img.src = url;
    });
  }
  function addFiles(list) {
    var I = S.imp, add = Array.prototype.slice.call(list || []);
    var ok = add.filter(function (f) { return /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name) || /^image\//.test(f.type); });
    if (ok.length < add.length) I.err = 'Only PDFs and images (screenshots or photos) can be read.'; else I.err = '';
    I.files = I.files.concat(ok).slice(0, 5);
    var total = I.files.reduce(function (a, f) { return a + f.size; }, 0);
    if (total > 18 * 1024 * 1024) { I.err = 'That’s more than 18 MB in total. Upload just the timetable or assessment pages.'; }
    redraw();
  }
  function runImport(k) {
    var I = S.imp;
    if (!I.files.length || I.busy) return;
    var total = I.files.reduce(function (a, f) { return a + f.size; }, 0);
    if (total > 18 * 1024 * 1024) { I.err = 'That’s more than 18 MB in total. Upload just the timetable or assessment pages.'; redraw(); return; }
    I.busy = true; I.step = 'reading'; I.started = Date.now(); I.err = ''; I.upgrade = false; redraw();
    var ticker = setInterval(function () { if (I.step !== 'reading') { clearInterval(ticker); return; } var el = document.querySelector('[data-cx-imp-clock]'); if (el) el.textContent = Math.round((Date.now() - I.started) / 1000) + 's'; var st = document.querySelector('[data-cx-imp-stage]'); if (st) st.textContent = stageText(); }, 500);
    Promise.all(I.files.map(fileToB64)).then(function (files) {
      return callFn('import-timetable', {
        files: files,
        context: { uni: k.uni ? k.uni.short : '', uniFull: k.uni ? k.uni.full : '', degree: k.degree ? k.degree.name : '', year: k.year, today: ymd(new Date()),
          modules: k.mods.map(function (m) { return { code: m.code, name: m.name, term: m.term }; }) }
      });
    }).then(function (r) {
      clearInterval(ticker);
      I.busy = false; I.res = r; I.step = 'review'; I.drop = {}; I.keepMod = {};
      I.secs = Math.round((Date.now() - I.started) / 1000);
      (r.mods || []).forEach(function (m, i) { if (m.m !== null && m.m !== undefined) I.keepMod[i] = true; });
      if (window.UnizyWeb && window.UnizyWeb.plan) window.UnizyWeb.plan.refresh();
      redraw();
    }).catch(function (e) { clearInterval(ticker); I.busy = false; I.step = 'pick'; I.err = e.message; I.upgrade = !!e.upgrade; redraw(); });
  }
  function stageText() {
    var s = (Date.now() - S.imp.started) / 1000;
    return s < 4 ? 'Uploading your files…' : s < 12 ? 'Reading the pages…' : s < 22 ? 'Finding modules, classes and deadlines…' : s < 40 ? 'Matching modules to your course…' : 'Nearly there: long handbooks take a little longer…';
  }
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function impResolveMod(k, res, label) {
    // map the module text used on a class/deadline to the catalogue module (or keep the text)
    var t = String(label || '').trim(); if (!t) return { name: '', key: null };
    var tl = t.toLowerCase();
    var found = (res.mods || []).filter(function (m) { return (m.code && tl.indexOf(m.code.toLowerCase()) !== -1) || (m.name && (tl === m.name.toLowerCase() || tl.indexOf(m.name.toLowerCase()) !== -1 || m.name.toLowerCase().indexOf(tl) !== -1)); })[0];
    if (found && found.m !== null && found.m !== undefined && k.mods[found.m]) return { name: k.mods[found.m].name, key: k.mods[found.m].key };
    var direct = k.mods.filter(function (m) { return (m.code && tl.indexOf(m.code.toLowerCase()) !== -1) || tl === m.name.toLowerCase(); })[0];
    if (direct) return { name: direct.name, key: direct.key };
    return { name: found ? (found.name || found.code) : t, key: null };
  }
  function applyImport(k) {
    var I = S.imp, r = I.res; if (!r) return;
    var stamp = Date.now(), n = 0;
    var keepKeys = [];
    (r.mods || []).forEach(function (m, i) { if (I.keepMod[i] && m.m !== null && m.m !== undefined && k.mods[m.m]) keepKeys.push(k.mods[m.m].key); });
    // selection: in the app keep what they had; during setup start from the compulsory modules
    var base = k.screen === 'app' ? k.selKeys.slice() : k.mods.filter(function (m) { return m.locked; }).map(function (m) { return m.key; });
    var sel = base.concat(keepKeys.filter(function (x) { return base.indexOf(x) === -1; }));
    var items = k.getPlan().slice();
    var sig = {}; items.forEach(function (x) { sig[[x.kind, x.dow, x.date, x.time, x.title, x.mod].join('|')] = 1; });
    var push = function (it) { var s = [it.kind, it.dow, it.date, it.time, it.title, it.mod].join('|'); if (sig[s]) return; sig[s] = 1; it.id = 'i' + stamp + '_' + (n++); it.src = 'import'; it.done = false; items.push(it); };
    var cl = 0, ev = 0, dl = 0, nt = 0;
    (r.classes || []).forEach(function (c, i) { if (I.drop['c' + i]) return; var md = impResolveMod(k, r, c.mod); push({ kind: 'class', dow: c.d, time: c.s, end: c.e || '', title: c.title, mod: md.name, loc: c.loc || '', weeks: c.w || '' }); cl++; });
    (r.once || []).forEach(function (c, i) { if (I.drop['o' + i]) return; var md = impResolveMod(k, r, c.mod); push({ kind: 'event', date: c.date, time: c.s || '', end: c.e || '', title: c.title, mod: md.name, loc: c.loc || '' }); ev++; });
    (r.due || []).forEach(function (c, i) { if (I.drop['d' + i]) return; var md = impResolveMod(k, r, c.mod); push({ kind: 'deadline', date: c.date, time: c.t || '', title: c.title + (c.wt ? ' (' + c.wt + ')' : ''), mod: md.name }); dl++; });
    (r.hb || []).forEach(function (h, i) {
      if (I.drop['h' + i]) return;
      var md = impResolveMod(k, r, h.mod); if (!md.key) return;
      var body = [];
      if (h.sum) body.push(h.sum, '');
      if (h.as && h.as.length) { body.push('## Assessment'); h.as.forEach(function (x) { body.push('- ' + x); }); body.push(''); }
      if (h.tp && h.tp.length) { body.push('## Weekly topics'); h.tp.forEach(function (x, j) { body.push((j + 1) + '. ' + x); }); body.push(''); }
      if (h.rd && h.rd.length) { body.push('## Key reading'); h.rd.forEach(function (x) { body.push('- ' + x); }); body.push(''); }
      body.push('(Added from your uploaded handbook. Check it against the latest version on ' + (LMS[k.uni && k.uni.id] || 'your uni’s site') + '.)');
      k.addModuleNote(md.key, 'Handbook', 'Handbook: ' + md.name, body.join('\n'));
      nt++;
    });
    k.savePlan(items);
    if (sel.length) k.setSelection(sel);
    var parts = [];
    if (keepKeys.length) parts.push(keepKeys.length + (keepKeys.length === 1 ? ' module' : ' modules'));
    if (cl) parts.push(cl + ' weekly ' + (cl === 1 ? 'class' : 'classes'));
    if (ev) parts.push(ev + (ev === 1 ? ' session' : ' sessions'));
    if (dl) parts.push(dl + (dl === 1 ? ' deadline' : ' deadlines'));
    if (nt) parts.push(nt + ' handbook ' + (nt === 1 ? 'page' : 'pages'));
    I.done = parts.length ? 'Added ' + parts.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.' : 'Nothing new to add: it was all in your plan already.';
    I.step = 'pick'; I.res = null; I.files = []; I.open = false;
    k.notify('Your course is set up', I.done);
    k.go('time');
    redraw();
  }
  function impVals(k) {
    var I = S.imp, r = I.res, theme = k.theme || {};
    var un = k.uni ? k.uni.short : 'your uni';
    var row = function (id, text, sub) { var off = !!I.drop[id]; return { text: text, sub: sub || '', op: off ? 0.45 : 1, strike: off ? 'line-through' : 'none', label: off ? 'Undo' : 'Remove', toggle: function () { I.drop[id] = !I.drop[id]; redraw(); } }; };
    var out = {
      open: I.open, closed: !I.open,
      show: function () { I.open = true; I.done = ''; redraw(); },
      hide: function () { if (I.busy) return; I.open = false; I.step = 'pick'; I.res = null; I.files = []; I.err = ''; redraw(); },
      signedOut: !signedIn(), signedIn: signedIn(),
      login: function () { location.href = '/login?next=' + encodeURIComponent('/app.html'); },
      signup: function () { location.href = '/signup?next=' + encodeURIComponent('/app.html'); },
      isPick: I.step === 'pick', isReading: I.step === 'reading', isReview: I.step === 'review' && !!r,
      onFiles: function (e) { if (e && e.target && e.target.files) { addFiles(e.target.files); try { e.target.value = ''; } catch (x) { /* ignore */ } } },
      files: I.files.map(function (f, i) { return { name: f.name, size: f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB', icon: /pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? 'PDF' : 'IMG', remove: function () { I.files.splice(i, 1); I.err = ''; redraw(); } }; }),
      hasFiles: I.files.length > 0, noFiles: !I.files.length,
      run: function () { runImport(k); }, runLabel: 'Read ' + (I.files.length === 1 ? 'it' : 'them') + ' and set me up',
      hasErr: !!I.err, err: I.err, upgrade: I.upgrade,
      intro: 'Upload your ' + un + ' timetable (a PDF or a screenshot) or your module handbooks. Unizy picks out your modules, weekly classes, deadlines and exams, and sets up your plan and notes in about half a minute. You check everything before it’s added.',
      hint: 'Tip: a screenshot of your weekly timetable and the assessment page of each handbook work best. Up to 5 files, 18 MB.',
      stage: stageText(), clock: Math.round((Date.now() - I.started) / 1000) + 's',
      hasDone: !!I.done && !I.open, done: I.done || '', clearDone: function () { I.done = ''; redraw(); }
    };
    if (r && I.step === 'review') {
      var mods = (r.mods || []).map(function (m, i) {
        var cat = m.m !== null && m.m !== undefined ? k.mods[m.m] : null, on = !!I.keepMod[i];
        return { text: (m.code ? m.code + ' · ' : '') + (m.name || ''), matched: !!cat, unmatched: !cat,
          sub: cat ? (cat.code && cat.code !== m.code ? 'Matched to ' + cat.code + ' ' + cat.name : 'Matched to your ' + un + ' module list') : 'Not in Unizy’s ' + un + ' Year ' + k.year + ' list, so it won’t get its own page. Its classes and deadlines are still added.',
          box: on ? '✓' : '', boxBg: on ? (k.strong || '#141414') : '#FFFFFF', boxFg: k.onStrong || '#FFFFFF', boxBorder: on ? (k.strong || '#141414') : '#BDBDB6',
          toggle: function () { if (!cat) return; I.keepMod[i] = !I.keepMod[i]; redraw(); } };
      });
      var classes = (r.classes || []).map(function (c, i) { return row('c' + i, DOW[c.d] + ' ' + c.s + (c.e ? '–' + c.e : '') + ' · ' + c.title, [c.mod, c.loc, c.w ? 'weeks ' + c.w : ''].filter(Boolean).join(' · ')); });
      var once = (r.once || []).map(function (c, i) { return row('o' + i, fmtDate(c.date) + (c.s ? ' ' + c.s : '') + ' · ' + c.title, [c.mod, c.loc].filter(Boolean).join(' · ')); });
      var due = (r.due || []).map(function (c, i) { return row('d' + i, fmtDate(c.date) + (c.t ? ' ' + c.t : '') + ' · ' + c.title, [c.mod, c.wt ? 'worth ' + c.wt : '', c.k].filter(Boolean).join(' · ')); });
      var hb = (r.hb || []).map(function (h, i) { var md = impResolveMod(k, r, h.mod); return row('h' + i, 'Handbook: ' + (md.name || h.mod), md.key ? (h.as.length ? h.as.length + ' assessment lines · ' : '') + (h.tp.length ? h.tp.length + ' weekly topics' : 'summary') : 'Not added: this module isn’t in your list'); });
      Object.assign(out, {
        mods: mods, hasMods: mods.length > 0, modsTitle: 'Modules (' + mods.length + ')',
        classes: classes, hasClasses: classes.length > 0, classesTitle: 'Weekly classes (' + classes.length + ')',
        once: once, hasOnce: once.length > 0, onceTitle: 'One-off sessions (' + once.length + ')',
        due: due, hasDue: due.length > 0, dueTitle: 'Deadlines and exams (' + due.length + ')',
        hb: hb, hasHb: hb.length > 0, hbTitle: 'Handbook pages for Notes (' + hb.length + ')',
        warn: (r.warn || []).map(function (w) { return { text: w }; }), hasWarn: (r.warn || []).length > 0,
        empty: !mods.length && !classes.length && !once.length && !due.length && !hb.length,
        reviewTitle: 'Here’s what Unizy found' + (I.secs ? ' (' + I.secs + 's)' : ''),
        reviewSub: 'Untick a module or remove anything that’s wrong, then add it all. You can edit or delete any of it later in Plan and Notes.',
        apply: function () { applyImport(k); }, applyLabel: k.screen === 'app' ? 'Add it to my plan' : 'Add it and open my dashboard',
        again: function () { I.step = 'pick'; I.res = null; redraw(); }
      });
    }
    return out;
  }
  function fmtDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return s || ''; return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }

  // ------------------------------------------------------------------ uni calendar feeds (LMS sync)
  function storeOf(k) { return (k.getStore ? k.getStore() : k.store) || {}; }
  function feedsOf(k) { return (storeOf(k)['unizy:feeds'] || {}).list || []; }
  function saveFeeds(k, list) { k.save('unizy:feeds', { list: list }); }
  function matchMod(k, e) {
    var hay = (e.title + ' ' + e.cats + ' ' + e.desc).toLowerCase();
    var best = null;
    k.selMods.concat(k.mods).forEach(function (m) {
      if (best) return;
      if (m.code && m.code.length >= 4 && hay.indexOf(m.code.toLowerCase()) !== -1) best = m;
    });
    if (!best) k.selMods.forEach(function (m) { if (!best && m.name.length > 6 && hay.indexOf(m.name.toLowerCase()) !== -1) best = m; });
    return best ? best.name : (e.cats ? e.cats.split(',')[0].slice(0, 80) : '');
  }
  function syncFeed(k, feed, quiet) {
    var F = S.feeds;
    if (F.busy[feed.id]) return Promise.resolve();
    F.busy[feed.id] = true; if (!quiet) redraw();
    return callFn('calendar-sync', { url: feed.url }).then(function (r) {
      F.busy[feed.id] = false;
      k = S.kit || k;
      var items = k.getPlan();
      var prefix = 'f:' + feed.id + ':';
      var doneBefore = {}; items.forEach(function (x) { if (String(x.id).indexOf(prefix) === 0 && x.done) doneBefore[x.id] = true; });
      var kept = items.filter(function (x) { return String(x.id).indexOf(prefix) !== 0; });
      var seen = {};
      var add = (r.events || []).map(function (e) {
        var id = prefix + hash(e.uid + '|' + e.date + '|' + (e.time || ''));
        if (seen[id]) return null; seen[id] = 1;
        var it = { id: id, kind: e.due ? 'deadline' : 'event', date: e.date, time: e.due ? (e.time && e.time !== '00:00' ? e.time : '') : (e.time || ''), end: e.endTime || '', title: e.title.slice(0, 140), mod: matchMod(k, e), loc: e.location || '', src: 'feed', done: !!doneBefore[id] };
        if (it.kind === 'deadline' && e.allDay) it.time = '';
        return it;
      }).filter(Boolean);
      k.savePlan(kept.concat(add));
      var list = feedsOf(k).map(function (f) { return f.id === feed.id ? Object.assign({}, f, { source: r.source || f.source, name: r.name || f.name, last: Date.now(), count: add.length, deadlines: add.filter(function (x) { return x.kind === 'deadline'; }).length, error: '' }) : f; });
      saveFeeds(k, list);
      if (!quiet) { F.msg = 'Synced ' + (r.name || r.source || 'your calendar') + ': ' + add.length + (add.length === 1 ? ' event' : ' events') + ' in your plan.'; F.kind = 'ok'; }
      redraw();
    }).catch(function (e) {
      F.busy[feed.id] = false;
      k = S.kit || k;
      saveFeeds(k, feedsOf(k).map(function (f) { return f.id === feed.id ? Object.assign({}, f, { lastTry: Date.now(), error: e.message }) : f; }));
      if (!quiet) { F.msg = e.message; F.kind = 'err'; }
      redraw();
    });
  }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  function autoSync(k) {
    var F = S.feeds;
    if (!signedIn() || k.screen !== 'app' || Date.now() - F.autoAt < 10 * 60000) return;
    var due = feedsOf(k).filter(function (f) { return Date.now() - (f.last || 0) > 60 * 60000 && Date.now() - (f.lastTry || 0) > 30 * 60000; });
    F.autoAt = Date.now();
    if (!due.length) return;
    // one at a time, each with fresh plan data
    due.reduce(function (p, f) { return p.then(function () { return syncFeed(S.kit || k, f, true); }); }, Promise.resolve());
  }
  function feedVals(k) {
    var F = S.feeds, list = feedsOf(k), un = k.uni ? k.uni.short : 'your uni', lms = LMS[k.uni && k.uni.id] || 'Moodle, Canvas or Blackboard';
    if (k.screen === 'app' && signedIn() && list.length) setTimeout(function () { autoSync(k); }, 0);
    var addFeed = function () {
      var url = String(inputVal('[data-cx-feed-url]', F.url) || '').trim();
      if (!/^(https?|webcals?):\/\//i.test(url)) { F.msg = 'Paste the full calendar link, starting https:// or webcal://.'; F.kind = 'err'; redraw(); return; }
      if (list.some(function (f) { return f.url === url; })) { F.msg = 'That calendar is already connected.'; F.kind = 'err'; redraw(); return; }
      if (list.length >= 6) { F.msg = 'You can connect up to 6 calendars.'; F.kind = 'err'; redraw(); return; }
      var feed = { id: hash(url + Date.now()).slice(0, 8), url: url, added: Date.now() };
      saveFeeds(k, list.concat([feed]));
      F.url = ''; setInput('[data-cx-feed-url]', ''); F.adding = false;
      syncFeed(S.kit || k, feed, false).then(function () {
        var now = feedsOf(S.kit || k).filter(function (f) { return f.id === feed.id; })[0];
        if (now && now.error && !now.last) saveFeeds(S.kit || k, feedsOf(S.kit || k).filter(function (f) { return f.id !== feed.id; }));
      });
    };
    var fmtAgo = function (ms) { return ms ? ago(new Date(ms).toISOString()) : 'never'; };
    return {
      open: F.open, closed: !F.open,
      show: function () { F.open = true; F.msg = ''; redraw(); }, hide: function () { F.open = false; F.msg = ''; redraw(); },
      signedOut: !signedIn(), signedIn: signedIn(),
      login: function () { location.href = '/login?next=' + encodeURIComponent('/app.html'); },
      count: list.length, has: list.length > 0, none: !list.length,
      btnLabel: list.length ? 'Uni calendar (' + list.length + ')' : 'Sync uni calendar',
      intro: 'Connect your ' + un + ' calendar from ' + lms + ' (or your online timetable) and assignment deadlines, quizzes, exams and lectures appear in your plan by themselves. Unizy checks for changes every time you open it, and hourly while it’s open.',
      list: list.map(function (f) {
        var busy = !!F.busy[f.id];
        return {
          name: f.name || f.source || 'Calendar', source: f.source || 'Calendar',
          meta: busy ? 'Syncing…' : f.error ? 'Problem: ' + f.error : (f.count || 0) + (f.count === 1 ? ' event' : ' events') + (f.deadlines ? ', ' + f.deadlines + (f.deadlines === 1 ? ' deadline' : ' deadlines') : '') + ' · synced ' + fmtAgo(f.last),
          metaColor: f.error && !busy ? '#9A1B12' : '#5C5C57',
          sync: function () { syncFeed(S.kit || k, f, false); }, syncLabel: busy ? 'Syncing…' : 'Sync now',
          remove: function () {
            var kk = S.kit || k; var prefix = 'f:' + f.id + ':';
            kk.savePlan(kk.getPlan().filter(function (x) { return String(x.id).indexOf(prefix) !== 0; }));
            saveFeeds(kk, feedsOf(kk).filter(function (x) { return x.id !== f.id; }));
            F.msg = 'Disconnected. Its events were removed from your plan.'; F.kind = 'ok'; redraw();
          }
        };
      }),
      adding: F.adding || !list.length, notAdding: !(F.adding || !list.length),
      startAdd: function () { F.adding = true; redraw(); },
      url: F.url, onUrl: function (e) { F.url = e && e.target ? e.target.value : ''; },
      onUrlKey: function (e) { if (e && e.key === 'Enter') { e.preventDefault(); addFeed(); } },
      add: addFeed, addLabel: Object.keys(F.busy).some(function (x) { return F.busy[x]; }) ? 'Connecting…' : 'Connect calendar',
      hasMsg: !!F.msg, msg: F.msg, msgBg: F.kind === 'err' ? '#FBEDEF' : '#EEF6E4',
      howOpen: F.howOpen, toggleHow: function () { F.howOpen = !F.howOpen; redraw(); },
      how: [
        { h: 'Moodle (UCL, LSE, Cambridge, Queen Mary’s QMplus)', t: 'Open Calendar → Import or export calendars → Export calendar. Choose “All events” and “Recent and next 60 days” (or custom range), then “Get calendar URL” and copy the link.' },
        { h: 'Canvas (Oxford)', t: 'Open Calendar, then “Calendar feed” at the bottom right, and copy the link.' },
        { h: 'Blackboard (Imperial)', t: 'Open Calendar, select the settings (gear) icon, then “Share calendar” or “Get external calendar link”, and copy the link.' },
        { h: 'Your online timetable', t: 'Most uni timetable pages have a “Subscribe” or “Add to calendar” option that gives an iCal or webcal:// link. Copy that link.' }
      ],
      privacy: 'Your calendar link is private to you: it’s saved to your account and only used to read your calendar. Disconnect any time.'
    };
  }

  // ------------------------------------------------------------------ module hubs
  function loadHub(k, force) {
    var H = S.hub, m = k.active, key = hubKey(m);
    if (!key || !signedIn()) return Promise.resolve();
    if (H.loading || (!force && H.key === key && H.data && Date.now() - H.at < 30000)) return Promise.resolve();
    if (H.key !== key) { H.data = null; H.open = {}; H.threads = {}; H.compose = false; }
    H.key = key; H.loading = true; redraw();
    return rpc('hub_state', { p_module_key: key, p_module_name: m.name, p_sort: H.sort, p_kind: H.kind }).then(function (d) {
      H.loading = false; H.at = Date.now();
      if (H.key === key) H.data = d;
      if (d && d.verified === false && S.ver.data && S.ver.data.verified) loadVer(true);
      redraw();
    }).catch(function (e) { H.loading = false; H.at = Date.now(); H.msg = e.message; H.kind2 = 'err'; redraw(); });
  }
  function loadThread(id) {
    return rpc('hub_thread', { p_post: id }).then(function (r) { S.hub.threads[id] = r.ok ? r.replies : []; redraw(); }).catch(function () { S.hub.threads[id] = []; redraw(); });
  }
  function hubNote(t, kind) { S.hub.msg = t || ''; S.hub.kind2 = kind || ''; redraw(); }
  function hubVals(k) {
    var H = S.hub, m = k.active, key = hubKey(m), kit = k.shareKit, un = k.uni ? k.uni.short : 'your uni';
    if (k.tab === 'hub' && signedIn() && key && (H.key !== key || (!H.data && !H.loading && Date.now() - H.at > 8000) || (H.data && Date.now() - H.at > 60000 && !H.loading))) setTimeout(function () { loadHub(S.kit || k); }, 0);
    var d = (H.key === key && H.data) || null;
    var ver = !!(d && d.verified);
    var counts = (d && d.counts) || {};
    var chips = [[null, 'All', counts.all], ['question', 'Questions', counts.question], ['advice', 'Advice', counts.advice], ['notes', 'Notes', counts.notes], ['cards', 'Flashcards', counts.cards]].map(function (c) {
      var on = H.kind === c[0];
      return { label: c[1] + (c[2] ? ' ' + c[2] : ''), bg: on ? k.strong : '#FFFFFF', fg: on ? k.onStrong : '#141414', border: on ? k.strong : '#DADAD4', pick: function () { H.kind = c[0]; H.at = 0; loadHub(S.kit || k, true); } };
    });
    var sorts = [['active', 'Active'], ['new', 'Newest'], ['top', 'Most helpful']].map(function (c) {
      var on = H.sort === c[0];
      return { label: c[1], weight: on ? '800' : '600', deco: on ? 'underline' : 'none', pick: function () { H.sort = c[0]; loadHub(S.kit || k, true); } };
    });
    var KIND = { question: ['Question', '#E8F0FE', '#1A3A7A'], advice: ['Advice', '#FFF4D6', '#5A4100'], notes: ['Notes', '#E8F6EC', '#1D5B2E'], cards: ['Flashcards', '#F3E8FA', '#4E1A6E'] };
    var posts = ((d && d.posts) || []).map(function (p) {
      var K = KIND[p.kind] || KIND.question, open = !!H.open[p.id], items = (p.payload && Array.isArray(p.payload.items)) ? p.payload.items : [];
      var who = p.who || {}, body = String(p.body || '');
      var replies = (H.threads[p.id] || []).map(function (r) {
        var rw = r.who || {};
        return { body: r.body, who: r.mine ? 'You' : rw.name, initial: initial(rw.name), meta: [rw.degree, rw.year ? 'Year ' + rw.year : '', ago(r.at)].filter(Boolean).join(' · '), op: !!r.op && !r.mine, mine: !!r.mine, notMine: !r.mine,
          remove: function () { rpc('hub_delete', { p_kind: 'reply', p_id: r.id }).then(function () { loadThread(p.id); H.at = 0; }).catch(function (e) { hubNote(e.message, 'err'); }); },
          report: function () { rpc('campus_report', { p_kind: 'reply', p_id: r.id, p_reason: '' }).then(function (x) { hubNote(x.message, 'ok'); }).catch(function (e) { hubNote(e.message, 'err'); }); } };
      });
      var armed = H.delArm === p.id;
      return {
        id: p.id, kindLabel: K[0], kindBg: K[1], kindFg: K[2], title: p.title,
        who: p.mine ? 'You' : who.name, initial: initial(who.name), meta: [who.degree, who.year ? 'Year ' + who.year : '', ago(p.at)].filter(Boolean).join(' · '),
        body: open ? body : body.slice(0, 360) + (body.length > 360 ? '…' : ''), hasBody: !!body,
        isCards: p.kind === 'cards', isNotes: p.kind === 'notes',
        cardsPreview: items.slice(0, open ? 40 : 3).map(function (c) { return { f: c.f, b: c.b }; }), cardCount: items.length + ' cards',
        canMore: body.length > 360 || items.length > 3, moreLabel: open ? 'Show less' : (p.kind === 'cards' ? 'Show all ' + items.length + ' cards' : 'Read more'),
        toggleMore: function () { H.open[p.id] = !open; redraw(); },
        helpful: (p.voted ? '▲ Helpful ' : '△ Helpful ') + (p.score || ''), helpBg: p.voted ? k.tint : '#FFFFFF', helpBorder: p.voted ? k.strong : '#DADAD4', notMine: !p.mine,
        vote: function () {
          p.voted = !p.voted; p.score = Math.max(0, (p.score || 0) + (p.voted ? 1 : -1)); redraw();
          rpc('hub_toggle', { p_post: p.id, p_what: 'vote' }).catch(function (e) { hubNote(e.message, 'err'); H.at = 0; });
        },
        canSave: (p.kind === 'cards' || p.kind === 'notes') && !!kit,
        saveLabel: p.saved ? '✓ Saved to ' + ((kit && kit.module) || 'your module') : p.kind === 'cards' ? 'Save ' + items.length + ' cards to my ' + ((kit && kit.module) || 'module') : 'Save a copy to my notes',
        saves: p.saves ? p.saves + ' saved' : '',
        save: function () {
          if (p.saved || !kit) return;
          var from = p.mine ? '' : (who.name || 'a coursemate');
          if (p.kind === 'cards') kit.saveCards(items, from); else kit.saveNote(p.title, body, from);
          p.saved = true; p.saves = (p.saves || 0) + 1; redraw();
          hubNote(p.kind === 'cards' ? items.length + ' cards saved. Find them in Revise → Flashcards under your own cards.' : 'Saved to your notes for ' + kit.module + '.', 'ok');
          rpc('hub_toggle', { p_post: p.id, p_what: 'save' }).catch(function () { /* the copy is saved either way */ });
        },
        replyCount: p.replies ? p.replies + (p.replies === 1 ? ' reply' : ' replies') : 'Reply',
        threadOpen: H.threads[p.id] !== undefined && !!H.open['t' + p.id],
        toggleThread: function () { var o = !H.open['t' + p.id]; H.open['t' + p.id] = o; if (o) { H.threads[p.id] = H.threads[p.id] || []; loadThread(p.id); } redraw(); },
        replies: replies, noReplies: !replies.length,
        replyText: H.reply[p.id] || '', onReply: function (e) { H.reply[p.id] = e && e.target ? e.target.value : ''; },
        replyAttr: 'r' + p.id,
        sendReply: function () {
          var el = document.querySelector('[data-cx-reply="r' + p.id + '"]'); var t = String((el && el.value) || H.reply[p.id] || '').trim();
          if (!t) return;
          rpc('hub_reply', { p_post: p.id, p_body: t }).then(function (r) {
            if (!r.ok) { hubNote(r.message, 'err'); return; }
            H.reply[p.id] = ''; if (el) el.value = ''; p.replies = (p.replies || 0) + 1; loadThread(p.id); H.at = 0;
          }).catch(function (e) { hubNote(e.message, 'err'); });
        },
        mine: !!p.mine, removeLabel: armed ? 'Tap again to remove' : 'Remove',
        remove: function () {
          if (!armed) { H.delArm = p.id; redraw(); setTimeout(function () { if (H.delArm === p.id) { H.delArm = null; redraw(); } }, 4000); return; }
          H.delArm = null;
          rpc('hub_delete', { p_kind: 'post', p_id: p.id }).then(function (r) { hubNote(r.message, r.ok ? 'ok' : 'err'); loadHub(S.kit || k, true); }).catch(function (e) { hubNote(e.message, 'err'); });
        },
        report: function () { rpc('campus_report', { p_kind: 'post', p_id: p.id, p_reason: '' }).then(function (x) { hubNote(x.message, 'ok'); }).catch(function (e) { hubNote(e.message, 'err'); }); }
      };
    });
    // composer
    var cKind = H.cKind;
    var kinds = [['question', 'Ask a question'], ['advice', 'Share advice'], ['notes', 'Share notes'], ['cards', 'Share flashcards']].map(function (c) {
      var on = cKind === c[0];
      return { label: c[1], bg: on ? k.strong : '#FFFFFF', fg: on ? k.onStrong : '#141414', border: on ? k.strong : '#DADAD4', pick: function () { H.cKind = c[0]; H.cPick = null; redraw(); } };
    });
    var picks = [];
    if (kit && cKind === 'cards') picks = (kit.cardSets || []).map(function (c) { var on = H.cPick === c.id; return { label: c.label + ' (' + Math.min(40, c.n) + ')', bg: on ? k.tint : '#FFFFFF', border: on ? k.strong : '#DADAD4', pick: function () { H.cPick = c.id; if (!H.cTitle) { H.cTitle = c.label; setInput('[data-cx-ctitle]', c.label); } redraw(); } }; });
    if (kit && cKind === 'notes') picks = (kit.notes || []).map(function (c) { var on = H.cPick === c.id; return { label: c.title, bg: on ? k.tint : '#FFFFFF', border: on ? k.strong : '#DADAD4', pick: function () { H.cPick = c.id; var n = kit.note(c.id); H.cTitle = c.title; setInput('[data-cx-ctitle]', c.title); if (n) { H.cBody = n.body; setInput('[data-cx-cbody]', n.body); } redraw(); } }; });
    var post = function () {
      if (H.busy) return;
      var title = String(inputVal('[data-cx-ctitle]', H.cTitle) || '').trim(), body = String(inputVal('[data-cx-cbody]', H.cBody) || '').trim(), payload = null;
      if (cKind === 'cards') { if (!H.cPick) return hubNote('Pick one of your flashcard sets to share.', 'err'); var cs = kit.cards(H.cPick); if (!cs.length) return hubNote('That set is empty.', 'err'); payload = { items: cs }; }
      if (cKind === 'notes' && !body) return hubNote('Pick one of your notes or paste notes to share.', 'err');
      H.busy = true; redraw();
      rpc('hub_post', { p_module_key: key, p_module_name: m.name, p_kind: cKind, p_title: title, p_body: body, p_payload: payload }).then(function (r) {
        H.busy = false;
        if (!r.ok) { hubNote(r.message, 'err'); return; }
        H.compose = false; H.cTitle = ''; H.cBody = ''; H.cPick = null; hubNote('Posted to the ' + m.name + ' hub.', 'ok');
        loadHub(S.kit || k, true);
      }).catch(function (e) { H.busy = false; hubNote(e.message, 'err'); });
    };
    var members = d && d.members ? +d.members : 0;
    var invite = 'I’m using Unizy for ' + (m.code ? m.code + ' ' : '') + m.name + ' at ' + un + '. Join the module hub to swap notes, flashcards and advice: https://unizy.uk/signup';
    return {
      key: key, hasModule: !!key, noModule: !key,
      module: m.name, code: m.code || '',
      verified: ver, loading: signedIn() && !!key && !d,
      teaser: d && !ver ? (d.teaser ? d.teaser + (d.teaser === 1 ? ' post' : ' posts') + ' from ' + un + ' students are waiting in this hub.' : (d.teaserMembers ? d.teaserMembers + ' coursemates have joined this hub.' : 'Be one of the first ' + un + ' students in this hub.')) : '',
      stats: ver ? members + (members === 1 ? ' coursemate' : ' coursemates') + ' here · ' + (d.activeWeek || 0) + ' active this week' : '',
      chips: chips, sorts: sorts,
      posts: posts, hasPosts: posts.length > 0, empty: ver && !posts.length && !H.loading,
      emptyText: H.kind ? 'Nothing in this section yet.' : 'This hub is brand new. Be the first: share your lecture notes or a flashcard set, or ask what everyone thinks of the coursework. Every post makes the hub more useful for the whole cohort.',
      compose: H.compose, notCompose: !H.compose, canCompose: ver,
      openCompose: function () { H.compose = true; H.msg = ''; redraw(); setTimeout(function () { var el = document.querySelector('[data-cx-ctitle]'); if (el) el.focus(); }, 60); },
      closeCompose: function () { H.compose = false; redraw(); },
      kinds: kinds, picks: picks, hasPicks: picks.length > 0, showPicks: cKind === 'cards' || cKind === 'notes',
      noPicks: (cKind === 'cards' || cKind === 'notes') && !picks.length,
      noPicksText: cKind === 'cards' ? 'You don’t have flashcards for ' + m.name + ' yet. Make some in Revise first.' : 'No notes with text for ' + m.name + ' yet. You can paste notes below instead.',
      showBody: cKind !== 'cards',
      cTitle: H.cTitle, onCTitle: function (e) { H.cTitle = e && e.target ? e.target.value : ''; },
      cBody: H.cBody, onCBody: function (e) { H.cBody = e && e.target ? e.target.value : ''; },
      titlePh: cKind === 'question' ? 'e.g. How are people approaching question 3 on the problem set?' : cKind === 'advice' ? 'e.g. What I wish I knew before the midterm' : cKind === 'notes' ? 'e.g. Week 4 lecture notes: elasticity' : 'Name the set',
      bodyPh: cKind === 'question' ? 'Add detail so coursemates can help. Don’t post answers to assessed work.' : cKind === 'advice' ? 'Revision tips, which readings matter, how the exam felt…' : 'Paste or edit the notes to share',
      postLabel: H.busy ? 'Posting…' : 'Post to the hub', post: post,
      rules: 'Only verified ' + un + ' students can see this hub. Be kind, credit others’ work, and don’t share answers to assessed coursework or exam papers that aren’t public.',
      hasMsg: !!H.msg, msg: H.msg, msgBg: H.kind2 === 'err' ? '#FBEDEF' : '#EEF6E4', clearMsg: function () { hubNote(''); },
      refresh: function () { loadHub(S.kit || k, true); },
      invite: function () {
        var done = function () { H.copied = true; redraw(); setTimeout(function () { H.copied = false; redraw(); }, 1800); };
        if (navigator.share) { navigator.share({ text: invite }).then(function () {}, function () {}); return; }
        try { navigator.clipboard.writeText(invite).then(done, function () { window.prompt('Copy this invite:', invite); }); } catch (e) { window.prompt('Copy this invite:', invite); }
      },
      inviteLabel: H.copied ? 'Invite copied' : 'Invite coursemates'
    };
  }

  // ------------------------------------------------------------------ marketplace
  var CATS = [['textbooks', 'Textbooks'], ['kit', 'Lab & course kit'], ['materials', 'Notes & materials'], ['housing', 'Rooms & sub-lets'], ['other', 'Other']];
  var CAT_ICON = { textbooks: '📚', kit: '🥼', materials: '🗂️', housing: '🏠', other: '📦' };
  function loadMarket(force) {
    var M = S.mkt;
    if (!signedIn() || M.loading || (!force && M.data && Date.now() - M.at < 30000)) return Promise.resolve();
    M.loading = true; redraw();
    return rpc('market_list', { p_cat: M.cat, p_q: M.q || null, p_mine: M.mine }).then(function (d) { M.loading = false; M.at = Date.now(); M.data = d; redraw(); })
      .catch(function (e) { M.loading = false; M.at = Date.now(); mNote(e.message, 'err'); });
  }
  function loadInbox() { return rpc('market_inbox').then(function (d) { S.mkt.inbox = d || []; redraw(); }).catch(function () { S.mkt.inbox = S.mkt.inbox || []; redraw(); }); }
  function loadThreadMsgs(tid) {
    var M = S.mkt; var after = M.msgs.length ? M.msgs[M.msgs.length - 1].id : 0;
    return rpc('market_messages_for', { p_thread: tid, p_after: after }).then(function (r) {
      if (!r.ok || M.thread !== tid) return;
      if ((r.messages || []).length) { M.msgs = M.msgs.concat(r.messages); setTimeout(function () { var el = document.querySelector('[data-cx-mscroll]'); if (el) el.scrollTop = el.scrollHeight; }, 40); }
      redraw();
    }).catch(function () {});
  }
  function mNote(t, kind) { S.mkt.msg = t || ''; S.mkt.kind = kind || ''; redraw(); }
  function setView(v) {
    var M = S.mkt; M.view = v; M.msg = '';
    clearInterval(M.timer); M.timer = null;
    if (v === 'inbox') loadInbox();
    if (v === 'thread') M.timer = setInterval(function () { if (M.view !== 'thread' || !document.querySelector('[data-cx-mscroll]')) { clearInterval(M.timer); M.timer = null; return; } if (!document.hidden) loadThreadMsgs(M.thread); }, 6000);
    redraw();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* ignore */ }
  }
  function openThread(tid, title) { var M = S.mkt; M.thread = tid; M.threadTitle = title || ''; M.msgs = []; M.msgText = ''; setView('thread'); loadThreadMsgs(tid); }
  function compressPhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1400, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('Couldn’t read that photo.')); }, 'image/jpeg', 0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file isn’t a photo Unizy can read.')); };
      img.src = url;
    });
  }
  function uploadPhotos(files) {
    var M = S.mkt, uid = X().Auth.session && X().Auth.session.user ? X().Auth.session.user.id : null;
    if (!uid) return;
    var room = 4 - M.photos.length;
    Array.prototype.slice.call(files || [], 0, Math.max(0, room)).forEach(function (f) {
      M.uploading++; redraw();
      compressPhoto(f).then(function (blob) {
        var path = uid + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.jpg';
        return X().Auth.fresh().then(function (s) {
          return fetch(CFG.supabaseUrl + '/storage/v1/object/market/' + path, { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: blob });
        }).then(function (r) { if (!r.ok) throw new Error('Couldn’t upload that photo. Try again.'); M.photos.push(path); });
      }).catch(function (e) { mNote(e.message, 'err'); }).then(function () { M.uploading--; redraw(); });
    });
  }
  function blankForm(k) { return { id: null, category: 'textbooks', title: '', description: '', price: '', unit: 'total', condition: 'Good', module: (k.active && k.active.code) || '', location: '' }; }
  function mktVals(k) {
    var M = S.mkt, un = k.uni ? k.uni.short : 'your uni';
    if (k.tab === 'market' && signedIn() && (M.view === 'browse' || M.view === 'detail') && !M.loading && (!M.data || Date.now() - M.at > 60000) && Date.now() - M.at > 5000) setTimeout(function () { loadMarket(); }, 0);
    if (k.tab === 'market' && signedIn() && M.inbox === null) { M.inbox = []; setTimeout(loadInbox, 0); }
    if (k.tab !== 'market' && signedIn() && !M.data && !M.loading && Date.now() - M.at > 300000) setTimeout(function () { loadMarket(); }, 0);
    var d = M.data, ver = !!(d && d.verified);
    var cats = [[null, 'All']].concat(CATS).map(function (c) { var on = M.cat === c[0]; return { label: c[1], bg: on ? k.strong : '#FFFFFF', fg: on ? k.onStrong : '#141414', border: on ? k.strong : '#DADAD4', pick: function () { M.cat = c[0]; M.mine = false; loadMarket(true); } }; });
    var card = function (l) {
      var who = l.who || {};
      var st = l.status === 'reserved' ? 'Reserved' : l.status === 'sold' ? 'Sold' : '';
      return {
        id: l.id, title: l.title, price: money(l.price, l.unit), hasPhoto: !!(l.photos && l.photos[0]), noPhoto: !(l.photos && l.photos[0]), photo: photoUrl(l.photos && l.photos[0]), icon: CAT_ICON[l.category] || '📦',
        meta: [l.condition && l.category !== 'housing' ? l.condition : '', l.module, l.location].filter(Boolean).join(' · '),
        seller: (l.mine ? 'You' : who.name) + ' · ' + ago(l.at), status: st, hasStatus: !!st,
        open: function () { M.cur = l; M.contactText = 'Hi! Is this still available?'; setView('detail'); }
      };
    };
    var listings = ((d && d.listings) || []).map(card);
    var cur = M.cur, curWho = cur ? cur.who || {} : {};
    var unread = M.inbox && M.inbox.length ? (M.inbox || []).reduce(function (a, t) { return a + (+t.unread || 0); }, 0) : (d && +d.unread) || 0;
    var F = M.form || blankForm(k);
    var catForm = CATS.map(function (c) { var on = F.category === c[0]; return { label: c[1], bg: on ? k.tint : '#FFFFFF', border: on ? k.strong : '#DADAD4', pick: function () { F.category = c[0]; if (c[0] !== 'housing') F.unit = 'total'; M.form = F; redraw(); } }; });
    var conds = ['New', 'Like new', 'Good', 'Fair', 'Well used'].map(function (c) { var on = F.condition === c; return { label: c, bg: on ? k.tint : '#FFFFFF', border: on ? k.strong : '#DADAD4', pick: function () { F.condition = c; M.form = F; redraw(); } }; });
    var units = [['total', 'Total'], ['week', 'Per week'], ['month', 'Per month']].map(function (c) { var on = F.unit === c[0]; return { label: c[1], bg: on ? k.tint : '#FFFFFF', border: on ? k.strong : '#DADAD4', pick: function () { F.unit = c[0]; M.form = F; redraw(); } }; });
    var fieldSet = function (name) { return function (e) { F[name] = e && e.target ? e.target.value : ''; M.form = F; }; };
    var submit = function () {
      if (M.busy) return;
      ['title', 'description', 'price', 'module', 'location'].forEach(function (n) { var v = inputVal('[data-cx-m-' + n + ']', null); if (v !== null) F[n] = v; });
      var pence = Math.round(parseFloat(String(F.price).replace(/[£,\s]/g, '')) * 100);
      if (String(F.price).trim() === '' || !isFinite(pence)) return mNote('Enter a price in pounds (0 for free).', 'err');
      if (M.uploading) return mNote('Wait for your photos to finish uploading.', 'err');
      M.busy = true; redraw();
      rpc('market_save', { p_id: F.id, p_category: F.category, p_title: F.title, p_description: F.description, p_price_pence: pence, p_unit: F.unit, p_condition: F.category === 'housing' ? null : F.condition, p_module: F.module, p_location: F.location, p_photos: M.photos }).then(function (r) {
        M.busy = false;
        if (!r.ok) { mNote(r.message, 'err'); return; }
        M.form = null; M.photos = []; M.mine = true; M.cat = null;
        setView('browse'); mNote(r.message, 'ok'); loadMarket(true);
      }).catch(function (e) { M.busy = false; mNote(e.message, 'err'); });
    };
    var setStatus = function (st) {
      if (!cur) return;
      if (st === 'removed' && M.delArm !== cur.id) { M.delArm = cur.id; redraw(); setTimeout(function () { if (M.delArm) { M.delArm = null; redraw(); } }, 4000); return; }
      M.delArm = null;
      rpc('market_set_status', { p_id: cur.id, p_status: st }).then(function (r) {
        mNote(r.message, r.ok ? 'ok' : 'err');
        if (r.ok) { cur.status = st; if (st === 'removed') setView('browse'); loadMarket(true); }
      }).catch(function (e) { mNote(e.message, 'err'); });
    };
    var thread = M.thread ? (M.inbox || []).filter(function (t) { return t.id === M.thread; })[0] : null;
    return {
      verified: ver, loading: signedIn() && !d, teaser: d && !ver ? (d.teaser ? d.teaser + ' items are for sale at ' + un + ' right now.' : 'Buy and sell with students at ' + un + ' only.') : '',
      isBrowse: ver && M.view === 'browse', isDetail: ver && M.view === 'detail' && !!cur, isSell: ver && M.view === 'sell', isInbox: ver && M.view === 'inbox', isThread: ver && M.view === 'thread',
      back: function () { setView(M.view === 'thread' ? 'inbox' : 'browse'); },
      cats: cats, q: M.q, onQ: function (e) { M.q = e && e.target ? e.target.value : ''; },
      onQKey: function (e) { if (e && e.key === 'Enter') { e.preventDefault(); M.q = e.target.value; loadMarket(true); } },
      search: function () { M.q = inputVal('[data-cx-mq]', M.q); loadMarket(true); },
      mineOn: M.mine, mineLabel: M.mine ? '✓ My listings' : 'My listings', mineBg: M.mine ? k.tint : '#FFFFFF', mineBorder: M.mine ? k.strong : '#DADAD4',
      toggleMine: function () { M.mine = !M.mine; M.cat = null; loadMarket(true); },
      inboxLabel: 'Messages' + (unread ? ' (' + unread + ')' : ''), goInbox: function () { setView('inbox'); },
      sell: function () { M.form = blankForm(k); M.photos = []; setView('sell'); },
      listings: listings, hasListings: listings.length > 0, empty: ver && !listings.length && !M.loading,
      emptyText: M.mine ? 'You haven’t listed anything yet.' : M.q || M.cat ? 'Nothing matches that yet. Try another search or category.' : 'Nothing for sale at ' + un + ' yet. List the textbooks and kit you no longer need: someone in the year below is looking for them.',
      count: d && d.active ? d.active + ' items for sale at ' + un : '',
      safety: 'Unizy doesn’t take payments. Meet somewhere busy on campus, check items before paying, and never pay a deposit or rent for a room you haven’t viewed in person.',
      // detail
      cur: cur ? {
        title: cur.title, price: money(cur.price, cur.unit), desc: cur.description || 'No description.', meta: [CATS.filter(function (c) { return c[0] === cur.category; }).map(function (c) { return c[1]; })[0], cur.category !== 'housing' ? cur.condition : '', cur.module, cur.location].filter(Boolean).join(' · '),
        seller: cur.mine ? 'Your listing' : (curWho.name || 'A student') + (curWho.degree ? ' · ' + curWho.degree : '') + (curWho.year ? ', Year ' + curWho.year : ''),
        posted: 'Listed ' + ago(cur.at), photos: (cur.photos || []).map(function (p) { return { src: photoUrl(p) }; }), hasPhotos: !!(cur.photos && cur.photos.length),
        mine: !!cur.mine, notMine: !cur.mine, status: cur.status, isActive: cur.status === 'active', isReserved: cur.status === 'reserved', isSold: cur.status === 'sold',
        hasThread: !!cur.myThread, noThread: !cur.myThread && cur.status !== 'sold', isHousing: cur.category === 'housing',
        threads: cur.threads ? cur.threads + (cur.threads === 1 ? ' person has' : ' people have') + ' messaged you' : 'No messages yet'
      } : {},
      contactText: M.contactText, onContact: function (e) { M.contactText = e && e.target ? e.target.value : ''; },
      contact: function () {
        var t = String(inputVal('[data-cx-contact]', M.contactText) || '').trim(); if (!t || !cur) return;
        M.busy = true; redraw();
        rpc('market_contact', { p_listing: cur.id, p_body: t }).then(function (r) { M.busy = false; if (!r.ok) { mNote(r.message, 'err'); return; } cur.myThread = r.thread; loadInbox(); openThread(r.thread, cur.title); }).catch(function (e) { M.busy = false; mNote(e.message, 'err'); });
      },
      contactLabel: M.busy ? 'Sending…' : 'Message seller',
      openMyThread: function () { if (cur && cur.myThread) openThread(cur.myThread, cur.title); },
      markReserved: function () { setStatus('reserved'); }, markSold: function () { setStatus('sold'); }, markActive: function () { setStatus('active'); },
      removeListing: function () { setStatus('removed'); }, removeLabel: M.delArm && cur && M.delArm === cur.id ? 'Tap again to remove' : 'Remove listing',
      edit: function () {
        if (!cur) return;
        M.form = { id: cur.id, category: cur.category, title: cur.title, description: cur.description || '', price: String((cur.price || 0) / 100), unit: cur.unit || 'total', condition: cur.condition || 'Good', module: cur.module || '', location: cur.location || '' };
        M.photos = (cur.photos || []).slice(); setView('sell');
      },
      report: function () { if (cur) rpc('campus_report', { p_kind: 'listing', p_id: cur.id, p_reason: '' }).then(function (x) { mNote(x.message, 'ok'); }).catch(function (e) { mNote(e.message, 'err'); }); },
      // sell form
      formTitle: F.id ? 'Edit your listing' : 'Sell something to ' + un + ' students',
      catForm: catForm, conds: conds, units: units, isHousingForm: F.category === 'housing', notHousingForm: F.category !== 'housing',
      fTitle: F.title, fDesc: F.description, fPrice: F.price, fModule: F.module, fLocation: F.location,
      onTitle: fieldSet('title'), onDesc: fieldSet('description'), onPrice: fieldSet('price'), onModule: fieldSet('module'), onLocation: fieldSet('location'),
      titlePh: F.category === 'housing' ? 'e.g. Room in 3-bed flat, Camden, Jan–Jun' : F.category === 'kit' ? 'e.g. Lab coat (M) and goggles' : 'e.g. Varian, Intermediate Microeconomics, 9th ed.',
      descPh: F.category === 'housing' ? 'Dates, bills, who you live with, how to view. The landlord must agree to a sub-let.' : 'Condition, edition, anything missing, when you can meet.',
      locPh: 'e.g. Main campus, Mile End library, Hall reception',
      photosList: M.photos.map(function (p, i) { return { src: photoUrl(p), remove: function () { M.photos.splice(i, 1); redraw(); } }; }),
      canAddPhoto: M.photos.length + M.uploading < 4, uploading: M.uploading > 0, uploadingText: 'Uploading ' + M.uploading + (M.uploading === 1 ? ' photo…' : ' photos…'),
      onPhotos: function (e) { if (e && e.target && e.target.files) { uploadPhotos(e.target.files); try { e.target.value = ''; } catch (x) { /* ignore */ } } },
      submit: submit, submitLabel: M.busy ? 'Saving…' : F.id ? 'Save changes' : 'Post listing',
      cancelSell: function () { M.form = null; M.photos = []; setView(cur && F.id ? 'detail' : 'browse'); },
      // inbox
      threads: (M.inbox || []).map(function (t) {
        var o = t.other || {};
        return { title: t.title, who: (t.selling ? 'Buyer: ' : 'Seller: ') + (o.name || 'A student'), last: t.last || '', when: ago(t.lastAt), price: money(t.price, t.unit),
          hasPhoto: !!t.photo, noPhoto: !t.photo, photo: photoUrl(t.photo), unread: t.unread, hasUnread: +t.unread > 0,
          open: function () { openThread(t.id, t.title); } };
      }),
      noThreads: !(M.inbox || []).length,
      threadTitle: (thread && thread.title) || M.threadTitle || 'Conversation',
      threadWith: thread ? ((thread.selling ? 'With buyer ' : 'With seller ') + ((thread.other || {}).name || '')) : '',
      msgs: M.msgs.map(function (m) { return { body: m.body, time: ago(m.at), align: m.mine ? 'flex-end' : 'flex-start', bg: m.mine ? '#141414' : '#F3F3EF', fg: m.mine ? '#FFFFFF' : '#141414' }; }),
      msgText: M.msgText, onMsg: function (e) { M.msgText = e && e.target ? e.target.value : ''; },
      onMsgKey: function (e) { if (e && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } },
      sendMsg: sendMsg,
      hasMsg: !!M.msg, msg: M.msg, msgBg: M.kind === 'err' ? '#FBEDEF' : '#EEF6E4', clearMsg: function () { mNote(''); },
      unread: unread
    };
    function sendMsg() {
      var t = String(inputVal('[data-cx-msg]', M.msgText) || '').trim(); if (!t || !M.thread) return;
      rpc('market_send', { p_thread: M.thread, p_body: t }).then(function (r) { if (!r.ok) { mNote(r.message, 'err'); return; } M.msgText = ''; setInput('[data-cx-msg]', ''); loadThreadMsgs(M.thread); }).catch(function (e) { mNote(e.message, 'err'); });
    }
  }

  // ------------------------------------------------------------------ Study Mode (focus timer + rooms)
  var MODES = [{ id: '25', label: '25 / 5', f: 25, b: 5 }, { id: '50', label: '50 / 10', f: 50, b: 10 }, { id: '90', label: '90 / 15', f: 90, b: 15 }];
  function T() { try { return JSON.parse(localStorage.getItem(LS_TIMER) || 'null') || { mode: '25', phase: 'idle' }; } catch (e) { return { mode: '25', phase: 'idle' }; } }
  function saveT(t) { try { localStorage.setItem(LS_TIMER, JSON.stringify(t)); } catch (e) { /* ignore */ } }
  function modeOf(t) { return MODES.filter(function (m) { return m.id === t.mode; })[0] || MODES[0]; }
  function leftMs(t) { return t.phase === 'idle' ? modeOf(t).f * 60000 : t.running ? Math.max(0, t.endsAt - Date.now()) : (t.left || 0); }
  function clockText(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); s = s % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function beep() {
    if (!S.fo.beep) return;
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      var ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.65);
      setTimeout(function () { try { ctx.close(); } catch (e) { /* ignore */ } }, 900);
    } catch (e) { /* ignore */ }
  }
  function logFocus(t, minutes) {
    minutes = Math.round(minutes);
    if (minutes < 1 || !S.kit) return;
    var k = S.kit, store = storeOf(k), log = Object.assign({ d: {}, n: {} }, store['unizy:focus'] || {});
    log.d = Object.assign({}, log.d); log.n = Object.assign({}, log.n);
    var day = ymd(new Date());
    log.d[day] = Object.assign({}, log.d[day]); log.d[day][t.modKey] = (log.d[day][t.modKey] || 0) + minutes;
    log.n[t.modKey] = t.modName;
    var days = Object.keys(log.d).sort(); while (days.length > 90) delete log.d[days.shift()];
    k.save('unizy:focus', log);
    if (signedIn()) rpc('focus_log', { p_module_key: t.modKey, p_module_name: t.modName, p_minutes: Math.min(240, minutes) }).then(function () { S.fo.roomAt = 0; }).catch(function () { /* local log still counts */ });
  }
  function ping(t, force) {
    if (!signedIn() || !S.ver.data || !S.ver.data.verified) return;
    if (!force && Date.now() - S.fo.pingAt < 30000) return;
    S.fo.pingAt = Date.now();
    if (t.running && t.phase !== 'idle') rpc('focus_ping', { p_module_key: t.modKey, p_module_name: t.modName, p_phase: t.phase, p_ends_at: new Date(t.endsAt).toISOString() }).then(function () { S.fo.roomAt = 0; }).catch(function () {});
    else rpc('focus_leave').catch(function () {});
  }
  function tick() {
    var t = T();
    if (t.running && t.phase !== 'idle') {
      if (Date.now() >= t.endsAt) {
        var m = modeOf(t);
        if (t.phase === 'focus') {
          logFocus(t, m.f);
          t.cycles = (t.cycles || 0) + 1;
          t.phase = 'break'; t.endsAt = Date.now() + m.b * 60000;
          S.fo.msg = 'Focus block done: ' + m.f + ' minutes on ' + t.modName + '. Take a ' + m.b + '-minute break.';
        } else {
          t.phase = 'focus'; t.endsAt = Date.now() + m.f * 60000;
          S.fo.msg = 'Break over. Back to ' + t.modName + '.';
        }
        saveT(t); beep(); ping(t, true); redraw();
      } else ping(t, false);
      var txt = clockText(leftMs(t));
      Array.prototype.forEach.call(document.querySelectorAll('[data-cx-clock]'), function (el) { if (el.textContent !== txt) el.textContent = txt; });
      document.title = txt + (t.phase === 'break' ? ' · Break' : ' · Focus') + ' · Unizy';
    } else if (/· Unizy$/.test(document.title) && /^\d\d:\d\d/.test(document.title)) {
      document.title = 'Unizy · your uni, your modules, your AI tutor';
    }
  }
  function ensureTick() { if (!S.fo.tick) S.fo.tick = setInterval(tick, 1000); }
  function loadRoom(k, force) {
    var F = S.fo; if (!signedIn() || F.loading) return;
    if (!force && Date.now() - F.roomAt < 20000) return;
    var t = T(); var key = t.running && t.phase !== 'idle' ? t.modKey : hubKey(k.active);
    F.loading = true; F.roomAt = Date.now();
    rpc('focus_state', { p_module_key: key || '-' }).then(function (d) { F.loading = false; F.room = d; F.roomKey = key; redraw(); }).catch(function () { F.loading = false; });
  }
  function foVals(k) {
    var F = S.fo, t = T(), m = modeOf(t), running = !!t.running && t.phase !== 'idle', paused = !t.running && t.phase !== 'idle';
    ensureTick();
    if (k.tab === 'focus' && k.screen === 'app') setTimeout(function () { loadRoom(k); }, 0);
    var mods = k.selMods.length ? k.selMods : [k.active];
    var pickMod = F.modPick && mods.some(function (x) { return hubKey(x) === F.modPick; }) ? F.modPick : hubKey(k.active);
    var curMod = mods.filter(function (x) { return hubKey(x) === pickMod; })[0] || k.active;
    var start = function () {
      var nt = { mode: t.mode || '25', phase: 'focus', running: true, endsAt: Date.now() + m.f * 60000, modKey: hubKey(curMod), modName: curMod.name, cycles: 0 };
      saveT(nt); F.msg = ''; ping(nt, true); redraw(); tick();
    };
    var pause = function () { var x = T(); x.left = Math.max(0, x.endsAt - Date.now()); x.running = false; saveT(x); ping(x, true); redraw(); };
    var resume = function () { var x = T(); x.endsAt = Date.now() + (x.left || 0); x.running = true; saveT(x); ping(x, true); redraw(); };
    var stop = function () {
      var x = T();
      if (x.phase === 'focus') { var mm = modeOf(x); var done = (mm.f * 60000 - leftMs(x)) / 60000; if (done >= 5) { logFocus(x, done); F.msg = 'Logged ' + Math.round(done) + ' minutes on ' + x.modName + '.'; } else F.msg = 'Stopped. Sessions under 5 minutes aren’t logged.'; }
      saveT({ mode: x.mode, phase: 'idle' }); ping({ running: false, phase: 'idle' }, true); tick(); redraw();
    };
    var skip = function () { var x = T(); x.endsAt = Date.now() - 1; if (!x.running) { x.running = true; } saveT(x); tick(); };
    // weekly hours from the local log (synced to the account)
    var log = (k.store || {})['unizy:focus'] || { d: {}, n: {} };
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var mon = new Date(now); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    var byMod = {}, total = 0, days = [];
    for (var i = 0; i < 7; i++) {
      var dd = new Date(mon); dd.setDate(mon.getDate() + i); var key = ymd(dd), sum = 0;
      Object.keys((log.d || {})[key] || {}).forEach(function (mk) { var v = log.d[key][mk]; sum += v; byMod[mk] = (byMod[mk] || 0) + v; });
      total += sum; days.push({ label: dd.toLocaleDateString('en-GB', { weekday: 'narrow' }), min: sum, today: key === ymd(now) });
    }
    var maxDay = Math.max(60, Math.max.apply(null, days.map(function (x) { return x.min; })));
    var maxMod = Math.max(1, Math.max.apply(null, Object.keys(byMod).map(function (x) { return byMod[x]; }).concat([1])));
    var hrs = function (min) { min = Math.round(min); return min < 60 ? min + ' min' : (Math.floor(min / 60) + 'h' + (min % 60 ? ' ' + (min % 60) + 'm' : '')); };
    var room = F.room || {}, ver = !!room.verified;
    var people = (room.room || []).map(function (p) {
      var left = p.endsAt ? Math.max(0, Math.round((new Date(p.endsAt).getTime() - Date.now()) / 60000)) : null;
      return { name: p.me ? 'You' : p.name, initial: initial(p.name), status: p.phase === 'break' ? 'On a break' : 'Focusing' + (left !== null ? ' · ' + left + ' min left' : ''), bg: p.phase === 'break' ? '#F3F3EF' : k.tint, ring: p.phase === 'break' ? '#CFCFC8' : k.strong };
    });
    var roomName = running || paused ? t.modName : curMod.name;
    return {
      running: running, paused: paused, idle: t.phase === 'idle', notIdle: t.phase !== 'idle',
      clock: clockText(leftMs(t)), phase: t.phase === 'break' ? 'Break' : t.phase === 'focus' ? (paused ? 'Paused' : 'Focus') : 'Ready',
      phaseBg: t.phase === 'break' ? '#EEF6E4' : k.tint, ringColor: t.phase === 'break' ? '#2E7D32' : k.strong,
      modes: MODES.map(function (x) { var on = (t.mode || '25') === x.id; return { label: x.label, sub: x.f + ' min focus, ' + x.b + ' min break', bg: on ? k.strong : '#FFFFFF', fg: on ? k.onStrong : '#141414', border: on ? k.strong : '#DADAD4', pick: function () { if (t.phase !== 'idle') return; var y = T(); y.mode = x.id; saveT(y); redraw(); } }; }),
      modsList: mods.map(function (x) { var on = hubKey(x) === pickMod; return { label: (x.code ? x.code + ' · ' : '') + (x.name.length > 40 ? x.name.slice(0, 38) + '…' : x.name), bg: on ? k.tint : '#FFFFFF', border: on ? k.strong : '#DADAD4', pick: function () { if (t.phase !== 'idle') return; F.modPick = hubKey(x); F.roomAt = 0; redraw(); } }; }),
      modName: roomName, cycles: t.cycles ? t.cycles + (t.cycles === 1 ? ' block done' : ' blocks done') + ' this session' : '',
      start: start, pause: pause, resume: resume, stop: stop, skip: skip, skipLabel: t.phase === 'break' ? 'Skip break' : 'Finish block now',
      hasMsg: !!F.msg, msg: F.msg, clearMsg: function () { F.msg = ''; redraw(); },
      beepLabel: F.beep ? 'Sound on' : 'Sound off', toggleBeep: function () { F.beep = !F.beep; redraw(); },
      // room
      signedIn: signedIn(), signedOut: !signedIn(), verified: ver, roomLoading: signedIn() && !F.room,
      roomTitle: 'Silent room · ' + roomName,
      people: people, hasPeople: people.length > 0, noPeople: ver && !people.length,
      roomText: running ? 'Coursemates on ' + roomName + ' see you here while your timer runs. No chat, no distractions: just company.' : 'Start a timer to join this module’s silent room. Others on ' + roomName + ' see you focusing, and you see them.',
      uniNow: ver ? (room.uniNow || 0) + (room.uniNow === 1 ? ' student is' : ' students are') + ' focusing at ' + uniName(room.uni) + ' right now' : '',
      board: (room.board || []).map(function (b, i) { return { rank: i + 1, name: b.me ? 'You' : b.name, time: hrs(b.minutes), bold: b.me ? '800' : '600' }; }),
      hasBoard: !!(room.board && room.board.length), moduleWeek: ver && room.moduleWeek ? hrs(room.moduleWeek) + ' studied on this module by the cohort this week' : '',
      publicOn: room.public !== false, publicLabel: room.public !== false ? 'Shown on module leaderboards' : 'Hidden from leaderboards',
      togglePublic: function () { var on = !(room.public !== false); rpc('focus_set_public', { p_on: on }).then(function () { room.public = on; F.roomAt = 0; loadRoom(S.kit || k, true); redraw(); }).catch(function () {}); },
      // my week
      weekTotal: hrs(total), weekMods: Object.keys(byMod).sort(function (a, b) { return byMod[b] - byMod[a]; }).map(function (mk) { return { name: (log.n || {})[mk] || mk, time: hrs(byMod[mk]), pct: Math.round(byMod[mk] / maxMod * 100) + '%' }; }),
      hasWeek: total > 0, noWeek: total === 0,
      days: days.map(function (x) { return { label: x.label, h: Math.max(3, Math.round(x.min / maxDay * 64)) + 'px', bg: x.today ? k.strong : x.min ? k.tint : '#EFEFEA', border: x.min ? k.strong : '#E4E4DE', tip: x.min ? hrs(x.min) : '' }; }),
      // floating mini timer on other tabs
      showPill: (running || paused) && k.screen === 'app' && k.tab !== 'focus',
      pillText: (t.phase === 'break' ? 'Break · ' : '') + t.modName, pillBg: k.strong, pillFg: k.onStrong,
      goFocus: function () { k.go('focus'); }
    };
  }

  // ------------------------------------------------------------------ values for the template
  function vals(inst, v) {
    S.inst = inst;
    var k = v.campusKit;
    if (!k) return { ver: {}, imp: {}, feeds: {}, hub: {}, mkt: {}, fo: {} };
    k.strong = k.strong || '#141414'; k.onStrong = k.onStrong || '#FFFFFF'; k.tint = (k.theme && k.theme.tint) || '#F3F3EF';
    S.kit = k;
    var out = { ver: verVals(k), imp: impVals(k), feeds: feedVals(k), fo: foVals(k) };
    if (k.screen === 'app') { out.hub = hubVals(k); out.mkt = mktVals(k); } else { out.hub = {}; out.mkt = {}; }
    out.badge = out.mkt && out.mkt.unread ? out.mkt.unread + ' new' : out.fo.running ? 'Focusing' : '';
    return out;
  }
  // keep connected calendars fresh while Unizy stays open
  setInterval(function () { if (S.kit && !document.hidden) autoSync(S.kit); }, 15 * 60000);
  window.UnizyCampus = { vals: vals, _state: S };
})();
