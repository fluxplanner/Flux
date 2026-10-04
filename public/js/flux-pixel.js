/* ============================================================================
   FLUX PIXEL  ·  flux-pixel.js
   A drawing and diagram page: pen and highlighter, lines and arrows, boxes
   and circles, text, labels with leader lines, a library of lab, circuit,
   science, maths and geography stamps, and pictures. Everything is an object
   on an SVG page, so it can be picked up, moved, resized, recoloured and
   undone, and exported as a sharp PNG or SVG.

   ROUTES
     #/          your drawings
     #/d/<id>    the editor

   Drawings live in this browser (localStorage). Pictures are scaled down
   before they are stored so a page full of them still fits.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxPixel) return;

  var STORE = 'flux_pixel_docs_v1';
  var W = 1600, H = 1000;
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#111827', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#6b7280', '#ffffff'];
  var BGS = [['plain', 'Blank'], ['grid', 'Graph paper'], ['dots', 'Dot grid'], ['lines', 'Lined']];

  /* ── Little things ──────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function toast(text, kind) {
    var t = document.createElement('div');
    t.className = 'px-toast' + (kind ? ' px-toast--' + kind : '');
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 300); }, 2400);
  }
  function svgIcon(d, extra) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
  }
  var ICON = {
    select: svgIcon('<path d="M4 3l7 17 2.5-7.5L21 10z"/>'),
    pen: svgIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    hl: svgIcon('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
    eraser: svgIcon('<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 19"/><path d="M22 21H7M5 11l9 9"/>'),
    line: svgIcon('<path d="M5 19 19 5"/>'),
    arrow: svgIcon('<path d="M5 19 19 5M10 5h9v9"/>'),
    rect: svgIcon('<rect x="4" y="5" width="16" height="14" rx="1.5"/>'),
    ellipse: svgIcon('<ellipse cx="12" cy="12" rx="9" ry="7"/>'),
    text: svgIcon('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
    label: svgIcon('<circle cx="5" cy="18" r="2"/><path d="m6.5 16.5 6-6M13 10h8"/>'),
    stamp: svgIcon('<path d="M9 3h6v4l-3 2-3-2z"/><path d="M5 13h14v4H5zM7 21h10"/><path d="M12 9v4"/>'),
    image: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
    undo: svgIcon('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'),
    redo: svgIcon('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>'),
    trash: svgIcon('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
    copy: svgIcon('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    download: svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    back: svgIcon('<path d="m15 18-6-6 6-6"/>'),
    plus: svgIcon('<path d="M12 5v14M5 12h14"/>'),
    front: svgIcon('<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>'),
  };
  var TOOLS = [
    ['select', 'Select and move', 'V'], ['pen', 'Pen', 'P'], ['hl', 'Highlighter', 'H'], ['eraser', 'Eraser', 'E'],
    ['line', 'Line', 'L'], ['arrow', 'Arrow', 'A'], ['rect', 'Box', 'R'], ['ellipse', 'Circle', 'O'],
    ['text', 'Text', 'T'], ['label', 'Label with a line', 'B'], ['stamp', 'Stamps', 'S'], ['image', 'Picture', 'I'],
  ];

  /* ── Store ──────────────────────────────────────────────────────────── */

  function readStore() {
    try { var v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && Array.isArray(v.docs)) return v; } catch (e) {}
    return { v: 1, docs: [] };
  }
  function writeStore(st) {
    try { localStorage.setItem(STORE, JSON.stringify(st)); return true; }
    catch (e) { toast('This browser is out of space for drawings. Export and delete some old ones.', 'warn'); return false; }
  }
  function docs() { return readStore().docs; }
  function getDoc(id) { return docs().filter(function (d) { return d.id === id; })[0] || null; }
  function putDoc(doc) {
    var st = readStore();
    doc.updated = Date.now();
    var i = st.docs.findIndex(function (d) { return d.id === doc.id; });
    if (i >= 0) st.docs[i] = doc; else st.docs.unshift(doc);
    return writeStore(st);
  }
  function removeDoc(id) {
    var st = readStore();
    st.docs = st.docs.filter(function (d) { return d.id !== id; });
    writeStore(st);
  }
  function newDoc(opts) {
    opts = opts || {};
    return { id: uid(), title: opts.title || 'Untitled drawing', bg: opts.bg || 'plain', items: opts.items || [], created: Date.now(), updated: Date.now() };
  }

  /* ── Geometry ───────────────────────────────────────────────────────── */

  function stampById(id) {
    var out = null;
    (window.FluxPixelStamps || []).some(function (g) { return g.items.some(function (s) { if (s.id === id) { out = s; return true; } return false; }); });
    return out;
  }
  function textLines(t) { return String(t || '').split('\n'); }
  function textSize(it) {
    var lines = textLines(it.text);
    var longest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 1);
    return { w: Math.max(it.size * 0.6, longest * it.size * 0.56), h: lines.length * it.size * 1.25 };
  }
  function bbox(it) {
    var xs, ys, pad = (it.width || 0) / 2;
    switch (it.type) {
      case 'pen': case 'hl':
        xs = it.pts.map(function (p) { return p[0]; }); ys = it.pts.map(function (p) { return p[1]; });
        return { x: Math.min.apply(0, xs) - pad, y: Math.min.apply(0, ys) - pad, w: Math.max.apply(0, xs) - Math.min.apply(0, xs) + pad * 2, h: Math.max.apply(0, ys) - Math.min.apply(0, ys) + pad * 2 };
      case 'line': case 'arrow':
        return { x: Math.min(it.x1, it.x2) - pad, y: Math.min(it.y1, it.y2) - pad, w: Math.abs(it.x2 - it.x1) + pad * 2, h: Math.abs(it.y2 - it.y1) + pad * 2 };
      case 'text': {
        var s = textSize(it);
        return { x: it.x, y: it.y, w: s.w, h: s.h };
      }
      case 'label': {
        var t = textSize(it), left = it.x2 >= it.x1;
        var tx = left ? it.x2 + 8 : it.x2 - 8 - t.w, ty = it.y2 - t.h / 2;
        var x0 = Math.min(it.x1, tx), y0 = Math.min(it.y1, ty);
        return { x: x0 - 6, y: y0 - 6, w: Math.max(it.x1, tx + t.w) - x0 + 12, h: Math.max(it.y1, ty + t.h) - y0 + 12 };
      }
      default:
        return { x: it.x, y: it.y, w: it.w, h: it.h };
    }
  }
  function moveItem(it, dx, dy) {
    if (it.pts) it.pts = it.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; });
    ['x', 'x1', 'x2'].forEach(function (k) { if (k in it) it[k] += dx; });
    ['y', 'y1', 'y2'].forEach(function (k) { if (k in it) it[k] += dy; });
  }
  /** Scale about (ox, oy). Text keeps its shape: it scales by one factor. */
  function scaleItem(it, sx, sy, ox, oy) {
    var f = function (v, o, s) { return o + (v - o) * s; };
    if (it.type === 'text' || it.type === 'label') {
      var s = Math.max(0.2, (sx + sy) / 2);
      ['x', 'x1', 'x2'].forEach(function (k) { if (k in it) it[k] = f(it[k], ox, s); });
      ['y', 'y1', 'y2'].forEach(function (k) { if (k in it) it[k] = f(it[k], oy, s); });
      it.size = Math.max(8, it.size * s);
      return;
    }
    if (it.pts) it.pts = it.pts.map(function (p) { return [f(p[0], ox, sx), f(p[1], oy, sy)]; });
    ['x1', 'x2'].forEach(function (k) { if (k in it) it[k] = f(it[k], ox, sx); });
    ['y1', 'y2'].forEach(function (k) { if (k in it) it[k] = f(it[k], oy, sy); });
    if ('w' in it) { it.x = f(it.x, ox, sx); it.y = f(it.y, oy, sy); it.w = Math.max(4, it.w * sx); it.h = Math.max(4, it.h * sy); }
  }

  /* ── Drawing items as SVG ───────────────────────────────────────────── */

  /** A smooth path through the points: quadratic curves via the midpoints. */
  function smoothPath(pts) {
    if (!pts.length) return '';
    if (pts.length < 3) return 'M' + pts.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join(' L');
    var d = 'M' + r1(pts[0][0]) + ' ' + r1(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ' Q' + r1(pts[i][0]) + ' ' + r1(pts[i][1]) + ' ' + r1(mx) + ' ' + r1(my);
    }
    var last = pts[pts.length - 1];
    return d + ' L' + r1(last[0]) + ' ' + r1(last[1]);
  }
  function arrowHead(x1, y1, x2, y2, w) {
    var a = Math.atan2(y2 - y1, x2 - x1), len = 10 + w * 3, spread = 0.45;
    var p1 = [x2 - len * Math.cos(a - spread), y2 - len * Math.sin(a - spread)];
    var p2 = [x2 - len * Math.cos(a + spread), y2 - len * Math.sin(a + spread)];
    return r1(x2) + ',' + r1(y2) + ' ' + r1(p1[0]) + ',' + r1(p1[1]) + ' ' + r1(p2[0]) + ',' + r1(p2[1]);
  }
  function dashAttr(it) { return it.dash ? ' stroke-dasharray="' + (it.width * 3) + ' ' + (it.width * 2.5) + '"' : ''; }
  function textSVG(lines, x, y, size, color, anchor, bold) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" font-size="' + r1(size) + '" fill="' + color + '" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif"' + (bold ? ' font-weight="700"' : '') + (anchor === 'end' ? ' text-anchor="end"' : '') + '>'
      + lines.map(function (l, i) { return '<tspan x="' + r1(x) + '" dy="' + (i ? r1(size * 1.25) : r1(size * 0.92)) + '">' + (esc(l) || ' ') + '</tspan>'; }).join('') + '</text>';
  }
  /** One item. `hit` adds the invisible wide strokes the select tool clicks on. */
  function itemSVG(it, hit) {
    var c = it.color || '#111827', w = it.width || 3, out = '', fat = 'stroke="transparent" fill="none" stroke-width="' + (w + 16) + '" pointer-events="stroke" stroke-linecap="round"';
    switch (it.type) {
      case 'pen': case 'hl': {
        var d = smoothPath(it.pts);
        out = '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (it.type === 'hl' ? ' opacity=".38"' : '') + '/>';
        if (it.pts.length === 1) out = '<circle cx="' + r1(it.pts[0][0]) + '" cy="' + r1(it.pts[0][1]) + '" r="' + w / 2 + '" fill="' + c + '"' + (it.type === 'hl' ? ' opacity=".38"' : '') + '/>';
        if (hit) out += '<path d="' + d + '" ' + fat + '/>';
        break;
      }
      case 'line': case 'arrow': {
        out = '<line x1="' + r1(it.x1) + '" y1="' + r1(it.y1) + '" x2="' + r1(it.x2) + '" y2="' + r1(it.y2) + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"' + dashAttr(it) + '/>';
        if (it.type === 'arrow') out += '<polygon points="' + arrowHead(it.x1, it.y1, it.x2, it.y2, w) + '" fill="' + c + '" stroke="' + c + '" stroke-width="' + w / 2 + '" stroke-linejoin="round"/>';
        if (hit) out += '<line x1="' + r1(it.x1) + '" y1="' + r1(it.y1) + '" x2="' + r1(it.x2) + '" y2="' + r1(it.y2) + '" ' + fat + '/>';
        break;
      }
      case 'rect': case 'ellipse': {
        var fill = it.fill ? c : 'none';
        var shape = it.type === 'rect'
          ? '<rect x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" rx="' + Math.min(10, it.w / 8, it.h / 8) + '"'
          : '<ellipse cx="' + r1(it.x + it.w / 2) + '" cy="' + r1(it.y + it.h / 2) + '" rx="' + r1(it.w / 2) + '" ry="' + r1(it.h / 2) + '"';
        out = shape + ' fill="' + fill + '"' + (it.fill ? ' fill-opacity=".18"' : '') + ' stroke="' + c + '" stroke-width="' + w + '"' + dashAttr(it) + '/>';
        if (hit) out += shape + ' ' + fat.replace('fill="none"', it.fill ? 'fill="transparent"' : 'fill="none"').replace('pointer-events="stroke"', it.fill ? 'pointer-events="all"' : 'pointer-events="stroke"') + '/>';
        break;
      }
      case 'text': {
        out = textSVG(textLines(it.text), it.x, it.y, it.size, c, 'start', it.bold);
        if (hit) { var b = bbox(it); out += '<rect x="' + r1(b.x) + '" y="' + r1(b.y) + '" width="' + r1(b.w) + '" height="' + r1(b.h) + '" fill="transparent"/>'; }
        break;
      }
      case 'label': {
        var lines = textLines(it.text), sz = textSize(it), right = it.x2 >= it.x1;
        out = '<line x1="' + r1(it.x1) + '" y1="' + r1(it.y1) + '" x2="' + r1(it.x2) + '" y2="' + r1(it.y2) + '" stroke="' + c + '" stroke-width="' + Math.max(1.5, w * 0.7) + '" stroke-linecap="round"/>'
          + '<circle cx="' + r1(it.x1) + '" cy="' + r1(it.y1) + '" r="' + (3 + w * 0.6) + '" fill="' + c + '"/>'
          + textSVG(lines, right ? it.x2 + 8 : it.x2 - 8, it.y2 - sz.h / 2, it.size, c, right ? 'start' : 'end', it.bold);
        if (hit) { var lb = bbox(it); out += '<rect x="' + r1(lb.x) + '" y="' + r1(lb.y) + '" width="' + r1(lb.w) + '" height="' + r1(lb.h) + '" fill="transparent"/>'; }
        break;
      }
      case 'stamp': {
        var st = stampById(it.sid);
        var sw = (it.width || 3) * 100 / Math.max(20, Math.min(it.w, it.h));
        out = '<svg x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" viewBox="0 0 100 100" preserveAspectRatio="none" overflow="visible"><g fill="none" stroke="' + c + '" stroke-width="' + r1(sw) + '" stroke-linecap="round" stroke-linejoin="round">' + (st ? st.svg : '') + '</g></svg>';
        if (hit) out += '<rect x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" fill="transparent"/>';
        break;
      }
      case 'image':
        out = '<image href="' + esc(it.href) + '" x="' + r1(it.x) + '" y="' + r1(it.y) + '" width="' + r1(it.w) + '" height="' + r1(it.h) + '" preserveAspectRatio="none"/>';
        break;
    }
    return '<g data-id="' + esc(it.id) + '">' + out + '</g>';
  }
  function bgDefs(bg) {
    if (bg === 'grid') return '<pattern id="pxBg" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#c7d2fe" stroke-width="1"/><path d="M8 0V40M16 0V40M24 0V40M32 0V40M0 8H40M0 16H40M0 24H40M0 32H40" stroke="#e0e7ff" stroke-width=".6"/></pattern>';
    if (bg === 'dots') return '<pattern id="pxBg" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="1.6" fill="#a5b4fc"/></pattern>';
    if (bg === 'lines') return '<pattern id="pxBg" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 39.5H40" stroke="#bfdbfe" stroke-width="1"/></pattern>';
    return '';
  }
  /** The whole page as a standalone SVG, for export and thumbnails. */
  function docSVG(doc, opts) {
    opts = opts || {};
    var defs = bgDefs(doc.bg);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + (opts.size ? ' width="' + opts.size[0] + '" height="' + opts.size[1] + '"' : '') + '>'
      + (defs ? '<defs>' + defs + '</defs>' : '')
      + '<rect width="' + W + '" height="' + H + '" fill="#ffffff"/>'
      + (defs ? '<rect width="' + W + '" height="' + H + '" fill="url(#pxBg)"/>' : '')
      + doc.items.map(function (it) { return itemSVG(it, false); }).join('')
      + '</svg>';
  }

  /* ── Export ─────────────────────────────────────────────────────────── */

  function download(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function safeName(s) { return String(s || 'drawing').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'drawing'; }
  /** The page as a PNG blob, twice the page size for crisp printing. */
  function pngBlob(doc) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(new Blob([docSVG(doc, { size: [W, H] })], { type: 'image/svg+xml' }));
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = W * 2; cv.height = H * 2;
        var g = cv.getContext('2d');
        g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not make the picture')); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not make the picture')); };
      img.src = url;
    });
  }
  /** Pictures go in scaled to at most 1200px, as JPEG unless they need transparency. */
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, 1200 / Math.max(img.width, img.height));
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          var png = /png|gif|svg/.test(file.type);
          resolve({ href: cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), w: cv.width, h: cv.height });
        };
        img.onerror = reject;
        img.src = fr.result;
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  /* ── The example drawing ────────────────────────────────────────────── */

  function exampleDoc() {
    var c = '#111827';
    return newDoc({
      title: 'Example: heating water',
      bg: 'grid',
      items: [
        { id: uid(), type: 'text', x: 80, y: 60, text: 'Heating water with a Bunsen burner', size: 44, color: c, bold: true },
        { id: uid(), type: 'stamp', sid: 'flask', x: 640, y: 250, w: 260, h: 300, color: '#2563eb', width: 4 },
        { id: uid(), type: 'stamp', sid: 'burner', x: 680, y: 600, w: 180, h: 240, color: c, width: 4 },
        { id: uid(), type: 'label', x1: 770, y1: 470, x2: 1050, y2: 420, text: 'Water', size: 30, color: c, width: 3 },
        { id: uid(), type: 'label', x1: 770, y1: 640, x2: 1050, y2: 640, text: 'Flame', size: 30, color: '#ea580c', width: 3 },
        { id: uid(), type: 'label', x1: 715, y1: 285, x2: 420, y2: 230, text: 'Conical flask', size: 30, color: c, width: 3 },
        { id: uid(), type: 'arrow', x1: 1080, y1: 260, x2: 1080, y2: 140, color: '#dc2626', width: 5 },
        { id: uid(), type: 'text', x: 1110, y: 170, text: 'Steam rises', size: 28, color: '#dc2626' },
        { id: uid(), type: 'hl', pts: [[400, 905], [700, 905]], color: '#ca8a04', width: 26 },
        { id: uid(), type: 'text', x: 400, y: 880, text: 'Wear goggles!', size: 32, color: c, bold: true },
      ],
    });
  }

  /* ── The app ────────────────────────────────────────────────────────── */

  function mount(host) {
    var cleanup = null;

    function render() {
      if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
      var m = (location.hash || '').match(/^#\/d\/([^/]+)$/);
      if (m) {
        var d = getDoc(decodeURIComponent(m[1]));
        if (d) return editor(d);
        host.innerHTML = '<div class="px-empty"><h2>That drawing is not here</h2><p>It may have been deleted, or it was made on another device.</p><a class="px-btn px-btn--primary" href="#/">My drawings</a></div>';
        return;
      }
      gallery();
    }

    /* ── Gallery ─────────────────────────────────────────────────────── */

    function gallery() {
      var list = docs();
      host.innerHTML = '<section class="px-hero"><div><h1>Draw it, label it, export it</h1>'
        + '<p>Diagrams for science, maps for geography, sketches for anything. Stamps for lab equipment and circuits, labels with leader lines, and a crisp PNG for your notes or lab report. Free, no account, no ads.</p></div>'
        + '<div class="px-new"><span class="px-new-h">Start a new page</span><div class="px-new-row">'
        + BGS.map(function (b) {
          return '<button type="button" class="px-new-btn" data-new="' + b[0] + '"><span class="px-paper px-paper--' + b[0] + '"></span>' + esc(b[1]) + '</button>';
        }).join('') + '</div></div></section>'
        + (list.length ? '<h2 class="px-h2">Your drawings</h2><div class="px-grid">' + list.map(function (d) {
          return '<div class="px-card"><a class="px-thumb" href="#/d/' + encodeURIComponent(d.id) + '" aria-label="Open ' + esc(d.title) + '">' + docSVG(d) + '</a>'
            + '<div class="px-card-foot"><div><b>' + esc(d.title) + '</b><span>' + new Date(d.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.items.length + ' item' + (d.items.length === 1 ? '' : 's') + '</span></div>'
            + '<button type="button" class="px-icon" data-del="' + esc(d.id) + '" aria-label="Delete ' + esc(d.title) + '" title="Delete">' + ICON.trash + '</button></div></div>';
        }).join('') + '</div>' : '<div class="px-empty"><h2>No drawings yet</h2><p>Pick a page above to start, or open the example to see what Flux Pixel can do.</p></div>')
        + '<div class="px-foot"><button type="button" class="px-link" data-example>Open the example drawing</button></div>'
        + '<p class="px-note">Drawings are saved in this browser. Export a PNG or SVG to keep a copy anywhere.</p>';
      host.onclick = function (e) {
        var t = e.target.closest('[data-new],[data-del],[data-example]');
        if (!t) return;
        if (t.dataset.new) { var d = newDoc({ bg: t.dataset.new }); putDoc(d); location.hash = '#/d/' + encodeURIComponent(d.id); return; }
        if (t.hasAttribute('data-example')) { var ex = exampleDoc(); putDoc(ex); location.hash = '#/d/' + encodeURIComponent(ex.id); return; }
        if (t.dataset.del) {
          var doc = getDoc(t.dataset.del);
          if (doc && window.confirm('Delete “' + doc.title + '”? This cannot be undone.')) { removeDoc(doc.id); render(); }
        }
      };
      cleanup = function () { host.onclick = null; };
    }

    /* ── Editor ──────────────────────────────────────────────────────── */

    function editor(doc) {
      var st = {
        tool: 'pen', color: '#111827', width: 4, fill: false, dash: false,
        sel: null, zoom: 1, stamp: null, drag: null, draft: null,
        hist: [JSON.stringify(doc.items)], hi: 0,
      };
      var saveTimer = null;

      host.innerHTML = '<div class="px-editor">'
        + '<div class="px-top">'
        + '<a class="px-icon" href="#/" aria-label="All drawings" title="All drawings">' + ICON.back + '</a>'
        + '<input class="px-title" value="' + esc(doc.title) + '" aria-label="Drawing name" maxlength="80">'
        + '<span class="px-saved" aria-live="polite"></span><span class="px-grow"></span>'
        + '<button type="button" class="px-icon" data-act="undo" aria-label="Undo" title="Undo (Ctrl+Z)">' + ICON.undo + '</button>'
        + '<button type="button" class="px-icon" data-act="redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">' + ICON.redo + '</button>'
        + '<span class="px-zoom"><button type="button" class="px-icon" data-act="zoomout" aria-label="Zoom out">−</button><button type="button" class="px-zoom-v" data-act="zoomfit" title="Fit to screen">100%</button><button type="button" class="px-icon" data-act="zoomin" aria-label="Zoom in">+</button></span>'
        + '<button type="button" class="px-btn px-btn--small" data-act="copy">' + ICON.copy + '<span>Copy</span></button>'
        + '<button type="button" class="px-btn px-btn--small px-btn--primary" data-act="png">' + ICON.download + '<span>PNG</span></button>'
        + '<button type="button" class="px-btn px-btn--small" data-act="svg"><span>SVG</span></button>'
        + '</div>'
        + '<div class="px-body">'
        + '<div class="px-tools" role="toolbar" aria-label="Tools">' + TOOLS.map(function (t) {
          return '<button type="button" class="px-tool" data-tool="' + t[0] + '" aria-label="' + esc(t[1]) + '" title="' + esc(t[1]) + ' (' + t[2] + ')">' + ICON[t[0]] + '</button>';
        }).join('') + '</div>'
        + '<div class="px-stage" id="pxStage"><div class="px-wrap" id="pxWrap">'
        + '<svg class="px-svg" id="pxSvg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="' + NS + '"><defs id="pxDefs"></defs>'
        + '<rect width="' + W + '" height="' + H + '" fill="#fff"/><rect id="pxBgRect" width="' + W + '" height="' + H + '" fill="none"/>'
        + '<g id="pxItems"></g><g id="pxDraft"></g><g id="pxSel"></g></svg>'
        + '<textarea class="px-textin" id="pxText" hidden rows="1" aria-label="Text"></textarea></div></div>'
        + '<div class="px-props" id="pxProps"></div>'
        + '</div>'
        + '<input type="file" accept="image/*" id="pxFile" hidden>'
        + '</div>';

      var svg = $('#pxSvg', host), itemsG = $('#pxItems', host), draftG = $('#pxDraft', host), selG = $('#pxSel', host);
      var wrap = $('#pxWrap', host), stage = $('#pxStage', host), props = $('#pxProps', host), textIn = $('#pxText', host);

      /* Rendering */
      function drawBg() {
        $('#pxDefs', host).innerHTML = bgDefs(doc.bg);
        $('#pxBgRect', host).setAttribute('fill', doc.bg === 'plain' ? 'none' : 'url(#pxBg)');
      }
      function drawItems() { itemsG.innerHTML = doc.items.map(function (it) { return itemSVG(it, true); }).join(''); drawSel(); }
      function selected() { return st.sel ? doc.items.filter(function (i) { return i.id === st.sel; })[0] || null : null; }
      function drawSel() {
        var it = selected();
        if (!it) { selG.innerHTML = ''; return; }
        var b = bbox(it), p = 8;
        selG.innerHTML = '<rect x="' + (b.x - p) + '" y="' + (b.y - p) + '" width="' + (b.w + p * 2) + '" height="' + (b.h + p * 2) + '" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="6 5" pointer-events="none"/>'
          + '<rect data-handle="1" x="' + (b.x + b.w + p - 9) + '" y="' + (b.y + b.h + p - 9) + '" width="18" height="18" rx="4" fill="#fff" stroke="#2563eb" stroke-width="2.5" style="cursor:nwse-resize"/>';
      }
      function drawProps() {
        var it = selected();
        var color = it ? (it.color || st.color) : st.color;
        var width = it ? (it.width || st.width) : st.width;
        var showFill = it ? (it.type === 'rect' || it.type === 'ellipse') : (st.tool === 'rect' || st.tool === 'ellipse');
        var showDash = it ? /^(line|arrow|rect|ellipse)$/.test(it.type) : /^(line|arrow|rect|ellipse)$/.test(st.tool);
        var html = '<div class="px-sec"><span class="px-sec-h">Colour</span><div class="px-colors">' + COLORS.map(function (c) {
          return '<button type="button" class="px-color' + (c === color ? ' is-on' : '') + '" data-color="' + c + '" style="--c:' + c + '" aria-label="Colour ' + c + '"></button>';
        }).join('') + '<label class="px-color px-color--pick" title="Any colour"><input type="color" value="' + color + '" data-pick aria-label="Pick any colour"></label></div></div>';
        if (!it || it.type !== 'image') {
          html += '<div class="px-sec"><span class="px-sec-h">' + (it && (it.type === 'text' || it.type === 'label') ? 'Text size' : 'Thickness') + '</span>'
            + (it && (it.type === 'text' || it.type === 'label')
              ? '<input type="range" min="12" max="120" value="' + Math.round(it.size) + '" data-size aria-label="Text size">'
              : '<input type="range" min="1" max="' + (st.tool === 'hl' || (it && it.type === 'hl') ? 60 : 24) + '" value="' + width + '" data-width aria-label="Thickness">') + '</div>';
        }
        if (showFill || showDash) {
          html += '<div class="px-sec px-toggles">'
            + (showFill ? '<button type="button" class="px-chip' + ((it ? it.fill : st.fill) ? ' is-on' : '') + '" data-toggle="fill">Filled</button>' : '')
            + (showDash ? '<button type="button" class="px-chip' + ((it ? it.dash : st.dash) ? ' is-on' : '') + '" data-toggle="dash">Dashed</button>' : '')
            + '</div>';
        }
        if (it && (it.type === 'text' || it.type === 'label')) html += '<div class="px-sec px-toggles"><button type="button" class="px-chip' + (it.bold ? ' is-on' : '') + '" data-toggle="bold">Bold</button><button type="button" class="px-chip" data-act="edittext">Edit text</button></div>';
        if (st.tool === 'stamp') {
          html += '<div class="px-sec px-stamps"><span class="px-sec-h">Stamps — pick one, then tap the page</span>' + (window.FluxPixelStamps || []).map(function (g) {
            return '<div class="px-stamp-g"><b>' + esc(g.group) + '</b><div class="px-stamp-row">' + g.items.map(function (s) {
              return '<button type="button" class="px-stamp' + (st.stamp === s.id ? ' is-on' : '') + '" data-stamp="' + s.id + '" title="' + esc(s.name) + '" aria-label="' + esc(s.name) + '"><svg viewBox="-6 -6 112 112"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' + s.svg + '</g></svg></button>';
            }).join('') + '</div></div>';
          }).join('') + '</div>';
        }
        if (it) {
          html += '<div class="px-sec px-sel-acts"><span class="px-sec-h">Selected</span><div class="px-row">'
            + '<button type="button" class="px-btn px-btn--small" data-act="dup">' + ICON.copy + 'Duplicate</button>'
            + '<button type="button" class="px-btn px-btn--small" data-act="front">' + ICON.front + 'To front</button>'
            + '<button type="button" class="px-btn px-btn--small px-btn--danger" data-act="delete">' + ICON.trash + 'Delete</button></div></div>';
        }
        html += '<div class="px-sec"><span class="px-sec-h">Paper</span><div class="px-row">' + BGS.map(function (b) {
          return '<button type="button" class="px-chip' + (doc.bg === b[0] ? ' is-on' : '') + '" data-bg="' + b[0] + '">' + esc(b[1]) + '</button>';
        }).join('') + '</div></div>'
          + '<div class="px-sec"><button type="button" class="px-link px-danger" data-act="clear">Clear the page</button></div>'
          + '<p class="px-keys">V select · P pen · H highlight · E erase · L line · A arrow · R box · O circle · T text · B label · S stamps · Del delete · Ctrl+Z undo</p>';
        props.innerHTML = html;
      }
      function drawTools() { $$('[data-tool]', host).forEach(function (b) { b.classList.toggle('is-on', b.dataset.tool === st.tool); b.setAttribute('aria-pressed', b.dataset.tool === st.tool); }); }
      function applyZoom() {
        wrap.style.width = Math.round(st.zoom * 100) + '%';
        $('.px-zoom-v', host).textContent = Math.round(st.zoom * 100) + '%';
      }

      /* Saving and history */
      function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          if (putDoc(doc)) { var s = $('.px-saved', host); if (s) { s.textContent = 'Saved'; clearTimeout(s._t); s._t = setTimeout(function () { s.textContent = ''; }, 1200); } }
        }, 350);
      }
      function commit() {
        var snap = JSON.stringify(doc.items);
        if (snap === st.hist[st.hi]) return;
        st.hist = st.hist.slice(0, st.hi + 1);
        st.hist.push(snap);
        if (st.hist.length > 80) st.hist.shift();
        st.hi = st.hist.length - 1;
        save();
      }
      function undo() { if (st.hi <= 0) return; st.hi--; doc.items = JSON.parse(st.hist[st.hi]); st.sel = null; drawItems(); drawProps(); save(); }
      function redo() { if (st.hi >= st.hist.length - 1) return; st.hi++; doc.items = JSON.parse(st.hist[st.hi]); st.sel = null; drawItems(); drawProps(); save(); }

      /* Coordinates */
      function toPage(e) {
        var pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        var p = pt.matrixTransform(svg.getScreenCTM().inverse());
        return [Math.max(0, Math.min(W, p.x)), Math.max(0, Math.min(H, p.y))];
      }
      function pageScale() { var r = svg.getBoundingClientRect(); return r.width / W; }

      /* Tools */
      function setTool(t) {
        if (t === 'image') { $('#pxFile', host).click(); return; }
        st.tool = t;
        if (t !== 'select') st.sel = null;
        if (t === 'stamp' && !st.stamp) st.stamp = 'beaker';
        svg.setAttribute('data-mode', t);
        drawTools(); drawSel(); drawProps();
      }
      function addItem(it) { it.id = uid(); doc.items.push(it); drawItems(); commit(); return it; }

      /* Text entry, for text and labels */
      var editing = null;
      function openText(at, existing, onDone) {
        var s = pageScale();
        var size = existing ? existing.size : 32;
        var wr = wrap.getBoundingClientRect(), sr = svg.getBoundingClientRect();
        textIn.hidden = false;
        textIn.value = existing ? existing.text : '';
        textIn.style.left = (sr.left - wr.left + at[0] * s) + 'px';
        textIn.style.top = (sr.top - wr.top + at[1] * s) + 'px';
        textIn.style.fontSize = Math.max(12, size * s) + 'px';
        textIn.style.color = existing ? existing.color : st.color;
        editing = { onDone: onDone };
        setTimeout(function () { textIn.focus(); autosize(); }, 0);
      }
      function autosize() { textIn.style.height = 'auto'; textIn.style.height = textIn.scrollHeight + 'px'; textIn.style.width = 'auto'; textIn.style.width = Math.max(140, textIn.scrollWidth + 20) + 'px'; }
      function closeText(keep) {
        if (!editing) return;
        var ed = editing; editing = null;
        var v = textIn.value.replace(/\s+$/, '');
        textIn.hidden = true;
        ed.onDone(keep ? v : null);
      }
      textIn.addEventListener('input', autosize);
      textIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeText(true); }
        else if (e.key === 'Escape') { e.preventDefault(); closeText(false); }
        e.stopPropagation();
      });
      textIn.addEventListener('blur', function () { closeText(true); });

      function editTextOf(it) {
        var at = it.type === 'label' ? [it.x2 + (it.x2 >= it.x1 ? 8 : -160), it.y2 - it.size * 0.6] : [it.x, it.y];
        var before = it.text;
        it.text = '';
        drawItems();
        openText(at, { size: it.size, color: it.color, text: before }, function (v) {
          if (v == null) it.text = before;
          else if (!v) { doc.items = doc.items.filter(function (x) { return x !== it; }); st.sel = null; }
          else it.text = v;
          drawItems(); drawProps(); commit();
        });
      }

      /* Pointer */
      function eraseAt(e) {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        var g = el && el.closest && el.closest('#pxItems [data-id]');
        if (!g) return;
        var id = g.getAttribute('data-id');
        doc.items = doc.items.filter(function (i) { return i.id !== id; });
        drawItems();
      }
      svg.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        if (editing) { closeText(true); return; }
        var p = toPage(e);
        try { svg.setPointerCapture(e.pointerId); } catch (er) {}
        var t = st.tool;
        if (t === 'select') {
          if (e.target.getAttribute('data-handle')) {
            var it0 = selected(); var b0 = bbox(it0);
            st.drag = { mode: 'resize', start: p, box: b0, orig: JSON.parse(JSON.stringify(it0)) };
            return;
          }
          var g = e.target.closest('#pxItems [data-id]');
          st.sel = g ? g.getAttribute('data-id') : null;
          drawSel(); drawProps();
          if (st.sel) st.drag = { mode: 'move', last: p, moved: false };
          return;
        }
        if (t === 'eraser') { st.drag = { mode: 'erase' }; eraseAt(e); return; }
        if (t === 'text') {
          var hitText = e.target.closest('#pxItems [data-id]');
          var hitItem = hitText && doc.items.filter(function (i) { return i.id === hitText.getAttribute('data-id'); })[0];
          if (hitItem && (hitItem.type === 'text' || hitItem.type === 'label')) { editTextOf(hitItem); return; }
          var color = st.color;
          openText(p, null, function (v) { if (v) { var it = addItem({ type: 'text', x: p[0], y: p[1], text: v, size: 32, color: color }); st.sel = it.id; drawSel(); } });
          return;
        }
        if (t === 'stamp') {
          var size = 160;
          var it2 = addItem({ type: 'stamp', sid: st.stamp || 'beaker', x: p[0] - size / 2, y: p[1] - size / 2, w: size, h: size, color: st.color, width: Math.max(2, st.width) });
          st.sel = it2.id; drawSel();
          return;
        }
        var base = { color: st.color, width: st.width };
        if (t === 'pen' || t === 'hl') st.draft = Object.assign(base, { type: t, pts: [p], width: t === 'hl' ? Math.max(st.width * 4, 18) : st.width });
        else if (t === 'line' || t === 'arrow' || t === 'label') st.draft = Object.assign(base, { type: t === 'label' ? 'line' : t, x1: p[0], y1: p[1], x2: p[0], y2: p[1], dash: t === 'label' ? false : st.dash, _label: t === 'label' });
        else if (t === 'rect' || t === 'ellipse') st.draft = Object.assign(base, { type: t, x: p[0], y: p[1], w: 0, h: 0, fill: st.fill, dash: st.dash, _ox: p[0], _oy: p[1] });
        st.drag = { mode: 'draw' };
        drawDraft();
      });
      svg.addEventListener('pointermove', function (e) {
        if (!st.drag) return;
        var p = toPage(e);
        if (st.drag.mode === 'erase') { eraseAt(e); return; }
        if (st.drag.mode === 'move') {
          var it = selected(); if (!it) return;
          moveItem(it, p[0] - st.drag.last[0], p[1] - st.drag.last[1]);
          st.drag.last = p; st.drag.moved = true;
          drawItems();
          return;
        }
        if (st.drag.mode === 'resize') {
          var b = st.drag.box, it2 = selected();
          var sx = Math.max(0.05, (b.w + p[0] - st.drag.start[0]) / Math.max(1, b.w));
          var sy = Math.max(0.05, (b.h + p[1] - st.drag.start[1]) / Math.max(1, b.h));
          if (e.shiftKey || it2.type === 'stamp' || it2.type === 'image') { var s = Math.max(sx, sy); sx = sy = s; }
          var fresh = JSON.parse(JSON.stringify(st.drag.orig));
          scaleItem(fresh, sx, sy, b.x, b.y);
          Object.assign(it2, fresh);
          drawItems();
          return;
        }
        var d = st.draft; if (!d) return;
        if (d.pts) {
          var last = d.pts[d.pts.length - 1];
          if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.5) d.pts.push(p);
        } else if ('x1' in d) {
          var x2 = p[0], y2 = p[1];
          if (e.shiftKey) {
            var ang = Math.round(Math.atan2(y2 - d.y1, x2 - d.x1) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(x2 - d.x1, y2 - d.y1);
            x2 = d.x1 + len * Math.cos(ang); y2 = d.y1 + len * Math.sin(ang);
          }
          d.x2 = x2; d.y2 = y2;
        } else {
          var w = p[0] - d._ox, h = p[1] - d._oy;
          if (e.shiftKey) { var m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
          d.x = Math.min(d._ox, d._ox + w); d.y = Math.min(d._oy, d._oy + h); d.w = Math.abs(w); d.h = Math.abs(h);
        }
        drawDraft();
      });
      function endPointer() {
        var drag = st.drag; st.drag = null;
        if (!drag) return;
        if (drag.mode === 'erase' || (drag.mode === 'move' && drag.moved) || drag.mode === 'resize') { commit(); drawProps(); return; }
        if (drag.mode !== 'draw') return;
        var d = st.draft; st.draft = null; draftG.innerHTML = '';
        if (!d) return;
        if (d._label) {
          var len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
          if (len < 12) { d.x2 = d.x1 + 120; d.y2 = d.y1 - 40; }
          var lab = { type: 'label', x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, text: '', size: 30, color: d.color, width: Math.min(6, d.width) };
          draftG.innerHTML = itemSVG(Object.assign({ id: 'draft' }, lab, { text: ' ' }), false);
          var right = lab.x2 >= lab.x1;
          openText([right ? lab.x2 + 8 : lab.x2 - 168, lab.y2 - 18], { size: 30, color: lab.color, text: '' }, function (v) {
            draftG.innerHTML = '';
            if (v) { lab.text = v; var it = addItem(lab); st.sel = null; drawSel(); }
          });
          return;
        }
        if (d.pts && d.pts.length) { addItem(clean(d)); return; }
        if ('x1' in d && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 4) { addItem(clean(d)); return; }
        if ('w' in d && d.w > 4 && d.h > 4) { addItem(clean(d)); }
      }
      function clean(d) { var o = {}; Object.keys(d).forEach(function (k) { if (k[0] !== '_') o[k] = d[k]; }); return o; }
      svg.addEventListener('pointerup', endPointer);
      svg.addEventListener('pointercancel', endPointer);
      svg.addEventListener('dblclick', function (e) {
        var g = e.target.closest('#pxItems [data-id]');
        var it = g && doc.items.filter(function (i) { return i.id === g.getAttribute('data-id'); })[0];
        if (it && (it.type === 'text' || it.type === 'label')) { st.sel = it.id; editTextOf(it); }
      });
      function drawDraft() { draftG.innerHTML = st.draft ? itemSVG(Object.assign({ id: 'draft' }, st.draft, { type: st.draft.type }), false) : ''; }

      /* Pictures */
      $('#pxFile', host).addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (f) placeImage(f);
      });
      function placeImage(file) {
        readImage(file).then(function (im) {
          var s = Math.min(1, (W * 0.6) / im.w, (H * 0.6) / im.h);
          var w = im.w * s, h = im.h * s;
          var it = addItem({ type: 'image', href: im.href, x: (W - w) / 2, y: (H - h) / 2, w: w, h: h });
          st.tool = 'select'; st.sel = it.id; svg.setAttribute('data-mode', 'select');
          drawTools(); drawSel(); drawProps();
        }).catch(function () { toast('That picture could not be opened', 'warn'); });
      }
      function onPaste(e) {
        if (editing) return;
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') === 0) { e.preventDefault(); placeImage(items[i].getAsFile()); return; }
        }
      }
      stage.addEventListener('dragover', function (e) { e.preventDefault(); });
      stage.addEventListener('drop', function (e) {
        e.preventDefault();
        var f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f && f.type.indexOf('image') === 0) placeImage(f);
      });

      /* Buttons */
      host.onclick = function (e) {
        var t = e.target.closest('[data-tool],[data-act],[data-color],[data-toggle],[data-bg],[data-stamp]');
        if (!t) return;
        var it = selected();
        if (t.dataset.tool) return setTool(t.dataset.tool);
        if (t.dataset.stamp) { st.stamp = t.dataset.stamp; drawProps(); return; }
        if (t.dataset.color) {
          if (it) { it.color = t.dataset.color; drawItems(); commit(); } else st.color = t.dataset.color;
          drawProps(); return;
        }
        if (t.dataset.toggle) {
          var k = t.dataset.toggle;
          if (it) { it[k] = !it[k]; drawItems(); commit(); } else st[k] = !st[k];
          drawProps(); return;
        }
        if (t.dataset.bg) { doc.bg = t.dataset.bg; drawBg(); drawProps(); save(); return; }
        var a = t.dataset.act;
        if (a === 'undo') undo();
        else if (a === 'redo') redo();
        else if (a === 'zoomin') { st.zoom = Math.min(4, st.zoom + 0.25); applyZoom(); }
        else if (a === 'zoomout') { st.zoom = Math.max(0.5, st.zoom - 0.25); applyZoom(); }
        else if (a === 'zoomfit') { st.zoom = 1; applyZoom(); }
        else if (a === 'delete' && it) { doc.items = doc.items.filter(function (x) { return x !== it; }); st.sel = null; drawItems(); drawProps(); commit(); }
        else if (a === 'dup' && it) { var copy = JSON.parse(JSON.stringify(it)); moveItem(copy, 30, 30); var n = addItem(copy); st.sel = n.id; drawSel(); drawProps(); }
        else if (a === 'front' && it) { doc.items = doc.items.filter(function (x) { return x !== it; }).concat([it]); drawItems(); commit(); }
        else if (a === 'edittext' && it) editTextOf(it);
        else if (a === 'clear') { if (doc.items.length && window.confirm('Clear everything on this page? You can undo it.')) { doc.items = []; st.sel = null; drawItems(); drawProps(); commit(); } }
        else if (a === 'png') pngBlob(doc).then(function (b) { download(safeName(doc.title) + '.png', b); }).catch(function (er) { toast(er.message, 'warn'); });
        else if (a === 'svg') download(safeName(doc.title) + '.svg', new Blob([docSVG(doc)], { type: 'image/svg+xml' }));
        else if (a === 'copy') {
          if (!navigator.clipboard || typeof ClipboardItem === 'undefined') { toast('This browser cannot copy pictures — use PNG instead', 'warn'); return; }
          navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob(doc) })])
            .then(function () { toast('Copied — paste it into your notes, a doc or a slide'); }, function () { toast('Could not copy — use PNG instead', 'warn'); });
        }
      };
      host.oninput = function (e) {
        var it = selected();
        if (e.target.matches('.px-title')) { doc.title = e.target.value.trim() || 'Untitled drawing'; save(); return; }
        if (e.target.matches('[data-width]')) { var v = +e.target.value; if (it) { it.width = v; drawItems(); } else st.width = v; return; }
        if (e.target.matches('[data-size]')) { if (it) { it.size = +e.target.value; drawItems(); } return; }
        if (e.target.matches('[data-pick]')) { var c = e.target.value; if (it) { it.color = c; drawItems(); } else st.color = c; }
      };
      host.onchange = function (e) {
        if (e.target.matches('[data-width],[data-size],[data-pick]')) { if (selected()) commit(); drawProps(); }
      };

      /* Keys */
      var KEYS = {}; TOOLS.forEach(function (t) { KEYS[t[2].toLowerCase()] = t[0]; });
      function onKey(e) {
        if (editing || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
        var mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
        if (mod && e.key.toLowerCase() === 'd' && selected()) { e.preventDefault(); host.querySelector('[data-act="dup"]').click(); return; }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected()) { e.preventDefault(); host.querySelector('[data-act="delete"]').click(); return; }
        if (e.key === 'Escape') { st.sel = null; drawSel(); drawProps(); return; }
        if (mod || e.altKey) return;
        var tool = KEYS[e.key.toLowerCase()];
        if (tool) { e.preventDefault(); setTool(tool); }
      }
      document.addEventListener('keydown', onKey);
      document.addEventListener('paste', onPaste);

      drawBg(); drawItems(); setTool(doc.items.length ? 'select' : 'pen'); applyZoom();
      cleanup = function () {
        if (editing) closeText(true);
        clearTimeout(saveTimer); putDoc(doc);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('paste', onPaste);
        host.onclick = host.oninput = host.onchange = null;
      };
    }

    window.addEventListener('hashchange', render);
    render();
    return { render: render };
  }

  window.FluxPixel = {
    mount: mount,
    _bbox: bbox, _scaleItem: scaleItem, _moveItem: moveItem, _smoothPath: smoothPath, _docSVG: docSVG,
  };
})();
