/**
 * P13.1 — Global search v2: fuzzy match, keyboard nav, recent queries.
 * Flag: enable_global_search_v2 (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_global_search_v2';
  const STORE_KEY = 'flux_global_search_recents_v1';
  const MAX_RECENTS = 8;
  let _idx = 0;
  let _wrapped = false;

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

  function fuzzyMatch(text, q) {
    if (!q) return true;
    const t = String(text || '').toLowerCase();
    const qq = String(q || '').toLowerCase().trim();
    if (!qq) return true;
    if (t.includes(qq)) return 2;
    let ti = 0;
    for (let qi = 0; qi < qq.length; qi++) {
      const c = qq[qi];
      let found = false;
      while (ti < t.length) {
        if (t[ti++] === c) {
          found = true;
          break;
        }
      }
      if (!found) return 0;
    }
    return 1;
  }

  function fuzzyScore(text, q) {
    const m = fuzzyMatch(text, q);
    return m === 2 ? 100 : m === 1 ? 50 : 0;
  }

  function getRecents() {
    const rows = load(STORE_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function persistRecents(rows) {
    save(STORE_KEY, rows.slice(0, MAX_RECENTS));
    try {
      if (typeof window.syncKey === 'function') window.syncKey('globalSearchRecents', rows.slice(0, MAX_RECENTS));
    } catch (_) {}
  }

  function applyFromCloud(data) {
    if (!Array.isArray(data)) return;
    save(STORE_KEY, data.slice(0, MAX_RECENTS));
  }

  function getCloudSlice() {
    return getRecents();
  }

  function recordQuery(q) {
    const needle = String(q || '').trim();
    if (!needle || needle.length < 2) return;
    const next = [needle, ...getRecents().filter((r) => r !== needle)].slice(0, MAX_RECENTS);
    persistRecents(next);
  }

  function ctxTasks() {
    return typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
  }

  function ctxNotes() {
    return typeof window.notes !== 'undefined' && Array.isArray(window.notes) ? window.notes : [];
  }

  function stripHtml(h) {
    if (typeof window.strip === 'function') return window.strip(h || '');
    return String(h || '').replace(/<[^>]+>/g, '');
  }

  function buildResults(q) {
    const qq = String(q || '').trim().toLowerCase();
    const results = [];
    if (!qq) return results;

    ctxTasks().forEach((t) => {
      let score = fuzzyScore(t.name, qq);
      const sub =
        typeof window.getSubjects === 'function' ? window.getSubjects()[t.subject] : null;
      if (sub) score += fuzzyScore(sub.name, qq) * 0.35 + fuzzyScore(sub.short, qq) * 0.2;
      if (t.notes) score += fuzzyScore(stripHtml(t.notes), qq) * 0.15;
      if (score <= 0) return;
      results.push({
        type: 'task',
        label: t.name,
        sub: sub ? sub.short : '',
        done: !!t.done,
        score,
        action: () => {
          recordQuery(qq);
          if (typeof window.closeGlobalSearch === 'function') window.closeGlobalSearch();
          if (typeof window.nav === 'function') window.nav('dashboard');
          setTimeout(() => {
            const te = document.querySelector('[data-task-id="' + t.id + '"]');
            if (te) te.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 200);
        },
      });
    });

    ctxNotes().forEach((n) => {
      const blob = (n.title || '') + ' ' + stripHtml(n.body || '');
      const score = Math.max(fuzzyScore(n.title, qq), fuzzyScore(blob, qq) * 0.85);
      if (score <= 0) return;
      results.push({
        type: 'note',
        label: n.title || T('note.untitled'),
        sub: '',
        score,
        action: () => {
          recordQuery(qq);
          if (typeof window.closeGlobalSearch === 'function') window.closeGlobalSearch();
          if (typeof window.nav === 'function') window.nav('notes');
          setTimeout(() => {
            if (typeof window.openNote === 'function') window.openNote(n.id);
          }, 100);
        },
      });
    });

    if (typeof window.getSubjects === 'function') {
      Object.entries(window.getSubjects()).forEach(([, v]) => {
        const score = Math.max(fuzzyScore(v.name, qq), fuzzyScore(v.short, qq));
        if (score <= 0) return;
        results.push({
          type: 'class',
          label: v.name,
          sub: v.short,
          score,
          action: () => {
            recordQuery(qq);
            if (typeof window.closeGlobalSearch === 'function') window.closeGlobalSearch();
            if (typeof window.nav === 'function') window.nav('school');
          },
        });
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 16);
  }

  function setActiveIndex(idx) {
    const el = document.getElementById('globalSearchResults');
    if (!el) return;
    const items = el.querySelectorAll('.search-result-item');
    if (!items.length) return;
    _idx = Math.max(0, Math.min(idx, items.length - 1));
    items.forEach((node, i) => {
      node.classList.toggle('active', i === _idx);
      if (i === _idx) node.scrollIntoView({ block: 'nearest' });
    });
  }

  function renderResults(results) {
    const el = document.getElementById('globalSearchResults');
    if (!el) return;
    _idx = 0;
    if (!results.length) {
      el.innerHTML =
        '<div class="search-empty">' +
        esc(T('search.no_results')) +
        '</div>';
      window.globalSearchResults = [];
      return;
    }
    window.globalSearchResults = results.map((r) => r.action);
    el.innerHTML = results
      .map(
        (r, i) =>
          `<div class="search-result-item${i === 0 ? ' active' : ''}" data-gs-idx="${i}" role="option" aria-selected="${i === 0 ? 'true' : 'false'}">
      <span class="search-result-type">${esc(r.type)}</span>
      <span style="flex:1;${r.done ? 'text-decoration:line-through;opacity:.55' : ''}">${esc(r.label)}</span>
      ${r.sub ? `<span style="font-size:.62rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(r.sub)}</span>` : ''}
    </div>`
      )
      .join('');
    el.querySelectorAll('.search-result-item').forEach((node, i) => {
      node.addEventListener('click', () => {
        recordQuery(document.getElementById('globalSearchInput')?.value || '');
        window.globalSearchResults[i]?.();
      });
      node.addEventListener('mouseenter', () => setActiveIndex(i));
    });
  }

  function renderRecentsEmpty() {
    const el = document.getElementById('globalSearchResults');
    if (!el) return;
    _idx = 0;
    const recents = getRecents();
    if (!recents.length) {
      el.innerHTML =
        '<div class="search-empty flux-gs-v2-hint">' + esc(T('search.hint')) + '</div>';
      window.globalSearchResults = [];
      return;
    }
    const chips = recents
      .map(
        (r) =>
          `<button type="button" class="flux-gs-recent-chip">${esc(r)}</button>`
      )
      .join('');
    el.innerHTML =
      '<div class="flux-gs-recents"><div class="flux-gs-recents-label">' +
      esc(T('search.recents')) +
      '</div><div class="flux-gs-recent-row">' +
      chips +
      '</div><div class="flux-gs-v2-foot">' +
      esc(T('search.kbd_hint')) +
      '</div></div>';
    el.querySelectorAll('.flux-gs-recent-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('globalSearchInput');
        if (!input) return;
        const term = btn.textContent || '';
        input.value = term;
        run(term);
        input.focus();
      });
    });
    window.globalSearchResults = [];
  }

  function run(q) {
    if (!enabled()) return false;
    const qq = String(q || '').trim();
    if (!qq) {
      renderRecentsEmpty();
      return true;
    }
    renderResults(buildResults(qq));
    return true;
  }

  function handleKeydown(e) {
    if (!enabled()) return;
    const overlay = document.getElementById('searchOverlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    const input = document.getElementById('globalSearchInput');
    if (!input || document.activeElement !== input) return;

    const items = document.querySelectorAll('#globalSearchResults .search-result-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) setActiveIndex(_idx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) setActiveIndex(_idx - 1);
    } else if (e.key === 'Enter') {
      if (!items.length) return;
      e.preventDefault();
      window.globalSearchResults[_idx]?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof window.closeGlobalSearch === 'function') window.closeGlobalSearch();
    }
  }

  function onOpen() {
    if (!enabled()) return;
    _idx = 0;
    renderRecentsEmpty();
    const input = document.getElementById('globalSearchInput');
    if (input && !input._fluxGsV2Key) {
      input.addEventListener('keydown', handleKeydown);
      input._fluxGsV2Key = true;
    }
  }

  function install() {
    if (!enabled() || _wrapped) return false;
    const origRun = window.runGlobalSearch;
    window.runGlobalSearch = function (q) {
      if (enabled() && run(q)) return;
      if (typeof origRun === 'function') return origRun(q);
    };
    const origHandle = window.handleGlobalSearch;
    window.handleGlobalSearch = function (q) {
      const t = String(q || '').trim();
      if (enabled() && !t) {
        clearTimeout(window._globalSearchDebounce);
        run('');
        return;
      }
      if (typeof origHandle === 'function') return origHandle(q);
    };
    const origOpen = window.openGlobalSearch;
    window.openGlobalSearch = function () {
      if (typeof origOpen === 'function') origOpen();
      else {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) overlay.classList.add('open');
        const input = document.getElementById('globalSearchInput');
        if (input) {
          input.value = '';
          input.focus();
        }
        const res = document.getElementById('globalSearchResults');
        if (res) res.innerHTML = '';
      }
      onOpen();
    };
    _wrapped = true;
    return true;
  }

  window.FluxGlobalSearchV2 = {
    FLAG,
    enabled,
    run,
    buildResults,
    recordQuery,
    getCloudSlice,
    applyFromCloud,
    install,
  };
})();
