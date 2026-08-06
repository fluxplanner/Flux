/**
 * flux-teacher-resources.js — Teaching Resources tab (work mode, teachers).
 *
 * A curated catalog of free / open-educational-resource (OER) teaching sites
 * plus a no-key web search (CORS proxy → DuckDuckGo HTML, with a Wikipedia +
 * DDG instant-answer fallback so results always appear). Renders into the
 * #teacherResources panel via window.renderTeacherResources(). Self-contained.
 */
(function () {
  'use strict';

  /* Curated, genuinely-free teaching resources grouped by category. */
  var CATALOG = [
    {
      cat: 'General & OER', items: [
        { n: 'OER Commons', u: 'https://www.oercommons.org/', d: 'Huge library of free, openly-licensed lessons & courses.' },
        { n: 'CK-12', u: 'https://www.ck12.org/', d: 'Free customizable textbooks, sims, and practice (FlexBooks).' },
        { n: 'Khan Academy', u: 'https://www.khanacademy.org/', d: 'Free video lessons + practice across subjects, K-college.' },
        { n: 'OpenStax', u: 'https://openstax.org/', d: 'Free, peer-reviewed, openly-licensed textbooks.' },
        { n: 'Curriki', u: 'https://www.curriki.org/', d: 'Free open curricula and lesson collections.' },
      ],
    },
    {
      cat: 'Science', items: [
        { n: 'PhET Simulations', u: 'https://phet.colorado.edu/', d: 'Free interactive math & science sims (CU Boulder).' },
        { n: 'NASA STEM', u: 'https://www.nasa.gov/stem/', d: 'Free STEM lessons, activities, and media.' },
        { n: 'HHMI BioInteractive', u: 'https://www.biointeractive.org/', d: 'Free, classroom-ready biology resources & data.' },
        { n: 'Smithsonian Learning Lab', u: 'https://learninglab.si.edu/', d: 'Millions of free museum resources to build lessons.' },
      ],
    },
    {
      cat: 'Mathematics', items: [
        { n: 'Desmos Classroom', u: 'https://teacher.desmos.com/', d: 'Free interactive math activities + graphing.' },
        { n: 'Illustrative Mathematics', u: 'https://www.illustrativemathematics.org/', d: 'Free problem-based K-12 math curriculum.' },
        { n: 'NRICH', u: 'https://nrich.maths.org/', d: 'Free rich math problems & investigations (Cambridge).' },
      ],
    },
    {
      cat: 'English / Language Arts', items: [
        { n: 'CommonLit', u: 'https://www.commonlit.org/', d: 'Free reading passages with questions, grades 3-12.' },
        { n: 'ReadWriteThink', u: 'https://www.readwritethink.org/', d: 'Free literacy lessons & student tools (NCTE).' },
        { n: 'Project Gutenberg', u: 'https://www.gutenberg.org/', d: '70,000+ free public-domain ebooks for class texts.' },
      ],
    },
    {
      cat: 'Social Studies & History', items: [
        { n: 'Library of Congress', u: 'https://www.loc.gov/programs/teachers/', d: 'Free primary sources + teaching tools.' },
        { n: 'DocsTeach (Nat. Archives)', u: 'https://www.docsteach.org/', d: 'Free primary-source activities you can assign.' },
        { n: 'iCivics', u: 'https://www.icivics.org/', d: 'Free civics games & lesson plans.' },
      ],
    },
    {
      cat: 'Teaching craft & tools', items: [
        { n: 'Edutopia', u: 'https://www.edutopia.org/', d: 'Free, research-based teaching strategies & ideas.' },
        { n: 'Common Sense Education', u: 'https://www.commonsense.org/education/', d: 'Free edtech reviews & digital-citizenship lessons.' },
        { n: 'Pixabay', u: 'https://pixabay.com/', d: 'Free, no-attribution images for slides & handouts.' },
      ],
    },
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ── no-key web search (same robust approach as the notebook) ── */
  function proxyText(targetUrl) {
    var enc = encodeURIComponent(targetUrl);
    var eps = ['https://corsproxy.io/?url=' + enc, 'https://api.allorigins.win/raw?url=' + enc];
    var i = 0;
    function next() {
      if (i >= eps.length) return Promise.reject(new Error('proxy down'));
      var ctrl = ('AbortController' in window) ? new AbortController() : null;
      var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
      return fetch(eps[i++], ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('s' + r.status); return r.text(); })
        .catch(function () { clearTimeout(t); return next(); });
    }
    return next();
  }
  function ddgInstant(q) {
    return fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1')
      .then(function (r) { return r.json(); }).then(function (j) {
        var rows = [];
        if (j.AbstractURL) rows.push({ title: j.Heading || q, url: j.AbstractURL, desc: (j.AbstractText || '').slice(0, 160) });
        (function walk(list) { (list || []).forEach(function (t) { if (rows.length >= 8) return; if (t.FirstURL && t.Text) rows.push({ title: t.Text.split(' - ')[0].slice(0, 90), url: t.FirstURL, desc: t.Text.slice(0, 160) }); else if (t.Topics) walk(t.Topics); }); })(j.RelatedTopics);
        return rows;
      });
  }
  function wikiResults(q) {
    return fetch('https://en.wikipedia.org/w/rest.php/v1/search/page?q=' + encodeURIComponent(q) + '&limit=8')
      .then(function (r) { return r.json(); }).then(function (j) {
        return (j.pages || []).map(function (p) { return { title: p.title, url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.key || p.title), desc: (p.description || '').slice(0, 160) }; });
      });
  }
  function fallback(q) {
    return Promise.all([ddgInstant(q).catch(function () { return []; }), wikiResults(q).catch(function () { return []; })])
      .then(function (parts) { var seen = {}, out = []; parts[0].concat(parts[1]).forEach(function (x) { if (out.length >= 8 || !x || !x.url || seen[x.url]) return; seen[x.url] = 1; out.push(x); }); return out; });
  }
  function webSearch(q) {
    var ddg = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q);
    return proxyText(ddg).then(function (html) {
      var rows = [];
      try {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('.result__a').forEach(function (a) {
          if (rows.length >= 8) return;
          var href = a.getAttribute('href') || ''; var m = href.match(/[?&]uddg=([^&]+)/);
          var real = m ? decodeURIComponent(m[1]) : href; if (real.indexOf('//') === 0) real = 'https:' + real;
          var card = (a.closest && a.closest('.result')) || a.parentNode; var snip = card && card.querySelector ? card.querySelector('.result__snippet') : null;
          rows.push({ title: (a.textContent || real).trim(), url: real, desc: ((snip && snip.textContent) || '').trim().slice(0, 160) });
        });
      } catch (e) {}
      rows = rows.filter(function (x) { return /^https?:\/\//.test(x.url); });
      return rows.length ? rows : fallback(q);
    }).catch(function () { return fallback(q); });
  }

  function catalogHtml() {
    return CATALOG.map(function (g) {
      return '<section class="ftr-group"><h2 class="ftr-cat">' + esc(g.cat) + '</h2><div class="ftr-grid">' +
        g.items.map(function (it) {
          return '<a class="ftr-card" href="' + esc(it.u) + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="ftr-card-name">' + esc(it.n) + '</span>' +
            '<span class="ftr-card-desc">' + esc(it.d) + '</span>' +
            '<span class="ftr-card-host">' + esc((it.u.split('/')[2] || '').replace(/^www\./, '')) + ' ↗</span></a>';
        }).join('') + '</div></section>';
    }).join('');
  }

  function render() {
    var panel = document.getElementById('teacherResources');
    if (!panel) return;
    panel.innerHTML =
      '<header class="flux-page-header flux-page-header--lead">' +
        '<h1 class="flux-page-title">Teaching Resources</h1>' +
        '<p class="flux-page-sub">Free, classroom-ready resources from across the web — curated, plus search.</p>' +
      '</header>' +
      '<div class="ftr-search"><input id="ftrQ" type="search" placeholder="Search the web for lessons, worksheets, primary sources…" aria-label="Search teaching resources"><button type="button" class="ftr-search-btn" id="ftrGo">Search</button></div>' +
      '<div id="ftrResults" class="ftr-results" hidden></div>' +
      '<div class="ftr-catalog">' + catalogHtml() + '</div>';

    var q = panel.querySelector('#ftrQ'), go = panel.querySelector('#ftrGo'), res = panel.querySelector('#ftrResults');
    function run() {
      var term = (q.value || '').trim();
      if (!term) { res.hidden = true; res.innerHTML = ''; return; }
      res.hidden = false;
      res.innerHTML = '<div class="ftr-note">Searching the web…</div>';
      webSearch(term).then(function (hits) {
        res.innerHTML = hits.length
          ? '<div class="ftr-results-head">Web results for “' + esc(term) + '”</div>' + hits.map(function (h) {
              return '<a class="ftr-result" href="' + esc(h.url) + '" target="_blank" rel="noopener noreferrer"><span class="ftr-result-title">' + esc(h.title) + '</span><span class="ftr-result-desc">' + esc(h.desc || h.url) + '</span><span class="ftr-result-host">' + esc((h.url.split('/')[2] || '').replace(/^www\./, '')) + ' ↗</span></a>';
            }).join('')
          : '<div class="ftr-note">No results — try different keywords.</div>';
      }).catch(function () { res.innerHTML = '<div class="ftr-note">Search is unavailable right now — the curated resources below still work.</div>'; });
    }
    go.addEventListener('click', run);
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
  }

  window.renderTeacherResources = render;
})();
