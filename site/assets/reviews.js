/* Unizy reviews page: public list + one review per confirmed account. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG, SKEY = 'unizy.session';
  var $ = function (id) { return document.getElementById(id); };
  var state = { sort: 'newest', offset: 0, page: 10, mine: null, confirmed: false, token: null };

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
  function stars(n, cls) {
    var w = el('span', { class: 'rv-stars ' + (cls || ''), 'aria-label': n + ' out of 5 stars', role: 'img' });
    for (var i = 1; i <= 5; i++) w.appendChild(el('i', { class: i <= Math.round(n) ? 'on' : '', 'aria-hidden': 'true', text: '★' }));
    return w;
  }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }

  // ---------- public list ----------
  function load(reset) {
    if (reset) { state.offset = 0; $('list').innerHTML = ''; }
    return rpc('public_reviews', { p_limit: state.page, p_offset: state.offset, p_sort: state.sort }).then(function (d) {
      var n = +d.count || 0;
      $('avg').textContent = n ? String(d.average) : '–';
      var as = $('avg-stars'); as.innerHTML = ''; if (n) as.appendChild(stars(+d.average, 'big'));
      $('count').textContent = n ? n + (n === 1 ? ' review' : ' reviews') + ' from Unizy students' : 'No reviews yet. Be the first.';
      var bars = $('bars'); bars.innerHTML = '';
      [5, 4, 3, 2, 1].forEach(function (s) {
        var c = (d.stars && +d.stars[s]) || 0, pct = n ? Math.round(c * 100 / n) : 0;
        bars.appendChild(el('div', { class: 'rv-bar' }, [el('span', { text: s + ' ★' }), el('span', { class: 'rv-track' }, [el('i', { style: 'width:' + pct + '%' })]), el('span', { class: 'rv-n', text: String(c) })]));
      });
      var list = $('list');
      if (!n && reset) list.appendChild(el('div', { class: 'rv-empty' }, [el('strong', { text: 'No reviews yet.' }), ' Unizy has only just launched. If you’ve used it, your review will be the first one students see.']));
      (d.reviews || []).forEach(function (r) {
        var course = r.course && String(r.course).trim();
        list.appendChild(el('article', { class: 'rv-card' }, [
          el('div', { class: 'rv-card-top' }, [stars(r.rating), el('span', { class: 'rv-date', text: day(r.at) + (r.edited ? ' · edited' : '') })]),
          r.title ? el('h3', { text: r.title }) : null,
          el('p', { class: 'rv-body', text: r.body }),
          el('p', { class: 'rv-who' }, [el('strong', { text: r.name }), course ? ' · ' + course : '', el('span', { class: 'rv-verified', text: 'Verified Unizy account' })])
        ]));
      });
      state.offset += (d.reviews || []).length;
      $('more').hidden = state.offset >= n;
    }).catch(function () { $('count').textContent = 'Couldn’t load reviews. Refresh to try again.'; });
  }
  $('sort').addEventListener('change', function () { state.sort = this.value; load(true); });
  $('more').addEventListener('click', function () { load(false); });

  // ---------- writing a review ----------
  function renderWrite() {
    var box = $('write'); box.innerHTML = '';
    box.appendChild(el('h2', { text: state.mine ? 'Your review' : 'Leave a review' }));
    if (!state.token) {
      box.appendChild(el('p', { class: 'muted', text: 'Reviews can only be left by students with a Unizy account, one per account.' }));
      box.appendChild(el('div', { class: 'rv-actions' }, [el('a', { class: 'btn primary', href: '/login?next=' + encodeURIComponent('/reviews'), text: 'Log in to write a review' }), el('a', { class: 'btn ghost', href: '/signup?next=' + encodeURIComponent('/reviews'), text: 'Create an account' })]));
      return;
    }
    if (!state.confirmed) {
      box.appendChild(el('p', { class: 'muted', text: 'Confirm your email address first: open the link we emailed you when you signed up. Then come back here to leave your review.' }));
      return;
    }
    if (state.mine && state.mine.status === 'hidden') {
      box.appendChild(el('p', { class: 'muted', text: 'Your review was removed for breaking the review rules. Email ' + CFG.contactEmail + ' if you think this is a mistake.' }));
      return;
    }
    if (state.mine && !state.editing) {
      box.appendChild(el('div', { class: 'rv-card mine' }, [
        el('div', { class: 'rv-card-top' }, [stars(state.mine.rating), el('span', { class: 'rv-date', text: day(state.mine.at) })]),
        state.mine.title ? el('h3', { text: state.mine.title }) : null,
        el('p', { class: 'rv-body', text: state.mine.body })
      ]));
      var del = el('button', { class: 'btn ghost', type: 'button', text: 'Delete' });
      del.addEventListener('click', function () {
        if (del.getAttribute('data-arm') !== '1') { del.setAttribute('data-arm', '1'); del.textContent = 'Tap again to delete'; setTimeout(function () { del.removeAttribute('data-arm'); del.textContent = 'Delete'; }, 4000); return; }
        rpc('delete_my_review', {}, state.token).then(function () { state.mine = null; renderWrite(); load(true); }).catch(function (e) { alertMsg(e.message); });
      });
      box.appendChild(el('div', { class: 'rv-actions' }, [el('button', { class: 'btn primary', type: 'button', text: 'Edit my review', onclick: function () { state.editing = true; renderWrite(); } }), del]));
      box.appendChild(el('p', { class: 'muted small', text: 'You can have one review per account. Editing replaces it.' }));
      return;
    }
    // the form
    var m = state.mine || {};
    var msg = el('div', { class: 'msg', role: 'alert', hidden: true });
    var picked = m.rating || 0;
    var group = el('div', { class: 'rv-pick', role: 'radiogroup', 'aria-label': 'Star rating' });
    var labels = ['', 'Poor', 'Not great', 'OK', 'Good', 'Excellent'];
    var hint = el('span', { class: 'rv-pick-hint', text: picked ? labels[picked] : 'Choose a rating' });
    var paint = function () { Array.prototype.forEach.call(group.children, function (b, i) { b.className = i < picked ? 'on' : ''; b.setAttribute('aria-checked', i + 1 === picked ? 'true' : 'false'); }); hint.textContent = picked ? labels[picked] : 'Choose a rating'; };
    for (var i = 1; i <= 5; i++) (function (v) {
      var b = el('button', { type: 'button', role: 'radio', 'aria-label': v + (v === 1 ? ' star' : ' stars') + ', ' + labels[v], text: '★' });
      b.addEventListener('click', function () { picked = v; paint(); });
      b.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); picked = Math.min(5, (picked || 0) + 1); paint(); group.children[picked - 1].focus(); } if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); picked = Math.max(1, (picked || 2) - 1); paint(); group.children[picked - 1].focus(); } });
      group.appendChild(b);
    })(i);
    var title = el('input', { id: 'rv-title', type: 'text', maxlength: '80', placeholder: 'e.g. Saved me hours before exams', value: m.title || '' });
    var body = el('textarea', { id: 'rv-body', maxlength: '1500', rows: '6', placeholder: 'What did you use Unizy for, and how did it help? Be honest: good and bad both help other students.' });
    body.value = m.body || '';
    var counter = el('span', { class: 'muted small', text: (body.value.length) + ' / 1500' });
    body.addEventListener('input', function () { counter.textContent = body.value.length + ' / 1500'; });
    var showCourse = el('input', { id: 'rv-course', type: 'checkbox' }); showCourse.checked = m.showCourse !== false;
    var submit = el('button', { class: 'btn primary', type: 'submit', text: state.mine ? 'Save changes' : 'Post my review' });
    var form = el('form', { class: 'rv-form', novalidate: true }, [
      el('div', { class: 'rv-row' }, [el('span', { class: 'lab', text: 'Your rating' }), group, hint]),
      el('label', { class: 'rv-field', for: 'rv-title' }, [el('span', { class: 'lab', text: 'Headline (optional)' }), title]),
      el('label', { class: 'rv-field', for: 'rv-body' }, [el('span', { class: 'lab', text: 'Your review' }), body, counter]),
      el('label', { class: 'rv-check', for: 'rv-course' }, [showCourse, ' Show my university, course and year with my review']),
      msg,
      el('div', { class: 'rv-actions' }, [submit, state.mine ? el('button', { class: 'btn ghost', type: 'button', text: 'Cancel', onclick: function () { state.editing = false; renderWrite(); } }) : null]),
      el('p', { class: 'muted small', text: 'Only your first name is shown, never your email. One review per account.' })
    ]);
    paint();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var show = function (t, ok) { msg.hidden = false; msg.className = 'msg' + (ok ? ' ok' : ''); msg.textContent = t; };
      if (!picked) { show('Choose a star rating.'); return; }
      if (body.value.trim().length < 20) { show('Write at least 20 characters so other students know what you think.'); body.focus(); return; }
      submit.disabled = true; submit.textContent = 'Saving…';
      fresh().then(function (s) {
        if (!s) throw new Error('Please log in again.');
        state.token = s.access_token;
        return rpc('submit_review', { p_rating: picked, p_title: title.value, p_body: body.value, p_show_course: showCourse.checked }, s.access_token);
      }).then(function (r) {
        submit.disabled = false; submit.textContent = state.mine ? 'Save changes' : 'Post my review';
        if (!r.ok) { show(r.message); return; }
        state.editing = false;
        return rpc('my_review', {}, state.token).then(function (d) { state.mine = d.review; renderWrite(); load(true); var ok = el('div', { class: 'msg ok', role: 'status', text: r.message }); $('write').insertBefore(ok, $('write').children[1] || null); });
      }).catch(function (err) { submit.disabled = false; submit.textContent = state.mine ? 'Save changes' : 'Post my review'; show(err.message || 'Something went wrong.'); });
    });
    box.appendChild(form);
  }
  function alertMsg(t) { var b = $('write'); var m = el('div', { class: 'msg', role: 'alert', text: t }); b.appendChild(m); }

  load(true);
  fresh().then(function (s) {
    if (!s) { renderWrite(); return; }
    state.token = s.access_token;
    $('nav-app').textContent = 'My dashboard';
    return rpc('my_review', {}, s.access_token).then(function (d) { state.confirmed = !!d.confirmed; state.mine = d.review; renderWrite(); })
      .catch(function () { state.token = null; renderWrite(); });
  });
})();
