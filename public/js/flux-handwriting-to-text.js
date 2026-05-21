/**
 * P34.1 — Handwriting-to-text for notes (Tesseract.js, on-device).
 * Flag: enable_handwriting_to_text (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_handwriting_to_text';
  const STORE_KEY = 'flux_handwriting_ocr_v1';
  const OVERLAY_ID = 'fluxHandwritingOverlay';
  const FILE_INPUT_ID = 'fluxHandwritingFile';
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  let tesseractPromise = null;

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
    return { scans: s.scans || 0 };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('handwritingToText', getCloudSlice());
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

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tesseractPromise) {
      tesseractPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-flux-tesseract]');
        if (existing) {
          existing.addEventListener('load', () => resolve(window.Tesseract));
          existing.addEventListener('error', () => reject(new Error('tesseract_load_failed')));
          if (window.Tesseract) resolve(window.Tesseract);
          return;
        }
        const s = document.createElement('script');
        s.src = TESSERACT_URL;
        s.async = true;
        s.dataset.fluxTesseract = '1';
        s.onload = () => resolve(window.Tesseract);
        s.onerror = () => reject(new Error('tesseract_load_failed'));
        document.head.appendChild(s);
      }).catch((err) => {
        tesseractPromise = null;
        throw err;
      });
    }
    return tesseractPromise;
  }

  function cleanHandwritingText(raw) {
    return String(raw || '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  function closeModal() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function insertIntoNote(text) {
    const cleaned = cleanHandwritingText(text);
    if (!cleaned) {
      toast(T('hw.empty'), 'warning');
      return false;
    }
    const editor = document.getElementById('noteEditor');
    if (!editor) {
      toast(T('hw.no_editor'), 'warning');
      return false;
    }
    const html = cleaned
      .split('\n')
      .map((line) => `<p>${esc(line)}</p>`)
      .join('');
    editor.innerHTML = (editor.innerHTML || '') + html;
    persistPrefs({ scans: getPrefs().scans + 1 });
    toast(T('hw.inserted'), 'success');
    return true;
  }

  function openEditModal(text, thumbUrl, progressEl) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'flux-hw-overlay';
    overlay.innerHTML = `<div class="flux-hw-panel" role="dialog">
  <div class="flux-hw-head">
    <div style="font-weight:800;font-size:.85rem">${esc(T('hw.title'))}</div>
    <button type="button" data-hw-close style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem">✕</button>
  </div>
  <div class="flux-hw-body">
    ${thumbUrl ? '<img class="flux-hw-thumb" alt="" />' : ''}
    <div class="flux-hw-label">${esc(T('hw.edit_label'))}</div>
    <textarea class="flux-hw-textarea" id="fluxHwTextInput"></textarea>
    <div style="font-size:.68rem;color:var(--muted)">${esc(T('hw.hint'))}</div>
  </div>
  <div class="flux-hw-foot">
    <button type="button" class="btn-sec" data-hw-close>${esc(T('hw.cancel'))}</button>
    <button type="button" class="flux-hw-insert-btn" data-hw-insert>${esc(T('hw.insert'))}</button>
  </div>
</div>`;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('#fluxHwTextInput');
    input.value = cleanHandwritingText(text);
    const thumb = overlay.querySelector('.flux-hw-thumb');
    if (thumb && thumbUrl) thumb.src = thumbUrl;

    overlay.querySelectorAll('[data-hw-close]').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('[data-hw-insert]')?.addEventListener('click', () => {
      if (insertIntoNote(input.value)) closeModal();
    });
    if (progressEl) progressEl.remove();
  }

  function openLoadingModal(thumbUrl) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'flux-hw-overlay';
    overlay.innerHTML = `<div class="flux-hw-panel" role="dialog">
  <div class="flux-hw-head"><div style="font-weight:800;font-size:.85rem">${esc(T('hw.title'))}</div></div>
  <div class="flux-hw-body">
    ${thumbUrl ? '<img class="flux-hw-thumb" alt="" />' : ''}
    <div class="flux-hw-progress" id="fluxHwProgress">${esc(T('hw.reading'))}</div>
  </div>
</div>`;
    document.body.appendChild(overlay);
    const thumb = overlay.querySelector('.flux-hw-thumb');
    if (thumb && thumbUrl) thumb.src = thumbUrl;
    return overlay.querySelector('#fluxHwProgress');
  }

  async function ocrFile(file) {
    const Tesseract = await loadTesseract();
    const url = URL.createObjectURL(file);
    try {
      const result = await Tesseract.recognize(url, 'eng', {
        logger(m) {
          if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
            const el = document.getElementById('fluxHwProgress');
            if (el) el.textContent = T('hw.progress', { pct: Math.round(m.progress * 100) });
          }
        },
      });
      return cleanHandwritingText(result?.data?.text || '');
    } finally {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    }
  }

  async function processFile(file) {
    if (!file || !enabled()) return;
    const editor = document.getElementById('noteEditor');
    if (!editor) {
      toast(T('hw.open_note'), 'warning');
      return;
    }

    const thumbUrl = URL.createObjectURL(file);
    const progressEl = openLoadingModal(thumbUrl);

    try {
      const text = await ocrFile(file);
      if (!text) throw new Error(T('hw.no_text'));
      openEditModal(text, thumbUrl, progressEl);
    } catch (err) {
      closeModal();
      const msg = String(err?.message || err || '');
      if (msg.includes('tesseract')) toast(T('hw.ocr_failed'), 'error');
      else toast(msg || T('hw.failed'), 'error');
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

  function pickHandwritingPhoto() {
    if (!enabled()) return;
    ensureFileInput().click();
  }

  function enhanceNotesToolbar() {
    const toolbar = document.querySelector('#notesEditorView [onclick*="saveNote"]')?.parentElement;
    if (!toolbar || document.getElementById('fluxHwScanBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fluxHwScanBtn';
    btn.className = 'flux-hw-scan-btn';
    btn.textContent = '✍ ' + T('hw.btn');
    btn.title = T('hw.btn_hint');
    btn.addEventListener('click', pickHandwritingPhoto);

    const photoLabel = toolbar.querySelector('label input[type="file"]')?.closest('label');
    if (photoLabel) photoLabel.insertAdjacentElement('afterend', btn);
    else toolbar.appendChild(btn);
  }

  function wrapOpenNote() {
    const orig = window.openNote;
    if (typeof orig !== 'function' || orig._fluxHwWrapped) return;
    window.openNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) enhanceNotesToolbar();
      } catch (_) {}
      return r;
    };
    window.openNote._fluxHwWrapped = true;
  }

  function wrapOpenNewNote() {
    const orig = window.openNewNote;
    if (typeof orig !== 'function' || orig._fluxHwWrapped) return;
    window.openNewNote = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) enhanceNotesToolbar();
      } catch (_) {}
      return r;
    };
    window.openNewNote._fluxHwWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('hw.palette');
    const keys = 'handwriting scan ocr stylus photo notes write';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '✍',
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
            pickHandwritingPhoto();
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

  window.FluxHandwritingToText = {
    FLAG,
    enabled,
    pickHandwritingPhoto,
    processFile,
    cleanHandwritingText,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
