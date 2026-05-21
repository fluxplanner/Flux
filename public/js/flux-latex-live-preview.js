/**
 * P29.1 — LaTeX live preview split pane (KaTeX).
 * Flag: enable_latex_live_preview (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_latex_live_preview';
  const STORE_KEY = 'flux_latex_preview_v1';
  const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
  const KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
  const SPLIT_ID = 'fluxLatexSplit';
  const PREVIEW_BODY_ID = 'fluxLatexPreviewBody';

  let katexPromise = null;
  let debounceTimer = null;

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

  function getPrefs() {
    const s = load(STORE_KEY, {});
    return { splitOpen: s.splitOpen !== false };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('latexLivePreview', getCloudSlice());
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    return getPrefs();
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs(data);
    updateSplitVisibility();
    refreshPreview();
  }

  function loadStylesheet(href) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`link[href="${href}"]`)) {
        resolve();
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('css load failed'));
      document.head.appendChild(link);
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('script load failed'));
      document.head.appendChild(script);
    });
  }

  function ensureKatex() {
    if (window.katex) return Promise.resolve(window.katex);
    if (!katexPromise) {
      katexPromise = loadStylesheet(KATEX_CSS)
        .then(() => loadScript(KATEX_JS))
        .then(() => {
          if (!window.katex) throw new Error('katex missing');
          return window.katex;
        })
        .catch((err) => {
          katexPromise = null;
          throw err;
        });
    }
    return katexPromise;
  }

  function editorText() {
    const el = document.getElementById('noteEditor');
    if (!el) return '';
    const d = document.createElement('div');
    d.innerHTML = el.innerHTML || '';
    return d.innerText || d.textContent || '';
  }

  function tokenizeMath(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      if (src.slice(i, i + 2) === '$$') {
        const end = src.indexOf('$$', i + 2);
        if (end !== -1) {
          tokens.push({ type: 'display', math: src.slice(i + 2, end).trim() });
          i = end + 2;
          continue;
        }
      }
      if (src.slice(i, i + 2) === '\\[') {
        const end = src.indexOf('\\]', i + 2);
        if (end !== -1) {
          tokens.push({ type: 'display', math: src.slice(i + 2, end).trim() });
          i = end + 2;
          continue;
        }
      }
      if (src.slice(i, i + 2) === '\\(') {
        const end = src.indexOf('\\)', i + 2);
        if (end !== -1) {
          tokens.push({ type: 'inline', math: src.slice(i + 2, end).trim() });
          i = end + 2;
          continue;
        }
      }
      if (src[i] === '$' && src[i + 1] !== '$') {
        const end = src.indexOf('$', i + 1);
        if (end !== -1) {
          tokens.push({ type: 'inline', math: src.slice(i + 1, end).trim() });
          i = end + 1;
          continue;
        }
      }

      let next = src.length;
      for (const marker of ['$$', '\\[', '\\(', '$']) {
        const idx = src.indexOf(marker, i);
        if (idx !== -1 && idx < next) next = idx;
      }
      const text = src.slice(i, next);
      if (text) tokens.push({ type: 'text', text });
      i = next === i ? i + 1 : next;
    }
    return tokens;
  }

  function renderTokens(tokens, katex) {
    if (!tokens.length) {
      return `<div class="flux-latex-preview-empty">${esc(T('latex.empty'))}</div>`;
    }
    return tokens
      .map((tok) => {
        if (tok.type === 'text') {
          return `<span class="flux-latex-text">${esc(tok.text)}</span>`;
        }
        try {
          return katex.renderToString(tok.math, {
            displayMode: tok.type === 'display',
            throwOnError: false,
            strict: 'ignore',
          });
        } catch (err) {
          return `<span class="flux-latex-err">${esc(tok.math || err.message)}</span>`;
        }
      })
      .join('');
  }

  async function refreshPreview() {
    if (!enabled()) return;
    const body = document.getElementById(PREVIEW_BODY_ID);
    if (!body || !getPrefs().splitOpen) return;
    const text = editorText();
    if (!text.trim()) {
      body.innerHTML = `<div class="flux-latex-preview-empty">${esc(T('latex.empty'))}</div>`;
      return;
    }
    try {
      const katex = await ensureKatex();
      body.innerHTML = renderTokens(tokenizeMath(text), katex);
    } catch (_) {
      body.innerHTML = `<div class="flux-latex-preview-empty">${esc(T('latex.load_fail'))}</div>`;
    }
  }

  function scheduleRefresh() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      refreshPreview();
    }, 280);
  }

  function updateSplitVisibility() {
    const wrap = document.getElementById(SPLIT_ID);
    const toggle = document.getElementById('fluxLatexToggleBtn');
    const open = getPrefs().splitOpen;
    if (wrap) wrap.classList.toggle('is-collapsed', !open);
    if (toggle) toggle.classList.toggle('flux-latex-active', open);
    if (open) refreshPreview();
  }

  function toggleSplit() {
    const next = !getPrefs().splitOpen;
    persistPrefs({ splitOpen: next });
    updateSplitVisibility();
    toast(next ? T('latex.split_on') : T('latex.split_off'), 'info');
  }

  function insertAtCursor(text) {
    const el = document.getElementById('noteEditor');
    if (!el) return;
    el.focus();
    try {
      document.execCommand('insertText', false, text);
    } catch (_) {
      el.innerHTML += esc(text);
    }
    scheduleRefresh();
  }

  function insertInlineTemplate() {
    insertAtCursor('$E=mc^2$');
  }

  function insertDisplayTemplate() {
    insertAtCursor('\n$$\n\\frac{a}{b}\n$$\n');
  }

  function ensureSplitLayout() {
    const editor = document.getElementById('noteEditor');
    if (!editor) return;

    if (!document.getElementById(SPLIT_ID)) {
      const wrap = document.createElement('div');
      wrap.id = SPLIT_ID;
      wrap.className = 'flux-latex-split';
      editor.parentNode.insertBefore(wrap, editor);
      wrap.appendChild(editor);

      const preview = document.createElement('div');
      preview.id = 'fluxLatexPreview';
      preview.className = 'flux-latex-preview-pane';
      preview.innerHTML = `<div class="flux-latex-preview-head">${esc(T('latex.preview'))}</div><div id="${PREVIEW_BODY_ID}" class="flux-latex-preview-body"></div>`;
      wrap.appendChild(preview);

      if (!editor.dataset.fluxLatexInput) {
        editor.addEventListener('input', scheduleRefresh);
        editor.dataset.fluxLatexInput = '1';
      }
    }

    ensureToolbarButtons();
    updateSplitVisibility();
  }

  function ensureToolbarButtons() {
    const rtbar = document.querySelector('#notesEditorView .rtbar');
    if (!rtbar || document.getElementById('fluxLatexToggleBtn')) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'fluxLatexToggleBtn';
    toggle.className = 'rtbtn';
    toggle.title = T('latex.toggle');
    toggle.textContent = '∑';
    toggle.addEventListener('click', toggleSplit);

    const inlineBtn = document.createElement('button');
    inlineBtn.type = 'button';
    inlineBtn.className = 'rtbtn';
    inlineBtn.title = T('latex.insert_inline');
    inlineBtn.textContent = '$x$';
    inlineBtn.addEventListener('click', insertInlineTemplate);

    const displayBtn = document.createElement('button');
    displayBtn.type = 'button';
    displayBtn.className = 'rtbtn';
    displayBtn.title = T('latex.insert_display');
    displayBtn.textContent = '$$';
    displayBtn.addEventListener('click', insertDisplayTemplate);

    rtbar.appendChild(toggle);
    rtbar.appendChild(inlineBtn);
    rtbar.appendChild(displayBtn);
  }

  function wrapOpenNote() {
    const orig = window.openNote;
    if (typeof orig !== 'function' || orig._fluxLatexWrapped) return;
    window.openNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) ensureSplitLayout();
      } catch (_) {}
      return r;
    };
    window.openNote._fluxLatexWrapped = true;
  }

  function wrapOpenNewNote() {
    const orig = window.openNewNote;
    if (typeof orig !== 'function' || orig._fluxLatexWrapped) return;
    window.openNewNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) ensureSplitLayout();
      } catch (_) {}
      return r;
    };
    window.openNewNote._fluxLatexWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('latex.palette');
    const keys = 'latex katex math equation preview split';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '∑',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="notes"]');
            window.nav('notes', tab);
          }
          persistPrefs({ splitOpen: true });
          setTimeout(() => {
            const notes = Array.isArray(window.notes) ? window.notes : [];
            if (notes.length && typeof window.openNote === 'function') {
              window.openNote(notes[0].id);
            } else if (typeof window.openNewNote === 'function') {
              window.openNewNote();
            }
            ensureSplitLayout();
            updateSplitVisibility();
          }, 300);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapOpenNote();
    wrapOpenNewNote();
    if (document.getElementById('notesEditorView')?.style.display !== 'none') {
      ensureSplitLayout();
    }
    return true;
  }

  window.FluxLatexLivePreview = {
    FLAG,
    enabled,
    toggleSplit,
    refreshPreview,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
