/* Dashboard attachments: files, photos and videos for the marker and the tutor.
   Everything is prepared in the browser before sending: photos are resized to JPEG, each video becomes a few still
   frames (no sound), PDFs go as they are, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, code and text files
   become plain text (spreadsheets keep their cell references and formulas). Screenshots can be pasted straight in.
   Limits: 10 photos, 2 videos, 5 files (only mentioned if someone goes over).

   var tray = UnizyAttach.tray('key');      // one tray per draft; kept in memory while the dashboard is open
   tray.html()                              // markup to include where the button should go
   tray.mount()                             // call after that markup is in the page
   tray.count(), tray.busy(), tray.summary()
   tray.payload() -> [attachments]          // for the request body
   tray.clear()
*/
(function () {
  'use strict';
  var LIM = { photo: 10, video: 2, doc: 5 }, FRAMES = 8, PHOTO_EDGE = 1568, FRAME_EDGE = 1280;
  var MAX_PDF = 15 * 1024 * 1024, MAX_VIDEO = 2 * 1024 * 1024 * 1024;
  var TEXT_EXT = /\.(txt|md|csv|tsv|json|py|r|rmd|m|sql|js|ts|java|c|cpp|h|cs|tex|bib|html|css|xml|yaml|yml|do|sas|ipynb)$/;
  var ACCEPT = 'image/*,video/*,.pdf,.docx,.xlsx,.xlsm,.pptx,.txt,.md,.csv,.tsv,.json,.py,.r,.rmd,.m,.sql,.js,.ts,.java,.c,.cpp,.h,.cs,.tex,.bib,.html,.css,.xml,.yaml,.yml,.do,.sas,.ipynb,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv';
  var MAX_TEXT = 58000;
  var trays = {};

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function kindOf(f) {
    var n = (f.name || '').toLowerCase(), t = f.type || '';
    if (/^image\//.test(t) || /\.(jpe?g|png|webp|gif|heic|heif)$/.test(n)) return 'photo';
    if (/^video\//.test(t) || /\.(mp4|mov|m4v|webm|3gp)$/.test(n)) return 'video';
    if (t === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
    if (/\.docx$/.test(n) || t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    if (/\.(xlsx|xlsm)$/.test(n) || t === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
    if (/\.pptx$/.test(n) || t === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
    if (/^text\//.test(t) || TEXT_EXT.test(n)) return 'text';
    if (/\.(doc|pages|odt|rtf)$/.test(n)) return 'olddoc';
    if (/\.(xls|numbers|ods)$/.test(n)) return 'oldsheet';
    if (/\.(ppt|key|odp)$/.test(n)) return 'oldslides';
    return '';
  }
  function b64(dataUrl) { return dataUrl.slice(dataUrl.indexOf(',') + 1); }
  function fileB64(f) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(b64(r.result)); }; r.onerror = function () { rej(new Error('read')); }; r.readAsDataURL(f); });
  }
  function draw(src, w, h, edge, q) {
    var s = Math.min(1, edge / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
    var full = c.toDataURL('image/jpeg', q);
    var t = document.createElement('canvas'), ts = 112 / Math.max(c.width, c.height); t.width = Math.round(c.width * ts); t.height = Math.round(c.height * ts);
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    return { data: b64(full), thumb: t.toDataURL('image/jpeg', 0.7) };
  }
  function loadImage(f) {
    if (window.createImageBitmap) {
      return createImageBitmap(f, { imageOrientation: 'from-image' }).then(function (bm) { return { el: bm, w: bm.width, h: bm.height }; })
        .catch(function () { return viaImg(f); });
    }
    return viaImg(f);
  }
  function viaImg(f) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () { res({ el: im, w: im.naturalWidth, h: im.naturalHeight, url: u }); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('photo')); };
      im.src = u;
    });
  }
  function prepPhoto(f) {
    return loadImage(f).then(function (o) {
      var r = draw(o.el, o.w, o.h, PHOTO_EDGE, 0.85);
      if (o.url) URL.revokeObjectURL(o.url); if (o.el.close) o.el.close();
      return { img: r.data, thumb: r.thumb };
    }).catch(function () { throw new Error('We couldn’t open “' + f.name + '”. Try a JPEG or PNG photo.'); });
  }
  function once(el, ev, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { el.removeEventListener(ev, h); rej(new Error('timeout')); }, ms);
      function h() { clearTimeout(t); el.removeEventListener(ev, h); res(); }
      el.addEventListener(ev, h);
    });
  }
  function clock(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function prepVideo(f) {
    var v = document.createElement('video'), u = URL.createObjectURL(f), frames = [];
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = u;
    var fail = function () { throw new Error('We couldn’t open the video “' + f.name + '”. Try an MP4 or a video from your camera roll.'); };
    return once(v, 'loadedmetadata', 20000).catch(fail).then(function () {
      if (isFinite(v.duration) && v.duration > 0) return;
      v.currentTime = 1e7; return once(v, 'durationchange', 8000).catch(function () {}); // some recordings report no length until sought
    }).then(function () {
      return v.play().then(function () { v.pause(); }, function () {}); // iOS only paints frames after a play
    }).then(function () {
      var d = isFinite(v.duration) && v.duration > 0 ? v.duration : 1, n = d < 4 ? 3 : d < 12 ? 5 : FRAMES, chain = Promise.resolve();
      for (var i = 0; i < n; i++) (function (i) {
        chain = chain.then(function () {
          var t = Math.min(d - 0.05, (i + 0.5) * d / n);
          v.currentTime = Math.max(0, t);
          return once(v, 'seeked', 12000).then(function () {
            if (!v.videoWidth) fail();
            var r = draw(v, v.videoWidth, v.videoHeight, FRAME_EDGE, 0.8);
            frames.push({ data: r.data, thumb: r.thumb, at: t });
          });
        });
      })(i);
      return chain.then(function () { return { frames: frames, duration: d }; });
    }).catch(function (e) { if (/couldn/.test(e.message)) throw e; fail(); })
      .then(function (r) { URL.revokeObjectURL(u); return r; }, function (e) { URL.revokeObjectURL(u); throw e; });
  }
  // Office files are zips: read the entries we need and inflate them in the browser.
  function zipRead(f, want) {
    return f.arrayBuffer().then(function (buf) {
      var dv = new DataView(buf), u8 = new Uint8Array(buf), eocd = -1, out = {}, jobs = [];
      for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      if (eocd < 0) throw new Error('zip');
      var n = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), dec = new TextDecoder();
      for (var k = 0; k < n; k++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
        var name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
        if (want(name)) (function (name, method, off, csize) {
          var start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), data = u8.subarray(start, start + csize);
          jobs.push((method === 0 ? Promise.resolve(dec.decode(data)) : new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text())
            .then(function (x) { out[name] = x; }));
        })(name, method, off, csize);
        p += 46 + nl + el + cl;
      }
      return Promise.all(jobs).then(function () { return out; });
    });
  }
  function unxml(x) { return x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (m, c) { return String.fromCharCode(+c); }).replace(/&amp;/g, '&'); }
  function num(a, b) { return (+(a.match(/(\d+)\.xml$/) || [0, 0])[1]) - (+(b.match(/(\d+)\.xml$/) || [0, 0])[1]); }
  function cap(t) { return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + '\n[… the rest of the file was cut to fit]' : t; }
  function docxText(f) {
    return zipRead(f, function (n) { return n === 'word/document.xml'; }).then(function (z) {
      var x = z['word/document.xml']; if (x == null) throw new Error('nodoc');
      return cap(unxml(x.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim());
    }).catch(function () { throw new Error('We couldn’t read “' + f.name + '”. Save it as a PDF and add that instead.'); });
  }
  // Excel: every sheet as rows of "A1: value" cells, with formulas kept (=SUM(B2:B9)), so the tutor can explain them.
  function xlsxText(f) {
    return zipRead(f, function (n) { return n === 'xl/sharedStrings.xml' || n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).then(function (z) {
      var shared = [];
      (z['xl/sharedStrings.xml'] || '').replace(/<si>([\s\S]*?)<\/si>/g, function (m, si) { var t = ''; si.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, function (m2, v) { t += v; }); shared.push(unxml(t)); });
      var rel = {}, names = [];
      (z['xl/_rels/workbook.xml.rels'] || '').replace(/<Relationship [^>]*>/g, function (r) { var id = (r.match(/Id="([^"]+)"/) || [])[1], tg = (r.match(/Target="([^"]+)"/) || [])[1]; if (id && tg) rel[id] = 'xl/' + tg.replace(/^\/?xl\//, ''); });
      (z['xl/workbook.xml'] || '').replace(/<sheet [^>]*>/g, function (s1) { var nm = (s1.match(/name="([^"]*)"/) || [])[1], id = (s1.match(/r:id="([^"]+)"/) || [])[1]; names.push({ name: unxml(nm || ''), path: rel[id] }); });
      var paths = Object.keys(z).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).sort(num);
      if (!names.length || names.some(function (s2) { return !z[s2.path]; })) names = paths.map(function (p, i) { return { name: 'Sheet ' + (i + 1), path: p }; });
      var out = [];
      names.forEach(function (sh) {
        var rows = [];
        z[sh.path].replace(/<row[^>]*>([\s\S]*?)<\/row>/g, function (m, row) {
          var cells = [];
          row.replace(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, function (m3, attrs, inner) {
            var ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1] || '', ty = (attrs.match(/t="([^"]+)"/) || [])[1] || '';
            inner = inner || '';
            var fm = (inner.match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1], v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1], is = (inner.match(/<is>([\s\S]*?)<\/is>/) || [])[1];
            var val = ty === 's' && v != null ? shared[+v] : is ? unxml(is.replace(/<[^>]+>/g, '')) : v != null ? unxml(v) : '';
            if (ty === 'b' && v != null) val = v === '1' ? 'TRUE' : 'FALSE';
            if (fm) val = (val !== '' ? val + ' ' : '') + '[=' + unxml(fm) + ']';
            if (val !== '') cells.push(ref + ': ' + val);
          });
          if (cells.length) rows.push(cells.join(' | '));
        });
        out.push('### Sheet "' + sh.name + '"' + (rows.length ? '' : ' (empty)') + '\n' + rows.join('\n'));
      });
      var t = out.join('\n\n').trim();
      if (!t) throw new Error('empty');
      return cap('Excel workbook. Each line is one row; cells are "cell: value", and [=…] shows the cell’s formula.\n\n' + t);
    }).catch(function () { throw new Error('We couldn’t read “' + f.name + '”. Try a screenshot of the sheet, or save it as .xlsx or CSV.'); });
  }
  function pptxText(f) {
    return zipRead(f, function (n) { return /^ppt\/slides\/slide\d+\.xml$/.test(n) || /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n); }).then(function (z) {
      var slides = Object.keys(z).filter(function (n) { return /^ppt\/slides\//.test(n); }).sort(num), out = [];
      slides.forEach(function (n, i) {
        var t = z[n].replace(/<\/a:p>/g, '\n').replace(/<a:br\/>/g, '\n').replace(/<(?!\/?a:t\b)[^>]+>/g, '').replace(/<\/?a:t[^>]*>/g, '');
        var note = z['ppt/notesSlides/notesSlide' + (i + 1) + '.xml'];
        note = note ? unxml(note.replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, '')).replace(/^\s*\d+\s*$/m, '').trim() : '';
        out.push('### Slide ' + (i + 1) + '\n' + unxml(t).replace(/\n{2,}/g, '\n').trim() + (note ? '\nSpeaker notes: ' + note : ''));
      });
      var s3 = out.join('\n\n').trim(); if (!s3) throw new Error('empty');
      return cap(s3);
    }).catch(function () { throw new Error('We couldn’t read “' + f.name + '”. Save it as a PDF and add that instead.'); });
  }

  function Tray(key) { this.key = key; this.items = []; this.err = ''; this.seq = 0; }
  Tray.prototype.count = function () { return this.items.length; };
  Tray.prototype.busy = function () { return this.items.some(function (x) { return x.state === 'busy'; }); };
  Tray.prototype.n = function (k) { return this.items.filter(function (x) { return x.kind === k || (k === 'doc' && (x.kind === 'pdf' || x.kind === 'text')); }).length; };
  Tray.prototype.summary = function () {
    var ph = this.n('photo'), vi = this.n('video'), parts = [];
    if (ph) parts.push(ph + ' photo' + (ph > 1 ? 's' : ''));
    if (vi) parts.push(vi + ' video' + (vi > 1 ? 's' : ''));
    this.items.forEach(function (x) { if (x.kind === 'pdf' || x.kind === 'text') parts.push(x.name); });
    return parts.join(', ');
  };
  Tray.prototype.payload = function () {
    var out = [], vids = 0, ph = 0;
    this.items.forEach(function (x) {
      if (x.state !== 'ready') return;
      if (x.kind === 'photo') out.push({ type: 'image', media_type: 'image/jpeg', data: x.img, label: 'Photo ' + (++ph) });
      else if (x.kind === 'video') { vids++; x.frames.forEach(function (fr, i) { out.push({ type: 'image', media_type: 'image/jpeg', data: fr.data, video: vids, label: 'Video ' + vids + ', still ' + (i + 1) + ' of ' + x.frames.length + ' (at ' + clock(fr.at) + ' of ' + clock(x.duration) + ')' }); }); }
      else if (x.kind === 'pdf') out.push({ type: 'pdf', name: x.name, data: x.data });
      else if (x.kind === 'text') out.push({ type: 'text', name: x.name, text: x.text });
    });
    return out;
  };
  Tray.prototype.clear = function () { this.items = []; this.err = ''; this.paint(); };
  Tray.prototype.html = function () { return '<div class="ua" data-ua="' + esc(this.key) + '">' + this.inner() + '</div>'; };
  Tray.prototype.inner = function () {
    var h = '<div class="ua-row"><label class="ua-add"><input type="file" multiple accept="' + ACCEPT + '" data-ua-in><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"/></svg><span>Add files, photos or videos</span></label><small class="ua-hint">or paste a screenshot</small></div>';
    if (this.items.length) h += '<ul class="ua-list">' + this.items.map(function (x) {
      var icon = x.thumb ? '<img src="' + x.thumb + '" alt="">' : '<span class="ua-doc">' + (x.kind === 'pdf' ? 'PDF' : x.sub === 'Spreadsheet' ? 'XLS' : x.sub === 'Slides' ? 'PPT' : 'DOC') + '</span>';
      var sub = x.state === 'busy' ? (x.kind === 'video' ? 'Preparing video…' : 'Preparing…') : x.kind === 'video' ? clock(x.duration) + ' video' : x.kind === 'photo' ? 'Photo' : x.kind === 'pdf' ? 'PDF' : x.sub || 'Document';
      return '<li class="ua-item' + (x.state === 'busy' ? ' busy' : '') + (x.kind === 'video' ? ' vid' : '') + '">' + icon + '<span class="ua-meta"><b>' + esc(x.name) + '</b><small>' + sub + '</small></span><button type="button" class="ua-x" data-ua-x="' + x.id + '" aria-label="Remove ' + esc(x.name) + '">×</button></li>';
    }).join('') + '</ul>';
    if (this.err) h += '<p class="ua-err" role="alert">' + esc(this.err) + '</p>';
    return h;
  };
  Tray.prototype.paint = function () {
    var el = document.querySelector('[data-ua="' + this.key + '"]');
    if (el) el.innerHTML = this.inner();
    if (this.onchange) this.onchange();
  };
  Tray.prototype.mount = function (onchange) {
    var self = this, el = document.querySelector('[data-ua="' + this.key + '"]');
    if (onchange) this.onchange = onchange;
    if (!el || el._ua) return; el._ua = true;
    el.addEventListener('change', function (e) { if (e.target.hasAttribute('data-ua-in')) { self.add(Array.prototype.slice.call(e.target.files || [])); e.target.value = ''; } });
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-ua-x]'); if (b) { self.remove(+b.getAttribute('data-ua-x')); } });
    // drop files onto the tray or the answer box next to it
    var zone = el.parentNode;
    zone.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); zone.classList.add('ua-over'); } });
    zone.addEventListener('dragleave', function (e) { if (!zone.contains(e.relatedTarget)) zone.classList.remove('ua-over'); });
    // paste a screenshot (or copied files) straight into the box
    zone.addEventListener('paste', function (e) {
      var cd = e.clipboardData; if (!cd) return;
      var files = Array.prototype.slice.call(cd.files || []);
      if (!files.length && cd.items) Array.prototype.forEach.call(cd.items, function (it) { if (it.kind === 'file') { var fl = it.getAsFile(); if (fl) files.push(fl); } });
      if (!files.length) return;
      e.preventDefault();
      var stamp = new Date().toTimeString().slice(0, 5);
      self.add(files.map(function (fl, i) {
        if (!/^image\//.test(fl.type) || (fl.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(fl.name))) return fl;
        try { return new File([fl], 'Screenshot ' + stamp + (files.length > 1 ? ' (' + (i + 1) + ')' : '') + '.png', { type: fl.type }); } catch (er) { return fl; }
      }));
    });
    zone.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); zone.classList.remove('ua-over'); self.add(Array.prototype.slice.call(e.dataTransfer.files)); } });
  };
  Tray.prototype.remove = function (id) { this.items = this.items.filter(function (x) { return x.id !== id; }); this.err = ''; this.paint(); };
  Tray.prototype.add = function (files) {
    var self = this; this.err = '';
    files.forEach(function (f) {
      var k = kindOf(f), slot = k === 'photo' ? 'photo' : k === 'video' ? 'video' : 'doc';
      if (!k) { self.err = '“' + f.name + '” isn’t a file type we can read. Use photos, screenshots, videos, PDF, Word, Excel, PowerPoint, CSV or text files.'; return; }
      if (k === 'olddoc') { self.err = 'Save “' + f.name + '” as a PDF or .docx and add that instead.'; return; }
      if (k === 'oldsheet') { self.err = 'Save “' + f.name + '” as .xlsx or CSV (or add a screenshot) and add that instead.'; return; }
      if (k === 'oldslides') { self.err = 'Save “' + f.name + '” as .pptx or PDF and add that instead.'; return; }
      if (self.n(slot) >= LIM[slot]) { self.err = slot === 'photo' ? 'You can add up to 10 photos.' : slot === 'video' ? 'You can add up to 2 videos.' : 'You can add up to 5 files.'; return; }
      if (k === 'pdf' && f.size > MAX_PDF) { self.err = '“' + f.name + '” is too large. Try a PDF under 15 MB, or photos of the pages you need.'; return; }
      if (k === 'video' && f.size > MAX_VIDEO) { self.err = '“' + f.name + '” is too large. Try a shorter video.'; return; }
      var it = { id: ++self.seq, kind: k === 'photo' || k === 'video' || k === 'pdf' ? k : 'text', sub: k === 'xlsx' ? 'Spreadsheet' : k === 'pptx' ? 'Slides' : '', name: f.name || (k === 'photo' ? 'Screenshot' : 'File'), state: 'busy' };
      self.items.push(it);
      var job = k === 'photo' ? prepPhoto(f).then(function (r) { it.img = r.img; it.thumb = r.thumb; })
        : k === 'video' ? prepVideo(f).then(function (r) { it.frames = r.frames; it.duration = r.duration; it.thumb = r.frames[0] && r.frames[0].thumb; })
        : k === 'pdf' ? fileB64(f).then(function (d) { it.data = d; })
        : k === 'docx' ? docxText(f).then(function (t) { if (!t.trim()) throw new Error('“' + f.name + '” looks empty.'); it.text = t; })
        : k === 'xlsx' ? xlsxText(f).then(function (t) { it.text = t; })
        : k === 'pptx' ? pptxText(f).then(function (t) { it.text = t; })
        : f.text().then(function (t) { if (!t.trim()) throw new Error('“' + f.name + '” looks empty.'); it.text = cap(t); });
      job.then(function () { it.state = 'ready'; self.paint(); }, function (e) {
        self.items = self.items.filter(function (x) { return x !== it; });
        self.err = e && e.message && e.message.length > 12 ? e.message : 'We couldn’t read “' + f.name + '”.'; self.paint();
      });
    });
    this.paint();
  };

  var css = '.ua{margin:10px 0 4px}.ua-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
    '.ua-add{position:relative;display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border:1.5px dashed rgba(23,48,42,.35);border-radius:999px;font:600 14px/1.2 Inter,system-ui,sans-serif;color:#17302A;cursor:pointer;background:rgba(255,255,255,.55);transition:background .15s,border-color .15s}' +
    '.ua-add:hover,.ua-add:focus-within{background:#fff;border-color:#3E6B5C}.ua-add input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}' +
    '.ua-add svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.ua-list{list-style:none;margin:10px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}' +
    '@media (max-width:560px){.ua-list{grid-template-columns:1fr 1fr;gap:6px}.ua-item{gap:7px;padding:5px 4px 5px 5px}.ua-item img,.ua-doc{width:36px;height:36px}.ua-meta b{font-size:12px}.ua-meta small{font-size:11px}.ua-x{width:24px;height:24px;font-size:18px}}' +
    '.ua-item{display:flex;align-items:center;gap:10px;padding:7px 8px 7px 7px;border:1px solid rgba(23,48,42,.15);border-radius:12px;background:#fff;min-width:0}' +
    '.ua-item img,.ua-doc{width:44px;height:44px;border-radius:8px;object-fit:cover;flex:none;background:#ECEDE6}.ua-item.vid img{outline:2px solid #3E6B5C;outline-offset:-2px}' +
    '.ua-doc{display:grid;place-items:center;font:700 11px/1 "JetBrains Mono",monospace;color:#8A5E1E;background:#F1DDA9}' +
    '.ua-meta{display:flex;flex-direction:column;min-width:0;flex:1}.ua-meta b{font:600 13px/1.3 Inter,system-ui,sans-serif;color:#17302A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ua-meta small{font:12px/1.3 Inter,system-ui,sans-serif;color:#5D6D67}' +
    '.ua-item.busy .ua-meta small:before{content:"";display:inline-block;width:9px;height:9px;margin-right:6px;border:2px solid #3E6B5C;border-right-color:transparent;border-radius:50%;animation:uaspin .8s linear infinite;vertical-align:-1px}@keyframes uaspin{to{transform:rotate(360deg)}}' +
    '.ua-x{flex:none;width:28px;height:28px;border-radius:50%;border:0;background:transparent;color:#5D6D67;font-size:20px;line-height:1;cursor:pointer}.ua-x:hover{background:#ECEDE6;color:#17302A}' +
    '.ua-hint{font:12.5px/1.3 Inter,system-ui,sans-serif;color:#5D6D67}' +
    '.ua-err{margin:8px 0 0;color:#B23A2E;font:500 13.5px/1.4 Inter,system-ui,sans-serif}.ua-over{outline:2px dashed #3E6B5C;outline-offset:4px;border-radius:12px}' +
    '.db-bubble .ua-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.db-bubble .ua-chip{font:600 12px/1 Inter,system-ui,sans-serif;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3)}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // readText: the text of a PowerPoint (one "### Slide N" block per slide) or Word file, for the module page's slide library
  function readText(f) { var n = (f.name || '').toLowerCase(); return /\.pptx$/.test(n) ? pptxText(f) : /\.docx$/.test(n) ? docxText(f) : Promise.reject(new Error('Add a PowerPoint or Word file.')); }
  window.UnizyAttach = { tray: function (key) { return trays[key] || (trays[key] = new Tray(key)); }, readText: readText };
})();
