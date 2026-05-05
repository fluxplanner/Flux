/**
 * Flux AI — Claude-style Connections: apps, providers, BYOK models, custom hooks.
 * Depends on globals from app.js: load, save, showToast, signInWithGoogle, nav,
 * gmailToken / gmailEmails (when present), FluxOrchestrator (optional palette).
 */
(function () {
  const STORAGE_ITEMS = 'flux_ai_connections_items_v1';
  const STORAGE_CUSTOM = 'flux_ai_connections_custom_v1';
  const STORAGE_MODEL = 'flux_ai_model_route_v1';

  const DEFS = [
    { id: 'gmail', group: 'Google', icon: '📧', title: 'Gmail', hint: 'Injects anonymized inbox subject lines into Flux AI context when Google is linked.', needsGoogle: true },
    { id: 'gcalendar', group: 'Google', icon: '🗓', title: 'Google Calendar', hint: 'Same Google login as Flux. Calendar already feeds your planner snapshot; Flux AI assumes you use it.', needsGoogle: true },
    { id: 'google_docs', group: 'Google', icon: '📄', title: 'Google Docs & Drive', hint: 'No live file read yet. When on, Flux AI treats Docs/Drive as your doc workspace — ask you to paste links or excerpts.', needsGoogle: false },
    { id: 'youtube', group: 'Google', icon: '▶', title: 'YouTube', hint: 'No OAuth yet. When on, Flux AI can cite study playlists, explain concepts visually, and help you scaffold watch notes.', needsGoogle: false },
    { id: 'canvas', group: 'Planner', icon: '🎓', title: 'Canvas LMS', hint: 'Uses your Canvas tab connection + pinned reader text.', needsGoogle: false },
    { id: 'notion_like', group: 'Productivity', icon: '📝', title: 'Wikis & notes apps', hint: 'Generic toggle for Notion/Obsidian style notes — Flux invites pasting snippets and keeps structure suggestions tool-agnostic.', needsGoogle: false },
    { id: 'github', group: 'Build', icon: '⌘', title: 'Code & repos', hint: 'When on, Flux can help interpret errors, scaffold commits, and review diffs — you paste snippets or CI logs.', needsGoogle: false },
    { id: 'slack_discord', group: 'Teams', icon: '💬', title: 'Slack / Discord', hint: 'No API keys stored. Helps draft messages or summarize threads when you paste them.', needsGoogle: false },
  ];

  /** @typedef {{enabled?:boolean,live?:boolean,note?:string}} ConnItem */

  let _mounted = false;
  let _view = 'chat';

  function lsGet(k, d) {
    try {
      var v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }

  function getItemsState() {
    var o = lsGet(STORAGE_ITEMS, {});
    if (!o || typeof o !== 'object') o = {};
    return o;
  }
  function saveItemsState(items) {
    lsSet(STORAGE_ITEMS, items);
  }

  function getCustomSlots() {
    var a = lsGet(STORAGE_CUSTOM, []);
    return Array.isArray(a) ? a : [];
  }
  function saveCustomSlots(arr) {
    lsSet(STORAGE_CUSTOM, arr.slice(0, 24));
  }

  function getModelRoute() {
    var d = lsGet(STORAGE_MODEL, {});
    var out = {};
    out.mode =
      typeof d.mode === 'string' && d.mode.length ? d.mode : 'flux_default';
    out.apiKey = typeof d.apiKey === 'string' ? d.apiKey : '';
    out.baseUrl = typeof d.baseUrl === 'string' ? d.baseUrl : '';
    out.modelId = typeof d.modelId === 'string' ? d.modelId : '';
    return out;
  }

  function googleLive() {
    try {
      return !!(
        (typeof gmailToken !== 'undefined' && gmailToken) ||
        sessionStorage.getItem('flux_gmail_token') ||
        (typeof currentUser !== 'undefined' && currentUser?.app_metadata?.provider === 'google')
      );
    } catch (e) {
      return false;
    }
  }

  function canvasLive() {
    try {
      return !!(window.CanvasState && CanvasState.connected);
    } catch (e) {
      return false;
    }
  }

  function toggleItem(id, on) {
    var st = getItemsState();
    st[id] = st[id] || {};
    st[id].enabled = !!on;
    saveItemsState(st);
    renderConnectionsPanel(true);
    if (typeof showToast === 'function') {
      var label = id;
      DEFS.forEach(function (d) {
        if (d.id === id) label = d.title;
      });
      showToast(on ? label + ' · on for Flux AI' : label + ' · off', 'info');
    }
  }

  function addCustomSlot() {
    var label = (prompt('Short name for this connection (e.g. “Chem lab sensor API”):') || '').trim();
    if (!label) return;
    var slots = getCustomSlots();
    slots.unshift({
      id: 'cust_' + Date.now(),
      label: label,
      hint: '',
      enabled: true,
    });
    saveCustomSlots(slots);
    renderConnectionsPanel(true);
  }

  function updateCustomHint(id, text) {
    var slots = getCustomSlots().map(function (s) {
      if (s.id === id) s.hint = String(text || '').slice(0, 800);
      return s;
    });
    saveCustomSlots(slots);
  }

  function saveModelForm() {
    var modeEl = document.getElementById('fluxAiConnModelMode');
    var keyEl = document.getElementById('fluxAiConnApiKey');
    var baseEl = document.getElementById('fluxAiConnBaseUrl');
    var midEl = document.getElementById('fluxAiConnModelId');
    lsSet(STORAGE_MODEL, {
      mode: modeEl ? modeEl.value : 'flux_default',
      apiKey: keyEl ? keyEl.value.trim() : '',
      baseUrl: baseEl ? baseEl.value.trim() : '',
      modelId: midEl ? midEl.value.trim() : '',
    });
    if (typeof showToast === 'function') showToast('Model route saved locally on this device', 'success');
  }

  /** @returns {Record<string,string>} */
  function itemNoteDefaults() {
    return {
      google_docs: 'School essays + lab drafts live here.',
      youtube: 'Exam review playlists for Calc + Bio.',
      github: `Private course repo.`,
    };
  }

  function gmailSnippetBlock() {
    if (!getItemsState().gmail || !getItemsState().gmail.enabled) return '';
    var tokOk = !!(typeof gmailToken !== 'undefined' && gmailToken);
    if (!tokOk) return '\n(Gmail toggle is ON but Google mail is not linked — ask the student to sign in with Google.)\n';
    if (typeof gmailEmails === 'undefined' || !gmailEmails || !gmailEmails.length)
      return '\n(Gmail is linked — inbox summary not fetched yet this session. Offer to summarize once they navigate to Gmail in Canvas/mobile or resend message.)\n';
    var lines = gmailEmails.slice(0, 12).map(function (e, i) {
      var sub = (e.subject || '(no subject)').slice(0, 120);
      var from = (e.from || '').slice(0, 80);
      return (i + 1) + '. ' + sub + (from ? ' — ' + from : '');
    });
    return `\nRecent inbox subjects/titles ONLY (privacy-trimmed; do not infer body content):\n${lines.join('\n')}\n`;
  }

  function appendToSystem(base) {
    var st = getItemsState();
    var active = DEFS.filter(function (d) {
      return st[d.id] && st[d.id].enabled;
    });
    var custom = getCustomSlots().filter(function (c) {
      return c.enabled;
    });
    var mr = getModelRoute();
    var parts = [];

    parts.push(
      '\n\n---\n## Flux AI — Connections (workspace)\n' +
        'The student curated these links. Honour them naturally: cite what is live in Flux, advise what requires paste/OAuth,\n' +
        'never claim you executed an external API unless data is quoted below.\n'
    );

    if (mr.mode === 'openai_compatible')
      parts.push('\nRouting: Responses use the student\'s OpenAI-compatible API (bring-your-own-key).\n');
    else if (mr.mode === 'anthropic_messages')
      parts.push('\nRouting: Responses use the student\'s Anthropic Claude API key (bring-your-own-key).\n');
    else parts.push('\nRouting: Responses use Flux default cloud model (Groq/Gemini for vision).\n');

    DEFS.forEach(function (d) {
      var row = st[d.id];
      if (!row || !row.enabled) return;
      var live = '';
      if (d.id === 'canvas') live = canvasLive() ? '(Live: Canvas connector active.) ' : '(Not linked: Canvas not connected.) ';
      if (d.needsGoogle && d.id === 'gmail') live = googleLive() ? '(Google session cached.) ' : '(Sign in required.) ';
      if (d.needsGoogle && d.id === 'gcalendar') live = googleLive() ? '(Google session cached.) ' : '(Sign in for calendar scope.) ';
      var note = (row.note || itemNoteDefaults()[d.id] || '').trim();
      parts.push('- **' + d.title + '** ' + live + d.hint + (note ? '\n  Student note: ' + note : '') + '\n');
    });

    custom.forEach(function (c) {
      parts.push(
        '- **' + c.label + '** (custom) ' +
          (c.hint ? 'What Flux should assume: ' + c.hint : 'Flux should ask for URLs or pasted context when relevant.') +
          '\n'
      );
    });

    parts.push(gmailSnippetBlock());

    return base + parts.join('');
  }

  /** @returns {Record<string, unknown>} */
  function getRoutingPayload() {
    var r = getModelRoute();
    if (!r.mode || r.mode === 'flux_default') return {};
    var key = (r.apiKey || '').trim();
    var mid = (r.modelId || '').trim();
    if (!key || !mid) return {};
    if (r.mode === 'openai_compatible') {
      return {
        routing: {
          mode: 'openai_compatible',
          openaiCompatible: {
            apiKey: key,
            baseUrl: (r.baseUrl || '').trim(),
            model: mid,
          },
        },
      };
    }
    if (r.mode === 'anthropic_messages') {
      return {
        routing: {
          mode: 'anthropic_messages',
          anthropic: {
            apiKey: key,
            model: mid,
          },
        },
      };
    }
    return {};
  }

  /** BYOK incomplete → block send */
  function isRoutingConfigured() {
    var r = getModelRoute();
    if (!r.mode || r.mode === 'flux_default') return true;
    var key = (r.apiKey || '').trim();
    var mid = (r.modelId || '').trim();
    return !!(key && mid);
  }

  async function beforeSend() {
    var st = getItemsState().gmail;
    if (!st || !st.enabled) return;
    try {
      if (typeof refreshGmailEmailsFromApi === 'function') await refreshGmailEmailsFromApi();
    } catch (e) {}
  }

  function setView(which) {
    _view = which === 'connections' ? 'connections' : 'chat';
    var paneC = document.getElementById('fluxAiPaneChat');
    var paneN = document.getElementById('fluxAiPaneConnections');
    var bC = document.getElementById('fluxAiViewBtnChat');
    var bN = document.getElementById('fluxAiViewBtnConn');
    if (!paneC || !paneN) return;
    var onConn = _view === 'connections';
    paneC.hidden = onConn ? true : false;
    paneN.hidden = onConn ? false : true;
    paneC.style.display = onConn ? 'none' : '';
    paneN.style.display = onConn ? '' : 'none';
    paneN.setAttribute('aria-hidden', onConn ? 'false' : 'true');
    if (bC) {
      bC.classList.toggle('flux-ai-view-tab--active', !onConn);
      bC.setAttribute('aria-selected', onConn ? 'false' : 'true');
    }
    if (bN) {
      bN.classList.toggle('flux-ai-view-tab--active', onConn);
      bN.setAttribute('aria-selected', onConn ? 'true' : 'false');
    }
    paneC.setAttribute('aria-hidden', onConn ? 'true' : 'false');
    if (!onConn) document.getElementById('aiInput')?.focus();
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderConnectionsPanel(mountInnerOnly) {
    var root = document.getElementById('fluxAiPaneConnections');
    if (!root) return;
    root.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'flux-conn-head';
    header.innerHTML =
      '<div class="flux-conn-kicker">Workspace</div>' +
      '<h2 class="flux-conn-title">Connections</h2>' +
      '<p class="flux-conn-desc">Flux AI reads your planner + anything you activate here — like Claude’s connectors.\n      Native Google scopes power Gmail summaries when signed in.\n      You can route chats through <strong>OpenAI-compatible</strong> or <strong>Anthropic</strong> endpoints with keys that stay only in this browser until you delete them.\n      Add “anything else” via custom pins so Flux behaves like it knows your tools.</p>';
    root.appendChild(header);

    var grid = document.createElement('div');
    grid.className = 'flux-conn-grid';

    var st = getItemsState();
    DEFS.forEach(function (d) {
      var row = st[d.id] || {};
      var en = !!row.enabled;
      var badge = '';
      if (d.id === 'canvas') badge = canvasLive() ? '<span class="flux-conn-badge flux-conn-badge--ok">live</span>' : '<span class="flux-conn-badge">setup</span>';
      if (d.id === 'gmail' || d.id === 'gcalendar')
        badge = googleLive() ? '<span class="flux-conn-badge flux-conn-badge--ok">google</span>' : '<span class="flux-conn-badge">connect</span>';

      var noteVal = row.note || '';
      var card = document.createElement('div');
      card.className = 'flux-conn-card' + (en ? ' flux-conn-card--on' : '');
      card.innerHTML =
        '<div class="flux-conn-card-top">' +
        '<span class="flux-conn-ico">' +
        esc(d.icon) +
        '</span>' +
        '<div class="flux-conn-meta">' +
        '<div class="flux-conn-name">' +
        esc(d.title) +
        '</div>' +
        '<div class="flux-conn-group">' +
        esc(d.group) +
        '</div></div>' +
        '<label class="flux-conn-toggle"><input type="checkbox" aria-label="' +
        esc(d.title) +
        '" data-conn="' +
        esc(d.id) +
        '"' +
        (en ? ' checked' : '') +
        '> <span>Use in Flux AI</span></label></div>' +
        badge +
        '<p class="flux-conn-hint">' +
        esc(d.hint) +
        '</p>' +
        (d.needsGoogle && !googleLive() && !en
          ? '<button type="button" class="flux-conn-mini">Sign in with Google</button>'
          : '') +
        '<label class="flux-conn-mini-label">Context note<span class="visually-hidden"> for ' +
        esc(d.title) +
        '</span></label>' +
        '<textarea class="flux-conn-mini-ta" data-conn-note="' +
        esc(d.id) +
        '" rows="2" maxlength="560" placeholder="Optional hint for Flux (subjects, course codes, quirks…)"></textarea>';

      card.querySelector('textarea').value = noteVal;
      var cb = card.querySelector('input[type="checkbox"]');
      if (cb)
        cb.addEventListener('change', function () {
          toggleItem(d.id, cb.checked);
        });
      var mini = card.querySelector('.flux-conn-mini');
      if (mini && typeof signInWithGoogle === 'function') {
        mini.onclick = function () {
          signInWithGoogle();
        };
      }
      grid.appendChild(card);
    });

    root.appendChild(grid);

    grid.querySelectorAll('textarea[data-conn-note]').forEach(function (ta) {
      var id = ta.getAttribute('data-conn-note');
      ta.addEventListener(
        'change',
        function () {
          var s = getItemsState();
          s[id] = s[id] || {};
          s[id].note = ta.value.trim();
          s[id].enabled = !!document.querySelector('input[data-conn="' + id + '"]:checked');
          saveItemsState(s);
        },
        false
      );
    });

    var customs = document.createElement('section');
    customs.className = 'flux-conn-section';
    customs.innerHTML =
      '<div class="flux-conn-section-head"><h3>Paste-friendly &amp; “anything” hooks</h3>' +
      '<button type="button" class="flux-conn-add" id="fluxAiConnAddCustom">Add custom pin</button></div>' +
      '<p class="flux-conn-micro">Flux can’t magically call undocumented APIs.\nGive it a memorable label plus what to assume so answers feel Claude-native.</p>' +
      '<div id="fluxAiConnCustomList" class="flux-conn-custom-list"></div>';
    root.appendChild(customs);

    var addBtnEl = document.getElementById('fluxAiConnAddCustom');
    if (addBtnEl) addBtnEl.addEventListener('click', addCustomSlot);
    var list = document.getElementById('fluxAiConnCustomList');
    getCustomSlots().forEach(function (slot) {
      var rowEl = document.createElement('div');
      rowEl.className = 'flux-conn-custom';
      rowEl.innerHTML =
        '<div class="flux-conn-custom-top">' +
        '<strong>' +
        esc(slot.label) +
        '</strong>' +
        '<label class="flux-conn-toggle sm"><input type="checkbox"' +
        (slot.enabled ? ' checked' : '') +
        '> On</label></div>' +
        '<textarea rows="3" maxlength="800" placeholder="What Flux should know (API shape, dashboards, MCP servers, Zapier…)"></textarea>' +
        '<button type="button" class="flux-conn-rm">Remove</button>';

      rowEl.querySelector('textarea').value = slot.hint || '';
      var cbOn = rowEl.querySelector('input[type="checkbox"]');
      cbOn.addEventListener('change', function () {
        var slots = getCustomSlots().map(function (x) {
          if (x.id === slot.id) x.enabled = cbOn.checked;
          return x;
        });
        saveCustomSlots(slots);
      });
      rowEl.querySelector('textarea').addEventListener(
        'change',
        function (e) {
          updateCustomHint(slot.id, e.target.value);
        },
        false
      );
      rowEl.querySelector('.flux-conn-rm').onclick = function () {
        saveCustomSlots(getCustomSlots().filter(function (x) {
          return x.id !== slot.id;
        }));
        renderConnectionsPanel(true);
      };
      list.appendChild(rowEl);
    });

    var routing = document.createElement('section');
    routing.className = 'flux-conn-section flux-conn-routing';
    var mr = getModelRoute();
    routing.innerHTML =
      '<div class="flux-conn-section-head"><h3>Models & routing</h3></div>' +
      '<div class="flux-conn-micro warn">⚠ Bring-your-own keys live in this browser\'s storage and are forwarded over HTTPS\nthrough Flux\'s relay. Clear them anytime. Avoid shared/public devices.</div>' +
      '<label class="flux-conn-mini-label">Mode</label>' +
      '<select id="fluxAiConnModelMode" class="flux-conn-select">' +
      `<option value="flux_default"${mr.mode === 'flux_default' ? ' selected' : ''}>Flux default · Groq (Gemini vision for photos)</option>` +
      `<option value="openai_compatible"${mr.mode === 'openai_compatible' ? ' selected' : ''}>OpenAI-compatible API (OpenAI, Groq, Together, LM Studio URL…)</option>` +
      `<option value="anthropic_messages"${mr.mode === 'anthropic_messages' ? ' selected' : ''}>Anthropic Messages · Claude models</option>` +
      '</select>' +
      '<label class="flux-conn-mini-label">API key</label>' +
      '<input type="password" id="fluxAiConnApiKey" class="flux-conn-input" autocomplete="new-password" placeholder="sk-ant-… · sk-…">' +
      '<label class="flux-conn-mini-label">OpenAI-compat base URL (optional)</label>' +
      '<input type="url" id="fluxAiConnBaseUrl" class="flux-conn-input" placeholder="https://api.openai.com/v1">' +
      '<label class="flux-conn-mini-label">Model id</label>' +
      '<input type="text" id="fluxAiConnModelId" class="flux-conn-input" placeholder="gpt-4o-mini · claude-sonnet-4-20250514 · llama-3.3-70b-versatile">' +
      '<div class="flux-conn-actions"><button type="button" class="flux-conn-save" id="fluxAiConnSaveModel">Save routing</button>' +
      '<button type="button" class="flux-conn-ghost" id="fluxAiConnClearModel">Clear keys</button></div>';

    root.appendChild(routing);

    var kIn = document.getElementById('fluxAiConnApiKey');
    var bIn = document.getElementById('fluxAiConnBaseUrl');
    var mIn = document.getElementById('fluxAiConnModelId');
    if (kIn) kIn.value = mr.apiKey || '';
    if (bIn) bIn.value = mr.baseUrl || '';
    if (mIn) mIn.value = mr.modelId || '';
    var saveBtn = document.getElementById('fluxAiConnSaveModel');
    if (saveBtn) saveBtn.addEventListener('click', saveModelForm);
    var clrBtn = document.getElementById('fluxAiConnClearModel');
    if (clrBtn) {
      clrBtn.onclick = function () {
        lsSet(STORAGE_MODEL, { mode: 'flux_default', apiKey: '', baseUrl: '', modelId: '' });
        if (typeof showToast === 'function') showToast('Cleared routing + keys locally', 'info');
        renderConnectionsPanel(true);
      };
    }
  }

  function bindChrome() {
    document.querySelectorAll('[data-flux-ai-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var w = btn.getAttribute('data-flux-ai-view');
        setView(w === 'connections' ? 'connections' : 'chat');
      });
    });
  }

  function init() {
    if (_mounted) return;
    _mounted = true;
    bindChrome();
    renderConnectionsPanel(true);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }

  window.openFluxConnections = function () {
    try {
      nav('ai');
    } catch (e) {}
    setView('connections');
  };

  window.FluxAIConnections = {
    init: init,
    setView: setView,
    appendToSystem: appendToSystem,
    getRoutingPayload: getRoutingPayload,
    isRoutingConfigured: isRoutingConfigured,
    beforeSend: beforeSend,
    renderConnectionsPanel: renderConnectionsPanel,
    getActiveView: function () {
      return _view;
    },
  };
})();
