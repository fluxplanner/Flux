/**
 * P26.1 — Periodic table SRS quizzes (symbol / name / number).
 * Flag: enable_periodic_srs_quiz (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_periodic_srs_quiz';
  const STORE_KEY = 'flux_periodic_srs_v1';
  const TOOL_ID = 'periodic-srs';

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

  function elements() {
    const list = window.fluxPeriodic?.ELEMENTS;
    return Array.isArray(list) ? list : [];
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    return {
      mode: s.mode || 'sym_name',
      catFilter: s.catFilter || 'all',
      cards: s.cards && typeof s.cards === 'object' ? s.cards : {},
      stats: {
        reviewed: s.stats?.reviewed || 0,
        correct: s.stats?.correct || 0,
        sessions: s.stats?.sessions || 0,
      },
      wrongQueue: Array.isArray(s.wrongQueue) ? s.wrongQueue : [],
    };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('periodicSrsQuiz', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    const s = getStore();
    return { mode: s.mode, catFilter: s.catFilter, cards: s.cards, stats: s.stats, wrongQueue: s.wrongQueue };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistStore({
      mode: data.mode || 'sym_name',
      catFilter: data.catFilter || 'all',
      cards: data.cards || {},
      stats: data.stats || { reviewed: 0, correct: 0, sessions: 0 },
      wrongQueue: Array.isArray(data.wrongQueue) ? data.wrongQueue : [],
    });
  }

  function cardKey(el, mode) {
    return `${el.n}_${mode}`;
  }

  function getCard(el, mode) {
    const store = getStore();
    const k = cardKey(el, mode);
    return (
      store.cards[k] || {
        interval: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        nextDue: todayStr(),
      }
    );
  }

  function setCard(el, mode, card) {
    const store = getStore();
    store.cards[cardKey(el, mode)] = card;
    persistStore(store);
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

  function filteredElements() {
    const store = getStore();
    return elements().filter((el) => store.catFilter === 'all' || el.cat === store.catFilter);
  }

  function dueElements(mode) {
    const today = todayStr();
    const pool = filteredElements();
    const due = pool.filter((el) => getCard(el, mode).nextDue <= today);
    if (due.length) return due;
    return pool.filter((el) => getCard(el, mode).reps === 0).slice(0, 12);
  }

  function promptAnswer(el, mode) {
    if (mode === 'sym_name') return { prompt: el.s, sub: T('ptsrs.q_sym_name'), answer: el.name };
    if (mode === 'name_sym') return { prompt: el.name, sub: T('ptsrs.q_name_sym'), answer: el.s };
    if (mode === 'num_sym') return { prompt: String(el.n), sub: T('ptsrs.q_num_sym'), answer: el.s };
    return { prompt: el.s, sub: '', answer: el.name };
  }

  function distractors(el, mode, count) {
    const pool = filteredElements().filter((x) => x.n !== el.n);
    const answers = new Set();
    const target = promptAnswer(el, mode).answer;
    answers.add(target);
    const sameCat = pool.filter((x) => x.cat === el.cat);
    const src = [...sameCat, ...pool].sort(() => Math.random() - 0.5);
    for (const x of src) {
      const a = promptAnswer(x, mode).answer;
      if (!answers.has(a)) {
        answers.add(a);
        if (answers.size >= count + 1) break;
      }
    }
    return [...answers].filter((a) => a !== target).slice(0, count);
  }

  function pickNext(mode) {
    const store = getStore();
    if (store.wrongQueue.length) {
      const n = store.wrongQueue.shift();
      persistStore(store);
      const el = elements().find((e) => e.n === n);
      if (el) return el;
    }
    const due = dueElements(mode);
    if (!due.length) return null;
    return due[Math.floor(Math.random() * due.length)];
  }

  function startSession(mode) {
    session = { mode, el: pickNext(mode), revealed: false, picked: null };
    return session;
  }

  function recordGrade(quality, wasCorrect) {
    if (!session?.el) return;
    const store = getStore();
    const card = schedule(getCard(session.el, session.mode), quality);
    store.cards[cardKey(session.el, session.mode)] = card;
    store.stats.reviewed = (store.stats.reviewed || 0) + 1;
    if (wasCorrect) store.stats.correct = (store.stats.correct || 0) + 1;
    if (!wasCorrect && !store.wrongQueue.includes(session.el.n)) store.wrongQueue.push(session.el.n);
    persistStore(store);
  }

  function renderQuizBody(body) {
    const store = getStore();
    if (!session) startSession(store.mode);
    const mode = store.mode;

    const statsHtml = `<div class="flux-ptsrs-stats">
  <div class="flux-ptsrs-stat"><div class="flux-ptsrs-stat-val">${dueElements(mode).length}</div><div class="flux-ptsrs-stat-lbl">${esc(T('ptsrs.due'))}</div></div>
  <div class="flux-ptsrs-stat"><div class="flux-ptsrs-stat-val">${store.stats.correct || 0}</div><div class="flux-ptsrs-stat-lbl">${esc(T('ptsrs.correct'))}</div></div>
  <div class="flux-ptsrs-stat"><div class="flux-ptsrs-stat-val">${store.wrongQueue.length}</div><div class="flux-ptsrs-stat-lbl">${esc(T('ptsrs.review'))}</div></div>
</div>`;

    const modes = [
      ['sym_name', T('ptsrs.mode_sym')],
      ['name_sym', T('ptsrs.mode_name')],
      ['num_sym', T('ptsrs.mode_num')],
    ];
    const modeHtml = `<div class="flux-ptsrs-mode-row">${modes
      .map(
        ([id, lbl]) =>
          `<button type="button" class="btn-sec${mode === id ? ' active' : ''}" data-ptsrs-mode="${esc(id)}">${esc(lbl)}</button>`,
      )
      .join('')}</div>`;

    if (!session.el) {
      body.innerHTML = `${statsHtml}${modeHtml}<p style="font-size:.78rem;color:var(--muted);text-align:center">${esc(T('ptsrs.all_caught_up'))}</p>`;
      bindModeButtons(body);
      return;
    }

    const { prompt, sub, answer } = promptAnswer(session.el, mode);
    const opts = [answer, ...distractors(session.el, mode, 3)].sort(() => Math.random() - 0.5);

    body.innerHTML = `${statsHtml}${modeHtml}
<div class="flux-ptsrs-card">
  <div class="flux-ptsrs-prompt">${esc(prompt)}</div>
  <div class="flux-ptsrs-sub">${esc(sub)}</div>
  <div class="flux-ptsrs-options">
    ${opts
      .map((o) => {
        let cls = 'flux-ptsrs-opt';
        if (session.revealed) {
          if (o === answer) cls += ' correct';
          else if (o === session.picked) cls += ' wrong';
        }
        return `<button type="button" class="${cls}" data-ptsrs-opt="${esc(o)}"${session.revealed ? ' disabled' : ''}>${esc(o)}</button>`;
      })
      .join('')}
  </div>
  ${
    session.revealed
      ? `<div class="flux-ptsrs-grade">
    <button type="button" class="btn-sec" data-ptsrs-q="1">${esc(T('ptsrs.again'))}</button>
    <button type="button" class="btn-sec" data-ptsrs-q="3">${esc(T('ptsrs.hard'))}</button>
    <button type="button" class="btn-sec" data-ptsrs-q="4">${esc(T('ptsrs.good'))}</button>
    <button type="button" class="btn-sec" data-ptsrs-q="5">${esc(T('ptsrs.easy'))}</button>
  </div>`
      : ''
  }
</div>`;

    bindModeButtons(body);
    body.querySelectorAll('[data-ptsrs-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (session.revealed) return;
        session.picked = btn.getAttribute('data-ptsrs-opt');
        session.revealed = true;
        const ok = session.picked === answer;
        renderQuizBody(body);
        if (ok) toast(T('ptsrs.nice'), 'success');
        else toast(T('ptsrs.oops', { answer }), 'warning');
      });
    });
    body.querySelectorAll('[data-ptsrs-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = parseInt(btn.getAttribute('data-ptsrs-q'), 10);
        recordGrade(q, session.picked === answer);
        startSession(store.mode);
        renderQuizBody(body);
      });
    });
  }

  function bindModeButtons(body) {
    body.querySelectorAll('[data-ptsrs-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const store = getStore();
        store.mode = btn.getAttribute('data-ptsrs-mode');
        persistStore(store);
        startSession(store.mode);
        renderQuizBody(body);
      });
    });
  }

  function openQuiz() {
    if (!enabled()) return;
    if (!elements().length) {
      toast(T('ptsrs.no_elements'), 'warning');
      return;
    }
    const store = getStore();
    store.stats.sessions = (store.stats.sessions || 0) + 1;
    persistStore(store);
    startSession(store.mode);
    if (typeof window.fluxOpenToolModal !== 'function') {
      toast(T('ptsrs.unavailable'), 'warning');
      return;
    }
    window.fluxOpenToolModal({
      id: TOOL_ID,
      emoji: '⚗',
      title: T('ptsrs.title'),
      wide: true,
      renderBody: renderQuizBody,
    });
  }

  function registerToolbox() {
    const layout = window.fluxToolbox?.UNIFIED_LAYOUT;
    if (!layout || !enabled()) return;
    const sci = layout.find((s) => s.id === 'science');
    if (!sci || sci.tools.some((t) => t.id === TOOL_ID)) return;
    sci.tools.push({
      id: TOOL_ID,
      label: T('ptsrs.tool_label'),
      icon: '🧪',
      desc: T('ptsrs.tool_desc'),
      mode: 'modal',
      fn: 'openPeriodicSrsQuiz',
    });
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('ptsrs.palette');
    const keys = 'periodic element quiz srs chemistry symbol';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '⚗',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="toolbox"]');
            window.nav('toolbox', tab);
          }
          setTimeout(() => openQuiz(), 250);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    registerToolbox();
    try {
      if (window.fluxToolbox?.render) window.fluxToolbox.render();
    } catch (_) {}
    return true;
  }

  window.openPeriodicSrsQuiz = openQuiz;
  window.FluxPeriodicSrsQuiz = {
    FLAG,
    enabled,
    schedule,
    getCloudSlice,
    applyFromCloud,
    openQuiz,
    getPaletteCommands,
    install,
  };
})();
