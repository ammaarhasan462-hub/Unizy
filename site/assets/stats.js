/* Private funnel page for the Unizy owner. Data comes from funnel_report(), which only answers admin accounts. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG, box = document.getElementById('stats');
  try { localStorage.setItem('unizy:notrack', '1'); } catch (e) {}
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function session() { try { return JSON.parse(localStorage.getItem('unizy.session') || 'null'); } catch (e) { return null; } }
  function fresh() {
    var s = session(); if (!s) return Promise.resolve(null);
    if ((s.expires_at || 0) - 60 > Date.now() / 1000) return Promise.resolve(s);
    return fetch(CFG.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (b) {
        if (!b || !b.access_token) return null;
        var ns = Object.assign({}, s, { access_token: b.access_token, refresh_token: b.refresh_token, expires_at: b.expires_at || Math.floor(Date.now() / 1000) + (b.expires_in || 3600) });
        try { localStorage.setItem('unizy.session', JSON.stringify(ns)); } catch (e) {}
        return ns;
      });
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '–'; }
  var days = 28;
  function load() {
    box.innerHTML = '<p class="muted">Loading…</p>';
    fresh().then(function (s) {
      if (!s) { box.innerHTML = '<p>Log in with your owner account to see this page. <a href="/login?next=%2Fstats.html">Log in</a></p>'; return null; }
      return fetch(CFG.supabaseUrl + '/rest/v1/rpc/funnel_report', { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_days: days }) }).then(function (r) { return r.json(); });
    }).then(function (d) {
      if (d === null) return;
      if (!d || !d.ok) { box.innerHTML = '<p>' + esc((d && d.message) || 'Not available.') + '</p>'; return; }
      var e = d.events || {}, a = d.accounts || {};
      var v = function (k) { return +e[k] || 0; };
      var steps = [
        ['Homepage views', v('home_view'), 'anon'],
        ['Started the demo', v('demo_notes'), 'anon'],
        ['Finished the demo', v('demo_complete'), 'anon'],
        ['Opened the app', v('app_view'), 'anon'],
        ['Set up their modules (new devices)', v('setup_done'), 'anon'],
        ['Saw the sign-up page', v('signup_view'), 'anon'],
        ['Submitted sign-up', v('signup_submit'), 'anon'],
        ['New accounts', +a.signups || 0, 'acc'],
        ['Confirmed their email', +a.confirmed || 0, 'acc'],
        ['Reached a first useful result', +a.firstResult || 0, 'acc'],
        ['Came back within a week', +a.returned || 0, 'acc', +a.returnEligible || 0]
      ];
      var max = Math.max.apply(null, steps.map(function (x) { return x[1]; }).concat([1]));
      var h = '<div class="range">' + [7, 28, 90].map(function (n) { return '<button data-d="' + n + '" aria-pressed="' + (n === days) + '">' + n + ' days</button>'; }).join('') + '<span class="muted">Since ' + esc(d.since) + ' · ' + (+d.activeThisWeek || 0) + ' accounts active in the last 7 days</span></div>';
      h += '<section class="card"><h2>Visitor to active user</h2><p class="muted">Steps 1–7 are anonymous totals (one person can count more than once, and bots and your devices are left out). Steps 8–11 are accounts created in this period, excluding yours.</p><ol class="funnel">' +
        steps.map(function (x, i) {
          var prev = i ? steps[i - 1][1] : 0, note = x[3] !== undefined ? ' of ' + x[3] + ' whose first week is over' : (i ? ' · ' + pct(x[1], prev) + ' of previous step' : '');
          return '<li class="' + x[2] + '"><span class="lab">' + (i + 1) + '. ' + esc(x[0]) + '</span><span class="bar"><i style="width:' + Math.max(1, Math.round(x[1] / max * 100)) + '%"></i></span><span class="num"><b>' + x[1] + '</b>' + note + '</span></li>';
        }).join('') + '</ol></section>';
      var ctas = [['Explore Unizy (hero)', 'cta_explore_hero'], ['See how it works (hero)', 'cta_how_hero'], ['How it works (nav)', 'nav_how'], ['Sign up (nav)', 'nav_signup'], ['Explore Unizy (end of demo)', 'cta_explore_demo'], ['Sign up (end of demo)', 'cta_signup_demo'], ['Explore Unizy (bottom)', 'cta_explore_final'], ['Sign up (bottom)', 'cta_signup_final'], ['Answered all demo quiz questions', 'demo_quiz_done'], ['Log-in page views', 'login_view']];
      h += '<section class="card"><h2>Buttons and pages</h2><table><tbody>' + ctas.map(function (c) { return '<tr><td>' + c[0] + '</td><td class="r">' + v(c[1]) + '</td></tr>'; }).join('') + '</tbody></table></section>';
      h += '<section class="card"><h2>Weekly sign-up cohorts</h2><table><thead><tr><th>Week starting</th><th class="r">Sign-ups</th><th class="r">First useful result</th><th class="r">Came back within a week</th></tr></thead><tbody>' +
        ((d.cohorts || []).map(function (c) { return '<tr><td>' + esc(c.week) + '</td><td class="r">' + c.signups + '</td><td class="r">' + c.firstResult + ' (' + pct(c.firstResult, c.signups) + ')</td><td class="r">' + (c.eligible ? c.returned + ' of ' + c.eligible + ' (' + pct(c.returned, c.eligible) + ')' : 'week not over') + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">No sign-ups in this period yet.</td></tr>') + '</tbody></table>' +
        '<p class="muted">A first useful result means the account reviewed 10 flashcards, finished a topic test, finished a lecture or planned a deadline, or used the tutor.</p></section>';
      h += '<section class="card"><h2>By day</h2><table><thead><tr><th>Day</th><th class="r">Homepage views</th><th class="r">Demo starts</th><th class="r">Sign-up page</th><th class="r">Sign-ups submitted</th></tr></thead><tbody>' +
        ((d.daily || []).slice().reverse().map(function (r) { return '<tr><td>' + esc(r.day) + '</td><td class="r">' + (r.views || 0) + '</td><td class="r">' + (r.demo || 0) + '</td><td class="r">' + (r.signupView || 0) + '</td><td class="r">' + (r.submits || 0) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="muted">No visits recorded yet.</td></tr>') + '</tbody></table></section>';
      box.innerHTML = h;
      fresh().then(function (s2) {
        return fetch(CFG.supabaseUrl + '/rest/v1/rpc/outcomes_report', { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + s2.access_token, 'Content-Type': 'application/json' }, body: '{}' }).then(function (r) { return r.json(); });
      }).then(function (o) {
        if (!o || !o.ok) return;
        var rt = o.retest || {}, rc = o.recall || {}, mn = o.minutes || {}, sv = o.survey || {}, hrs = sv.hours || {};
        var row = function (a, b) { return '<tr><td>' + a + '</td><td class="r">' + b + '</td></tr>'; };
        var sec = document.createElement('section'); sec.className = 'card';
        sec.innerHTML = '<h2>Is it working? Learning outcomes (all time, excluding your accounts)</h2><p class="muted">The homepage only shows each figure once 20 or more students contribute to it.</p><table><tbody>' +
          row('Students who retested a topic', (rt.students || 0) + ' (' + (rt.topics || 0) + ' topics)') +
          row('Average score: first try → latest', rt.first == null ? '–' : rt.first + '% → ' + rt.latest + '% (' + (rt.improved || 0) + ' students improved)') +
          row('Spaced flashcard reviews still known', rc.rate == null ? '–' : rc.rate + '% of ' + rc.reviews + ' reviews (' + rc.students + ' students)') +
          row('Median active study, last 7 days', mn.median == null ? '–' : Math.round(mn.median) + ' min (' + mn.students + ' students)') +
          row('Survey: saves time a lot / a bit / no difference / takes longer', (sv.aLot || 0) + ' / ' + (sv.aBit || 0) + ' / ' + (sv.same || 0) + ' / ' + (sv.longer || 0)) +
          row('Hours saved a week (none / under 1 / 1–2 / 3–5 / 5+)', [hrs['0'] || 0, hrs['<1'] || 0, hrs['1-2'] || 0, hrs['3-5'] || 0, hrs['5+'] || 0].join(' / ')) +
          '</tbody></table>';
        box.insertBefore(sec, box.children[2] || null);
      }).catch(function () {});
    }).catch(function () { box.innerHTML = '<p>Couldn’t load the figures. Check your connection and refresh.</p>'; });
  }
  box.addEventListener('click', function (ev) { var b = ev.target.closest('[data-d]'); if (b) { days = +b.getAttribute('data-d'); load(); } });
  load();
})();
