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

  /* ───────── file upload (PDF text + image OCR via vision) ───────── */

  var PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var _pdfjsP = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (_pdfjsP) return _pdfjsP;
    _pdfjsP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = PDFJS_SRC;
      s.onload = function () {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; } catch (e) {}
        res(window.pdfjsLib);
      };
      s.onerror = function () { rej(new Error('Could not load the PDF reader.')); };
      document.head.appendChild(s);
    });
    return _pdfjsP;
  }

  function readArrayBuffer(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(new Error('Could not read the file.')); };
      r.readAsArrayBuffer(file);
    });
  }
  function readDataURL(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(new Error('Could not read the file.')); };
      r.readAsDataURL(file);
    });
  }

  function extractPdfText(file) {
    return loadPdfJs().then(function (pdfjsLib) {
      return readArrayBuffer(file).then(function (buf) {
        return pdfjsLib.getDocument({ data: buf }).promise.then(function (pdf) {
          var pages = Math.min(pdf.numPages, 50);
          var chain = Promise.resolve('');
          for (var i = 1; i <= pages; i++) {
            (function (n) {
              chain = chain.then(function (acc) {
                if (acc.length >= MAX_DOC_CHARS) return acc;
                return pdf.getPage(n).then(function (page) {
                  return page.getTextContent().then(function (tc) {
                    var txt = tc.items.map(function (it) { return it.str; }).join(' ');
                    return acc + '\n' + txt;
                  });
                });
              });
            })(i);
          }
          return chain.then(function (text) { return text.replace(/\s+\n/g, '\n').trim(); });
        });
      });
    });
  }

  /** Image → text via the planner's vision proxy (Flux AI must be loaded). */
  function extractImageText(file) {
    return readDataURL(file).then(function (dataUrl) {
      var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
      if (!m) throw new Error('Unsupported image.');
      var API = window.API || (window.__FluxExtensionAPI && window.__FluxExtensionAPI.API);
      if (!API || !API.ai || typeof window.fluxAuthHeaders !== 'function') {
        throw new Error('Sign in / open Flux AI first so images can be read.');
      }
      return window.fluxAuthHeaders().then(function (headers) {
        return fetch(API.ai, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            system: 'Transcribe everything legible in this image — text, equations, diagram labels, table values. Be literal and complete; output only the transcription.',
            messages: [{ role: 'user', content: 'Transcribe this image for my notes.' }],
            imageBase64: m[2],
            mimeType: m[1],
          }),
        });
      }).then(function (r) { return r.json(); }).then(function (j) {
        return (j && j.content && j.content[0] && j.content[0].text) || '';
      });
    });
  }

  function handleFiles(fileList, onDone) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) { onDone && onDone(); return; }
    var msg = document.getElementById('fkbUpMsg');
    var setMsg = function (t) { if (msg) { msg.hidden = false; msg.textContent = t; } };
    var i = 0;
    function next() {
      if (i >= files.length) { setMsg(files.length + ' file(s) added to knowledge.'); onDone && onDone(); return; }
      var f = files[i++];
      var isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
      var isImg = /^image\//i.test(f.type);
      setMsg('Reading ' + f.name + '… (' + i + '/' + files.length + ')');
      var p = isPdf ? extractPdfText(f) : isImg ? extractImageText(f) : Promise.reject(new Error('Unsupported file type.'));
      p.then(function (text) {
        text = String(text || '').trim();
        if (!text) throw new Error('No readable text found in ' + f.name + '.');
        add(f.name.replace(/\.[^.]+$/, ''), text, isPdf ? 'PDF' : 'Image');
        next();
      }).catch(function (err) {
        setMsg(err.message || ('Could not read ' + f.name));
        next();
      });
    }
    next();
  }

  /* ───────── Manager UI ───────── */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Inner manager markup (shared by the modal + the inline hub tab).
  function managerInnerHtml(inline) {
    return '<div class="fkb-modal' + (inline ? ' fkb-modal--inline' : '') + '" role="dialog" aria-label="Flux knowledge base">' +
        '<div class="fkb-head">' +
          '<div><div class="fkb-title">Knowledge base</div>' +
          '<div class="fkb-sub">Paste notes, formula sheets, rubrics — Flux uses them when they match your question.</div></div>' +
          (inline ? '' : '<button class="fkb-x" id="fkbClose" aria-label="Close">✕</button>') +
        '</div>' +
        '<div class="fkb-add">' +
          '<div class="fkb-row">' +
            '<input id="fkbTitle" placeholder="Title (e.g. Physics formula sheet — forces)" maxlength="120">' +
            '<input id="fkbSubject" placeholder="Subject (optional)" maxlength="60">' +
          '</div>' +
          '<textarea id="fkbContent" placeholder="Paste the material here…" rows="6"></textarea>' +
          '<div class="fkb-row fkb-row--end">' +
            '<span class="fkb-count" id="fkbCount">0 / ' + MAX_DOC_CHARS + '</span>' +
            '<label class="fkb-btn fkb-btn--ghost" id="fkbUploadBtn" tabindex="0">' +
              'Upload PDF / image' +
              '<input type="file" id="fkbFile" accept="application/pdf,image/*" multiple hidden>' +
            '</label>' +
            '<button class="fkb-btn" id="fkbAdd">Add to knowledge</button>' +
          '</div>' +
          '<div class="fkb-upmsg" id="fkbUpMsg" hidden></div>' +
        '</div>' +
        '<div class="fkb-list" id="fkbList"></div>' +
      '</div>';
  }

  // Wire add/list/upload onto a root container (modal or inline hub tab).
  function wireManager(root, onClose) {
    var renderList = function () {
      var docs = lsLoad();
      var el = root.querySelector('#fkbList');
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
    root.addEventListener('click', function (e) {
      if (onClose && (e.target === root || e.target.id === 'fkbClose')) return onClose();
      var del = e.target.closest('.fkb-del');
      if (del) { remove(del.getAttribute('data-id')); renderList(); return; }
      if (e.target.id === 'fkbAdd') {
        var t = root.querySelector('#fkbTitle'), s = root.querySelector('#fkbSubject'), c = root.querySelector('#fkbContent');
        if (!c.value.trim()) { c.focus(); return; }
        try {
          add(t.value.trim() || c.value.trim().slice(0, 60), c.value, s.value.trim());
          t.value = ''; s.value = ''; c.value = '';
          var cnt = root.querySelector('#fkbCount'); if (cnt) cnt.textContent = '0 / ' + MAX_DOC_CHARS;
          renderList();
          try { if (typeof showToast === 'function') showToast('Added — Flux will use it when it matches.', 'success'); } catch (e2) {}
        } catch (err) { try { if (typeof showToast === 'function') showToast(err.message, 'error'); } catch (e2) {} }
      }
    });
    root.addEventListener('input', function (e) {
      if (e.target.id === 'fkbContent') {
        var cnt = root.querySelector('#fkbCount'); if (cnt) cnt.textContent = e.target.value.length + ' / ' + MAX_DOC_CHARS;
      }
    });
    root.addEventListener('change', function (e) {
      if (e.target.id === 'fkbFile') { handleFiles(e.target.files, renderList); e.target.value = ''; }
    });
  }

  // Inline render into a hub tab (no overlay, no close button).
  function renderInline(host) {
    if (!host) return;
    host.innerHTML = managerInnerHtml(true);
    wireManager(host, null);
  }

  function openManager() {
    // Knowledge now lives as its own full panel (the former "Notes" tab). If that
    // inline manager is mounted, route there instead of spawning a duplicate
    // overlay — two managers would share element IDs (#fkbTitle, #fkbList, …).
    if (document.querySelector('.fkb-modal--inline') && typeof window.nav === 'function') {
      closeManager();
      try { window.nav('notes'); return; } catch (e) {}
    }
    closeManager();
    var ov = document.createElement('div');
    ov.id = 'fkbOverlay';
    ov.innerHTML = managerInnerHtml(false);
    document.body.appendChild(ov);
    wireManager(ov, closeManager);
    document.addEventListener('keydown', escClose);
  }

  function escClose(e) { if (e.key === 'Escape') closeManager(); }
  function closeManager() {
    var ov = document.getElementById('fkbOverlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', escClose);
  }

  window.FluxKnowledge = {
    renderInline: renderInline,
    appendToSystem: appendToSystem,
    openManager: openManager,
    closeManager: closeManager,
    add: add,
    list: lsLoad,
    remove: remove,
    search: search,
  };
})();
