/**
 * P12.3 — Voice NL task capture for quick-add (Web Speech API).
 * Flag: enable_voice_task_capture (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_voice_task_capture';
  let recognition = null;
  let listening = false;

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

  function speechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function SpeechRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition;
  }

  function micBtn() {
    return document.getElementById('fluxVoiceMicBtn');
  }

  function statusEl() {
    return document.getElementById('fluxVoiceStatus');
  }

  function setStatus(text) {
    const el = statusEl();
    if (el) el.textContent = text || '';
  }

  function updateMicUi() {
    const btn = micBtn();
    if (!btn) return;
    btn.classList.toggle('flux-voice-mic-btn--listening', listening);
    btn.setAttribute('aria-pressed', listening ? 'true' : 'false');
    btn.setAttribute('aria-label', listening ? T('voice.stop') : T('voice.start'));
    btn.textContent = listening ? '⏹' : '🎤';
  }

  function applyTranscript(text, finalPass) {
    const input = document.getElementById('quickAddInput');
    if (!input) return;
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    input.value = trimmed;
    if (typeof window.updateQuickAddPreview === 'function') window.updateQuickAddPreview(trimmed);
    if (finalPass) {
      setStatus(T('voice.heard', { text: trimmed.slice(0, 48) + (trimmed.length > 48 ? '…' : '') }));
      if (typeof window.showToast === 'function') window.showToast(T('voice.ready'), 'info');
    }
  }

  function stopListening() {
    listening = false;
    try {
      recognition?.stop();
    } catch (_) {}
    recognition = null;
    updateMicUi();
    if (!statusEl()?.textContent) setStatus('');
  }

  function startListening() {
    if (!enabled() || !speechSupported()) {
      if (typeof window.showToast === 'function') window.showToast(T('voice.unsupported'), 'error');
      return;
    }
    if (listening) {
      stopListening();
      return;
    }

    const panel = document.getElementById('quickAddPanel');
    if (!panel?.classList.contains('open') && typeof window.openQuickAdd === 'function') {
      window.openQuickAdd();
    }

    const SR = SpeechRecognitionCtor();
    recognition = new SR();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true;
      updateMicUi();
      setStatus(T('voice.listening'));
    };

    recognition.onresult = (e) => {
      let interim = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0]?.transcript || '';
        if (e.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      applyTranscript(finalText || interim, !!finalText);
    };

    recognition.onerror = (ev) => {
      const code = ev?.error || 'unknown';
      if (code === 'aborted' || code === 'no-speech') {
        setStatus(code === 'no-speech' ? T('voice.no_speech') : '');
        return;
      }
      if (typeof window.showToast === 'function') window.showToast(T('voice.error'), 'error');
      setStatus('');
    };

    recognition.onend = () => {
      listening = false;
      recognition = null;
      updateMicUi();
    };

    try {
      recognition.start();
    } catch (_) {
      listening = false;
      recognition = null;
      updateMicUi();
      if (typeof window.showToast === 'function') window.showToast(T('voice.error'), 'error');
    }
  }

  function ensureUi() {
    const inner = document.querySelector('#quickAddPanel .quick-add-panel-inner');
    if (!inner || micBtn()) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fluxVoiceMicBtn';
    btn.className = 'flux-voice-mic-btn';
    btn.textContent = '🎤';
    btn.setAttribute('aria-label', T('voice.start'));
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startListening();
    });

    const submit = document.getElementById('quickAddSubmit');
    if (submit) inner.insertBefore(btn, submit);
    else inner.appendChild(btn);

    if (!document.getElementById('fluxVoiceStatus')) {
      const status = document.createElement('div');
      status.id = 'fluxVoiceStatus';
      status.className = 'flux-voice-status';
      status.setAttribute('aria-live', 'polite');
      const panel = document.getElementById('quickAddPanel');
      const hint = panel?.querySelector('.quick-add-hint');
      if (hint) panel.insertBefore(status, hint);
      else panel?.appendChild(status);
    }

    if (!speechSupported()) {
      btn.disabled = true;
      btn.title = T('voice.unsupported');
    }
  }

  function getPaletteCommands(q) {
    if (!enabled() || !speechSupported()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('voice.cmd');
    if (needle && !label.toLowerCase().includes(needle) && !needle.includes('voice') && !needle.includes('mic'))
      return [];
    return [
      {
        icon: '🎤',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          startListening();
        },
      },
    ];
  }

  function wrapQuickAdd() {
    const open = window.openQuickAdd;
    if (typeof open === 'function' && !open._fluxVoiceWrapped) {
      window.openQuickAdd = function () {
        open.apply(this, arguments);
        if (enabled()) ensureUi();
      };
      window.openQuickAdd._fluxVoiceWrapped = true;
    }
    const close = window.closeQuickAdd;
    if (typeof close === 'function' && !close._fluxVoiceWrapped) {
      window.closeQuickAdd = function () {
        stopListening();
        close.apply(this, arguments);
      };
      window.closeQuickAdd._fluxVoiceWrapped = true;
    }
  }

  function install() {
    if (!enabled()) return false;
    wrapQuickAdd();
    ensureUi();
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

  window.FluxVoiceCapture = {
    FLAG,
    enabled,
    speechSupported,
    startListening,
    stopListening,
    ensureUi,
    getPaletteCommands,
    install,
  };
})();
