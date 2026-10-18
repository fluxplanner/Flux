/* ============================================================================
   FLUX PIXEL · MATHS FIGURES  ·  flux-pixel-figures.js
   The "Maths figures" panel: pick a figure, fill in a short form, watch the
   preview, and Insert it on the page (or Update the one being edited).
   Copy figure, PNG, SVG and a share link work from the panel too.

   The figures themselves come from flux-figures.js (window.FluxFigures).
   This file is only the form: a native <dialog>, so focus stays inside it,
   Escape closes it, and screen readers hear it as a dialog. Every field has
   a real <label>; problems are said in words in a live region and the field
   is marked aria-invalid.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxPixelFigures) return;
  var F = window.FluxFigures;
  var LAST = 'flux_pixel_fig_last';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(text, kind) {
    var t = document.createElement('div');
    t.className = 'px-toast' + (kind ? ' px-toast--' + kind : '');
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 300); }, 2400);
  }

  /* ── The forms ─────────────────────────────────────────────────────── */

  var UNITS = [['', 'No units'], ['mm', 'mm'], ['cm', 'cm'], ['m', 'm'], ['km', 'km'], ['in', 'in'], ['ft', 'ft'], ['yd', 'yd']];
  var DPS = [['0', 'Whole numbers'], ['1', '1 decimal place'], ['2', '2 decimal places'], ['3', '3 decimal places']];
  function H(l) { return { t: 'head', l: l }; }
  function N(k, l, show, extra) { return Object.assign({ k: k, t: 'num', l: l, show: show }, extra || {}); }
  function T(k, l, show) { return { k: k, t: 'text', l: l, show: show }; }
  function C(k, l, show) { return { k: k, t: 'chk', l: l, show: show }; }
  function S(k, l, opts, show) { return { k: k, t: 'sel', l: l, opts: opts, show: show }; }
  function LETTERS(keys, show) { return { t: 'row', l: 'Letters', keys: keys, show: show || function (s) { return s.names; } }; }
  function is() { var ks = arguments; return function (s) { for (var i = 0; i < ks.length; i++) if (s[ks[i][0]] === ks[i][1]) return true; return false; }; }
  function method() { var ms = Array.prototype.slice.call(arguments); return function (s) { return ms.indexOf(s.method) >= 0; }; }
  var NOTE = { t: 'note', l: 'Type a label to use instead of the number (x, x + 2, ?), or a dash (-) to leave that one blank. _ and ^ make small text: F_1, cm^2.' };
  var UNIT_ROWS = [S('u', 'Units', UNITS), S('dp', 'Round worked-out values to', DPS)];
  var TURN = [H('Position'), N('rot', 'Turn it (degrees, anticlockwise)')];
  var GIVEN = C('giv', 'Show the measurements you typed');
  var WORKED = C('calc', 'Show worked-out measurements');

  var FORMS = {
    grid: [
      { t: 'preset', l: 'Start from', opts: [
        ['', 'Choose…'],
        ['four', 'Four quadrants, −10 to 10', { xmin: -10, xmax: 10, ymin: -10, ymax: 10, xstep: 1, ystep: 1, axes: true, nums: true, lines: true }],
        ['small', 'Four quadrants, −5 to 5', { xmin: -5, xmax: 5, ymin: -5, ymax: 5, xstep: 1, ystep: 1, axes: true, nums: true, lines: true }],
        ['first', 'First quadrant, 0 to 10', { xmin: 0, xmax: 10, ymin: 0, ymax: 10, xstep: 1, ystep: 1, axes: true, nums: true, lines: true }],
        ['paper', 'Blank graph paper', { xmin: 0, xmax: 20, ymin: 0, ymax: 14, xstep: 1, ystep: 1, axes: false, nums: false, lines: true, eqs: '', pts: '', title: '' }],
      ] },
      H('Range'),
      N('xmin', 'Smallest x'), N('xmax', 'Largest x'), N('ymin', 'Smallest y'), N('ymax', 'Largest y'),
      N('xstep', 'Grid step across'), N('ystep', 'Grid step up'),
      H('Axes'),
      C('axes', 'Axes'), C('arrows', 'Arrows on the axes', is(['axes', true])), C('nums', 'Numbers'), C('lines', 'Grid lines'),
      N('every', 'Numbers on every … line (0 picks for you)', is(['nums', true])),
      T('xname', 'Name of the x axis', is(['axes', true])), T('yname', 'Name of the y axis', is(['axes', true])), T('title', 'Title (optional)'),
      H('Graphs and points'),
      { k: 'eqs', t: 'area', l: 'Lines and curves, one per line', ph: 'y = 2x + 1\ny = x^2 − 4\nx = 3' },
      C('eqlab', 'Write each equation beside its line'), C('mono', 'Black only, with dashes (for printing)'),
      { k: 'pts', t: 'area', l: 'Points and shapes, one per line', ph: 'A(2, 3)\npolygon P(0,0) Q(4,0) R(4,3)\nsegment (0,0) (3,4)' },
      C('ptcoord', 'Write the coordinates beside each point'),
    ],
    numline: [
      H('The line'),
      N('from', 'Starts at'), N('to', 'Ends at'), N('step', 'Step between ticks'),
      N('every', 'Number every … ticks'),
      S('minor', 'Small ticks between', [['0', 'None'], ['1', '1 (halves)'], ['2', '2 (thirds)'], ['3', '3 (quarters)'], ['4', '4 (fifths)'], ['9', '9 (tenths)']]),
      C('nums', 'Numbers'), C('frac', 'Numbers as fractions', is(['nums', true])), C('arrows', 'Arrows at both ends'),
      H('Marks'),
      { k: 'marks', t: 'area', l: 'Dots and inequalities, one per line', ph: '3\nopen −2\nP = 1/2\nx > 2\n−1 ≤ x < 3' },
      { t: 'note', l: 'A number puts a dot there (open 3 for an open circle, P = 3 to name it). An inequality like x > 2 or −1 ≤ x < 3 shades the line. Join two with "or".' },
    ],
    triangle: [
      H('Measurements'),
      S('method', 'Make it from', [['sss', 'Three sides'], ['sas', 'Two sides and the angle between them'], ['asa', 'Two angles and the side between them'], ['aas', 'Two angles and a side not between them'], ['aaa', 'Three angles (the shape only)'], ['right', 'A right angle and its two legs']]),
      N('c', 'Side AB', method('sss', 'sas', 'asa')),
      N('a', function (s) { return s.method === 'right' ? 'Leg BC' : 'Side BC'; }, method('sss', 'aas', 'right')),
      N('b', function (s) { return s.method === 'right' ? 'Leg CA' : 'Side CA'; }, method('sss', 'sas', 'right')),
      N('A', function (s) { return s.method === 'sas' ? 'Angle A, between AB and CA (°)' : 'Angle A (°)'; }, method('sas', 'asa', 'aas', 'aaa')),
      N('B', 'Angle B (°)', method('asa', 'aas', 'aaa')),
      N('C', 'Angle C (°)', method('aaa')),
    ].concat(UNIT_ROWS, [
      H('Labels'),
      GIVEN, WORKED, C('names', 'Corner letters'), LETTERS(['nA', 'nB', 'nC']),
      NOTE,
      T('sAB', 'Label on AB'), T('sBC', 'Label on BC'), T('sCA', 'Label on CA'),
      T('gA', 'Label in angle A'), T('gB', 'Label in angle B'), T('gC', 'Label in angle C'),
      H('Marks'),
      C('box', 'Right-angle box'), C('ticks', 'Tick marks on equal sides'), C('arcs', 'Matching arcs on equal angles'),
      S('alt', 'Height (dashed)', [['none', 'None'], ['A', 'From A down to BC'], ['B', 'From B down to CA'], ['C', 'From C down to AB']]),
      T('hLab', 'Label on the height', function (s) { return s.alt !== 'none'; }),
    ], TURN, [C('flip', 'Flip it over')]),
    rect: [
      H('Measurements'), N('w', 'Width (AB)'), N('h', 'Height (BC)'),
    ].concat(UNIT_ROWS, [
      H('Labels'), GIVEN, C('all4', 'Label all four sides'), C('diag', 'Draw the diagonal AC'), WORKED,
      C('names', 'Corner letters'), LETTERS(['nA', 'nB', 'nC', 'nD']),
      NOTE, T('sW', 'Label on the width'), T('sH', 'Label on the height'), T('sD', 'Label on the diagonal', is(['diag', true])),
      H('Marks'), C('boxes', 'Right-angle boxes'), C('ticks', 'Tick marks on equal sides'),
    ], TURN),
    para: [
      H('Measurements'), N('b', 'Base (AB)'), N('s', 'Slanted side (AD)'), N('ang', 'Angle at A (°)'),
    ].concat(UNIT_ROWS, [
      H('Labels'), GIVEN, C('height', 'Draw the height (dashed)'),
      C('names', 'Corner letters'), LETTERS(['nA', 'nB', 'nC', 'nD']),
      NOTE, T('sB', 'Label on the base'), T('sS', 'Label on the slanted side'), T('gA', 'Label in angle A'), T('sH', 'Label on the height', is(['height', true])),
      H('Marks'), C('arrows', 'Arrows on parallel sides'), C('ticks', 'Tick marks on equal sides'),
    ], TURN, [C('flip', 'Flip it over')]),
    trap: [
      H('Measurements'),
      S('type', 'Kind', [['iso', 'Isosceles (equal legs)'], ['right', 'Right (one leg upright)'], ['free', 'Any (choose where the top starts)']]),
      N('b1', 'Bottom (AB)'), N('b2', 'Top (DC)'), N('h', 'Height'),
      N('off', 'The top starts this far in from A', is(['type', 'free'])),
    ].concat(UNIT_ROWS, [
      H('Labels'), GIVEN, WORKED, C('height', 'Draw the height (dashed)', function (s) { return s.type !== 'right'; }),
      C('names', 'Corner letters'), LETTERS(['nA', 'nB', 'nC', 'nD']),
      NOTE, T('sB1', 'Label on the bottom'), T('sB2', 'Label on the top'), T('sH', 'Label on the height'), T('sL', 'Label on the left leg', function (s) { return s.type !== 'right'; }), T('sR', 'Label on the right leg'),
      H('Marks'), C('arrows', 'Arrows on the parallel sides'), C('ticks', 'Tick marks on equal legs', is(['type', 'iso'])), C('boxes', 'Right-angle boxes', is(['type', 'right'])),
    ], TURN, [C('flip', 'Flip it over')]),
    kite: [
      H('Measurements'), N('wd', 'Width across (BD)'), N('p', 'From the top to where the diagonals cross'), N('q', 'From where they cross to the bottom'),
    ].concat(UNIT_ROWS, [
      H('Labels'), C('diag', 'Draw the diagonals (dashed)'), C('giv', 'Show the diagonal lengths', is(['diag', true])), C('calc', 'Show the side lengths (worked out)'),
      C('names', 'Corner letters'), LETTERS(['nA', 'nB', 'nC', 'nD']),
      NOTE, T('sT', 'Label on the top sides'), T('sB', 'Label on the bottom sides'),
      T('dW', 'Label across', is(['diag', true])), T('dP', 'Label on the top part', is(['diag', true])), T('dQ', 'Label on the bottom part', is(['diag', true])),
      H('Marks'), C('ticks', 'Tick marks on equal sides'), C('box', 'Right-angle box where the diagonals cross', is(['diag', true])),
    ], TURN),
    reg: [
      H('Measurements'),
      S('n', 'Sides', [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) { return [String(n), n + ' (' + F.POLY_NAMES[n] + ')']; })),
      N('s', 'Side length'),
    ].concat(UNIT_ROWS, [
      H('Labels'), C('giv', 'Show the side length'), C('calc', 'Show the inside angle (worked out)'), C('names', 'Corner letters'),
      C('apo', 'Apothem (centre to the middle of a side)'), C('rad', 'Radius (centre to a corner)'), C('centre', 'Centre point'),
      NOTE, T('sS', 'Label on the side'), T('gI', 'Label in the angle'), T('sA', 'Label on the apothem', is(['apo', true])), T('sR', 'Label on the radius', is(['rad', true])),
      H('Marks'), C('ticks', 'Tick marks (all sides equal)'),
    ], TURN),
    angle: [
      H('Angles'),
      S('mode', 'Kind', [['single', 'One angle'], ['line', 'Angles on a straight line'], ['right', 'Angles in a right angle'], ['point', 'Angles around a point'], ['vertical', 'Two crossing lines']]),
      S('parts', 'How many angles', [['2', '2'], ['3', '3']], is(['mode', 'line'], ['mode', 'right'])),
      { k: 'parts', t: 'sel', l: 'How many angles', opts: [['3', '3'], ['4', '4']], show: is(['mode', 'point']), dup: 1 },
      N('a1', function (s) { return s.mode === 'single' ? 'Angle (°)' : s.mode === 'vertical' ? 'Angle between the lines (°)' : 'Angle 1 (°)'; }),
      N('a2', 'Angle 2 (°)', function (s) { return (s.mode === 'line' || s.mode === 'right') ? s.parts >= 3 : s.mode === 'point'; }),
      N('a3', 'Angle 3 (°)', function (s) { return s.mode === 'point' && s.parts >= 4; }),
      { t: 'note', l: 'The last angle is worked out so they add up.', show: is(['mode', 'line'], ['mode', 'right'], ['mode', 'point']) },
      H('Labels'), C('giv', 'Show the sizes you typed'), C('calc', 'Show worked-out sizes', function (s) { return s.mode !== 'single'; }),
      C('names', 'Letters (angle ABC)', is(['mode', 'single'])), LETTERS(['nA', 'nB', 'nC'], function (s) { return s.names && s.mode === 'single'; }),
      NOTE,
      T('l1', 'Label in angle 1'), T('l2', 'Label in angle 2', function (s) { return s.mode !== 'single'; }),
      T('l3', 'Label in angle 3', function (s) { return s.mode === 'vertical' || s.parts >= 3 && s.mode !== 'single'; }),
      T('l4', 'Label in angle 4', function (s) { return s.mode === 'vertical' || s.mode === 'point' && s.parts >= 4; }),
    ].concat(TURN),
    parallel: [
      H('Lines'), N('ang', 'Angle between the transversal and the lines (°)'),
      H('Labels'),
      S('mode', 'Label the eight angles with', [['numbers', 'Numbers 1 to 8'], ['sizes', 'Their sizes'], ['mine', 'Only the labels I type']]),
      C('arcs', 'Arcs on angles with sizes'), C('arrows', 'Arrows on the parallel lines'), C('names', 'Line names'),
      { t: 'row', l: 'Names', keys: ['nL', 'nM', 'nT'], show: is(['names', true]) },
      { t: 'note', l: 'Angles 1 to 4 are at the top crossing (1 upper left, 2 upper right, 3 lower left, 4 lower right); 5 to 8 the same at the bottom. Type a label to use instead, or a dash to leave one blank.' },
      { t: 'grid8', keys: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] },
    ].concat(TURN),
    solid: [
      H('Solid'),
      S('shape', 'Shape', [['cube', 'Cube'], ['cuboid', 'Cuboid (rectangular prism)'], ['triprism', 'Triangular prism'], ['pyramid', 'Pyramid'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['sphere', 'Sphere'], ['hemi', 'Hemisphere']]),
      S('tri', 'Triangle', [['iso', 'Isosceles'], ['right', 'Right-angled']], is(['shape', 'triprism'])),
      N('l', function (s) { return s.shape === 'cube' ? 'Edge' : s.shape === 'triprism' ? 'Length of the prism' : s.shape === 'pyramid' ? 'Base length' : 'Length'; }, is(['shape', 'cube'], ['shape', 'cuboid'], ['shape', 'triprism'], ['shape', 'pyramid'])),
      N('w', function (s) { return s.shape === 'triprism' ? 'Base of the triangle' : s.shape === 'pyramid' ? 'Base width' : 'Width'; }, is(['shape', 'cuboid'], ['shape', 'triprism'], ['shape', 'pyramid'])),
      N('h', function (s) { return s.shape === 'triprism' ? 'Height of the triangle' : 'Height'; }, is(['shape', 'cuboid'], ['shape', 'triprism'], ['shape', 'pyramid'], ['shape', 'cylinder'], ['shape', 'cone'])),
      N('r', 'Radius', is(['shape', 'cylinder'], ['shape', 'cone'], ['shape', 'sphere'], ['shape', 'hemi'])),
    ].concat(UNIT_ROWS, [
      H('Labels'), C('giv', 'Show the measurements'), C('slant', 'Slant height (worked out)', is(['shape', 'cone'], ['shape', 'pyramid'])),
      S('hid', 'Hidden edges', [['dash', 'Dashed'], ['hide', 'Not shown']]),
      NOTE,
      T('sL', 'Label on the length', is(['shape', 'cube'], ['shape', 'cuboid'], ['shape', 'triprism'], ['shape', 'pyramid'])),
      T('sW', 'Label on the width', is(['shape', 'cuboid'], ['shape', 'triprism'], ['shape', 'pyramid'])),
      T('sH', 'Label on the height', is(['shape', 'cuboid'], ['shape', 'triprism'], ['shape', 'pyramid'], ['shape', 'cylinder'], ['shape', 'cone'])),
      T('sR', 'Label on the radius', is(['shape', 'cylinder'], ['shape', 'cone'], ['shape', 'sphere'], ['shape', 'hemi'])),
      T('sS', 'Label on the slant height', function (s) { return s.slant && (s.shape === 'cone' || s.shape === 'pyramid'); }),
    ]),
  };

  /* ── Pictures of a figure ──────────────────────────────────────────── */

  /** A standalone SVG of the figure on white, k times its natural size. */
  function standalone(built, k) {
    k = k || 1;
    var vb = built.vb;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '" width="' + Math.round(vb[2] * k) + '" height="' + Math.round(vb[3] * k) + '">'
      + '<rect x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' + vb[3] + '" fill="#ffffff"/>' + built.svg + '</svg>';
  }
  /** Any SVG text as a PNG blob. */
  function svgToPng(svgText, w, h) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
        var g = cv.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not make the picture')); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not make the picture')); };
      img.src = url;
    });
  }
  function figurePng(built) { return svgToPng(standalone(built, 2), built.vb[2] * 2, built.vb[3] * 2); }
  /** Copy a picture to the clipboard where the browser allows it. pngPromise is made inside the click, as Safari needs. */
  function copyPng(pngPromise) {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      toast('This browser cannot copy pictures. Use PNG instead.', 'warn');
      return Promise.resolve(false);
    }
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': pngPromise })])
      .then(function () { toast('Copied. Paste it into a test, a doc or a slide.'); return true; },
        function () { toast('Could not copy here. Use PNG instead.', 'warn'); return false; });
  }
  function download(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function fileName(spec) {
    return (F.describe(spec).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'figure');
  }
  function shareURL(spec) {
    return location.href.split('#')[0] + '#/fig/' + F.encode(spec);
  }

  /* ── Remembering the last settings ─────────────────────────────────── */

  function readLast() {
    try { var v = JSON.parse(localStorage.getItem(LAST) || 'null'); if (v && v.specs) return v; } catch (e) {}
    return { kind: 'triangle', specs: {} };
  }
  function saveLast(spec) {
    try {
      var v = readLast();
      v.kind = spec.kind; v.specs[spec.kind] = spec;
      localStorage.setItem(LAST, JSON.stringify(v));
    } catch (e) {}
  }
  function lastSpec(kind) {
    var v = readLast(), k = kind || v.kind;
    return F.clean(v.specs[k] || { kind: k }) || F.defaults('triangle');
  }

  /* ── The dialog ────────────────────────────────────────────────────── */

  var dlg = null, state = null, seq = 0;

  function fieldId(k, i) { return 'pxf-' + k + (i ? '-' + i : ''); }
  function labelOf(f, s) { return typeof f.l === 'function' ? f.l(s) : f.l; }

  function formHTML(kind, s) {
    var html = '', open = false;
    FORMS[kind].forEach(function (f, i) {
      var show = f.show ? ' data-show="' + i + '"' : '';
      if (f.t === 'head') {
        if (open) html += '</fieldset>';
        html += '<fieldset class="px-f-set"><legend class="px-f-legend">' + esc(f.l) + '</legend>';
        open = true;
        return;
      }
      var id = fieldId(f.k, f.dup);
      if (f.t === 'num' || f.t === 'text') {
        html += '<div class="px-f-row"' + show + '><label class="px-f-lab" for="' + id + '" data-lab="' + i + '">' + esc(labelOf(f, s)) + '</label>'
          + '<input class="px-f-in" id="' + id + '" data-k="' + f.k + '" type="text" autocomplete="off" spellcheck="false"'
          + (f.t === 'num' ? ' inputmode="decimal"' : ' maxlength="80"') + ' value="' + esc(s[f.k]) + '"></div>';
      } else if (f.t === 'area') {
        html += '<div class="px-f-row px-f-row--wide"' + show + '><label class="px-f-lab" for="' + id + '">' + esc(f.l) + '</label>'
          + '<textarea class="px-f-in px-f-area" id="' + id + '" data-k="' + f.k + '" rows="3" spellcheck="false" placeholder="' + esc(f.ph || '') + '">' + esc(s[f.k]) + '</textarea></div>';
      } else if (f.t === 'chk') {
        html += '<div class="px-f-row px-f-row--chk"' + show + '><label class="px-f-chk" for="' + id + '"><input type="checkbox" id="' + id + '" data-k="' + f.k + '"' + (s[f.k] ? ' checked' : '') + '><span data-lab="' + i + '">' + esc(labelOf(f, s)) + '</span></label></div>';
      } else if (f.t === 'sel' || f.t === 'preset') {
        html += '<div class="px-f-row"' + show + '><label class="px-f-lab" for="' + (f.t === 'preset' ? 'pxf-preset' : id) + '" data-lab="' + i + '">' + esc(labelOf(f, s)) + '</label>'
          + '<select class="px-f-in" id="' + (f.t === 'preset' ? 'pxf-preset' : id) + '"' + (f.t === 'preset' ? ' data-preset="' + i + '"' : ' data-k="' + f.k + '"') + '>'
          + f.opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f.t === 'sel' && String(s[f.k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('')
          + '</select></div>';
      } else if (f.t === 'row') {
        html += '<div class="px-f-row"' + show + '><span class="px-f-lab" id="pxf-row-' + i + '">' + esc(f.l) + '</span><span class="px-f-trio" role="group" aria-labelledby="pxf-row-' + i + '">'
          + f.keys.map(function (k, j) { return '<input class="px-f-in px-f-in--short" id="' + fieldId(k) + '" data-k="' + k + '" type="text" maxlength="12" autocomplete="off" aria-label="' + esc(f.l + ' ' + (j + 1)) + '" value="' + esc(s[k]) + '">'; }).join('')
          + '</span></div>';
      } else if (f.t === 'grid8') {
        html += '<div class="px-f-row px-f-row--wide"' + show + '><div class="px-f-eight">' + f.keys.map(function (k, j) {
          return '<label class="px-f-mini" for="' + fieldId(k) + '"><span>' + (j + 1) + '</span><input class="px-f-in" id="' + fieldId(k) + '" data-k="' + k + '" type="text" maxlength="20" autocomplete="off" value="' + esc(s[k]) + '" aria-label="Label for angle ' + (j + 1) + '"></label>';
        }).join('') + '</div></div>';
      } else if (f.t === 'note') {
        html += '<p class="px-f-note"' + show + '>' + esc(f.l) + '</p>';
      }
    });
    if (open) html += '</fieldset>';
    return html + '<p class="px-f-reset"><button type="button" class="px-link" data-fig-act="reset">Start this figure again</button></p>';
  }

  /** The settings, as the form has them now. */
  function readForm() {
    var d = F.DEFAULTS[state.kind], s = { kind: state.kind };
    Object.keys(d).forEach(function (k) { if (k !== 'kind') s[k] = state.spec[k]; });
    // Two fields can share a key (angles around a point have their own "how many"): the one on show wins.
    var shown = function (el) { var row = el.closest('[data-show]'); return !(row && row.hidden); }, byKey = {};
    Array.prototype.forEach.call(dlg.querySelectorAll('#pxFigForm [data-k]'), function (el) {
      var k = el.getAttribute('data-k');
      if (!byKey[k] || (!shown(byKey[k]) && shown(el))) byKey[k] = el;
    });
    Object.keys(byKey).forEach(function (k) {
      var el = byKey[k];
      if (el.type === 'checkbox') s[k] = el.checked;
      else if (typeof d[k] === 'number') { var o = {}; o.kind = state.kind; o[k] = el.value; s[k] = el.value.trim() === '' ? NaN : F.clean(o)[k]; }
      else s[k] = el.value;
    });
    return s;
  }
  function syncVisibility(s) {
    var f = FORMS[state.kind];
    Array.prototype.forEach.call(dlg.querySelectorAll('#pxFigForm [data-show]'), function (el) {
      var def = f[+el.getAttribute('data-show')];
      el.hidden = !def.show(s);
    });
    Array.prototype.forEach.call(dlg.querySelectorAll('#pxFigForm [data-lab]'), function (el) {
      var def = f[+el.getAttribute('data-lab')];
      if (typeof def.l === 'function') el.textContent = def.l(s);
    });
  }

  var raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; update(); }); }
  function update() {
    if (!dlg || !state) return;
    var s = readForm();
    syncVisibility(s);
    s = readForm();
    state.spec = s;
    var r = F.build(s, { ink: state.color });
    var prev = dlg.querySelector('#pxFigPrev'), msg = dlg.querySelector('#pxFigMsg'), ok = !r.error;
    Array.prototype.forEach.call(dlg.querySelectorAll('#pxFigForm [aria-invalid]'), function (el) { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); });
    if (ok) {
      state.built = r;
      prev.innerHTML = '<svg viewBox="' + r.vb.join(' ') + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' + r.svg + '</svg>';
      prev.classList.remove('is-stale');
      prev.setAttribute('aria-label', 'Preview: ' + F.describe(s));
      if (msg.textContent) msg.textContent = '';
      msg.classList.remove('is-err');
      Object.keys(r.auto || {}).forEach(function (k) {
        var el = dlg.querySelector('#pxFigForm [data-k="' + k + '"]');
        if (el && el.type === 'text') el.placeholder = r.auto[k];
      });
      saveLast(s);
    } else {
      state.built = null;
      prev.classList.add('is-stale');
      prev.setAttribute('aria-label', 'Preview not updated: ' + r.error);
      msg.textContent = r.error;
      msg.classList.add('is-err');
      if (r.field) {
        var bad = dlg.querySelector('#pxFigForm [data-k="' + r.field + '"]');
        if (bad) { bad.setAttribute('aria-invalid', 'true'); bad.setAttribute('aria-describedby', 'pxFigMsg'); }
      }
    }
    Array.prototype.forEach.call(dlg.querySelectorAll('[data-needs-figure]'), function (b) { b.disabled = !ok; });
  }

  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'px-fig';
    dlg.setAttribute('aria-labelledby', 'pxFigH');
    dlg.innerHTML = '<div class="px-fig-in">'
      + '<header class="px-fig-head"><h2 id="pxFigH">Maths figures</h2><span class="px-fig-sub">Drawn to scale, ready to print</span><span class="px-grow"></span>'
      + '<button type="button" class="px-icon" data-fig-act="cancel" aria-label="Close">×</button></header>'
      + '<fieldset class="px-fig-kinds"><legend class="px-sr">Figure</legend>' + F.KINDS.map(function (k) {
        return '<label class="px-fig-kind"><input type="radio" name="pxFigKind" value="' + k[0] + '"><span>' + esc(k[1]) + '</span></label>';
      }).join('') + '</fieldset>'
      + '<div class="px-fig-body">'
      + '<div class="px-fig-side"><div class="px-fig-prev" id="pxFigPrev" role="img" aria-label="Preview"></div>'
      + '<p class="px-fig-msg" id="pxFigMsg" role="status" aria-live="polite"></p>'
      + '<div class="px-fig-share" hidden><label class="px-f-lab" for="pxFigLink">Share link: opens these settings</label><input class="px-f-in" id="pxFigLink" readonly></div></div>'
      + '<div class="px-fig-form" id="pxFigForm"></div>'
      + '</div>'
      + '<footer class="px-fig-foot">'
      + '<button type="button" class="px-btn px-btn--small" data-fig-act="copy" data-needs-figure>Copy figure</button>'
      + '<button type="button" class="px-btn px-btn--small" data-fig-act="link" data-needs-figure>Share link</button>'
      + '<button type="button" class="px-btn px-btn--small" data-fig-act="png" data-needs-figure>PNG</button>'
      + '<button type="button" class="px-btn px-btn--small" data-fig-act="svg" data-needs-figure>SVG</button>'
      + '<span class="px-grow"></span>'
      + '<button type="button" class="px-btn px-btn--small" data-fig-act="cancel">Cancel</button>'
      + '<button type="button" class="px-btn px-btn--small px-btn--primary" data-fig-act="done" data-needs-figure>Insert</button>'
      + '</footer></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('input', function (e) {
      if (e.target.name === 'pxFigKind') return;
      if (e.target.hasAttribute('data-preset')) return;
      schedule();
    });
    dlg.addEventListener('change', function (e) {
      if (e.target.name === 'pxFigKind') { setKind(e.target.value); return; }
      if (e.target.hasAttribute('data-preset')) {
        var f = FORMS[state.kind][+e.target.getAttribute('data-preset')], o = f.opts.filter(function (x) { return x[0] === e.target.value; })[0];
        if (o && o[2]) { state.spec = F.clean(Object.assign({}, state.spec, o[2])); renderForm(); dlg.querySelector('#pxf-preset').focus(); }
        return;
      }
      schedule();
    });
    dlg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fig-act]');
      if (!b || b.disabled) return;
      act(b.getAttribute('data-fig-act'));
    });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    return dlg;
  }
  function renderForm() {
    dlg.querySelector('#pxFigForm').innerHTML = formHTML(state.kind, state.spec);
    dlg.querySelector('.px-fig-share').hidden = true;
    update();
  }
  function setKind(kind) {
    state.kind = kind;
    state.spec = lastSpec(kind);
    renderForm();
  }
  function act(a) {
    var s = state.spec, built = state.built;
    if (a === 'cancel') { close(); return; }
    if (a === 'reset') { state.spec = F.defaults(state.kind); renderForm(); var first = dlg.querySelector('#pxFigForm .px-f-in'); if (first) first.focus(); return; }
    if (!built) return;
    if (a === 'done') {
      var cb = state.onDone, spec = F.clean(s);
      saveLast(spec);
      close(true);
      if (cb) cb(spec);
      return;
    }
    if (a === 'copy') copyPng(figurePng(built));
    else if (a === 'png') figurePng(built).then(function (b) { download(fileName(s) + '.png', b); }, function (er) { toast(er.message, 'warn'); });
    else if (a === 'svg') download(fileName(s) + '.svg', new Blob([standalone(built, 1)], { type: 'image/svg+xml' }));
    else if (a === 'link') {
      var url = shareURL(s), box = dlg.querySelector('.px-fig-share'), input = dlg.querySelector('#pxFigLink');
      box.hidden = false; input.value = url;
      var done = function () { toast('Link copied. Anyone who opens it gets this figure to edit.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { input.focus(); input.select(); });
      else { input.focus(); input.select(); }
    }
  }
  function close(keep) {
    if (!dlg || !state) return;
    var st = state;
    state = null;
    if (dlg.open) dlg.close();
    if (st.opener && st.opener.focus && document.contains(st.opener)) { try { st.opener.focus(); } catch (e) {} }
    if (!keep && st.onCancel) st.onCancel();
  }

  /**
   * Open the panel. opts.spec: the figure to start from (else the last one
   * made); opts.mode 'edit' says Update instead of Insert; opts.onDone(spec)
   * gets the finished settings; opts.onCancel when it is closed without.
   */
  function open(opts) {
    opts = opts || {};
    ensureDialog();
    if (state) close(true);
    var spec = (opts.spec && F.clean(opts.spec)) || lastSpec();
    state = { kind: spec.kind, spec: spec, onDone: opts.onDone, onCancel: opts.onCancel, color: opts.color || '#111827', opener: document.activeElement, id: ++seq };
    dlg.querySelector('[data-fig-act="done"]').textContent = opts.mode === 'edit' ? 'Update figure' : 'Insert';
    Array.prototype.forEach.call(dlg.querySelectorAll('input[name="pxFigKind"]'), function (r) { r.checked = r.value === spec.kind; });
    renderForm();
    if (!dlg.open) dlg.showModal();
    var on = dlg.querySelector('input[name="pxFigKind"]:checked');
    if (on) on.focus();
  }

  window.FluxPixelFigures = {
    open: open,
    close: function () { close(); },
    isOpen: function () { return !!(dlg && dlg.open); },
    standalone: standalone, svgToPng: svgToPng, figurePng: figurePng, copyPng: copyPng, shareURL: shareURL, lastSpec: lastSpec,
  };
})();
