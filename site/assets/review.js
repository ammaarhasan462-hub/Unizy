/* Unizy clinical review workspace: invited clinicians read every part of a medical topic (answers and explanations
   visible) and sign it off. A sign-off records the topic's content hash, so any later edit needs a fresh review. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG, SKEY = 'unizy.session', D = window.UZDIAG;
  var $ = function (id) { return document.getElementById(id); };
  var S = { token: null, me: null, index: null, pack: null, packId: null, topic: null, signs: null, queue: null, msg: null };
  var SECNAME = { core: 'Core concept', mechanism: 'Mechanism', features: 'Key features', investigations: 'Investigations', management: 'Management principles', clinical: 'Clinical application', misconceptions: 'Common misconceptions' };

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function headers(t) { var h = { apikey: CFG.anonKey, 'Content-Type': 'application/json' }; if (t) h.Authorization = 'Bearer ' + t; return h; }
  function rpc(fn, args, token) {
    return fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + fn, { method: 'POST', headers: headers(token), body: JSON.stringify(args || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error((b && b.message) || 'Something went wrong.'); return b; }); });
  }
  function session() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function fresh() {
    var s = session();
    if (!s || !s.refresh_token) return Promise.resolve(null);
    if ((s.expires_at || 0) - 60 > Date.now() / 1000) return Promise.resolve(s);
    return fetch(CFG.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: s.refresh_token }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        if (!b || !b.access_token) return null;
        var ns = Object.assign({}, s, { access_token: b.access_token, refresh_token: b.refresh_token, expires_at: b.expires_at || Math.floor(Date.now() / 1000) + (b.expires_in || 3600) });
        try { localStorage.setItem(SKEY, JSON.stringify(ns)); } catch (e) {}
        return ns;
      }).catch(function () { return null; });
  }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function main() { var m = $('main'); m.innerHTML = ''; window.scrollTo(0, 0); return m; }
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('Could not load ' + u); return r.json(); }); }

  // ---------- screens ----------
  function signedOut() {
    var m = main();
    m.appendChild(el('h1', { text: 'Clinical review' }));
    m.appendChild(el('p', { class: 'lead', text: 'This workspace is for doctors and other registered clinicians who review Unizy’s medical content. Log in with the account you were invited with.' }));
    m.appendChild(el('div', {}, [el('a', { class: 'btn', href: '/login?next=' + encodeURIComponent('/review'), text: 'Log in' })]));
  }
  function notReviewer() {
    var m = main();
    m.appendChild(el('h1', { text: 'Clinical review' }));
    m.appendChild(el('p', { class: 'lead', text: 'Your account isn’t set up as a clinical reviewer yet. Unizy invites registered clinicians (for example foundation doctors and above, with a GMC number) to check medical topics before their name appears on them.' }));
    m.appendChild(el('p', { class: 'lead' }, ['Interested? Email ', el('a', { href: 'mailto:' + CFG.contactEmail + '?subject=' + encodeURIComponent('Clinical reviewer for Unizy'), text: CFG.contactEmail }), ' with your role, GMC number and the areas you could review.']));
  }
  function home() {
    S.pack = null; S.topic = null; history.replaceState(null, '', '/review');
    var m = main();
    m.appendChild(el('h1', { text: 'Clinical review' }));
    m.appendChild(el('p', { class: 'lead', text: 'Pick a module, then a topic. You’ll see everything students see, with the right answers and every explanation shown. Approve it if it is accurate and safe for medical students, or request changes and say what is wrong. Your name and role appear on topics you approve; if the topic is edited later, it shows as waiting for a new review.' }));
    var grid = el('div', { class: 'grid' });
    (S.index || []).forEach(function (p) {
      grid.appendChild(el('button', { class: 'pick', type: 'button', onclick: function () { openPack(p.id); } }, [
        el('strong', { text: p.title }), el('small', { text: p.where + ' · ' + p.topics.length + ' topics' })]));
    });
    if (!(S.index || []).length) grid.appendChild(el('p', { class: 'lead', text: 'No medical modules are ready for review yet.' }));
    m.appendChild(grid);
  }
  function openPack(id) {
    var m = main(); m.appendChild(el('p', { class: 'lead', text: 'Loading…' }));
    Promise.all([getJSON('/data/library/' + id + '.json'), rpc('public_signoffs', { p_pack: id }), rpc('review_queue', { p_pack: id }, S.token)]).then(function (r) {
      S.packId = id; S.pack = r[0]; S.signs = r[1]; S.queue = r[2];
      history.replaceState(null, '', '/review?pack=' + encodeURIComponent(id));
      packView();
    }).catch(function (e) { m.innerHTML = ''; m.appendChild(el('p', { class: 'msg', text: e.message })); m.appendChild(el('button', { class: 'back', text: '← All modules', onclick: home })); });
  }
  function statusOf(t) {
    var h = D.hash(S.pack, t), sg = (S.signs.topics || []).find(function (x) { return +x.topic === t; });
    if (sg && sg.approvedHash === h && sg.decision === 'approved') return { cls: 'ok', text: 'Signed off by ' + sg.name + ' · ' + day(sg.at), h: h };
    if (sg && sg.decision === 'changes' && sg.hash === h) return { cls: 'bad', text: 'Changes requested · ' + day(sg.at), h: h };
    if (sg && sg.approvedHash) return { cls: 'warn', text: 'Edited since sign-off: needs review', h: h };
    return { cls: '', text: 'Not reviewed yet', h: h };
  }
  function packView() {
    var p = S.pack, m = main();
    m.appendChild(el('button', { class: 'back', text: '← All modules', onclick: home }));
    m.appendChild(el('h1', { text: p.title }));
    if (p.about) m.appendChild(el('p', { class: 'lead', text: p.about }));
    m.appendChild(el('p', { class: 'lead', text: 'Content last checked against its sources: ' + (p.reviewed ? day(p.reviewed) : 'not recorded') + '.' }));
    var grid = el('div', { class: 'grid' });
    p.topics.forEach(function (name, t) {
      var st = statusOf(t), open = (S.queue.reports || []).filter(function (r) { return +r.topic === t && r.status === 'open'; }).length;
      grid.appendChild(el('button', { class: 'pick', type: 'button', onclick: function () { topicView(t); } }, [
        el('strong', { text: (t + 1) + '. ' + name }), el('span', {}, [el('span', { class: 'pill ' + st.cls, text: st.text })]),
        open ? el('small', { text: open + ' open student report' + (open === 1 ? '' : 's') }) : null]));
    });
    m.appendChild(grid);
  }
  function srcLinks(ix) {
    var srcs = S.pack.sources || [];
    var w = el('div', { class: 'src' }, [el('strong', { text: 'Sources: ' })]);
    (ix || []).forEach(function (k) { var s = srcs[k]; if (s) w.appendChild(el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.title })); });
    return w;
  }
  function mcq(q, label) {
    var box = el('div', { class: 'q' });
    if (label) box.appendChild(el('span', { class: 'k', text: label }));
    box.appendChild(el('div', { class: 'body', style: 'font-weight:600', text: q.q }));
    (q.options || []).forEach(function (o, i) {
      var right = i === q.answer, ow = (q.optWhy || [])[i];
      box.appendChild(el('div', { class: 'opt' + (right ? ' right' : '') }, [el('em', { text: right ? '✓' : '✗' }), el('div', {}, [el('div', { text: o }), ow ? el('div', { class: 'why', text: ow }) : null])]));
    });
    if (q.why) box.appendChild(el('div', { class: 'why' }, [el('strong', { text: 'Explanation: ' }), q.why]));
    if (q.clue) box.appendChild(el('div', { class: 'why' }, [el('strong', { text: 'Key clue: ' }), q.clue]));
    if (q.concept) box.appendChild(el('div', { class: 'why' }, [el('strong', { text: 'Concept: ' }), q.concept]));
    if (q.followUp) box.appendChild(mcq(q.followUp, 'Follow-up (same concept, new scenario)'));
    return box;
  }
  function topicView(t) {
    var p = S.pack, m = main(), st = statusOf(t);
    S.topic = t; history.replaceState(null, '', '/review?pack=' + encodeURIComponent(S.packId) + '&t=' + t);
    var of = function (k) { return (p[k] || []).filter(function (x) { return +x.t === t; }); };
    m.appendChild(el('button', { class: 'back', text: '← ' + p.title, onclick: packView }));
    m.appendChild(el('h1', { text: (t + 1) + '. ' + p.topics[t] }));
    m.appendChild(el('div', {}, [el('span', { class: 'pill ' + st.cls, text: st.text }), ' ', el('span', { class: 'pill', text: 'Version ' + st.h })]));

    var reps = (S.queue.reports || []).filter(function (r) { return +r.topic === t; });
    if (reps.length) {
      var rc = el('div', { class: 'card' }, [el('h2', { text: 'Student reports' })]);
      reps.forEach(function (r) { rc.appendChild(el('div', { class: 'hist' }, [el('span', { class: 'pill ' + (r.status === 'open' ? 'warn' : r.status === 'fixed' ? 'ok' : ''), text: r.status }), ' ', day(r.at) + (r.item ? ' · ' + r.item : '') + ': ' + r.message + (r.resolution ? ' → ' + r.resolution : '')])); });
      m.appendChild(rc);
    }
    of('notes').forEach(function (n) {
      var c = el('div', { class: 'card' }, [el('h2', { text: 'Notes' })]);
      if (n.overview) c.appendChild(el('div', { class: 'body', text: n.overview }));
      if ((n.objectives || []).length) c.appendChild(el('div', { class: 'body', text: 'Objectives:\n• ' + n.objectives.join('\n• ') }));
      (n.sections || []).forEach(function (sx) {
        var g = sx.kind === 'guidance';
        c.appendChild(el('div', { class: 'sec' }, [el('h3', { text: sx.h || SECNAME[sx.k] || sx.k }),
          el('span', { class: 'badge', style: 'background:' + (g ? '#FDF0D5' : '#E8F0FB'), text: g ? 'Clinical guidance · as of ' + (sx.asOf || '?') : 'Stable principle' }),
          el('div', { class: 'body', text: sx.body }), srcLinks(sx.src)]));
      });
      if (!(n.sections || []).length && n.body) c.appendChild(el('div', { class: 'body', text: n.body }));
      m.appendChild(c);
    });
    var labels = of('labels');
    labels.forEach(function (lb) {
      var nm = D.NAMES[lb.diagram] || {};
      m.appendChild(el('div', { class: 'card' }, [el('h2', { text: lb.title || 'Label the diagram' }), el('img', { class: 'diag', src: D.svg(lb.diagram, lb.items), alt: D.ALT[lb.diagram] || '' }),
        el('div', { class: 'body', text: lb.items.map(function (k, i) { return (i + 1) + ' = ' + (nm[k] || k); }).join('\n') }),
        el('p', { class: 'hist', text: 'Check the numbers sit on the right structures in this schematic.' })]));
    });
    var cards = of('cards');
    if (cards.length) {
      var cc = el('div', { class: 'cards' });
      cards.forEach(function (c) { cc.appendChild(el('div', { class: 'fc' }, [el('span', { class: 'k', text: c.kind || 'card' }), el('strong', { text: c.f }), el('span', { text: c.b }), c.ex ? el('span', { class: 'why', text: 'If wrong: ' + c.ex }) : null])); });
      m.appendChild(el('div', { class: 'card' }, [el('h2', { text: 'Flashcards (' + cards.length + ')' }), cc]));
    }
    var qs = of('questions');
    if (qs.length) {
      var qc = el('div', { class: 'card' }, [el('h2', { text: 'Questions (' + qs.length + ')' })]);
      qs.forEach(function (q) {
        if (q.type === 'mcq') qc.appendChild(mcq(q, (q.stage === 'apply' ? 'Apply' : 'Retrieve') + ' · multiple choice'));
        else qc.appendChild(el('div', { class: 'q' }, [el('span', { class: 'k', text: q.type + ' · ' + q.marks + ' marks' }), el('div', { class: 'body', style: 'font-weight:600', text: q.q }),
          el('div', { class: 'body', text: 'Mark scheme:\n• ' + (q.markScheme || []).join('\n• ') }), el('details', {}, [el('summary', { text: 'Model answer' }), el('div', { class: 'body', text: q.modelAnswer || '' })])]));
      });
      m.appendChild(qc);
    }
    var it = of('interpret');
    if (it.length) {
      var ic = el('div', { class: 'card' }, [el('h2', { text: 'Data interpretation (' + it.length + ')' })]);
      it.forEach(function (x) {
        var box = el('div', { class: 'q' }, [el('span', { class: 'k', text: x.kind + (x.title ? ' · ' + x.title : '') })]);
        if (x.kind === 'ecg') box.appendChild(el('div', { class: 'strip' }, [el('img', { src: D.ecg(x.ecg), alt: 'ECG strip' })]), box.appendChild(el('div', { class: 'hist', text: 'Drawn from: ' + JSON.stringify(x.ecg) })));
        else {
          var tb = el('table', {}, [el('tr', {}, ['Test', 'Result', 'Unit', 'Typical range'].map(function (h) { return el('th', { text: h }); }))]);
          (x.rows || []).forEach(function (r) { tb.appendChild(el('tr', {}, r.map(function (v) { return el('td', { text: v }); }))); });
          box.appendChild(tb);
        }
        box.appendChild(mcq(x, null));
        ic.appendChild(box);
      });
      m.appendChild(ic);
    }
    of('cases').forEach(function (cs) {
      var c = el('div', { class: 'card' }, [el('h2', { text: 'Case: ' + cs.title })]);
      (cs.steps || []).forEach(function (sp, j) { c.appendChild(el('div', { class: 'body', text: (j + 1) + '. ' + sp.text })); if (sp.ask) c.appendChild(mcq(sp.ask, 'Case question')); });
      if ((cs.debrief || []).length) c.appendChild(el('div', { class: 'body', text: 'Debrief:\n• ' + cs.debrief.join('\n• ') }));
      m.appendChild(c);
    });
    of('osce').forEach(function (o) {
      m.appendChild(el('div', { class: 'card' }, [el('h2', { text: 'OSCE: ' + o.title }), el('div', { class: 'body', text: o.steps.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') }),
        (o.tips || []).length ? el('div', { class: 'body', text: 'Tips:\n• ' + o.tips.join('\n• ') }) : null, srcLinks(o.src)]));
    });
    var hist = (S.queue.history || []).filter(function (x) { return +x.topic === t; });
    if (hist.length) {
      var hc = el('details', { class: 'card' }, [el('summary', { text: 'Review history (' + hist.length + ')' })]);
      hist.forEach(function (x) { hc.appendChild(el('div', { class: 'hist', text: day(x.at) + ' · ' + x.name + ' · ' + (x.decision === 'approved' ? 'approved' : 'requested changes') + ' · version ' + x.hash + (x.comments ? ': ' + x.comments : '') })); });
      m.appendChild(hc);
    }
    m.appendChild(decisionBox(t, st.h));
  }
  function decisionBox(t, h) {
    var msg = el('div', { class: 'msg', role: 'alert', hidden: true });
    var checks = ['I have read every section, card, question and explanation above.', 'Facts, mechanisms, investigations and interpretations are accurate and current for UK practice, and the right answers are right.', 'Nothing here is unsafe for medical students learning from it (no doses or advice that could mislead on placement).']
      .map(function (t2, i) { var cb = el('input', { type: 'checkbox', id: 'ck' + i }); return { cb: cb, row: el('label', { class: 'check', for: 'ck' + i }, [cb, t2]) }; });
    var ta = el('textarea', { maxlength: '6000', placeholder: 'Comments. For changes: say exactly what is wrong, where, and the correct version (a guideline link helps).' });
    var ok = el('button', { class: 'btn', type: 'button', text: 'Approve and sign off' });
    var ch = el('button', { class: 'btn ghost', type: 'button', text: 'Request changes' });
    function send(decision) {
      msg.hidden = true;
      if (decision === 'approved' && !checks.every(function (c) { return c.cb.checked; })) { msg.hidden = false; msg.className = 'msg'; msg.textContent = 'Tick all three boxes to approve, or request changes.'; return; }
      ok.disabled = ch.disabled = true;
      fresh().then(function (s) {
        if (!s) throw new Error('Please log in again.');
        S.token = s.access_token;
        return rpc('submit_signoff', { p_pack: S.packId, p_topic: t, p_hash: h, p_decision: decision, p_comments: ta.value }, s.access_token);
      }).then(function (r) {
        ok.disabled = ch.disabled = false;
        msg.hidden = false; msg.className = 'msg' + (r.ok ? ' ok' : ''); msg.textContent = r.message;
        if (r.ok) return Promise.all([rpc('public_signoffs', { p_pack: S.packId }), rpc('review_queue', { p_pack: S.packId }, S.token)]).then(function (x) { S.signs = x[0]; S.queue = x[1]; });
      }).catch(function (e) { ok.disabled = ch.disabled = false; msg.hidden = false; msg.className = 'msg'; msg.textContent = e.message; });
    }
    ok.addEventListener('click', function () { send('approved'); });
    ch.addEventListener('click', function () { send('changes'); });
    return el('div', { class: 'card decide' }, [el('h2', { text: 'Your decision' }), el('p', { class: 'hist', text: 'Signing off as ' + S.me.name + ', ' + S.me.credentials + (S.me.gmc ? ' (GMC ' + S.me.gmc + ')' : '') + '. This covers version ' + h + ' of this topic only.' })]
      .concat(checks.map(function (c) { return c.row; })).concat([ta, msg, el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [ok, ch])]));
  }

  // ---------- start ----------
  fresh().then(function (s) {
    if (!s) { signedOut(); return; }
    S.token = s.access_token;
    return rpc('reviewer_me', {}, s.access_token).then(function (me) {
      if (!me.reviewer) { notReviewer(); return; }
      S.me = me; $('who').textContent = me.name + ' · ' + me.credentials;
      return getJSON('/data/med-index.json').then(function (ix) {
        S.index = ix.packs || [];
        var q = new URLSearchParams(location.search), pid = q.get('pack'), t = q.get('t');
        if (pid && S.index.some(function (p) { return p.id === pid; })) {
          openPack(pid);
          if (t !== null) { var iv = setInterval(function () { if (S.pack && S.packId === pid) { clearInterval(iv); if (+t >= 0 && +t < S.pack.topics.length) topicView(+t); } }, 100); setTimeout(function () { clearInterval(iv); }, 15000); }
        } else home();
      });
    });
  }).catch(function (e) { var m = main(); m.appendChild(el('p', { class: 'msg', text: e.message || 'Something went wrong. Refresh to try again.' })); });
})();
