/* SaveMyGrade landing page interactions: draggable 3D hero, scroll storytelling, feature showcase, real reviews. */
(function () {
  'use strict';
  var CFG = window.UNIZY_CONFIG || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function track(ev) {
    try {
      if (navigator.webdriver || localStorage.getItem('unizy:notrack') === '1') return;
      fetch(CFG.supabaseUrl + '/rest/v1/rpc/track_event', { method: 'POST', keepalive: true, headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_event: ev }) }).catch(function () {});
    } catch (e) {}
  }

  // ---------- intro ----------
  var h1 = $('.hero h1');
  if (h1) {
    $$('[data-split]', h1).forEach(function (line) {
      var words = line.textContent.trim().split(/\s+/);
      line.innerHTML = words.map(function (w, i) { return '<span class="w"><span style="transition-delay:' + (0.08 * i + (+line.getAttribute('data-split') || 0)) + 's">' + esc(w) + '</span></span>'; }).join(' ');
    });
  }
  requestAnimationFrame(function () { requestAnimationFrame(function () { document.documentElement.classList.add('loaded'); }); });
  track('lp_view');

  // ---------- header ----------
  var nav = $('.nav');
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 10); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  $('.nav-menu').addEventListener('click', function () { var o = !nav.classList.contains('open'); nav.classList.toggle('open', o); this.setAttribute('aria-expanded', String(o)); });
  $$('.nav-links a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); }); });
  try {
    var s = JSON.parse(localStorage.getItem('unizy.session') || 'null');
    if (s && s.access_token) {
      $$('[data-auth="app"]').forEach(function (a) { a.textContent = 'Dashboard'; a.href = '/dashboard'; });
      $$('[data-auth="login"]').forEach(function (a) { a.hidden = true; });
    }
  } catch (e) {}
  $$('[data-ev]').forEach(function (a) { a.addEventListener('click', function () { track(a.getAttribute('data-ev')); }); });

  // ---------- 3D hero ----------
  var scene = $('.scene'), stage = $('.stage');
  if (scene && stage) {
    var cards = $$('.fc', stage).map(function (el) { return { el: el, z: +el.getAttribute('data-z') || 0, x: +el.getAttribute('data-x') || 0 }; });
    var st = { ry: -18, rx: 10, vy: 0, drag: false, lastX: 0, lastT: 0, idleAt: 0, hx: 0, hy: 0, sc: 1, t0: performance.now(), visible: true };
    var norm = function (a, ref) { while (a - ref > 180) a -= 360; while (a - ref < -180) a += 360; return a; };
    scene.addEventListener('pointerdown', function (e) { st.drag = true; st.lastX = e.clientX; st.lastT = performance.now(); st.vy = 0; scene.setPointerCapture(e.pointerId); track('lp_hero_drag'); });
    scene.addEventListener('pointermove', function (e) {
      var r = scene.getBoundingClientRect();
      st.hx = ((e.clientX - r.left) / r.width - .5); st.hy = ((e.clientY - r.top) / r.height - .5);
      if (!st.drag) return;
      var now = performance.now(), dx = e.clientX - st.lastX;
      st.ry += dx * 0.45; st.vy = dx * 0.45 / Math.max(8, now - st.lastT) * 16;
      st.lastX = e.clientX; st.lastT = now;
    });
    var up = function () { if (st.drag) { st.drag = false; st.idleAt = performance.now(); } };
    scene.addEventListener('pointerup', up); scene.addEventListener('pointercancel', up);
    scene.addEventListener('pointerleave', function () { st.hx = 0; st.hy = 0; });
    var spin = $('#spin');
    if (spin) spin.addEventListener('click', function () { st.vy = 22; st.idleAt = performance.now(); track('lp_hero_spin'); });
    new IntersectionObserver(function (es) { st.visible = es[0].isIntersecting; }, { threshold: 0 }).observe(scene);

    var frame = function (now) {
      requestAnimationFrame(frame);
      if (!st.visible) return;
      var t = (now - st.t0) / 1000;
      if (!st.drag) {
        st.ry += st.vy; st.vy *= 0.955;
        if (Math.abs(st.vy) < 0.05 && now - st.idleAt > 1600) {
          var target = reduce ? -18 : -18 + Math.sin(t * 0.35) * 14 + st.hx * 16;
          st.ry = norm(st.ry, target); st.ry += (target - st.ry) * 0.035;
        }
      }
      var rxT = 10 - st.hy * 10;
      st.rx += (rxT - st.rx) * 0.08;
      // scroll: tilt back and shrink as the hero scrolls away
      var p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));
      var floatY = reduce ? 0 : Math.sin(t * 1.1) * 8;
      stage.style.setProperty('--ry', st.ry.toFixed(2) + 'deg');
      stage.style.setProperty('--rx', (st.rx + p * 18).toFixed(2) + 'deg');
      stage.style.setProperty('--sc', (1 - p * 0.12).toFixed(3));
      stage.style.translate = '0 ' + (floatY + p * 40).toFixed(1) + 'px';
      // depth of field: cards that swing behind the panel go soft
      var rad = st.ry * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
      for (var i = 0; i < cards.length; i++) {
        var k = cards[i], ez = k.z * c - k.x * s;
        var blur = ez < 0 ? Math.min(4, -ez / 40) : 0;
        k.el.style.filter = blur > 0.2 ? 'blur(' + blur.toFixed(1) + 'px)' : '';
        k.el.style.opacity = ez < -60 ? '.6' : '1';
      }
    };
    requestAnimationFrame(frame);
  }

  // ---------- reveal on scroll ----------
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -10% 0px' });
  $$('.rv').forEach(function (el) { io.observe(el); });

  // ---------- big statement lights up word by word as you scroll ----------
  var quote = $('.big-quote');
  if (quote) {
    var html = quote.innerHTML.split(/(<[^>]+>)/).map(function (part) { return part.charAt(0) === '<' ? part : part.split(/(\s+)/).map(function (w) { return /\S/.test(w) ? '<span class="dimw">' + w + '</span>' : w; }).join(''); }).join('');
    quote.innerHTML = html;
    var words = $$('.dimw', quote);
    var lightUp = function () {
      var r = quote.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      var n = Math.round(p * words.length);
      words.forEach(function (w, i) { w.classList.toggle('lit', i < n); });
    };
    if (reduce) words.forEach(function (w) { w.classList.add('lit'); });
    else { window.addEventListener('scroll', lightUp, { passive: true }); lightUp(); }
  }

  // ---------- count-up stats ----------
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return; cio.unobserve(e.target);
      var el = e.target, to = +el.getAttribute('data-count'), suf = el.getAttribute('data-suffix') || '', t0 = performance.now(), dur = reduce ? 0 : 1400;
      var stepFn = function (now) {
        var p = dur ? Math.min(1, (now - t0) / dur) : 1, v = Math.round(to * (1 - Math.pow(1 - p, 3)));
        el.textContent = v.toLocaleString('en-GB') + suf;
        if (p < 1) requestAnimationFrame(stepFn);
      };
      requestAnimationFrame(stepFn);
    });
  }, { threshold: .4 });
  $$('[data-count]').forEach(function (el) { cio.observe(el); });

  // ---------- scroll storytelling (how it works) ----------
  var steps = $$('.step'), views = $$('.sv');
  var setStep = function (i) {
    steps.forEach(function (s, j) { s.classList.toggle('on', j === i); });
    views.forEach(function (v, j) { v.classList.toggle('on', j === i); });
    if (i === 1) typeAnswer();
  };
  if (steps.length) {
    var sio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setStep(steps.indexOf(e.target)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { sio.observe(s); });
    setStep(0);
  }
  var typed = false;
  function typeAnswer() {
    var el = $('#typeans'); if (!el || typed) return; typed = true;
    var text = el.getAttribute('data-text'), i = 0;
    if (reduce) { el.textContent = text; return; }
    var go = function () { i += 2; el.textContent = text.slice(0, i); if (i < text.length) setTimeout(go, 22); };
    go();
  }

  // ---------- feature showcase ----------
  var feat = $('.feat');
  if (feat) {
    var tabs = $$('.ftab', feat), panels = $$('.fpanel', feat), cur = 0, timer = null, paused = false;
    var select = function (i, user) {
      cur = i;
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', j === i ? 'true' : 'false'); t.tabIndex = j === i ? 0 : -1; });
      panels.forEach(function (p, j) { p.classList.toggle('on', j === i); p.hidden = j !== i; });
      if (panels[i] && panels[i].getAttribute('data-panel') === 'tutor') runChat();
      // restart the progress bar animation
      var pr = $('.prog', tabs[i]); if (pr) { pr.style.animation = 'none'; void pr.offsetWidth; pr.style.animation = ''; }
      if (user) { paused = true; feat.classList.add('paused'); clearTimeout(timer); track('lp_feature_' + (panels[i] && panels[i].getAttribute('data-panel'))); }
      else schedule();
    };
    var schedule = function () { clearTimeout(timer); if (paused || reduce) return; timer = setTimeout(function () { select((cur + 1) % tabs.length); }, 6000); };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, true); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); tabs[(i + 1) % tabs.length].focus(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select((i + tabs.length - 1) % tabs.length, true); tabs[(i + tabs.length - 1) % tabs.length].focus(); }
      });
    });
    var fio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { fio.disconnect(); select(0); } }, { threshold: .3 });
    fio.observe(feat);
  }
  var chatRan = false;
  function runChat() {
    var box = $('#chatdemo'); if (!box || chatRan) return; chatRan = true;
    var msgs = JSON.parse(box.getAttribute('data-msgs'));
    var i = 0;
    var next = function () {
      if (i >= msgs.length) return;
      var m = msgs[i++];
      if (m.r === 'tu' && !reduce) {
        var t = document.createElement('div'); t.className = 'bub tu'; t.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; box.appendChild(t);
        setTimeout(function () { t.textContent = m.t; setTimeout(next, 900); }, 1100);
      } else {
        var b = document.createElement('div'); b.className = 'bub ' + m.r; b.textContent = m.t; box.appendChild(b);
        setTimeout(next, reduce ? 0 : 700);
      }
    };
    next();
  }

  // ---------- cursor spotlight on glass cards ----------
  $$('.spot, .feat-view').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // ---------- magnetic primary buttons ----------
  if (!reduce && window.matchMedia('(hover:hover)').matches) {
    $$('.btn-glow.lg').forEach(function (b) {
      b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.2).toFixed(1) + 'px)'; });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  // ---------- real reviews only ----------
  var revs = $('#revs');
  if (revs && CFG.supabaseUrl) {
    fetch(CFG.supabaseUrl + '/rest/v1/rpc/public_reviews', { method: 'POST', headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_limit: 3, p_offset: 0, p_sort: 'newest' }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var list = d && (d.reviews || d.items || []);
        if (!d || !+d.count || !list || !list.length) return;
        revs.innerHTML = list.map(function (r) {
          var n = Math.max(0, Math.min(5, +r.rating || 0));
          return '<article class="rev"><span class="stars" aria-label="' + n + ' out of 5 stars">' + '★★★★★'.slice(0, n) + '<span style="opacity:.25">' + '★★★★★'.slice(0, 5 - n) + '</span></span>' + (r.title ? '<h3 style="margin:0;font-family:var(--display)">' + esc(r.title) + '</h3>' : '') + '<p>' + esc(r.body) + '</p><span class="who">' + [r.name, r.course].filter(Boolean).map(esc).join(' · ') + ' · Verified account</span></article>';
        }).join('');
      }).catch(function () {});
  }
})();
