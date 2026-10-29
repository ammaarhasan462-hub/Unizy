/* Unizy public pages: mobile menu, current-page marker and the logged-in "My dashboard" button. */
(function () {
  'use strict';
  var btn = document.querySelector('.sx-menu'), nav = document.getElementById('sx-nav'), top = document.querySelector('.sx-top');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      top.classList.toggle('open', open);
    });
  }
  if (top) {
    var onScroll = function () { top.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  var session = null;
  try { session = JSON.parse(localStorage.getItem('unizy.session') || 'null'); } catch (e) { session = null; }
  if (session && session.access_token) {
    var cta = document.querySelector('[data-auth="app"]'), login = document.querySelector('[data-auth="login"]');
    if (cta) { cta.textContent = 'My dashboard'; cta.href = '/app'; }
    if (login) login.hidden = true;
  }
  // gentle reveal as sections scroll into view
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('main .sec, main section.plans, main .reveal').forEach(function (s) { s.classList.add('will-reveal'); io.observe(s); });
  }
})();
