// flux-extension/content.js — auto page context + SPA/DOM watching + skills
(function () {
  'use strict';
  if (globalThis.__FLUX_PLANNER_CONTENT_SCRIPT_V2__) return;
  globalThis.__FLUX_PLANNER_CONTENT_SCRIPT_V2__ = true;

  const FluxAutoContext = {
    _lastUrl: '',
    _lastSentAt: 0,
    _debounceTimer: null,
    _observer: null,
    _domDebounceTimer: null,
    _MIN_INTERVAL_MS: 2000,

    init() {
      try {
        const isArc =
          !!globalThis.window?.arc ||
          !!document.documentElement?.getAttribute?.('data-arc-browsing-context') ||
          /Arc\//i.test(navigator.userAgent || '');
        chrome.runtime.sendMessage({ type: 'DETECT_ARC', isArc }).catch(() => {});
      } catch (_) {}

      this.sendContext('page_load');
      this.watchNavigation();
      this.watchDOMChanges();
      this.watchSelection();

      chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
        if (msg.type === 'GET_PAGE_CONTEXT') {
          respond({ context: this.extract() });
          return;
        }
        if (msg.type === 'EXECUTE_SKILL') {
          FluxSkillExecutor.run(msg.skillId, msg.params || {})
            .then((result) => respond({ result }))
            .catch((e) => respond({ result: { error: String(e.message || e) } }));
          return true;
        }
        if (msg.type === 'EXECUTE_ACTION') {
          FluxActionEngine.execute(msg.action || {})
            .then((result) => respond({ result }))
            .catch((e) => respond({ result: { error: String(e.message || e) } }));
          return true;
        }
        if (msg.type === 'GET_VERIFICATION_CONTEXT') {
          respond({ context: FluxActionEngine.getVerificationContext() });
          return;
        }
        if (msg.type === 'HIGHLIGHT_TEXT') {
          this.highlightText(msg.text);
          respond({ ok: true });
        }
      });
    },

    watchNavigation() {
      let lastHref = location.href;
      const self = this;
      const checkUrl = () => {
        if (location.href !== lastHref) {
          lastHref = location.href;
          setTimeout(() => self.sendContext('navigation'), 800);
        }
      };
      const origPush = history.pushState.bind(history);
      const origReplace = history.replaceState.bind(history);
      history.pushState = (...args) => {
        origPush(...args);
        checkUrl();
      };
      history.replaceState = (...args) => {
        origReplace(...args);
        checkUrl();
      };
      window.addEventListener('popstate', () => setTimeout(() => self.sendContext('popstate'), 500));
      window.addEventListener('hashchange', () => setTimeout(() => self.sendContext('hashchange'), 300));
      setInterval(checkUrl, 1500);
    },

    watchDOMChanges() {
      const self = this;
      this._observer = new MutationObserver((mutations) => {
        const significant = mutations.some(
          (m) =>
            m.addedNodes.length > 3 ||
            m.type === 'childList',
        );
        if (!significant) return;
        clearTimeout(self._domDebounceTimer);
        self._domDebounceTimer = setTimeout(() => {
          self.sendContext('dom_change', { silent: true });
        }, 1500);
      });
      if (document.body) {
        this._observer.observe(document.body, { childList: true, subtree: true });
      }
    },

    watchSelection() {
      let selectionTimer = null;
      const ping = () => {
        clearTimeout(selectionTimer);
        selectionTimer = setTimeout(() => {
          const sel = window.getSelection()?.toString().trim();
          if (sel && sel.length > 10) {
            chrome.runtime
              .sendMessage({ type: 'SELECTED_TEXT', text: sel, url: location.href })
              .catch(() => {});
          }
        }, 300);
      };
      document.addEventListener('mouseup', ping, { passive: true });
      document.addEventListener('selectionchange', ping, { passive: true });
    },

    sendContext(trigger = 'unknown', opts = {}) {
      const now = Date.now();
      if (trigger === 'dom_change' && now - this._lastSentAt < this._MIN_INTERVAL_MS) return;
      this._lastSentAt = now;

      const context = this.extract();
      context._trigger = trigger;
      context._silent = !!opts.silent;

      chrome.runtime.sendMessage({ type: 'PAGE_CONTEXT_UPDATE', context }).catch(() => {});
      chrome.storage.session.set({ lastPageContext: context, lastContextAt: now }).catch(() => {});
    },

    extract() {
      const rawVisible = this.getVisibleText();
      const ctx = {
        url: location.href,
        domain: location.hostname,
        title: document.title,
        timestamp: new Date().toISOString(),
        pageType: this.detectPageType(),
        selectedText: window.getSelection()?.toString().trim() || null,
        visibleText: this.scrubPII(rawVisible),
        headings: this.getHeadings(),
        metadata: this.getMetadata(),
        semanticSnapshot: this.buildSemanticSnapshot(),
        links: this.getImportantLinks(),
        tables: this.getTables(),
        forms: this.getForms(),
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        canScroll: document.documentElement.scrollHeight > window.innerHeight,
      };

      const type = ctx.pageType;
      if (type === 'google-docs') ctx.googleDocs = this.getGoogleDocsContext();
      if (type === 'gmail') ctx.email = this.getEmailContext();
      if (type === 'canvas-lms' || type === 'canvas-assignment') ctx.canvas = this.getCanvasContext();
      if (type === 'canvas-quiz') {
        ctx.canvas = this.getCanvasContext();
        ctx.quiz = this.getQuizContext();
      }
      if (type === 'youtube') ctx.youtube = this.getYouTubeContext();
      if (type === 'google-classroom') ctx.classroom = this.getClassroomContext();

      return ctx;
    },

    /**
     * Strip obvious PII (emails, card numbers, SSNs, password lines) before any text leaves the page.
     * Always run on visible text + raw labels before the AI sees them.
     */
    scrubPII(text) {
      if (!text) return text;
      return String(text)
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD_REDACTED]')
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
        .replace(/\b(?:password|passwd|pwd)\s*[:=]\s*\S+/gi, 'password=[REDACTED]');
    },

    /**
     * Walk visible interactive + content elements, tag each with a stable
     * `data-flux-id`, and return a list the AI can target with click/type actions.
     */
    extractAccessibilityTree() {
      const elements = [];
      let idCounter = 1;
      const selector = [
        'button', 'a[href]', 'input:not([type="hidden"])', 'textarea',
        'select', '[role]', 'label', 'h1', 'h2', 'h3',
        '[tabindex]', '.question', '[class*="question"]',
        '[class*="answer"]', '[class*="submit"]',
      ].join(', ');

      const seen = new WeakSet();
      document.querySelectorAll(selector).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (!el.offsetParent && el.tagName !== 'BODY') return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const tag = el.tagName.toLowerCase();
        let role = el.getAttribute('role');
        if (!role) {
          if (tag === 'button') role = 'button';
          else if (tag === 'a') role = 'link';
          else if (tag === 'input') role = el.type === 'checkbox' || el.type === 'radio' ? el.type : (el.type || 'textbox');
          else if (tag === 'textarea') role = 'textbox';
          else if (tag === 'select') role = 'combobox';
          else role = tag;
        }

        const labelFromAria = el.getAttribute('aria-label');
        const labelFromPlaceholder = el.getAttribute('placeholder');
        const labelFromTitle = el.getAttribute('title');
        let labelFromFor = '';
        if (el.id) {
          try {
            labelFromFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim() || '';
          } catch (_) {}
        }
        const label =
          labelFromAria ||
          labelFromPlaceholder ||
          labelFromTitle ||
          labelFromFor ||
          (el.textContent?.trim() || '').slice(0, 100);

        const id = `flux_el_${idCounter++}`;
        try { el.dataset.fluxId = id; } catch (_) {}

        elements.push({
          id,
          tag,
          role,
          label: this.scrubPII(label),
          type: el.type || null,
          value: tag === 'input' || tag === 'textarea' ? this.scrubPII(el.value || '') : null,
          checked: el.type === 'radio' || el.type === 'checkbox' ? !!el.checked : null,
          disabled: !!el.disabled,
          visible: rect.top >= -100 && rect.bottom <= window.innerHeight + 100,
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          href: el.href || null,
          name: el.name || el.id || null,
        });
      });

      return elements;
    },

    /**
     * Token-optimized snapshot: just the bits the AI needs to plan an action.
     * Used by the vision loop alongside a viewport screenshot.
     */
    buildSemanticSnapshot() {
      const elements = this.extractAccessibilityTree();
      const visibleElements = elements.filter((e) => e.visible);
      const interactiveRoles = new Set([
        'button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'tab',
        'searchbox', 'listbox', 'menuitem', 'switch', 'option', 'treeitem',
      ]);

      return {
        url: location.href,
        title: document.title,
        pageType: this.detectPageType(),
        interactive: visibleElements
          .filter((e) => interactiveRoles.has(e.role))
          .slice(0, 80)
          .map((e) => ({
            id: e.id,
            role: e.role,
            label: e.label.slice(0, 80),
            value: e.value ? e.value.slice(0, 50) : null,
            checked: e.checked,
            disabled: e.disabled,
            pos: `${e.x},${e.y}`,
          })),
        content: visibleElements
          .filter(
            (e) =>
              ['h1', 'h2', 'h3', 'p', 'span', 'div', 'td', 'li'].includes(e.tag) &&
              e.label.length > 10,
          )
          .slice(0, 80)
          .map((e) => ({ tag: e.tag, text: e.label.slice(0, 150) })),
        allElements: elements.slice(0, 200).map((e) => ({
          id: e.id,
          role: e.role,
          label: e.label.slice(0, 60),
          pos: `${e.x},${e.y}`,
        })),
      };
    },

    detectPageType() {
      const url = location.href;
      const host = location.hostname;
      if (host.includes('deltamath.com')) return 'deltamath';
      if (url.includes('docs.google.com/document')) return 'google-docs';
      if (url.includes('docs.google.com/spreadsheets')) return 'google-sheets';
      if (url.includes('docs.google.com/presentation')) return 'google-slides';
      if (url.includes('mail.google.com')) return 'gmail';
      if (url.includes('calendar.google.com')) return 'google-calendar';
      if (url.includes('classroom.google.com')) return 'google-classroom';
      if (url.includes('youtube.com/watch')) return 'youtube';
      if (url.includes('instructure.com')) {
        if (url.includes('/quizzes/')) return 'canvas-quiz';
        if (url.includes('/assignments/')) return 'canvas-assignment';
        return 'canvas-lms';
      }
      if (url.includes('khanacademy.org')) return 'khan-academy';
      if (url.includes('chegg.com') || url.includes('quizlet.com')) return 'study-tool';
      if (document.querySelector('article, .article, [role="article"]')) return 'article';
      return 'webpage';
    },

    getVisibleText() {
      const max = 8000;
      const elements = [
        ...document.querySelectorAll(
          'p, h1, h2, h3, h4, li, td, th, label, .question, .question-text, [class*="question"], [class*="quiz"], span, div',
        ),
      ];
      let text = '';
      const seen = new Set();
      for (const el of elements) {
        const t = el.textContent?.trim();
        if (!t || t.length < 10 || seen.has(t)) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const directText = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join(' ');
        if (directText.length > 5) {
          seen.add(t);
          text += t + '\n';
          if (text.length > max) break;
        }
      }
      let out = text.slice(0, max).trim();
      if (out.length < 400 && document.body) {
        try {
          const extra = document.body.innerText?.trim().slice(0, max);
          if (extra && extra.length > out.length) out = extra.slice(0, max);
        } catch (_) {}
      }
      try {
        document.querySelectorAll('*').forEach((el) => {
          if (!el.shadowRoot || out.length >= max) return;
          try {
            const st = el.shadowRoot.innerText?.trim();
            if (st && st.length > 20) out += '\n' + st.slice(0, Math.min(2000, max - out.length));
          } catch (_) {}
        });
      } catch (_) {}
      return out.slice(0, max);
    },

    getHeadings() {
      return [...document.querySelectorAll('h1, h2, h3')]
        .slice(0, 15)
        .map((h) => ({ level: h.tagName, text: h.textContent.trim().slice(0, 300) }))
        .filter((h) => h.text.length > 2);
    },

    getImportantLinks() {
      return [...document.querySelectorAll('a[href]')]
        .filter((a) => {
          const t = a.textContent.trim();
          return t.length > 3 && t.length < 120 && !a.href.includes('#') && a.offsetParent !== null;
        })
        .slice(0, 20)
        .map((a) => ({ text: a.textContent.trim(), href: a.href }));
    },

    getForms() {
      return [...document.querySelectorAll('form')].slice(0, 5).map((form) => ({
        action: form.action,
        fields: [...form.querySelectorAll('input, textarea, select')]
          .filter((f) => f.type !== 'hidden')
          .map((f) => ({
            type: f.type,
            name: f.name || f.id,
            placeholder: f.placeholder,
            value: f.type === 'password' ? '[hidden]' : f.value,
            label: f.id
              ? document.querySelector(`label[for="${CSS.escape(f.id)}"]`)?.textContent?.trim()
              : f.labels?.[0]?.textContent?.trim(),
          })),
      }));
    },

    getTables() {
      return [...document.querySelectorAll('table')].slice(0, 5).map((table) => {
        const headers = [...table.querySelectorAll('th')].map((th) => th.textContent.trim()).slice(0, 10);
        const rows = [...table.querySelectorAll('tbody tr')]
          .slice(0, 10)
          .map((row) => [...row.querySelectorAll('td')].map((td) => td.textContent.trim().slice(0, 200)));
        return { headers, rows };
      });
    },

    getQuizContext() {
      const questions = [];
      const questionEls = document.querySelectorAll(
        '.question, [id^="question_"], .question_holder, .display_question',
      );
      questionEls.forEach((qEl, i) => {
        const qNum = i + 1;
        const qTextEl = qEl.querySelector(
          '.question_text, .header, [class*="question-text"], h3, .quiz_question',
        );
        const qText =
          qTextEl?.textContent?.trim() || qEl.querySelector('p, .stem')?.textContent?.trim() || '';
        const choices = [...qEl.querySelectorAll('.answer, .answer_for_blank, li.answer, [class*="answer-option"]')]
          .map((a) => ({
            text:
              a.querySelector('label, .answer_text, span')?.textContent?.trim() || a.textContent.trim(),
            input: a.querySelector('input'),
            id: a.querySelector('input')?.id || a.dataset.id,
          }))
          .filter((a) => a.text.length > 0);
        const textInput = qEl.querySelector('input[type="text"], textarea, input[type="number"]');
        const selectedChoice = qEl.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
        const points = qEl.querySelector('.points, [class*="point"], .question_points')?.textContent?.trim();
        questions.push({
          number: qNum,
          text: qText.slice(0, 1000),
          type:
            choices.length > 0
              ? qEl.querySelector('input[type="checkbox"]')
                ? 'multiple_select'
                : 'multiple_choice'
              : 'free_response',
          choices: choices.slice(0, 8),
          currentAnswer: textInput?.value || selectedChoice?.value || null,
          points,
          answered: !!(textInput?.value || selectedChoice),
          element_id: qEl.id,
        });
      });
      const quizTitle = document.querySelector('.quiz-title, h1, .title')?.textContent?.trim();
      const timeRemaining = document.querySelector('#time_running, .time_running, [class*="time"]')?.textContent?.trim();
      const questionCount = document.querySelector('.question_count, #quiz_points_possible')?.textContent?.trim();
      return {
        title: quizTitle,
        timeRemaining,
        questionCount,
        totalQuestions: questions.length,
        questions,
        url: location.href,
      };
    },

    getCanvasContext() {
      const assignmentTitle = document.querySelector('.assignment_title, h1.title, h1, .item-title')?.textContent?.trim();
      const dueDate = document.querySelector('.due_date_display, .assignment-due-date, [class*="due"]')?.textContent?.trim();
      const points = document.querySelector('.points_possible, [class*="points"]')?.textContent?.trim();
      const description = document
        .querySelector('.description, .assignment_description, .show-content')
        ?.textContent?.trim()
        .slice(0, 3000);
      const rubric = [...document.querySelectorAll('.rubric_criterion')].slice(0, 10).map((r) => ({
        description: r.querySelector('.description_title')?.textContent?.trim(),
        points: r.querySelector('.points')?.textContent?.trim(),
      }));
      return { assignmentTitle, dueDate, points, description, rubric };
    },

    getGoogleDocsContext() {
      const title = document.querySelector('.docs-title-input')?.value || document.title;
      const paragraphs = [...document.querySelectorAll('.kix-paragraphrenderer')]
        .map((p) => p.textContent.trim())
        .filter((t) => t.length > 0)
        .slice(0, 50);
      const fullText = paragraphs.join('\n');
      return {
        title,
        wordCount: fullText.split(/\s+/).filter(Boolean).length,
        paragraphs: fullText.slice(0, 5000),
        characterCount: fullText.length,
      };
    },

    getEmailContext() {
      const subject = document.querySelector('h2[data-legacy-thread-id], .hP, .ha h2')?.textContent?.trim();
      const body = document
        .querySelector('.a3s.aiL, .a3s, [data-message-id] .ii.gt div')
        ?.textContent?.trim()
        .slice(0, 3000);
      const sender =
        document.querySelector('.gD')?.getAttribute('email') ||
        document.querySelector('.from .go')?.textContent?.trim();
      const isCompose = !!document.querySelector('.compose-container, [role="dialog"][aria-label*="compose"]');
      const emailList = !subject;
      const recentEmails = emailList
        ? [...document.querySelectorAll('.zA')].slice(0, 10).map((row) => ({
            sender: row.querySelector('.yX, .zF')?.textContent?.trim(),
            subject: row.querySelector('.y6 span:not(.T3)')?.textContent?.trim(),
            preview: row.querySelector('.y2')?.textContent?.trim(),
            unread: row.classList.contains('zE'),
          }))
        : null;
      return { subject, body, sender, isCompose, emailList, recentEmails };
    },

    getYouTubeContext() {
      const title = document
        .querySelector('h1.ytd-video-primary-info-renderer, .title.style-scope.ytd-video-primary-info-renderer')
        ?.textContent?.trim();
      const channel = document.querySelector('#channel-name, .ytd-channel-name a')?.textContent?.trim();
      const description = document
        .querySelector('#description-inline-expander, #description yt-formatted-string')
        ?.textContent?.trim()
        .slice(0, 1000);
      const transcript = [...document.querySelectorAll('.segment-text, ytd-transcript-segment-renderer .segment-text')]
        .map((el) => el.textContent.trim())
        .filter((t) => t.length > 0)
        .slice(0, 100)
        .join(' ')
        .slice(0, 3000);
      return { title, channel, description, transcript: transcript || null };
    },

    getClassroomContext() {
      const assignments = [...document.querySelectorAll('.EjDnib, [data-assignment-id]')].slice(0, 10).map((a) => ({
        title: a.querySelector('.YVvGBb, h2')?.textContent?.trim(),
        due: a.querySelector('.K3BMXe, [class*="due"]')?.textContent?.trim(),
        status: a.querySelector('.sW8e5, [class*="status"]')?.textContent?.trim(),
      }));
      return { assignments };
    },

    getMetadata() {
      return {
        ogTitle: document.querySelector('meta[property="og:title"]')?.content,
        ogDescription: document.querySelector('meta[property="og:description"]')?.content,
        articlePublished: document.querySelector('meta[property="article:published_time"]')?.content,
        keywords: document.querySelector('meta[name="keywords"]')?.content,
      };
    },

    highlightText(searchText) {
      if (!searchText || searchText.length < 3) return;
      const needle = searchText.slice(0, 80);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.includes(needle.slice(0, Math.min(30, needle.length)))) continue;
        try {
          const span = document.createElement('mark');
          span.style.cssText =
            'background:rgba(0,191,255,0.35);border-radius:3px;padding:0 2px;transition:background 0.5s;';
          span.className = 'flux-highlight';
          const range = document.createRange();
          const idx = node.textContent.indexOf(needle.slice(0, 30));
          if (idx < 0) continue;
          range.setStart(node, idx);
          range.setEnd(node, Math.min(node.textContent.length, idx + Math.min(needle.length, 120)));
          range.surroundContents(span);
          span.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            try {
              if (span.parentNode) span.replaceWith(document.createTextNode(span.textContent));
            } catch (_) {}
          }, 4000);
          break;
        } catch (_) {
          continue;
        }
      }
    },
  };

  const FluxSkillExecutor = {
    async run(skillId, params) {
      const map = {
        'google-docs-type': () => this.googleDocsType(params.text, params.slow),
        'google-docs-select-all': async () => {
          document.execCommand('selectAll');
          return { ok: true };
        },
        'google-docs-replace': () => this.googleDocsReplace(params.find, params.replace),
        'gmail-compose': () => this.gmailCompose(params),
        'gmail-reply': () => this.gmailReply(params),
        'canvas-fill-answer': () => this.canvasFillAnswer(params),
        'canvas-fill-all-answers': () => this.canvasFillAllAnswers(params),
        click: () => {
          document.querySelector(params.selector)?.click();
          return { ok: true };
        },
        'fill-form': () => this.fillForm(params.fields),
        'scroll-to': () => this.scrollToSelector(params.selector),
        'scroll-to-question': () => this.scrollToQuestion(params.number),
      };
      const fn = map[skillId];
      if (!fn) return { error: 'Unknown skill: ' + skillId };
      return fn.call(this);
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
          await new Promise((r) => setTimeout(r, 35 + Math.random() * 50));
        }
      } else {
        insert('insertText', false, text);
      }
      return { ok: true, charsTyped: String(text || '').length };
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
      await new Promise((r) => setTimeout(r, 900));
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
        await new Promise((r) => setTimeout(r, 400));
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
      await new Promise((r) => setTimeout(r, 700));
      const bodyField = document.querySelector('[role="textbox"][aria-label*="Message Body"], .Am.Al.editable');
      if (bodyField && body) {
        bodyField.focus();
        document.execCommand('insertText', false, body);
      }
      return { ok: true };
    },

    async canvasFillAnswer({ questionNumber, answer, answerText }) {
      const questionEls = [...document.querySelectorAll('.question, [id^="question_"], .display_question')];
      const qEl = questionEls[questionNumber - 1];
      if (!qEl) return { error: `Question ${questionNumber} not found on page` };
      const textInput = qEl.querySelector('input[type="text"], textarea, input[type="number"]');
      if (textInput) {
        textInput.focus();
        textInput.value = answer;
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        textInput.dispatchEvent(new Event('change', { bubbles: true }));
        textInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { ok: true, method: 'text_input', value: answer };
      }
      if (answerText) {
        const choices = [...qEl.querySelectorAll('.answer, li.answer, .answer_for_blank')];
        for (const choice of choices) {
          const choiceText = choice.querySelector('label, .answer_text, span')?.textContent?.trim() || '';
          if (choiceText.toLowerCase().includes(String(answerText).toLowerCase().slice(0, 20))) {
            const radio = choice.querySelector('input[type="radio"], input[type="checkbox"]');
            if (radio) {
              radio.click();
              choice.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return { ok: true, method: 'multiple_choice', selected: choiceText };
            }
          }
        }
      }
      return { error: `Could not fill answer for question ${questionNumber}` };
    },

    async canvasFillAllAnswers({ answers }) {
      let filled = 0;
      const failed = [];
      for (const ans of answers || []) {
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
        const result = await this.canvasFillAnswer(ans);
        if (result.ok) filled++;
        else failed.push(`Q${ans.questionNumber}: ${result.error}`);
      }
      return { ok: true, filled, failed, total: (answers || []).length };
    },

    scrollToQuestion(number) {
      const questionEls = [...document.querySelectorAll('.question, [id^="question_"], .display_question')];
      const qEl = questionEls[number - 1];
      if (qEl) qEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { ok: !!qEl };
    },

    scrollToSelector(selector) {
      const el = document.querySelector(selector);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  /**
   * Vision Action Engine — executes AI-generated atomic actions.
   * Driven by sidebar VisionLoop; never auto-runs.
   */
  const FluxActionEngine = {
    _history: [],

    async execute(action) {
      this._history.push({ action, executedAt: Date.now() });
      if (this._history.length > 50) this._history.shift();
      switch (action.type) {
        case 'click': return this.click(action);
        case 'type': return await this.type(action);
        case 'clear': return this.clear(action);
        case 'select': return this.select(action);
        case 'scroll': return this.scroll(action);
        case 'hover': return this.hover(action);
        case 'press_key': return this.pressKey(action);
        case 'fill_canvas_answer': return await this.fillCanvasAnswer(action);
        case 'wait': return new Promise((r) => setTimeout(() => r({ ok: true }), action.ms || 500));
        default: return { error: `Unknown action: ${action.type}` };
      }
    },

    findElement(action) {
      if (action.elementId) {
        try {
          const el = document.querySelector(`[data-flux-id="${CSS.escape(action.elementId)}"]`);
          if (el) return el;
        } catch (_) {}
      }
      if (action.selector) {
        try {
          const el = document.querySelector(action.selector);
          if (el) return el;
        } catch (_) {}
      }
      if (action.x !== undefined && action.y !== undefined) {
        return document.elementFromPoint(action.x, action.y);
      }
      if (action.text) {
        const all = document.querySelectorAll(
          'button, a, input, label, [role="button"], [role="link"], [role="tab"]',
        );
        const needle = String(action.text).toLowerCase();
        for (const el of all) {
          const t = (el.textContent || el.value || '').trim().toLowerCase();
          if (t.includes(needle)) return el;
        }
      }
      return null;
    },

    click(action) {
      const el = this.findElement(action);
      if (!el) return { error: `Element not found for click: ${JSON.stringify(action).slice(0, 120)}` };
      this.flashElement(el);
      try {
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        el.click();
      } catch (e) {
        return { error: `Click failed: ${e.message}` };
      }
      return {
        ok: true,
        clicked: `${el.tagName} "${(el.textContent || '').trim().slice(0, 30)}"`,
      };
    },

    async type(action) {
      const el = this.findElement(action);
      if (!el) return { error: 'Element not found for type' };
      this.flashElement(el);
      el.focus();

      if (action.clear) {
        try {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (_) {}
      }

      if (action.slow) {
        const chars = String(action.text || '').split('');
        for (let i = 0; i < chars.length; i++) {
          document.execCommand('insertText', false, chars[i]);
          await new Promise((r) => setTimeout(r, 40));
        }
        return { ok: true, typed: String(action.text).slice(0, 30) };
      }

      const nativeInputValue = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement?.prototype || {},
        'value',
      )?.set;
      const nativeTextareaValue = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement?.prototype || {},
        'value',
      )?.set;

      try {
        if (el.tagName === 'INPUT' && nativeInputValue) {
          nativeInputValue.call(el, action.text);
        } else if (el.tagName === 'TEXTAREA' && nativeTextareaValue) {
          nativeTextareaValue.call(el, action.text);
        } else {
          el.value = action.text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        return { error: `Type failed: ${e.message}` };
      }
      return { ok: true, typed: String(action.text || '').slice(0, 30) };
    },

    clear(action) {
      const el = this.findElement(action);
      if (!el) return { error: 'Element not found for clear' };
      el.focus();
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return { ok: true };
    },

    select(action) {
      const el = this.findElement(action);
      if (!el) return { error: 'Element not found for select' };
      if (el.tagName === 'SELECT') {
        const target = String(action.value || '').toLowerCase();
        const option = [...el.options].find(
          (o) => o.value === action.value || o.text.toLowerCase().includes(target),
        );
        if (option) {
          el.value = option.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { ok: true, selected: option.text };
        }
      }
      if (el.type === 'radio' || el.type === 'checkbox') {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.click();
        return { ok: true };
      }
      return { error: 'Could not select value' };
    },

    scroll(action) {
      if (action.toBottom) {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      } else if (action.toTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action.toElement && action.selector) {
        try {
          const target = document.querySelector(action.selector);
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_) {}
      } else {
        window.scrollBy({ top: action.y || 300, left: action.x || 0, behavior: 'smooth' });
      }
      return { ok: true };
    },

    hover(action) {
      const el = this.findElement(action);
      if (!el) return { error: 'Element not found for hover' };
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      return { ok: true };
    },

    pressKey(action) {
      const target = document.activeElement || document.body;
      const keyMap = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Space: 32 };
      const keyCode = keyMap[action.key] || (action.key ? action.key.charCodeAt(0) : 13);
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: action.key, keyCode, bubbles: true }),
      );
      target.dispatchEvent(
        new KeyboardEvent('keyup', { key: action.key, keyCode, bubbles: true }),
      );
      return { ok: true };
    },

    async fillCanvasAnswer(action) {
      const qEls = [
        ...document.querySelectorAll('.question, [id^="question_"], .display_question'),
      ];
      const qEl = qEls[action.questionNumber - 1];
      if (!qEl) return { error: `Q${action.questionNumber} not found` };

      const textInput = qEl.querySelector(
        'input[type="text"], textarea, input[type="number"]',
      );
      if (textInput) {
        textInput.focus();
        this.flashElement(textInput);
        await new Promise((r) => setTimeout(r, 200));
        const nativeSet = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;
        if (nativeSet) nativeSet.call(textInput, action.answer);
        else textInput.value = action.answer;
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        textInput.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, method: 'text', value: action.answer };
      }

      if (action.answerText) {
        const choices = [
          ...qEl.querySelectorAll(
            '.answer, li.answer, .answer_for_blank, [class*="choice"]',
          ),
        ];
        const needle = String(action.answerText).toLowerCase().slice(0, 25);
        for (const c of choices) {
          const ct = (
            c.querySelector('label, .answer_text, span')?.textContent || c.textContent
          ).trim();
          if (ct.toLowerCase().includes(needle)) {
            const inp = c.querySelector('input');
            if (inp) {
              this.flashElement(c);
              inp.click();
              await new Promise((r) => setTimeout(r, 100));
              return { ok: true, method: 'choice', selected: ct };
            }
          }
        }
      }

      return { error: `Could not fill Q${action.questionNumber}` };
    },

    flashElement(el) {
      if (!el) return;
      const orig = el.style.outline;
      const origOffset = el.style.outlineOffset;
      try {
        el.style.outline = '2px solid rgba(0,191,255,0.8)';
        el.style.outlineOffset = '2px';
      } catch (_) {}
      setTimeout(() => {
        try {
          el.style.outline = orig;
          el.style.outlineOffset = origOffset;
        } catch (_) {}
      }, 800);
    },

    getVerificationContext() {
      return {
        url: location.href,
        title: document.title,
        visibleText: FluxAutoContext.scrubPII(FluxAutoContext.getVisibleText()).slice(0, 2000),
        alerts: document
          .querySelector('.alert, .error, .success, [role="alert"]')
          ?.textContent?.trim() || null,
        semanticSnapshot: FluxAutoContext.buildSemanticSnapshot(),
      };
    },
  };

  FluxAutoContext.init();
})();
