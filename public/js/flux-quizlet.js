/* ============================================================================
   FLUX · QUIZLET  ·  flux-quizlet.js
   Reads a Quizlet set from the page the student has open, and hands it to
   Flux Flashcards as an ordinary share link (flashcards.html#share=j…), so
   preview, save and "new cards since last time" all reuse the share path.

   Quizlet answers anything but a person's browser with a captcha, so Flux
   cannot fetch a set from its link; the reading has to happen on the page.
   Two things run it there:
     • the "Send to Flux" bookmark (bookmarklet(), shown in Flashcards →
       Import → From Quizlet), and
     • the Flux browser extension's button on Quizlet sets
       (extension/src/quizlet.js), for browsers like Dia and Arc that will
       not run a bookmark.

   cards(), read(), message() and grab() are turned into source text with
   toString() for the bookmark, so they must not use anything from outside
   themselves, and must not use line comments: a bookmark URL loses its line
   breaks.

   No side effects: loads in flashcards.html, the extension and the unit tests.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxQuizlet) return;

  /**
   * The set's cards from the page's Next.js data. Quizlet keeps them as
   * studiable items with cardSides (word, definition); the data is JSON with
   * more JSON inside strings. Items from other sets on the page (suggestions)
   * are dropped. With `setId`, only that set counts: after moving between
   * sets inside Quizlet the data still describes the first page, and reading
   * it would give the wrong set. Without one, the set with the most cards.
   * Returns { cards: [[term, def]], skipped } where skipped counts cards with
   * a side that has no text (a picture only).
   */
  function cards(data, setId) {
    var seen = {}, items = [];
    (function walk(v, depth) {
      if (v == null || depth > 60) return;
      if (typeof v === 'string') {
        var t = v.trim();
        if (t.length > 20 && (t[0] === '{' || t[0] === '[') && t.indexOf('cardSides') > -1) {
          try { walk(JSON.parse(t), depth + 1); } catch (e) {}
        }
        return;
      }
      if (typeof v !== 'object') return;
      if (Array.isArray(v.cardSides)) {
        var key = v.id != null ? String(v.id) : JSON.stringify(v.cardSides);
        if (!seen[key]) { seen[key] = 1; items.push(v); }
        return;
      }
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) walk(v[k], depth + 1);
    })(data, 0);
    var groups = {}, best = null;
    items.forEach(function (it) {
      var g = String(it.studiableContainerId == null ? '' : it.studiableContainerId);
      (groups[g] = groups[g] || []).push(it);
    });
    if (setId) best = groups[String(setId)] || [];
    else Object.keys(groups).forEach(function (g) { if (!best || groups[g].length > best.length) best = groups[g]; });
    best = (best || []).slice().sort(function (a, b) { return (a.rank || 0) - (b.rank || 0); });
    function side(it, label, i) {
      var s = it.cardSides.filter(function (x) { return x && x.label === label; })[0] || it.cardSides[i] || {};
      return (s.media || []).map(function (m) { return m && m.plainText ? String(m.plainText) : ''; }).join(' ').trim();
    }
    var out = [], skipped = 0;
    best.forEach(function (it) {
      var term = side(it, 'word', 0), def = side(it, 'definition', 1);
      if (term && def) out.push([term, def]); else skipped++;
    });
    return { cards: out, skipped: skipped };
  }

  /**
   * Runs on the Quizlet page; `readCards` is cards(). Returns
   * { code, count, skipped } where code is the share code for
   * flashcards.html#share=, or { error: 'not-quizlet' | 'no-cards' }.
   * The page's data first, then the visible terms (which follow Quizlet's
   * own moves between sets).
   */
  function read(readCards) {
    var host = location.hostname.replace(/^www\./, '');
    if (!/(^|\.)quizlet\.com$/.test(host)) return { error: 'not-quizlet' };
    var m = location.pathname.match(/\/(\d{3,})(\/|$)/) || location.pathname.match(/-(\d{3,})\/?$/);
    var got = { cards: [], skipped: 0 };
    try { got = readCards(JSON.parse(document.getElementById('__NEXT_DATA__').textContent), m && m[1]); } catch (e) {}
    if (!got.cards.length) {
      got = { cards: [], skipped: 0 };
      var t = document.querySelectorAll('.TermText');
      for (var i = 0; i + 1 < t.length; i += 2) {
        var a = (t[i].innerText || '').trim(), b = (t[i + 1].innerText || '').trim();
        if (a && b) got.cards.push([a, b]);
      }
    }
    if (!got.cards.length) return { error: 'no-cards' };
    var h1 = document.querySelector('h1');
    var title = (h1 && (h1.innerText || '').trim()) || (document.title || '').replace(/\s*\|\s*Quizlet\s*$/i, '').replace(/\s*Flashcards\s*$/i, '').trim() || 'Quizlet set';
    var p = { t: title.slice(0, 120), c: got.cards, d: 'From Quizlet: ' + location.hostname + location.pathname };
    if (m) p.o = 'quizlet-' + m[1];
    var code = 'j' + btoa(unescape(encodeURIComponent(JSON.stringify(p)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { code: code, count: got.cards.length, skipped: got.skipped };
  }

  /** What to tell the student for a read() result, or '' when it worked cleanly. */
  function message(r) {
    if (r.error === 'not-quizlet') return 'Open a Quizlet set first, then use Send to Flux.';
    if (r.error === 'no-cards') return 'Flux could not find any cards on this page. Open the set itself (the page that lists all its terms) and try again.';
    if (r.skipped) return r.skipped + (r.skipped === 1 ? ' card has' : ' cards have') + ' only a picture on one side, so Flux left ' + (r.skipped === 1 ? 'it' : 'them') + ' out.';
    return '';
  }

  /** The bookmark: reads the page and opens Flux at `flux` with the set. */
  function grab(readPage, readCards, say, flux) {
    var r = readPage(readCards), note = say(r);
    if (r.error) { alert(note); return; }
    if (note) alert(note);
    var url = flux + '#share=' + r.code;
    var w = window.open(url, '_blank');
    if (w) { try { w.opener = null; } catch (e) {} } else location.href = url;
  }

  /** The bookmark's address, for a Flux Flashcards page at `fluxUrl`. */
  function bookmarklet(fluxUrl) {
    var src = '(' + grab.toString() + ')(' + read.toString() + ',' + cards.toString() + ',' + message.toString() + ',' + JSON.stringify(String(fluxUrl)) + ')';
    return 'javascript:' + encodeURIComponent(src.replace(/\s*\n\s*/g, ' ')) + ';void 0';
  }

  root.FluxQuizlet = { cards: cards, read: read, message: message, bookmarklet: bookmarklet };
})();
