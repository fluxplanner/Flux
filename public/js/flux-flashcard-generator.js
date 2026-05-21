/**
 * P27.1 — Flashcard generator from note headings / bullets (local-first).
 * Flag: enable_flashcard_generator (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_flashcard_generator';
  const STORE_KEY = 'flux_flashcard_generator_v1';
  const OVERLAY_ID = 'fluxFlashcardGenOverlay';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  function stripHtml(html) {
    if (typeof window.strip === 'function') return window.strip(html);
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
  }

  function getPrefs() {
    const s = load(STORE_KEY, {});
    return {
      maxCards: s.maxCards || 40,
      generated: s.generated || 0,
    };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('flashcardGenerator', getCloudSlice());
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    const p = getPrefs();
    return { maxCards: p.maxCards, generated: p.generated };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs(data);
  }

  function addCard(cards, seen, q, a) {
    const question = String(q || '').trim();
    const answer = String(a || '').trim();
    if (question.length < 2 || answer.length < 2) return;
    const key = question.toLowerCase() + '|' + answer.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cards.push({ q: question, a: answer.slice(0, 500), source: 'local' });
  }

  function parseNoteToCards(html, noteTitle) {
    const cards = [];
    const seen = new Set();
    const title = noteTitle || T('fcg.default_note');
    const max = getPrefs().maxCards;

    const plain = stripHtml(html);
    plain.split(/\n+/).forEach((line) => {
      const trimmed = line.trim();
      const m = trimmed.match(/^([^:]{2,80}):\s+(.{2,})$/);
      if (m) addCard(cards, seen, m[1], m[2]);
    });

    const root = document.createElement('div');
    root.innerHTML = html || '';

    root.querySelectorAll('h1,h2,h3,h4').forEach((h) => {
      const heading = h.textContent.trim();
      if (!heading) return;
      let answer = '';
      let sib = h.nextElementSibling;
      while (sib && !/^H[1-4]$/i.test(sib.tagName)) {
        if (sib.tagName === 'UL' || sib.tagName === 'OL') break;
        answer += (sib.textContent || '') + ' ';
        sib = sib.nextElementSibling;
      }
      if (answer.trim()) {
        addCard(cards, seen, T('fcg.q_heading', { topic: heading }), answer.trim().slice(0, 400));
      }
      if (sib && (sib.tagName === 'UL' || sib.tagName === 'OL')) {
        sib.querySelectorAll('li').forEach((li) => {
          const t = li.textContent.trim();
          if (!t) return;
          if (t.includes(':')) {
            const idx = t.indexOf(':');
            addCard(cards, seen, t.slice(0, idx).trim(), t.slice(idx + 1).trim());
          } else {
            addCard(cards, seen, T('fcg.q_bullet', { topic: heading, item: t.slice(0, 80) }), t);
          }
        });
      }
    });

    root.querySelectorAll('li').forEach((li) => {
      const t = li.textContent.trim();
      if (!t || !t.includes(':')) return;
      const idx = t.indexOf(':');
      addCard(cards, seen, t.slice(0, idx).trim(), t.slice(idx + 1).trim());
    });

    root.querySelectorAll('strong,b').forEach((b) => {
      const term = b.textContent.trim();
      if (term.length < 2 || term.length > 60) return;
      const parent = b.parentElement;
      if (!parent) return;
      const full = parent.textContent.trim();
      const rest = full.replace(term, '').replace(/^[\s:–-]+/, '').trim();
      if (rest.length >= 2) addCard(cards, seen, term, rest.slice(0, 300));
    });

    if (!cards.length && plain.trim().length > 40) {
      const chunks = plain
        .split(/\n{2,}|(?<=[.!?])\s+/)
        .map((c) => c.trim())
        .filter((c) => c.length > 20);
      chunks.slice(0, 8).forEach((chunk, i) => {
        addCard(cards, seen, T('fcg.q_chunk', { n: i + 1, title }), chunk.slice(0, 280));
      });
    }

    return cards.slice(0, max);
  }

  function applyCardsToNote(cards) {
    if (!cards.length) return false;
    if (typeof window.flashcards !== 'undefined') window.flashcards = cards;
    if (typeof window.fcIndex !== 'undefined') window.fcIndex = 0;
    if (typeof window.fcFlipped !== 'undefined') window.fcFlipped = false;

    const noteId = typeof window.currentNoteId !== 'undefined' ? window.currentNoteId : null;
    if (noteId && typeof window.notes !== 'undefined' && Array.isArray(window.notes)) {
      const n = window.notes.find((x) => x.id === noteId);
      if (n) {
        n.flashcards = cards;
        if (typeof window.save === 'function') window.save('flux_notes', window.notes);
        try {
          if (typeof window.syncKey === 'function') window.syncKey('notes', window.notes);
        } catch (_) {}
      }
    }
    persistPrefs({ generated: getPrefs().generated + 1 });
    if (typeof window.openFlashcards === 'function') window.openFlashcards();
    return true;
  }

  function closePreview() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function openPreview(cards, onAiFallback) {
    closePreview();
    if (!cards.length) {
      const resEl = document.getElementById('aiNoteResult');
      if (resEl) {
        resEl.style.display = 'block';
        resEl.innerHTML = `<div style="font-size:.78rem;color:var(--muted2);margin-bottom:8px">${esc(T('fcg.none_found'))}</div>
<button type="button" class="btn-sec" id="fluxFcgAiFallback">${esc(T('fcg.try_ai'))}</button>`;
        resEl.querySelector('#fluxFcgAiFallback')?.addEventListener('click', () => {
          if (typeof onAiFallback === 'function') onAiFallback();
        });
      } else {
        toast(T('fcg.none_found'), 'warning');
      }
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'flux-fcg-overlay';
    overlay.innerHTML = `<div class="flux-fcg-panel" role="dialog">
  <div class="flux-fcg-head">
    <div style="font-weight:800;font-size:.85rem">${esc(T('fcg.preview_title', { n: cards.length }))}</div>
    <button type="button" data-fcg-close style="background:none;border:none;color:var(--muted);cursor:pointer">✕</button>
  </div>
  <div class="flux-fcg-list">
    ${cards
      .map(
        (c, i) => `<div class="flux-fcg-row">
  <input type="checkbox" checked data-fcg-idx="${i}" id="fcg_${i}" />
  <label for="fcg_${i}">
    <div class="flux-fcg-q">${esc(c.q)}</div>
    <div class="flux-fcg-a">${esc(c.a)}</div>
  </label>
</div>`,
      )
      .join('')}
  </div>
  <div class="flux-fcg-foot">
    <button type="button" class="btn-sec" data-fcg-all>${esc(T('fcg.select_all'))}</button>
    <button type="button" class="btn-sec" data-fcg-none>${esc(T('fcg.select_none'))}</button>
    ${onAiFallback ? `<button type="button" class="btn-sec" data-fcg-ai>${esc(T('fcg.try_ai'))}</button>` : ''}
    <button type="button" class="flux-fcg-study-btn" data-fcg-apply>${esc(T('fcg.study'))}</button>
  </div>
</div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('[data-fcg-close]')?.addEventListener('click', closePreview);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePreview();
    });
    overlay.querySelector('[data-fcg-all]')?.addEventListener('click', () => {
      overlay.querySelectorAll('[data-fcg-idx]').forEach((cb) => {
        cb.checked = true;
      });
    });
    overlay.querySelector('[data-fcg-none]')?.addEventListener('click', () => {
      overlay.querySelectorAll('[data-fcg-idx]').forEach((cb) => {
        cb.checked = false;
      });
    });
    overlay.querySelector('[data-fcg-ai]')?.addEventListener('click', () => {
      closePreview();
      if (onAiFallback) onAiFallback();
    });
    overlay.querySelector('[data-fcg-apply]')?.addEventListener('click', () => {
      const selected = [];
      overlay.querySelectorAll('[data-fcg-idx]').forEach((cb) => {
        if (cb.checked) selected.push(cards[parseInt(cb.getAttribute('data-fcg-idx'), 10)]);
      });
      if (!selected.length) {
        toast(T('fcg.pick_one'), 'warning');
        return;
      }
      closePreview();
      applyCardsToNote(selected);
      toast(T('fcg.applied', { n: selected.length }), 'success');
    });
  }

  function generateLocal() {
    const editor = document.getElementById('noteEditor');
    const html = editor?.innerHTML || '';
    if (!stripHtml(html).trim()) {
      toast(T('fcg.empty_note'), 'warning');
      return;
    }
    const title = document.getElementById('noteTitleInput')?.value?.trim() || '';
    const cards = parseNoteToCards(html, title);
    const aiOrig = window.generateFlashcardsFromNote?._fluxFcgOrig;
    openPreview(cards, aiOrig ? () => aiOrig() : null);
  }

  function studyNoteCards() {
    const noteId = typeof window.currentNoteId !== 'undefined' ? window.currentNoteId : null;
    if (!noteId || !Array.isArray(window.notes)) return;
    const n = window.notes.find((x) => x.id === noteId);
    if (!n?.flashcards?.length) {
      toast(T('fcg.no_saved'), 'warning');
      return;
    }
    window.flashcards = n.flashcards;
    window.fcIndex = 0;
    window.fcFlipped = false;
    if (typeof window.openFlashcards === 'function') window.openFlashcards();
  }

  function shuffleFlashcards() {
    if (!Array.isArray(window.flashcards) || window.flashcards.length < 2) return;
    const arr = [...window.flashcards];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    window.flashcards = arr;
    window.fcIndex = 0;
    window.fcFlipped = false;
    if (typeof window.renderFC === 'function') window.renderFC();
    toast(T('fcg.shuffled'), 'info');
  }

  function enhanceFlashcardView() {
    const view = document.getElementById('flashcardView');
    if (!view || view.querySelector('.flux-fcg-shuffle')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-sec flux-fcg-shuffle';
    btn.textContent = T('fcg.shuffle');
    btn.addEventListener('click', shuffleFlashcards);
    const progress = document.getElementById('fcProgress');
    if (progress) progress.insertAdjacentElement('afterend', btn);
  }

  function enhanceNotesToolbar() {
    const toolbar = document.querySelector('#notesEditorView [onclick*="generateFlashcardsFromNote"]')?.parentElement;
    if (!toolbar || document.getElementById('fluxFcgStudyBtn')) return;

    const genBtn = toolbar.querySelector('[onclick*="generateFlashcardsFromNote"]');
    if (genBtn) genBtn.textContent = '🃏 ' + T('fcg.generate');

    const studyBtn = document.createElement('button');
    studyBtn.id = 'fluxFcgStudyBtn';
    studyBtn.type = 'button';
    studyBtn.className = 'btn-sec';
    studyBtn.style.cssText = 'padding:6px 12px;font-size:.78rem';
    studyBtn.textContent = '🃏 ' + T('fcg.study_saved');
    studyBtn.addEventListener('click', studyNoteCards);
    if (genBtn) genBtn.insertAdjacentElement('afterend', studyBtn);
  }

  function wrapGenerateFlashcards() {
    const orig = window.generateFlashcardsFromNote;
    if (typeof orig !== 'function' || orig._fluxFcgWrapped) return;
    const wrapped = function () {
      if (enabled()) return generateLocal();
      return orig.apply(this, arguments);
    };
    wrapped._fluxFcgWrapped = true;
    wrapped._fluxFcgOrig = orig;
    window.generateFlashcardsFromNote = wrapped;
  }

  function wrapOpenFlashcards() {
    const orig = window.openFlashcards;
    if (typeof orig !== 'function' || orig._fluxFcgWrapped) return;
    window.openFlashcards = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) enhanceFlashcardView();
      } catch (_) {}
      return r;
    };
    window.openFlashcards._fluxFcgWrapped = true;
  }

  function wrapOpenNote() {
    const orig = window.openNote;
    if (typeof orig !== 'function' || orig._fluxFcgWrapped) return;
    window.openNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) enhanceNotesToolbar();
      } catch (_) {}
      return r;
    };
    window.openNote._fluxFcgWrapped = true;
  }

  function wrapOpenNewNote() {
    const orig = window.openNewNote;
    if (typeof orig !== 'function' || orig._fluxFcgWrapped) return;
    window.openNewNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) enhanceNotesToolbar();
      } catch (_) {}
      return r;
    };
    window.openNewNote._fluxFcgWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('fcg.palette');
    const keys = 'flashcard generate note study cards';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🃏',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="notes"]');
            window.nav('notes', tab);
          }
          setTimeout(() => {
            if (typeof window.generateFlashcardsFromNote === 'function') {
              window.generateFlashcardsFromNote();
            }
          }, 300);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapGenerateFlashcards();
    wrapOpenFlashcards();
    wrapOpenNote();
    wrapOpenNewNote();
    enhanceNotesToolbar();
    return true;
  }

  window.FluxFlashcardGenerator = {
    FLAG,
    enabled,
    parseNoteToCards,
    generateLocal,
    studyNoteCards,
    shuffleFlashcards,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
