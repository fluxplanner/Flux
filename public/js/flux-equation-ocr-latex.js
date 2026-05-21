/**
 * P30.1 — Equation OCR → LaTeX (Gemini vision + manual correct).
 * Flag: enable_equation_ocr_latex (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_equation_ocr_latex';
  const STORE_KEY = 'flux_equation_ocr_v1';
  const OVERLAY_ID = 'fluxEquationOcrOverlay';
  const FILE_INPUT_ID = 'fluxEquationOcrFile';
  const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
  const KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';

  const OCR_PROMPT =
    'This image shows a handwritten or printed mathematical equation. Return ONLY valid LaTeX math notation with no markdown fences, no $$ delimiters, and no explanation. Use standard LaTeX: \\\\frac, \\\\sqrt, ^, _, greek letters, etc.';

  let katexPromise = null;
  let previewTimer = null;

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
    return { converted: s.converted || 0 };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('equationOcrLatex', getCloudSlice());
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    return getPrefs();
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs(data);
  }

  function cleanLatex(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^```(?:latex|tex)?\s*/i, '').replace(/```\s*$/i, '').trim();
    s = s.replace(/^\$\$|\$\$$/g, '').trim();
    s = s.replace(/^\\\[|\\\]$/g, '').trim();
    s = s.replace(/^\\\(|\\\)$/g, '').trim();
    return s;
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

  async function renderPreview(latex, el) {
    if (!el) return;
    const cleaned = cleanLatex(latex);
    if (!cleaned) {
      el.innerHTML = `<span class="flux-eocr-err">${esc(T('eocr.preview_empty'))}</span>`;
      return;
    }
    try {
      const katex = await ensureKatex();
      el.innerHTML = katex.renderToString(cleaned, {
        displayMode: true,
        throwOnError: false,
        strict: 'ignore',
      });
    } catch (_) {
      el.innerHTML = `<span class="flux-eocr-err">${esc(cleaned)}</span>`;
    }
  }

  function closeModal() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function insertIntoNote(latex) {
    const cleaned = cleanLatex(latex);
    if (!cleaned) {
      toast(T('eocr.empty'), 'warning');
      return false;
    }
    const editor = document.getElementById('noteEditor');
    if (!editor) {
      toast(T('eocr.no_editor'), 'warning');
      return false;
    }
    const block = `\n<p>$$${cleaned}$$</p>\n`;
    editor.innerHTML = (editor.innerHTML || '') + block;
    try {
      if (window.FluxLatexLivePreview?.refreshPreview) window.FluxLatexLivePreview.refreshPreview();
    } catch (_) {}
    persistPrefs({ converted: getPrefs().converted + 1 });
    toast(T('eocr.inserted'), 'success');
    return true;
  }

  function openCorrectionModal(latex, thumbUrl) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'flux-eocr-overlay';
    overlay.innerHTML = `<div class="flux-eocr-panel" role="dialog" aria-label="${esc(T('eocr.title'))}">
  <div class="flux-eocr-head">
    <div style="font-weight:800;font-size:.85rem">${esc(T('eocr.title'))}</div>
    <button type="button" data-eocr-close style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem">✕</button>
  </div>
  <div class="flux-eocr-body">
    ${thumbUrl ? `<img class="flux-eocr-thumb" src="" alt="" />` : ''}
    <div class="flux-eocr-label">${esc(T('eocr.edit_label'))}</div>
    <textarea class="flux-eocr-textarea" id="fluxEocrLatexInput"></textarea>
    <div class="flux-eocr-label">${esc(T('eocr.preview_label'))}</div>
    <div class="flux-eocr-preview" id="fluxEocrPreview"></div>
  </div>
  <div class="flux-eocr-foot">
    <button type="button" class="btn-sec" data-eocr-close>${esc(T('eocr.cancel'))}</button>
    <button type="button" class="flux-eocr-insert-btn" data-eocr-insert>${esc(T('eocr.insert'))}</button>
  </div>
</div>`;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('#fluxEocrLatexInput');
    input.value = cleanLatex(latex);
    const preview = overlay.querySelector('#fluxEocrPreview');
    const thumb = overlay.querySelector('.flux-eocr-thumb');
    if (thumb && thumbUrl) thumb.src = thumbUrl;

    const schedulePreview = () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => renderPreview(input.value, preview), 200);
    };

    input.addEventListener('input', schedulePreview);
    schedulePreview();

    overlay.querySelectorAll('[data-eocr-close]').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('[data-eocr-insert]')?.addEventListener('click', () => {
      if (insertIntoNote(input.value)) closeModal();
    });
  }

  function openLoadingModal(thumbUrl) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'flux-eocr-overlay';
    overlay.innerHTML = `<div class="flux-eocr-panel" role="dialog">
  <div class="flux-eocr-head"><div style="font-weight:800;font-size:.85rem">${esc(T('eocr.title'))}</div></div>
  <div class="flux-eocr-body">
    ${thumbUrl ? `<img class="flux-eocr-thumb" src="" alt="" />` : ''}
    <div class="flux-eocr-loading">${esc(T('eocr.reading'))}</div>
  </div>
</div>`;
    document.body.appendChild(overlay);
    const thumb = overlay.querySelector('.flux-eocr-thumb');
    if (thumb && thumbUrl) thumb.src = thumbUrl;
  }

  async function processFile(file) {
    if (!file || !enabled()) return;
    if (typeof window.callGemini !== 'function' || typeof window.fileToBase64 !== 'function') {
      toast(T('eocr.unavailable'), 'warning');
      return;
    }

    const thumbUrl = URL.createObjectURL(file);
    openLoadingModal(thumbUrl);

    try {
      const base64 = await window.fileToBase64(file);
      const raw = await window.callGemini(base64, file.type || 'image/jpeg', OCR_PROMPT);
      const latex = cleanLatex(raw);
      if (!latex) throw new Error(T('eocr.no_latex'));
      openCorrectionModal(latex, thumbUrl);
    } catch (err) {
      closeModal();
      toast(err.message || T('eocr.failed'), 'error');
    } finally {
      setTimeout(() => URL.revokeObjectURL(thumbUrl), 5000);
    }
  }

  function ensureFileInput() {
    let input = document.getElementById(FILE_INPUT_ID);
    if (input) return input;
    input = document.createElement('input');
    input.type = 'file';
    input.id = FILE_INPUT_ID;
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) processFile(file);
    });
    document.body.appendChild(input);
    return input;
  }

  function pickEquationPhoto() {
    if (!enabled()) return;
    const editor = document.getElementById('noteEditor');
    if (!editor) {
      toast(T('eocr.open_note'), 'warning');
      return;
    }
    ensureFileInput().click();
  }

  function enhanceNotesToolbar() {
    const toolbar = document.querySelector('#notesEditorView [onclick*="generateFlashcardsFromNote"]')?.parentElement;
    if (!toolbar || document.getElementById('fluxEocrBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fluxEocrBtn';
    btn.style.cssText =
      'padding:6px 10px;font-size:.78rem;border-radius:8px;background:rgba(192,132,252,.12);border:1px solid rgba(192,132,252,.28);color:var(--purple);cursor:pointer';
    btn.textContent = '📐 ' + T('eocr.btn');
    btn.title = T('eocr.btn_hint');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      pickEquationPhoto();
    });

    const photoLabel = toolbar.querySelector('label[for], label input[type="file"]')?.closest('label')
      || toolbar.querySelector('label');
    if (photoLabel) photoLabel.insertAdjacentElement('afterend', btn);
    else toolbar.appendChild(btn);
  }

  function wrapOpenNote() {
    const orig = window.openNote;
    if (typeof orig !== 'function' || orig._fluxEocrWrapped) return;
    window.openNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) enhanceNotesToolbar();
      } catch (_) {}
      return r;
    };
    window.openNote._fluxEocrWrapped = true;
  }

  function wrapOpenNewNote() {
    const orig = window.openNewNote;
    if (typeof orig !== 'function' || orig._fluxEocrWrapped) return;
    window.openNewNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) enhanceNotesToolbar();
      } catch (_) {}
      return r;
    };
    window.openNewNote._fluxEocrWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('eocr.palette');
    const keys = 'equation ocr latex photo math scan';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📐',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="notes"]');
            window.nav('notes', tab);
          }
          setTimeout(() => {
            if (typeof window.openNewNote === 'function') window.openNewNote();
            enhanceNotesToolbar();
            pickEquationPhoto();
          }, 300);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapOpenNote();
    wrapOpenNewNote();
    enhanceNotesToolbar();
    return true;
  }

  window.FluxEquationOcrLatex = {
    FLAG,
    enabled,
    pickEquationPhoto,
    processFile,
    cleanLatex,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
