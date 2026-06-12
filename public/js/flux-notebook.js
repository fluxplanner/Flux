/**
 * flux-notebook.js — Flux Notebook: NotebookLM-style study workspace.
 *
 *   • Sources rail: paste text, search Wikipedia and pull articles in,
 *     import any URL (via the r.jina.ai reader), or reuse Knowledge-base docs.
 *     Checkboxes control what the AI is allowed to see.
 *   • Grounded chat: answers come ONLY from checked sources, with numbered
 *     [n] citations that open the source viewer.
 *   • Studio: one-click Quiz (interactive, graded), Flashcards (flip cards),
 *     Study guide, Summary, FAQ, Timeline — all generated from the sources.
 *
 * Reuses app globals when present: fluxAiSimple (AI), fmtAI (markdown+TeX),
 * FluxKnowledge (doc store), showToast, save/load (synced storage).
 *
 * Public surface: window.FluxNotebook = { open, close, addSource, listSources }
 */
(function () {
  'use strict';

  var KEY = 'flux_notebook_sources';
  var MAX_SOURCES = 25;
  var MAX_SRC_CHARS = 30000;
  var PROMPT_TOTAL = 20000; // keep under free-tier per-request token caps
  var PROMPT_PER_SRC = 9000;

  /* ───────── storage ───────── */

  function lsLoad() {
    try { if (typeof load === 'function') return load(KEY, []) || []; } catch (e) {}
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function lsSave(list) {
    try { if (typeof save === 'function') { save(KEY, list); return; } } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, kind) {
    try { if (typeof showToast === 'function') showToast(msg, kind || 'info'); } catch (e) {}
  }
  function md(raw) {
    try { if (typeof fmtAI === 'function') return fmtAI(String(raw || '')); } catch (e) {}
    return esc(raw).replace(/\n/g, '<br>');
  }

  function addSource(title, content, kind, url) {
    var list = lsLoad();
    if (list.length >= MAX_SOURCES) throw new Error('Notebook is full (' + MAX_SOURCES + ' sources).');
    var src = {
      id: 'ns_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: String(title || 'Untitled source').slice(0, 140),
      kind: kind || 'paste',
      url: String(url || ''),
      content: String(content || '').slice(0, MAX_SRC_CHARS),
      checked: true,
      addedAt: new Date().toISOString(),
    };
    list.push(src);
    lsSave(list);
    return src;
  }

  function checkedSources() {
    return lsLoad().filter(function (s) { return s.checked !== false; });
  }

  /** Numbered source context for prompts. Returns { text, srcs }. */
  function sourceContext() {
    var srcs = checkedSources();
    var budget = PROMPT_TOTAL;
    var parts = [];
    srcs.forEach(function (s, i) {
      if (budget <= 0) return;
      var chunk = String(s.content || '').slice(0, Math.min(PROMPT_PER_SRC, budget));
      budget -= chunk.length;
      parts.push('[SOURCE ' + (i + 1) + '] "' + s.title + '"\n' + chunk);
    });
    return { text: parts.join('\n\n---\n\n'), srcs: srcs };
  }

  function ai(system, user, opts) {
    if (typeof fluxAiSimple !== 'function') return Promise.reject(new Error('Flux AI is not loaded yet.'));
    return fluxAiSimple(system, user, opts);
  }

  /* ───────── external source loaders ───────── */

  function wikiSearch(q) {
    return fetch('https://en.wikipedia.org/w/rest.php/v1/search/page?q=' + encodeURIComponent(q) + '&limit=6')
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j.pages || []).map(function (p) { return { title: p.title, desc: p.description || (p.excerpt || '').replace(/<[^>]+>/g, '') }; }); });
  }

  function wikiFetch(title) {
    var u = 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&origin=*&redirects=1&titles=' + encodeURIComponent(title);
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      var pages = j.query && j.query.pages || {};
      var first = pages[Object.keys(pages)[0]];
      if (!first || !first.extract) throw new Error('No article text found.');
      return { title: first.title, content: first.extract };
    });
  }

  function urlFetch(url) {
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return fetch('https://r.jina.ai/' + url, { headers: { 'X-Return-Format': 'text' } })
      .then(function (r) {
        if (!r.ok) throw new Error('Could not read that page (' + r.status + ').');
        return r.text();
      })
      .then(function (t) { return { title: url.replace(/^https?:\/\//, '').slice(0, 80), content: t }; });
  }

  /* ───────── overlay UI ───────── */

  var chatLog = []; // session-only [{role, content}]

  function open() {
    close();
    var ov = document.createElement('div');
    ov.id = 'fnbOverlay';
    ov.innerHTML =
      '<div class="fnb" role="dialog" aria-label="Flux Notebook">' +
        '<header class="fnb-top">' +
          '<div class="fnb-brand"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Flux Notebook</div>' +
          '<button class="fnb-x" id="fnbClose" aria-label="Close">✕</button>' +
        '</header>' +
        '<div class="fnb-cols">' +
          '<aside class="fnb-sources">' +
            '<div class="fnb-col-head">Sources <button class="fnb-mini" id="fnbAddSrc">+ Add</button></div>' +
            '<div class="fnb-src-list" id="fnbSrcList"></div>' +
          '</aside>' +
          '<main class="fnb-chat">' +
            '<div class="fnb-msgs" id="fnbMsgs">' +
              '<div class="fnb-hello" id="fnbHello"><h3>Ask your sources anything.</h3><p>Answers come only from the sources you check, with citations. Add a source to get started.</p></div>' +
            '</div>' +
            '<div class="fnb-composer">' +
              '<textarea id="fnbInput" rows="1" placeholder="Ask about your sources…"></textarea>' +
              '<button id="fnbSend" class="fnb-send" aria-label="Send"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>' +
            '</div>' +
          '</main>' +
          '<aside class="fnb-studio">' +
            '<div class="fnb-col-head">Studio</div>' +
            '<button class="fnb-gen" data-gen="quiz">Quiz me</button>' +
            '<button class="fnb-gen" data-gen="flashcards">Flashcards</button>' +
            '<button class="fnb-gen" data-gen="guide">Study guide</button>' +
            '<button class="fnb-gen" data-gen="summary">Summary</button>' +
            '<button class="fnb-gen" data-gen="faq">FAQ</button>' +
            '<button class="fnb-gen" data-gen="timeline">Timeline</button>' +
          '</aside>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    renderSources();
    wire(ov);
  }

  function close() {
    var ov = document.getElementById('fnbOverlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', escClose);
  }
  function escClose(e) { if (e.key === 'Escape' && !document.getElementById('fnbModal')) close(); }

  var KIND_ICON = { wiki: 'W', paste: '¶', knowledge: '◆' };

  function renderSources() {
    var el = document.getElementById('fnbSrcList');
    if (!el) return;
    var list = lsLoad();
    el.innerHTML = list.length
      ? list.map(function (s) {
          return '<div class="fnb-src" data-id="' + esc(s.id) + '">' +
            '<input type="checkbox" class="fnb-src-chk" ' + (s.checked !== false ? 'checked' : '') + ' aria-label="Include source">' +
            '<button class="fnb-src-open" title="View source"><span class="fnb-src-kind fnb-k-' + esc(s.kind) + '">' + (s.kind === 'url' ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>' : esc(KIND_ICON[s.kind] || '¶')) + '</span>' +
            '<span class="fnb-src-title">' + esc(s.title) + '</span></button>' +
            '<button class="fnb-src-del" title="Remove">✕</button>' +
          '</div>';
        }).join('')
      : '<div class="fnb-empty">No sources yet.<br>Add notes, a Wikipedia article, or a link.</div>';
  }

  /* ───────── add-source modal ───────── */

  function openAddModal() {
    closeModal();
    var m = document.createElement('div');
    m.id = 'fnbModal';
    m.innerHTML =
      '<div class="fnb-modal">' +
        '<div class="fnb-modal-head">Add a source <button class="fnb-x" id="fnbModalClose">✕</button></div>' +
        '<div class="fnb-tabs">' +
          '<button class="fnb-tab active" data-t="search">Search</button>' +
          '<button class="fnb-tab" data-t="paste">Paste text</button>' +
          '<button class="fnb-tab" data-t="url">From URL</button>' +
          '<button class="fnb-tab" data-t="kb">My knowledge</button>' +
        '</div>' +
        '<div class="fnb-tab-body" id="fnbTabBody"></div>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.id === 'fnbModalClose') return closeModal();
      var tab = e.target.closest('.fnb-tab');
      if (tab) {
        m.querySelectorAll('.fnb-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
        renderTab(tab.getAttribute('data-t'));
      }
    });
    renderTab('search');
  }
  function closeModal() { var m = document.getElementById('fnbModal'); if (m) m.remove(); }

  function renderTab(t) {
    var b = document.getElementById('fnbTabBody');
    if (!b) return;
    if (t === 'search') {
      b.innerHTML = '<div class="fnb-row"><input id="fnbQ" placeholder="Search Wikipedia for a topic…"><button class="fnb-btn" id="fnbQGo">Search</button></div><div id="fnbQRes" class="fnb-results"></div>';
      var go = function () {
        var q = (document.getElementById('fnbQ').value || '').trim();
        if (!q) return;
        var res = document.getElementById('fnbQRes');
        res.innerHTML = '<div class="fnb-empty">Searching…</div>';
        wikiSearch(q).then(function (hits) {
          res.innerHTML = hits.length
            ? hits.map(function (h) { return '<button class="fnb-result" data-title="' + esc(h.title) + '"><b>' + esc(h.title) + '</b><span>' + esc(h.desc || '') + '</span></button>'; }).join('')
            : '<div class="fnb-empty">No results.</div>';
        }).catch(function () { res.innerHTML = '<div class="fnb-empty">Search failed — check your connection.</div>'; });
      };
      document.getElementById('fnbQGo').addEventListener('click', go);
      document.getElementById('fnbQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      b.addEventListener('click', function (e) {
        var r = e.target.closest('.fnb-result');
        if (!r) return;
        r.disabled = true; r.style.opacity = '0.5';
        wikiFetch(r.getAttribute('data-title')).then(function (a) {
          addSource(a.title, a.content, 'wiki', 'https://en.wikipedia.org/wiki/' + encodeURIComponent(a.title));
          renderSources(); closeModal(); toast('Added "' + a.title + '"', 'success');
        }).catch(function (err) { toast(err.message, 'error'); r.disabled = false; r.style.opacity = ''; });
      });
    } else if (t === 'paste') {
      b.innerHTML = '<input id="fnbPT" placeholder="Title"><textarea id="fnbPC" rows="7" placeholder="Paste notes, an article, a chapter…"></textarea><div class="fnb-row fnb-row--end"><button class="fnb-btn" id="fnbPGo">Add source</button></div>';
      document.getElementById('fnbPGo').addEventListener('click', function () {
        var c = document.getElementById('fnbPC').value;
        if (!c.trim()) return;
        addSource(document.getElementById('fnbPT').value.trim() || c.trim().slice(0, 60), c, 'paste');
        renderSources(); closeModal(); toast('Source added', 'success');
      });
    } else if (t === 'url') {
      b.innerHTML = '<div class="fnb-row"><input id="fnbU" placeholder="https://example.com/article"><button class="fnb-btn" id="fnbUGo">Import</button></div><div class="fnb-empty" id="fnbUMsg"></div>';
      document.getElementById('fnbUGo').addEventListener('click', function () {
        var u = (document.getElementById('fnbU').value || '').trim();
        if (!u) return;
        document.getElementById('fnbUMsg').textContent = 'Reading the page…';
        urlFetch(u).then(function (a) {
          addSource(a.title, a.content, 'url', u);
          renderSources(); closeModal(); toast('Imported', 'success');
        }).catch(function (err) { document.getElementById('fnbUMsg').textContent = err.message; });
      });
    } else if (t === 'kb') {
      var docs = [];
      try { docs = (window.FluxKnowledge && FluxKnowledge.list()) || []; } catch (e) {}
      b.innerHTML = docs.length
        ? docs.map(function (d) { return '<button class="fnb-result" data-kid="' + esc(d.id) + '"><b>' + esc(d.title) + '</b><span>' + esc(String(d.content).slice(0, 90)) + '…</span></button>'; }).join('')
        : '<div class="fnb-empty">Your knowledge base is empty. Add docs via the Knowledge button in AI chat.</div>';
      b.addEventListener('click', function (e) {
        var r = e.target.closest('[data-kid]');
        if (!r) return;
        var d = docs.filter(function (x) { return x.id === r.getAttribute('data-kid'); })[0];
        if (!d) return;
        addSource(d.title, d.content, 'knowledge');
        renderSources(); closeModal(); toast('Added from knowledge base', 'success');
      });
    }
  }

  /* ───────── source viewer ───────── */

  function viewSource(id) {
    var s = lsLoad().filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    closeModal();
    var m = document.createElement('div');
    m.id = 'fnbModal';
    m.innerHTML =
      '<div class="fnb-modal fnb-modal--viewer">' +
        '<div class="fnb-modal-head"><span>' + esc(s.title) + '</span>' +
          (s.url ? '<a class="fnb-srclink" href="' + esc(s.url) + '" target="_blank" rel="noopener">open original ↗</a>' : '') +
          '<button class="fnb-x" id="fnbModalClose">✕</button></div>' +
        '<div class="fnb-viewer-body">' + esc(s.content).replace(/\n/g, '<br>') + '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.id === 'fnbModalClose') closeModal();
    });
  }

  /* ───────── grounded chat ───────── */

  function appendMsgEl(role, html) {
    var hello = document.getElementById('fnbHello');
    if (hello) hello.remove();
    var wrap = document.getElementById('fnbMsgs');
    var div = document.createElement('div');
    div.className = 'fnb-msg ' + role;
    div.innerHTML = html;
    wrap.appendChild(div);
    wrap.scrollTop = wrap.scrollHeight;
    return div;
  }

  function citeify(html, srcs) {
    return html.replace(/\[(\d{1,2})\]/g, function (m0, n) {
      var s = srcs[+n - 1];
      if (!s) return m0;
      return '<button class="fnb-cite" data-src="' + esc(s.id) + '" title="' + esc(s.title) + '">' + n + '</button>';
    });
  }

  function sendChat() {
    var input = document.getElementById('fnbInput');
    var q = (input.value || '').trim();
    if (!q) return;
    var ctx = sourceContext();
    if (!ctx.srcs.length) { toast('Add (and check) at least one source first.', 'warning'); return; }
    input.value = '';
    appendMsgEl('user', esc(q));
    var thinking = appendMsgEl('bot', '<span class="fnb-think">●●●</span>');
    chatLog.push({ role: 'user', content: q });
    var history = chatLog.slice(-8).map(function (m) { return m.role.toUpperCase() + ': ' + m.content; }).join('\n');
    var system =
      'You are Flux Notebook. Answer ONLY from the numbered sources below. Cite every claim with [n] right after it. ' +
      'If the sources do not contain the answer, say so plainly and suggest what source to add. Be concise, use markdown.\n\n' + ctx.text;
    ai(system, history)
      .then(function (out) {
        chatLog.push({ role: 'assistant', content: out });
        thinking.innerHTML = citeify(md(out), ctx.srcs);
        var wrap = document.getElementById('fnbMsgs');
        if (wrap) wrap.scrollTop = wrap.scrollHeight;
      })
      .catch(function (e) { thinking.innerHTML = '<span class="fnb-err">' + esc(e.message) + '</span>'; });
  }

  /* ───────── studio generators ───────── */

  var GEN = {
    flashcards: {
      label: 'Flashcards',
      sys: 'Create 10-14 flashcards covering the most testable content in the sources. Respond ONLY with JSON: {"cards":[{"q":"…","a":"…"}]}',
      json: true,
    },
    guide: { label: 'Study guide', sys: 'Write a tight study guide of the sources: key concepts with one-line explanations, must-know formulas/dates/terms, and 3 likely exam questions at the end. Use markdown headings and cite sources [n].' },
    summary: { label: 'Summary', sys: 'Summarize the sources in at most 250 words. Lead with the single most important idea. Cite sources [n].' },
    faq: { label: 'FAQ', sys: 'Write the 6-8 questions a student would most likely ask about the sources, each with a 1-3 sentence answer. Markdown, cite [n].' },
    timeline: { label: 'Timeline', sys: 'Extract a chronological timeline from the sources (date or sequence → event, one line each, markdown list). If the content is not chronological, organize it as an ordered learning path instead. Cite [n].' },
  };

  function runGenerator(kind) {
    var ctx = sourceContext();
    if (!ctx.srcs.length) { toast('Add (and check) at least one source first.', 'warning'); return; }
    if (kind === 'quiz') return runQuiz(ctx);
    var g = GEN[kind];
    if (!g) return;
    var holder = appendMsgEl('bot', '<div class="fnb-gen-head">' + esc(g.label) + '</div><span class="fnb-think">●●●</span>');
    ai(g.sys + '\n\nSOURCES:\n' + ctx.text, 'Generate the ' + g.label.toLowerCase() + ' now.', g.json ? { responseFormat: 'json_object' } : undefined)
      .then(function (out) {
        if (kind === 'flashcards') return renderFlashcards(holder, out);
        holder.innerHTML = '<div class="fnb-gen-head">' + esc(g.label) + '</div>' + citeify(md(out), ctx.srcs);
      })
      .catch(function (e) { holder.innerHTML = '<span class="fnb-err">' + esc(e.message) + '</span>'; });
  }

  function renderFlashcards(holder, out) {
    var cards = [];
    try { cards = (JSON.parse(out).cards || []); } catch (e) {}
    if (!cards.length) { holder.innerHTML = '<span class="fnb-err">Could not generate flashcards — try again.</span>'; return; }
    holder.innerHTML = '<div class="fnb-gen-head">Flashcards <span class="fnb-dim">(' + cards.length + ' — click to flip)</span></div>' +
      '<div class="fnb-cards">' + cards.map(function (c) {
        return '<button class="fnb-card"><span class="fnb-card-q">' + esc(c.q) + '</span><span class="fnb-card-a">' + esc(c.a) + '</span></button>';
      }).join('') + '</div>';
  }

  function runQuiz(ctx) {
    var holder = appendMsgEl('bot', '<div class="fnb-gen-head">Quiz</div><span class="fnb-think">●●●</span>');
    var sys = 'Create a quiz of 6 multiple-choice questions from the sources, mixing difficulty. Respond ONLY with JSON: ' +
      '{"questions":[{"q":"…","options":["…","…","…","…"],"answer":0,"why":"one-line explanation"}]} where answer is the index of the correct option.' +
      '\n\nSOURCES:\n' + ctx.text;
    ai(sys, 'Generate the quiz now as json.', { responseFormat: 'json_object' })
      .then(function (out) {
        var qs = [];
        try { qs = JSON.parse(out).questions || []; } catch (e) {}
        qs = qs.filter(function (q) { return q && q.q && Array.isArray(q.options) && q.options.length >= 2; });
        if (!qs.length) { holder.innerHTML = '<span class="fnb-err">Quiz generation failed — try again.</span>'; return; }
        holder.innerHTML = '<div class="fnb-gen-head">Quiz <span class="fnb-dim">(' + qs.length + ' questions)</span></div>' +
          qs.map(function (q, qi) {
            return '<div class="fnb-quiz-q" data-answer="' + (+q.answer || 0) + '">' +
              '<div class="fnb-quiz-text">' + (qi + 1) + '. ' + esc(q.q) + '</div>' +
              q.options.map(function (o, oi) {
                return '<button class="fnb-quiz-opt" data-oi="' + oi + '">' + esc(o) + '</button>';
              }).join('') +
              '<div class="fnb-quiz-why" hidden>' + esc(q.why || '') + '</div>' +
            '</div>';
          }).join('') +
          '<div class="fnb-quiz-score" hidden>Score: <b class="fnb-quiz-n">0</b>/' + qs.length + '</div>';
      })
      .catch(function (e) { holder.innerHTML = '<span class="fnb-err">' + esc(e.message) + '</span>'; });
  }

  /* ───────── event wiring ───────── */

  function wire(ov) {
    document.addEventListener('keydown', escClose);
    ov.addEventListener('click', function (e) {
      if (e.target.id === 'fnbClose') return close();
      if (e.target.id === 'fnbAddSrc') return openAddModal();
      if (e.target.id === 'fnbSend' || e.target.closest('#fnbSend')) return sendChat();

      var gen = e.target.closest('.fnb-gen');
      if (gen) return runGenerator(gen.getAttribute('data-gen'));

      var cite = e.target.closest('.fnb-cite');
      if (cite) return viewSource(cite.getAttribute('data-src'));

      var row = e.target.closest('.fnb-src');
      if (row) {
        var id = row.getAttribute('data-id');
        if (e.target.closest('.fnb-src-del')) {
          lsSave(lsLoad().filter(function (s) { return s.id !== id; }));
          renderSources();
          return;
        }
        if (e.target.classList.contains('fnb-src-chk')) {
          var list = lsLoad();
          list.forEach(function (s) { if (s.id === id) s.checked = e.target.checked; });
          lsSave(list);
          return;
        }
        if (e.target.closest('.fnb-src-open')) return viewSource(id);
      }

      var card = e.target.closest('.fnb-card');
      if (card) return card.classList.toggle('flipped');

      var opt = e.target.closest('.fnb-quiz-opt');
      if (opt) {
        var qEl = opt.closest('.fnb-quiz-q');
        if (qEl.classList.contains('done')) return;
        qEl.classList.add('done');
        var right = +qEl.getAttribute('data-answer');
        qEl.querySelectorAll('.fnb-quiz-opt').forEach(function (b, i) {
          b.disabled = true;
          if (i === right) b.classList.add('right');
        });
        if (+opt.getAttribute('data-oi') !== right) opt.classList.add('wrong');
        var why = qEl.querySelector('.fnb-quiz-why');
        if (why && why.textContent) why.hidden = false;
        var box = qEl.parentElement;
        var all = box.querySelectorAll('.fnb-quiz-q');
        var done = box.querySelectorAll('.fnb-quiz-q.done');
        if (all.length === done.length) {
          var correct = 0;
          done.forEach(function (qq) { if (!qq.querySelector('.fnb-quiz-opt.wrong')) correct++; });
          var sc = box.querySelector('.fnb-quiz-score');
          if (sc) { sc.hidden = false; sc.querySelector('.fnb-quiz-n').textContent = correct; }
        }
        return;
      }
    });
    var input = ov.querySelector('#fnbInput');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
  }

  window.FluxNotebook = {
    open: open,
    close: close,
    addSource: addSource,
    listSources: lsLoad,
    _wikiSearch: wikiSearch,
  };
})();
