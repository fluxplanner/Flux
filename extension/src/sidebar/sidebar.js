/**
 * sidebar.js — side rail UI controller.
 *
 * Flux always sees the current tab:
 *   • Every send pulls a FRESH page snapshot via FLUX_GET_PAGE_SNAPSHOT
 *     (background falls back to scripting.executeScript, so it works even on
 *     tabs that were open before the extension installed).
 *   • With "Live" on (default), a screenshot of the tab is attached to every
 *     message → the vision model literally sees the screen, Gemini-style.
 *   • Tab switches / navigations update the context bar in real time.
 *
 * Replies stream token-by-token over a long-lived port to the background.
 */
import { ext, runtime } from '../lib/browser-shim.js';
import FluxTex from '../../../public/js/flux-tex.js';

const elChat = document.getElementById('chat');
const elHello = document.getElementById('hello');
const elComposer = document.getElementById('composer');
const elSend = document.getElementById('sendBtn');
const elCapture = document.getElementById('captureBtn');
const elSugg = document.getElementById('suggestions');
const elCtxBar = document.getElementById('contextBar');
const elCtxTitle = document.getElementById('ctxTitle');
const elCtxFavicon = document.getElementById('ctxFavicon');
const elLive = document.getElementById('liveToggle');
const elNewChat = document.getElementById('newChat');
const elOpenWeb = document.getElementById('openWeb');
const elAttachPreview = document.getElementById('attachPreview');
const elAttachImg = document.getElementById('attachImg');
const elAttachRemove = document.getElementById('attachRemove');

let liveView = true;            // attach a screenshot to every send
let pendingImage = null;        // manual 📷 capture waiting to be sent
let history = [];               // [{role, content}] — text only
let busy = false;

/* ───────── Tiny markdown renderer (escapes first — no raw HTML) ───────── */

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function md(raw) {
  // LaTeX math → placeholders now, rendered HTML at the end (flux-tex.js).
  let texSlots = null;
  try {
    const ex = FluxTex.extract(raw);
    raw = ex.text;
    texSlots = ex.slots;
  } catch (_) {}
  let s = escHtml(raw);
  // fenced code
  s = s.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${code.replace(/\n$/, '')}</code></pre>`);
  // inline code
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // headings
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>')
       .replace(/^## (.+)$/gm, '<h2>$1</h2>')
       .replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // bold / italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // links (escaped → match &lt; free URLs)
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // lists: group consecutive bullet/numbered lines
  s = s.replace(/(?:^|\n)((?:[-*] .+(?:\n|$))+)/g, (m, block) =>
    '\n<ul>' + block.trim().split('\n').map((l) => `<li>${l.replace(/^[-*] /, '')}</li>`).join('') + '</ul>');
  s = s.replace(/(?:^|\n)((?:\d+[.)] .+(?:\n|$))+)/g, (m, block) =>
    '\n<ol>' + block.trim().split('\n').map((l) => `<li>${l.replace(/^\d+[.)] /, '')}</li>`).join('') + '</ol>');
  // paragraphs
  s = s.split(/\n{2,}/).map((p) => {
    const t = p.trim();
    if (!t) return '';
    if (/^<(pre|ul|ol|h\d)/.test(t)) return t;
    return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
  }).join('');
  // re-insert rendered math
  try { if (texSlots) s = FluxTex.restore(s, texSlots); } catch (_) {}
  return s;
}

/* ───────── Chat rendering ───────── */

function hideHello() { if (elHello) elHello.style.display = 'none'; }

function appendUser(text) {
  hideHello();
  const div = document.createElement('div');
  div.className = 'msg user';
  div.textContent = text;
  elChat.appendChild(div);
  elChat.scrollTop = elChat.scrollHeight;
  return div;
}

function appendBot() {
  hideHello();
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';
  elChat.appendChild(div);
  elChat.scrollTop = elChat.scrollHeight;
  return div;
}

function setBot(div, text, { error = false, sawScreen = false } = {}) {
  div.classList.toggle('error', !!error);
  const EYE_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const note = sawScreen ? '<div class="vision-note">' + EYE_SVG + ' answered from a screenshot of your tab</div>' : '';
  div.innerHTML = note + (error ? escHtml(text) : md(text));
  elChat.scrollTop = elChat.scrollHeight;
}

/* ───────── Context bar ───────── */

let ctxRefreshTimer = null;

async function refreshContext() {
  try {
    const r = await runtime.sendMessage({ type: 'FLUX_GET_PAGE_SNAPSHOT' });
    const snap = r && r.ok ? r.snapshot : null;
    if (!snap) {
      elCtxTitle.textContent = 'No tab in view';
      elCtxFavicon.hidden = true;
      return;
    }
    elCtxBar.classList.toggle('restricted', !!snap.restricted);
    elCtxTitle.textContent = snap.restricted
      ? 'Browser page — Flux can’t read this one'
      : (snap.title || snap.url || 'this tab');
    if (snap.favIconUrl && /^https?:/.test(snap.favIconUrl)) {
      elCtxFavicon.src = snap.favIconUrl;
      elCtxFavicon.hidden = false;
    } else {
      elCtxFavicon.hidden = true;
    }
    renderSuggestions(snap);
  } catch (_) {
    elCtxTitle.textContent = 'this tab';
  }
}

function scheduleCtxRefresh() {
  if (ctxRefreshTimer) clearTimeout(ctxRefreshTimer);
  ctxRefreshTimer = setTimeout(refreshContext, 250);
}

try {
  ext.tabs.onActivated?.addListener(scheduleCtxRefresh);
  ext.tabs.onUpdated?.addListener((tabId, info) => {
    if (info && (info.status === 'complete' || info.title)) scheduleCtxRefresh();
  });
  if (ext.windows && ext.windows.onFocusChanged) {
    ext.windows.onFocusChanged.addListener(scheduleCtxRefresh);
  }
} catch (_) {}

/* ───────── Suggestions ───────── */

function suggestionsFor(snap) {
  const h = (() => { try { return new URL(snap.url || '').hostname; } catch (_) { return ''; } })();
  if (/instructure|canvaslms/.test(h)) return ['Summarize this assignment', 'What’s due and when?', 'Quiz me on this'];
  if (/youtube\./.test(h)) return ['Summarize this video', 'Key takeaways', 'Make flashcards'];
  if (/docs\.google/.test(h)) return ['Critique my writing', 'Continue this draft', 'Tighten this up'];
  if (/mail\.google/.test(h)) return ['Draft a reply', 'Summarize this thread'];
  if (/deltamath|khanacademy|ixl\.|mathway/.test(h)) return ['Walk me through this problem', 'Explain the concept', 'Check my answer'];
  if (/wikipedia/.test(h)) return ['Summarize this article', 'Explain like I’m 12', 'Make flashcards'];
  return ['Summarize this page', 'Explain what I’m looking at', 'Make flashcards from this'];
}

function renderSuggestions(snap) {
  const list = snap && !snap.restricted ? suggestionsFor(snap) : ['What can you do?'];
  elSugg.innerHTML = list
    .map((s) => `<button class="sugg" data-prompt="${escHtml(s)}">${escHtml(s)}</button>`)
    .join('');
}

elSugg.addEventListener('click', (e) => {
  const b = e.target.closest('[data-prompt]');
  if (!b) return;
  elComposer.value = b.getAttribute('data-prompt');
  handleSend();
});

/* ───────── Live view toggle + manual capture ───────── */

elLive.addEventListener('click', async () => {
  liveView = !liveView;
  elLive.classList.toggle('on', liveView);
  try { await ext.storage.local.set({ flux_live_view: liveView }); } catch (_) {}
});

elCapture.addEventListener('click', async () => {
  try {
    const r = await runtime.sendMessage({ type: 'FLUX_CAPTURE_TAB' });
    if (!r || !r.ok || !r.dataUrl) throw new Error(r?.error || 'capture failed');
    pendingImage = r.dataUrl;
    elAttachImg.src = r.dataUrl;
    elAttachPreview.hidden = false;
    elComposer.focus();
  } catch (e) {
    const div = appendBot();
    setBot(div, 'Couldn’t capture the tab: ' + e.message, { error: true });
  }
});

elAttachRemove.addEventListener('click', () => {
  pendingImage = null;
  elAttachPreview.hidden = true;
});

/* ───────── Send ───────── */

elComposer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});
elComposer.addEventListener('input', () => {
  elComposer.style.height = 'auto';
  elComposer.style.height = Math.min(elComposer.scrollHeight, 120) + 'px';
});
elSend.addEventListener('click', handleSend);

const SYSTEM = [
  'You are Flux — a sharp, friendly AI living in the user’s browser side rail (part of Flux Planner).',
  'You can SEE the user’s current tab: a text snapshot of the page is included below, and often a screenshot too. Treat them as what the user is looking at right now.',
  'When the user says "this page", "this question", "this problem" — they mean the page context. Never claim you can’t see the page when context is present.',
  'For homework problems: give the answer AND a tight explanation of how to get it.',
  'Be direct and concise. Use markdown. Short paragraphs, bullets where they help.',
  'Voice: talk like a good tutor, not a textbook. NEVER write "Step 1:", "Step 2:" walkthrough headers, never say "The final answer is:", and never use \\boxed{}. Explain the key move in a sentence or two, show the work naturally, then end with the answer in **bold**.',
  'Math: write expressions (fractions, exponents, equations) in LaTeX between $...$ (inline) or $$...$$ (display) — it renders beautifully. Plain quantities stay plain text: write "35 N" or "68 kg", never "$35\\;N$" and never \\; spacing macros. Keep equations short; break long derivations across lines.',
].join('\n');

function contextString(snap) {
  if (!snap || snap.restricted) return '';
  const parts = [
    `URL: ${snap.url || ''}`,
    `Title: ${snap.title || ''}`,
  ];
  if (snap.selection) parts.push(`User's selected text:\n${snap.selection}`);
  if (snap.text) parts.push(`Page text:\n${snap.text}`);
  return parts.join('\n');
}

async function handleSend() {
  const text = (elComposer.value || '').trim();
  if (!text || busy) return;
  busy = true;
  elSend.disabled = true;
  elComposer.value = '';
  elComposer.style.height = 'auto';

  appendUser(text);
  const botDiv = appendBot();

  try {
    // 1. Fresh snapshot of whatever tab the user is on right now.
    let snap = null;
    try {
      const r = await runtime.sendMessage({ type: 'FLUX_GET_PAGE_SNAPSHOT' });
      snap = r && r.ok ? r.snapshot : null;
    } catch (_) {}

    // 2. Screenshot: manual attach wins; otherwise Live view, or auto-fallback
    //    when the page has no extractable text (canvas-rendered apps).
    let imageDataUrl = pendingImage;
    const textLen = (snap && snap.text ? snap.text.length : 0);
    if (!imageDataUrl && !snap?.restricted && (liveView || textLen < 400)) {
      try {
        const cap = await runtime.sendMessage({ type: 'FLUX_CAPTURE_TAB' });
        if (cap && cap.ok && cap.dataUrl) imageDataUrl = cap.dataUrl;
      } catch (_) {}
    }
    pendingImage = null;
    elAttachPreview.hidden = true;

    history.push({ role: 'user', content: text });
    if (history.length > 16) history = history.slice(-16);

    const payload = {
      system: SYSTEM,
      messages: history.slice(),
      context: contextString(snap),
    };

    let sawScreen = false;
    if (imageDataUrl) {
      const m = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        payload.imageBase64 = m[2];
        payload.mimeType = m[1];
        sawScreen = true;
      }
    }

    const full = await streamAI(payload, (partial) => {
      setBot(botDiv, partial, { sawScreen });
    });

    const reply = full || 'I didn’t get a response — try again.';
    setBot(botDiv, reply, { sawScreen });
    history.push({ role: 'assistant', content: reply });
  } catch (e) {
    const msg = String(e && e.message || '');
    const friendly = /429|rate.?limit|over capacity/i.test(msg)
      ? 'Flux is handling a lot of traffic right now — give it a few seconds and ask again.'
      : 'Error: ' + (msg || 'something went wrong') +
        '\nIf this keeps happening, reload the extension or check the Planner host in the popup.';
    setBot(botDiv, friendly, { error: true });
    history.pop(); // drop the failed user turn so retries are clean
  }

  busy = false;
  elSend.disabled = false;
  elComposer.focus();
}

/** Stream via the background port; falls back to one-shot FLUX_CALL_AI. */
function streamAI(payload, onPartial) {
  return new Promise((resolve, reject) => {
    let port = null;
    try {
      port = ext.runtime.connect({ name: 'flux-ai-stream' });
    } catch (_) {
      port = null;
    }
    if (!port) {
      runtime.sendMessage({ type: 'FLUX_CALL_AI', payload })
        .then((r) => (r && r.ok ? resolve(r.text || '') : reject(new Error(r?.error || 'AI error'))))
        .catch(reject);
      return;
    }
    let full = '';
    let settled = false;
    let paintTimer = null;
    const paint = () => {
      paintTimer = null;
      if (full) onPartial(full);
    };
    port.onMessage.addListener((m) => {
      if (!m || settled) return;
      if (m.type === 'delta') {
        full += m.delta || '';
        if (!paintTimer) paintTimer = setTimeout(paint, 80);
      } else if (m.type === 'done') {
        settled = true;
        try { port.disconnect(); } catch (_) {}
        resolve(m.text || full);
      } else if (m.type === 'error') {
        settled = true;
        try { port.disconnect(); } catch (_) {}
        reject(new Error(m.error || 'AI error'));
      }
    });
    port.onDisconnect.addListener(() => {
      if (!settled) {
        settled = true;
        if (full) resolve(full);
        else reject(new Error('Connection to Flux dropped — try again.'));
      }
    });
    try {
      port.postMessage({ type: 'FLUX_STREAM_AI', payload });
    } catch (e) {
      settled = true;
      reject(e);
    }
  });
}

/* ───────── New chat / open planner ───────── */

elNewChat.addEventListener('click', () => {
  history = [];
  elChat.querySelectorAll('.msg').forEach((n) => n.remove());
  if (elHello) elHello.style.display = '';
  elComposer.focus();
});

elOpenWeb.addEventListener('click', async () => {
  const r = await runtime.sendMessage({ type: 'FLUX_GET_CONFIG' });
  const url = (r && r.ok && r.config && r.config.app_url) || 'https://fluxplanner.github.io/Flux/';
  ext.tabs.create({ url });
});

/* ───────── Context-menu / omnibox intents ───────── */

async function bootIntent() {
  let r = null;
  try { r = await runtime.sendMessage({ type: 'FLUX_GET_INTENT' }); } catch (_) {}
  if (!r || !r.ok || !r.intent) return;
  const intent = r.intent;
  const sel = intent.text ? `\n\nSelected text:\n${intent.text}` : '';
  switch (intent.action) {
    case 'summarize':
      elComposer.value = 'Summarize this' + (intent.text ? ' selection' : ' page') + '.' + sel;
      return handleSend();
    case 'flashcards':
      elComposer.value = 'Make flashcards from this.' + sel;
      return handleSend();
    case 'cite':
      elComposer.value = 'Give me an APA citation for this page.' + sel;
      return handleSend();
    case 'addTask':
    case 'omniboxQuickAdd':
      elComposer.value = 'Add to my planner: ' + (intent.text || intent.url || '');
      elComposer.focus();
      return;
  }
}

/* ───────── Boot ───────── */

(async function boot() {
  try {
    const r = await ext.storage.local.get('flux_live_view');
    if (r && typeof r.flux_live_view === 'boolean') liveView = r.flux_live_view;
  } catch (_) {}
  elLive.classList.toggle('on', liveView);
  await refreshContext();
  await bootIntent();
  elComposer.focus();
})();
