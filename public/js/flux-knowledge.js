/**
 * flux-knowledge.js — Flux's personal knowledge base ("train it with YOUR data").
 *
 * Students paste class notes, formula sheets, rubrics, worked examples.
 * Docs are stored in synced user data (save/load → Supabase user_data blob)
 * and the most relevant ones are injected into the AI system prompt at
 * answer time — retrieval, not weight training: the only way "teach the AI
 * my class" actually works at this scale.
 *
 * Public surface (window.FluxKnowledge):
 *   appendToSystem(system, userText) → system + matched docs
 *   openManager()                    → add/list/delete UI
 *   add(title, content, subject)     → programmatic add (agent tools, tests)
 *   list() / remove(id) / search(query)
 */
(function () {
  'use strict';

  var KEY = 'flux_knowledge_docs';
  var MAX_DOCS = 40;
  var MAX_DOC_CHARS = 24000;
  var INJECT_DOC_CHARS = 2200;   // per doc
  var INJECT_TOTAL_CHARS = 5000; // per prompt
  var TOP_K = 3;

  var STOP = {};
  ('the a an and or of to in on for with is are was be been this that it as at by from ' +
   'what how why when where which who can could should would do does did my your our')
    .split(' ').forEach(function (w) { STOP[w] = 1; });

  function lsLoad() {
    try {
      if (typeof load === 'function') return load(KEY, []) || [];
    } catch (e) {}
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function lsSave(docs) {
    try {
      if (typeof save === 'function') { save(KEY, docs); return; }
    } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(docs)); } catch (e) {}
  }

  function tokens(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(function (t) { return t.length > 2 && !STOP[t]; });
  }

  /** Score a doc against query tokens: presence-weighted, title hits 3x. */
  function scoreDoc(doc, qTokens) {
    if (!qTokens.length) return 0;
    var body = ' ' + String(doc.content || '').toLowerCase() + ' ';
    var title = ' ' + String(doc.title || '').toLowerCase() + ' ' +
                String(doc.subject || '').toLowerCase() + ' ';
    var score = 0;
    for (var i = 0; i < qTokens.length; i++) {
      var t = qTokens[i];
      if (title.indexOf(t) >= 0) score += 3;
      if (body.indexOf(' ' + t) >= 0) score += 1;
    }
    return score;
  }

  /** Slice the doc around the first query hit so the relevant part survives the cap. */
  function excerpt(doc, qTokens) {
    var c = String(doc.content || '');
    if (c.length <= INJECT_DOC_CHARS) return c;
    var lower = c.toLowerCase();
    var pos = -1;
    for (var i = 0; i < qTokens.length && pos < 0; i++) pos = lower.indexOf(qTokens[i]);
    if (pos < 0) pos = 0;
    var start = Math.max(0, pos - Math.floor(INJECT_DOC_CHARS / 3));
    return (start > 0 ? '…' : '') + c.slice(start, start + INJECT_DOC_CHARS) + '…';
  }

  function search(query, k) {
    var q = tokens(query);
    return lsLoad()
      .map(function (d) { return { doc: d, score: scoreDoc(d, q) }; })
      .filter(function (r) { return r.score >= 2; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, k || TOP_K);
  }

  function appendToSystem(system, userText) {
    try {
      var hits = search(userText, TOP_K);
      if (!hits.length) return system;
      var q = tokens(userText);
      var parts = [];
      var budget = INJECT_TOTAL_CHARS;
      hits.forEach(function (r) {
        if (budget <= 0) return;
        var ex = excerpt(r.doc, q).slice(0, budget);
        budget -= ex.length;
        parts.push('### ' + (r.doc.title || 'Untitled') +
          (r.doc.subject ? ' (' + r.doc.subject + ')' : '') + '\n' + ex);
      });
      return system +
        '\n\n<knowledge_base>\nThe student saved these class materials. Prefer their definitions, formulas, and conventions when answering:\n\n' +
        parts.join('\n\n') + '\n</knowledge_base>';
    } catch (e) {
      return system;
    }
  }

  function add(title, content, subject) {
    var docs = lsLoad();
    if (docs.length >= MAX_DOCS) throw new Error('Knowledge base is full (' + MAX_DOCS + ' docs). Delete something first.');
    var doc = {
      id: 'kd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: String(title || 'Untitled').slice(0, 120),
      subject: String(subject || '').slice(0, 60),
      content: String(content || '').slice(0, MAX_DOC_CHARS),
      addedAt: new Date().toISOString(),
    };
    docs.push(doc);
    lsSave(docs);
    return doc;
  }

  function remove(id) {
    lsSave(lsLoad().filter(function (d) { return d.id !== id; }));
  }

  /* ───────── Manager UI ───────── */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function openManager() {
    closeManager();
    var ov = document.createElement('div');
    ov.id = 'fkbOverlay';
    ov.innerHTML =
      '<div class="fkb-modal" role="dialog" aria-label="Flux knowledge base">' +
        '<div class="fkb-head">' +
          '<div><div class="fkb-title">Knowledge base</div>' +
          '<div class="fkb-sub">Paste notes, formula sheets, rubrics — Flux uses them when they match your question.</div></div>' +
          '<button class="fkb-x" id="fkbClose" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="fkb-add">' +
          '<div class="fkb-row">' +
            '<input id="fkbTitle" placeholder="Title (e.g. Physics formula sheet — forces)" maxlength="120">' +
            '<input id="fkbSubject" placeholder="Subject (optional)" maxlength="60">' +
          '</div>' +
          '<textarea id="fkbContent" placeholder="Paste the material here…" rows="6"></textarea>' +
          '<div class="fkb-row fkb-row--end">' +
            '<span class="fkb-count" id="fkbCount">0 / ' + MAX_DOC_CHARS + '</span>' +
            '<button class="fkb-btn" id="fkbAdd">Add to knowledge</button>' +
          '</div>' +
        '</div>' +
        '<div class="fkb-list" id="fkbList"></div>' +
      '</div>';
    document.body.appendChild(ov);

    var renderList = function () {
      var docs = lsLoad();
      var el = document.getElementById('fkbList');
      if (!el) return;
      el.innerHTML = docs.length
        ? docs.slice().reverse().map(function (d) {
            return '<div class="fkb-item">' +
              '<div class="fkb-item-main">' +
                '<div class="fkb-item-title">' + esc(d.title) +
                  (d.subject ? '<span class="fkb-tag">' + esc(d.subject) + '</span>' : '') + '</div>' +
                '<div class="fkb-item-prev">' + esc(String(d.content).slice(0, 140)) + '…</div>' +
              '</div>' +
              '<button class="fkb-del" data-id="' + esc(d.id) + '" title="Delete">✕</button>' +
            '</div>';
          }).join('')
        : '<div class="fkb-empty">Nothing saved yet. Add your first formula sheet or notes above.</div>';
    };
    renderList();

    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.id === 'fkbClose') return closeManager();
      var del = e.target.closest('.fkb-del');
      if (del) { remove(del.getAttribute('data-id')); renderList(); return; }
      if (e.target.id === 'fkbAdd') {
        var t = document.getElementById('fkbTitle');
        var s = document.getElementById('fkbSubject');
        var c = document.getElementById('fkbContent');
        if (!c.value.trim()) { c.focus(); return; }
        try {
          add(t.value.trim() || c.value.trim().slice(0, 60), c.value, s.value.trim());
          t.value = ''; s.value = ''; c.value = '';
          var cnt = document.getElementById('fkbCount');
          if (cnt) cnt.textContent = '0 / ' + MAX_DOC_CHARS;
          renderList();
          try { if (typeof showToast === 'function') showToast('Added — Flux will use it when it matches.', 'success'); } catch (e2) {}
        } catch (err) {
          try { if (typeof showToast === 'function') showToast(err.message, 'error'); } catch (e2) {}
        }
      }
    });
    ov.addEventListener('input', function (e) {
      if (e.target.id === 'fkbContent') {
        var cnt = document.getElementById('fkbCount');
        if (cnt) cnt.textContent = e.target.value.length + ' / ' + MAX_DOC_CHARS;
      }
    });
    document.addEventListener('keydown', escClose);
  }

  function escClose(e) { if (e.key === 'Escape') closeManager(); }
  function closeManager() {
    var ov = document.getElementById('fkbOverlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', escClose);
  }

  window.FluxKnowledge = {
    appendToSystem: appendToSystem,
    openManager: openManager,
    closeManager: closeManager,
    add: add,
    list: lsLoad,
    remove: remove,
    search: search,
  };
})();
