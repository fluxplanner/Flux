/* Flux Graph Paper (paper.html): the paper is one SVG drawn in millimetres, so
   the preview, the printout and the PNG are the same drawing. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$;
  var SIZES = { a4: [210, 297], letter: [215.9, 279.4] };
  var ids = ['ppKind', 'ppSize', 'ppStep', 'ppMargin', 'ppBold', 'ppTitle', 'ppTitleText'];
  var saved = T.load('flux_paper_v1', {});
  ids.forEach(function (id) {
    var el = $('#' + id);
    if (saved[id] != null) { if (el.type === 'checkbox') el.checked = saved[id]; else el.value = saved[id]; }
    el.addEventListener('input', draw); el.addEventListener('change', draw);
  });
  function opts() {
    var o = {};
    ids.forEach(function (id) { var el = $('#' + id); o[id] = el.type === 'checkbox' ? el.checked : el.value; });
    T.save('flux_paper_v1', o);
    return o;
  }
  function line(x1, y1, x2, y2, w, c) { return '<line x1="' + x1.toFixed(2) + '" y1="' + y1.toFixed(2) + '" x2="' + x2.toFixed(2) + '" y2="' + y2.toFixed(2) + '" stroke="' + (c || '#7fb3d5') + '" stroke-width="' + w + '"/>'; }
  function svg() {
    var o = opts();
    var W = SIZES[o.ppSize][0], H = SIZES[o.ppSize][1];
    var step = Math.min(30, Math.max(2, +o.ppStep || 5)), m = Math.min(40, Math.max(0, +o.ppMargin || 0));
    var top = m + (o.ppTitle ? 14 : 0);
    var x0 = m, y0 = top, x1 = W - m, y1 = H - m, out = [];
    var thin = 0.15, bold = 0.4;
    var nx = Math.floor((x1 - x0) / step), ny = Math.floor((y1 - y0) / step);
    x1 = x0 + nx * step; y1 = y0 + ny * step;
    if (o.ppKind === 'grid') {
      for (var i = 0; i <= nx; i++) out.push(line(x0 + i * step, y0, x0 + i * step, y1, o.ppBold && i % 5 === 0 ? bold : thin));
      for (var j = 0; j <= ny; j++) out.push(line(x0, y0 + j * step, x1, y0 + j * step, o.ppBold && j % 5 === 0 ? bold : thin));
    } else if (o.ppKind === 'dot') {
      for (i = 0; i <= nx; i++) for (j = 0; j <= ny; j++) out.push('<circle cx="' + (x0 + i * step).toFixed(2) + '" cy="' + (y0 + j * step).toFixed(2) + '" r="0.35" fill="#5b7f99"/>');
    } else if (o.ppKind === 'iso') {
      var h = step * Math.sqrt(3) / 2, rows = Math.floor((y1 - y0) / h);
      for (j = 0; j <= rows; j++) for (i = 0; i <= nx; i++) out.push('<circle cx="' + (x0 + i * step + (j % 2 ? step / 2 : 0)).toFixed(2) + '" cy="' + (y0 + j * h).toFixed(2) + '" r="0.35" fill="#5b7f99"/>');
      // the three line families, clipped to the box
      out.push('<g clip-path="url(#ppClip)">');
      for (var k = -rows - nx; k <= nx + rows; k++) {
        var bx = x0 + k * step;
        out.push(line(bx, y0, bx + (y1 - y0) / Math.tan(Math.PI / 3), y1, thin), line(bx, y0, bx - (y1 - y0) / Math.tan(Math.PI / 3), y1, thin));
      }
      for (j = 0; j <= rows; j++) out.push(line(x0, y0 + j * h, x1, y0 + j * h, thin));
      out.push('</g>');
    } else if (o.ppKind === 'semilog') {
      for (i = 0; i <= nx; i++) out.push(line(x0 + i * step, y0, x0 + i * step, y1, o.ppBold && i % 5 === 0 ? bold : thin));
      var cyc = (y1 - y0) / 3;
      for (var c = 0; c < 3; c++) for (var d = 1; d <= 10; d++) {
        var y = y1 - c * cyc - Math.log10(d) * cyc;
        out.push(line(x0, y, x1, y, d === 1 || d === 10 ? bold : thin));
        if (d < 10) out.push('<text x="' + (x0 - 1.2).toFixed(2) + '" y="' + (y + 1).toFixed(2) + '" font-size="2.6" text-anchor="end" fill="#5b7f99">' + d + '</text>');
      }
    } else if (o.ppKind === 'polar') {
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.min(x1 - x0, y1 - y0) / 2;
      for (var r = step; r <= R + 0.01; r += step) out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(2) + '" fill="none" stroke="#7fb3d5" stroke-width="' + (o.ppBold && Math.round(r / step) % 5 === 0 ? bold : thin) + '"/>');
      for (var a = 0; a < 360; a += 15) {
        var t = a * Math.PI / 180;
        out.push(line(cx, cy, cx + R * Math.cos(t), cy - R * Math.sin(t), a % 90 === 0 ? bold : thin));
        if (a % 30 === 0) out.push('<text x="' + (cx + (R + 3) * Math.cos(t)).toFixed(2) + '" y="' + (cy - (R + 3) * Math.sin(t) + 1).toFixed(2) + '" font-size="2.8" text-anchor="middle" fill="#5b7f99">' + a + '°</text>');
      }
    } else if (o.ppKind === 'staves') {
      var gap = Math.max(1.5, step / 2.5), staff = gap * 4, between = staff + Math.max(8, step * 2);
      for (y = y0; y + staff <= y1; y += between) for (k = 0; k < 5; k++) out.push(line(x0, y + k * gap, x1, y + k * gap, 0.25, '#555'));
    } else if (o.ppKind === 'hand') {
      var lh = Math.max(4, step), block = lh * 3 + lh;
      for (y = y0; y + lh * 3 <= y1; y += block) {
        out.push(line(x0, y, x1, y, thin, '#9bb'), line(x0, y + lh, x1, y + lh, 0.15, '#c66'), line(x0, y + lh * 2, x1, y + lh * 2, 0.4, '#58a'), line(x0, y + lh * 3, x1, y + lh * 3, thin, '#9bb'));
      }
    }
    if (o.ppTitle) {
      out.push('<rect x="' + m + '" y="' + m + '" width="' + (W - 2 * m) + '" height="10" fill="none" stroke="#5b7f99" stroke-width="0.3"/>');
      out.push('<text x="' + (m + 2) + '" y="' + (m + 6.6) + '" font-size="4" font-family="sans-serif" fill="#222">' + T.esc(o.ppTitleText || '') + '</text>');
    }
    return { w: W, h: H, markup: '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + ' ' + H + '">'
      + '<defs><clipPath id="ppClip"><rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '"/></clipPath></defs>'
      + '<rect width="100%" height="100%" fill="#fff"/>' + out.join('') + '</svg>' };
  }
  var current;
  function draw() {
    current = svg();
    var host = $('#ppPreview');
    host.innerHTML = current.markup;
    var s = host.querySelector('svg'); s.style.width = '100%'; s.style.height = 'auto'; s.style.display = 'block';
  }
  // Print: the page's own size, the paper alone.
  var pageStyle = document.createElement('style'); document.head.appendChild(pageStyle);
  function png(cb) {
    var scale = 300 / 25.4 / 2; // ~150 dpi
    var img = new Image();
    var cv = document.createElement('canvas'); cv.width = Math.round(current.w * scale); cv.height = Math.round(current.h * scale);
    img.onload = function () { var g = cv.getContext('2d'); g.drawImage(img, 0, 0, cv.width, cv.height); if (window.FluxHub && window.FluxHub.markCanvas) window.FluxHub.markCanvas(cv); cv.toBlob(cb, 'image/png'); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(current.markup);
  }
  $('#ppPrint').addEventListener('click', function () {
    pageStyle.textContent = '@page { size: ' + ($('#ppSize').value === 'letter' ? 'letter' : 'A4') + '; margin: 0; } @media print { #ppPreviewWrap { padding: 0 !important; } #ppPreview svg { width: 100% !important; } main > h1, main > p { display: none; } }';
    if (window.FluxHub && !window.FluxHub.canPrint()) { png(function (b) { window.FluxHub.printImage(b, 'flux-graph-paper.png', 'Graph paper'); }); return; }
    window.print();
  });
  $('#ppPng').addEventListener('click', function () { png(function (b) { T.download('flux-graph-paper.png', b); }); });
  draw();
  window.fluxPaper = { svg: svg };
})();
