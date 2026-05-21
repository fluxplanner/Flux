/**
 * P28.1 — SRS deck mode for notes tagged #review (SM-2).
 * Flag: enable_srs_deck_mode (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_srs_deck_mode';
  const STORE_KEY = 'flux_srs_deck_v1';
  const TOOL_ID = 'srs-deck';
  const REVIEW_TAG = '#review';
  const BANNER_ID = 'fluxSrsDeckBanner';

  let session = null;

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

  function todayStr() {
    return typeof window.todayStr === 'function' ? window.todayStr() : new Date().toISOString().slice(0, 10);
  }

  function addDays(iso, n) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function notesList() {
    return Array.isArray(window.notes) ? window.notes : [];
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    return {
      cards: s.cards && typeof s.cards === 'object' ? s.cards : {},
      stats: {
        reviewed: s.stats?.reviewed || 0,
        sessions: s.stats?.sessions || 0,
      },
    };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('srsDeckMode', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    const s = getStore();
    return { cards: s.cards, stats: s.stats };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistStore({
      cards: data.cards || {},
      stats: data.stats || { reviewed: 0, sessions: 0 },
    });
  }

  function isReviewNote(note) {
    if (!note) return false;
    const tags = note.fluxTags || [];
    if (tags.some((t) => String(t).toLowerCase() === REVIEW_TAG)) return true;
    const blob = `${note.title || ''} ${note.body || ''}`.toLowerCase();
    return blob.includes('#review');
  }

  function cardKey(noteId, idx) {
    return `${noteId}_${idx}`;
  }

  function defaultCard(note, src, idx) {
    return {
      noteId: note.id,
      noteTitle: note.title || T('srsd.default_note'),
      q: src.q,
      a: src.a,
      interval: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      nextDue: todayStr(),
    };
  }

  function getSourceCards(note) {
    if (note.flashcards?.length) return note.flashcards;
    if (window.FluxFlashcardGenerator?.parseNoteToCards) {
      try {
        return window.FluxFlashcardGenerator.parseNoteToCards(note.body, note.title) || [];
      } catch (_) {
        return [];
      }
    }
    return [];
  }

  function syncFromNotes() {
    const store = getStore();
    const activeKeys = new Set();

    notesList().forEach((note) => {
      if (!isReviewNote(note)) return;
      const src = getSourceCards(note);
      src.forEach((c, idx) => {
        const k = cardKey(note.id, idx);
        activeKeys.add(k);
        const prev = store.cards[k];
        if (!prev || prev.q !== c.q || prev.a !== c.a) {
          store.cards[k] = defaultCard(note, c, idx);
        } else {
          store.cards[k] = {
            ...prev,
            noteId: note.id,
            noteTitle: note.title || T('srsd.default_note'),
            q: c.q,
            a: c.a,
          };
        }
      });
    });

    Object.keys(store.cards).forEach((k) => {
      if (!activeKeys.has(k)) delete store.cards[k];
    });

    persistStore(store);
    return store;
  }

  function allCards() {
    return Object.values(getStore().cards);
  }

  function dueCards() {
    const today = todayStr();
    return allCards().filter((c) => c.nextDue <= today);
  }

  function newCards(limit) {
    return allCards()
      .filter((c) => !c.reps)
      .slice(0, limit || 12);
  }

  function schedule(card, quality) {
    const next = { ...card };
    if (quality < 3) {
      next.interval = 1;
      next.lapses = (next.lapses || 0) + 1;
      next.reps = 0;
    } else {
      if (next.reps === 0) next.interval = 1;
      else if (next.reps === 1) next.interval = 6;
      else next.interval = Math.max(1, Math.round(next.interval * next.ease));
      next.ease = Math.max(
        1.3,
        next.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
      );
      next.reps = (next.reps || 0) + 1;
    }
    next.nextDue = addDays(todayStr(), next.interval);
    return next;
  }

  function buildQueue() {
    syncFromNotes();
    const due = dueCards();
    if (due.length) return [...due].sort(() => Math.random() - 0.5);
    const fresh = newCards(12);
    if (fresh.length) return [...fresh].sort(() => Math.random() - 0.5);
    return [];
  }

  function recordGrade(quality) {
    if (!session?.cardKey) return;
    const store = getStore();
    const prev = store.cards[session.cardKey];
    if (!prev) return;
    store.cards[session.cardKey] = schedule(prev, quality);
    store.stats.reviewed = (store.stats.reviewed || 0) + 1;
    persistStore(store);
  }

  function startSession() {
    const queue = buildQueue();
    if (!queue.length) {
      session = null;
      return false;
    }
    const store = getStore();
    store.stats.sessions = (store.stats.sessions || 0) + 1;
    persistStore(store);
    const first = queue[0];
    session = {
      queue,
      index: 0,
      cardKey: Object.keys(store.cards).find((k) => {
        const c = store.cards[k];
        return c.q === first.q && c.a === first.a && c.noteId === first.noteId;
      }),
      flipped: false,
    };
    if (!session.cardKey) {
      session.cardKey = Object.keys(store.cards).find((k) => store.cards[k] === first);
    }
    return true;
  }

  function nextCard() {
    if (!session) return false;
    session.index += 1;
    if (session.index >= session.queue.length) return false;
    const card = session.queue[session.index];
    const store = getStore();
    session.cardKey =
      Object.keys(store.cards).find((k) => {
        const c = store.cards[k];
        return c.q === card.q && c.a === card.a && c.noteId === card.noteId;
      }) || null;
    session.flipped = false;
    return true;
  }

  function statsHtml() {
    syncFromNotes();
    const due = dueCards().length;
    const total = allCards().length;
    const stats = getStore().stats;
    return `<div class="flux-srsd-stats">
  <div class="flux-srsd-stat"><div class="flux-srsd-stat-val">${due}</div><div class="flux-srsd-stat-lbl">${esc(T('srsd.due'))}</div></div>
  <div class="flux-srsd-stat"><div class="flux-srsd-stat-val">${total}</div><div class="flux-srsd-stat-lbl">${esc(T('srsd.cards'))}</div></div>
  <div class="flux-srsd-stat"><div class="flux-srsd-stat-val">${stats.sessions || 0}</div><div class="flux-srsd-stat-lbl">${esc(T('srsd.sessions'))}</div></div>
</div>`;
  }

  function renderStudyBody(body) {
    if (!body) return;
    if (!session) {
      if (!startSession()) {
        body.innerHTML = `${statsHtml()}<div class="flux-srsd-card"><div class="flux-srsd-q">${esc(T('srsd.all_caught_up'))}</div><div class="flux-srsd-hint">${esc(T('srsd.tag_hint'))}</div></div>`;
        return;
      }
    }

    const store = getStore();
    const card = session.cardKey ? store.cards[session.cardKey] : session.queue[session.index];
    if (!card) {
      body.innerHTML = `${statsHtml()}<div class="flux-srsd-card"><div class="flux-srsd-q">${esc(T('srsd.no_cards'))}</div></div>`;
      return;
    }

    const progress = `${session.index + 1} / ${session.queue.length}`;
    body.innerHTML = `${statsHtml()}
<div class="flux-srsd-meta">${esc(card.noteTitle || '')} · ${esc(progress)}</div>
<div class="flux-srsd-card${session.flipped ? ' revealed' : ''}" id="fluxSrsdFlipCard">
  <div class="flux-srsd-q">${esc(card.q)}</div>
  ${session.flipped ? `<div class="flux-srsd-a">${esc(card.a)}</div>` : `<div class="flux-srsd-hint">${esc(T('srsd.tap_reveal'))}</div>`}
</div>
${
  session.flipped
    ? `<div class="flux-srsd-grade">
    <button type="button" class="btn-sec" data-srsd-q="1">${esc(T('srsd.again'))}</button>
    <button type="button" class="btn-sec" data-srsd-q="3">${esc(T('srsd.hard'))}</button>
    <button type="button" class="btn-sec" data-srsd-q="4">${esc(T('srsd.good'))}</button>
    <button type="button" class="btn-sec" data-srsd-q="5">${esc(T('srsd.easy'))}</button>
  </div>`
    : ''
}`;

    const flipEl = body.querySelector('#fluxSrsdFlipCard');
    if (flipEl && !session.flipped) {
      flipEl.addEventListener('click', () => {
        session.flipped = true;
        renderStudyBody(body);
      });
    }

    body.querySelectorAll('[data-srsd-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = parseInt(btn.getAttribute('data-srsd-q'), 10);
        recordGrade(q);
        if (!nextCard()) {
          session = null;
          toast(T('srsd.session_done'), 'success');
        }
        renderStudyBody(body);
        refreshBanner();
      });
    });
  }

  function openDeckReview() {
    if (!enabled()) return;
    syncFromNotes();
    session = null;
    if (typeof window.fluxOpenToolModal !== 'function') {
      toast(T('srsd.unavailable'), 'warning');
      return;
    }
    window.fluxOpenToolModal({
      id: TOOL_ID,
      emoji: '🔄',
      title: T('srsd.title'),
      wide: true,
      renderBody: renderStudyBody,
    });
  }

  function refreshBanner() {
    const host = document.getElementById('notesListView');
    if (!host || !enabled()) return;
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.className = 'flux-srsd-banner';
      const list = document.getElementById('notesList');
      if (list) host.insertBefore(banner, list);
      else host.appendChild(banner);
    }
    syncFromNotes();
    const due = dueCards().length;
    const total = allCards().length;
    const reviewNotes = notesList().filter(isReviewNote).length;
    banner.innerHTML = `<div class="flux-srsd-banner-text">${esc(T('srsd.banner_lead'))} <strong>${due}</strong> ${esc(T('srsd.due'))} · <strong>${total}</strong> ${esc(T('srsd.cards'))} · <strong>${reviewNotes}</strong> ${esc(T('srsd.notes'))}</div>
<div class="flux-srsd-banner-actions">
  <button type="button" class="flux-srsd-start">${esc(T('srsd.start'))}</button>
  <button type="button" class="btn-sec flux-srsd-sync">${esc(T('srsd.sync'))}</button>
</div>`;
    banner.querySelector('.flux-srsd-start')?.addEventListener('click', openDeckReview);
    banner.querySelector('.flux-srsd-sync')?.addEventListener('click', () => {
      syncFromNotes();
      refreshBanner();
      toast(T('srsd.synced'), 'success');
    });
  }

  function ensureFilterButton() {
    const row = document.querySelector('#notesListView .tmode-btn')?.parentElement;
    if (!row || row.querySelector('[data-srsd-filter]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tmode-btn flux-srsd-review-btn';
    btn.setAttribute('data-srsd-filter', '1');
    btn.textContent = '🔄 #review';
    btn.addEventListener('click', () => {
      if (typeof window.setNoteFilter === 'function') window.setNoteFilter('review', btn);
    });
    row.appendChild(btn);
  }

  function ensureReviewTagButton() {
    const editor = document.getElementById('notesEditorView');
    if (!editor) return;
    let btn = document.getElementById('fluxSrsdTagBtn');
    if (!btn) {
      const toolbar = editor.querySelector('div[style*="flex-wrap"]');
      if (!toolbar) return;
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'fluxSrsdTagBtn';
      btn.className = 'flux-srsd-tag-btn';
      btn.style.cssText = 'padding:6px 12px;font-size:.78rem';
      btn.addEventListener('click', toggleReviewTag);
      const saveBtn = toolbar.querySelector('button[onclick="saveNote()"]');
      if (saveBtn) saveBtn.insertAdjacentElement('afterend', btn);
      else toolbar.appendChild(btn);
    }
    updateReviewTagButton();
  }

  function updateReviewTagButton() {
    const btn = document.getElementById('fluxSrsdTagBtn');
    if (!btn) return;
    const note = notesList().find((n) => n.id === window.currentNoteId);
    const on = note && isReviewNote(note);
    btn.textContent = on ? '🔄 #review ✓' : '🔄 #review';
    btn.classList.toggle('active', !!on);
  }

  function toggleReviewTag() {
    const note = notesList().find((n) => n.id === window.currentNoteId);
    if (!note) {
      toast(T('srsd.save_first'), 'warning');
      return;
    }
    note.fluxTags = Array.isArray(note.fluxTags) ? note.fluxTags : [];
    const idx = note.fluxTags.findIndex((t) => String(t).toLowerCase() === REVIEW_TAG);
    if (idx >= 0) note.fluxTags.splice(idx, 1);
    else note.fluxTags.push(REVIEW_TAG);
    save('flux_notes', notesList());
    try {
      if (typeof window.syncKey === 'function') window.syncKey('notes', notesList());
    } catch (_) {}
    syncFromNotes();
    updateReviewTagButton();
    toast(idx >= 0 ? T('srsd.tag_off') : T('srsd.tag_on'), 'success');
    if (typeof window.renderNotesList === 'function') window.renderNotesList();
  }

  function dueBadgeForNote(noteId) {
    const today = todayStr();
    const n = allCards().filter((c) => c.noteId === noteId && c.nextDue <= today).length;
    return n;
  }

  function renderReviewNotesList() {
    const el = document.getElementById('notesList');
    if (!el) return;
    syncFromNotes();
    const q = (document.getElementById('noteSearch')?.value || '').toLowerCase();
    let list = notesList().filter(isReviewNote);
    if (q) {
      list = list.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(q) ||
          (n.body || '').toLowerCase().includes(q),
      );
    }
    if (!list.length) {
      el.innerHTML = `<div class="empty">${esc(T('srsd.empty_filter'))}</div>`;
      refreshBanner();
      return;
    }
    const strip =
      typeof window.strip === 'function'
        ? window.strip
        : (html) => {
            const d = document.createElement('div');
            d.innerHTML = html || '';
            return d.textContent || '';
          };
    const getSubjects =
      typeof window.getSubjects === 'function' ? window.getSubjects : () => ({});
    el.innerHTML = list
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((n) => {
        const sub = getSubjects()[n.subject];
        const due = dueBadgeForNote(n.id);
        const cardCount = getSourceCards(n).length;
        return `<div class="note-card" onclick="openNote(${n.id})"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><div class="note-title">${esc(n.title || 'Untitled')}</div>${n.starred ? '<span style="color:var(--gold)">⭐</span>' : ''}${cardCount ? `<span class="badge badge-purple" style="padding:2px 6px;font-size:.6rem">🃏 ${cardCount}</span>` : ''}${due ? `<span class="badge badge-blue" style="padding:2px 6px;font-size:.6rem">🔄 ${due}</span>` : ''}</div>${sub ? `<span class="badge badge-blue" style="padding:2px 6px;font-size:.62rem;margin-bottom:4px">${sub.short}</span>` : ''}<div class="note-preview">${esc(strip(n.body || ''))}</div><div style="font-size:.62rem;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:5px">${new Date(n.updatedAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div>`;
      })
      .join('');
    refreshBanner();
  }

  function wrapRenderNotesList() {
    const orig = window.renderNotesList;
    if (typeof orig !== 'function' || orig._fluxSrsdWrapped) return;
    window.renderNotesList = function () {
      if (!enabled()) return orig.apply(this, arguments);
      ensureFilterButton();
      if (window.noteFilter === 'review') {
        renderReviewNotesList();
        return;
      }
      orig.apply(this, arguments);
      refreshBanner();
      document.querySelectorAll('#notes .note-card').forEach((cardEl) => {
        const onclick = cardEl.getAttribute('onclick') || '';
        const m = onclick.match(/openNote\((\d+)\)/);
        if (!m) return;
        const due = dueBadgeForNote(parseInt(m[1], 10));
        if (!due) return;
        const titleRow = cardEl.querySelector('div[style*="align-items"]');
        if (!titleRow || titleRow.querySelector('[data-srsd-due]')) return;
        titleRow.insertAdjacentHTML(
          'beforeend',
          `<span data-srsd-due class="badge badge-blue" style="padding:2px 6px;font-size:.6rem">🔄 ${due}</span>`,
        );
      });
    };
    window.renderNotesList._fluxSrsdWrapped = true;
  }

  function wrapSaveNote() {
    const orig = window.saveNote;
    if (typeof orig !== 'function' || orig._fluxSrsdWrapped) return;
    window.saveNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) {
          syncFromNotes();
          updateReviewTagButton();
          refreshBanner();
        }
      } catch (_) {}
      return r;
    };
    window.saveNote._fluxSrsdWrapped = true;
  }

  function wrapOpenNote() {
    const orig = window.openNote;
    if (typeof orig !== 'function' || orig._fluxSrsdWrapped) return;
    window.openNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) ensureReviewTagButton();
      } catch (_) {}
      return r;
    };
    window.openNote._fluxSrsdWrapped = true;
  }

  function wrapOpenNewNote() {
    const orig = window.openNewNote;
    if (typeof orig !== 'function' || orig._fluxSrsdWrapped) return;
    window.openNewNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) ensureReviewTagButton();
      } catch (_) {}
      return r;
    };
    window.openNewNote._fluxSrsdWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('srsd.palette');
    const keys = 'srs review deck spaced repetition flashcard #review';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🔄',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="notes"]');
            window.nav('notes', tab);
          }
          setTimeout(openDeckReview, 300);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapRenderNotesList();
    wrapSaveNote();
    wrapOpenNote();
    wrapOpenNewNote();
    ensureFilterButton();
    ensureReviewTagButton();
    refreshBanner();
    return true;
  }

  window.FluxSrsDeckMode = {
    FLAG,
    enabled,
    isReviewNote,
    syncFromNotes,
    dueCards,
    openDeckReview,
    toggleReviewTag,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
  window.openSrsDeckReview = openDeckReview;
})();
