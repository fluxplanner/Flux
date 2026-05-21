/**
 * P13.4 — Focus intent note before deep work / timer sessions.
 * Flag: enable_focus_intent (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_focus_intent';
  const STORE_KEY = 'flux_focus_intents_v1';
  const MAX_RECENT = 8;
  let _activeIntent = null;
  let _wrapped = false;

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

  function getStore() {
    const s = load(STORE_KEY, {});
    return s && typeof s === 'object' ? s : { history: [], recent: [] };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('focusIntents', data);
    } catch (_) {}
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    save(STORE_KEY, data);
  }

  function getCloudSlice() {
    return getStore();
  }

  function recentIntents() {
    const r = getStore().recent;
    return Array.isArray(r) ? r.filter(Boolean).slice(0, MAX_RECENT) : [];
  }

  function rememberIntent(text) {
    const t = String(text || '').trim();
    if (!t) return;
    const store = getStore();
    const recent = [t, ...(store.recent || []).filter((x) => x !== t)].slice(0, MAX_RECENT);
    persistStore({ ...store, recent });
  }

  function recordSession(entry) {
    const store = getStore();
    const history = Array.isArray(store.history) ? store.history.slice() : [];
    history.unshift({
      id: Date.now(),
      ...entry,
      recordedAt: Date.now(),
    });
    while (history.length > 40) history.pop();
    persistStore({ ...store, history, recent: store.recent || [] });
    if (entry.intent) rememberIntent(entry.intent);
  }

  function taskMeta(taskId) {
    const tasks = typeof window.tasks !== 'undefined' ? window.tasks : [];
    const t = taskId ? tasks.find((x) => String(x.id) === String(taskId)) : null;
    return {
      taskId: t?.id ?? taskId ?? null,
      taskName: t?.name || '',
      subject: t?.subject || '',
    };
  }

  function promptIntent(ctx) {
    return new Promise((resolve) => {
      if (!enabled()) {
        resolve('');
        return;
      }
      if (document.getElementById('fluxFocusIntentModal')) {
        resolve(false);
        return;
      }

      const meta = taskMeta(ctx?.taskId);
      const recents = recentIntents();
      const modal = document.createElement('div');
      modal.id = 'fluxFocusIntentModal';
      modal.className = 'flux-focus-intent-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', T('intent.title'));

      const chips = recents.length
        ? recents
            .map(
              (r) =>
                `<button type="button" class="flux-intent-chip">${esc(r)}</button>`
            )
            .join('')
        : `<span class="flux-intent-muted">${esc(T('intent.no_recent'))}</span>`;

      modal.innerHTML = `<div class="flux-focus-intent-dialog">
        <div class="flux-intent-kicker">${esc(ctx?.mode === 'timer' ? T('intent.kicker_timer') : T('intent.kicker_deep'))}</div>
        <h3 class="flux-intent-heading">${esc(T('intent.title'))}</h3>
        ${meta.taskName ? `<p class="flux-intent-task">${esc(meta.taskName)}</p>` : ''}
        <label class="modal-micro-label" for="fluxFocusIntentInput">${esc(T('intent.label'))}</label>
        <textarea id="fluxFocusIntentInput" rows="3" placeholder="${esc(T('intent.placeholder'))}"></textarea>
        <div class="flux-intent-recents"><span class="flux-intent-recents-label">${esc(T('intent.recents'))}</span><div class="flux-intent-chip-row">${chips}</div></div>
        <div class="flux-intent-actions">
          <button type="button" class="btn-sec" id="fluxIntentCancel">${esc(T('intent.cancel'))}</button>
          <button type="button" class="btn-sec" id="fluxIntentSkip">${esc(T('intent.skip'))}</button>
          <button type="button" id="fluxIntentStart">${esc(T('intent.start'))}</button>
        </div>
      </div>`;

      const close = (val) => {
        modal.remove();
        resolve(val);
      };

      modal.addEventListener('click', (e) => {
        if (e.target === modal) close(false);
      });
      modal.querySelector('#fluxIntentCancel')?.addEventListener('click', () => close(false));
      modal.querySelector('#fluxIntentSkip')?.addEventListener('click', () => close(''));
      modal.querySelector('#fluxIntentStart')?.addEventListener('click', () => {
        const v = modal.querySelector('#fluxFocusIntentInput')?.value || '';
        close(String(v).trim());
      });
      modal.querySelectorAll('.flux-intent-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          const input = modal.querySelector('#fluxFocusIntentInput');
          if (input) input.value = btn.textContent || '';
          input?.focus();
        });
      });

      document.body.appendChild(modal);
      const input = modal.querySelector('#fluxFocusIntentInput');
      input?.focus();
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(false);
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          close(String(input.value || '').trim());
        }
      });
    });
  }

  function injectDeepWorkIntent() {
    if (!_activeIntent?.text) return;
    const overlay = document.getElementById('deepWorkOverlay');
    if (!overlay) return;
    if (overlay.querySelector('.flux-dw-intent')) return;
    const block = document.createElement('div');
    block.className = 'flux-dw-intent';
    block.textContent = _activeIntent.text;
    const timeEl = overlay.querySelector('#dwTime');
    if (timeEl) timeEl.insertAdjacentElement('beforebegin', block);
    else overlay.querySelector('div')?.appendChild(block);
  }

  function logDeepWorkSession(completed) {
    if (!completed || !_activeIntent) return;
    const task =
      typeof window.tasks !== 'undefined'
        ? window.tasks.find((x) => String(x.id) === String(_activeIntent.taskId))
        : null;
    const mins = task?.estTime || 25;
    const ts = typeof window.todayStr === 'function' ? window.todayStr() : '';
    const entry = {
      date: ts,
      mins,
      subject: task?.subject || _activeIntent.subject || '',
      hour: new Date().getHours(),
      intent: _activeIntent.text || '',
      mode: 'deep_work',
      taskId: _activeIntent.taskId,
    };
    if (typeof window.sessionLog !== 'undefined' && Array.isArray(window.sessionLog)) {
      window.sessionLog.push(entry);
      save('flux_session_log', window.sessionLog);
      try {
        if (typeof window.syncKey === 'function') window.syncKey('sessionLog', window.sessionLog);
      } catch (_) {}
      try {
        if (typeof window.renderFocusHeatmap === 'function') window.renderFocusHeatmap();
      } catch (_) {}
    }
    recordSession({
      intent: _activeIntent.text,
      mode: 'deep_work',
      taskId: _activeIntent.taskId,
      taskName: _activeIntent.taskName,
      mins,
      completed: true,
    });
  }

  function attachSessionHook() {
    if (window._fluxIntentSessionHook) return;
    if (typeof window.FluxBus === 'undefined' || !FluxBus.on) return;
    FluxBus.on('session_ended', () => {
      if (!_activeIntent || _activeIntent.mode !== 'timer') return;
      try {
        const log = typeof window.sessionLog !== 'undefined' ? window.sessionLog : load('flux_session_log', []);
        const last = log[log.length - 1];
        if (last && _activeIntent.text) last.intent = _activeIntent.text;
        if (typeof window.sessionLog !== 'undefined') window.sessionLog = log;
        save('flux_session_log', log);
        recordSession({
          intent: _activeIntent.text,
          mode: 'timer',
          taskId: _activeIntent.taskId,
          taskName: _activeIntent.taskName,
          mins: last?.mins,
          completed: true,
        });
      } catch (_) {}
      _activeIntent = null;
    });
    window._fluxIntentSessionHook = true;
  }

  function wrapFocusEntrypoints() {
    if (_wrapped) return;

    const origDeep = window.startDeepWork;
    if (typeof origDeep === 'function') {
      window.startDeepWork = async function (taskId) {
        if (!enabled()) return origDeep.apply(this, arguments);
        const intent = await promptIntent({ mode: 'deep_work', taskId });
        if (intent === false) return;
        const meta = taskMeta(taskId);
        _activeIntent = {
          text: intent,
          mode: 'deep_work',
          taskId: meta.taskId,
          taskName: meta.taskName,
          subject: meta.subject,
          startedAt: Date.now(),
        };
        origDeep.call(this, taskId);
        setTimeout(injectDeepWorkIntent, 30);
      };
    }

    const origEnd = window.endDeepWork;
    if (typeof origEnd === 'function') {
      window.endDeepWork = function (completed) {
        if (enabled() && _activeIntent?.mode === 'deep_work') {
          try {
            logDeepWorkSession(!!completed);
          } catch (_) {}
          _activeIntent = null;
        }
        return origEnd.apply(this, arguments);
      };
    }

    const origTimerTask = window.startTimerFromTask;
    if (typeof origTimerTask === 'function') {
      window.startTimerFromTask = async function (id) {
        if (!enabled()) return origTimerTask.apply(this, arguments);
        const intent = await promptIntent({ mode: 'timer', taskId: id });
        if (intent === false) return;
        const meta = taskMeta(id);
        _activeIntent = {
          text: intent,
          mode: 'timer',
          taskId: meta.taskId,
          taskName: meta.taskName,
          subject: meta.subject,
          startedAt: Date.now(),
        };
        return origTimerTask.call(this, id);
      };
    }

    _wrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const label = T('intent.palette');
    const needle = (q || '').toLowerCase().trim();
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !['focus', 'intent', 'deep'].some((k) => needle.includes(k)) &&
      !(window.FluxCmdPaletteV2?.matchesQuery?.(needle, label, '', ['focus', 'intent']))
    ) {
      return [];
    }
    return [
      {
        id: 'focus:intent',
        icon: '🎯',
        label,
        cat: 'Focus',
        _keys: ['focus', 'intent', 'deep work'],
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.startDeepWork === 'function') window.startDeepWork();
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapFocusEntrypoints();
    attachSessionHook();
    return true;
  }

  window.FluxFocusIntent = {
    FLAG,
    enabled,
    promptIntent,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
