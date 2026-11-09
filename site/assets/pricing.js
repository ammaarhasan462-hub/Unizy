/* Unizy pricing page: sends signed-in students to Stripe checkout with their account attached. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG, links = CFG.stripe || {};
  var SKEY = 'unizy.session';
  var cta = document.getElementById('pro-cta'), note = document.getElementById('pro-note'), cur = document.getElementById('current');
  function session() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function headers(t) { var h = { apikey: CFG.anonKey, 'Content-Type': 'application/json' }; if (t) h.Authorization = 'Bearer ' + t; return h; }
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
      }).catch(function () { return s; });
  }
  function choice() { var r = document.querySelector('input[name=opt]:checked'); return r ? r.value : 'year'; }
  var who = null;
  function update() {
    var plan = choice(), url = links[plan];
    var label = { year: 'Get the year pass for £39', monthly: 'Start monthly for £5.99', exam: 'Get the exam pass for £12' }[plan];
    if (!who) { cta.href = '/signup?next=' + encodeURIComponent('/pricing'); cta.textContent = 'Create a free account to get Pro'; cta.removeAttribute('aria-disabled'); return; }
    if (!url) { cta.removeAttribute('href'); cta.setAttribute('aria-disabled', 'true'); cta.textContent = 'Checkout opens very soon'; note.textContent = 'Payments are being switched on. Your free trial and free plan work in the meantime.'; return; }
    var q = 'client_reference_id=' + encodeURIComponent(who.id) + (who.email ? '&prefilled_email=' + encodeURIComponent(who.email) : '');
    cta.href = url + (url.indexOf('?') >= 0 ? '&' : '?') + q;
    cta.removeAttribute('aria-disabled');
    cta.textContent = label;
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name=opt]'), function (r) { r.addEventListener('change', update); });
  cta.addEventListener('click', function (e) { if (cta.getAttribute('aria-disabled') === 'true') e.preventDefault(); });
  update();

  fresh().then(function (s) {
    if (!s || !s.user) return;
    who = { id: s.user.id, email: s.user.email };
    document.getElementById('nav-app').textContent = 'My dashboard';
    var free = document.getElementById('free-cta'); free.href = '/app.html'; free.textContent = 'Go to my dashboard';
    update();
    return fetch(CFG.supabaseUrl + '/rest/v1/rpc/my_plan', { method: 'POST', headers: headers(s.access_token), body: '{}' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      var day = function (iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
      var text = d.tier === 'pro' ? 'You’re on Unizy Pro until ' + day(d.until) + (d.plan === 'monthly' && d.renews ? ' (renews automatically).' : '.') + (d.plan !== 'monthly' ? ' Buying another pass adds the time on.' : '')
        : d.tier === 'trial' ? 'Your free Pro trial ends on ' + day(d.until) + '. Choose a plan below to keep Pro after that.'
        : 'You’re on the free plan.';
      cur.textContent = text; cur.hidden = false;
      if (d.tier === 'pro' && d.plan === 'monthly') { cta.removeAttribute('href'); cta.setAttribute('aria-disabled', 'true'); cta.textContent = 'You’re already on Pro'; }
    });
  });
})();
