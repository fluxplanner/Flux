// flux-extension/content.js — page context + skill execution (minimal DOM writes except transient highlights)
(function () {
  'use strict';
  if (globalThis.__FLUX_PLANNER_CONTENT_SCRIPT_V1__) return;
  globalThis.__FLUX_PLANNER_CONTENT_SCRIPT_V1__ = true;

const FluxPageContext = {
  extract() {
    return {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      timestamp: new Date().toISOString(),
      pageType: this.detectPageType(),
      selectedText: window.getSelection()?.toString().trim() || null,
      visibleText: this.getVisibleText(),
      headings: this.getHeadings(),
      links: this.getImportantLinks(),
      forms: this.getForms(),
      tables: this.getTables(),
      emails: this.getEmailContext(),
      googleDocs: this.getGoogleDocsContext(),
      canvas: this.getCanvasContext(),
      assignments: this.getAssignmentContext(),
      metadata: this.getMetadata(),
    };
  },

  detectPageType() {
    const url = window.location.href;
    const host = window.location.hostname;
    if (host.includes('deltamath.com')) return 'deltamath';
    if (url.includes('docs.google.com/document')) return 'google-docs';
    if (url.includes('docs.google.com/spreadsheets')) return 'google-sheets';
    if (url.includes('docs.google.com/presentation')) return 'google-slides';
    if (url.includes('mail.google.com')) return 'gmail';
    if (url.includes('calendar.google.com')) return 'google-calendar';
    if (url.includes('classroom.google.com')) return 'google-classroom';
    if (url.includes('instructure.com') || url.includes('canvas')) return 'canvas-lms';
    if (url.includes('youtube.com')) return 'youtube';
    if (document.querySelector('article, .article, [role="article"]')) return 'article';
    if (document.querySelector('form')) return 'form';
    return 'webpage';
  },

  /** DeltaMath / Desmos-style SPAs: Angular app-root + problem; heavy JS; short per-node text. */
  getVisibleText() {
    const max = 14000;
    const chunks = [];

    const pushChunk = (raw) => {
      const t = String(raw || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t\f\v]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (t.length < 4) return;
      if (!chunks.some((ex) => ex === t || (t.length < ex.length && ex.includes(t)) || (ex.length < t.length && t.includes(ex)))) {
        chunks.push(t);
      }
    };

    const selRoots = [
      'app-root',
      'student',
      'problem',
      'main',
      '[role="main"]',
      '#root',
      '#app',
      '.main.container',
      '[class*="problem"]',
      '[class*="Problem"]',
      '[class*="question"]',
      '[data-testid*="problem"]',
    ];
    for (const q of selRoots) {
      try {
        const el = document.querySelector(q);
        if (el) pushChunk(el.innerText);
      } catch (_) {}
    }

    try {
      if (document.body) pushChunk(document.body.innerText);
    } catch (_) {}

    try {
      document.querySelectorAll('*').forEach((el) => {
        if (!el.shadowRoot) return;
        try {
          pushChunk(el.shadowRoot.innerText);
        } catch (_) {}
      });
    } catch (_) {}

    try {
      document.querySelectorAll('iframe').forEach((frame) => {
        try {
          const doc = frame.contentDocument;
          if (doc?.body) pushChunk(doc.body.innerText);
        } catch (_) {}
      });
    } catch (_) {}

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        const tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return NodeFilter.FILTER_REJECT;
        }
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -400 || rect.top > window.innerHeight * 5) {
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let wText = '';
    let node;
    while ((node = walker.nextNode()) && wText.length < 6000) {
      const t = node.textContent.trim();
      if (t.length > 0) wText += t + ' ';
    }
    pushChunk(wText);

    chunks.sort((a, b) => b.length - a.length);
    let out = '';
    for (const c of chunks) {
      if (out.includes(c.slice(0, Math.min(100, c.length)))) continue;
      out += (out ? '\n\n—\n\n' : '') + c;
      if (out.length >= max) break;
    }
    return out.slice(0, max);
  },

  getHeadings() {
    return [...document.querySelectorAll('h1, h2, h3')]
      .slice(0, 10)
      .map((h) => ({ level: h.tagName, text: h.textContent.trim().slice(0, 200) }));
  },

  getImportantLinks() {
    return [...document.querySelectorAll('a[href]')]
      .filter((a) => {
        const text = a.textContent.trim();
        return text.length > 3 && text.length < 100 && !a.href.includes('#');
      })
      .slice(0, 15)
      .map((a) => ({ text: a.textContent.trim(), href: a.href }));
  },

  getForms() {
    return [...document.querySelectorAll('form')].slice(0, 3).map((form) => ({
      action: form.action,
      fields: [...form.querySelectorAll('input, textarea, select')]
        .map((f) => ({
          type: f.type,
          name: f.name,
          placeholder: f.placeholder,
          label: f.labels?.[0]?.textContent?.trim(),
        }))
        .filter((f) => f.name || f.placeholder || f.label),
    }));
  },

  getTables() {
    return [...document.querySelectorAll('table')].slice(0, 3).map((table) => {
      const headers = [...table.querySelectorAll('th')].map((th) => th.textContent.trim()).slice(0, 8);
      const rows = [...table.querySelectorAll('tbody tr')]
        .slice(0, 5)
        .map((row) => [...row.querySelectorAll('td')].map((td) => td.textContent.trim().slice(0, 100)));
      return { headers, rows };
    });
  },

  getEmailContext() {
    if (!window.location.href.includes('mail.google.com')) return null;
    const subject = document.querySelector('h2[data-legacy-thread-id], .hP')?.textContent?.trim();
    const body = document.querySelector('.a3s, [data-message-id]')?.textContent?.trim().slice(0, 2000);
    const sender = document.querySelector('.gD')?.getAttribute('email');
    const isCompose = !!document.querySelector('.T-I.J-J5-Ji.ao2.T-I-atl.L3');
    return { subject, body, sender, isCompose };
  },

  getGoogleDocsContext() {
    if (!window.location.href.includes('docs.google.com/document')) return null;
    const title = document.querySelector('.docs-title-input')?.value || document.title;
    const paragraphs = [...document.querySelectorAll('.kix-paragraphrenderer')]
      .slice(0, 20)
      .map((p) => p.textContent.trim())
      .filter((t) => t.length > 0);
    const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
    return { title, wordCount, paragraphs: paragraphs.join('\n').slice(0, 3000) };
  },

  getCanvasContext() {
    if (!window.location.href.includes('instructure.com')) return null;
    const assignmentTitle = document.querySelector('.assignment_title, h1.title')?.textContent?.trim();
    const dueDate = document.querySelector('.due_date_display, .assignment-due-date')?.textContent?.trim();
    const points = document.querySelector('.points_possible')?.textContent?.trim();
    const description = document
      .querySelector('.description, .assignment_description')
      ?.textContent?.trim()
      .slice(0, 2000);
    return { assignmentTitle, dueDate, points, description };
  },

  getAssignmentContext() {
    const keywords = ['due', 'submit', 'assignment', 'homework', 'quiz', 'exam', 'essay', 'project'];
    const bodyText = document.body.textContent.toLowerCase();
    const isAssignment = keywords.some((k) => bodyText.includes(k));
    if (!isAssignment) return null;
    const dueDates = [...document.body.querySelectorAll('*')]
      .filter((el) => /due|deadline/i.test(el.textContent) && el.textContent.trim().length < 100)
      .slice(0, 3)
      .map((el) => el.textContent.trim());
    return { isAssignment, dueDates };
  },

  getMetadata() {
    return {
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      ogDescription: document.querySelector('meta[property="og:description"]')?.content,
      articlePublished: document.querySelector('meta[property="article:published_time"]')?.content,
    };
  },
};

const FluxSkillExecutor = {
  async run(skillId, params) {
    switch (skillId) {
      case 'google-docs-type':
        return this.googleDocsType(params.text, params.slow);
      case 'google-docs-select-all':
        return this.googleDocsSelectAll();
      case 'google-docs-replace':
        return this.googleDocsReplace(params.find, params.replace);
      case 'gmail-compose':
        return this.gmailCompose(params);
      case 'gmail-reply':
        return this.gmailReply(params);
      case 'scroll-to':
        return this.scrollTo(params.selector);
      case 'click':
        return this.clickElement(params.selector);
      case 'fill-form':
        return this.fillForm(params.fields);
      default:
        return { error: 'Unknown skill: ' + skillId };
    }
  },

  async googleDocsType(text, slow = false) {
    const editor = document.querySelector('.kix-appview-editor');
    if (!editor) return { error: 'Not in Google Docs' };
    editor.focus();
    editor.click();
    const insert = document.execCommand.bind(document);
    if (slow) {
      for (const char of String(text || '')) {
        insert('insertText', false, char);
        await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
      }
    } else {
      insert('insertText', false, text);
    }
    return { ok: true, charsTyped: String(text || '').length };
  },

  async googleDocsSelectAll() {
    document.execCommand('selectAll');
    return { ok: true };
  },

  async googleDocsReplace(find, replace) {
    const editor = document.querySelector('.kix-appview-editor');
    if (!editor) return { error: 'Not in Google Docs' };
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const findInput = document.querySelector('.docs-findinput-query input');
    const replaceInput = document.querySelector('.docs-findinput-replacement input');
    if (findInput) {
      findInput.value = find;
      findInput.dispatchEvent(new Event('input'));
    }
    if (replaceInput) {
      replaceInput.value = replace;
      replaceInput.dispatchEvent(new Event('input'));
    }
    return { ok: true };
  },

  async gmailCompose({ to, subject, body }) {
    const composeBtn = document.querySelector('[data-tooltip="Compose"], .T-I.J-J5-Ji.z0.NIcon.T-I-atl.L3');
    if (composeBtn) composeBtn.click();
    await new Promise((r) => setTimeout(r, 800));

    if (to) {
      const toField = document.querySelector('input[name="to"], .agP input');
      if (toField) {
        toField.value = to;
        toField.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if (subject) {
      const subjectField = document.querySelector('input[name="subjectbox"], input[placeholder="Subject"]');
      if (subjectField) {
        subjectField.value = subject;
        subjectField.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if (body) {
      await new Promise((r) => setTimeout(r, 300));
      const bodyField = document.querySelector('[role="textbox"][aria-label*="Message Body"], .Am.Al.editable');
      if (bodyField) {
        bodyField.focus();
        document.execCommand('insertText', false, body);
      }
    }
    return { ok: true };
  },

  async gmailReply({ body }) {
    const replyBtn = document.querySelector('[data-tooltip="Reply"], .ams.bkH span[data-tooltip="Reply"]');
    if (replyBtn) replyBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    const bodyField = document.querySelector('[role="textbox"][aria-label*="Message Body"], .Am.Al.editable');
    if (bodyField && body) {
      bodyField.focus();
      document.execCommand('insertText', false, body);
    }
    return { ok: true };
  },

  async scrollTo(selector) {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return { ok: !!el };
  },

  async clickElement(selector) {
    const el = document.querySelector(selector);
    if (el) el.click();
    return { ok: !!el };
  },

  async fillForm(fields) {
    let filled = 0;
    for (const [selector, value] of Object.entries(fields || {})) {
      const el = document.querySelector(selector);
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    }
    return { ok: true, filled };
  },
};

FluxPageContext.highlightText = function (searchText) {
  if (!searchText) return;
  try {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.includes(searchText)) continue;
      const span = document.createElement('mark');
      span.style.cssText =
        'background: rgba(0,191,255,0.3); border-radius: 2px; transition: background 0.3s;';
      try {
        const range = document.createRange();
        const idx = node.textContent.indexOf(searchText);
        range.setStart(node, idx);
        range.setEnd(node, idx + searchText.length);
        range.surroundContents(span);
      } catch (_) {
        continue;
      }
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        try {
          if (span.parentNode) span.replaceWith(document.createTextNode(span.textContent));
        } catch (_) {}
      }, 3000);
      break;
    }
  } catch (_) {}
};

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type === 'CONTEXT_MENU_ACTION') {
    try {
      chrome.runtime.sendMessage(msg);
    } catch (_) {}
    respond({ ok: true });
    return;
  }
  if (msg.type === 'GET_PAGE_CONTEXT') {
    respond({ context: FluxPageContext.extract() });
    return;
  }
  if (msg.type === 'EXECUTE_SKILL') {
    FluxSkillExecutor.run(msg.skillId, msg.params || {})
      .then((result) => respond({ result }))
      .catch((e) => respond({ result: { error: String(e.message || e) } }));
    return true;
  }
  if (msg.type === 'HIGHLIGHT_TEXT') {
    FluxPageContext.highlightText(msg.text);
    respond({ ok: true });
    return;
  }
});

let _selTimer = null;
document.addEventListener(
  'selectionchange',
  () => {
    clearTimeout(_selTimer);
    _selTimer = setTimeout(() => {
      try {
        const t = window.getSelection()?.toString().trim() || '';
        chrome.runtime.sendMessage({ type: 'SELECTED_TEXT', text: t }).catch(() => {});
      } catch (_) {}
    }, 120);
  },
  { passive: true }
);
})();
