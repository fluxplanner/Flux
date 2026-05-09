/* global chrome */

const SUPABASE_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
const AI_PROXY_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`;

let currentPageContext = null;
let selectedText = null;
const chatHistory = [];

async function refreshPageContext() {
  const badge = document.getElementById('pageTypeBadge');
  const domain = document.getElementById('contextDomain');
  const title = document.getElementById('contextTitle');

  badge.textContent = '...';
  badge.className = 'page-badge loading';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
    currentPageContext = response?.context;

    if (currentPageContext) {
      domain.textContent = currentPageContext.domain || currentPageContext.url;
      title.textContent = currentPageContext.title?.slice(0, 72) || '';
      badge.textContent = formatPageType(currentPageContext.pageType);
      badge.className = `page-badge type-${currentPageContext.pageType}`;
      updateSkillsBar(currentPageContext.pageType);
    }
  } catch (e) {
    domain.textContent = 'Cannot access this page';
    badge.textContent = '—';
    badge.className = 'page-badge type-unknown';
  }
}

function formatPageType(type) {
  const labels = {
    'google-docs': '📝 Docs',
    gmail: '📧 Gmail',
    'google-calendar': '📅 Calendar',
    'canvas-lms': '🎓 Canvas',
    youtube: '▶ YouTube',
    article: '📰 Article',
    'google-classroom': '🏫 Classroom',
    webpage: '🌐 Web',
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
  const applicable = BUILT_IN_SKILLS.filter(
    (s) => s.applicablePages.includes(pageType) || s.applicablePages.includes('webpage')
  );
  chips.innerHTML = applicable
    .map(
      (skill) =>
        `<button type="button" class="skill-chip" data-skill-id="${skill.id}" title="${skill.description.replace(/"/g, '&quot;')}">
      <span>${skill.icon}</span> ${skill.name}
    </button>`
    )
    .join('');
  chips.querySelectorAll('.skill-chip').forEach((btn) => {
    btn.addEventListener('click', () => activateSkill(btn.dataset.skillId));
  });

  const panel = document.getElementById('sidebarSkillsPanel');
  if (panel) {
    panel.innerHTML = applicable
      .map((s) => `<div style="margin:4px 0"><strong>${s.icon} ${s.name}</strong> — ${s.description}</div>`)
      .join('');
  }
}

async function activateSkill(skillId) {
  const skill = BUILT_IN_SKILLS.find((s) => s.id === skillId);
  if (!skill) return;

  addMessage('user', `Use skill: ${skill.name}`);
  const context = currentPageContext;
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
    prompt = `I need a reply to this email. Write it in a direct, clear tone (no filler phrases):\n\nSubject: ${context?.emails?.subject}\nFrom: ${context?.emails?.sender}\nContent: ${context?.emails?.body?.slice(0, 2000)}`;
  } else if (skill.id === 'google-docs-write') {
    const snippet = (context?.googleDocs?.paragraphs || context?.visibleText || '').slice(0, 2000);
    prompt = `Write content to insert into the Google Doc at the cursor. Output ONLY the text to type — no markdown fences, no preamble like "Here is", no quotes around the whole block. Match the doc's tone. Relevant doc excerpt:\n\n${snippet}\n\nIf the excerpt is empty, write one focused paragraph that fits a student doc.`;
  }

  if (!prompt.trim()) {
    addMessage('ai', 'This skill needs page context or a follow-up in chat. Describe what to write and try again.');
    return;
  }

  await sendToAI(prompt, skill);
}

async function sendToAI(message, skill = null) {
  const typingEl = addTypingIndicator();

  try {
    const { fluxAuthToken } = await chrome.storage.local.get('fluxAuthToken');
    const systemPrompt = buildSystemPrompt(currentPageContext);

    const msgs = chatHistory
      .slice(-6)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }))
      .concat([{ role: 'user', content: message }]);

    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fluxAuthToken || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: msgs,
      }),
    });

    const data = await response.json().catch(() => ({}));
    typingEl.remove();

    const aiRaw =
      data.content?.[0]?.text || data.response || data.error || (response.ok ? '' : 'No response');
    const aiText = typeof aiRaw === 'string' ? aiRaw : JSON.stringify(aiRaw);

    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: aiText });

    addMessage('ai', aiText);

    if (skill?.id === 'google-docs-write') {
      await executeOnPage('google-docs-type', { text: aiText, slow: true });
    } else if (skill?.id === 'gmail-draft-reply') {
      await executeOnPage('gmail-reply', { body: aiText });
    }
  } catch (e) {
    typingEl.remove();
    addMessage('ai', `Error: ${e.message}`);
  }
}

function buildSystemPrompt(ctx) {
  if (!ctx) return 'You are Flux, a helpful assistant.';
  const gd = ctx.googleDocs;
  const em = ctx.emails;
  const cv = ctx.canvas;
  return `You are Flux, an AI assistant in a student planner Chrome extension.

Current page: ${ctx.title} (${ctx.url})
Page type: ${ctx.pageType}
Domain: ${ctx.domain}
${gd ? `\nGoogle Doc excerpt:\n${String(gd.paragraphs || '').slice(0, 2000)}` : ''}
${em ? `\nEmail subject: ${em.subject}\nFrom: ${em.sender}\nBody: ${String(em.body || '').slice(0, 1000)}` : ''}
${cv ? `\nCanvas: ${cv.assignmentTitle}\nDue: ${cv.dueDate}\nPoints: ${cv.points}` : ''}
${ctx.visibleText ? `\nVisible page text (truncated):\n${ctx.visibleText.slice(0, 2000)}` : ''}

Be direct and specific. Reference actual on-page content when possible. Do not use filler openers.`;
}

async function executeOnPage(skillId, params) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_SKILL', skillId, params });
  } catch (e) {
    return { result: { error: e.message } };
  }
}

function addMessage(role, text) {
  const messages = document.getElementById('chatMessages');
  const welcome = messages.querySelector('.flux-welcome');
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
    .replace(/>/g, '&gt;');
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

function bindMessagesListener() {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SELECTED_TEXT') {
      selectedText = msg.text;
      const bar = document.getElementById('selectedTextBar');
      const preview = document.getElementById('selectedTextPreview');
      if (msg.text) {
        bar.style.display = 'flex';
        preview.textContent = msg.text.slice(0, 80) + (msg.text.length > 80 ? '...' : '');
      } else {
        bar.style.display = 'none';
      }
    }
    if (msg.type === 'CONTEXT_MENU_ACTION') {
      const bar = document.getElementById('selectedTextBar');
      const preview = document.getElementById('selectedTextPreview');
      const t = (msg.selectionText || '').trim();
      if (msg.menuItemId === 'flux-ask' && t) {
        selectedText = t;
        bar.style.display = 'flex';
        preview.textContent = t.slice(0, 80) + (t.length > 80 ? '...' : '');
        input.value = `About this selection: ${t}\n\n`;
        input.focus();
      }
      if (msg.menuItemId === 'flux-add-task' && t) {
        input.value = `Create a Flux task from this: ${t}`;
        input.focus();
      }
    }
  });
}

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener('click', handleSend);

async function handleSend() {
  let text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  addMessage('user', text);
  await sendToAI(text);
}

document.getElementById('clearSelectionBtn').addEventListener('click', () => {
  selectedText = null;
  document.getElementById('selectedTextBar').style.display = 'none';
});

document.getElementById('refreshContextBtn').addEventListener('click', refreshPageContext);

const skillsToggleBtn = document.getElementById('skillsToggleBtn');
const sidebarSkillsPanel = document.getElementById('sidebarSkillsPanel');
if (skillsToggleBtn && sidebarSkillsPanel) {
  skillsToggleBtn.addEventListener('click', () => {
    const on = sidebarSkillsPanel.style.display !== 'none';
    sidebarSkillsPanel.style.display = on ? 'none' : 'block';
    input.focus();
  });
}

bindMessagesListener();
refreshPageContext();

chrome.tabs.onActivated.addListener(refreshPageContext);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') refreshPageContext();
});
