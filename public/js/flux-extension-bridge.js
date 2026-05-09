/**
 * Chrome extension side panel ↔ embedded Flux (iframe) bridge.
 * Handles postMessage only from extension origins; runs AI via signed-in session in-frame.
 */
(function () {
  'use strict';

  function allowExtensionOrigin(origin) {
    return (
      typeof origin === 'string' &&
      (origin.startsWith('chrome-extension://') ||
        origin.startsWith('moz-extension://'))
    );
  }

  function buildDomSnapshot() {
    const maxLen = 16000;
    const root = document.getElementById('app') || document.body;
    if (!root) {
      return { text: '(no DOM root)', url: location.href, at: new Date().toISOString(), title: document.title || '' };
    }

    const lines = [];
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
    const all = root.querySelectorAll('h1,h2,h3,h4,h5,h6,button,a,[role="button"],[aria-label],[data-task-id],input,textarea,label,.nav-tab,[class*="task"]');
    all.forEach((el) => {
      if (skipTags.has(el.tagName)) return;
      try {
        const st = window.getComputedStyle(el);
        if (st && (st.visibility === 'hidden' || st.display === 'none')) return;
      } catch (_) {}
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role') || '';
      const lbl = el.getAttribute('aria-label') || '';
      let bit =
        lbl ||
        (tag === 'input' || tag === 'textarea'
          ? (el.placeholder || el.value || '').trim()
          : (el.innerText || '').replace(/\s+/g, ' ').trim());
      if (!bit) return;
      if (bit.length > 400) bit = bit.slice(0, 400) + '…';
      lines.push('- ' + tag + (role ? '[role=' + role + ']' : '') + ': ' + bit);
    });

    let text = lines.length ? lines.join('\n') : '';
    if (text.length < 200) {
      text = (root.innerText || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
    }
    if (text.length > maxLen) text = text.slice(0, maxLen) + '\n… (truncated)';

    return {
      text,
      url: location.href,
      at: new Date().toISOString(),
      title: document.title || '',
    };
  }

  async function visionAsk(question, imageBase64, mimeType) {
    const api = window.__FluxExtensionAPI;
    if (!api || !api.API || !api.fluxAuthHeaders) {
      throw new Error('Flux is still loading — try again in a moment.');
    }
    const cleanB64 = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
    const messages = [
      {
        role: 'system',
        content:
          'You are Flux, a student planner assistant. The user shared a screenshot. Describe what you see and answer their question. If text is unreadable, say so. Be concise and accurate.',
      },
      {
        role: 'user',
        content: String(question || 'Describe what you see and anything relevant for a student.'),
      },
    ];
    const res = await fetch(api.API.ai, {
      method: 'POST',
      headers: await api.fluxAuthHeaders(),
      body: JSON.stringify({
        messages,
        imageBase64: cleanB64,
        mimeType: mimeType || 'image/png',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'HTTP ' + res.status);
    }
    const data = await res.json();
    return data.content?.[0]?.text || data.text || '';
  }

  async function textAsk(question, snapshotText) {
    const api = window.__FluxExtensionAPI;
    if (!api || !api.fluxAiSimple) {
      throw new Error('Flux is still loading — try again in a moment.');
    }
    const ctx = snapshotText
      ? 'Below is a text snapshot of what the Flux UI is currently showing (partial).\n---\n' +
        snapshotText +
        '\n---\n\nUser question: ' +
        question
      : String(question);
    const system =
      'You are Flux AI inside the Flux student planner. Use the UI snapshot when it helps answer. If the snapshot lacks needed info, say what is missing.';
    return await api.fluxAiSimple(system, ctx);
  }

  window.addEventListener('message', async (ev) => {
    if (!allowExtensionOrigin(ev.origin)) return;
    const data = ev.data;

    function reply(payload) {
      try {
        ev.source.postMessage(Object.assign({ source: 'flux-app-bridge' }, payload), ev.origin);
      } catch (_) {}
    }

    if (!data || typeof data !== 'object' || data.source !== 'flux-chrome-ext') return;

    const id = data.id;

    try {
      if (data.type === 'PING') {
        reply({ id, ok: true, type: 'PONG' });
        return;
      }
      if (data.type === 'SNAPSHOT') {
        reply({ id, ok: true, type: 'SNAPSHOT', snapshot: buildDomSnapshot() });
        return;
      }
      if (data.type === 'AI_TEXT') {
        const text = await textAsk(data.question, data.snapshotText || '');
        reply({ id, ok: true, type: 'AI_TEXT', text });
        return;
      }
      if (data.type === 'AI_VISION') {
        const text = await visionAsk(data.question, data.imageBase64, data.mimeType);
        reply({ id, ok: true, type: 'AI_VISION', text });
        return;
      }
      reply({ id, ok: false, error: 'unknown_type' });
    } catch (e) {
      reply({ id, ok: false, error: String((e && e.message) || e) });
    }
  });
})();
