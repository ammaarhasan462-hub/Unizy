/* Unizy personal welcome: a private note shown to one account after it signs in, before the app.
   Who gets one and what it says is stored only in the database (public.special_welcomes) and served by
   the special_welcome() RPC to that account alone, so nothing personal lives in this public file. */
(function () {
  'use strict';
  var HIDE_KEY = 'unizy:sw:uid';      // remembers (on this device) that this account has a welcome, to avoid a flash of the app
  var SEEN_KEY = 'unizy:sw:seen:';    // once per browser session (each new visit / tab shows a fresh one)
  var hidden = false, hideTimer = null;

  function css() {
    if (document.getElementById('uzw-css')) return;
    var s = document.createElement('style');
    s.id = 'uzw-css';
    s.textContent = [
      'html.uzw-wait #root{visibility:hidden}',
      '.uzw{position:fixed;inset:0;z-index:2147483000;overflow-y:auto;font-family:"DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif;color:#4A1F2C;',
      'background:radial-gradient(120% 80% at 50% 0%,#FFF6F1 0%,#FDE3E8 55%,#F9CFDA 100%);display:flex;align-items:center;justify-content:center;padding:28px 18px;box-sizing:border-box;opacity:0;transition:opacity .45s ease}',
      '.uzw.on{opacity:1}.uzw.off{opacity:0}',
      '.uzw *{box-sizing:border-box}',
      '.uzw-in{position:relative;width:100%;max-width:520px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px}',
      '.uzw-kick{font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#B4566F}',
      '.uzw-h{margin:0;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:clamp(34px,8vw,52px);line-height:1.08;color:#4A1F2C}',
      '.uzw-h em{font-style:italic;color:#D2456B;display:inline-block;animation:uzwPop .7s cubic-bezier(.2,1.6,.4,1) .35s both}',
      '.uzw-sub{margin:0;font-size:16px;color:#7A4655}',
      /* gift */
      '.uzw-gift{position:relative;width:170px;height:170px;margin-top:18px;border:0;background:none;padding:0;cursor:pointer;animation:uzwWiggle 2.4s ease-in-out 1s infinite}',
      '.uzw-gift:focus-visible{outline:3px solid #D2456B;outline-offset:8px;border-radius:12px}',
      '.uzw-box{position:absolute;left:15px;right:15px;bottom:0;height:108px;background:#D2456B;border-radius:8px;box-shadow:inset 0 -10px 0 rgba(0,0,0,.08),0 14px 28px rgba(150,40,70,.25)}',
      '.uzw-box:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:26px;margin-left:-13px;background:#FFE3A8}',
      '.uzw-lid{position:absolute;left:5px;right:5px;bottom:100px;height:36px;background:#E25C80;border-radius:8px;transition:transform .7s cubic-bezier(.3,1.4,.5,1),opacity .6s ease .35s;transform-origin:20% 100%;box-shadow:0 4px 0 rgba(0,0,0,.06)}',
      '.uzw-lid:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:26px;margin-left:-13px;background:#FFE3A8}',
      '.uzw-bow{position:absolute;left:50%;top:-30px;width:70px;height:34px;margin-left:-35px}',
      '.uzw-bow:before,.uzw-bow:after{content:"";position:absolute;top:2px;width:32px;height:28px;border:8px solid #FFE3A8;border-radius:50% 50% 50% 50%/60% 60% 40% 40%}',
      '.uzw-bow:before{left:0;transform:rotate(-18deg)}.uzw-bow:after{right:0;transform:rotate(18deg)}',
      '.uzw-hint{font-size:15px;font-weight:600;color:#B4566F}',
      '.uzw-open .uzw-lid{transform:translateY(-90px) rotate(-28deg);opacity:0}',
      '.uzw-open .uzw-box{animation:uzwSink .6s ease .45s forwards}',
      '.uzw-open.uzw-gift{animation:none;cursor:default}',
      /* surprise */
      '.uzw-sur{display:none;flex-direction:column;align-items:center;gap:14px;width:100%}',
      '.uzw-sur.on{display:flex;animation:uzwRise .7s cubic-bezier(.2,1.2,.4,1) both}',
      '.uzw-talk{display:flex;align-items:flex-end;gap:12px;width:100%;text-align:left}',
      '.uzw-cat{flex:0 0 auto;width:132px;height:132px;animation:uzwBob 3s ease-in-out infinite}',
      '.uzw-bub{position:relative;flex:1 1 auto;background:#fff;border-radius:22px 22px 22px 6px;padding:18px 20px;box-shadow:0 10px 30px rgba(150,40,70,.16);margin-bottom:46px}',
      '.uzw-bub:before{content:"";position:absolute;left:-10px;bottom:10px;border:10px solid transparent;border-right-color:#fff;border-left:0}',
      '.uzw-msg{margin:0;font-family:Fraunces,Georgia,serif;font-size:20px;line-height:1.4;color:#4A1F2C}',
      '.uzw-from{margin:10px 0 0;font-size:15px;font-weight:700;color:#D2456B;text-align:right}',
      '.uzw-next{font:inherit;font-size:16px;font-weight:700;color:#fff;background:#4A1F2C;border:0;border-radius:999px;padding:14px 28px;min-height:50px;cursor:pointer;box-shadow:0 8px 20px rgba(74,31,44,.25);transition:transform .15s ease}',
      '.uzw-next:hover{transform:translateY(-2px)}.uzw-next:focus-visible{outline:3px solid #D2456B;outline-offset:3px}',
      /* floating hearts */
      '.uzw-hearts{position:fixed;inset:0;pointer-events:none;overflow:hidden}',
      '.uzw-heart{position:absolute;bottom:-40px;font-size:20px;color:#E8829C;opacity:.55;animation:uzwFloat linear infinite}',
      '.uzw-burst{position:absolute;left:50%;top:50%;font-size:22px;color:#D2456B;pointer-events:none;animation:uzwBurst 1.1s ease-out forwards}',
      '@keyframes uzwPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}',
      '@keyframes uzwWiggle{0%,70%,100%{transform:rotate(0)}75%{transform:rotate(-6deg)}80%{transform:rotate(6deg)}85%{transform:rotate(-4deg)}90%{transform:rotate(3deg)}}',
      '@keyframes uzwSink{to{transform:scale(.85);opacity:0}}',
      '@keyframes uzwRise{from{transform:translateY(24px) scale(.96);opacity:0}to{transform:none;opacity:1}}',
      '@keyframes uzwBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
      '@keyframes uzwFloat{from{transform:translateY(0) rotate(0)}to{transform:translateY(-115vh) rotate(25deg)}}',
      '@keyframes uzwBurst{from{transform:translate(-50%,-50%) scale(.4);opacity:1}to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.2);opacity:0}}',
      '@media (max-width:420px){.uzw-cat{width:98px;height:98px}.uzw-msg{font-size:18px}.uzw-bub{padding:16px}}',
      '@media (prefers-reduced-motion:reduce){.uzw *,.uzw{animation:none!important;transition:none!important}.uzw-heart{display:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // the Unizy tutor cat, in pink, holding a little heart
  var CAT = '<svg class="uzw-cat" viewBox="0 0 120 120" aria-hidden="true">' +
    '<path d="M88 106c16 0 22-14 15-27" fill="none" stroke="#4A1F2C" stroke-width="10" stroke-linecap="round"/>' +
    '<path d="M88 106c16 0 22-14 15-27" fill="none" stroke="#F6B9C8" stroke-width="5.5" stroke-linecap="round"/>' +
    '<path d="M33 113c-3-27 8-45 27-45s30 18 27 45z" fill="#F6B9C8" stroke="#4A1F2C" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M50 113c-1-14 3-24 10-24s11 10 10 24z" fill="#FFFFFF" opacity="0.92"/>' +
    '<path d="M31 47L25 15l30 17z" fill="#F6B9C8" stroke="#4A1F2C" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M89 47l6-32-30 17z" fill="#F6B9C8" stroke="#4A1F2C" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M34 39l-3-15 14 8z" fill="#E8829C"/><path d="M86 39l3-15-14 8z" fill="#E8829C"/>' +
    '<ellipse cx="60" cy="51" rx="33" ry="28" fill="#F6B9C8" stroke="#4A1F2C" stroke-width="3"/>' +
    '<ellipse cx="60" cy="63" rx="15" ry="10" fill="#FFFFFF"/>' +
    '<path d="M41 49q6-7 12 0M67 49q6-7 12 0" fill="none" stroke="#4A1F2C" stroke-width="3" stroke-linecap="round"/>' +
    '<ellipse cx="40" cy="60" rx="5" ry="3" fill="#E8829C" opacity=".7"/><ellipse cx="80" cy="60" rx="5" ry="3" fill="#E8829C" opacity=".7"/>' +
    '<path d="M56 58h8l-4 4.5z" fill="#D2456B" stroke="#4A1F2C" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M60 62.5c0 3.5-3.5 5.5-6.5 3.5M60 62.5c0 3.5 3.5 5.5 6.5 3.5" fill="none" stroke="#4A1F2C" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M45 60l-17-2M45 64l-17 3M75 60l17-2M75 64l17 3" fill="none" stroke="#4A1F2C" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M60 104c-9-6-14-10-14-16a6 6 0 0 1 14-3a6 6 0 0 1 14 3c0 6-5 10-14 16z" fill="#D2456B" stroke="#4A1F2C" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<ellipse cx="49" cy="112" rx="8" ry="4.5" fill="#F6B9C8" stroke="#4A1F2C" stroke-width="2.5"/>' +
    '<ellipse cx="71" cy="112" rx="8" ry="4.5" fill="#F6B9C8" stroke="#4A1F2C" stroke-width="2.5"/>' +
    '</svg>';

  function release() {
    clearTimeout(hideTimer);
    if (hidden) { document.documentElement.classList.remove('uzw-wait'); hidden = false; }
  }

  function render(d, done, nextLabel) {
    css();
    var wrap = el('div', 'uzw');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'A message for you');

    var hearts = el('div', 'uzw-hearts');
    for (var i = 0; i < 14; i++) {
      var h = el('span', 'uzw-heart', '♥');
      h.style.left = (Math.random() * 100) + '%';
      h.style.fontSize = (12 + Math.random() * 18) + 'px';
      h.style.animationDuration = (9 + Math.random() * 9) + 's';
      h.style.animationDelay = (-Math.random() * 14) + 's';
      hearts.appendChild(h);
    }
    wrap.appendChild(hearts);

    var inner = el('div', 'uzw-in');
    inner.appendChild(el('div', 'uzw-kick', 'Unizy'));
    var h1 = el('h1', 'uzw-h');
    h1.appendChild(document.createTextNode('Welcome back, '));
    h1.appendChild(el('em', null, d.compliment));
    inner.appendChild(h1);
    inner.appendChild(el('p', 'uzw-sub', 'Someone left you a little something before you start.'));

    var gift = el('button', 'uzw-gift');
    gift.type = 'button';
    gift.setAttribute('aria-label', 'Open your present');
    var box = el('span', 'uzw-box'), lid = el('span', 'uzw-lid');
    lid.appendChild(el('span', 'uzw-bow'));
    gift.appendChild(box); gift.appendChild(lid);
    inner.appendChild(gift);
    var hint = el('div', 'uzw-hint', 'Tap the present to open it 🎁');
    inner.appendChild(hint);

    var sur = el('div', 'uzw-sur');
    var talk = el('div', 'uzw-talk');
    talk.insertAdjacentHTML('beforeend', CAT);
    var bub = el('div', 'uzw-bub');
    bub.appendChild(el('p', 'uzw-msg', d.message));
    bub.appendChild(el('p', 'uzw-from', 'From ' + (d.sender || '') + ' 💌'));
    talk.appendChild(bub);
    sur.appendChild(talk);
    var next = el('button', 'uzw-next', nextLabel || 'Next →');
    next.type = 'button';
    sur.appendChild(next);
    inner.appendChild(sur);
    wrap.appendChild(inner);

    gift.addEventListener('click', function () {
      if (gift.classList.contains('uzw-open')) return;
      gift.classList.add('uzw-open');
      hint.style.visibility = 'hidden';
      var r = gift.getBoundingClientRect();
      for (var k = 0; k < 16; k++) {
        var b = el('span', 'uzw-burst', k % 3 ? '♥' : '✦');
        var a = (k / 16) * Math.PI * 2, dist = 70 + Math.random() * 60;
        b.style.left = (r.left + r.width / 2) + 'px';
        b.style.top = (r.top + r.height / 2) + 'px';
        b.style.position = 'fixed';
        b.style.setProperty('--dx', Math.cos(a) * dist + 'px');
        b.style.setProperty('--dy', Math.sin(a) * dist + 'px');
        wrap.appendChild(b);
        setTimeout((function (n) { return function () { n.remove(); }; })(b), 1200);
      }
      setTimeout(function () {
        gift.style.display = 'none';
        hint.style.display = 'none';
        sur.classList.add('on');
        try { next.focus({ preventScroll: true, focusVisible: false }); } catch (e) { /* ignore */ }
      }, 900);
    });
    next.addEventListener('click', function () {
      wrap.classList.add('off');
      setTimeout(function () { wrap.remove(); }, 450);
      done();
    });

    document.body.appendChild(wrap);
    release();
    requestAnimationFrame(function () { wrap.classList.add('on'); try { gift.focus({ preventScroll: true, focusVisible: false }); } catch (e) { /* ignore */ } });
  }

  window.UnizyWelcome = {
    // called as the app starts: if this device knows the signed-in account has a welcome, keep the app hidden briefly
    prehide: function (session) {
      try {
        var uid = session && session.user && session.user.id;
        if (!uid || localStorage.getItem(HIDE_KEY) !== uid || sessionStorage.getItem(SEEN_KEY + uid)) return;
        css();
        document.documentElement.classList.add('uzw-wait');
        hidden = true;
        hideTimer = setTimeout(release, 3000);
      } catch (e) { /* storage blocked: no pre-hide */ }
    },
    release: release,
    // called once the account is confirmed: shows the welcome (once per browser session) if there is one
    check: function (rest, inst, uid) {
      try { if (sessionStorage.getItem(SEEN_KEY + uid)) { release(); return; } } catch (e) { /* ignore */ }
      rest('rpc/special_welcome', { method: 'POST', body: '{}' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || !d.compliment || !d.message) {
            try { if (localStorage.getItem(HIDE_KEY) === uid) localStorage.removeItem(HIDE_KEY); } catch (e) { /* ignore */ }
            release(); return;
          }
          try { sessionStorage.setItem(SEEN_KEY + uid, '1'); localStorage.setItem(HIDE_KEY, uid); } catch (e) { /* ignore */ }
          var setUp = ((inst && inst.state) || {}).screen === 'app';
          render(d, function () {
            if (((inst && inst.state) || {}).screen === 'app') inst.setState({ tab: 'notes' });
          }, setUp ? 'Next: go to my notes →' : 'Next: set up my modules →');
        })
        .catch(release);
    }
  };
})();
