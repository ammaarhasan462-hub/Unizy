/* Unizy lecture packs, reading lists and course launches (website):
   - Lecture packs: upload a lecture's slides or handout (PDF, PowerPoint, Word, text). Unizy writes notes with
     slide references, flashcards and practice questions mapped to the module outline, and makes the slides
     searchable so the tutor can quote them.
   - Reading lists: imports the module's official reading list (with its weekly sections) from the university.
   - Course launches: when a student opens Unizy from Moodle/Canvas/Blackboard, picks out that course. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG;
  var S = {
    inst: null, kit: null,
    lp: { file: null, title: '', step: 'pick', started: 0, err: '', upgrade: false, done: null, list: {}, listAt: {}, listLoading: {}, delArm: null, open: false },
    rl: { data: {}, loading: {}, at: {}, open: {}, showAll: {} },
    lti: { checked: false }
  };
  function X() { return window.UnizyWeb && window.UnizyWeb._internal; }
  function signedIn() { return !!(X() && X().Auth.session); }
  function redraw() { if (S.inst && S.inst.__app) S.inst.__app.schedule(); }
  function hubKey(m) { return window.UnizyCampus && window.UnizyCampus.hubKey ? window.UnizyCampus.hubKey(m) : ''; }
  function rpc(name, args) {
    return X().Sync.rest('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error('Something went wrong. Try again.'); return b; });
    });
  }
  function callFn(name, body) {
    return X().Auth.fresh().then(function (s) {
      if (!s) throw new Error('Log in first.');
      return fetch(CFG.supabaseUrl + '/functions/v1/' + name, { method: 'POST', headers: X().Auth.headers(true), body: JSON.stringify(body || {}) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok || b.ok === false) { var e = new Error(b.message || 'Something went wrong. Try again.'); e.upgrade = !!b.upgrade; e.reason = b.reason; throw e; }
        return b;
      });
    }, function (e) { throw new Error(e && e.message && e.message !== 'Failed to fetch' ? e.message : 'Couldn’t connect. Check your internet and try again.'); });
  }
  function ago(iso) { var t = new Date(iso).getTime(); if (!t) return ''; var d = Math.round((Date.now() - t) / 86400000); return d < 1 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? d + ' days ago' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }

  // ------------------------------------------------------------------ reading files in the browser
  // Minimal zip reader (PowerPoint and Word files are zips of XML) using the browser's built-in deflate.
  function unzip(buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf), eocd = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) return Promise.reject(new Error('That file looks damaged. Try saving it again.'));
    var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), files = [];
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true), loff = dv.getUint32(off + 42, true);
      var name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nlen));
      files.push({ name: name, method: method, csize: csize, loff: loff });
      off += 46 + nlen + elen + clen;
    }
    function read(f) {
      var lnl = dv.getUint16(f.loff + 26, true), lel = dv.getUint16(f.loff + 28, true), start = f.loff + 30 + lnl + lel;
      var data = u8.subarray(start, start + f.csize);
      if (f.method === 0) return Promise.resolve(new TextDecoder().decode(data));
      if (f.method !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(new Error('This browser can’t open that file. Save it as a PDF and upload that instead.'));
      var ds = new DecompressionStream('deflate-raw');
      return new Response(new Blob([data]).stream().pipeThrough(ds)).text();
    }
    return Promise.resolve({ files: files, read: read });
  }
  function xmlText(xml, tag, para) {
    var out = [], re = new RegExp('<' + para + '[ >][\\s\\S]*?</' + para + '>', 'g'), m;
    var unesc = function (s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); };
    var tre = new RegExp('<' + tag + '(?: [^>]*)?>([\\s\\S]*?)</' + tag + '>', 'g');
    while ((m = re.exec(xml))) { var line = '', t; tre.lastIndex = 0; while ((t = tre.exec(m[0]))) line += t[1]; line = unesc(line).trim(); if (line) out.push(line); }
    return out;
  }
  function splitPages(text) {
    var pages = [], cur = '', n = 1;
    String(text || '').split(/\n{2,}/).forEach(function (p) { if ((cur + '\n\n' + p).length > 2600 && cur) { pages.push({ n: n++, text: cur.trim() }); cur = ''; } cur += (cur ? '\n\n' : '') + p; });
    if (cur.trim()) pages.push({ n: n, text: cur.trim() });
    return pages;
  }
  function readFile(file) {
    var name = (file.name || '').toLowerCase();
    if (/\.pdf$/.test(name) || file.type === 'application/pdf') {
      return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res({ kind: 'pdf', pdf: String(fr.result).split(',')[1] || '' }); }; fr.onerror = function () { rej(new Error('Couldn’t open that PDF.')); }; fr.readAsDataURL(file); });
    }
    if (/\.(txt|md|markdown|text)$/.test(name)) return file.text().then(function (t) { return { kind: 'text', pages: splitPages(t) }; });
    if (/\.pptx$/.test(name) || /\.docx$/.test(name)) {
      return file.arrayBuffer().then(unzip).then(function (z) {
        if (/\.docx$/.test(name)) {
          var doc = z.files.filter(function (f) { return f.name === 'word/document.xml'; })[0];
          if (!doc) throw new Error('That Word file looks empty.');
          return z.read(doc).then(function (x) { return { kind: 'word', pages: splitPages(xmlText(x, 'w:t', 'w:p').join('\n\n')) }; });
        }
        var num = function (f) { return +(/(\d+)\.xml$/.exec(f.name) || [0, 0])[1]; };
        var slides = z.files.filter(function (f) { return /^ppt\/slides\/slide\d+\.xml$/.test(f.name); }).sort(function (a, b) { return num(a) - num(b); });
        var notes = {}; z.files.filter(function (f) { return /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f.name); }).forEach(function (f) { notes[num(f)] = f; });
        if (!slides.length) throw new Error('That PowerPoint file has no slides Unizy can read.');
        return Promise.all(slides.map(function (f) {
          var n = num(f);
          return Promise.all([z.read(f), notes[n] ? z.read(notes[n]) : Promise.resolve('')]).then(function (xs) {
            var body = xmlText(xs[0], 'a:t', 'a:p').join('\n'), sp = xs[1] ? xmlText(xs[1], 'a:t', 'a:p').filter(function (l) { return !/^\d+$/.test(l); }).join(' ') : '';
            return { n: n, text: body + (sp ? '\nSpeaker notes: ' + sp : '') };
          });
        })).then(function (pages) { return { kind: 'slides', pages: pages.filter(function (p) { return p.text.trim(); }) }; });
      });
    }
    if (/\.(ppt|doc|key|pages)$/.test(name)) return Promise.reject(new Error('That’s an older file type. Save it as a PDF (File → Save as → PDF) and upload that.'));
    return Promise.reject(new Error('Upload a PDF, PowerPoint (.pptx), Word (.docx) or text file.'));
  }

  // ------------------------------------------------------------------ lecture packs
  function loadPacks(k, force) {
    var L = S.lp, key = hubKey(k.active);
    if (!key || !signedIn() || L.listLoading[key] || (!force && L.listAt[key] && Date.now() - L.listAt[key] < 120000)) return;
    L.listLoading[key] = true;
    rpc('lecture_pack_list', { p_module_key: key }).then(function (d) { L.list[key] = Array.isArray(d) ? d : []; L.listAt[key] = Date.now(); L.listLoading[key] = false; redraw(); })
      .catch(function () { L.listLoading[key] = false; L.listAt[key] = Date.now(); redraw(); });
  }
  function stageText() {
    var s = (Date.now() - S.lp.started) / 1000;
    return s < 5 ? 'Uploading your file…' : s < 20 ? 'Reading every slide…' : s < 40 ? 'Matching it to the module outline…' : s < 65 ? 'Writing notes with slide references…' : s < 90 ? 'Writing flashcards and practice questions…' : 'Making your slides searchable…';
  }
  function savePack(k, r, title) {
    var mk = k.mk, store = k.getStore(), stamp = Date.now();
    var body = [];
    if (r.summary) body.push(r.summary, '');
    if (r.topics && r.topics.length) body.push('Covers: ' + r.topics.map(function (t) { return t.name + (t.pages && t.pages.length ? ' (p.' + t.pages.slice(0, 4).join(', ') + ')' : ''); }).join('; '), '');
    (r.notes || []).forEach(function (n) { body.push('## ' + n.h, n.body, ''); });
    if (r.gaps && r.gaps.length) { body.push('## Worth reading up on'); r.gaps.forEach(function (g) { body.push('- ' + g); }); body.push(''); }
    body.push('(Made from your upload “' + title + '”. Page references [p.N] point to its pages or slides.)');
    k.addModuleNote(k.active.key, 'Lecture packs', 'Lecture: ' + r.title, body.join('\n'));
    var cards = (r.cards || []).map(function (c, i) { return { id: 'lp' + stamp + '_' + i, t: null, bank: null, f: c.f, b: c.b + (c.p ? ' [p.' + c.p + ']' : ''), d: 1, src: 'notes', from: r.title }; });
    if (cards.length) k.save('unizy:' + mk + ':notecards', (store['unizy:' + mk + ':notecards'] || []).concat(cards));
    var qs = (r.questions || []).map(function (q, i) {
      var nq = k.normQ ? k.normQ(q, 'lp' + stamp + '_' + i, null, null) : null;
      if (!nq) return null;
      var ref = q.p ? ' (Your slides, p.' + q.p + '.)' : '';
      if (nq.type === 'mcq') nq.why = (nq.why || '') + ref; else nq.modelAnswer = (nq.modelAnswer || '') + ref;
      nq.from = r.title;
      return nq;
    }).filter(Boolean);
    if (qs.length) k.save('unizy:' + mk + ':aiqs', (store['unizy:' + mk + ':aiqs'] || []).concat(qs));
    return { cards: cards.length, qs: qs.length, notes: (r.notes || []).length };
  }
  function build(k) {
    var L = S.lp, f = L.file;
    if (!f || L.step === 'building') return;
    if (f.size > 19 * 1024 * 1024) { L.err = 'That file is over 19 MB. Upload one lecture at a time, or save it as a smaller PDF.'; redraw(); return; }
    var title = String((document.querySelector('[data-lp-title]') || {}).value || L.title || f.name.replace(/\.[^.]+$/, '')).trim().slice(0, 120);
    L.step = 'building'; L.started = Date.now(); L.err = ''; L.upgrade = false; redraw();
    var tick = setInterval(function () { if (L.step !== 'building') { clearInterval(tick); return; } var a = document.querySelector('[data-lp-stage]'); if (a) a.textContent = stageText(); var b = document.querySelector('[data-lp-clock]'); if (b) b.textContent = Math.round((Date.now() - L.started) / 1000) + 's'; }, 500);
    var m = k.active;
    readFile(f).then(function (doc) {
      return callFn('lecture-pack', {
        action: 'build', title: title, kind: doc.kind, pdf: doc.pdf, pages: doc.pages,
        module: { key: hubKey(m), name: m.name, code: m.code, summary: m.summary || '', topics: (m.topics || []).slice(0, 40) },
        uni: k.uni ? k.uni.full : '', degree: k.degree ? k.degree.name : '', year: k.year
      });
    }).then(function (r) {
      clearInterval(tick);
      var saved = savePack(S.kit || k, r, title);
      L.step = 'pick'; L.file = null; L.title = '';
      L.done = { title: r.title, summary: r.summary, topics: r.topics || [], gaps: r.gaps || [], saved: saved, searchable: r.searchable, secs: Math.round((Date.now() - L.started) / 1000) };
      L.listAt[hubKey(m)] = 0; loadPacks(S.kit || k, true);
      if (window.UnizyWeb && window.UnizyWeb.plan) window.UnizyWeb.plan.refresh();
      redraw();
    }).catch(function (e) { clearInterval(tick); L.step = 'pick'; L.err = e.message; L.upgrade = !!e.upgrade; redraw(); });
  }
  function lpVals(k) {
    var L = S.lp, key = hubKey(k.active), list = L.list[key] || [];
    if ((k.tab === 'overview' || k.tab === 'notes') && signedIn() && key) setTimeout(function () { loadPacks(k); }, 0);
    var tutor = k.tutorName || 'Your tutor';
    var d = L.done;
    return {
      signedIn: signedIn(), signedOut: !signedIn(),
      login: function () { location.href = '/login?next=' + encodeURIComponent('/app.html'); },
      weak: !!k.weakCoverage, strong: !k.weakCoverage,
      border: k.weakCoverage ? '2px solid ' + ((k.theme && k.theme.c1) || '#14283B') : '1px solid #E1E6EB',
      openPanel: function () { k.go('overview'); setTimeout(function () { var el = document.getElementById('lecture-packs'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); },
      headline: k.weakCoverage ? 'Build ' + k.active.name + '’s study pack from your lecture slides' : 'Turn a lecture into a study pack',
      intro: 'Upload a lecture’s slides or handout (PDF, PowerPoint, Word or text). Unizy writes revision notes with slide references, flashcards and practice questions, matched to the official ' + (k.active.code || k.active.name) + ' outline. ' + tutor + ' can then quote your slides when you ask questions.',
      isPick: L.step === 'pick', isBuilding: L.step === 'building',
      onFile: function (e) { var f = e && e.target && e.target.files && e.target.files[0]; if (f) { L.file = f; L.err = ''; L.done = null; L.title = f.name.replace(/\.[^.]+$/, '').slice(0, 120); } try { e.target.value = ''; } catch (x) { /* ignore */ } redraw(); },
      hasFile: !!L.file, noFile: !L.file, fileName: L.file ? L.file.name : '', fileSize: L.file ? (L.file.size > 1048576 ? (L.file.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(L.file.size / 1024)) + ' KB') : '',
      clearFile: function () { L.file = null; L.err = ''; redraw(); },
      title: L.title, onTitle: function (e) { L.title = e && e.target ? e.target.value : ''; },
      build: function () { build(k); }, stage: stageText(), clock: Math.round((Date.now() - L.started) / 1000) + 's',
      hasErr: !!L.err, err: L.err, upgrade: L.upgrade,
      hasDone: !!d, done: d ? {
        title: d.title, summary: d.summary, secs: d.secs,
        line: d.saved.notes + ' note sections, ' + d.saved.cards + ' flashcards and ' + d.saved.qs + ' practice questions added' + (d.searchable ? ', and ' + d.searchable + ' passages made searchable for ' + tutor : '') + '.',
        topics: d.topics.map(function (t) { return { label: t.name + (t.i !== null && t.i !== undefined && k.active.topics && k.active.topics[t.i] ? ' → ' + k.active.topics[t.i] : '') }; }),
        hasTopics: d.topics.length > 0, gaps: d.gaps.map(function (g) { return { text: g }; }), hasGaps: d.gaps.length > 0
      } : {},
      clearDone: function () { L.done = null; redraw(); },
      goNotes: function () { L.done = null; k.go('notes'); }, goCards: function () { L.done = null; k.go('flash'); }, goTest: function () { L.done = null; k.go('quiz'); }, goTutor: function () { L.done = null; k.go('tutor'); },
      packs: list.map(function (p) {
        var armed = L.delArm === p.id;
        return { title: p.title, meta: [p.pages ? p.pages + (p.source === 'slides' ? ' slides' : ' pages') : '', p.chunks ? p.chunks + ' searchable passages' : '', 'added ' + ago(p.at)].filter(Boolean).join(' · '),
          topics: (p.topics || []).slice(0, 4).map(function (t) { return t.name; }).join(', '),
          delLabel: armed ? 'Tap again to remove' : 'Stop searching it',
          del: function () {
            if (!armed) { L.delArm = p.id; redraw(); setTimeout(function () { if (L.delArm === p.id) { L.delArm = null; redraw(); } }, 4000); return; }
            L.delArm = null; rpc('lecture_pack_delete', { p_id: p.id }).then(function () { loadPacks(S.kit || k, true); }).catch(function () {});
          } };
      }),
      hasPacks: list.length > 0, packsTitle: 'Your lecture packs for ' + k.active.name + ' (' + list.length + ')',
      packsNote: 'Removing a pack stops ' + tutor + ' quoting it. The notes, flashcards and questions it made stay in your module.'
    };
  }
  // the tutor asks this for passages from the student's own slides
  function search(mod, text) {
    var key = hubKey(mod);
    if (!signedIn() || !key || !(S.lp.list[key] && S.lp.list[key].length)) return Promise.resolve([]);
    var t = new Promise(function (res) { setTimeout(function () { res([]); }, 3500); });
    return Promise.race([callFn('lecture-pack', { action: 'search', moduleKey: key, query: String(text || '').slice(0, 1500), k: 5 }).then(function (r) { return r.hits || []; }).catch(function () { return []; }), t]);
  }

  // ------------------------------------------------------------------ reading lists
  var RL_UNIS = { ucl: 1, lse: 1, qmul: 1 };
  function rlKey(k) { return (k.uni ? k.uni.id : '') + ':' + String(k.active.code || '').toLowerCase(); }
  function loadReading(k, refresh) {
    var R = S.rl, key = rlKey(k);
    if (!signedIn() || R.loading[key] || (!refresh && R.at[key] && Date.now() - R.at[key] < 600000)) return Promise.resolve(R.data[key]);
    R.loading[key] = true; redraw();
    return callFn('reading-list', { uni: k.uni ? k.uni.id : '', code: k.active.code || '', refresh: !!refresh }).then(function (d) {
      R.loading[key] = false; R.at[key] = Date.now(); R.data[key] = d; redraw(); return d;
    }).catch(function (e) { R.loading[key] = false; R.at[key] = Date.now(); R.data[key] = { ok: false, message: e.message, reason: e.reason }; redraw(); return R.data[key]; });
  }
  function rlVals(k) {
    var R = S.rl, key = rlKey(k), d = R.data[key], uni = k.uni ? k.uni.id : '';
    var supported = !!RL_UNIS[uni] && !!k.active.code;
    if (k.tab === 'overview' && signedIn() && supported && !d && !R.loading[key]) setTimeout(function () { loadReading(k); }, 0);
    var store = k.getStore(), ticks = (store['unizy:reading'] || {})[key] || {};
    var week = k.uni && k.uni.nowWeek ? k.uni.nowWeek : null;
    var secs = d && d.found ? d.sections : [];
    var weekIdx = -1;
    if (week) secs.forEach(function (s, i) { if (weekIdx < 0 && new RegExp('\\b(week|wk|lecture|session|seminar|topic)\\s*' + week + '\\b', 'i').test(s.name)) weekIdx = i; });
    var total = 0, read = 0;
    var sections = secs.map(function (s, i) {
      var open = R.open[key + '#' + i] !== undefined ? R.open[key + '#' + i] : (weekIdx >= 0 ? i === weekIdx : i === 0);
      var items = s.items.map(function (it, j) {
        var id = i + ':' + j, on = !!ticks[id]; total++; if (on) read++;
        var href = it.doi ? 'https://doi.org/' + it.doi : it.url ? it.url : 'https://www.google.com/search?q=' + encodeURIComponent((it.t + ' ' + (it.a || '')).slice(0, 200));
        return { title: it.t, meta: [it.a, it.y, it.k, it.j].filter(Boolean).join(' · '), href: href, linkLabel: it.doi || it.url ? 'Open' : 'Find it',
          box: on ? '✓' : '', boxBg: on ? k.strong : '#FFFFFF', boxFg: k.onStrong, boxBorder: on ? k.strong : '#B6C2CD', op: on ? 0.6 : 1,
          toggle: function () { var all = Object.assign({}, store['unizy:reading'] || {}); var mine = Object.assign({}, all[key] || {}); if (mine[id]) delete mine[id]; else mine[id] = 1; all[key] = mine; k.save('unizy:reading', all); } };
      });
      var done = items.filter(function (x) { return x.box; }).length;
      return { name: s.name, count: done + ' of ' + s.items.length + ' read', thisWeek: i === weekIdx, open: open, closed: !open, items: items,
        toggle: function () { R.open[key + '#' + i] = !open; redraw(); }, chevron: open ? '▾' : '▸', bg: i === weekIdx ? k.tint : '#FFFFFF' };
    });
    return {
      show: !!k.active.code && !!uni, supported: supported, unsupported: !supported,
      signedIn: signedIn(), signedOut: !signedIn(),
      loading: !!R.loading[key] && !d,
      found: !!(d && d.found && sections.length), notFound: !!(d && d.ok !== false && !(d && d.found && sections.length)),
      failed: !!(d && d.ok === false),
      message: d && d.ok === false ? d.message : 'No reading list is published for ' + (k.active.code || 'this module') + ' yet.',
      unsupportedText: !k.active.code ? '' : uni === 'imperial' ? 'Imperial’s reading lists need your Imperial login, so open them from Blackboard.' : uni === 'oxford' ? 'Oxford’s reading lists need your Oxford login, so open them from Canvas.' : uni === 'cambridge' ? 'Cambridge’s reading lists need your Raven login, so open them from Moodle.' : '',
      title: d && d.title ? d.title : (k.active.code || '') + ' reading list', link: d && d.link ? d.link : '#', hasLink: !!(d && d.link),
      progress: total ? read + ' of ' + total + ' read' : '',
      weekNote: weekIdx >= 0 ? 'This week (week ' + week + ') is open below.' : '',
      sections: sections, refresh: function () { loadReading(k, true); }
    };
  }

  // ------------------------------------------------------------------ opened from Moodle / Canvas / Blackboard
  function checkLti(k) {
    if (S.lti.checked || !signedIn() || !X().Auth.session.user) return;
    S.lti.checked = true;
    rpc('lti_pending').then(function (p) {
      if (!p || !p.uni) return;
      var kk = S.kit || k;
      if (window.UnizyCampus && window.UnizyCampus._state) { window.UnizyCampus._state.ver.data = null; window.UnizyCampus._state.ver.at = 0; }
      var hay = String((p.label || '') + ' ' + (p.title || '')).toLowerCase();
      var course = p.title || p.label || 'your course';
      if (!kk.uni || kk.uni.id !== p.uni || !kk.degree) { kk.startSetup(p.uni); kk.notify('Welcome from your uni', 'Pick your degree and year, and Unizy will set up ' + course + '.'); S.lti.pendingText = hay; return; }
      var hit = kk.mods.filter(function (m) { return m.code && hay.indexOf(String(m.code).toLowerCase()) !== -1; })[0] || kk.mods.filter(function (m) { return m.name.length > 6 && hay.indexOf(m.name.toLowerCase()) !== -1; })[0];
      if (hit) { kk.openModule(hit.key); kk.notify('Opened ' + hit.name, 'From your uni’s course page. Everything here is set up for ' + (hit.code || hit.name) + '.'); }
      else kk.notify('Signed in from ' + course, 'Pick the matching module on the left, or add it with “Add or remove modules”.');
    }).catch(function () {});
  }
  function pendingMatch(k) {
    // after a launch sent the student to set up their degree, open the course module once modules exist
    if (!S.lti.pendingText || k.screen !== 'app' || !k.mods.length) return;
    var hay = S.lti.pendingText; S.lti.pendingText = null;
    var hit = k.mods.filter(function (m) { return m.code && hay.indexOf(String(m.code).toLowerCase()) !== -1; })[0];
    if (hit) setTimeout(function () { k.openModule(hit.key); }, 0);
  }

  function vals(inst, v) {
    S.inst = inst;
    var k = v.campusKit;
    if (!k) return { lp: {}, rl: {} };
    k.strong = k.strong || '#14283B'; k.onStrong = k.onStrong || '#FFFFFF'; k.tint = (k.theme && k.theme.tint) || '#F6F4EE';
    S.kit = k;
    if (signedIn()) setTimeout(function () { checkLti(k); }, 0);
    pendingMatch(k);
    if (k.screen !== 'app' || !k.active.key) return { lp: {}, rl: {} };
    return { lp: lpVals(k), rl: rlVals(k) };
  }
  window.UnizyPacks = { vals: vals, search: search, loadReading: function () { return S.kit ? loadReading(S.kit) : Promise.resolve(null); }, readingFor: function () { return S.kit ? S.rl.data[rlKey(S.kit)] : null; }, _state: S };
})();
