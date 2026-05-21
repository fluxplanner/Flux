/**
 * P14.2 — Screenshot snip → task: paste image in quick-add, OCR text locally.
 * Flag: enable_screenshot_snip (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_screenshot_snip';
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let _processing = false;
  let _tesseractPromise = null;
  let _previewUrl = null;
  let _pasteBound = false;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  function snipBtn() {
    return document.getElementById('fluxSnipBtn');
  }

  function statusEl() {
    return document.getElementById('fluxSnipStatus');
  }

  function setStatus(text) {
    const el = statusEl();
    if (el) el.textContent = text || '';
  }

  function setBusy(busy) {
    _processing = busy;
    const btn = snipBtn();
    if (btn) {
      btn.disabled = busy;
      btn.classList.toggle('flux-snip-btn--busy', busy);
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
  }

  function clipboardReadSupported() {
    return !!(navigator.clipboard && typeof navigator.clipboard.read === 'function');
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!_tesseractPromise) {
      _tesseractPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-flux-tesseract]');
        if (existing) {
          existing.addEventListener('load', () => resolve(window.Tesseract));
          existing.addEventListener('error', reject);
          return;
        }
        const s = document.createElement('script');
        s.src = TESSERACT_URL;
        s.async = true;
        s.dataset.fluxTesseract = '1';
        s.onload = () => resolve(window.Tesseract);
        s.onerror = () => reject(new Error('tesseract_load_failed'));
        document.head.appendChild(s);
      });
    }
    return _tesseractPromise;
  }

  function cleanOcrText(raw) {
    return String(raw || '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  function revokePreview() {
    if (_previewUrl) {
      try {
        URL.revokeObjectURL(_previewUrl);
      } catch (_) {}
      _previewUrl = null;
    }
  }

  function showPreview(blob, lineCount) {
    const wrap = document.getElementById('fluxSnipPreview');
    const img = document.getElementById('fluxSnipPreviewImg');
    const meta = document.getElementById('fluxSnipPreviewMeta');
    if (!wrap || !img) return;
    revokePreview();
    _previewUrl = URL.createObjectURL(blob);
    img.src = _previewUrl;
    if (meta) {
      meta.textContent =
        lineCount > 0
          ? T('snip.preview_ok', { n: lineCount })
          : T('snip.preview_empty');
    }
    wrap.classList.add('is-visible');
  }

  function hidePreview() {
    const wrap = document.getElementById('fluxSnipPreview');
    if (wrap) wrap.classList.remove('is-visible');
    const img = document.getElementById('fluxSnipPreviewImg');
    if (img) img.removeAttribute('src');
    revokePreview();
  }

  function applyExtractedText(text) {
    const input = document.getElementById('quickAddInput');
    if (!input) return;
    const trimmed = cleanOcrText(text);
    input.value = trimmed;
    if (typeof window.updateQuickAddPreview === 'function') window.updateQuickAddPreview(trimmed);
    input.focus();
    if (trimmed) toast(T('snip.ready'), 'success');
    else toast(T('snip.no_text'), 'warning');
  }

  async function ocrBlob(blob) {
    const Tesseract = await loadTesseract();
    const url = URL.createObjectURL(blob);
    try {
      const result = await Tesseract.recognize(url, 'eng', {
        logger(m) {
          if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
            setStatus(T('snip.progress', { pct: Math.round(m.progress * 100) }));
          }
        },
      });
      return cleanOcrText(result?.data?.text || '');
    } finally {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    }
  }

  function imageFromPasteEvent(e) {
    const items = e.clipboardData?.items;
    if (!items) return null;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
        return item.getAsFile();
      }
    }
    return null;
  }

  async function imageFromClipboardApi() {
    if (!clipboardReadSupported()) return null;
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) return item.getType(type);
      if (item.types.includes('text/plain')) {
        const textBlob = await item.getType('text/plain');
        const text = cleanOcrText(await textBlob.text());
        if (text) {
          return { textOnly: text };
        }
      }
    }
    return null;
  }

  async function processImageBlob(blob) {
    if (!blob || _processing) return;
    setBusy(true);
    setStatus(T('snip.reading'));
    try {
      showPreview(blob, 0);
      const text = await ocrBlob(blob);
      const lines = text ? text.split(/\s+/).filter(Boolean).length : 0;
      showPreview(blob, lines);
      applyExtractedText(text);
      setStatus(text ? T('snip.done') : T('snip.no_text'));
    } catch (err) {
      hidePreview();
      const code = String(err?.message || err || '');
      if (code.includes('tesseract')) toast(T('snip.ocr_failed'), 'error');
      else toast(T('snip.failed'), 'error');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  async function handlePaste(e) {
    if (!enabled()) return;
    const panel = document.getElementById('quickAddPanel');
    if (!panel?.classList.contains('open')) return;
    const file = imageFromPasteEvent(e);
    if (!file) return;
    e.preventDefault();
    await processImageBlob(file);
  }

  async function readFromClipboard() {
    if (!enabled()) return;
    const panel = document.getElementById('quickAddPanel');
    if (!panel?.classList.contains('open') && typeof window.openQuickAdd === 'function') {
      window.openQuickAdd();
    }
    if (_processing) return;
    setStatus(T('snip.reading_clipboard'));
    try {
      const result = await imageFromClipboardApi();
      if (!result) {
        toast(T('snip.no_image'), 'warning');
        setStatus(T('snip.paste_hint'));
        return;
      }
      if (result.textOnly) {
        applyExtractedText(result.textOnly);
        setStatus(T('snip.text_from_clipboard'));
        return;
      }
      await processImageBlob(result);
    } catch (err) {
      const denied = err?.name === 'NotAllowedError';
      toast(denied ? T('snip.permission') : T('snip.failed'), 'error');
      setStatus(denied ? T('snip.paste_hint') : '');
    }
  }

  function pickImageFile() {
    const input = document.getElementById('fluxSnipFileInput');
    if (input) input.click();
  }

  function onFileChosen(e) {
    const file = e.target?.files?.[0];
    e.target.value = '';
    if (file && file.type.startsWith('image/')) void processImageBlob(file);
  }

  function ensureUi() {
    const inner = document.querySelector('#quickAddPanel .quick-add-panel-inner');
    if (!inner || snipBtn()) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fluxSnipBtn';
    btn.className = 'flux-snip-btn';
    btn.textContent = '✂️';
    btn.title = T('snip.btn_title');
    btn.setAttribute('aria-label', T('snip.btn_title'));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (clipboardReadSupported()) readFromClipboard();
      else pickImageFile();
    });

    const submit = document.getElementById('quickAddSubmit');
    const mic = document.getElementById('fluxVoiceMicBtn');
    if (mic && mic.nextSibling) inner.insertBefore(btn, mic.nextSibling);
    else if (mic) inner.insertBefore(btn, submit || null);
    else if (submit) inner.insertBefore(btn, submit);
    else inner.appendChild(btn);

    if (!document.getElementById('fluxSnipStatus')) {
      const status = document.createElement('div');
      status.id = 'fluxSnipStatus';
      status.className = 'flux-snip-status';
      status.setAttribute('aria-live', 'polite');
      const panel = document.getElementById('quickAddPanel');
      const voiceStatus = document.getElementById('fluxVoiceStatus');
      if (voiceStatus) panel.insertBefore(status, voiceStatus.nextSibling);
      else {
        const hint = panel?.querySelector('.quick-add-hint');
        if (hint) panel.insertBefore(status, hint);
        else panel?.appendChild(status);
      }
    }

    if (!document.getElementById('fluxSnipPreview')) {
      const panel = document.getElementById('quickAddPanel');
      const preview = document.createElement('div');
      preview.id = 'fluxSnipPreview';
      preview.className = 'flux-snip-preview';
      preview.innerHTML =
        '<img id="fluxSnipPreviewImg" alt="" /><div class="flux-snip-preview-meta" id="fluxSnipPreviewMeta"></div>';
      const parsed = document.getElementById('quickAddParsed');
      if (parsed) panel.insertBefore(preview, parsed);
      else panel?.appendChild(preview);
    }

    if (!document.getElementById('fluxSnipFileInput')) {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'fluxSnipFileInput';
      input.accept = 'image/*';
      input.hidden = true;
      input.addEventListener('change', onFileChosen);
      document.body.appendChild(input);
    }
  }

  function bindPaste() {
    if (_pasteBound) return;
    const panel = document.getElementById('quickAddPanel');
    if (!panel) return;
    panel.addEventListener('paste', handlePaste);
    _pasteBound = true;
  }

  function wrapQuickAdd() {
    const open = window.openQuickAdd;
    if (typeof open === 'function' && !open._fluxSnipWrapped) {
      window.openQuickAdd = function () {
        open.apply(this, arguments);
        if (enabled()) {
          ensureUi();
          bindPaste();
        }
      };
      window.openQuickAdd._fluxSnipWrapped = true;
    }
    const close = window.closeQuickAdd;
    if (typeof close === 'function' && !close._fluxSnipWrapped) {
      window.closeQuickAdd = function () {
        hidePreview();
        setStatus('');
        close.apply(this, arguments);
      };
      window.closeQuickAdd._fluxSnipWrapped = true;
    }
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('snip.cmd');
    const keys = 'screenshot snip paste image ocr clip';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '✂️',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.openQuickAdd === 'function') window.openQuickAdd();
          setTimeout(() => {
            if (clipboardReadSupported()) readFromClipboard();
            else {
              toast(T('snip.paste_hint'), 'info');
              pickImageFile();
            }
          }, 120);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapQuickAdd();
    ensureUi();
    bindPaste();
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    try {
      if (window.FluxFeatureFlags?.load) {
        window.FluxFeatureFlags.load().then(install).catch(install);
      } else install();
    } catch (_) {
      install();
    }
  });

  window.FluxScreenshotSnip = {
    FLAG,
    enabled,
    install,
    readFromClipboard,
    getPaletteCommands,
  };
})();
