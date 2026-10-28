/* Unizy study rooms (website): module sub-groups for verified students at the same university.
   Shared notes edited together (one person per section at a time, everyone sees changes live),
   a pooled flashcard vault, a seminar reading split, live multiplayer quizzes, and a cohort benchmark. */
(function () {
  'use strict';
  var S = {
    inst: null, kit: null,
    list: null, listAt: 0, listLoading: false, listKey: null,
    room: null, rid: null, rev: null, sub: 'notes', timer: null, clock: null, skew: 0, gone: false,
    edit: {}, saveT: {}, busy: false, msg: '', kind: '',
    form: { name: '', open: true, code: '' },
    vault: { topic: null, pick: null, newTopic: '', study: null },
    rd: { title: '', week: '', open: {}, sum: {}, importing: false, sec: null },
    qz: { topic: 'all', n: 5, secs: 30, autoAt: 0 },
    bench: {}, benchAt: {}
  };
  function X() { return window.UnizyWeb && window.UnizyWeb._internal; }
  function signedIn() { return !!(X() && X().Auth.session); }
  function redraw() { if (S.inst && S.inst.__app) S.inst.__app.schedule(); }
  function hubKey(m) { return window.UnizyCampus && window.UnizyCampus.hubKey ? window.UnizyCampus.hubKey(m) : ''; }
  function rpc(name, args) {
    return X().Sync.rest('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) throw new Error((b && b.message && !/permission|function|schema|relation|column/i.test(b.message)) ? b.message : 'Something went wrong. Try again.');
        return b;
      });
    });
  }
  function note(t, kind) { S.msg = t || ''; S.kind = kind || ''; redraw(); }
  function initial(n) { return (String(n || '?').trim().charAt(0) || '?').toUpperCase(); }
  function ago(iso) { var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; }

  // ------------------------------------------------------------------ data
  function loadList(k, force) {
    var key = hubKey(k.active);
    if (!signedIn() || !key || S.listLoading || (!force && S.listKey === key && Date.now() - S.listAt < 20000)) return;
    S.listLoading = true;
    rpc('room_list', { p_module_key: key }).then(function (d) { S.list = d; S.listKey = key; S.listAt = Date.now(); S.listLoading = false; redraw(); })
      .catch(function (e) { S.listLoading = false; S.listAt = Date.now(); note(e.message, 'err'); });
    if (!S.benchAt[key] || Date.now() - S.benchAt[key] > 60000) {
      S.benchAt[key] = Date.now();
      rpc('bench_get', { p_module_key: key }).then(function (b) { S.bench[key] = b; redraw(); }).catch(function () {});
    }
  }
  function poll() {
    clearTimeout(S.timer); S.timer = null;
    if (!S.rid || !signedIn()) return;
    var rid = S.rid;
    rpc('room_state', { p_room: rid, p_rev: S.room ? S.rev : null }).then(function (d) {
      if (S.rid !== rid) return;
      if (d && d.gone) { S.rid = null; S.room = null; note('That room isn’t available any more.', 'info'); S.listAt = 0; return; }
      S.skew = new Date(d.now).getTime() - Date.now();
      var prevQuiz = S.room && S.room.quiz;
      if (d.same && S.room) { S.room.members = d.members; S.room.quiz = d.quiz; }
      else { S.room = d; S.rev = d.rev; }
      if (S.room.quiz && (!prevQuiz || prevQuiz.id !== S.room.quiz.id) && S.room.quiz.state !== 'done') S.sub = 'quiz';
      hostAuto();
      redraw();
    }).catch(function () {}).then(function () {
      if (S.rid !== rid) return;
      var q = S.room && S.room.quiz, live = q && (q.state === 'question' || q.state === 'lobby' || q.state === 'reveal');
      S.timer = setTimeout(poll, document.hidden ? 15000 : live ? 1200 : 2500);
    });
  }
  function openRoom(id) {
    S.rid = id; S.room = null; S.rev = null; S.sub = 'notes'; S.edit = {}; S.vault.study = null; S.msg = '';
    redraw(); poll();
    if (!S.clock) S.clock = setInterval(clockTick, 250);
  }
  function closeRoom() {
    Object.keys(S.edit).forEach(function (b) { flush(+b, true); });
    S.rid = null; S.room = null; clearTimeout(S.timer); S.timer = null; S.listAt = 0; redraw();
  }
  function now() { return Date.now() + S.skew; }
  function qLeft(q) { if (!q || !q.startedAt) return 0; return Math.max(0, new Date(q.startedAt).getTime() + q.seconds * 1000 - now()); }
  function clockTick() {
    var q = S.room && S.room.quiz;
    if (!q || q.state !== 'question') return;
    var s = Math.ceil(qLeft(q) / 1000), el = document.querySelector('[data-rm-clock]');
    if (el && el.textContent !== String(s)) el.textContent = String(s);
    var bar = document.querySelector('[data-rm-bar]'); if (bar) bar.style.width = Math.round(qLeft(q) / (q.seconds * 1000) * 100) + '%';
    hostAuto();
  }
  // the host's page moves the quiz on when time is up or everyone online has answered
  function hostAuto() {
    var q = S.room && S.room.quiz; if (!q || !q.isHost || q.state !== 'question') return;
    var online = (S.room.members || []).filter(function (m) { return m.online; }).length || 1;
    if ((qLeft(q) <= 0 || q.answered >= online) && Date.now() - S.qz.autoAt > 2500) { S.qz.autoAt = Date.now(); rpc('quiz_advance', { p_session: q.id }).then(poll).catch(function () {}); }
  }

  // ------------------------------------------------------------------ shared notes editing
  function flush(bid, unlock) {
    var e = S.edit[bid]; if (!e) return Promise.resolve();
    clearTimeout(S.saveT[bid]);
    var el = document.querySelector('[data-rm-block="' + bid + '"]'); if (el) e.text = el.value;
    var p = e.text !== e.saved || e.kind !== e.savedKind ? rpc('room_block_save', { p_block: bid, p_body: e.text, p_kind: e.kind }).then(function (r) {
      if (!r.ok) { note(r.message, 'err'); delete S.edit[bid]; return; }
      e.saved = e.text; e.savedKind = e.kind;
    }) : Promise.resolve();
    return p.then(function () { if (unlock) { delete S.edit[bid]; return rpc('room_block_unlock', { p_block: bid }); } }).catch(function (er) { note(er.message, 'err'); }).then(poll);
  }
  function startEdit(b) {
    if (S.edit[b.id]) return;
    rpc('room_block_lock', { p_block: b.id }).then(function (r) {
      if (!r.ok) { note(r.message, 'err'); return; }
      S.edit[b.id] = { text: r.body, saved: r.body, kind: r.kind, savedKind: r.kind };
      redraw(); setTimeout(function () { var el = document.querySelector('[data-rm-block="' + b.id + '"]'); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (x) { /* ignore */ } } }, 60);
      poll();
    }).catch(function (e) { note(e.message, 'err'); });
  }
  function addBlock(after, kind) {
    rpc('room_block_add', { p_room: S.rid, p_after: after, p_kind: kind || 'p', p_body: '' }).then(function (r) {
      if (!r.ok) { note(r.message, 'err'); return; }
      S.edit[r.id] = { text: '', saved: '', kind: kind || 'p', savedKind: kind || 'p' };
      S.rev = null; poll();
      setTimeout(function () { var el = document.querySelector('[data-rm-block="' + r.id + '"]'); if (el) el.focus(); }, 700);
    }).catch(function (e) { note(e.message, 'err'); });
  }
  // keep locks alive while someone is typing
  setInterval(function () { Object.keys(S.edit).forEach(function (b) { if (S.rid) flush(+b, false); }); }, 25000);

  // ------------------------------------------------------------------ values for the template
  function listVals(k) {
    var d = S.list || {}, key = hubKey(k.active), un = k.uni ? k.uni.short : 'your uni', b = S.bench[key] || {};
    var mine = (d.mine || []).map(function (r) {
      return { name: r.name, meta: [r.here ? '' : r.module, r.members + (r.members === 1 ? ' member' : ' members'), r.online ? r.online + ' here now' : '', r.open ? 'open to coursemates' : 'invite only'].filter(Boolean).join(' · '),
        live: r.live, open: function () { openRoom(r.id); }, dot: r.online ? '#2E7D32' : '#BDBDB6' };
    });
    var open = (d.open || []).map(function (r) {
      return { name: r.name, meta: r.members + (r.members === 1 ? ' member' : ' members') + (r.online ? ' · ' + r.online + ' here now' : '') + ' · active ' + ago(r.lastAt),
        join: function () { rpc('room_join', { p_code: null, p_room: r.id }).then(function (x) { if (!x.ok) { note(x.message, 'err'); return; } openRoom(x.id); }).catch(function (e) { note(e.message, 'err'); }); } };
    });
    var bars = (b.buckets || []).map(function (c, i) { var max = Math.max.apply(null, b.buckets.concat([1])); var mineIn = b.mine !== null && b.mine !== undefined && Math.min(9, Math.floor(b.mine / 10)) === i; return { h: Math.max(4, Math.round(c / max * 60)) + 'px', bg: mineIn ? k.strong : k.tint, label: i * 10 + '' }; });
    var lv = {
      verified: !!d.verified, loading: signedIn() && !S.list,
      intro: 'Make a room for your seminar group or study group on ' + k.active.name + '. Write up seminar answers together, pool flashcards, split the reading, and run live quizzes to see where the group stands.',
      name: S.form.name, onName: function (e) { S.form.name = e && e.target ? e.target.value : ''; },
      namePh: 'e.g. ' + (k.active.code ? k.active.code + ' ' : '') + 'Seminar group 4',
      openLabel: S.form.open ? '✓ Coursemates on ' + (k.active.code || 'this module') + ' can find and join it' : 'Invite only (share the code)',
      openBg: S.form.open ? k.tint : '#FFFFFF', openBorder: S.form.open ? k.strong : '#DADAD4',
      toggleOpen: function () { S.form.open = !S.form.open; redraw(); },
      create: function () {
        var name = String((document.querySelector('[data-rm-name]') || {}).value || S.form.name || '').trim();
        if (S.busy) return; S.busy = true; redraw();
        rpc('room_create', { p_module_key: key, p_module_name: k.active.name, p_name: name, p_open: S.form.open }).then(function (r) {
          S.busy = false; if (!r.ok) { note(r.message, 'err'); return; }
          S.form.name = ''; note('Room made. Share the code ' + r.code + ' with your group.', 'ok'); openRoom(r.id);
        }).catch(function (e) { S.busy = false; note(e.message, 'err'); });
      },
      createLabel: S.busy ? 'Making…' : 'Make a room',
      code: S.form.code, onCode: function (e) { S.form.code = e && e.target ? e.target.value : ''; },
      onCodeKey: function (e) { if (e && e.key === 'Enter') { e.preventDefault(); lv.join(); } },
      join: function () {
        var c = String((document.querySelector('[data-rm-code]') || {}).value || S.form.code || '').trim(); if (!c) return note('Type the room code first.', 'err');
        rpc('room_join', { p_code: c, p_room: null }).then(function (x) { if (!x.ok) { note(x.message, 'err'); return; } S.form.code = ''; openRoom(x.id); }).catch(function (e) { note(e.message, 'err'); });
      },
      mine: mine, hasMine: mine.length > 0, open: open, hasOpen: open.length > 0,
      openTitle: 'Open rooms for ' + (k.active.code || k.active.name) + ' at ' + un,
      bench: {
        show: !!b.verified, enough: !!b.enough, notEnough: !!b.verified && !b.enough,
        title: 'How you compare on ' + (k.active.code || k.active.name),
        mine: b.mine !== null && b.mine !== undefined ? b.mine + '%' : '–',
        hasMine: b.mine !== null && b.mine !== undefined,
        pctText: b.percentile !== null && b.percentile !== undefined ? (b.percentile >= 50 ? 'Top ' + Math.max(1, 100 - b.percentile) + '%' : 'Ahead of ' + b.percentile + '%') + ' of ' + b.students + ' ' + un + ' students' : '',
        avg: b.average !== null && b.average !== undefined ? un + ' average: ' + b.average + '%' : '',
        bars: bars,
        sub: 'Your average over your last 10 topic tests and group quizzes on this module, in the last 60 days. Only totals are shown, never names.',
        waitText: (b.students || 0) + ' of 5 ' + un + ' students needed before the comparison appears. Topic tests and group quizzes count.' + (b.mine !== null && b.mine !== undefined ? ' Your average so far: ' + b.mine + '%.' : '')
      }
    };
    return lv;
  }
  function roomVals(k) {
    var R = S.room || {}, room = R.room || {}, q = R.quiz;
    var subs = [['notes', 'Shared notes'], ['vault', 'Card vault'], ['reading', 'Reading split'], ['quiz', q && q.state !== 'done' ? 'Live quiz ●' : 'Live quiz']].map(function (t) {
      var on = S.sub === t[0];
      return { label: t[1], bg: on ? k.strong : '#FFFFFF', fg: on ? k.onStrong : '#141414', border: on ? k.strong : '#DADAD4', pick: function () { S.sub = t[0]; redraw(); } };
    });
    // notes
    var blocks = (R.blocks || []).map(function (b) {
      var e = S.edit[b.id], editing = !!e;
      return {
        id: b.id, attr: String(b.id), editing: editing, viewing: !editing,
        isH: (e ? e.kind : b.kind) === 'h', isP: (e ? e.kind : b.kind) !== 'h',
        body: b.body || (b.lockedBy ? '' : 'Empty section'), empty: !b.body,
        text: e ? e.text : b.body,
        lockedBy: b.lockedBy || '', locked: !!b.lockedBy, free: !b.lockedBy && !editing,
        border: editing ? k.strong : b.lockedBy ? '#F0D27A' : 'transparent', bg: editing ? '#FFFFFF' : b.lockedBy ? '#FFFBEA' : 'transparent',
        meta: b.lockedBy ? '✎ ' + b.lockedBy + ' is writing this…' : b.by ? (b.by === 'You' ? 'You' : b.by) + ' · ' + ago(b.at) : '',
        edit: function () { startEdit(b); },
        onInput: function (ev) {
          var en = S.edit[b.id]; if (!en) return; en.text = ev && ev.target ? ev.target.value : en.text;
          clearTimeout(S.saveT[b.id]); S.saveT[b.id] = setTimeout(function () { flush(b.id, false); }, 800);
        },
        done: function () { flush(b.id, true); },
        kindLabel: (e && e.kind === 'h') ? 'Make it text' : 'Make it a heading',
        toggleKind: function () { var en = S.edit[b.id]; if (!en) return; en.kind = en.kind === 'h' ? 'p' : 'h'; redraw(); clearTimeout(S.saveT[b.id]); S.saveT[b.id] = setTimeout(function () { flush(b.id, false); }, 300); },
        addBelow: function () { addBlock(b.id, 'p'); },
        remove: function () { delete S.edit[b.id]; rpc('room_block_remove', { p_block: b.id }).then(function (r) { if (!r.ok) note(r.message, 'err'); S.rev = null; poll(); }).catch(function (er) { note(er.message, 'err'); }); }
      };
    });
    var notesText = (R.blocks || []).map(function (b) { return b.kind === 'h' ? '## ' + b.body : b.body; }).filter(Boolean).join('\n\n');
    // vault
    var cards = R.cards || [], topics = [];
    cards.forEach(function (c) { if (c.topic && topics.indexOf(c.topic) < 0) topics.push(c.topic); });
    var vt = S.vault.topic && topics.indexOf(S.vault.topic) >= 0 ? S.vault.topic : null;
    var shown = cards.filter(function (c) { return !vt || c.topic === vt; });
    var kit = k.shareKit;
    var st = S.vault.study;
    var studyCard = st ? shown[st.i % Math.max(1, shown.length)] : null;
    // readings
    var weeks = [], byWeek = {};
    (R.readings || []).forEach(function (x) { var w = x.week || 'Readings'; if (!byWeek[w]) { byWeek[w] = []; weeks.push(w); } byWeek[w].push(x); });
    var rl = window.UnizyPacks && window.UnizyPacks.readingFor ? window.UnizyPacks.readingFor() : null;
    // quiz
    var qv = {};
    if (q) {
      var online = (R.members || []).filter(function (m) { return m.online; }).length;
      var qq = q.question || {}, myC = q.myChoice, answered = myC !== null && myC !== undefined, reveal = q.state === 'reveal' || q.state === 'done';
      qv = {
        title: q.title, isLobby: q.state === 'lobby', isQuestion: q.state === 'question', isReveal: q.state === 'reveal', isDone: q.state === 'done', active: q.state !== 'done',
        host: q.isHost, notHost: !q.isHost, hostName: q.host, num: 'Question ' + (q.idx + 1) + ' of ' + q.total,
        q: qq.q || '', why: qq.why || '', hasWhy: !!qq.why && reveal,
        secs: Math.ceil(qLeft(q) / 1000), bar: Math.round(qLeft(q) / (q.seconds * 1000) * 100) + '%',
        answeredText: q.answered + ' of ' + online + ' answered', waitText: answered ? 'Answer locked in. Waiting for the others…' : '',
        options: (qq.options || []).map(function (o, i) {
          var right = reveal && i === qq.answer, mine = myC === i, wrong = reveal && mine && !right;
          var n = q.counts && q.counts[String(i)] ? q.counts[String(i)] : 0;
          return { label: String.fromCharCode(65 + i) + '. ' + o + (reveal ? '  (' + n + ')' : ''), bg: right ? '#EEF6E4' : wrong ? '#FBEDEF' : mine ? k.tint : '#FFFFFF', border: right ? '#2E7D32' : wrong ? '#C8102E' : mine ? k.strong : '#DADAD4', weight: mine ? '800' : '600',
            pick: function () { if (answered || q.state !== 'question') return; q.myChoice = i; redraw(); rpc('quiz_answer', { p_session: q.id, p_idx: q.idx, p_choice: i }).then(function (r) { if (!r.ok) note(r.message, 'err'); poll(); }).catch(function () {}); } };
        }),
        board: (q.board || []).map(function (p, i) { return { rank: i + 1, name: p.me ? 'You' : p.name, points: p.points, correct: p.correct + ' right', weight: p.me ? '800' : '600' }; }),
        hasBoard: (q.board || []).length > 0,
        players: (R.members || []).filter(function (m) { return m.online; }).map(function (m) { return { name: m.me ? 'You' : m.name, initial: initial(m.name) }; }),
        start: function () { rpc('quiz_advance', { p_session: q.id }).then(poll).catch(function (e) { note(e.message, 'err'); }); },
        reveal: function () { rpc('quiz_advance', { p_session: q.id }).then(poll).catch(function (e) { note(e.message, 'err'); }); },
        nextLabel: q.idx + 1 >= q.total ? 'Finish and show results' : 'Next question',
        next: function () { rpc('quiz_advance', { p_session: q.id }).then(poll).catch(function (e) { note(e.message, 'err'); }); },
        end: function () { rpc('quiz_end', { p_session: q.id }).then(poll).catch(function (e) { note(e.message, 'err'); }); },
        doneNote: 'Everyone who answered at least half the questions has this score added to the ' + (k.active.code || 'module') + ' benchmark.'
      };
    }
    var quizTopics = kit ? (kit.quizTopics || []) : [];
    return {
      loading: !S.room, ready: !!S.room,
      name: room.name || 'Study room', module: room.module || k.active.name, code: room.code || '', isOwner: !!room.owner,
      openText: room.open ? 'Open: coursemates can find it' : 'Invite only', toggleOpen: function () { rpc('room_settings', { p_room: S.rid, p_name: null, p_open: !room.open }).then(function () { S.rev = null; poll(); }).catch(function () {}); },
      copyCode: function () {
        var t = 'Join my Unizy study room for ' + (room.module || k.active.name) + ': code ' + room.code + ' (Campus → Study rooms on unizy.uk)';
        try { navigator.clipboard.writeText(t).then(function () { note('Invite copied. Send it to your group.', 'ok'); }, function () { window.prompt('Copy this invite:', t); }); } catch (e) { window.prompt('Copy this invite:', t); }
      },
      back: closeRoom,
      leave: function () {
        if (!S.leaveArm) { S.leaveArm = true; redraw(); setTimeout(function () { S.leaveArm = false; redraw(); }, 4000); return; }
        S.leaveArm = false; var id = S.rid; closeRoom();
        rpc('room_leave', { p_room: id }).then(function (r) { note(r.message, r.ok ? 'info' : 'err'); S.listAt = 0; redraw(); }).catch(function (e) { note(e.message, 'err'); });
      },
      leaveLabel: S.leaveArm ? 'Tap again to leave' : 'Leave room',
      members: (R.members || []).map(function (m) { return { name: m.me ? 'You' : m.name, initial: initial(m.name), dot: m.online ? '#2E7D32' : '#BDBDB6', title: (m.owner ? 'Owner · ' : '') + (m.online ? 'here now' : 'away') }; }),
      onlineText: (R.members || []).filter(function (m) { return m.online; }).length + ' here now · ' + (R.members || []).length + ' members',
      liveBanner: !!(q && q.state !== 'done' && S.sub !== 'quiz'), liveText: (q ? q.host + ' started “' + q.title + '”' : ''), goQuiz: function () { S.sub = 'quiz'; redraw(); },
      subs: subs, isNotes: S.sub === 'notes', isVault: S.sub === 'vault', isReading: S.sub === 'reading', isQuiz: S.sub === 'quiz',
      // notes
      blocks: blocks, addSection: function () { addBlock(null, 'p'); }, addHeading: function () { addBlock(null, 'h'); },
      copyNotes: function () { if (!kit) return; kit.saveNote((room.name || 'Study room') + ' shared notes', notesText, ''); note('A copy is in your Notes for ' + kit.module + '.', 'ok'); },
      notesHelp: 'Click a section to write in it. One person writes in a section at a time, and everyone sees each change within a couple of seconds. Add a section for each seminar question and split them up.',
      // vault
      vaultCount: cards.length + (cards.length === 1 ? ' card' : ' cards') + ' from ' + (function () { var w = {}; cards.forEach(function (c) { w[c.who] = 1; }); return Object.keys(w).length; })() + ' people',
      topics: [{ t: null, l: 'All (' + cards.length + ')' }].concat(topics.map(function (t) { return { t: t, l: t + ' (' + cards.filter(function (c) { return c.topic === t; }).length + ')' }; })).map(function (x) {
        var on = vt === x.t; return { label: x.l, bg: on ? k.strong : '#FFFFFF', fg: on ? k.onStrong : '#141414', border: on ? k.strong : '#DADAD4', pick: function () { S.vault.topic = x.t; S.vault.study = null; redraw(); } };
      }),
      sets: kit ? (kit.cardSets || []).map(function (c) { var on = S.vault.pick === c.id; return { label: c.label + ' (' + Math.min(40, c.n) + ')', bg: on ? k.tint : '#FFFFFF', border: on ? k.strong : '#DADAD4', pick: function () { S.vault.pick = c.id; redraw(); } }; }) : [],
      hasSets: !!(kit && kit.cardSets && kit.cardSets.length), noSets: !(kit && kit.cardSets && kit.cardSets.length),
      newTopic: S.vault.newTopic, onNewTopic: function (e) { S.vault.newTopic = e && e.target ? e.target.value : ''; },
      addCards: function () {
        if (!kit || !S.vault.pick) return note('Pick one of your card sets first.', 'err');
        var cs = kit.cards(S.vault.pick); if (!cs.length) return note('That set is empty.', 'err');
        var topic = String((document.querySelector('[data-rm-topic]') || {}).value || S.vault.newTopic || '').trim();
        rpc('room_cards_add', { p_room: S.rid, p_cards: cs, p_topic: topic }).then(function (r) { if (!r.ok) { note(r.message, 'err'); return; } note(r.n + ' cards added to the vault.', 'ok'); S.vault.pick = null; S.rev = null; poll(); }).catch(function (e) { note(e.message, 'err'); });
      },
      cards: shown.slice(0, 60).map(function (c) { return { f: c.f, b: c.b, meta: [c.topic, c.who].filter(Boolean).join(' · '), mine: c.mine || room.owner, remove: function () { rpc('room_card_remove', { p_card: c.id }).then(function (r) { if (!r.ok) note(r.message, 'err'); S.rev = null; poll(); }).catch(function () {}); } }; }),
      moreCards: shown.length > 60 ? '+ ' + (shown.length - 60) + ' more in the vault' : '', hasCards: shown.length > 0, noCards: !cards.length,
      saveAll: function () { if (!kit || !shown.length) return; kit.saveCards(shown.map(function (c) { return { f: c.f, b: c.b }; }), room.name || 'your study room'); note(shown.length + ' cards saved to ' + kit.module + '. Find them in Revise → Flashcards.', 'ok'); },
      saveAllLabel: 'Save ' + shown.length + ' to my cards',
      study: function () { if (!shown.length) return; S.vault.study = { i: 0, flip: false, order: null }; redraw(); },
      studying: !!st && !!studyCard, notStudying: !(st && studyCard),
      sc: studyCard ? { f: studyCard.f, b: studyCard.b, flipped: !!st.flip, front: !st.flip, num: ((st.i % shown.length) + 1) + ' of ' + shown.length } : {},
      flip: function () { if (S.vault.study) { S.vault.study.flip = !S.vault.study.flip; redraw(); } },
      nextCard: function () { if (S.vault.study) { S.vault.study.i++; S.vault.study.flip = false; redraw(); } },
      stopStudy: function () { S.vault.study = null; redraw(); },
      // readings
      weeks: weeks.map(function (w) {
        return { name: w, items: byWeek[w].map(function (x) {
          var open = !!S.rd.open[x.id];
          return { title: x.title, detail: x.detail, hasDetail: !!x.detail, who: x.who ? (x.who === 'You' ? 'You’re doing this' : x.who + ' is doing this') : 'Nobody yet',
            claimLabel: x.mineAssigned ? 'Drop it' : x.who ? 'Take it over' : 'I’ll do it', done: x.done, box: x.done ? '✓' : '', boxBg: x.done ? k.strong : '#FFFFFF', boxBorder: x.done ? k.strong : '#BDBDB6', boxFg: k.onStrong,
            summary: x.summary, hasSummary: !!x.summary, draft: S.rd.sum[x.id] !== undefined ? S.rd.sum[x.id] : x.summary,
            onSum: function (ev) { S.rd.sum[x.id] = ev && ev.target ? ev.target.value : ''; }, open: open, closed: !open, sumLabel: x.summary ? (open ? 'Hide summary' : 'Read summary') : (open ? 'Cancel' : 'Write a summary for the group'),
            attr: String(x.id), canRemove: x.canRemove || room.owner,
            claim: function () { rpc('room_reading_update', { p_id: x.id, p_action: 'claim', p_text: null }).then(function () { S.rev = null; poll(); }).catch(function () {}); },
            toggleDone: function () { rpc('room_reading_update', { p_id: x.id, p_action: 'done', p_text: null }).then(function () { S.rev = null; poll(); }).catch(function () {}); },
            toggleSum: function () { S.rd.open[x.id] = !open; redraw(); },
            saveSum: function () { var el = document.querySelector('[data-rm-sum="' + x.id + '"]'); var t = el ? el.value : (S.rd.sum[x.id] || ''); rpc('room_reading_update', { p_id: x.id, p_action: 'summary', p_text: t }).then(function () { delete S.rd.sum[x.id]; S.rd.open[x.id] = false; note('Summary shared with the room.', 'ok'); S.rev = null; poll(); }).catch(function () {}); },
            remove: function () { rpc('room_reading_update', { p_id: x.id, p_action: 'remove', p_text: null }).then(function (r) { if (!r.ok) note(r.message, 'err'); S.rev = null; poll(); }).catch(function () {}); }
          };
        }) };
      }),
      noReadings: !(R.readings || []).length,
      rdTitle: S.rd.title, onRdTitle: function (e) { S.rd.title = e && e.target ? e.target.value : ''; },
      rdWeek: S.rd.week, onRdWeek: function (e) { S.rd.week = e && e.target ? e.target.value : ''; },
      addReading: function () {
        var t = String((document.querySelector('[data-rm-rtitle]') || {}).value || S.rd.title || '').trim(), w = String((document.querySelector('[data-rm-rweek]') || {}).value || S.rd.week || '').trim();
        if (!t) return note('Type the reading first.', 'err');
        rpc('room_readings_add', { p_room: S.rid, p_items: [{ title: t, week: w }] }).then(function () { S.rd.title = ''; var el = document.querySelector('[data-rm-rtitle]'); if (el) el.value = ''; S.rev = null; poll(); }).catch(function (e) { note(e.message, 'err'); });
      },
      canImport: !!(k.active.code && k.uni && /^(ucl|lse|qmul)$/.test(k.uni.id)),
      importing: S.rd.importing,
      rlSections: rl && rl.found ? rl.sections.map(function (s, i) { return { label: s.name.length > 60 ? s.name.slice(0, 58) + '…' : s.name, n: s.items.length, pick: function () {
        rpc('room_readings_add', { p_room: S.rid, p_items: s.items.slice(0, 60).map(function (it) { return { title: it.t, detail: [it.a, it.y, it.k].filter(Boolean).join(' · '), week: s.name.slice(0, 80) }; }) })
          .then(function (r) { S.rd.importing = false; note((r.n || 0) + ' readings added. Now split them up.', 'ok'); S.rev = null; poll(); }).catch(function (e) { note(e.message, 'err'); });
      } }; }) : [],
      hasRl: !!(rl && rl.found), rlEmpty: !!(rl && !rl.found),
      startImport: function () { S.rd.importing = !S.rd.importing; if (S.rd.importing && window.UnizyPacks) window.UnizyPacks.loadReading().then(redraw); redraw(); },
      // quiz
      q: qv, hasQuiz: !!q && q.state !== 'done', quizDone: !!q && q.state === 'done', noQuiz: !q || q.state === 'done',
      qTopics: quizTopics.map(function (t) { var on = S.qz.topic === t.id; return { label: t.label.length > 50 ? t.label.slice(0, 48) + '…' : t.label, bg: on ? k.tint : '#FFFFFF', border: on ? k.strong : '#DADAD4', pick: function () { S.qz.topic = t.id; redraw(); } }; }),
      hasQTopics: quizTopics.length > 0, noQTopics: !quizTopics.length,
      qSizes: [5, 10, 15].map(function (n) { var on = S.qz.n === n; return { label: n + ' questions', bg: on ? k.strong : '#FFFFFF', fg: on ? k.onStrong : '#141414', border: on ? k.strong : '#DADAD4', pick: function () { S.qz.n = n; redraw(); } }; }),
      qTimes: [20, 30, 45].map(function (n) { var on = S.qz.secs === n; return { label: n + 's each', bg: on ? k.strong : '#FFFFFF', fg: on ? k.onStrong : '#141414', border: on ? k.strong : '#DADAD4', pick: function () { S.qz.secs = n; redraw(); } }; }),
      startQuiz: function () {
        if (!kit) return;
        var qs = kit.quiz(S.qz.topic, S.qz.n); if (qs.length < 2) return note('Not enough multiple-choice questions on that topic yet. Try “Mixed topics”.', 'err');
        var t = (quizTopics.filter(function (x) { return x.id === S.qz.topic; })[0] || {}).label || 'Group quiz';
        rpc('quiz_start', { p_room: S.rid, p_title: t, p_questions: qs, p_seconds: S.qz.secs }).then(function (r) { if (!r.ok) { note(r.message, 'err'); return; } S.sub = 'quiz'; poll(); }).catch(function (e) { note(e.message, 'err'); });
      }
    };
  }
  function vals(inst, v) {
    S.inst = inst;
    var k = v.campusKit;
    if (!k || k.screen !== 'app') return {};
    k.strong = k.strong || '#141414'; k.onStrong = k.onStrong || '#FFFFFF'; k.tint = (k.theme && k.theme.tint) || '#F3F3EF';
    S.kit = k;
    var onTab = k.tab === 'rooms';
    if (!onTab && S.rid) { clearTimeout(S.timer); S.timer = setTimeout(poll, 20000); }
    if (onTab && S.rid && !S.timer) setTimeout(poll, 0);
    if (onTab && !S.rid && signedIn()) setTimeout(function () { loadList(k); }, 0);
    var out = {
      inRoom: !!S.rid, notInRoom: !S.rid,
      hasMsg: !!S.msg, msg: S.msg, msgBg: S.kind === 'err' ? '#FBEDEF' : S.kind === 'ok' ? '#EEF6E4' : '#F3F3EF', clearMsg: function () { note(''); },
      live: !!(S.room && S.room.quiz && S.room.quiz.state !== 'done')
    };
    if (onTab) { out.list = listVals(k); if (S.rid) out.room = roomVals(k); else out.room = {}; }
    else { out.list = {}; out.room = {}; }
    return out;
  }
  // topic tests feed the cohort benchmark (anonymous: only totals are shown)
  function benchSubmit(mod, pct, n) {
    var key = hubKey(mod); if (!signedIn() || !key || !(n >= 3)) return;
    rpc('bench_submit', { p_module_key: key, p_pct: pct, p_n: n }).then(function () { S.benchAt[key] = 0; }).catch(function () {});
  }
  window.UnizyRooms = { vals: vals, benchSubmit: benchSubmit, _state: S };
})();
