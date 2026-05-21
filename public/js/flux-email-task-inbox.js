/**
 * P19.1 — Email-to-task staging inbox (approve before adding tasks).
 * Flag: enable_email_task_inbox (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_email_task_inbox';
  const STORE_KEY = 'flux_email_task_inbox_v1';
  const CARD_ID = 'fluxEmailTaskInboxCard';
  const GMAIL_QUERY =
    'in:inbox (due OR deadline OR assignment OR homework OR syllabus OR "due date") newer_than:14d';

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

  function taskList() {
    return typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    const queue = Array.isArray(s.queue) ? s.queue.filter((q) => q && q.id) : [];
    return { queue };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('emailTaskInbox', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    return {
      queue: getStore().queue.filter((q) => q.status === 'pending'),
    };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    const local = getStore();
    const remote = Array.isArray(data.queue) ? data.queue : [];
    const byId = new Map(local.queue.map((q) => [q.id, q]));
    remote.forEach((q) => {
      if (q && q.id && q.status === 'pending') byId.set(q.id, q);
    });
    persistStore({ queue: [...byId.values()] });
    renderCard();
  }

  function pendingQueue() {
    return getStore().queue.filter((q) => q.status === 'pending');
  }

  function parseDueDate(text) {
    const s = String(text || '');
    const iso = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) return iso[0];
    const slash = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (slash) {
      const y = slash[3]
        ? slash[3].length === 2
          ? 2000 + parseInt(slash[3], 10)
          : parseInt(slash[3], 10)
        : new Date().getFullYear();
      const mo = parseInt(slash[1], 10);
      const d = parseInt(slash[2], 10);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    if (typeof window.parseNLTask === 'function') {
      const nl = window.parseNLTask(s);
      if (nl?.date) return nl.date;
    }
    return '';
  }

  function inferType(subject, snippet) {
    const t = `${subject} ${snippet}`.toLowerCase();
    if (/\b(test|exam|quiz)\b/.test(t)) return 'test';
    if (/\b(project|essay|lab)\b/.test(t)) return /\bessay\b/.test(t) ? 'essay' : /\blab\b/.test(t) ? 'lab' : 'project';
    if (/\b(reading|read chapter)\b/.test(t)) return 'reading';
    return 'hw';
  }

  function inferPriority(subject, snippet, due) {
    const t = `${subject} ${snippet}`.toLowerCase();
    if (/\b(urgent|asap|action required)\b/.test(t)) return 'high';
    if (due) {
      const end = new Date(`${due}T23:59:00`);
      const h = (end - Date.now()) / 3600000;
      if (h > 0 && h <= 48) return 'high';
    }
    return 'med';
  }

  function syllabusScore(subject, snippet) {
    const t = `${subject} ${snippet}`.toLowerCase();
    let score = 0;
    if (/\b(due|deadline|assignment|homework|syllabus|submit|turn in)\b/.test(t)) score += 2;
    if (parseDueDate(t)) score += 1;
    if (/\b(class|course|period|teacher|school)\b/.test(t)) score += 1;
    return score;
  }

  function buildQueueItem(opts) {
    const subject = String(opts.subject || '').trim();
    const snippet = String(opts.snippet || '').trim();
    const combined = `${subject}\n${snippet}`;
    const nl = typeof window.parseNLTask === 'function' ? window.parseNLTask(combined) : null;
    const due = parseDueDate(combined) || nl?.date || '';
    const name = (nl?.name && nl.name.length > 3 ? nl.name : subject || snippet.slice(0, 120) || T('eti.untitled')).slice(
      0,
      240,
    );
    return {
      id: opts.id || 'eq_' + Date.now() + Math.floor(Math.random() * 1000),
      status: 'pending',
      subject,
      snippet: snippet.slice(0, 500),
      from: opts.from || '',
      receivedAt: opts.receivedAt || opts.date || '',
      parsedName: name,
      parsedDate: due,
      parsedType: nl?.type || inferType(subject, snippet),
      parsedPriority: nl?.priority || inferPriority(subject, snippet, due),
      parsedEst: nl?.estTime || 30,
      parsedSubject: nl?.subject || '',
      gmailMessageId: opts.gmailMessageId || null,
      createdAt: Date.now(),
    };
  }

  function isDuplicate(item) {
    const store = getStore();
    if (item.gmailMessageId && store.queue.some((q) => q.gmailMessageId === item.gmailMessageId)) return true;
    if (
      store.queue.some(
        (q) =>
          q.status === 'pending' &&
          q.parsedName === item.parsedName &&
          q.parsedDate === item.parsedDate &&
          q.subject === item.subject,
      )
    ) {
      return true;
    }
    return taskList().some((t) => t && item.gmailMessageId && String(t.gmailMessageId) === String(item.gmailMessageId));
  }

  function stageItem(item) {
    if (isDuplicate(item)) return false;
    const store = getStore();
    store.queue.unshift(item);
    persistStore(store);
    return true;
  }

  function pasteAndStage(text) {
    const raw = String(text || '').trim();
    if (!raw) {
      toast(T('eti.paste_empty'), 'warning');
      return 0;
    }
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const subject = lines[0] || '';
    const snippet = lines.slice(1).join('\n') || lines[0] || '';
    const item = buildQueueItem({ subject, snippet, from: T('eti.paste_source') });
    if (stageItem(item)) {
      toast(T('eti.staged_one'), 'success');
      renderCard();
      return 1;
    }
    toast(T('eti.duplicate'), 'info');
    return 0;
  }

  async function scanGmail() {
    if (typeof window.ensureGmailTokenFromSession === 'function') {
      const ok = await window.ensureGmailTokenFromSession();
      if (!ok) {
        toast(T('eti.gmail_needed'), 'warning');
        return 0;
      }
    }
    const token = window.gmailToken || sessionStorage.getItem('flux_gmail_token');
    if (!token) {
      toast(T('eti.gmail_needed'), 'warning');
      return 0;
    }

    let emails = [];
    try {
      if (typeof window.fetchGmailMessages === 'function') {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=${encodeURIComponent(GMAIL_QUERY)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error('Gmail ' + res.status);
        const data = await res.json();
        const messages = data.messages || [];
        emails = await Promise.all(
          messages.map(async (m) => {
            const detail = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            const d = await detail.json();
            const headers = d.payload?.headers || [];
            const get = (name) => headers.find((h) => h.name === name)?.value || '';
            return {
              id: m.id,
              subject: get('Subject'),
              from: get('From'),
              date: get('Date'),
              snippet: d.snippet || '',
            };
          }),
        );
      }
    } catch (e) {
      toast(T('eti.scan_fail'), 'error');
      return 0;
    }

    let n = 0;
    emails.forEach((email) => {
      if (syllabusScore(email.subject, email.snippet) < 2) return;
      const item = buildQueueItem({
        subject: email.subject,
        snippet: email.snippet,
        from: email.from,
        receivedAt: email.date,
        gmailMessageId: email.id,
      });
      if (stageItem(item)) n += 1;
    });
    toast(n ? T('eti.staged_n', { n }) : T('eti.scan_none'), n ? 'success' : 'info');
    renderCard();
    return n;
  }

  function removeItem(id) {
    const store = getStore();
    store.queue = store.queue.filter((q) => q.id !== id);
    persistStore(store);
  }

  function dismissItem(id) {
    removeItem(id);
    renderCard();
    toast(T('eti.dismissed'), 'info');
  }

  function refreshPlanner() {
    save('tasks', taskList());
    try {
      if (typeof window.syncKey === 'function') window.syncKey('tasks', taskList());
    } catch (_) {}
    try {
      if (typeof window.renderStats === 'function') window.renderStats();
    } catch (_) {}
    try {
      if (typeof window.renderTasks === 'function') window.renderTasks();
    } catch (_) {}
    try {
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
    } catch (_) {}
    try {
      if (typeof window.renderCountdown === 'function') window.renderCountdown();
    } catch (_) {}
    try {
      if (typeof window.checkAllPanic === 'function') window.checkAllPanic();
    } catch (_) {}
  }

  function approveItem(id) {
    const item = getStore().queue.find((q) => q.id === id && q.status === 'pending');
    if (!item) return false;
    const task = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: item.parsedName,
      date: item.parsedDate || '',
      subject: item.parsedSubject || '',
      priority: item.parsedPriority || 'med',
      type: item.parsedType || 'hw',
      estTime: item.parsedEst || 30,
      difficulty: 3,
      notes: [`From: ${item.from || '—'}`, item.snippet || ''].filter(Boolean).join('\n'),
      subtasks: [],
      done: false,
      rescheduled: 0,
      createdAt: Date.now(),
      source: 'email_inbox',
      emailInboxId: item.id,
      gmailMessageId: item.gmailMessageId || undefined,
    };
    if (typeof window.calcUrgency === 'function') task.urgencyScore = window.calcUrgency(task);
    taskList().unshift(task);
    removeItem(id);
    renderCard();
    refreshPlanner();
    toast(T('eti.approved', { name: task.name.slice(0, 40) }), 'success');
    return true;
  }

  function bindCard(card) {
    card.querySelector('#fluxEtiScan')?.addEventListener('click', () => scanGmail());
    card.querySelector('#fluxEtiPasteBtn')?.addEventListener('click', () => {
      const ta = document.getElementById('fluxEtiPaste');
      pasteAndStage(ta?.value || '');
      if (ta) ta.value = '';
    });
    card.querySelectorAll('[data-eti-approve]').forEach((btn) => {
      btn.addEventListener('click', () => approveItem(btn.getAttribute('data-eti-approve')));
    });
    card.querySelectorAll('[data-eti-dismiss]').forEach((btn) => {
      btn.addEventListener('click', () => dismissItem(btn.getAttribute('data-eti-dismiss')));
    });
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;

    const pending = pendingQueue();
    const badge = pending.length
      ? `<span class="flux-eti-badge">${pending.length}</span>`
      : '';

    const queueHtml = pending.length
      ? pending
          .map((item) => {
            const dueLabel = item.parsedDate
              ? typeof window.fmtFluxDue === 'function'
                ? window.fmtFluxDue(item.parsedDate)
                : item.parsedDate
              : T('eti.no_date');
            return `<div class="flux-eti-item" data-id="${esc(item.id)}">
  <div class="flux-eti-item-head">${esc(item.parsedName)}</div>
  <div class="flux-eti-item-meta">${esc(dueLabel)} · ${esc(item.parsedType)} · ${esc(item.from || T('eti.unknown_from'))}</div>
  <div class="flux-eti-item-snippet">${esc(item.snippet || item.subject)}</div>
  <div class="flux-eti-item-btns">
    <button type="button" data-eti-approve="${esc(item.id)}">${esc(T('eti.approve'))}</button>
    <button type="button" class="btn-sec" data-eti-dismiss="${esc(item.id)}">${esc(T('eti.dismiss'))}</button>
  </div>
</div>`;
          })
          .join('')
      : `<p class="flux-eti-empty">${esc(T('eti.empty'))}</p>`;

    card.innerHTML = `<h3>${esc(T('eti.title'))}${badge}</h3>
<p class="flux-eti-lede">${esc(T('eti.lede'))}</p>
<div class="flux-eti-actions">
  <button type="button" class="btn-sec" id="fluxEtiScan">${esc(T('eti.scan_gmail'))}</button>
</div>
<textarea id="fluxEtiPaste" class="flux-eti-paste" placeholder="${esc(T('eti.paste_ph'))}"></textarea>
<button type="button" class="btn-sec" id="fluxEtiPasteBtn" style="width:100%;margin-bottom:12px">${esc(T('eti.paste_btn'))}</button>
<div class="flux-eti-queue">${queueHtml}</div>`;

    bindCard(card);
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const pane = document.getElementById('spane-data');
    if (!pane) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'card flux-eti-card';
      const feedback = pane.querySelector('.card');
      if (feedback) feedback.insertAdjacentElement('afterend', card);
      else pane.prepend(card);
    }
    renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('eti.palette');
    const keys = 'email inbox syllabus forward staging approve';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📥',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') window.nav('settings');
          if (typeof window.switchStab === 'function') {
            const btn = document.querySelector('.stab[onclick*="data"]');
            window.switchStab('data', btn);
          }
          setTimeout(() => ensureCard(), 200);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return false;
    }
    ensureCard();
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxEtiWrapped) {
      window.nav = function (tab) {
        const r = origNav.apply(this, arguments);
        if (tab === 'settings') setTimeout(() => ensureCard(), 80);
        return r;
      };
      window.nav._fluxEtiWrapped = true;
    }
    const origSwitch = window.switchStab;
    if (typeof origSwitch === 'function' && !origSwitch._fluxEtiWrapped) {
      window.switchStab = function (tab) {
        const r = origSwitch.apply(this, arguments);
        if (tab === 'data') setTimeout(() => ensureCard(), 60);
        return r;
      };
      window.switchStab._fluxEtiWrapped = true;
    }
    return true;
  }

  window.FluxEmailTaskInbox = {
    FLAG,
    enabled,
    pendingQueue,
    pasteAndStage,
    scanGmail,
    approveItem,
    dismissItem,
    stageItem,
    renderCard,
    ensureCard,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
