/* global chrome */

let currentPageContext = null;
let selectedText = null;
const chatHistory = [];

/** { base64, mimeType, sourceLabel } set by Scan tab / Share screen; sent with the next AI call until cleared. */
let pendingVision = null;

let backgroundPort = null;
let isTyping = false;

const VISION_MAX_DIM = 1280;
const VISION_JPEG_QUALITY = 0.82;

function connectToBackground() {
  try {
    backgroundPort = chrome.runtime.connect({ name: 'flux-sidebar' });
  } catch (_) {
    setTimeout(connectToBackground, 500);
    return;
  }

  backgroundPort.onMessage.addListener((msg) => {
    if (msg.type === 'PAGE_CONTEXT_UPDATE') handleContextUpdate(msg.context);
    if (msg.type === 'SELECTED_TEXT') handleSelectedText(msg.text);
    if (msg.type === 'CONTEXT_MENU_ACTION') handleContextMenuAction(msg);
  });

  backgroundPort.onDisconnect.addListener(() => {
    backgroundPort = null;
    setTimeout(connectToBackground, 450);
  });
}

async function loadCachedContext() {
  try {
    const { lastPageContext } = await chrome.storage.session.get('lastPageContext');
    if (lastPageContext) handleContextUpdate(lastPageContext, { hydrate: true });
  } catch (_) {}
}

/** Side-panel fetch to Supabase is blocked by browser CORS; background worker relays with host permission. */
function callAiProxyViaBackground(systemPrompt, msgs, token, vision) {
  return new Promise((resolve) => {
    const payload = {
      system: systemPrompt,
      messages: msgs,
      token: token || '',
    };
    if (vision?.base64) {
      payload.imageBase64 = vision.base64;
      payload.mimeType = vision.mimeType || 'image/jpeg';
    }
    try {
      chrome.runtime.sendMessage(
        {
          type: 'AI_PROXY_CALL',
          payload,
        },
        (relay) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              status: 0,
              body: chrome.runtime.lastError.message,
            });
            return;
          }
          resolve(
            relay || {
              ok: false,
              status: 0,
              body: 'No response from extension background',
            },
          );
        },
      );
    } catch (e) {
      resolve({ ok: false, status: 0, body: String(e?.message || e) });
    }
  });
}

function fluxRestrictedTabHint(url) {
  if (!url || !String(url).trim()) return 'empty';
  const u = String(url).trim();
  const low = u.toLowerCase();
  try {
    const proto = new URL(u).protocol.replace(':', '').toLowerCase();
    if (['chrome', 'edge', 'about', 'devtools', 'chrome-extension', 'moz-extension', 'vivaldi'].includes(proto)) {
      return 'internal';
    }
  } catch {
    return 'bad-url';
  }
  if (low.includes('chrome.google.com/webstore')) return 'webstore';
  if (low.includes('microsoftedge.microsoft.com/addons')) return 'webstore';
  return null;
}

function dataUrlToBase64Parts(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!m) throw new Error('Invalid image data');
  return { mimeType: m[1].split(';')[0].trim(), base64: m[2] };
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = dataUrl;
  });
}

async function prepareVisionDataUrl(dataUrl) {
  const img = await loadImageFromDataUrl(dataUrl);
  const { naturalWidth: width, naturalHeight: height } = img;
  const max = VISION_MAX_DIM;
  const scale = Math.min(1, max / Math.max(width, height, 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', VISION_JPEG_QUALITY);
}

function captureVisibleTabViaBackground() {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (bg) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!bg?.ok) reject(new Error(bg?.error || 'Could not capture tab'));
        else resolve(bg.dataUrl);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function updateVisionBar() {
  const bar = document.getElementById('visionBar');
  const thumb = document.getElementById('visionThumb');
  const label = document.getElementById('visionLabel');
  if (!bar || !thumb || !label) return;
  if (!pendingVision) {
    bar.style.display = 'none';
    thumb.removeAttribute('src');
    return;
  }
  bar.style.display = 'flex';
  const mime = pendingVision.mimeType || 'image/jpeg';
  thumb.src = `data:${mime};base64,${pendingVision.base64}`;
  label.textContent = `Image attached (${pendingVision.sourceLabel || 'snapshot'}) — sent with your next message. Tap ✕ to remove.`;
}

function clearPendingVision() {
  pendingVision = null;
  updateVisionBar();
}

async function setPendingVisionFromDataUrl(dataUrl, sourceLabel) {
  try {
    const prepared = await prepareVisionDataUrl(dataUrl);
    const { base64, mimeType } = dataUrlToBase64Parts(prepared);
    pendingVision = { base64, mimeType, sourceLabel };
    updateVisionBar();
  } catch (e) {
    addMessage('ai', `Could not prepare image: ${e.message || e}`);
  }
}

async function handleScanTab() {
  try {
    let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs?.length) tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const restricted = fluxRestrictedTabHint(tab?.url || '');
    if (restricted) {
      addMessage(
        'ai',
        'Scan tab only works on a normal website tab (https://…), not chrome:// pages or the Web Store. Click the page you want, then tap Scan tab again.',
      );
      return;
    }
    const dataUrl = await captureVisibleTabViaBackground();
    await setPendingVisionFromDataUrl(dataUrl, 'browser tab');
  } catch (e) {
    addMessage('ai', `Scan tab failed: ${e.message || e}`);
  }
}

async function handleShareScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    addMessage('ai', 'Screen sharing is not available here. Try Scan tab on the page you need.');
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const video = document.createElement('video');
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => requestAnimationFrame(r));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width || !canvas.height) throw new Error('No video size');
    canvas.getContext('2d').drawImage(video, 0, 0);
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
    await setPendingVisionFromDataUrl(canvas.toDataURL('image/png'), 'shared screen');
  } catch (e) {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    const msg = String(e?.message || e);
    if (/denied|Permission dismissed|not allowed|canceled|aborted|User canceled/i.test(msg)) return;
    addMessage('ai', `Screen capture failed: ${msg}`);
  }
}

async function fluxGetPageContext(tabId) {
  return await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' });
}

async function fluxInjectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ['content.js'],
  });
}

function normalizeEmail(ctx) {
  return ctx?.email || ctx?.emails || null;
}

function updateContextBar(context) {
  const domainEl = document.getElementById('contextDomain');
  const titleEl = document.getElementById('contextTitle');
  const badgeEl = document.getElementById('pageTypeBadge');
  const liveEl = document.getElementById('liveDot');

  let host = '';
  try {
    host = context?.domain || new URL(context?.url || 'https://example.com').hostname;
  } catch {
    host = context?.domain || '';
  }
  if (domainEl) domainEl.textContent = host || '…';
  if (titleEl) titleEl.textContent = (context?.title || '').slice(0, 72);
  if (badgeEl) {
    badgeEl.textContent = formatPageType(context?.pageType);
    badgeEl.className = `page-badge type-${context?.pageType || 'webpage'}`;
  }
  if (liveEl) {
    liveEl.style.display = 'block';
    liveEl.title = 'Live page context';
    liveEl.style.animation = 'none';
    void liveEl.offsetHeight;
    liveEl.style.animation = '';
  }
}

function buildSuggestionChips(context) {
  const type = context?.pageType || 'webpage';
  const chips = [];

  if (type === 'canvas-quiz' && context?.quiz?.questions?.length > 0) {
    const unanswered = context.quiz.questions.filter((q) => !q.answered).length;
    chips.push(
      {
        text: `Solve all (${unanswered} left)`,
        prompt:
          'Solve every question on this quiz. For each answer, be precise. Then output a ```skill block with canvas-fill-all-answers and the answers array.',
      },
      { text: 'Explain question 1', prompt: 'Explain how to solve question 1 on this quiz step by step.' },
      { text: 'Show all answers', prompt: 'List the correct answer for every quiz question with a one-line reason each.' },
    );
  } else if (type === 'canvas-assignment') {
    chips.push(
      { text: 'Summarize assignment', prompt: 'Summarize what this assignment requires in 3 bullet points.' },
      { text: 'Add to planner', prompt: 'Add this assignment to my Flux planner with the due date from the page.' },
      { text: 'Study plan', prompt: 'Create a study plan to complete this assignment.' },
    );
  } else if (type === 'gmail') {
    const em = normalizeEmail(context);
    chips.push({
      text: em?.subject ? 'Draft a reply' : 'Summarize inbox',
      prompt: em?.subject
        ? `Draft a reply to this email: "${em.subject}". Keep it direct and useful.`
        : 'Summarize my most important visible emails from the inbox view.',
    });
    chips.push({ text: 'Find deadlines', prompt: 'Find any deadlines or due dates mentioned in the visible email content.' });
  } else if (type === 'google-docs') {
    chips.push(
      { text: 'Improve this doc', prompt: 'Read this document and suggest 3 specific improvements.' },
      { text: 'Summarize', prompt: 'Summarize this document in 5 bullet points.' },
      {
        text: 'Continue writing',
        prompt: 'Continue writing from where this document ends. Match the style and voice.',
      },
    );
  } else if (type === 'youtube') {
    chips.push(
      { text: 'Summarize video', prompt: 'Summarize the key points from this YouTube page.' },
      { text: 'Take notes', prompt: 'Create study notes from the visible video description and page content.' },
    );
  } else {
    chips.push(
      { text: 'Summarize page', prompt: 'Summarize this page in 3 sentences.' },
      { text: 'Find due dates', prompt: 'Find any deadlines or due dates mentioned on this page.' },
      {
        text: 'Add to planner',
        prompt: 'Extract any tasks or assignments from this page and add them to my planner.',
      },
    );
  }

  return chips;
}

function updateSuggestions(context) {
  const suggestionsEl = document.getElementById('suggestions');
  if (!suggestionsEl) return;
  const chips = buildSuggestionChips(context);
  suggestionsEl.innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="suggestion-chip" data-suggestion-prompt="${encodeURIComponent(c.prompt)}">${escapeHtml(c.text)}</button>`,
    )
    .join('');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function bindSuggestionsDelegation() {
  const el = document.getElementById('suggestions');
  if (!el || el.dataset.fluxBound) return;
  el.dataset.fluxBound = '1';
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.suggestion-chip');
    if (!btn?.dataset?.suggestionPrompt) return;
    try {
      const prompt = decodeURIComponent(btn.dataset.suggestionPrompt);
      const input = document.getElementById('chatInput');
      if (input) input.value = prompt;
      handleSend();
    } catch (_) {}
  });
}

function addSystemMessage(text) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;
  const welcome = messages.querySelector('.flux-welcome');
  if (welcome) welcome.remove();
  const div = document.createElement('div');
  div.className = 'message message-system';
  div.innerHTML = `<div class="message-content system-content">${formatMarkdown(text)}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function handleContextUpdate(context, opts = {}) {
  if (!context) return;
  const prev = currentPageContext;
  const silent = opts.silent === true;
  const hydrate = opts.hydrate === true;

  const wasQuiz = prev?.pageType === 'canvas-quiz';
  const isQuiz = context.pageType === 'canvas-quiz';
  const urlChanged = !!(prev && context.url !== prev.url);

  currentPageContext = context;
  updateContextBar(context);
  updateSkillsBar(context.pageType);
  updateSuggestions(context);

  if (silent) return;

  if (urlChanged && chatHistory.length > 0 && !hydrate) {
    const t = (context.title || context.domain || 'this page').slice(0, 80);
    addSystemMessage(`📍 Now on: **${t}**`);
  }

  const showQuizIntro =
    isQuiz && !wasQuiz && context.quiz?.questions?.length > 0 && (!hydrate || chatHistory.length === 0);
  if (showQuizIntro) {
    const qCount = context.quiz.questions.length;
    const unanswered = context.quiz.questions.filter((q) => !q.answered).length;
    addSystemMessage(
      `📝 **Canvas quiz detected**: ${context.quiz.title || 'Untitled'}\n` +
        `${qCount} question${qCount !== 1 ? 's' : ''}` +
        (unanswered > 0 ? ` · **${unanswered} unanswered**` : ' · All answered') +
        `\n\nI can see the questions. Say **solve all** or use the chip above; I can output skills to fill answers when you want.`,
    );
  }
}

function handleSelectedText(text) {
  if (!text || String(text).trim().length < 5) return;
  selectedText = String(text).trim();
  const bar = document.getElementById('selectedTextBar');
  const preview = document.getElementById('selectedTextPreview');
  if (bar) bar.style.display = 'flex';
  if (preview) preview.textContent = selectedText.slice(0, 80) + (selectedText.length > 80 ? '…' : '');
}

function handleContextMenuAction(msg) {
  const t = (msg.selectionText || '').trim();
  const inputEl = document.getElementById('chatInput');
  if (msg.menuId === 'flux-ask') {
    const line = t || (msg.linkUrl ? `Open / explain: ${msg.linkUrl}` : '');
    if (!line) return;
    selectedText = t || null;
    if (t) handleSelectedText(t);
    if (inputEl) {
      inputEl.value = t ? `About this: ${t}` : `About this link: ${msg.linkUrl}`;
    }
    handleSend();
    return;
  }
  if (msg.menuId === 'flux-solve' && t) {
    selectedText = t;
    handleSelectedText(t);
    if (inputEl) inputEl.value = `Solve this: ${t}`;
    handleSend();
    return;
  }
  if (msg.menuId === 'flux-add-task') {
    const line = t || (msg.linkUrl ? msg.linkUrl : '');
    if (!line) return;
    if (inputEl) inputEl.value = `Add to Flux as a task: ${line}`;
    handleSend();
  }
}

async function refreshContextSilently() {
  try {
    let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs?.length) tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) return;
    let response;
    try {
      response = await fluxGetPageContext(tab.id);
    } catch {
      await fluxInjectContentScript(tab.id);
      await new Promise((r) => setTimeout(r, 120));
      response = await fluxGetPageContext(tab.id);
    }
    if (response?.context) handleContextUpdate(response?.context, { silent: true });
  } catch (_) {}
}

async function refreshPageContext() {
  const badge = document.getElementById('pageTypeBadge');
  const domain = document.getElementById('contextDomain');
  const title = document.getElementById('contextTitle');

  if (badge) {
    badge.textContent = '…';
    badge.className = 'page-badge loading';
  }
  if (title) title.textContent = '';

  const fail = (line1, line2) => {
    if (domain) domain.textContent = line1;
    if (title) title.textContent = line2 || '';
    if (badge) {
      badge.textContent = '—';
      badge.className = 'page-badge type-unknown';
    }
    currentPageContext = null;
    updateSkillsBar('webpage');
    updateSuggestions({ pageType: 'webpage', title: '', url: '', domain: '' });
  };

  try {
    let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs?.length) tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) {
      fail('No active tab', 'Focus a website tab, then tap refresh.');
      return;
    }

    const restricted = fluxRestrictedTabHint(tab.url || '');
    if (restricted) {
      const sub =
        restricted === 'webstore'
          ? 'Can’t run on the extensions store. Open a homework or article tab.'
          : 'Open a real website (https://…). Not chrome:// or this panel.';
      fail('This tab isn’t readable', sub);
      return;
    }

    let response;
    try {
      response = await fluxGetPageContext(tab.id);
    } catch {
      try {
        await fluxInjectContentScript(tab.id);
        await new Promise((r) => setTimeout(r, 100));
        response = await fluxGetPageContext(tab.id);
      } catch {
        fail('Couldn’t attach', 'Reload the page, focus it, then tap refresh.');
        return;
      }
    }

    const ctx = response?.context;
    if (!ctx) {
      fail('No page data', 'Try refresh after the page finishes loading.');
      return;
    }

    handleContextUpdate(ctx, { silent: true });
    updateContextBar(ctx);
  } catch (e) {
    fail('Something went wrong', String(e?.message || e).slice(0, 140));
  }
}

function formatPageType(type) {
  const labels = {
    'google-docs': '📝 Docs',
    'google-sheets': '📊 Sheets',
    'google-slides': '📽 Slides',
    gmail: '📧 Gmail',
    'google-calendar': '📅 Calendar',
    'google-classroom': '🏫 Classroom',
    'canvas-lms': '🎓 Canvas',
    'canvas-quiz': '📝 Quiz',
    'canvas-assignment': '📋 Assignment',
    youtube: '▶ YouTube',
    article: '📰 Article',
    webpage: '🌐 Web',
    deltamath: '∑ DeltaMath',
    'khan-academy': '🟢 Khan',
    'study-tool': '📚 Study',
  };
  return labels[type] || '🌐 Web';
}

const BUILT_IN_SKILLS = [
  {
    id: 'google-docs-write',
    name: 'Write in Doc',
    icon: '📝',
    description: 'Type content into the Google Doc at cursor',
    applicablePages: ['google-docs'],
    params: ['text', 'slow'],
  },
  {
    id: 'google-docs-improve',
    name: 'Improve Doc',
    icon: '✨',
    description: 'Read the doc and suggest improvements',
    applicablePages: ['google-docs'],
    action: 'read-and-suggest',
  },
  {
    id: 'gmail-draft-reply',
    name: 'Draft Reply',
    icon: '↩',
    description: 'Draft a reply based on the open thread',
    applicablePages: ['gmail'],
    params: ['style'],
  },
  {
    id: 'gmail-summarize',
    name: 'Summarize Email',
    icon: '📋',
    description: 'Summarize this email thread',
    applicablePages: ['gmail'],
    action: 'summarize',
  },
  {
    id: 'canvas-add-tasks',
    name: 'Add to Planner',
    icon: '📌',
    description: 'Add Canvas assignments to Flux',
    applicablePages: ['canvas-lms'],
    action: 'extract-assignments',
  },
  {
    id: 'web-summarize',
    name: 'Summarize Page',
    icon: '📄',
    description: 'Summarize this webpage',
    applicablePages: ['webpage', 'article'],
    action: 'summarize',
  },
  {
    id: 'web-save-as-note',
    name: 'Save as Note',
    icon: '💾',
    description: 'Save page content as a Flux note',
    applicablePages: ['webpage', 'article', 'youtube'],
    action: 'save-note',
  },
  {
    id: 'add-deadline',
    name: 'Add Deadline',
    icon: '⏰',
    description: 'Find and add deadlines from this page',
    applicablePages: ['webpage', 'canvas-lms', 'google-classroom'],
    action: 'extract-deadline',
  },
];

function updateSkillsBar(pageType) {
  const chips = document.getElementById('skillsChips');
  if (!chips) return;
  const applicable = BUILT_IN_SKILLS.filter(
    (s) =>
      s.applicablePages.includes(pageType) ||
      s.applicablePages.includes('webpage') ||
      pageType === 'deltamath' ||
      pageType === 'canvas-quiz' ||
      pageType === 'canvas-assignment',
  );
  chips.innerHTML = applicable
    .map(
      (skill) =>
        `<button type="button" class="skill-chip" data-skill-id="${skill.id}" title="${escapeHtml(skill.description)}"><span>${skill.icon}</span> ${escapeHtml(skill.name)}</button>`,
    )
    .join('');
  chips.querySelectorAll('.skill-chip').forEach((btn) => {
    btn.addEventListener('click', () => activateSkill(btn.dataset.skillId));
  });

  const panel = document.getElementById('sidebarSkillsPanel');
  if (panel) {
    panel.innerHTML = applicable
      .map((s) => `<div style="margin:4px 0"><strong>${escapeHtml(s.icon + ' ' + s.name)}</strong> — ${escapeHtml(s.description)}</div>`)
      .join('');
  }
}

async function activateSkill(skillId) {
  const skill = BUILT_IN_SKILLS.find((s) => s.id === skillId);
  if (!skill) return;

  addMessage('user', `Use skill: ${skill.name}`);
  const context = currentPageContext;
  const em = normalizeEmail(context);
  let prompt = '';

  if (skill.action === 'summarize') {
    prompt = `Summarize this page concisely:\n\nTitle: ${context?.title}\nContent: ${context?.visibleText?.slice(0, 3000)}`;
  } else if (skill.action === 'read-and-suggest') {
    const body = context?.googleDocs?.paragraphs || '';
    prompt = `Read this Google Doc and suggest 3 specific improvements:\n\n${body.slice(0, 3000)}`;
  } else if (skill.action === 'extract-assignments') {
    prompt = `Extract all assignments from this Canvas page and format as a task list with due dates:\n\n${context?.visibleText?.slice(0, 3000)}`;
  } else if (skill.action === 'extract-deadline') {
    prompt = `Find all deadlines and due dates on this page. Format as: Task name — Due date\n\n${context?.visibleText?.slice(0, 2000)}`;
  } else if (skill.action === 'save-note') {
    prompt = `Create a clean note from this page content. Include key points and any important details:\n\nTitle: ${context?.title}\n${context?.visibleText?.slice(0, 3000)}`;
  } else if (skill.id === 'gmail-draft-reply') {
    prompt = `I need a reply to this email. Write it in a direct, clear tone (no filler phrases):\n\nSubject: ${em?.subject}\nFrom: ${em?.sender}\nContent: ${String(em?.body || '').slice(0, 2000)}`;
  } else if (skill.id === 'google-docs-write') {
    const snippet = (context?.googleDocs?.paragraphs || context?.visibleText || '').slice(0, 2000);
    prompt = `Write content to insert into the Google Doc at the cursor. Output ONLY the text to type — no markdown fences, no preamble. Match the doc's tone. Relevant excerpt:\n\n${snippet}\n\nIf the excerpt is empty, write one focused paragraph that fits a student doc.`;
  }

  if (!prompt.trim()) {
    addMessage('ai', 'This skill needs page context or a follow-up in chat. Describe what to write and try again.');
    return;
  }

  await sendToAI(prompt, skill);
}

async function handleSkillBlocksInResponse(aiText) {
  const skillPattern = /```skill\s*([\s\S]*?)```/g;
  let match;
  while ((match = skillPattern.exec(aiText)) !== null) {
    try {
      const call = JSON.parse(match[1].trim());
      const skillId = call.skill;
      const params = call.params || {};
      const res = await executeOnPage(skillId, params);
      const r = res?.result;
      if (r?.ok) {
        addSystemMessage(`✓ ${r.message || 'Done'} (${skillId})`);
        await refreshContextSilently();
      } else if (r?.error) {
        addSystemMessage(`⚠ ${r.error}`);
      }
    } catch (_) {
      /* malformed */
    }
  }
}

function filterAILight(text) {
  const startFilters = [/^certainly[!,.]?\s*/i, /^of course[!,.]?\s*/i, /^great question[!,.]?\s*/i];
  let result = String(text || '').trim();
  for (const f of startFilters) result = result.replace(f, '');
  if (result.length > 0) result = result.charAt(0).toUpperCase() + result.slice(1);
  return result.trim();
}

async function sendToAI(message, skill = null) {
  if (isTyping) return;
  const typingEl = addTypingIndicator();
  isTyping = true;

  try {
    if (window.FluxExtAuth?.refreshSessionIfNeeded) {
      try {
        await window.FluxExtAuth.refreshSessionIfNeeded();
      } catch (e) {
        typingEl.remove();
        isTyping = false;
        addMessage(
          'ai',
          `Your session expired — tap **Sign out**, then **Continue with Google** again.\n\n${String(e?.message || e)}`,
        );
        return;
      }
    }

    let { fluxAuthToken } = await chrome.storage.local.get('fluxAuthToken');
    const liveCtx = currentPageContext
      ? {
          ...currentPageContext,
          selectedText:
            (selectedText && String(selectedText).trim()) || currentPageContext.selectedText || null,
        }
      : null;
    let systemPrompt = buildSystemPrompt(liveCtx);
    if (pendingVision) {
      systemPrompt += `\n\nA visual snapshot is attached (${pendingVision.sourceLabel || 'image'}). Use it for anything visible (diagrams, math, UI). Combine with page text when helpful. Same conversational Flux voice—no stiff report unless they ask. If the snapshot is wrong or blank, say so briefly.`;
    }

    const msgs = chatHistory
      .slice(-6)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }))
      .concat([{ role: 'user', content: message }]);

    let relay = await callAiProxyViaBackground(systemPrompt, msgs, fluxAuthToken, pendingVision);
    const authLikeFail = () => {
      if (relay.status === 401) return true;
      const b = typeof relay.body === 'string' ? relay.body : '';
      return /invalid jwt|invalid JWT|invalid or expired|invalid refresh/i.test(b);
    };
    if (!relay.ok && authLikeFail() && window.FluxExtAuth?.refreshSessionIfNeeded) {
      try {
        await window.FluxExtAuth.refreshSessionIfNeeded();
        fluxAuthToken = (await chrome.storage.local.get('fluxAuthToken')).fluxAuthToken;
        relay = await callAiProxyViaBackground(systemPrompt, msgs, fluxAuthToken, pendingVision);
      } catch (_) {
        /* keep first error */
      }
    }
    const rawText = typeof relay.body === 'string' ? relay.body : '';
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { error: rawText ? rawText.slice(0, 280) : 'Invalid response' };
    }
    typingEl.remove();
    isTyping = false;

    const response = { ok: relay.ok, status: relay.status };

    const piece = data.content?.[0]?.text;
    const errLabel = typeof data.error === 'string' ? data.error : '';
    const errDetails = typeof data.details === 'string' ? data.details : '';
    const combinedErr =
      errDetails && errLabel ? `${errLabel}\n\n${errDetails}` : errDetails || errLabel;
    const aiRaw =
      (typeof piece === 'string' && piece) ||
      (typeof data.response === 'string' && data.response) ||
      (!response.ok && typeof data.message === 'string' && data.message) ||
      (!response.ok && combinedErr) ||
      (!response.ok
        ? `Request failed (${response.status}). Sign in on the Flux site, Settings → Look → Chrome extension → Save & sync. Then reload this extension on chrome://extensions.`
        : '');
    let aiText =
      aiRaw ||
      (response.ok ? 'No text in AI response. Check Supabase function logs.' : 'No response');
    aiText = filterAILight(aiText);

    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: aiText });

    addMessage('ai', aiText);

    if (pendingVision) clearPendingVision();

    await handleSkillBlocksInResponse(aiText);

    if (skill?.id === 'google-docs-write') {
      await executeOnPage('google-docs-type', { text: aiText, slow: true });
    } else if (skill?.id === 'gmail-draft-reply') {
      await executeOnPage('gmail-reply', { body: aiText });
    }
  } catch (e) {
    typingEl.remove();
    isTyping = false;
    addMessage('ai', `Error: ${e.message}`);
  }
}

function buildSystemPrompt(ctx) {
  if (!ctx) {
    return `You are Flux, a friendly AI in a Chrome extension side panel. Talk like a normal chatbot: warm, clear, conversational—short paragraphs, natural phrasing. Do not sound like a formal lab report unless the user asks for steps or an outline.`;
  }

  const gd = ctx.googleDocs;
  const em = normalizeEmail(ctx);
  const cv = ctx.canvas;
  const yt = ctx.youtube;
  const quiz = ctx.quiz;
  const sel = (ctx.selectedText && String(ctx.selectedText).trim()) || '';
  const vis = ctx.visibleText ? String(ctx.visibleText).slice(0, 9000) : '';

  let extra = '';

  if (ctx.pageType === 'canvas-quiz' && quiz?.questions?.length) {
    extra += `\n## Canvas quiz (all visible questions)\nQuiz: ${quiz.title || 'Untitled'}\n`;
    quiz.questions.forEach((q) => {
      extra += `\n**Q${q.number}:** ${q.text}\n`;
      if (q.choices?.length) {
        extra += `Choices:\n${q.choices.map((c, ci) => `  ${String.fromCharCode(65 + ci)}) ${c.text}`).join('\n')}\n`;
      }
      extra += `Type: ${q.type}, Points: ${q.points || '—'}, Answered: ${q.answered}\n`;
    });
    extra += `\nWhen the user wants answers filled in the page, output a fenced block exactly like:\n\`\`\`skill\n{"skill":"canvas-fill-all-answers","params":{"answers":[{"questionNumber":1,"answer":"value","answerText":"label"}]}}\n\`\`\`\n`;
  }

  if (ctx.pageType === 'google-docs' && gd) {
    extra += `\nGoogle Doc: "${gd.title || ctx.title}"\n${String(gd.paragraphs || '').slice(0, 4000)}`;
  }

  if (ctx.pageType === 'gmail' && em) {
    if (em.subject) {
      extra += `\nEmail: "${em.subject}"\nFrom: ${em.sender}\n${String(em.body || '').slice(0, 2000)}`;
    } else if (em.recentEmails?.length) {
      extra += `\nGmail inbox rows:\n`;
      em.recentEmails.forEach((e) => {
        extra += `- ${e.unread ? '[UNREAD] ' : ''}${e.subject || 'No subject'} — ${e.sender}\n`;
      });
    }
  }

  if (ctx.pageType === 'youtube' && yt) {
    extra += `\nYouTube: "${yt.title}"\nChannel: ${yt.channel}\n${String(yt.description || '').slice(0, 1500)}`;
    if (yt.transcript) extra += `\nTranscript excerpt:\n${String(yt.transcript).slice(0, 2000)}`;
  }

  if (cv && ['canvas-lms', 'canvas-assignment'].includes(ctx.pageType)) {
    extra += `\nCanvas assignment: ${cv.assignmentTitle}\nDue: ${cv.dueDate}\nPoints: ${cv.points}\n${String(cv.description || '').slice(0, 2000)}`;
  }

  const skipVisFor = ['canvas-quiz', 'google-docs', 'gmail'];
  const visBlock = vis && !skipVisFor.includes(ctx.pageType) ? `\nVisible page text:\n${vis}` : '';

  return `You are Flux, an AI assistant in a student planner Chrome extension.

Voice: Friendly, direct, conversational—like texting a sharp friend. No stiff "## Step N:" blocks unless they ask for steps or exam-style working.
Current page: ${ctx.title} (${ctx.url})
Page type: ${ctx.pageType}
Domain: ${ctx.domain}
${sel ? `\n=== USER HIGHLIGHTED TEXT (priority) ===\n${sel.slice(0, 6000)}\n=== end selection ===\n` : ''}
${extra}
${visBlock}

When asked to solve homework or quiz items: use selection first, then structured quiz data, then visible text. If content is missing, say what's missing casually.
Be accurate. Do not claim "JavaScript must be enabled" unless the captured text is only a generic noscript banner.

Skills: When the user explicitly wants an action on the page, you may output \`\`\`skill JSON \`\`\` blocks. Use ids: google-docs-type, gmail-reply, canvas-fill-all-answers, canvas-fill-answer, etc.`;
}

async function executeOnPage(skillId, params) {
  let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tabs?.length) tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_SKILL', skillId, params });
  } catch (e) {
    return { result: { error: e.message } };
  }
}

async function executeActionOnPage(action) {
  let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tabs?.length) tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) return { result: { error: 'No active tab' } };
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_ACTION', action });
  } catch (e) {
    return { result: { error: e.message } };
  }
}

async function captureScreenshotForVision() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(res?.screenshot || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Keywords that mean the user wants an on-page action, not a chat answer.
 * Only when this returns true do we engage the multi-step vision loop.
 */
function detectsActionIntent(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  const actionKeywords = [
    'click ', 'fill in', 'fill out', 'complete this', 'answer all', 'submit',
    'solve all', 'do the quiz', 'do all questions', 'type in', 'select ',
    'scroll down', 'scroll to', 'find and click', 'go to', 'navigate', 'open the',
    'compose ', 'write in', 'reply to', 'do all', 'finish this', 'check the box',
    'press enter', 'press the', 'auto-fill', 'autofill',
  ];
  return actionKeywords.some((k) => lower.includes(k));
}

function formatActionForDisplay(action) {
  switch (action.type) {
    case 'click':
      return `Clicking "${action.text || action.elementId || action.selector || ''}"`;
    case 'type':
      return `Typing "${(action.text || '').slice(0, 30)}"`;
    case 'fill_canvas_answer':
      return `Answering Q${action.questionNumber}: "${(action.answer || action.answerText || '').slice(0, 40)}"`;
    case 'scroll':
      return action.toBottom
        ? 'Scrolling to bottom'
        : action.toTop
          ? 'Scrolling to top'
          : `Scrolling ${(action.y || 0) > 0 ? 'down' : 'up'}`;
    case 'wait':
      return `Waiting ${action.ms || 500}ms`;
    case 'select':
      return `Selecting "${action.value}"`;
    case 'press_key':
      return `Pressing ${action.key}`;
    default:
      return action.type;
  }
}

/**
 * Vision-Action-Verification loop.
 * Up to 8 steps; each step = screenshot + DOM snapshot → AI plan → execute → verify.
 */
const VisionLoop = {
  maxSteps: 8,
  currentStep: 0,
  running: false,

  showIndicator(on) {
    const el = document.getElementById('visionModeIndicator');
    if (el) el.style.display = on ? 'flex' : 'none';
  },

  async run(userIntent, pageContext, screenshot) {
    if (this.running) {
      addSystemMessage('Vision loop already running. Tap ■ to stop.');
      return;
    }
    this.running = true;
    this.currentStep = 0;
    this.showIndicator(true);

    let currentContext = pageContext || null;
    let currentScreenshot = screenshot || null;
    const actionHistory = [];

    addSystemMessage(`🔍 Vision mode for: "${String(userIntent).slice(0, 60)}"`);

    try {
      while (this.currentStep < this.maxSteps && this.running) {
        this.currentStep++;

        const visionPrompt = this.buildVisionPrompt(userIntent, currentContext, actionHistory);
        const response = await this.callVisionAI(visionPrompt, currentScreenshot);
        if (!response) {
          addSystemMessage('⚠ No response from AI — stopping');
          break;
        }

        const parsed = this.parseAIResponse(response);
        if (parsed.reasoning) {
          addMessage('ai', parsed.reasoning);
          chatHistory.push({ role: 'assistant', content: parsed.reasoning });
        }

        if (!parsed.actions.length) {
          if (parsed.done) addSystemMessage(`✅ Task complete after ${this.currentStep} step${this.currentStep !== 1 ? 's' : ''}`);
          break;
        }

        for (const action of parsed.actions) {
          if (!this.running) break;
          addSystemMessage(`⚡ ${formatActionForDisplay(action)}`);
          const res = await executeActionOnPage(action);
          actionHistory.push({ action, result: res?.result, step: this.currentStep });
          if (res?.result?.error) addSystemMessage(`⚠ ${res.result.error}`);
          await new Promise((r) => setTimeout(r, action.waitAfter || 600));
        }

        if (parsed.done) {
          addSystemMessage(`✅ Complete`);
          break;
        }

        await new Promise((r) => setTimeout(r, 800));
        let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tabs?.length) tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id) {
          currentScreenshot = await captureScreenshotForVision();
          try {
            const fresh = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
            if (fresh?.context) currentContext = fresh.context;
          } catch (_) {}
        }
      }

      if (this.currentStep >= this.maxSteps && this.running) {
        addSystemMessage(`⚠ Reached max steps (${this.maxSteps}). Tell me what to try next.`);
      }
    } catch (e) {
      addSystemMessage(`⚠ Vision loop error: ${e.message || e}`);
    } finally {
      this.running = false;
      this.showIndicator(false);
    }
  },

  buildVisionPrompt(intent, ctx, history) {
    const snapshot = ctx?.semanticSnapshot || {};
    const interactive = (snapshot.interactive || []).slice(0, 40);
    const history4 = history.slice(-4);

    let prompt = `You are controlling a browser for the user. Their goal: "${intent}"

## Current page
URL: ${ctx?.url || '?'}
Title: ${ctx?.title || '?'}
Type: ${ctx?.pageType || 'webpage'}

## Visible interactive elements (use these IDs in actions)
${JSON.stringify(interactive, null, 1)}

## Recent action history
${history4.length
        ? history4
            .map((h) => `Step ${h.step}: ${h.action.type} → ${JSON.stringify(h.result).slice(0, 120)}`)
            .join('\n')
        : 'None yet'}

## Instructions
Look at the screenshot AND the DOM snapshot together. Decide the next action(s) that get closer to the goal.
Output EITHER one or more action blocks, OR a done block when the task is finished.

Action format (one JSON per fence):
\`\`\`action
{"type":"click","elementId":"flux_el_42"}
\`\`\`

Supported action types:
- click: { elementId | selector | text | x,y }
- type: { elementId | selector, text, clear?: true, slow?: false }
- select: { elementId, value }
- scroll: { y?, toBottom?, toTop?, selector?, toElement? }
- press_key: { key: "Enter"|"Escape"|"Tab"|... }
- fill_canvas_answer: { questionNumber, answer?, answerText? }
- wait: { ms: 800 }

When the goal is fully reached, output:
\`\`\`done
true
\`\`\`

Rules:
- Only reference elementIds that appear in the snapshot above.
- One short reasoning sentence, then the action fence(s).
- Never invent URLs, never escape the current tab.`;

    if (ctx?.quiz?.questions?.length) {
      prompt +=
        '\n\n## Canvas quiz on page\n' +
        ctx.quiz.questions
          .map(
            (q) =>
              `Q${q.number}: ${String(q.text || '').slice(0, 200)}\nType: ${q.type}\nChoices: ${(q.choices || [])
                .map((c) => c.text)
                .join(' | ')}\nAnswered: ${q.answered}`,
          )
          .join('\n\n');
    }

    return prompt;
  },

  async callVisionAI(prompt, screenshot) {
    const { fluxAuthToken } = await chrome.storage.local.get('fluxAuthToken');
    const messages = [{ role: 'user', content: 'What actions should I take next to complete the goal?' }];
    const vision = screenshot ? { base64: screenshot, mimeType: 'image/jpeg' } : null;
    const relay = await callAiProxyViaBackground(prompt, messages, fluxAuthToken || '', vision);
    if (!relay?.ok) return null;
    try {
      const data = JSON.parse(relay.body || '{}');
      return (
        data.content?.[0]?.text ||
        (typeof data.response === 'string' ? data.response : null) ||
        null
      );
    } catch {
      return null;
    }
  },

  parseAIResponse(text) {
    const actions = [];
    let reasoning = String(text || '');
    let done = false;

    const actionPattern = /```action\s*([\s\S]*?)```/g;
    let match;
    while ((match = actionPattern.exec(text)) !== null) {
      try {
        const action = JSON.parse(match[1].trim());
        actions.push(action);
        reasoning = reasoning.replace(match[0], '').trim();
      } catch (_) {
        /* malformed JSON — skip */
      }
    }

    const donePattern = /```done\s*([\s\S]*?)```/g;
    while ((match = donePattern.exec(text)) !== null) {
      done = true;
      reasoning = reasoning.replace(match[0], '').trim();
    }

    reasoning = filterAILight(reasoning);
    return { actions, reasoning: reasoning || null, done };
  },

  stop() {
    if (!this.running) return;
    this.running = false;
    this.showIndicator(false);
    addSystemMessage('⏹ Vision loop stopped');
  },
};

window.VisionLoop = VisionLoop;

function getWelcomeMarkup() {
  return `<div class="flux-welcome">
      <div class="welcome-header">
        <svg width="32" height="18" viewBox="0 0 60 32" fill="none" aria-hidden="true">
          <path d="M30,16 C32,5 46,5 46,16 C46,27 32,27 30,16 C28,27 14,27 14,16 C14,5 28,5 30,16 Z" fill="none" stroke="url(#wg)" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="30" cy="16" r="2.5" fill="#00bfff"/>
          <defs>
            <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00bfff" stop-opacity="0"/>
              <stop offset="30%" stop-color="#00bfff"/>
              <stop offset="70%" stop-color="#7c5cff"/>
              <stop offset="100%" stop-color="#7c5cff" stop-opacity="0"/>
            </linearGradient>
          </defs>
        </svg>
        <span class="welcome-title">Flux is watching</span>
      </div>
      <p class="welcome-text">This tab’s content updates automatically. Sign in with Google to chat. Use <strong>Scan tab</strong> if you need vision. On Canvas quizzes, ask me to solve or explain.</p>
    </div>`;
}

function startNewChat() {
  chatHistory.length = 0;
  clearPendingVision();
  selectedText = null;
  isTyping = false;
  const bar = document.getElementById('selectedTextBar');
  const preview = document.getElementById('selectedTextPreview');
  if (bar) bar.style.display = 'none';
  if (preview) preview.textContent = '';
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }
  const sendBtn = document.getElementById('sendBtn');
  sendBtn?.classList.remove('active');
  const panel = document.getElementById('sidebarSkillsPanel');
  if (panel) panel.style.display = 'none';
  const messages = document.getElementById('chatMessages');
  if (messages) {
    messages.innerHTML = getWelcomeMarkup();
    messages.scrollTop = 0;
  }
}

function addMessage(role, text) {
  const messages = document.getElementById('chatMessages');
  const welcome = messages?.querySelector('.flux-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `message message-${role}`;
  div.innerHTML = `
    <div class="message-content">${formatMarkdown(text)}</div>
    <div class="message-time">${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message message-ai typing';
  div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function formatMarkdown(text) {
  const esc = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```skill[\s\S]*?```/g, '');
  return esc
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

const input = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

function handleSend() {
  const inputEl = document.getElementById('chatInput');
  if (!inputEl || isTyping) return;
  let text = inputEl.value.trim();
  if (!text) return;
  const sel = (selectedText && selectedText.trim()) || '';
  if (sel && !text.includes(sel.slice(0, Math.min(48, sel.length)))) {
    text = `${text}\n\n[Text selected on page]\n${sel}`;
  }
  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendBtn?.classList.remove('active');
  addMessage('user', text);

  // Vision-action-verification loop kicks in for explicit "do something" requests
  if (detectsActionIntent(text) && currentPageContext) {
    chatHistory.push({ role: 'user', content: text });
    (async () => {
      const screenshot = await captureScreenshotForVision();
      await VisionLoop.run(text, currentPageContext, screenshot);
    })();
    return;
  }

  void sendToAI(text);
}

input?.addEventListener('input', () => {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  sendBtn?.classList.toggle('active', input.value.trim().length > 0);
});

input?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn?.addEventListener('click', handleSend);

document.getElementById('clearSelectionBtn')?.addEventListener('click', () => {
  selectedText = null;
  const b = document.getElementById('selectedTextBar');
  if (b) b.style.display = 'none';
});

document.getElementById('refreshContextBtn')?.addEventListener('click', refreshPageContext);
document.getElementById('newChatBtn')?.addEventListener('click', startNewChat);

document.getElementById('scanTabBtn')?.addEventListener('click', handleScanTab);
document.getElementById('shareScreenBtn')?.addEventListener('click', handleShareScreen);
document.getElementById('clearVisionBtn')?.addEventListener('click', clearPendingVision);
document.getElementById('stopVisionBtn')?.addEventListener('click', () => VisionLoop.stop());

const skillsToggleBtn = document.getElementById('skillsToggleBtn');
const sidebarSkillsPanel = document.getElementById('sidebarSkillsPanel');
if (skillsToggleBtn && sidebarSkillsPanel) {
  skillsToggleBtn.addEventListener('click', () => {
    const on = sidebarSkillsPanel.style.display !== 'none';
    sidebarSkillsPanel.style.display = on ? 'none' : 'block';
    document.getElementById('chatInput')?.focus();
  });
}

connectToBackground();
loadCachedContext();
bindSuggestionsDelegation();

if (window.FluxExtAuth) {
  window.FluxExtAuth.init();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.fluxAuthToken || changes.fluxUserEmail) {
        window.FluxExtAuth.refreshAuthBar();
      }
    });
  } catch (_) {}
}
