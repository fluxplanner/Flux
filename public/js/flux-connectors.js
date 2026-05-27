/* ════════════════════════════════════════════════════════════════════════════
 * FluxConnectors — central registry of external integrations (Claude-style)
 *
 * A Connector is an auth-bearing integration to an outside system: Google,
 * Canvas LMS, Microsoft 365, Schoology, Notion, etc. Each Connector declares:
 *   - id, name, icon
 *   - auth_kind: 'oauth' | 'api_key' | 'app_password' | 'none'
 *   - scopes (what the user is granting)
 *   - status getter (Connected / NeedsAuth / Off / Error)
 *   - connect() / disconnect() handlers
 *   - smokeTest() — optional, runs a small call to confirm credentials
 *
 * Settings UI mounts into Settings → Connectors. Cards render based on the
 * registry contents — adding a new connector is a single registry entry.
 *
 * Public API on window.FluxConnectors:
 *   .register(spec)                   add a connector
 *   .all()                            list of specs
 *   .get(id)                          single spec
 *   .status(id)                       current status string
 *   .connect(id) / disconnect(id)     trigger flows
 *   .test(id)                         run smoke test
 *   .subscribe(fn)                    notify on status change
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const STATUS_LABELS = {
    connected: { text: 'Connected', tone: 'good' },
    needs_auth: { text: 'Needs auth', tone: 'warn' },
    off: { text: 'Not connected', tone: 'muted' },
    error: { text: 'Error — reconnect', tone: 'bad' },
    coming_soon: { text: 'Coming soon', tone: 'muted' },
  };

  const registry = new Map();
  const subscribers = [];

  function notify(id) {
    for (const fn of subscribers) {
      try { fn(id, status(id)); } catch (_) {}
    }
  }

  function register(spec) {
    if (!spec || !spec.id) throw new Error('connector spec needs id');
    registry.set(spec.id, Object.freeze({
      id: spec.id,
      name: spec.name || spec.id,
      icon: spec.icon || '🔌',
      category: spec.category || 'other',
      auth_kind: spec.auth_kind || 'none',
      scopes: spec.scopes || [],
      description: spec.description || '',
      docs_url: spec.docs_url || '',
      role: spec.role || null,            // 'student' | 'staff' | null = all
      supports: spec.supports || [],      // ['calendar', 'tasks', 'docs', ...]
      defaultEnabled: !!spec.defaultEnabled,
      _statusFn: typeof spec.status === 'function' ? spec.status : null,
      _connectFn: typeof spec.connect === 'function' ? spec.connect : null,
      _disconnectFn: typeof spec.disconnect === 'function' ? spec.disconnect : null,
      _smokeFn: typeof spec.smokeTest === 'function' ? spec.smokeTest : null,
      _meta: spec.meta || {},
    }));
    notify(spec.id);
  }

  function all() {
    return [...registry.values()];
  }

  function get(id) {
    return registry.get(id) || null;
  }

  function status(id) {
    const spec = registry.get(id);
    if (!spec) return 'off';
    if (!spec._statusFn) return 'coming_soon';
    try { return spec._statusFn() || 'off'; } catch (_) { return 'error'; }
  }

  async function connect(id) {
    const spec = registry.get(id);
    if (!spec || !spec._connectFn) return false;
    try {
      const ok = await spec._connectFn();
      notify(id);
      return !!ok;
    } catch (e) {
      console.warn('[FluxConnectors] connect failed', id, e);
      notify(id);
      return false;
    }
  }

  async function disconnect(id) {
    const spec = registry.get(id);
    if (!spec) return false;
    try {
      if (spec._disconnectFn) await spec._disconnectFn();
      notify(id);
      return true;
    } catch (e) {
      console.warn('[FluxConnectors] disconnect failed', id, e);
      return false;
    }
  }

  async function test(id) {
    const spec = registry.get(id);
    if (!spec || !spec._smokeFn) return { ok: false, message: 'No smoke test available' };
    try {
      const r = await spec._smokeFn();
      return r && typeof r === 'object' ? r : { ok: !!r };
    } catch (e) {
      return { ok: false, message: e && e.message };
    }
  }

  function subscribe(fn) {
    if (typeof fn === 'function') subscribers.push(fn);
    return () => {
      const i = subscribers.indexOf(fn);
      if (i >= 0) subscribers.splice(i, 1);
    };
  }

  /* ───────── Built-in connectors ───────── */

  function ls(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }

  // 1 · Google — calendar, tasks, drive, docs, gmail, classroom
  register({
    id: 'google',
    name: 'Google',
    icon: '🅖',
    category: 'productivity',
    auth_kind: 'oauth',
    description: 'Calendar, Tasks, Drive, Docs, Gmail, Classroom — read + write.',
    scopes: ['calendar', 'tasks', 'drive.file', 'gmail.modify', 'classroom.courses.readonly'],
    supports: ['calendar', 'tasks', 'docs', 'mail', 'classroom'],
    defaultEnabled: true,
    status: () => {
      const tok = ls('flux_google_token', null);
      if (tok) return 'connected';
      const expired = ls('flux_google_token_expired', null);
      if (expired) return 'needs_auth';
      return 'off';
    },
    connect: async () => {
      if (typeof window.fluxGoogleConnect === 'function') return window.fluxGoogleConnect();
      if (typeof window.connectGoogle === 'function') return window.connectGoogle();
      if (typeof window.FluxGoogleHub?.connect === 'function') return window.FluxGoogleHub.connect();
      console.warn('[FluxConnectors] no google connect handler');
      return false;
    },
    disconnect: async () => {
      try { localStorage.removeItem('flux_google_token'); } catch (_) {}
      try { localStorage.removeItem('flux_google_token_expired'); } catch (_) {}
      if (typeof window.FluxGoogleHub?.disconnect === 'function') {
        try { await window.FluxGoogleHub.disconnect(); } catch (_) {}
      }
    },
  });

  // 2 · Canvas LMS
  register({
    id: 'canvas',
    name: 'Canvas',
    icon: '🅒',
    category: 'lms',
    auth_kind: 'api_key',
    description: 'Pull assignments, courses, modules, announcements from Canvas.',
    supports: ['assignments', 'courses', 'grades'],
    role: 'student',
    status: () => {
      const t = ls('flux_canvas_token', null) || ls('flux_canvas_v3_token', null);
      const h = ls('flux_canvas_host', null) || ls('flux_canvas_v3_host', null);
      if (t && h) return 'connected';
      return 'off';
    },
    connect: async () => {
      if (typeof window.fluxCanvasConnect === 'function') return window.fluxCanvasConnect();
      // Fall through to Settings → Canvas section
      if (typeof window.nav === 'function') {
        try { window.nav('settings'); } catch (_) {}
      }
      return false;
    },
    disconnect: async () => {
      if (typeof window.fluxCanvasDisconnect === 'function') {
        try { window.fluxCanvasDisconnect(); } catch (_) {}
      }
    },
    smokeTest: async () => {
      const h = ls('flux_canvas_host', null) || ls('flux_canvas_v3_host', null);
      if (!h) return { ok: false, message: 'No host saved' };
      return { ok: true, message: 'Token + host saved (manual verify in panel).' };
    },
  });

  // 3 · Microsoft 365 — Outlook Calendar, To-Do, OneDrive, Teams
  register({
    id: 'microsoft',
    name: 'Microsoft 365',
    icon: '🅼',
    category: 'productivity',
    auth_kind: 'oauth',
    description: 'Outlook Calendar, To Do, OneDrive, Teams.',
    scopes: ['calendars.readwrite', 'tasks.readwrite', 'files.read', 'mail.send'],
    supports: ['calendar', 'tasks', 'files'],
    // Status is coming-soon until OAuth backend is wired
    status: () => 'coming_soon',
  });

  // 4 · Schoology
  register({
    id: 'schoology',
    name: 'Schoology',
    icon: '🅢',
    category: 'lms',
    auth_kind: 'api_key',
    description: 'Assignments, grades, calendar.',
    supports: ['assignments', 'grades', 'calendar'],
    role: 'student',
    status: () => (ls('flux_schoology_token', null) ? 'connected' : 'coming_soon'),
  });

  // 5 · PowerSchool / Infinite Campus (gradebook read)
  register({
    id: 'powerschool',
    name: 'PowerSchool',
    icon: '🅟',
    category: 'lms',
    auth_kind: 'api_key',
    description: 'Read-only gradebook + attendance.',
    supports: ['grades', 'attendance'],
    role: 'student',
    status: () => 'coming_soon',
  });

  // 6 · Apple Calendar / iCloud via .ics
  register({
    id: 'ical',
    name: 'iCal / Subscribe',
    icon: '🅘',
    category: 'productivity',
    auth_kind: 'none',
    description: 'Subscribe to any .ics feed (Apple Calendar, school feeds, etc.).',
    supports: ['calendar'],
    status: () => {
      const feeds = (() => { try { return JSON.parse(ls('flux_ical_feeds', '[]')); } catch (_) { return []; } })();
      return Array.isArray(feeds) && feeds.length ? 'connected' : 'off';
    },
    connect: async () => {
      if (typeof window.FluxIcalSubscribe?.openDialog === 'function') {
        window.FluxIcalSubscribe.openDialog();
        return true;
      }
      return false;
    },
  });

  // 7 · Notion
  register({
    id: 'notion',
    name: 'Notion',
    icon: '🅝',
    category: 'productivity',
    auth_kind: 'oauth',
    description: 'Push tasks into a Notion database; embed a page in a card.',
    supports: ['tasks', 'docs'],
    status: () => 'coming_soon',
  });

  // 8 · Linear (staff)
  register({
    id: 'linear',
    name: 'Linear',
    icon: '🅛',
    category: 'productivity',
    auth_kind: 'oauth',
    description: 'Team issues for staff workboard.',
    supports: ['tasks'],
    role: 'staff',
    status: () => 'coming_soon',
  });

  // 9 · GitHub Classroom (autograder for CS)
  register({
    id: 'github',
    name: 'GitHub Classroom',
    icon: '🅖',
    category: 'lms',
    auth_kind: 'oauth',
    description: 'Pull assignments + autograder results.',
    supports: ['assignments'],
    role: 'student',
    status: () => 'coming_soon',
  });

  // 10 · Khan / Quizlet / Brilliant — practice deep links
  register({
    id: 'practice',
    name: 'Khan / Quizlet / Brilliant',
    icon: '🎯',
    category: 'study',
    auth_kind: 'none',
    description: 'Quick deep-links into practice problems by subject.',
    supports: ['practice'],
    status: () => 'connected', // no auth needed, always-on
  });

  // 11 · Slack
  register({
    id: 'slack',
    name: 'Slack',
    icon: '🅢',
    category: 'communication',
    auth_kind: 'oauth',
    description: 'Notifications to a Slack workspace (staff).',
    supports: ['notifications'],
    role: 'staff',
    status: () => 'coming_soon',
  });

  // 12 · Discord / Teams — group together as "Team chat"
  register({
    id: 'teamchat',
    name: 'Discord / Teams',
    icon: '💬',
    category: 'communication',
    auth_kind: 'oauth',
    description: 'Notifications + check-ins.',
    supports: ['notifications'],
    status: () => 'coming_soon',
  });

  // 13 · Spotify / YouTube Music — focus playlist
  register({
    id: 'music',
    name: 'Focus Music',
    icon: '🎧',
    category: 'wellness',
    auth_kind: 'oauth',
    description: 'Auto-play a focus playlist when a timer starts.',
    supports: ['music'],
    status: () => {
      try { return localStorage.getItem('flux_focus_music_url') ? 'connected' : 'off'; } catch(_) { return 'off'; }
    },
    connect: async () => {
      try {
        const url = window.prompt('Paste a Spotify / YouTube Music playlist URL:', '');
        if (!url) return false;
        localStorage.setItem('flux_focus_music_url', url);
        if (typeof window.showToast === 'function') window.showToast('Focus playlist saved.', 'info');
        return true;
      } catch (_) { return false; }
    },
    disconnect: async () => { try { localStorage.removeItem('flux_focus_music_url'); } catch (_) {} },
  });

  // 14 · Read-aloud TTS
  register({
    id: 'tts',
    name: 'Read-aloud (TTS)',
    icon: '🔊',
    category: 'accessibility',
    auth_kind: 'none',
    description: 'Browser TTS (always on). Optional: ElevenLabs / Azure key for higher quality.',
    supports: ['accessibility'],
    status: () => 'connected',
    smokeTest: async () => {
      try {
        const u = new SpeechSynthesisUtterance('Flux read-aloud is working.');
        u.rate = 1.0;
        speechSynthesis.speak(u);
        return { ok: true, message: 'Playing test phrase.' };
      } catch (e) {
        return { ok: false, message: e && e.message };
      }
    },
  });

  // 15 · Zoom / Meet — auto-attach to events
  register({
    id: 'meetings',
    name: 'Zoom / Meet',
    icon: '🎥',
    category: 'communication',
    auth_kind: 'oauth',
    description: 'Auto-attach meeting links to scheduled events.',
    supports: ['meetings'],
    status: () => 'coming_soon',
  });

  // 16 · Anki / RemNote export
  register({
    id: 'flashcard-export',
    name: 'Anki / RemNote',
    icon: '🃏',
    category: 'study',
    auth_kind: 'none',
    description: 'Export Flux flashcards as Anki .apkg or RemNote markdown.',
    supports: ['flashcards'],
    role: 'student',
    status: () => 'connected',
  });

  /* ───────── Settings UI mount ───────── */

  const TONE_COLORS = {
    good: '#22c55e',
    warn: '#f59e0b',
    muted: 'var(--muted)',
    bad: '#ef4444',
  };

  function buildCardHTML(spec) {
    const st = status(spec.id);
    const sl = STATUS_LABELS[st] || STATUS_LABELS.off;
    const role = spec.role ? `<span style="font-size:.55rem;padding:2px 6px;border-radius:6px;background:rgba(var(--accent-rgb),0.12);color:var(--accent);text-transform:uppercase;letter-spacing:0.08em">${spec.role}</span>` : '';
    const connectable = !!spec._connectFn;
    const showDisconnect = st === 'connected' && !!spec._disconnectFn;
    const canTest = !!spec._smokeFn;
    return `
      <div class="flux-connector-card" data-connector-id="${spec.id}">
        <div class="flux-connector-head">
          <div class="flux-connector-icon" aria-hidden="true">${spec.icon}</div>
          <div class="flux-connector-meta">
            <div class="flux-connector-name">${escHtml(spec.name)} ${role}</div>
            <div class="flux-connector-desc">${escHtml(spec.description || '')}</div>
          </div>
          <div class="flux-connector-status" style="color:${TONE_COLORS[sl.tone]}">
            <span class="flux-connector-dot" style="background:${TONE_COLORS[sl.tone]}"></span>
            ${sl.text}
          </div>
        </div>
        <div class="flux-connector-actions">
          ${connectable && st !== 'connected' ? `<button type="button" class="btn flux-connector-connect" data-connector-action="connect" data-connector-id="${spec.id}">Connect</button>` : ''}
          ${showDisconnect ? `<button type="button" class="btn-sec flux-connector-disconnect" data-connector-action="disconnect" data-connector-id="${spec.id}">Disconnect</button>` : ''}
          ${canTest ? `<button type="button" class="btn-sec flux-connector-test" data-connector-action="test" data-connector-id="${spec.id}">Test</button>` : ''}
          ${st === 'coming_soon' ? `<span style="font-size:.7rem;color:var(--muted)">Wiring in progress</span>` : ''}
        </div>
      </div>`;
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mountSettingsCard() {
    const spane = document.getElementById('spane-connectors')
      || document.getElementById('spane-integrations')
      || document.getElementById('spane-data')
      || document.getElementById('spane-appearance');
    if (!spane) return;
    if (document.getElementById('fluxConnectorsCard')) return;
    const card = document.createElement('div');
    card.className = 'card flux-connectors-card';
    card.id = 'fluxConnectorsCard';
    const role = (window.FluxRole && window.FluxRole.current) || 'student';
    const list = all().filter((c) => !c.role || c.role === role);
    const grouped = list.reduce((acc, c) => {
      (acc[c.category] = acc[c.category] || []).push(c);
      return acc;
    }, {});
    const sectionOrder = ['productivity', 'lms', 'communication', 'study', 'accessibility', 'wellness', 'other'];
    const sectionTitles = {
      productivity: 'Productivity',
      lms: 'Learning systems',
      communication: 'Communication',
      study: 'Study',
      accessibility: 'Accessibility',
      wellness: 'Wellness',
      other: 'Other',
    };
    card.innerHTML = `
      <h3>Connectors</h3>
      <div class="ssub" style="font-size:.75rem;color:var(--muted2);margin-bottom:14px;line-height:1.55">
        External services Flux can read from or write to. Each connector lists
        what it can do; connect only what you need.
      </div>
      ${sectionOrder.map((sec) => grouped[sec]?.length ? `
        <div class="flux-connector-section">
          <div class="flux-connector-section-title">${sectionTitles[sec]}</div>
          <div class="flux-connector-grid">
            ${grouped[sec].map(buildCardHTML).join('')}
          </div>
        </div>
      ` : '').join('')}
    `;
    spane.insertBefore(card, spane.firstChild);
    bindCardActions(card);
  }

  function bindCardActions(root) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-connector-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-connector-action');
      const id = btn.getAttribute('data-connector-id');
      if (!id) return;
      btn.disabled = true;
      try {
        if (action === 'connect') await connect(id);
        else if (action === 'disconnect') await disconnect(id);
        else if (action === 'test') {
          const r = await test(id);
          if (typeof window.showToast === 'function') {
            window.showToast(r.ok ? '✓ ' + (r.message || 'Test passed') : '✗ ' + (r.message || 'Test failed'), r.ok ? 'success' : 'warn');
          }
        }
        repaintCard(id);
      } finally {
        btn.disabled = false;
      }
    });
  }

  function repaintCard(id) {
    const card = document.querySelector(`[data-connector-id="${id}"]`);
    if (!card) return;
    const spec = get(id);
    if (!spec) return;
    const html = buildCardHTML(spec);
    const tpl = document.createElement('div');
    tpl.innerHTML = html.trim();
    card.replaceWith(tpl.firstElementChild);
  }

  subscribe((id) => repaintCard(id));

  /* ───────── Boot ───────── */

  function pollMount() {
    let tries = 0;
    const tick = () => {
      tries++;
      try { mountSettingsCard(); } catch (_) {}
      if (tries < 30 && !document.getElementById('fluxConnectorsCard')) setTimeout(tick, 500);
    };
    tick();
  }

  document.addEventListener('flux-nav', (e) => {
    if (e && e.detail && e.detail.panel === 'settings') {
      setTimeout(mountSettingsCard, 100);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pollMount, { once: true });
  } else {
    pollMount();
  }

  window.FluxConnectors = {
    register, all, get, status, connect, disconnect, test, subscribe,
    _mount: mountSettingsCard,
  };
})();
