/**
 * Flux · Unified Google integration (all account types).
 * One Google sign-in grants Gmail, Calendar, Tasks, and Docs scopes.
 * Canvas LMS uses a one-time school login (Google SSO on Canvas when supported);
 * tokens sync via cloud so reconnect is not required on new devices.
 */
(function () {
  'use strict';

  const LS_SCOPES_OK = 'flux_google_scopes_granted_v1';
  const LS_HUB_TAB = 'flux_google_hub_tab_v1';

  const SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/documents',
  ];

  function scopesString() {
    return SCOPES.join(' ');
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
    else console.log('[FluxGoogle]', msg);
  }

  function isGoogleLinked() {
    try {
      return !!(
        (typeof gmailToken !== 'undefined' && gmailToken) ||
        sessionStorage.getItem('flux_gmail_token') ||
        (typeof currentUser !== 'undefined' && currentUser && currentUser.app_metadata?.provider === 'google')
      );
    } catch (_) {
      return false;
    }
  }

  async function ensureToken() {
    if (typeof window.gmailToken !== 'undefined' && window.gmailToken) return window.gmailToken;
    try {
      const cached = sessionStorage.getItem('flux_gmail_token');
      if (cached) {
        window.gmailToken = cached;
        return cached;
      }
    } catch (_) {}
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    if (!sb) return null;
    try {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (session?.provider_token) {
        applyProviderToken(session.provider_token);
        return session.provider_token;
      }
    } catch (_) {}
    return null;
  }

  function applyProviderToken(tok) {
    if (!tok) return;
    try {
      window.gmailToken = tok;
      sessionStorage.setItem('flux_gmail_token', tok);
      if (typeof save === 'function') save(LS_SCOPES_OK, true);
    } catch (_) {}
  }

  async function signIn(opts) {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    if (!sb) {
      toast('Auth not available — refresh the page', 'error');
      return;
    }
    const forceConsent = !!(opts && opts.forceConsent);
    const hadScopes = typeof load === 'function' && load(LS_SCOPES_OK, false);
    const prompt = forceConsent || !hadScopes ? 'consent' : 'select_account';
    try {
      if (typeof window.initOAuthPostMessageListener === 'function') window.initOAuthPostMessageListener();
      const redirectTo =
        typeof window.getRedirectURL === 'function' ? window.getRedirectURL() : window.location.origin + window.location.pathname;
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: scopesString(),
          queryParams: { access_type: 'offline', prompt },
        },
      });
      if (error) throw error;
      if (!data?.url) {
        toast('Could not start Google sign-in', 'error');
        return;
      }
      const feat = 'width=520,height=720,left=80,top=60,scrollbars=yes,resizable=yes';
      const w = window.open(data.url, 'fluxGoogleOAuth', feat);
      if (!w || w.closed == null) {
        window.location.href = data.url;
        return;
      }
      try {
        w.focus();
      } catch (_) {}
      toast('Approve Google access in the pop-up — Gmail, Calendar, Tasks, and Docs unlock together.', 'info');
    } catch (e) {
      console.error('[FluxGoogle] oauth', e);
      toast('Sign-in failed: ' + (e.message || e), 'error');
    }
  }

  function getIntegrationsForCloud() {
    try {
      const tok = typeof load === 'function' ? load('flux_canvas_token', '') : '';
      const host = typeof load === 'function' ? load('flux_canvas_host', '') : '';
      if (!tok || !host) return null;
      return {
        canvasToken: String(tok),
        canvasHost: String(host),
        canvasUrl: typeof load === 'function' ? load('flux_canvas_url', '') : '',
        updatedAt: Date.now(),
      };
    } catch (_) {
      return null;
    }
  }

  function restoreIntegrationsFromCloud(integrations) {
    if (!integrations || !integrations.canvasToken || !integrations.canvasHost) return false;
    try {
      if (typeof save === 'function') {
        save('flux_canvas_token', integrations.canvasToken);
        save('flux_canvas_host', integrations.canvasHost);
        if (integrations.canvasUrl) save('flux_canvas_url', integrations.canvasUrl);
      }
      try {
        window.canvasToken = integrations.canvasToken;
        window.canvasUrl = integrations.canvasUrl || 'https://' + integrations.canvasHost;
      } catch (_) {}
      if (window.CanvasState) {
        window.CanvasState.connected = true;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function pushIntegrationsToCloud() {
    const payload = getIntegrationsForCloud();
    if (!payload || typeof syncToCloud !== 'function') return;
    void syncToCloud();
  }

  async function validateCanvasToken() {
    if (typeof canvasProxyGet !== 'function') return false;
    try {
      await canvasProxyGet('/users/self/profile');
      return true;
    } catch (_) {
      return false;
    }
  }

  async function afterSignIn(session) {
    if (session?.provider_token) applyProviderToken(session.provider_token);
    try {
      if (typeof refreshGmailEmailsFromApi === 'function') await refreshGmailEmailsFromApi();
    } catch (_) {}
    try {
      if (window.FluxGoogleTasks && typeof FluxGoogleTasks.prefetch === 'function') await FluxGoogleTasks.prefetch();
    } catch (_) {}
    try {
      if (typeof canvasToken !== 'undefined' && canvasToken && typeof canvasProxyGet === 'function') {
        const ok = await validateCanvasToken();
        if (!ok) {
          if (typeof save === 'function') {
            save('flux_canvas_token', null);
            save('flux_canvas_host', null);
          }
          try {
            window.canvasToken = '';
            window.canvasUrl = '';
          } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      if (window.fluxCanvasBootstrapFromGoogle) window.fluxCanvasBootstrapFromGoogle();
    } catch (_) {}
    renderHubIfVisible();
    try {
      if (window.FluxAIConnections && typeof FluxAIConnections.renderConnectionsPanel === 'function') {
        FluxAIConnections.renderConnectionsPanel(true);
      }
    } catch (_) {}
    updateSettingsCard();
  }

  function hubTab() {
    try {
      return load(LS_HUB_TAB, 'tasks');
    } catch (_) {
      return 'tasks';
    }
  }

  function setHubTab(id) {
    try {
      save(LS_HUB_TAB, id);
    } catch (_) {}
    renderHub();
  }

  function googleSignInGateHtml() {
    return `
    <div class="g-hub-gate">
      <div class="g-hub-gate-icon" aria-hidden="true">🔗</div>
      <h2 class="g-hub-gate-title flux-color-title">Connect Google</h2>
      <p class="g-hub-gate-sub">One sign-in unlocks <strong>Gmail</strong>, <strong>Google Tasks</strong>, <strong>Calendar</strong>, and <strong>Docs</strong> for every Flux account — students, staff, and guests upgrading to sync.</p>
      <p class="g-hub-gate-sub g-hub-gate-sub--muted">Canvas uses your school login (Google SSO when your district supports it). After the first Canvas link, Flux remembers it on your account.</p>
      <button type="button" class="g-hub-gate-btn login-google-btn" onclick="FluxGoogle.signIn()">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Continue with Google
      </button>
      <button type="button" class="btn-sec g-hub-gate-guest" onclick="nav('dashboard')">Back to dashboard</button>
    </div>`;
  }

  function statusStripHtml() {
    const email =
      (typeof currentUser !== 'undefined' && currentUser && currentUser.email) ||
      (typeof load === 'function' ? load('flux_last_user_email', '') : '') ||
      '';
    const canvasOn =
      (typeof canvasToken !== 'undefined' && canvasToken && typeof canvasUrl !== 'undefined' && canvasUrl) ||
      (typeof load === 'function' && load('flux_canvas_token', ''));
    return `
    <div class="g-hub-status" aria-label="Integration status">
      <span class="g-hub-pill g-hub-pill--on">Google connected${email ? ' · ' + esc(email) : ''}</span>
      <span class="g-hub-pill ${canvasOn ? 'g-hub-pill--on' : ''}">${canvasOn ? 'Canvas linked' : 'Canvas — finish school login once'}</span>
    </div>`;
  }

  function isStaffHub() {
    try {
      return typeof FluxRole !== 'undefined' && FluxRole.isStaff && FluxRole.isStaff();
    } catch (_) {
      return false;
    }
  }

  function syncHubPageSubtitle() {
    const sub = document.getElementById('canvasHubPageSub');
    if (!sub) return;
    if (isStaffHub()) {
      sub.textContent =
        'Connect once, then import Gmail, Calendar events, Tasks, Docs, and Canvas assignments into Flux — available in Work and Personal mode.';
    } else {
      sub.textContent =
        'One Google sign-in for Gmail, Google Tasks, and Calendar. Link Canvas once with your school Google login when prompted.';
    }
  }

  function hubTabsList() {
    return [
      { id: 'tasks', label: 'Tasks', icon: '✅' },
      { id: 'calendar', label: 'Calendar', icon: '📅' },
      { id: 'gmail', label: 'Gmail', icon: '📧' },
      { id: 'docs', label: 'Docs', icon: '📄' },
      { id: 'canvas', label: 'Canvas', icon: '🎓' },
    ];
  }

  async function syncCalendar() {
    if (typeof syncGoogleCalendar !== 'function') {
      toast('Calendar sync is not available', 'warning');
      return;
    }
    await ensureToken();
    await syncGoogleCalendar({
      statusEl: document.getElementById('gHubGcalStatus'),
      eventsEl: document.getElementById('gHubGcalEvents'),
    });
  }

  function renderCalendarPane() {
    const slot = document.getElementById('gHubCalendarSlot');
    if (!slot) return;
    slot.innerHTML = `
    <div class="g-hub-import-card">
      <p class="g-hub-muted">Pull upcoming Google Calendar events and add them as Flux tasks.</p>
      <div class="g-tasks-head" style="margin-top:12px">
        <button type="button" class="btn-sec" onclick="FluxGoogle.syncCalendar()">↻ Sync calendar</button>
        <button type="button" onclick="nav('calendar')">Open Flux calendar</button>
      </div>
      <div id="gHubGcalStatus" style="margin-top:12px"></div>
      <div id="gHubGcalEvents" class="g-hub-gcal-events" style="margin-top:8px"></div>
    </div>`;
    void syncCalendar();
  }

  function renderDocsPane() {
    const slot = document.getElementById('gHubDocsSlot');
    if (!slot) return;
    const primary = (typeof load === 'function' && load('flux_google_docs_primary_url', '')) || '';
    slot.innerHTML = `
    <div class="g-hub-import-card">
      <p class="g-hub-muted">Sync a Google Doc into <strong>Flux AI</strong> or push planner notes to your doc.</p>
      <div class="mrow" style="margin-top:12px">
        <label for="gHubDocsUrl" style="font-size:.78rem;color:var(--muted)">Primary doc URL</label>
        <input type="url" id="gHubDocsUrl" value="${esc(primary)}" placeholder="https://docs.google.com/document/d/…/edit" style="margin-top:6px;width:100%">
      </div>
      <div class="g-tasks-head" style="margin-top:12px">
        <button type="button" class="btn-sec" onclick="FluxGoogle.saveDocsUrl()">Save URL</button>
        <button type="button" onclick="window.fluxGoogleDocsPullNow&&fluxGoogleDocsPullNow()">Pull into AI</button>
        <button type="button" class="btn-sec" onclick="window.fluxGoogleDocsCreateAndOpen&&fluxGoogleDocsCreateAndOpen()">New doc</button>
      </div>
      <div class="mrow" style="margin-top:14px">
        <label for="gHubDocsPush" style="font-size:.78rem;color:var(--muted)">Push text to doc</label>
        <textarea id="gHubDocsPush" rows="4" maxlength="480000" placeholder="Paste notes to send to your primary Google Doc…" style="margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:.78rem;width:100%"></textarea>
        <button type="button" style="margin-top:8px" onclick="FluxGoogle.pushDocsFromHub()">Replace doc body</button>
      </div>
    </div>`;
  }

  function saveDocsUrl() {
    const v = String(document.getElementById('gHubDocsUrl')?.value || '').trim();
    if (typeof save === 'function') save('flux_google_docs_primary_url', v);
    if (typeof window.fluxGoogleDocsSavePrimaryUrl === 'function') window.fluxGoogleDocsSavePrimaryUrl();
    toast('Doc URL saved', 'success');
  }

  function pushDocsFromHub() {
    const ta = document.getElementById('gHubDocsPush');
    const settingsTa = document.getElementById('fluxDocsPushBody');
    if (ta && settingsTa) settingsTa.value = ta.value;
    if (typeof window.fluxGoogleDocsPushFromTextarea === 'function') window.fluxGoogleDocsPushFromTextarea();
    else toast('Docs sync not loaded', 'warning');
  }

  function renderHub() {
    const stack = document.getElementById('canvasHubStack');
    if (!stack) return;

    syncHubPageSubtitle();

    if (!isGoogleLinked()) {
      stack.innerHTML = googleSignInGateHtml();
      return;
    }

    const tab = hubTab();
    const tabs = hubTabsList();

    stack.innerHTML = `
    <div class="g-hub">
      ${statusStripHtml()}
      <p class="g-hub-muted g-hub-import-lede">Import into Flux — use <strong>+ Task</strong> or <strong>+ Flux</strong> on each row, or bulk import on Tasks and Canvas.</p>
      <nav class="g-hub-tabs" role="tablist" aria-label="Google and Canvas">
        ${tabs
          .map(
            (t) =>
              `<button type="button" role="tab" class="g-hub-tab ${tab === t.id ? 'active' : ''}" aria-selected="${tab === t.id}" onclick="FluxGoogle.setTab('${t.id}')"><span aria-hidden="true">${t.icon}</span><span>${esc(t.label)}</span></button>`,
          )
          .join('')}
      </nav>
      <div id="gHubTasksSlot" class="g-hub-pane g-hub-pane--pad" ${tab === 'tasks' ? '' : 'style="display:none"'}></div>
      <div id="gHubCalendarSlot" class="g-hub-pane g-hub-pane--pad" ${tab === 'calendar' ? '' : 'style="display:none"'}></div>
      <div id="gHubGmailSlot" class="g-hub-pane g-hub-pane--pad" ${tab === 'gmail' ? '' : 'style="display:none"'}>
        <div id="canvasGmailList" class="g-hub-gmail-list"></div>
      </div>
      <div id="gHubDocsSlot" class="g-hub-pane g-hub-pane--pad" ${tab === 'docs' ? '' : 'style="display:none"'}></div>
      <div id="gHubCanvasSlot" class="g-hub-pane" ${tab === 'canvas' ? '' : 'style="display:none"'}></div>
    </div>`;

    if (tab === 'canvas') {
      if (typeof window.__fluxRenderCanvasPanelCore === 'function') window.__fluxRenderCanvasPanelCore();
    } else if (tab === 'gmail') {
      if (typeof loadGmail === 'function') void loadGmail();
    } else if (tab === 'tasks') {
      if (window.FluxGoogleTasks && typeof FluxGoogleTasks.render === 'function') FluxGoogleTasks.render();
    } else if (tab === 'calendar') {
      renderCalendarPane();
    } else if (tab === 'docs') {
      renderDocsPane();
    }
  }

  function renderHubIfVisible() {
    const panel = document.getElementById('canvas');
    if (panel && panel.classList.contains('active')) renderHub();
  }

  function updateSettingsCard() {
    const el = document.getElementById('fluxGoogleIntegrationStatus');
    if (!el) return;
    if (!isGoogleLinked()) {
      el.textContent = 'Sign in with Google to unlock Gmail, Tasks, Calendar, and Docs in one step.';
      return;
    }
    const bits = ['Gmail', 'Calendar', 'Tasks', 'Docs'];
    el.textContent = 'Connected — ' + bits.join(', ') + ' use the same Google session. Open the Canvas tab for school LMS + inbox.';
  }

  function wrapCanvasPanel() {
    if (window.__fluxRenderCanvasPanelCore) return;
    const orig = window.__fluxRenderCanvasPanel;
    if (typeof orig !== 'function') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapCanvasPanel, { once: true });
      } else {
        setTimeout(wrapCanvasPanel, 50);
      }
      return;
    }
    window.__fluxRenderCanvasPanelCore = orig;
    window.__fluxRenderCanvasPanel = function () {
      renderHub();
    };
  }

  wrapCanvasPanel();

  window.FluxGoogle = {
    SCOPES,
    scopesString,
    isGoogleLinked,
    ensureToken,
    applyProviderToken,
    signIn,
    signInWithFullScopes: (opts) => signIn({ forceConsent: true, ...(opts || {}) }),
    afterSignIn,
    getIntegrationsForCloud,
    restoreIntegrationsFromCloud,
    pushIntegrationsToCloud,
    setTab: setHubTab,
    renderHub,
    renderHubIfVisible,
    updateSettingsCard,
    syncCalendar,
    saveDocsUrl,
    pushDocsFromHub,
  };

  window.fluxReconnectGoogleCalendarWrite = function () {
    return FluxGoogle.signInWithFullScopes({ forceConsent: true });
  };
  window.fluxReconnectGoogleDocs = function () {
    return FluxGoogle.signInWithFullScopes({ forceConsent: true });
  };
})();
