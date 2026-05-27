/**
 * sidebar.js — side rail UI controller.
 *
 * Flow:
 *   • Fetches the current tab's page context from the background SW.
 *   • Renders suggestions based on detected page type.
 *   • Routes user input: `/<slash>` → run skill, plain text → call AI proxy.
 *   • Parses ```skill``` blocks from AI replies and forwards them to the content script.
 *
 * Skills are kept aligned with the web app's flux-skills.js by intent
 * (same slash names + behaviours). The runners that need DOM (in-page actions)
 * delegate to content.js via runtime messaging.
 */
import { ext, runtime, tabs } from '../lib/browser-shim.js';

const elChat = document.getElementById('chat');
const elComposer = document.getElementById('composer');
const elSend = document.getElementById('sendBtn');
const elCapture = document.getElementById('captureBtn');
const elSugg = document.getElementById('suggestions');
const elPage = document.getElementById('pageType');
const elOpenWeb = document.getElementById('openWeb');

let lastTabId = null;
let lastContext = null;

/* ───────── Suggestions by page type ───────── */

const SUGGESTIONS = {
  canvas: ['/summarize this assignment', '/quiz-me on this page', 'Add this to Flux'],
  gmail: ['Draft a reply', 'Add this to Flux', '/summarize this thread'],
  gdocs: ['/critique', '/expand the outline', '/summarize'],
  youtube: ['/summarize this video', '/flashcards from this'],
  gclassroom: ['Sync to Flux', '/plan around these deadlines'],
  generic: ['/summarize this page', '/flashcards from selection', 'Add this to Flux'],
};

function renderSuggestions(type) {
  elPage.textContent = type;
  const list = SUGGESTIONS[type] || SUGGESTIONS.generic;
  elSugg.innerHTML = list.map((s) => `<button class="sugg" data-prompt="${escAttr(s)}">${escHtml(s)}</button>`).join('');
}

function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

elSugg.addEventListener('click', (e) => {
  const b = e.target.closest('[data-prompt]');
  if (!b) return;
  elComposer.value = b.getAttribute('data-prompt');
  elComposer.focus();
});

/* ───────── Chat rendering ───────── */

function append(role, text, opts) {
  const div = document.createElement('div');
  div.className = 'msg ' + role + (opts && opts.skill ? ' skill' : '');
  div.textContent = text;
  elChat.appendChild(div);
  elChat.scrollTop = elChat.scrollHeight;
  return div;
}

/* ───────── Boot — fetch intent + context ───────── */

async function bootIntent() {
  const r = await runtime.sendMessage({ type: 'FLUX_GET_INTENT' });
  if (!r || !r.ok || !r.intent) return;
  const intent = r.intent;
  switch (intent.action) {
    case 'addTask':
      elComposer.value = 'Add task: ' + (intent.text || intent.url || '');
      break;
    case 'summarize':
      elComposer.value = '/summarize ' + (intent.text || 'this page');
      handleSend();
      break;
    case 'flashcards':
      elComposer.value = '/flashcards ' + (intent.text || '');
      handleSend();
      break;
    case 'cite':
      elComposer.value = '/cite ' + (intent.text || intent.url || '');
      handleSend();
      break;
    case 'omniboxQuickAdd':
      elComposer.value = 'Add task: ' + intent.text;
      handleSend();
      break;
  }
}

async function bootContext() {
  const tab = await tabs.active();
  if (!tab) return;
  lastTabId = tab.id;
  // Wait briefly for content.js to broadcast
  await new Promise((r) => setTimeout(r, 400));
  // Fall back: ask via direct message if cache miss
  try {
    const r = await runtime.sendMessage({ type: 'FLUX_GET_CONFIG' });
    if (r && !r.ok) console.warn('[Flux sidebar] config fetch failed', r.error);
  } catch (_) {}
  try {
    const ctx = await fetchTabContext(tab.id);
    if (ctx) {
      lastContext = ctx;
      renderSuggestions(ctx.type || 'generic');
    } else {
      renderSuggestions('generic');
    }
  } catch (e) {
    console.warn('[Flux sidebar] context fetch failed', e);
    renderSuggestions('generic');
  }
}

async function fetchTabContext(tabId) {
  return new Promise((resolve) => {
    ext.runtime.sendMessage({ type: 'FLUX_GET_TAB_CONTEXT', tabId }, (r) => {
      if (r && r.ok) return resolve(r.context);
      resolve(null);
    });
  });
}

/* ───────── Send handler ───────── */

elComposer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});
elSend.addEventListener('click', handleSend);

async function handleSend() {
  const text = (elComposer.value || '').trim();
  if (!text) return;
  elComposer.value = '';
  append('user', text);

  // Slash command?
  if (text.startsWith('/')) {
    const thinking = append('bot', 'Running…', { skill: true });
    try {
      const r = await runSkill(text);
      thinking.textContent = r.render || r.message || 'Done.';
    } catch (e) {
      thinking.textContent = 'Skill failed: ' + (e.message || 'unknown');
    }
    return;
  }

  // Plain AI message — include lastContext as a hint.
  const thinking = append('bot', 'Thinking…');
  try {
    const r = await runtime.sendMessage({
      type: 'FLUX_CALL_AI',
      payload: {
        system: 'You are Flux AI inside a browser side rail. The user is on a page; consider its context. Be concise.',
        messages: [{ role: 'user', content: text }],
        context: lastContext ? `Page type: ${lastContext.type}. URL: ${lastContext.url || ''}.\n` + (lastContext.text || '').slice(0, 4000) : '',
      },
    });
    if (!r || !r.ok) {
      thinking.textContent = 'AI error: ' + (r?.error || 'unknown');
      return;
    }
    thinking.textContent = r.text || '(no reply)';
    parseSkillBlock(r.text);
  } catch (e) {
    thinking.textContent = 'Error: ' + e.message;
  }
}

function parseSkillBlock(text) {
  const m = text && text.match(/```skill\s*(\{[\s\S]*?\})\s*```/);
  if (!m) return;
  let payload;
  try { payload = JSON.parse(m[1]); } catch (_) { return; }
  if (payload && payload.id) {
    runSkill('/' + payload.id + ' ' + (payload.args || '')).catch(() => {});
  }
}

/* ───────── Capture button (screenshot current tab) ───────── */

elCapture.addEventListener('click', async () => {
  try {
    const r = await runtime.sendMessage({ type: 'FLUX_CAPTURE_TAB' });
    if (!r || !r.ok) {
      append('bot', 'Capture failed: ' + (r?.error || 'unknown'));
      return;
    }
    const img = document.createElement('img');
    img.src = r.dataUrl;
    img.style.cssText = 'max-width:100%;border-radius:10px;border:1px solid var(--border);margin-top:6px';
    const wrap = append('bot', 'Captured tab:');
    wrap.appendChild(img);
  } catch (e) {
    append('bot', 'Capture error: ' + e.message);
  }
});

/* ───────── Open Flux web app ───────── */

elOpenWeb.addEventListener('click', async () => {
  const r = await runtime.sendMessage({ type: 'FLUX_GET_CONFIG' });
  const url = (r && r.ok && r.config && r.config.app_url) || 'https://azfermohammed.github.io/Fluxplanner/';
  ext.tabs.create({ url });
});

/* ───────── Skill runners (subset wired locally; AI-backed ones go through proxy) ───────── */

async function runSkill(text) {
  const m = text.match(/^\/([a-z][a-z0-9_-]*)(?:\s+([\s\S]*))?$/i);
  if (!m) return { render: 'Not a skill command.' };
  const id = m[1].toLowerCase();
  const args = (m[2] || '').trim();

  // In-page skills (run on the active tab)
  if (id === 'summarize' || id === 'summarize-page') {
    const tab = await tabs.active();
    const txt = await getActiveTabText(tab.id);
    if (!txt) return { render: 'Nothing to summarize.' };
    const r = await runtime.sendMessage({
      type: 'FLUX_CALL_AI',
      payload: {
        system: 'Summarize the page text in 5 tight bullets. No filler.',
        messages: [{ role: 'user', content: 'Summarize.' }],
        context: txt,
      },
    });
    return { render: r?.text || 'No reply' };
  }

  if (id === 'flashcards') {
    const sel = await getActiveTabSelection();
    const src = args || sel || (lastContext && lastContext.text) || '';
    if (!src) return { render: 'Select text first, or pass content after /flashcards.' };
    const r = await runtime.sendMessage({
      type: 'FLUX_CALL_AI',
      payload: {
        system: 'Generate 8-12 flashcards as a JSON array of {"q":"...","a":"..."}. Respond ONLY with the JSON array.',
        messages: [{ role: 'user', content: src.slice(0, 6000) }],
      },
    });
    return { render: r?.text || 'No flashcards generated.' };
  }

  if (id === 'cite') {
    const ref = args || (lastContext && (lastContext.url || lastContext.title)) || '';
    const r = await runtime.sendMessage({
      type: 'FLUX_CALL_AI',
      payload: {
        system: 'Generate an APA citation for the reference. Output only the citation.',
        messages: [{ role: 'user', content: ref }],
      },
    });
    return { render: r?.text || 'No citation.' };
  }

  // Default — pass to AI as a freeform skill
  const r = await runtime.sendMessage({
    type: 'FLUX_CALL_AI',
    payload: {
      system: `The user invoked skill /${id}. Respond appropriately. Args: ${args || '(none)'}`,
      messages: [{ role: 'user', content: args || id }],
    },
  });
  return { render: r?.text || 'No reply.' };
}

async function getActiveTabText(tabId) {
  return new Promise((resolve) => {
    ext.tabs.sendMessage(tabId, { type: 'FLUX_GET_PAGE_TEXT' }, (r) => resolve(r && r.text));
  });
}
async function getActiveTabSelection() {
  const tab = await tabs.active();
  if (!tab) return '';
  return new Promise((resolve) => {
    ext.tabs.sendMessage(tab.id, { type: 'FLUX_GET_SELECTION' }, (r) => resolve(r && r.text));
  });
}

/* ───────── Boot ───────── */

bootContext().then(bootIntent);
