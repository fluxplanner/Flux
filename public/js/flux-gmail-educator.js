/**
 * Educator Gmail → task import (smart parsing, dedupe).
 * Flag: enable_gmail_educator_import (default off). Educator roles only.
 */
(function () {
  'use strict';

  const LS_IMPORTED = 'flux_gmail_imported_map_v1';
  const LS_FILTER = 'flux_gmail_edu_filter_v1';

  let _emails = [];
  let _legacyLoadGmail = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_gmail_educator_import', false);
    } catch (_) {
      return false;
    }
  }

  function isEducator() {
    try {
      return typeof FluxRole !== 'undefined' && FluxRole.isEducator && FluxRole.isEducator();
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

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
    else console.log('[gmail-edu]', msg);
  }

  function getToken() {
    return window.gmailToken || sessionStorage.getItem('flux_gmail_token') || null;
  }

  function taskList() {
    return Array.isArray(window.tasks) ? window.tasks : [];
  }

  function importedMap() {
    const m = load(LS_IMPORTED, {});
    return m && typeof m === 'object' ? m : {};
  }

  function saveImportedMap(m) {
    save(LS_IMPORTED, m || {});
  }

  function messageImported(messageId) {
    if (!messageId) return false;
    if (importedMap()[messageId]) return true;
    return taskList().some((t) => t && String(t.gmailMessageId) === String(messageId));
  }

  function markImported(messageId, taskId) {
    const m = importedMap();
    m[String(messageId)] = { taskId, at: Date.now() };
    saveImportedMap(m);
  }

  function parseDueDate(text) {
    const s = String(text || '');
    const iso = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) return iso[0];
    const slash = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (slash) {
      const y = slash[3] ? (slash[3].length === 2 ? 2000 + parseInt(slash[3], 10) : parseInt(slash[3], 10)) : new Date().getFullYear();
      const mo = parseInt(slash[1], 10);
      const d = parseInt(slash[2], 10);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    const by = s.match(/\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (by) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const target = days.indexOf(by[1].toLowerCase());
      if (target >= 0) {
        const now = new Date();
        const cur = now.getDay();
        let add = target - cur;
        if (add <= 0) add += 7;
        const dt = new Date(now);
        dt.setDate(dt.getDate() + add);
        return dt.toISOString().slice(0, 10);
      }
    }
    return '';
  }

  function inferType(subject, snippet) {
    const t = `${subject} ${snippet}`.toLowerCase();
    if (/\b(iep|504|accommodation)\b/.test(t)) return 'other';
    if (/\b(meeting|conference|call|zoom|teams)\b/.test(t)) return 'other';
    if (/\b(permission|form|signature|register)\b/.test(t)) return 'hw';
    if (/\b(grade|grades|report card)\b/.test(t)) return 'other';
    return 'hw';
  }

  function inferPriority(subject, snippet, due) {
    const t = `${subject} ${snippet}`.toLowerCase();
    if (/\b(urgent|asap|immediate|action required)\b/.test(t)) return 'high';
    if (due) {
      const end = new Date(`${due}T23:59:00`);
      const h = (end - Date.now()) / 3600000;
      if (h > 0 && h <= 48) return 'high';
    }
    if (/\b(reminder|follow up|please review)\b/.test(t)) return 'med';
    return 'med';
  }

  function actionScore(email) {
    const sub = String(email.subject || '').toLowerCase();
    const sn = String(email.snippet || '').toLowerCase();
    let score = 0;
    if (/\b(action required|please complete|deadline|due by|rsvp|follow up|permission slip)\b/.test(sub)) score += 2;
    if (/\b(parent|guardian|conference|iep|504)\b/.test(sub)) score += 1;
    if (parseDueDate(`${email.subject} ${email.snippet}`)) score += 1;
    if (/\b(urgent|asap)\b/.test(sub + sn)) score += 1;
    return score;
  }

  function buildTaskFromEmail(email) {
    const combined = `${email.subject || ''}\n${email.snippet || ''}`;
    const due = parseDueDate(combined);
    const name = (email.subject || 'Email follow-up').slice(0, 240);
    const task = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name,
      date: due,
      subject: '',
      priority: inferPriority(email.subject, email.snippet, due),
      type: inferType(email.subject, email.snippet),
      notes: [`From: ${email.from || ''}`, `Date: ${email.date || ''}`, '', email.snippet || ''].join('\n').trim(),
      done: false,
      rescheduled: 0,
      createdAt: Date.now(),
      gmailMessageId: email.id,
      source: 'gmail_educator',
    };
    if (typeof window.calcUrgency === 'function') task.urgencyScore = window.calcUrgency(task);
    return task;
  }

  function importEmail(email, opts) {
    const silent = !!(opts && opts.silent);
    if (!email || messageImported(email.id)) {
      if (!silent) toast('Already imported', 'info');
      return false;
    }
    const task = buildTaskFromEmail(email);
    const list = taskList();
    list.unshift(task);
    save('tasks', list);
    markImported(email.id, task.id);
    if (typeof window.syncKey === 'function') window.syncKey('tasks', list);
    if (!silent) {
      if (typeof window.renderStats === 'function') window.renderStats();
      if (typeof window.renderTasks === 'function') window.renderTasks();
      toast(`Imported "${task.name.slice(0, 40)}"`, 'success');
    }
    return true;
  }

  function queryForFilter(key) {
    const map = {
      inbox: 'in:inbox',
      unread: 'in:inbox is:unread',
      parents: 'in:inbox (subject:parent OR subject:guardian OR from:pta)',
      school: 'in:inbox (school OR principal OR district OR "report card")',
      week: 'in:inbox newer_than:7d',
    };
    return map[key] || map.inbox;
  }

  async function ensureToken() {
    if (typeof window.ensureGmailTokenFromSession === 'function') {
      return window.ensureGmailTokenFromSession();
    }
    return !!getToken();
  }

  async function fetchInbox(filterKey) {
    const token = getToken();
    if (!token) return { ok: false, needsSignIn: true };
    const q = queryForFilter(filterKey || load(LS_FILTER, 'inbox'));
    try {
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (listRes.status === 401) return { ok: false, expired: true };
      if (!listRes.ok) return { ok: false, error: `Gmail API ${listRes.status}` };
      const data = await listRes.json();
      const messages = data.messages || [];
      if (!messages.length) {
        _emails = [];
        window.gmailEmails = [];
        return { ok: true, emails: [] };
      }
      const emails = await Promise.all(
        messages.map(async (m) => {
          try {
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
              actionScore: 0,
            };
          } catch (_) {
            return { id: m.id, subject: '(error)', from: '', date: '', snippet: '', actionScore: 0 };
          }
        }),
      );
      emails.forEach((e) => {
        e.actionScore = actionScore(e);
      });
      _emails = emails;
      window.gmailEmails = emails;
      return { ok: true, emails };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  function renderList(host) {
    if (!_emails.length) {
      host.querySelector('.flux-gmail-edu-list')?.replaceChildren();
      const empty = host.querySelector('.flux-gmail-edu-empty-slot');
      if (empty) empty.style.display = '';
      return;
    }
    const empty = host.querySelector('.flux-gmail-edu-empty-slot');
    if (empty) empty.style.display = 'none';
    const list = host.querySelector('.flux-gmail-edu-list');
    if (!list) return;
    list.innerHTML = _emails
      .map((e) => {
        const imported = messageImported(e.id);
        const due = parseDueDate(`${e.subject} ${e.snippet}`);
        const tags = [];
        if (due) tags.push(`<span class="flux-gmail-edu-tag flux-gmail-edu-tag--due">Due ${esc(due)}</span>`);
        if (e.actionScore >= 2) tags.push('<span class="flux-gmail-edu-tag">Action likely</span>');
        return `<div class="flux-gmail-edu-row${e.actionScore >= 2 ? ' flux-gmail-edu-row--action' : ''}${imported ? ' flux-gmail-edu-row--imported' : ''}">
          <div class="flux-gmail-edu-body">
            <div class="flux-gmail-edu-subject">${esc(e.subject || '(no subject)')}</div>
            <div class="flux-gmail-edu-meta">${esc(e.from || '')}</div>
            <div class="flux-gmail-edu-snippet">${esc(e.snippet || '')}</div>
            ${tags.length ? `<div class="flux-gmail-edu-tags">${tags.join('')}</div>` : ''}
          </div>
          <div class="flux-gmail-edu-actions">
            <button type="button" data-gmail-import="${esc(e.id)}" ${imported ? 'disabled' : ''}>${imported ? '✓ In Flux' : '+ Task'}</button>
          </div>
        </div>`;
      })
      .join('');

    list.querySelectorAll('[data-gmail-import]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const email = _emails.find((x) => x.id === btn.getAttribute('data-gmail-import'));
        if (email) importEmail(email);
        renderList(host);
      });
    });
  }

  function renderShell(host, filterKey) {
    const fk = filterKey || load(LS_FILTER, 'inbox');
    host.innerHTML = `
      <div class="flux-gmail-edu g-hub-import-card">
        <div class="flux-gmail-edu-head">
          <h3>Gmail → tasks</h3>
          <span class="flux-gmail-edu-badge">Educator</span>
        </div>
        <p class="g-hub-muted">Import school emails as planner tasks with due-date hints and deduplication.</p>
        <div class="flux-gmail-edu-filters">
          <select id="fluxGmailEduFilter" aria-label="Inbox filter">
            <option value="inbox"${fk === 'inbox' ? ' selected' : ''}>Inbox</option>
            <option value="unread"${fk === 'unread' ? ' selected' : ''}>Unread</option>
            <option value="week"${fk === 'week' ? ' selected' : ''}>Last 7 days</option>
            <option value="parents"${fk === 'parents' ? ' selected' : ''}>Parent / guardian</option>
            <option value="school"${fk === 'school' ? ' selected' : ''}>School keywords</option>
          </select>
          <button type="button" class="flux-gmail-edu-btn-primary" id="fluxGmailEduRefresh">↻ Refresh</button>
          <button type="button" id="fluxGmailEduBulk">Import action items</button>
        </div>
        <div class="flux-gmail-edu-empty-slot" style="display:none">No messages in this filter.</div>
        <div class="flux-gmail-edu-list"></div>
        <p class="flux-gmail-edu-foot">Read-only Gmail access. Tasks store the message id so the same email is not imported twice.</p>
      </div>`;

    host.querySelector('#fluxGmailEduFilter')?.addEventListener('change', (e) => {
      save(LS_FILTER, e.target.value);
      void load(host);
    });
    host.querySelector('#fluxGmailEduRefresh')?.addEventListener('click', () => void load(host));
    host.querySelector('#fluxGmailEduBulk')?.addEventListener('click', () => {
      let n = 0;
      _emails
        .filter((e) => e.actionScore >= 2 && !messageImported(e.id))
        .slice(0, 8)
        .forEach((e) => {
          if (importEmail(e, { silent: true })) n += 1;
        });
      if (n) {
        if (typeof window.renderStats === 'function') window.renderStats();
        if (typeof window.renderTasks === 'function') window.renderTasks();
        toast(`Imported ${n} task${n === 1 ? '' : 's'}`, 'success');
      } else toast('No new action-item emails to import', 'info');
      renderList(host);
    });
  }

  async function load(container) {
    const host = container || (typeof window.gmailListContainer === 'function' ? window.gmailListContainer() : null);
    if (!host) return;

    if (!enabled() || !isEducator()) {
      if (_legacyLoadGmail) return _legacyLoadGmail();
      return;
    }

    await ensureToken();
    if (!getToken()) {
      host.innerHTML = `<div class="flux-gmail-edu-empty">Sign in with Google to import Gmail.</div>`;
      return;
    }

    if (!host.querySelector('.flux-gmail-edu')) {
      renderShell(host);
    }

    const status = host.querySelector('.flux-gmail-edu-filters');
    const fk = host.querySelector('#fluxGmailEduFilter')?.value || load(LS_FILTER, 'inbox');
    const res = await fetchInbox(fk);
    if (!res.ok) {
      host.innerHTML = `<div class="flux-gmail-edu-empty">Could not load Gmail${res.error ? `: ${esc(res.error)}` : ''}.</div>`;
      return;
    }
    renderList(host);
  }

  async function importTopActionEmail() {
    if (!enabled() || !isEducator()) {
      toast('Gmail import not enabled', 'warn');
      return false;
    }
    if (!(await ensureToken()) || !getToken()) {
      toast('Sign in with Google first', 'warn');
      return false;
    }
    const res = await fetchInbox(load(LS_FILTER, 'inbox'));
    if (!res.ok) {
      toast(res.needsSignIn ? 'Connect Google in Gmail hub' : res.error || 'Gmail unavailable', 'error');
      return false;
    }
    const top = (_emails || [])
      .filter((e) => e.actionScore >= 2 && !messageImported(e.id))
      .sort((a, b) => b.actionScore - a.actionScore)[0];
    if (!top) {
      toast('No new high-action emails in this filter', 'info');
      return false;
    }
    return importEmail(top);
  }

  async function importActionEmailsBulk(max) {
    if (!enabled() || !isEducator()) return 0;
    if (!(await ensureToken()) || !getToken()) {
      toast('Sign in with Google first', 'warn');
      return 0;
    }
    const res = await fetchInbox(load(LS_FILTER, 'inbox'));
    if (!res.ok) {
      toast(res.error || 'Could not load Gmail', 'error');
      return 0;
    }
    const limit = typeof max === 'number' ? max : 8;
    let n = 0;
    (_emails || [])
      .filter((e) => e.actionScore >= 2 && !messageImported(e.id))
      .slice(0, limit)
      .forEach((e) => {
        if (importEmail(e, { silent: true })) n += 1;
      });
    if (n) {
      if (typeof window.renderStats === 'function') window.renderStats();
      if (typeof window.renderTasks === 'function') window.renderTasks();
      toast(`Imported ${n} task${n === 1 ? '' : 's'}`, 'success');
    } else toast('No new action emails to import', 'info');
    return n;
  }

  function install() {
    if (!enabled()) return false;
    if (typeof window.loadGmail === 'function' && !_legacyLoadGmail) {
      _legacyLoadGmail = window.loadGmail;
      window.loadGmail = function () {
        return load();
      };
    }
    window.fluxGmailEducatorImport = importEmail;
    return true;
  }

  window.FluxGmailEducator = {
    enabled,
    isEducator,
    install,
    load,
    fetchInbox,
    importEmail,
    importTopActionEmail,
    importActionEmailsBulk,
    parseDueDate,
    buildTaskFromEmail,
  };
})();
