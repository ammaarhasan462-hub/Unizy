/* Unizy on the web: accounts (Supabase magic-link email), syncing saved work, and the AI (via the Unizy AI function). */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG;
  var SKEY = 'unizy.session';
  var listeners = [];

  // ---------------- auth ----------------
  var Auth = {
    session: null,
    load: function () {
      try { Auth.session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { Auth.session = null; }
    },
    store: function (s) {
      Auth.session = s;
      try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) {}
      listeners.forEach(function (f) { try { f(s); } catch (e) {} });
    },
    headers: function (withUser) {
      var h = { apikey: CFG.anonKey, 'Content-Type': 'application/json' };
      if (withUser && Auth.session) h.Authorization = 'Bearer ' + Auth.session.access_token;
      return h;
    },
    fromHash: function () {
      var h = location.hash.replace(/^#/, '');
      if (!/access_token=/.test(h) && !/error_description=/.test(h)) return null;
      var p = new URLSearchParams(h);
      history.replaceState(null, '', location.pathname + location.search);
      if (p.get('error_description')) return { error: p.get('error_description') };
      return { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: Math.floor(Date.now() / 1000) + (+p.get('expires_in') || 3600) };
    },
    sendLink: function (email) {
      var redirect = location.origin + location.pathname;
      return fetch(CFG.supabaseUrl + '/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect), {
        method: 'POST', headers: Auth.headers(false), body: JSON.stringify({ email: email, create_user: true })
      }).then(function (r) {
        if (r.ok) return true;
        return r.json().catch(function () { return {}; }).then(function (b) {
          var m = (b && (b.msg || b.error_description || b.message)) || '';
          if (r.status === 429 || /rate/i.test(m)) throw new Error('Too many sign-in emails just now. Wait a few minutes and try again.');
          throw new Error(m || 'Couldn’t send the sign-in email. Check the address and try again.');
        });
      });
    },
    refresh: function () {
      var s = Auth.session;
      if (!s || !s.refresh_token) return Promise.resolve(null);
      return fetch(CFG.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: Auth.headers(false), body: JSON.stringify({ refresh_token: s.refresh_token })
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (b) {
        if (!b || !b.access_token) { Auth.store(null); return null; }
        var ns = { access_token: b.access_token, refresh_token: b.refresh_token, expires_at: b.expires_at || Math.floor(Date.now() / 1000) + (b.expires_in || 3600), user: b.user || s.user };
        Auth.store(ns);
        return ns;
      }).catch(function () { return Auth.session; });
    },
    fresh: function () {
      var s = Auth.session;
      if (!s) return Promise.resolve(null);
      if ((s.expires_at || 0) - 60 > Date.now() / 1000) return Promise.resolve(s);
      return Auth.refresh();
    },
    fetchUser: function () {
      return Auth.fresh().then(function (s) {
        if (!s) return null;
        return fetch(CFG.supabaseUrl + '/auth/v1/user', { headers: Auth.headers(true) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (u) {
          if (!u) return null;
          Auth.store(Object.assign({}, Auth.session, { user: { id: u.id, email: u.email, name: (u.user_metadata || {}).full_name || '' } }));
          return u;
        });
      });
    },
    signOut: function () {
      var s = Auth.session;
      if (s) fetch(CFG.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: Auth.headers(true) }).catch(function () {});
      Auth.store(null);
    }
  };

  // anonymous daily totals only: no cookies, no IDs
  function track(ev) {
    try {
      if (navigator.webdriver || navigator.globalPrivacyControl || navigator.doNotTrack === '1' || localStorage.getItem('unizy:notrack') === '1') return;
      fetch(CFG.supabaseUrl + '/rest/v1/rpc/track_event', { method: 'POST', keepalive: true, headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_event: ev }) }).catch(function () {});
    } catch (e) {}
  }

  // ---------------- sync of saved work ----------------
  var Sync = {
    queue: {}, timer: null, status: 'idle',
    rest: function (path, opts) {
      return Auth.fresh().then(function (s) {
        if (!s) throw new Error('signed out');
        opts = opts || {};
        opts.headers = Object.assign(Auth.headers(true), opts.headers || {});
        return fetch(CFG.supabaseUrl + '/rest/v1/' + path, opts);
      });
    },
    push: function (key, val) {
      if (!Auth.session || key.indexOf('unizy:') !== 0) return;
      Sync.queue[key] = val;
      clearTimeout(Sync.timer);
      Sync.timer = setTimeout(Sync.flush, 1200);
    },
    flush: function () {
      var keys = Object.keys(Sync.queue);
      if (!keys.length || !Auth.session || !Auth.session.user) return Promise.resolve();
      var uid = Auth.session.user.id, now = new Date().toISOString();
      var rows = keys.map(function (k) { return { user_id: uid, key: k, value: Sync.queue[k] === undefined ? null : Sync.queue[k], updated_at: now }; });
      Sync.queue = {};
      Sync.status = 'saving'; refreshUi();
      return Sync.rest('user_store?on_conflict=user_id,key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) })
        .then(function (r) { Sync.status = r.ok ? 'saved' : 'error'; if (!r.ok) rows.forEach(function (x) { Sync.queue[x.key] = x.value; }); refreshUi(); })
        .catch(function () { Sync.status = 'error'; rows.forEach(function (x) { Sync.queue[x.key] = x.value; }); refreshUi(); });
    },
    pull: function () {
      // Server copy wins for keys it has; anything only on this device is uploaded.
      return Sync.rest('user_store?select=key,value', { method: 'GET' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
        var server = {};
        rows.forEach(function (x) { server[x.key] = x.value; });
        var local = {};
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('unizy:') === 0) local[k] = JSON.parse(localStorage.getItem(k)); } } catch (e) {}
        Object.keys(server).forEach(function (k) { try { localStorage.setItem(k, JSON.stringify(server[k])); } catch (e) {} });
        Object.keys(local).forEach(function (k) { if (!(k in server)) Sync.queue[k] = local[k]; });
        Sync.flush();
        return Object.assign({}, local, server);
      }).catch(function () { return null; });
    }
  };

  // ---------------- AI client (same call shape as Claude's in-app sampling) ----------------
  function aiError(code, message) { return { code: code, message: message, userMessage: message }; }
  function blobToJpegBase64(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () {
        var max = 1568, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.86).split(',')[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(aiError('image_rejected', 'One of the photos couldn’t be read. Try a JPEG or PNG.')); };
      img.src = url;
    });
  }
  function guessKind(input) {
    var t = typeof input === 'string' ? input : (input[0] && input[0].content) || '';
    if (/Mark it as a|COURSE KNOWLEDGE ===[\s\S]*Student’s typed work/.test(t)) return 'assess';
    if (/^You are .*examiner/.test(t)) return 'mark';
    if (/revision flashcards/.test(t)) return 'cards';
    if (/practice questions/.test(t)) return 'questions';
    if (/Turn the student’s notes/.test(t)) return 'notes';
    if (Array.isArray(input)) return 'tutor';
    return 'other';
  }
  function parseJson(text) {
    var s = String(text || '').trim();
    try { return JSON.parse(s); } catch (e) {}
    var m = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
    if (m) { try { return JSON.parse(m[1]); } catch (e) {} }
    var a = s.search(/[\[{]/), b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
    throw { code: 'invalid_json', message: 'The AI reply wasn’t readable. Try again.', userMessage: 'The AI reply wasn’t readable. Try again.', text: s };
  }
  function call(input, opts, asJson) {
    opts = opts || {};
    return Auth.fresh().then(function (s) {
      if (!s) throw aiError('not_granted', 'Sign in to use the AI tutor and marking.');
      var imgs = opts.images ? Array.prototype.slice.call(opts.images.length !== undefined ? opts.images : [opts.images]) : [];
      return Promise.all(imgs.map(blobToJpegBase64)).then(function (b64) {
        var body = { input: input, json: !!asJson, kind: guessKind(input), tier: opts.modelTier || 'default', cache: !!opts.cache, stream: typeof opts.onText === 'function', images: b64.map(function (d) { return { media_type: 'image/jpeg', data: d }; }) };
        return fetch(CFG.supabaseUrl + '/functions/v1/ai', { method: 'POST', headers: Auth.headers(true), body: JSON.stringify(body), signal: opts.signal });
      });
    }).then(function (r) {
      var left = r.headers.get('X-Unizy-Units-Left');
      if (left !== null) { Account.left = +left; Plan.refresh(); }
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (b) {
          var code = b.code || (r.status === 401 ? 'session_expired' : r.status === 429 ? 'rate_limited' : 'upstream_error');
          if (code === 'session_expired') Auth.refresh();
          if (b.upgrade) showUpgrade(b.message);
          else if (code === 'ai_paused') toast(b.message, null, null, 8000);
          throw aiError(code, b.message || 'The AI had a problem. Try again.');
        });
      }
      if (!opts.onText || !r.body || !r.body.getReader) {
        return r.headers.get('Content-Type') && r.headers.get('Content-Type').indexOf('event-stream') >= 0
          ? r.text().then(function (raw) { return sseText(raw); })
          : r.json().then(function (b) { if (opts.onText && b.text) opts.onText({ text: b.text, delta: b.text }); return { text: b.text || '', truncated: !!b.truncated }; });
      }
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '', text = '', truncated = false;
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) return { text: text, truncated: truncated };
          buf += dec.decode(res.value, { stream: true });
          var parts = buf.split('\n\n'); buf = parts.pop();
          parts.forEach(function (ev) {
            var line = ev.split('\n').filter(function (l) { return l.indexOf('data:') === 0; }).map(function (l) { return l.slice(5).trim(); }).join('');
            if (!line) return;
            try {
              var d = JSON.parse(line);
              if (d.type === 'content_block_delta' && d.delta && d.delta.type === 'text_delta') { text += d.delta.text; opts.onText({ text: text, delta: d.delta.text }); }
              if (d.type === 'message_delta' && d.delta && d.delta.stop_reason === 'max_tokens') truncated = true;
              if (d.type === 'error') throw aiError('upstream_error', 'The AI stopped part-way. Try again.');
            } catch (e) { if (e && e.code) throw e; }
          });
          return pump();
        });
      }
      return pump();
    }).then(function (res) {
      if (!res.text) throw aiError('empty_completion', 'The AI didn’t reply. Try again.');
      return res;
    }).catch(function (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'Stopped.' };
      if (e && e.code) throw e;
      throw aiError('upstream_error', 'Couldn’t reach the AI. Check your connection and try again.');
    });
  }
  function sseText(raw) {
    var text = '', truncated = false;
    raw.split('\n').forEach(function (l) {
      if (l.indexOf('data:') !== 0) return;
      try { var d = JSON.parse(l.slice(5)); if (d.type === 'content_block_delta' && d.delta && d.delta.text) text += d.delta.text; if (d.type === 'message_delta' && d.delta && d.delta.stop_reason === 'max_tokens') truncated = true; } catch (e) {}
    });
    return { text: text, truncated: truncated };
  }
  var sample = function (input, opts) { return call(input, opts, false); };
  sample.json = function (input, opts) {
    var o = Object.assign({}, opts || {}); var onText = o.onText; delete o.onText;
    if (onText) o.onText = onText;
    return call(input, o, true).then(function (r) { return parseJson(r.text); });
  };
  sample.limits = function () { return Promise.resolve({ maxPromptBytes: 100000, images: { maxCount: 5, maxInputBytes: 20000000, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] } }); };

  window.claude = { use: function (name) { return Promise.resolve(name === 'sample' && Auth.session ? sample : null); } };

  // ---------------- plan (free / trial / Pro) ----------------
  function fmtDay(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  var Plan = {
    data: null, busy: false,
    refresh: function () {
      if (!Auth.session) { Plan.data = null; return Promise.resolve(null); }
      if (Plan.busy) return Plan.busy;
      Plan.busy = Sync.rest('rpc/my_plan', { method: 'POST', body: '{}' }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { Plan.busy = false; if (d) Plan.data = d; refreshUi(); return d; })
        .catch(function () { Plan.busy = false; return null; });
      return Plan.busy;
    },
    label: function () {
      var d = Plan.data; if (!d) return '';
      if (d.tier === 'pro') return 'Unizy Pro' + (d.plan === 'monthly' ? (d.renews ? ', renews ' : ', ends ') + fmtDay(d.until) : ' (' + (d.plan === 'year' ? 'year pass' : 'exam pass') + '), until ' + fmtDay(d.until));
      if (d.tier === 'trial') return 'Free Pro trial, ends ' + fmtDay(d.until);
      return 'Free plan: ' + Math.max(0, d.actionsLeft) + ' of ' + d.actionsPerWeek + ' AI actions and ' + Math.max(0, d.assessLeft) + ' of ' + d.assessPerWeek + ' Assess marking left this week';
    }
  };
  var toastEl = null;
  function toast(text, linkText, href, ms) {
    if (toastEl) toastEl.remove();
    toastEl = el('div', { role: 'status', style: 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:1100;background:#14283B;color:#fff;border-radius:14px;padding:12px 14px 12px 16px;max-width:min(560px,calc(100vw - 32px));box-sizing:border-box;display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 12px 40px rgba(0,0,0,.3);font:14px/1.45 DM Sans,system-ui,sans-serif' }, [
      el('span', { style: 'flex:1 1 220px' }, [text]),
      linkText ? el('a', { href: href, style: 'background:#E9893B;color:#14283B;font-weight:700;text-decoration:none;padding:8px 14px;border-radius:999px;white-space:nowrap' }, [linkText]) : null,
      el('button', { 'aria-label': 'Dismiss', style: 'border:none;background:none;color:#fff;font-size:20px;cursor:pointer;padding:0 4px', onclick: function () { if (toastEl) { toastEl.remove(); toastEl = null; } } }, ['×'])
    ]);
    document.body.appendChild(toastEl);
    if (ms) { var mine = toastEl; setTimeout(function () { if (toastEl === mine) { mine.remove(); toastEl = null; } }, ms); }
  }
  function showUpgrade(msg) { toast(msg || 'You’ve reached your free limit.', 'See Pro plans', '/pricing'); }

  // ---------------- account UI ----------------
  var Account = {
    inst: null, left: null, open: false, msg: '', busy: false,
    vals: function () {
      var s = Auth.session, email = s && s.user && s.user.email;
      return {
        signedIn: !!s, label: s ? ((s.user && s.user.name) ? s.user.name.charAt(0).toUpperCase() : email ? email.charAt(0).toUpperCase() : 'Me') : 'Log in',
        title: s ? 'Your account' : 'Sign in to save your work and use the AI',
        open: function () { Account.show(); }
      };
    },
    show: function () { if (!Auth.session) { Sync.flush(); location.href = '/login?next=' + encodeURIComponent('/app.html'); return; } Account.open = true; Account.msg = ''; drawModal(); },
    hide: function () { Account.open = false; drawModal(); }
  };
  function refreshUi() { if (Account.open) drawModal(); if (Account.inst && Account.inst.__app) Account.inst.__app.schedule(); }

  var modal;
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'style') e.style.cssText = attrs[k]; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function drawModal() {
    if (modal) { modal.remove(); modal = null; }
    if (!Account.open) return;
    var s = Auth.session, theme = (Account.inst && Account.inst.__theme) || { c1: '#14283B', on1: '#FFFFFF' };
    var btn = 'font:inherit;font-size:15px;font-weight:600;padding:12px 18px;min-height:44px;border-radius:999px;cursor:pointer;';
    var card = el('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': s ? 'Your account' : 'Sign in', style: 'background:#fff;color:#14283B;border-radius:20px;max-width:420px;width:100%;padding:28px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:DM Sans,system-ui,sans-serif' });
    var close = el('button', { 'aria-label': 'Close', style: 'align-self:flex-end;border:none;background:none;font-size:22px;cursor:pointer;width:44px;height:44px;margin:-14px -14px -10px 0', onclick: Account.hide }, ['×']);
    card.appendChild(close);
    if (!s) {
      card.appendChild(el('h2', { style: "margin:0;font-family:'Fraunces',sans-serif;font-weight:800;font-size:26px;letter-spacing:-.02em" }, ['Sign in to Unizy']));
      card.appendChild(el('p', { style: 'margin:0;font-size:15px;line-height:1.55;color:#33475A' }, ['We’ll email you a sign-in link, no password needed. Signing in saves your notes, flashcards and progress across devices and switches on your AI tutor and essay marking.']));
      var input = el('input', { type: 'email', autocomplete: 'email', placeholder: 'Personal or uni email', 'aria-label': 'Email address', style: 'font:inherit;font-size:16px;padding:12px 14px;border-radius:12px;border:1.5px solid #C5CFD8' });
      var go = el('button', { style: btn + 'border:none;background:' + theme.c1 + ';color:' + theme.on1 }, [Account.busy ? 'Sending…' : 'Email me a sign-in link']);
      var submit = function () {
        var v = (input.value || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { Account.msg = 'Enter a valid email address.'; drawModal(); return; }
        Account.busy = true; Account.msg = ''; drawModal();
        Auth.sendLink(v).then(function () { Account.busy = false; Account.msg = 'Check your inbox for a link from Unizy and open it on this device. It can take a minute; check spam too.'; drawModal(); })
          .catch(function (e) { Account.busy = false; Account.msg = e.message; drawModal(); });
      };
      go.addEventListener('click', submit);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      card.appendChild(input); card.appendChild(go);
      if (Account.msg) card.appendChild(el('p', { role: 'status', style: 'margin:0;font-size:14px;line-height:1.5;color:#33475A' }, [Account.msg]));
      card.appendChild(el('p', { style: 'margin:0;font-size:12px;line-height:1.5;color:#5B6C7D' }, ['By signing in you agree to the ', el('a', { href: 'terms.html', style: 'color:#14283B' }, ['terms']), ' and ', el('a', { href: 'privacy.html', style: 'color:#14283B' }, ['privacy policy']), '.']));
      setTimeout(function () { input.focus(); }, 30);
    } else {
      var email = (s.user && s.user.email) || 'your account';
      card.appendChild(el('h2', { style: "margin:0;font-family:'Fraunces',sans-serif;font-weight:800;font-size:24px" }, ['Your account']));
      card.appendChild(el('p', { style: 'margin:0;font-size:15px;color:#33475A' }, [(s.user && s.user.name) ? 'Hi ' + s.user.name + '. ' : '', 'Signed in as ', el('strong', {}, [email])]));
      card.appendChild(el('a', { href: '/reset.html?email=' + encodeURIComponent((s.user && s.user.email) || ''), style: 'font-size:14px;font-weight:600;color:#14283B' }, ['Set or change your password']));
      card.appendChild(el('a', { href: '/reviews', style: 'font-size:14px;font-weight:600;color:#14283B' }, ['Leave a review of Unizy']));
      card.appendChild(el('p', { style: 'margin:0;font-size:14px;line-height:1.5;color:#33475A' }, [
        Sync.status === 'saving' ? 'Saving your work…' : Sync.status === 'error' ? 'Couldn’t save just now. Unizy will keep trying.' : 'Your work is saved to your account.'
      ]));
      var pd = Plan.data;
      if (pd) {
        var planBox = el('div', { style: 'display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:14px;background:' + (pd.tier === 'free' ? '#F6F4EE' : '#F2FAE1') + ';border:1.5px solid ' + (pd.tier === 'free' ? '#DCE3E8' : '#E9893B') }, [
          el('span', { style: 'font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4A5C6E' }, ['Your plan']),
          el('span', { style: 'font-size:15px;font-weight:700;line-height:1.4' }, [Plan.label()])
        ]);
        if (pd.tier !== 'free' && pd.unitsLeft != null) planBox.appendChild(el('span', { style: 'font-size:13px;color:#33475A' }, ['AI allowance left today: ' + Math.max(0, pd.unitsLeft) + '.']));
        if (pd.tier !== 'pro') planBox.appendChild(el('a', { href: '/pricing', style: btn + 'text-decoration:none;text-align:center;border:none;background:#14283B;color:#fff;box-shadow:0 3px 0 #E9893B' }, [pd.tier === 'trial' ? 'Keep Pro after your trial' : 'Upgrade to Pro']));
        else if (pd.plan === 'monthly' && CFG.stripe && CFG.stripe.portal) planBox.appendChild(el('a', { href: CFG.stripe.portal + (s.user && s.user.email ? '?prefilled_email=' + encodeURIComponent(s.user.email) : ''), target: '_blank', rel: 'noopener', style: 'font-size:14px;font-weight:600;color:#14283B' }, ['Manage or cancel your subscription']));
        card.appendChild(planBox);
      } else Plan.refresh();
      card.appendChild(el('button', { style: btn + 'border:1.5px solid #C5CFD8;background:#fff;color:#14283B', onclick: function () { Sync.flush().then(function () { Auth.signOut(); Account.hide(); location.reload(); }); } }, ['Sign out']));
      card.appendChild(el('p', { style: 'margin:0;font-size:12px;line-height:1.5;color:#5B6C7D' }, ['To delete your account and everything saved in it, email ', el('a', { href: 'mailto:' + CFG.contactEmail, style: 'color:#14283B' }, [CFG.contactEmail]), '.']));
    }
    modal = el('div', { style: 'position:fixed;inset:0;z-index:1000;background:rgba(10,10,10,.5);display:flex;align-items:center;justify-content:center;padding:16px', onclick: function (e) { if (e.target === modal) Account.hide(); } }, [card]);
    document.body.appendChild(modal);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && Account.open) Account.hide(); });

  // ---------------- start-up ----------------
  function attach(proto) {
    var origSave = proto.save, origRender = proto.renderVals;
    if (origSave) proto.save = function (key, val) { origSave.call(this, key, val); Sync.push(key, val); };
    proto.renderVals = function () {
      var v = origRender.call(this);
      v.account = Account.vals();
      if (window.UnizySocial) {
        try { v.fg = window.UnizySocial.vals(this, v); } catch (e) { console.error('[unizy] friends', e); v.fg = { demo: true, live: false }; }
        if (v.fg && v.fg.badge && Array.isArray(v.tabs)) v.tabs = v.tabs.map(function (t) { return t.label === 'Friend groups' ? Object.assign({}, t, { label: 'Friend groups (' + v.fg.badge + ')' }) : t; });
        if (v.fg && v.fg.badge && Array.isArray(v.navGroups)) v.navGroups = v.navGroups.map(function (g) { return g.id === 'ask' && !g.hasBadge ? Object.assign({}, g, { badge: v.fg.badge + ' new', hasBadge: true }) : g; });
      }
      if (window.UnizyCampus) {
        try { v.cx = window.UnizyCampus.vals(this, v); } catch (e) { console.error('[unizy] campus', e); v.cx = { ver: {}, imp: {}, feeds: {}, hub: {}, mkt: {}, fo: {} }; }
        try { v.rm = window.UnizyRooms ? window.UnizyRooms.vals(this, v) : {}; } catch (e) { console.error('[unizy] rooms', e); v.rm = {}; }
        try { v.pk = window.UnizyPacks ? window.UnizyPacks.vals(this, v) : { lp: {}, rl: {} }; } catch (e) { console.error('[unizy] packs', e); v.pk = { lp: {}, rl: {} }; }
        if (v.rm && v.rm.live && v.cx) v.cx.badge = 'Live quiz';
        if (v.cx && v.cx.badge && Array.isArray(v.navGroups)) v.navGroups = v.navGroups.map(function (g) { return g.id === 'campus' && !g.hasBadge ? Object.assign({}, g, { badge: v.cx.badge, hasBadge: true }) : g; });
      }
      this.__theme = v.theme;
      // remember the chosen uni, course, year and modules between visits
      var st = this.state || {};
      if (st.screen === 'app' && st.uni && st.degree) {
        var setup = { uni: st.uni, degree: st.degree, year: st.year || 1, mods: st.mods || null, active: st.active || null };
        var js = JSON.stringify(setup);
        if (js !== this.__lastSetup) { var firstSetup = false; try { firstSetup = !localStorage.getItem('unizy:setup'); } catch (e) {} if (firstSetup) track('setup_done'); this.__lastSetup = js; try { localStorage.setItem('unizy:setup', js); } catch (e) {} Sync.push('unizy:setup', setup); }
      }
      return v;
    };
  }
  function enableAi(inst) {
    inst.sampleFn = Auth.session ? sample : null;
    inst.setState({ ai: Auth.session ? 'ready' : 'off', aiImages: Auth.session ? { maxCount: 5, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] } : null });
  }
  function restoreSetup(inst, all) {
    var setup = all && all['unizy:setup'];
    if (!setup) { try { setup = JSON.parse(localStorage.getItem('unizy:setup') || 'null'); } catch (e) { setup = null; } }
    var params = new URLSearchParams(location.search), want = params.get('uni');
    if (want) {
      history.replaceState(null, '', location.pathname + location.hash);
      if (!(setup && setup.uni === want && setup.degree)) { inst.setState({ uni: want, screen: 'degree', degree: null, year: null, mods: null, active: null }); return; }
    }
    if (setup && setup.uni && setup.degree && !(inst.state && inst.state.screen === 'app')) inst.setState(Object.assign({ screen: 'app' }, setup));
  }

  window.UnizyWeb = {
    start: function (root, templateHTML, Comp) {
      Auth.load();
      var fromLink = Auth.fromHash();
      track('app_view');
      // active study time: minutes in which the student actually interacted with the app (tab visible)
      var lastAct = 0;
      ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) { document.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true, capture: true }); });
      setInterval(function () {
        if (document.hidden || Date.now() - lastAct > 90000) return;
        try {
          var t = JSON.parse(localStorage.getItem('unizy:time') || '{}') || {}, d = new Date();
          var k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
          t[k] = Math.min(1440, (t[k] || 0) + 1);
          var keys = Object.keys(t).sort(); while (keys.length > 120) delete t[keys.shift()];
          localStorage.setItem('unizy:time', JSON.stringify(t)); Sync.push('unizy:time', t);
          var st = inst.state && inst.state.store; if (st) st['unizy:time'] = t;
        } catch (e) {}
      }, 60000);
      attach(Comp.prototype);
      var inst = window.UnizyRuntime.mount(root, templateHTML, Comp, {});
      Account.inst = inst;
      restoreSetup(inst, null);
      if (/signin/.test(location.hash)) { location.replace('/login?next=' + encodeURIComponent('/app.html')); return inst; }
      var after = function () {
        if (!Auth.session) { enableAi(inst); return; }
        Auth.fetchUser().then(function (u) {
          if (!u) { Auth.store(null); enableAi(inst); return; }
          enableAi(inst);
          Plan.refresh();
          Sync.rest('rpc/touch_activity', { method: 'POST', body: '{}' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.excluded) { try { localStorage.setItem('unizy:notrack', '1'); } catch (e) {} } }).catch(function () {});
          if (/[?&]upgraded=1/.test(location.search)) {
            history.replaceState(null, '', location.pathname + location.hash);
            toast('Payment received. Switching on Unizy Pro…');
            var tries = 0, check = function () { Plan.refresh().then(function (d) { if (d && d.tier === 'pro') toast('You’re on Unizy Pro. Enjoy the full AI tutor and marking!', null, null, 7000); else if (++tries < 20) setTimeout(check, 3000); else toast('Your payment went through, but Pro hasn’t switched on yet. Refresh in a minute, or email ' + CFG.contactEmail + '.'); }); };
            setTimeout(check, 1500);
          }
          Sync.pull().then(function (all) {
            if (!all) return;
            var store = {};
            Object.keys(all).forEach(function (k) { store[k] = all[k]; });
            inst.setState({ store: Object.assign({}, (inst.state || {}).store, store) });
            restoreSetup(inst, all);
          });
        });
      };
      if (fromLink && fromLink.error) { location.replace('/login?next=' + encodeURIComponent('/app.html') + '#error_description=' + encodeURIComponent(fromLink.error)); return inst; }
      else if (fromLink) { Auth.store(fromLink); after(); }
      else after();
      window.addEventListener('beforeunload', function () { Sync.flush(); });
      return inst;
    },
    account: Account,
    plan: Plan,
    _internal: { Auth: Auth, Sync: Sync, refresh: function () { refreshUi(); } }
  };
})();
