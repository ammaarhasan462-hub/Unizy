/* Unizy log in, sign up and password reset pages. Shares the session with the app (localStorage "unizy.session"). */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG;
  var MODE = document.body.getAttribute('data-mode'); // login | signup | reset
  var SKEY = 'unizy.session';
  var root = document.getElementById('auth');
  var params = new URLSearchParams(location.search);
  var next = params.get('next') || '/app.html';
  if (!/^\/(?!\/)[\w\-./?=&%#]*$/.test(next)) next = '/app.html';
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  // anonymous daily totals only: no cookies, no IDs
  function track(ev) {
    try {
      if (navigator.webdriver || navigator.globalPrivacyControl || navigator.doNotTrack === '1' || localStorage.getItem('unizy:notrack') === '1') return;
      fetch(CFG.supabaseUrl + '/rest/v1/rpc/track_event', { method: 'POST', keepalive: true, headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_event: ev }) }).catch(function () {});
    } catch (e) {}
  }

  // ---------- helpers ----------
  function headers(token) {
    var h = { apikey: CFG.anonKey, 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }
  function api(path, body, opts) {
    opts = opts || {};
    return fetch(CFG.supabaseUrl + '/auth/v1/' + path, { method: opts.method || 'POST', headers: headers(opts.token), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (b) {
          if (r.ok) return b;
          var e = new Error(b.msg || b.error_description || b.message || b.error || 'Something went wrong.');
          e.status = r.status; e.code = b.error_code || b.code || b.error || '';
          throw e;
        });
      }, function () { var e = new Error('offline'); e.code = 'offline'; throw e; });
  }
  function friendly(e, ctx) {
    var c = String(e.code || ''), m = String(e.message || '');
    if (c === 'offline') return 'Couldn’t reach Unizy. Check your internet connection and try again.';
    if (e.status === 429 || /rate_limit|over_/.test(c) || /rate limit|too many/i.test(m)) return 'Too many attempts just now. Wait a few minutes and try again.';
    if (c === 'invalid_credentials' || /invalid login/i.test(m)) return 'That email and password don’t match. Check them, or reset your password below. If you’ve only ever used email links, choose “Email me a code instead”.';
    if (c === 'email_not_confirmed' || /not confirmed/i.test(m)) return 'confirm';
    if (c === 'user_already_exists' || /already registered|already exists/i.test(m)) return 'exists';
    if (c === 'weak_password' || /password should|weak/i.test(m)) return 'Choose a stronger password: at least 8 characters, and not a common one.';
    if (c === 'same_password') return 'Your new password must be different from your old one.';
    if (c === 'validation_failed' || /invalid.*email|unable to validate email/i.test(m)) return 'Check that your email address is correct.';
    if (/signups not allowed|signup.*disabled/i.test(m)) return 'New sign-ups are paused right now. Please try again later.';
    if (ctx === 'reset' && (e.status === 401 || e.status === 403)) return 'This reset link has expired or was already used. Ask for a new one.';
    return m && m.length < 140 ? m : 'Something went wrong. Please try again.';
  }
  function getSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function saveSession(b) {
    var s = { access_token: b.access_token, refresh_token: b.refresh_token, expires_at: b.expires_at || Math.floor(Date.now() / 1000) + (b.expires_in || 3600), user: b.user ? { id: b.user.id, email: b.user.email, name: (b.user.user_metadata || {}).full_name || '' } : null };
    try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function go() { location.href = next; }
  // ---------- cross-device pairing ----------
  function b64url(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function getPair(fresh) {
    var p = null;
    try { var raw = JSON.parse(sessionStorage.getItem('unizy.pair') || 'null'); if (!fresh && raw && raw.v && Date.now() - raw.t < 18 * 60000) p = raw.v; } catch (e) {}
    if (!p) { var a = new Uint8Array(32); crypto.getRandomValues(a); p = b64url(a); try { sessionStorage.setItem('unizy.pair', JSON.stringify({ v: p, t: Date.now() })); } catch (e) {} }
    return p;
  }
  function confirmUrl(pair) { return location.origin + '/confirmed?pair=' + pair + (next !== '/app.html' ? '&next=' + encodeURIComponent(next) : ''); }
  function fn(name, body, token) {
    return fetch(CFG.supabaseUrl + '/functions/v1/' + name, { method: 'POST', headers: headers(token || CFG.anonKey), body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  var waiter = null;
  function stopWaiting() { if (waiter) { clearTimeout(waiter.t); document.removeEventListener('visibilitychange', waiter.vis); window.removeEventListener('focus', waiter.vis); window.removeEventListener('storage', waiter.st); waiter = null; } }
  function waitForLink(pair, statusEl) {
    stopWaiting();
    var started = Date.now(), busyNow = false;
    var done = function (b) {
      stopWaiting(); saveSession(b); try { sessionStorage.removeItem('unizy.pair'); } catch (e) {}
      render([el('div', { class: 'inbox-icon ok', 'aria-hidden': 'true', text: '✓' }), h1('You’re logged in', 'Your link was opened, so this page has logged you in too. Taking you to your dashboard…')]);
      setTimeout(go, 1100);
    };
    var tick = function () {
      if (!waiter || busyNow) return;
      if (Date.now() - started > 20 * 60000) { stopWaiting(); if (statusEl) statusEl.textContent = 'Stopped checking after 20 minutes. Once you’ve opened the link, log in here.'; return; }
      busyNow = true;
      fn('handoff', { action: 'claim', pair: pair }).then(function (r) {
        if (r && r.token_hash) return api('verify', { type: r.type || 'magiclink', token_hash: r.token_hash }).then(done, function () { return api('verify', { type: 'email', token_hash: r.token_hash }).then(done); });
      }).catch(function () {}).then(function () { busyNow = false; schedule(); });
    };
    var schedule = function () { if (!waiter) return; clearTimeout(waiter.t); waiter.t = setTimeout(tick, document.hidden ? 8000 : 3000); };
    waiter = { t: 0, vis: function () { if (!document.hidden) { clearTimeout(waiter.t); tick(); } }, st: function (e) { if (e.key === SKEY && e.newValue) { var s2 = getSession(); if (s2 && s2.access_token) { stopWaiting(); go(); } } } };
    document.addEventListener('visibilitychange', waiter.vis); window.addEventListener('focus', waiter.vis); window.addEventListener('storage', waiter.st);
    schedule();
  }
  function link(path) { return path + (params.get('next') ? '?next=' + encodeURIComponent(next) : ''); }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function field(o) {
    var id = 'f-' + o.name;
    var input = el('input', { id: id, name: o.name, type: o.type || 'text', autocomplete: o.autocomplete, placeholder: o.placeholder, required: o.required, minlength: o.minlength, value: o.value || '', 'aria-describedby': o.hint ? id + '-hint' : null, inputmode: o.inputmode });
    var wrap = el('div', { class: 'field' + (o.type === 'password' ? ' has-toggle' : '') }, [input]);
    if (o.type === 'password') {
      var t = el('button', { type: 'button', class: 'toggle', 'aria-label': 'Show password', 'aria-pressed': 'false', text: 'Show' });
      t.addEventListener('click', function () { var show = input.type === 'password'; input.type = show ? 'text' : 'password'; t.textContent = show ? 'Hide' : 'Show'; t.setAttribute('aria-pressed', show ? 'true' : 'false'); t.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); input.focus(); });
      wrap.appendChild(t);
    }
    var lab = el('label', { for: id, class: 'lab' }, [o.label]);
    var row = el('div', { class: 'row' }, [lab, o.after || null]);
    return { node: el('div', { class: 'group' }, [row, wrap, o.hint ? el('p', { id: id + '-hint', class: 'hint', text: o.hint }) : null]), input: input };
  }
  function msgBox() { return el('div', { class: 'msg', role: 'alert', 'aria-live': 'assertive', hidden: true }); }
  function showMsg(box, text, kind) {
    box.innerHTML = ''; box.hidden = !text; box.className = 'msg' + (kind ? ' ' + kind : '');
    if (typeof text === 'string') box.textContent = text; else if (text) box.appendChild(text);
  }
  function busy(btn, on, label) { btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); if (label) btn.textContent = label; }
  function render(nodes) { root.innerHTML = ''; nodes.forEach(function (n) { if (n) root.appendChild(n); }); var f = root.querySelector('input:not([type=hidden])'); if (f && window.innerWidth > 700) setTimeout(function () { f.focus(); }, 20); }
  function h1(t, sub) { return el('div', { class: 'head' }, [el('h1', { text: t }), sub ? el('p', { class: 'sub', text: sub }) : null]); }
  function legal() { return el('p', { class: 'legal' }, ['By continuing you agree to Unizy’s ', el('a', { href: '/terms.html', text: 'terms' }), ' and ', el('a', { href: '/privacy.html', text: 'privacy policy' }), '. Unizy is for students aged 16 and over.']); }

  // ---------- "check your inbox" ----------
  function inbox(email, kind) {
    var box = msgBox();
    var resend = el('button', { type: 'button', class: 'btn ghost', text: 'Send it again' });
    resend.addEventListener('click', function () {
      busy(resend, true, 'Sending…');
      var pr = getPair(false);
      var p = kind === 'signup' ? api('resend?redirect_to=' + encodeURIComponent(confirmUrl(pr)), { type: 'signup', email: email }) : kind === 'reset' ? api('recover?redirect_to=' + encodeURIComponent(location.origin + '/reset.html'), { email: email }) : api('otp?redirect_to=' + encodeURIComponent(confirmUrl(pr)), { email: email, create_user: true });
      p.then(function () { busy(resend, false, 'Send it again'); showMsg(box, 'Sent again. It can take a minute to arrive.', 'ok'); })
        .catch(function (e) { busy(resend, false, 'Send it again'); showMsg(box, friendly(e)); });
    });
    var lines = {
      signup: ['Confirm your email', 'We’ve sent a link to ', '. Open it on any device (your phone is fine) and this page will log you in automatically.'],
      reset: ['Check your inbox', 'If there’s an account for ', ', we’ve sent a link to choose a new password. It works once and expires in an hour.'],
      link: ['Check your inbox', 'We’ve sent a sign-in link to ', '. Open it on any device (your phone is fine) and this page will log you in automatically.']
    }[kind];
    var waiting = kind === 'reset' ? null : el('p', { class: 'waiting', role: 'status' }, [el('span', { class: 'dot', 'aria-hidden': 'true' }), 'Waiting for you to open the link…']);
    render([
      el('div', { class: 'inbox-icon', 'aria-hidden': 'true' }, [svgMail()]),
      h1(lines[0]),
      el('p', { class: 'sub' }, [lines[1], el('strong', { text: email }), lines[2]]),
      waiting,
      el('p', { class: 'hint', text: 'Can’t see it? Check your spam or promotions folder. The email comes from noreply@unizy.uk.' + (kind === 'signup' ? ' If you already have an Unizy account, log in instead.' : '') }),
      box,
      el('div', { class: 'actions' }, [resend, el('a', { class: 'btn ghost', href: kind === 'signup' ? link('/signup') : link('/login'), text: 'Use a different email' })]),
      kind === 'signup' ? el('p', { class: 'switch' }, ['Already confirmed? ', el('a', { href: link('/login'), text: 'Log in' })]) : el('p', { class: 'switch' }, [el('a', { href: link('/login'), text: 'Back to log in' })])
    ]);
    if (waiting) waitForLink(getPair(false), waiting);
  }
  function svgMail() {
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('width', '28'); s.setAttribute('height', '28'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linejoin', 'round');
    var p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'M3 5h18v14H3zM3 6l9 7 9-7'); s.appendChild(p); return s;
  }

  // ---------- sign-in / reset code (scanner-proof: uni mail systems open links, but can't type codes) ----------
  function sendCode(email, purpose) { return fn('login-code', { email: email, purpose: purpose }).then(function (r) { if (!r || !r.ok) { var e = new Error(r && r.error === 'invalid_email' ? 'Check that your email address is correct.' : 'Couldn’t send the email just now. Try again in a minute.'); e.code = r && r.error; if (r && r.error === 'rate_limited') e.status = 429; throw e; } return r; }); }
  function codeView(email, purpose, digits) {
    var n = digits || 6, box = msgBox();
    var code = field({ name: 'code', label: n + '-digit code', autocomplete: 'one-time-code', placeholder: '', required: true, inputmode: 'numeric' });
    code.input.setAttribute('maxlength', String(n)); code.input.setAttribute('pattern', '[0-9]*'); code.input.className = 'code-input'; code.input.style.cssText = 'font-family:ui-monospace,Menlo,monospace;font-size:28px;letter-spacing:.45em;text-align:center;padding-left:.45em';
    var submit = el('button', { type: 'submit', class: 'btn primary wide', text: purpose === 'reset' ? 'Continue' : 'Log in' });
    var form = el('form', { novalidate: true, method: 'post', action: '#' }, [code.node, box, submit]);
    function check() {
      var v = code.input.value.replace(/\D/g, '');
      if (v.length !== n) { showMsg(box, 'Enter the ' + n + '-digit code from the email.'); code.input.focus(); return; }
      busy(submit, true, 'Checking…'); showMsg(box, '');
      api('verify', { type: purpose === 'reset' ? 'recovery' : 'magiclink', email: email, token: v }).catch(function (e1) { if (purpose === 'reset' || e1.status === 429) throw e1; return api('verify', { type: 'email', email: email, token: v }); }).then(function (b) {
        if (purpose === 'reset') { resetView({ access_token: b.access_token, refresh_token: b.refresh_token, expires_at: b.expires_at || Math.floor(Date.now() / 1000) + (b.expires_in || 3600) }); return; }
        saveSession(b); busy(submit, true, 'Logged in'); go();
      }).catch(function (err) {
        busy(submit, false, purpose === 'reset' ? 'Continue' : 'Log in');
        showMsg(box, err.status === 429 ? friendly(err) : 'That code didn’t work. Check it, or send a new one. Codes work once and expire after an hour.');
      });
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); check(); });
    code.input.addEventListener('input', function () { var v = code.input.value.replace(/\D/g, '').slice(0, n); if (v !== code.input.value) code.input.value = v; if (v.length === n) check(); });
    var resend = el('button', { type: 'button', class: 'btn ghost', text: 'Send a new code' });
    resend.addEventListener('click', function () {
      busy(resend, true, 'Sending…');
      sendCode(email, purpose).then(function () { busy(resend, false, 'Send a new code'); showMsg(box, 'New code sent. It can take a minute to arrive. Use the newest one.', 'ok'); })
        .catch(function (e) { busy(resend, false, 'Send a new code'); showMsg(box, friendly(e)); });
    });
    render([
      el('div', { class: 'inbox-icon', 'aria-hidden': 'true' }, [svgMail()]),
      h1('Check your inbox'),
      el('p', { class: 'sub' }, ['We’ve emailed a ' + n + '-digit code to ', el('strong', { text: email }), purpose === 'reset' ? '. Enter it here to choose a new password.' : '. Enter it here to log in.']),
      form,
      el('p', { class: 'hint', text: 'Can’t see it? Check Junk, Spam or Other. The email comes from noreply@unizy.uk. On a uni email, it can sometimes take a few minutes.' }),
      el('div', { class: 'actions' }, [resend, el('a', { class: 'btn ghost', href: link('/login'), text: 'Use a different email' })])
    ]);
  }

  // ---------- already signed in ----------
  function signedIn(s) {
    var who = (s.user && (s.user.name || s.user.email)) || 'your account';
    var out = el('button', { type: 'button', class: 'btn ghost', text: 'Log out' });
    out.addEventListener('click', function () {
      fetch(CFG.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: headers(s.access_token) }).catch(function () {});
      try { localStorage.removeItem(SKEY); } catch (e) {}
      location.reload();
    });
    render([h1('You’re logged in', 'Signed in as ' + who + '.'), el('div', { class: 'actions' }, [el('a', { class: 'btn primary', href: next, text: 'Go to my dashboard' }), out])]);
  }

  // ---------- log in ----------
  function loginView(prefill) {
    var box = msgBox();
    var email = field({ name: 'email', type: 'email', label: 'Email', autocomplete: 'email', placeholder: 'Personal or uni email', required: true, value: prefill || params.get('email') || '', inputmode: 'email' });
    var forgot = el('a', { href: '#', class: 'small', text: 'Forgot password?' });
    var pw = field({ name: 'password', type: 'password', label: 'Password', autocomplete: 'current-password', required: true, after: forgot });
    var submit = el('button', { type: 'submit', class: 'btn primary wide', text: 'Log in' });
    var magic = el('button', { type: 'button', class: 'btn ghost wide', text: 'Email me a code instead' });
    var form = el('form', { novalidate: true, method: 'post', action: '#' }, [email.node, pw.node, box, submit]);
    forgot.addEventListener('click', function (e) { e.preventDefault(); forgotView(email.input.value.trim()); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = email.input.value.trim(), p = pw.input.value;
      if (!EMAIL_RE.test(em)) { showMsg(box, 'Enter a valid email address.'); email.input.focus(); return; }
      if (!p) { showMsg(box, 'Enter your password, or choose “Email me a code instead”.'); pw.input.focus(); return; }
      busy(submit, true, 'Logging in…'); showMsg(box, '');
      api('token?grant_type=password', { email: em, password: p }).then(function (b) { saveSession(b); busy(submit, true, 'Logged in'); go(); })
        .catch(function (err) {
          busy(submit, false, 'Log in');
          var f = friendly(err);
          if (f === 'confirm') {
            var again = el('button', { type: 'button', class: 'linkish', text: 'Send the confirmation email again' });
            again.addEventListener('click', function () { api('resend?redirect_to=' + encodeURIComponent(confirmUrl(getPair(true))), { type: 'signup', email: em }).then(function () { inbox(em, 'signup'); }).catch(function (e2) { showMsg(box, friendly(e2)); }); });
            showMsg(box, el('span', {}, ['You need to confirm your email first. Open the link we sent to ', el('strong', { text: em }), '. ', again]));
          } else showMsg(box, f);
        });
    });
    magic.addEventListener('click', function () {
      var em = email.input.value.trim();
      if (!EMAIL_RE.test(em)) { showMsg(box, 'Type your email above, then choose “Email me a code instead”.'); email.input.focus(); return; }
      busy(magic, true, 'Sending…');
      sendCode(em, 'login').then(function (r) { codeView(em, 'login', r.digits); })
        .catch(function (err) { busy(magic, false, 'Email me a code instead'); showMsg(box, friendly(err)); });
    });
    render([h1('Welcome back', 'Log in to pick up where you left off.'), form, el('div', { class: 'or', 'aria-hidden': 'true' }, [el('span', { text: 'or' })]), magic,
      el('p', { class: 'switch' }, ['New to Unizy? ', el('a', { href: link('/signup'), text: 'Create an account' })]), legal()]);
  }

  // ---------- forgot password ----------
  function forgotView(prefill) {
    var box = msgBox();
    var email = field({ name: 'email', type: 'email', label: 'Email', autocomplete: 'email', placeholder: 'Personal or uni email', required: true, value: prefill || '', inputmode: 'email' });
    var submit = el('button', { type: 'submit', class: 'btn primary wide', text: 'Send reset code' });
    var form = el('form', { novalidate: true, method: 'post', action: '#' }, [email.node, box, submit]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = email.input.value.trim();
      if (!EMAIL_RE.test(em)) { showMsg(box, 'Enter a valid email address.'); email.input.focus(); return; }
      busy(submit, true, 'Sending…');
      sendCode(em, 'reset').then(function (r) { codeView(em, 'reset', r.digits); })
        .catch(function (err) { busy(submit, false, 'Send reset code'); showMsg(box, friendly(err)); });
    });
    var back = el('a', { href: link('/login'), text: 'Back to log in' });
    if (MODE === 'login') back.addEventListener('click', function (e) { e.preventDefault(); loginView(email.input.value.trim()); });
    render([h1('Reset your password', 'Enter the email you use for Unizy and we’ll send you a code to choose a new password.'), form, el('p', { class: 'switch' }, [back])]);
  }

  // ---------- sign up ----------
  function strength(p) {
    var s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
    if (p.length < 8) return { n: 1, t: 'Too short: use at least 8 characters' };
    return s <= 2 ? { n: 2, t: 'Okay: a longer password is safer' } : s === 3 ? { n: 3, t: 'Good' } : { n: 4, t: 'Strong' };
  }
  function signupView() {
    var box = msgBox();
    var name = field({ name: 'name', label: 'First name', autocomplete: 'given-name', placeholder: 'e.g. Sam' });
    var email = field({ name: 'email', type: 'email', label: 'Email', autocomplete: 'email', placeholder: 'Personal or uni email', required: true, value: params.get('email') || '', inputmode: 'email', hint: 'Any email works, personal or uni.' });
    var pw = field({ name: 'password', type: 'password', label: 'Password', autocomplete: 'new-password', required: true, minlength: 8 });
    var meter = el('div', { class: 'meter', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i'), el('i')]);
    var meterText = el('p', { class: 'hint', id: 'f-password-hint', text: 'At least 8 characters.' });
    pw.input.setAttribute('aria-describedby', 'f-password-hint');
    pw.node.appendChild(meter); pw.node.appendChild(meterText);
    pw.input.addEventListener('input', function () {
      var v = pw.input.value, st = v ? strength(v) : null;
      meter.setAttribute('data-n', st ? st.n : 0); meterText.textContent = st ? st.t : 'At least 8 characters.';
    });
    var submit = el('button', { type: 'submit', class: 'btn primary wide', text: 'Create account' });
    var form = el('form', { novalidate: true, method: 'post', action: '#' }, [name.node, email.node, pw.node, box, submit]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nm = name.input.value.trim().slice(0, 60), em = email.input.value.trim(), p = pw.input.value;
      if (!EMAIL_RE.test(em)) { showMsg(box, 'Enter a valid email address.'); email.input.focus(); return; }
      if (p.length < 8) { showMsg(box, 'Your password needs at least 8 characters.'); pw.input.focus(); return; }
      if (p.toLowerCase() === em.toLowerCase() || /^(password|12345678|qwerty)/i.test(p)) { showMsg(box, 'Choose a password that’s harder to guess.'); pw.input.focus(); return; }
      busy(submit, true, 'Creating your account…'); showMsg(box, '');
      track('signup_submit');
      // create the account (no email link needed), then log straight in with the same details
      fetch(CFG.supabaseUrl + '/functions/v1/signup', { method: 'POST', headers: headers(CFG.anonKey), body: JSON.stringify({ email: em, password: p, name: nm }) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (b) {
            if (r.ok) return b;
            var e = new Error(''); e.status = r.status;
            e.code = b.error === 'exists' ? 'user_already_exists' : b.error === 'rate_limited' ? 'over_request_rate_limit' : b.error === 'weak_password' ? 'weak_password' : b.error === 'invalid_email' ? 'validation_failed' : '';
            throw e;
          });
        }, function () { var e = new Error('offline'); e.code = 'offline'; throw e; })
        .then(function () { busy(submit, true, 'Logging you in…'); return api('token?grant_type=password', { email: em, password: p }); })
        .then(function (b) { saveSession(b); go(); })
        .catch(function (err) {
          busy(submit, false, 'Create account');
          var f = friendly(err);
          if (f === 'exists') showMsg(box, el('span', {}, ['There’s already an account with that email. ', el('a', { href: '/login?email=' + encodeURIComponent(em) + (params.get('next') ? '&next=' + encodeURIComponent(next) : ''), text: 'Log in instead' }), '.']));
          else showMsg(box, f === 'confirm' ? 'Your account was created. Log in to continue.' : f);
        });
    });
    render([h1('Create your account', 'Free for students. Save your notes, flashcards and progress, and switch on your AI tutor and essay marking.'), form,
      el('p', { class: 'switch' }, ['Already have an account? ', el('a', { href: link('/login'), text: 'Log in' })]), legal()]);
  }

  // ---------- choose a new password (from the reset email) ----------
  function resetView(token) {
    var box = msgBox();
    var pw = field({ name: 'password', type: 'password', label: 'New password', autocomplete: 'new-password', required: true, minlength: 8, hint: 'At least 8 characters.' });
    var pw2 = field({ name: 'password2', type: 'password', label: 'Type it again', autocomplete: 'new-password', required: true });
    var submit = el('button', { type: 'submit', class: 'btn primary wide', text: 'Save new password' });
    var form = el('form', { novalidate: true, method: 'post', action: '#' }, [pw.node, pw2.node, box, submit]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var p = pw.input.value;
      if (p.length < 8) { showMsg(box, 'Your password needs at least 8 characters.'); pw.input.focus(); return; }
      if (p !== pw2.input.value) { showMsg(box, 'The two passwords don’t match.'); pw2.input.focus(); return; }
      busy(submit, true, 'Saving…');
      api('user', { password: p }, { method: 'PUT', token: token.access_token }).then(function (u) {
        saveSession({ access_token: token.access_token, refresh_token: token.refresh_token, expires_at: token.expires_at, user: u });
        render([h1('Password changed', 'You’re logged in. Taking you to your dashboard…')]);
        setTimeout(go, 1200);
      }).catch(function (err) { busy(submit, false, 'Save new password'); showMsg(box, friendly(err, 'reset')); });
    });
    render([h1('Choose a new password', 'Pick something you haven’t used elsewhere.'), form]);
  }

  // ---------- the page the email link opens ----------
  function confirmedView() {
    var h = new URLSearchParams(location.hash.replace(/^#/, ''));
    var pair = params.get('pair') || '';
    if (location.hash) history.replaceState(null, '', location.pathname + (next !== '/app.html' ? '?next=' + encodeURIComponent(next) : ''));
    if (h.get('error_description') || !h.get('access_token')) {
      var s0 = getSession();
      render([h1('That link has already been used', 'Links work once and expire after an hour. If you’ve already logged in somewhere, you’re all set.'),
        el('div', { class: 'actions' }, [s0 && s0.access_token ? el('a', { class: 'btn primary', href: next, text: 'Go to my dashboard' }) : el('a', { class: 'btn primary', href: '/login', text: 'Log in' }), el('a', { class: 'btn ghost', href: '/login', text: 'Get a new link' })])]);
      return;
    }
    var tok = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600 };
    var status = el('p', { class: 'waiting', role: 'status' }, [el('span', { class: 'dot', 'aria-hidden': 'true' }), 'Logging in your other tab or device…']);
    render([el('div', { class: 'inbox-icon ok', 'aria-hidden': 'true', text: '✓' }), h1('You’re in!', 'Your email is confirmed and you’re logged in.'), pair ? status : null,
      el('div', { class: 'actions' }, [el('a', { class: 'btn primary', href: next, text: 'Go to my dashboard here' })])]);
    fetch(CFG.supabaseUrl + '/auth/v1/user', { headers: headers(tok.access_token) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (u) {
      saveSession(Object.assign({}, tok, { user: u || null }));
      if (!pair) return;
      return fn('handoff', { action: 'complete', pair: pair }, tok.access_token).then(function (r) {
        status.textContent = r && r.ok ? 'Done. The page where you signed up has logged in too, so you can close this one or carry on here.' : 'You’re logged in here. If your other page doesn’t log in by itself, just log in there.';
        status.className = 'waiting done';
      });
    }).catch(function () { status.textContent = 'You’re logged in here. If your other page doesn’t log in by itself, just log in there.'; status.className = 'waiting done'; });
  }

  // ---------- start ----------
  if (MODE === 'confirmed') { confirmedView(); return; }
  var hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hash.get('access_token') || hash.get('error_description')) history.replaceState(null, '', location.pathname + location.search);
  if (MODE === 'reset') {
    if (hash.get('error_description')) { forgotView(''); showMsg(root.querySelector('.msg'), 'That reset link has expired or was already used. Ask for a new one below.'); }
    else if (hash.get('access_token') && hash.get('type') === 'recovery') resetView({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'), expires_at: Math.floor(Date.now() / 1000) + (+hash.get('expires_in') || 3600) });
    else forgotView(params.get('email') || '');
    return;
  }
  if (hash.get('access_token')) { saveSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'), expires_in: +hash.get('expires_in') || 3600 }); go(); return; }
  var s = getSession();
  if (s && s.access_token && s.refresh_token) { signedIn(s); return; }
  track(MODE === 'signup' ? 'signup_view' : 'login_view');
  if (MODE === 'signup') signupView(); else loginView();
  if (hash.get('error_description')) showMsg(root.querySelector('.msg'), 'That link has expired or was already used. Log in, or ask for a new link.');
})();
