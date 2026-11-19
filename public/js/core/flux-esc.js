/*
 * FluxEsc — the one HTML escaper.
 *
 * Why this exists: app.js's old esc() skipped quotes, and ~45 call sites drop
 * its output into attributes (title="${esc(name)}"), so a task called
 * `x" onmouseover="…` broke out of the attribute. ~150 modules already defer
 * to window.esc, so fixing it here fixes them all at once.
 *
 * Loaded first in the vendor bundle so every later script can rely on it.
 * null/undefined render as '' — showing the word "undefined" was never wanted.
 */
(function () {
  'use strict';
  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function html(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return MAP[c]; });
  }
  /*
   * Note bodies are rich text (bold, lists, links) that sync between devices,
   * so escaping them would wipe the formatting — but writing them straight to
   * innerHTML ran any <img onerror> a synced or imported body carried.
   * Parsing inside a <template> never runs scripts or fires load events, so we
   * can strip the active parts there and hand back only inert markup.
   */
  var DROP = 'script,style,iframe,frame,object,embed,link,meta,base,form,svg,math,template,noscript';
  var URL_ATTR = /^(href|src|xlink:href|action|formaction|srcset|background|poster)$/i;
  function richText(s) {
    var t = document.createElement('template');
    t.innerHTML = String(s == null ? '' : s);
    t.content.querySelectorAll(DROP).forEach(function (el) { el.remove(); });
    t.content.querySelectorAll('*').forEach(function (el) {
      for (var i = el.attributes.length - 1; i >= 0; i--) {
        var a = el.attributes[i];
        var v = a.value.replace(/[\s\u0000-\u001f]+/g, '').toLowerCase();
        if (/^on/i.test(a.name) ||
            (URL_ATTR.test(a.name) && /^(javascript|vbscript|data):/.test(v) && !/^data:image\/(png|jpe?g|gif|webp);/.test(v))) {
          el.removeAttribute(a.name);
        }
      }
    });
    return t.innerHTML;
  }
  window.FluxEsc = Object.freeze({ html: html, richText: richText });
  window.esc = html;
})();
