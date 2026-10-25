/* Unizy page runtime: renders the app's templates (holes, sc-if, sc-for, on* handlers)
   and patches the live DOM in place so typing and focus are never interrupted. */
(function () {
  'use strict';
  var VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, track: 1, wbr: 1 };
  var XHTML = 'http://www.w3.org/1999/xhtml';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function getPath(scope, expr) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return +expr;
    var o = scope, parts = expr.split('.');
    for (var i = 0; i < parts.length; i++) { if (o == null) return undefined; o = o[parts[i]]; }
    return o;
  }
  var HOLE = /\{\{([^}]+)\}\}/g;
  function fill(scope, str) { return str.replace(HOLE, function (_, e) { var v = getPath(scope, e); return v == null ? '' : String(v); }); }
  function single(str) { var m = /^\s*\{\{([^}]+)\}\}\s*$/.exec(str); return m ? m[1] : null; }
  function bare(attr) { return (attr || '').replace(/[{}]/g, ''); }

  function kids(node, scope, H) { var out = ''; for (var c = node.firstChild; c; c = c.nextSibling) out += render(c, scope, H); return out; }
  function render(node, scope, H) {
    if (node.nodeType === 3) return esc(fill(scope, node.nodeValue));
    if (node.nodeType !== 1) return '';
    var tag = node.localName;
    if (tag === 'helmet' || tag === 'dc-import') return '';
    if (tag === 'sc-if') return getPath(scope, bare(node.getAttribute('value'))) ? kids(node, scope, H) : '';
    if (tag === 'sc-for') {
      var list = getPath(scope, bare(node.getAttribute('list'))) || [], as = node.getAttribute('as'), out = '';
      for (var i = 0; i < list.length; i++) { var sc = Object.create(scope); sc[as] = list[i]; out += kids(node, sc, H); }
      return out;
    }
    var attrs = '', evs = null;
    for (var j = 0; j < node.attributes.length; j++) {
      var a = node.attributes[j], n = a.name;
      if (n.indexOf('hint-') === 0) continue;
      if (/^on[a-z]+$/i.test(n)) {
        var ex = single(a.value), fn = ex ? getPath(scope, ex) : null;
        if (typeof fn === 'function') (evs = evs || {})[n.slice(2).toLowerCase()] = fn;
        continue;
      }
      if (tag === 'textarea' && n === 'value') continue;
      attrs += ' ' + n + '="' + esc(fill(scope, a.value)) + '"';
    }
    if (evs) { H.push(evs); attrs += ' data-dc-ev="' + (H.length - 1) + '"'; }
    if (tag === 'textarea') return '<textarea' + attrs + '>' + esc(fill(scope, node.getAttribute('value') || '')) + '</textarea>';
    if (VOID[tag] && node.namespaceURI === XHTML) return '<' + tag + attrs + '>';
    return '<' + tag + attrs + '>' + kids(node, scope, H) + '</' + tag + '>';
  }

  function syncAttrs(from, to) {
    var i, a;
    for (i = from.attributes.length - 1; i >= 0; i--) {
      a = from.attributes[i];
      if (!to.hasAttribute(a.name) && !(from.tagName === 'DETAILS' && a.name === 'open')) from.removeAttribute(a.name);
    }
    for (i = 0; i < to.attributes.length; i++) { a = to.attributes[i]; if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value); }
  }
  function same(f, t) {
    if (f.nodeType !== t.nodeType) return false;
    if (f.nodeType !== 1) return true;
    return f.tagName === t.tagName && f.namespaceURI === t.namespaceURI && !(f.tagName === 'INPUT' && f.type !== t.type);
  }
  function morph(from, to) {
    if (from.tagName === 'INPUT' && from.type === 'file') { var keep = from.getAttribute('data-dc-ev'); syncAttrs(from, to); return keep; }
    syncAttrs(from, to);
    var active = document.activeElement === from;
    if (from.tagName === 'INPUT') { var v = to.getAttribute('value') || ''; if (!active && from.value !== v) from.value = v; return; }
    if (from.tagName === 'TEXTAREA') { if (!active && from.value !== to.value) from.value = to.value; return; }
    morphChildren(from, to);
  }
  function morphChildren(from, to) {
    var fk = Array.prototype.slice.call(from.childNodes), tk = Array.prototype.slice.call(to.childNodes), i;
    for (i = 0; i < tk.length; i++) {
      var t = tk[i], f = fk[i];
      if (!f) { from.appendChild(t); continue; }
      if (!same(f, t)) { from.replaceChild(t, f); continue; }
      if (f.nodeType !== 1) { if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue; continue; }
      morph(f, t);
    }
    for (i = fk.length - 1; i >= tk.length; i--) from.removeChild(fk[i]);
  }

  function DCLogic() { this.state = {}; this.props = {}; }
  DCLogic.prototype.setState = function (o) {
    var patch = typeof o === 'function' ? o(this.state) : o;
    this.state = Object.assign({}, this.state, patch);
    if (this.__app) this.__app.schedule();
  };

  function mount(root, templateHTML, Comp, props) {
    var tpl = document.createElement('template');
    tpl.innerHTML = templateHTML;
    var frag = tpl.content;
    Array.prototype.forEach.call(frag.querySelectorAll('helmet'), function (h) {
      Array.prototype.forEach.call(h.children, function (c) { document.head.appendChild(c.cloneNode(true)); });
    });
    var inst = new Comp();
    inst.props = props || {};
    inst.state = inst.state || {};
    var app = {
      handlers: [], pending: false, mounted: false,
      schedule: function () {
        if (app.pending) return;
        app.pending = true;
        (window.queueMicrotask || function (f) { Promise.resolve().then(f); })(function () { app.pending = false; app.render(); });
      },
      render: function () {
        var H = [], vals;
        try { vals = inst.renderVals(); } catch (e) { console.error('[unizy] render failed', e); return; }
        var html = '';
        for (var c = frag.firstChild; c; c = c.nextSibling) html += render(c, vals, H);
        var t = document.createElement('template');
        t.innerHTML = html;
        var holder = document.createElement('div');
        holder.appendChild(t.content);
        app.handlers = H;
        morphChildren(root, holder);
        if (app.mounted && inst.componentDidUpdate) { try { inst.componentDidUpdate(); } catch (e) { console.error(e); } }
        if (app.afterRender) app.afterRender(inst);
      }
    };
    function handle(type) {
      root.addEventListener(type, function (e) {
        var el = e.target;
        while (el && el !== root) {
          var id = el.getAttribute ? el.getAttribute('data-dc-ev') : null;
          if (id !== null && id !== undefined) {
            var evs = app.handlers[+id] || {}, fn = null, tg = el.tagName, ty = (el.type || '').toLowerCase();
            if (type === 'click') fn = evs.click;
            else if (type === 'input') fn = (tg === 'TEXTAREA' || (tg === 'INPUT' && ty !== 'file' && ty !== 'checkbox' && ty !== 'radio')) ? (evs.change || evs.input) : null;
            else if (type === 'change') fn = ((tg === 'INPUT' && (ty === 'file' || ty === 'checkbox' || ty === 'radio')) || tg === 'SELECT') ? evs.change : null;
            else if (type === 'keydown') fn = evs.keydown;
            if (fn) { try { fn(e); } catch (err) { console.error(err); } return; }
          }
          el = el.parentNode;
        }
      });
    }
    ['click', 'input', 'change', 'keydown'].forEach(handle);
    inst.__app = app;
    app.render();
    app.mounted = true;
    if (inst.componentDidMount) { try { inst.componentDidMount(); } catch (e) { console.error(e); } }
    return inst;
  }

  window.DCLogic = DCLogic;
  window.UnizyRuntime = { mount: mount };
})();
