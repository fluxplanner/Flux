/* ============================================================================
   FLUX TUTOR · SCREENS  ·  flux-teacher-app.js
   What the student sees on teacher.html: the library of study sets, the notes
   a set is built from, and, for one set, its study guide, Learn, practice
   test, flashcards, "Ask your notes" and study plan.

   WHO DOES WHAT
   -------------
   flux-tutor-core.js (window.FluxTutor) does everything about the text:
   reading notes into cited sentences, the guide, questions, answer checking,
   mastery, search and the plan. flux-tutor-store.js (window.FluxTutorStore)
   saves. flux-flash-core.js (window.FluxFlash) schedules cards and hands a
   deck to Flux Flashcards. This file only draws and keeps the screen in step
   with the open set; it repeats none of the core's logic.

   GROUNDING
   ---------
   Nothing here writes about the subject and Flux AI is never called. Every
   sentence shown as coming from the notes is the notes' own text, with its
   file, page and paragraph. The only network use is the file readers below
   (pdf.js, mammoth, tesseract), loaded from a CDN at a pinned version, and
   only when a student adds that kind of file.

   SAFETY
   ------
   Notes, file names, titles and answers are the student's text: every piece
   goes through esc() before it reaches innerHTML (highlighted search results
   are escaped piece by piece).

   ROUTES (location.hash, so a reload comes back to the same place)
     #library                     the library (also the default)
     #new                         a new set; it is saved once something is typed or added
     #set/<id>/<tab>              tab: notes | guide | learn | test | cards | ask | plan
     #set/<id>/ask?q=<question>   "Ask your notes" with its last question
   UI-only state (an unfinished practice test, the flashcard on screen) stays
   out of the set: the test in progress lives in sessionStorage for a reload.
   ========================================================================== */
(function () {
  'use strict';

  const T = window.FluxTutor;
  const Store = window.FluxTutorStore;
  const FF = window.FluxFlash || null;
  const root = document.getElementById('teacherApp');
  const saveEl = document.getElementById('ftSaveState');
  const liveEl = document.getElementById('ftLive');
  const toastHost = document.getElementById('ftToasts');
  if (!root) return;
  if (!T || !Store) {
    root.innerHTML = '<p class="ft-alert" role="alert">Flux Tutor could not start. Reload the page to try again.</p>';
    return;
  }

  const PROMISE = 'Flux Tutor works only from your notes — it doesn\'t make things up.';
  const TABS = [
    { id: 'notes', label: 'Notes', icon: 'notes' },
    { id: 'guide', label: 'Study guide', icon: 'guide' },
    { id: 'learn', label: 'Learn', icon: 'learn' },
    { id: 'test', label: 'Practice test', icon: 'test' },
    { id: 'cards', label: 'Flashcards', icon: 'cards' },
    { id: 'ask', label: 'Ask your notes', icon: 'ask' },
    { id: 'plan', label: 'Study plan', icon: 'plan' },
  ];
  const TAB_IDS = TABS.map((t) => t.id);
  const TEST_KEY = 'flux_tutor.v2.test.';
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_PDF_PAGES = 40;
  // File readers, pinned and loaded only when a student adds that kind of file.
  const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const MAMMOTH_SRC = 'https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js';
  const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const TESSERACT_PATHS = {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
  };

  /* ── Small helpers ──────────────────────────────────────────────────── */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const enc = encodeURIComponent;
  function plural(n, one, many) { return fmtNum(n) + ' ' + (n === 1 ? one : (many || one + 's')); }
  function fmtNum(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); }
  function nowIso() { return new Date().toISOString(); }
  function dateOf(ymd) { const p = String(ymd).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function fmtDay(ymd) {
    try { return dateOf(ymd).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); } catch (_) { return ymd; }
  }
  function fmtWhen(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    try { return new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (_) { return String(iso).slice(0, 16).replace('T', ' '); }
  }
  /** "today", "yesterday", "3 days ago", "on Mon 5 Oct". */
  function ago(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    const days = T.daysBetween(T.ymd(t), T.ymd());
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    return 'on ' + fmtDay(T.ymd(t));
  }
  function examLine(daysLeft) {
    if (daysLeft == null) return '';
    if (daysLeft < 0) return 'Exam date has passed';
    if (daysLeft === 0) return 'Exam today';
    if (daysLeft === 1) return 'Exam tomorrow';
    return 'Exam in ' + daysLeft + ' days';
  }
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function duration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m ? m + ' min ' + s + ' s' : s + ' s';
  }

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    cross: '<path d="M6 6l12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    guide: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M4 17a2.5 2.5 0 0 1 2.5-2.5H20"/>',
    learn: '<path d="M12 3 2.5 8 12 13l9.5-5L12 3Z"/><path d="M6.5 11v5.2c3.1 2.4 7.9 2.4 11 0V11"/>',
    test: '<path d="M9 3h6v3H9z"/><path d="M8 4.5H6V21h12V4.5h-2"/><path d="m9 13 2 2 4-4"/>',
    cards: '<rect x="2" y="7" width="15" height="13" rx="2"/><path d="M7 3h13a2 2 0 0 1 2 2v11"/>',
    ask: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    plan: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8.5 15.5l2 2 4-4"/>',
  };
  function icon(name, size) {
    const s = size || 18;
    return '<svg class="ft-icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  }

  /** "Biology notes.pdf · page 3 · paragraph 2" as a citation. */
  function cite(ref) {
    return '<cite class="ft-cite">' + esc(T.formatRef(ref)) + '</cite>';
  }
  /** A text with the matched words marked; each piece is escaped on its own. */
  function highlight(text, stems) {
    if (!stems || !stems.length) return esc(text);
    return T.highlightSegments(text, stems).map((p) => (p.hit ? '<mark>' + esc(p.text) + '</mark>' : esc(p.text))).join('');
  }
  /** A passage from the notes with where it came from. */
  function quote(p, stems) {
    if (!p) return '';
    const own = !p.ref || p.ref.edited;
    return '<figure class="ft-quote"><figcaption class="ft-quote-label">' + (own ? 'From your study guide' : 'From your notes') + '</figcaption>'
      + '<blockquote><p>' + highlight(p.text, stems) + '</p></blockquote>' + cite(p.ref) + '</figure>';
  }

  /* ── App state ──────────────────────────────────────────────────────── */

  const app = {
    store: null,
    view: 'loading',     // library | set | missing
    tab: '',
    open: null,          // the set on screen and what is worked out from it
    metas: [],
    bin: [],
    binOpen: false,
    notice: '',          // shown once on the library (the beta's sets moved in)
    libError: '',
    storeError: null,
    ui: freshUi(),
  };
  function freshUi() {
    return { editing: null, learnPick: false, learnNote: '', test: null, cards: null, askQuery: '', planNote: '' };
  }
  let busy = false;

  /** The open set's notes as cited sentences (rebuilt only when the notes change). */
  function corpusNow() {
    const o = app.open;
    const h = T.sourcesHash(o.set.sources);
    if (h !== o.srcHash || !o.corpus) {
      o.srcHash = h;
      o.corpus = T.buildCorpus(o.set.sources);
      o.index = null;
      o.conceptsKey = '';
    }
    return o.corpus;
  }
  /** The guide's key terms linked to the notes: what Learn, tests and cards use. */
  function conceptsNow() {
    const o = app.open;
    const corpus = corpusNow();
    const key = o.srcHash + '|' + o.guideVer;
    if (o.conceptsKey !== key) {
      o.concepts = o.set.guide ? T.conceptsFromGuide(corpus, o.set.guide) : [];
      o.conceptsKey = key;
    }
    return o.concepts;
  }
  function conceptById(id) { return conceptsNow().find((c) => c.id === id) || null; }
  function searchIndex() {
    const o = app.open;
    corpusNow();
    if (!o.index) o.index = T.buildSearchIndex(o.corpus);
    return o.index;
  }
  function guideChanged() { app.open.guideVer++; }
  function studied() { app.open.set.studiedAt = nowIso(); }

  /* ── Saving ─────────────────────────────────────────────────────────── */

  /**
   * Save the open set now. Every tap that changes it (an answer, a rating, an
   * edit) saves straight away: a write still waiting when the tab closes or
   * reloads can be lost, and a finished test must not be.
   */
  function save() {
    const o = app.open;
    if (!o || o.draft || !app.store) return;
    app.store.autosave(o.set);
    app.store.flush();
  }
  /** While typing: saved after a short pause, and at once when the field is left. */
  function saveSoon() {
    const o = app.open;
    if (!o || o.draft || !app.store) return;
    app.store.autosave(o.set);
  }
  /** A new set is saved the first time the student types or adds something. */
  function persistDraft() {
    const o = app.open;
    if (!o || !o.draft) return;
    o.draft = false;
    replaceHash(setHash(o.set.id, 'notes'));
    const head = root.querySelector('.ft-set-head');
    if (head && !head.querySelector('.ft-tabs')) head.insertAdjacentHTML('beforeend', tabsNav());
  }
  function setSaveLabel(text, state) {
    if (!saveEl) return;
    saveEl.textContent = text || '';
    saveEl.dataset.state = state || '';
    saveEl.hidden = !text;
  }
  function idleLabel() {
    if (!app.store) return '';
    return app.store.persistent ? 'Saved on this device' : 'Only kept in this tab';
  }
  let askedPersist = false;
  function onStatus(s) {
    if (s.state === 'error') { showStoreError(s.error); }
    if (!app.open || !s || s.id !== app.open.set.id) return;
    if (s.state === 'pending' || s.state === 'saving') setSaveLabel('Saving…', 'saving');
    else if (s.state === 'saved') {
      setSaveLabel(app.store.persistent ? 'Saved' : 'Only kept in this tab', app.store.persistent ? 'saved' : 'warn');
      clearStoreError();
      if (!askedPersist) { askedPersist = true; app.store.requestPersist(); }
    } else if (s.state === 'error') setSaveLabel('Not saved', 'error');
  }
  function showStoreError(err) {
    app.storeError = err || { message: 'Flux Tutor could not save that change.' };
    const el = document.getElementById('ftStoreAlert');
    if (el) { el.textContent = app.storeError.message; el.hidden = false; }
  }
  function clearStoreError() {
    app.storeError = null;
    const el = document.getElementById('ftStoreAlert');
    if (el) { el.textContent = ''; el.hidden = true; }
  }
  function storeBanners() {
    const s = app.store;
    let out = '';
    if (s && s.warning) out += '<p class="ft-warn" role="note">' + icon('info', 17) + '<span>' + esc(s.warning) + '</span></p>';
    out += '<p id="ftStoreAlert" class="ft-alert" role="alert"' + (app.storeError ? '' : ' hidden') + '>' + (app.storeError ? esc(app.storeError.message) : '') + '</p>';
    return out;
  }

  /* ── Announcements, toasts and dialogs ──────────────────────────────── */

  function announce(text) {
    if (!liveEl) return;
    liveEl.textContent = '';
    setTimeout(() => { liveEl.textContent = text; }, 40);
  }

  let toastTimer = 0;
  function closeToast() {
    clearTimeout(toastTimer);
    if (!toastHost) return;
    const el = toastHost.firstElementChild;
    if (!el) return;
    const hadFocus = el.contains(document.activeElement);
    el.remove();
    if (hadFocus) focusHeading();
  }
  /**
   * A short message at the bottom of the screen. opts.action: { label, run }
   * (an Undo); opts.link: { href, label }; opts.focus moves focus to the action
   * (used when the button that was pressed has just gone from the screen).
   */
  function toast(message, opts) {
    const o = opts || {};
    if (!toastHost) return;
    clearTimeout(toastTimer);
    toastHost.textContent = '';
    const el = document.createElement('div');
    el.className = 'ft-toast';
    el.setAttribute('role', 'status');
    const p = document.createElement('p');
    p.textContent = message;
    el.appendChild(p);
    let actionBtn = null;
    if (o.action) {
      actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'ft-toast-btn';
      actionBtn.textContent = o.action.label;
      actionBtn.addEventListener('click', () => { closeToast(); o.action.run(); });
      el.appendChild(actionBtn);
    }
    if (o.link) {
      const a = document.createElement('a');
      a.className = 'ft-toast-btn';
      a.href = o.link.href;
      a.textContent = o.link.label;
      el.appendChild(a);
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'ft-toast-close';
    x.setAttribute('aria-label', 'Dismiss');
    x.innerHTML = icon('cross', 16);
    x.addEventListener('click', closeToast);
    el.appendChild(x);
    const ms = o.action ? 10000 : 5000;
    const arm = () => { clearTimeout(toastTimer); toastTimer = setTimeout(closeToast, ms); };
    el.addEventListener('mouseenter', () => clearTimeout(toastTimer));
    el.addEventListener('mouseleave', arm);
    el.addEventListener('focusin', () => clearTimeout(toastTimer));
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) arm(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeToast(); } });
    toastHost.appendChild(el);
    arm();
    if (o.focus && actionBtn) actionBtn.focus();
  }

  /**
   * A small modal dialog (the browser's own <dialog>: Escape closes it and the
   * page behind cannot be reached while it is open). Resolves with the typed
   * value, true for a confirmation, or null when cancelled.
   */
  function dialog(opts) {
    const opener = document.activeElement;
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      if (typeof d.showModal !== 'function') {
        if (opts.input) { const v = window.prompt(opts.label, opts.value || ''); resolve(v == null ? null : v); } else resolve(window.confirm(opts.text) ? true : null);
        return;
      }
      d.className = 'ft-dialog';
      d.setAttribute('aria-labelledby', 'ftDialogTitle');
      d.innerHTML = '<form method="dialog" class="ft-dialog-form" novalidate>'
        + '<h2 class="ft-dialog-title" id="ftDialogTitle">' + esc(opts.title) + '</h2>'
        + (opts.text ? '<p class="ft-dialog-text">' + esc(opts.text) + '</p>' : '')
        + (opts.input ? '<div class="ft-field"><label class="ft-label" for="ftDialogInput">' + esc(opts.label) + '</label>'
          + '<input class="ft-input" id="ftDialogInput" maxlength="' + (opts.maxLength || 160) + '" value="' + esc(opts.value || '') + '" autocomplete="off"></div>' : '')
        + '<p class="ft-error" role="alert" id="ftDialogError"></p>'
        + '<div class="ft-row ft-row--end"><button type="button" class="ft-btn ft-btn--quiet" data-dialog="cancel">Cancel</button>'
        + '<button type="submit" class="ft-btn' + (opts.danger ? ' ft-btn--danger' : '') + '">' + esc(opts.okLabel || 'OK') + '</button></div></form>';
      document.body.appendChild(d);
      let result = null;
      const form = d.querySelector('form');
      const input = d.querySelector('input');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input) {
          const err = opts.validate ? opts.validate(input.value) : '';
          if (err) { d.querySelector('#ftDialogError').textContent = err; input.focus(); return; }
          result = input.value;
        } else result = true;
        d.close();
      });
      d.querySelector('[data-dialog="cancel"]').addEventListener('click', () => d.close());
      d.addEventListener('close', () => {
        d.remove();
        if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
        resolve(result);
      });
      d.showModal();
      if (input) { input.focus(); input.select(); }
    });
  }

  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ── Routing ────────────────────────────────────────────────────────── */

  function setHash(id, tab, query) {
    return '#set/' + enc(id) + (tab ? '/' + tab : '') + (query ? '?' + query : '');
  }
  function parseHash() {
    const raw = String(location.hash || '').replace(/^#\/?/, '');
    const qi = raw.indexOf('?');
    const path = qi >= 0 ? raw.slice(0, qi) : raw;
    const query = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '');
    const parts = path.split('/');
    if (parts[0] === 'new') return { view: 'new' };
    if (parts[0] === 'set' && parts[1]) {
      let id = '';
      try { id = decodeURIComponent(parts[1]); } catch (_) { id = ''; }
      if (id) return { view: 'set', id, tab: TAB_IDS.includes(parts[2]) ? parts[2] : '', query };
    }
    return { view: 'library' };
  }
  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }
  function replaceHash(hash) {
    try { history.replaceState(history.state, '', hash); } catch (_) { /* the next navigation still works */ }
  }
  function focusEl(target) {
    const el = typeof target === 'string' ? root.querySelector(target) : target;
    if (!el) return false;
    try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' });
    return true;
  }
  function focusHeading() {
    focusEl('#ftStepTitle') || focusEl('#ftScreenTitle') || focusEl('#ftLibTitle');
  }

  let routeSeq = 0;
  let firstRoute = true;
  function afterRoute(target) {
    if (firstRoute) { firstRoute = false; return; }
    window.scrollTo(0, 0);
    focusEl(target);
  }

  async function route() {
    const seq = ++routeSeq;
    const r = parseHash();
    closeToast();
    stopTestTimer();
    if (r.view === 'library') {
      await leaveSet();
      await loadLibrary();
      if (seq !== routeSeq) return;
      renderLibrary();
      afterRoute('#ftLibTitle');
      return;
    }
    if (r.view === 'new') {
      await leaveSet();
      if (seq !== routeSeq) return;
      const set = T.newSet({});
      set.sources = [T.newSource('Your notes', 'Notes', '')];
      openSet(set, true);
      app.tab = 'notes';
      renderSet();
      afterRoute('#ftTitle');
      return;
    }
    if (!app.open || app.open.set.id !== r.id) {
      await leaveSet();
      const set = await app.store.get(r.id);
      if (seq !== routeSeq) return;
      if (!set) { renderMissing(); afterRoute('#ftScreenTitle'); return; }
      openSet(set, false);
    }
    const set = app.open.set;
    if (set.deletedAt) { renderDeleted(); afterRoute('#ftScreenTitle'); return; }
    const tab = r.tab || (set.guide || set.legacy ? 'guide' : 'notes');
    if (!r.tab) replaceHash(setHash(set.id, tab));
    if (app.tab !== tab) { app.ui.editing = null; app.ui.planNote = ''; }
    app.tab = tab;
    if (tab === 'ask') app.ui.askQuery = r.query.get('q') || '';
    prepareTab(tab);
    renderSet();
    afterRoute(focusTarget());
    if (tab === 'test') startTestTimer();
  }

  async function leaveSet() {
    stopTestTimer();
    const o = app.open;
    if (!o) return;
    app.open = null;
    app.ui = freshUi();
    app.tab = '';
    if (!o.draft) await app.store.flush();
    setSaveLabel(idleLabel(), app.store.persistent ? 'idle' : 'warn');
  }

  function openSet(set, draft) {
    app.open = { set, draft, srcHash: '', corpus: null, guideVer: 0, conceptsKey: '', concepts: [], index: null, otherTab: false };
    app.ui = freshUi();
    app.view = 'set';
    app.notice = '';
    app.tab = '';
    if (!draft) restoreTest();
    // The beta's sets (and any set saved before its guide) get a guide when opened.
    if (!draft && !set.guide && T.hasNotes(set)) buildGuide();
    setSaveLabel(draft ? '' : (app.store.persistent ? 'Saved' : 'Only kept in this tab'), app.store.persistent ? 'saved' : 'warn');
  }

  /** Build (or rebuild) the study guide from the notes; the student's edits are kept. */
  function buildGuide() {
    const o = app.open;
    const corpus = corpusNow();
    const m = T.measure(corpus);
    if (!m.enough) return { ok: false, measure: m };
    o.set.guide = T.mergeGuide(o.set.guide, T.buildGuide(o.set.sources, { corpus }));
    guideChanged();
    save();
    return { ok: true };
  }

  function prepareTab(tab) {
    const set = app.open.set;
    if (tab !== 'notes' && T.hasNotes(set) && (!set.guide || T.guideStale(set))) buildGuide();
    if (tab === 'learn') {
      const s = set.learn;
      if (s && s.phase === 'learn' && !T.currentStep(s) && set.guide) {
        T.nextStep(s, corpusNow(), conceptsNow(), set.mastery);
        save();
      }
    }
    if (tab === 'plan') ensurePlan();
    if (tab === 'cards' && !app.ui.cards) app.ui.cards = { queue: cardQueueIds(), flipped: false };
  }
  function focusTarget() {
    if (app.tab === 'learn') {
      const s = app.open.set.learn;
      if (s && !app.ui.learnPick && root.querySelector('#ftStepTitle')) return '#ftStepTitle';
    }
    return '#ftScreenTitle';
  }

  /* ── Library ────────────────────────────────────────────────────────── */

  async function loadLibrary() {
    const [live, bin] = await Promise.all([app.store.list(), app.store.list({ deleted: true })]);
    app.metas = live.ok ? live.sets : [];
    app.bin = bin.ok ? bin.sets : [];
    if (!live.ok) app.libError = live.error.message;
  }
  async function refreshLibrary(focusSel) {
    await loadLibrary();
    if (app.open || parseHash().view !== 'library') return;
    renderLibrary();
    if (focusSel) focusEl(focusSel) || focusEl('#ftLibTitle');
  }

  function renderLibrary() {
    app.view = 'library';
    document.title = 'Flux Tutor · Study from your notes';
    setSaveLabel(idleLabel(), app.store.persistent ? 'idle' : 'warn');
    const sets = app.metas;
    root.innerHTML = storeBanners()
      + '<section class="ft-library" aria-labelledby="ftLibTitle">'
      + '<div class="ft-lib-head"><div class="ft-lib-intro">'
      + '<h1 id="ftLibTitle" class="ft-h1" tabindex="-1">Your study sets</h1>'
      + '<p class="ft-promise">' + icon('shield', 17) + '<span>' + esc(PROMISE) + '</span></p></div>'
      + '<div class="ft-lib-actions">'
      + '<a class="ft-btn" href="#new">' + icon('plus') + 'New study set</a>'
      + '<button type="button" class="ft-btn ft-btn--quiet" data-act="sample">' + icon('sparkle') + 'Try it with a sample</button>'
      + '<button type="button" class="ft-btn ft-btn--quiet" data-act="import">' + icon('upload') + 'Import</button>'
      + (sets.length ? '<button type="button" class="ft-btn ft-btn--quiet" data-act="export-all">' + icon('download') + 'Back up all</button>' : '')
      + '<input type="file" id="ftImportFile" class="ft-visually-hidden" accept=".json,application/json" tabindex="-1" aria-label="Choose a Flux Tutor export to import">'
      + '</div></div>'
      + (app.notice ? '<p class="ft-notice" role="status">' + icon('info', 17) + '<span>' + esc(app.notice) + '</span></p>' : '')
      + '<p id="ftLibAlert" class="ft-alert" role="alert"' + (app.libError ? '' : ' hidden') + '>' + esc(app.libError) + '</p>'
      + (sets.length ? '<ul class="ft-sets" aria-label="Study sets">' + sets.map(setCard).join('') + '</ul>' : emptyLibrary())
      + (app.bin.length ? binHtml() : '')
      + '<p class="ft-storage-note">' + esc(app.store.backend === 'memory'
        ? 'Nothing here is saved after you close this tab. Use Export to keep a copy.'
        : 'Your study sets are saved in this browser on this device. Use Export to keep a copy, or to move a set to another device.') + '</p>'
      + '</section>';
  }

  function emptyLibrary() {
    return '<div class="ft-empty"><h2 class="ft-h2">Start with your notes</h2><ol class="ft-steps">'
      + '<li><strong>Add your notes.</strong> Paste them, or add a PDF, a Word document or a photo of your notes.</li>'
      + '<li><strong>Get a study guide.</strong> An outline, key terms, key facts and short summaries, each with where in your notes it came from.</li>'
      + '<li><strong>Study it.</strong> Learn one step at a time, take practice tests, review flashcards, ask your notes, and plan the days to your exam.</li>'
      + '</ol><p class="ft-help">New here? “Try it with a sample” opens a short set of biology notes to explore.</p></div>';
  }

  function setCard(m) {
    const title = m.title || 'Untitled study set';
    const studied = m.studiedAt ? 'Last studied ' + ago(m.studiedAt) : 'Not studied yet';
    const exam = examLine(m.daysLeft);
    const chips = (m.subject ? '<span class="ft-chip">' + esc(m.subject) + '</span>' : '')
      + (m.sample ? '<span class="ft-chip ft-chip--accent">Sample</span>' : '')
      + (!m.hasGuide ? '<span class="ft-chip">' + (m.words ? 'Guide not built yet' : 'No notes yet') + '</span>' : '');
    const num = (v) => Math.max(0, Math.round(Number(v) || 0));
    const pct = Math.min(100, num(m.percent));
    const progress = num(m.terms)
      ? '<div class="ft-meter" role="progressbar" aria-label="Terms mastered" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>'
        + '<p class="ft-set-progress">' + num(m.mastered) + ' of ' + plural(num(m.terms), 'term') + ' mastered' + (m.lastTestPct != null ? ' · last test ' + Math.min(100, num(m.lastTestPct)) + '%' : '') + '</p>'
      : '<p class="ft-set-progress">' + (num(m.words) ? plural(num(m.words), 'word') + ' of notes' : 'Add notes to start') + '</p>';
    const id = esc(m.id);
    return '<li class="ft-set-card" data-set="' + id + '">'
      + '<h2 class="ft-set-title"><a href="' + esc(setHash(m.id, '')) + '" data-open="' + id + '">' + esc(title) + '</a></h2>'
      + (chips ? '<div class="ft-chips">' + chips + '</div>' : '')
      + '<p class="ft-set-meta">' + esc(studied) + (exam ? ' · ' + esc(exam) : '') + '</p>'
      + progress
      + '<div class="ft-set-actions">'
      + '<button type="button" class="ft-mini" data-act="rename" data-id="' + id + '" aria-label="Rename ' + esc(title) + '">Rename</button>'
      + '<button type="button" class="ft-mini" data-act="duplicate" data-id="' + id + '" aria-label="Duplicate ' + esc(title) + '">Duplicate</button>'
      + '<button type="button" class="ft-mini" data-act="export" data-id="' + id + '" aria-label="Export ' + esc(title) + '">Export</button>'
      + '<button type="button" class="ft-mini ft-mini--danger" data-act="delete" data-id="' + id + '" aria-label="Delete ' + esc(title) + '">Delete</button>'
      + '</div></li>';
  }

  function binHtml() {
    return '<details class="ft-bin"' + (app.binOpen ? ' open' : '') + '><summary>Recently deleted (' + app.bin.length + ')</summary>'
      + '<p class="ft-help">Deleted sets stay here for 30 days, then they are removed for good.</p>'
      + '<ul class="ft-bin-list">' + app.bin.map((m) => {
        const title = m.title || 'Untitled study set';
        return '<li><span class="ft-bin-title">' + esc(title) + '</span><span class="ft-help">Deleted ' + esc(ago(m.deletedAt)) + '</span>'
          + '<span class="ft-bin-actions"><button type="button" class="ft-mini" data-act="restore" data-id="' + esc(m.id) + '" aria-label="Restore ' + esc(title) + '">Restore</button>'
          + '<button type="button" class="ft-mini ft-mini--danger" data-act="purge" data-id="' + esc(m.id) + '" aria-label="Delete ' + esc(title) + ' forever">Delete forever</button></span></li>';
      }).join('') + '</ul></details>';
  }

  function libAlert(message) {
    app.libError = message || '';
    const el = document.getElementById('ftLibAlert');
    if (el) { el.textContent = app.libError; el.hidden = !app.libError; }
  }
  function metaById(id) { return app.metas.find((m) => m.id === id) || app.bin.find((m) => m.id === id) || null; }

  async function libRename(id) {
    const m = metaById(id);
    if (!m) return;
    const value = await dialog({
      title: 'Rename study set', label: 'Name', value: m.title, okLabel: 'Save', input: true, maxLength: T.LIMITS.title,
      validate: (v) => (v.trim() ? '' : Store.MESSAGES.title),
    });
    if (value == null) return;
    const res = await app.store.rename(id, value);
    if (!res.ok) { libAlert(res.error.message); return; }
    libAlert('');
    await refreshLibrary('[data-act="rename"][data-id="' + cssId(id) + '"]');
    announce('Renamed to ' + res.set.title + '.');
  }
  async function libDuplicate(id) {
    const res = await app.store.duplicate(id);
    if (!res.ok) { libAlert(res.error.message); return; }
    libAlert('');
    await refreshLibrary('[data-open="' + cssId(res.set.id) + '"]');
    toast('Made a copy: “' + res.set.title + '”.');
  }
  async function libExport(id) {
    const res = await app.store.exportSet(id);
    if (!res.ok) { libAlert(res.error.message); return; }
    download(res.filename, res.text);
    toast('Exported as ' + res.filename + '. Import that file to bring the set back, here or on another device.');
  }
  async function libExportAll() {
    const res = await app.store.exportAll();
    if (!res.ok) { libAlert(res.error.message); return; }
    download(res.filename, res.text);
    toast('Saved a backup of ' + plural(res.count, 'study set') + ' as ' + res.filename + '.');
  }
  async function libDelete(id) {
    const m = metaById(id);
    const title = (m && m.title) || 'Untitled study set';
    const res = await app.store.remove(id);
    if (!res.ok) { libAlert(res.error.message); return; }
    libAlert('');
    await refreshLibrary();
    toast('Deleted “' + title + '”.', { action: { label: 'Undo', run: () => guarded(() => libRestore(id, true)) }, focus: true });
  }
  async function libRestore(id, fromUndo) {
    const res = await app.store.restore(id);
    if (!res.ok) { libAlert(res.error.message); return; }
    libAlert('');
    await refreshLibrary('[data-open="' + cssId(id) + '"]');
    if (!fromUndo) toast('Restored “' + (res.set.title || 'Untitled study set') + '”.');
    else announce('Restored “' + (res.set.title || 'Untitled study set') + '”.');
  }
  async function libPurge(id) {
    const m = metaById(id);
    const title = (m && m.title) || 'Untitled study set';
    const ok = await dialog({ title: 'Delete for good?', text: '“' + title + '” and everything in it will be removed from this device. This cannot be undone.', okLabel: 'Delete forever', danger: true });
    if (!ok) return;
    const res = await app.store.purge(id);
    if (!res.ok) { libAlert(res.error.message); return; }
    await refreshLibrary('#ftLibTitle');
    announce('Deleted “' + title + '” for good.');
  }
  async function libImport(file) {
    if (!file) return;
    let text = '';
    try { text = await file.text(); } catch (_) { libAlert('That file could not be read. Try saving it again, then import it.'); return; }
    const res = await app.store.importText(text);
    if (!res.ok) { libAlert(res.error.message); return; }
    libAlert('');
    const n = res.sets.length;
    await refreshLibrary(n ? '[data-open="' + cssId(res.sets[0].id) + '"]' : '#ftLibTitle');
    toast('Imported ' + plural(n, 'study set') + '.' + (res.skipped ? ' ' + plural(res.skipped, 'set') + ' in the file could not be read.' : ''));
  }
  async function createSample() {
    const set = T.sampleSet();
    const corpus = T.buildCorpus(set.sources);
    set.guide = T.buildGuide(set.sources, { corpus });
    const res = await app.store.save(set);
    if (!res.ok) {
      if (app.view === 'library') libAlert(res.error.message); else showStoreError(res.error);
      return;
    }
    go(setHash(res.set.id, 'guide'));
  }
  /** An id used inside a CSS attribute selector. */
  function cssId(id) { return String(id).replace(/["\\]/g, '\\$&'); }

  /* ── One set: the frame ─────────────────────────────────────────────── */

  function tabsNav() {
    const id = app.open.set.id;
    return '<nav class="ft-tabs" aria-label="Study set"><ul>' + TABS.map((t) => '<li><a href="' + esc(setHash(id, t.id)) + '"'
      + (t.id === app.tab ? ' aria-current="page"' : '') + '>' + icon(t.icon, 17) + '<span>' + t.label + '</span></a></li>').join('') + '</ul></nav>';
  }
  function subline(set) {
    const bits = [];
    if (set.subject) bits.push(esc(set.subject));
    if (set.examDate) bits.push(esc(examLine(T.daysBetween(T.ymd(), set.examDate))) + ' (' + esc(fmtDay(set.examDate)) + ')');
    return '<p class="ft-set-sub" id="ftSetSub"' + (bits.length ? '' : ' hidden') + '>' + bits.join(' · ') + '</p>';
  }
  function renderSet() {
    const o = app.open;
    const set = o.set;
    const title = set.title || (o.draft ? 'New study set' : 'Untitled study set');
    document.title = title + ' · Flux Tutor';
    let screen = '';
    switch (app.tab) {
      case 'guide': screen = guideScreen(); break;
      case 'learn': screen = learnScreen(); break;
      case 'test': screen = testScreen(); break;
      case 'cards': screen = cardsScreen(); break;
      case 'ask': screen = askScreen(); break;
      case 'plan': screen = planScreen(); break;
      default: screen = notesScreen();
    }
    root.innerHTML = storeBanners()
      + '<div class="ft-set-head">'
      + '<a class="ft-back" href="#library">' + icon('back', 16) + 'All study sets</a>'
      + '<h1 class="ft-set-name" id="ftSetName">' + esc(title) + '</h1>'
      + subline(set)
      + (o.draft ? '' : tabsNav())
      + '</div>'
      + '<div id="ftOtherTab">' + (o.otherTab ? otherTabBanner() : '') + '</div>'
      + screen;
  }
  function renderScreen(target) {
    renderSet();
    if (target) focusEl(target);
  }
  function renderMissing() {
    app.view = 'missing';
    app.open = null;
    setSaveLabel(idleLabel(), 'idle');
    root.innerHTML = '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Study set not found</h1>'
      + '<p>' + esc(Store.MESSAGES.missing) + ' It may have been deleted, or it was made on another device. Use Export there and Import here to move it.</p>'
      + '<a class="ft-btn" href="#library">' + icon('back', 16) + 'All study sets</a></section>';
  }
  function renderDeleted() {
    const set = app.open.set;
    root.innerHTML = '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">' + esc(set.title || 'Untitled study set') + ' is in Recently deleted</h1>'
      + '<p>Restore it to study it again.</p><div class="ft-row"><button type="button" class="ft-btn" data-act="restore-open">Restore</button>'
      + '<a class="ft-btn ft-btn--quiet" href="#library">All study sets</a></div></section>';
  }
  function otherTabBanner() {
    return '<p class="ft-banner" role="status">This study set was changed in another tab. <button type="button" class="ft-link-btn" data-act="reload-set">Load the latest version</button></p>';
  }
  function needGuide(title) {
    const set = app.open.set;
    const has = T.hasNotes(set);
    return '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">' + esc(title) + '</h2>'
      + '<div class="ft-empty-state"><p>' + (has
        ? 'There is too little text in your notes to build a study guide yet. Add a few more full sentences of notes, then build the guide.'
        : 'Add your notes first. Everything in Flux Tutor is built from them.') + '</p>'
      + '<a class="ft-btn" href="' + esc(setHash(set.id, 'notes')) + '">Go to your notes</a></div>'
      + (title === 'Study guide' ? legacyHtml(set) : '') + '</section>';
  }
  function noTerms(title) {
    return '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">' + esc(title) + '</h2>'
      + '<div class="ft-empty-state"><p>' + esc(title) + ' works from the key terms in your study guide, and there are none yet. Add the terms you need to know to the study guide.</p>'
      + '<a class="ft-btn" href="' + esc(setHash(app.open.set.id, 'guide')) + '">Add terms in the study guide</a></div></section>';
  }

  /* ── Notes (and creating a set) ─────────────────────────────────────── */

  function notesScreen() {
    const o = app.open;
    const set = o.set;
    return '<section class="ft-panel" aria-labelledby="ftScreenTitle">'
      + '<h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">' + (o.draft ? 'New study set' : 'Notes') + '</h2>'
      + '<p class="ft-lead">' + (o.draft ? 'Give it a name, then add your class notes. ' : '')
      + 'The study guide, questions and flashcards are built only from this text, so check it reads right, especially text read from a photo.</p>'
      + (o.draft ? '<p class="ft-help">Just looking? <button type="button" class="ft-link-btn" data-act="sample">Try it with a sample</button></p>' : '')
      + '<div class="ft-grid">'
      + '<div class="ft-field ft-field--wide"><label class="ft-label" for="ftTitle">Title</label>'
      + '<input class="ft-input" id="ftTitle" data-field="title" maxlength="' + T.LIMITS.title + '" value="' + esc(set.title) + '" placeholder="e.g. Biology unit 3: cells" autocomplete="off"></div>'
      + '<div class="ft-field"><label class="ft-label" for="ftSubject">Subject <span class="ft-optional">(optional)</span></label>'
      + '<input class="ft-input" id="ftSubject" data-field="subject" maxlength="' + T.LIMITS.subject + '" value="' + esc(set.subject) + '" placeholder="e.g. Biology" autocomplete="off"></div>'
      + '<div class="ft-field"><label class="ft-label" for="ftExam">Exam date <span class="ft-optional">(optional)</span></label>'
      + '<input class="ft-input" id="ftExam" type="date" data-field="examDate" value="' + esc(set.examDate) + '"></div>'
      + '</div>'
      + '<h3 class="ft-h3" id="ftSourcesTitle">Your notes</h3>'
      + '<ol class="ft-sources" id="ftSources" aria-labelledby="ftSourcesTitle">' + set.sources.map(sourceItem).join('') + '</ol>'
      + '<p class="ft-help" id="ftNoSources"' + (set.sources.length ? ' hidden' : '') + '>No notes yet. Add typed notes or a file below.</p>'
      + '<div class="ft-row"><button type="button" class="ft-btn ft-btn--quiet" data-act="src-add">' + icon('plus') + 'Add typed notes</button></div>'
      + importerHtml()
      + '<div class="ft-build"><p class="ft-error" id="ftBuildMsg" role="alert"></p>'
      + '<button type="button" class="ft-btn ft-btn--big" data-act="build" id="ftBuildBtn">' + icon('sparkle') + buildLabel() + '</button>'
      + '<p class="ft-help">Finds the outline, key terms, key facts and short summaries in your notes, each with where it came from. Your own edits to the guide are kept.</p></div>'
      + '</section>';
  }
  function buildLabel() {
    const set = app.open.set;
    if (!set.guide) return 'Build my study guide';
    return T.guideStale(set) ? 'Update my study guide' : 'Open my study guide';
  }
  function sourceItem(src) {
    const id = esc(src.id);
    const kind = src.kind === 'Notes' ? 'Typed' : src.kind;
    return '<li class="ft-source" data-src="' + id + '">'
      + '<div class="ft-source-head"><span class="ft-kind">' + esc(kind) + '</span>'
      + '<label class="ft-source-name" for="ftSrc-' + id + '">' + esc(src.name) + '</label>'
      + '<span class="ft-help" data-words>' + plural(T.wordCount(src.text), 'word') + '</span>'
      + '<button type="button" class="ft-mini ft-mini--danger" data-act="src-remove" data-src="' + id + '" aria-label="Remove ' + esc(src.name) + '">Remove</button></div>'
      + '<textarea class="ft-textarea ft-textarea--notes" id="ftSrc-' + id + '" data-src-text="' + id + '" maxlength="' + T.LIMITS.sourceText + '" '
      + 'placeholder="Paste or type your notes here. Put each heading on its own line so the outline can find it.">' + esc(src.text) + '</textarea></li>';
  }
  function importerHtml() {
    return '<div class="ft-importer" role="group" aria-labelledby="ftImportTitle">'
      + '<div class="ft-import-copy"><strong id="ftImportTitle">Add a photo or a file</strong>'
      + '<span>PDFs, Word documents (.docx) and text files are read in your browser. Photos and scanned pages are read with English text recognition on this device (the first time, it downloads the reader). Nothing is uploaded.</span></div>'
      + '<div class="ft-drop-prompt"><strong>Drop photos or files here</strong><span>or choose them:</span></div>'
      + '<div class="ft-row">'
      + '<button type="button" class="ft-btn ft-btn--quiet" data-act="pick-photo">Add a photo</button>'
      + '<button type="button" class="ft-btn ft-btn--quiet" data-act="pick-file">Choose files</button>'
      + '<input class="ft-visually-hidden" id="ftPhotoFiles" type="file" accept="image/*" multiple tabindex="-1" aria-label="Choose photos of your notes">'
      + '<input class="ft-visually-hidden" id="ftMaterialFiles" type="file" accept=".pdf,.docx,.txt,.md,.markdown,.csv,.html,.htm,.xml,application/pdf,text/plain,text/markdown,text/csv,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple tabindex="-1" aria-label="Choose files with your notes">'
      + '</div>'
      + '<p class="ft-upload-status" id="ftUploadStatus" role="status" hidden></p>'
      + '<p class="ft-help">Up to ' + T.LIMITS.sources + ' notes and files in a set, 15 MB per file. Check text read from photos: handwriting, equations and diagrams can come out wrong.</p>'
      + '</div>';
  }
  function refreshBuildButton() {
    const b = document.getElementById('ftBuildBtn');
    if (b && app.open) b.innerHTML = icon('sparkle') + buildLabel();
  }
  function onNotesInput(target) {
    const o = app.open;
    if (!o) return;
    const set = o.set;
    if (target.dataset.field) {
      const f = target.dataset.field;
      if (f === 'title') {
        set.title = target.value.slice(0, T.LIMITS.title);
        const h = document.getElementById('ftSetName');
        if (h) h.textContent = set.title || (o.draft ? 'New study set' : 'Untitled study set');
        document.title = (set.title || 'New study set') + ' · Flux Tutor';
      } else if (f === 'subject') set.subject = target.value.slice(0, T.LIMITS.subject);
      else if (f === 'examDate') {
        set.examDate = T.isYmd(target.value) ? target.value : '';
        const sub = document.getElementById('ftSetSub');
        if (sub) sub.outerHTML = subline(set);
      }
    } else if (target.dataset.srcText) {
      const src = set.sources.find((s) => s.id === target.dataset.srcText);
      if (!src) return;
      src.text = target.value.slice(0, T.LIMITS.sourceText);
      const li = target.closest('.ft-source');
      const w = li && li.querySelector('[data-words]');
      if (w) w.textContent = plural(T.wordCount(src.text), 'word');
      refreshBuildButton();
    } else return;
    persistDraft();
    saveSoon();
  }
  function addTypedNotes() {
    const set = app.open.set;
    if (set.sources.length >= T.LIMITS.sources) { toast('A study set can hold up to ' + T.LIMITS.sources + ' notes and files.'); return; }
    const n = set.sources.filter((s) => s.kind === 'Notes').length;
    const src = T.newSource(n ? 'More notes ' + (n + 1) : 'Your notes', 'Notes', '');
    set.sources.push(src);
    persistDraft();
    save();
    appendSource(src);
    focusEl('#ftSrc-' + cssEsc(src.id));
  }
  function cssEsc(id) { return window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/[^\w-]/g, '\\$&'); }
  function appendSource(src) {
    const list = document.getElementById('ftSources');
    if (!list) return;
    list.insertAdjacentHTML('beforeend', sourceItem(src));
    const none = document.getElementById('ftNoSources');
    if (none) none.hidden = true;
    refreshBuildButton();
  }
  function removeSource(id) {
    const set = app.open.set;
    const index = set.sources.findIndex((s) => s.id === id);
    if (index < 0) return;
    const src = set.sources.splice(index, 1)[0];
    persistDraft();
    save();
    renderScreen();
    const o = app.open;
    toast('Removed “' + src.name + '” from your notes.', {
      focus: true,
      action: {
        label: 'Undo',
        run: () => {
          if (app.open !== o) return;
          o.set.sources.splice(Math.min(index, o.set.sources.length), 0, src);
          save();
          if (app.tab === 'notes') renderScreen('#ftSrc-' + cssEsc(src.id));
          announce('Put “' + src.name + '” back.');
        },
      },
    });
  }
  function buildFromNotes() {
    const o = app.open;
    const set = o.set;
    const msg = document.getElementById('ftBuildMsg');
    const say = (text, focusSel) => { if (msg) msg.textContent = text; if (focusSel) focusEl(focusSel); };
    if (!set.title.trim()) { say('Give the study set a title first.', '#ftTitle'); return; }
    if (!T.hasNotes(set)) { say('Add your notes first: type or paste them, or add a file.'); return; }
    if (set.guide && !T.guideStale(set)) { go(setHash(set.id, 'guide')); return; }
    persistDraft();
    // Empty boxes are not notes: they are left out once the guide is built.
    const before = set.sources;
    set.sources = before.filter((s) => s.text.trim());
    const r = buildGuide();
    if (!r.ok) {
      set.sources = before;
      say('There is not enough text to study from yet (' + plural(r.measure.words, 'word') + '). Add a few more full sentences of notes.');
      return;
    }
    save();
    go(setHash(set.id, 'guide'));
  }

  /* File readers (from the first beta, kept): PDF with pdf.js, Word with
     mammoth, photos with tesseract, all in this browser. */
  const libraryLoads = Object.create(null);
  let ocrWorkerPromise = null;
  let importBusy = false;
  function loadReader(globalName, src) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (libraryLoads[globalName]) return libraryLoads[globalName];
    libraryLoads[globalName] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error('The file reader did not start. Reload the page and try again.')));
      script.onerror = () => reject(new Error('The file reader could not be downloaded. Check your connection and try again.'));
      document.head.appendChild(script);
    }).catch((error) => { libraryLoads[globalName] = null; throw error; });
    return libraryLoads[globalName];
  }
  function setImportStatus(message, state) {
    const el = document.getElementById('ftUploadStatus');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
    el.dataset.state = state || '';
  }
  function updateImportControls() {
    const box = root.querySelector('.ft-importer');
    if (box) box.setAttribute('aria-busy', importBusy ? 'true' : 'false');
  }
  async function getOcrWorker() {
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = loadReader('Tesseract', TESSERACT_SRC).then((tesseract) => {
        if (typeof tesseract.createWorker !== 'function') throw new Error('The photo reader is not available.');
        return tesseract.createWorker('eng', 1, Object.assign({
          logger(m) {
            if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
              const el = document.getElementById('ftUploadStatus');
              const label = (el && el.dataset.currentFile) || 'Reading the photo';
              setImportStatus(label + ' · ' + Math.round(m.progress * 100) + '%');
            }
          },
        }, TESSERACT_PATHS));
      }).catch((error) => { ocrWorkerPromise = null; throw error; });
    }
    return ocrWorkerPromise;
  }
  window.addEventListener('pagehide', () => {
    if (!ocrWorkerPromise) return;
    ocrWorkerPromise.then((w) => w.terminate()).catch(() => {});
    ocrWorkerPromise = null;
  });
  async function recognize(source, label) {
    const el = document.getElementById('ftUploadStatus');
    if (el) el.dataset.currentFile = label + ' · reading on this device';
    setImportStatus(label + ' · loading the photo reader…');
    const worker = await getOcrWorker();
    const result = await worker.recognize(source);
    return (result && result.data && result.data.text) || '';
  }
  async function extractPhotoText(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('This photo could not be opened. Try a JPG or PNG.'));
        el.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('This photo has no picture in it.');
      const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This photo could not be prepared for reading.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      try { return await recognize(canvas, file.name); } finally { canvas.width = 0; canvas.height = 0; }
    } finally { URL.revokeObjectURL(url); }
  }
  async function extractPdfText(file) {
    const pdfjs = await loadReader('pdfjsLib', PDFJS_SRC);
    try { pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; } catch (_) { /* older build */ }
    // isEvalSupported: false — pdf.js 3.x can otherwise be made to run script
    // from a crafted PDF's font data (CVE-2024-4367); this is the advisory's fix.
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    const count = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pages = [];
    try {
      for (let n = 1; n <= count; n++) {
        setImportStatus('Reading ' + file.name + ' · page ' + n + ' of ' + count + '…');
        const page = await pdf.getPage(n);
        try {
          // Lines and paragraphs kept (the core's PDF reader), so citations can say "page 3 · paragraph 2".
          let text = T.pdfItemsToText((await page.getTextContent()).items);
          if (text.replace(/\s/g, '').length < 24) {
            // A scanned page: read the picture of it.
            const natural = page.getViewport({ scale: 1 });
            const scale = Math.min(1.6, 2200 / Math.max(natural.width, natural.height));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Page ' + n + ' could not be prepared for reading.');
            try {
              await page.render({ canvasContext: ctx, viewport }).promise;
              text = await recognize(canvas, file.name + ' · page ' + n);
            } finally { canvas.width = 0; canvas.height = 0; }
          }
          if (text.trim()) pages.push('Page ' + n + '\n' + text.trim());
        } finally { page.cleanup(); }
      }
    } finally { await pdf.destroy(); }
    return { text: pages.join('\n\n'), cut: pdf.numPages > MAX_PDF_PAGES ? 'Only the first ' + MAX_PDF_PAGES + ' pages of ' + file.name + ' were read.' : '' };
  }
  async function extractWordText(file) {
    const mammoth = await loadReader('mammoth', MAMMOTH_SRC);
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return (result && result.value) || '';
  }
  function fileKind(file) {
    const name = String(file.name || '').toLowerCase();
    const type = file.type || '';
    if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/.test(name)) return 'Photo';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'PDF';
    if (name.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'Word';
    if (/\.(txt|md|markdown|csv|html?|xml)$/.test(name) || type.startsWith('text/')) return 'Text';
    return '';
  }
  async function extractFileText(file, kind) {
    if (kind === 'Photo') return { text: await extractPhotoText(file), cut: '' };
    if (kind === 'PDF') return extractPdfText(file);
    if (kind === 'Word') return { text: await extractWordText(file), cut: '' };
    const raw = await file.text();
    if (/\.html?$/i.test(file.name) || file.type === 'text/html') {
      // Parsed into a document that is never shown: only its text is kept.
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      doc.querySelectorAll('script, style, template, noscript').forEach((n) => n.remove());
      return { text: doc.body ? doc.body.textContent : '', cut: '' };
    }
    return { text: raw, cut: '' };
  }
  /**
   * Read files into the open set's notes, one after another. Files added
   * while others are still being read wait their turn (nothing is dropped).
   */
  const importQueue = [];
  function importFiles(fileList, expected) {
    const files = Array.from(fileList || []);
    if (!files.length || !app.open) return;
    importQueue.push({ files, expected, o: app.open });
    if (!importBusy) runImports();
  }
  async function runImports() {
    importBusy = true;
    updateImportControls();
    const summary = [];
    let added = 0;
    let failed = 0;
    let lastSet = null;
    while (importQueue.length) {
      const job = importQueue.shift();
      const o = job.o;
      if (app.open !== o) continue;
      lastSet = o;
      for (let i = 0; i < job.files.length; i++) {
        const file = job.files[i];
        if (app.open !== o) break;
        if (o.set.sources.length >= T.LIMITS.sources) {
          summary.push(file.name + ' was not added: a study set can hold up to ' + T.LIMITS.sources + ' notes and files.');
          failed++;
          continue;
        }
        try {
          const kind = fileKind(file);
          if (!kind || (job.expected === 'Photo' && kind !== 'Photo') || (job.expected === 'File' && kind === 'Photo')) {
            throw new Error('This kind of file cannot be read. Use a photo, a PDF, a Word document (.docx) or a text file.');
          }
          if (file.size > MAX_FILE_BYTES) throw new Error('Files must be 15 MB or smaller.');
          if (!file.size) throw new Error('This file is empty.');
          setImportStatus('Reading ' + file.name + (job.files.length > 1 ? ' (' + (i + 1) + ' of ' + job.files.length + ')' : '') + '…');
          const got = await extractFileText(file, kind);
          let text = T.normalizeText(got.text);
          if (!text) throw new Error('No readable text was found in it.');
          if (text.length > T.LIMITS.sourceText) { text = text.slice(0, T.LIMITS.sourceText); summary.push(file.name + ' was too long, so only its first part was kept.'); }
          if (got.cut) summary.push(got.cut);
          if (app.open !== o) break;
          const src = T.newSource(file.name, kind, text);
          o.set.sources.push(src);
          added++;
          persistDraft();
          save();
          if (app.tab === 'notes') appendSource(src);
        } catch (error) {
          failed++;
          summary.push(file.name + ': ' + ((error && error.message) || 'It could not be read.'));
        }
      }
    }
    importBusy = false;
    updateImportControls();
    if (!lastSet || app.open !== lastSet) return;
    if (added) summary.unshift(plural(added, 'file') + ' added below. Check the text, then build your study guide.');
    setImportStatus(summary.join('\n'), failed && !added ? 'error' : '');
    announce(summary.join(' '));
  }

  /* ── Study guide ────────────────────────────────────────────────────── */

  function guideScreen() {
    const set = app.open.set;
    const g = set.guide;
    if (!g) return needGuide('Study guide');
    const stale = T.guideStale(set);
    return '<section class="ft-panel" aria-labelledby="ftScreenTitle">'
      + '<div class="ft-panel-head"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">Study guide</h2>'
      + '<button type="button" class="ft-btn ft-btn--quiet ft-btn--small" data-act="guide-download">' + icon('download', 16) + 'Download</button></div>'
      + '<p class="ft-promise">' + icon('shield', 17) + '<span>' + esc(PROMISE) + ' Every line says where in your notes it came from. Fix it, delete it or add your own.</span></p>'
      + (stale ? '<p class="ft-banner" role="note">Your notes changed, but there is too little text in them now to rebuild this guide, so it still shows your earlier notes.</p>' : '')
      + outlineHtml(g) + itemsHtml('terms') + itemsHtml('facts') + legacyHtml(set)
      + '</section>';
  }
  function outlineHtml(g) {
    if (!g.outline.length) return '';
    return '<section class="ft-guide-sec" aria-labelledby="ftOutlineTitle"><h3 class="ft-h3" id="ftOutlineTitle">Outline</h3>'
      + '<ol class="ft-outline">' + g.outline.map((o) => '<li class="ft-outline-item" data-level="' + o.level + '">'
        + '<p class="ft-outline-title">' + esc(o.title) + '</p>'
        + (o.summary.length
          ? '<ul class="ft-summary">' + o.summary.map((p) => '<li><span>' + esc(p.text) + '</span> ' + cite(p.ref) + '</li>').join('') + '</ul>'
          : '<p class="ft-outline-ref">' + cite(o.ref) + '</p>')
        + '</li>').join('') + '</ol></section>';
  }
  function itemCite(item) {
    if (item.kind === 'user' || !item.ref) return '<cite class="ft-cite">Added by you</cite>';
    return '<cite class="ft-cite">' + esc(T.formatRef(item.ref)) + (item.edited ? ' · edited by you' : '') + '</cite>';
  }
  function itemsHtml(what) {
    const g = app.open.set.guide;
    const terms = what === 'terms';
    const list = terms ? g.terms : g.facts;
    const ed = app.ui.editing;
    const title = terms ? 'Key terms' : 'Key facts';
    const hid = terms ? 'ftTermsTitle' : 'ftFactsTitle';
    const empty = terms
      ? 'No key terms were found in your notes. Add the terms you need to know: Learn, the practice test and flashcards are built from them.'
      : 'No dates, numbers or causes stood out in your notes. Add facts you want to remember.';
    return '<section class="ft-guide-sec" aria-labelledby="' + hid + '"><h3 class="ft-h3" id="' + hid + '">' + title + ' <span class="ft-count">' + list.length + '</span></h3>'
      + (list.length ? '' : '<p class="ft-help">' + empty + '</p>')
      + '<ul class="ft-items">' + list.map((it) => (ed && ed.what === what && ed.id === it.id ? editForm(what, it) : itemHtml(what, it))).join('') + '</ul>'
      + addForm(what) + '</section>';
  }
  function itemHtml(what, it) {
    const id = esc(it.id);
    const name = what === 'terms' ? it.term : it.text.slice(0, 60);
    const body = what === 'terms'
      ? '<p class="ft-item-main"><dfn class="ft-term">' + esc(it.term) + '</dfn> <span class="ft-def">' + esc(it.def) + '</span></p>'
      : '<p class="ft-item-main">' + (it.tags || []).map((t) => '<span class="ft-tag">' + esc({ date: 'Date', number: 'Number', cause: 'Cause and effect' }[t] || t) + '</span>').join('') + '<span class="ft-fact">' + esc(it.text) + '</span></p>';
    return '<li class="ft-item" data-item="' + id + '">' + body
      + '<div class="ft-item-foot">' + itemCite(it) + '<span class="ft-item-actions">'
      + '<button type="button" class="ft-mini" data-act="item-edit" data-what="' + what + '" data-id="' + id + '" aria-label="Edit ' + esc(name) + '">Edit</button>'
      + '<button type="button" class="ft-mini ft-mini--danger" data-act="item-delete" data-what="' + what + '" data-id="' + id + '" aria-label="Delete ' + esc(name) + '">Delete</button>'
      + '</span></div></li>';
  }
  function editForm(what, it) {
    const id = esc(it.id);
    const fields = what === 'terms'
      ? '<div class="ft-field"><label class="ft-label" for="ftEditTerm">Term</label><input class="ft-input" id="ftEditTerm" name="term" maxlength="' + T.LIMITS.term + '" value="' + esc(it.term) + '" autocomplete="off"></div>'
        + '<div class="ft-field"><label class="ft-label" for="ftEditDef">Definition</label><textarea class="ft-textarea ft-textarea--short" id="ftEditDef" name="def" maxlength="' + T.LIMITS.def + '">' + esc(it.def) + '</textarea></div>'
      : '<div class="ft-field"><label class="ft-label" for="ftEditFact">Fact</label><textarea class="ft-textarea ft-textarea--short" id="ftEditFact" name="text" maxlength="' + T.LIMITS.fact + '">' + esc(it.text) + '</textarea></div>';
    return '<li class="ft-item ft-item--editing" data-item="' + id + '"><form class="ft-edit" data-form="item-edit" data-what="' + what + '" data-id="' + id + '" novalidate>'
      + fields + '<p class="ft-error" role="alert"></p>'
      + '<div class="ft-row"><button type="submit" class="ft-btn ft-btn--small">Save</button><button type="button" class="ft-btn ft-btn--quiet ft-btn--small" data-act="item-cancel">Cancel</button>'
      + '<span class="ft-help">Esc cancels</span></div></form></li>';
  }
  function addForm(what) {
    if (what === 'terms') {
      return '<form class="ft-add" data-form="add-term" novalidate><h4 class="ft-h4">Add a term</h4>'
        + '<div class="ft-field"><label class="ft-label" for="ftNewTerm">Term</label><input class="ft-input" id="ftNewTerm" name="term" maxlength="' + T.LIMITS.term + '" autocomplete="off"></div>'
        + '<div class="ft-field"><label class="ft-label" for="ftNewDef">Definition</label><textarea class="ft-textarea ft-textarea--short" id="ftNewDef" name="def" maxlength="' + T.LIMITS.def + '"></textarea></div>'
        + '<p class="ft-error" role="alert"></p><button type="submit" class="ft-btn ft-btn--small">' + icon('plus', 16) + 'Add term</button></form>';
    }
    return '<form class="ft-add" data-form="add-fact" novalidate><h4 class="ft-h4">Add a fact</h4>'
      + '<div class="ft-field"><label class="ft-label" for="ftNewFact">Fact</label><textarea class="ft-textarea ft-textarea--short" id="ftNewFact" name="text" maxlength="' + T.LIMITS.fact + '"></textarea></div>'
      + '<p class="ft-error" role="alert"></p><button type="submit" class="ft-btn ft-btn--small">' + icon('plus', 16) + 'Add fact</button></form>';
  }
  function legacyHtml(set) {
    if (!set.legacy || !set.legacy.notes.length) return '';
    return '<section class="ft-guide-sec ft-legacy" aria-labelledby="ftLegacyTitle"><h3 class="ft-h3" id="ftLegacyTitle">From the first Flux Tutor beta</h3>'
      + '<p class="ft-help">What you wrote in the first version of Flux Tutor, kept exactly as you wrote it.</p>'
      + '<ul class="ft-legacy-list">' + set.legacy.notes.map((n) => '<li><p class="ft-legacy-label">' + esc(n.label) + '</p>'
        + (n.prompt ? '<blockquote class="ft-legacy-prompt"><p>' + esc(n.prompt) + '</p></blockquote>' : '')
        + '<p class="ft-legacy-text">' + esc(n.text) + '</p></li>').join('') + '</ul></section>';
  }
  function itemLabel(what, it) { return what === 'terms' ? it.term : it.text.slice(0, 60) + (it.text.length > 60 ? '…' : ''); }

  function startEdit(what, id) {
    app.ui.editing = { what, id };
    renderScreen(what === 'terms' ? '#ftEditTerm' : '#ftEditFact');
  }
  function cancelEdit() {
    const ed = app.ui.editing;
    app.ui.editing = null;
    renderScreen(ed ? '[data-act="item-edit"][data-id="' + cssId(ed.id) + '"]' : '#ftScreenTitle');
  }
  function saveEdit(form) {
    const what = form.dataset.what;
    const id = form.dataset.id;
    const g = app.open.set.guide;
    const err = form.querySelector('.ft-error');
    const patch = what === 'terms'
      ? { term: form.elements.term.value, def: form.elements.def.value }
      : { text: form.elements.text.value };
    if (what === 'terms' ? !patch.term.trim() || !patch.def.trim() : !patch.text.trim()) {
      err.textContent = what === 'terms' ? 'Fill in both the term and its definition.' : 'Write the fact, or press Cancel.';
      return;
    }
    T.editItem(g, what, id, patch);
    guideChanged();
    save();
    app.ui.editing = null;
    renderScreen('[data-act="item-edit"][data-id="' + cssId(id) + '"]');
    announce('Saved your change.');
  }
  function deleteItem(what, id) {
    const o = app.open;
    const g = o.set.guide;
    const removed = T.removeItem(g, what, id);
    if (!removed) return;
    guideChanged();
    save();
    renderScreen();
    toast('Deleted “' + itemLabel(what, removed.item) + '” from the study guide.', {
      focus: true,
      action: {
        label: 'Undo',
        run: () => {
          if (app.open !== o) return;
          T.restoreItem(o.set.guide, what, removed);
          guideChanged();
          save();
          if (app.tab === 'guide') renderScreen('[data-act="item-edit"][data-id="' + cssId(removed.item.id) + '"]');
          announce('Put it back.');
        },
      },
    });
  }
  function addItem(form, what) {
    const g = app.open.set.guide;
    const err = form.querySelector('.ft-error');
    const item = what === 'terms' ? T.addTerm(g, form.elements.term.value, form.elements.def.value) : T.addFact(g, form.elements.text.value);
    if (!item) {
      err.textContent = what === 'terms' ? 'Fill in both the term and its definition.' : 'Write the fact first.';
      focusEl(what === 'terms' ? (form.elements.term.value.trim() ? '#ftNewDef' : '#ftNewTerm') : '#ftNewFact');
      return;
    }
    guideChanged();
    save();
    renderScreen(what === 'terms' ? '#ftNewTerm' : '#ftNewFact');
    announce('Added “' + itemLabel(what, item) + '”.');
  }

  /* ── Questions (Learn, the quick check and the practice test) ───────── */

  function isAnswerOption(q, value) {
    return q.type === 'tf' ? value === q.answer : value === q.answer;
  }
  /**
   * A question's inputs. st: { given, locked, rec } — locked shows a marked
   * answer (the right option and a wrong pick are marked, not only by colour).
   */
  function questionBody(q, pre, st) {
    const s = st || {};
    const dis = s.locked ? ' disabled' : '';
    const given = s.given;
    if (q.type === 'mc' || q.type === 'mcdef' || q.type === 'tf') {
      const opts = q.type === 'tf' ? [['true', 'True'], ['false', 'False']] : (q.options || []).map((x) => [x, x]);
      const stem = q.type === 'tf' ? q.statement : q.stem;
      return '<fieldset class="ft-fieldset"><legend class="ft-q-prompt">' + esc(q.prompt) + '</legend>'
        + '<p class="ft-q-stem' + (q.type === 'mcdef' ? ' is-term' : '') + '">' + esc(stem) + '</p>'
        + '<div class="ft-options' + (q.type === 'tf' ? ' ft-options--tf' : '') + '">' + opts.map(([value, label]) => {
          const checked = given != null && given === value;
          let mark = '';
          let cls = '';
          if (s.locked && s.rec) {
            if (isAnswerOption(q, value)) { cls = ' is-answer'; mark = '<span class="ft-opt-mark">' + icon('check', 16) + '<span class="ft-visually-hidden"> (the answer)</span></span>'; } else if (checked) { cls = ' is-wrong'; mark = '<span class="ft-opt-mark">' + icon('cross', 16) + '<span class="ft-visually-hidden"> (your answer)</span></span>'; }
          }
          return '<label class="ft-option' + cls + '"><input type="radio" name="' + esc(pre) + '" value="' + esc(value) + '"' + (checked ? ' checked' : '') + dis + '><span class="ft-opt-text">' + esc(label) + '</span>' + mark + '</label>';
        }).join('') + '</div></fieldset>';
    }
    if (q.type === 'cloze') {
      const val = typeof given === 'string' ? given : '';
      return '<p class="ft-q-prompt" id="' + esc(pre) + '-p">' + esc(q.prompt) + '</p>'
        + '<p class="ft-cloze">' + esc(q.before) + '<label class="ft-visually-hidden" for="' + esc(pre) + '-in">' + esc(q.prompt) + '</label>'
        + '<input class="ft-blank" id="' + esc(pre) + '-in" name="answer" value="' + esc(val) + '" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="' + esc(pre) + '-ctx"' + dis + '>'
        + esc(q.after) + '</p><span class="ft-visually-hidden" id="' + esc(pre) + '-ctx">' + esc(T.questionText(q)) + '</span>';
    }
    if (q.type === 'written') {
      const val = typeof given === 'string' ? given : '';
      return '<p class="ft-q-prompt">' + esc(q.prompt) + '</p><p class="ft-q-stem">' + esc(q.stem) + '</p>'
        + '<div class="ft-field"><label class="ft-label" for="' + esc(pre) + '-in">Your answer</label>'
        + '<input class="ft-input" id="' + esc(pre) + '-in" name="answer" value="' + esc(val) + '" autocomplete="off" autocapitalize="off" spellcheck="false"' + dis + '></div>';
    }
    if (q.type === 'match') {
      const g = given && typeof given === 'object' ? given : {};
      const per = s.rec && s.rec.perConcept ? s.rec.perConcept : null;
      return '<fieldset class="ft-fieldset"><legend class="ft-q-prompt">' + esc(q.prompt) + '</legend><ol class="ft-match">'
        + (q.pairs || []).map((p, i) => {
          const chosen = typeof g[p.conceptId] === 'string' ? g[p.conceptId] : '';
          const ok = per ? per[p.conceptId] === true : null;
          const cls = s.locked && per ? (ok ? ' is-right' : ' is-wrong') : '';
          return '<li class="ft-match-row' + cls + '"><label class="ft-match-def" for="' + esc(pre) + '-m' + i + '">' + esc(p.def) + '</label>'
            + '<select class="ft-select" id="' + esc(pre) + '-m' + i + '" data-concept="' + esc(p.conceptId) + '"' + dis + '><option value="">Choose a term…</option>'
            + (q.options || []).map((x) => '<option value="' + esc(x) + '"' + (x === chosen ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>'
            + (s.locked && per ? '<span class="ft-match-mark">' + (ok ? icon('check', 16) + '<span class="ft-visually-hidden">Right</span>' : icon('cross', 16) + '<span class="ft-visually-hidden">Not right: ' + esc(p.term) + '</span>') + '</span>' : '')
            + '</li>';
        }).join('') + '</ol></fieldset>';
    }
    return '<p class="ft-help">This question cannot be shown.</p>';
  }
  function readGiven(scope, q) {
    if (q.type === 'match') {
      const g = {};
      scope.querySelectorAll('select[data-concept]').forEach((sel) => { if (sel.value) g[sel.dataset.concept] = sel.value; });
      return g;
    }
    if (q.type === 'mc' || q.type === 'mcdef' || q.type === 'tf') {
      const r = scope.querySelector('input[type="radio"]:checked');
      return r ? r.value : '';
    }
    const input = scope.querySelector('input[name="answer"]');
    return input ? input.value : '';
  }
  function blank(q, given) {
    return q.type === 'match' ? !given || !Object.keys(given).length : !String(given == null ? '' : given).trim();
  }
  /** Words of the answer to mark in its source sentence. */
  function answerStems(q) {
    if (!q || !['mc', 'cloze', 'written'].includes(q.type)) return [];
    return T.words(q.answer).filter((w) => w.length > 2).map(T.stem);
  }
  function verdictHead(rec) {
    if (rec.unsure) return 'Here is the answer.';
    switch (rec.verdict) {
      case 'correct': return 'Right.';
      case 'close': return 'Right, with a spelling slip.';
      case 'partial': return 'Partly right.';
      case 'skipped': return 'Skipped.';
      default: return 'Not quite.';
    }
  }
  function feedbackHtml(q, rec) {
    const right = T.isRight(rec.verdict);
    const cls = right ? 'is-right' : rec.verdict === 'partial' ? 'is-partial' : 'is-wrong';
    let html = '<div class="ft-feedback ' + cls + '" id="ftFeedback"><p class="ft-verdict">' + icon(right ? 'check' : 'info', 18) + '<strong>' + esc(verdictHead(rec)) + '</strong></p>';
    if (rec.note) html += '<p class="ft-note">' + esc(rec.note) + '</p>';
    if (q.type === 'tf' && q.note) html += '<p class="ft-note">' + esc(q.note) + '</p>';
    if (q.type === 'match') {
      html += '<ul class="ft-pairs">' + (q.pairs || []).map((p) => '<li><strong>' + esc(p.term) + '</strong>: ' + esc(p.def) + '</li>').join('') + '</ul>';
    } else if (!right || rec.verdict === 'close') {
      html += '<p class="ft-answer-line">Answer: <strong>' + esc(T.answerText(q)) + '</strong></p>';
    }
    const sources = q.type === 'match' ? (q.sources || []) : (q.source ? [q.source] : []);
    html += sources.map((p) => quote(p, answerStems(q))).join('');
    return html + '</div>';
  }
  function feedbackSpeech(q, rec) {
    const bits = [verdictHead(rec)];
    if (rec.note) bits.push(rec.note);
    if (q.type === 'tf' && q.note) bits.push(q.note);
    if (!T.isRight(rec.verdict) && q.type !== 'match') bits.push('Answer: ' + T.answerText(q) + '.');
    const src = q.type === 'match' ? (q.sources || [])[0] : q.source;
    if (src) bits.push('Your notes say: ' + src.text + ' (' + T.formatRef(src.ref) + ')');
    return bits.join(' ');
  }
  function statusText(status) {
    return { mastered: 'mastered', learning: 'still learning', weak: 'needs work', new: 'not started' }[status] || status;
  }
  function masteryLine(id, label) {
    const m = app.open.set.mastery[id];
    const st = T.statusOf(m);
    const level = m ? Math.min(m.level, T.MASTERED) : 0;
    const left = T.MASTERED - level;
    const text = st === 'mastered' ? 'Mastered. It will not come back in this session.'
      : st === 'weak' ? 'Needs work. It will come back again soon.'
        : left > 0 ? plural(left, 'more right answer') + ' to master it.' : 'Almost there.';
    let dots = '';
    for (let i = 0; i < T.MASTERED; i++) dots += '<span class="ft-dot' + (i < level ? ' is-on' : '') + '"></span>';
    return '<p class="ft-mastery" data-status="' + st + '"><span class="ft-dots" aria-hidden="true">' + dots + '</span><span><strong>' + esc(label) + '</strong>: ' + esc(text) + '</span></p>';
  }

  /* ── Learn ──────────────────────────────────────────────────────────── */

  function learnScreen() {
    const set = app.open.set;
    if (!set.guide) return needGuide('Learn');
    const concepts = conceptsNow();
    if (!concepts.length) return noTerms('Learn');
    const s = set.learn;
    let body;
    if (!s || app.ui.learnPick) body = pickerView(concepts);
    else if (s.phase === 'check') body = checkView(s);
    else if (s.phase === 'learn') {
      const step = T.currentStep(s);
      body = step ? stepView(s, step) : pickerView(concepts);
    } else body = doneView(s);
    return '<section class="ft-panel ft-learn" aria-labelledby="ftScreenTitle"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">Learn</h2>' + body + '</section>';
  }
  function pickerView(concepts) {
    const set = app.open.set;
    const topics = T.topicsFor(corpusNow(), concepts);
    const s = set.learn;
    let firstOpen = topics.findIndex((t) => T.masterySummary(t.conceptIds, set.mastery).mastered < t.conceptIds.length);
    if (firstOpen < 0) firstOpen = 0;
    return '<p class="ft-lead">Pick what to learn. A quick check of 3 to 5 questions finds what you already know; then you go one term at a time: what your notes say, a question, and feedback that shows the passage it came from.</p>'
      + '<form class="ft-pick" data-form="learn-start" novalidate><fieldset class="ft-fieldset"><legend class="ft-h3">Topics from your notes</legend>'
      + '<div class="ft-row ft-row--tight"><button type="button" class="ft-link-btn" data-act="topics-all">Select all</button><button type="button" class="ft-link-btn" data-act="topics-none">Clear</button></div>'
      + '<ul class="ft-topics">' + topics.map((t, i) => {
        const ms = T.masterySummary(t.conceptIds, set.mastery);
        const names = t.conceptIds.map((id) => { const c = conceptById(id); return c ? c.label : ''; }).filter(Boolean);
        return '<li class="ft-topic"><label class="ft-check"><input type="checkbox" name="topic" value="' + i + '"' + (i === firstOpen ? ' checked' : '') + '>'
          + '<span class="ft-topic-title">' + esc(t.title) + '</span></label>'
          + '<p class="ft-topic-meta">' + plural(t.conceptIds.length, 'term') + ' · ' + ms.mastered + ' mastered</p>'
          + '<p class="ft-topic-terms">' + esc(names.join(', ')) + '</p></li>';
      }).join('') + '</ul></fieldset>'
      + '<label class="ft-check ft-check--plain"><input type="checkbox" name="skipCheck"> Skip the quick check</label>'
      + '<p class="ft-error" role="alert"></p>'
      + '<div class="ft-row"><button type="submit" class="ft-btn">Start learning</button>'
      + (s && s.phase !== 'done' ? '<button type="button" class="ft-btn ft-btn--quiet" data-act="learn-resume">Back to where I was</button>' : '')
      + '</div></form>';
  }
  function checkView(s) {
    const qs = s.check.questions;
    const i = Math.max(0, Math.min(s.check.index, qs.length - 1));
    const q = qs[i];
    const a = s.check.answers[q.id];
    const last = i >= qs.length - 1;
    return '<article class="ft-step" aria-labelledby="ftStepTitle"><p class="ft-kicker">Quick check</p>'
      + '<h3 class="ft-step-title" id="ftStepTitle" tabindex="-1">Question ' + (i + 1) + ' of ' + qs.length + '</h3>'
      + (i === 0 && !a ? '<p class="ft-help">A few questions to see what you already know, so Learn starts in the right place.</p>' : '')
      + '<form class="ft-question" data-form="check" data-qid="' + esc(q.id) + '" novalidate>'
      + questionBody(q, 'c-' + q.id, { given: a ? a.given : null, locked: !!a, rec: a })
      + '<p class="ft-error" role="alert"></p>'
      + (!a ? '<div class="ft-row"><button type="submit" class="ft-btn">Check</button><button type="button" class="ft-btn ft-btn--quiet" data-act="check-unsure">I’m not sure</button></div>' : '')
      + '</form>'
      + (a ? feedbackHtml(q, a) + '<div class="ft-step-nav"><button type="button" class="ft-btn" data-act="check-next" id="ftNextBtn">' + (last ? 'Start learning' : 'Next question') + '</button></div>' : '')
      + '</article>';
  }
  function shownIds(step) {
    const ids = step.explain.map((p) => p.sentenceId).filter(Boolean);
    if (step.q.source && step.q.source.sentenceId) ids.push(step.q.source.sentenceId);
    return ids;
  }
  function stepView(s, step) {
    const latest = T.atLatest(s);
    const rec = step.rec;
    const single = step.conceptIds.length === 1;
    const c = single ? conceptById(step.conceptIds[0]) : null;
    const label = c ? c.label : (step.q.concept || 'This term');
    const title = step.q.type === 'match' ? 'Match the terms' : (step.teach ? 'New: ' : '') + label;
    const sum = T.masterySummary(s.topics, app.open.set.mastery);
    const answered = !!rec;
    let nav = '';
    if (s.index > 0) nav += '<button type="button" class="ft-btn ft-btn--quiet" data-act="step-back">Back</button>';
    if (latest && !answered) nav += '<button type="button" class="ft-btn ft-btn--quiet" data-act="step-skip">Skip</button>';
    if (answered || !latest) {
      nav += '<button type="button" class="ft-btn ft-btn--quiet" data-act="step-repeat" title="Another question on this, next">Repeat</button>'
        + '<button type="button" class="ft-btn" data-act="step-next" id="ftNextBtn">Next</button>';
    }
    return '<div class="ft-learn-bar"><p class="ft-help">' + sum.mastered + ' of ' + plural(sum.total, 'term') + ' mastered in this session</p>'
      + '<button type="button" class="ft-link-btn" data-act="learn-pick">Change topics</button></div>'
      + (app.ui.learnNote ? '<p class="ft-notice" role="note">' + esc(app.ui.learnNote) + '</p>' : '')
      + '<article class="ft-step" aria-labelledby="ftStepTitle">'
      + '<p class="ft-kicker">Step ' + (s.index + 1) + (latest ? '' : ' · looking back') + '</p>'
      + '<h3 class="ft-step-title" id="ftStepTitle" tabindex="-1">' + esc(title) + '</h3>'
      + (step.teach && step.explain.length ? '<div class="ft-explain"><p class="ft-explain-label">What your notes say</p>' + step.explain.map((p) => quote(p)).join('') + '</div>' : '')
      + '<form class="ft-question" data-form="step" data-qid="' + esc(step.q.id) + '" novalidate>'
      + questionBody(step.q, 's-' + step.id, { given: rec ? rec.given : null, locked: answered || !latest, rec })
      + '<p class="ft-error" role="alert"></p>'
      + (!answered && latest ? '<div class="ft-row"><button type="submit" class="ft-btn">Check</button><button type="button" class="ft-btn ft-btn--quiet" data-act="step-unsure">I’m not sure</button></div>' : '')
      + '</form>'
      + (answered ? feedbackHtml(step.q, rec) + (c ? masteryLine(c.id, c.label) : '') : '')
      + (c ? helpHtml(step, c) : '')
      + '<div class="ft-step-nav">' + nav + '</div>'
      + '</article>';
  }
  function helpHtml(step, c) {
    const corpus = corpusNow();
    const shown = shownIds(step);
    let simpler = '';
    if (step.help.simpler) {
      const r = T.simplerFor(corpus, c, conceptsNow(), shown);
      simpler = '<section class="ft-help-panel" aria-labelledby="ftSimplerTitle"><h4 class="ft-h4" id="ftSimplerTitle">Simpler</h4>'
        + (r.note ? '<p class="ft-help">' + esc(r.note) + '</p>' : '')
        + r.sentences.map((p) => quote(p)).join('')
        + (r.terms.length ? '<p class="ft-help">Other key terms in that, as your notes put them:</p><ul class="ft-term-list">'
          + r.terms.map((t) => '<li><strong>' + esc(t.term) + '</strong>: ' + esc(t.text) + ' ' + cite(t.ref) + '</li>').join('') + '</ul>' : '')
        + '</section>';
    }
    let examples = '';
    let more = true;
    if (step.help.examples) {
      const list = T.examplesFor(corpus, c, shown);
      const showing = list.slice(0, step.help.examples);
      // Once every passage the notes have is on screen, say so (and the button goes).
      more = step.help.examples < list.length;
      examples = '<section class="ft-help-panel" aria-labelledby="ftExampleTitle"><h4 class="ft-h4" id="ftExampleTitle" tabindex="-1">' + (showing.length > 1 ? 'More from your notes' : 'Another example') + '</h4>'
        + showing.map((ex) => '<div class="ft-example">' + ex.sentences.map((p) => quote(p)).join('') + '</div>').join('')
        + (!more ? '<p class="ft-none-msg" id="ftNoMore" tabindex="-1">Your notes have no more examples of “' + esc(c.label) + '”.</p>' : '')
        + '</section>';
    }
    return '<div class="ft-help-row" role="group" aria-label="More help with ' + esc(c.label) + '">'
      + '<button type="button" class="ft-btn ft-btn--quiet ft-btn--small" data-act="step-simpler" aria-expanded="' + (step.help.simpler ? 'true' : 'false') + '">' + (step.help.simpler ? 'Hide simpler' : 'Simpler') + '</button>'
      + (more ? '<button type="button" class="ft-btn ft-btn--quiet ft-btn--small" data-act="step-example">Another example</button>' : '')
      + '</div>' + simpler + examples;
  }
  function doneView(s) {
    const set = app.open.set;
    const sum = T.learnSummary(s, conceptsNow(), set.mastery);
    return '<article class="ft-step" aria-labelledby="ftStepTitle"><p class="ft-kicker">Session finished</p>'
      + '<h3 class="ft-step-title" id="ftStepTitle" tabindex="-1">' + sum.mastered + ' of ' + plural(sum.topics.length, 'term') + ' mastered</h3>'
      + '<p>You answered ' + plural(sum.answered, 'question') + ' and got ' + sum.right + ' right.</p>'
      + '<ul class="ft-status-list">' + sum.topics.map((t) => '<li data-status="' + t.status + '"><span class="ft-status-dot" aria-hidden="true"></span><strong>' + esc(t.label) + '</strong> <span class="ft-help">' + statusText(t.status) + '</span></li>').join('') + '</ul>'
      + '<div class="ft-row">'
      + (sum.shaky.length ? '<button type="button" class="ft-btn" data-act="learn-shaky">Practise the ' + plural(sum.shaky.length, 'term') + ' not mastered yet</button>' : '')
      + '<button type="button" class="ft-btn ft-btn--quiet" data-act="learn-pick">Pick new topics</button>'
      + '<a class="ft-btn ft-btn--quiet" href="' + esc(setHash(set.id, 'test')) + '">Take a practice test</a></div></article>';
  }

  function beginLearn(ids, opts) {
    const o = app.open;
    const set = o.set;
    const corpus = corpusNow();
    const concepts = conceptsNow();
    const s = T.startLearn(corpus, concepts, ids, set.mastery, { seed: T.uid('L'), skipCheck: !!(opts && opts.skipCheck) });
    set.learn = s;
    studied();
    app.ui.learnPick = false;
    app.ui.learnNote = '';
    if (s.phase === 'learn') T.nextStep(s, corpus, concepts, set.mastery);
    save();
  }
  function startFromPicker(form) {
    const topics = T.topicsFor(corpusNow(), conceptsNow());
    const ids = [];
    form.querySelectorAll('input[name="topic"]:checked').forEach((box) => {
      const t = topics[Number(box.value)];
      if (t) t.conceptIds.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    });
    if (!ids.length) {
      form.querySelector('.ft-error').textContent = 'Pick at least one topic.';
      const first = form.querySelector('input[name="topic"]');
      if (first) first.focus();
      return;
    }
    beginLearn(ids, { skipCheck: form.elements.skipCheck && form.elements.skipCheck.checked });
    renderScreen('#ftStepTitle');
  }
  function learnState() { return app.open.set.learn; }
  function answerCheckQ(form, unsure) {
    const set = app.open.set;
    const s = learnState();
    const q = s.check.questions.find((x) => x.id === form.dataset.qid);
    if (!q || s.check.answers[q.id]) return;
    const given = unsure ? '' : readGiven(form, q);
    if (!unsure && blank(q, given)) { form.querySelector('.ft-error').textContent = 'Choose or type an answer, or press “I’m not sure”.'; return; }
    const rec = T.answerCheck(s, set.mastery, q.id, given);
    if (unsure && rec) rec.unsure = true;
    studied();
    save();
    renderScreen('#ftNextBtn');
    announce(feedbackSpeech(q, rec));
  }
  function nextCheck() {
    const set = app.open.set;
    const s = learnState();
    const last = s.check.index >= s.check.questions.length - 1;
    if (!last) {
      s.check.index++;
      save();
      renderScreen('#ftStepTitle');
      return;
    }
    const answers = s.check.questions.map((q) => s.check.answers[q.id]).filter(Boolean);
    const right = answers.filter((a) => T.isRight(a.verdict)).length;
    T.finishCheck(s, set.mastery);
    T.nextStep(s, corpusNow(), conceptsNow(), set.mastery);
    app.ui.learnNote = 'Quick check: ' + right + ' of ' + s.check.questions.length + ' right. ' + (right < s.check.questions.length ? 'You start with what you missed.' : 'You start with the terms you have seen least.');
    save();
    renderScreen('#ftStepTitle');
  }
  function answerStepQ(form, unsure) {
    const set = app.open.set;
    const s = learnState();
    const step = T.currentStep(s);
    if (!step || step.rec || !T.atLatest(s) || step.q.id !== form.dataset.qid) return;
    let rec;
    if (unsure) rec = T.dontKnow(s, set.mastery);
    else {
      const given = readGiven(form, step.q);
      if (blank(step.q, given)) { form.querySelector('.ft-error').textContent = 'Choose or type an answer, or press “I’m not sure”.'; return; }
      rec = T.answerStep(s, set.mastery, given);
    }
    app.ui.learnNote = '';
    studied();
    save();
    renderScreen('#ftNextBtn');
    if (rec) announce(feedbackSpeech(step.q, rec));
  }
  function moveStep(kind) {
    const set = app.open.set;
    const s = learnState();
    const corpus = corpusNow();
    const concepts = conceptsNow();
    app.ui.learnNote = '';
    if (kind === 'back') T.backStep(s);
    else if (kind === 'skip') { T.skipStep(s); T.nextStep(s, corpus, concepts, set.mastery); } else if (kind === 'repeat') { T.repeatStep(s); T.nextStep(s, corpus, concepts, set.mastery); } else T.nextStep(s, corpus, concepts, set.mastery);
    save();
    renderScreen('#ftStepTitle');
    if (s.phase === 'done') announce('Session finished.');
  }
  function stepHelp(kind) {
    const s = learnState();
    const step = T.currentStep(s);
    if (!step) return;
    if (kind === 'simpler') step.help.simpler = !step.help.simpler;
    else step.help.examples = Math.min(50, step.help.examples + 1);
    save();
    renderScreen();
    const btn = root.querySelector('[data-act="step-' + (kind === 'simpler' ? 'simpler' : 'example') + '"]');
    if (btn) focusEl(btn);
    else focusEl('#ftNoMore') || focusEl('#ftExampleTitle');
    if (kind === 'simpler' && step.help.simpler) {
      const panel = root.querySelector('.ft-help-panel');
      announce(panel ? panel.textContent : '');
    } else if (kind === 'example') {
      const title = root.querySelector('#ftExampleTitle');
      const box = title && title.parentNode;
      const newest = box && Array.from(box.querySelectorAll('.ft-example')).pop();
      const none = document.getElementById('ftNoMore');
      announce([newest ? newest.textContent : '', none ? none.textContent : ''].join(' ').trim());
    }
  }

  /* ── Practice test ──────────────────────────────────────────────────── */

  function persistTest() {
    if (!app.open) return;
    const key = TEST_KEY + app.open.set.id;
    try {
      const t = app.ui.test;
      if (!t) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(t));
    } catch (_) { /* a reload then starts a fresh test */ }
  }
  function restoreTest() {
    try {
      const raw = sessionStorage.getItem(TEST_KEY + app.open.set.id);
      const t = raw ? JSON.parse(raw) : null;
      if (t && Array.isArray(t.qs) && t.qs.length && (t.phase === 'running' || t.phase === 'results') && t.answers && typeof t.answers === 'object') app.ui.test = t;
    } catch (_) { app.ui.test = null; }
  }
  let timerHandle = 0;
  function stopTestTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = 0; } }
  function startTestTimer() {
    stopTestTimer();
    const t = app.ui.test;
    if (!app.open || app.tab !== 'test' || !t || t.phase !== 'running' || !t.timed) return;
    const tick = () => {
      if (app.ui.test !== t || t.phase !== 'running') { stopTestTimer(); return; }
      const left = t.deadline - Date.now();
      const el = document.getElementById('ftTimerText');
      if (el) el.textContent = clock(left);
      if (left <= 60000 && !t.warned) { t.warned = true; persistTest(); announce('One minute left.'); }
      if (left <= 0) { stopTestTimer(); finishTest(true); }
    };
    tick();
    if (app.ui.test === t && t.phase === 'running') timerHandle = setInterval(tick, 1000);
  }
  function testScreen() {
    const set = app.open.set;
    if (!set.guide) return needGuide('Practice test');
    if (!conceptsNow().length) return noTerms('Practice test');
    const t = app.ui.test;
    if (t && t.phase === 'running') return runningTestHtml(t);
    if (t && t.phase === 'results') return resultsHtml(t);
    return setupTestHtml();
  }
  function setupTestHtml() {
    const set = app.open.set;
    const types = [['mc', 'Multiple choice'], ['tf', 'True or false'], ['written', 'Type the answer'], ['match', 'Matching']];
    return '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">Practice test</h2>'
      + '<p class="ft-lead">Mixed questions from your notes. When you finish, you can review every question you missed with the passage it came from.</p>'
      + '<form class="ft-test-setup" data-form="test-setup" novalidate><div class="ft-grid">'
      + '<div class="ft-field"><label class="ft-label" for="ftTestCount">Questions</label><select class="ft-select" id="ftTestCount" name="count">'
      + [5, 10, 15, 20].map((n) => '<option value="' + n + '"' + (n === 10 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>'
      + '<div class="ft-field"><label class="ft-label" for="ftTestTimer">Timer</label><select class="ft-select" id="ftTestTimer" name="timer">'
      + [[0, 'No timer'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [20, '20 minutes'], [30, '30 minutes']].map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('') + '</select></div>'
      + '</div><fieldset class="ft-fieldset"><legend class="ft-label">Kinds of question</legend><div class="ft-checks">'
      + types.map(([v, l]) => '<label class="ft-check ft-check--plain"><input type="checkbox" name="types" value="' + v + '" checked> ' + l + '</label>').join('') + '</div></fieldset>'
      + '<fieldset class="ft-fieldset"><legend class="ft-label">Focus</legend><div class="ft-checks">'
      + '<label class="ft-check ft-check--plain"><input type="radio" name="focus" value="all" checked> Everything</label>'
      + '<label class="ft-check ft-check--plain"><input type="radio" name="focus" value="weak"> Terms I have not mastered</label></div></fieldset>'
      + '<p class="ft-error" role="alert"></p><div class="ft-row"><button type="submit" class="ft-btn">Start the test</button></div></form>'
      + historyHtml(set) + '</section>';
  }
  function historyHtml(set) {
    if (!set.tests.length) return '';
    return '<section class="ft-guide-sec" aria-labelledby="ftHistTitle"><h3 class="ft-h3" id="ftHistTitle">Your past tests</h3><ul class="ft-history">'
      + set.tests.slice().reverse().map((r) => '<li><details class="ft-details"><summary><span class="ft-score-pill">' + r.pct + '%</span>'
        + '<span>' + esc(fmtWhen(r.at)) + ' · ' + fmtNum(r.right) + ' of ' + r.total + ' right' + (r.timed ? ' · ' + r.timed + '-minute timer' : '') + '</span></summary>'
        + (r.missed.length ? '<ol class="ft-review">' + r.missed.map((x) => '<li class="ft-review-item is-wrong"><p class="ft-review-q">' + esc(x.prompt) + '</p>'
          + '<p>' + (x.given ? 'Your answer: <span class="ft-given">' + esc(x.given) + '</span>' : 'You left this blank.') + '</p>'
          + '<p class="ft-answer-line">Answer: <strong>' + esc(x.answer) + '</strong></p>' + quote(x.source) + '</li>').join('') + '</ol>'
          : '<p class="ft-help">Every question right.</p>')
        + '</details></li>').join('') + '</ul></section>';
  }
  function runningTestHtml(t) {
    return '<section class="ft-panel" aria-labelledby="ftScreenTitle"><div class="ft-panel-head' + (t.timed ? ' ft-panel-head--sticky' : '') + '"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">Practice test</h2>'
      + (t.timed ? '<p class="ft-timer"><span class="ft-visually-hidden">Time left: </span>' + icon('plan', 16) + '<span id="ftTimerText">' + clock(t.deadline - Date.now()) + '</span></p>' : '')
      + '</div><p class="ft-help">' + plural(t.qs.length, 'question') + '. Nothing is marked until you finish' + (t.timed ? ', or until the time runs out' : '') + '.</p>'
      + '<form class="ft-test" data-form="test" novalidate><ol class="ft-test-list">'
      + t.qs.map((q, i) => '<li class="ft-test-q" data-qid="' + esc(q.id) + '"><h3 class="ft-q-num" id="ftQ' + (i + 1) + '">Question ' + (i + 1) + '</h3>'
        + questionBody(q, 't-' + q.id, { given: t.answers[q.id], locked: false }) + '</li>').join('')
      + '</ol><div class="ft-row"><button type="submit" class="ft-btn">Finish and mark</button>'
      + '<button type="button" class="ft-btn ft-btn--quiet" data-act="test-quit">Stop without marking</button></div></form></section>';
  }
  function givenText(q, given) {
    if (q.type === 'match') {
      const g = given && typeof given === 'object' ? given : {};
      return (q.pairs || []).map((p) => (g[p.conceptId] || '—') + ' for “' + p.def.slice(0, 50) + (p.def.length > 50 ? '…' : '') + '”').join('; ');
    }
    if (q.type === 'tf') return given === 'true' ? 'True' : given === 'false' ? 'False' : String(given || '');
    return String(given || '');
  }
  function resultsHtml(t) {
    const g = t.graded;
    const byId = new Map(t.qs.map((q) => [q.id, q]));
    const missed = g.results.filter((r) => !T.isRight(r.verdict));
    const right = g.results.filter((r) => T.isRight(r.verdict));
    const review = (r) => {
      const q = byId.get(r.qid);
      if (!q) return '';
      const ok = T.isRight(r.verdict);
      const sources = q.type === 'match' ? (q.sources || []) : (q.source ? [q.source] : []);
      return '<li class="ft-review-item ' + (ok ? 'is-right' : 'is-wrong') + '"><p class="ft-review-q">' + esc(T.questionText(q)) + '</p>'
        + '<p>' + (r.blank ? 'You left this blank.' : 'Your answer: <span class="ft-given">' + esc(givenText(q, t.answers[r.qid])) + '</span>') + '</p>'
        + (r.note ? '<p class="ft-note">' + esc(r.note) + '</p>' : '')
        + (q.type === 'tf' && q.note && !ok ? '<p class="ft-note">' + esc(q.note) + '</p>' : '')
        + '<p class="ft-answer-line">Answer: <strong>' + esc(T.answerText(q)) + '</strong></p>'
        + sources.map((p) => quote(p, answerStems(q))).join('') + '</li>';
    };
    return '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">Your result</h2>'
      + (t.timeUp ? '<p class="ft-notice" role="note">Time ran out, so the test was marked as it was.</p>' : '')
      + '<p class="ft-score"><strong>' + fmtNum(g.right) + ' of ' + g.total + '</strong> right · ' + g.pct + '%' + (t.seconds ? ' · ' + duration(t.seconds) : '') + '</p>'
      + '<div class="ft-meter ft-meter--big" role="progressbar" aria-label="Score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + g.pct + '"><span style="width:' + g.pct + '%"></span></div>'
      + (missed.length
        ? '<h3 class="ft-h3">Review what you missed (' + missed.length + ')</h3><ol class="ft-review">' + missed.map(review).join('') + '</ol>'
        : '<p>You got every question right.</p>')
      + (right.length ? '<details class="ft-details"><summary>Questions you got right (' + right.length + ')</summary><ol class="ft-review">' + right.map(review).join('') + '</ol></details>' : '')
      + '<div class="ft-row"><button type="button" class="ft-btn" data-act="test-new">Take another test</button>'
      + '<a class="ft-btn ft-btn--quiet" href="' + esc(setHash(app.open.set.id, 'learn')) + '">Go to Learn</a></div></section>';
  }
  function startTest(form) {
    const set = app.open.set;
    const types = Array.from(form.querySelectorAll('input[name="types"]:checked')).map((b) => b.value);
    const err = form.querySelector('.ft-error');
    if (!types.length) { err.textContent = 'Pick at least one kind of question.'; return; }
    const count = Number(form.elements.count.value) || 10;
    const timed = Number(form.elements.timer.value) || 0;
    const focus = (form.querySelector('input[name="focus"]:checked') || {}).value === 'weak' ? 'weak' : 'all';
    const qs = T.buildPracticeTest(corpusNow(), conceptsNow(), set.mastery, { count, types, focus, seed: T.uid('T') });
    if (!qs.length) { err.textContent = 'There is not enough in your study guide for these kinds of question. Pick more kinds, or add terms to the guide.'; return; }
    const now = Date.now();
    app.ui.test = { phase: 'running', qs, answers: {}, startedAt: now, timed, deadline: timed ? now + timed * 60000 : 0, warned: false };
    persistTest();
    renderScreen('#ftScreenTitle');
    startTestTimer();
  }
  function collectTestAnswer(target) {
    const t = app.ui.test;
    if (!t || t.phase !== 'running') return;
    const li = target.closest('[data-qid]');
    if (!li) return;
    const q = t.qs.find((x) => x.id === li.dataset.qid);
    if (!q) return;
    const given = readGiven(li, q);
    if (blank(q, given)) delete t.answers[q.id]; else t.answers[q.id] = given;
    persistTest();
  }
  function finishTest(timeUp) {
    const t = app.ui.test;
    if (!t || t.phase !== 'running' || !app.open) return;
    stopTestTimer();
    root.querySelectorAll('.ft-test-q[data-qid]').forEach((li) => collectTestAnswer(li));
    const set = app.open.set;
    const g = T.gradePracticeTest(t.qs, t.answers);
    let seconds = Math.round((Date.now() - t.startedAt) / 1000);
    if (t.timed) seconds = Math.min(seconds, t.timed * 60);
    set.tests.push(T.practiceRecord(t.qs, t.answers, g, { seconds, timed: t.timed }));
    // What the test showed moves each term's mastery (unanswered questions say nothing).
    const at = nowIso();
    g.results.forEach((r) => {
      const q = t.qs.find((x) => x.id === r.qid);
      if (!q || r.blank) return;
      if (q.type === 'match') {
        (q.pairs || []).forEach((p) => { set.mastery[p.conceptId] = T.applyResult(set.mastery[p.conceptId], r.perConcept && r.perConcept[p.conceptId] ? 'correct' : 'incorrect', at); });
      } else if (q.conceptId) set.mastery[q.conceptId] = T.applyResult(set.mastery[q.conceptId], r.verdict, at);
    });
    studied();
    save();
    t.phase = 'results';
    t.graded = g;
    t.seconds = seconds;
    t.timeUp = !!timeUp;
    persistTest();
    if (app.tab === 'test') { renderScreen(); window.scrollTo(0, 0); focusEl('#ftScreenTitle'); }
    announce((timeUp ? 'Time is up. ' : '') + 'You got ' + fmtNum(g.right) + ' of ' + g.total + ' right.');
  }

  /* ── Flashcards ─────────────────────────────────────────────────────── */

  function examAt() {
    const d = app.open.set.examDate;
    return T.isYmd(d) ? dateOf(d).getTime() + 9 * 3600000 : null;
  }
  function cardQueueIds() { return T.cardQueue(app.open.set, Date.now(), 20).map((c) => c.id); }
  function cardsScreen() {
    const set = app.open.set;
    if (!set.guide) return needGuide('Flashcards');
    const list = T.cardList(set);
    if (!list.length) return noTerms('Flashcards');
    if (!FF) return '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">Flashcards</h2><p class="ft-alert" role="alert">Flashcards could not start. Reload the page to try again.</p></section>';
    const ui = app.ui.cards || (app.ui.cards = { queue: cardQueueIds(), flipped: false });
    ui.queue = ui.queue.filter((id) => list.some((c) => c.id === id));
    const counts = T.cardCounts(set);
    const card = ui.queue.length ? list.find((c) => c.id === ui.queue[0]) : null;
    let stage;
    if (card) {
      const now = Date.now();
      const pv = FF.preview({ s: card.s }, now, { examAt: examAt() });
      const grades = [[FF.AGAIN, 'Again'], [FF.HARD, 'Hard'], [FF.GOOD, 'Good'], [FF.EASY, 'Easy']];
      stage = '<div class="ft-flash" id="ftFlash">'
        + '<p class="ft-flash-label">Term</p><p class="ft-flash-term">' + esc(card.term) + '</p>'
        + (ui.flipped ? '<div class="ft-flash-back"><p class="ft-flash-label">Definition</p><p class="ft-flash-def" id="ftFlashDef">' + esc(card.def) + '</p>' + itemCite(set.guide.terms.find((t) => t.id === card.id) || card) + '</div>' : '')
        + '</div>'
        + (ui.flipped
          ? '<div class="ft-rate" role="group" aria-label="How well did you know it?">' + grades.map(([g, label]) => {
            const wait = FF.fmtWait(pv[g].due - now);
            return '<button type="button" class="ft-rate-btn" data-act="card-rate" data-grade="' + g + '" aria-label="' + label + ', see it again in ' + wait + '"><span>' + label + '</span><span class="ft-rate-wait">' + wait + '</span></button>';
          }).join('') + '</div>'
          : '<div class="ft-row ft-row--center"><button type="button" class="ft-btn ft-btn--big" data-act="card-flip" id="ftFlipBtn">Show answer</button></div>')
        + '<p class="ft-help ft-center">' + plural(ui.queue.length, 'card') + ' left in this round. Keys: Space shows the answer, 1 to 4 rate it.</p>';
    } else {
      const soon = T.cardList(set).filter((c) => c.s && c.s.due > Date.now()).sort((a, b) => a.s.due - b.s.due)[0];
      stage = '<div class="ft-empty-state"><p><strong>You are done for now.</strong> ' + (soon ? 'The next card is due in ' + esc(FF.fmtWait(soon.s.due - Date.now())) + '.' : '') + '</p>'
        + (soon && soon.s.due - Date.now() < 20 * 60000 ? '<button type="button" class="ft-btn ft-btn--quiet" data-act="cards-ahead">Review the ones coming up now</button>' : '') + '</div>';
    }
    const deck = set.flashDeckId ? FF.getDeck(set.flashDeckId) : null;
    return '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">Flashcards</h2>'
      + '<p class="ft-lead" id="ftCardCounts">' + counts.due + ' due · ' + counts.fresh + ' new · ' + counts.later + ' later</p>'
      + '<p class="ft-help">One card for each key term. Each card comes back just before you are likely to forget it' + (set.examDate ? ', and never after your exam date' : '') + '.</p>'
      + '<div class="ft-card-stage">' + stage + '</div>'
      + '<section class="ft-guide-sec" aria-labelledby="ftSendTitle"><h3 class="ft-h3" id="ftSendTitle">Flux Flashcards</h3>'
      + '<p>Send these ' + plural(list.length, 'term') + ' to Flux Flashcards to use its games, tests and match mode. Sending again updates the same deck and keeps your progress there.</p>'
      + '<div class="ft-row"><button type="button" class="ft-btn ft-btn--quiet" data-act="cards-send">' + icon('cards', 17) + 'Send to Flux Flashcards</button>'
      + (deck ? '<a class="ft-btn ft-btn--quiet" href="flashcards.html#/deck/' + esc(enc(deck.id)) + '">Open the deck</a>' : '') + '</div></section>'
      + '</section>';
  }
  function flipCard() {
    const ui = app.ui.cards;
    if (!ui || !ui.queue.length || ui.flipped) return;
    ui.flipped = true;
    renderScreen('[data-act="card-rate"][data-grade="' + FF.GOOD + '"]');
    const def = document.getElementById('ftFlashDef');
    if (def) announce('Definition: ' + def.textContent);
  }
  function rateCard(grade) {
    const set = app.open.set;
    const ui = app.ui.cards;
    if (!ui || !ui.queue.length || !ui.flipped) return;
    const card = T.cardList(set).find((c) => c.id === ui.queue[0]);
    ui.queue.shift();
    ui.flipped = false;
    if (card) {
      const c = { s: card.s };
      FF.review(c, grade, Date.now(), { examAt: examAt() });
      set.cards[card.id] = c.s;
      studied();
      save();
    }
    if (!ui.queue.length) ui.queue = cardQueueIds();
    renderScreen(ui.queue.length ? '#ftFlipBtn' : '#ftScreenTitle');
    if (!ui.queue.length) announce('You are done for now.');
  }
  function cardsAhead() {
    const set = app.open.set;
    const limit = Date.now() + 20 * 60000;
    app.ui.cards = { queue: T.cardList(set).filter((c) => c.s && c.s.due <= limit).sort((a, b) => a.s.due - b.s.due).map((c) => c.id), flipped: false };
    renderScreen('#ftFlipBtn');
  }
  function sendToFlashcards() {
    const set = app.open.set;
    const existing = set.flashDeckId ? FF.getDeck(set.flashDeckId) : null;
    const r = T.flashDeckFrom(set, existing);
    const deck = existing ? r.deck : FF.newDeck(r.deck);
    if (!FF.putDeck(deck)) {
      showStoreError({ message: 'There is no room left in this browser to save the Flux Flashcards deck. Delete a deck you no longer need in Flux Flashcards, then try again.' });
      return;
    }
    set.flashDeckId = deck.id;
    save();
    renderScreen('[data-act="cards-send"]');
    toast(existing
      ? 'Updated your Flux Flashcards deck: ' + plural(r.added, 'new card') + ', ' + plural(r.updated, 'card') + ' changed.'
      : 'Sent ' + plural(r.added, 'card') + ' to Flux Flashcards.', { link: { href: 'flashcards.html#/deck/' + enc(deck.id), label: 'Open Flux Flashcards' } });
  }

  /* ── Ask your notes ─────────────────────────────────────────────────── */

  function askScreen() {
    const set = app.open.set;
    if (!T.hasNotes(set)) return needGuide('Ask your notes');
    const q = app.ui.askQuery;
    return '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">Ask your notes</h2>'
      + '<p class="ft-lead">Type a question or a few key words. You see the passages in your notes that match, best first, with where each one is. Flux Tutor does not write answers of its own.</p>'
      + '<form class="ft-ask" data-form="ask" role="search" novalidate><label class="ft-label" for="ftAsk">Your question</label>'
      + '<div class="ft-ask-row"><input class="ft-input" id="ftAsk" name="q" type="search" value="' + esc(q) + '" maxlength="300" autocomplete="off" placeholder="e.g. What does the cell wall do?">'
      + '<button type="submit" class="ft-btn">' + icon('ask', 17) + 'Search</button></div></form>'
      + '<div class="ft-ask-results" id="ftAskResults">' + (q ? askResultsHtml(q) : '') + '</div></section>';
  }
  function lastAsk(query) {
    const r = T.searchNotes(corpusNow(), searchIndex(), query, conceptsNow());
    app.ui.askResult = r;
    return r;
  }
  function askResultsHtml(query) {
    const r = lastAsk(query);
    if (r.empty) return '<p class="ft-help">Add a word or two about the topic. Question words like “what” and “why” are not searched.</p>';
    const result = (x) => '<li class="ft-result"><article>' + (x.section ? '<p class="ft-result-section">' + esc(x.section) + '</p>' : '')
      + '<p class="ft-result-text">' + x.sentences.map((p) => highlight(p.text, r.stems)).join(' ') + (x.trimmed ? ' <span class="ft-help">(part of a longer paragraph)</span>' : '') + '</p>'
      + cite(x.ref) + '</article></li>';
    if (!r.covered) {
      return '<div class="ft-none"><p class="ft-none-title"><strong>Nothing in your notes covers that.</strong></p>'
        + (r.missing.length ? '<p class="ft-help">Your notes never use: ' + r.missing.map((w) => '<span class="ft-word">' + esc(w) + '</span>').join(', ') + '.</p>' : '')
        + (r.related.length ? '<h3 class="ft-h4">Closest passages (they do not answer it)</h3><ol class="ft-results ft-results--near">' + r.related.map(result).join('') + '</ol>' : '')
        + '</div>';
    }
    return (r.terms.length ? '<div class="ft-ask-terms"><h3 class="ft-h4">Key terms</h3><ul class="ft-term-list">'
      + r.terms.map((t) => '<li><strong>' + esc(t.term) + '</strong>: ' + esc(t.def) + ' ' + cite(t.ref) + '</li>').join('') + '</ul></div>' : '')
      + '<h3 class="ft-h4">' + plural(r.results.length, 'passage') + ' from your notes</h3><ol class="ft-results">' + r.results.map(result).join('') + '</ol>';
  }
  function runAsk(form) {
    const q = String(form.elements.q.value || '').trim().slice(0, 300);
    app.ui.askQuery = q;
    replaceHash(setHash(app.open.set.id, 'ask', q ? 'q=' + enc(q) : ''));
    const box = document.getElementById('ftAskResults');
    if (box) box.innerHTML = q ? askResultsHtml(q) : '';
    const r = app.ui.askResult;
    if (!q) announce('Type a question first.');
    else if (r && r.empty) announce('Add a word or two about the topic.');
    else if (r && !r.covered) announce('Nothing in your notes covers that.');
    else if (r) announce(plural(r.results.length, 'passage') + ' found in your notes.');
  }

  /* ── Study plan ─────────────────────────────────────────────────────── */

  function ensurePlan() {
    const set = app.open.set;
    if (!set.examDate || !set.guide) return;
    const today = T.ymd();
    if (set.plan && set.plan.examDate === set.examDate && set.plan.builtOn === today) return;
    rebuildPlan();
  }
  function rebuildPlan() {
    const set = app.open.set;
    const today = T.ymd();
    const r = T.buildStudyPlan({ concepts: conceptsNow().map((c) => ({ id: c.id, label: c.label })), mastery: set.mastery, examDate: set.examDate, today });
    set.plan = r.ok ? { builtAt: nowIso(), builtOn: today, examDate: set.examDate, days: r.days } : null;
    save();
  }
  function planItems() {
    const plan = app.open.set.plan;
    return plan ? plan.days.reduce((a, d) => a.concat(d.items), []) : [];
  }
  function planScreen() {
    const set = app.open.set;
    const today = T.ymd();
    const date = set.examDate;
    const left = date ? T.daysBetween(today, date) : null;
    const head = '<section class="ft-panel" aria-labelledby="ftScreenTitle"><h2 class="ft-h2" id="ftScreenTitle" tabindex="-1">Study plan</h2>';
    const form = '<form class="ft-plan-form" data-form="exam" novalidate><div class="ft-field"><label class="ft-label" for="ftPlanDate">Exam date</label>'
      + '<input class="ft-input" type="date" id="ftPlanDate" name="date" value="' + esc(date) + '" min="' + today + '"></div>'
      + '<div class="ft-row"><button type="submit" class="ft-btn ft-btn--small">' + (date ? 'Change the date' : 'Make my plan') + '</button>'
      + (date ? '<button type="button" class="ft-btn ft-btn--quiet ft-btn--small" data-act="exam-clear">Remove the date</button>' : '') + '</div>'
      + '<p class="ft-error" role="alert"></p></form>';
    if (!set.guide) return needGuide('Study plan');
    if (!conceptsNow().length) return noTerms('Study plan');
    const intro = '<p class="ft-lead">Add your exam date and the terms in this set are spread over the days left: learn the weakest first, review them a day, three days and a week later, and finish with a practice test.</p>';
    if (!date) return head + intro + form + '</section>';
    if (left < 0) return head + '<p class="ft-banner" role="note">Your exam date (' + esc(fmtDay(date)) + ') has passed. Pick a new date to get a new plan.</p>' + form + '</section>';
    const plan = set.plan;
    if (!plan) return head + form + '<p class="ft-help">The plan could not be made for that date.</p></section>';
    const items = planItems();
    const done = items.filter((it) => set.planDone[it.id]).length;
    let n = 0;
    return head
      + '<p class="ft-lead">' + (left === 0 ? 'Your exam is today.' : left === 1 ? 'Your exam is tomorrow.' : left + ' days until your exam on ' + esc(fmtDay(date)) + '.')
      + ' <span id="ftPlanCount">' + done + ' of ' + items.length + ' done.</span></p>'
      + (app.ui.planNote ? '<p class="ft-notice" role="note">' + esc(app.ui.planNote) + '</p>' : '')
      + (left > T.LIMITS.planDays ? '<p class="ft-help">The plan covers the next ' + T.LIMITS.planDays + ' days; it fills in as your exam gets closer.</p>' : '')
      + '<ol class="ft-plan">' + plan.days.map((d) => {
        const diff = T.daysBetween(today, d.date);
        const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : fmtDay(d.date);
        return '<li class="ft-plan-day' + (diff === 0 ? ' is-today' : '') + '"><h3 class="ft-plan-date">' + esc(label) + '</h3><ul class="ft-plan-items">'
          + d.items.map((it) => {
            n++;
            const checked = !!set.planDone[it.id];
            const go = it.type === 'learn' || it.type === 'review'
              ? '<button type="button" class="ft-mini" data-act="plan-go" data-plan="' + esc(it.id) + '">Start</button>'
              : '<a class="ft-mini" href="' + esc(setHash(set.id, it.type === 'test' ? 'test' : 'cards')) + '">Open</a>';
            return '<li class="ft-plan-item' + (checked ? ' is-done' : '') + '"><input type="checkbox" id="ftPlan' + n + '" data-plan="' + esc(it.id) + '"' + (checked ? ' checked' : '') + '>'
              + '<label for="ftPlan' + n + '">' + esc(it.label) + '</label>' + go + '</li>';
          }).join('') + '</ul></li>';
      }).join('') + '</ol>'
      + '<div class="ft-row"><button type="button" class="ft-btn ft-btn--quiet" data-act="plan-rebuild">Update the plan from my progress</button></div>'
      + form + '</section>';
  }
  function saveExamDate(form) {
    const set = app.open.set;
    const v = form.elements.date.value;
    const err = form.querySelector('.ft-error');
    if (!T.isYmd(v)) { err.textContent = 'Pick the date of your exam.'; return; }
    if (T.daysBetween(T.ymd(), v) < 0) { err.textContent = 'Pick today or a later date.'; return; }
    set.examDate = v;
    rebuildPlan();
    app.ui.planNote = '';
    renderScreen('#ftScreenTitle');
    announce('Your plan is ready.');
  }
  function togglePlan(box) {
    const set = app.open.set;
    const id = box.dataset.plan;
    if (box.checked) set.planDone[id] = true; else delete set.planDone[id];
    save();
    const li = box.closest('.ft-plan-item');
    if (li) li.classList.toggle('is-done', box.checked);
    const items = planItems();
    const count = document.getElementById('ftPlanCount');
    if (count) count.textContent = items.filter((it) => set.planDone[it.id]).length + ' of ' + items.length + ' done.';
  }
  function planGo(id) {
    const it = planItems().find((x) => x.id === id);
    if (!it) return;
    const known = it.conceptIds.filter((cid) => conceptById(cid));
    if (!known.length) { app.ui.planNote = 'Those terms are no longer in your study guide. Update the plan.'; renderScreen('#ftScreenTitle'); return; }
    beginLearn(known, { skipCheck: it.type === 'review' });
    go(setHash(app.open.set.id, 'learn'));
  }

  /* ── Events ─────────────────────────────────────────────────────────── */

  async function guarded(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); } catch (e) {
      if (window.console) console.error(e);
      toast('Something went wrong there. Try again.');
    } finally { busy = false; }
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !root.contains(btn) || btn.disabled) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    switch (act) {
      case 'sample': guarded(createSample); break;
      case 'import': { const f = document.getElementById('ftImportFile'); if (f) f.click(); break; }
      case 'export-all': guarded(libExportAll); break;
      case 'rename': guarded(() => libRename(id)); break;
      case 'duplicate': guarded(() => libDuplicate(id)); break;
      case 'export': guarded(() => libExport(id)); break;
      case 'delete': guarded(() => libDelete(id)); break;
      case 'restore': guarded(() => libRestore(id, false)); break;
      case 'purge': guarded(() => libPurge(id)); break;
      case 'restore-open': guarded(async () => {
        const sid = app.open.set.id;
        const res = await app.store.restore(sid);
        if (!res.ok) { showStoreError(res.error); return; }
        app.open.set = res.set;
        route();
      }); break;
      case 'reload-set': guarded(async () => {
        const sid = app.open.set.id;
        await app.store.flush();
        const set = await app.store.get(sid);
        if (!set) { renderMissing(); return; }
        const tab = app.tab;
        openSet(set, false);
        app.tab = tab;
        prepareTab(tab);
        renderScreen(focusTarget());
      }); break;
      case 'pick-photo': { const f = document.getElementById('ftPhotoFiles'); if (f) f.click(); break; }
      case 'pick-file': { const f = document.getElementById('ftMaterialFiles'); if (f) f.click(); break; }
      case 'src-add': addTypedNotes(); break;
      case 'src-remove': removeSource(btn.dataset.src); break;
      case 'build': buildFromNotes(); break;
      case 'guide-download': {
        const set = app.open.set;
        download(String(set.title || 'study-guide').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60) + '-study-guide.md', T.toMarkdown(set), 'text/markdown');
        toast('Downloaded your study guide as a Markdown (.md) file.');
        break;
      }
      case 'item-edit': startEdit(btn.dataset.what, id); break;
      case 'item-cancel': cancelEdit(); break;
      case 'item-delete': deleteItem(btn.dataset.what, id); break;
      case 'topics-all': case 'topics-none':
        root.querySelectorAll('input[name="topic"]').forEach((b) => { b.checked = act === 'topics-all'; });
        break;
      case 'learn-resume': app.ui.learnPick = false; renderScreen('#ftStepTitle'); break;
      case 'learn-pick': app.ui.learnPick = true; renderScreen('#ftScreenTitle'); break;
      case 'learn-shaky': {
        const sum = T.learnSummary(app.open.set.learn, conceptsNow(), app.open.set.mastery);
        beginLearn(sum.shaky, { skipCheck: true });
        renderScreen('#ftStepTitle');
        break;
      }
      case 'check-unsure': answerCheckQ(btn.closest('form'), true); break;
      case 'check-next': nextCheck(); break;
      case 'step-unsure': answerStepQ(btn.closest('form'), true); break;
      case 'step-back': moveStep('back'); break;
      case 'step-skip': moveStep('skip'); break;
      case 'step-repeat': moveStep('repeat'); break;
      case 'step-next': moveStep('next'); break;
      case 'step-simpler': stepHelp('simpler'); break;
      case 'step-example': stepHelp('example'); break;
      case 'test-quit': app.ui.test = null; persistTest(); stopTestTimer(); renderScreen('#ftScreenTitle'); announce('Test stopped. Nothing was marked.'); break;
      case 'test-new': app.ui.test = null; persistTest(); renderScreen('#ftScreenTitle'); break;
      case 'card-flip': flipCard(); break;
      case 'card-rate': rateCard(Number(btn.dataset.grade)); break;
      case 'cards-ahead': cardsAhead(); break;
      case 'cards-send': sendToFlashcards(); break;
      case 'plan-rebuild': rebuildPlan(); app.ui.planNote = 'Updated from your progress.'; renderScreen('#ftScreenTitle'); break;
      case 'plan-go': planGo(btn.dataset.plan); break;
      case 'exam-clear': {
        const set = app.open.set;
        set.examDate = '';
        set.plan = null;
        save();
        renderScreen('#ftScreenTitle');
        break;
      }
      default: break;
    }
  });

  root.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form || !form.dataset || !form.dataset.form) return;
    e.preventDefault();
    switch (form.dataset.form) {
      case 'item-edit': saveEdit(form); break;
      case 'add-term': addItem(form, 'terms'); break;
      case 'add-fact': addItem(form, 'facts'); break;
      case 'learn-start': startFromPicker(form); break;
      case 'check': answerCheckQ(form, false); break;
      case 'step': answerStepQ(form, false); break;
      case 'test-setup': startTest(form); break;
      case 'test': finishTest(false); break;
      case 'ask': runAsk(form); break;
      case 'exam': saveExamDate(form); break;
      default: break;
    }
  });

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && (t.dataset.field || t.dataset.srcText)) { onNotesInput(t); return; }
    if (t.closest && t.closest('form[data-form="test"]')) collectTestAnswer(t);
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'ftPhotoFiles' || t.id === 'ftMaterialFiles') {
      importFiles(t.files, t.id === 'ftPhotoFiles' ? 'Photo' : 'File');
      t.value = '';
      return;
    }
    if (t.id === 'ftImportFile') {
      const file = t.files && t.files[0];
      t.value = '';
      guarded(() => libImport(file));
      return;
    }
    if (t.dataset && t.dataset.plan && t.type === 'checkbox') { togglePlan(t); return; }
    if (t.dataset && t.dataset.field === 'examDate') { onNotesInput(t); save(); return; }
    // A typed field was left: save what is waiting now.
    if (t.dataset && (t.dataset.field || t.dataset.srcText)) { save(); return; }
    if (t.closest && t.closest('form[data-form="test"]')) collectTestAnswer(t);
  });
  root.addEventListener('toggle', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('ft-bin')) app.binOpen = e.target.open;
  }, true);
  root.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === 'Escape' && t.closest && t.closest('form[data-form="item-edit"]')) {
      e.preventDefault();
      cancelEdit();
    }
    // Enter in one answer must not hand in the whole practice test.
    if (e.key === 'Enter' && t.tagName === 'INPUT' && t.closest && t.closest('form[data-form="test"]')) e.preventDefault();
  });
  // Flashcard keys: Space shows the answer, 1–4 rate it (never while typing).
  document.addEventListener('keydown', (e) => {
    if (app.view !== 'set' || app.tab !== 'cards' || !app.ui.cards || e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tgt = e.target;
    if (tgt && (tgt.closest('input, textarea, select, dialog, .ft-toast') || tgt.isContentEditable)) return;
    if ((e.key === ' ' || e.key === 'Enter') && !app.ui.cards.flipped && (!tgt || !tgt.closest('button, a'))) {
      e.preventDefault();
      flipCard();
    } else if (/^[1-4]$/.test(e.key) && app.ui.cards.flipped) {
      e.preventDefault();
      rateCard(Number(e.key));
    }
  });

  // Dropping files on the notes screen.
  function hasFiles(e) { return !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')); }
  function dropZone(e) { return e.target.closest && e.target.closest('.ft-importer'); }
  function highlightDrop(zone, on) {
    if (!zone) return;
    zone.classList.toggle('is-dragging', on);
    const p = zone.querySelector('.ft-drop-prompt strong');
    if (p) p.textContent = on ? 'Let go to add your files' : 'Drop photos or files here';
  }
  root.addEventListener('dragenter', (e) => { const z = dropZone(e); if (!z || !hasFiles(e)) return; e.preventDefault(); highlightDrop(z, true); });
  root.addEventListener('dragover', (e) => {
    const z = dropZone(e);
    if (!z || !hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    highlightDrop(z, true);
  });
  root.addEventListener('dragleave', (e) => { const z = dropZone(e); if (!z || (e.relatedTarget && z.contains(e.relatedTarget))) return; highlightDrop(z, false); });
  root.addEventListener('drop', (e) => {
    const z = dropZone(e);
    if (!z || !hasFiles(e)) return;
    e.preventDefault();
    highlightDrop(z, false);
    importFiles(e.dataTransfer.files, 'Any');
  });
  // A file dropped anywhere else would open in the tab and leave Flux Tutor.
  window.addEventListener('dragover', (e) => { if (hasFiles(e) && !dropZone(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (hasFiles(e) && !dropZone(e)) e.preventDefault(); });

  /* ── Start ──────────────────────────────────────────────────────────── */

  function onStoreChange(c) {
    if (!c || !c.fromOtherTab) return;
    if (app.view === 'library' && !app.open) {
      const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('input, textarea, dialog');
      if (!busy && !typing && !document.querySelector('dialog[open]')) refreshLibrary();
      return;
    }
    if (app.open && !app.open.draft && c.id === app.open.set.id && !app.open.otherTab) {
      app.open.otherTab = true;
      const host = document.getElementById('ftOtherTab');
      if (host) host.innerHTML = otherTabBanner();
    }
  }

  async function start() {
    let store;
    try { store = await Store.open(); } catch (e) {
      root.innerHTML = '<p class="ft-alert" role="alert">Flux Tutor could not open its library. Reload the page to try again.</p>';
      return;
    }
    app.store = store;
    store.onStatus(onStatus);
    store.onChange(onStoreChange);
    const mig = await store.migrateLegacy();
    if (mig.ok && mig.migrated) {
      app.notice = mig.migrated === 1
        ? 'Your session from the first Flux Tutor beta is now a study set below, with everything you wrote in it.'
        : 'Your sessions from the first Flux Tutor beta are now ' + mig.migrated + ' study sets below, with everything you wrote in them.';
    } else if (!mig.ok && mig.error) app.libError = mig.error.message;
    window.addEventListener('hashchange', () => { route(); });
    await route();
  }

  if (window.FluxHub && typeof window.FluxHub.mountAll === 'function') window.FluxHub.mountAll();
  start();
})();
