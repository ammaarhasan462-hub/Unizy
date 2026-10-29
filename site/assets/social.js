/* Unizy Friend groups (website): friend codes, same-uni friend requests, group chats with @Professor / @Dr. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG;
  var S = { marks: {}, marksAt: {}, open: {}, share: { open: false }, quiz: null, delArm: null,
    inst: null, ctx: null, data: null, loading: false, view: 'friends', group: null,
    msgs: {}, lastId: {}, msgsLoading: false, notice: '', noticeKind: '', noticeUpgrade: false,
    codeInput: '', nameInput: null, newName: '', newPick: {}, adding: false, addPick: {}, chatText: '',
    thinking: null, copied: false, removeArm: null, leaveArm: false, busy: false, timer: null, fast: false, lastState: 0, lastUni: null
  };
  function X() { return window.UnizyWeb && window.UnizyWeb._internal; }
  function signedIn() { return !!(X() && X().Auth.session); }
  function redraw() { if (S.inst && S.inst.__app) S.inst.__app.schedule(); }
  function rpc(fn, args) {
    return X().Sync.rest('rpc/' + fn, { method: 'POST', body: JSON.stringify(args || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) throw new Error((b && b.message && !/permission|function/i.test(b.message)) ? b.message : 'Something went wrong. Try again.');
        return b;
      });
    });
  }
  function note(text, kind, upgrade) { S.notice = text || ''; S.noticeKind = kind || ''; S.noticeUpgrade = !!upgrade; redraw(); }
  function initial(n) { n = String(n || '?').trim(); return (n.charAt(0) || '?').toUpperCase(); }
  function when(iso) {
    try {
      var d = new Date(iso), now = new Date();
      var t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return d.toDateString() === now.toDateString() ? t : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + t;
    } catch (e) { return ''; }
  }
  function scrollSoon(force) {
    setTimeout(function () {
      var el = document.querySelector('[data-chat-scroll]');
      if (!el) return;
      if (force || el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
    }, 40);
  }
  function setInput(sel, v) { var el = document.querySelector(sel); if (el) el.value = v; }

  // ---------- server calls ----------
  function loadState() {
    var c = S.ctx;
    if (!c || !c.uni || !signedIn()) return Promise.resolve();
    if (!S.data) { S.loading = true; redraw(); }
    var u = X().Auth.session.user || {};
    S.lastState = Date.now(); S.lastUni = c.uni;
    return rpc('social_state', { p_name: u.name || '', p_uni: c.uni, p_degree: c.degree || null, p_degree_name: c.degreeName || null, p_year: c.year || null })
      .then(function (d) {
        S.data = d; S.loading = false;
        if (S.nameInput === null) S.nameInput = (d.me && d.me.name) || '';
        if (S.view === 'group' && S.group && !(d.groups || []).some(function (g) { return g.id === S.group; })) { S.view = 'friends'; S.group = null; }
        redraw();
      })
      .catch(function (e) { S.loading = false; S.failedAt = Date.now(); note(e.message, 'err'); });
  }
  function loadMsgs(gid, force) {
    if (!gid || !signedIn()) return Promise.resolve();
    if (!S.msgs[gid]) { S.msgsLoading = true; redraw(); }
    return rpc('get_messages', { p_group: gid, p_after: S.lastId[gid] || 0 }).then(function (r) {
      S.msgsLoading = false;
      if (r && r.gone) { if (S.group === gid) { S.view = 'friends'; S.group = null; note('You’re no longer in that group.', 'info'); } return loadState(); }
      var add = (r && r.messages) || [];
      if (add.length) {
        var have = {}; (S.msgs[gid] || []).forEach(function (m) { have[m.id] = 1; });
        S.msgs[gid] = (S.msgs[gid] || []).concat(add.filter(function (m) { return !have[m.id]; }));
        S.lastId[gid] = add[add.length - 1].id;
        if (S.thinking && S.thinking.gid === gid && add.some(function (m) { return m.kind === 'ai' && m.replyTo === S.thinking.mid; })) S.thinking = null;
        add.forEach(function (m) { if (m.kind === 'share' && m.marks) S.marks[m.id] = m.marks; });
        if (S.data) (S.data.groups || []).forEach(function (g) { if (g.id === gid) g.unread = 0; });
        scrollSoon(force);
      }
      redraw();
    }).catch(function () { S.msgsLoading = false; redraw(); });
  }

  // ---------- polling: fast while the tab is open, slow otherwise (for the unread badge) ----------
  function refreshMarks(gid) {
    if (!gid || !(S.msgs[gid] || []).some(function (m) { return m.kind === 'share'; })) return;
    if (Date.now() - (S.marksAt[gid] || 0) < 8000) return;
    S.marksAt[gid] = Date.now();
    rpc('share_marks_for', { p_group: gid }).then(function (r) { Object.keys(r || {}).forEach(function (k) { S.marks[k] = r[k]; }); redraw(); }).catch(function () {});
  }
  function mark(mid, data, gid) {
    var mine = (S.marks[mid] || []).filter(function (x) { return !x.me; });
    S.marks[mid] = mine.concat([{ me: true, name: 'You', data: data }]); redraw();
    return rpc('mark_share', { p_message: mid, p_data: data }).then(function (r) { if (!r.ok) note(r.message, 'err'); S.marksAt[gid] = 0; refreshMarks(gid); }).catch(function (e) { note(e.message, 'err'); });
  }
  function postShare(gid, type, title, payload) {
    S.busy = true; redraw();
    return rpc('post_share', { p_group: gid, p_type: type, p_title: title, p_payload: payload }).then(function (r) {
      S.busy = false;
      if (!r.ok) { note(r.message, 'err'); return; }
      S.share = { open: false }; note('');
      loadMsgs(gid).then(function () { scrollSoon(true); });
    }).catch(function (e) { S.busy = false; note(e.message, 'err'); });
  }
  // AI replies end with a "SOURCES:" line; show it as labels instead of text
  function splitSources(t) {
    t = String(t || ''); var m = /\n*[ \t*_]*SOURCES?:[ \t*_]*([^\n]*)\s*$/i.exec(t);
    if (!m) return { body: t, src: '' };
    var labels = m[1].split(/\s*;\s*/).map(function (x) { x = x.replace(/[*_]/g, '').trim(); return /^outline/i.test(x) ? 'Official module outline' : /^general/i.test(x) ? 'General knowledge (check this)' : x; }).filter(Boolean);
    return { body: t.slice(0, m.index).trim(), src: labels.join(' · ') };
  }
  function schedule() {
    clearTimeout(S.timer);
    if (!signedIn()) { S.timer = null; return; }
    var gap = document.hidden ? 20000 : S.fast ? 2500 : 60000;
    S.timer = setTimeout(function () {
      var jobs = [];
      if (S.fast && S.view === 'group' && S.group) jobs.push(loadMsgs(S.group));
      if (!S.fast || Date.now() - S.lastState > 15000) jobs.push(loadState());
      Promise.all(jobs).then(schedule, schedule);
    }, gap);
  }
  function setFast(on) {
    if (on === S.fast && S.timer) return;
    S.fast = on;
    schedule();
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.fast) { clearTimeout(S.timer); S.timer = null; setTimeout(function () { if (S.group && S.view === 'group') loadMsgs(S.group); loadState().then(schedule); }, 0); } });

  // ---------- actions ----------
  function openGroup(id) {
    S.view = 'group'; S.group = id; S.adding = false; S.addPick = {}; S.leaveArm = false; S.notice = '';
    redraw(); loadMsgs(id, true).then(function () { scrollSoon(true); });
    setTimeout(function () { var el = document.querySelector('[data-fg-input]'); if (el && window.innerWidth > 700) el.focus(); }, 60);
  }
  function addFriend(raw) {
    var code = String(raw == null ? S.codeInput : raw).trim();
    if (!code) { note('Type your friend’s code first.', 'err'); return; }
    if (S.busy) return;
    S.busy = true; redraw();
    rpc('send_friend_request', { p_code: code }).then(function (r) {
      S.busy = false; note(r.message, r.ok ? 'ok' : 'err');
      if (r.ok) { S.codeInput = ''; setInput('[data-fg-code]', ''); loadState(); }
    }).catch(function (e) { S.busy = false; note(e.message, 'err'); });
  }
  function mentionPersona(text) {
    if (/@\s*(dr|doctor)\b/i.test(text)) return 'dr';
    if (/@\s*(prof|professor)\b/i.test(text)) return 'prof';
    if (/@\s*(tutor|ai|unizy)\b/i.test(text)) return S.ctx && S.ctx.isMed ? 'dr' : 'prof';
    return null;
  }
  function send() {
    var gid = S.group, text = String(S.chatText || '').trim();
    var el = document.querySelector('[data-fg-input]'); if (el && el.value.trim()) text = el.value.trim();
    if (!gid || !text || S.busy) return;
    S.busy = true;
    rpc('post_message', { p_group: gid, p_body: text }).then(function (r) {
      S.busy = false;
      if (!r.ok) { note(r.message, 'err'); return; }
      S.chatText = ''; setInput('[data-fg-input]', '');
      var persona = mentionPersona(text);
      loadMsgs(gid, true);
      if (persona) {
        var who = (persona === 'dr' ? 'Dr ' : 'Professor ') + ((S.ctx && S.ctx.uniShort) || '');
        S.thinking = { gid: gid, mid: r.id, name: who }; redraw(); scrollSoon(true);
        var c = S.ctx || {};
        X().Auth.fresh().then(function (s) {
          return fetch(CFG.supabaseUrl + '/functions/v1/group-ai', { method: 'POST', headers: X().Auth.headers(true), body: JSON.stringify({ group: gid, message: r.id, persona: persona, context: { module: c.module || '', code: c.code || '', summary: c.summary || '', topics: (c.topics || []).slice(0, 20) } }) });
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (b) {
            if (!res.ok) { S.thinking = null; note(b.message || (who + ' couldn’t answer just now.'), 'err', !!b.upgrade); return; }
            loadMsgs(gid, true);
            if (window.UnizyWeb && window.UnizyWeb.plan) window.UnizyWeb.plan.refresh();
          });
        }).catch(function () { S.thinking = null; note('Couldn’t reach ' + who + '. Try again.', 'err'); });
      }
    }).catch(function (e) { S.busy = false; note(e.message, 'err'); });
  }

  // ---------- values for the template ----------
  function vals(inst, v) {
    S.inst = inst;
    var st = inst.state || {}, mi = v.meInfo || {}, am = v.activeMod || {}, theme = v.theme || {};
    S.ctx = { uni: mi.uni, uniShort: mi.uniShort || '', degree: mi.degree, degreeName: mi.degreeName, year: mi.year, isMed: !!mi.isMed, module: am.name, code: am.code, summary: am.summary, topics: Array.isArray(am.topics) ? am.topics : [] };
    var onTab = st.screen === 'app' && st.tab === 'friends';
    if (!signedIn()) {
      if (S.timer) { clearTimeout(S.timer); S.timer = null; }
      S.data = null;
      return { demo: true, demoBanner: true, live: false, login: function () { location.href = '/login?next=' + encodeURIComponent('/app.html'); }, signup: function () { location.href = '/signup?next=' + encodeURIComponent('/app.html'); } };
    }
    if (st.screen === 'app' && S.ctx.uni) {
      if ((!S.data && !S.loading && Date.now() - (S.failedAt || 0) > 15000) || (S.lastUni && S.lastUni !== S.ctx.uni && !S.loading)) { S.loading = true; S.lastUni = S.ctx.uni; setTimeout(function () { loadState().then(schedule); }, 0); }
      setTimeout(function () { setFast(onTab); }, 0);
    }
    var d = S.data || { me: {}, friends: [], incoming: [], outgoing: [], groups: [] };
    if (!d.me) d.me = {};
    var uniShort = S.ctx.uniShort || 'your uni';
    var lightBtn = String(theme.onBtn || '#FFFFFF').toUpperCase() !== '#FFFFFF';
    var strong = lightBtn ? theme.onBtn : theme.btn, onStrong = lightBtn ? '#FFFFFF' : theme.onBtn;
    var friendMeta = function (f) { return [f.degree, f.year ? 'Year ' + f.year : ''].filter(Boolean).join(' · ') || uniShort; };
    var unreadTotal = 0; (d.groups || []).forEach(function (g) { unreadTotal += +g.unread || 0; });
    var cur = S.view === 'group' ? (d.groups || []).find(function (g) { return g.id === S.group; }) : null;
    var chip = function (on) { return { border: strong, bg: on ? strong : '#FFFFFF', fg: on ? onStrong : '#17302A', pressed: on ? 'true' : 'false' }; };
    var memberIds = {}; if (cur) (cur.members || []).forEach(function (m) { memberIds[m.id] = 1; });
    var addable = (d.friends || []).filter(function (f) { return !memberIds[f.id]; });
    var meId = d.me && d.me.id;
    var msgs = (cur && S.msgs[cur.id]) || [];
    if (cur && onTab) setTimeout(function () { refreshMarks(cur.id); }, 0);
    var kit = v.shareKit || null, gidNow = cur ? cur.id : null, sh = S.share || { open: false };
    var shType = sh.type || 'cards';
    var pill = function (on) { return { bg: on ? strong : '#FFFFFF', fg: on ? onStrong : '#17302A', border: on ? strong : '#D6DDD8' }; };
    var tutorNames = ['Professor ' + uniShort, 'Dr ' + uniShort];
    function shareView(m) {
      var p = m.payload || {}, items = Array.isArray(p.items) ? p.items : [], type = p.type, marks = S.marks[m.id] || m.marks || [];
      var myMark = marks.filter(function (x) { return x.me; })[0], myData = (myMark && myMark.data) || {};
      var LBL = { cards: 'Flashcard set', quiz: 'Group quiz', prep: 'Seminar prep', note: 'Shared note' };
      var ICON = { cards: '▤', quiz: '?', prep: '✎', note: '¶' };
      var o = {
        sys: false, bubble: false, share: true, id: m.id, kindLabel: LBL[type] || 'Shared', icon: ICON[type] || '•', title: p.title || '', who: m.mine ? 'You' : m.who, time: when(m.at),
        meta: [p.module ? 'from ' + p.module : '', type === 'cards' ? items.length + ' cards' : type === 'quiz' ? items.length + ' questions' : type === 'prep' ? items.length + ' points' : ''].filter(Boolean).join(' · '),
        isCards: type === 'cards', isQuiz: type === 'quiz', isPrep: type === 'prep', isNote: type === 'note',
        mine: !!m.mine, removeLabel: S.delArm === m.id ? 'Tap again to remove' : 'Remove',
        remove: function () {
          if (S.delArm !== m.id) { S.delArm = m.id; redraw(); setTimeout(function () { if (S.delArm === m.id) { S.delArm = null; redraw(); } }, 4000); return; }
          S.delArm = null;
          rpc('delete_share', { p_message: m.id }).then(function (r) { note(r.message, r.ok ? 'info' : 'err'); if (r.ok && gidNow) S.msgs[gidNow] = (S.msgs[gidNow] || []).filter(function (x) { return x.id !== m.id; }); redraw(); }).catch(function (e) { note(e.message, 'err'); });
        },
        accent: strong, onAccent: onStrong, tint: theme.tint
      };
      if (type === 'cards') {
        var savers = marks.filter(function (x) { return x.data && x.data.saved; }).map(function (x) { return x.name; });
        o.preview = items.slice(0, S.open[m.id] ? 40 : 3).map(function (c) { return { f: c.f, b: c.b }; });
        o.moreLabel = items.length > 3 ? (S.open[m.id] ? 'Show fewer' : 'Show all ' + items.length) : ''; o.hasMore = items.length > 3;
        o.toggleMore = function () { S.open[m.id] = !S.open[m.id]; redraw(); };
        o.actLabel = myData.saved ? '✓ Saved to your cards' : 'Save to my ' + ((kit && kit.module) || 'module') + ' cards';
        o.act = function () { if (myData.saved || !kit) return; kit.saveCards(items, m.mine ? '' : m.who); mark(m.id, { saved: true }, gidNow); note(items.length + ' cards saved to ' + kit.module + '. Find them under Revise → Your cards.', 'ok'); };
        o.status = savers.length ? 'Saved by ' + savers.join(', ') : 'Nobody has saved these yet';
      }
      if (type === 'quiz') {
        var scores = marks.filter(function (x) { return x.data && x.data.total; }).sort(function (a, b) { return b.data.score - a.data.score; });
        o.status = scores.length ? 'Scores: ' + scores.map(function (x) { return x.name + ' ' + x.data.score + '/' + x.data.total; }).join(' · ') : 'No one has taken it yet';
        var qz = S.quiz && S.quiz.mid === m.id ? S.quiz : null;
        o.taking = !!qz; o.notTaking = !qz;
        o.actLabel = myData.total ? 'Retake (you scored ' + myData.score + '/' + myData.total + ')' : 'Take the quiz';
        o.act = function () { S.quiz = { mid: m.id, i: 0, picks: {} }; redraw(); };
        if (qz) {
          var q = items[qz.i] || {}, pick = qz.picks[qz.i], answered = pick !== undefined, last = qz.i >= items.length - 1;
          o.qNum = 'Question ' + (qz.i + 1) + ' of ' + items.length; o.qText = q.q || '';
          o.qOpts = (q.options || []).map(function (op, i) {
            var right = answered && i === q.answer, wrong = answered && i === pick && pick !== q.answer;
            return { label: String.fromCharCode(65 + i) + '. ' + op, bg: right ? '#EEF6E4' : wrong ? '#FBEDEF' : '#FFFFFF', border: right ? '#2E7D32' : wrong ? '#C8102E' : '#D6DDD8', pick: function () { if (qz.picks[qz.i] === undefined) { qz.picks[qz.i] = i; redraw(); } } };
          });
          o.answered = answered; o.why = answered ? (pick === q.answer ? 'Correct. ' : 'Not quite. ') + (q.why || '') : '';
          o.nextLabel = last ? 'Finish and share my score' : 'Next question';
          o.next = function () {
            if (!last) { qz.i++; redraw(); return; }
            var sc = 0; items.forEach(function (it, i) { if (qz.picks[i] === it.answer) sc++; });
            S.quiz = null; mark(m.id, { score: sc, total: items.length }, gidNow); note('You scored ' + sc + '/' + items.length + '. Your score is shown to the group.', 'ok');
          };
          o.quit = function () { S.quiz = null; redraw(); };
        }
      }
      if (type === 'prep') {
        var mineDone = Array.isArray(myData.done) ? myData.done : [];
        o.points = items.map(function (t, i) {
          var who = marks.filter(function (x) { return x.data && Array.isArray(x.data.done) && x.data.done.indexOf(i) !== -1; }).map(function (x) { return x.name; });
          var on = mineDone.indexOf(i) !== -1;
          return { text: String(t), on: on, box: on ? '✓' : '', boxBg: on ? strong : '#FFFFFF', boxFg: onStrong, boxBorder: on ? strong : '#B9C4BE', who: who.length ? 'Prepared: ' + who.join(', ') : 'Not prepared yet',
            toggle: function () { var d = mineDone.slice(); var k = d.indexOf(i); if (k === -1) d.push(i); else d.splice(k, 1); mark(m.id, { done: d }, gidNow); } };
        });
        o.status = 'Tick the points you’ve prepared so the group can split the work.';
      }
      if (type === 'note') {
        var body = String(p.body || '');
        o.noteText = S.open[m.id] ? body : body.slice(0, 420) + (body.length > 420 ? '…' : '');
        o.hasMore = body.length > 420; o.moreLabel = S.open[m.id] ? 'Show less' : 'Read the whole note'; o.toggleMore = function () { S.open[m.id] = !S.open[m.id]; redraw(); };
        o.actLabel = myData.saved ? '✓ Copy saved to your notes' : 'Save a copy to my notes';
        o.act = function () { if (myData.saved || !kit) return; kit.saveNote(p.title || 'Shared note', body, m.mine ? '' : m.who); mark(m.id, { saved: true }, gidNow); note('Saved to your notes for ' + kit.module + '.', 'ok'); };
        var nSaved = marks.filter(function (x) { return x.data && x.data.saved; }).length;
        o.status = 'A copy of ' + (m.mine ? 'your' : m.who + '’s') + ' note. ' + (nSaved ? nSaved + ' saved a copy.' : '') ;
      }
      ['preview', 'points', 'qOpts'].forEach(function (k) { if (!o[k]) o[k] = []; });
      return o;
    }
    var shareChoices = [];
    if (kit && sh.open) {
      if (shType === 'cards') shareChoices = kit.cardSets.map(function (c) { return Object.assign({ label: c.label + ' (' + Math.min(40, c.n) + ')', pick: function () { S.share.pick = c.id; S.share.pickLabel = c.label; redraw(); } }, pill(sh.pick === c.id)); });
      if (shType === 'quiz') shareChoices = kit.quizTopics.map(function (c) { return Object.assign({ label: c.label, pick: function () { S.share.pick = c.id; S.share.pickLabel = c.label; redraw(); } }, pill(sh.pick === c.id)); });
      if (shType === 'note') shareChoices = kit.notes.map(function (c) { return Object.assign({ label: c.title, pick: function () { S.share.pick = c.id; S.share.pickLabel = c.title; redraw(); } }, pill(sh.pick === c.id)); });
    }
    var shareTypes = [['cards', 'Flashcard set'], ['quiz', 'Group quiz'], ['prep', 'Seminar prep'], ['note', 'A note']].map(function (t) { return Object.assign({ label: t[1], pick: function () { S.share = { open: true, type: t[0], quizN: 5 }; redraw(); } }, pill(shType === t[0])); });
    var shareGo = function () {
      if (!kit || !gidNow) return;
      var mod = kit.module;
      if (shType === 'cards') { if (!sh.pick) return note('Pick a set of cards to share.', 'err'); var cs = kit.cards(sh.pick); if (!cs.length) return note('That set is empty.', 'err'); postShare(gidNow, 'cards', sh.pickLabel || 'Flashcards', { module: mod, items: cs }); }
      if (shType === 'quiz') { if (!sh.pick) return note('Pick a topic for the quiz.', 'err'); var qs = kit.quiz(sh.pick, sh.quizN || 5); if (qs.length < 2) return note('Not enough questions on that topic yet. Try “Mixed topics”.', 'err'); postShare(gidNow, 'quiz', (sh.pickLabel || 'Quiz') + ' quiz', { module: mod, items: qs }); }
      if (shType === 'prep') {
        var tEl = document.querySelector('[data-fg-prep-title]'), pEl = document.querySelector('[data-fg-prep-points]');
        var title = String((tEl && tEl.value) || sh.prepTitle || '').trim(), pts = String((pEl && pEl.value) || sh.prepText || '').split('\n').map(function (x) { return x.trim().replace(/^[-•*\d.)\s]+/, ''); }).filter(Boolean).slice(0, 20);
        if (!title) return note('Give the seminar a title, e.g. “Week 5: Sovereignty”.', 'err');
        if (!pts.length) return note('Add at least one reading or question, one per line.', 'err');
        postShare(gidNow, 'prep', title, { module: mod, items: pts.map(function (x) { return x.slice(0, 300); }) });
      }
      if (shType === 'note') { if (!sh.pick) return note('Pick one of your notes.', 'err'); var nn = kit.note(sh.pick); if (!nn || !nn.body.trim()) return note('That note is empty.', 'err'); postShare(gidNow, 'note', nn.title, { module: mod, body: nn.body }); }
    };
    var out = {
      demo: false, demoBanner: false, live: true,
      shareOpen: !!sh.open && !!kit, shareClosed: !(sh.open && kit), canShare: !!kit,
      toggleShare: function () { S.share = sh.open ? { open: false } : { open: true, type: 'cards', quizN: 5 }; redraw(); },
      shareTypes: shareTypes, shareChoices: shareChoices, hasShareChoices: shareChoices.length > 0,
      shIsPrep: shType === 'prep', shNotPrep: shType !== 'prep', shIsQuiz: shType === 'quiz', shIsNote: shType === 'note',
      shEmpty: shType !== 'prep' && !shareChoices.length,
      shEmptyText: shType === 'note' ? 'You don’t have any notes with text in ' + ((kit && kit.module) || 'this module') + ' yet. Write or upload notes in Learn → Notes first.' : 'Nothing to share for ' + ((kit && kit.module) || 'this module') + ' yet. Switch module, or add your own cards.',
      shQuizSizes: [5, 10].map(function (n) { return Object.assign({ label: n + ' questions', pick: function () { S.share.quizN = n; redraw(); } }, pill((sh.quizN || 5) === n)); }),
      shPrepTitle: sh.prepTitle || '', onPrepTitle: function (e) { S.share.prepTitle = e && e.target ? e.target.value : ''; },
      shPrepText: sh.prepText || '', onPrepText: function (e) { S.share.prepText = e && e.target ? e.target.value : ''; },
      shGoLabel: S.busy ? 'Sharing…' : shType === 'cards' ? 'Share these cards' : shType === 'quiz' ? 'Start the group quiz' : shType === 'prep' ? 'Post seminar prep' : 'Share a copy',
      shareGo: shareGo,
      shModule: (kit && kit.module) || '',
      sharePrivacy: shType === 'note' ? 'Your notes are private. This posts a copy of the note you pick to everyone in ' + (cur ? cur.name : 'this group') + '; you can remove it later. Unizy never shares notes for you.' : 'Everyone in ' + (cur ? cur.name : 'this group') + ' will see this. You can remove anything you share.',
      badge: unreadTotal + (d.incoming || []).length,
      code: d.me.code || '…', uniShort: uniShort,
      codeHint: 'Friends at ' + uniShort + ' add you with this code.',
      copyLabel: S.copied ? 'Copied' : 'Copy',
      copy: function () {
        var c = d.me.code; if (!c) return;
        var done = function () { S.copied = true; redraw(); setTimeout(function () { S.copied = false; redraw(); }, 1600); };
        try { navigator.clipboard.writeText(c).then(done, function () { window.prompt('Copy your code:', c); }); } catch (e) { window.prompt('Copy your code:', c); }
      },
      friendsBg: S.view === 'friends' ? theme.tint : 'transparent',
      showFriends: function () { S.view = 'friends'; S.group = null; S.removeArm = null; redraw(); },
      friendCount: (d.friends || []).length, hasReq: (d.incoming || []).length > 0, reqCount: (d.incoming || []).length,
      groups: (d.groups || []).map(function (g) {
        var last = g.last ? (g.last.kind === 'system' ? g.last.body : g.last.who + ': ' + g.last.body) : (g.members || []).length + ' people';
        return { name: g.name, initial: initial(g.name), sub: last, unread: g.unread, hasUnread: +g.unread > 0 && !(S.view === 'group' && S.group === g.id), bg: S.view === 'group' && S.group === g.id ? theme.tint : 'transparent', pick: function () { openGroup(g.id); } };
      }),
      noGroups: !(d.groups || []).length && !S.loading,
      newGroup: function () { S.view = 'new'; S.group = null; S.newName = ''; S.newPick = {}; S.notice = ''; redraw(); setTimeout(function () { var el = document.querySelector('[data-fg-gname]'); if (el) el.focus(); }, 50); },
      hasNotice: !!S.notice, notice: S.notice, noticeUpgrade: S.noticeUpgrade,
      noticeBg: S.noticeKind === 'err' ? '#FBEDEF' : S.noticeKind === 'ok' ? '#EEF6E4' : '#F4F4EF',
      clearNotice: function () { note(''); },
      loading: S.loading && !S.data,

      vFriends: !!S.data && S.view === 'friends',
      friendsSub: 'Add coursemates and flatmates at ' + uniShort + ' with their friend code, then start group chats together.',
      codeInput: S.codeInput, codePlaceholder: 'e.g. ' + (d.me.code ? d.me.code.slice(0, 4) : 'UCL-') + 'AB12CD',
      onCodeInput: function (e) { S.codeInput = e && e.target ? e.target.value : ''; },
      onCodeKey: function (e) { if (e && e.key === 'Enter') { e.preventDefault(); addFriend(e.target.value); } },
      addFriend: function () { addFriend(); }, addLabel: S.busy && S.view === 'friends' ? 'Adding…' : 'Send friend request',
      uniRule: 'You can only add students at ' + uniShort + '. They’ll need to accept your request.',
      nameInput: S.nameInput == null ? (d.me.name || '') : S.nameInput,
      onNameInput: function (e) { S.nameInput = e && e.target ? e.target.value : ''; },
      onNameKey: function (e) { if (e && e.key === 'Enter') { e.preventDefault(); out.saveName(); } },
      saveName: function () {
        var n = String(S.nameInput || '').trim();
        rpc('set_display_name', { p_name: n }).then(function (r) { note(r.message, r.ok ? 'ok' : 'err'); if (r.ok) loadState(); }).catch(function (e) { note(e.message, 'err'); });
      },
      hasIncoming: (d.incoming || []).length > 0,
      incoming: (d.incoming || []).map(function (rq) {
        var respond = function (yes) { rpc('respond_friend_request', { p_id: rq.reqId, p_accept: yes }).then(function (r) { note(r.message, r.ok ? 'ok' : 'err'); loadState(); }).catch(function (e) { note(e.message, 'err'); }); };
        return { name: rq.name, initial: initial(rq.name), meta: friendMeta(rq) + ' · wants to be friends', accept: function () { respond(true); }, decline: function () { respond(false); } };
      }),
      friends: (d.friends || []).map(function (f) {
        var armed = S.removeArm === f.id;
        return {
          name: f.name, initial: initial(f.name), meta: friendMeta(f),
          chat: function () { S.view = 'new'; S.group = null; S.newPick = {}; S.newPick[f.id] = true; S.newName = ''; S.notice = ''; redraw(); },
          removeLabel: armed ? 'Tap again to remove' : 'Remove', removeColor: armed ? '#B42318' : '#34463F',
          remove: function () {
            if (!armed) { S.removeArm = f.id; redraw(); setTimeout(function () { if (S.removeArm === f.id) { S.removeArm = null; redraw(); } }, 4000); return; }
            S.removeArm = null;
            rpc('remove_friend', { p_user: f.id }).then(function () { note(f.name + ' removed from your friends.', 'info'); loadState(); }).catch(function (e) { note(e.message, 'err'); });
          }
        };
      }),
      noFriends: !!S.data && !(d.friends || []).length,
      hasOutgoing: (d.outgoing || []).length > 0,
      outgoing: (d.outgoing || []).map(function (og) {
        return { name: og.name, cancel: function () { rpc('remove_friend', { p_user: og.id }).then(function () { note('Request cancelled.', 'info'); loadState(); }).catch(function (e) { note(e.message, 'err'); }); } };
      }),

      vNew: !!S.data && S.view === 'new',
      newName: S.newName, newNamePlaceholder: 'e.g. ' + (S.ctx.module ? S.ctx.module + ' study group' : 'Revision crew'),
      onNewName: function (e) { S.newName = e && e.target ? e.target.value : ''; },
      newChoices: (d.friends || []).map(function (f) { var on = !!S.newPick[f.id]; return Object.assign({ label: (on ? '✓ ' : '') + f.name, toggle: function () { S.newPick[f.id] = !S.newPick[f.id]; redraw(); } }, chip(on)); }),
      newPickedCount: Object.keys(S.newPick).filter(function (k) { return S.newPick[k]; }).length,
      noFriendsForGroup: !(d.friends || []).length,
      tutorNote: tutorNames[0] + ' and ' + tutorNames[1] + ' are in every group. Tag either one in a message to ask a question; it uses the asker’s tutor allowance.',
      createLabel: S.busy && S.view === 'new' ? 'Creating…' : 'Create group chat',
      createGroup: function () {
        var name = String(S.newName || '').trim(); var el = document.querySelector('[data-fg-gname]'); if (el && el.value.trim()) name = el.value.trim();
        var ids = Object.keys(S.newPick).filter(function (k) { return S.newPick[k]; });
        if (!name) { note('Give your group a name.', 'err'); return; }
        if (!ids.length) { note('Pick at least one friend to add.', 'err'); return; }
        S.busy = true; redraw();
        rpc('create_group', { p_name: name, p_members: ids }).then(function (r) {
          S.busy = false;
          if (!r.ok) { note(r.message, 'err'); return; }
          note('');
          loadState().then(function () { openGroup(r.id); });
        }).catch(function (e) { S.busy = false; note(e.message, 'err'); });
      },

      vGroup: !!S.data && S.view === 'group' && !!cur,
      gName: cur ? cur.name : '',
      gMembers: cur ? (cur.members || []).map(function (m) { return m.id === meId ? 'You' : m.name; }).join(', ') : '',
      tutorsIn: tutorNames.join(' + ') + ' can join in',
      toggleAdd: function () { S.adding = !S.adding; S.addPick = {}; redraw(); },
      adding: S.adding,
      addChoices: addable.map(function (f) { var on = !!S.addPick[f.id]; return Object.assign({ label: (on ? '✓ ' : '') + f.name, toggle: function () { S.addPick[f.id] = !S.addPick[f.id]; redraw(); } }, chip(on)); }),
      noAddChoices: !addable.length,
      addPeople: function () {
        var ids = Object.keys(S.addPick).filter(function (k) { return S.addPick[k]; });
        if (!ids.length || !cur) { note('Pick someone to add.', 'err'); return; }
        rpc('add_group_members', { p_group: cur.id, p_members: ids }).then(function (r) { note(r.message, r.ok ? 'ok' : 'err'); S.adding = false; S.addPick = {}; loadState(); loadMsgs(cur.id, true); }).catch(function (e) { note(e.message, 'err'); });
      },
      leaveLabel: S.leaveArm ? 'Tap again to leave' : 'Leave', leaveColor: S.leaveArm ? '#B42318' : '#34463F',
      leave: function () {
        if (!cur) return;
        if (!S.leaveArm) { S.leaveArm = true; redraw(); setTimeout(function () { S.leaveArm = false; redraw(); }, 4000); return; }
        S.leaveArm = false;
        rpc('leave_group', { p_group: cur.id }).then(function (r) { note(r.message, 'info'); S.view = 'friends'; S.group = null; loadState(); }).catch(function (e) { note(e.message, 'err'); });
      },
      msgsLoading: S.msgsLoading && !msgs.length,
      msgs: msgs.map(function (m) {
        if (m.kind === 'system') return { sys: true, bubble: false, share: false, text: m.body };
        if (m.kind === 'share') return shareView(m);
        var ai = m.kind === 'ai', mine = !!m.mine;
        var sp = ai ? splitSources(m.body) : { body: m.body, src: '' };
        return {
          sys: false, bubble: true, share: false, text: sp.body, hasSrc: !!sp.src, srcText: sp.src, noSrcAi: ai && !sp.src, who: mine ? 'You' : m.who, time: when(m.at),
          dir: mine ? 'row-reverse' : 'row', align: mine ? 'flex-end' : 'flex-start',
          initial: ai ? (/^Dr\b/.test(m.who) ? 'Dr' : 'Prof') : initial(m.who),
          avBg: ai ? strong : mine ? '#17302A' : '#5D6D67', avFg: ai ? onStrong : '#FFFFFF',
          bg: ai ? theme.tint : mine ? '#17302A' : '#F4F4EF', fg: mine ? '#FFFFFF' : '#17302A',
          border: ai ? strong : mine ? '#17302A' : '#F4F4EF',
          radius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px'
        };
      }),
      thinking: !!(S.thinking && cur && S.thinking.gid === cur.id), thinkingText: S.thinking ? S.thinking.name + ' is thinking…' : '',
      emptyChat: !!cur && !S.msgsLoading && !msgs.some(function (m) { return m.kind !== 'system'; }),
      mentionExample: '@' + tutorNames[0],
      mentions: tutorNames.map(function (n) {
        return { label: '@' + n, insert: function () {
          var el = document.querySelector('[data-fg-input]'); var cv = el ? el.value : S.chatText;
          var nv = (cv && !/\s$/.test(cv) ? cv + ' ' : cv || '') + '@' + n + ' ';
          S.chatText = nv; if (el) { el.value = nv; el.focus(); try { el.setSelectionRange(nv.length, nv.length); } catch (e) {} }
        } };
      }),
      chatText: S.chatText, chatPlaceholder: 'Message ' + (cur ? cur.name : 'the group') + ', or tag @' + tutorNames[0],
      onChat: function (e) { S.chatText = e && e.target ? e.target.value : ''; },
      onChatKey: function (e) { if (e && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } },
      send: send
    };
    return out;
  }

  window.UnizySocial = { vals: vals, _state: S };
})();
